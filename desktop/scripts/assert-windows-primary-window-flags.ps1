[CmdletBinding()]
param(
    [string] $PackageName,
    [string] $PackageFamilyName,
    [string] $PackageFullName,
    [int] $TimeoutSeconds = 30
)

$ErrorActionPreference = "Stop"

function Resolve-TargetPackage {
    if ([string]::IsNullOrWhiteSpace($PackageName) -and [string]::IsNullOrWhiteSpace($PackageFamilyName) -and [string]::IsNullOrWhiteSpace($PackageFullName)) {
        throw "Pass -PackageName, -PackageFamilyName, or -PackageFullName."
    }

    if ([string]::IsNullOrWhiteSpace($PackageName)) {
        $packages = @(Get-AppxPackage -ErrorAction Stop)
    }
    else {
        $packages = @(Get-AppxPackage -Name $PackageName -ErrorAction Stop)
    }

    if (-not [string]::IsNullOrWhiteSpace($PackageFullName)) {
        $packages = @($packages | Where-Object { $_.PackageFullName -eq $PackageFullName })
    }
    if (-not [string]::IsNullOrWhiteSpace($PackageFamilyName)) {
        $packages = @($packages | Where-Object { $_.PackageFamilyName -eq $PackageFamilyName })
    }

    if ($packages.Count -eq 0) {
        throw "Package not found: name=$PackageName family=$PackageFamilyName fullName=$PackageFullName"
    }
    if ($packages.Count -gt 1 -and [string]::IsNullOrWhiteSpace($PackageFamilyName) -and [string]::IsNullOrWhiteSpace($PackageFullName)) {
        $matches = $packages | ForEach-Object { "$($_.PackageFullName) [$($_.PackageFamilyName)]" }
        throw "Package name $PackageName matched multiple packages; pass -PackageFamilyName or -PackageFullName.`n$($matches -join [Environment]::NewLine)"
    }

    return $packages |
        Sort-Object -Property Version -Descending |
        Select-Object -First 1
}

$package = Resolve-TargetPackage
if ($null -eq $package) {
    throw "Package not found: $PackageName"
}

$nativeSource = @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class WindowFlags {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

    [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW", SetLastError = true)]
    public static extern IntPtr GetWindowLongPtr64(IntPtr hWnd, int nIndex);

    [DllImport("user32.dll", EntryPoint = "GetWindowLongW", SetLastError = true)]
    public static extern int GetWindowLong32(IntPtr hWnd, int nIndex);

    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern int GetWindowTextW(IntPtr hWnd, StringBuilder text, int maxCount);

    public static IntPtr GetWindowLongPtr(IntPtr hWnd, int nIndex) {
        return IntPtr.Size == 8 ? GetWindowLongPtr64(hWnd, nIndex) : new IntPtr(GetWindowLong32(hWnd, nIndex));
    }
}
"@

if (-not ("WindowFlags" -as [type])) {
    Add-Type -TypeDefinition $nativeSource
}

function Get-WindowTitle {
    param([IntPtr] $WindowHandle)

    $builder = New-Object System.Text.StringBuilder 1024
    [void] [WindowFlags]::GetWindowTextW($WindowHandle, $builder, $builder.Capacity)
    return $builder.ToString()
}

function Get-PackageWindows {
    param($Package)

    $windows = New-Object System.Collections.Generic.List[object]
    $installLocation = [System.IO.Path]::GetFullPath($Package.InstallLocation)
    [WindowFlags]::EnumWindows({
        param([IntPtr] $windowHandle, [IntPtr] $lParam)

        if (-not [WindowFlags]::IsWindowVisible($windowHandle)) {
            return $true
        }

        $processId = 0
        [void] [WindowFlags]::GetWindowThreadProcessId($windowHandle, [ref] $processId)
        if ($processId -eq 0) {
            return $true
        }

        try {
            $process = Get-Process -Id $processId -ErrorAction Stop
            $processPath = [System.IO.Path]::GetFullPath($process.Path)
        }
        catch {
            return $true
        }

        if (-not $processPath.StartsWith($installLocation, [System.StringComparison]::OrdinalIgnoreCase)) {
            return $true
        }

        $extendedStyle = [WindowFlags]::GetWindowLongPtr($windowHandle, -20).ToInt64()
        $windows.Add([pscustomobject]@{
            Handle = $windowHandle
            ProcessId = $processId
            ProcessName = $process.ProcessName
            Title = Get-WindowTitle -WindowHandle $windowHandle
            ExtendedStyle = $extendedStyle
        })
        return $true
    }, [IntPtr]::Zero) | Out-Null

    return $windows
}

function Stop-PackageProcesses {
    param($Package)

    $installLocation = [System.IO.Path]::GetFullPath($Package.InstallLocation)
    Get-Process |
        Where-Object {
            try {
                $processPath = [System.IO.Path]::GetFullPath($_.Path)
                return $processPath.StartsWith($installLocation, [System.StringComparison]::OrdinalIgnoreCase)
            }
            catch {
                return $false
            }
        } |
        ForEach-Object {
            Stop-Process -Id $_.Id -Force -ErrorAction Stop
        }
}

Stop-PackageProcesses -Package $package
Start-Sleep -Milliseconds 500

$existingWindowHandles = New-Object System.Collections.Generic.HashSet[string]
foreach ($existingWindow in @(Get-PackageWindows -Package $package)) {
    [void] $existingWindowHandles.Add([string] $existingWindow.Handle)
}

$appUserModelId = "$($package.PackageFamilyName)!App"
Start-Process -FilePath "explorer.exe" -ArgumentList "shell:AppsFolder\$appUserModelId" -WindowStyle Hidden
$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
$windows = @()
do {
    Start-Sleep -Milliseconds 500
    $windows = @(Get-PackageWindows -Package $package | Where-Object { -not $existingWindowHandles.Contains([string] $_.Handle) })
    if ($windows.Count -gt 0) {
        break
    }
} while ((Get-Date) -lt $deadline)

if ($windows.Count -eq 0) {
    throw "No new visible primary window found for package $($package.PackageFullName)."
}

$wsExAppWindow = 0x00040000
$wsExNoActivate = 0x08000000
$validWindow = $windows | Where-Object {
    ($_.ExtendedStyle -band $wsExAppWindow) -ne 0 -and
    ($_.ExtendedStyle -band $wsExNoActivate) -eq 0
} | Select-Object -First 1

if ($null -eq $validWindow) {
    $details = $windows | ForEach-Object {
        "$($_.ProcessName)[$($_.ProcessId)] hwnd=$($_.Handle) exStyle=0x$($_.ExtendedStyle.ToString('x')) title=$($_.Title)"
    }
    throw "No visible package window had WS_EX_APPWINDOW without WS_EX_NOACTIVATE.`n$($details -join [Environment]::NewLine)"
}

Write-Output "Window flags ok: $($validWindow.ProcessName)[$($validWindow.ProcessId)] hwnd=$($validWindow.Handle) exStyle=0x$($validWindow.ExtendedStyle.ToString('x'))"

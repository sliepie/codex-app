import { execFileSync } from "node:child_process";
import { parseArgs, resolveTargetPackage } from "./store-owl-shell-common.js";

function psString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const timeoutSeconds = Number.parseInt(args.get("timeout-seconds") ?? "30", 10);
  const appxPackage = resolveTargetPackage({
    packageName: args.get("package-name"),
    packageFamilyName: args.get("package-family-name"),
    packageFullName: args.get("package-full-name"),
  });
  const script = `
$ErrorActionPreference = "Stop"
$PackageFullName = ${psString(appxPackage.packageFullName)}
$PackageFamilyName = ${psString(appxPackage.packageFamilyName)}
$InstallLocation = [System.IO.Path]::GetFullPath(${psString(appxPackage.installLocation)})
$TimeoutSeconds = ${timeoutSeconds}
$nativeSource = @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class WindowFlags {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern IntPtr GetWindow(IntPtr hWnd, uint uCmd);
  [DllImport("user32.dll", SetLastError = true)] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
  [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW", SetLastError = true)] public static extern IntPtr GetWindowLongPtr64(IntPtr hWnd, int nIndex);
  [DllImport("user32.dll", EntryPoint = "GetWindowLongW", SetLastError = true)] public static extern int GetWindowLong32(IntPtr hWnd, int nIndex);
  [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)] public static extern int GetWindowTextW(IntPtr hWnd, StringBuilder text, int maxCount);
  public static IntPtr GetWindowLongPtr(IntPtr hWnd, int nIndex) {
    return IntPtr.Size == 8 ? GetWindowLongPtr64(hWnd, nIndex) : new IntPtr(GetWindowLong32(hWnd, nIndex));
  }
}
"@
if (-not ("WindowFlags" -as [type])) { Add-Type -TypeDefinition $nativeSource }
function Get-WindowTitle([IntPtr] $WindowHandle) {
  $builder = New-Object System.Text.StringBuilder 1024
  [void] [WindowFlags]::GetWindowTextW($WindowHandle, $builder, $builder.Capacity)
  return $builder.ToString()
}
function Get-PackageWindows {
  $windows = New-Object System.Collections.Generic.List[object]
  [WindowFlags]::EnumWindows({
    param([IntPtr] $windowHandle, [IntPtr] $lParam)
    if (-not [WindowFlags]::IsWindowVisible($windowHandle)) { return $true }
    $processId = 0
    [void] [WindowFlags]::GetWindowThreadProcessId($windowHandle, [ref] $processId)
    if ($processId -eq 0) { return $true }
    try {
      $process = Get-Process -Id $processId -ErrorAction Stop
      $processPath = [System.IO.Path]::GetFullPath($process.Path)
    } catch {
      return $true
    }
    if (-not $processPath.StartsWith($InstallLocation, [System.StringComparison]::OrdinalIgnoreCase)) { return $true }
    $windows.Add([pscustomobject]@{
      Handle = $windowHandle
      Owner = [WindowFlags]::GetWindow($windowHandle, 4).ToInt64()
      ProcessId = $processId
      ProcessName = $process.ProcessName
      Title = Get-WindowTitle -WindowHandle $windowHandle
      ExtendedStyle = [WindowFlags]::GetWindowLongPtr($windowHandle, -20).ToInt64()
    })
    return $true
  }, [IntPtr]::Zero) | Out-Null
  return $windows
}
Get-Process | Where-Object {
  try {
    [System.IO.Path]::GetFullPath($_.Path).StartsWith($InstallLocation, [System.StringComparison]::OrdinalIgnoreCase)
  } catch { $false }
} | ForEach-Object { Stop-Process -Id $_.Id -Force -ErrorAction Stop }
Start-Sleep -Milliseconds 500
Start-Process -FilePath "explorer.exe" -ArgumentList "shell:AppsFolder\\$PackageFamilyName!App" -WindowStyle Hidden
$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
$windows = @()
do {
  Start-Sleep -Milliseconds 500
  $windows = @(Get-PackageWindows)
  if ($windows.Count -gt 0) { break }
} while ((Get-Date) -lt $deadline)
if ($windows.Count -eq 0) { throw "No visible primary window found for package $PackageFullName." }
$wsExAppWindow = 0x00040000
$wsExNoActivate = 0x08000000
$wsExToolWindow = 0x00000080
$validWindow = $windows | Where-Object {
  $hasAppWindow = ($_.ExtendedStyle -band $wsExAppWindow) -ne 0
  $isUnownedTaskbarWindow = $_.Owner -eq 0 -and ($_.ExtendedStyle -band $wsExToolWindow) -eq 0
  ($hasAppWindow -or $isUnownedTaskbarWindow) -and ($_.ExtendedStyle -band $wsExNoActivate) -eq 0
} | Select-Object -First 1
if ($null -eq $validWindow) {
  $details = $windows | ForEach-Object { "$($_.ProcessName)[$($_.ProcessId)] hwnd=$($_.Handle) owner=$($_.Owner) exStyle=0x$($_.ExtendedStyle.ToString('x')) title=$($_.Title)" }
  throw "No visible package window was taskbar-eligible without WS_EX_NOACTIVATE.\`n$($details -join [Environment]::NewLine)"
}
Write-Output "Window flags ok: $($validWindow.ProcessName)[$($validWindow.ProcessId)] hwnd=$($validWindow.Handle) owner=$($validWindow.Owner) exStyle=0x$($validWindow.ExtendedStyle.ToString('x'))"
`;
  execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], {
    stdio: "inherit",
    windowsHide: true,
  });
}

main();

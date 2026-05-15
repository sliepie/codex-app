[CmdletBinding()]
param(
    [string] $ProductId = "9PLM9XGG6VKS",
    [string] $PackageName = "OpenAI.Codex",
    [string] $PackageFamilyName = "OpenAI.Codex_2p2nqsd0c76g0",
    [string] $OutputPath
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path $PSScriptRoot "..\resources\node_repl.exe"
}

function Invoke-Winget {
    param(
        [string[]] $Arguments,
        [switch] $AllowNoApplicableUpgrade
    )

    & winget @Arguments
    if ($LASTEXITCODE -ne 0) {
        $noApplicableUpgradeExitCode = -1978335189
        if ($AllowNoApplicableUpgrade -and $LASTEXITCODE -eq $noApplicableUpgradeExitCode) {
            Write-Output "No newer Codex Store package is available; using the installed package."
            return
        }

        throw "winget $($Arguments -join ' ') failed with exit code $LASTEXITCODE."
    }
}

function Get-CodexAppPackage {
    Get-AppxPackage -Name $PackageName -ErrorAction SilentlyContinue |
        Where-Object { $_.PackageFamilyName -eq $PackageFamilyName } |
        Sort-Object -Property Version -Descending |
        Select-Object -First 1
}

function Get-PeMachine {
    param([string] $Path)

    $bytes = [System.IO.File]::ReadAllBytes($Path)
    if ($bytes.Length -lt 0x40 -or $bytes[0] -ne 0x4d -or $bytes[1] -ne 0x5a) {
        throw "Expected a PE executable: $Path"
    }

    $peOffset = [System.BitConverter]::ToInt32($bytes, 0x3c)
    if ($peOffset -lt 0 -or $peOffset + 6 -gt $bytes.Length) {
        throw "Invalid PE header offset in $Path."
    }

    return [System.BitConverter]::ToUInt16($bytes, $peOffset + 4)
}

function Format-PeMachine {
    param([uint16] $Machine)

    switch ($Machine) {
        0x8664 { "x64" }
        0xaa64 { "ARM64" }
        0x014c { "x86" }
        default { "0x{0:x4}" -f $Machine }
    }
}

function Get-Sha256 {
    param([string] $Path)

    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
        $hashBytes = $sha256.ComputeHash([System.IO.File]::ReadAllBytes($Path))
        return ([System.BitConverter]::ToString($hashBytes) -replace "-", "").ToLowerInvariant()
    }
    finally {
        $sha256.Dispose()
    }
}

function Resolve-NodeReplPath {
    param($Package)

    $candidate = Join-Path $Package.InstallLocation "app\resources\node_repl.exe"
    if (Test-Path -LiteralPath $candidate -PathType Leaf) {
        return $candidate
    }

    throw "Could not find node_repl.exe under installed package: $($Package.InstallLocation)"
}

$existingPackage = Get-CodexAppPackage
$installedByScript = $null -eq $existingPackage

try {
    if ($installedByScript) {
        Invoke-Winget @(
            "install",
            "--id", $ProductId,
            "--source", "msstore",
            "--exact",
            "--scope", "user",
            "--architecture", "x64",
            "--silent",
            "--accept-package-agreements",
            "--accept-source-agreements",
            "--authentication-mode", "silent",
            "--disable-interactivity"
        )
    }
    else {
        Invoke-Winget -AllowNoApplicableUpgrade -Arguments @(
            "upgrade",
            "--id", $ProductId,
            "--source", "msstore",
            "--exact",
            "--scope", "user",
            "--architecture", "x64",
            "--silent",
            "--include-unknown",
            "--accept-package-agreements",
            "--accept-source-agreements",
            "--authentication-mode", "silent",
            "--disable-interactivity"
        )
    }

    $package = Get-CodexAppPackage
    if ($null -eq $package) {
        throw "Official Codex Store package family $PackageFamilyName was not found after winget completed."
    }

    $sourcePath = Resolve-NodeReplPath -Package $package
    $machine = Get-PeMachine -Path $sourcePath
    if ($machine -ne 0x8664) {
        throw "Expected x64 node_repl.exe, found $(Format-PeMachine -Machine $machine)."
    }

    $outputDirectory = Split-Path -Parent $OutputPath
    New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
    Copy-Item -LiteralPath $sourcePath -Destination $OutputPath -Force

    $hash = Get-Sha256 -Path $OutputPath
    $metadata = [ordered]@{
        productId = $ProductId
        packageName = $package.Name
        packageFullName = $package.PackageFullName
        packageFamilyName = $package.PackageFamilyName
        packageVersion = [string] $package.Version
        sourceRelativePath = "app/resources/node_repl.exe"
        architecture = "x64"
        sha256 = $hash
    }

    $metadataPath = [System.IO.Path]::ChangeExtension($OutputPath, ".json")
    $metadataJson = (($metadata | ConvertTo-Json) -replace '(?m)^    "', '  "' -replace '":\s+', '": ') + [Environment]::NewLine
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($metadataPath, $metadataJson, $utf8NoBom)

    Write-Output "Updated $OutputPath from $($package.PackageFullName)."
    Write-Output "SHA-256: $($metadata.sha256)"
}
finally {
    if ($installedByScript) {
        $packageToRemove = Get-CodexAppPackage
        if ($null -ne $packageToRemove) {
            Remove-AppxPackage -Package $packageToRemove.PackageFullName -ErrorAction Stop
            Write-Output "Uninstalled temporary Codex package $($packageToRemove.PackageFullName)."
        }
    }
}

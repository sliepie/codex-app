[CmdletBinding()]
param(
    [string]$PackageName,
    [string]$PackageFamilyName,
    [string]$PackageFullName
)

$ErrorActionPreference = "Stop"

function Resolve-RepoRoot {
    return [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\..\..\.."))
}

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)]
        [scriptblock]$Command
    )

    & $Command
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}

$repoRoot = Resolve-RepoRoot
$windowFlagArgs = @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", ".\desktop\scripts\assert-windows-primary-window-flags.ps1"
)
$payloadArgs = @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", ".\desktop\scripts\assert-store-owl-shell-package-payload.ps1"
)
$packageIdentityArgs = @()
if (-not [string]::IsNullOrWhiteSpace($PackageName)) {
    $packageIdentityArgs += @("-PackageName", $PackageName)
}
if (-not [string]::IsNullOrWhiteSpace($PackageFamilyName)) {
    $packageIdentityArgs += @("-PackageFamilyName", $PackageFamilyName)
}
if (-not [string]::IsNullOrWhiteSpace($PackageFullName)) {
    $packageIdentityArgs += @("-PackageFullName", $PackageFullName)
}
$windowFlagArgs += $packageIdentityArgs
$payloadArgs += $packageIdentityArgs

Push-Location $repoRoot
try {
    Invoke-Checked { npm --prefix desktop run test:windows-package-resources }
    Invoke-Checked { powershell @payloadArgs }
    Invoke-Checked { powershell @windowFlagArgs }
    Invoke-Checked { git diff --check }
}
finally {
    Pop-Location
}

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
    ".\desktop\.cache\scripts\assert-windows-primary-window-flags.js"
)
$payloadArgs = @(
    ".\desktop\.cache\scripts\assert-store-owl-shell-package-payload.js"
)
$packageIdentityArgs = @()
if (-not [string]::IsNullOrWhiteSpace($PackageName)) {
    $packageIdentityArgs += @("--package-name", $PackageName)
}
if (-not [string]::IsNullOrWhiteSpace($PackageFamilyName)) {
    $packageIdentityArgs += @("--package-family-name", $PackageFamilyName)
}
if (-not [string]::IsNullOrWhiteSpace($PackageFullName)) {
    $packageIdentityArgs += @("--package-full-name", $PackageFullName)
}
$windowFlagArgs += $packageIdentityArgs
$payloadArgs += $packageIdentityArgs

Push-Location $repoRoot
try {
    Invoke-Checked { npm --prefix desktop run test:windows-package-resources }
    Invoke-Checked { node @payloadArgs }
    Invoke-Checked { node @windowFlagArgs }
    Invoke-Checked { git diff --check }
}
finally {
    Pop-Location
}

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
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
    "-File", ".\desktop\scripts\assert-windows-primary-window-flags.ps1",
    "-PackageName", $PackageName
)
if (-not [string]::IsNullOrWhiteSpace($PackageFamilyName)) {
    $windowFlagArgs += @("-PackageFamilyName", $PackageFamilyName)
}
if (-not [string]::IsNullOrWhiteSpace($PackageFullName)) {
    $windowFlagArgs += @("-PackageFullName", $PackageFullName)
}

Push-Location $repoRoot
try {
    Invoke-Checked { npm --prefix desktop run test:windows-package-resources }
    Invoke-Checked { powershell @windowFlagArgs }
    Invoke-Checked { git diff --check }
}
finally {
    Pop-Location
}

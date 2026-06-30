[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$PackageName
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
Push-Location $repoRoot
try {
    Invoke-Checked { npm --prefix desktop run test:windows-package-resources:compiled }
    Invoke-Checked {
        powershell -NoProfile -ExecutionPolicy Bypass -File ".\desktop\scripts\assert-windows-primary-window-flags.ps1" -PackageName $PackageName
    }
    Invoke-Checked { git diff --check }
}
finally {
    Pop-Location
}

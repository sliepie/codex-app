[CmdletBinding()]
param(
    [string]$PackageRoot
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

function Test-JsonFile {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json | Out-Null
    Write-Output "$Path JSON ok"
}

function Test-PeMachine {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [Parameter(Mandatory = $true)]
        [int]$ExpectedMachine,
        [Parameter(Mandatory = $true)]
        [string]$Label
    )

    $bytes = [IO.File]::ReadAllBytes($Path)
    $peOffset = [BitConverter]::ToInt32($bytes, 0x3c)
    $machine = [BitConverter]::ToUInt16($bytes, $peOffset + 4)
    if ($machine -ne $ExpectedMachine) {
        throw "Expected $Label to have PE machine 0x$($ExpectedMachine.ToString('x')); got 0x$($machine.ToString('x'))."
    }
    Write-Output "$Label PE machine ok"
}

$repoRoot = Resolve-RepoRoot
Push-Location $repoRoot
try {
    Test-JsonFile -Path "desktop\resources\cua_node\bin\node_repl.json"
    Test-JsonFile -Path "desktop\resources\extension-host.json"
    Test-JsonFile -Path "desktop\resources\codex-computer-use.json"
    Test-JsonFile -Path "desktop\package.json"

    Test-PeMachine -Path "desktop\resources\cua_node\bin\node_repl.exe" -ExpectedMachine 0xaa64 -Label "node_repl.exe ARM64"
    Test-PeMachine -Path "desktop\resources\extension-host.exe" -ExpectedMachine 0xaa64 -Label "extension-host.exe ARM64"
    Test-PeMachine -Path "desktop\resources\codex-computer-use.exe" -ExpectedMachine 0x8664 -Label "codex-computer-use.exe x64"

    if ($PackageRoot) {
        Invoke-Checked { npm --prefix desktop run build:scripts }
        Invoke-Checked { npm --prefix desktop run verify:windows-arm64-resource-binaries:compiled -- --package-root $PackageRoot }
    }
    else {
        Invoke-Checked { npm --prefix desktop run verify:windows-arm64-resource-binaries }
    }

    Invoke-Checked { git diff --check }
}
finally {
    Pop-Location
}

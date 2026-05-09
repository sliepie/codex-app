param(
    [ValidateSet('x64', 'arm64')]
    [string]$Architecture = $env:PACKAGE_ARCHITECTURE
)

$ErrorActionPreference = 'Stop'

function ConvertTo-LowerHexString {
    param(
        [Parameter(Mandatory = $true)]
        [byte[]]$Bytes
    )

    return ([System.BitConverter]::ToString($Bytes) -replace '-', '').ToLowerInvariant()
}

function Get-WindowsOaiUpdaterFileHash {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    $stream = [System.IO.File]::OpenRead($Path)
    try {
        return ConvertTo-LowerHexString -Bytes ($sha256.ComputeHash($stream))
    }
    finally {
        $stream.Dispose()
        $sha256.Dispose()
    }
}

function Get-WindowsOaiUpdaterSourceHash {
    param(
        [Parameter(Mandatory = $true)]
        [string]$SourceRoot,

        [Parameter(Mandatory = $true)]
        [string]$CrateRoot,

        [Parameter(Mandatory = $true)]
        [string]$BuildScriptPath
    )

    $separators = [char[]]@('\', '/')
    $resolvedSourceRoot = (Resolve-Path -LiteralPath $SourceRoot).Path.TrimEnd($separators)
    $resolvedCrateRoot = (Resolve-Path -LiteralPath $CrateRoot).Path.TrimEnd($separators)
    $sourceFiles = @(
        (Join-Path $resolvedCrateRoot 'Cargo.toml'),
        (Join-Path $resolvedCrateRoot 'Cargo.lock'),
        $BuildScriptPath
    )
    $srcRoot = Join-Path $resolvedCrateRoot 'src'

    if (Test-Path -LiteralPath $srcRoot) {
        $sourceFiles += Get-ChildItem -LiteralPath $srcRoot -Recurse -File | ForEach-Object { $_.FullName }
    }

    $hashInput = New-Object System.Text.StringBuilder
    foreach ($sourceFile in ($sourceFiles | Where-Object { Test-Path -LiteralPath $_ } | Sort-Object)) {
        $fullPath = (Resolve-Path -LiteralPath $sourceFile).Path
        if ($fullPath.StartsWith($resolvedSourceRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
            $relativePath = $fullPath.Substring($resolvedSourceRoot.Length).TrimStart($separators).Replace('\', '/')
        }
        else {
            $relativePath = $fullPath.Replace('\', '/')
        }

        $fileHash = Get-WindowsOaiUpdaterFileHash -Path $fullPath
        [void]$hashInput.AppendLine($relativePath)
        [void]$hashInput.AppendLine($fileHash)
    }

    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($hashInput.ToString())
        $hashBytes = $sha256.ComputeHash($bytes)
        return ConvertTo-LowerHexString -Bytes $hashBytes
    }
    finally {
        $sha256.Dispose()
    }
}

function Assert-SuccessfulNativeCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Description
    )

    if ($LASTEXITCODE -ne 0) {
        throw "$Description failed with exit code $LASTEXITCODE."
    }
}

if ([string]::IsNullOrWhiteSpace($Architecture)) {
    $Architecture = 'arm64'
}

foreach ($command in @('rustup', 'cargo')) {
    if ($null -eq (Get-Command $command -ErrorAction SilentlyContinue)) {
        throw "Rust is required to build the native Windows updater. Install rustup and the MSVC Rust toolchain, then run this command again."
    }
}

$target = switch ($Architecture) {
    'x64' { 'x86_64-pc-windows-msvc' }
    'arm64' { 'aarch64-pc-windows-msvc' }
}

$desktopRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$manifestPath = Join-Path $desktopRoot 'native/windows-oai-update-checker/Cargo.toml'
$crateRoot = Split-Path -Parent $manifestPath
$outputPath = Join-Path $desktopRoot 'resources/native/windows-updater.node'
$builtPath = Join-Path $desktopRoot "native/windows-oai-update-checker/target/$target/release/codex_windows_oai_update_checker.dll"
$cacheRoot = Join-Path $desktopRoot '.cache/windows-oai-update-checker'
$stampPath = Join-Path $cacheRoot 'windows-updater.node.json'
$cacheStampVersion = 2
$sourceHash = Get-WindowsOaiUpdaterSourceHash -SourceRoot $desktopRoot -CrateRoot $crateRoot -BuildScriptPath $PSCommandPath

if ((Test-Path -LiteralPath $outputPath) -and (Test-Path -LiteralPath $stampPath)) {
    try {
        $stamp = Get-Content -Raw -LiteralPath $stampPath | ConvertFrom-Json
        if (
            $stamp.version -eq $cacheStampVersion -and
            $stamp.target -eq $target -and
            $stamp.sourceHash -eq $sourceHash
        ) {
            Write-Output "Using cached $outputPath for $target."
            return
        }
    }
    catch {
        Write-Output "Ignoring invalid updater cache stamp at $stampPath."
    }
}

rustup target add $target
Assert-SuccessfulNativeCommand -Description "rustup target add $target"
cargo build --manifest-path $manifestPath --release --target $target
Assert-SuccessfulNativeCommand -Description "cargo build for $target"

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $outputPath) | Out-Null
Copy-Item -LiteralPath $builtPath -Destination $outputPath -Force
New-Item -ItemType Directory -Force -Path $cacheRoot | Out-Null
[ordered]@{
    version = $cacheStampVersion
    target = $target
    sourceHash = $sourceHash
} | ConvertTo-Json | Set-Content -LiteralPath $stampPath -Encoding UTF8
Write-Output "Built $outputPath for $target."

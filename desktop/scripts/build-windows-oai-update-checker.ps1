param(
    [ValidateSet('x64', 'arm64')]
    [string]$Architecture = $env:PACKAGE_ARCHITECTURE
)

$ErrorActionPreference = 'Stop'

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
$outputPath = Join-Path $desktopRoot 'resources/native/windows-updater.node'
$builtPath = Join-Path $desktopRoot "native/windows-oai-update-checker/target/$target/release/codex_windows_oai_update_checker.dll"

rustup target add $target
cargo build --manifest-path $manifestPath --release --target $target

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $outputPath) | Out-Null
Copy-Item -LiteralPath $builtPath -Destination $outputPath -Force
Write-Output "Built $outputPath for $target."

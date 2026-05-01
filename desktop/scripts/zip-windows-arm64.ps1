$ErrorActionPreference = "Stop"

$desktopRoot = Split-Path -Parent $PSScriptRoot
$packageRoot = Join-Path $desktopRoot "out\Codex-win32-arm64"
$assetRoot = Join-Path $desktopRoot "out\release-assets"

if (-not (Test-Path -LiteralPath $packageRoot)) {
    throw "Windows ARM64 package root is missing: $packageRoot"
}

$version = $env:CODEX_RELEASE_VERSION
if ([string]::IsNullOrWhiteSpace($version)) {
    $packageJson = Get-Content -LiteralPath (Join-Path $desktopRoot "package.json") -Raw |
        ConvertFrom-Json
    $version = $packageJson.version
}

New-Item -ItemType Directory -Force -Path $assetRoot | Out-Null

$assetName = "codex-app-windows-arm64-v$version.zip"
$assetPath = Join-Path $assetRoot $assetName
if (Test-Path -LiteralPath $assetPath) {
    Remove-Item -LiteralPath $assetPath -Force
}

Compress-Archive -LiteralPath (Join-Path $packageRoot "*") -DestinationPath $assetPath

@"
Windows ARM64 artifact in this release:
- $assetName
"@ | Set-Content -Path (Join-Path $assetRoot "RELEASE_NOTES_WINDOWS_ARM64.txt")

Write-Output $assetPath

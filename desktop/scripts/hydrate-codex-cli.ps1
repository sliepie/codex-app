param(
    [string] $CodexRepo = "openai/codex",
    [string] $CacheRoot,
    [switch] $Force
)

$ErrorActionPreference = "Stop"

$desktopRoot = Split-Path -Parent $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($CacheRoot)) {
    $CacheRoot = Join-Path $desktopRoot ".cache\codex-cli"
}

$resourcesRoot = Join-Path $desktopRoot "resources"
New-Item -ItemType Directory -Force -Path $CacheRoot | Out-Null
New-Item -ItemType Directory -Force -Path $resourcesRoot | Out-Null

if ([string]::IsNullOrWhiteSpace($CodexRepo)) {
    throw "Missing Codex GitHub repository."
}

$releaseJson = & gh release view --repo $CodexRepo --json tagName,name,url,assets 2>&1
if ($LASTEXITCODE -ne 0) {
    throw "Failed to resolve latest Codex release from $CodexRepo. $releaseJson"
}

$release = $releaseJson | ConvertFrom-Json
$assetsByName = @{}
foreach ($asset in $release.assets) {
    $assetsByName[$asset.name] = $asset
}

$requiredAssets = @(
    @{
        AssetName = "codex-aarch64-pc-windows-msvc.exe"
        OutputName = "codex.exe"
    },
    @{
        AssetName = "codex-windows-sandbox-setup-aarch64-pc-windows-msvc.exe"
        OutputName = "codex-windows-sandbox-setup.exe"
    },
    @{
        AssetName = "codex-command-runner-aarch64-pc-windows-msvc.exe"
        OutputName = "codex-command-runner.exe"
    }
)

$hydratedAssets = @()
foreach ($requiredAsset in $requiredAssets) {
    $asset = $assetsByName[$requiredAsset.AssetName]
    if ($null -eq $asset -or [string]::IsNullOrWhiteSpace($asset.url)) {
        throw "Missing Codex release asset: $($requiredAsset.AssetName)"
    }

    $downloadPath = Join-Path $CacheRoot $requiredAsset.AssetName
    $outputPath = Join-Path $resourcesRoot $requiredAsset.OutputName

    if ($Force -and (Test-Path -LiteralPath $downloadPath)) {
        Remove-Item -LiteralPath $downloadPath -Force
    }
    if (-not (Test-Path -LiteralPath $downloadPath)) {
        Invoke-WebRequest -UseBasicParsing -Uri $asset.url -OutFile $downloadPath
    }

    Copy-Item -LiteralPath $downloadPath -Destination $outputPath -Force
    $hydratedAssets += [ordered] @{
        assetName = $requiredAsset.AssetName
        outputName = $requiredAsset.OutputName
        downloadUrl = $asset.url
        size = $asset.size
    }
}

$releaseInfoPath = Join-Path $CacheRoot "latest-release.json"
[ordered] @{
    tagName = $release.tagName
    name = $release.name
    htmlUrl = $release.url
    assets = $hydratedAssets
} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $releaseInfoPath

Write-Output "Hydrated Codex CLI $($release.tagName) into $resourcesRoot"

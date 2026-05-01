param(
    [string] $Version,
    [string] $AppcastUrl,
    [string] $CacheRoot,
    [switch] $Force
)

$ErrorActionPreference = "Stop"

$desktopRoot = Split-Path -Parent $PSScriptRoot
$repoRoot = Split-Path -Parent $desktopRoot
$versionFile = Join-Path $repoRoot "codex-app-version.json"

if (-not (Test-Path -LiteralPath $versionFile)) {
    throw "Missing app version file: $versionFile"
}

$versionInfo = Get-Content -LiteralPath $versionFile -Raw | ConvertFrom-Json
if ([string]::IsNullOrWhiteSpace($Version)) {
    $Version = $versionInfo.version
}
if ([string]::IsNullOrWhiteSpace($AppcastUrl)) {
    $AppcastUrl = $versionInfo.appcastUrl
}
if ([string]::IsNullOrWhiteSpace($CacheRoot)) {
    $CacheRoot = Join-Path $desktopRoot ".cache\codex-app"
}

if ([string]::IsNullOrWhiteSpace($Version)) {
    throw "Missing Codex app version."
}
if ([string]::IsNullOrWhiteSpace($AppcastUrl)) {
    throw "Missing Codex appcast URL."
}

New-Item -ItemType Directory -Force -Path $CacheRoot | Out-Null

[xml] $appcast = (Invoke-WebRequest -UseBasicParsing -Uri $AppcastUrl).Content
$sparkle = New-Object System.Xml.XmlNamespaceManager($appcast.NameTable)
$sparkle.AddNamespace("sparkle", "http://www.andymatuschak.org/xml-namespaces/sparkle")

$item = $appcast.SelectSingleNode("//item[sparkle:shortVersionString='$Version']", $sparkle)
if ($null -eq $item) {
    throw "Codex app version $Version was not found in the appcast."
}

$enclosure = $item.SelectSingleNode("enclosure")
if ($null -eq $enclosure -or [string]::IsNullOrWhiteSpace($enclosure.url)) {
    throw "Codex app version $Version does not have a full download URL."
}

$downloadUrl = [string] $enclosure.url
$zipPath = Join-Path $CacheRoot (Split-Path -Leaf ([uri] $downloadUrl).AbsolutePath)
$extractRoot = Join-Path $CacheRoot ("extract-" + $Version)
$recoveredRoot = Join-Path $desktopRoot "recovered\app-asar-extracted"

if ($Force -and (Test-Path -LiteralPath $zipPath)) {
    Remove-Item -LiteralPath $zipPath -Force
}
if (-not (Test-Path -LiteralPath $zipPath)) {
    Invoke-WebRequest -UseBasicParsing -Uri $downloadUrl -OutFile $zipPath
}

if ($Force -and (Test-Path -LiteralPath $extractRoot)) {
    Remove-Item -LiteralPath $extractRoot -Recurse -Force
}
if (-not (Test-Path -LiteralPath $extractRoot)) {
    New-Item -ItemType Directory -Force -Path $extractRoot | Out-Null
    Expand-Archive -LiteralPath $zipPath -DestinationPath $extractRoot
}

$appAsar = Get-ChildItem -LiteralPath $extractRoot -Recurse -Filter "app.asar" |
    Where-Object { $_.FullName -match "Codex\.app[\\/]+Contents[\\/]+Resources[\\/]+app\.asar$" } |
    Select-Object -First 1
if ($null -eq $appAsar) {
    throw "Could not find Codex.app Contents/Resources/app.asar in the downloaded ZIP."
}

node (Join-Path $PSScriptRoot "refresh-recovered-from-dmg.mjs") --app-asar $appAsar.FullName --output $recoveredRoot

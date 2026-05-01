param(
    [string] $Version,
    [string] $AppcastUrl = "https://persistent.oaistatic.com/codex-app-prod/appcast.xml",
    [string] $CacheRoot,
    [switch] $Force
)

$ErrorActionPreference = "Stop"

$desktopRoot = Split-Path -Parent $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($CacheRoot)) {
    $CacheRoot = Join-Path $desktopRoot ".cache\codex-app"
}

if ([string]::IsNullOrWhiteSpace($AppcastUrl)) {
    throw "Missing Codex appcast URL."
}

New-Item -ItemType Directory -Force -Path $CacheRoot | Out-Null

[xml] $appcast = (Invoke-WebRequest -UseBasicParsing -Uri $AppcastUrl).Content
$sparkle = New-Object System.Xml.XmlNamespaceManager($appcast.NameTable)
$sparkle.AddNamespace("sparkle", "http://www.andymatuschak.org/xml-namespaces/sparkle")

$item = $null
if ([string]::IsNullOrWhiteSpace($Version)) {
    $item = $appcast.SelectSingleNode("//item[enclosure][1]", $sparkle)
}
else {
    $item = $appcast.SelectSingleNode("//item[sparkle:shortVersionString='$Version']", $sparkle)
}

if ($null -eq $item) {
    if ([string]::IsNullOrWhiteSpace($Version)) {
        throw "No Codex app release was found in the appcast."
    }
    throw "Codex app version $Version was not found in the appcast."
}

$selectedVersionNode = $item.SelectSingleNode("sparkle:shortVersionString", $sparkle)
if ($null -eq $selectedVersionNode -or [string]::IsNullOrWhiteSpace($selectedVersionNode.InnerText)) {
    throw "The selected Codex app release does not have a version."
}

$selectedVersion = $selectedVersionNode.InnerText
$selectedBuildNode = $item.SelectSingleNode("sparkle:version", $sparkle)
$selectedBuildNumber = ""
if ($null -ne $selectedBuildNode) {
    $selectedBuildNumber = $selectedBuildNode.InnerText
}

$enclosure = $item.SelectSingleNode("enclosure")
if ($null -eq $enclosure -or [string]::IsNullOrWhiteSpace($enclosure.url)) {
    throw "Codex app version $selectedVersion does not have a full download URL."
}

$downloadUrl = [string] $enclosure.url
$zipPath = Join-Path $CacheRoot (Split-Path -Leaf ([uri] $downloadUrl).AbsolutePath)
$extractRoot = Join-Path $CacheRoot ("extract-" + $selectedVersion)
$recoveredRoot = Join-Path $desktopRoot "recovered\app-asar-extracted"
$releaseInfoPath = Join-Path $CacheRoot "latest-release.json"

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

[ordered] @{
    version = $selectedVersion
    buildNumber = $selectedBuildNumber
    downloadUrl = $downloadUrl
} | ConvertTo-Json | Set-Content -LiteralPath $releaseInfoPath

Write-Output "Hydrated Codex app $selectedVersion from $downloadUrl"

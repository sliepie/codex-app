param(
    [string] $AppcastUrl = "https://persistent.oaistatic.com/codex-app-prod/appcast.xml",
    [string] $ReleaseApiUrl = "https://api.github.com/repos/openai/codex/releases/latest"
)

$ErrorActionPreference = "Stop"

function Write-GitHubOutput {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Name,

        [Parameter(Mandatory = $true)]
        [string] $Value
    )

    if (-not [string]::IsNullOrWhiteSpace($env:GITHUB_OUTPUT)) {
        "$Name=$Value" | Add-Content -LiteralPath $env:GITHUB_OUTPUT
    }
}

if ([string]::IsNullOrWhiteSpace($AppcastUrl)) {
    throw "Missing Codex appcast URL."
}
if ([string]::IsNullOrWhiteSpace($ReleaseApiUrl)) {
    throw "Missing Codex CLI release API URL."
}

[xml] $appcast = (Invoke-WebRequest -UseBasicParsing -Uri $AppcastUrl).Content
$sparkle = New-Object System.Xml.XmlNamespaceManager($appcast.NameTable)
$sparkle.AddNamespace("sparkle", "http://www.andymatuschak.org/xml-namespaces/sparkle")

$item = $appcast.SelectSingleNode("//item[enclosure][1]", $sparkle)
if ($null -eq $item) {
    throw "No Codex app release was found in the appcast."
}

$versionNode = $item.SelectSingleNode("sparkle:shortVersionString", $sparkle)
if ($null -eq $versionNode -or [string]::IsNullOrWhiteSpace($versionNode.InnerText)) {
    throw "The selected Codex app release does not have a version."
}

$buildNode = $item.SelectSingleNode("sparkle:version", $sparkle)
$buildNumber = ""
if ($null -ne $buildNode) {
    $buildNumber = $buildNode.InnerText
}

$cliRelease = Invoke-RestMethod -Uri $ReleaseApiUrl
if ([string]::IsNullOrWhiteSpace($cliRelease.tag_name)) {
    throw "The selected Codex CLI release does not have a tag name."
}

$appVersion = $versionNode.InnerText
$cliTag = $cliRelease.tag_name
$releaseTag = "v$appVersion-cli-$cliTag"
$buildMarkerKey = "windows-arm64-built-app-$appVersion-build-$buildNumber-cli-$cliTag"
$hydrationCacheKey = "windows-arm64-hydrated-app-$appVersion-build-$buildNumber-cli-$cliTag"

Write-GitHubOutput -Name "codex_app_version" -Value $appVersion
Write-GitHubOutput -Name "codex_app_build" -Value $buildNumber
Write-GitHubOutput -Name "codex_cli_tag" -Value $cliTag
Write-GitHubOutput -Name "release_tag" -Value $releaseTag
Write-GitHubOutput -Name "build_marker_key" -Value $buildMarkerKey
Write-GitHubOutput -Name "hydration_cache_key" -Value $hydrationCacheKey

[ordered] @{
    codexAppVersion = $appVersion
    codexAppBuild = $buildNumber
    codexCliTag = $cliTag
    releaseTag = $releaseTag
} | ConvertTo-Json

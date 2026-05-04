param(
    [Parameter(Mandatory = $true)]
    [string] $PackageName,

    [Parameter(Mandatory = $true)]
    [string] $Publisher,

    [Parameter(Mandatory = $true)]
    [string] $Version,

    [Parameter(Mandatory = $true)]
    [ValidateSet('x64', 'arm64')]
    [string] $Architecture,

    [Parameter(Mandatory = $true)]
    [uri] $PackageUri,

    [Parameter(Mandatory = $true)]
    [uri] $AppInstallerUri,

    [Parameter(Mandatory = $true)]
    [ValidateRange(0, 255)]
    [int] $HoursBetweenUpdateChecks,

    [Parameter(Mandatory = $true)]
    [bool] $ShowPrompt,

    [Parameter(Mandatory = $true)]
    [bool] $UpdateBlocksActivation,

    [Parameter(Mandatory = $true)]
    [string] $OutputPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function ConvertTo-XmlText {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Value
    )

    return [System.Security.SecurityElement]::Escape($Value)
}

if ($Version -notmatch '^\d+\.\d+\.\d+\.\d+$') {
    throw "Version '$Version' must be a four-part MSIX version, for example 26.429.20946.0."
}

if ($UpdateBlocksActivation -and -not $ShowPrompt) {
    throw 'UpdateBlocksActivation can only be true when ShowPrompt is true.'
}

$outputDirectory = Split-Path -Parent $OutputPath
if ($outputDirectory) {
    New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
}

$showPromptValue = $ShowPrompt.ToString().ToLowerInvariant()
$updateBlocksActivationValue = $UpdateBlocksActivation.ToString().ToLowerInvariant()

$content = @"
<?xml version="1.0" encoding="utf-8"?>
<AppInstaller
  xmlns="http://schemas.microsoft.com/appx/appinstaller/2021"
  Version="$(ConvertTo-XmlText $Version)"
  Uri="$(ConvertTo-XmlText $AppInstallerUri.AbsoluteUri)">
  <MainPackage
    Name="$(ConvertTo-XmlText $PackageName)"
    Publisher="$(ConvertTo-XmlText $Publisher)"
    Version="$(ConvertTo-XmlText $Version)"
    ProcessorArchitecture="$(ConvertTo-XmlText $Architecture)"
    Uri="$(ConvertTo-XmlText $PackageUri.AbsoluteUri)" />
  <UpdateSettings>
    <OnLaunch HoursBetweenUpdateChecks="$HoursBetweenUpdateChecks" ShowPrompt="$showPromptValue" UpdateBlocksActivation="$updateBlocksActivationValue" />
    <AutomaticBackgroundTask />
  </UpdateSettings>
</AppInstaller>
"@

Set-Content -Path $OutputPath -Value $content -Encoding utf8
Write-Host "Wrote $OutputPath"

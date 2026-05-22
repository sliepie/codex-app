[CmdletBinding()]
param(
    [string] $Repository = "tectonic-typesetting/tectonic",
    [string] $Version = "0.16.9",
    [string] $OutputPath
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path $PSScriptRoot "..\.cache\tectonic\windows-x64\tectonic.exe"
}

function Get-PeMachine {
    param([string] $Path)

    $bytes = [System.IO.File]::ReadAllBytes($Path)
    if ($bytes.Length -lt 0x40 -or $bytes[0] -ne 0x4d -or $bytes[1] -ne 0x5a) {
        throw "Expected a PE executable: $Path"
    }

    $peOffset = [System.BitConverter]::ToInt32($bytes, 0x3c)
    if ($peOffset -lt 0 -or $peOffset + 6 -gt $bytes.Length) {
        throw "Invalid PE header offset in $Path."
    }

    return [System.BitConverter]::ToUInt16($bytes, $peOffset + 4)
}

function Get-Sha256 {
    param([string] $Path)

    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
        $hashBytes = $sha256.ComputeHash([System.IO.File]::ReadAllBytes($Path))
        return ([System.BitConverter]::ToString($hashBytes) -replace "-", "").ToLowerInvariant()
    }
    finally {
        $sha256.Dispose()
    }
}

function Invoke-WithRetry {
    param(
        [scriptblock] $ScriptBlock,
        [string] $Description
    )

    $lastError = $null
    for ($attempt = 1; $attempt -le 3; $attempt++) {
        try {
            return & $ScriptBlock
        }
        catch {
            $lastError = $_
            if ($attempt -eq 3) {
                break
            }
            $delaySeconds = 5 * $attempt
            Write-Output "$Description failed on attempt $attempt; retrying in $delaySeconds seconds."
            Start-Sleep -Seconds $delaySeconds
        }
    }

    throw $lastError
}

$assetName = "tectonic-$Version-x86_64-pc-windows-msvc.zip"
$tagName = "tectonic@$Version"
$encodedTagName = [System.Uri]::EscapeDataString($tagName)
$releaseUrl = "https://api.github.com/repos/$Repository/releases/tags/$encodedTagName"
$headers = @{
    "User-Agent" = "codex-app-windows-arm64-build"
    "Accept" = "application/vnd.github+json"
}

$release = Invoke-WithRetry -Description "Fetch Tectonic release metadata" -ScriptBlock {
    Invoke-RestMethod -Uri $releaseUrl -Headers $headers
}
$asset = $release.assets | Where-Object { $_.name -eq $assetName } | Select-Object -First 1
if ($null -eq $asset) {
    throw "Could not find $assetName in $releaseUrl."
}

$outputDirectory = Split-Path -Parent $OutputPath
$downloadDirectory = Join-Path $PSScriptRoot "..\.cache\tectonic\downloads"
$extractRoot = Join-Path $PSScriptRoot "..\.cache\tectonic\extract-$Version"
$zipPath = Join-Path $downloadDirectory $assetName

New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
New-Item -ItemType Directory -Force -Path $downloadDirectory | Out-Null

if (-not (Test-Path -LiteralPath $zipPath -PathType Leaf)) {
    Invoke-WithRetry -Description "Download $assetName" -ScriptBlock {
        Invoke-WebRequest -Uri $asset.browser_download_url -Headers $headers -OutFile $zipPath
    }
}

$zipHash = Get-Sha256 -Path $zipPath
if ($asset.digest -match "^sha256:(.+)$" -and $zipHash -ne $Matches[1].ToLowerInvariant()) {
    Remove-Item -LiteralPath $zipPath -Force
    throw "Downloaded $assetName SHA-256 mismatch: expected $($Matches[1]), got $zipHash."
}

Remove-Item -LiteralPath $extractRoot -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $extractRoot | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::ExtractToDirectory($zipPath, $extractRoot)

$tectonic = Get-ChildItem -LiteralPath $extractRoot -Recurse -File -Filter "tectonic.exe" |
    Select-Object -First 1
if ($null -eq $tectonic) {
    throw "Could not find tectonic.exe in $assetName."
}

$machine = Get-PeMachine -Path $tectonic.FullName
if ($machine -ne 0x8664) {
    throw "Expected x64 tectonic.exe from $assetName."
}

Copy-Item -LiteralPath $tectonic.FullName -Destination $OutputPath -Force
$exeHash = Get-Sha256 -Path $OutputPath

$metadata = [ordered]@{
    repository = $Repository
    tagName = $release.tag_name
    assetName = $asset.name
    assetDigest = $asset.digest
    sourceUrl = $asset.browser_download_url
    architecture = "x64"
    sha256 = $exeHash
}
$metadataPath = [System.IO.Path]::ChangeExtension($OutputPath, ".json")
$metadataJson = (($metadata | ConvertTo-Json) -replace '(?m)^    "', '  "' -replace '":\s+', '": ') + [Environment]::NewLine
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($metadataPath, $metadataJson, $utf8NoBom)

Write-Output "Downloaded $assetName to $OutputPath."
Write-Output "SHA-256: $exeHash"

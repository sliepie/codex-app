param(
    [Parameter(Mandatory = $true)]
    [string] $SourcePath,

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
    [securestring] $CertificatePassword,

    [Parameter(Mandatory = $true)]
    [string] $OutputDirectory,

    [switch] $TrustCertificate
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-LatestWindowsSdkTool {
    param(
        [Parameter(Mandatory = $true)]
        [string] $ToolName
    )

    $tool = Get-ChildItem -Path "${env:ProgramFiles(x86)}\Windows Kits\10\bin" -Filter $ToolName -Recurse |
        Where-Object { $_.FullName -like "*\x64\$ToolName" } |
        Sort-Object FullName -Descending |
        Select-Object -First 1

    if ($null -eq $tool) {
        throw "$ToolName was not found. Install the Windows SDK and rerun this script."
    }

    return $tool.FullName
}

function ConvertTo-PlainText {
    param(
        [Parameter(Mandatory = $true)]
        [securestring] $Value
    )

    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
    try {
        return [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    }
    finally {
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
}

if ($Version -notmatch '^\d+\.\d+\.\d+\.\d+$') {
    throw "Version '$Version' must be a four-part MSIX version, for example 26.429.20946.0."
}

if ($Publisher -notmatch '^CN=') {
    throw "Publisher '$Publisher' should be a certificate subject such as CN=Codex Local Test."
}

if (-not (Test-Path -Path $SourcePath -PathType Container)) {
    throw "SourcePath '$SourcePath' does not exist."
}

$sourceRoot = Resolve-Path -Path $SourcePath
$stageRoot = Join-Path $OutputDirectory 'stage'
$assetRoot = Join-Path $OutputDirectory 'release-assets'
$certRoot = Join-Path $OutputDirectory 'cert'
$manifestPath = Join-Path $stageRoot 'AppxManifest.xml'
$entryPointPath = Join-Path $stageRoot 'app/Codex.exe'
$msixPath = Join-Path $assetRoot "Codex-$Architecture-self-signed.msix"
$pfxPath = Join-Path $certRoot 'CodexSelfSigned.pfx'
$cerPath = Join-Path $certRoot 'CodexSelfSigned.cer'

New-Item -ItemType Directory -Path $stageRoot -Force | Out-Null
New-Item -ItemType Directory -Path $assetRoot -Force | Out-Null
New-Item -ItemType Directory -Path $certRoot -Force | Out-Null

Copy-Item -Path (Join-Path $sourceRoot '*') -Destination $stageRoot -Recurse -Force

if (-not (Test-Path -Path $manifestPath -PathType Leaf)) {
    throw "The staged payload does not contain AppxManifest.xml."
}

if (-not (Test-Path -Path $entryPointPath -PathType Leaf)) {
    throw "Cannot create MSIX: AppxManifest.xml declares app\Codex.exe, but the staged payload does not contain it. Hydrate a complete Windows payload first."
}

Remove-Item -Path (Join-Path $stageRoot 'AppxSignature.p7x') -Force -ErrorAction SilentlyContinue
Remove-Item -Path (Join-Path $stageRoot 'AppxBlockMap.xml') -Force -ErrorAction SilentlyContinue
Remove-Item -Path (Join-Path $stageRoot 'AppxMetadata/CodeIntegrity.cat') -Force -ErrorAction SilentlyContinue

[xml] $manifest = Get-Content -Path $manifestPath
$identity = $manifest.Package.Identity
$identity.Name = $PackageName
$identity.Publisher = $Publisher
$identity.Version = $Version
$identity.ProcessorArchitecture = $Architecture
$manifest.Save($manifestPath)

$certificate = New-SelfSignedCertificate `
    -Type Custom `
    -KeyUsage DigitalSignature `
    -Subject $Publisher `
    -CertStoreLocation 'Cert:\CurrentUser\My' `
    -TextExtension @('2.5.29.37={text}1.3.6.1.5.5.7.3.3', '2.5.29.19={text}') `
    -FriendlyName 'Codex self-signed MSIX test certificate'

Export-PfxCertificate -Cert $certificate -FilePath $pfxPath -Password $CertificatePassword | Out-Null
Export-Certificate -Cert $certificate -FilePath $cerPath | Out-Null

if ($TrustCertificate) {
    Import-Certificate -FilePath $cerPath -CertStoreLocation 'Cert:\CurrentUser\TrustedPeople' | Out-Null
}

$makeAppx = Get-LatestWindowsSdkTool -ToolName 'makeappx.exe'
$signTool = Get-LatestWindowsSdkTool -ToolName 'signtool.exe'

& $makeAppx pack /d $stageRoot /p $msixPath /o
if ($LASTEXITCODE -ne 0) {
    throw "makeappx failed with exit code $LASTEXITCODE"
}

$plainTextPassword = ConvertTo-PlainText -Value $CertificatePassword
try {
    & $signTool sign /fd SHA256 /f $pfxPath /p $plainTextPassword $msixPath
    if ($LASTEXITCODE -ne 0) {
        throw "signtool sign failed with exit code $LASTEXITCODE"
    }
}
finally {
    $plainTextPassword = $null
}

Write-Host "Wrote $msixPath"
Write-Host "Wrote $cerPath"
Write-Host "Wrote $pfxPath"
if ($TrustCertificate) {
    Write-Host 'Installed the public certificate into Cert:\CurrentUser\TrustedPeople'
}
else {
    Write-Host 'Certificate was not installed. Import the .cer into Trusted People before installing the MSIX on a target machine.'
}

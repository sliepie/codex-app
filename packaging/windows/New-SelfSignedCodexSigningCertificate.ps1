param(
    [Parameter(Mandatory = $true)]
    [string] $PackageName,

    [Parameter(Mandatory = $true)]
    [string] $Publisher,

    [Parameter(Mandatory = $true)]
    [uri] $AppInstallerUri,

    [Parameter(Mandatory = $true)]
    [securestring] $CertificatePassword,

    [Parameter(Mandatory = $true)]
    [string] $OutputDirectory,

    [int] $ValidYears = 3,

    [string] $FileNamePrefix = 'CodexSelfSigned',

    [switch] $KeepInStore
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ($Publisher -notmatch '^CN=') {
    throw "Publisher '$Publisher' should be a certificate subject such as CN=Codex Local Test."
}

if ($ValidYears -lt 1) {
    throw 'ValidYears must be at least 1.'
}

New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null

$pfxPath = Join-Path $OutputDirectory "$FileNamePrefix.pfx"
$cerPath = Join-Path $OutputDirectory "$FileNamePrefix.cer"
$base64Path = Join-Path $OutputDirectory "$FileNamePrefix.pfx.base64.txt"
$valuesPath = Join-Path $OutputDirectory "$FileNamePrefix.github-values.txt"

$certificate = New-SelfSignedCertificate `
    -Type CodeSigningCert `
    -Subject $Publisher `
    -FriendlyName "$PackageName self-signed MSIX signing certificate" `
    -KeyAlgorithm RSA `
    -KeyLength 2048 `
    -HashAlgorithm SHA256 `
    -CertStoreLocation 'Cert:\CurrentUser\My' `
    -NotAfter (Get-Date).AddYears($ValidYears)

try {
    Export-PfxCertificate -Cert $certificate -FilePath $pfxPath -Password $CertificatePassword -Force | Out-Null
    Export-Certificate -Cert $certificate -FilePath $cerPath -Force | Out-Null

    [Convert]::ToBase64String([IO.File]::ReadAllBytes($pfxPath)) |
        Set-Content -Path $base64Path -Encoding ascii

    @"
GitHub repository variables:
SELF_SIGNED_PACKAGE_NAME=$PackageName
SELF_SIGNED_PACKAGE_PUBLISHER=$Publisher
SELF_SIGNED_APPINSTALLER_URI=$($AppInstallerUri.AbsoluteUri)

GitHub repository secrets:
SELF_SIGNED_PFX_BASE64=<contents of $([IO.Path]::GetFileName($base64Path))>
SELF_SIGNED_PFX_PASSWORD=<the password passed to this script>

Public trust file:
$([IO.Path]::GetFileName($cerPath))
"@ | Set-Content -Path $valuesPath -Encoding utf8
}
finally {
    if (-not $KeepInStore) {
        Remove-Item -Path "Cert:\CurrentUser\My\$($certificate.Thumbprint)" -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "Wrote $pfxPath"
Write-Host "Wrote $cerPath"
Write-Host "Wrote $base64Path"
Write-Host "Wrote $valuesPath"
if (-not $KeepInStore) {
    Write-Host 'Removed the generated certificate from Cert:\CurrentUser\My. Import the CER on target machines to trust signed MSIX packages.'
}

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
    [string] $CertificatePath,

    [Parameter(Mandatory = $true)]
    [securestring] $CertificatePassword,

    [Parameter(Mandatory = $true)]
    [string] $OutputDirectory,

    [switch] $ExportCertificate
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

if ($PackageName -eq 'OpenAI.Codex') {
    throw "PackageName must not be OpenAI.Codex. Use a distinct package identity for self-signed builds."
}

if (-not (Test-Path -Path $SourcePath -PathType Container)) {
    throw "SourcePath '$SourcePath' does not exist."
}

if (-not (Test-Path -Path $CertificatePath -PathType Leaf)) {
    throw "CertificatePath '$CertificatePath' does not exist. Create the self-signed PFX outside this script and pass it in."
}

$sourceRoot = (Resolve-Path -Path $SourcePath).Path
$certificateFile = (Resolve-Path -Path $CertificatePath).Path
$stageRoot = Join-Path $OutputDirectory 'stage'
$assetRoot = Join-Path $OutputDirectory 'release-assets'
$manifestPath = Join-Path $stageRoot 'AppxManifest.xml'
$entryPointPath = Join-Path $stageRoot 'app/Codex.exe'
$msixPath = Join-Path $assetRoot "Codex-$Architecture-self-signed.msix"
$cerPath = Join-Path $assetRoot 'CodexSelfSigned.cer'

New-Item -ItemType Directory -Path $stageRoot -Force | Out-Null
New-Item -ItemType Directory -Path $assetRoot -Force | Out-Null

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

$certificate = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new(
    $certificateFile,
    $CertificatePassword,
    [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::Exportable
)

if ($certificate.Subject -ne $Publisher) {
    throw "Certificate subject '$($certificate.Subject)' must exactly match manifest Publisher '$Publisher'."
}

if (-not $certificate.HasPrivateKey) {
    throw "CertificatePath '$CertificatePath' does not contain a private key. Pass a PFX, not a CER."
}

if ($ExportCertificate) {
    [System.IO.File]::WriteAllBytes($cerPath, $certificate.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert))
}

$priConfigPath = Join-Path $OutputDirectory 'priconfig.xml'
$priPath = Join-Path $stageRoot 'resources.pri'
Remove-Item -Path $priConfigPath -Force -ErrorAction SilentlyContinue
Remove-Item -Path $priPath -Force -ErrorAction SilentlyContinue

$makePri = Get-LatestWindowsSdkTool -ToolName 'makepri.exe'
& $makePri createconfig /cf $priConfigPath /dq lang-en-US /o
if ($LASTEXITCODE -ne 0) {
    throw "makepri createconfig failed with exit code $LASTEXITCODE"
}

& $makePri new /pr $stageRoot /cf $priConfigPath /mn $manifestPath /of $priPath /o
if ($LASTEXITCODE -ne 0) {
    throw "makepri new failed with exit code $LASTEXITCODE"
}

if (-not (Test-Path -Path $priPath -PathType Leaf)) {
    throw "makepri did not create resources.pri."
}

Remove-Item -Path $priConfigPath -Force -ErrorAction SilentlyContinue

$makeAppx = Get-LatestWindowsSdkTool -ToolName 'makeappx.exe'
$signTool = Get-LatestWindowsSdkTool -ToolName 'signtool.exe'
$launcherPaths = @(
    Get-ChildItem -LiteralPath (Join-Path $stageRoot 'app') -Filter '*.exe' -File |
        Sort-Object FullName
)
if ($launcherPaths.Count -eq 0) {
    throw 'The staged app does not contain any top-level executable launchers.'
}

$plainTextPassword = ConvertTo-PlainText -Value $CertificatePassword
try {
    foreach ($launcherPath in $launcherPaths) {
        $launcherSignature = Get-AuthenticodeSignature -FilePath $launcherPath.FullName
        if ($launcherSignature.Status -eq [System.Management.Automation.SignatureStatus]::NotSigned) {
            & $signTool sign /fd SHA256 /f $certificateFile /p $plainTextPassword $launcherPath.FullName
            if ($LASTEXITCODE -ne 0) {
                throw "signtool sign for staged launcher '$($launcherPath.Name)' failed with exit code $LASTEXITCODE"
            }

            $launcherSignature = Get-AuthenticodeSignature -FilePath $launcherPath.FullName
            if (
                $null -eq $launcherSignature.SignerCertificate -or
                $launcherSignature.SignerCertificate.Thumbprint -ne $certificate.Thumbprint -or
                $launcherSignature.Status -eq [System.Management.Automation.SignatureStatus]::HashMismatch
            ) {
                throw "Staged launcher '$($launcherPath.Name)' did not retain the expected Authenticode signature."
            }
        }
        elseif ($launcherSignature.Status -ne [System.Management.Automation.SignatureStatus]::Valid) {
            throw "Staged launcher '$($launcherPath.Name)' has an invalid Authenticode signature status: $($launcherSignature.Status)."
        }
    }

    & $makeAppx pack /d $stageRoot /p $msixPath /o
    if ($LASTEXITCODE -ne 0) {
        throw "makeappx failed with exit code $LASTEXITCODE"
    }

    & $signTool sign /fd SHA256 /f $certificateFile /p $plainTextPassword $msixPath
    if ($LASTEXITCODE -ne 0) {
        throw "signtool sign failed with exit code $LASTEXITCODE"
    }
}
finally {
    $plainTextPassword = $null
}

Write-Host "Wrote $msixPath"
if ($ExportCertificate) {
    Write-Host "Wrote $cerPath"
}
Write-Host 'No certificate was created or trusted. Keep the PFX private and distribute only the CER.'

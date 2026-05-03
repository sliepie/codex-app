# Self-signed MSIX updates

This is the Windows path for a self-signed non-Store Codex MSIX release:

1. Build the Electron `win32` payload on the GitHub runner.
2. Copy the generated app payload into the staged MSIX package folder.
3. Remove stale generated package-signature files from the staged copy.
4. Update `AppxManifest.xml` with the release identity, publisher, architecture, and four-part MSIX version.
5. Pack the staged folder into an unsigned `.msix`.
6. Sign the `.msix` with an existing self-signed PFX supplied through GitHub secrets.
7. Export the public `.cer` next to the `.msix`.
8. Generate a `.appinstaller` file that points to the GitHub Release `.msix`.
9. Publish the `.msix`, `.cer`, and `.appinstaller` as draft release assets.

The repo does not create the certificate. Create the self-signed PFX outside the repo once, keep it private, and pass it to the packaging script or GitHub workflow. The `.cer` is public and can be shared so target machines can trust packages signed by the private PFX.

Self-signing is cheap and useful for local installs or controlled testing. It is not a public trust chain. Every target Windows user must trust the `.cer` before installing the MSIX.

## GitHub inputs

The `Windows Self-Signed MSIX Release` workflow expects these repository secrets:

- `SELF_SIGNED_PFX_BASE64`: base64-encoded PFX bytes.
- `SELF_SIGNED_PFX_PASSWORD`: PFX password.

On PowerShell, encode a local PFX for the secret value like this:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes('C:\path\to\CodexSelfSigned.pfx'))
```

Never commit the PFX or its password. Only distribute the exported `.cer`.

The workflow builds `arm64` packages on GitHub's `windows-11-arm` runner and `x64` packages on `windows-latest`.

## Local generation

Create a self-signed MSIX locally with an existing PFX:

```powershell
$password = Read-Host -AsSecureString 'PFX password'

./packaging/windows/New-SelfSignedCodexMsix.ps1 `
  -SourcePath './codex' `
  -PackageName 'Local.Codex' `
  -Publisher 'CN=Codex Local Test' `
  -Version '26.429.20946.0' `
  -Architecture 'arm64' `
  -CertificatePath './secrets/CodexSelfSigned.pfx' `
  -CertificatePassword $password `
  -OutputDirectory './out/windows/self-signed' `
  -ExportCertificate
```

`-ExportCertificate` writes `CodexSelfSigned.cer` next to the `.msix` as a release asset. The script does not create a PFX and does not import anything into the current user's certificate stores.

## Update behavior

The generated App Installer file uses both supported update checks:

- `OnLaunch` checks when the app starts.
- `AutomaticBackgroundTask` checks about every 8 hours without user launch.

The workflow passes `HoursBetweenUpdateChecks=0` explicitly so launch checks happen every time. That is useful while validating the update channel.

## Hosting rule

Do not rely on `ms-appinstaller:?source=` for public distribution. Microsoft disabled that protocol by default on consumer devices in December 2023. Link users directly to the `.appinstaller` file instead.

The host must serve the right MIME types:

| Extension | MIME type |
| --- | --- |
| `.msix` | `application/msix` |
| `.appinstaller` | `application/appinstaller` |

Generate a local App Installer file after you know the release URLs:

```powershell
./packaging/windows/New-CodexAppInstaller.ps1 `
  -PackageName 'Your.PackageName' `
  -Publisher 'CN=Codex Local Test' `
  -Version '26.429.20946.0' `
  -Architecture 'arm64' `
  -PackageUri 'https://github.com/sliepie/codex-app/releases/download/v26.429.20946/Codex-arm64-self-signed.msix' `
  -AppInstallerUri 'https://sliepie.github.io/codex-app/Codex.appinstaller' `
  -HoursBetweenUpdateChecks 0 `
  -ShowPrompt $true `
  -UpdateBlocksActivation $false `
  -OutputPath './out/windows/Codex.appinstaller'
```

## References

- Microsoft Learn: https://learn.microsoft.com/windows/msix/package/sign-msix-package-guide
- Microsoft Learn: https://learn.microsoft.com/windows/msix/app-installer/update-settings
- Microsoft Learn: https://learn.microsoft.com/windows/msix/app-installer/installing-windows10-apps-web
- Electron Forge: https://www.electronforge.io/config/makers/msix

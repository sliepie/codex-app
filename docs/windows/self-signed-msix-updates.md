# Self-signed MSIX updates

This is the Windows path for a self-signed non-Store Codex MSIX release:

1. Build the Electron `win32` payload on the GitHub runner.
2. Copy the generated app payload into the staged MSIX package folder.
3. Stage the required MSIX manifest and logo assets without committing generated `codex/` payload files.
4. Remove stale generated package-signature files from the staged copy.
5. Update `AppxManifest.xml` with the release identity, publisher, architecture, and four-part MSIX version.
6. Generate `resources.pri` so Windows can resolve the target-size unplated icon assets.
7. Pack the staged folder into an unsigned `.msix`.
8. Sign the `.msix` with an existing self-signed PFX supplied through GitHub secrets.
9. Export the public `.cer` next to the `.msix`.
10. Generate a `.appinstaller` file that points to the GitHub Pages `.msix`.
11. Publish the `.msix`, `.cer`, and `.appinstaller` to GitHub Pages for App Installer updates.
12. Publish the same files as GitHub Release assets for archive/manual download.

Create the self-signed PFX with `packaging/windows/New-SelfSignedCodexSigningCertificate.ps1`, keep the PFX private, and pass it to the GitHub workflow through secrets. The `.cer` is public and can be shared so target machines can trust packages signed by the private PFX.

Self-signing is cheap and useful for local installs or controlled testing. It is not a public trust chain. Every target Windows user must trust the `.cer` before installing the MSIX.

## Install the published build

Install the public certificate before opening the App Installer file:

```powershell
Import-Certificate `
  -FilePath .\CodexSelfSigned.cer `
  -CertStoreLocation Cert:\LocalMachine\TrustedPeople
```

Run that command from an elevated PowerShell prompt after downloading
`CodexSelfSigned.cer` from GitHub Pages or the GitHub Release. App Installer
does not search the current user's certificate store when it verifies package
identity, so importing into `Cert:\CurrentUser\...` is not enough.

After the certificate is trusted, open
`https://sliepie.github.io/codex-app/Codex.appinstaller` to install or update
Codex.

## GitHub configuration

Main release builds in `Windows ARM64 Release Artifacts` build and publish the
ZIP plus self-signed MSIX/App Installer path when the release build is not
skipped by the build marker. Scheduled and `main` push runs only skip when the
build marker exists and the matching GitHub Release is still published. Deleting
that release forces the next scheduled or `main` push run to rebuild and publish
the same version again. Manual workflow runs against `main` always rebuild and
publish the same release assets for the currently resolved upstream Codex app
version. Manual workflow runs against other branches build artifacts only and do
not publish GitHub Release or Pages assets.

Set these repository variables:

- `SELF_SIGNED_PACKAGE_NAME`: MSIX package identity name.
- `SELF_SIGNED_PACKAGE_PUBLISHER`: certificate subject, for example `CN=Codex Local Test`.
- `SELF_SIGNED_APPINSTALLER_URI`: stable public URL where `Codex.appinstaller` will be hosted.
- `SELF_SIGNED_PAGES_BASE_URL`: stable public base URL for the Pages-hosted update assets, without a trailing slash.

Set these repository secrets:

- `SELF_SIGNED_PFX_BASE64`: base64-encoded PFX bytes.
- `SELF_SIGNED_PFX_PASSWORD`: PFX password.

Use a distinct package identity for self-signed builds. Do not use `OpenAI.Codex`; that identity belongs to the official app package.

Generate those values with:

```powershell
$password = Read-Host -AsSecureString 'PFX password'

./packaging/windows/New-SelfSignedCodexSigningCertificate.ps1 `
  -PackageName 'Sliepie.Codex.SelfSigned' `
  -Publisher 'CN=Codex Local Test' `
  -AppInstallerUri 'https://sliepie.github.io/codex-app/Codex.appinstaller' `
  -CertificatePassword $password `
  -OutputDirectory './out/windows/signing'
```

The script writes:

- `CodexSelfSigned.pfx`: private signing certificate. Do not commit it.
- `CodexSelfSigned.cer`: public trust certificate for target machines.
- `CodexSelfSigned.pfx.base64.txt`: value for `SELF_SIGNED_PFX_BASE64`.
- `CodexSelfSigned.github-values.txt`: variable and secret checklist, including the Pages base URL.

Never commit the PFX, its base64 text, or its password. The public trust certificate is committed at `packaging/windows/certs/CodexSelfSigned.cer` and should match the private PFX stored in GitHub secrets.

The workflow builds `arm64` packages on GitHub's Windows runner, matching the repo's existing Windows ARM64 release workflow and hydration scripts.

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

GitHub Pages is the canonical self-signed update host. The workflow deploys `Codex.appinstaller`, `Codex-arm64-self-signed.msix`, and `CodexSelfSigned.cer` to Pages. GitHub Releases keep archive/manual-download copies of the same files.

Set:

```text
SELF_SIGNED_APPINSTALLER_URI=https://sliepie.github.io/codex-app/Codex.appinstaller
SELF_SIGNED_PAGES_BASE_URL=https://sliepie.github.io/codex-app
```

The host must serve the right MIME types and include `Content-Length`:

| Extension | MIME type |
| --- | --- |
| `.msix` | `application/msix` |
| `.appinstaller` | `application/appinstaller` |

After the first Pages deployment, verify the live headers:

```powershell
Invoke-WebRequest -Method Head -Uri 'https://sliepie.github.io/codex-app/Codex.appinstaller'
Invoke-WebRequest -Method Head -Uri 'https://sliepie.github.io/codex-app/Codex-arm64-self-signed.msix'
```

Generate a local App Installer file after you know the release URLs:

```powershell
./packaging/windows/New-CodexAppInstaller.ps1 `
  -PackageName 'Your.PackageName' `
  -Publisher 'CN=Codex Local Test' `
  -Version '26.429.20946.0' `
  -Architecture 'arm64' `
  -PackageUri 'https://sliepie.github.io/codex-app/Codex-arm64-self-signed.msix' `
  -AppInstallerUri 'https://sliepie.github.io/codex-app/Codex.appinstaller' `
  -HoursBetweenUpdateChecks 0 `
  -ShowPrompt $true `
  -UpdateBlocksActivation $false `
  -OutputPath './out/windows/Codex.appinstaller'
```

## References

- Microsoft Learn: https://learn.microsoft.com/windows/msix/package/sign-msix-package-guide
- Microsoft Learn: https://learn.microsoft.com/windows/msix/app-installer/troubleshoot-appinstaller-issues
- Microsoft Learn: https://learn.microsoft.com/windows/msix/app-installer/update-settings
- Microsoft Learn: https://learn.microsoft.com/windows/msix/app-installer/installing-windows10-apps-web
- Electron Forge: https://www.electronforge.io/config/makers/msix

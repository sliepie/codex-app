# Azure Artifact Signing MSIX updates

This is the production Windows path for a non-Store Codex MSIX release:

1. Stage the unpacked Windows package payload.
2. Remove stale generated package-signature files from the staged copy.
3. Update `AppxManifest.xml` with the release identity, publisher, architecture, and four-part MSIX version.
4. Pack the staged folder into an unsigned `.msix`.
5. Sign the `.msix` with Azure Artifact Signing.
6. Generate a `.appinstaller` file that points to the GitHub Release `.msix`.
7. Publish both files as release assets.

The `.msix` can live on GitHub Releases. The `.appinstaller` should have a stable URL because Windows uses that URL for future update checks. GitHub Pages is a better fit for that stable endpoint than a per-tag release URL.

This workflow expects a complete Windows payload under `codex/`. The current manifest declares `app\Codex.exe`; if the checkout only contains supporting DLLs/resources and not that executable, the workflow stops before packing. Hydrate or build the Windows payload first, then rerun the workflow.

## Eligibility and cost

Microsoft now calls Trusted Signing **Azure Artifact Signing** in the docs. Some tooling still uses the old Trusted Signing name.

Current Microsoft guidance says:

- Basic SKU: USD 9.99 per Artifact Signing account per month, 5,000 signatures/month, USD 0.005 per signature after quota.
- Premium SKU: USD 99.99 per account per month, 100,000 signatures/month, USD 0.005 per signature after quota.
- Public Trust signing supports organizations in the USA, Canada, the European Union, and the United Kingdom.
- Public Trust signing for individual developers is currently limited to the USA and Canada.
- Billing is not prorated after the account is created.

So for a European natural person, this is not currently the cheap public-trust path. For a European legal entity, the Basic SKU is the likely low-cost route. If only an individual European identity is available, use an OV code-signing certificate or Microsoft Store distribution instead.

## Self-signed route

Self-signing is the cheapest route for local installs and controlled testing. It does not create a public trust chain. Every target Windows user must trust the generated certificate before installing the MSIX.

Use it when:

- You are installing only on your own machines.
- You are testing the package/update mechanics before paying for a public-trust signer.
- You can explicitly import the `.cer` into `Cert:\CurrentUser\TrustedPeople` or deploy it through device management.

Do not use it as the public release path. Public users will see trust failures unless they install your certificate first.

Create a self-signed MSIX locally:

```powershell
$password = Read-Host -AsSecureString 'PFX password'

./packaging/windows/New-SelfSignedCodexMsix.ps1 `
  -SourcePath './codex' `
  -PackageName 'Local.Codex' `
  -Publisher 'CN=Codex Local Test' `
  -Version '26.429.20946.0' `
  -Architecture 'arm64' `
  -CertificatePassword $password `
  -OutputDirectory './out/windows/self-signed' `
  -TrustCertificate
```

Omit `-TrustCertificate` when you only want to create the `.cer` and `.pfx` without modifying the current user's certificate stores. Use `-TrustCertificate` only on machines where you intentionally want to trust packages signed by that generated certificate.

This script stops before certificate creation if the staged payload is incomplete. In this checkout, `AppxManifest.xml` declares `app\Codex.exe`, so the payload must contain that file before MakeAppx can produce a valid package.

## Required Azure inputs

The release workflow intentionally requires these values instead of guessing:

- Azure tenant ID
- Azure client ID
- Azure client secret, or an OIDC setup replacing the secret-based login
- Artifact Signing endpoint, for example `https://weu.codesigning.azure.net`
- Artifact Signing account name
- Artifact Signing certificate profile name
- MSIX package identity name
- MSIX publisher subject copied from the Artifact Signing certificate profile
- Stable `.appinstaller` URL

For MSIX, the manifest `Publisher` must exactly match the Artifact Signing certificate subject. If they do not match, signing fails or the package cannot be installed.

## Update behavior

The generated App Installer file uses both supported update checks:

- `OnLaunch` checks when the app starts.
- `AutomaticBackgroundTask` checks about every 8 hours without user launch.

The workflow passes `HoursBetweenUpdateChecks=0` explicitly so launch checks happen every time. That is useful while validating the update channel. Increase it before broad distribution if every-launch checks are too noisy.

## Hosting rule

Do not rely on `ms-appinstaller:?source=` for public distribution. Microsoft disabled that protocol by default on consumer devices in December 2023. Link users directly to the `.appinstaller` file instead.

The host must serve the right MIME types:

| Extension | MIME type |
| --- | --- |
| `.msix` | `application/msix` |
| `.appinstaller` | `application/appinstaller` |

## Local generation

Generate a local App Installer file after you know the release URLs:

```powershell
./packaging/windows/New-CodexAppInstaller.ps1 `
  -PackageName 'Your.PackageName' `
  -Publisher 'CN=Your Validated Publisher' `
  -Version '26.429.20946.0' `
  -Architecture 'arm64' `
  -PackageUri 'https://github.com/sliepie/codex-app/releases/download/v26.429.20946/Codex-arm64.msix' `
  -AppInstallerUri 'https://sliepie.github.io/codex-app/Codex.appinstaller' `
  -HoursBetweenUpdateChecks 0 `
  -ShowPrompt $true `
  -UpdateBlocksActivation $false `
  -OutputPath './out/windows/Codex.appinstaller'
```

## References

- Microsoft Learn: https://learn.microsoft.com/windows/msix/package/sign-msix-package-guide
- Microsoft Learn: https://learn.microsoft.com/azure/artifact-signing/how-to-signing-integrations
- Microsoft Learn: https://learn.microsoft.com/windows/msix/app-installer/update-settings
- Microsoft Learn: https://learn.microsoft.com/windows/msix/app-installer/installing-windows10-apps-web
- Electron Forge: https://www.electronforge.io/config/makers/msix

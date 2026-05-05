# Codex App Windows ARM64 releases

This repo tracks official Codex desktop app releases and publishes Windows
ARM64 builds from them. It follows the upstream desktop release feed, hydrates
the matching app payload, adds the Windows ARM64 runtime resources, and builds
release artifacts for direct ZIP use and self-signed MSIX/App Installer
installation.

The repo does not commit the extracted Codex app payload, Windows Store package
resources, Electron output, or Codex CLI helper binaries. Those are release
inputs or build outputs, so they are hydrated during the build instead of being
tracked in git.

The appcast is the official Electron update feed for the Codex desktop app. It
is small metadata that points at the current upstream desktop ZIP; this repo
uses it to find and hydrate the app payload during a build instead of committing
that payload to git.

## Install the self-signed Windows ARM64 build

### App Installer

The current self-signed App Installer update channel is published through
GitHub Pages:

- Certificate: https://sliepie.github.io/codex-app/CodexSelfSigned.cer
- App Installer: https://sliepie.github.io/codex-app/Codex.appinstaller

Install the certificate before opening the App Installer file. Windows App
Installer validates the MSIX signature first and will not install the app until
the self-signed certificate is trusted by the machine.

Run this from an elevated PowerShell prompt:

```powershell
Import-Certificate `
  -FilePath .\CodexSelfSigned.cer `
  -CertStoreLocation Cert:\LocalMachine\TrustedPeople
```

After the certificate is installed, open `Codex.appinstaller` to install or
update Codex.

### ZIP

The ZIP does not need App Installer or the certificate. Extract it and run
`Codex.exe` directly from the extracted folder.

Latest ZIP:

- https://github.com/sliepie/codex-app/releases/latest/download/codex-app-windows-arm64.zip

### Release Assets

The latest GitHub Release also exposes direct links for the self-signed install
assets:

- Certificate: https://github.com/sliepie/codex-app/releases/latest/download/CodexSelfSigned.cer
- App Installer: https://github.com/sliepie/codex-app/releases/latest/download/Codex.appinstaller
- MSIX: https://github.com/sliepie/codex-app/releases/latest/download/Codex-arm64-self-signed.msix

## Layout

- `desktop/`: minimal Electron Forge packaging workspace.
- `desktop/scripts/hydrate-codex-app.ts`: reads the official Electron update
  feed, downloads the latest upstream Codex app ZIP, and extracts `app.asar`.
- `desktop/scripts/hydrate-codex-cli.ts`: downloads the latest Windows ARM64
  Codex CLI and helper binaries from `openai/codex`.
- `desktop/scripts/update-node-repl.ps1`: refreshes the vendored x64
  `node_repl.exe` fallback from the official Microsoft Store Codex app.
- `desktop/scripts/refresh-recovered-from-dmg.mjs`: extracts the app payload
  into `desktop/recovered/app-asar-extracted/`.
- `desktop/forge.config.js`: packages the app and creates the Windows ARM64
  ZIP with Electron Forge.
- `docs/windows/`: Windows self-signed MSIX and App Installer update notes

## Local Build

From `desktop/`:

```shell
fnm install 22
fnm use 22
npm ci
npm run make:win:arm64
```

`fnm` is Fast Node Manager. It installs and switches to the Node.js version
used by the Electron packaging workspace before `npm ci` runs.

The build hydrates `desktop/recovered/app-asar-extracted/` from the official
appcast and downloads the Windows ARM64 Codex CLI resources before packaging.
The ZIP output is written under `desktop/out/make/zip/win32/arm64/`.

## Vendored `node_repl.exe`

The Windows ARM64 package tracks `desktop/resources/node_repl.exe` because
`node_repl` is closed source and no Windows ARM64 source or download path is
available. It is the only accepted x64 resource-binary exception.

From `desktop/`, refresh it with:

```powershell
npm run update:node-repl
```

The updater installs or upgrades the official Microsoft Store Codex app
(`9PLM9XGG6VKS`), copies `node_repl.exe`, writes provenance metadata next to
the binary, and uninstalls Codex only if the script installed it into a
previously missing state.

- Built installers and packaging outputs are release artifacts and should not be committed to git.
- Windows self-signed MSIX/App Installer work is documented in `docs/windows/self-signed-msix-updates.md`.

## Disclaimer

This repository and its Windows ARM64 release artifacts are unofficial. They are
not affiliated with, endorsed by, or supported by OpenAI.

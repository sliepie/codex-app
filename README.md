# codex-app-win-arm64

Codex desktop app packaging for Windows ARM64.

This repo builds a Windows ARM64 Electron package from the latest official
Codex app payload in the production appcast. It does not track the extracted
Codex app payload, Windows Store package resources, Electron output, or Codex
CLI helper binaries.

## Layout

- `desktop/`: minimal Electron Forge packaging workspace.
- `desktop/scripts/hydrate-codex-app.ts`: downloads the latest upstream Codex
  app ZIP from the appcast and extracts `app.asar`.
- `desktop/scripts/hydrate-codex-cli.ts`: downloads the latest Windows ARM64
  Codex CLI and helper binaries from `openai/codex`.
- `desktop/scripts/update-node-repl.ps1`: refreshes the vendored x64
  `node_repl.exe` fallback from the official Microsoft Store Codex app.
- `desktop/scripts/refresh-recovered-from-dmg.mjs`: extracts the app payload
  into `desktop/recovered/app-asar-extracted/`.
- `desktop/forge.config.js`: packages the app and creates the Windows ARM64
  ZIP with Electron Forge.
- `docs/windows/`: Windows MSIX, signing, and App Installer update notes

## Local Build

From `desktop/`:

```shell
fnm install 22
fnm use 22
npm ci
npm run make:win:arm64
```

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

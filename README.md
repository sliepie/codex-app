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
- `desktop/scripts/refresh-recovered-from-dmg.mjs`: extracts the app payload
  into `desktop/recovered/app-asar-extracted/`.
- `desktop/forge.config.js`: packages the app and creates the Windows ARM64
  ZIP with Electron Forge.

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

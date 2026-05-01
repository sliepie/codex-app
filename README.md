# codex-app-win-arm64

Codex desktop app packaging for Windows ARM64.

This repo builds a Windows ARM64 Electron package from the latest official
Codex app payload in the production appcast. It does not track the extracted
Codex app payload, Windows Store package resources, Electron output, or Codex
CLI helper binaries.

## Layout

- `desktop/`: minimal Electron Forge packaging workspace.
- `desktop/scripts/hydrate-codex-app.ps1`: downloads the latest upstream Codex
  app ZIP from the appcast and extracts `app.asar`.
- `desktop/scripts/refresh-recovered-from-dmg.mjs`: extracts the app payload
  into `desktop/recovered/app-asar-extracted/`.
- `desktop/scripts/zip-windows-arm64.ps1`: zips the packaged Windows ARM64 app.

## Local Build

From `desktop/`:

```powershell
npm ci
npm run make:win:arm64
```

The build hydrates `desktop/recovered/app-asar-extracted/` from the official
appcast before packaging. The ZIP output is written under
`desktop/out/release-assets/`.

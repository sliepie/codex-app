# codex-app-win-arm64

Codex desktop app packaging and release repository for Windows ARM64.

This repo tracks an Electron-based Windows ARM64 packaging pipeline that keeps
the recovered Codex app payload in git and builds release ZIP artifacts from a
native Windows ARM64 GitHub Actions runner.

## Layout

- `desktop/`: Electron Forge workspace used to build Windows ARM64 release ZIPs.
- `desktop/recovered/app-asar-extracted/`: recovered Codex app payload used by
  the active packaging line.
- `codex/`: canonical upstream payload root kept for comparison and refresh work.

GitHub release artifacts:

- Release tags like `v26.429.20946` trigger `.github/workflows/windows-arm64-release.yml`.
- Built ZIPs are release-only outputs and are not tracked in git.
- The app expects the Codex CLI path to be supplied by the runtime environment;
  this package does not vendor the CLI helper binaries into Electron resources.

## Local Build

From `desktop/`:

```powershell
npm ci
npm run make:win:arm64
```

The ZIP output is written under `desktop/out/make`.

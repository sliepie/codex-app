---
name: store-package-update
description: "Store package update for codex-app. Use when refreshing Store-vendored helper binaries, replacing the Windows Forge/Electron shell with the Store/Owl Codex.exe and chrome.dll payload, or changing Store provenance and resource-binary exceptions."
---

# Store Package Dependency Update

## Start

- Confirm the branch and PR state with `git status --short --branch`; never work on `main`.
- Use one Store package refresh flow for helper binaries and Store/Owl shell payloads together.
- If a PR already exists for Store package binaries, push follow-up commits to that PR branch. Completion criterion: the branch and PR title describe the combined Store package binary refresh.
- Read the context pointers below before editing. Completion criterion: every listed file that exists has been inspected.

## Context Pointers

- `AGENTS.md`, `CONTEXT.md`, `docs/executable-inventory.md`.
- `docs/adr/0001-use-official-x64-node-repl-fallback.md`.
- `desktop/package.json`, `desktop/scripts/update-node-repl.ps1`, `desktop/scripts/update-store-owl-shell.ts`, `desktop/scripts/store-owl-shell-common.ts`, and `desktop/scripts/resource-binary-exceptions.ts`.
- `desktop/forge.config.js`, `desktop/scripts/prepare-self-signed-msix-payload.ts`, `desktop/scripts/windows-package-resources.test.mjs`, `desktop/scripts/assert-store-owl-shell-package-payload.ts`, and `desktop/scripts/assert-windows-primary-window-flags.ts`.
- `desktop/resources/store-owl-shell.json` and the three helper metadata JSON files under `desktop/resources/`.

## Store Source Rules

- Treat the Microsoft Store package as the fallback source: copy Store payloads only when the equivalent Windows ARM64 payload cannot be built, downloaded from a public source, or hydrated from the macOS app.
- Use only the official Microsoft Store Codex package for product ID `9PLM9XGG6VKS` and package identity `OpenAI.Codex`.
- Do not use `OpenAI.Codex.Arm64Dev`, copied WindowsApps folders, macOS appcast artifacts, GitHub release assets, Google Chrome, Chromium, npm Electron packages, or arbitrary local paths as Windows Store/Owl sources.
- Use only the installed package location resolved from the official Store package that the updater installed or upgraded.
- If the updater temporarily installs or upgrades Store Codex, uninstall it afterward only when it was missing before the run.

## Store Package Refresh

- Run `npm --prefix desktop run update:store-package` from the repo root to refresh all Store-sourced binary payloads in one pass.
- The combined update refreshes Store-vendored `node_repl.exe`, Chrome `extension-host.exe`, Computer Use `codex-computer-use.exe`, and the Store/Owl shell payload.
- Completion criterion: helper metadata records the official Store package identity, version, source-relative path, architecture, and SHA; the tracked Store/Owl archive `desktop/resources/store-owl-shell/package.tar.gz` contains the matched Store payload set; and `desktop/resources/store-owl-shell.json` records Store source identity, archive size/SHA, version, source-relative paths, sizes, SHA values, architectures, nested native payloads, and `owl-shell-runtime.json`.

## Store/Owl Shell Payload

- Goal: keep the default Windows package as a clean Forge/Electron testbed first. Store/Owl shell staging is preserved as an opt-in experiment behind `CODEX_WINDOWS_HOST_MODE=store-owl`, not the default host path.
- Customization order: validate the default Electron host first; then enable Codex++ with `CODEX_ENABLE_CODEX_PLUSPLUS=1`; then enable the Store/Owl host with `CODEX_WINDOWS_HOST_MODE=store-owl` only if the Electron host cannot satisfy the Windows behavior being tested.
- Electron testbed: the default package should keep the Electron-produced root executable and `ffmpeg.dll`, should not contain Store/Owl `chrome.dll` or root `owl-shell-runtime.json`, and should set the packaged app `main` to the recovered upstream Codex main rather than `codex-plusplus/loader.cjs`.
- Store/Owl goal: when explicitly enabled, update the Windows package to run from the official Store/Owl shell payload, replacing the old Forge/Electron shell with the Store-matched `app/Codex.exe`, `app/chrome.dll`, and sibling Chromium runtime files.
- Matched set: keep the top-level Store/Owl `app/` shell runtime files, Store-only runtime directories, `owl-shell-runtime.json`, AppX manifest identity, AppX assets, and split PRI files in version lockstep. Do not copy Store `app/resources` or Store `app/resources/app.asar`: use the Store archive only to resolve the matching public macOS appcast version/build, then hydrate the app archive and unpacked resources from that macOS payload. Keep helper resources and native module payloads hydrated, built, or copied from public/macOS sources where available. Do not copy only `chrome.dll`, only `Codex.exe`, or only icon assets.
- Commit boundary: Store/Owl shell payload binaries are intentionally committed only as the single tracked archive `desktop/resources/store-owl-shell/package.tar.gz` on Git LFS. Do not commit the extracted payload tree, unrelated copied WindowsApps paths, Store `app/resources`, Store `app/resources/app.asar`, or ad hoc local payload directories.
- Package staging: wire the Windows package flow so the tracked Store/Owl payload is staged only when `CODEX_WINDOWS_HOST_MODE=store-owl`. Updating metadata or payload automation alone is not a completed Store/Owl shell change. Completion criterion: package-resource tests cover both the default Electron testbed and the opt-in Store/Owl staging path, and the opt-in path fails when the tracked payload is missing.
- Validation: prefer MSIX/AppX validation; ZIP or unpacked launches are acceptable for file inspection only. Completion criterion: `.agents/skills/store-package-update/scripts/validate-store-owl-shell.ps1` confirms the installed package payload matches `desktop/resources/store-owl-shell.json`, except entries marked mutable for self-signed identity-resource rewrites; the installed build contains Store/Owl `app/Codex.exe`, `app/chrome.dll`, and `owl-shell-runtime.json`; a launched Windows build has a visible primary window with `WS_EX_APPWINDOW` and without `WS_EX_NOACTIVATE`.
- Fallback: stock Electron taskbar/focus patches are fallback-only. Completion criterion: a failing Store/Owl MSIX/AppX smoke check proves Store/Owl package parity cannot solve the issue first.

## Helper Binary Payload

- Keep every resource binary ARM64 unless it cannot be compiled, downloaded, or otherwise obtained for Windows ARM64.
- Keep `desktop/resources/cua_node/bin/node_repl.exe` and `desktop/resources/extension-host.exe` ARM64 when the Store package provides ARM64 binaries.
- Keep `desktop/resources/codex-computer-use.exe` as an accepted x64 exception until an ARM64 helper exists.
- Keep `desktop/scripts/resource-binary-exceptions.ts` aligned with `CONTEXT.md`, `docs/adr/0001-use-official-x64-node-repl-fallback.md`, and `docs/executable-inventory.md`.
- Keep the tracked helper files limited to the three `.exe` files and their `.json` metadata unless Store/Owl shell packaging explicitly changes that rule.
- Changed helper provenance must be reflected in `docs/executable-inventory.md`; `npm --prefix desktop run verify:windows-arm64-resource-binaries` must pass against the package root being validated.

## Validation

Validation script bodies live under `.agents/skills/store-package-update/scripts/`; update those files instead of adding inline script blocks to this skill.

- Run `.agents/skills/store-package-update/scripts/validate-helper-refresh.ps1` from the repo root; pass `-PackageRoot` only when validating an already-built or temporary package tree.
- Install the built Windows package, then run `.agents/skills/store-package-update/scripts/validate-store-owl-shell.ps1 -PackageName <package identity> -PackageFamilyName <package family>` from the repo root; pass `-PackageFullName` instead when that is the precise target you have. The validation script owns launching the target package.

Confirm `Get-AppxPackage -Name OpenAI.Codex` is empty after a temporary install run unless Codex was already installed before the update.

## PR Workflow

Follow `AGENTS.md`: push follow-up commits to the existing PR branch, create a PR when none exists, and do not create empty commits when refresh plus validation produces no file changes.

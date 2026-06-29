---
name: store-package-update
description: "Maintain Store-sourced Windows package dependencies for codex-app. Use when refreshing Store-vendored helper binaries, changing Store/Owl shell packaging parity, updating Windows AppX/MSIX identity or assets, or editing Store provenance and resource-binary exceptions."
---

# Store Package Dependency Update

## Start

- Confirm the branch and PR state with `git status --short --branch`; never work on `main`.
- Choose exactly one branch: helper binary refresh, or Store/Owl shell parity.
- If the current branch or PR title points at the wrong branch, switch/create the right feature branch or get explicit approval before repurposing it.
- Read only the context for the chosen branch, then validate against that branch's completion criterion.

## Context Pointers

- **Always**: `AGENTS.md`, `CONTEXT.md`, `docs/executable-inventory.md`.
- **Helper refresh**: `docs/adr/0001-use-official-x64-node-repl-fallback.md`, `desktop/scripts/update-node-repl.ps1`, `desktop/scripts/resource-binary-exceptions.ts`, and the three helper metadata JSON files under `desktop/resources/`.
- **Shell parity**: `desktop/forge.config.js`, `desktop/scripts/prepare-self-signed-msix-payload.ts`, `desktop/scripts/windows-package-resources.test.mjs`, `desktop/resources/store-owl-shell.json` when present, and `desktop/scripts/assert-windows-primary-window-flags.ps1` when present.

## Store Source Rules

- Use only the official Microsoft Store Codex package for product ID `9PLM9XGG6VKS` and package identity `OpenAI.Codex`.
- Do not use `OpenAI.Codex.Arm64Dev`, copied WindowsApps folders, macOS appcast artifacts, GitHub release assets, Google Chrome, Chromium, npm Electron packages, or arbitrary local paths as Windows Store/Owl sources.
- Use only the installed package location resolved from the official Store package that the updater installed or upgraded.
- If the updater temporarily installs or upgrades Store Codex, uninstall it afterward only when it was missing before the run.

## Store/Owl Shell Branch

- Treat the Store/Owl shell as a matched set: `Codex.exe`, `chrome_elf.dll`, `chrome.dll`, `.pak` resources, snapshots, locales, `owl-shell-runtime.json`, app resources, AppX manifest identity, and AppX assets stay in version lockstep.
- Do not copy only `chrome.dll`, only `Codex.exe`, or only icon assets.
- Prefer Store/Owl package parity over stock Electron taskbar/focus patches. Stock Electron compatibility patches are fallback-only and need a failing smoke check first.
- Prefer MSIX/AppX validation for shell parity. ZIP or unpacked launches are acceptable for file inspection, but not as the final taskbar/focus signal.
- Store source provenance must live in `desktop/resources/store-owl-shell.json`. If that file does not exist yet, creating it is part of the shell parity change.
- `desktop/scripts/windows-package-resources.test.mjs` must cover the matched set: `Codex.exe`, `chrome_elf.dll`, `chrome.dll`, `.pak` resources, snapshots, locales, `owl-shell-runtime.json`, AppX manifest/assets, and app resources touched by the package flow.
- If no reusable window-flag smoke check exists, add `desktop/scripts/assert-windows-primary-window-flags.ps1` before claiming shell parity complete. Ad hoc Win32 snippets are diagnosis only.
- Completion criterion: the package records Store source identity, version, source-relative paths, architectures, and SHA values; package-resource tests cover the matched set; a launched Windows build passes a reusable smoke check showing a visible primary window with `WS_EX_APPWINDOW` and without `WS_EX_NOACTIVATE`.

## Helper Binary Branch

- Run `npm --prefix desktop run update:node-repl` from the repo root to refresh Store-vendored `node_repl.exe`, Chrome `extension-host.exe`, and Computer Use `codex-computer-use.exe`.
- Keep every resource binary ARM64 unless it cannot be compiled, downloaded, or otherwise obtained for Windows ARM64.
- Keep `desktop/resources/cua_node/bin/node_repl.exe` and `desktop/resources/extension-host.exe` ARM64 when the Store package provides ARM64 binaries.
- Keep `desktop/resources/codex-computer-use.exe` as an accepted x64 exception until an ARM64 helper exists.
- Keep `desktop/scripts/resource-binary-exceptions.ts` aligned with `CONTEXT.md`, `docs/adr/0001-use-official-x64-node-repl-fallback.md`, and `docs/executable-inventory.md`.
- Keep the tracked helper files limited to the three `.exe` files and their `.json` metadata unless Store/Owl shell packaging explicitly changes that rule.
- Completion criterion: helper metadata records the official Store package identity, version, source-relative path, architecture, and SHA; changed provenance is reflected in `docs/executable-inventory.md`; `npm --prefix desktop run verify:windows-arm64-resource-binaries` passes.

## Validation

For helper binary refreshes, run:

```powershell
node -e "const fs=require('fs'); JSON.parse(fs.readFileSync('desktop/resources/cua_node/bin/node_repl.json','utf8')); JSON.parse(fs.readFileSync('desktop/resources/extension-host.json','utf8')); JSON.parse(fs.readFileSync('desktop/resources/codex-computer-use.json','utf8')); JSON.parse(fs.readFileSync('desktop/package.json','utf8')); console.log('json ok')"
$bytes=[IO.File]::ReadAllBytes('desktop\resources\cua_node\bin\node_repl.exe'); $pe=[BitConverter]::ToInt32($bytes,0x3c); $machine=[BitConverter]::ToUInt16($bytes,$pe+4); if ($machine -ne 0xaa64) { throw "Expected ARM64 node_repl.exe" }; 'node_repl.exe ARM64 ok'
$bytes=[IO.File]::ReadAllBytes('desktop\resources\extension-host.exe'); $pe=[BitConverter]::ToInt32($bytes,0x3c); $machine=[BitConverter]::ToUInt16($bytes,$pe+4); if ($machine -ne 0xaa64) { throw "Expected ARM64 extension-host.exe" }; 'extension-host.exe ARM64 ok'
$bytes=[IO.File]::ReadAllBytes('desktop\resources\codex-computer-use.exe'); $pe=[BitConverter]::ToInt32($bytes,0x3c); $machine=[BitConverter]::ToUInt16($bytes,$pe+4); if ($machine -ne 0x8664) { throw "Expected x64 codex-computer-use.exe" }; 'codex-computer-use.exe x64 ok'
npm --prefix desktop run verify:windows-arm64-resource-binaries
git diff --check
```

Run those helper validation commands from the repo root. For Store/Owl shell changes, also run:

```powershell
npm --prefix desktop run test:windows-package-resources:compiled
powershell -NoProfile -ExecutionPolicy Bypass -File .\desktop\scripts\assert-windows-primary-window-flags.ps1 -PackageName Sliepie.Codex.SelfSigned
git diff --check
```

Install or launch the built Windows package from its package identity path before running the window-flag smoke check.

Confirm `Get-AppxPackage -Name OpenAI.Codex` is empty after a temporary install run unless Codex was already installed before the update.

## PR Workflow

Follow `AGENTS.md`: push follow-up commits to the existing PR branch, create a PR when none exists, and do not create empty commits when refresh plus validation produces no file changes.

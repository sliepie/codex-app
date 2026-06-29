---
name: store-package-update
description: "Maintain Store-sourced Windows package dependencies for this repo. Use when updating or comparing the official Store/Owl Windows shell layout, Store-vendored helper binaries (`node_repl.exe`, `extension-host.exe`, `codex-computer-use.exe`), Store package provenance, Windows package identity/assets, resource-binary exceptions, or the Windows ARM64 Codex Desktop package path that depends on the official Microsoft Store `OpenAI.Codex` package."
---

# Store Package Dependency Update

## Quick Start

From the repo root:

```powershell
git status --short --branch
cd desktop
npm run update:node-repl
```

Despite the script name, `npm run update:node-repl` refreshes the Store-sourced helper binaries: `node_repl.exe`, Chrome `extension-host.exe`, and Computer Use `codex-computer-use.exe`.

For Store/Owl shell parity work, do not patch stock Electron window behavior first. Inspect the official Store package, treat the Owl runtime files as a matched package set, update packaging automation/tests, and validate with a real Windows window/taskbar smoke check.

## Context To Read First

- `AGENTS.md`
- `CONTEXT.md`
- `docs/adr/0001-use-official-x64-node-repl-fallback.md`
- `README.md`
- `docs/executable-inventory.md`
- `desktop/forge.config.js`
- `desktop/scripts/prepare-self-signed-msix-payload.ts`
- `desktop/scripts/update-node-repl.ps1`
- `desktop/scripts/resource-binary-exceptions.ts`
- `desktop/scripts/windows-package-resources.test.mjs`
- `desktop/resources/cua_node/bin/node_repl.json`
- `desktop/resources/extension-host.json`
- `desktop/resources/codex-computer-use.json`

## Store/Owl Shell Rules

- Use only the official Microsoft Store Codex package for product ID `9PLM9XGG6VKS` and package identity `OpenAI.Codex`.
- Do not use `OpenAI.Codex.Arm64Dev`, a copied WindowsApps folder, macOS appcast artifacts, GitHub release assets, Google Chrome, Chromium, npm Electron packages, or arbitrary local paths as the source of Windows shell runtime files.
- The only acceptable source path is the installed package location resolved from the official Store package that the updater installed or upgraded.
- Treat the Store/Owl shell as an atomic matched set. Do not copy only `chrome.dll`, only `Codex.exe`, or only icon assets.
- Keep `Codex.exe`, `chrome_elf.dll`, `chrome.dll`, `.pak` resources, snapshots, locales, `owl-shell-runtime.json`, app resources, AppX manifest identity, and AppX assets in version lockstep with the same Store package.
- For taskbar/focus regressions, prefer Store/Owl package parity over stock Electron patches. Stock Electron compatibility patches are fallback-only and must be backed by a failing smoke check.
- For Windows taskbar/focus validation, the visible primary window must have `WS_EX_APPWINDOW` and must not have `WS_EX_NOACTIVATE`.
- Prefer MSIX/AppX validation for shell parity and taskbar behavior. ZIP/unpacked launches are acceptable for file inspection, but not as the final Windows shell parity signal.

## Helper Binary Rules

- Keep every resource binary ARM64 unless it cannot be compiled, downloaded, or otherwise obtained for Windows ARM64.
- `desktop/resources/cua_node/bin/node_repl.exe` and `desktop/resources/extension-host.exe` are Store-vendored ARM64 helpers when available. `desktop/resources/codex-computer-use.exe` is an accepted x64 resource-binary exception until an ARM64 helper exists.
- The authoritative exception list is `desktop/scripts/resource-binary-exceptions.ts`; keep it aligned with `CONTEXT.md`, `docs/adr/0001-use-official-x64-node-repl-fallback.md`, and `docs/executable-inventory.md`.
- Refresh helper binaries only from the official Store package through `npm run update:node-repl`.
- The updater may temporarily install or upgrade the Store Codex app. It must uninstall Codex only if it installed it into a previously missing state.
- Keep `desktop/resources/cua_node/bin/node_repl.exe`, `desktop/resources/cua_node/bin/node_repl.json`, `desktop/resources/extension-host.exe`, `desktop/resources/extension-host.json`, `desktop/resources/codex-computer-use.exe`, and `desktop/resources/codex-computer-use.json` tracked. Keep the rest of `desktop/resources/*` ignored unless Store/Owl shell packaging explicitly changes that rule.
- If the package identity, version, architecture, or SHA changes, update `docs/executable-inventory.md`.
- Do not touch `out/`, generated files, `bin/`, or `obj/`.

## Validation

Run these before committing helper binary refreshes:

```powershell
node -e "const fs=require('fs'); JSON.parse(fs.readFileSync('desktop/resources/cua_node/bin/node_repl.json','utf8')); JSON.parse(fs.readFileSync('desktop/resources/extension-host.json','utf8')); JSON.parse(fs.readFileSync('desktop/resources/codex-computer-use.json','utf8')); JSON.parse(fs.readFileSync('desktop/package.json','utf8')); console.log('json ok')"
$bytes=[IO.File]::ReadAllBytes('desktop\resources\cua_node\bin\node_repl.exe'); $pe=[BitConverter]::ToInt32($bytes,0x3c); $machine=[BitConverter]::ToUInt16($bytes,$pe+4); if ($machine -ne 0xaa64) { throw "Expected ARM64 node_repl.exe" }; 'node_repl.exe ARM64 ok'
$bytes=[IO.File]::ReadAllBytes('desktop\resources\extension-host.exe'); $pe=[BitConverter]::ToInt32($bytes,0x3c); $machine=[BitConverter]::ToUInt16($bytes,$pe+4); if ($machine -ne 0xaa64) { throw "Expected ARM64 extension-host.exe" }; 'extension-host.exe ARM64 ok'
$bytes=[IO.File]::ReadAllBytes('desktop\resources\codex-computer-use.exe'); $pe=[BitConverter]::ToInt32($bytes,0x3c); $machine=[BitConverter]::ToUInt16($bytes,$pe+4); if ($machine -ne 0x8664) { throw "Expected x64 codex-computer-use.exe" }; 'codex-computer-use.exe x64 ok'
npm run verify:windows-arm64-resource-binaries
git diff --check
```

For Store/Owl shell changes, also validate the built Windows app from the installed/package identity path and assert the visible primary window has `WS_EX_APPWINDOW` and does not have `WS_EX_NOACTIVATE`.

Confirm `Get-AppxPackage -Name OpenAI.Codex` is empty after a temporary install run, unless Codex was already installed before the update.

## PR And Automerge Workflow

Use a feature branch, never `main`, `codex`, or `codex/*`.

If a PR already exists for the branch, push follow-up commits to that PR branch. If no PR exists, create one.

The update must be reviewable through a PR and can be automerged. After pushing, enable automerge on the PR when repository rules allow it:

```powershell
gh pr merge --auto --squash
```

If there are no file changes after refresh and validation, do not create an empty commit or new PR.

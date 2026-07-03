---
name: store-package-update
description: "Store package update for codex-app. Use when refreshing Store-vendored helper binaries, replacing the Windows Forge/Electron shell with the Store/Owl Codex.exe and chrome.dll payload, or changing Store provenance and resource-binary exceptions."
---

# Store Package Dependency Update

## Start

- Confirm the branch and PR state with `git status --short --branch`; never work on `main`.
- Choose exactly one branch for the run: helper refresh, or Store/Owl shell migration.
- If the current branch or PR title points at the wrong branch, switch/create the right feature branch or get explicit approval before repurposing it. Completion criterion: the branch and PR title describe the chosen branch.
- Read only the context for the chosen branch. Completion criterion: every file listed for that branch below has been inspected before editing.

## Context Pointers

- **Always**: `AGENTS.md`, `CONTEXT.md`, `docs/executable-inventory.md`.
- **Helper refresh**: `docs/adr/0001-use-official-x64-node-repl-fallback.md`, `desktop/scripts/update-node-repl.ps1`, `desktop/scripts/resource-binary-exceptions.ts`, and the three helper metadata JSON files under `desktop/resources/`.
- **Shell parity**: `desktop/forge.config.js`, `desktop/scripts/prepare-self-signed-msix-payload.ts`, `desktop/scripts/windows-package-resources.test.mjs`, `desktop/resources/store-owl-shell.json` when present, and `desktop/scripts/assert-windows-primary-window-flags.ts` when present.

## Store Source Rules

- Use only the official Microsoft Store Codex package for product ID `9PLM9XGG6VKS` and package identity `OpenAI.Codex`.
- Do not use `OpenAI.Codex.Arm64Dev`, copied WindowsApps folders, macOS appcast artifacts, GitHub release assets, Google Chrome, Chromium, npm Electron packages, or arbitrary local paths as Windows Store/Owl sources.
- Use only the installed package location resolved from the official Store package that the updater installed or upgraded.
- If the updater temporarily installs or upgrades Store Codex, uninstall it afterward only when it was missing before the run.

## Store/Owl Shell Migration Branch

- Goal: update the Windows package to run from the official Store/Owl shell payload, replacing the old Forge/Electron shell with the Store-matched `app/Codex.exe`, `app/chrome.dll`, and sibling Chromium runtime files.
- Source: run `npm --prefix desktop run update:store-owl-shell` from the repo root. Completion criterion: the ignored Store/Owl cache contains the matched Store payload set, and `desktop/resources/store-owl-shell.json` records Store source identity, version, source-relative paths, sizes, SHA values, architectures, and `owl-shell-runtime.json`.
- Matched set: keep the full top-level `app/` runtime file set, locales, `owl-shell-runtime.json`, app resources, AppX manifest identity, AppX assets, and split PRI files in version lockstep. Do not copy only `chrome.dll`, only `Codex.exe`, or only icon assets.
- Commit boundary: do not commit Store/Owl shell payload binaries such as `Codex.exe`, `chrome_elf.dll`, `chrome.dll`, `.pak` resources, snapshots, locales, or AppX image assets unless the repo intentionally adds a tracked allowlist for that branch. Commit provenance metadata, package automation, and tests.
- Package staging: wire the Windows package flow to stage the Store/Owl cache into the built MSIX/AppX payload before validation. Updating metadata or cache automation alone is not a completed Store/Owl shell change. Completion criterion: package-resource tests cover the package staging path.
- Validation: prefer MSIX/AppX validation; ZIP or unpacked launches are acceptable for file inspection only. Completion criterion: `.agents/skills/store-package-update/scripts/validate-store-owl-shell.ps1` confirms the installed package payload matches `desktop/resources/store-owl-shell.json`, except entries marked mutable for self-signed identity-resource rewrites; the installed build contains Store/Owl `app/Codex.exe`, `app/chrome.dll`, and `owl-shell-runtime.json`; a launched Windows build has a visible primary window with `WS_EX_APPWINDOW` and without `WS_EX_NOACTIVATE`.
- Fallback: stock Electron taskbar/focus patches are fallback-only. Completion criterion: a failing Store/Owl MSIX/AppX smoke check proves Store/Owl package parity cannot solve the issue first.

## Helper Binary Branch

- Run `npm --prefix desktop run update:node-repl` from the repo root to refresh Store-vendored `node_repl.exe`, Chrome `extension-host.exe`, and Computer Use `codex-computer-use.exe`.
- Keep every resource binary ARM64 unless it cannot be compiled, downloaded, or otherwise obtained for Windows ARM64.
- Keep `desktop/resources/cua_node/bin/node_repl.exe` and `desktop/resources/extension-host.exe` ARM64 when the Store package provides ARM64 binaries.
- Keep `desktop/resources/codex-computer-use.exe` as an accepted x64 exception until an ARM64 helper exists.
- Keep `desktop/scripts/resource-binary-exceptions.ts` aligned with `CONTEXT.md`, `docs/adr/0001-use-official-x64-node-repl-fallback.md`, and `docs/executable-inventory.md`.
- Keep the tracked helper files limited to the three `.exe` files and their `.json` metadata unless Store/Owl shell packaging explicitly changes that rule.
- Completion criterion: helper metadata records the official Store package identity, version, source-relative path, architecture, and SHA; changed provenance is reflected in `docs/executable-inventory.md`; `npm --prefix desktop run verify:windows-arm64-resource-binaries` passes.

## Validation

Validation script bodies live under `.agents/skills/store-package-update/scripts/`; update those files instead of adding inline script blocks to this skill.

- For helper binary refreshes, run `.agents/skills/store-package-update/scripts/validate-helper-refresh.ps1` from the repo root.
- For helper binary refreshes without `desktop/out/Codex-win32-arm64`, pass `-PackageRoot` only when validating an already-built or temporary package tree.
- For Store/Owl shell changes, install the built Windows package, then run `.agents/skills/store-package-update/scripts/validate-store-owl-shell.ps1 -PackageName <package identity> -PackageFamilyName <package family>` from the repo root; pass `-PackageFullName` instead when that is the precise target you have. The validation script owns launching the target package.

Confirm `Get-AppxPackage -Name OpenAI.Codex` is empty after a temporary install run unless Codex was already installed before the update.

## PR Workflow

Follow `AGENTS.md`: push follow-up commits to the existing PR branch, create a PR when none exists, and do not create empty commits when refresh plus validation produces no file changes.

---
name: store-package-update
description: "Store helper refresh for codex-app. Use when refreshing Microsoft Store-vendored Windows helper binaries or updating their provenance/resource-binary exceptions."
---

# Store Helper Refresh

## Start

- Confirm the branch and PR state with `git status --short --branch`; never work on `main`.
- If a PR already exists for this helper refresh, push follow-up commits to that PR branch. Completion criterion: the active branch and PR title both describe a Store helper refresh.
- Read the context below before editing. Completion criterion: every listed file that exists has been inspected.

## Context Pointers

- `AGENTS.md`, `CONTEXT.md`, `docs/executable-inventory.md`.
- `docs/adr/0001-vendor-official-store-helper-exceptions.md`.
- `desktop/package.json`, `desktop/scripts/update-node-repl.ps1`, and `desktop/scripts/resource-binary-exceptions.ts`.
- `desktop/scripts/windows-package-resources.test.mjs`.
- The three helper metadata JSON files under `desktop/resources/`.

## Store Source Rules

- Treat the Microsoft Store package as the source only for explicitly vendored helper payloads.
- Use only the official Microsoft Store Codex package for product ID `9PLM9XGG6VKS` and package identity `OpenAI.Codex`.
- Do not use `OpenAI.Codex.Arm64Dev`, copied WindowsApps folders, macOS appcast artifacts, GitHub release assets, Google Chrome, Chromium, npm Electron packages, or arbitrary local paths as Store helper sources.
- Use only the installed package location resolved from the official Store package that the updater installed or upgraded.
- If the updater temporarily installs or upgrades Store Codex, uninstall it afterward only when it was missing before the run.

## Refresh Loop

1. Run `npm --prefix desktop run update:store-package` from the repo root. Completion criterion: these files and their metadata are updated from the same official Store package when the Store package changed:
   - `desktop/resources/cua_node/bin/node_repl.exe`
   - `desktop/resources/extension-host.exe`
   - `desktop/resources/codex-computer-use.exe`
2. Check provenance. Completion criterion: each helper metadata JSON records the official package identity, package version, source-relative path, architecture, and SHA-256 for the matching `.exe`.
3. Check architecture policy. Completion criterion: `node_repl.exe` and `extension-host.exe` are ARM64, while `codex-computer-use.exe` remains the named x64 exception until an ARM64 helper exists.
4. Keep policy docs aligned. Completion criterion: changed helper provenance or architecture policy is reflected in `CONTEXT.md`, `docs/adr/0001-vendor-official-store-helper-exceptions.md`, `docs/executable-inventory.md`, `desktop/scripts/resource-binary-exceptions.ts`, and focused package-resource tests.
5. Keep the tracked payload narrow. Completion criterion: the refresh commits only the three helper `.exe` files, their `.json` metadata, and necessary policy/test/doc updates.

## Validation

- Run `.agents/skills/store-package-update/scripts/validate-helper-refresh.ps1` from the repo root. Completion criterion: metadata exists, helper PE architectures match policy, and helper provenance is internally consistent.
- Run `npm --prefix desktop run verify:windows-arm64-resource-binaries` when a Windows package root exists or can be built for the change. Completion criterion: every packaged executable is ARM64 or matches a named exception.
- Confirm `Get-AppxPackage -Name OpenAI.Codex` is empty after a temporary Store install unless Codex was already installed before the update.

## PR Workflow

Follow `AGENTS.md`: push follow-up commits to the existing PR branch, create a PR when none exists, and do not create empty commits when refresh plus validation produces no file changes.

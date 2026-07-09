---
name: store-package-update
description: "Store package update for codex-app. Use when refreshing Store-vendored helper binaries or changing Store provenance and resource-binary exceptions."
---

# Store Package Dependency Update

## Start

- Confirm the branch and PR state with `git status --short --branch`; never work on `main`.
- If a PR already exists for Store package binaries, push follow-up commits to that PR branch. Completion criterion: the branch and PR title describe the helper binary refresh.
- Read the context pointers below before editing. Completion criterion: every listed file that exists has been inspected.

## Context Pointers

- `AGENTS.md`, `CONTEXT.md`, `docs/executable-inventory.md`.
- `docs/adr/0001-vendor-official-store-helper-exceptions.md`.
- `desktop/package.json`, `desktop/scripts/update-node-repl.ps1`, and `desktop/scripts/resource-binary-exceptions.ts`.
- `desktop/forge.config.js`, `desktop/scripts/prepare-self-signed-msix-payload.ts`, and `desktop/scripts/windows-package-resources.test.mjs`.
- The three helper metadata JSON files under `desktop/resources/`.

## Store Source Rules

- Treat the Microsoft Store package as the source only for explicitly vendored Store payloads.
- Use only the official Microsoft Store Codex package for product ID `9PLM9XGG6VKS` and package identity `OpenAI.Codex`.
- Do not use `OpenAI.Codex.Arm64Dev`, copied WindowsApps folders, macOS appcast artifacts, GitHub release assets, Google Chrome, Chromium, npm Electron packages, or arbitrary local paths as Store helper sources.
- Use only the installed package location resolved from the official Store package that the updater installed or upgraded.
- If the updater temporarily installs or upgrades Store Codex, uninstall it afterward only when it was missing before the run.

## Store Package Refresh

- Run `npm --prefix desktop run update:store-package` from the repo root to refresh all Store-sourced helper binaries in one pass.
- The update refreshes Store-vendored `node_repl.exe`, Chrome `extension-host.exe`, and Computer Use `codex-computer-use.exe`.
- Completion criterion: helper metadata records the official Store package identity, version, source-relative path, architecture, and SHA.

## Helper Binary Payload

- Keep every resource binary ARM64 unless it cannot be compiled, downloaded, or otherwise obtained for Windows ARM64.
- Keep `desktop/resources/cua_node/bin/node_repl.exe` and `desktop/resources/extension-host.exe` ARM64 when the Store package provides ARM64 binaries.
- Keep `desktop/resources/codex-computer-use.exe` as an accepted x64 exception until an ARM64 helper exists.
- Keep `desktop/scripts/resource-binary-exceptions.ts` aligned with `CONTEXT.md`, `docs/adr/0001-vendor-official-store-helper-exceptions.md`, and `docs/executable-inventory.md`.
- Keep the tracked helper files limited to the three `.exe` files and their `.json` metadata.
- Changed helper provenance must be reflected in `docs/executable-inventory.md`; `npm --prefix desktop run verify:windows-arm64-resource-binaries` must pass against the package root being validated.

## Validation

Validation script bodies live under `.agents/skills/store-package-update/scripts/`; update those files instead of adding inline script blocks to this skill.

- Run `.agents/skills/store-package-update/scripts/validate-helper-refresh.ps1` from the repo root; pass `-PackageRoot` only when validating an already-built or temporary package tree.
Confirm `Get-AppxPackage -Name OpenAI.Codex` is empty after a temporary install run unless Codex was already installed before the update.

## PR Workflow

Follow `AGENTS.md`: push follow-up commits to the existing PR branch, create a PR when none exists, and do not create empty commits when refresh plus validation produces no file changes.

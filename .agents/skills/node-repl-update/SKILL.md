---
name: node-repl-update
description: Refreshes the vendored Windows x64 `node_repl.exe` fallback for this repo and publishes changes through a PR. Use when updating `desktop/resources/node_repl.exe`, `desktop/resources/node_repl.json`, the Node REPL updater automation, or the explicit x64 resource-binary exception in the Windows ARM64 Codex Desktop package.
---

# Node REPL Update

## Quick Start

From the repo root:

```powershell
git status --short --branch
cd desktop
npm run update:node-repl
```

Then validate, update docs if the binary changed, commit on a feature branch, push, open or update a PR, and enable automerge when the PR is mergeable.

## Context To Read First

- `AGENTS.md`
- `CONTEXT.md`
- `docs/adr/0001-use-official-x64-node-repl-fallback.md`
- `README.md`
- `docs/executable-inventory.md`
- `desktop/scripts/update-node-repl.ps1`
- `desktop/resources/node_repl.json`

## Rules

- Keep every resource binary ARM64 unless it cannot be compiled, downloaded, or otherwise obtained for Windows ARM64.
- `desktop/resources/node_repl.exe` is the only accepted x64 resource-binary exception for now.
- Refresh `node_repl.exe` only from the official Microsoft Store Codex package for product ID `9PLM9XGG6VKS` through `npm run update:node-repl`.
- The package identity must be the official Store package `OpenAI.Codex`; do not use `OpenAI.Codex.Arm64Dev` or any local/dev-modified package identity.
- Do not replace the vendored binary from an arbitrary local path, a copied WindowsApps path, the macOS appcast, GitHub release assets, npm packages, or any non-Store source.
- The only acceptable source path is the installed package location resolved from the official Microsoft Store package that the updater installed or upgraded.
- The updater may temporarily install or upgrade the Store Codex app. It must uninstall Codex only if it installed it into a previously missing state.
- Keep `desktop/resources/node_repl.exe` and `desktop/resources/node_repl.json` tracked. Keep the rest of `desktop/resources/*` ignored.
- If the package identity, version, architecture, or SHA changes, update `docs/executable-inventory.md`.
- Do not touch `out/`, generated files, `bin/`, or `obj/`.

## Validation

Run these before committing:

```powershell
node -e "JSON.parse(require('fs').readFileSync('desktop/resources/node_repl.json','utf8')); JSON.parse(require('fs').readFileSync('desktop/package.json','utf8')); console.log('json ok')"
$bytes=[IO.File]::ReadAllBytes('desktop\resources\node_repl.exe'); $pe=[BitConverter]::ToInt32($bytes,0x3c); $machine=[BitConverter]::ToUInt16($bytes,$pe+4); if ($machine -ne 0x8664) { throw "Expected x64 node_repl.exe" }; 'node_repl.exe x64 ok'
git diff --check
```

Confirm `Get-AppxPackage -Name OpenAI.Codex` is empty after a temporary install run, unless Codex was already installed before the update.

## PR And Automerge Workflow

Use a feature branch, never `main`, `codex`, or `codex/*`.

If a PR already exists for the branch, push follow-up commits to that PR branch. If no PR exists, create one.

The update must be reviewable through a PR and can be automerged. After pushing, enable automerge on the PR when repository rules allow it:

```powershell
gh pr merge --auto --squash
```

If there are no file changes after refresh and validation, do not create an empty commit or new PR.

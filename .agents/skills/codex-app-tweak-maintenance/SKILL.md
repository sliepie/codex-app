---
name: codex-app-tweak-maintenance
description: Maintain Codex app bundled Codex++ tweaks in sliepie/codex-app. Use when changing files under desktop/codex-plusplus/tweaks, fixing tweak CSS selectors, updating tweak manifest versions, updating windows-package-resources tests, checking whether an installed local tweak copy was updated, or syncing a repo-owned bundled tweak into the locally installed Codex++ tweak directory.
---

# Codex App Tweak Maintenance

## Workflow

1. Work on the current PR branch unless the user asks for a new PR; never switch to main for follow-up tweak fixes.
2. Inspect the repo source of truth first: `desktop/codex-plusplus/tweaks/<tweak-id>/index.js`, its `manifest.json`, and `desktop/scripts/windows-package-resources.test.mjs`.
3. For selector drift, inspect recovered app assets under `desktop/recovered/app-asar-extracted/` when available. Prefer targeted bundle snippets over broad recursive searches.
4. Scope tweak CSS to existing stable app-owned markers and container roles. Do not add new direct `data-*` markers only to support tweak CSS.
5. When changing an existing bundled tweak, bump that tweak's `manifest.json` version in the same change.
6. Update focused assertions in `desktop/scripts/windows-package-resources.test.mjs`.
7. Validate with the bundled Node runtime if default `node` is blocked: `C:\Users\sliepie\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe --test desktop/scripts/windows-package-resources.test.mjs`.
8. After repo changes, if the user asks about the local installed copy or needs immediate app testing, sync the installed tweak copy too. Writes outside the repo require approval. Follow `desktop/codex-plusplus/tweaks/README.md`: keep installed local copies on the main minor and increment the installed patch every refresh (for example `0.18.1` becomes `0.18.2`), never copying the bundled PR minor version (for example `0.19.0`) into the installed test copy.

## Installed Tweak Sync

Use `scripts/sync-installed-tweak.ps1` instead of hand-copying files.

Recommended dry run:

```powershell
powershell -ExecutionPolicy Bypass -File <skill-dir>\scripts\sync-installed-tweak.ps1 -RepoRoot <repo-root> -WhatIf
```

Apply after reviewing the target:

```powershell
powershell -ExecutionPolicy Bypass -File <skill-dir>\scripts\sync-installed-tweak.ps1 -RepoRoot <repo-root>
```

If discovery is slow or ambiguous, pass the exact installed tweak folder:

```powershell
powershell -ExecutionPolicy Bypass -File <skill-dir>\scripts\sync-installed-tweak.ps1 -RepoRoot <repo-root> -InstalledTweakPath <installed-tweak-folder>
```

## Guardrails

- Do not run UI Automation unless the user explicitly asks for live UIA inspection.
- Do not publish machine-local absolute paths in PR bodies, issues, comments, or release notes.
- Keep patches narrow: tweak file, manifest version, focused test, and docs only when they capture a new durable rule.

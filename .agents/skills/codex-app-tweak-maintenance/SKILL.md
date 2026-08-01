---
name: codex-app-tweak-maintenance
description: Maintain bundled Codex++ UI tweaks in sliepie/codex-app. Use for tweak source changes, renderer-selector work, manifest updates, installed-copy refreshes, and related PR feedback under desktop/codex-plusplus/tweaks.
---

# Codex App Tweak Maintenance

High-level guidance for bundled Codex++ UI tweaks under `desktop/codex-plusplus/tweaks/`.

## Overview

- Tweak source and metadata live in `desktop/codex-plusplus/tweaks/<tweak-id>/`.
- `desktop/codex-plusplus/tweaks/README.md` defines tweak versioning and repository conventions.
- `.agents/skills/codex-app-tweak-maintenance/scripts/sync-installed-tweak.ps1` refreshes an installed copy.
- `desktop/scripts/windows-package-resources.test.mjs` contains existing packaging and tweak coverage.
- Use current upstream renderer evidence when a selector or source rewrite depends on renderer structure.

## Explicit rules

- Prefer static CSS or build-time rewrites.
- Do not add runtime observers, DOM walkers, polling, timers, or dynamic DOM mutation without explicit approval.
- Target the element or property owner with stable, source-backed selectors; remove superseded selector branches.
- When changing an existing bundled tweak, bump its `manifest.json` version according to the repository README.
- Use the sync script for installed copies; do not copy tweak files manually.
- The Codex++ tweak loader automatically reloads installed tweaks after syncing, so a restart is not needed. Stop after syncing and ask the user to visually validate the running app.
- Keep changes scoped to the requested tweak and preserve unrelated accepted behavior.

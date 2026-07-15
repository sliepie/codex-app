# Runtime and app regressions investigation

Date: 2026-07-15

Branch: `sliepie/fix-runtime-cache-and-app-regressions`

This is a running evidence log. It records observations, commands, decisions, and validation while investigating the Windows ARM64 runtime workflow and desktop app regressions.

## Reported symptoms

- The GitHub primary-runtime workflow appears to rebuild every time instead of reusing or validating cached output.
- The installed app has a broken taskbar icon.
- Codex++ and the repository-bundled tweaks are absent.
- The Codex/work selector and search icon in the sidebar should be hidden.
- All bundled tweaks need to be re-evaluated; stale tweaks should remain excluded rather than being enabled through fallbacks.
- While the desktop app is running, Windows Antimalware Service consumes about 9% CPU. Running the Codex CLI alone does not cause that activity, and closing the desktop app stops it.

## Ground rules

- Keep the diagnosis evidence-driven and preserve upstream behavior where possible.
- Do not add Windows Defender exclusions or weaken host security.
- Do not use UI Automation unless explicitly requested.
- Do not edit generated output.
- Keep outdated tweak selectors out; do not layer speculative fallbacks over stale rules.

## Initial repository state

- Started from clean `main` at `a3b7999c`.
- Created feature branch `sliepie/fix-runtime-cache-and-app-regressions`.
- The root domain context currently says the Windows ARM64 package is a clean Electron testbed with no Codex++ loader or Codex++ hydration. This conflicts with the required installed behavior and is part of the investigation.
- Relevant workflows are `.github/workflows/primary-runtime-windows-arm64.yml`, `.github/workflows/windows-arm64-pr-build.yml`, and `.github/workflows/windows-arm64-release.yml`.
- Relevant bundled tweaks currently live under `desktop/codex-plusplus/tweaks/`.

## Feedback loops

The investigation will establish one focused pass/fail command per symptom before changing behavior:

1. Runtime CI: inspect a recent workflow run and add a local workflow/config assertion that fails when an unchanged runtime input would still schedule a rebuild.
2. Packaging: use the package-plan/resource tests to assert that the taskbar icon and required Codex++ payloads are present in the packaged plan.
3. Tweaks: use the focused Codex++ package-resource test seam to assert the exact current selectors and reject stale rules.
4. Defender CPU: capture a short, repeatable process/CPU and filesystem-activity comparison with the desktop app running versus the CLI-only baseline. A repository fix will not be claimed until the triggering app behavior is identified.

## Timeline

### 2026-07-15 — kickoff

- Read the repository instructions, domain context, debugging workflow, and bundled-tweak maintenance workflow.
- Confirmed the worktree was clean before branching.
- Started three read-only investigations in parallel: runtime CI caching, packaged app assets/tweaks, and Windows Defender activity.

### 2026-07-15 — first source findings

- Confirmed `desktop/scripts/resolve-primary-runtime-source.ts` only sends a `HEAD` request to the public x64 manifest and then unconditionally writes `should_publish=true`. It never reads the upstream version, compares it with the published ARM64 manifest, or checks whether a usable build already exists.
- Confirmed the primary-runtime publish job has only the npm dependency cache. It does not cache or restore the composed runtime output, so every scheduled run that reaches the job rebuilds the full archive.
- Found two release-tagged commits based on current `main` that are not present on `origin/main`: `4c43e054` restores the Electron-hosted Codex++ customization path, and `38db87b6` excludes the stale sidebar action-control and right-panel tab rule groups. Their branch/PR status is being checked before reuse.
- Confirmed current `main` deliberately rewrites the packaged entry point back to the recovered upstream bootstrap and excludes `codex-plusplus/` from Forge packaging. The missing Codex++ runtime and bundled tweaks are therefore reproducible from source configuration, not just an installed-copy problem.

## Findings

### Confirmed

1. Runtime scheduled rebuilds are unconditional: the resolver checks reachability only and always publishes.
2. Runtime output is not cached: the workflow caches npm dependencies but not the composed archive/output directory.
3. Codex++ absence is encoded in the current package path: Forge excludes the loader/runtime and resets `package.json.main` to the recovered bootstrap.

### Under investigation

- Whether the release-tagged customization commits should be recovered as-is or adapted after current upstream hydration changes.
- The exact taskbar-icon failure mode: executable/window icon, MSIX identity association, or shell asset resolution.
- The exact desktop-app activity that keeps Windows Defender busy.

## Changes

Pending diagnosis.

## Validation

Pending diagnosis.

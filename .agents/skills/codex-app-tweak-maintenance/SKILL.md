---
name: codex-app-tweak-maintenance
description: Trace and maintain Codex++ UI tweaks in sliepie/codex-app. Use for bundled tweak changes, selector drift, upstream renderer inspection, manifest updates, installed-copy refreshes, user-owned visual validation, and PR feedback under desktop/codex-plusplus/tweaks.
---

# Codex App Tweak Maintenance

Use a trace-first loop: prove the current upstream structure, patch the element that owns the behavior, verify both version tracks, and close the existing PR loop.

## 1. Orient

1. Inspect the current branch, working tree, and PR head/base.
2. Stay on the current PR branch. If no PR exists, follow the repository branch and PR instructions.
3. Fetch `origin/main`; when the PR is behind and the working tree is safe, rebase before editing.
4. Inspect the tweak source and manifest, `desktop/scripts/windows-package-resources.test.mjs`, and `desktop/codex-plusplus/tweaks/README.md`.

Complete this step only when the current branch/PR, dirty files, tweak id, bundled branch version, and `origin/main` version are known.

For PR-feedback-only requests, query thread-aware review state now. If no actionable code change remains, continue at step 6. For installed-refresh-only requests with no repository change, verify the source and target versions, then continue at step 5.

## 2. Trace upstream

1. Treat the app build the user is running as the UI source of truth. Verify its package version and archive identity before relying on a recovered snapshot.
2. Reuse `docs/upstream/codex-app/<version>/` only when its recorded version and hashes match that build. When evidence is missing, extract the smallest relevant implementation and imported shared-component chunks byte-for-byte, then record package version, archive entry, SHA-256, and size in that directory's `README.md`.
3. Follow imports from the feature implementation into shared components. Identify:
   - the element that owns the property being changed;
   - every rendered variant that changes that owner or hierarchy;
   - the stable app-owned markers, roles, class tokens, icon paths, and container boundaries available for scoping;
   - the relevant cascade and inherited variables.
4. Use screenshots to orient and measure; derive DOM claims from current source. Use live UI Automation only when the user explicitly requests it.

For investigation-only requests, stop here and report the evidence without changing files.

Complete this step only when current source proves the property owner, selector hierarchy, and relevant variants. A plausible selector or passing string assertion is not completion.

## 3. Patch the owner

1. Prefer static CSS or an existing build-time rewrite. Add runtime observers, DOM walkers, polling, timers, or dynamic annotations only after explicit user approval.
2. Scope from a stable container to the property-owning element. Prefer source-backed structural or semantic markers over visible text, positional selectors, or accumulated fallback branches.
3. Remove superseded selector branches so one current source-backed path remains. Preserve unrelated accepted tweak behavior.
4. Compare the bundled manifest with `origin/main`:
   - if the branch still has main's version, apply the next version required by `desktop/codex-plusplus/tweaks/README.md`;
   - if the current PR already contains that bump, keep it for follow-up commits.
5. Do not add CSS serialization, selector-string, or rendered-shape assertions unless the user explicitly requests tests. Only change an existing test when the implementation otherwise makes that test fail.

Complete this step only when the diff contains the narrow behavior change, one correct PR-level manifest bump when required, and any newly required upstream evidence.

## 4. Prepare the local candidate

1. Run only the cheap structural check during UI iteration:

   ```powershell
   git diff --check
   ```

2. Inspect the final diff and reconfirm that the selector targets the source-proven owner.
3. Do not run UI Automation, screenshots, browser automation, test suites, builds, CI, or other visual checks unless the user explicitly requests them. The user owns visual validation for tweak iterations.

Complete this step when the local diff is clean and each selector claim is backed by current bundle/component evidence.

## 5. Sync the installed copy

Sync every bundled tweak change unless the user explicitly opts out. Use the script rather than copying files by hand:

```powershell
powershell -ExecutionPolicy Bypass -File .agents\skills\codex-app-tweak-maintenance\scripts\sync-installed-tweak.ps1 -RepoRoot . -WhatIf
powershell -ExecutionPolicy Bypass -File .agents\skills\codex-app-tweak-maintenance\scripts\sync-installed-tweak.ps1 -RepoRoot .
```

When discovery is ambiguous, pass `-InstalledTweakPath` with the verified target. The script keeps the installed copy on main's minor version and advances its local patch independently from the bundled PR version.

Verify the repository and installed `index.js` hashes match, confirm the installed manifest version advanced, and tell the user to reload or restart the app because an existing renderer retains its injected stylesheet.

After syncing, stop and ask the user to visually validate the running app. Do not commit, push, edit or create a PR, start a build, run CI, or poll checks until the user explicitly confirms the UI result.

Complete this step only when the installed target, version transition, file parity, reload requirement, and pending user visual gate are explicit.

## 6. Close the PR loop

Enter this step only after the user explicitly confirms the visual result.

1. Commit and push follow-up work to the existing PR branch.
2. Recheck that the pushed head matches local `HEAD` and is zero commits behind `origin/main`.
3. Query live, thread-aware PR review state. Address every safe actionable current comment and still-relevant outdated comment; reply to or resolve threads only when the user asks.
4. Take one final required-check snapshot. Do not repeatedly poll or wait for CI unless the user explicitly asks.

Complete the task when the working tree is clean, the PR is current and mergeable, no actionable review feedback remains, and the latest check state has been reported without polling.

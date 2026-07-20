---
name: codex-app-tweak-maintenance
description: Trace and maintain Codex++ UI tweaks in sliepie/codex-app. Use for bundled tweak changes, selector drift, upstream renderer inspection, manifest or focused-test updates, installed-copy refreshes, and PR feedback under desktop/codex-plusplus/tweaks.
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
5. Update the exact focused serialization/assertion coverage in `desktop/scripts/windows-package-resources.test.mjs`.

Complete this step only when the diff contains the narrow behavior change, one correct PR-level manifest bump when required, focused coverage, and any newly required upstream evidence.

## 4. Verify

1. Run:

   ```powershell
   node --test desktop/scripts/windows-package-resources.test.mjs
   git diff --check
   ```

   If `node` is unavailable, locate the repository's bundled Node runtime and run the same test.
2. Inspect the generated CSS assertion and the final diff. Reconfirm that the selector targets the source-proven owner in every relevant variant.
3. Treat tests as serialization and packaging proof, not rendered-DOM proof.

Complete this step only when the focused suite passes, the diff is clean, and each selector claim is backed by current bundle/component evidence.

## 5. Sync the installed copy

Sync every bundled tweak change unless the user explicitly opts out. Use the script rather than copying files by hand:

```powershell
powershell -ExecutionPolicy Bypass -File .agents\skills\codex-app-tweak-maintenance\scripts\sync-installed-tweak.ps1 -RepoRoot . -WhatIf
powershell -ExecutionPolicy Bypass -File .agents\skills\codex-app-tweak-maintenance\scripts\sync-installed-tweak.ps1 -RepoRoot .
```

When discovery is ambiguous, pass `-InstalledTweakPath` with the verified target. The script keeps the installed copy on main's minor version and advances its local patch independently from the bundled PR version.

Verify the repository and installed `index.js` hashes match, confirm the installed manifest version advanced, and tell the user to reload or restart the app because an existing renderer retains its injected stylesheet.

Complete this step only when the installed target, version transition, file parity, and reload requirement are explicit.

## 6. Close the PR loop

1. Commit and push follow-up work to the existing PR branch.
2. Recheck that the pushed head matches local `HEAD` and is zero commits behind `origin/main`.
3. Query live, thread-aware PR review state. Address every safe actionable current comment and still-relevant outdated comment; reply to or resolve threads only when the user asks.
4. Wait for every required check, including downstream publish jobs, to finish on the exact pushed head.

Complete the task only when the working tree is clean, the PR is mergeable on the latest base, required checks pass, and no actionable review feedback remains.

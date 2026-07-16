# Bundled Tweak Versioning

Bundled Codex++ tweak manifests are versioned against the version currently on main.

- Existing tweak PR manifests must use the next minor version from main with patch zero, for example main `0.N.0` becomes PR `0.N+1.0`.
- Local modified test copies must stay on the main minor and use a patch bump, for example main `0.N.0` becomes local `0.N.1`.
- Do not copy the PR manifest version into a local installed test copy. When testing a PR whose bundled manifest is `0.N+1.0`, keep the installed test copy on the main minor, for example `0.N.1`.
- Every time a changed local test copy is installed or refreshed, increment that installed copy's patch version again: local test versions are `0.N.X+1`, for example local `0.N.1` becomes local `0.N.2`. Update the installed `manifest.json` in the same step as copying changed tweak files so reloads can observe the new local patch.
- Local installed test copies must never be higher than the PR manifest version.
- New bundled tweaks start at 0.1.0; local installed copies use that same version unless the PR manifest has already advanced.
- The Codex++ loader replaces an installed tweak when the bundled manifest version is newer than the installed manifest version.

## Source Inspection

- Never guess DOM structure, selectors, bundle names, or injected row order for bundled UI tweaks.
- Before changing a tweak that depends on upstream Codex UI structure, inspect the real upstream source that ships in the app bundle.
- If the relevant source is not already available locally, download and extract the latest macOS Codex app build, then inspect the recovered renderer bundle before choosing selectors or patch targets.
- Treat screenshots as symptoms only. Use them to orient the investigation, not as proof of DOM structure.

## Restoring Native UI Behavior

- When app-owned UI or behavior hidden by a tweak must be restored, first remove or narrow the override to re-enable the native implementation.
- Reuse existing app selectors, variables, masks, pseudo-elements, and state logic whenever possible.
- Never add replacement CSS to imitate native behavior while the existing implementation can be reused.
- Recreate native behavior only when reuse is impossible, and document why.

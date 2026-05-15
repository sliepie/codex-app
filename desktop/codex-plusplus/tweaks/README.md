# Bundled Tweak Versioning

Bundled Codex++ tweak manifests are versioned against the version currently on main.

- PR manifests may advance one increment from the main version for that tweak.
- Existing tweak PRs use a minor bump when the PR is the next bundled release for that tweak.
- Local installed test copies use the same version as main, unless a patch bump is needed to force Codex++ to reload local changes.
- Local installed test copies must never be higher than the PR manifest version.
- New bundled tweaks start at 0.1.0; local installed copies use that same version unless the PR manifest has already advanced.
- The Codex++ loader only replaces an installed bundled tweak when the bundled manifest version is newer than the installed marker version.

# Bundled Tweak Versioning

Bundled Codex++ tweak manifests are versioned against the version currently on main.

- Existing tweak PR manifests must use the next minor version from main with patch zero, for example main `0.N.0` becomes PR `0.N+1.0`.
- Local modified test copies must stay on the main minor and use a patch bump, for example main `0.N.0` becomes local `0.N.1`.
- Local installed test copies must never be higher than the PR manifest version.
- New bundled tweaks start at 0.1.0; local installed copies use that same version unless the PR manifest has already advanced.
- The Codex++ loader only replaces an installed bundled tweak when the bundled manifest version is newer than the installed marker version.

# 0001 Vendor official x64 node_repl fallback

## Status

Accepted

## Context

This repo produces a Windows ARM64 Codex Desktop package. Resource binaries should be ARM64 unless they cannot be compiled, downloaded, or otherwise obtained for Windows ARM64.

Codex Desktop expects a `node_repl` resource binary for Node REPL tool support. The macOS ARM64 app includes `Contents/Resources/node_repl`, but the public `openai/codex` release assets do not include a Windows ARM64 `node_repl` binary. The Windows `node_repl.exe` binary is closed source and currently available only as an official x64 binary.

`winget download` can retrieve Microsoft Store packaged app files for offline use, but Microsoft documents Entra ID authentication requirements for Store package download. `winget install` can still install the Store app through the normal consumer path, but it does not hand the build a stable MSIX/appx file to extract.

## Decision

Use the latest official closed-source x64 `node_repl.exe` as a committed vendored fallback until a Windows ARM64 `node_repl` can be compiled, downloaded, or otherwise obtained.

Hydration may install or upgrade the official Microsoft Store Codex app (`9PLM9XGG6VKS`), copy `node_repl.exe` from the installed package location, and uninstall Codex afterward only if the script installed it into a previously missing state. `node_repl.exe` updates must always come from that official Microsoft Store package; local manual paths, copied package folders, appcast artifacts, GitHub release assets, npm packages, and other non-Store sources are not valid update sources.

Commit `node_repl.exe` to this repo at `desktop/resources/node_repl.exe`. The updater should also write provenance metadata with the source package identity and SHA-256 digest.

Validation must keep the package ARM64 by default and treat `resources/node_repl.exe` as the only allowed x64 PE exception. The inventory should record that exception with provenance and a SHA-256 digest.

## Consequences

- The Windows ARM64 package becomes intentionally mixed-architecture while this fallback is in use.
- Node REPL tool support can work before an ARM64-native `node_repl` exists.
- Git history includes a closed-source vendored executable.
- The hydration path may temporarily mutate the local machine by installing or upgrading the Store Codex app.
- Existing user installs are not removed by cleanup; only installs created by the hydrator are uninstalled.
- Future work should remove this exception when an ARM64-native `node_repl.exe` becomes available.

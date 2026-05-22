# 0001 Vendor official x64 Store binary fallbacks

## Status

Accepted

## Context

This repo produces a Windows ARM64 Codex Desktop package. Resource binaries should be ARM64 unless they cannot be compiled, downloaded, or otherwise obtained for Windows ARM64.

Codex Desktop expects a `node_repl` resource binary for Node REPL tool support. The macOS ARM64 app includes `Contents/Resources/node_repl`, but the public `openai/codex` release assets do not include a Windows ARM64 `node_repl` binary. The Windows `node_repl.exe` binary is closed source and currently available only as an official x64 binary.

The bundled Chrome plugin also needs a Windows native messaging host. The public appcast and plugin repository links do not provide source or a Windows ARM64 host, while the official Microsoft Store package includes an x64 host at `extension-host/windows/x64/extension-host.exe`. In the Windows ARM64 package, hydration copies that x64 fallback into the plugin path resolved by the bundled installer: `extension-host/windows/arm64/extension-host.exe`.

`winget download` can retrieve Microsoft Store packaged app files for offline use, but Microsoft documents Entra ID authentication requirements for Store package download. `winget install` can still install the Store app through the normal consumer path, but it does not hand the build a stable MSIX/appx file to extract.

## Decision

Use the latest official closed-source x64 `node_repl.exe` and Chrome `extension-host.exe` as committed vendored fallbacks until Windows ARM64-native equivalents can be compiled, downloaded, or otherwise obtained.

Hydration may install or upgrade the official Microsoft Store Codex app (`9PLM9XGG6VKS`), copy `node_repl.exe` and `extension-host.exe` from the installed package location, and uninstall Codex afterward only if the script installed it into a previously missing state. These binary updates must always come from that official Microsoft Store package with the `OpenAI.Codex` package identity; `OpenAI.Codex.Arm64Dev`, local manual paths, copied package folders, appcast artifacts, GitHub release assets, npm packages, and other non-Store sources are not valid update sources.

Commit `node_repl.exe` to this repo at `desktop/resources/node_repl.exe` and `extension-host.exe` at `desktop/resources/extension-host.exe`. The updater should also write provenance metadata with the source package identity and SHA-256 digest for each file.

Validation must keep the package ARM64 by default and treat every x64 payload as an explicit resource-binary exception in `desktop/scripts/resource-binary-exceptions.ts`. The current exceptions are `resources/node_repl.exe`, the Chrome plugin `extension-host.exe` copied to the ARM64 lookup path, and the GitHub-release hydrated public Tectonic `tectonic.exe` payload. `npm run verify:windows-arm64-resource-binaries` must reject unlisted non-ARM64 PE files. The inventory should record each exception with provenance and a SHA-256 digest when the binary is committed or downloaded from a pinned public release.

## Consequences

- The Windows ARM64 package becomes intentionally mixed-architecture while this fallback is in use.
- Node REPL tool support can work before an ARM64-native `node_repl` exists.
- The bundled Chrome plugin can use the official Windows native messaging host while the app package remains ARM64.
- The bundled LaTeX plugin can use the public Windows x64 Tectonic release while no Windows ARM64 Tectonic release exists.
- Git history includes a closed-source vendored executable.
- The hydration path may temporarily mutate the local machine by installing or upgrading the Store Codex app.
- Existing user installs are not removed by cleanup; only installs created by the hydrator are uninstalled.
- Future work should remove these exceptions when ARM64-native `node_repl.exe`, `extension-host.exe`, and `tectonic.exe` binaries become available.

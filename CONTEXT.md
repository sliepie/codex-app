# Codex App Windows ARM64

This context describes the packaging language and architecture rules for the Windows ARM64 Codex Desktop package.

## Language

**Windows ARM64 package**:
The Electron desktop package produced by this repo for ARM64 Windows devices.

**Resource binary**:
An executable copied into the packaged app's `resources/` directory and launched by the desktop app at runtime.

**Vendored resource binary**:
A resource binary committed to this repo because it cannot be built or downloaded through the normal ARM64 hydration path.

**Resource binary exception**:
An explicit, validated x64 resource binary allowed in the Windows ARM64 package until a Windows ARM64 equivalent can be compiled, downloaded, or otherwise obtained.

**`node_repl`**:
The resource binary used by Codex Desktop to provide Node REPL tool support.

**`extension-host`**:
The Chrome plugin's Windows native messaging host. The ARM64 package uses the official x64 Store fallback at the plugin's ARM64 lookup path until an ARM64 host exists.

**Tectonic**:
The bundled LaTeX plugin executable. The ARM64 package downloads the public x64 Windows Tectonic release asset until an ARM64 build exists.

**Official package source**:
An upstream OpenAI distribution channel, such as the Codex production appcast or the Microsoft Store package for product ID `9PLM9XGG6VKS`.

**Latest official app release**:
The official upstream Codex Desktop release selected for Windows ARM64 packaging when more than one official app release feed is available. Latest means the highest Sparkle build number (`sparkle:version`), with the production feed winning ties, not a specific feed label.

**Temporary Store-install scrape**:
A refresh path that installs or upgrades the official Microsoft Store Codex app, copies `node_repl.exe` and `extension-host.exe` from the installed package, and uninstalls Codex only if the script installed it into a previously missing state.

**Windows ARM64 package plan**:
The single ordered script plan for ARM64 Windows packaging. It builds the updater, hydrates app resources, hydrates GitHub release assets, verifies browser runtime compatibility, runs Forge, and verifies resource-binary architecture policy.

## Relationships

- A **Windows ARM64 package** contains **Resource binaries**.
- **Resource binaries** should be ARM64 unless they cannot be compiled, downloaded, or otherwise obtained for Windows ARM64.
- Every **Resource binary exception** must live in `desktop/scripts/resource-binary-exceptions.ts` and be enforced by `npm run verify:windows-arm64-resource-binaries`.
- **`node_repl`** and **`extension-host`** are **Vendored resource binaries** until Windows ARM64 binaries can be compiled, downloaded, or otherwise obtained.
- **`node_repl`** and **`extension-host`** may use the latest official closed-source x64 binaries from the Microsoft Store package, even when that fallback version does not match the macOS appcast version exactly.
- A **Temporary Store-install scrape** refreshes the vendored `desktop/resources/node_repl.exe` and `desktop/resources/extension-host.exe` binaries from the official Microsoft Store package for product ID `9PLM9XGG6VKS`; non-Store sources are not valid for these vendored fallback updates.
- **Tectonic** is a public GitHub-release hydrated **Resource binary exception** from `tectonic-typesetting/tectonic` until a Windows ARM64 release asset exists.
- The **Windows ARM64 package plan** is the only CI entry point for the ordered Windows ARM64 package flow.
- A **Windows ARM64 package** follows the **Latest official app release** when no exact upstream version and build are requested; default packaging does not prefer a fixed app release feed.
- Release artifacts identify the selected official app release by upstream version and build; release notes may include the selected feed as audit information.

## Example dialogue

> **Dev:** "Can I commit an x64 executable in this Windows ARM64 repo?"
> **Domain expert:** "Only as a named resource-binary exception with provenance, validation, inventory coverage, and a removal condition."

## Flagged ambiguities

- "ARM64 package" does not mean every file is ARM64 when an executable cannot be compiled, downloaded, or otherwise obtained for Windows ARM64. Resolved: `node_repl.exe`, Chrome `extension-host.exe`, and LaTeX `tectonic.exe` are the accepted x64 exceptions for now.
- "latest app release" means the highest Sparkle build number (`sparkle:version`) across official app release feeds, with the production feed winning ties.

# Codex App Windows ARM64

This context describes the packaging language and architecture rules for the Windows ARM64 Codex Desktop package.

## Language

**Windows ARM64 package**:
The Electron desktop package produced by this repo for ARM64 Windows devices.

**Resource binary**:
An executable copied into the packaged app's `resources/` directory and launched by the desktop app at runtime.

**Vendored resource binary**:
A resource binary committed to this repo because it cannot be built or downloaded through the normal ARM64 hydration path.

**`node_repl`**:
The resource binary used by Codex Desktop to provide Node REPL tool support.

**Official package source**:
An upstream OpenAI distribution channel, such as the Codex production appcast or the Microsoft Store package for product ID `9PLM9XGG6VKS`.

**Latest official app release**:
The official upstream Codex Desktop release selected for Windows ARM64 packaging when more than one official app release feed is available. Latest means the highest Sparkle build number (`sparkle:version`), with the production feed winning ties, not a specific feed label.

**Temporary Store-install scrape**:
A refresh path that installs or upgrades the official Microsoft Store Codex app, copies `node_repl.exe` from the installed package, and uninstalls Codex only if the script installed it into a previously missing state.

## Relationships

- A **Windows ARM64 package** contains **Resource binaries**.
- **Resource binaries** should be ARM64 unless they cannot be compiled, downloaded, or otherwise obtained for Windows ARM64.
- **`node_repl`** is a **Vendored resource binary** until a Windows ARM64 binary can be compiled, downloaded, or otherwise obtained.
- **`node_repl`** may use the latest official closed-source x64 binary from an **Official package source**, even when that fallback version does not match the macOS appcast version exactly.
- A **Temporary Store-install scrape** refreshes the vendored `desktop/resources/node_repl.exe` binary from the official Microsoft Store package for product ID `9PLM9XGG6VKS`; non-Store sources are not valid for `node_repl` updates.
- A **Windows ARM64 package** follows the **Latest official app release** when no exact upstream version and build are requested; default packaging does not prefer a fixed app release feed.
- Release artifacts identify the selected official app release by upstream version and build; release notes may include the selected feed as audit information.

## Example dialogue

> **Dev:** "Can I commit an x64 executable in this Windows ARM64 repo?"
> **Domain expert:** "Only for `node_repl`, only because no ARM64-native source or download path exists, and the exception must stay explicit in validation and inventory."

## Flagged ambiguities

- "ARM64 package" does not mean every file is ARM64 when an executable cannot be compiled, downloaded, or otherwise obtained for Windows ARM64. Resolved: `node_repl.exe` is the only accepted x64 exception for now.
- "latest app release" means the highest Sparkle build number (`sparkle:version`) across official app release feeds, with the production feed winning ties.

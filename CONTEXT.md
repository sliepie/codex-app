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
An explicit, validated resource binary with special provenance or architecture requirements in the Windows ARM64 package. Non-ARM64 exceptions are allowed only until a Windows ARM64 equivalent can be compiled, downloaded, or otherwise obtained.

**`node_repl`**:
The resource binary used by Codex Desktop to provide Node REPL tool support.

**`extension-host`**:
The Chrome plugin's Windows native messaging host. The ARM64 package uses the official ARM64 Store helper at the plugin's ARM64 lookup path.

**Computer Use helper**:
The Windows helper executable used by the bundled Computer Use plugin to control desktop apps. The ARM64 package carries the official x64 Store helper as an explicit resource-binary exception until an ARM64 helper exists.

**Store/Owl shell payload**:
The tracked `desktop/resources/store-owl-shell/package.tar.gz` archive copied from the official Microsoft Store Codex package. It supplies the ARM64 `Codex.exe`, `chrome.dll`, Chromium runtime files, Store manifest assets, and PRI files for later isolated experiments while the Windows package remains a clean Forge/Electron testbed.

**Tectonic**:
The bundled LaTeX plugin executable. The ARM64 package downloads the public x64 Windows Tectonic release asset until an ARM64 build exists.

**Official package source**:
An upstream OpenAI distribution channel, such as the Codex production appcast or the Microsoft Store package for product ID `9PLM9XGG6VKS`.

**Store helper source**:
The official Microsoft Store package used only for explicitly vendored helper payloads and the parked Store/Owl shell archive.

**Latest official app release**:
The official upstream Codex Desktop release selected for Windows ARM64 packaging from the production appcast.

**Temporary Store-install scrape**:
A refresh path that installs or upgrades the official Microsoft Store Codex app, copies `node_repl.exe`, `extension-host.exe`, and `codex-computer-use.exe` from the installed package, and uninstalls Codex only if the script installed it into a previously missing state.

**Windows ARM64 package plan**:
The single ordered script plan for ARM64 Windows packaging. It builds the updater, hydrates upstream app resources with only the Windows primary taskbar-window patch, hydrates required Windows release assets, verifies browser runtime compatibility, runs Forge, and verifies resource-binary architecture policy.

**Bundled UI tweak selector**:
A CSS selector shipped by a bundled Codex++ tweak under `desktop/codex-plusplus/tweaks/`.

## Relationships

- A **Windows ARM64 package** contains **Resource binaries**.
- **Resource binaries** should be ARM64 unless they cannot be compiled, downloaded, or otherwise obtained for Windows ARM64.
- The **Microsoft Store package** is a **Store helper source**, not the default source for payloads that are available from public release assets or the macOS app.
- Every **Resource binary exception** must live in `desktop/scripts/resource-binary-exceptions.ts` and be enforced by `npm run verify:windows-arm64-resource-binaries`.
- **`node_repl`**, **`extension-host`**, and the **Computer Use helper** are **Vendored resource binaries** until they no longer need to be copied from the Microsoft Store package.
- The Windows package is a **clean Electron testbed**: no Codex++ loader, no Codex++ hydration, no Store/Owl host swap, and no recovered-source feature patches except the Windows primary taskbar-window patch. It does not enable OWL features, message rail gates, window-service rewrites, Work Louder stubs, or self-signed bundle rewrites.
- The **Store/Owl shell payload** is a tracked Store archive at `desktop/resources/store-owl-shell/package.tar.gz`; it must stay version-locked to `desktop/resources/store-owl-shell.json`, but it is not wired into the package path.
- **`node_repl`** and **`extension-host`** use ARM64 binaries from the Microsoft Store package when available; the **Computer Use helper** may use the latest official closed-source x64 binary until a Windows ARM64 equivalent exists.
- A **Temporary Store-install scrape** refreshes the vendored `desktop/resources/cua_node/bin/node_repl.exe`, `desktop/resources/extension-host.exe`, and `desktop/resources/codex-computer-use.exe` binaries from the official Microsoft Store package for product ID `9PLM9XGG6VKS`; non-Store sources are not valid for these vendored helper updates.
- **Tectonic** is a public GitHub-release hydrated **Resource binary exception** from `tectonic-typesetting/tectonic` until a Windows ARM64 release asset exists.
- The **Windows ARM64 package plan** is the only CI entry point for the ordered Windows ARM64 package flow.
- A **Windows ARM64 package** follows the **Latest official app release** from the production appcast when no exact upstream version and build are requested.
- Release artifacts identify the selected official app release by upstream version and build.
- A **Bundled UI tweak selector** must reuse existing stable app markers when scoping app surfaces. Do not add new direct `data-*` markers only to support tweak CSS; instead, bound selectors to existing app-owned markers and container roles.

## Example dialogue

> **Dev:** "Can I commit an x64 executable in this Windows ARM64 repo?"
> **Domain expert:** "Only as a named resource-binary exception with provenance, validation, inventory coverage, and a removal condition."

## Flagged ambiguities

- "ARM64 package" does not mean every file is ARM64 when an executable cannot be compiled, downloaded, or otherwise obtained for Windows ARM64. Resolved: Computer Use `codex-computer-use.exe` and LaTeX `tectonic.exe` are the accepted x64 exceptions for now; `node_repl.exe` and Chrome `extension-host.exe` are ARM64 Store-vendored helpers.
- "latest app release" means the selected production appcast release.

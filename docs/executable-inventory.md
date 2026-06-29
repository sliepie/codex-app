# Codex App Executable Inventory

Date: 2026-06-29

## Source Artifacts

| Artifact | Value |
| --- | --- |
| macOS source app | `Codex-darwin-arm64-26.429.30905.zip` |
| Windows ARM64 output | `desktop/out/make/zip/win32/arm64/codex-app-windows-arm64-v26.429.30905.zip` |
| Windows package directory | `desktop/out/Codex-win32-arm64` |
| macOS extracted app | `desktop/.cache/codex-app/extract-26.429.30905/Codex.app` |
| Vendored Node REPL helper | `desktop/resources/cua_node/bin/node_repl.exe` from `OpenAI.Codex_26.623.8305.0_arm64__2p2nqsd0c76g0` |
| Vendored Chrome extension host helper | `desktop/resources/extension-host.exe` from `OpenAI.Codex_26.623.8305.0_arm64__2p2nqsd0c76g0` |
| Vendored Computer Use helper fallback | `desktop/resources/codex-computer-use.exe` from `OpenAI.Codex_26.623.8305.0_arm64__2p2nqsd0c76g0` |
| GitHub-release hydrated Tectonic fallback | `tectonic-0.16.9-x86_64-pc-windows-msvc.zip` from `tectonic-typesetting/tectonic` |
| Resource binary exception policy | `desktop/scripts/resource-binary-exceptions.ts` enforced by `npm run verify:windows-arm64-resource-binaries` |
| Store architecture check | Microsoft Store package `9PLM9XGG6VKS` installed `OpenAI.Codex_26.623.8305.0_arm64__2p2nqsd0c76g0`; Node REPL and Chrome extension-host are ARM64, while Computer Use remains x64 |

## Version Match

| Check | macOS source | Windows ARM64 output | Result |
| --- | --- | --- | --- |
| App version | `CFBundleShortVersionString` = `26.429.30905` | `Codex.exe` `ProductVersion` = `26.429.30905` | Match |
| Build number | `CFBundleVersion` = `2345` | `Codex.exe` `FileVersion` = `2345` | Match |
| Electron | refresh manifest = `41.2.0` | `desktop/package.json` dependency = `41.2.0` | Match |
| Codex CLI | release payload = `rust-v0.128.0` | `resources/codex.exe --version` = `codex-cli 0.128.0` | Match |
| CLI helper binaries | release payload = `rust-v0.128.0` | Windows helper `FileVersion` = `0.128.0` | Match |
| Node REPL helper | Store package `OpenAI.Codex_26.623.8305.0_arm64__2p2nqsd0c76g0` | `resources/cua_node/bin/node_repl.exe` SHA-256 = `3e2fb244544c834730108caeea4fdafe3e8c3353fb611b71832b2c5897cfaac6` | Store-vendored ARM64 helper |
| Chrome extension host helper | Store package `OpenAI.Codex_26.623.8305.0_arm64__2p2nqsd0c76g0` | `resources/extension-host.exe` SHA-256 = `5436d4d588ca4bf7f66cd78a0ea0042c899f4a7ec4aff337577dab9730e1baba` | Store-vendored ARM64 helper |
| Computer Use helper fallback | Store package `OpenAI.Codex_26.623.8305.0_arm64__2p2nqsd0c76g0` | `resources/codex-computer-use.exe` SHA-256 = `f2b2f56fcd1699b0fa32dec3214a56a1d36b937a2ecf58cc822ab4a904551e03` | Explicit x64 exception |
| Tectonic fallback | Public release `tectonic@0.16.9` | `tectonic.exe` SHA-256 = `a0a9a5eaf1a940d9a615ad78d35225ca59420c7984576c6402fffb3e9fb05ceb`; asset digest = `sha256:131a24604785a9600989a3d91225f597df52ac06f00aeffe86fd529f99ee5cdd` | `hydrate:cli` x64 exception |

## Architecture Summary

| Artifact | Executable count | Architecture result |
| --- | ---: | --- |
| macOS source app | 36 Mach-O files | 31 `arm64`, 5 Sparkle universal `fat(2)` files |
| Windows ARM64 output | Pending package rebuild | Adds Store-vendored ARM64 helpers for `resources/cua_node/bin/node_repl.exe` and Chrome plugin `extension-host.exe` at the ARM64 lookup path, plus explicit `x64` exceptions for Computer Use `codex-computer-use.exe` and LaTeX `tectonic.exe` |
| Rebuilt native module cache | 1 PE file | `better_sqlite3.node` is `ARM64`; `.forge-meta` is `arm64--145` |

The produced Windows package contains no `.node` files in `resources/app.asar` and no `resources/app.asar.unpacked` directory. The local native cache is rebuilt for ARM64, but no native module is emitted as a separate file in the produced package.

The Windows ARM64 package is ARM64 by default. Any x64 PE payload must match the named exception policy in `desktop/scripts/resource-binary-exceptions.ts`; unlisted non-ARM64 `.dll`, `.exe`, or `.node` files fail `npm run verify:windows-arm64-resource-binaries`.

## macOS Executables

| Relative path | Kind | Architecture | Size |
| --- | --- | --- | ---: |
| `Contents/Frameworks/Codex Helper (GPU).app/Contents/MacOS/Codex Helper (GPU)` | Mach-O 64 | `arm64` | 221888 |
| `Contents/Frameworks/Codex Helper (Plugin).app/Contents/MacOS/Codex Helper (Plugin)` | Mach-O 64 | `arm64` | 221888 |
| `Contents/Frameworks/Codex Helper (Renderer).app/Contents/MacOS/Codex Helper (Renderer)` | Mach-O 64 | `arm64` | 221888 |
| `Contents/Frameworks/Codex Helper.app/Contents/MacOS/Codex Helper` | Mach-O 64 | `arm64` | 221888 |
| `Contents/Frameworks/Electron Framework.framework/Versions/A/Electron Framework` | Mach-O 64 | `arm64` | 177868560 |
| `Contents/Frameworks/Electron Framework.framework/Versions/A/Helpers/chrome_crashpad_handler` | Mach-O 64 | `arm64` | 1271856 |
| `Contents/Frameworks/Electron Framework.framework/Versions/A/Libraries/libEGL.dylib` | Mach-O 64 | `arm64` | 109664 |
| `Contents/Frameworks/Electron Framework.framework/Versions/A/Libraries/libffmpeg.dylib` | Mach-O 64 | `arm64` | 2218480 |
| `Contents/Frameworks/Electron Framework.framework/Versions/A/Libraries/libGLESv2.dylib` | Mach-O 64 | `arm64` | 6818352 |
| `Contents/Frameworks/Electron Framework.framework/Versions/A/Libraries/libvk_swiftshader.dylib` | Mach-O 64 | `arm64` | 16643888 |
| `Contents/Frameworks/Mantle.framework/Versions/A/Mantle` | Mach-O 64 | `arm64` | 107072 |
| `Contents/Frameworks/ReactiveObjC.framework/Versions/A/ReactiveObjC` | Mach-O 64 | `arm64` | 385232 |
| `Contents/Frameworks/Sparkle.framework/Versions/B/Autoupdate` | Mach-O fat | `fat(2)` | 710336 |
| `Contents/Frameworks/Sparkle.framework/Versions/B/Sparkle` | Mach-O fat | `fat(2)` | 977808 |
| `Contents/Frameworks/Sparkle.framework/Versions/B/Updater.app/Contents/MacOS/Updater` | Mach-O fat | `fat(2)` | 291568 |
| `Contents/Frameworks/Sparkle.framework/Versions/B/XPCServices/Downloader.xpc/Contents/MacOS/Downloader` | Mach-O fat | `fat(2)` | 173248 |
| `Contents/Frameworks/Sparkle.framework/Versions/B/XPCServices/Installer.xpc/Contents/MacOS/Installer` | Mach-O fat | `fat(2)` | 224480 |
| `Contents/Frameworks/Squirrel.framework/Versions/A/Resources/ShipIt` | Mach-O 64 | `arm64` | 143824 |
| `Contents/Frameworks/Squirrel.framework/Versions/A/Squirrel` | Mach-O 64 | `arm64` | 162016 |
| `Contents/MacOS/Codex` | Mach-O 64 | `arm64` | 53248 |
| `Contents/Resources/app.asar.unpacked/node_modules/better-sqlite3/build/Release/better_sqlite3.node` | Mach-O 64 | `arm64` | 1938464 |
| `Contents/Resources/app.asar.unpacked/node_modules/node-pty/build/Release/pty.node` | Mach-O 64 | `arm64` | 104528 |
| `Contents/Resources/app.asar.unpacked/node_modules/node-pty/build/Release/pty.node.dSYM/Contents/Resources/DWARF/pty.node` | Mach-O 64 | `arm64` | 12446 |
| `Contents/Resources/app.asar.unpacked/node_modules/node-pty/build/Release/spawn-helper` | Mach-O 64 | `arm64` | 69904 |
| `Contents/Resources/codex` | Mach-O 64 | `arm64` | 198539120 |
| `Contents/Resources/codex_chronicle` | Mach-O 64 | `arm64` | 4078112 |
| `Contents/Resources/native/bare-modifier-monitor` | Mach-O 64 | `arm64` | 142496 |
| `Contents/Resources/native/browser-use-peer-authorization.node` | Mach-O 64 | `arm64` | 101792 |
| `Contents/Resources/native/launch-services-helper` | Mach-O 64 | `arm64` | 87424 |
| `Contents/Resources/native/sparkle.node` | Mach-O 64 | `arm64` | 138976 |
| `Contents/Resources/node` | Mach-O 64 | `arm64` | 118440960 |
| `Contents/Resources/node_repl` | Mach-O 64 | `arm64` | 9340288 |
| `Contents/Resources/plugins/openai-bundled/plugins/computer-use/Codex Computer Use.app/Contents/MacOS/SkyComputerUseService` | Mach-O 64 | `arm64` | 14502016 |
| `Contents/Resources/plugins/openai-bundled/plugins/computer-use/Codex Computer Use.app/Contents/SharedSupport/SkyComputerUseClient.app/Contents/MacOS/SkyComputerUseClient` | Mach-O 64 | `arm64` | 10033088 |
| `Contents/Resources/plugins/openai-bundled/plugins/latex-tectonic/bin/tectonic` | Mach-O 64 | `arm64` | 50318848 |
| `Contents/Resources/rg` | Mach-O 64 | `arm64` | 4044752 |

## Windows ARM64 Executables

| Relative path | PE architecture | Version |
| --- | --- | --- |
| `Codex.exe` | `ARM64` | `ProductVersion` `26.429.30905`; `FileVersion` `2345` |
| `d3dcompiler_47.dll` | `ARM64` | `10.0.26100.4654` |
| `dxcompiler.dll` | `ARM64` | `1.9.2602.0` |
| `dxil.dll` | `ARM64` | `101.7.2308.24` |
| `ffmpeg.dll` | `ARM64` | No file version metadata |
| `libEGL.dll` | `ARM64` | `2.1.27045` |
| `libGLESv2.dll` | `ARM64` | `2.1.27045` |
| `resources/codex-command-runner.exe` | `ARM64` | `0.128.0` |
| `resources/codex-windows-sandbox-setup.exe` | `ARM64` | `0.128.0` |
| `resources/codex.exe` | `ARM64` | `0.128.0`; CLI reports `codex-cli 0.128.0` |
| `resources/cua_node/bin/node_repl.exe` | `ARM64` | Vendored from `OpenAI.Codex_26.623.8305.0_arm64__2p2nqsd0c76g0`; SHA-256 `3e2fb244544c834730108caeea4fdafe3e8c3353fb611b71832b2c5897cfaac6` |
| `resources/plugins/openai-bundled/plugins/chrome/extension-host/windows/arm64/extension-host.exe` | `ARM64` | Vendored from `OpenAI.Codex_26.623.8305.0_arm64__2p2nqsd0c76g0`; copied to the ARM64 plugin lookup path because the bundled installer uses `os.arch()`; SHA-256 `5436d4d588ca4bf7f66cd78a0ea0042c899f4a7ec4aff337577dab9730e1baba` |
| `resources/plugins/openai-bundled/plugins/computer-use/node_modules/@oai/sky/bin/windows/codex-computer-use.exe` | `x64` | Vendored from `OpenAI.Codex_26.623.8305.0_arm64__2p2nqsd0c76g0`; SHA-256 `f2b2f56fcd1699b0fa32dec3214a56a1d36b937a2ecf58cc822ab4a904551e03` |
| `resources/plugins/openai-bundled/plugins/latex/bin/tectonic.exe` or `resources/plugins/openai-bundled/plugins/latex-tectonic/bin/tectonic.exe` | `x64` | Downloaded by `hydrate:cli` from `tectonic-typesetting/tectonic` release `tectonic@0.16.9`; SHA-256 `a0a9a5eaf1a940d9a615ad78d35225ca59420c7984576c6402fffb3e9fb05ceb` |
| `vk_swiftshader.dll` | `ARM64` | `5.0.0` |
| `vulkan-1.dll` | `ARM64` | Vulkan Loader |

## Validation Commands

These checks were run from `desktop`:

```powershell
npm run hydrate:app
npm run hydrate:cli
npm run make:win:arm64:ci
npm run verify:windows-arm64-resource-binaries
npx asar list .\out\Codex-win32-arm64\resources\app.asar
```

Repository validation also included whitespace checks and a tracked-file scan for local absolute path markers.

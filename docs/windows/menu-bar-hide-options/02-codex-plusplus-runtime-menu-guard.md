# Codex++ Runtime Menu Lifecycle Guard

## Idea

Install a Windows-only main-process guard in Codex++ runtime, or in a main-scope bundled tweak, that wraps Electron menu lifecycle APIs and reapplies menu-bar visibility whenever upstream rebuilds the native menu.

## Mechanism

The guard would:

- Wrap electron.Menu.setApplicationMenu.
- Reapply menu-bar visibility to all live windows after every application-menu rebuild.
- Listen to app.on("browser-window-created").
- Optionally read host-specific state through globalThis.__codexpp_window_services__.
- Apply a native hide or show strategy to each matching BrowserWindow.

Possible host lookup:

- globalThis.__codexpp_window_services__.windowManager
- windowManager.getHostIdForWebContents(win.webContents)
- windowManager.options.getGlobalStateForHost(hostId).get("hideWindowsMenuBar")

## Findings

The existing app builds one native application menu and calls Menu.setApplicationMenu(menu). On Windows and Linux, Electron applies that menu to windows. That lines up with the observed failure where menu state changes were undone by later menu refreshes.

Codex++ already has a window-services bridge in the recovered bundle and runtime code reads from globalThis.__codexpp_window_services__. That makes a lifecycle guard technically possible.

The loader currently requires original Codex before the runtime fully starts. Upstream startup is deferred enough that this may still be early enough, but that timing is not a strong contract.

## Why It Might Work

It attacks the native lifecycle rather than one minified call site. If upstream refreshes the menu from focus, browser-sidebar state, inspector state, or keybinding state, the wrapper still sees Menu.setApplicationMenu.

It can preserve the current upstream application menu for renderer popups and accelerators, while controlling the visible native menu per window.

## Why It Might Fail

The setting-change trigger is not solved by wrapping Menu.setApplicationMenu. If the user toggles the setting and no menu rebuild or window event follows, nothing reapplies unless we also add explicit IPC or observe state writes.

Host-specific behavior depends on private upstream window-manager internals. If those internals move, the runtime guard breaks in a less obvious way than the bundle patcher did.

The loader-order issue is real. A first window could be created or menu-mutated before the guard is installed.

## Risks

- Double wrapping if tweaks reload without a symbol guard and proper stop().
- Clobbering intentional menus for child windows, debug windows, comment windows, or popups.
- Restoring via setMenu(Menu.getApplicationMenu()) may restore too much on windows that intentionally had no menu.
- Private global bridge use is brittle unless formalized as a Codex++ runtime API.

## Tests

- Fake-Electron tests for wrapping and restoring Menu.setApplicationMenu.
- Idempotent start/stop tests.
- browser-window-created tests.
- Host-mapping delay tests.
- Loader-order test proving the guard installs before the first user-visible window can be created.
- Manual Windows checks: default startup, toggle off/on, focus refresh, new window, debug window, safe mode, tweak reload.

## Skeptical Recommendation

Reasonable only if we formalize the window-services seam or accept a global mode. As an ordinary tweak with private host spelunking, this is too easy to make flaky.

Score: 6/10 as a first-class Codex++ runtime feature. 4/10 as a private ordinary tweak.


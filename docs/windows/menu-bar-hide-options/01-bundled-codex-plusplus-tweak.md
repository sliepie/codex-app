# Bundled Codex++ Tweak

## Idea

Build the Windows menu-bar toggle as a bundled Codex++ tweak with scope both instead of patching the recovered upstream bundle.

Candidate files:

- desktop/codex-plusplus/tweaks/windows-menu-bar/manifest.json
- desktop/codex-plusplus/tweaks/windows-menu-bar/index.js

## Mechanism

The main side owns the real setting and persists it with Codex++ tweak storage. The renderer side registers a Codex++ settings page and talks to the main side through a tiny namespaced IPC API.

Expected shape:

- Main start(api) reads hidden, defaulting to true on Windows.
- Renderer registers a Codex++ settings page such as Windows Menu Bar.
- Renderer calls only get and set(boolean) over tweak IPC.
- Main validates the boolean, persists it, and applies it to all current BrowserWindows.
- Main listens for browser-window-created and reapplies after short deferred ticks because upstream may mutate menus after construction.

## Findings

This fits existing Codex++ seams:

- desktop/package.json routes startup through the Codex++ loader.
- desktop/codex-plusplus/loader.cjs syncs bundled tweaks into the user tweak directory and updates installed bundled tweaks only when the bundled version is newer.
- desktop/codex-plusplus/runtime/main.js discovers and loads main-process tweaks with Node access.
- desktop/codex-plusplus/runtime/preload/tweak-host.js gives renderer tweaks settings, storage, React helpers, IPC, and an fs proxy.
- desktop/codex-plusplus/runtime/preload/settings-injector.d.ts exposes settings registration APIs.

Renderer tweaks cannot manage native windows directly. Main tweaks can use require("electron") and reach app, BrowserWindow, and Menu.

## Why It Might Work

It removes the brittle minified recovered-bundle surgery entirely. The setting becomes owned by the extension layer that is already meant to customize the app.

It also gives us a real implementation seam for tests: a menu controller can be unit-tested with fake Electron objects, instead of only checking generated minified strings.

## Why It Might Fail

It is global unless we deliberately use private Codex window services. The old bundle patch tried to be host-scoped through upstream windowHostIds; a clean tweak should not pretend it owns that private model.

It will not naturally appear in upstream Appearance. It should live under Codex++ settings unless we add a separate settings injection story.

There may be first-window flicker because Codex++ runtime starts around upstream startup rather than replacing upstream BrowserWindow construction.

If Menu.getApplicationMenu() is null during early startup, restoring the visible menu needs a retry.

Safe mode disables tweaks, so the app returns to upstream behavior.

## Risks

- Global behavior may be acceptable for Windows chrome, but it is a behavior change from the attempted host-scoped setting.
- Main-scope tweaks are powerful; keep IPC narrow and avoid exposing generic window mutation.
- Disabling or unloading the tweak should restore menu visibility for the current session, or the app may be left in a surprising state.

## Tests

- Unit test a pure menu controller with fake BrowserWindow and Menu.
- Assert hide calls setAutoHideMenuBar(true), setMenuBarVisibility(false), and the selected removal strategy.
- Assert show calls setMenu(Menu.getApplicationMenu()), setAutoHideMenuBar(false), and setMenuBarVisibility(true).
- Assert destroyed windows are skipped.
- Assert new-window deferred retries run.
- Assert IPC rejects non-booleans and persists booleans.
- Package and smoke-test Windows ARM64: startup, toggle off, toggle on, restart, and new window.

## Skeptical Recommendation

Best first prototype if we accept that this is a global Codex++ feature, not an upstream Appearance setting. It is cleaner than recovered-bundle patching and easier to test.

Score: 7/10 for a global Codex++ setting. Lower if upstream Appearance integration or per-host behavior is mandatory.


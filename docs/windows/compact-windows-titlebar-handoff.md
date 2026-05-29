# Compact Windows Titlebar Handoff

## Current Goal

Implement the compact Windows titlebar tweak by reusing the app's native no-menu titlebar path:

- no extra Windows topbar rendered by the app shell
- chat/app header owns the top titlebar surface, like macOS
- native Windows window controls stay visible on the right
- built-in sidebar/back/forward header buttons stay in their normal app-shell slots
- no transparent old topbar layer and no DOM-moving button workaround
- refresh the local installed tweak and verify without capturing the user's fullscreen desktop

Active goal objective in Codex:

> Replace the compact Windows titlebar tweak direction with the native/macOS-style no-extra-topbar path: keep Windows window controls, reuse existing app header layout, verify with targeted screenshots, update the handoff doc, and publish the PR update.

## Repo State

- Repo: `C:\dev\source\personal\codex-app`
- Branch: `sliepie/compact-windows-titlebar-tweak`
- PR: `https://github.com/sliepie/codex-app/pull/87`

Touched files in the current pass:

- `desktop/codex-plusplus/tweaks/codex-app-compact-windows-titlebar/index.js`
- `desktop/codex-plusplus/tweaks/codex-app-compact-windows-titlebar/manifest.json`
- `desktop/scripts/windows-package-resources.test.mjs`
- this handoff doc

Local installed tweak path:

- `C:\Users\sliepie\AppData\Roaming\codex-plusplus\tweaks\app.sliepie.codex.compact-windows-titlebar`

## Key Finding

The installed renderer app shell already has the desired layout branch.

In `app-shell-DnmC_oyn.js`, the Windows topbar path is controlled by `platform === windows && window.electronBridge?.showApplicationMenu != null`.

When that returns false:

- `or()` does not render `.group/windows-top-bar`
- `Fn()` renders the app header with `top-0` and `inset-x-0`
- the left panel gets `paddingTop: var(--height-toolbar)`, matching the macOS/no-menu shape
- `use-window-controls-safe-area` still provides safe header spacing for native controls

So the correct seam is to remove only `electronBridge.showApplicationMenu` before renderer boot, not to hide or move rendered DOM after the fact.

## Rejected Approaches

These were tried and rejected:

- keeping the old Windows topbar as a transparent layer
- hiding only the menu row from the Windows topbar
- moving the Windows topbar left controls into a fixed overlay host
- adding spacer/sidebar text matching or other layout hacks after the topbar had already rendered

The screenshot that showed overlap after the DOM-move pass is:

- `C:\tmp\codex-app-screenshots\codex-window-printwindow-checkagain-topstrip-20260529-005940.png`

## Current Implementation Direction

The compact tweak is now a main-process tweak.

It patches future `electron.BrowserWindow` construction on Windows:

1. read the original `webPreferences.preload`
2. write a generated preload shim under `CODEX_PLUSPLUS_USER_ROOT\generated`
3. replace the window preload with the shim
4. in the shim, wrap `contextBridge.exposeInMainWorld`
5. when the original preload exposes `electronBridge`, copy the API and delete `showApplicationMenu`
6. require the original preload and restore the original `exposeInMainWorld`

That leaves the rest of `electronBridge` intact and makes the app shell take its existing macOS-style no-menu layout branch.

Important caveat: because this changes the preload used when a BrowserWindow is created, the running window may need an app restart or a newly created window to show the result. Hot-reloading the tweak file updates the main tweak, but it cannot retroactively change the preload that created an already-loaded renderer.

## Screenshot Notes

The user is watching fullscreen YouTube. Avoid full desktop screenshots and `CopyFromScreen`.

Use targeted `PrintWindow` captures of the Codex window only. If `PrintWindow` returns stale/blank output, stop screenshot verification instead of capturing the desktop.

Older screenshots are useful only as rejected-reference evidence:

- `C:\tmp\codex-app-screenshots\codex-window-printwindow-checkagain-topstrip-20260529-005940.png` shows the bad left-control/sidebar overlap from the DOM-move pass
- `C:\tmp\codex-app-screenshots\codex-window-printwindow-spacerfix-topstrip-20260529-010350.png` shows the rejected spacer attempt still failing
- `C:\tmp\codex-app-screenshots\codex-window-printwindow-nativepath-check-topstrip-20260529-063305.png` shows the already-open renderer still using the old preload/topbar spacing, so it is not accepted proof of the new path.
- `C:\tmp\codex-app-screenshots\codex-window-printwindow-existingpatch-topstrip-20260529-064203.png` shows that trying to mutate `window.electronBridge` in the already-open renderer did not move the shell into the no-menu layout. That experiment was reverted; do not repeat it as the final path.

## Validation

Focused test command:

```powershell
fnm exec -- node --test --test-name-pattern "bundles app-owned Codex\+\+ UI tweaks|Bundled Codex\+\+ tweak versions|Codex app compact Windows titlebar tweak|Codex app UI override and Windows menu-bar tweak|includes generated plugin resources" desktop/scripts/windows-package-resources.test.mjs
```

Full file test has had known unrelated failures:

- `PE machine reader rejects invalid PE signatures`
- `Windows ARM64 Resource binary verifier rejects unlisted x64 files`

Latest validation:

- focused test command passed: 5/5
- repo and local installed tweak hashes match for `index.js` and `manifest.json`
- Codex++ main log shows `Compact Windows titlebar BrowserWindow preload patch installed`
- generated shim is still pending because no new BrowserWindow has been constructed since the main tweak started
- targeted `PrintWindow` capture of the current already-open window confirmed it is not using the patched preload yet

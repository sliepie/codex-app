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

- `desktop/codex-plusplus/loader.cjs`
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

The restart check also found that a main-process tweak alone is not early enough when the Codex++ runtime is scheduled after upstream Codex startup. The initial Codex window is created before main tweaks run, so the compact tweak never writes its generated preload shim for that first window. The loader must start Codex++ runtime before requiring upstream Codex so main tweaks can patch Electron constructors before the first `BrowserWindow`.

## Rejected Approaches

These were tried and rejected:

- keeping the old Windows topbar as a transparent layer
- hiding only the menu row from the Windows topbar
- moving the Windows topbar left controls into a fixed overlay host
- adding spacer/sidebar text matching or other layout hacks after the topbar had already rendered

The screenshot that showed overlap after the DOM-move pass is:

- `C:\tmp\codex-app-screenshots\codex-window-printwindow-checkagain-topstrip-20260529-005940.png`

## Current Implementation Direction

The implementation has two small pieces:

1. The Codex++ loader starts runtime integration before requiring the upstream Codex main module.
2. The compact tweak remains a separate main-process tweak that patches `electron.BrowserWindow` construction on Windows.

The tweak behavior:

1. read the original `webPreferences.preload`
2. write a generated preload shim under `CODEX_PLUSPLUS_USER_ROOT\generated`
3. replace the window preload with the shim
4. in the shim, wrap `contextBridge.exposeInMainWorld`
5. when the original preload exposes `electronBridge`, copy the API and delete `showApplicationMenu`
6. require the original preload and restore the original `exposeInMainWorld`

That leaves the rest of `electronBridge` intact and makes the app shell take its existing macOS-style no-menu layout branch.

Important caveat: because the loader is packaged inside the app ASAR, the currently installed app cannot prove the new startup order until the app package itself is updated. The user-restarted installed app still has the old loader ordering, so it remains valid negative evidence but not a proof of the PR state after this loader change.

## Screenshot Notes

The user is watching fullscreen YouTube. Avoid full desktop screenshots and `CopyFromScreen`.

Use targeted `PrintWindow` captures of the Codex window only. If `PrintWindow` returns stale/blank output, stop screenshot verification instead of capturing the desktop.

Older screenshots are useful only as rejected-reference evidence:

- `C:\tmp\codex-app-screenshots\codex-window-printwindow-checkagain-topstrip-20260529-005940.png` shows the bad left-control/sidebar overlap from the DOM-move pass
- `C:\tmp\codex-app-screenshots\codex-window-printwindow-spacerfix-topstrip-20260529-010350.png` shows the rejected spacer attempt still failing
- `C:\tmp\codex-app-screenshots\codex-window-printwindow-nativepath-check-topstrip-20260529-063305.png` shows the already-open renderer still using the old preload/topbar spacing, so it is not accepted proof of the new path.
- `C:\tmp\codex-app-screenshots\codex-window-printwindow-existingpatch-topstrip-20260529-064203.png` shows that trying to mutate `window.electronBridge` in the already-open renderer did not move the shell into the no-menu layout. That experiment was reverted; do not repeat it as the final path.
- `C:\tmp\codex-app-screenshots\codex-window-printwindow-restart-codex-topstrip-20260529-075616.png` shows the user-restarted installed app still using the old startup path. That led to the loader-order fix in this PR.

## Validation

Focused test command:

```powershell
fnm exec -- node --test --test-name-pattern "bundles app-owned Codex\+\+ UI tweaks|Bundled Codex\+\+ tweak versions|Codex app compact Windows titlebar tweak|Codex app UI override and Windows menu-bar tweak|includes generated plugin resources" desktop/scripts/windows-package-resources.test.mjs
```

Combined loader/tweak command used after the loader-order fix:

```powershell
fnm exec -- node --test --test-name-pattern "bundles app-owned Codex\+\+ UI tweaks|Bundled Codex\+\+ tweak versions|Codex app compact Windows titlebar tweak|Codex app UI override and Windows menu-bar tweak|includes generated plugin resources|Codex\+\+ loader" desktop/scripts/windows-package-resources.test.mjs
```

Full file test has had known unrelated failures:

- `PE machine reader rejects invalid PE signatures`
- `Windows ARM64 Resource binary verifier rejects unlisted x64 files`

Latest validation:

- combined focused test command passed: 17/17
- loader tests now prove Codex++ runtime starts before upstream Codex startup
- loader tests include a regression case where early runtime patches `BrowserWindow` before upstream startup constructs a window
- compact tweak unit coverage still proves `showApplicationMenu` is removed before renderer boot
- targeted `PrintWindow` capture of the user-restarted installed app confirmed the old packaged loader still misses the first window, which is expected until the app package is rebuilt/reinstalled with this PR

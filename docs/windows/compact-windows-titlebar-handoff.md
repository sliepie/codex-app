# Compact Windows Titlebar Handoff

## Current Goal

Implement the compact Windows titlebar tweak by reusing the app's native no-menu titlebar path:

- no extra Windows topbar rendered by the app shell
- chat/app header owns the top titlebar surface, like macOS
- native Windows window controls stay visible on the right
- built-in sidebar/back/forward header buttons stay in their normal app-shell slots
- no transparent old topbar layer and no DOM-moving button workaround
- verify with targeted screenshots from a packaged build, not a dev Electron launch

Active goal objective in Codex:

> Replace the compact Windows titlebar tweak direction with the native/macOS-style no-extra-topbar path: keep Windows window controls, reuse existing app header layout, verify with targeted screenshots, update the handoff doc, and publish the PR update.

## Repo State

- Repo: C:\dev\source\personal\codex-app
- Branch: sliepie/compact-windows-titlebar-tweak
- PR: https://github.com/sliepie/codex-app/pull/87

Touched files in the current pass:

- desktop/codex-plusplus/loader.cjs
- desktop/codex-plusplus/compact-windows-titlebar-preload.cjs
- desktop/codex-plusplus/tweaks/codex-app-compact-windows-titlebar/index.js
- desktop/codex-plusplus/tweaks/codex-app-compact-windows-titlebar/manifest.json
- desktop/forge.config.js
- desktop/scripts/windows-package-resources.test.mjs
- this handoff doc

Local installed tweak path:

- C:\Users\sliepie\AppData\Roaming\codex-plusplus\tweaks\app.sliepie.codex.compact-windows-titlebar

Downloaded PR build path from the previous pushed commit:

- outer artifact: C:\tmp\codex-pr87-build\codex-app-windows-arm64-pr.zip
- extracted payload: C:\tmp\codex-pr87-build\payload
- packaged executable: C:\tmp\codex-pr87-build\payload\Codex.exe
- packaged ASAR: C:\tmp\codex-pr87-build\payload\resources\app.asar

That downloaded build predates the latest simplification until the branch is pushed again and Actions produces a new artifact.

## Key Finding

The installed renderer app shell already has the desired layout branch.

In app-shell-DnmC_oyn.js, the Windows topbar path is controlled by platform === windows && window.electronBridge?.showApplicationMenu != null.

When that returns false:

- or() does not render .group/windows-top-bar
- Fn() renders the app header with top-0 and inset-x-0
- the left panel gets paddingTop: var(--height-toolbar), matching the macOS/no-menu shape
- use-window-controls-safe-area still provides safe header spacing for native controls

So the correct seam is to remove only electronBridge.showApplicationMenu before renderer boot, not to hide or move rendered DOM after the fact.

## Current Implementation Direction

Keep Codex startup order close to main:

1. desktop/codex-plusplus/loader.cjs registers early session preload hooks.
2. The loader exposes a tiny synchronous IPC answer for whether the compact Windows titlebar tweak is enabled.
3. The loader requires upstream Codex main.
4. Codex++ runtime integration is scheduled afterward, matching the previous app bootstrap shape.

The compact titlebar behavior is now in desktop/codex-plusplus/compact-windows-titlebar-preload.cjs:

1. run as an early session preload
2. synchronously ask the loader if app.sliepie.codex.compact-windows-titlebar is enabled
3. wrap contextBridge.exposeInMainWorld
4. when the original Codex preload exposes electronBridge, copy the API and delete showApplicationMenu
5. leave all other bridge members intact

The local tweak entry under desktop/codex-plusplus/tweaks/codex-app-compact-windows-titlebar is intentionally small. It exists so Codex++ can list, enable, and disable the feature as a normal bundled local tweak; the actual effect must happen earlier than renderer-scope tweaks can run.

## Rejected Approaches

These were tried and rejected:

- keeping the old Windows topbar as a transparent layer
- hiding only the menu row from the Windows topbar
- moving the Windows topbar left controls into a fixed overlay host
- adding spacer/sidebar text matching or other layout hacks after the topbar had already rendered
- starting the full Codex++ main runtime before upstream Codex solely to patch BrowserWindow
- launching the extracted/dev Electron copy for final verification, because it hit local DB path issues and is not the packaged-user path

The screenshot that showed overlap after the DOM-move pass is:

- C:\tmp\codex-app-screenshots\codex-window-printwindow-checkagain-topstrip-20260529-005940.png

## Screenshot Notes

Do not use the extracted/dev Electron launch path for final proof.

Use a packaged PR build:

1. push the current branch
2. wait for the Windows ARM64 PR build
3. download/extract the fresh codex-app-windows-arm64-pr artifact
4. launch that packaged Codex.exe, preferably with isolated CODEX_HOME and CODEX_SQLITE_HOME if running alongside the user's live app
5. capture only the Codex window/top strip with PrintWindow
6. close the packaged test process

Avoid full desktop screenshots and CopyFromScreen. If PrintWindow returns stale or blank output, stop screenshot verification instead of capturing the user's desktop.

Older screenshots are useful only as rejected-reference evidence:

- C:\tmp\codex-app-screenshots\codex-window-printwindow-checkagain-topstrip-20260529-005940.png shows the bad left-control/sidebar overlap from the DOM-move pass
- C:\tmp\codex-app-screenshots\codex-window-printwindow-spacerfix-topstrip-20260529-010350.png shows the rejected spacer attempt still failing
- C:\tmp\codex-app-screenshots\codex-window-printwindow-nativepath-check-topstrip-20260529-063305.png shows the already-open renderer still using the old preload/topbar spacing, so it is not accepted proof of the new path
- C:\tmp\codex-app-screenshots\codex-window-printwindow-existingpatch-topstrip-20260529-064203.png shows that trying to mutate window.electronBridge in the already-open renderer did not move the shell into the no-menu layout
- C:\tmp\codex-app-screenshots\codex-window-printwindow-restart-codex-topstrip-20260529-075616.png shows the user-restarted installed app still using the old startup path before this PR build is installed

## Validation

Focused package/resource test command:

fnm exec -- node --test --test-name-pattern "Codex\+\+ loader|compact Windows titlebar|bundles app-owned Codex\+\+ UI tweaks|includes generated plugin resources|Forge preflight" desktop/scripts/windows-package-resources.test.mjs

Latest focused result:

- passed 18/18

Hidden Electron preload-order fixture:

- folder: C:\tmp\codex-titlebar-preload-order
- runner: .\desktop\node_modules\electron\dist\electron.exe C:\tmp\codex-titlebar-preload-order\main.cjs
- result file: C:\tmp\codex-titlebar-preload-order\result.json

Latest hidden Electron result:

- hasBridge: true
- hasMenu: false
- keepApplicationBridge: true
- keys: keepApplicationBridge

Full desktop/scripts/windows-package-resources.test.mjs has had known unrelated failures:

- PE machine reader rejects invalid PE signatures
- Windows ARM64 Resource binary verifier rejects unlisted x64 files

Final visual proof is still pending a fresh packaged PR build for the latest branch state.

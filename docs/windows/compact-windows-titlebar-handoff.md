# Compact Windows Titlebar Handoff

## Current Goal

Implement the compact Windows titlebar tweak so Windows uses the macOS-style layout:

- the old Windows topbar is hidden, not kept alive as a transparent layer
- the chat/app header owns the titlebar surface and uses the old titlebar background tint
- the left top controls remain available: sidebar toggle, back, forward
- the right/native Windows controls remain available
- the chat header does not overlap the sidebar
- the local installed tweak is refreshed and verified with a screenshot

Active goal objective in Codex:

> Implement the compact Windows titlebar tweak so it hides the old topbar visually while preserving the left topbar controls, keeps the Windows/right controls usable, refreshes the local installed tweak, and verifies the result with a screenshot.

## Repo State

- Repo: `C:\dev\source\personal\codex-app`
- Branch: `sliepie/compact-windows-titlebar-tweak`
- PR: `https://github.com/sliepie/codex-app/pull/87`
- Existing pushed commit: `00aecda` (`Add compact Windows titlebar tweak`)
- Current local files are dirty and include a rejected transparent-topbar experiment. Do not commit that shape as-is.

Touched files:

- `desktop/codex-plusplus/tweaks/codex-app-compact-windows-titlebar/index.js`
- `desktop/codex-plusplus/tweaks/codex-app-compact-windows-titlebar/manifest.json`
- `desktop/scripts/windows-package-resources.test.mjs`
- this handoff doc

Local installed tweak path:

- `C:\Users\sliepie\AppData\Roaming\codex-plusplus\tweaks\app.sliepie.codex.compact-windows-titlebar`

The local installed tweak auto-reloads when `index.js` is copied there.

## What Was Tried

Initial pushed PR implementation:

- hid only the menu row from the Windows topbar
- moved the chat header to `top:0`
- kept native/right controls
- this looked like the old PR86 trick and did not fully hide the old topbar

Second attempt:

- hid the whole Windows topbar with `display:none`
- moved the chat header to `top:0; left:0; right:0`
- screenshot showed the chat title overlapping the sidebar and the left controls missing

Third attempt:

- removed `left:0/right:0` so the chat header respected the content column
- screenshot fixed sidebar overlap
- but the left top controls were still missing because the whole Windows topbar was hidden

Rejected workaround:

- kept the Windows topbar visible as a transparent layer
- hid only the menu row
- set the topbar to `pointer-events:none` and topbar buttons to `pointer-events:auto`
- screenshot looked close, with left controls visible, but it is explicitly not the requested direction
- user called this out as "the old trick again"

## Desired Direction

Go full macOS-style:

- old Windows topbar should be hidden
- do not preserve it as a transparent button layer
- reuse/move the real left controls if possible instead of recreating behavior
- keep CSS small; do not add a large custom layout stylesheet

Likely implementation path:

1. Find the Windows topbar and its left control group.
2. Move the existing left control group into a small host attached to the app/chat header, so the real buttons keep their existing event handlers.
3. Hide the original Windows topbar.
4. Style only the compact host and the chat header:
   - app header `top:0`
   - app header background `var(--codex-titlebar-tint, transparent)`
   - compact host positioned at the left edge of the titlebar/header area
   - main content top offset `var(--height-toolbar-sm)`

Current implementation pass:

- `index.js` now uses a small DOM move with `MutationObserver`
- it creates `#codex-app-compact-windows-titlebar-controls`
- it moves the first non-menu button group out of `.app-header-tint.group\\/windows-top-bar`
- it then hides `.app-header-tint.group\\/windows-top-bar` with `display:none!important`
- screenshot verification passed visually with targeted `PrintWindow`

Important selectors seen so far:

- Windows topbar: `.app-header-tint.group\\/windows-top-bar`
- PR86 menu row selector: `.group\\/windows-top-bar>.flex.items-center.gap-0\\.5.pr-2.pl-1:has(>button[aria-haspopup="menu"][aria-expanded])`
- App/chat header: `.app-header-tint.draggable.pointer-events-none.fixed.h-toolbar:not(.group\\/windows-top-bar)`
- App header context menu surface: `[data-testid="app-shell-header-context-menu-surface"]`
- Main content viewport: `.app-shell-main-content-viewport`

## Screenshot Notes

The user is watching fullscreen YouTube. Avoid full desktop screenshots and `CopyFromScreen`.

Use targeted `PrintWindow` captures of the Codex window only. If `PrintWindow` stops working or returns stale/blank output, pause screenshot verification instead of capturing the desktop.

Useful existing screenshots:

- `C:\tmp\codex-app-screenshots\codex-window-full-20260529-004140.png`
- `C:\tmp\codex-app-screenshots\codex-window-topstrip-20260529-004140.png`
- `C:\tmp\codex-app-screenshots\codex-window-printwindow-full-20260529-005029.png`
- `C:\tmp\codex-app-screenshots\codex-window-printwindow-topstrip-20260529-005029.png`

The `004140` screenshot shows the rejected transparent-topbar workaround. It is useful as a visual reference for button placement, not as accepted implementation proof.

The `005029` screenshot shows the current macOS-style DOM-move pass: left controls visible, old topbar hidden by CSS, chat header not overlapping the sidebar.

## Validation

Focused test command that has passed earlier for the pushed PR version:

```powershell
fnm exec -- node --test --test-name-pattern "bundles app-owned Codex\+\+ UI tweaks|Bundled Codex\+\+ tweak versions|Codex app compact Windows titlebar tweak|Codex app UI override and Windows menu-bar tweak|includes generated plugin resources" desktop/scripts/windows-package-resources.test.mjs
```

Full file test still had known unrelated failures:

- `PE machine reader rejects invalid PE signatures`
- `Windows ARM64 Resource binary verifier rejects unlisted x64 files`

Need rerun focused tests after final implementation. Also verify by `PrintWindow` screenshot.

## Things To Avoid

- Do not keep the old Windows topbar around as a transparent layer.
- Do not use the PR86 menu-row-only hide approach as the final solution.
- Do not capture the whole desktop while the user has fullscreen YouTube open.
- Do not commit the current transparent-topbar experiment.
- Keep changes scoped to the new compact tweak and its packaging test unless a tiny supporting change is truly required.

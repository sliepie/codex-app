# BrowserWindow setMenu null

## Idea

Use win.setMenu(null) as the hard per-window hide operation instead of relying on removeMenu() or setMenuBarVisibility(false).

## Mechanism

On hide:

- win.setAutoHideMenuBar(true)
- win.setMenuBarVisibility(false)
- win.setMenu(null)

On show:

- win.setMenu(Menu.getApplicationMenu())
- win.setAutoHideMenuBar(false)
- win.setMenuBarVisibility(true)

This can be driven from a Codex++ main tweak, a runtime guard, or an app configuration handler.

## Findings

This is the most direct per-window way to detach the menu surface. It should avoid the single-Alt reveal problem better than autoHideMenuBar alone.

It is less app-wide than Menu.setApplicationMenu(null), so the application menu can still exist for renderer submenu popups and other windows.

## Why It Might Work

It may be the strongest visual fix while keeping the app's global menu available.

It also avoids cloning menus or hiding individual items.

## Why It Might Fail

Accelerators on Windows/Linux are often menu-backed. Detaching the window menu may stop local shortcuts that the app relies on.

Menu.setApplicationMenu(menu) may reattach a menu to windows after setMenu(null), so lifecycle reapply is still required.

The distinction between removeMenu() and setMenu(null) must be tested in a real packaged Windows build; assuming they differ enough would be another guess.

## Risks

- Command palette, search, zoom, reload, devtools, close-tab, or navigation shortcuts may break.
- Reapply timing may still flicker.
- Child windows and popup windows may get altered unintentionally.

## Tests

- Electron smoke: compare removeMenu() and setMenu(null) for visual behavior, Alt behavior, and accelerators.
- App smoke: verify critical shortcuts after hide.
- App smoke: show restores real menu.
- App smoke: menu stays hidden after focus and application-menu refresh.

## Skeptical Recommendation

Good second prototype after hidden accelerator menu. Do not ship unless shortcut behavior is proven.

Score: 5/10 pending accelerator smoke.


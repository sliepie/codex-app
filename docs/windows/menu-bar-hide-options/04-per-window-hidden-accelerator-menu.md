# Per-Window Hidden Accelerator Menu

## Idea

Instead of removing the menu, attach a per-window cloned menu whose top-level items are hidden, while keeping the application menu alive for commands, accelerators, and renderer popups.

## Mechanism

On hide:

- Read Menu.getApplicationMenu().
- Clone enough of the menu template or menu items to preserve command structure and accelerators.
- Set top-level visible menu items to visible false, or build hidden top-level shells with existing submenus.
- Call win.setMenu(hiddenMenu) for hidden windows.
- Keep Menu.setApplicationMenu(realMenu) intact.

On show:

- Call win.setMenu(Menu.getApplicationMenu()).
- Restore auto-hide and visibility flags as needed.

## Findings

The app uses the native menu for more than visible chrome. Renderer code can call Menu.getApplicationMenu()?.getMenuItemById(menuId)?.submenu.popup(...). Global menu removal risks breaking that path.

Electron documentation indicates hidden menu item accelerators still work on Windows/Linux. If that holds for hidden top-level menus, this option preserves shortcuts better than setMenu(null).

## Why It Might Work

It gives each BrowserWindow a native menu object for accelerator registration while avoiding visible File/Edit/View/Window/Help labels.

It is compatible with an implementation in a Codex++ main tweak or runtime guard. It does not require patching recovered renderer code.

## Why It Might Fail

Electron may still reserve a blank menu strip for a menu whose top-level items are hidden. That would be visually worse than a visible menu.

Menu cloning is not trivial. Native Menu/MenuItem objects are not a stable serializable template, and role behavior may not clone cleanly.

The app's menu mutates over time. A hidden clone must rebuild after every Menu.setApplicationMenu.

## Risks

- Blank native menu strip.
- Lost role behavior if cloning is incomplete.
- Drift between real application menu and hidden per-window menu.
- Higher implementation complexity than setMenu(null).

## Tests

- Build a minimal Electron smoke app on Windows.
- Include a real menu with visible labels.
- Include a hidden top-level menu.
- Include an accelerator item under the hidden top-level menu.
- Press accelerator and single Alt.
- Verify no blank strip appears.
- Verify renderer-style submenu popup still works through the real application menu.
- Regression test rebuild after Menu.setApplicationMenu.

## Skeptical Recommendation

Best theoretical Electron strategy if it works in a real Windows smoke test. Do not implement in the app until the blank-strip and accelerator questions are answered.

Score: 7/10 after successful Electron smoke. 2/10 without that proof.


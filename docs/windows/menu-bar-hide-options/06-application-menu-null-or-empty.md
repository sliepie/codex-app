# Application Menu Null Or Empty

## Idea

Remove the app-wide menu on Windows with Menu.setApplicationMenu(null) or replace it with Menu.buildFromTemplate([]) when the hide setting is enabled.

## Mechanism

On hide:

- Save the real application menu somewhere.
- Call Menu.setApplicationMenu(null) or set an empty menu.

On show:

- Rebuild or restore the full application menu.
- Reapply it to windows.

## Findings

This would likely remove the visible native menu surface. It also sidesteps per-window host matching.

But the app uses Menu.getApplicationMenu() as a real command object. Renderer code can ask main to popup a submenu from the application menu. Removing the global menu can break that pathway.

The app also depends on menu-backed native roles and accelerators.

## Why It Might Work

It is simple and global. If the only requirement were "never show File/Edit/View," it is tempting.

## Why It Might Fail

It breaks too much ownership:

- No per-window or per-host behavior.
- Menu.getApplicationMenu() becomes null or useless.
- Menu-backed accelerators and native roles may disappear.
- Restoring requires knowing exactly when and how upstream rebuilds the menu.

## Risks

- Broken command shortcuts.
- Broken renderer application-menu popup.
- Broken native edit commands.
- Hard-to-debug restore ordering.

## Tests

- Verify show-application-menu still works after hiding. It probably will not.
- Verify command palette/search/zoom/fullscreen accelerators.
- Verify native edit commands in text inputs.
- Verify hidden then visible then hidden again after upstream menu refresh.

## Skeptical Recommendation

Do not choose this unless the product explicitly accepts losing native menu-backed command behavior. It is too broad for this app.

Score: 2/10.


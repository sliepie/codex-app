# Auto-Hide And Alt Suppression

## Idea

Use autoHideMenuBar and setMenuBarVisibility(false) as the primary hide behavior, optionally suppressing the standalone Alt key so the menu does not reappear.

## Mechanism

On hide:

- win.setAutoHideMenuBar(true)
- win.setMenuBarVisibility(false)
- Optionally intercept standalone Alt with before-input-event.

On show:

- win.setAutoHideMenuBar(false)
- win.setMenuBarVisibility(true)

## Findings

Electron documents that autoHideMenuBar still allows the menu to show when the user presses Alt. It also says changing auto-hide does not necessarily hide an already-visible menu immediately.

This means auto-hide is not the same as removing the menu.

## Why It Might Work

It preserves the menu and therefore has the best chance of preserving accelerators and native roles.

It is low-impact and easy to restore.

## Why It Might Fail

It does not satisfy a hard "hide menu bar" requirement. Alt reveal is built into the feature.

before-input-event may not reliably prevent native menu activation. Even if it works for standalone Alt, it can interfere with legitimate Alt shortcuts and menu navigation.

## Risks

- The menu remains discoverable by Alt.
- Existing visible menu may stay visible until another native event.
- Input interception can be fragile and accessibility-hostile.

## Tests

- Electron smoke: press Alt after hiding.
- Electron smoke: Alt-based shortcuts still work.
- App smoke: menu remains hidden after focus, setting toggle, and menu refresh.

## Skeptical Recommendation

Not sufficient as the main implementation. It can be an additional polish layer, not the feature.

Score: 2/10.


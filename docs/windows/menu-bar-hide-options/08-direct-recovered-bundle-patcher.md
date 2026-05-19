# Direct Recovered Bundle Patcher

## Idea

Continue injecting the setting UI and native behavior directly into the recovered upstream bundles during hydration.

## Mechanism

This was the attempted approach:

- Patch general-settings assets to add a Windows Appearance toggle.
- Patch the main bundle to add window-manager methods and a set-configuration branch.
- Patch BrowserWindow construction to set autoHideMenuBar from the setting.
- Patch menu refresh to reapply after Menu.setApplicationMenu.

## Findings

This approach has now been removed from the current working branch as the fresh-start baseline.

It did land in the CI artifact: the artifact contained the setting, the main-process methods, and the Menu.setApplicationMenu plus refreshWindowsMenuBars hook. The live test still failed. That means the problem was not simply "patch missing from artifact."

The strongest remaining explanations are:

- The setting was written in a host/global-state bucket that did not target the visible local window.
- The native Electron calls were not sufficient for the app's current menu behavior.
- The tests were too string-focused and did not prove the actual toggle-to-window behavior.

## Why It Might Work

It can reach private upstream internals that a clean tweak should not touch, including windowHostIds, hostConfig.id, and upstream global state. That makes per-host behavior theoretically possible.

It can place the setting in upstream Appearance rather than Codex++ settings.

## Why It Might Fail

It is brittle in exactly the way we saw:

- Minified names and function shapes drift.
- A regex/string-passing patch can still miss the real runtime behavior.
- Host context and native menu lifecycle are easy to misread.
- The feedback loop depended on packaged manual testing too late.

## Risks

- Reintroducing it risks another patch that passes CI but fails in the installed app.
- More stale-patch checks make the patcher heavier without addressing the weak behavior seam.
- It couples a Codex++ customization to upstream private bundle internals.

## Tests If Revisited

- Add a behavior harness, not just regex assertions.
- Prove set-configuration reaches the correct visible window.
- Prove toggle off and on changes BrowserWindow menu state.
- Prove behavior after Menu.setApplicationMenu.
- Prove remote/non-local host behavior intentionally.

## Skeptical Recommendation

Do not use as the next attempt. Keep it removed while we decide on a cleaner implementation path.

Score: 3/10.


# Existing App Configuration Channel

## Idea

Keep using the app's existing configuration pipeline for a hideWindowsMenuBar setting, but fix ownership and targeting before changing more Electron menu calls.

## Mechanism

The attempted bundle implementation added a renderer setting that called the app's use-configuration path. That path sends set-configuration with key and value, and main process writes the value through its global-state handler.

The corrected version would make this setting explicitly local or global for Windows native chrome:

- Write/read the local native-chrome setting, not an arbitrary sender host setting.
- Apply to all relevant primary BrowserWindows, or at least the local primary window.
- Keep the renderer setting and main behavior on the same storage owner.

## Findings

The live artifact showed the setting UI and the main-process handler were present, but toggling did not change visible behavior. That means "patch landed" was not the same as "state reached the right window."

Likely flow:

- Renderer setting calls use-configuration.
- use-configuration sends vscode://codex/set-configuration.
- Preload forwards the message to main.
- Main writes this.globalState.set(key, value).
- The injected native update used this.hostConfig.id.
- Window update only touched windows whose windowHostIds matched that host id.

That creates a credible host/global-state mismatch. The settings UI may run in a host context that does not own the visible local primary window.

Also, use-configuration is optimistic. The UI can appear toggled before we know the native side reached the correct window.

Codex++ storage is separate:

- Main tweak storage is under the Codex++ storage folder.
- Renderer tweak storage is under localStorage keys.
- Neither automatically feeds app set-configuration.

## Why It Might Work

If the real issue is targeting, this is the least exotic fix. It keeps one app setting and one main handler, but changes the native-chrome setting to target the correct windows.

It also explains why the menu stayed visible even after the Electron refresh hook landed.

## Why It Might Fail

The Electron hide API may still be insufficient after targeting is fixed. This idea only solves "the toggle reaches the correct state owner and window set."

It also keeps us in recovered-bundle patch territory unless this channel is exposed through a formal Codex++ API or an upstream source patch.

## Risks

- Applying globally could surprise users in remote or multi-host windows.
- Applying only to local could leave secondary windows inconsistent.
- Continuing to patch minified set-configuration code is brittle.
- Logging must be removed before shipping.

## Tests

- Add targeted instrumentation first: key, value, sender host id, persisted state path, matched window ids, menu object nullness.
- Test hideWindowsMenuBar=false writes false and calls the show branch.
- Test hideWindowsMenuBar=true writes true and calls the hide branch.
- Test remote/non-local settings context either deliberately affects local native chrome or deliberately does not.
- Packaged smoke: toggle off, verify persisted state, verify BrowserWindow reports visible menu state.

## Skeptical Recommendation

Treat this as the leading diagnosis, not necessarily the final implementation. Before choosing a new API, prove whether the existing toggle missed the visible window because of host/global-state targeting.

Score: 6/10 as a diagnosis path. 3/10 as a long-term implementation if it still requires minified bundle surgery.


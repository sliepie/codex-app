---
name: codex-ui-automation
description: Inspect the running Windows Codex desktop UI through UI Automation. Use when validating Codex app UI tweaks, dropdown/menu row visibility, accessible names, live control classes, bounds, or CSS selector assumptions against the currently running packaged app.
---

# Codex UI Automation

Use this skill to verify the live Windows Codex desktop UI before changing selectors or after reloading a tweak.

## Workflow

1. Put the app into the state you need to inspect, for example open the profile/settings menu.
2. Run the bundled script from the repo root:

       powershell -ExecutionPolicy Bypass -File .agents\skills\codex-ui-automation\scripts\inspect-codex-menu.ps1 -OpenSettingsMenu

3. Treat the script output as live accessibility evidence: names, control types, exposed class tokens, and bounds.
4. Use source inspection for DOM/component ownership and UIA for rendered row order/visibility. Do not treat UIA class names as a full DOM dump.

## Useful Options

       powershell -ExecutionPolicy Bypass -File .agents\skills\codex-ui-automation\scripts\inspect-codex-menu.ps1 -MenuName Settings -WaitSeconds 10

- `-MenuName`: Filter to an open menu by accessible name.
- `-WindowName`: Top-level app window name, default `Codex`.
- `-ProcessName`: Process executable, default `Codex.exe`.
- `-WaitSeconds`: Poll briefly for menus after the UI is opened.
- `-OpenSettingsMenu`: Open the bottom-left Settings/profile menu and inspect it in the same process.

By default the script reads UI Automation only. Use `-OpenSettingsMenu` when the profile menu needs to be opened without a separate process stealing focus.

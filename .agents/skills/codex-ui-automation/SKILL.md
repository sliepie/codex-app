---
name: codex-ui-automation
description: Inspect the running Windows Codex desktop UI through UI Automation. Use only when the user explicitly asks to inspect or validate the live running app with UI Automation; do not invoke automatically for ordinary UI tweak or selector work.
---

# Codex UI Automation

Use this skill only when the user explicitly asks to inspect or validate the live Windows Codex desktop UI with UI Automation. Do not run it automatically before changing selectors or after reloading a tweak; prefer source inspection unless the user asks for live UIA evidence.

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

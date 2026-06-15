# Profile Dropdown Invite Findings

## Source Inspected

- Build: `26.609.41114-build-3888`, recovered under `desktop/recovered/app-asar-extracted`.
- Menu chunk: `webview/assets/profile-dropdown-E4knYyDU.js`.
- Related chunks:
  - `webview/assets/rate-limit-summary-xXHgYrot.js`
  - `webview/assets/referral-invite-modal-B6r0ktkz.js`
  - `webview/assets/dropdown-CUE_rV_-.js`

## Findings

- `Invite a friend` / `Invite a coworker` is rendered by the profile dropdown chunk, not by the rate-limit summary/usage menu chunk.
- The profile dropdown builds a single flex column container with children ordered as account/profile/settings rows, rate-limit summary, invite row, and log-out row.
- The invite row is produced by the profile-dropdown referral component and wrapped in an Electron-only gate. In the rendered Electron menu the wrapper sits immediately before `Log out`.
- The rate-limit summary is still useful as a context anchor because the same profile dropdown container directly contains the compact usage summary.
- The shared dropdown item component renders rows as Radix menu items with `role="menuitem"`.
- A live Windows UI Automation check against the running packaged app showed the open profile menu as a Radix menu root with class tokens including `flex`, `flex-col`, and `w-[280px]`. Its direct accessible children were an empty group, `Personal account`, `Profile`, `Settings Ctrl+,`, `Usage remaining`, `Invite a friend`, and `Log out`.

## Selector Decision

Use the live Radix profile menu root as context, then hide the second-to-last menu item:

```css
.w-\[280px\]>.flex.w-full.min-w-0.flex-col.gap-0>:nth-last-child(2):has(svg path[d^="M16.834"]) {
  display: none !important;
}
```

This is intentionally not `usage menu > :nth-last-child(2)`. The invite row is a direct child of the profile dropdown's inner flex column after the usage row, not a child of the usage summary. UI Automation exposes the visible order, but the CSS follows the recovered DOM source: the `w-[280px]` dropdown content contains the `flex w-full min-w-0 flex-col gap-0` column. The final selector also requires the invite/envelope icon path so the usage block is not hidden when the invite row is absent or delayed.

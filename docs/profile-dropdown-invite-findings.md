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
- The invite row is produced by the profile-dropdown referral component and wrapped in an Electron-only gate. In the rendered Electron menu it sits immediately before `Log out`.
- The rate-limit summary is still useful as a context anchor because the same profile dropdown container directly contains the compact usage summary.
- The shared dropdown item component renders rows as Radix menu items with `role="menuitem"`.

## Selector Decision

Use the profile dropdown container as context, then hide the second-to-last menu item:

```css
.flex.w-full.min-w-0.flex-col.gap-0:has(>.flex.flex-col.text-sm:has(>.grid.items-center.gap-y-1\.5.py-1))>[role="menuitem"]:nth-last-child(2) {
  display: none !important;
}
```

This is intentionally not `usage menu > :nth-last-child(2)`. The invite row is a sibling after the usage summary, not a child of the usage summary.

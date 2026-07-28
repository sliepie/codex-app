# Codex app 26.721.5848.0 sidebar renderer evidence

Captured on 2026-07-28 from the running self-signed Windows ARM64 package before
refreshing the sidebar UI tweaks.

## Package and archive identity

- Package: `Sliepie.Codex.SelfSigned_26.721.5848.0_arm64__t4q581v5edfmp`
- Archive entry: `app/resources/app.asar`
- Archive size: `334379272` bytes
- Archive SHA-256: `2a22dff881747da6dbc245a164f1e36fcdc9978acb6a3e976a4a61cd22d4ea8c`

## Renderer source

- Entry:
  `recovered/app-asar-extracted/webview/assets/app-initial-BHB6SClA.js`
- Size: `14047570` bytes
- SHA-256: `db8d1c641e5020c80c5fbd02e09c5313fe0bca5d37248127cfc7caddb579437b`

The extracted JavaScript remains untracked under the repository's upstream
evidence policy. The identity above is sufficient to reproduce the inspected
source from the matching package.

## Sidebar ownership findings

- The collapsed sidebar is wrapped by
  `[data-pip-obstacle="app-shell-floating-left-panel"]`. Its direct `aside`
  uses `data-testid="app-shell-floating-left-panel"` and contains a separate
  `.app-header-tint.flex.h-toolbar` navigation header before the sidebar body.
  The floating wrapper owns the vertical position; the nested header owns the
  duplicated collapsed navigation controls.
- Thread actions use an absolute right-side rail. The renderer defines the
  common rail as `absolute right-0 top-0 z-10 flex h-full`, the two-action
  variant as `mr-0.5 w-[52px]`, and the status variant as
  `min-w-[52px]`. Action buttons use
  `.sidebar-hover-icon-button-tint`; status content uses
  `data-hover-card-open-immediately`.
- Thread rows expose `data-app-action-sidebar-thread-row`. Their title content,
  resting status layer, and absolute action rail are separate siblings, so
  action visibility and title-width reservation must target the action-bearing
  52px rail rather than every status layer.
- Rich hover cards render as `role="tooltip"` with the
  `rounded-xl ... backdrop-blur-sm` rich-card classes and are portaled to the
  supplied container or `document.body`. Suppression therefore targets the
  body-level rich card only while the sidebar scroll surface is hovered. Using
  sidebar `:focus-within` would also suppress unrelated rich cards after focus
  remains on a sidebar control.

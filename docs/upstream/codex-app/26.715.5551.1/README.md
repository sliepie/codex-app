# Codex 26.715.5551.1 renderer sidebar bundles

This directory contains the renderer chunks copied byte-for-byte from the currently installed self-signed package. They are used to audit and maintain the sidebar build patches and Codex++ CSS selectors.

Source package:

- Package: `Sliepie.Codex.SelfSigned_26.715.5551.1_arm64__t4q581v5edfmp`
- Archive: `app/resources/app.asar`
- Archive SHA-256: `48A7E3FAD33A5DF2BAA8FE27B67BE1B7697BFE13FC179CFBCC9A07D02075FCA9`
- Verified: `2026-07-19`

Retained entries:

- Sidebar implementation: `app-initial~app-main~appgen-settings-page~page~appgen-library-page~appgen-page~appgen-setti~ogh9jurw-Ccxu2qV_.js`
  - Archive entry: `recovered/app-asar-extracted/webview/assets/app-initial~app-main~appgen-settings-page~page~appgen-library-page~appgen-page~appgen-setti~ogh9jurw-Ccxu2qV_.js`
  - SHA-256: `44DB3711C906E1402C50B046F33B8F4C7FA7569C0F26E2A6C480EA2693782785`
  - Size: `822128` bytes
- Shared navigation row and section components: `app-initial~app-main~plugin-detail-page~settings-page~projects-index-page~appgen-library-pa~nsqr45u8-BsxF8U1y.js`
  - Archive entry: `recovered/app-asar-extracted/webview/assets/app-initial~app-main~plugin-detail-page~settings-page~projects-index-page~appgen-library-pa~nsqr45u8-BsxF8U1y.js`
  - SHA-256: `F1E84147355DBEB3D7958E41A0C3A5291F0D62F2CDCBFCA057F19195C651FED8`
  - Size: `15487` bytes
- Sidebar thread orchestration and row data attributes: `app-initial~notebook-preview-panel~app-main~pull-request-route~projects-index-page~cloud-en~lpx9dmpy-DIXNZs6h.js`
  - Archive entry: `recovered/app-asar-extracted/webview/assets/app-initial~notebook-preview-panel~app-main~pull-request-route~projects-index-page~cloud-en~lpx9dmpy-DIXNZs6h.js`
  - SHA-256: `168142BCC2D5E02DBBC2179B510FC71093E3A69212D1DD6442E4A015BA9D854C`
  - Size: `246125` bytes
- Sidebar thread row and title layout: `app-initial~app-main~onboarding-page~projects-index-page~hotkey-window-thread-page~chatgpt-~j34jmud9-BI9BnaCD.js`
  - Archive entry: `recovered/app-asar-extracted/webview/assets/app-initial~app-main~onboarding-page~projects-index-page~hotkey-window-thread-page~chatgpt-~j34jmud9-BI9BnaCD.js`
  - SHA-256: `A47042D97C83A6C268DEB0155FB9BA3A2CF8226AD3BC4C61E6A3B119FC1C902F`
  - Size: `66957` bytes

The sidebar snapshot includes any build rewrites already present in that installed package, but it predates the heading-normalization rewrite documented here. In this version, the visible `Chats` section passes `` heading:`Tasks` `` to `sidebarSection`, which produces the stale live `data-app-action-sidebar-section-heading="Tasks"` marker. The Windows packaging rewrite normalizes that heading to `Chats` and accepts a future upstream-native `Chats` heading without modifying it.

The sidebar imports the shared row component as `uM`. Its outer shell carries `relative`, `h-[var(--height-token-row)]`, and `py-row-y`; that shell is a `button` for a simple row and a `div` when the row has an interactive trailing action. Height overrides must target that outer shell rather than the nested label button/content wrapper.

Thread lists import the thread orchestration component as `NA`. It attaches the semantic `sidebarThreadRow` data attributes, then delegates the visible row to `Wr`. The visible title is the block-level `[data-thread-title]` span inside a self-stretching, centered flex container; title-only optical corrections should target that span instead of moving the row or action rail.

Only the renderer chunks needed for the sidebar implementation, shared row/section structure, and thread-title ownership chain are retained. The full `app.asar` is 326 MB and contains unrelated runtime and media assets.

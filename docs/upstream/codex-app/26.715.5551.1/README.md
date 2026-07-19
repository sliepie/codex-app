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

The sidebar snapshot includes any build rewrites already present in that installed package, but it predates the heading-normalization rewrite documented here. In this version, the visible `Chats` section passes `` heading:`Tasks` `` to `sidebarSection`, which produces the stale live `data-app-action-sidebar-section-heading="Tasks"` marker. The Windows packaging rewrite normalizes that heading to `Chats` and accepts a future upstream-native `Chats` heading without modifying it.

The sidebar imports the shared row component as `uM`. Its outer shell carries `relative`, `h-[var(--height-token-row)]`, and `py-row-y`; that shell is a `button` for a simple row and a `div` when the row has an interactive trailing action. Height overrides must target that outer shell rather than the nested label button/content wrapper.

Only the renderer chunks needed for the sidebar implementation and its shared row/section structure are retained. The full `app.asar` is 326 MB and contains unrelated runtime and media assets.

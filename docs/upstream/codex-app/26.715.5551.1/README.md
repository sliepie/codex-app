# Codex 26.715.5551.1 renderer sidebar bundle

This directory contains the renderer chunk copied byte-for-byte from the currently installed self-signed package. It is used to audit and maintain the sidebar build patches and Codex++ CSS selectors.

Source package:

- Package: `Sliepie.Codex.SelfSigned_26.715.5551.1_arm64__t4q581v5edfmp`
- Archive: `app/resources/app.asar`
- Archive SHA-256: `48A7E3FAD33A5DF2BAA8FE27B67BE1B7697BFE13FC179CFBCC9A07D02075FCA9`
- Archive entry: `recovered/app-asar-extracted/webview/assets/app-initial~app-main~appgen-settings-page~page~appgen-library-page~appgen-page~appgen-setti~ogh9jurw-Ccxu2qV_.js`
- Extracted file SHA-256: `44DB3711C906E1402C50B046F33B8F4C7FA7569C0F26E2A6C480EA2693782785`
- Extracted file size: `822128` bytes
- Verified: `2026-07-19`

The snapshot includes any build rewrites already present in that installed package, but it predates the heading-normalization rewrite documented here. In this version, the visible `Chats` section passes `` heading:`Tasks` `` to `sidebarSection`, which produces the stale live `data-app-action-sidebar-section-heading="Tasks"` marker. The Windows packaging rewrite normalizes that heading to `Chats` and accepts a future upstream-native `Chats` heading without modifying it.

Only the renderer chunk containing the sidebar implementation is retained. The full `app.asar` is 326 MB and contains unrelated runtime and media assets.

# Runtime and app regressions investigation

Date: 2026-07-15

Branch: `sliepie/fix-runtime-cache-and-app-regressions`

This is a running evidence log. It records observations, commands, decisions, and validation while investigating the Windows ARM64 runtime workflow and desktop app regressions.

## Reported symptoms

- The GitHub primary-runtime workflow appears to rebuild every time instead of reusing or validating cached output.
- The installed app has a broken taskbar icon.
- Codex++ and the repository-bundled tweaks are absent.
- The Codex/work selector and search icon in the sidebar should be hidden.
- Visible ChatGPT product-name text should read Codex.
- All bundled tweaks need to be re-evaluated; stale tweaks should remain excluded rather than being enabled through fallbacks.
- While the desktop app is running, Windows Antimalware Service consumes about 9% CPU. Running the Codex CLI alone does not cause that activity, and closing the desktop app stops it.
- Follow-up UI adjustment: start by reducing sidebar item height by 2 px, with up to 4 px available after visual review.

## Ground rules

- Keep the diagnosis evidence-driven and preserve upstream behavior where possible.
- Do not add Windows Defender exclusions or weaken host security.
- Do not use UI Automation unless explicitly requested.
- Do not edit generated output.
- Keep outdated tweak selectors out; do not layer speculative fallbacks over stale rules.

## Initial repository state

- Started from clean `main` at `a3b7999c`.
- Created feature branch `sliepie/fix-runtime-cache-and-app-regressions`.
- The root domain context currently says the Windows ARM64 package is a clean Electron testbed with no Codex++ loader or Codex++ hydration. This conflicts with the required installed behavior and is part of the investigation.
- Relevant workflows are `.github/workflows/primary-runtime-windows-arm64.yml`, `.github/workflows/windows-arm64-pr-build.yml`, and `.github/workflows/windows-arm64-release.yml`.
- Relevant bundled tweaks currently live under `desktop/codex-plusplus/tweaks/`.

## Feedback loops

The investigation will establish one focused pass/fail command per symptom before changing behavior:

1. Runtime CI: inspect a recent workflow run and add a local workflow/config assertion that fails when an unchanged runtime input would still schedule a rebuild.
2. Packaging: use the package-plan/resource tests to assert that the taskbar icon and required Codex++ payloads are present in the packaged plan.
3. Tweaks: use the focused Codex++ package-resource test seam to assert the exact current selectors and reject stale rules.
4. Defender CPU: capture a short, repeatable process/CPU and filesystem-activity comparison with the desktop app running versus the CLI-only baseline. A repository fix will not be claimed until the triggering app behavior is identified.

## Timeline

### 2026-07-15 — kickoff

- Read the repository instructions, domain context, debugging workflow, and bundled-tweak maintenance workflow.
- Confirmed the worktree was clean before branching.
- Started three read-only investigations in parallel: runtime CI caching, packaged app assets/tweaks, and Windows Defender activity.

### 2026-07-15 — first source findings

- Confirmed `desktop/scripts/resolve-primary-runtime-source.ts` only sends a `HEAD` request to the public x64 manifest and then unconditionally writes `should_publish=true`. It never reads the upstream version, compares it with the published ARM64 manifest, or checks whether a usable build already exists.
- Confirmed the primary-runtime publish job has only the npm dependency cache. It does not cache or restore the composed runtime output, so every scheduled run that reaches the job rebuilds the full archive.
- Found two release-tagged commits based on current `main` that are not present on `origin/main`: `4c43e054` restores the Electron-hosted Codex++ customization path, and `38db87b6` excludes the stale sidebar action-control and right-panel tab rule groups. Their branch/PR status is being checked before reuse.
- Confirmed current `main` deliberately rewrites the packaged entry point back to the recovered upstream bootstrap and excludes `codex-plusplus/` from Forge packaging. The missing Codex++ runtime and bundled tweaks are therefore reproducible from source configuration, not just an installed-copy problem.

### 2026-07-15 — current remote and live package inspection

- Refreshed remote refs and rebased this branch onto current `origin/main` at `969b7144` before implementation.
- Live Actions evidence shows three scheduled runs (`29401592828`, `29422852917`, and `29445564797`) on the same commit and upstream bundle. Each reported an npm cache hit, then spent 365–411 seconds rebuilding and republishing the runtime. Since 2026-07-09, 28 scheduled runs used about 213.6 runner-minutes across only three source commits.
- The three nominally identical runtime outputs had different archive sizes. This proves the published asset is being needlessly replaced and also reveals nondeterministic archive bytes that need separate containment or correction.
- Current `origin/main` contains the latest upstream hydration fix from PR #136, but the earlier merged customization commits from PR #134 and PR #132 are no longer ancestors of `main`. This explains why the current source again excludes Codex++ and again enables the stale sidebar/right-panel rule groups.
- Inspected the installed self-signed MSIX manifest and payload. The manifest references `assets\icon.png`, `assets\Square44x44Logo.png`, and `assets\Square150x150Logo.png`, but the installed package has no root `assets` directory. `desktop/scripts/prepare-self-signed-msix-payload.ts` writes those references without copying `desktop/assets/windows/msix/` into the payload. This is a direct cause for broken shell/taskbar icon resolution.
- Measured Windows Defender while the desktop app remained open. Antimalware Service produced bursty reads while the desktop process tree was nearly idle. No scheduled scan was active, and a short filesystem watch observed only a handful of Sentry state writes.
- Repeated the measurement for 29 seconds while the desktop tree stayed at exactly seven processes with no starts or exits. Antimalware Service still averaged 7.00% normalized CPU, peaked at 30.55%, averaged 329.21 MB/s of reads, and peaked at 2.80 GB/s. This rules out a child-process or crash respawn loop.
- The installed Electron host is a 214.7 MB unsigned executable mapped by five desktop processes. The separately running 293.9 MB CLI/app-server executable has a valid OpenAI signature and is mapped by only one process. Other unsigned mapped desktop modules total about 36 MB. The recurring read bursts line up with repeated scans of the large stable desktop image and/or archive much better than with file churn.
- The official Defender performance recorder was attempted, but Windows rejected it because the current process is not elevated. No trace file was left behind. An administrator trace remains necessary to attribute Defender scan time to an exact file; the repository must not add exclusions based on inference.
- Microsoft documents unsigned executables and DLLs as a common cause of higher Defender CPU during real-time scanning and recommends signing internal binaries. Its supported performance analyzer is the path to exact per-file attribution and requires an elevated administrator session: [real-time protection performance troubleshooting](https://learn.microsoft.com/en-us/defender-endpoint/troubleshoot-performance-issues) and [performance analyzer reference](https://learn.microsoft.com/en-us/defender-endpoint/performance-analyzer-reference).

### 2026-07-15 — installed-source tweak audit

- Inspected the installed `26.707` application archive rather than guessing selectors from the older checked-in recovered bundle.
- The new Codex/ChatGPT Work selector and compact Search button are siblings inside a dedicated `div.ml-2.flex.items-center` wrapper in the first fixed header under the existing sidebar root marker. A single locale-independent wrapper rule can hide both; localized `aria-label` text should not be used.
- The stale sidebar hover/action and right-panel tab rule groups were removed entirely.
- The old project action-rail selector no longer matches upstream's max-width/grid structure and was removed with its rule group.
- The Codex Mobile sidebar selector is stale because that action moved to the Help menu; it was removed entirely.
- Still source-backed: the app-menu marker, thread/project data markers, image preview controls, settings layout markers, invite/settings SVG markers, usage-menu rows/links, and the independent Windows menu-bar tweak.
- The Codex++ loader does not automatically disable a tweak because selectors are stale. Installed tweaks remain enabled unless safe mode or configuration disables them, so stale behavior must be kept out by omitting/removing the affected rules.
- The installed UI override had diverged to experimental version `0.26.1`, which would outrank the PR bundle and retain stale rules. Used the guarded repo sync flow to replace its content with the audited source while returning the installed copy to its separate main-based test track. The first audit sync used `0.25.1`; the stale-code deletion refresh advanced it to `0.25.2`.

### 2026-07-15 — first pull-request feedback loop

- Primary-runtime validation passed on GitHub in 5m36s and populated the new verified cache path.
- The first Windows ARM64 app build failed during hydration because the restored forced-all OWL feature-switch rewriter no longer had a valid target in the current bundle.
- Inspection of the current installed `26.707` source showed that upstream now owns OWL bootstrap state, merges enable/disable feature switches, and enables its intended defaults. The obsolete forced-all and binding rewrite code was removed rather than broadened or retained as dormant compatibility code.
- Current-source probes confirmed that the window-services and Codex Micro cleanup patches still have source-backed targets.
- The old message-rail gate is absent from the current bundle while the rail component remains. Its wrapper would throw after scanning the bundle, so that rewrite and its tests were removed entirely.
- The current main-process wrapper calls `stop()` on the Codex Micro service. The replacement service now implements that no-op lifecycle method while continuing to remove the unsupported Work Louder runtime dependency.
- A second no-legacy review found two older window-services strategies and a standalone-primary taskbar bundle shape. Current `26.707` uses the service-factory window-services shape and the shared Quick Chat/primary taskbar shape, so the older branches and standalone taskbar test were deleted.
- After removing the obsolete source rewriters and dormant CSS groups, script compilation, the Windows package-resource suite, and the 11-test recovered-bundle patch suite passed locally. The follow-up must still pass the real GitHub app hydration/build job.

### 2026-07-16 — package-signature comparison and static product-name rewrite

- Confirmed the installed self-signed package already has a valid Developer package signature and the official Store package has a valid Store package signature. Outer MSIX signing therefore does not imply that every executable inside the package has an Authenticode signature.
- The Store-sourced Owl shell has unsigned top-level `Codex.exe`, Chromium launchers, elevation helpers, and notification helper. The large Codex CLI, command runner, and sandbox helper under `resources` have valid OpenAI signatures. The user also reproduces the Defender load with the official app, so package signing alone and this repository's self-signed package alone cannot explain the issue.
- Unsigned app launchers remain a shared, plausible trigger, but not a confirmed root cause. The self-signed packager now signs every top-level staged executable before packing instead of signing only the declared entry point. A live comparison and elevated Defender trace are still required to measure whether that changes scanning behavior.
- Rejected a runtime DOM-observer approach for product naming. Hydration now rewrites capitalized `ChatGPT` product text inside renderer JavaScript string and template literals. Product identifiers, lowercase protocol values and URLs, and the `ChatGPT-Account-ID` header remain unchanged.
- Added a repository instruction requiring explicit approval before runtime observers, DOM tree walkers, polling, timers, or other dynamic JavaScript are introduced in tweaks or source patches. Build-time rewrites and CSS are the default.

## Findings

### Confirmed

1. Runtime scheduled rebuilds are unconditional: the resolver checks reachability only and always publishes.
2. Runtime output is not cached: the workflow caches npm dependencies but not the composed archive/output directory.
3. Codex++ absence is encoded in the current package path: Forge excludes the loader/runtime and resets `package.json.main` to the recovered bootstrap.
4. The self-signed MSIX omits the icon assets referenced by its own manifest.
5. Defender load is on-access read scanning, not a scheduled scan and not explained by ordinary app-data write churn.
6. The requested sidebar controls have a current locale-independent structural selector; text/ARIA matching is unnecessary.
7. Several old UI override groups are genuinely stale, and Codex++ version/update handling will not disable them automatically.
8. Defender activity continues with a completely stable desktop process tree, so process respawning and crash loops are ruled out. Both the self-signed and official apps reproduce the load, both outer packages have valid signatures, and both contain unsigned app launchers. Unsigned launchers remain a shared hypothesis, not a proven cause; the signed CLI-only path still does not reproduce the issue.

### Under investigation

- Exact per-file Defender attribution, which requires an elevated Defender performance recording.
- A steady-state comparison of the current package and a package with every top-level launcher signed.

## Changes

- Runtime resolver now reads the upstream and published manifests and records explicit provenance for the source archive, relevant source-manifest metadata, the deterministic build recipe, and a weekly native-substitution refresh epoch.
- Scheduled runtime runs skip publishing only when all provenance matches, the published manifest describes a valid Windows ARM64 archive, and that archive still responds successfully. Pull requests, relevant pushes, and manual runs remain forced validation paths.
- Runtime output is cached by source, source metadata, recipe, and refresh epoch. A restored output must pass target, size, archive-hash, source, recipe, and epoch verification before composition is skipped. Restore/save use separate run-specific keys so an invalid immutable cache rebuilds once and the repaired output becomes the newest reusable entry.
- The weekly epoch deliberately recomposes unchanged upstream archives once per week so newly published ARM64 Node, npm, Python, NuGet, or PyPI substitutions are not frozen indefinitely. This reduces a six-hour schedule from as many as 28 compositions per week to one when upstream inputs remain stable.
- The runtime builder writes provenance into `LATEST.json` and rejects source, manifest, recipe, or epoch drift between resolution and composition.
- Added focused resolver and cached-output integrity tests, and made those tests part of the primary-runtime pull-request job.
- The self-signed MSIX packager now Authenticode-signs every unsigned top-level staged executable with the existing package code-signing certificate before creating and signing the outer MSIX. It preserves valid existing signatures, rejects invalid states, and verifies the expected signer after signing. This covers the desktop host and Chromium/helper launchers without changing Defender configuration.
- Restored the previously merged Codex++ customization chain on top of the current PR #136 hydration code: release tag/SHA resolution, cache identity, workflow inputs, runtime hydration, Forge packaging, loader entry point, release metadata, and the Electron-compatible recovered-source patches.
- Removed the obsolete OWL feature-switch, OWL binding, and message-rail rewrite implementations and tests. Current upstream owns those behaviors.
- Removed legacy window-services repair/lifecycle strategies and the obsolete standalone-primary taskbar rewriter. Only the two current `26.707` bundle shapes remain.
- Added the current `stop()` lifecycle method to the Codex Micro replacement service so the upstream wrapper can shut it down without a `TypeError`.
- Restored both Windows icon paths. Payload preparation now copies the complete MSIX asset directory referenced by `AppxManifest.xml`, and recovered main-process bundles receive an explicit Windows `BrowserWindow` icon from the packaged resource directory.
- Re-evaluated both bundled tweaks. The independent Windows menu-bar tweak remains source-backed and unchanged. The UI override is now `0.26.0`, hides the current mode/search wrapper with one locale-independent structural selector, and removes the obsolete Codex Mobile, sidebar hover/project-action, and right-panel tab code entirely.
- Added a build-time renderer transformation that changes capitalized ChatGPT product text to Codex without runtime observers or changes to protocol identifiers.
- Added the no-runtime-observers-without-approval rule to the repository instructions.

## Validation

- Runtime script compilation passed.
- Runtime resolver/provenance/cache tests passed: 11/11.
- Runtime cached-output integrity tests passed: 2/2.
- The updated workflow parses as YAML.
- Defender mitigation remains unproven. The official-app reproduction and the valid outer signatures rule out package-signature state as a complete explanation; exact scan attribution and observed CPU improvement still require an elevated trace and a live package comparison.
- Recovered-bundle patch tests passed: 12/12, including static product-name replacement and preservation of product identifiers, protocol values, URLs, and the account header.
- Release resolver tests passed: 21/21.
- Windows package-resource tests passed: 79/79 after obsolete patch tests were deleted, including execution of payload preparation, verification that every manifest-referenced icon exists, a Forge-to-runtime icon-path cross-check, current Codex Micro lifecycle coverage, and failure coverage for a missing recovered entry point.
- Installed UI tweak `index.js` now hashes identically to the audited repo source; its installed-only manifest version is `0.25.2`.
- Release-path focused suites also passed: CLI hydration 5/5, Windows ARM64 package plan 9/9, and browser-client runtime compatibility 8/8.
- The MSIX packaging PowerShell script parses successfully after the inner-signing change.
- A temporary-copy run against the real recovered bundle replaced 2,800 product-name string occurrences across 95 renderer assets without touching the source tree.

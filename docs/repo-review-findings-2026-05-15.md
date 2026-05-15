# Repo Review Findings - 2026-05-15

## Critical

### 1. Release builds execute floating npm code while signing secrets are in scope

`desktop/package.json:14` runs `npx -y -p @typescript/native-preview@beta tsgo`, so release scripts execute a floating beta compiler outside the locked dependency graph. `desktop/package.json:26` runs that build before decoding the self-signed PFX. The release workflow then passes `SELF_SIGNED_PFX_BASE64` and `SELF_SIGNED_PFX_PASSWORD` into the decode step at `.github/workflows/windows-arm64-release.yml:164-166`.

Impact: a compromised or changed npm beta package can execute inside the signing-secret step and exfiltrate the self-signed certificate material.

Recommended fix: pin the compiler in `package-lock.json` or vendor the build tool, and do not compile scripts in the same step that receives signing secrets.

## High

### 2. Release job exposes write-scoped GitHub credentials to install and build scripts

The release workflow grants write scopes at `.github/workflows/windows-arm64-release.yml:11-14` and exports `GH_TOKEN` job-wide at `.github/workflows/windows-arm64-release.yml:20`. The dependency install runs with that token in the environment at `.github/workflows/windows-arm64-release.yml:40-42`.

Impact: a compromised dependency, postinstall script, or build script gets release and Pages publishing authority before the workflow reaches the intended publish steps.

Recommended fix: split build and publish into separate jobs, keep build jobs read-only, and scope `GH_TOKEN` only to the specific `gh` publish steps.

### 3. Self-signed App Installer XML is internally invalid

`desktop/scripts/write-self-signed-appinstaller.ts:78` emits `ShowPrompt="false"` with `UpdateBlocksActivation="true"`. The PowerShell generator rejects that exact combination at `packaging/windows/New-CodexAppInstaller.ps1:51-52`, and the package test currently asserts the bad XML at `desktop/scripts/windows-package-resources.test.mjs:914`. The release workflow publishes the TypeScript generator output at `.github/workflows/windows-arm64-release.yml:200-210`.

Impact: the published self-signed App Installer channel can be rejected or behave incorrectly, and the test suite currently protects the broken behavior.

Recommended fix: align the TypeScript generator with the PowerShell validation rule and update the test to assert a valid `OnLaunch` combination.

### 4. Externally sourced release metadata is interpolated into PowerShell

`desktop/scripts/resolve-codex-releases.ts:39-41` writes raw values to `GITHUB_OUTPUT`, including upstream release values at `desktop/scripts/resolve-codex-releases.ts:205-213`. The release workflow interpolates those outputs directly into a PowerShell here-string at `.github/workflows/windows-arm64-release.yml:111-117`.

Impact: compromised appcast or upstream tag metadata containing PowerShell syntax can execute in a write-scoped release job.

Recommended fix: validate versions and tags against strict allowlists before writing outputs, then pass values through environment variables instead of expression interpolation inside PowerShell code.

### 5. Upstream app, CLI, and Codex++ artifacts are repackaged without mandatory independent verification

The Codex app ZIP URL is parsed from appcast data at `desktop/scripts/hydrate-codex-app.ts:1543`, downloaded at `desktop/scripts/hydrate-codex-app.ts:1558`, and extracted at `desktop/scripts/hydrate-codex-app.ts:1563`. Codex++ release zipball data is accepted and unpacked through `desktop/scripts/hydrate-codex-app.ts:433`, `desktop/scripts/hydrate-codex-app.ts:450`, and `desktop/scripts/hydrate-codex-app.ts:455`. CLI assets are downloaded and copied through `desktop/scripts/hydrate-codex-cli.ts:335` and `desktop/scripts/hydrate-codex-cli.ts:338`.

Impact: compromised upstream, CDN, or GitHub release assets can be re-signed or shipped by this repo.

Recommended fix: require independent checksums, signatures, pinned release digests, or a verified manifest for every repackaged upstream artifact. The Node ZIP path already has checksum validation; these paths need equivalent treatment.

### 6. Tweak store IDs can path-traverse out of `TWEAKS_DIR`

`desktop/codex-plusplus/runtime/main.js:2297-2312` normalizes store entries but returns `manifest.id` without enforcing a safe path-segment pattern. Installation then joins that ID into filesystem paths at `desktop/codex-plusplus/runtime/main.js:3098-3099`, recursively removes the target at `desktop/codex-plusplus/runtime/main.js:3132`, and copies staged content into it at `desktop/codex-plusplus/runtime/main.js:3133`.

Impact: a malicious or compromised store registry entry with `../` in the manifest ID can delete or write outside the tweak folder.

Recommended fix: enforce the same safe ID regex used elsewhere before any filesystem use, and assert the resolved target remains inside `TWEAKS_DIR`.

### 7. Codex++ settings injector still has a renderer-wide observer and heavy DOM probe path

`desktop/codex-plusplus/runtime/preload/settings-injector.js:72-76` observes `document.documentElement` and calls `tryInject()` plus `maybeDumpDom()` on every mutation. The injection path performs broad selector scans and layout reads at `desktop/codex-plusplus/runtime/preload/settings-injector.js:386`, `desktop/codex-plusplus/runtime/preload/settings-injector.js:418`, `desktop/codex-plusplus/runtime/preload/settings-injector.js:2427-2438`, and `desktop/codex-plusplus/runtime/preload/settings-injector.js:2507-2515`. Preload logging is sent through `desktop/codex-plusplus/runtime/preload/settings-injector.js:58` and handled in main at `desktop/codex-plusplus/runtime/main.js:2762`.

Impact: normal chat streaming and renderer updates can trigger repeated DOM scans, layout work, and log writes, which can produce UI jank or freezes. This is distinct from the bundled tweak observer fixes already in PR #48.

Recommended fix: replace the renderer-wide observer with a bounded startup/retry path or a narrowly scoped observer that disconnects, and keep DOM dump/log paths off mutation hot paths.

## Medium

### 8. Renderer tweak startup waits on advisory GitHub update checks

The renderer preload waits on `codexpp:list-tweaks` before loading tweaks at `desktop/codex-plusplus/runtime/preload/tweak-host.js:24`. The main handler awaits update checks for every discovered tweak at `desktop/codex-plusplus/runtime/main.js:2627-2628`, and the update-check path starts at `desktop/codex-plusplus/runtime/main.js:2948-2949`.

Impact: offline or slow GitHub requests can delay bundled UI and user tweak loading even though update status is only advisory metadata.

Recommended fix: return discovered tweaks immediately and resolve update metadata asynchronously.

### 9. `waitForElement()` can leak observers forever

`desktop/codex-plusplus/runtime/preload/tweak-host.js:146-162` computes a timeout deadline, but the timeout check only runs inside the `MutationObserver` callback.

Impact: if the target never appears and no mutation occurs after the deadline, the promise never rejects and the observer remains attached.

Recommended fix: use a real timer that disconnects the observer at `timeoutMs`, while the observer only handles early success.

### 10. Tweak source and asset path checks do not resolve symlinks

The runtime exposes tweak source and asset reads at `desktop/codex-plusplus/runtime/main.js:2723` and `desktop/codex-plusplus/runtime/main.js:2741`. Store installation extracts and copies tweak sources at `desktop/codex-plusplus/runtime/main.js:3110-3115`, and the copy filter only skips `.git` and `node_modules` at `desktop/codex-plusplus/runtime/main.js:3227-3230`.

Impact: a reviewed tweak repository can include symlinks that let renderer-side IPC reads escape the intended tweak tree.

Recommended fix: resolve real paths before reads and either reject symlinks during install/copy or enforce resolved-path containment at every read boundary.

### 11. `update-node-repl.ps1` trusts any installed AppX named `OpenAI.Codex`

The updater selects the highest-version local AppX package by name at `desktop/scripts/update-node-repl.ps1:32-35`. It then takes `app/resources/node_repl.exe` from that package at `desktop/scripts/update-node-repl.ps1:81`, only enforcing x64 PE machine later at `desktop/scripts/update-node-repl.ps1:133`. The committed metadata expects the official package identity at `desktop/resources/node_repl.json:3-5`.

Impact: a local or dev package with the same name and a higher version can poison the vendored `node_repl.exe` fallback.

Recommended fix: require the expected package family or publisher before copying the binary, and fail if the installed package identity does not match the metadata contract.

### 12. Browser native runtime verification can accept wrong-arch `.node` files

`desktop/scripts/verify-browser-client-runtime.ts:154-167` accepts runtime metadata based on ABI/platform/arch fields. `desktop/scripts/verify-browser-client-runtime.ts:183-214` also accepts ABI/path-based evidence for `.node` files without reading the PE machine from the matched native binary.

Impact: a renamed x64 or invalid `.node` file can pass verification and fail later in the packaged Windows ARM64 runtime.

Recommended fix: locate the concrete `.node` file selected by metadata/path evidence and validate its PE machine before accepting the runtime.

### 13. CI does not run targeted tests before package and release work

Targeted package/release tests exist in `desktop/package.json:19`. The PR workflow installs dependencies and continues into packaging without running them at `.github/workflows/windows-arm64-pr-build.yml:40-42`, and the release workflow has the same install-only shape at `.github/workflows/windows-arm64-release.yml:40-42`.

Impact: workflow policy and package resource regressions can pass CI even when local targeted tests catch them.

Recommended fix: run the targeted test scripts before packaging in PR and release workflows.

### 14. Manual release recovery docs contradict workflow skip behavior

The recovery docs say manual `main` dispatch rebuilds and republishes at `docs/windows/self-signed-msix-updates.md:43`. The release workflow skips most build and publish steps when `current_commit_release_tag` is present, including `.github/workflows/windows-arm64-release.yml:50`, `.github/workflows/windows-arm64-release.yml:55`, `.github/workflows/windows-arm64-release.yml:104`, `.github/workflows/windows-arm64-release.yml:139`, `.github/workflows/windows-arm64-release.yml:201`, and `.github/workflows/windows-arm64-release.yml:266`.

Impact: manual recovery can no-op when a matching release marker already exists, contrary to the docs.

Recommended fix: either document the current skip behavior or add an explicit force-republish path for manual recovery.

### 15. Same-repo PR branches can move and upload the mutable alpha release before review

The PR workflow triggers on pull requests at `.github/workflows/windows-arm64-pr-build.yml:4`. Same-repo PRs enter the publish job through `.github/workflows/windows-arm64-pr-build.yml:91-96`, receive `GH_TOKEN` at `.github/workflows/windows-arm64-pr-build.yml:98`, and can move/edit/upload the `codex-app-alpha` release at `.github/workflows/windows-arm64-pr-build.yml:144-163`.

Impact: same-repo branch authors can affect the public alpha release channel before review. The fork guard helps external contributors, but it does not protect same-repo branches.

Recommended fix: gate alpha publishing behind trusted branches, maintainers, labels, or a separate manually approved workflow.

### 16. Full npm audit reports release-toolchain vulnerabilities

`npm audit --json` reported 32 total advisories: low 6, moderate 2, high 24, critical 0. A notable cluster is in release tooling around `@electron/node-gyp` and `tar`, with lockfile evidence at `desktop/package-lock.json:165`, `desktop/package-lock.json:177`, `desktop/package-lock.json:910-925`, and `desktop/package-lock.json:1271`.

Impact: the packaging and native rebuild path carries known high-severity dependency risk.

Recommended fix: update or isolate the affected release-toolchain dependencies and re-run audit after the package lock changes.

## Low

### 17. Generated PFX base64 secret is not ignored outside ignored output directories

`packaging/windows/New-SelfSignedCodexSigningCertificate.ps1:41-43` writes both a `.pfx` and `.pfx.base64.txt` output. `.gitignore:42` ignores `*.pfx`, but there is no matching ignore for `*.pfx.base64.txt`.

Impact: using an alternate repo-local output directory can accidentally stage base64 private key material.

Recommended fix: add an ignore rule for `*.pfx.base64.txt`.

### 18. README points to a non-existent source script path

`README.md:75` documents `desktop/scripts/refresh-recovered-from-dmg.mjs`, but the source file is `desktop/scripts/refresh-recovered-from-dmg.ts`; npm uses the compiled `.cache/scripts/refresh-recovered-from-dmg.js`.

Impact: contributors following the README hit a missing source path.

Recommended fix: update the README to name the TypeScript source or the npm script entrypoint.

### 19. Agent domain docs still describe a generic `/src/` layout

`docs/agents/domain.md:18` lists `/src/` in the repo layout, but this repo is organized around `desktop/`, `packaging/`, and `docs/windows/`.

Impact: future agents get misleading first-pass navigation guidance.

Recommended fix: replace the generic layout with the actual repo structure.

## Review Scope

This document captures the whole-repo review performed against PR #48 on branch `feature/local-log-cleanup-helper`. The review covered Windows packaging and release workflows, desktop scripts and automation, Codex++ integration/runtime/preload/tweaks, security and supply-chain paths, tests, docs, and repo hygiene.

## Verification Already Run

- `npm run test:windows-package-resources` passed.
- `npm run test:resolve-codex-releases` passed.
- `npm run test:patch-windows-self-signed-bundle` passed.
- `npm run test:verify-browser-client-runtime` passed.
- `cargo test` passed with 0 tests.
- `npm audit --json` returned nonzero with low 6, moderate 2, high 24, critical 0, total 32.

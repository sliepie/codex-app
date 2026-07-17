---
name: store-package-update
description: "Refresh Microsoft Store-vendored Codex helpers or their Windows ARM64 provenance and package-resource policy."
---

# Store Helper Refresh

## 1. Orient

1. Read `AGENTS.md`, `CONTEXT.md`, `docs/executable-inventory.md`, `docs/adr/0001-vendor-official-store-helper-exceptions.md`, `desktop/package.json`, `desktop/scripts/update-node-repl.ps1`, `desktop/scripts/resource-binary-exceptions.ts`, `desktop/scripts/windows-package-resources.test.mjs`, the validator below, and the three helper metadata files under `desktop/resources/`.
2. Run `git status --short --branch`. Work from a non-`main` feature branch and continue an existing Store-helper PR when one exists.
3. Run authenticated `gh pr view --json title,url,headRefName` outside the sandbox. Treat a no-PR result as no existing Store-helper PR.

Completion criterion: the active branch and PR, when present, describe the Store helper refresh; a branch without a PR has been identified; and the source, staging, policy, test, and metadata seams have been inspected.

## 2. Preserve the Store boundary

The official Microsoft Store package is the provenance source for these vendored inputs only:

| Helper | Official Store source | Tracked input | Forge package destination | Required PE architecture |
| --- | --- | --- | --- | --- |
| Node REPL | `app/resources/cua_node/bin/node_repl.exe` | `desktop/resources/cua_node/bin/node_repl.exe` | `resources/cua_node/bin/node_repl.exe` | ARM64 |
| Chrome extension host | `app/resources/plugins/openai-bundled/plugins/chrome/extension-host/windows/arm64/extension-host.exe` | `desktop/resources/extension-host.exe` | `resources/plugins/openai-bundled/plugins/chrome/extension-host/windows/arm64/extension-host.exe` | ARM64 |
| Computer Use | `app/resources/cua_node/bin/node_modules/@oai/sky/bin/windows/codex-computer-use.exe` | `desktop/resources/codex-computer-use.exe` | `resources/plugins/openai-bundled/plugins/computer-use/node_modules/@oai/sky/bin/windows/codex-computer-use.exe` | x64 exception |

Accept helper provenance only from the package that `desktop/scripts/update-node-repl.ps1` resolves after installing or upgrading Microsoft Store product `9PLM9XGG6VKS`, package name `OpenAI.Codex`, and package family `OpenAI.Codex_2p2nqsd0c76g0`. Other packages, release assets, browsers, and filesystem copies do not establish Store-helper provenance.

Electron Forge supplies the ARM64 application host. The Store/Owl shell remains parked outside the package plan; this refresh transfers no host executable or shell payload.

Completion criterion: every planned Store-sourced file maps to one table row, and the Electron host and parked Store/Owl shell are outside the change scope.

## 3. Refresh one package set

1. Record whether the official Store package family is already installed with `Get-AppxPackage -Name OpenAI.Codex`.
2. From the repository root, run `npm --prefix desktop run update:store-package`.
3. Inspect the resulting `.exe` files and adjacent `.json` metadata. The updater must resolve one official package, update all three helper pairs, and record the package identity, version, source-relative path, architecture, and SHA-256.
4. When the package was absent before the run, confirm the updater removed its temporary Store installation. Keep a pre-existing installation installed.

Completion criterion: the three helper binaries and metadata files are internally consistent with one official Store package, and the Store installation state matches its pre-refresh state.

## 4. Apply policy changes at their seam

1. Update `docs/executable-inventory.md` on every refresh with the date, full Store package identity, and helper SHA-256 values from the metadata.
2. Treat package identity, source path, staging path, architecture, and removal condition as the helper contract. Change `CONTEXT.md`, `docs/adr/0001-vendor-official-store-helper-exceptions.md`, `desktop/scripts/resource-binary-exceptions.ts`, and the focused cases in `desktop/scripts/windows-package-resources.test.mjs` only when that contract changes.
3. Confirm `node_repl.exe` and `extension-host.exe` are ARM64; confirm `codex-computer-use.exe` is the named x64 exception.

Completion criterion: the inventory snapshot matches all helper metadata, and every changed helper-contract field is represented consistently in policy documentation, the resource-binary exception policy, and focused tests.

## 5. Validate the package boundary

1. From the repository root, run `npm --prefix desktop run build:scripts`, then run `node --test --test-name-pattern="Store binary updater|Store package updater|Windows ARM64 Resource binary policy|generates Windows bundled plugin resources|does not track Store Owl shell payload metadata" desktop/scripts/windows-package-resources.test.mjs`.
2. Choose a Windows ARM64 package root that represents this change: reuse a matching built package, or create one with `npm --prefix desktop run package:win:arm64`. Run `.agents/skills/store-package-update/scripts/validate-helper-refresh.ps1 -PackageRoot <package-root>` from the repository root. The validator checks helper metadata, PE architectures, packaged provenance, and `git diff --check`.

Completion criterion: focused tests pass; the validator accepts every helper; and the package contains an ARM64 Electron host, the two staged ARM64 helpers, and only the named x64 exceptions.

## 6. Publish a narrow refresh

Review the diff before committing. A routine refresh contains helper binaries whose bytes changed, metadata for all three helpers, and the current inventory snapshot; an explicitly requested skill edit may accompany it. Include contract-policy documentation and test changes only when the helper contract changed. Do not create an empty commit. Push to the active Store-helper PR branch, or create a PR from the feature branch when none exists. Use repo-relative paths in PR text.

Completion criterion: the PR describes a Store helper refresh, contains no machine-local paths, and its commits stay within the validated scope.

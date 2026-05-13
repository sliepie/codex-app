import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptsRoot = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.dirname(scriptsRoot);
const repoRoot = path.dirname(desktopRoot);
const require = createRequire(import.meta.url);
const {
  collectNativeNodeModuleTargets,
  hasArm64RuntimePayload,
  syncCodexPlusPlusRuntimeAssets,
  syncBundledPluginResources,
} = require(
  path.join(desktopRoot, ".cache", "scripts", "hydrate-codex-app.js"),
);

function writeFixture(filePath, source) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, source, "utf8");
}

function writePeFixture(filePath, machine) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const bytes = Buffer.alloc(0x100);
  bytes[0] = 0x4d;
  bytes[1] = 0x5a;
  bytes.writeInt32LE(0x80, 0x3c);
  bytes.writeUInt16LE(machine, 0x84);
  fs.writeFileSync(filePath, bytes);
}

function writeMachOFixture(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, Buffer.from([0xcf, 0xfa, 0xed, 0xfe, 0x0c, 0x00, 0x00, 0x01]));
}

function createAppResourcesFixture() {
  const appResourcesRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-app-resources-"));
  const bundledRoot = path.join(appResourcesRoot, "plugins", "openai-bundled");

  writeFixture(
    path.join(bundledRoot, ".agents", "plugins", "marketplace.json"),
    `${JSON.stringify(
      {
        name: "openai-bundled",
        interface: {
          displayName: "OpenAI Bundled",
        },
        plugins: [
          {
            name: "browser-use",
            source: {
              source: "local",
              path: "./plugins/browser-use",
            },
            policy: {
              installation: "AVAILABLE",
              authentication: "ON_INSTALL",
            },
            category: "Engineering",
          },
          {
            name: "computer-use",
            source: {
              source: "local",
              path: "./plugins/computer-use",
            },
            policy: {
              installation: "AVAILABLE",
              authentication: "ON_INSTALL",
            },
            category: "Productivity",
          },
          {
            name: "latex-tectonic",
            source: {
              source: "local",
              path: "./plugins/latex-tectonic",
            },
            policy: {
              installation: "AVAILABLE",
              authentication: "ON_INSTALL",
            },
            category: "Research",
          },
        ],
      },
      null,
      2,
    )}\n`,
  );

  writeFixture(
    path.join(bundledRoot, "plugins", "browser-use", ".codex-plugin", "plugin.json"),
    `${JSON.stringify({ name: "browser-use", version: "0.1.0-alpha1" }, null, 2)}\n`,
  );
  writeFixture(
    path.join(bundledRoot, "plugins", "browser-use", "scripts", "browser-client.mjs"),
    "export const browserClient = true;\n",
  );
  writeFixture(
    path.join(bundledRoot, "plugins", "browser-use", "skills", "browser", "SKILL.md"),
    "# Browser\n",
  );
  writeFixture(
    path.join(bundledRoot, "plugins", "computer-use", ".codex-plugin", "plugin.json"),
    `${JSON.stringify({ name: "computer-use", version: "0.1.0-alpha1" }, null, 2)}\n`,
  );
  writeFixture(
    path.join(bundledRoot, "plugins", "computer-use", "skills", "computer", "SKILL.md"),
    "# Computer\n",
  );
  writeFixture(
    path.join(bundledRoot, "plugins", "latex-tectonic", ".codex-plugin", "plugin.json"),
    `${JSON.stringify({ name: "latex-tectonic" }, null, 2)}\n`,
  );

  return appResourcesRoot;
}

test("generates Windows bundled plugin resources except macOS-only plugins", () => {
  const appResourcesRoot = createAppResourcesFixture();
  const destinationPluginsRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-plugin-output-"));

  syncBundledPluginResources(appResourcesRoot, destinationPluginsRoot);

  const marketplace = JSON.parse(
    fs.readFileSync(
      path.join(
        destinationPluginsRoot,
        "openai-bundled/.agents/plugins/marketplace.json",
      ),
      "utf8",
    ),
  );
  assert.deepEqual(
    marketplace.plugins.map((plugin) => plugin.name),
    ["browser-use"],
  );
  assert.equal(marketplace.plugins[0].source.path, "./plugins/browser-use");

  assert.equal(
    fs.existsSync(
      path.join(
        destinationPluginsRoot,
        "openai-bundled/plugins/browser-use/scripts/browser-client.mjs",
      ),
    ),
    true,
  );
  assert.equal(
    fs.existsSync(path.join(destinationPluginsRoot, "openai-bundled/plugins/computer-use")),
    false,
  );
  assert.equal(
    fs.existsSync(path.join(destinationPluginsRoot, "openai-bundled/plugins/latex-tectonic")),
    false,
  );
});

test("syncs Codex++ runtime assets from a GitHub release source tree", () => {
  const sourceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-plusplus-source-"));
  const destinationRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-plusplus-output-"));
  writeFixture(
    path.join(sourceRoot, "packages", "installer", "assets", "runtime", "main.js"),
    "module.exports = {};\n",
  );
  writeFixture(
    path.join(sourceRoot, "packages", "installer", "assets", "runtime", "preload.js"),
    "module.exports = {};\n",
  );
  writeFixture(path.join(sourceRoot, "LICENSE"), "MIT\n");

  syncCodexPlusPlusRuntimeAssets(
    sourceRoot,
    {
      tag_name: "v0.1.7",
      html_url: "https://github.com/b-nnett/codex-plusplus/releases/tag/v0.1.7",
      zipball_url: "https://api.github.com/repos/b-nnett/codex-plusplus/zipball/v0.1.7",
      published_at: "2026-05-12T14:08:09Z",
    },
    destinationRoot,
  );

  assert.equal(
    fs.readFileSync(path.join(destinationRoot, "runtime", "main.js"), "utf8"),
    "module.exports = {};\n",
  );
  assert.equal(fs.readFileSync(path.join(destinationRoot, "LICENSE"), "utf8"), "MIT\n");
  const release = JSON.parse(fs.readFileSync(path.join(destinationRoot, "release.json"), "utf8"));
  assert.equal(release.repo, "b-nnett/codex-plusplus");
  assert.equal(release.tagName, "v0.1.7");
});

test("discovers native modules copied inside bundled plugin resources", () => {
  const appResourcesRoot = createAppResourcesFixture();
  const destinationPluginsRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-plugin-output-"));
  writeFixture(
    path.join(
      appResourcesRoot,
      "plugins",
      "openai-bundled",
      "plugins",
      "browser-use",
      "scripts",
      "node_modules",
      "classic-level",
      "package.json",
    ),
    `${JSON.stringify({ name: "classic-level", version: "3.0.0" }, null, 2)}\n`,
  );
  writeFixture(
    path.join(
      appResourcesRoot,
      "plugins",
      "openai-bundled",
      "plugins",
      "browser-use",
      "scripts",
      "node_modules",
      "classic-level",
      "binding.gyp",
    ),
    "{}\n",
  );

  syncBundledPluginResources(appResourcesRoot, destinationPluginsRoot);

  const targets = collectNativeNodeModuleTargets(
    fs.mkdtempSync(path.join(os.tmpdir(), "codex-recovered-")),
    destinationPluginsRoot,
  );

  assert.equal(targets.length, 1);
  assert.equal(targets[0].runtime, "node");
  assert.deepEqual(targets[0].nativeModules, [{ name: "classic-level", version: "3.0.0" }]);
  assert.equal(
    path.relative(destinationPluginsRoot, targets[0].nodeModulesRoot).replaceAll(path.sep, "/"),
    "openai-bundled/plugins/browser-use/scripts/node_modules",
  );
});

test("foreign-only native prebuilds are not ready for Windows ARM64", () => {
  const packageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-native-package-"));
  writePeFixture(path.join(packageRoot, "prebuilds", "win32-x64", "classic-level.node"), 0x8664);

  assert.equal(hasArm64RuntimePayload(packageRoot), false);

  writePeFixture(path.join(packageRoot, "build", "Release", "classic-level.node"), 0xaa64);

  assert.equal(hasArm64RuntimePayload(packageRoot), true);
});

test("Mach-O native payloads are not ready for Windows ARM64", () => {
  const packageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-native-package-"));
  writeMachOFixture(path.join(packageRoot, "build", "Release", "better_sqlite3.node"));

  assert.equal(hasArm64RuntimePayload(packageRoot), false);
});

test("fails when the upstream bundle is missing required browser-use", () => {
  const appResourcesRoot = createAppResourcesFixture();
  const marketplacePath = path.join(
    appResourcesRoot,
    "plugins",
    "openai-bundled",
    ".agents",
    "plugins",
    "marketplace.json",
  );
  const marketplace = JSON.parse(fs.readFileSync(marketplacePath, "utf8"));
  marketplace.plugins = marketplace.plugins.filter((plugin) => plugin.name !== "browser-use");
  fs.writeFileSync(marketplacePath, `${JSON.stringify(marketplace, null, 2)}\n`, "utf8");

  assert.throws(
    () =>
      syncBundledPluginResources(
        appResourcesRoot,
        fs.mkdtempSync(path.join(os.tmpdir(), "codex-plugin-output-")),
      ),
    /does not list required plugin browser-use/,
  );
});

test("includes generated plugin resources and Codex++ integration in the Windows package", () => {
  const config = require(path.join(desktopRoot, "forge.config.js"));
  assert.ok(config.packagerConfig.extraResource.includes("resources/plugins"));
  assert.ok(config.packagerConfig.extraResource.includes("resources/native"));
  assert.equal(config.packagerConfig.ignore("/codex-plusplus/loader.cjs"), false);
  assert.equal(config.packagerConfig.ignore("/codex-plusplus/runtime/main.js"), false);
  assert.equal(
    config.packagerConfig.ignore("/codex-plusplus/tweaks/codex-app-ui-overrides/manifest.json"),
    false,
  );

  const packageJson = JSON.parse(
    fs.readFileSync(path.join(desktopRoot, "package.json"), "utf8"),
  );
  assert.equal(packageJson.main, "codex-plusplus/loader.cjs");
});

test("bundles the app-owned Codex++ UI tweak without keyboard shortcut tweaks", () => {
  const tweakRoot = path.join(desktopRoot, "codex-plusplus", "tweaks", "codex-app-ui-overrides");
  const manifest = JSON.parse(fs.readFileSync(path.join(tweakRoot, "manifest.json"), "utf8"));
  assert.equal(manifest.id, "app.sliepie.codex.ui-overrides");
  assert.equal(manifest.scope, "renderer");
  assert.notEqual(manifest.id.includes("keyboard"), true);

  const source = fs.readFileSync(path.join(tweakRoot, "index.js"), "utf8");
  assert.doesNotThrow(() => {
    const module = { exports: {} };
    const exports = module.exports;
    const fn = new Function("module", "exports", "console", source);
    fn(module, exports, console);
    assert.equal(typeof module.exports.start, "function");
    assert.equal(typeof module.exports.stop, "function");
  });
});

test("includes installed tslib for recovered main-process bundles", () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(desktopRoot, "package.json"), "utf8"),
  );
  assert.equal(packageJson.dependencies?.tslib, "^2.8.1");

  const config = require(path.join(desktopRoot, "forge.config.js"));
  assert.equal(config.packagerConfig.ignore("/node_modules/tslib/package.json"), false);
  assert.equal(config.packagerConfig.ignore("/node_modules/tslib/tslib.js"), false);
});

function expandScriptCommands(scriptName, scripts, seen = new Set()) {
  assert.ok(scripts[scriptName], `Missing npm script ${scriptName}`);
  assert.ok(!seen.has(scriptName), `Recursive npm script ${scriptName}`);

  seen.add(scriptName);
  return scripts[scriptName].split("&&").flatMap((rawCommand) => {
    const command = rawCommand.trim();
    const npmRunMatch = command.match(/^npm run ([^ ]+)(?:\s|$)/);
    if (!npmRunMatch) {
      return [command];
    }

    return [
      command,
      ...expandScriptCommands(npmRunMatch[1], scripts, new Set(seen)),
    ];
  });
}

function assertUpdaterBuildsBeforeForge(scriptName, scripts) {
  const commands = expandScriptCommands(scriptName, scripts);
  const updaterIndex = commands.findIndex((command) =>
    command.includes("build:windows-oai-update-checker -- -Architecture arm64"),
  );
  const forgeIndex = commands.findIndex((command) => command.startsWith("electron-forge "));

  assert.notEqual(updaterIndex, -1);
  assert.notEqual(forgeIndex, -1);
  assert.ok(updaterIndex < forgeIndex);
}

function assertHydrateAppRunsBeforeForge(scriptName, scripts) {
  const commands = expandScriptCommands(scriptName, scripts);
  const hydrateIndex = commands.findIndex((command) => command.includes("hydrate:app:compiled"));
  const forgeIndex = commands.findIndex((command) => command.startsWith("electron-forge "));

  assert.notEqual(hydrateIndex, -1);
  assert.notEqual(forgeIndex, -1);
  assert.ok(hydrateIndex < forgeIndex);
}

test("builds the replacement Windows updater before packaging", () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(desktopRoot, "package.json"), "utf8"),
  );
  assertUpdaterBuildsBeforeForge("package:win:arm64", packageJson.scripts);
  assertUpdaterBuildsBeforeForge("make:win:arm64", packageJson.scripts);
  assertUpdaterBuildsBeforeForge("make:win:arm64:ci", packageJson.scripts);
});

test("hydrates the app payload before packaging", () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(desktopRoot, "package.json"), "utf8"),
  );
  assertHydrateAppRunsBeforeForge("package:win:arm64", packageJson.scripts);
  assertHydrateAppRunsBeforeForge("make:win:arm64", packageJson.scripts);
  assertHydrateAppRunsBeforeForge("make:win:arm64:ci", packageJson.scripts);
});

test("PR builds publish the ZIP to a mutable alpha release", () => {
  const workflowSource = fs.readFileSync(
    path.join(repoRoot, ".github", "workflows", "windows-arm64-pr-build.yml"),
    "utf8",
  );

  assert.match(workflowSource, /permissions:\r?\n  contents: read/);
  assert.match(workflowSource, /name: codex-app-windows-arm64-pr/);
  assert.match(workflowSource, /publish-alpha-release:/);
  assert.match(
    workflowSource,
    /if: github\.event\.pull_request\.head\.repo\.full_name == github\.repository/,
  );
  assert.match(workflowSource, /permissions:\r?\n      contents: write/);
  assert.match(workflowSource, /ALPHA_RELEASE_TAG: codex-app-alpha/);
  assert.match(workflowSource, /actions\/download-artifact@37930b1c2abaa49bbe596cd826c3c89aef350131/);
  assert.match(workflowSource, /gh release create \$tag[\s\S]*--prerelease --latest=false/);
  assert.match(workflowSource, /gh release edit \$tag[\s\S]*--prerelease --latest=false/);
  assert.match(workflowSource, /gh release upload \$tag \$zip\.FullName[\s\S]*--clobber/);
});

test("keys native updater cache by builder script and Rust crate sources", () => {
  const cacheKeyInputs = [
    "desktop/scripts/build-windows-oai-update-checker.ps1",
    "desktop/native/windows-oai-update-checker/Cargo.lock",
    "desktop/native/windows-oai-update-checker/Cargo.toml",
    "desktop/native/windows-oai-update-checker/src/**",
  ];

  for (const workflowName of [
    "windows-arm64-pr-build.yml",
    "windows-arm64-release.yml",
  ]) {
    const workflowSource = fs.readFileSync(
      path.join(repoRoot, ".github", "workflows", workflowName),
      "utf8",
    );

    for (const cacheKeyInput of cacheKeyInputs) {
      assert.ok(
        workflowSource.includes(cacheKeyInput),
        `${workflowName} cache key should include ${cacheKeyInput}`,
      );
    }
  }
});

test("native updater build stamp covers the builder script", () => {
  const source = fs.readFileSync(
    path.join(desktopRoot, "scripts", "build-windows-oai-update-checker.ps1"),
    "utf8",
  );

  assert.match(source, /BuildScriptPath/);
  assert.match(source, /\$cacheStampVersion = 2/);
  assert.match(source, /Assert-SuccessfulNativeCommand -Description "rustup target add \$target"/);
  assert.match(source, /Assert-SuccessfulNativeCommand -Description "cargo build for \$target"/);
});

test("self-signed appinstaller updates immediately on launch", () => {
  const outputPath = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "codex-appinstaller-")),
    "Codex.appinstaller",
  );

  execFileSync(
    process.execPath,
    [
      path.join(desktopRoot, ".cache", "scripts", "write-self-signed-appinstaller.js"),
      "--package-name",
      "OpenAI.Codex",
      "--publisher",
      "CN=OpenAI",
      "--version",
      "26.506.21252.0",
      "--architecture",
      "arm64",
      "--package-uri",
      "https://example.invalid/Codex.msix",
      "--appinstaller-uri",
      "https://example.invalid/Codex.appinstaller",
      "--output",
      outputPath,
    ],
    { stdio: "pipe" },
  );

  const appInstaller = fs.readFileSync(outputPath, "utf8");
  assert.match(
    appInstaller,
    /<OnLaunch HoursBetweenUpdateChecks="0" ShowPrompt="false" UpdateBlocksActivation="true" \/>/,
  );
});

test("pins packaged Windows updater metadata to the prod OAI identity", () => {
  const source = fs.readFileSync(path.join(desktopRoot, "forge.config.js"), "utf8");
  assert.match(source, /const codexWindowsProdOaiPackageIdentity = 'OpenAI\.Codex';/);
  assert.match(
    source,
    /packageJson\.codexWindowsPackageIdentity = codexWindowsProdOaiPackageIdentity;/,
  );
});

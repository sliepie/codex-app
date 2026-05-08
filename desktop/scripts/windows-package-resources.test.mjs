import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptsRoot = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.dirname(scriptsRoot);
const require = createRequire(import.meta.url);
const {
  collectNativeNodeModuleTargets,
  hasArm64RuntimePayload,
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

test("includes generated plugin resources in the Windows package", () => {
  const config = require(path.join(desktopRoot, "forge.config.js"));
  assert.ok(config.packagerConfig.extraResource.includes("resources/plugins"));
  assert.ok(config.packagerConfig.extraResource.includes("resources/native"));
});

test("builds the replacement Windows updater before packaging", () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(desktopRoot, "package.json"), "utf8"),
  );
  assert.match(
    packageJson.scripts["package:win:arm64"],
    /build:windows-oai-update-checker -- -Architecture arm64/,
  );
  assert.match(
    packageJson.scripts["make:win:arm64"],
    /build:windows-oai-update-checker -- -Architecture arm64/,
  );
  assert.match(
    packageJson.scripts["make:win:arm64:ci"],
    /build:windows-oai-update-checker -- -Architecture arm64/,
  );
});

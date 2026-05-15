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
const {
  patchElectronCppgcHeapForMsvcHeader,
  patchBetterSqlite3ForV8ExternalPointerApi,
  prepareElectronHeadersForNativeRebuild,
} = require(
  path.join(desktopRoot, ".cache", "scripts", "patch-better-sqlite3-electron.js"),
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
            name: "browser",
            source: {
              source: "local",
              path: "./plugins/browser",
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
            name: "chrome",
            source: {
              source: "local",
              path: "./plugins/chrome",
            },
            policy: {
              installation: "AVAILABLE",
              authentication: "ON_INSTALL",
            },
            category: "Productivity",
          },
          {
            name: "latex",
            source: {
              source: "local",
              path: "./plugins/latex",
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
    path.join(bundledRoot, "plugins", "browser", ".codex-plugin", "plugin.json"),
    `${JSON.stringify({ name: "browser", version: "0.1.0-alpha2" }, null, 2)}\n`,
  );
  writeFixture(
    path.join(bundledRoot, "plugins", "browser", "scripts", "browser-client.mjs"),
    "export const browserClient = true;\n",
  );
  writeFixture(
    path.join(bundledRoot, "plugins", "browser", "skills", "browser", "SKILL.md"),
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
    path.join(bundledRoot, "plugins", "chrome", ".codex-plugin", "plugin.json"),
    `${JSON.stringify({ name: "chrome", version: "0.1.0-alpha1" }, null, 2)}\n`,
  );
  writeFixture(
    path.join(bundledRoot, "plugins", "chrome", "skills", "chrome", "SKILL.md"),
    "# Chrome\n",
  );
  writeFixture(
    path.join(bundledRoot, "plugins", "latex", ".codex-plugin", "plugin.json"),
    `${JSON.stringify({ name: "latex" }, null, 2)}\n`,
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
    ["browser"],
  );
  assert.equal(marketplace.plugins[0].source.path, "./plugins/browser");

  assert.equal(
    fs.existsSync(
      path.join(
        destinationPluginsRoot,
        "openai-bundled/plugins/browser/scripts/browser-client.mjs",
      ),
    ),
    true,
  );
  assert.equal(
    fs.existsSync(path.join(destinationPluginsRoot, "openai-bundled/plugins/computer-use")),
    false,
  );
  assert.equal(
    fs.existsSync(path.join(destinationPluginsRoot, "openai-bundled/plugins/chrome")),
    false,
  );
  assert.equal(
    fs.existsSync(path.join(destinationPluginsRoot, "openai-bundled/plugins/latex")),
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

test("discovers native modules copied inside every non-excluded bundled plugin resource", () => {
  const appResourcesRoot = createAppResourcesFixture();
  const destinationPluginsRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-plugin-output-"));
  const marketplacePath = path.join(
    appResourcesRoot,
    "plugins",
    "openai-bundled",
    ".agents",
    "plugins",
    "marketplace.json",
  );
  const marketplace = JSON.parse(fs.readFileSync(marketplacePath, "utf8"));
  marketplace.plugins.push({
    name: "native-helper",
    source: {
      source: "local",
      path: "./plugins/native-helper",
    },
    policy: {
      installation: "AVAILABLE",
      authentication: "ON_INSTALL",
    },
    category: "Engineering",
  });
  fs.writeFileSync(marketplacePath, `${JSON.stringify(marketplace, null, 2)}\n`, "utf8");

  writeFixture(
    path.join(
      appResourcesRoot,
      "plugins",
      "openai-bundled",
      "plugins",
      "native-helper",
      ".codex-plugin",
      "plugin.json",
    ),
    `${JSON.stringify({ name: "native-helper", version: "0.1.0-alpha1" }, null, 2)}\n`,
  );
  writeFixture(
    path.join(
      appResourcesRoot,
      "plugins",
      "openai-bundled",
      "plugins",
      "browser",
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
      "browser",
      "scripts",
      "node_modules",
      "classic-level",
      "prebuilds",
      "darwin-arm64",
      "classic-level.node",
    ),
    "native payload\n",
  );
  writeFixture(
    path.join(
      appResourcesRoot,
      "plugins",
      "openai-bundled",
      "plugins",
      "native-helper",
      "scripts",
      "node_modules",
      "native-helper-level",
      "package.json",
    ),
    `${JSON.stringify({ name: "native-helper-level", version: "1.2.3" }, null, 2)}\n`,
  );
  writeFixture(
    path.join(
      appResourcesRoot,
      "plugins",
      "openai-bundled",
      "plugins",
      "native-helper",
      "scripts",
      "node_modules",
      "native-helper-level",
      "prebuilds",
      "darwin-arm64",
      "native-helper-level.node",
    ),
    "native payload\n",
  );

  syncBundledPluginResources(appResourcesRoot, destinationPluginsRoot);

  const targets = collectNativeNodeModuleTargets(
    fs.mkdtempSync(path.join(os.tmpdir(), "codex-recovered-")),
    destinationPluginsRoot,
  );
  const targetsByPath = new Map(
    targets.map((target) => [
      path.relative(destinationPluginsRoot, target.nodeModulesRoot).replaceAll(path.sep, "/"),
      target,
    ]),
  );

  assert.equal(targets.length, 2);
  assert.equal(
    targetsByPath.get("openai-bundled/plugins/browser/scripts/node_modules")?.runtime,
    "node",
  );
  assert.deepEqual(
    targetsByPath.get("openai-bundled/plugins/browser/scripts/node_modules")?.nativeModules,
    [{ name: "classic-level", version: "3.0.0" }],
  );
  assert.equal(
    targetsByPath.get("openai-bundled/plugins/native-helper/scripts/node_modules")?.runtime,
    "node",
  );
  assert.deepEqual(
    targetsByPath.get("openai-bundled/plugins/native-helper/scripts/node_modules")?.nativeModules,
    [{ name: "native-helper-level", version: "1.2.3" }],
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

function writeBetterSqlite3SourceFixture(nodeModulesRoot) {
  const moduleRoot = path.join(nodeModulesRoot, "better-sqlite3");
  writeFixture(
    path.join(moduleRoot, "src", "better_sqlite3.cpp"),
    `void init(v8::Isolate* isolate, Addon* addon) {
\tv8::Local<v8::External> data = v8::External::New(isolate, addon);
}
`,
  );
  writeFixture(
    path.join(moduleRoot, "src", "util", "macros.cpp"),
    `#define EasyIsolate v8::Isolate* isolate = v8::Isolate::GetCurrent()
#define OnlyIsolate info.GetIsolate()
#define OnlyContext isolate->GetCurrentContext()
#define OnlyAddon static_cast<Addon*>(info.Data().As<v8::External>()->Value())
`,
  );
  writeFixture(
    path.join(moduleRoot, "src", "util", "helpers.cpp"),
    `void SetPrototypeGetter() {
\trecv->InstanceTemplate()->SetNativeDataProperty(
\t\tInternalizedFromLatin1(isolate, name),
\t\tfunc,
\t\t0,
\t\tdata
\t);
}
`,
  );
}

test("patches better-sqlite3 source for Electron 42 rebuilds", () => {
  const nodeModulesRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-native-modules-"));
  writeBetterSqlite3SourceFixture(nodeModulesRoot);

  patchBetterSqlite3ForV8ExternalPointerApi(nodeModulesRoot, "42.0.1");
  patchBetterSqlite3ForV8ExternalPointerApi(nodeModulesRoot, "42.0.1");

  assert.match(
    fs.readFileSync(
      path.join(nodeModulesRoot, "better-sqlite3", "src", "better_sqlite3.cpp"),
      "utf8",
    ),
    /BETTER_SQLITE3_EXTERNAL_NEW\(isolate, addon\)/,
  );
  assert.match(
    fs.readFileSync(
      path.join(nodeModulesRoot, "better-sqlite3", "src", "util", "macros.cpp"),
      "utf8",
    ),
    /BETTER_SQLITE3_EXTERNAL_POINTER_TAG/,
  );
  assert.match(
    fs.readFileSync(
      path.join(nodeModulesRoot, "better-sqlite3", "src", "util", "macros.cpp"),
      "utf8",
    ),
    /BETTER_SQLITE3_EXTERNAL_VALUE\(info\.Data\(\)\.As<v8::External>\(\)\)/,
  );
  assert.match(
    fs.readFileSync(
      path.join(nodeModulesRoot, "better-sqlite3", "src", "util", "helpers.cpp"),
      "utf8",
    ),
    /\t\tnullptr,/,
  );
});

test("leaves better-sqlite3 source unchanged before Electron 42", () => {
  const nodeModulesRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-native-modules-"));
  writeBetterSqlite3SourceFixture(nodeModulesRoot);

  patchBetterSqlite3ForV8ExternalPointerApi(nodeModulesRoot, "41.2.0");

  assert.match(
    fs.readFileSync(
      path.join(nodeModulesRoot, "better-sqlite3", "src", "better_sqlite3.cpp"),
      "utf8",
    ),
    /v8::External::New\(isolate, addon\)/,
  );
  assert.doesNotMatch(
    fs.readFileSync(
      path.join(nodeModulesRoot, "better-sqlite3", "src", "util", "macros.cpp"),
      "utf8",
    ),
    /BETTER_SQLITE3_EXTERNAL_POINTER_TAG/,
  );
});

test("patches Electron cppgc heap header for MSVC rebuilds", () => {
  const headerPath = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "codex-electron-headers-")),
    "include",
    "node",
    "cppgc",
    "heap.h",
  );
  writeFixture(
    headerPath,
    `#include "v8config.h"  // NOLINT(build/include_directory)

namespace cppgc {
class StackStartMarker {
 public:
  StackStartMarker() : stack_start_(__builtin_frame_address(0)) {}
};
}
`,
  );

  patchElectronCppgcHeapForMsvcHeader(headerPath);
  patchElectronCppgcHeapForMsvcHeader(headerPath);

  const source = fs.readFileSync(headerPath, "utf8");
  assert.match(source, /#include <intrin\.h>/);
  assert.match(source, /#pragma intrinsic\(_AddressOfReturnAddress\)/);
  assert.match(source, /StackStartMarker\(\) : stack_start_\(_AddressOfReturnAddress\(\)\) \{\}/);
  assert.equal(source.match(/#include <intrin\.h>/g)?.length, 1);
});

test("exports generic Electron header preparation separately from better-sqlite3 patching", () => {
  assert.equal(typeof prepareElectronHeadersForNativeRebuild, "function");

  const hydrateSource = fs.readFileSync(
    path.join(desktopRoot, "scripts", "hydrate-codex-app.ts"),
    "utf8",
  );
  assert.match(
    hydrateSource,
    /prepareElectronHeadersForNativeRebuild\(\s*desktopRoot,\s*runtimeVersion,\s*targetRuntimeArch,\s*\) \?\? process\.env/s,
  );
  assert.match(hydrateSource, /prepareBetterSqlite3ElectronRebuild\({\s*electronVersion: runtimeVersion,/s);
});

test("allows the upstream bundle to omit the browser plugin", () => {
  const appResourcesRoot = createAppResourcesFixture();
  const destinationPluginsRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-plugin-output-"));
  const marketplacePath = path.join(
    appResourcesRoot,
    "plugins",
    "openai-bundled",
    ".agents",
    "plugins",
    "marketplace.json",
  );
  const marketplace = JSON.parse(fs.readFileSync(marketplacePath, "utf8"));
  marketplace.plugins = marketplace.plugins.filter((plugin) => plugin.name !== "browser");
  fs.writeFileSync(marketplacePath, `${JSON.stringify(marketplace, null, 2)}\n`, "utf8");

  syncBundledPluginResources(appResourcesRoot, destinationPluginsRoot);

  const destinationMarketplace = JSON.parse(
    fs.readFileSync(
      path.join(
        destinationPluginsRoot,
        "openai-bundled",
        ".agents",
        "plugins",
        "marketplace.json",
      ),
      "utf8",
    ),
  );
  assert.deepEqual(destinationMarketplace.plugins, []);
  assert.equal(
    fs.existsSync(path.join(destinationPluginsRoot, "openai-bundled", "plugins", "browser")),
    false,
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

  const loaderSource = fs.readFileSync(
    path.join(desktopRoot, "codex-plusplus", "loader.cjs"),
    "utf8",
  );
  assert.match(loaderSource, /config\.json/);
  assert.match(loaderSource, /autoUpdate: false/);
  assert.match(loaderSource, /bundledVersionIsNewer\(marker\.version, current\.version\)/);
});

test("bundles app-owned Codex++ UI tweaks without keyboard shortcut tweaks", () => {
  const tweaksRoot = path.join(desktopRoot, "codex-plusplus", "tweaks");
  const tweakNames = fs
    .readdirSync(tweaksRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(tweakNames, [
    "codex-app-ui-overrides",
    "codex-plusplus-updater-ui-overrides",
  ]);

  for (const tweakName of tweakNames) {
    const tweakRoot = path.join(tweaksRoot, tweakName);
    const manifest = JSON.parse(fs.readFileSync(path.join(tweakRoot, "manifest.json"), "utf8"));
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
  }
});

test("Codex app UI override installs styles without observing renderer mutations", () => {
  const tweakRoot = path.join(desktopRoot, "codex-plusplus", "tweaks", "codex-app-ui-overrides");
  const source = fs.readFileSync(path.join(tweakRoot, "index.js"), "utf8");
  const appendedStyles = [];
  const eventListeners = [];
  let mutationObserverCount = 0;

  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const previousMutationObserver = globalThis.MutationObserver;
  const previousNodeFilter = globalThis.NodeFilter;

  const fakeElement = {
    className: "",
    parentElement: null,
    style: {},
    getBoundingClientRect: () => ({ width: 0, height: 0, left: 0, bottom: 0 }),
    querySelector: () => null,
  };

  globalThis.NodeFilter = { SHOW_TEXT: 4 };
  globalThis.MutationObserver = class {
    constructor() {
      mutationObserverCount += 1;
    }

    observe() {}
    disconnect() {}
  };
  globalThis.window = {
    innerHeight: 1000,
    requestAnimationFrame(callback) {
      callback();
      return 1;
    },
    cancelAnimationFrame() {},
    addEventListener(type) {
      eventListeners.push(type);
    },
    removeEventListener() {},
  };
  globalThis.document = {
    body: fakeElement,
    documentElement: fakeElement,
    head: {
      appendChild(style) {
        appendedStyles.push(style);
      },
    },
    getElementById: () => null,
    createElement: () => ({ id: "", textContent: "", remove() {} }),
    createTreeWalker: () => ({ nextNode: () => null }),
    querySelectorAll: () => [],
  };

  try {
    const module = { exports: {} };
    const exports = module.exports;
    const fn = new Function("module", "exports", "console", source);
    fn(module, exports, console);

    module.exports.start({ log: console });

    assert.equal(mutationObserverCount, 0);
    assert.deepEqual(eventListeners, []);
    assert.equal(appendedStyles.length, 1);
    assert.match(
      appendedStyles[0].textContent,
      /top:calc\(0\.75rem \+ 26px\)!important/,
    );

    module.exports.stop();
  } finally {
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
    globalThis.MutationObserver = previousMutationObserver;
    globalThis.NodeFilter = previousNodeFilter;
  }
});

test("Codex++ updater UI override hides update controls without observing renderer mutations", () => {
  const tweakRoot = path.join(
    desktopRoot,
    "codex-plusplus",
    "tweaks",
    "codex-plusplus-updater-ui-overrides",
  );
  const source = fs.readFileSync(path.join(tweakRoot, "index.js"), "utf8");
  const documentEvents = [];
  const windowEvents = [];
  let mutationObserverCount = 0;
  let timeoutId = 0;
  let timeoutDelay = 0;
  let clearedTimeoutId = 0;

  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const previousMutationObserver = globalThis.MutationObserver;
  const previousNodeFilter = globalThis.NodeFilter;

  const releaseButton = {
    title: "Open Codex++ releases",
    textContent: "Update",
    style: {},
    isConnected: true,
  };
  const updateSection = { style: {}, isConnected: true };
  const watcherSection = { style: {}, isConnected: true };
  const textNodes = [
    {
      textContent: "Codex++ Updates",
      parentElement: { closest: (selector) => (selector === "section" ? updateSection : null) },
    },
    {
      textContent: "Auto-Repair Watcher",
      parentElement: { closest: (selector) => (selector === "section" ? watcherSection : null) },
    },
  ];

  globalThis.NodeFilter = { SHOW_TEXT: 4 };
  globalThis.MutationObserver = class {
    constructor() {
      mutationObserverCount += 1;
    }

    observe() {}
    disconnect() {}
  };
  globalThis.window = {
    requestAnimationFrame(callback) {
      callback();
      return 1;
    },
    cancelAnimationFrame() {},
    setTimeout(_callback, delay) {
      timeoutId += 1;
      timeoutDelay = delay;
      return timeoutId;
    },
    clearTimeout(id) {
      clearedTimeoutId = id;
    },
    addEventListener(type) {
      windowEvents.push(type);
    },
    removeEventListener(type) {
      windowEvents.push(`remove:${type}`);
    },
  };
  globalThis.document = {
    body: {},
    documentElement: {},
    addEventListener(type) {
      documentEvents.push(type);
    },
    removeEventListener(type) {
      documentEvents.push(`remove:${type}`);
    },
    createTreeWalker: () => {
      let index = 0;
      return { nextNode: () => textNodes[index++] ?? null };
    },
    querySelectorAll: () => [releaseButton],
  };

  try {
    const module = { exports: {} };
    const exports = module.exports;
    const fn = new Function("module", "exports", "console", source);
    fn(module, exports, console);

    module.exports.start({ log: console });

    assert.equal(mutationObserverCount, 0);
    assert.deepEqual(documentEvents, []);
    assert.deepEqual(windowEvents, []);
    assert.equal(timeoutDelay, 250);
    assert.equal(releaseButton.style.display, "none");
    assert.equal(updateSection.style.display, "none");
    assert.equal(watcherSection.style.display, "none");

    module.exports.stop();

    assert.deepEqual(documentEvents, []);
    assert.deepEqual(windowEvents, []);
    assert.equal(clearedTimeoutId, timeoutId);
    assert.equal(releaseButton.style.display, "");
    assert.equal(updateSection.style.display, "");
    assert.equal(watcherSection.style.display, "");
  } finally {
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
    globalThis.MutationObserver = previousMutationObserver;
    globalThis.NodeFilter = previousNodeFilter;
  }
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

test("Windows ARM64 workflows use the documented VS2026 runner image", () => {
  for (const workflowName of [
    "windows-arm64-pr-build.yml",
    "windows-arm64-release.yml",
  ]) {
    const workflowSource = fs.readFileSync(
      path.join(repoRoot, ".github", "workflows", workflowName),
      "utf8",
    );

    assert.match(workflowSource, /runs-on: windows-2025-vs2026/);
    assert.doesNotMatch(workflowSource, /runs-on: windows-latest/);
  }
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
  assert.match(workflowSource, /CODEX_PLUS_PLUS_TAG: \$\{\{ needs\.build-windows-arm64\.outputs\.codex_plus_plus_tag \}\}/);
  assert.match(workflowSource, /Codex\+\+: \$env:CODEX_PLUS_PLUS_TAG/);
  assert.match(workflowSource, /BUILD_SHA: \$\{\{ github\.sha \}\}/);
  assert.doesNotMatch(workflowSource, /PR_HEAD_SHA/);
  assert.match(workflowSource, /\$targetSha = \$env:BUILD_SHA/);
  assert.match(workflowSource, /actions\/download-artifact@37930b1c2abaa49bbe596cd826c3c89aef350131/);
  assert.match(workflowSource, /gh release create \$tag[\s\S]*--prerelease --latest=false/);
  assert.match(workflowSource, /gh release edit \$tag[\s\S]*--prerelease --latest=false/);
  assert.match(workflowSource, /gh release upload \$tag \$zip\.FullName[\s\S]*--clobber/);
});

test("release workflow tracks Codex++ in package inputs and release metadata", () => {
  const workflowSource = fs.readFileSync(
    path.join(repoRoot, ".github", "workflows", "windows-arm64-release.yml"),
    "utf8",
  );

  assert.match(workflowSource, /CODEX_PLUS_PLUS_TAG: \$\{\{ steps\.upstream\.outputs\.codex_plus_plus_tag \}\}/);
  assert.match(workflowSource, /Codex\+\+: \$\{\{ steps\.upstream\.outputs\.codex_plus_plus_tag \}\}/);
  assert.match(workflowSource, /gh release create \$tag[\s\S]*--notes "\$notes"/);
  assert.match(workflowSource, /gh release edit \$tag[\s\S]*--notes "\$notes"/);
});

test("authenticates Codex++ GitHub release lookup when a token is available", () => {
  const scriptSource = fs.readFileSync(
    path.join(desktopRoot, "scripts", "hydrate-codex-app.ts"),
    "utf8",
  );

  assert.match(scriptSource, /const token = process\.env\.GH_TOKEN \?\? process\.env\.GITHUB_TOKEN/);
  assert.match(scriptSource, /headers\.Authorization = `Bearer \$\{token\}`/);
  assert.match(scriptSource, /headers: githubHeaders\(\)/);
  assert.match(scriptSource, /process\.env\.CODEX_PLUS_PLUS_TAG/);
  assert.match(scriptSource, /fetchCodexPlusPlusRelease\(pinnedTagName\)/);
  assert.match(scriptSource, /downloadFile\(zipballUrl, zipPath, githubHeaders\(\)\)/);
});

test("authenticates GitHub release asset downloads when a token is available", () => {
  const scriptSource = fs.readFileSync(
    path.join(desktopRoot, "scripts", "hydrate-codex-cli.ts"),
    "utf8",
  );

  assert.match(scriptSource, /const token = process\.env\.GH_TOKEN \?\? process\.env\.GITHUB_TOKEN/);
  assert.match(scriptSource, /headers\.Authorization = `Bearer \$\{token\}`/);
  assert.match(scriptSource, /hostname === "api\.github\.com" \|\| hostname === "github\.com"/);
  assert.match(scriptSource, /fetch\(url, \{ headers: headersForUrl\(url\) \}\)/);
});

test("repo Node toolchain matches the Electron runtime Node major", () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(desktopRoot, "package.json"), "utf8"),
  );
  const nodeVersionFile = fs.readFileSync(path.join(repoRoot, ".node-version"), "utf8").trim();
  const electronPath = require("electron");
  const electronNodeVersion = execFileSync(
    electronPath,
    ["-p", "process.versions.node"],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1",
      },
    },
  ).trim();
  const electronNodeMajor = electronNodeVersion.split(".")[0];

  assert.equal(nodeVersionFile, electronNodeMajor);
  assert.equal(packageJson.engines.node, electronNodeMajor);
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

test("caches rebuilt native Node modules separately from hydrated app resources", () => {
  const resolverSource = fs.readFileSync(
    path.join(desktopRoot, "scripts", "resolve-codex-releases.mjs"),
    "utf8",
  );
  for (const cacheKeyInput of [
    "package-lock.json",
    "scripts/hydrate-codex-app.ts",
    "scripts/patch-better-sqlite3-electron.ts",
  ]) {
    assert.ok(
      resolverSource.includes(cacheKeyInput),
      `native module cache key should include ${cacheKeyInput}`,
    );
  }
  assert.match(resolverSource, /native_modules_cache_key/);

  const hydrateSource = fs.readFileSync(
    path.join(desktopRoot, "scripts", "hydrate-codex-app.ts"),
    "utf8",
  );
  assert.match(hydrateSource, /inputHash: cacheInputHash\(electronNativeModuleCacheInputPaths\)/);
  assert.match(hydrateSource, /version: 4/);

  for (const workflowName of [
    "windows-arm64-pr-build.yml",
    "windows-arm64-release.yml",
  ]) {
    const workflowSource = fs.readFileSync(
      path.join(repoRoot, ".github", "workflows", workflowName),
      "utf8",
    );
    const hydratedCacheBlock = workflowSource.match(
      /- name: Restore hydrated release cache[\s\S]*?- name: Prepare native Node module cache directory/,
    )?.[0];

    assert.ok(hydratedCacheBlock, `${workflowName} should restore a separate native module cache`);
    assert.doesNotMatch(hydratedCacheBlock, /desktop\/\.cache\/runtime-node-modules/);
    assert.match(
      workflowSource,
      /New-Item -ItemType Directory -Force -Path desktop\/\.cache\/runtime-node-modules/,
    );
    assert.match(workflowSource, /path: desktop\/\.cache\/runtime-node-modules/);
    assert.match(workflowSource, /key: \$\{\{ steps\.upstream\.outputs\.native_modules_cache_key \}\}/);
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

test("ZIP builds do not enable the Windows Store updater", () => {
  const source = fs.readFileSync(
    path.join(desktopRoot, "native", "windows-oai-update-checker", "src", "lib.rs"),
    "utf8",
  );

  assert.match(source, /if first == APPMODEL_ERROR_NO_PACKAGE \{/);
  assert.match(source, /return Ok\(String::new\(\)\);/);
  assert.doesNotMatch(source, /return Ok\("Codex"\.to_string\(\)\);/);
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

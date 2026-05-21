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
const uiOverridesManifestRelativePath =
  "desktop/codex-plusplus/tweaks/codex-app-ui-overrides/manifest.json";
const require = createRequire(import.meta.url);
const {
  collectNativeNodeModuleTargets,
  hasArm64RuntimePayload,
  patchCodexWindowServicesSource,
  patchMarkdownOperationDirectiveCrashSource,
  pruneUnusedNativePayloads,
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

function parseThreePartVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  assert.ok(match, `Expected three-part version, got ${version}`);
  return match.slice(1).map((part) => Number.parseInt(part, 10));
}

function readGitFile(ref, relativePath) {
  return execFileSync("git", ["show", `${ref}:${relativePath}`], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function readMainBranchFile(relativePath) {
  try {
    return readGitFile("origin/main", relativePath);
  } catch {
    execFileSync("git", ["fetch", "--depth=1", "origin", "main:refs/remotes/origin/main"], {
      cwd: repoRoot,
      stdio: "ignore",
    });
    return readGitFile("origin/main", relativePath);
  }
}

function expectedBundledTweakPrVersion(mainVersion) {
  const [major, minor, patch] = parseThreePartVersion(mainVersion);
  assert.equal(major, 0);
  assert.equal(patch, 0);
  return `0.${minor + 1}.0`;
}

function expectedLocalModifiedTweakVersion(mainVersion) {
  const [major, minor, patch] = parseThreePartVersion(mainVersion);
  return `${major}.${minor}.${patch + 1}`;
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

function createMarkdownDirectiveFixture() {
  const tick = String.fromCharCode(96);
  return [
    "const codexDirective=\"codexDirective\";",
    "function ar(e){return e;}",
    "function g(e){return e;}",
    "const c=null;",
    "function Hr(e){return e.split(" +
      tick +
      "\n" +
      tick +
      ").filter(e=>!Ur(e)).join(" +
      tick +
      "\n" +
      tick +
      ")}",
    "function Ur(e){let t=e.trimStart();if(!t.startsWith(\"::\")||t.startsWith(\":::\"))return!1;let n=2;for(;Wr(t.charCodeAt(n));)n+=1;return n===2?!1:s.has(t.slice(2,n))}",
    "function Wr(e){return e>=65&&e<=90||e>=97&&e<=122||e>=48&&e<=57||e===45||e===95}",
    "function Br(n,T){let E=n,ne=T?ar(Hr(E)):E,O=g(ne,c);return O}",
  ].join("");
}

function evaluateMarkdownDirectiveFixture(source, operationNames = ["git-create-branch"]) {
  return new Function("s", source + "; return { Hr, Br };")(new Set(operationNames));
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
    "window.__codexppSettingsSurfaceVisible = true; window.dispatchEvent(new CustomEvent('codexpp:settings-surface', { detail: { visible: true } }));\n",
  );
  writeFixture(path.join(sourceRoot, "LICENSE"), "MIT\n");

  syncCodexPlusPlusRuntimeAssets(
    sourceRoot,
    {
      tag_name: "v0.1.7",
      commitSha: "7c3e1f6d2b4a9c8e7f6d5c4b3a29181716151413",
      html_url: "https://github.com/b-nnett/codex-plusplus/releases/tag/v0.1.7",
      zipball_url: "https://api.github.com/repos/b-nnett/codex-plusplus/zipball/v0.1.7",
      published_at: "2026-05-12T14:08:09Z",
    },
    destinationRoot,
    "sliepie/codex-plusplus",
  );

  assert.equal(
    fs.readFileSync(path.join(destinationRoot, "runtime", "main.js"), "utf8"),
    "module.exports = {};\n",
  );
  assert.equal(fs.readFileSync(path.join(destinationRoot, "LICENSE"), "utf8"), "MIT\n");
  const release = JSON.parse(fs.readFileSync(path.join(destinationRoot, "release.json"), "utf8"));
  assert.equal(release.repo, "sliepie/codex-plusplus");
  assert.equal(release.tagName, "v0.1.7");
  assert.equal(release.commitSha, "7c3e1f6d2b4a9c8e7f6d5c4b3a29181716151413");
});

test("rejects Codex++ runtime assets without the settings surface event contract", () => {
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

  assert.throws(
    () =>
      syncCodexPlusPlusRuntimeAssets(sourceRoot, {
        tag_name: "v0.1.7",
        commitSha: "7c3e1f6d2b4a9c8e7f6d5c4b3a29181716151413",
        html_url: "https://github.com/sliepie/codex-plusplus/releases/tag/v0.1.7",
        zipball_url: "https://api.github.com/repos/sliepie/codex-plusplus/zipball/v0.1.7",
        published_at: "2026-05-12T14:08:09Z",
      }, destinationRoot, "sliepie/codex-plusplus"),
    /settings surface event contract/,
  );
});

test("patches recovered Codex window services source", () => {
  const source =
    "const services = createServices({" +
    "buildFlavor:'prod',allowDevtools:false,allowDebugMenu:false," +
    "allowInspectElement:false,globalState:{},getGlobalStateForHost(){}," +
    "desktopRoot:'',preloadPath:'',repoRoot:'',disposables:[]" +
    "});startApp();";

  const result = patchCodexWindowServicesSource(source);

  assert.equal(result?.changed, true);
  assert.equal(result?.strategy, "service-factory-fingerprint");
  assert.match(result?.source ?? "", /globalThis\.__codexpp_window_services__=services;startApp\(\);/);
});

test("patches markdown operation directives before renderer parsing", () => {
  const source = createMarkdownDirectiveFixture();

  const result = patchMarkdownOperationDirectiveCrashSource(source);

  assert.equal(result?.changed, true);
  assert.equal(result?.strategy, "operation-directive-filter");
  assert.match(result?.source ?? "", /E=Hr\(n\),ne=T\?ar\(E\):E/);

  const patched = evaluateMarkdownDirectiveFixture(result?.source ?? "");
  const content =
    "before\n" +
    "::git-create-branch{cwd=\"C:\\tmp\\foo\" branch=\"sliepie/fix\"}\n" +
    "after";
  assert.equal(patched.Br(content, false), "before\nafter");
  assert.equal(patched.Br(content, true), "before\nafter");

  const second = patchMarkdownOperationDirectiveCrashSource(result?.source ?? "");
  assert.equal(second?.changed, false);
  assert.equal(second?.strategy, "already-patched");
});

test("keeps non-operation directives and fenced operation directive examples", () => {
  const result = patchMarkdownOperationDirectiveCrashSource(createMarkdownDirectiveFixture());
  const patched = evaluateMarkdownDirectiveFixture(result?.source ?? "");
  const content =
    "alpha\n" +
    "::note{cwd=\"C:\\tmp\\foo\"}\n" +
    "```text\n" +
    "::git-create-branch{cwd=\"C:\\tmp\\foo\" branch=\"sliepie/fix\"}\n" +
    "```\n" +
    "omega";

  assert.equal(patched.Br(content, false), content);
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

test("discovers source-only native packages that declare binding.gyp", () => {
  const recoveredRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-recovered-"));
  const pluginsRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-plugins-"));
  const packageRoot = path.join(recoveredRoot, "node_modules", "source-native");
  writeFixture(
    path.join(packageRoot, "package.json"),
    `${JSON.stringify({ name: "source-native", version: "1.0.0" }, null, 2)}\n`,
  );
  writeFixture(path.join(packageRoot, "binding.gyp"), "{}\n");

  const targets = collectNativeNodeModuleTargets(recoveredRoot, pluginsRoot);

  assert.deepEqual(targets.map((target) => target.nativeModules).flat(), [
    { name: "source-native", version: "1.0.0" },
  ]);
});

test("prunes unused node-pty fallback and debug payloads", () => {
  const nodeModulesRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-native-modules-"));
  const nodePtyRoot = path.join(nodeModulesRoot, "node-pty");

  for (const filePath of [
    path.join(nodePtyRoot, "prebuilds", "win32-arm64", "conpty.node"),
    path.join(nodePtyRoot, "prebuilds", "win32-arm64", "conpty.pdb"),
    path.join(nodePtyRoot, "prebuilds", "win32-arm64", "conpty_console_list.node"),
    path.join(nodePtyRoot, "prebuilds", "win32-arm64", "conpty_console_list.pdb"),
    path.join(nodePtyRoot, "prebuilds", "win32-arm64", "pty.node"),
    path.join(nodePtyRoot, "prebuilds", "win32-arm64", "pty.pdb"),
    path.join(nodePtyRoot, "prebuilds", "win32-arm64", "winpty.dll"),
    path.join(nodePtyRoot, "prebuilds", "win32-arm64", "winpty.pdb"),
    path.join(nodePtyRoot, "prebuilds", "win32-arm64", "winpty-agent.exe"),
    path.join(nodePtyRoot, "prebuilds", "win32-arm64", "winpty-agent.pdb"),
    path.join(nodePtyRoot, "prebuilds", "win32-arm64", "conpty", "conpty.dll"),
    path.join(nodePtyRoot, "prebuilds", "win32-arm64", "conpty", "OpenConsole.exe"),
    path.join(nodePtyRoot, "third_party", "conpty", "1.23.251008001", "win10-arm64", "conpty.dll"),
    path.join(nodePtyRoot, "third_party", "conpty", "1.23.251008001", "win10-arm64", "OpenConsole.exe"),
    path.join(nodePtyRoot, "third_party", "conpty", "1.23.251008001", "win10-x64", "conpty.dll"),
    path.join(nodePtyRoot, "third_party", "conpty", "1.23.251008001", "win10-x64", "OpenConsole.exe"),
    path.join(nodePtyRoot, "prebuilds", "win32-x64", "pty.node"),
  ]) {
    writePeFixture(filePath, filePath.includes("x64") ? 0x8664 : 0xaa64);
  }

  pruneUnusedNativePayloads(nodeModulesRoot);

  assert.equal(fs.existsSync(path.join(nodePtyRoot, "prebuilds", "win32-arm64", "conpty")), false);
  assert.equal(fs.existsSync(path.join(nodePtyRoot, "third_party", "conpty")), false);
  assert.equal(fs.existsSync(path.join(nodePtyRoot, "prebuilds", "win32-x64")), false);
  assert.equal(fs.existsSync(path.join(nodePtyRoot, "prebuilds", "win32-arm64", "conpty.pdb")), false);
  assert.equal(
    fs.existsSync(path.join(nodePtyRoot, "prebuilds", "win32-arm64", "conpty_console_list.pdb")),
    false,
  );
  assert.equal(fs.existsSync(path.join(nodePtyRoot, "prebuilds", "win32-arm64", "pty.pdb")), false);
  assert.equal(fs.existsSync(path.join(nodePtyRoot, "prebuilds", "win32-arm64", "winpty.pdb")), false);
  assert.equal(fs.existsSync(path.join(nodePtyRoot, "prebuilds", "win32-arm64", "winpty-agent.pdb")), false);
  assert.equal(fs.existsSync(path.join(nodePtyRoot, "prebuilds", "win32-arm64", "conpty.node")), true);
  assert.equal(
    fs.existsSync(path.join(nodePtyRoot, "prebuilds", "win32-arm64", "conpty_console_list.node")),
    true,
  );
  assert.equal(fs.existsSync(path.join(nodePtyRoot, "prebuilds", "win32-arm64", "pty.node")), true);
  assert.equal(fs.existsSync(path.join(nodePtyRoot, "prebuilds", "win32-arm64", "winpty.dll")), false);
  assert.equal(
    fs.existsSync(path.join(nodePtyRoot, "prebuilds", "win32-arm64", "winpty-agent.exe")),
    false,
  );
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
  assert.equal(config.packagerConfig.ignore("/codex-plusplus-old/loader.cjs"), true);
  assert.equal(config.packagerConfig.ignore("/codex-plusplus/runtime/main.js"), false);
  assert.equal(config.packagerConfig.ignore("/package.json.bak"), true);
  assert.equal(
    config.packagerConfig.ignore(
      "/recovered/app-asar-extracted/node_modules/node-pty/prebuilds/win32-arm64/conpty.pdb",
    ),
    true,
  );
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
  assert.match(loaderSource, /__codexpp\.originalMain/);
  assert.match(loaderSource, /registerEarlyPreloadHooks\(\);[\s\S]*require\(path\.join\(packagedRoot, originalMain\)\)/);
  assert.match(loaderSource, /canRemoveStaleTweaks/);
  assert.match(loaderSource, /maxLogBytes = 10 \* 1024 \* 1024/);
  assert.match(loaderSource, /if \(size > maxLogBytes\)/);
  assert.match(loaderSource, /function trimLogToRetainedBytes/);
  assert.match(loaderSource, /fs\.readSync\(/);

  const forgeSource = fs.readFileSync(path.join(desktopRoot, "forge.config.js"), "utf8");
  assert.match(forgeSource, /originalMain: recoveredOriginalMain\(upstreamPackageJson\)/);
  assert.match(forgeSource, /path\.posix\.isAbsolute\(normalizedMain\)/);
  assert.match(forgeSource, /normalizedMain\.startsWith\('\.\.\/'\)/);
  assert.match(forgeSource, /assertCodexPlusPlusPackageInputs\(buildPath\)/);
});

function ensureRecoveredPackageForForgeTest(t) {
  const recoveredRoot = path.join(desktopRoot, "recovered");
  const recoveredPackageRoot = path.join(recoveredRoot, "app-asar-extracted");
  const recoveredPackageJsonPath = path.join(recoveredPackageRoot, "package.json");
  if (fs.existsSync(recoveredPackageJsonPath)) {
    return;
  }

  const hadRecoveredRoot = fs.existsSync(recoveredRoot);
  writeFixture(
    recoveredPackageJsonPath,
    JSON.stringify({ main: ".vite/build/bootstrap.js", version: "0.0.0" }, null, 2) + "\n",
  );
  t.after(() => {
    if (!hadRecoveredRoot) {
      fs.rmSync(recoveredRoot, { recursive: true, force: true });
      return;
    }
    fs.rmSync(recoveredPackageJsonPath, { force: true });
  });
}

function runForgeAfterCopy(config, buildPath) {
  return new Promise((resolve, reject) => {
    config.packagerConfig.afterCopy[0](buildPath, null, null, null, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

test("Forge preflight fails when hydrated Codex++ runtime is missing", async (t) => {
  ensureRecoveredPackageForForgeTest(t);
  const config = require(path.join(desktopRoot, "forge.config.js"));
  const buildPath = fs.mkdtempSync(path.join(os.tmpdir(), "codex-forge-preflight-"));
  t.after(() => fs.rmSync(buildPath, { recursive: true, force: true }));

  writeFixture(path.join(buildPath, "package.json"), JSON.stringify({ name: "codex" }, null, 2) + "\n");
  writeFixture(path.join(buildPath, "codex-plusplus", "loader.cjs"), "module.exports = {};\n");

  await assert.rejects(
    () => runForgeAfterCopy(config, buildPath),
    /Missing required packaged file: codex-plusplus\/runtime\/main\.js/,
  );
});

function createCodexPlusPlusLoaderFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-plusplus-loader-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const loaderPath = path.join(root, "codex-plusplus", "loader.cjs");
  const originalMain = "recovered/app-asar-extracted/.vite/build/bootstrap.js";
  const originalMainPath = path.join(root, originalMain);
  const runtimeMainPath = path.join(root, "codex-plusplus", "runtime", "main.js");
  const appData = path.join(root, "AppData");
  const tracePath = path.join(root, "trace.txt");

  fs.mkdirSync(path.dirname(loaderPath), { recursive: true });
  fs.copyFileSync(path.join(desktopRoot, "codex-plusplus", "loader.cjs"), loaderPath);
  writeFixture(
    path.join(root, "package.json"),
    JSON.stringify({ __codexpp: { originalMain } }, null, 2) + "\n",
  );
  writeFixture(
    originalMainPath,
    'require("node:fs").appendFileSync(process.env.CODEX_LOADER_TRACE, "original\\n");\n',
  );
  writeFixture(
    runtimeMainPath,
    'require("node:fs").appendFileSync(process.env.CODEX_LOADER_TRACE, "runtime\\n");\n',
  );

  return { root, loaderPath, appData, tracePath };
}

function runCodexPlusPlusLoaderFixture(fixture) {
  execFileSync(process.execPath, [fixture.loaderPath], {
    cwd: fixture.root,
    env: {
      ...process.env,
      APPDATA: fixture.appData,
      CODEX_LOADER_TRACE: fixture.tracePath,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  return fs.readFileSync(fixture.tracePath, "utf8").trim().split(/\r?\n/);
}

test("Codex++ loader starts original Codex before runtime integration", (t) => {
  const fixture = createCodexPlusPlusLoaderFixture(t);

  assert.deepEqual(runCodexPlusPlusLoaderFixture(fixture), ["original", "runtime"]);
});

test("Codex++ loader registers preload hooks before original Codex startup", (t) => {
  const fixture = createCodexPlusPlusLoaderFixture(t);
  writeFixture(
    path.join(fixture.root, "node_modules", "electron", "index.js"),
    [
      'const fs = require("node:fs");',
      "const trace = process.env.CODEX_LOADER_TRACE;",
      "const session = {",
      "  registerPreloadScript() { fs.appendFileSync(trace, \"preload\\n\"); },",
      "};",
      "module.exports = {",
      "  app: {",
      "    whenReady() {",
      "      return {",
      "        then(callback) {",
      "          fs.appendFileSync(trace, \"when-ready-hook\\n\");",
      "          callback();",
      "          return { catch() {} };",
      "        },",
      "      };",
      "    },",
      "    on(event) {",
      "      if (event === \"session-created\") fs.appendFileSync(trace, \"session-created-hook\\n\");",
      "    },",
      "  },",
      "  session: { defaultSession: session },",
      "};",
      "",
    ].join("\n"),
  );

  assert.deepEqual(runCodexPlusPlusLoaderFixture(fixture), [
    "when-ready-hook",
    "preload",
    "session-created-hook",
    "original",
    "runtime",
  ]);
});

test("Codex++ loader still starts runtime when a bundled tweak marker is corrupt", (t) => {
  const fixture = createCodexPlusPlusLoaderFixture(t);
  writeFixture(
    path.join(fixture.root, "codex-plusplus", "tweaks", "app-tweak", "manifest.json"),
    JSON.stringify({ id: "app-tweak", version: "1.1.0" }, null, 2) + "\n",
  );
  writeFixture(
    path.join(
      fixture.appData,
      "codex-plusplus",
      "tweaks",
      "app-tweak",
      ".codex-app-bundled-tweak.json",
    ),
    "{broken json",
  );

  assert.deepEqual(runCodexPlusPlusLoaderFixture(fixture), ["original", "runtime"]);
});

test("Codex++ loader does not replace user-owned tweak directories", (t) => {
  const fixture = createCodexPlusPlusLoaderFixture(t);
  writeFixture(
    path.join(fixture.root, "codex-plusplus", "tweaks", "app-tweak", "manifest.json"),
    JSON.stringify({ id: "app-tweak", version: "2.0.0" }, null, 2) + "\n",
  );
  writeFixture(
    path.join(fixture.root, "codex-plusplus", "tweaks", "app-tweak", "index.js"),
    'module.exports = "bundled";\n',
  );
  const installedTweakRoot = path.join(fixture.appData, "codex-plusplus", "tweaks", "app-tweak");
  writeFixture(path.join(installedTweakRoot, "index.js"), 'module.exports = "user";\n');
  writeFixture(
    path.join(installedTweakRoot, ".codex-app-bundled-tweak.json"),
    JSON.stringify({ source: "other", id: "app-tweak", version: "1.0.0" }, null, 2) + "\n",
  );

  assert.deepEqual(runCodexPlusPlusLoaderFixture(fixture), ["original", "runtime"]);
  assert.equal(
    fs.readFileSync(path.join(installedTweakRoot, "index.js"), "utf8"),
    'module.exports = "user";\n',
  );
});

test("Codex++ loader upgrades trusted bundled tweak installs", (t) => {
  const fixture = createCodexPlusPlusLoaderFixture(t);
  writeFixture(
    path.join(fixture.root, "codex-plusplus", "tweaks", "app-tweak", "manifest.json"),
    JSON.stringify({ id: "app-tweak", version: "1.1.0" }, null, 2) + "\n",
  );
  writeFixture(
    path.join(fixture.root, "codex-plusplus", "tweaks", "app-tweak", "index.js"),
    'module.exports = "bundled";\n',
  );
  const installedTweakRoot = path.join(fixture.appData, "codex-plusplus", "tweaks", "app-tweak");
  writeFixture(path.join(installedTweakRoot, "index.js"), 'module.exports = "old";\n');
  writeFixture(
    path.join(installedTweakRoot, ".codex-app-bundled-tweak.json"),
    JSON.stringify({ source: "codex-app", id: "app-tweak", version: "1.0.0" }, null, 2) + "\n",
  );

  assert.deepEqual(runCodexPlusPlusLoaderFixture(fixture), ["original", "runtime"]);
  assert.equal(
    fs.readFileSync(path.join(installedTweakRoot, "index.js"), "utf8"),
    'module.exports = "bundled";\n',
  );
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(installedTweakRoot, ".codex-app-bundled-tweak.json"), "utf8"))
      .version,
    "1.1.0",
  );
});

test("Codex++ loader removes trusted app-owned bundled tweaks no longer packaged", (t) => {
  const fixture = createCodexPlusPlusLoaderFixture(t);
  fs.mkdirSync(path.join(fixture.root, "codex-plusplus", "tweaks"), { recursive: true });
  const removedTweakRoot = path.join(
    fixture.appData,
    "codex-plusplus",
    "tweaks",
    "app.sliepie.codex.mobile-pairing",
  );
  const userTweakRoot = path.join(fixture.appData, "codex-plusplus", "tweaks", "user-tweak");

  writeFixture(path.join(removedTweakRoot, "index.js"), 'module.exports = "removed";\n');
  writeFixture(
    path.join(removedTweakRoot, ".codex-app-bundled-tweak.json"),
    JSON.stringify(
      { source: "codex-app", id: "app.sliepie.codex.mobile-pairing", version: "0.1.0" },
      null,
      2,
    ) + "\n",
  );
  writeFixture(path.join(userTweakRoot, "index.js"), 'module.exports = "user";\n');
  writeFixture(
    path.join(userTweakRoot, ".codex-app-bundled-tweak.json"),
    JSON.stringify({ source: "other", id: "user-tweak", version: "1.0.0" }, null, 2) + "\n",
  );

  assert.deepEqual(runCodexPlusPlusLoaderFixture(fixture), ["original", "runtime"]);
  assert.equal(fs.existsSync(removedTweakRoot), false);
  assert.equal(fs.existsSync(userTweakRoot), true);
});

test("Codex++ loader keeps installed tweaks when bundled tweak discovery fails", (t) => {
  const fixture = createCodexPlusPlusLoaderFixture(t);
  writeFixture(
    path.join(fixture.root, "codex-plusplus", "tweaks", "bad-tweak", "manifest.json"),
    JSON.stringify({ id: "../escaped", version: "1.0.0" }, null, 2) + "\n",
  );
  const installedTweakRoot = path.join(
    fixture.appData,
    "codex-plusplus",
    "tweaks",
    "app.sliepie.codex.mobile-pairing",
  );
  writeFixture(path.join(installedTweakRoot, "index.js"), 'module.exports = "old";\n');
  writeFixture(
    path.join(installedTweakRoot, ".codex-app-bundled-tweak.json"),
    JSON.stringify(
      { source: "codex-app", id: "app.sliepie.codex.mobile-pairing", version: "0.1.0" },
      null,
      2,
    ) + "\n",
  );

  assert.deepEqual(runCodexPlusPlusLoaderFixture(fixture), ["original", "runtime"]);
  assert.equal(fs.existsSync(installedTweakRoot), true);
});

test("Codex++ loader rejects unsafe bundled tweak ids", (t) => {
  const fixture = createCodexPlusPlusLoaderFixture(t);
  writeFixture(
    path.join(fixture.root, "codex-plusplus", "tweaks", "bad-tweak", "manifest.json"),
    JSON.stringify({ id: "../escaped", version: "1.0.0" }, null, 2) + "\n",
  );

  assert.deepEqual(runCodexPlusPlusLoaderFixture(fixture), ["original", "runtime"]);
  assert.equal(fs.existsSync(path.join(fixture.appData, "codex-plusplus", "escaped")), false);
});

test("Codex++ loader does not rewrite already disabled updater config", (t) => {
  const fixture = createCodexPlusPlusLoaderFixture(t);
  const configPath = path.join(fixture.appData, "codex-plusplus", "config.json");
  const configSource = '{"codexPlusPlus":{"autoUpdate":false},"keep":"format"}\n';
  writeFixture(configPath, configSource);

  assert.deepEqual(runCodexPlusPlusLoaderFixture(fixture), ["original", "runtime"]);
  assert.equal(fs.readFileSync(configPath, "utf8"), configSource);
});

test("Codex++ loader disables updater when nested config shape is invalid", (t) => {
  const fixture = createCodexPlusPlusLoaderFixture(t);
  const configPath = path.join(fixture.appData, "codex-plusplus", "config.json");
  writeFixture(configPath, JSON.stringify({ codexPlusPlus: "invalid", keep: true }, null, 2) + "\n");

  assert.deepEqual(runCodexPlusPlusLoaderFixture(fixture), ["original", "runtime"]);
  assert.deepEqual(JSON.parse(fs.readFileSync(configPath, "utf8")), {
    codexPlusPlus: { autoUpdate: false },
    keep: true,
  });
});

test("Codex++ loader disables updater when config JSON is malformed", (t) => {
  const fixture = createCodexPlusPlusLoaderFixture(t);
  const configPath = path.join(fixture.appData, "codex-plusplus", "config.json");
  writeFixture(configPath, "{broken json\n");

  assert.deepEqual(runCodexPlusPlusLoaderFixture(fixture), ["original", "runtime"]);
  assert.deepEqual(JSON.parse(fs.readFileSync(configPath, "utf8")), {
    codexPlusPlus: { autoUpdate: false },
  });
  const invalidConfigFiles = fs
    .readdirSync(path.dirname(configPath))
    .filter((name) => name.startsWith("config.json.invalid"));
  assert.equal(invalidConfigFiles.length, 1);
  assert.equal(
    fs.readFileSync(path.join(path.dirname(configPath), invalidConfigFiles[0]), "utf8"),
    "{broken json\n",
  );
});

test("bundles app-owned Codex++ UI tweaks without keyboard shortcut tweaks", () => {
  const tweaksRoot = path.join(desktopRoot, "codex-plusplus", "tweaks");
  const mainUiOverridesManifest = JSON.parse(
    readMainBranchFile(uiOverridesManifestRelativePath),
  );
  const tweakNames = fs
    .readdirSync(tweaksRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(tweakNames, [
    "codex-app-ui-overrides",
    "codex-plusplus-updater-ui-overrides",
  ]);
  const expectedTweakMetadata = new Map([
    [
      "codex-app-ui-overrides",
      {
        id: "app.sliepie.codex.ui-overrides",
        version: expectedBundledTweakPrVersion(mainUiOverridesManifest.version),
      },
    ],
    [
      "codex-plusplus-updater-ui-overrides",
      { id: "app.sliepie.codex.codex-plusplus-updater-ui", version: "0.3.0" },
    ],
  ]);

  for (const tweakName of tweakNames) {
    const tweakRoot = path.join(tweaksRoot, tweakName);
    const manifest = JSON.parse(fs.readFileSync(path.join(tweakRoot, "manifest.json"), "utf8"));
    assert.deepEqual(
      { id: manifest.id, version: manifest.version },
      expectedTweakMetadata.get(tweakName),
    );
    assert.equal(manifest.scope, "renderer");
    assert.equal(manifest.main, "index.js");
    assert.notEqual(manifest.id.includes("keyboard"), true);

    const source = fs.readFileSync(path.join(tweakRoot, manifest.main), "utf8");
    if (tweakName === "codex-app-ui-overrides") {
      assert.doesNotMatch(source, /createTreeWalker|requestAnimationFrame|setTimeout/);
    } else {
      assert.doesNotMatch(source, /MutationObserver|createTreeWalker|requestAnimationFrame|setTimeout|addEventListener/);
    }
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

test("Codex++ UI override versions follow main branch bump policy", () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(repoRoot, uiOverridesManifestRelativePath), "utf8"),
  );
  const mainManifest = JSON.parse(readMainBranchFile(uiOverridesManifestRelativePath));
  const [mainMajor, mainMinor, mainPatch] = parseThreePartVersion(mainManifest.version);

  assert.equal(
    manifest.version,
    expectedBundledTweakPrVersion(mainManifest.version),
  );
  assert.equal(
    expectedLocalModifiedTweakVersion(mainManifest.version),
    `${mainMajor}.${mainMinor}.${mainPatch + 1}`,
  );
  assert.notEqual(
    expectedLocalModifiedTweakVersion(mainManifest.version),
    manifest.version,
  );
});

test("Codex app UI override installs styles and Appearance menu-bar toggle", () => {
  const tweakRoot = path.join(desktopRoot, "codex-plusplus", "tweaks", "codex-app-ui-overrides");
  const manifest = JSON.parse(fs.readFileSync(path.join(tweakRoot, "manifest.json"), "utf8"));
  const source = fs.readFileSync(path.join(tweakRoot, manifest.main), "utf8");
  assert.doesNotMatch(source, /createTreeWalker|requestAnimationFrame|setTimeout/);
  const appendedStyles = [];
  let styleRemoved = false;
  let observerCallback = null;
  let observerDisconnected = false;
  const storageValues = new Map();

  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const previousNodeFilter = globalThis.NodeFilter;
  const previousMutationObserver = globalThis.MutationObserver;

  class FakeElement {
    constructor(tagName = "div") {
      this.tagName = tagName.toUpperCase();
      this.className = "";
      this.children = [];
      this.parentElement = null;
      this.style = {};
      this.id = "";
      this.type = "";
      this._textContent = "";
      this.attributes = new Map();
      this.listeners = new Map();
    }

    get textContent() {
      return `${this._textContent}${this.children.map((child) => child.textContent).join("")}`;
    }

    set textContent(value) {
      this._textContent = String(value);
      this.children = [];
    }

    appendChild(child) {
      child.parentElement = this;
      this.children.push(child);
      return child;
    }

    append(...children) {
      for (const child of children) {
        this.appendChild(child);
      }
    }

    insertBefore(child, before) {
      child.parentElement = this;
      const index = this.children.indexOf(before);
      if (index === -1) {
        this.children.push(child);
      } else {
        this.children.splice(index, 0, child);
      }
      return child;
    }

    contains(child) {
      return this === child || this.children.some((candidate) => candidate.contains(child));
    }

    remove() {
      if (this.id === "codex-app-ui-overrides-style") {
        styleRemoved = true;
      }
      if (!this.parentElement) {
        return;
      }
      this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
      this.parentElement = null;
    }

    setAttribute(name, value) {
      this.attributes.set(name, String(value));
    }

    getAttribute(name) {
      return this.attributes.get(name) ?? null;
    }

    removeAttribute(name) {
      this.attributes.delete(name);
    }

    addEventListener(type, handler) {
      const handlers = this.listeners.get(type) ?? [];
      handlers.push(handler);
      this.listeners.set(type, handlers);
    }

    click() {
      for (const handler of this.listeners.get("click") ?? []) {
        handler({ defaultPrevented: false });
      }
    }

    querySelector(selector) {
      return this.querySelectorAll(selector)[0] ?? null;
    }

    querySelectorAll(selector) {
      const descendants = [];
      const visit = (element) => {
        for (const child of element.children) {
          descendants.push(child);
          visit(child);
        }
      };
      visit(this);

      if (selector === 'button[role="switch"]') {
        return descendants.filter(
          (element) =>
            element.tagName === "BUTTON" && element.getAttribute("role") === "switch",
        );
      }
      if (selector === "[data-codex-app-ui-menu-bar-toggle-track]") {
        return descendants.filter((element) =>
          element.attributes.has("data-codex-app-ui-menu-bar-toggle-track"),
        );
      }
      if (selector === "[data-codex-app-ui-menu-bar-toggle-thumb]") {
        return descendants.filter((element) =>
          element.attributes.has("data-codex-app-ui-menu-bar-toggle-thumb"),
        );
      }

      return [];
    }
  }

  const documentElement = new FakeElement("html");
  const head = new FakeElement("head");
  head.appendChild = (style) => {
    FakeElement.prototype.appendChild.call(head, style);
    appendedStyles.push(style);
    return style;
  };
  const settingsSurface = new FakeElement("div");
  settingsSurface.className =
    "border-token-border flex flex-col divide-y-[0.5px] divide-token-border rounded-lg border";
  const themeRow = new FakeElement("div");
  themeRow.textContent = "Theme";
  const pointerRow = new FakeElement("div");
  pointerRow.textContent = "Use pointer cursors";
  const reduceMotionRow = new FakeElement("div");
  reduceMotionRow.textContent = "Reduce motion";
  settingsSurface.append(themeRow, pointerRow, reduceMotionRow);
  documentElement.appendChild(settingsSurface);

  const findById = (root, id) => {
    if (root.id === id) {
      return root;
    }
    for (const child of root.children) {
      const found = findById(child, id);
      if (found) {
        return found;
      }
    }
    return null;
  };

  globalThis.NodeFilter = { SHOW_TEXT: 4 };
  globalThis.MutationObserver = class {
    constructor(callback) {
      observerCallback = callback;
    }

    observe(target, options) {
      assert.equal(target, documentElement);
      assert.deepEqual(options, { childList: true, subtree: true });
    }

    disconnect() {
      observerDisconnected = true;
    }
  };
  globalThis.window = {
    innerHeight: 1000,
    localStorage: {
      getItem: () => null,
      setItem: () => {},
    },
  };
  globalThis.document = {
    body: documentElement,
    documentElement,
    head,
    getElementById: (id) =>
      findById(head, id) ?? findById(documentElement, id) ?? null,
    createElement: (tagName) => new FakeElement(tagName),
    querySelectorAll: (selector) =>
      selector === ".main-surface .flex.flex-col.rounded-lg.border"
        ? [settingsSurface]
        : [],
  };

  try {
    const module = { exports: {} };
    const exports = module.exports;
    const fn = new Function("module", "exports", "console", source);
    fn(module, exports, console);

    const storage = {
      get: (key, defaultValue) =>
        storageValues.has(key) ? storageValues.get(key) : defaultValue,
      set: (key, value) => {
        storageValues.set(key, value);
      },
    };

    module.exports.start({ log: console, storage });

    assert.equal(
      documentElement.getAttribute("data-codex-app-ui-hide-windows-menu-bar"),
      "true",
    );
    assert.equal(typeof observerCallback, "function");
    assert.equal(appendedStyles.length, 1);
    assert.equal(appendedStyles[0].id, "codex-app-ui-overrides-style");
    const uiOverrideCss = appendedStyles[0].textContent;
    assert.match(
      appendedStyles[0].textContent,
      /top:calc\(0\.75rem \+ 26px\)!important/,
    );
    assert.ok(
      uiOverrideCss.includes(
        String.raw`:root[data-codex-app-ui-hide-windows-menu-bar="true"] .group\/windows-top-bar>.flex.items-center.gap-0\.5.pr-2.pl-1:has(>button[aria-haspopup="menu"][aria-expanded]){display:none!important;}`,
      ),
    );
    assert.equal(
      uiOverrideCss.includes(
        String.raw`.group\/windows-top-bar{display:none!important;}`,
      ),
      false,
    );
    assert.equal(
      uiOverrideCss.includes(String.raw`.group\/windows-top-bar button[aria-label]`),
      false,
    );
    const settingRow = document.getElementById(
      "codex-app-ui-hide-windows-menu-bar-setting",
    );
    assert.ok(settingRow);
    assert.deepEqual(
      settingsSurface.children.map((child) => child.id || child.textContent),
      [
        "Theme",
        "Use pointer cursors",
        "codex-app-ui-hide-windows-menu-bar-setting",
        "Reduce motion",
      ],
    );
    const toggle = settingRow.querySelector('button[role="switch"]');
    assert.ok(toggle);
    assert.equal(toggle.getAttribute("aria-label"), "Hide menu bar");
    assert.equal(toggle.getAttribute("aria-checked"), "true");
    assert.equal(
      settingRow
        .querySelector("[data-codex-app-ui-menu-bar-toggle-track]")
        .getAttribute("data-state"),
      "checked",
    );
    toggle.click();
    assert.equal(storageValues.get("hideWindowsMenuBar"), false);
    assert.equal(
      documentElement.getAttribute("data-codex-app-ui-hide-windows-menu-bar"),
      "false",
    );
    assert.equal(toggle.getAttribute("aria-checked"), "false");
    assert.equal(
      settingRow
        .querySelector("[data-codex-app-ui-menu-bar-toggle-track]")
        .getAttribute("data-state"),
      "unchecked",
    );
    observerCallback();
    assert.equal(
      settingsSurface.children.filter(
        (child) => child.id === "codex-app-ui-hide-windows-menu-bar-setting",
      ).length,
      1,
    );
    assert.match(
      appendedStyles[0].textContent,
      /\[data-app-action-sidebar-project-row\] button svg[^{}]*\{width:0\.875rem!important/,
    );
    assert.doesNotMatch(
      appendedStyles[0].textContent,
      /\[data-app-action-sidebar-section-heading="Chats"\] \[data-app-action-sidebar-thread-row\]/,
    );
    assert.match(
      appendedStyles[0].textContent,
      /\[data-app-action-sidebar-thread-row\]:not\(\[data-app-action-sidebar-section-heading="Chats"\]~\[data-app-action-sidebar-thread-row\]\):has\(\.absolute\.top-0\.left-1\.z-10\):is\(:hover,:focus-within,\[aria-current="page"\],[^{}]+\) \[data-thread-title-trigger\]\{padding-inline-start:1\.25rem!important;\}/,
    );
    assert.match(
      appendedStyles[0].textContent,
      /\[data-app-action-sidebar-thread-row\]:not\(\[data-app-action-sidebar-section-heading="Chats"\]~\[data-app-action-sidebar-thread-row\]\):has\(\.absolute\.top-0\.left-1\.z-10\):is\(:hover,:focus-within,\[aria-current="page"\],[^{}]+\) \.w-4:not\(:has\(button\)\)[^{}]*\{opacity:0!important;visibility:hidden!important;\}/,
    );
    assert.match(
      appendedStyles[0].textContent,
      /\[data-app-action-sidebar-thread-row\]:not\(\[data-app-action-sidebar-section-heading="Chats"\]~\[data-app-action-sidebar-thread-row\]\):is\(:hover,:focus-within,\[aria-current="page"\],[^{}]+\) \.absolute\.top-0\.left-1\.z-10[^{}]*\{opacity:1!important;pointer-events:auto!important;visibility:visible!important;\}/,
    );
    assert.ok(
      uiOverrideCss.includes(
        String.raw`[data-app-action-sidebar-section-heading="Chats"]{position:relative!important;left:-2px!important;}`,
      ),
    );
    assert.ok(
      uiOverrideCss.includes(
        String.raw`.group\/chats-section-header{position:relative!important;left:1px!important;}`,
      ),
    );
    assert.doesNotMatch(
      appendedStyles[0].textContent,
      /(^|\n)\[data-app-action-sidebar-section-heading="Chats"\][^{}]*\[data-thread-title-trigger\]/,
    );
    assert.doesNotMatch(
      appendedStyles[0].textContent,
      /(^|\n)\[data-app-action-sidebar-section-heading="Chats"\][^{}]*(\.absolute\.top-0\.left-1\.z-10|\.w-4)/,
    );
    assert.doesNotMatch(
      appendedStyles[0].textContent,
      /\.group\\\/chats-section-header:is\(:hover,:focus-within\)/,
    );
    assert.match(
      appendedStyles[0].textContent,
      /\.main-surface>\.draggable\.flex\.items-center\.px-panel\.electron\\:h-toolbar\.extension\\:h-toolbar-sm:not\(:has\(\*\)\):has\(\+\.scrollbar-stable\.flex-1\.overflow-y-auto\.p-panel\)\{display:none!important;\}/,
    );
    assert.match(
      appendedStyles[0].textContent,
      /\.main-surface>\.draggable\.flex\.items-center\.px-panel\.electron\\:h-toolbar\.extension\\:h-toolbar-sm:not\(:has\(\*\)\)\+\.scrollbar-stable\.flex-1\.overflow-y-auto\.p-panel\{padding-top:0\.5rem!important;padding-bottom:4rem!important;\}/,
    );
    assert.ok(
      uiOverrideCss.includes(
        String.raw`.flex.flex-col.text-sm>.grid.items-center.gap-y-1\.5.py-1{padding-left:calc(var(--padding-row-x) + 1.25rem + 2px)!important;padding-right:var(--padding-row-x)!important;}`,
      ),
    );
    assert.ok(
      uiOverrideCss.includes(
        String.raw`.flex.flex-col.text-sm:has(>.grid.items-center.gap-y-1\.5.py-1)>a[href="https://openai.com/chatgpt/pricing"],.flex.flex-col.text-sm:has(>.grid.items-center.gap-y-1\.5.py-1)>a[href^="https://help.openai.com/en/articles/11369540-using-codex"]{display:none!important;}`,
      ),
    );

    module.exports.start({ log: console, storage });
    assert.equal(appendedStyles.length, 1);

    module.exports.stop();
    assert.equal(observerDisconnected, true);
    assert.equal(
      documentElement.getAttribute("data-codex-app-ui-hide-windows-menu-bar"),
      null,
    );
    assert.equal(
      document.getElementById("codex-app-ui-hide-windows-menu-bar-setting"),
      null,
    );
    assert.equal(styleRemoved, true);
  } finally {
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
    globalThis.NodeFilter = previousNodeFilter;
    globalThis.MutationObserver = previousMutationObserver;
  }
});

test("Codex++ updater UI override installs static styles without observing renderer mutations", () => {
  const tweakRoot = path.join(
    desktopRoot,
    "codex-plusplus",
    "tweaks",
    "codex-plusplus-updater-ui-overrides",
  );
  const source = fs.readFileSync(path.join(tweakRoot, "index.js"), "utf8");
  assert.doesNotMatch(source, /MutationObserver|createTreeWalker|requestAnimationFrame|setTimeout|addEventListener/);
  const appendedStyles = [];
  let removed = false;

  const previousDocument = globalThis.document;
  globalThis.document = {
    head: {
      appendChild(style) {
        appendedStyles.push(style);
      },
    },
    getElementById: (id) => appendedStyles.find((style) => style.id === id) ?? null,
    createElement: () => ({
      id: "",
      textContent: "",
      remove() {
        removed = true;
      },
    }),
  };

  try {
    const module = { exports: {} };
    const exports = module.exports;
    const fn = new Function("module", "exports", "console", source);
    fn(module, exports, console);

    module.exports.start({ log: console });

    assert.equal(appendedStyles.length, 1);
    assert.equal(appendedStyles[0].id, "codex-plusplus-updater-ui-overrides-style");
    assert.match(appendedStyles[0].textContent, /button\[title="Open Codex\+\+ releases"\]/);
    assert.match(appendedStyles[0].textContent, /\[data-codexpp="tweaks-panel"\] section:has\(> \[data-codexpp-config-card\]\)/);
    assert.match(appendedStyles[0].textContent, /\[data-codexpp="tweaks-panel"\] section:has\(> \[data-codexpp-config-card\]\) \+ section/);

    module.exports.start({ log: console });
    assert.equal(appendedStyles.length, 1);

    module.exports.stop();

    assert.equal(removed, true);
  } finally {
    globalThis.document = previousDocument;
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

test("keeps the TypeScript beta script compiler floating", () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(desktopRoot, "package.json"), "utf8"),
  );

  assert.equal(packageJson.devDependencies?.["@typescript/native-preview"], undefined);
  assert.equal(
    packageJson.scripts["build:scripts"],
    "npx -y -p @typescript/native-preview@beta tsgo -p tsconfig.scripts.json",
  );
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
    /if: github\.event\.pull_request\.head\.repo\.full_name == github\.repository && github\.event\.pull_request\.draft == false/,
  );
  assert.match(workflowSource, /permissions:\r?\n      contents: write/);
  assert.match(workflowSource, /ALPHA_RELEASE_TAG: codex-app-alpha/);
  assert.match(workflowSource, /CODEX_PLUS_PLUS_TAG: \$\{\{ needs\.build-windows-arm64\.outputs\.codex_plus_plus_tag \}\}/);
  assert.match(workflowSource, /CODEX_PLUS_PLUS_SHA: \$\{\{ needs\.build-windows-arm64\.outputs\.codex_plus_plus_sha \}\}/);
  assert.match(workflowSource, /Codex\+\+: \$env:CODEX_PLUS_PLUS_TAG/);
  assert.match(workflowSource, /Codex\+\+ commit: \$env:CODEX_PLUS_PLUS_SHA/);
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
  assert.match(workflowSource, /CODEX_PLUS_PLUS_SHA: \$\{\{ steps\.upstream\.outputs\.codex_plus_plus_sha \}\}/);
  assert.match(workflowSource, /Codex\+\+: \$env:CODEX_PLUS_PLUS_TAG/);
  assert.match(workflowSource, /Codex\+\+ commit: \$env:CODEX_PLUS_PLUS_SHA/);
  assert.match(workflowSource, /gh release create \$tag[\s\S]*--notes "\$notes"/);
  assert.match(workflowSource, /gh release edit \$tag[\s\S]*--notes "\$notes"/);
});

test("release workflows scope GitHub credentials away from install and build scripts", () => {
  const releaseWorkflowSource = fs.readFileSync(
    path.join(repoRoot, ".github", "workflows", "windows-arm64-release.yml"),
    "utf8",
  );
  const prWorkflowSource = fs.readFileSync(
    path.join(repoRoot, ".github", "workflows", "windows-arm64-pr-build.yml"),
    "utf8",
  );
  const packageJson = JSON.parse(fs.readFileSync(path.join(desktopRoot, "package.json"), "utf8"));

  assert.doesNotMatch(releaseWorkflowSource, /env:\r?\n\s+GH_TOKEN: \$\{\{ github\.token \}\}\r?\n\s+IS_RELEASE_EVENT:/);
  assert.doesNotMatch(prWorkflowSource, /env:\r?\n\s+GH_TOKEN: \$\{\{ github\.token \}\}\r?\n\s+PACKAGE_ARCHITECTURE:/);
  assert.match(releaseWorkflowSource, /name: Resolve upstream release versions[\s\S]*GH_TOKEN: \$\{\{ github\.token \}\}[\s\S]*run: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types \.\/scripts\/resolve-codex-releases\.ts/);
  assert.match(prWorkflowSource, /name: Resolve upstream release versions[\s\S]*GH_TOKEN: \$\{\{ github\.token \}\}[\s\S]*run: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types \.\/scripts\/resolve-codex-releases\.ts/);
  assert.ok(releaseWorkflowSource.indexOf("name: Resolve upstream release versions") < releaseWorkflowSource.indexOf("name: Skip released commit"));
  assert.doesNotMatch(
    releaseWorkflowSource.slice(0, releaseWorkflowSource.indexOf("name: Skip released commit")),
    /cache: npm/,
  );
  assert.ok(releaseWorkflowSource.indexOf("name: Skip released commit") < releaseWorkflowSource.indexOf("name: Restore Electron cache"));
  assert.match(releaseWorkflowSource, /name: Restore npm cache[\s\S]*if: steps\.upstream\.outputs\.current_commit_release_tag == ''[\s\S]*cache: npm[\s\S]*cache-dependency-path: desktop\/package-lock\.json/);
  assert.ok(releaseWorkflowSource.indexOf("name: Restore npm cache") < releaseWorkflowSource.indexOf("name: Install dependencies"));
  assert.match(releaseWorkflowSource, /name: Restore Electron cache[\s\S]*if: steps\.upstream\.outputs\.current_commit_release_tag == ''/);
  assert.match(releaseWorkflowSource, /name: Install dependencies[\s\S]*if: steps\.upstream\.outputs\.current_commit_release_tag == ''[\s\S]*run: npm ci/);
  assert.match(releaseWorkflowSource, /name: Build desktop scripts[\s\S]*if: steps\.upstream\.outputs\.current_commit_release_tag == ''[\s\S]*run: npm run build:scripts/);
  assert.ok(prWorkflowSource.indexOf("name: Resolve upstream release versions") < prWorkflowSource.indexOf("name: Restore Electron cache"));
  assert.match(prWorkflowSource, /name: Build desktop scripts[\s\S]*run: npm run build:scripts/);
  assert.ok(prWorkflowSource.indexOf("name: Restore Electron cache") < prWorkflowSource.indexOf("name: Install dependencies"));
  assert.ok(releaseWorkflowSource.indexOf("name: Restore Electron cache") < releaseWorkflowSource.indexOf("name: Install dependencies"));
  assert.match(prWorkflowSource, /name: Build Windows updater[\s\S]*run: npm run build:windows-oai-update-checker -- -Architecture arm64/);
  assert.match(releaseWorkflowSource, /name: Build Windows updater[\s\S]*run: npm run build:windows-oai-update-checker -- -Architecture arm64/);
  assert.match(prWorkflowSource, /name: Hydrate Windows ARM64 inputs[\s\S]*CODEX_APP_VERSION: \$\{\{ steps\.upstream\.outputs\.codex_app_version \}\}[\s\S]*CODEX_APP_BUILD: \$\{\{ steps\.upstream\.outputs\.codex_app_build \}\}/);
  assert.match(releaseWorkflowSource, /name: Hydrate Windows ARM64 inputs[\s\S]*CODEX_APP_VERSION: \$\{\{ steps\.upstream\.outputs\.codex_app_version \}\}[\s\S]*CODEX_APP_BUILD: \$\{\{ steps\.upstream\.outputs\.codex_app_build \}\}/);
  assert.match(prWorkflowSource, /name: Hydrate Windows ARM64 inputs[\s\S]*GH_TOKEN: \$\{\{ github\.token \}\}[\s\S]*run: npm run hydrate:app:compiled && npm run hydrate:cli:compiled/);
  assert.match(releaseWorkflowSource, /name: Hydrate Windows ARM64 inputs[\s\S]*GH_TOKEN: \$\{\{ github\.token \}\}[\s\S]*run: npm run hydrate:app:compiled && npm run hydrate:cli:compiled/);
  assert.match(prWorkflowSource, /name: Verify Windows ARM64 inputs[\s\S]*run: npm run verify:browser-client-runtime:compiled/);
  assert.match(releaseWorkflowSource, /name: Verify Windows ARM64 inputs[\s\S]*run: npm run verify:browser-client-runtime:compiled/);
  assert.ok(
    releaseWorkflowSource.indexOf("name: Skip released commit") <
      releaseWorkflowSource.indexOf("name: Run targeted desktop tests"),
  );
  assert.match(releaseWorkflowSource, /name: Run targeted desktop tests[\s\S]*if: steps\.upstream\.outputs\.current_commit_release_tag == ''[\s\S]*npm run test:resolve-codex-releases:compiled && npm run test:windows-package-resources:compiled && npm run test:verify-browser-client-runtime:compiled/);
  assert.match(prWorkflowSource, /name: Run targeted desktop tests[\s\S]*npm run test:resolve-codex-releases:compiled && npm run test:windows-package-resources:compiled && npm run test:verify-browser-client-runtime:compiled/);
  assert.match(prWorkflowSource, /name: Restore hydrated release cache[\s\S]*uses: actions\/cache\/restore@/);
  assert.match(releaseWorkflowSource, /name: Restore hydrated release cache[\s\S]*uses: actions\/cache@/);
  assert.equal(packageJson.scripts["build:scripts"], "npx -y -p @typescript/native-preview@beta tsgo -p tsconfig.scripts.json");
  assert.equal(packageJson.scripts["verify:browser-client-runtime"], "npm run build:scripts && npm run verify:browser-client-runtime:compiled");
  assert.equal(packageJson.scripts["verify:browser-client-runtime:compiled"], "node ./.cache/scripts/verify-browser-client-runtime.js");
  assert.equal(packageJson.scripts["test:resolve-codex-releases:compiled"], "node --test scripts/resolve-codex-releases.test.mjs");
  assert.equal(packageJson.scripts["test:windows-package-resources:compiled"], "node --test scripts/windows-package-resources.test.mjs");
  assert.equal(packageJson.scripts["test:verify-browser-client-runtime:compiled"], "node --test scripts/verify-browser-client-runtime.test.mjs");
  assert.equal(packageJson.scripts["decode:self-signed-pfx"], "npm run build:scripts && node ./.cache/scripts/decode-self-signed-pfx.js");
  assert.equal(packageJson.scripts["prepare:self-signed-msix-payload:compiled"], "node ./.cache/scripts/prepare-self-signed-msix-payload.js");
  assert.equal(packageJson.scripts["write:self-signed-appinstaller:compiled"], "node ./.cache/scripts/write-self-signed-appinstaller.js");
  assert.match(releaseWorkflowSource, /node \.\/\.cache\/scripts\/decode-self-signed-pfx\.js --output/);
  assert.doesNotMatch(releaseWorkflowSource, /npm run decode:self-signed-pfx/);
  assert.match(releaseWorkflowSource, /npm run prepare:self-signed-msix-payload:compiled/);
  assert.match(releaseWorkflowSource, /npm run write:self-signed-appinstaller:compiled/);
});

test("self-signed MSIX payload rewrites shared SwiftShader ICD metadata", () => {
  const scriptSource = fs.readFileSync(
    path.join(desktopRoot, "scripts", "prepare-self-signed-msix-payload.ts"),
    "utf8",
  );

  assert.match(scriptSource, /function rewriteSwiftShaderIcdMetadata\(appRoot: string\): void/);
  assert.match(scriptSource, /path\.join\(appRoot, "vk_swiftshader_icd\.json"\)/);
  assert.match(scriptSource, /JSON\.stringify\(swiftShaderIcd, null, 2\)/);
  assert.match(scriptSource, /rewriteSwiftShaderIcdMetadata\(appRoot\);/);
});

test("log cleanup helper blocks any Codex process before moving SQLite logs", () => {
  const scriptSource = fs.readFileSync(
    path.join(desktopRoot, "scripts", "Clear-CodexLocalLogs.ps1"),
    "utf8",
  );

  assert.match(scriptSource, /\$_\.Name -eq "Codex\.exe" -or \$_.Name -eq "codex\.exe"/);
  assert.match(scriptSource, /Get-CimInstance Win32_Process -ErrorAction Stop/);
  assert.match(scriptSource, /Could not inspect running Codex processes/);
  assert.doesNotMatch(scriptSource, /Get-CimInstance Win32_Process -ErrorAction SilentlyContinue/);
  assert.doesNotMatch(scriptSource, /CommandLine -match/);
  assert.match(scriptSource, /Get-ChildItem -LiteralPath \$codexHomePath -Filter "logs_2\.sqlite\*"/);
  assert.match(scriptSource, /Move-Item -LiteralPath \$file\.FullName -Destination \$destination -Force/);
});

test("authenticates Codex++ GitHub release lookup when a token is available", () => {
  const scriptSource = fs.readFileSync(
    path.join(desktopRoot, "scripts", "hydrate-codex-app.ts"),
    "utf8",
  );

  assert.match(scriptSource, /const token = process\.env\.GH_TOKEN \?\? process\.env\.GITHUB_TOKEN/);
  assert.match(scriptSource, /headers\.Authorization = `Bearer \$\{token\}`/);
  assert.match(scriptSource, /headers: githubHeaders\(\)/);
  assert.match(scriptSource, /process\.env\.CODEX_PLUS_PLUS_REPOSITORY/);
  assert.match(scriptSource, /process\.env\.CODEX_APP_VERSION/);
  assert.match(scriptSource, /process\.env\.CODEX_APP_BUILD/);
  assert.match(scriptSource, /--build-number/);
  assert.match(scriptSource, /function findReleaseItem\(appcast: string, version\?: string, buildNumber\?: string\)/);
  assert.match(scriptSource, /releaseItemBuildNumber\(candidate\) === buildNumber/);
  assert.match(scriptSource, /findReleaseItem\(await appcastResponse\.text\(\), options\.version, options\.buildNumber\)/);
  assert.match(scriptSource, /--codex-plusplus-repo/);
  assert.match(scriptSource, /process\.env\.CODEX_PLUS_PLUS_TAG/);
  assert.match(scriptSource, /process\.env\.CODEX_PLUS_PLUS_SHA/);
  assert.match(scriptSource, /fetchCodexPlusPlusRelease\(repository, pinnedTagName\)/);
  assert.match(scriptSource, /fetchCodexPlusPlusTagCommitSha\(repository, tagName\)/);
  assert.match(scriptSource, /repos\/\$\{repositoryApiPath\(repository\)\}\/zipball\/\$\{commitSha\}/);
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
  assert.match(scriptSource, /fetchGitHubRelease\(options\.codexRepo, options\.codexTag\)/);
  assert.match(scriptSource, /verifyAssetDigest\(asset, downloadPath\)/);
  assert.doesNotMatch(scriptSource, /execFileSync\(\s*"gh"/);
});

test("Codex app hydration keys extracted app cache by version and build", () => {
  const appHydratorSource = fs.readFileSync(
    path.join(desktopRoot, "scripts", "hydrate-codex-app.ts"),
    "utf8",
  );
  const cliHydratorSource = fs.readFileSync(
    path.join(desktopRoot, "scripts", "hydrate-codex-cli.ts"),
    "utf8",
  );
  const verifierSource = fs.readFileSync(
    path.join(desktopRoot, "scripts", "verify-browser-client-runtime.ts"),
    "utf8",
  );

  assert.match(appHydratorSource, /function appExtractCacheSegment\(version: string, buildNumber\?: string\)/);
  assert.match(appHydratorSource, /const appCacheSegment = appExtractCacheSegment\(selectedVersion, selectedBuildNumber\)/);
  assert.match(appHydratorSource, /const zipPath = path\.join\(options\.cacheRoot, `\$\{appCacheSegment\}\$\{downloadExtension\}`\)/);
  assert.match(
    appHydratorSource,
    /const extractDir = `extract-\$\{appCacheSegment\}`/,
  );
  assert.match(appHydratorSource, /extractDir,/);
  assert.match(cliHydratorSource, /function appExtractCacheSegment\(version: string, buildNumber\?: string\)/);
  assert.match(cliHydratorSource, /buildNumber\?: string/);
  assert.match(cliHydratorSource, /extractDir\?: string/);
  assert.match(
    cliHydratorSource,
    /function appExtractDirCandidates\(version: string, buildNumber\?: string, extractDir\?: string\)/,
  );
  assert.match(verifierSource, /function appExtractCacheSegment\(version: string, buildNumber\?: string\)/);
  assert.match(
    verifierSource,
    /function appExtractDirCandidates\(version: string, buildNumber\?: string, extractDir\?: string\)/,
  );
});

test("operational scripts resolve desktop root from script location", () => {
  for (const scriptName of [
    "hydrate-codex-app.ts",
    "hydrate-codex-cli.ts",
    "refresh-recovered-from-dmg.ts",
    "resolve-codex-releases.ts",
  ]) {
    const scriptSource = fs.readFileSync(path.join(desktopRoot, "scripts", scriptName), "utf8");
    assert.match(scriptSource, /function resolveDesktopRoot\(\): string/);
    assert.match(scriptSource, /path\.basename\((?:__dirname|directory)\) === "scripts"/);
    assert.match(scriptSource, /path\.basename\(path\.dirname\((?:__dirname|directory)\)\) === "\.cache"/);
    assert.doesNotMatch(scriptSource, /const desktopRoot = process\.cwd\(\)/);
  }
});

test("verifies hydrated upstream artifact integrity metadata", () => {
  const appHydratorSource = fs.readFileSync(
    path.join(desktopRoot, "scripts", "hydrate-codex-app.ts"),
    "utf8",
  );
  const cliHydratorSource = fs.readFileSync(
    path.join(desktopRoot, "scripts", "hydrate-codex-cli.ts"),
    "utf8",
  );

  assert.match(appHydratorSource, /expectedDownloadLength/);
  assert.match(appHydratorSource, /Downloaded Codex app ZIP size mismatch/);
  assert.match(cliHydratorSource, /parseAssetDigest/);
  assert.match(cliHydratorSource, /verifyAssetDigest\(asset, downloadPath\)/);
  assert.match(cliHydratorSource, /verifyAssetDigest\(asset, archivePath\)/);
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
    path.join(desktopRoot, "scripts", "resolve-codex-releases.ts"),
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

test("non-official Windows packages do not enable the Windows Store updater", () => {
  const source = fs.readFileSync(
    path.join(desktopRoot, "native", "windows-oai-update-checker", "src", "lib.rs"),
    "utf8",
  );

  assert.match(source, /if first == APPMODEL_ERROR_NO_PACKAGE \{/);
  assert.match(source, /return Ok\(String::new\(\)\);/);
  assert.match(
    source,
    /const OFFICIAL_PACKAGE_FAMILY_NAME: &str = "OpenAI\.Codex_2p2nqsd0c76g0";/,
  );
  assert.match(source, /if package_family_name != OFFICIAL_PACKAGE_FAMILY_NAME \{/);
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
    /<OnLaunch HoursBetweenUpdateChecks="0" ShowPrompt="true" UpdateBlocksActivation="true" \/>/,
  );
});

test("hardcodes packaged Windows updater metadata to the self-signed identity", () => {
  const source = fs.readFileSync(path.join(desktopRoot, "forge.config.js"), "utf8");
  assert.match(source, /const codexWindowsPackageIdentity = 'Sliepie\.Codex\.SelfSigned';/);
  assert.match(
    source,
    /packageJson\.codexWindowsPackageIdentity = codexWindowsPackageIdentity;/,
  );
});

test("node REPL updater only accepts the official Store package family", () => {
  const source = fs.readFileSync(
    path.join(desktopRoot, "scripts", "update-node-repl.ps1"),
    "utf8",
  );

  assert.match(source, /\$PackageName = "OpenAI\.Codex"/);
  assert.match(source, /\$PackageFamilyName = "OpenAI\.Codex_2p2nqsd0c76g0"/);
  assert.match(source, /Where-Object \{ \$_\.PackageFamilyName -eq \$PackageFamilyName \}/);
});

test("ignores generated signing-secret base64 exports", () => {
  const gitignoreSource = fs.readFileSync(path.join(repoRoot, ".gitignore"), "utf8");
  assert.match(gitignoreSource, /^\*\.pfx\.base64\.txt$/m);
});

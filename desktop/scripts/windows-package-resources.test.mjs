import assert from "node:assert/strict";
import crypto from "node:crypto";
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
const bundledTweakRelativeRoots = new Map([
  ["codex-app-ui-overrides", "desktop/codex-plusplus/tweaks/codex-app-ui-overrides"],
  ["codex-app-windows-menu-bar", "desktop/codex-plusplus/tweaks/codex-app-windows-menu-bar"],
]);
const newBundledTweaks = new Set();
const require = createRequire(import.meta.url);
const {
  collectNativeNodeModuleTargets,
  findAppAsar,
  hasArm64RuntimePayload,
  assertNoWorkLouderRuntimeReferences,
  patchRecoveredCodexMicroServiceSource,
  patchCodexWindowServicesSource,
  patchMarkdownOperationDirectiveCrashSource,
  pruneWorkLouderPackages,
  patchOwlFeatureBindingSource,
  patchRecoveredMessageRailStatsigGateSource,
  patchRecoveredOwlFeatureSwitchSource,
  pruneUnusedNativePayloads,
  rewriteCodexPlusPlusRuntimePreload,
  syncCodexPlusPlusRuntimeAssets,
  syncBundledPluginResources,
} = require(
  path.join(desktopRoot, ".cache", "scripts", "hydrate-codex-app.js"),
);
const {
  installTectonicWindowsPayload,
} = require(
  path.join(desktopRoot, ".cache", "scripts", "bundled-plugin-windows-payloads.js"),
);
const {
  matchWindowsArm64ResourceBinaryException,
  peMachine,
  readPeMachine,
  windowsArm64ResourceBinaryExceptions,
} = require(
  path.join(desktopRoot, ".cache", "scripts", "resource-binary-exceptions.js"),
);
const {
  verifyWindowsArm64ResourceBinaries,
} = require(
  path.join(desktopRoot, ".cache", "scripts", "verify-windows-arm64-resource-binaries.js"),
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

function readMainBranchJson(relativePath) {
  return JSON.parse(readMainBranchFile(relativePath));
}

function gitFileList(ref, relativeRoot) {
  const output = execFileSync("git", ["ls-tree", "-r", "--name-only", ref, "--", relativeRoot], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return output.trim() ? output.trim().split(/\r?\n/) : [];
}

function readMainBranchFileList(relativeRoot) {
  try {
    return gitFileList("origin/main", relativeRoot);
  } catch {
    execFileSync("git", ["fetch", "--depth=1", "origin", "main:refs/remotes/origin/main"], {
      cwd: repoRoot,
      stdio: "ignore",
    });
    return gitFileList("origin/main", relativeRoot);
  }
}

function normalizeText(source) {
  return source.replace(/\r\n/g, "\n");
}

function listLocalFiles(relativeRoot) {
  const root = path.join(repoRoot, relativeRoot);
  const files = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath);
        continue;
      }
      files.push(path.relative(root, entryPath).replaceAll(path.sep, "/"));
    }
  }
  visit(root);
  return files.sort().map((file) => relativeRoot + "/" + file);
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

function comparableTweakFileText(relativePath, source) {
  if (!relativePath.endsWith("/manifest.json")) {
    return normalizeText(source);
  }

  const manifest = JSON.parse(source);
  delete manifest.version;
  return JSON.stringify(manifest);
}

function tweakContentMatchesMainBranch(relativeRoot) {
  const localFiles = listLocalFiles(relativeRoot).sort();
  const mainFiles = readMainBranchFileList(relativeRoot).sort();
  if (JSON.stringify(localFiles) !== JSON.stringify(mainFiles)) {
    return false;
  }

  return localFiles.every((relativePath) => (
    comparableTweakFileText(relativePath, fs.readFileSync(path.join(repoRoot, relativePath), "utf8")) ===
    comparableTweakFileText(relativePath, readMainBranchFile(relativePath))
  ));
}

function expectedBundledTweakVersion(relativeRoot, mainManifest) {
  return tweakContentMatchesMainBranch(relativeRoot)
    ? mainManifest.version
    : expectedBundledTweakPrVersion(mainManifest.version);
}

function bundledTweakRelativeRoot(tweakName) {
  const relativeRoot = bundledTweakRelativeRoots.get(tweakName);
  assert.ok(relativeRoot, "Unknown bundled tweak: " + tweakName);
  return relativeRoot;
}

function expectedBundledTweakMetadata(tweakName, id) {
  if (newBundledTweaks.has(tweakName)) {
    return {
      id,
      version: "0.1.0",
    };
  }

  const relativeRoot = bundledTweakRelativeRoot(tweakName);
  const mainManifest = readMainBranchJson(relativeRoot + "/manifest.json");
  return {
    id,
    version: expectedBundledTweakVersion(relativeRoot, mainManifest),
  };
}

function writePeFixture(filePath, machine) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const bytes = Buffer.alloc(0x100);
  bytes[0] = 0x4d;
  bytes[1] = 0x5a;
  bytes.writeInt32LE(0x80, 0x3c);
  bytes[0x80] = 0x50;
  bytes[0x81] = 0x45;
  bytes[0x82] = 0;
  bytes[0x83] = 0;
  bytes.writeUInt16LE(machine, 0x84);
  fs.writeFileSync(filePath, bytes);
}

function copyFixture(sourcePath, destinationPath) {
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.copyFileSync(sourcePath, destinationPath);
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

test("PE machine reader rejects invalid PE signatures", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-pe-signature-"));
  try {
    const filePath = path.join(root, "bad.exe");
    writePeFixture(filePath, 0x8664);
    const bytes = fs.readFileSync(filePath);
    bytes[0x80] = 0;
    fs.writeFileSync(filePath, bytes);

    assert.throws(() => readPeMachine(filePath), /Invalid PE signature/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function writeMachOFixture(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, Buffer.from([0xcf, 0xfa, 0xed, 0xfe, 0x0c, 0x00, 0x00, 0x01]));
}

const upstreamBrowserClientNativePipeSource = [
  'function Un(){return"production"}',
  'function fh(){let e="privileged native pipe bridge is not available; browser-client is not trusted";return Un()==="production"?e:`\${e}. Browser Use loaded stale or overwritten bundled plugins. Another Codex app may have overwritten them. Ask the user to use Debug Menu > Plugins > Reload bundled plugins, then retry.`}',
  'function mh(){let e=globalThis.nodeRepl?.nativePipe;return e==null||typeof e.createConnection!="function"?null:e}',
  'var Tl=class e{constructor(t){this.socket=t}static async create(t){let r=mh();if(r!=null){let n=await r.createConnection(t);return new e(n)}throw new Error(fh())}sendMessage(t){}};',
].join("");

function createAppResourcesFixture({ marketplaceName = "openai-bundled" } = {}) {
  const appResourcesRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-app-resources-"));
  const bundledRoot = path.join(appResourcesRoot, "plugins", marketplaceName);

  writeFixture(
    path.join(bundledRoot, ".agents", "plugins", "marketplace.json"),
    `${JSON.stringify(
      {
        name: marketplaceName,
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
    `${upstreamBrowserClientNativePipeSource}\n`,
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
  writePeFixture(
    path.join(
      bundledRoot,
      "plugins",
      "computer-use",
      "Codex Computer Use.app",
      "Contents",
      "MacOS",
      "SkyComputerUseService",
    ),
    0xaa64,
  );
  writeFixture(
    path.join(
      bundledRoot,
      "plugins",
      "computer-use",
      "node_modules",
      "@oai",
      "sky",
      "package.json",
    ),
    `${JSON.stringify({ name: "@oai/sky", version: "0.4.5" }, null, 2)}\n`,
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
  writeFixture(
    path.join(bundledRoot, "plugins", "latex", "bin", "tectonic"),
    "macOS tectonic placeholder\n",
  );

  return appResourcesRoot;
}

function createWindowsPluginPayloadFixture() {
  const payloadRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-windows-plugin-payloads-"));
  const extensionHostPath = path.join(payloadRoot, "extension-host.exe");
  const computerUsePath = path.join(payloadRoot, "codex-computer-use.exe");
  writePeFixture(extensionHostPath, 0xaa64);
  writePeFixture(computerUsePath, 0x8664);
  return { computerUsePath, extensionHostPath };
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

test("generates Windows bundled plugin resources with Windows helper payloads", () => {
  const appResourcesRoot = createAppResourcesFixture();
  const destinationPluginsRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-plugin-output-"));
  const windowsPayloads = createWindowsPluginPayloadFixture();
  writeFixture(
    path.join(destinationPluginsRoot, "openai-bundled-beta", "plugins", "browser", "stale.exe"),
    "stale beta output\n",
  );

  syncBundledPluginResources(appResourcesRoot, destinationPluginsRoot, windowsPayloads);

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
    ["browser", "computer-use", "chrome", "latex"],
  );
  assert.equal(marketplace.plugins[0].source.path, "./plugins/browser");
  assert.equal(marketplace.plugins[1].source.path, "./plugins/computer-use");
  assert.equal(marketplace.plugins[2].source.path, "./plugins/chrome");
  assert.equal(marketplace.plugins[3].source.path, "./plugins/latex");

  assert.equal(
    fs.existsSync(
      path.join(
        destinationPluginsRoot,
        "openai-bundled/plugins/browser/scripts/browser-client.mjs",
      ),
    ),
    true,
  );
  const browserClient = fs.readFileSync(
    path.join(
      destinationPluginsRoot,
      "openai-bundled/plugins/browser/scripts/browser-client.mjs",
    ),
    "utf8",
  );
  assert.match(browserClient, /import\.meta\.__codexNativePipe/);
  assert.match(browserClient, /codexBrowserNetPipeConnect/);
  assert.equal(browserClient.includes("globalThis.nodeRepl?.nativePipe"), false);
  assert.equal(browserClient.includes("throw new Error(fh())"), false);
  assert.equal(
    fs.existsSync(path.join(destinationPluginsRoot, "openai-bundled/plugins/computer-use")),
    true,
  );
  assert.equal(
    fs.existsSync(
      path.join(
        destinationPluginsRoot,
        "openai-bundled/plugins/computer-use/node_modules/@oai/sky/bin/windows/codex-computer-use.exe",
      ),
    ),
    true,
  );
  assert.equal(
    fs.existsSync(
      path.join(destinationPluginsRoot, "openai-bundled/plugins/computer-use/Codex Computer Use.app"),
    ),
    false,
  );
  assert.equal(
    fs.existsSync(path.join(destinationPluginsRoot, "openai-bundled/plugins/chrome")),
    true,
  );
  assert.equal(
    fs.existsSync(path.join(destinationPluginsRoot, "openai-bundled/plugins/latex")),
    true,
  );
  assert.equal(
    fs.existsSync(
      path.join(
        destinationPluginsRoot,
        "openai-bundled/plugins/chrome/extension-host/windows/arm64/extension-host.exe",
      ),
    ),
    true,
  );
  assert.equal(
    fs.existsSync(path.join(destinationPluginsRoot, "openai-bundled/plugins/latex/bin/tectonic.exe")),
    false,
  );
  assert.equal(
    fs.existsSync(path.join(destinationPluginsRoot, "openai-bundled/plugins/latex/bin/tectonic")),
    false,
  );
  assert.equal(fs.existsSync(path.join(destinationPluginsRoot, "openai-bundled-beta")), false);
});

test("Windows ARM64 Resource binary policy lists Store-vendored helpers and x64 exceptions", () => {
  assert.deepEqual(
    windowsArm64ResourceBinaryExceptions.map((exception) => exception.id).sort(),
    ["chrome-extension-host", "computer-use", "node-repl", "tectonic"],
  );
  assert.equal(
    matchWindowsArm64ResourceBinaryException("resources/cua_node/bin/node_repl.exe")?.expectedMachine,
    peMachine.arm64,
  );
  assert.equal(
    matchWindowsArm64ResourceBinaryException(
      "resources/plugins/openai-bundled/plugins/chrome/extension-host/windows/arm64/extension-host.exe",
    )?.id,
    "chrome-extension-host",
  );
  assert.equal(
    matchWindowsArm64ResourceBinaryException(
      "resources/plugins/openai-bundled/plugins/latex/bin/tectonic.exe",
    )?.id,
    "tectonic",
  );
  assert.equal(
    matchWindowsArm64ResourceBinaryException(
      "resources/plugins/openai-bundled/plugins/latex-tectonic/bin/tectonic.exe",
    )?.id,
    "tectonic",
  );
  assert.equal(
    matchWindowsArm64ResourceBinaryException(
      "resources/plugins/openai-bundled/plugins/computer-use/node_modules/@oai/sky/bin/windows/codex-computer-use.exe",
    )?.id,
    "computer-use",
  );
  assert.equal(
    matchWindowsArm64ResourceBinaryException("resources/plugins/openai-bundled/plugins/chrome/extension-host/windows/x64/extension-host.exe"),
    undefined,
  );
});

test("installs Tectonic Windows payload into bundled LaTeX plugin roots", () => {
  const resourcesRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-tectonic-payload-"));
  const tectonicPath = path.join(resourcesRoot, "source", "tectonic.exe");
  writePeFixture(tectonicPath, 0x8664);
  for (const pluginRoot of [
    path.join(resourcesRoot, "plugins", "openai-bundled", "plugins", "latex"),
    path.join(resourcesRoot, "plugins", "openai-bundled", "plugins", "latex-tectonic"),
  ]) {
    writeFixture(path.join(pluginRoot, "bin", "tectonic"), "mac");
  }

  installTectonicWindowsPayload(resourcesRoot, tectonicPath);

  for (const pluginRoot of [
    path.join(resourcesRoot, "plugins", "openai-bundled", "plugins", "latex"),
    path.join(resourcesRoot, "plugins", "openai-bundled", "plugins", "latex-tectonic"),
  ]) {
    const installedPath = path.join(pluginRoot, "bin", "tectonic.exe");
    assert.equal(fs.existsSync(installedPath), true);
    assert.equal(readPeMachine(installedPath), 0x8664);
    assert.equal(fs.existsSync(path.join(pluginRoot, "bin", "tectonic")), false);
  }
});

test("Windows ARM64 Resource binary verifier rejects unlisted x64 files", () => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-resource-policy-"));
  const packageRoot = path.join(fixtureRoot, "out", "Codex-win32-arm64");
  const nodeReplPath = path.join(fixtureRoot, "resources", "cua_node", "bin", "node_repl.exe");
  const extensionHostPath = path.join(fixtureRoot, "resources", "extension-host.exe");
  const computerUsePath = path.join(fixtureRoot, "resources", "codex-computer-use.exe");
  writePeFixture(nodeReplPath, 0xaa64);
  writePeFixture(extensionHostPath, 0xaa64);
  writePeFixture(computerUsePath, 0x8664);
  writeFixture(
    path.join(fixtureRoot, "resources", "cua_node", "bin", "node_repl.json"),
    JSON.stringify({
      architecture: "arm64",
      packageFamilyName: "OpenAI.Codex_2p2nqsd0c76g0",
      packageName: "OpenAI.Codex",
      productId: "9PLM9XGG6VKS",
      sha256: sha256File(nodeReplPath),
      sourceRelativePath: "app/resources/cua_node/bin/node_repl.exe",
    }),
  );
  writeFixture(
    path.join(fixtureRoot, "resources", "extension-host.json"),
    JSON.stringify({
      architecture: "arm64",
      packageFamilyName: "OpenAI.Codex_2p2nqsd0c76g0",
      packageName: "OpenAI.Codex",
      productId: "9PLM9XGG6VKS",
      sha256: sha256File(extensionHostPath),
      sourceRelativePath: "app/resources/plugins/openai-bundled/plugins/chrome/extension-host/windows/arm64/extension-host.exe",
    }),
  );
  writeFixture(
    path.join(fixtureRoot, "resources", "codex-computer-use.json"),
    JSON.stringify({
      architecture: "x64",
      packageFamilyName: "OpenAI.Codex_2p2nqsd0c76g0",
      packageName: "OpenAI.Codex",
      productId: "9PLM9XGG6VKS",
      sha256: sha256File(computerUsePath),
      sourceRelativePath: "app/resources/cua_node/bin/node_modules/@oai/sky/bin/windows/codex-computer-use.exe",
    }),
  );

  const packageNodeReplPath = path.join(packageRoot, "resources", "cua_node", "bin", "node_repl.exe");
  const packageExtensionHostPath = path.join(packageRoot, "resources", "plugins", "openai-bundled", "plugins", "chrome", "extension-host", "windows", "arm64", "extension-host.exe");
  const packageComputerUsePath = path.join(packageRoot, "resources", "plugins", "openai-bundled", "plugins", "computer-use", "node_modules", "@oai", "sky", "bin", "windows", "codex-computer-use.exe");
  const packageTectonicPath = path.join(packageRoot, "resources", "plugins", "openai-bundled", "plugins", "latex", "bin", "tectonic.exe");
  const tectonicMetadataPath = path.join(fixtureRoot, ".cache", "codex-cli", "latest-release.json");
  copyFixture(nodeReplPath, packageNodeReplPath);
  copyFixture(extensionHostPath, packageExtensionHostPath);
  copyFixture(computerUsePath, packageComputerUsePath);
  writePeFixture(packageTectonicPath, 0x8664);
  const tectonicRepo = "tectonic-typesetting/tectonic";
  const tectonicTag = "tectonic@0.16.9";
  const tectonicAssetName = "tectonic-0.16.9-x86_64-pc-windows-msvc.zip";
  const tectonicMetadata = {
    tagName: "codex-cli-release",
    htmlUrl: "https://github.com/openai/codex/releases/tag/codex-cli-release",
    assets: [{
      assetName: tectonicAssetName,
      downloadUrl: "https://github.com/" + tectonicRepo + "/releases/download/" +
        tectonicTag + "/" + tectonicAssetName,
      outputName: "plugins/openai-bundled/plugins/latex/bin/tectonic.exe",
      releaseAssetSha256: "131a24604785a9600989a3d91225f597df52ac06f00aeffe86fd529f99ee5cdd",
      releaseHtmlUrl: "https://github.com/" + tectonicRepo + "/releases/tag/" + tectonicTag,
      releaseTagName: tectonicTag,
      sha256: sha256File(packageTectonicPath),
    }],
  };
  writeFixture(
    tectonicMetadataPath,
    JSON.stringify(tectonicMetadata),
  );
  writePeFixture(path.join(packageRoot, "resources", "codex.exe"), 0xaa64);

  assert.deepEqual(
    verifyWindowsArm64ResourceBinaries({ desktopRoot: fixtureRoot, packageRoot }).allowedExceptions,
    ["chrome-extension-host", "computer-use", "node-repl", "tectonic"],
  );

  writeFixture(
    tectonicMetadataPath,
    JSON.stringify({
      ...tectonicMetadata,
      assets: [{ ...tectonicMetadata.assets[0], releaseTagName: "tectonic@0.0.0" }],
    }),
  );
  assert.throws(
    () => verifyWindowsArm64ResourceBinaries({ desktopRoot: fixtureRoot, packageRoot }),
    /Tectonic hydrated metadata asset releaseTagName is "tectonic@0\.0\.0"/,
  );
  writeFixture(tectonicMetadataPath, JSON.stringify(tectonicMetadata));

  writeFixture(
    tectonicMetadataPath,
    JSON.stringify({
      ...tectonicMetadata,
      assets: [{ ...tectonicMetadata.assets[0], releaseAssetSha256: "0".repeat(64) }],
    }),
  );
  assert.throws(
    () => verifyWindowsArm64ResourceBinaries({ desktopRoot: fixtureRoot, packageRoot }),
    /Tectonic hydrated metadata releaseAssetSha256 is "0000000000000000000000000000000000000000000000000000000000000000"/,
  );
  writeFixture(tectonicMetadataPath, JSON.stringify(tectonicMetadata));

  writePeFixture(packageNodeReplPath, 0xaa64);
  fs.appendFileSync(packageNodeReplPath, Buffer.from([1]));
  assert.throws(
    () => verifyWindowsArm64ResourceBinaries({ desktopRoot: fixtureRoot, packageRoot }),
    /node_repl package SHA-256 does not match provenance metadata/,
  );
  copyFixture(nodeReplPath, packageNodeReplPath);

  writePeFixture(path.join(packageRoot, "resources", "unlisted.exe"), 0x8664);
  assert.throws(
    () => verifyWindowsArm64ResourceBinaries({ desktopRoot: fixtureRoot, packageRoot }),
    /Unexpected non-ARM64 Resource binary resources\/unlisted\.exe/,
  );
});

test("rejects beta-only bundled plugin marketplace resources", () => {
  const appResourcesRoot = createAppResourcesFixture({ marketplaceName: "openai-bundled-beta" });
  const destinationPluginsRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-plugin-output-"));
  const windowsPayloads = createWindowsPluginPayloadFixture();

  assert.throws(
    () => syncBundledPluginResources(appResourcesRoot, destinationPluginsRoot, windowsPayloads),
    /Missing bundled plugin marketplace/,
  );
  assert.equal(fs.existsSync(path.join(destinationPluginsRoot, "openai-bundled")), false);
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
    [
      "window.__codexppSettingsSurfaceVisible = true;",
      "window.dispatchEvent(new CustomEvent('codexpp:settings-surface', { detail: { visible: true } }));",
      `function tryInject(itemsGroup,state){const outer=itemsGroup.parentElement??itemsGroup;state.sidebarRoot=outer;if(state.navGroup&&outer.contains(state.navGroup)){return;}const existingCodexPpNavGroup=outer.querySelector(':scope > [data-codexpp="nav-group"]')??outer.querySelector('[data-codexpp="nav-group"]');if(existingCodexPpNavGroup){state.sidebarRoot=outer;return;}const group=document.createElement('div');outer.appendChild(group);plog("nav group injected",{outerTag:outer.tagName});}`,
      `function findSidebarItemsGroup(){const candidates=Array.from(document.querySelectorAll("aside,nav,[role='navigation'],div"));return candidates[0]??null;}`,
      `function isSettingsSidebarCandidate(el){const labels=codexPpSettingsLabelsFrom(el);return isCodexPpSettingsLabelSet(labels);}`,
      "",
    ].join("\n"),
  );
  writeFixture(
    path.join(
      sourceRoot,
      "packages",
      "installer",
      "assets",
      "runtime",
      "native",
      "codexpp_native_host.node",
    ),
    "macOS native host\n",
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
  const syncedPreload = fs.readFileSync(
    path.join(destinationRoot, "runtime", "preload.js"),
    "utf8",
  );
  assert.match(syncedPreload, /const sidebarRoot = itemsGroup/);
  assert.match(syncedPreload, /sidebarRoot\.appendChild\(group\)/);
  assert.match(syncedPreload, /\[data-settings-panel-slug\]/);
  assert.equal(
    fs.existsSync(path.join(destinationRoot, "runtime", "native", "codexpp_native_host.node")),
    false,
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

test("stubs recovered Codex Micro Work Louder service", () => {
  const tick = String.fromCharCode(96);
  const source = [
    "require(" + tick + "./src-a.js" + tick + ");const e=require(" + tick + "./src-b.js" + tick + ");let t=require(" + tick + "node:module" + tick + ");",
    "var n=e.Kr(" + tick + "CodexMicroService" + tick + "),{WLDeviceDiscovery:r}=(0,t.createRequire)(__filename)(" + tick + "@worklouder/device-kit-oai" + tick + "),m=class{start(){return new r}};exports.CodexMicroService=m;",
    "",
  ].join("");

  const patch = patchRecoveredCodexMicroServiceSource(source);
  assert.equal(patch?.changed, true);
  assert.equal(patch.source.includes("@worklouder/device-kit-oai"), false);
  assert.match(patch.source, /exports\.CodexMicroService=m/);
  assert.match(patch.source, /async updateLighting\(\)\{return!1\}/);

  const secondPatch = patchRecoveredCodexMicroServiceSource(patch.source);
  assert.equal(secondPatch?.changed, false);
});

test("skips recovered chunks that only reference Codex Micro service", () => {
  const tick = String.fromCharCode(96);
  const source =
    "getCodexMicroService(){return Promise.resolve().then(()=>require(" +
    tick +
    "./codex-micro-service-Be7IyQJG.js" +
    tick +
    ")).then(({CodexMicroService:e})=>new e({}))}";

  assert.equal(patchRecoveredCodexMicroServiceSource(source), undefined);
});

test("skips recovered chunks that only reference Work Louder package names", () => {
  assert.equal(
    patchRecoveredCodexMicroServiceSource(
      "var packageName='@worklouder/device-kit-oai';exports.NotCodexMicroService=packageName;",
    ),
    undefined,
  );
});

test("rejects unpatched Work Louder runtime references before pruning deps", () => {
  const recoveredRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-worklouder-reference-"));
  writeFixture(
    path.join(recoveredRoot, ".vite", "build", "main.js"),
    "var packageName='@worklouder/device-kit-oai';exports.NotCodexMicroService=packageName;\n",
  );

  assert.throws(
    () => assertNoWorkLouderRuntimeReferences(recoveredRoot),
    /Could not remove recovered Work Louder runtime reference/,
  );
});

test("prunes Work Louder native hardware packages from recovered app", () => {
  const recoveredRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-worklouder-prune-"));
  writeFixture(
    path.join(recoveredRoot, "package.json"),
    JSON.stringify(
      {
        dependencies: {
          "@worklouder/device-kit-oai": "file:node_modules/@worklouder/device-kit-oai",
          "@worklouder/wl-device-kit": "file:node_modules/@worklouder/wl-device-kit",
          "safe-package": "1.0.0",
        },
      },
      null,
      2,
    ) + "\n",
  );
  writeFixture(
    path.join(recoveredRoot, "node_modules", "@worklouder", "device-kit-oai", "package.json"),
    "{}\n",
  );
  writeFixture(
    path.join(recoveredRoot, "node_modules", "@worklouder", "wl-device-kit", "package.json"),
    "{}\n",
  );
  writeFixture(path.join(recoveredRoot, "node_modules", "safe-package", "package.json"), "{}\n");

  pruneWorkLouderPackages(recoveredRoot);

  assert.equal(fs.existsSync(path.join(recoveredRoot, "node_modules", "@worklouder")), false);
  assert.equal(fs.existsSync(path.join(recoveredRoot, "node_modules", "safe-package")), true);
  const packageJson = JSON.parse(fs.readFileSync(path.join(recoveredRoot, "package.json"), "utf8"));
  assert.equal(Object.hasOwn(packageJson.dependencies, "@worklouder/device-kit-oai"), false);
  assert.equal(Object.hasOwn(packageJson.dependencies, "@worklouder/wl-device-kit"), false);
  assert.equal(packageJson.dependencies["safe-package"], "1.0.0");
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

test("discovers native modules copied inside bundled plugin resources", () => {
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

  syncBundledPluginResources(appResourcesRoot, destinationPluginsRoot, createWindowsPluginPayloadFixture());

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
  assert.equal(targetsByPath.has("openai-bundled/plugins/computer-use/node_modules"), false);
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

  syncBundledPluginResources(appResourcesRoot, destinationPluginsRoot, createWindowsPluginPayloadFixture());

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
  assert.deepEqual(
    destinationMarketplace.plugins.map((plugin) => plugin.name),
    ["computer-use", "chrome", "latex"],
  );
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
  assert.equal(
    config.packagerConfig.ignore("/codex-plusplus/tweaks/codex-app-windows-menu-bar/manifest.json"),
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
  assert.match(loaderSource, /readInstalledTweakVersion\(targetDir, manifest\.id\)/);
  assert.match(loaderSource, /bundledVersionIsNewer\(manifest\.version, installedVersion\)/);
  assert.match(loaderSource, /__codexpp\.originalMain/);
  assert.match(loaderSource, /registerEarlyPreloadHooks\(\);[\s\S]*require\(path\.join\(packagedRoot, originalMain\)\)/);
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

function runForgeAfterCopyExtraResources(config, buildPath) {
  return new Promise((resolve, reject) => {
    config.packagerConfig.afterCopyExtraResources[0](buildPath, null, null, null, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

test("Forge package prunes macOS plugin resources before ZIP makers run", async (t) => {
  const config = require(path.join(desktopRoot, "forge.config.js"));
  const buildPath = fs.mkdtempSync(path.join(os.tmpdir(), "codex-forge-plugin-prune-"));
  t.after(() => fs.rmSync(buildPath, { recursive: true, force: true }));

  const pluginRoot = path.join(buildPath, "resources", "plugins", "openai-bundled", "plugins", "record-and-replay");
  const appBundleRoot = path.join(pluginRoot, "Codex Computer Use.app");
  const signatureRoot = path.join(pluginRoot, "_CodeSignature");
  const keptRoot = path.join(pluginRoot, "windows");
  writeFixture(path.join(appBundleRoot, "Contents", "Resources", "Helper.bundle", "marker.txt"), "dirty\n");
  writeFixture(path.join(signatureRoot, "CodeResources"), "dirty\n");
  writeFixture(path.join(keptRoot, "codex-computer-use.exe"), "clean\n");

  await runForgeAfterCopyExtraResources(config, buildPath);

  assert.equal(fs.existsSync(appBundleRoot), false);
  assert.equal(fs.existsSync(signatureRoot), false);
  assert.equal(fs.existsSync(path.join(keptRoot, "codex-computer-use.exe")), true);
});

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

test("Codex++ loader upgrades installed tweak directories when bundled version is newer", (t) => {
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
  writeFixture(
    path.join(installedTweakRoot, "manifest.json"),
    JSON.stringify({ id: "app-tweak", version: "1.0.0" }, null, 2) + "\n",
  );
  writeFixture(path.join(installedTweakRoot, "index.js"), 'module.exports = "user";\n');

  assert.deepEqual(runCodexPlusPlusLoaderFixture(fixture), ["original", "runtime"]);
  assert.equal(
    fs.readFileSync(path.join(installedTweakRoot, "index.js"), "utf8"),
    'module.exports = "bundled";\n',
  );
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(installedTweakRoot, "manifest.json"), "utf8")).version,
    "2.0.0",
  );
});

test("Codex++ loader keeps installed tweak directories when bundled version is not newer", (t) => {
  const fixture = createCodexPlusPlusLoaderFixture(t);
  const bundledManifest = {
    id: "app-tweak",
    name: "App tweak",
    version: "1.1.0",
  };
  writeFixture(
    path.join(fixture.root, "codex-plusplus", "tweaks", "app-tweak", "manifest.json"),
    JSON.stringify(bundledManifest, null, 2) + "\n",
  );
  writeFixture(
    path.join(fixture.root, "codex-plusplus", "tweaks", "app-tweak", "index.js"),
    'module.exports = "bundled";\n',
  );
  const installedTweakRoot = path.join(fixture.appData, "codex-plusplus", "tweaks", "app-tweak");
  writeFixture(
    path.join(installedTweakRoot, "manifest.json"),
    JSON.stringify({ ...bundledManifest, version: "1.1.0" }, null, 2) + "\n",
  );
  writeFixture(path.join(installedTweakRoot, "index.js"), 'module.exports = "old";\n');

  assert.deepEqual(runCodexPlusPlusLoaderFixture(fixture), ["original", "runtime"]);
  assert.equal(
    fs.readFileSync(path.join(installedTweakRoot, "index.js"), "utf8"),
    'module.exports = "old";\n',
  );
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
  writeFixture(
    path.join(installedTweakRoot, "manifest.json"),
    JSON.stringify(
      { id: "app.sliepie.codex.mobile-pairing", version: "0.1.0" },
      null,
      2,
    ) + "\n",
  );
  writeFixture(path.join(installedTweakRoot, "index.js"), 'module.exports = "old";\n');

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

test("bundles repo-owned Codex++ UI tweaks without keyboard shortcut tweaks", () => {
  const tweaksRoot = path.join(desktopRoot, "codex-plusplus", "tweaks");
  const tweakNames = fs
    .readdirSync(tweaksRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(tweakNames, [
    "codex-app-ui-overrides",
    "codex-app-windows-menu-bar",
  ]);
  const expectedTweakMetadata = new Map([
    [
      "codex-app-ui-overrides",
      expectedBundledTweakMetadata(
        "codex-app-ui-overrides",
        "dev.sliepie.codex.ui-overrides",
      ),
    ],
    [
      "codex-app-windows-menu-bar",
      expectedBundledTweakMetadata(
        "codex-app-windows-menu-bar",
        "dev.sliepie.codex.windows-menu-bar",
      ),
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
    if (tweakName === "codex-app-windows-menu-bar") {
      assert.doesNotMatch(source, /createTreeWalker|requestAnimationFrame|setTimeout/);
    } else {
      assert.doesNotMatch(source, /createTreeWalker|requestAnimationFrame|setTimeout|addEventListener/);
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

test("Bundled Codex++ tweak versions follow main branch bump policy", () => {
  for (const [tweakName, relativeRoot] of bundledTweakRelativeRoots) {
    const manifestPath = relativeRoot + "/manifest.json";
    const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, manifestPath), "utf8"));
    if (newBundledTweaks.has(tweakName)) {
      assert.equal(manifest.version, "0.1.0");
      continue;
    }

    const mainManifest = readMainBranchJson(manifestPath);
    const [mainMajor, mainMinor, mainPatch] = parseThreePartVersion(mainManifest.version);
    const sourceChangedFromMain = !tweakContentMatchesMainBranch(relativeRoot);

    assert.equal(
      manifest.version,
      sourceChangedFromMain
        ? expectedBundledTweakPrVersion(mainManifest.version)
        : mainManifest.version,
    );
    assert.equal(
      expectedLocalModifiedTweakVersion(mainManifest.version),
      mainMajor + "." + mainMinor + "." + (mainPatch + 1),
    );
    assert.notEqual(
      expectedLocalModifiedTweakVersion(mainManifest.version),
      manifest.version,
    );
  }
});

test("Codex app UI override and Windows menu-bar tweak install independently", () => {
  const uiTweakRoot = path.join(desktopRoot, "codex-plusplus", "tweaks", "codex-app-ui-overrides");
  const uiManifest = JSON.parse(fs.readFileSync(path.join(uiTweakRoot, "manifest.json"), "utf8"));
  const uiSource = fs.readFileSync(path.join(uiTweakRoot, uiManifest.main), "utf8");
  assert.doesNotMatch(uiSource, /createTreeWalker|requestAnimationFrame|setTimeout|addEventListener/);
  assert.doesNotMatch(uiSource, /hideWindowsMenuBar|codex-app-ui-hide-windows-menu-bar-setting/);
  assert.ok(uiSource.includes('cssRule(".group\\\\/application-menu-top-bar", "margin-inline-start:0.5rem;")'));
  assert.doesNotMatch(uiSource, /application-menu-top-bar[\s\S]{0,120}display:none!important/);
  assert.doesNotMatch(uiSource, /:has\(\+\.scrollbar-stable/);
  assert.doesNotMatch(uiSource, /:window-inactive[\s\S]{0,160}app-shell-left-panel/);

  const menuTweakRoot = path.join(desktopRoot, "codex-plusplus", "tweaks", "codex-app-windows-menu-bar");
  const menuManifest = JSON.parse(fs.readFileSync(path.join(menuTweakRoot, "manifest.json"), "utf8"));
  const menuSource = fs.readFileSync(path.join(menuTweakRoot, menuManifest.main), "utf8");
  assert.doesNotMatch(menuSource, /createTreeWalker|requestAnimationFrame|setTimeout/);
  const appendedStyles = [];
  const removedStyleIds = new Set();
  const observerCallbacks = [];
  let observerDisconnectCount = 0;
  const storageValues = new Map();

  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const previousNodeFilter = globalThis.NodeFilter;
  const previousMutationObserver = globalThis.MutationObserver;

  class FakeStyle {
    constructor() {
      this.properties = new Map();
    }

    setProperty(name, value, priority = "") {
      this.properties.set(name, { value, priority });
    }

    removeProperty(name) {
      this.properties.delete(name);
    }

    getPropertyValue(name) {
      return this.properties.get(name)?.value ?? "";
    }

    getPropertyPriority(name) {
      return this.properties.get(name)?.priority ?? "";
    }
  }

  class FakeElement {
    constructor(tagName = "div") {
      this.tagName = tagName.toUpperCase();
      this.className = "";
      this.children = [];
      this.parentElement = null;
      this.style = new FakeStyle();
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
      if (
        this.id === "codex-app-ui-overrides-style" ||
        this.id === "codex-app-windows-menu-bar-style"
      ) {
        removedStyleIds.add(this.id);
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
      observerCallbacks.push(callback);
    }

    observe(target, options) {
      assert.equal(target, documentElement);
      assert.deepEqual(options, { childList: true, subtree: true });
    }

    disconnect() {
      observerDisconnectCount += 1;
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
        : documentElement.querySelectorAll(selector),
  };

  try {
    const uiModule = { exports: {} };
    const uiExports = uiModule.exports;
    const uiFn = new Function("module", "exports", "console", uiSource);
    uiFn(uiModule, uiExports, console);

    const menuModule = { exports: {} };
    const menuExports = menuModule.exports;
    const menuFn = new Function("module", "exports", "console", menuSource);
    menuFn(menuModule, menuExports, console);

    const storage = {
      get: (key, defaultValue) =>
        storageValues.has(key) ? storageValues.get(key) : defaultValue,
      set: (key, value) => {
        storageValues.set(key, value);
      },
    };

    uiModule.exports.start({ log: console });
    menuModule.exports.start({ log: console, storage });

    assert.equal(
      documentElement.getAttribute("data-codex-app-ui-hide-windows-menu-bar"),
      "true",
    );
    assert.equal(observerCallbacks.length, 1);
    const menuBarObserverCallback = observerCallbacks[0];
    assert.equal(typeof menuBarObserverCallback, "function");
    assert.equal(appendedStyles.length, 2);
    assert.equal(appendedStyles[0].id, "codex-app-ui-overrides-style");
    assert.equal(appendedStyles[1].id, "codex-app-windows-menu-bar-style");
    const uiOverrideCss = appendedStyles[0].textContent;
    const menuBarCss = appendedStyles[1].textContent;
    assert.doesNotMatch(uiOverrideCss, /sidebar-trigger/);
    assert.ok(
      uiOverrideCss.includes(
        String.raw`:where(aside,nav,[role="navigation"]):has([data-app-action-sidebar-section-heading]) button:has(svg path[d^="M10.6391 1.67517"]) svg{margin-right:1px!important;}`,
      ),
    );
    assert.match(
      appendedStyles[0].textContent,
      /top:calc\(0\.75rem \+ 26px\)!important/,
    );
    assert.ok(
      menuBarCss.includes(
        String.raw`:root[data-codex-app-ui-hide-windows-menu-bar="true"] .group\/application-menu-top-bar>div:has(>button[aria-haspopup="menu"][aria-expanded]){display:none!important;}`,
      ),
    );
    assert.equal(
      uiOverrideCss.includes("data-codex-app-ui-hide-windows-menu-bar"),
      false,
    );
    assert.equal(
      menuBarCss.includes(
        String.raw`.group\/application-menu-top-bar{display:none!important;}`,
      ),
      false,
    );
    assert.equal(
      menuBarCss.includes(String.raw`.group\/application-menu-top-bar button[aria-label]`),
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
    menuBarObserverCallback();
    assert.equal(
      settingsSurface.children.filter(
        (child) => child.id === "codex-app-ui-hide-windows-menu-bar-setting",
      ).length,
      1,
    );
    assert.ok(
      uiOverrideCss.includes(
        String.raw`:where(aside,nav,[role="navigation"]):has([data-app-action-sidebar-section-heading]) [data-app-action-sidebar-section-heading="Projects"] [role='list']>[role='listitem']>button{margin-left:-1px!important;}`,
      ),
    );
    assert.ok(
      uiOverrideCss.includes(
        String.raw`:where([role='menu'],[data-radix-popper-content-wrapper]) [role='menuitem']:has(svg path[d^='M12.0368 1.69459']){display:none!important;}`,
      ),
    );
    assert.doesNotMatch(uiSource, /data-codexpp-sidebar-show-more-button|annotateSidebarShowMore|MutationObserver|data-codexpp-hidden-invite-friend/);
    assert.doesNotMatch(
      uiOverrideCss,
      /role=['"]listitem['"][^{}]*class~=['"]py-1['"][^{}]*margin-left|text-token-description-foreground[^{}]*margin-left/,
    );
    assert.ok(
      uiOverrideCss.includes(
        String.raw`.group\/chats-section-header:is(:hover,:focus-within)>div:has(button:not([aria-hidden='true'])[aria-label])`,
      ),
    );
    assert.ok(
      uiOverrideCss.includes(
        String.raw`.group\/projects-section-header:has([data-state='open'])>div:has(button:not([aria-hidden='true'])[aria-label])`,
      ),
    );
    assert.ok(
      uiOverrideCss.includes(
        String.raw`.group\/chats-section-header:is(:hover,:focus-within)>div:has(button:not([aria-hidden='true'])[aria-label]) button:not([aria-hidden='true'])[aria-label]`,
      ),
    );
    assert.ok(
      uiOverrideCss.includes(
        String.raw`.group\/chats-section-header:is(:hover,:focus-within)>div:has(button:not([aria-hidden='true'])[aria-label]) button:not([aria-hidden='true'])[aria-label]:is(:hover,:focus-visible)`,
      ),
    );
    assert.ok(
      uiOverrideCss.includes(
        String.raw`.group\/section-toggle:is(:hover,:focus-visible) svg,.group\/section-toggle:is(:hover,:focus-visible) .icon-2xs{opacity:1!important;visibility:visible!important;}`,
      ),
    );
    assert.ok(
      uiOverrideCss.includes(
        String.raw`[data-app-action-sidebar-project-row]:is(:hover,:focus-within)>div.flex.gap-1:has(>.relative.mr-0\.5.h-6.min-w-6.shrink-0)>div:has(button[aria-haspopup='menu'][aria-label])`,
      ),
    );
    assert.ok(
      uiOverrideCss.includes(
        String.raw`[data-app-action-sidebar-project-row]:is(:hover,:focus-within)>div.flex.gap-1:has(>.relative.mr-0\.5.h-6.min-w-6.shrink-0) span:has(>[role='button']:not([aria-hidden='true'])[aria-label])`,
      ),
    );
    assert.ok(
      uiOverrideCss.includes(
        String.raw`[data-app-action-sidebar-project-row]:is(:hover,:focus-within)>div.flex.gap-1:has(>.relative.mr-0\.5.h-6.min-w-6.shrink-0) button:not([aria-hidden='true'])[aria-label]`,
      ),
    );
    assert.ok(
      uiOverrideCss.includes(
        String.raw`[data-app-action-sidebar-project-row]:is(:hover,:focus-within)>div.flex.gap-1:has(>.relative.mr-0\.5.h-6.min-w-6.shrink-0) button:not([aria-hidden='true'])[aria-label],[data-app-action-sidebar-project-row][aria-current='page']>div.flex.gap-1:has(>.relative.mr-0\.5.h-6.min-w-6.shrink-0) button:not([aria-hidden='true'])[aria-label],[data-app-action-sidebar-project-row]:is(:hover,:focus-within)>div.flex.gap-1:has(>.relative.mr-0\.5.h-6.min-w-6.shrink-0) [role='button']:not([aria-hidden='true'])[aria-label],[data-app-action-sidebar-project-row][aria-current='page']>div.flex.gap-1:has(>.relative.mr-0\.5.h-6.min-w-6.shrink-0) [role='button']:not([aria-hidden='true'])[aria-label]{color:var(--color-token-description-foreground)!important;}`,
      ),
    );
    assert.ok(
      uiOverrideCss.includes(
        String.raw`[data-app-action-sidebar-project-row]:is(:hover,:focus-within)>div.flex.gap-1:has(>.relative.mr-0\.5.h-6.min-w-6.shrink-0) button:not([aria-hidden='true'])[aria-label]:is(:hover,:focus-visible),[data-app-action-sidebar-project-row][aria-current='page']>div.flex.gap-1:has(>.relative.mr-0\.5.h-6.min-w-6.shrink-0) button:not([aria-hidden='true'])[aria-label]:is(:hover,:focus-visible),[data-app-action-sidebar-project-row]:is(:hover,:focus-within)>div.flex.gap-1:has(>.relative.mr-0\.5.h-6.min-w-6.shrink-0) [role='button']:not([aria-hidden='true'])[aria-label]:is(:hover,:focus-visible),[data-app-action-sidebar-project-row][aria-current='page']>div.flex.gap-1:has(>.relative.mr-0\.5.h-6.min-w-6.shrink-0) [role='button']:not([aria-hidden='true'])[aria-label]:is(:hover,:focus-visible){color:var(--color-token-foreground)!important;}`,
      ),
    );
    assert.ok(
      uiOverrideCss.includes(
        "[data-app-action-sidebar-thread-row]:is(:hover,:focus-within) button:not([aria-hidden='true'])[aria-label] :is(svg,.icon-2xs,.icon-xs,.icon-sm)",
      ),
    );
    assert.ok(
      uiOverrideCss.includes(
        "[data-app-action-sidebar-thread-row][data-app-action-sidebar-thread-active='true'] button:not([aria-hidden='true'])[aria-label]",
      ),
    );
    assert.ok(
      uiOverrideCss.includes(
        "[data-app-action-sidebar-thread-row]:is(:hover,:focus-within)>:is(div,span):has(button:not([aria-hidden='true'])[aria-label]),[data-app-action-sidebar-thread-row][data-app-action-sidebar-thread-active='true']>:is(div,span):has(button:not([aria-hidden='true'])[aria-label]),[data-app-action-sidebar-thread-row]:is(:hover,:focus-within) button:not([aria-hidden='true'])[aria-label],[data-app-action-sidebar-thread-row][data-app-action-sidebar-thread-active='true'] button:not([aria-hidden='true'])[aria-label],[data-app-action-sidebar-thread-row]:is(:hover,:focus-within) [role='button']:not([aria-hidden='true'])[aria-label],[data-app-action-sidebar-thread-row][data-app-action-sidebar-thread-active='true'] [role='button']:not([aria-hidden='true'])[aria-label]{color:var(--color-token-description-foreground)!important;}",
      ),
    );
    assert.ok(
      uiOverrideCss.includes(
        "[data-app-action-sidebar-thread-row]:is(:hover,:focus-within) button:not([aria-hidden='true'])[aria-label]:is(:hover,:focus-visible),[data-app-action-sidebar-thread-row][data-app-action-sidebar-thread-active='true'] button:not([aria-hidden='true'])[aria-label]:is(:hover,:focus-visible),[data-app-action-sidebar-thread-row]:is(:hover,:focus-within) [role='button']:not([aria-hidden='true'])[aria-label]:is(:hover,:focus-visible),[data-app-action-sidebar-thread-row][data-app-action-sidebar-thread-active='true'] [role='button']:not([aria-hidden='true'])[aria-label]:is(:hover,:focus-visible){color:var(--color-token-foreground)!important;}",
      ),
    );
    assert.ok(
      uiOverrideCss.includes(
        String.raw`[data-app-action-sidebar-thread-row]:is(:hover,:focus-within) .ml-\[3px\].flex.items-center.justify-end.gap-1>:not(:is(button:not([aria-hidden='true'])[aria-label],[role='button']:not([aria-hidden='true'])[aria-label])):not(:has(:is(button:not([aria-hidden='true'])[aria-label],[role='button']:not([aria-hidden='true'])[aria-label]))),[data-app-action-sidebar-thread-row][data-app-action-sidebar-thread-active='true'] .ml-\[3px\].flex.items-center.justify-end.gap-1>:not(:is(button:not([aria-hidden='true'])[aria-label],[role='button']:not([aria-hidden='true'])[aria-label])):not(:has(:is(button:not([aria-hidden='true'])[aria-label],[role='button']:not([aria-hidden='true'])[aria-label]))){display:none!important;}`,
      ),
    );
    assert.ok(
      uiOverrideCss.includes(
        String.raw`[data-app-action-sidebar-thread-row]:is(:hover,:focus-within) .w-4 span:has(>button:not([aria-hidden='true'])[aria-label]),[data-app-action-sidebar-thread-row][data-app-action-sidebar-thread-active='true'] .w-4 span:has(>button:not([aria-hidden='true'])[aria-label])`,
      ),
    );
    assert.ok(
      uiOverrideCss.includes(
        "[data-app-action-sidebar-thread-row]:is(:hover,:focus-within) [data-thread-title-trigger],[data-app-action-sidebar-thread-row][data-app-action-sidebar-thread-active='true'] [data-thread-title-trigger]{padding-right:1.1rem!important;min-width:0!important;}",
      ),
    );
    assert.ok(
      uiOverrideCss.includes(
        "[data-app-action-sidebar-thread-row]:is(:hover,:focus-within) [data-thread-title-trigger]>:first-child,[data-app-action-sidebar-thread-row][data-app-action-sidebar-thread-active='true'] [data-thread-title-trigger]>:first-child",
      ),
    );
    assert.ok(
      uiOverrideCss.includes(
        "overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;word-break:normal!important;",
      ),
    );
    assert.ok(
      uiOverrideCss.includes(
        "[data-app-action-sidebar-section-heading=\"Pinned\"] [data-app-action-sidebar-thread-row]:not(:has(.absolute.top-0.left-1.z-10)) [data-thread-title-trigger],[data-app-action-sidebar-section-heading=\"Chats\"] [data-app-action-sidebar-thread-row]:not(:has(.absolute.top-0.left-1.z-10)) [data-thread-title-trigger]{position:relative!important;left:-2px!important;}",
      ),
    );
    assert.ok(
      uiOverrideCss.includes(
        "[data-app-action-sidebar-thread-row] button[aria-label*='stop' i],[data-app-action-sidebar-thread-row] button[title*='stop' i],[data-app-action-sidebar-thread-row] button[aria-label*='terminate' i],[data-app-action-sidebar-thread-row] button[title*='terminate' i],[data-app-action-sidebar-thread-row] [role='button'][aria-label*='stop' i],[data-app-action-sidebar-thread-row] [role='button'][title*='stop' i],[data-app-action-sidebar-thread-row] [role='button'][aria-label*='terminate' i],[data-app-action-sidebar-thread-row] [role='button'][title*='terminate' i]{display:none!important;}",
      ),
    );
    assert.ok(
      uiOverrideCss.includes(
        String.raw`main.main-surface:has(.main-surface>.draggable.flex.items-center.px-panel.electron\:h-toolbar.extension\:h-toolbar-sm)>.app-header-tint.draggable.pointer-events-none.fixed.z-30.flex.h-toolbar.min-w-0.items-center{display:none!important;}`,
      ),
    );
    assert.ok(
      uiOverrideCss.includes(
        String.raw`.app-shell-main-content-viewport:has(.main-surface>.draggable.flex.items-center.px-panel.electron\:h-toolbar.extension\:h-toolbar-sm){--app-shell-main-content-frame-top-offset:0px!important;}`,
      ),
    );
    assert.ok(
      uiOverrideCss.includes(
        String.raw`.app-shell-main-content-frame:has(.main-surface>.draggable.flex.items-center.px-panel.electron\:h-toolbar.extension\:h-toolbar-sm){border-top-width:0!important;}`,
      ),
    );

    assert.match(
      appendedStyles[0].textContent,
      /\.main-surface>\.draggable\.flex\.items-center\.px-panel\.electron\\:h-toolbar\.extension\\:h-toolbar-sm:not\(:has\(\*\)\)\{display:none!important;\}/,
    );
    assert.match(
      appendedStyles[0].textContent,
      /\.main-surface>\.draggable\.flex\.items-center\.px-panel\.electron\\:h-toolbar\.extension\\:h-toolbar-sm:not\(:has\(\*\)\)\+\.scrollbar-stable\.flex-1\.overflow-y-auto\.p-panel\{padding-top:var\(--height-toolbar\)!important;padding-bottom:4rem!important;\}/,
    );
    assert.ok(
      uiOverrideCss.includes(
        String.raw`:where(aside,nav,[role='navigation'],div):has(>[data-codexpp="nav-group"]){justify-content:flex-start!important;}`,
      ),
    );
    assert.ok(
      uiOverrideCss.includes(
        String.raw`:where(aside,nav,[role='navigation'],div):has(>[data-codexpp="nav-group"])>[class~="flex-1"],:where(aside,nav,[role='navigation'],div):has(>[data-codexpp="nav-group"])>[class~="grow"]{flex:0 0 auto!important;}`,
      ),
    );
    assert.ok(
      uiOverrideCss.includes(
        String.raw`[data-codexpp="nav-group"],[data-codexpp="pages-group"]{flex:0 0 auto!important;margin-top:0!important;}`,
      ),
    );
    assert.ok(
      uiOverrideCss.includes(
        String.raw`nav:has([data-settings-panel-slug]) .min-h-0.flex-1.overflow-y-auto.pb-2{margin-right:calc(var(--padding-row-x) * -1)!important;padding-right:var(--padding-row-x)!important;padding-bottom:1.25rem!important;}`,
      ),
    );
    assert.ok(
      uiOverrideCss.includes(
        String.raw`:where(aside,nav,[role="navigation"]):has([data-app-action-sidebar-section-heading]) :is(a,button,[role='button'])[aria-label*='codex mobile' i]{display:none!important;}`,
      ),
    );
    assert.doesNotMatch(uiOverrideCss, /aria-label\*='invite'|title\*='invite'|href\*='referral'|Invite a friend/);
    assert.ok(
      uiOverrideCss.includes(
        String.raw`.flex.flex-col.text-sm:has(>.grid.items-center.gap-y-1\.5.py-1)>.grid.items-center.gap-y-1\.5.py-1,.flex.flex-col.text-sm:has(>.grid.items-center.gap-y-1\.5.py-1)>.grid.items-center.gap-y-1\.5.py-1~:is(div,button,[role='menuitem']):not(a[href]):has(svg){padding-left:calc(var(--padding-row-x) + 1.25rem + 2px)!important;padding-right:var(--padding-row-x)!important;}`,
      ),
    );
    assert.doesNotMatch(uiOverrideCss, /USAGE_MENU_RESET_ACTION_DECLARATIONS|1\.25rem \+ 4px/);
    assert.doesNotMatch(uiOverrideCss, /\.grid\.items-center\.gap-y-1\\\.5\.py-1\+\*/);
    assert.doesNotMatch(uiOverrideCss, /(^|[;{])left:-?1px/);
    const uiCssRules = Array.from(uiOverrideCss.matchAll(/([^{}]+)\{([^{}]+)\}/g)).map(
      ([, selector, declarations]) => ({
        selector: selector.trim(),
        declarations: declarations.trim(),
      }),
    );
    const usageLinkHideRule = uiCssRules.find(
      ({ selector, declarations }) =>
        declarations === "display:none!important;" &&
        selector.includes('a[href="https://openai.com/chatgpt/pricing"]'),
    );
    assert.ok(usageLinkHideRule);
    assert.deepEqual(usageLinkHideRule.selector.split(","), [
      String.raw`.flex.flex-col.text-sm:has(>.grid.items-center.gap-y-1\.5.py-1)>a[href="https://openai.com/chatgpt/pricing"]`,
      String.raw`.flex.flex-col.text-sm:has(>.grid.items-center.gap-y-1\.5.py-1)>a[href^="https://help.openai.com/en/articles/11369540-using-codex"]`,
    ]);
    assert.doesNotMatch(usageLinkHideRule.selector, /nth-last-child|\+\*\+\*|M16\.834/);
    assert.doesNotMatch(uiOverrideCss, /nth-last-child|M16\.834/);
    assert.equal(
      uiCssRules.some(
        ({ selector, declarations }) =>
          declarations === "display:none!important;" &&
          selector.includes(".grid.items-center.gap-y-1\\.5.py-1+*+*"),
      ),
      false,
    );

    menuModule.exports.start({ log: console, storage });
    assert.equal(appendedStyles.length, 2);

    menuModule.exports.stop();
    uiModule.exports.stop();
    assert.equal(observerDisconnectCount, 2);
    assert.equal(
      documentElement.getAttribute("data-codex-app-ui-hide-windows-menu-bar"),
      null,
    );
    assert.equal(
      document.getElementById("codex-app-ui-hide-windows-menu-bar-setting"),
      null,
    );
    assert.equal(removedStyleIds.has("codex-app-windows-menu-bar-style"), true);
    assert.equal(removedStyleIds.has("codex-app-ui-overrides-style"), true);
  } finally {
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
    globalThis.NodeFilter = previousNodeFilter;
    globalThis.MutationObserver = previousMutationObserver;
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

test("Windows ARM64 package commands delegate ordering to the package plan", () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(desktopRoot, "package.json"), "utf8"),
  );
  assert.equal(packageJson.scripts["prepare:win:arm64"], "npm run build:scripts && npm run plan:win:arm64:compiled -- prepare");
  assert.equal(packageJson.scripts["package:win:arm64"], "npm run build:scripts && npm run plan:win:arm64:compiled -- package");
  assert.equal(packageJson.scripts["make:win:arm64"], "npm run build:scripts && npm run plan:win:arm64:compiled -- make");
  assert.equal(packageJson.scripts["make:win:arm64:ci"], "npm run build:scripts && npm run plan:win:arm64:compiled -- make");
});

test("keeps the TypeScript RC script compiler floating", () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(desktopRoot, "package.json"), "utf8"),
  );

  assert.equal(packageJson.devDependencies?.["@typescript/native-preview"], undefined);
  assert.equal(
    packageJson.scripts["build:scripts"],
    "npx -y -p typescript@rc tsc -p tsconfig.scripts.json",
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

test("primary runtime workflow triggers when npm lockfile inputs change", () => {
  const workflowSource = fs.readFileSync(
    path.join(repoRoot, ".github", "workflows", "primary-runtime-windows-arm64.yml"),
    "utf8",
  );

  assert.match(workflowSource, /pull_request:[\s\S]*paths:[\s\S]*- "desktop\/package-lock\.json"[\s\S]*workflow_dispatch:/);
  assert.match(workflowSource, /push:[\s\S]*paths:[\s\S]*- "desktop\/package-lock\.json"[\s\S]*permissions:/);
  assert.match(workflowSource, /cache-dependency-path: desktop\/package-lock\.json/);
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
  assert.doesNotMatch(workflowSource, /CODEX_APPCAST_FEED/);
  assert.match(workflowSource, /CODEX_PLUS_PLUS_TAG: \$\{\{ needs\.build-windows-arm64\.outputs\.codex_plus_plus_tag \}\}/);
  assert.match(workflowSource, /CODEX_PLUS_PLUS_SHA: \$\{\{ needs\.build-windows-arm64\.outputs\.codex_plus_plus_sha \}\}/);
  assert.doesNotMatch(workflowSource, /Upstream Codex appcast/);
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
  assert.doesNotMatch(workflowSource, /CODEX_APPCAST_FEED/);
  assert.doesNotMatch(workflowSource, /CODEX_APPCAST_URL/);
  assert.doesNotMatch(workflowSource, /Codex appcast:/);
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
  assert.ok(releaseWorkflowSource.indexOf("name: Resolve upstream release versions") < releaseWorkflowSource.indexOf("name: Notice existing repo release"));
  assert.doesNotMatch(
    releaseWorkflowSource.slice(0, releaseWorkflowSource.indexOf("name: Notice existing repo release")),
    /cache: npm/,
  );
  assert.ok(releaseWorkflowSource.indexOf("name: Notice existing repo release") < releaseWorkflowSource.indexOf("name: Restore Electron cache"));
  assert.match(releaseWorkflowSource, /name: Restore npm cache[\s\S]*cache: npm[\s\S]*cache-dependency-path: desktop\/package-lock\.json/);
  assert.ok(releaseWorkflowSource.indexOf("name: Restore npm cache") < releaseWorkflowSource.indexOf("name: Install dependencies"));
  assert.match(releaseWorkflowSource, /name: Restore Electron cache[\s\S]*uses: actions\/cache@/);
  assert.match(releaseWorkflowSource, /name: Install dependencies[\s\S]*run: npm ci/);
  assert.match(releaseWorkflowSource, /name: Build desktop scripts[\s\S]*run: npm run build:scripts/);
  assert.ok(prWorkflowSource.indexOf("name: Resolve upstream release versions") < prWorkflowSource.indexOf("name: Restore Electron cache"));
  assert.match(prWorkflowSource, /name: Build desktop scripts[\s\S]*run: npm run build:scripts/);
  assert.ok(prWorkflowSource.indexOf("name: Restore Electron cache") < prWorkflowSource.indexOf("name: Install dependencies"));
  assert.ok(releaseWorkflowSource.indexOf("name: Restore Electron cache") < releaseWorkflowSource.indexOf("name: Install dependencies"));
  assert.match(prWorkflowSource, /name: Build Windows ARM64 ZIP[\s\S]*CODEX_APP_VERSION: \$\{\{ steps\.upstream\.outputs\.codex_app_version \}\}[\s\S]*CODEX_APP_BUILD: \$\{\{ steps\.upstream\.outputs\.codex_app_build \}\}/);
  assert.match(releaseWorkflowSource, /name: Make Windows ARM64 ZIP[\s\S]*CODEX_APP_VERSION: \$\{\{ steps\.upstream\.outputs\.codex_app_version \}\}[\s\S]*CODEX_APP_BUILD: \$\{\{ steps\.upstream\.outputs\.codex_app_build \}\}/);
  assert.match(prWorkflowSource, /name: Build Windows ARM64 ZIP[\s\S]*GH_TOKEN: \$\{\{ github\.token \}\}[\s\S]*run: npm run plan:win:arm64:compiled -- make/);
  assert.match(releaseWorkflowSource, /name: Make Windows ARM64 ZIP[\s\S]*GH_TOKEN: \$\{\{ github\.token \}\}[\s\S]*run: npm run plan:win:arm64:compiled -- make/);
  assert.ok(
    releaseWorkflowSource.indexOf("name: Notice existing repo release") <
      releaseWorkflowSource.indexOf("name: Run targeted desktop tests"),
  );
  assert.match(releaseWorkflowSource, /name: Run targeted desktop tests[\s\S]*npm run test:resolve-codex-releases:compiled && npm run test:hydrate-codex-cli:compiled && npm run test:windows-arm64-package-plan:compiled && npm run test:windows-package-resources:compiled && npm run test:verify-browser-client-runtime:compiled/);
  assert.match(prWorkflowSource, /name: Run targeted desktop tests[\s\S]*npm run test:resolve-codex-releases:compiled && npm run test:hydrate-codex-cli:compiled && npm run test:windows-arm64-package-plan:compiled && npm run test:windows-package-resources:compiled && npm run test:verify-browser-client-runtime:compiled/);
  assert.match(prWorkflowSource, /name: Restore hydrated release cache[\s\S]*uses: actions\/cache\/restore@/);
  assert.match(releaseWorkflowSource, /name: Restore hydrated release cache[\s\S]*uses: actions\/cache@/);
  assert.equal(packageJson.scripts["build:scripts"], "npx -y -p typescript@rc tsc -p tsconfig.scripts.json");
  assert.equal(packageJson.scripts["verify:browser-client-runtime"], "npm run build:scripts && npm run verify:browser-client-runtime:compiled");
  assert.equal(packageJson.scripts["verify:browser-client-runtime:compiled"], "node ./.cache/scripts/verify-browser-client-runtime.js");
  assert.equal(packageJson.scripts["test:resolve-codex-releases:compiled"], "node --test scripts/resolve-codex-releases.test.mjs");
  assert.equal(packageJson.scripts["test:hydrate-codex-cli:compiled"], "node --test scripts/hydrate-codex-cli.test.mjs");
  assert.equal(packageJson.scripts["test:windows-arm64-package-plan:compiled"], "node --test scripts/windows-arm64-package-plan.test.mjs");
  assert.equal(packageJson.scripts["test:windows-package-resources:compiled"], "node --test scripts/windows-package-resources.test.mjs");
  assert.equal(packageJson.scripts["test:verify-browser-client-runtime:compiled"], "node --test scripts/verify-browser-client-runtime.test.mjs");
  assert.equal(packageJson.scripts["decode:self-signed-pfx"], "npm run build:scripts && node ./.cache/scripts/decode-self-signed-pfx.js");
  assert.equal(packageJson.scripts["prepare:self-signed-msix-payload:compiled"], "node ./.cache/scripts/prepare-self-signed-msix-payload.js");
  assert.equal(packageJson.scripts["write:self-signed-appinstaller:compiled"], "node ./.cache/scripts/write-self-signed-appinstaller.js");
  assert.match(releaseWorkflowSource, /node \.\/\.cache\/scripts\/decode-self-signed-pfx\.js --output/);
  assert.doesNotMatch(releaseWorkflowSource, /npm run decode:self-signed-pfx/);
  assert.match(releaseWorkflowSource, /npm run prepare:self-signed-msix-payload:compiled/);
  assert.match(releaseWorkflowSource, /npm run write:self-signed-appinstaller:compiled/);
  assert.match(releaseWorkflowSource, /PACKAGE_VERSION: \$\{\{ steps\.upstream\.outputs\.msix_package_version \}\}/);
  assert.doesNotMatch(releaseWorkflowSource, /PACKAGE_VERSION: \$\{\{ steps\.upstream\.outputs\.release_version \}\}/);
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

test("self-signed MSIX manifest does not declare phone extensions", () => {
  const scriptSource = fs.readFileSync(
    path.join(desktopRoot, "scripts", "prepare-self-signed-msix-payload.ts"),
    "utf8",
  );

  assert.doesNotMatch(scriptSource, /xmlns:mp=/);
  assert.doesNotMatch(scriptSource, /mp:PhoneIdentity/);
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
  assert.match(scriptSource, /headers\.Authorization = "Bearer " \+ token/);
  assert.match(scriptSource, /fetchGithubUrl/);
  assert.match(scriptSource, /withoutAuthorization/);
  assert.match(scriptSource, /shouldRetryWithoutAuthorization/);
  assert.match(scriptSource, /statusCode === 401 \|\| statusCode === 404/);
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
    path.join(desktopRoot, "scripts", "github-release-assets.ts"),
    "utf8",
  );

  assert.match(scriptSource, /const token = process\.env\.GH_TOKEN \?\? process\.env\.GITHUB_TOKEN/);
  assert.match(scriptSource, /headers\.Authorization = "Bearer " \+ token/);
  assert.match(scriptSource, /hostname === "api\.github\.com" \|\| hostname === "github\.com"/);
  assert.match(scriptSource, /requestUrl/);
  assert.match(scriptSource, /withoutAuthorization/);
  assert.doesNotMatch(scriptSource, /fetch\(/);
  assert.match(scriptSource, /export async function fetchGitHubRelease/);
  assert.match(scriptSource, /ensureCachedReleaseAsset/);
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

test("Codex app cache consumers allow beta app bundle names", () => {
  const extractRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-beta-app-"));
  const betaAppAsar = path.join(
    extractRoot,
    "Codex Beta.app",
    "Contents",
    "Resources",
    "app.asar",
  );
  writeFixture(betaAppAsar, "asar");

  assert.equal(findAppAsar(extractRoot), betaAppAsar);

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

  assert.match(appHydratorSource, /findAppResourceFile\(root, "app\.asar"\)/);
  assert.match(cliHydratorSource, /findAppResourceFile\(root, "node"\)/);
  assert.match(verifierSource, /findAppResourceFile\(root, "node"\)/);
  assert.doesNotMatch(appHydratorSource, /Codex\.app\/Contents\/Resources\/app\.asar/);
  assert.doesNotMatch(cliHydratorSource, /"Codex\.app", "Contents", "Resources", "node"/);
  assert.doesNotMatch(verifierSource, /"Codex\.app", "Contents", "Resources", "node"/);
});

test("Codex app hydration guards missing OWL Electron feature binding", () => {
  const source =
    'function rn(e){return Qe().isOwlFeatureEnabled(e)}function Qe(){let e=process._linkedBinding;if(typeof e!=`function`)throw Error(`Owl feature binding is unavailable`);return Ge.parse(e.call(process,`electron_common_owl_features`))}function $e(){return Qe()}';

  const patch = patchOwlFeatureBindingSource(source);

  assert.ok(patch);
  assert.equal(patch.changed, true);
  assert.match(patch.source, /if\(typeof e!="function"\)return \{isOwlFeatureEnabled:\(\)=>!1\}/);
  assert.match(patch.source, /try\{return Ge\.parse\(e\.call\(process,"electron_common_owl_features"\)\)\}/);
  assert.match(patch.source, /catch\{return \{isOwlFeatureEnabled:\(\)=>!1\}\}/);
  assert.doesNotMatch(patch.source, /throw Error\(`Owl feature binding is unavailable`\)/);

  const secondPatch = patchOwlFeatureBindingSource(patch.source);
  assert.ok(secondPatch);
  assert.equal(secondPatch.changed, false);
});

test("Codex app hydration accepts upstream OWL binding fallback", () => {
  const source =
    "var Ve=`electron_common_owl_features`,Ge=t.Yc({isOwlFeatureEnabled:t.Wc(e=>typeof e==`function`)});function Qe(){let e=process._linkedBinding;if(typeof e!=`function`)return null;let t;try{t=e.call(process,Ve)}catch(e){if(st(e))return null;throw e}return Ge.parse(t)}";

  const patch = patchOwlFeatureBindingSource(source);

  assert.ok(patch);
  assert.equal(patch.changed, false);
});

test("Codex app hydration enables all OWL Electron features", () => {
  const source =
    "let i=require(`electron`),a=`;`,r=/;/,f=function(){return/;/;},g=()=>/;/.test(x),p=require(`node:path`);i.app.commandLine;a=e.o(a);";

  const patch = patchRecoveredOwlFeatureSwitchSource(source);

  assert.ok(patch);
  assert.equal(patch.changed, true);
  assert.match(
    patch.source,
    /__codexExistingFeatures=i\.app\.commandLine\.getSwitchValue\("enable-features"\)/,
  );
  assert.match(
    patch.source,
    /i\.app\.commandLine\.appendSwitch\("enable-features",__codexExistingFeatures\?__codexExistingFeatures\+","\+__codexOwlFeatures:__codexOwlFeatures\)/,
  );
  assert.match(
    patch.source,
    /__codexOwlFeatures="OwlAutofillAndPasswords,OwlAuth,OwlDownloads,OwlExtensions,OwlOpenAIGoLinks,OwlPermissions,OwlPrinting,OwlWebViewEnhancements"/,
  );
  assert.match(
    patch.source,
    /let i=require\(`electron`\),a=`;`,r=\/;\/,f=function\(\)\{return\/;\/;\},g=\(\)=>\/;\/\.test\(x\),p=require\(`node:path`\);try\{/,
  );
  assert.doesNotMatch(patch.source, /,try\{/);
  assert.doesNotMatch(patch.source, /a=`;try\{/);
  assert.doesNotMatch(patch.source, /return\/;try\{/);
  assert.doesNotMatch(patch.source, /=>\/;try\{/);
  assert.match(patch.source, /Codex\+\+ enable Owl Electron features/);

  const secondPatch = patchRecoveredOwlFeatureSwitchSource(patch.source);
  assert.ok(secondPatch);
  assert.equal(secondPatch.changed, false);
});

test("Codex app hydration enables the message rail Statsig gate", () => {
  const source =
    "var rail=async()=>{let{ThreadUserMessageNavigationRail:e}=await import(`./thread-user-message-navigation-rail.js`);return e};function Bo(){return Pt(\"2551582477\")&&At('2551582477')&&client.checkGate(`2551582477`)&&client . checkGate(`2551582477`)&&enabled}";

  const patch = patchRecoveredMessageRailStatsigGateSource(source);

  assert.ok(patch);
  assert.equal(patch.changed, true);
  assert.match(patch.source, /true\/\* Codex\+\+ enable message rail \*\//);
  assert.doesNotMatch(patch.source, /Pt\("2551582477"\)/);
  assert.doesNotMatch(patch.source, /At\('2551582477'\)/);
  assert.match(patch.source, /client\.checkGate\(`2551582477`\)/);
  assert.match(patch.source, /client \. checkGate\(`2551582477`\)/);
  assert.doesNotMatch(patch.source, /client\.true/);

  const secondPatch = patchRecoveredMessageRailStatsigGateSource(patch.source);
  assert.ok(secondPatch);
  assert.equal(secondPatch.changed, false);
});

test("Codex++ runtime preload patch prefers Store settings panel items container", () => {
  const source = `
function tryInject() {
  const itemsGroup = findSidebarItemsGroup();
  const outer = itemsGroup.parentElement ?? itemsGroup;
  state.sidebarRoot = outer;
  if (state.navGroup && outer.contains(state.navGroup)) return;
  const existingCodexPpNavGroup = outer.querySelector('[data-codexpp="nav-group"]');
  outer.appendChild(group);
  plog("nav group injected", { outerTag: outer.tagName });
}
function findSidebarItemsGroup() {
  const candidates = Array.from(document.querySelectorAll("aside,nav,[role='navigation'],div"));
  return candidates[0] ?? null;
}
function isSettingsSidebarCandidate(el) {
  if (!codexPpVisibleBox(el)) return false;
  const labels = codexPpSettingsLabelsFrom(el);
  return isCodexPpSettingsLabelSet(labels);
}
`;

  const updated = rewriteCodexPlusPlusRuntimePreload(source);

  assert.match(updated, /const sidebarRoot = itemsGroup;/);
  assert.match(updated, /state\.sidebarRoot = sidebarRoot/);
  assert.match(updated, /const settingsPanelSlug = document\.querySelector\("\[data-settings-panel-slug\]"\)/);
  assert.match(updated, /const settingsPanelNav = settingsPanelSlug\?\.closest\("nav"\)/);
  assert.match(updated, /const settingsItemsGroup = settingsPanelSlug\?\.closest\("\.min-h-0\.flex-1\.overflow-y-auto\.pb-2"\)/);
  assert.match(updated, /const settingsItemsOuter = settingsItemsGroup\?\.parentElement \?\? settingsItemsGroup;/);
  assert.match(updated, /settingsPanelNav\.contains\(settingsItemsGroup\)/);
  assert.match(updated, /isSettingsSidebarCandidate\(settingsItemsOuter\)/);
  assert.match(updated, /return settingsItemsGroup;/);
  assert.match(
    updated,
    /if \(el\.querySelector\("\[data-settings-panel-slug\]"\) && codexPpVisibleBox\(el\)\) return true;/,
  );
  assert.equal(rewriteCodexPlusPlusRuntimePreload(updated), updated);
});

test("Codex++ runtime preload patch upgrades old Store settings slug nav fast path", () => {
  const source = `
function tryInject() {
  const itemsGroup = findSidebarItemsGroup();
  const outer = itemsGroup.parentElement ?? itemsGroup;
  state.sidebarRoot = outer;
  if (state.navGroup && outer.contains(state.navGroup)) return;
  const existingCodexPpNavGroup = outer.querySelector('[data-codexpp="nav-group"]');
  outer.appendChild(group);
  plog("nav group injected", { outerTag: outer.tagName });
}
function findSidebarItemsGroup() {
  const settingsPanelSlug = document.querySelector("[data-settings-panel-slug]");
  const settingsPanelNav = settingsPanelSlug?.closest("nav");
  if (settingsPanelNav instanceof HTMLElement && isSettingsSidebarCandidate(settingsPanelNav)) {
    return settingsPanelNav;
  }
  const candidates = Array.from(document.querySelectorAll("aside,nav,[role='navigation'],div"));
  return candidates[0] ?? null;
}
function isSettingsSidebarCandidate(el) {
  if (!codexPpVisibleBox(el)) return false;
  if (el.querySelector("[data-settings-panel-slug]") && codexPpVisibleBox(el)) return true;
  const labels = codexPpSettingsLabelsFrom(el);
  return isCodexPpSettingsLabelSet(labels);
}
`;

  const updated = rewriteCodexPlusPlusRuntimePreload(source);

  assert.doesNotMatch(updated, /return settingsPanelNav;/);
  assert.match(updated, /return settingsItemsGroup;/);
  assert.equal(rewriteCodexPlusPlusRuntimePreload(updated), updated);
});

test("Codex app OWL feature binding patch preserves minified dollar identifiers", () => {
  const source =
    'function $1(){let $$=process._linkedBinding;if(typeof $$!=`function`)throw Error(`Owl feature binding is unavailable`);return $2.parse($$.call(process,`electron_common_owl_features`))}';

  const patch = patchOwlFeatureBindingSource(source);

  assert.ok(patch);
  assert.equal(patch.changed, true);
  assert.match(patch.source, /function \$1\(\)\{let \$\$=process\._linkedBinding/);
  assert.match(patch.source, /typeof \$\$!="function"/);
  assert.match(patch.source, /\$2\.parse\(\$\$\.call\(process,"electron_common_owl_features"\)\)/);
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

test("Codex app hydration runs through an explicit package runner", () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(desktopRoot, "package.json"), "utf8"),
  );
  const appHydratorSource = fs.readFileSync(
    path.join(desktopRoot, "scripts", "hydrate-codex-app.ts"),
    "utf8",
  );
  const runnerSource = fs.readFileSync(
    path.join(desktopRoot, "scripts", "run-hydrate-codex-app.ts"),
    "utf8",
  );

  assert.equal(
    packageJson.scripts["hydrate:app"],
    "npm run build:scripts && node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types ./scripts/run-hydrate-codex-app.ts",
  );
  assert.equal(
    packageJson.scripts["hydrate:app:compiled"],
    "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types ./scripts/run-hydrate-codex-app.ts",
  );
  assert.match(
    appHydratorSource,
    /export async function main\(argv: string\[\] = process\.argv\.slice\(2\)\): Promise<void>/,
  );
  assert.match(runnerSource, /createRequire\(import\.meta\.url\)/);
  assert.match(runnerSource, /import type \{ main as hydrateCodexApp \} from "\.\/hydrate-codex-app"/);
  assert.match(runnerSource, /require\("\.\.\/\.cache\/scripts\/hydrate-codex-app\.js"\)/);
  assert.match(runnerSource, /await main\(process\.argv\.slice\(2\)\)/);
  assert.doesNotMatch(appHydratorSource, /process\.argv\[1\]/);
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
  const githubAssetSource = fs.readFileSync(
    path.join(desktopRoot, "scripts", "github-release-assets.ts"),
    "utf8",
  );

  assert.match(appHydratorSource, /expectedDownloadLength/);
  assert.match(appHydratorSource, /Downloaded Codex app ZIP size mismatch/);
  assert.match(githubAssetSource, /parseAssetDigest/);
  assert.match(githubAssetSource, /ensureCachedReleaseAsset/);
  assert.match(githubAssetSource, /completeMarkerPath/);
  assert.match(githubAssetSource, /temporaryExtractRoot/);
  assert.match(githubAssetSource, /fs\.renameSync\(temporaryExtractRoot, extractRoot\)/);
  assert.match(cliHydratorSource, /ensureCachedReleaseAsset/);
  assert.match(cliHydratorSource, /ensureExtractedZip/);
});

test("repo Node toolchain matches the Electron runtime Node major", () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(desktopRoot, "package.json"), "utf8"),
  );
  const nodeVersionFile = fs.readFileSync(path.join(repoRoot, ".node-version"), "utf8").trim();
  const electronPackageJson = JSON.parse(
    fs.readFileSync(path.join(desktopRoot, "node_modules", "electron", "package.json"), "utf8"),
  );
  const electronNodeTypesRange = electronPackageJson.dependencies?.["@types/node"];
  assert.equal(typeof electronNodeTypesRange, "string");
  const electronNodeMajorMatch = /^\^?(\d+)\./.exec(electronNodeTypesRange);
  assert.ok(
    electronNodeMajorMatch,
    `Expected Electron @types/node range to start with a major version, got ${electronNodeTypesRange}`,
  );
  const electronNodeMajor = electronNodeMajorMatch[1];
  const nodeVersionMajorMatch = /^(\d+)(?:\.|$)/.exec(nodeVersionFile);
  assert.ok(
    nodeVersionMajorMatch,
    `Expected .node-version to start with a major version, got ${nodeVersionFile}`,
  );

  assert.equal(nodeVersionMajorMatch[1], electronNodeMajor);
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
  const planSource = fs.readFileSync(
    path.join(desktopRoot, "scripts", "windows-arm64-package-plan.ts"),
    "utf8",
  );
  for (const cacheKeyInput of [
    "package-lock.json",
    "scripts/hydrate-codex-app.ts",
    "scripts/patch-better-sqlite3-electron.ts",
  ]) {
    assert.ok(
      planSource.includes(cacheKeyInput),
      `native module cache key should include ${cacheKeyInput}`,
    );
  }
  assert.match(resolverSource, /windowsArm64NativeModuleCacheInputPaths/);
  assert.match(resolverSource, /windowsArm64HydratedCacheInputPaths/);
  assert.match(resolverSource, /native_modules_cache_key/);
  assert.match(
    planSource,
    /windowsArm64HydratedCacheInputPaths[\s\S]*"scripts\/run-hydrate-codex-app\.ts"/,
  );

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

test("Store binary updater only accepts the official Store package family", () => {
  const source = fs.readFileSync(
    path.join(desktopRoot, "scripts", "update-node-repl.ps1"),
    "utf8",
  );

  const paramBlock = source.match(/param\([\s\S]*?\)/)?.[0] ?? "";
  assert.doesNotMatch(paramBlock, /\$ProductId|\$PackageName|\$PackageFamilyName/);
  assert.match(source, /\$PackageName = "OpenAI\.Codex"/);
  assert.match(source, /\$PackageFamilyName = "OpenAI\.Codex_2p2nqsd0c76g0"/);
  assert.match(source, /Where-Object \{ \$_\.PackageFamilyName -eq \$PackageFamilyName \}/);
  assert.match(source, /app\/resources\/cua_node\/bin\/node_repl\.exe/);
  assert.match(
    source,
    /app\/resources\/plugins\/openai-bundled\/plugins\/chrome\/extension-host\/windows\/arm64\/extension-host\.exe/,
  );
  assert.match(
    source,
    /app\/resources\/plugins\/openai-bundled\/plugins\/chrome\/extension-host\/windows\/x64\/extension-host\.exe/,
  );
  assert.match(
    source,
    /app\/resources\/cua_node\/bin\/node_modules\/@oai\/sky\/bin\/windows\/codex-computer-use\.exe/,
  );
});

test("CLI hydrator downloads the public x64 Windows Tectonic release asset", () => {
  const source = fs.readFileSync(
    path.join(desktopRoot, "scripts", "hydrate-codex-cli.ts"),
    "utf8",
  );

  assert.match(source, /resourceBinaryExceptionById\("tectonic"\)/);
  assert.match(source, /expectedGithubRepository/);
  assert.match(source, /expectedGithubReleaseTag/);
  assert.match(source, /expectedGithubAssetName/);
  assert.doesNotMatch(source, /--tectonic-repo|--tectonic-version|-TectonicRepo|-TectonicVersion/);
  assert.match(source, /hydrateTectonicExe/);
  assert.match(source, /readPeMachine\(tectonicPath\)/);
  assert.match(source, /installTectonicWindowsPayload\(resourcesRoot, tectonicPath\)/);
  assert.match(source, /executableSha256: sha256\(tectonicPath\)/);
  assert.match(source, /releaseHtmlUrl: tectonicAsset\.releaseHtmlUrl/);
  assert.match(source, /releaseTagName: tectonicAsset\.releaseTagName/);
  assert.match(source, /releaseAssetSha256: tectonicAsset\.releaseAssetSha256/);
  assert.match(source, /sha256: tectonicAsset\.executableSha256/);
});

test("ignores generated signing-secret base64 exports", () => {
  const gitignoreSource = fs.readFileSync(path.join(repoRoot, ".gitignore"), "utf8");
  assert.match(gitignoreSource, /^\*\.pfx\.base64\.txt$/m);
});

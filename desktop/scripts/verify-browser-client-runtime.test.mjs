import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { verifyBrowserClientRuntime } from "../.cache/scripts/verify-browser-client-runtime.js";

function writeFixture(filePath, source) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, source, "utf8");
}

function writePeFixture(filePath, versionText, machine = 0xaa64) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const versionBytes = Buffer.from(versionText, "latin1");
  const bytes = Buffer.alloc(0x120 + versionBytes.length);
  bytes[0] = 0x4d;
  bytes[1] = 0x5a;
  bytes.writeInt32LE(0x80, 0x3c);
  bytes.write("PE\0\0", 0x80, "latin1");
  bytes.writeUInt16LE(machine, 0x84);
  versionBytes.copy(bytes, 0x120);
  fs.writeFileSync(filePath, bytes);
}

function createDesktopFixture({
  appBundleName = "Codex.app",
  includeClassicLevelBridge = true,
  marketplaceName = "openai-bundled",
} = {}) {
  const desktopRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-browser-runtime-"));
  const appVersion = "26.506.21252";
  const appBuildNumber = "61741";
  const appExtractDir = `extract-${appVersion}-build-${appBuildNumber}`;
  const browserPluginRoot = path.join(
    desktopRoot,
    "resources",
    "plugins",
    marketplaceName,
    "plugins",
    "browser",
  );
  const classicLevelRoot = path.join(
    browserPluginRoot,
    "scripts",
    "node_modules",
    "classic-level",
  );

  writeFixture(
    path.join(desktopRoot, ".cache", "codex-app", "latest-release.json"),
    `${JSON.stringify({ buildNumber: appBuildNumber, extractDir: appExtractDir, version: appVersion }, null, 2)}\n`,
  );
  writeFixture(
    path.join(
      desktopRoot,
      ".cache",
      "codex-app",
      appExtractDir,
      appBundleName,
      "Contents",
      "Resources",
      "cua_node",
      "bin",
      "node",
    ),
    "fake mac node v24.14.0 v24.14.0\n",
  );
  writePeFixture(
    path.join(desktopRoot, "resources", "cua_node", "bin", "node.exe"),
    "fake windows node v24.14.0 v24.14.0",
  );
  writeFixture(
    path.join(browserPluginRoot, "scripts", "browser-client.mjs"),
    'import{ClassicLevel as mH}from"./node_modules/classic-level.mjs";\n',
  );
  if (includeClassicLevelBridge) {
    writeFixture(
      path.join(browserPluginRoot, "scripts", "node_modules", "classic-level.mjs"),
      'export { ClassicLevel } from "./classic-level/index.js";\n',
    );
  }
  writeFixture(
    path.join(classicLevelRoot, "package.json"),
    `${JSON.stringify({ name: "classic-level", version: "3.0.0" }, null, 2)}\n`,
  );

  return { appBuildNumber, appExtractDir, appVersion, browserPluginRoot, classicLevelRoot, desktopRoot };
}

test("accepts legacy app extract cache metadata without extractDir", async () => {
  const { appBuildNumber, appExtractDir, appVersion, browserPluginRoot, desktopRoot } = createDesktopFixture();
  const codexAppCacheRoot = path.join(desktopRoot, ".cache", "codex-app");
  const legacyExtractDir = `extract-${appVersion}`;
  fs.renameSync(path.join(codexAppCacheRoot, appExtractDir), path.join(codexAppCacheRoot, legacyExtractDir));
  writeFixture(
    path.join(codexAppCacheRoot, "latest-release.json"),
    `${JSON.stringify({ buildNumber: appBuildNumber, version: appVersion }, null, 2)}\n`,
  );
  fs.rmSync(browserPluginRoot, { recursive: true, force: true });

  const result = await verifyBrowserClientRuntime({ desktopRoot });

  assert.equal(result.nodeVersion, "v24.14.0");
  assert.equal(result.browserPluginPresent, false);
});

test("accepts browser client native payload metadata matching the bundled Node ABI", async () => {
  const { classicLevelRoot, desktopRoot } = createDesktopFixture();
  writeFixture(
    path.join(classicLevelRoot, "build", "Release", ".codex-runtime-meta.json"),
    `${JSON.stringify(
      {
        abi: "137",
        arch: "arm64",
        platform: "win32",
        runtime: "node",
      },
      null,
      2,
    )}\n`,
  );

  writePeFixture(
    path.join(classicLevelRoot, "build", "Release", "classic-level.node"),
    "native payload",
  );

  const result = await verifyBrowserClientRuntime({ desktopRoot });

  assert.equal(result.nodeVersion, "v24.14.0");
  assert.equal(result.abi, "137");
  assert.equal(result.browserPluginPresent, true);
  assert.equal(result.classicLevelVersion, "3.0.0");
});

test("rejects a browser client that is missing its runtime bridge", async () => {
  const { classicLevelRoot, desktopRoot } = createDesktopFixture({
    includeClassicLevelBridge: false,
  });
  writeFixture(
    path.join(classicLevelRoot, "build", "Release", ".codex-runtime-meta.json"),
    `${JSON.stringify(
      {
        abi: "137",
        arch: "arm64",
        platform: "win32",
        runtime: "node",
      },
      null,
      2,
    )}\n`,
  );
  writePeFixture(
    path.join(classicLevelRoot, "build", "Release", "classic-level.node"),
    "native payload",
  );

  await assert.rejects(
    () => verifyBrowserClientRuntime({ desktopRoot }),
    /Missing Browser client runtime bridge/,
  );
});

test("ignores beta bundled plugin resource names", async () => {
  const { classicLevelRoot, desktopRoot } = createDesktopFixture({
    appBundleName: "Codex (Beta).app",
    marketplaceName: "openai-bundled-beta",
  });
  writeFixture(
    path.join(classicLevelRoot, "build", "Release", ".codex-runtime-meta.json"),
    `${JSON.stringify(
      {
        abi: "137",
        arch: "arm64",
        platform: "win32",
        runtime: "node",
      },
      null,
      2,
    )}\n`,
  );

  writePeFixture(
    path.join(classicLevelRoot, "build", "Release", "classic-level.node"),
    "native payload",
  );

  const result = await verifyBrowserClientRuntime({ desktopRoot });

  assert.equal(result.nodeVersion, "v24.14.0");
  assert.equal(result.abi, "137");
  assert.equal(result.browserPluginPresent, false);
  assert.equal(result.classicLevelVersion, undefined);
});

test("skips browser client ABI check when the browser plugin is not bundled", async () => {
  const { browserPluginRoot, desktopRoot } = createDesktopFixture();
  fs.rmSync(browserPluginRoot, { recursive: true, force: true });

  const result = await verifyBrowserClientRuntime({ desktopRoot });

  assert.equal(result.nodeVersion, "v24.14.0");
  assert.equal(result.abi, "137");
  assert.equal(result.browserPluginPresent, false);
  assert.equal(result.classicLevelVersion, undefined);
});

test("accepts N-API runtime-agnostic Windows ARM64 prebuilds", async () => {
  const { classicLevelRoot, desktopRoot } = createDesktopFixture();
  writeFixture(
    path.join(classicLevelRoot, "package.json"),
    `${JSON.stringify(
      {
        name: "classic-level",
        scripts: {
          prebuild: "prebuildify -t 18.20.4 --napi --strip",
        },
        version: "3.0.0",
      },
      null,
      2,
    )}\n`,
  );
  writePeFixture(
    path.join(classicLevelRoot, "prebuilds", "win32-arm64", "classic-level.node"),
    "native payload",
  );

  const result = await verifyBrowserClientRuntime({ desktopRoot });

  assert.equal(result.abi, "137");
  assert.equal(result.classicLevelVersion, "3.0.0");
});

test("rejects untagged Windows ARM64 prebuilds without N-API evidence", async () => {
  const { classicLevelRoot, desktopRoot } = createDesktopFixture();
  writePeFixture(
    path.join(classicLevelRoot, "prebuilds", "win32-arm64", "classic-level.node"),
    "native payload",
  );

  await assert.rejects(
    () => verifyBrowserClientRuntime({ desktopRoot }),
    /classic-level@3\.0\.0 does not match Node v24\.14\.0 ABI 137/,
  );
});

test("rejects browser client native payloads built for the Electron ABI", async () => {
  const { classicLevelRoot, desktopRoot } = createDesktopFixture();
  writeFixture(path.join(classicLevelRoot, "build", "Release", ".forge-meta"), "arm64--145\n");
  writePeFixture(
    path.join(classicLevelRoot, "bin", "win32-arm64-145", "classic-level.node"),
    "electron native payload",
  );

  await assert.rejects(
    () => verifyBrowserClientRuntime({ desktopRoot }),
    /classic-level@3\.0\.0 does not match Node v24\.14\.0 ABI 137/,
  );
});

test("rejects Windows ARM64 native paths with non-ARM64 payloads", async () => {
  const { classicLevelRoot, desktopRoot } = createDesktopFixture();
  writePeFixture(
    path.join(classicLevelRoot, "bin", "win32-arm64-137", "classic-level.node"),
    "x64 native payload",
    0x8664,
  );

  await assert.rejects(
    () => verifyBrowserClientRuntime({ desktopRoot }),
    /Browser client native payload classic-level\.node is not ARM64: machine 0x8664/,
  );
});

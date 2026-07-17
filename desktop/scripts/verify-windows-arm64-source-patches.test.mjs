import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptsRoot = path.dirname(fileURLToPath(import.meta.url));
const desktopSourceRoot = path.dirname(scriptsRoot);
const require = createRequire(import.meta.url);
const asar = require("@electron/asar");
const {
  verifyWindowsArm64SourcePatches,
} = require(path.join(desktopSourceRoot, ".cache", "scripts", "verify-windows-arm64-source-patches.js"));

const browserClientSource = [
  "function nativePipe(){let e=globalThis.nodeRepl?.nativePipe;return e==null||typeof e.createConnection!==\"function\"?null:e;}",
  "const trustError=\"privileged native pipe bridge is not available; browser-client is not trusted\";",
].join("\n");
const primaryRuntimeManifestUrl =
  "https://github.com/sliepie/codex-app/releases/download/codex-primary-runtime-win32-arm64/LATEST.json";
const taskbarMarker = "Codex Windows primary taskbar window";
const windowServicesMarker = "globalThis.__codexpp_window_services__=";
const browserWindowIcon =
  "BrowserWindow({icon:process.platform===`win32`?require(\"node:path\").join(process.resourcesPath,`icon.ico`):void 0,width:";
const localCacheRelocation =
  "process.resourcesPath?.replace(/\\//g,`\\\\`)+`Packages`+`LocalCache`+`Local`";
const inactiveWindowsMica =
  "function D2({appearance:e,isFocused:t,platform:n}){return!t&&!w2(e)&&n===`darwin`}";
const settingsPreloadMarkers = [
  "const sidebarRoot = itemsGroup;",
  "state.sidebarRoot = sidebarRoot",
  "state.navGroup && sidebarRoot.contains(state.navGroup)",
  "sidebarRoot.querySelector(",
  "sidebarRoot.appendChild(group)",
  "sidebarRootTag: sidebarRoot.tagName",
  "const settingsItemsGroup = settingsPanelSlug?.closest",
  "settingsPanelNav.contains(settingsItemsGroup)",
];

const defaultMainSource = [
  `const taskbar = ${JSON.stringify(taskbarMarker)};`,
  `${windowServicesMarker}services;`,
  `new ${browserWindowIcon}100});`,
  `const relocated = ${localCacheRelocation};`,
  inactiveWindowsMica,
].join("\n");
const defaultRuntimeSource = `const runtimeManifest = ${JSON.stringify(primaryRuntimeManifestUrl)};\n`;
const defaultPreloadSource = `${settingsPreloadMarkers.join("\n")}\n`;
const defaultRendererSource =
  "const Brand={ChatGPT:`chatgpt`};const label=`Open Codex`;const welcome=`Welcome to Codex, ${Brand.ChatGPT}`;" +
  "const header=`ChatGPT-Account-ID`;const headerAlias=`ChatGPT-Account-Id`;const url=`https://chatgpt.com`;" +
  "const matcher=/ChatGPT/;/* ChatGPT product migration */";

function writeFixture(filePath, source) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, source, "utf8");
}

async function createPackageFixture({
  hydratedBrowserSource = browserClientSource,
  includeHydratedBrowserClient = true,
  includePackagedBrowserClient = true,
  mainSource = defaultMainSource,
  packagedBrowserSource = hydratedBrowserSource,
  preloadSource = defaultPreloadSource,
  rendererSource = defaultRendererSource,
  runtimeSource = defaultRuntimeSource,
} = {}) {
  const desktopRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-arm64-source-patches-"));
  const packageRoot = path.join(desktopRoot, "out", "Codex-win32-arm64");
  const appSourceRoot = path.join(desktopRoot, "app-source");
  const browserClientRelativePath = path.join(
    "resources",
    "plugins",
    "openai-bundled",
    "plugins",
    "browser",
    "scripts",
    "browser-client.mjs",
  );

  if (includeHydratedBrowserClient) {
    writeFixture(path.join(desktopRoot, browserClientRelativePath), hydratedBrowserSource);
  }
  if (includePackagedBrowserClient) {
    writeFixture(path.join(packageRoot, browserClientRelativePath), packagedBrowserSource);
  }
  writeFixture(
    path.join(appSourceRoot, "recovered", "app-asar-extracted", ".vite", "build", "main.js"),
    mainSource,
  );
  writeFixture(
    path.join(appSourceRoot, "recovered", "app-asar-extracted", ".vite", "build", "runtime.js"),
    runtimeSource,
  );
  writeFixture(
    path.join(appSourceRoot, "codex-plusplus", "runtime", "preload.js"),
    preloadSource,
  );
  writeFixture(
    path.join(
      appSourceRoot,
      "recovered",
      "app-asar-extracted",
      "webview",
      "assets",
      "product-text.js",
    ),
    rendererSource,
  );

  const appAsarPath = path.join(packageRoot, "resources", "app.asar");
  fs.mkdirSync(path.dirname(appAsarPath), { recursive: true });
  await asar.createPackage(appSourceRoot, appAsarPath);

  return { desktopRoot, packageRoot };
}

test("verifies the Windows ARM64 packaged source-patch postconditions", async () => {
  const { desktopRoot, packageRoot } = await createPackageFixture();

  const result = verifyWindowsArm64SourcePatches({ desktopRoot, packageRoot });

  assert.equal(result.checkedViteBuildFiles, 2);
  assert.equal(result.appAsarPath, path.join(packageRoot, "resources", "app.asar"));
});

test("rejects a packaged Browser client that differs from hydrated resources", async () => {
  const { desktopRoot, packageRoot } = await createPackageFixture({
    packagedBrowserSource: "export const staleBrowserClient = true;\n",
  });

  assert.throws(
    () => verifyWindowsArm64SourcePatches({ desktopRoot, packageRoot }),
    /Packaged Browser client differs from hydrated Browser client/,
  );
});

test("accepts an upstream package without a Browser plugin", async () => {
  const { desktopRoot, packageRoot } = await createPackageFixture({
    includeHydratedBrowserClient: false,
    includePackagedBrowserClient: false,
  });

  assert.doesNotThrow(() => verifyWindowsArm64SourcePatches({ desktopRoot, packageRoot }));
});

test("rejects one-sided Browser plugin presence", async (t) => {
  await t.test("hydrated client only", async () => {
    const { desktopRoot, packageRoot } = await createPackageFixture({
      includePackagedBrowserClient: false,
    });
    assert.throws(
      () => verifyWindowsArm64SourcePatches({ desktopRoot, packageRoot }),
      /Hydrated Browser client is missing from packaged resources/,
    );
  });

  await t.test("packaged client only", async () => {
    const { desktopRoot, packageRoot } = await createPackageFixture({
      includeHydratedBrowserClient: false,
    });
    assert.throws(
      () => verifyWindowsArm64SourcePatches({ desktopRoot, packageRoot }),
      /Packaged Browser client exists without hydrated Browser client/,
    );
  });
});

test("rejects each missing packaged source-patch postcondition", async (t) => {
  const cases = [
    {
      name: "repo-only Browser native-pipe token",
      options: {
        hydratedBrowserSource: "import.meta.__codexNativePipe;\n",
      },
      error: /repo-only native-pipe token/,
    },
    {
      name: "primary taskbar-window marker",
      options: { mainSource: defaultMainSource.replace(taskbarMarker, "missing-taskbar-marker") },
      error: /primary taskbar-window marker/,
    },
    {
      name: "Codex window-services export",
      options: { mainSource: defaultMainSource.replace(windowServicesMarker, "globalThis.missingServices=") },
      error: /Codex window-services export/,
    },
    {
      name: "Windows primary BrowserWindow icon",
      options: { mainSource: defaultMainSource.replace(browserWindowIcon, "BrowserWindow({width:") },
      error: /Windows primary BrowserWindow icon/,
    },
    {
      name: "WindowsApps LocalCache relocation",
      options: { mainSource: defaultMainSource.replace("`LocalCache`", "`Cache`") },
      error: /WindowsApps LocalCache relocation/,
    },
    {
      name: "inactive Windows Mica behavior",
      options: {
        mainSource: defaultMainSource.replace(
          inactiveWindowsMica,
          "function D2({appearance:e,isFocused:t,platform:n}){return!t&&!w2(e)&&(n===`darwin`||n===`win32`)}",
        ),
      },
      error: /inactive Windows Mica behavior/,
    },
    {
      name: "Windows ARM64 primary runtime manifest route",
      options: { runtimeSource: "const runtimeManifest = `missing`;\n" },
      error: /Windows ARM64 primary runtime manifest route/,
    },
    {
      name: "Codex++ settings preload marker",
      options: {
        preloadSource: defaultPreloadSource.replace("sidebarRoot.appendChild(group)", "missing.appendChild(group)"),
      },
      error: /Codex\+\+ settings preload is missing patch marker/,
    },
    {
      name: "renderer product text",
      options: { rendererSource: `${defaultRendererSource}const staleLabel=\"Open ChatGPT\";` },
      error: /Unpatched ChatGPT renderer product text/,
    },
    {
      name: "Work Louder runtime reference",
      options: { runtimeSource: `${defaultRuntimeSource}import "@worklouder/device-kit-oai";\n` },
      error: /Unpatched Work Louder runtime reference/,
    },
  ];

  for (const testCase of cases) {
    await t.test(testCase.name, async () => {
      const { desktopRoot, packageRoot } = await createPackageFixture(testCase.options);
      assert.throws(
        () => verifyWindowsArm64SourcePatches({ desktopRoot, packageRoot }),
        testCase.error,
      );
    });
  }
});

import * as asar from "@electron/asar";
import fs from "node:fs";
import path from "node:path";
import { findReplaceableChatGptProductTextInJavaScriptStrings } from "./javascript-product-text.ts";

type Options = {
  desktopRoot: string;
  packageRoot: string;
};

type PackagedJavaScript = {
  archiveEntry: string;
  relativePath: string;
  source: string;
};

export type WindowsArm64SourcePatchVerificationResult = {
  appAsarPath: string;
  checkedViteBuildFiles: number;
};

const browserClientRelativePath = path.join(
  "resources",
  "plugins",
  "openai-bundled",
  "plugins",
  "browser",
  "scripts",
  "browser-client.mjs",
);
const codexPlusPlusPreloadRelativePath = "codex-plusplus/runtime/preload.js";
const recoveredViteBuildPrefix = "recovered/app-asar-extracted/.vite/build/";
const recoveredRendererAssetsPrefix = "recovered/app-asar-extracted/webview/assets/";
const windowsPrimaryTaskbarMarker = "Codex Windows primary taskbar window";
const codexWindowServicesMarker = "globalThis.__codexpp_window_services__=";
const windowsArm64PrimaryRuntimeManifestUrl =
  "https://github.com/sliepie/codex-app/releases/download/codex-primary-runtime-win32-arm64/LATEST.json";
const repoOnlyBrowserClientNativePipeTokens = [
  "import.meta.__codexNativePipe",
  "codexBrowserNetPipeConnect",
];
const codexPlusPlusSettingsPreloadMarkers = [
  "const sidebarRoot = itemsGroup;",
  "state.sidebarRoot = sidebarRoot",
  "state.navGroup && sidebarRoot.contains(state.navGroup)",
  "sidebarRoot.querySelector(",
  "sidebarRoot.appendChild(group)",
  "sidebarRootTag: sidebarRoot.tagName",
  "const settingsItemsGroup = settingsPanelSlug?.closest",
  "settingsPanelNav.contains(settingsItemsGroup)",
];
const windowsPrimaryBrowserWindowIconPattern =
  /BrowserWindow\(\{icon:process\.platform===`win32`\?require\("node:path"\)\.join\(process\.resourcesPath,`icon\.ico`\):void 0,width:/;
const windowsAppsLocalCacheRelocationPattern =
  /process\.resourcesPath\?\.replace[\s\S]*?`Packages`[\s\S]*?`LocalCache`[\s\S]*?`Local`/;
const inactiveWindowsMicaBackdropPattern =
  /\bfunction\s+[A-Za-z_$][\w$]*\(\{appearance:([A-Za-z_$][\w$]*),isFocused:([A-Za-z_$][\w$]*),platform:([A-Za-z_$][\w$]*)\}\)\{return!\2&&![A-Za-z_$][\w$]*\(\1\)&&\3===`darwin`\}/;
const workLouderRuntimeReferencePattern = /@worklouder\//i;
function resolveDesktopRoot(): string {
  return path.basename(__dirname) === "scripts" && path.basename(path.dirname(__dirname)) === ".cache"
    ? path.resolve(__dirname, "..", "..")
    : path.resolve(__dirname, "..");
}

function readOption(argv: string[], ...names: string[]): string | undefined {
  for (const name of names) {
    const index = argv.indexOf(name);
    if (index !== -1) {
      const value = argv[index + 1];
      if (!value || value.startsWith("-")) {
        throw new Error("Missing value for " + name);
      }
      return value;
    }
  }
  return undefined;
}

function parseOptions(argv: string[]): Options {
  const desktopRoot = resolveDesktopRoot();
  return {
    desktopRoot,
    packageRoot: readOption(argv, "--package-root", "-PackageRoot") ??
      path.join(desktopRoot, "out", "Codex-win32-arm64"),
  };
}

function normalizedArchivePath(value: string): string {
  return value.replace(/^[\\/]+/, "").replaceAll("\\", "/");
}

function archivePathForRead(entry: string): string {
  return normalizedArchivePath(entry).split("/").join(path.sep);
}

function readArchiveFile(archivePath: string, entry: string): Buffer {
  // extractFile reads the selected entry into memory; it never expands app.asar onto disk.
  return asar.extractFile(archivePath, archivePathForRead(entry));
}

function readPackagedJavaScript(archivePath: string): PackagedJavaScript[] {
  const files = asar.listPackage(archivePath, { isPack: false })
    .map((entry) => ({ archiveEntry: entry, relativePath: normalizedArchivePath(entry) }))
    .filter(({ relativePath }) =>
      relativePath.startsWith(recoveredViteBuildPrefix) && relativePath.endsWith(".js"),
    )
    .map(({ archiveEntry, relativePath }) => ({
      archiveEntry,
      relativePath,
      source: readArchiveFile(archivePath, archiveEntry).toString("utf8"),
    }));

  if (files.length === 0) {
    throw new Error(
      "Missing packaged recovered Vite build JavaScript under " + recoveredViteBuildPrefix + ".",
    );
  }
  return files;
}

function readPackagedRendererJavaScript(archivePath: string): PackagedJavaScript[] {
  const files = asar.listPackage(archivePath, { isPack: false })
    .map((entry) => ({ archiveEntry: entry, relativePath: normalizedArchivePath(entry) }))
    .filter(({ relativePath }) => {
      if (!relativePath.startsWith(recoveredRendererAssetsPrefix)) {
        return false;
      }
      const assetName = relativePath.slice(recoveredRendererAssetsPrefix.length);
      return assetName.endsWith(".js") && !assetName.includes("/");
    })
    .map(({ archiveEntry, relativePath }) => ({
      archiveEntry,
      relativePath,
      source: readArchiveFile(archivePath, archiveEntry).toString("utf8"),
    }));

  if (files.length === 0) {
    throw new Error(
      "Missing packaged renderer JavaScript under " + recoveredRendererAssetsPrefix + ".",
    );
  }
  return files;
}

function requireViteBuildMatch(
  files: PackagedJavaScript[],
  description: string,
  predicate: (source: string) => boolean,
): void {
  if (files.some((file) => predicate(file.source))) {
    return;
  }

  throw new Error(
    "Missing packaged Windows source patch: " + description + ". Checked: " +
      files.map((file) => file.relativePath).join(", ") + ".",
  );
}

function verifyBrowserClient(desktopRoot: string, packageRoot: string): void {
  const hydratedPath = path.join(desktopRoot, browserClientRelativePath);
  const packagedPath = path.join(packageRoot, browserClientRelativePath);
  const hydratedExists = fs.existsSync(hydratedPath);
  const packagedExists = fs.existsSync(packagedPath);
  if (!hydratedExists && !packagedExists) {
    return;
  }
  if (!hydratedExists) {
    throw new Error("Packaged Browser client exists without hydrated Browser client: " + packagedPath);
  }
  if (!packagedExists) {
    throw new Error("Hydrated Browser client is missing from packaged resources: " + packagedPath);
  }

  const hydrated = fs.readFileSync(hydratedPath);
  const packaged = fs.readFileSync(packagedPath);
  if (!packaged.equals(hydrated)) {
    throw new Error("Packaged Browser client differs from hydrated Browser client: " + packagedPath);
  }

  for (const token of repoOnlyBrowserClientNativePipeTokens) {
    if (packaged.includes(token)) {
      throw new Error("Packaged Browser client contains repo-only native-pipe token " + JSON.stringify(token) + ".");
    }
  }
}

function verifyCodexPlusPlusSettingsPreload(archivePath: string): void {
  const entries = asar.listPackage(archivePath, { isPack: false });
  const entry = entries.find((candidate) =>
    normalizedArchivePath(candidate) === codexPlusPlusPreloadRelativePath,
  );
  if (!entry) {
    throw new Error("Missing packaged Codex++ settings preload: " + codexPlusPlusPreloadRelativePath);
  }

  const source = readArchiveFile(archivePath, entry).toString("utf8");
  const missing = codexPlusPlusSettingsPreloadMarkers.filter((marker) => !source.includes(marker));
  if (missing.length > 0) {
    throw new Error(
      "Packaged Codex++ settings preload is missing patch marker(s): " +
        missing.map((marker) => JSON.stringify(marker)).join(", ") + ".",
    );
  }
}

function verifyNoWorkLouderRuntimeReferences(files: PackagedJavaScript[]): void {
  const reference = files.find((file) => workLouderRuntimeReferencePattern.test(file.source));
  if (reference) {
    throw new Error("Unpatched Work Louder runtime reference in " + reference.relativePath + ".");
  }
}

function verifyRendererProductText(files: PackagedJavaScript[]): void {
  for (const file of files) {
    const offset = findReplaceableChatGptProductTextInJavaScriptStrings(file.source);
    if (offset !== undefined) {
      throw new Error(
        "Unpatched ChatGPT renderer product text in " + file.relativePath +
          " at source offset " + offset + ".",
      );
    }
  }
}

export function verifyWindowsArm64SourcePatches(
  options: Options,
): WindowsArm64SourcePatchVerificationResult {
  const appAsarPath = path.join(options.packageRoot, "resources", "app.asar");
  if (!fs.existsSync(appAsarPath)) {
    throw new Error("Missing Windows ARM64 app.asar: " + appAsarPath);
  }

  verifyBrowserClient(options.desktopRoot, options.packageRoot);
  const viteBuildFiles = readPackagedJavaScript(appAsarPath);

  requireViteBuildMatch(
    viteBuildFiles,
    "primary taskbar-window marker",
    (source) => source.includes(windowsPrimaryTaskbarMarker),
  );
  requireViteBuildMatch(
    viteBuildFiles,
    "Codex window-services export",
    (source) => source.includes(codexWindowServicesMarker),
  );
  requireViteBuildMatch(
    viteBuildFiles,
    "Windows primary BrowserWindow icon",
    (source) => windowsPrimaryBrowserWindowIconPattern.test(source),
  );
  requireViteBuildMatch(
    viteBuildFiles,
    "WindowsApps LocalCache relocation",
    (source) => windowsAppsLocalCacheRelocationPattern.test(source),
  );
  requireViteBuildMatch(
    viteBuildFiles,
    "inactive Windows Mica behavior",
    (source) => inactiveWindowsMicaBackdropPattern.test(source),
  );
  requireViteBuildMatch(
    viteBuildFiles,
    "Windows ARM64 primary runtime manifest route",
    (source) => source.includes(windowsArm64PrimaryRuntimeManifestUrl),
  );
  verifyCodexPlusPlusSettingsPreload(appAsarPath);
  verifyNoWorkLouderRuntimeReferences(viteBuildFiles);
  verifyRendererProductText(readPackagedRendererJavaScript(appAsarPath));

  return {
    appAsarPath,
    checkedViteBuildFiles: viteBuildFiles.length,
  };
}

function main(): void {
  const result = verifyWindowsArm64SourcePatches(parseOptions(process.argv.slice(2)));
  console.log(
    "Verified Windows ARM64 packaged source patches: " + result.checkedViteBuildFiles +
      " recovered Vite build file(s).",
  );
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}

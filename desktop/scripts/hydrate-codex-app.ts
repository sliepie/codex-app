import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import extract from "extract-zip";

type Options = {
  version?: string;
  appcastUrl: string;
  cacheRoot: string;
  force: boolean;
};

type NativeNodeModule = {
  name: string;
  version: string;
};

type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  version?: string;
};

type MarketplacePlugin = {
  name?: string;
  source?: {
    source?: string;
    path?: string;
  };
  [key: string]: unknown;
};

type MarketplaceJson = {
  name?: string;
  interface?: unknown;
  plugins?: MarketplacePlugin[];
  [key: string]: unknown;
};

type PluginJson = {
  name?: string;
};

const desktopRoot = process.cwd();
const runtimeNodeModulesCacheRoot = path.join(desktopRoot, ".cache", "runtime-node-modules");
const bundledPluginsRoot = path.join(desktopRoot, "resources", "plugins");
const browserUsePluginName = "browser-use";
const openAiBundledMarketplaceName = "openai-bundled";
const excludedBundledPluginNames = new Set(["latex-tectonic"]);
const requiredBundledPluginNames = new Set([browserUsePluginName]);

function readOption(argv: string[], ...names: string[]): string | undefined {
  for (const name of names) {
    const index = argv.indexOf(name);
    if (index !== -1) {
      const value = argv[index + 1];
      if (!value || value.startsWith("-")) {
        throw new Error(`Missing value for ${name}`);
      }
      return value;
    }
  }
  return undefined;
}

function hasFlag(argv: string[], ...names: string[]): boolean {
  return names.some((name) => argv.includes(name));
}

function parseOptions(argv: string[]): Options {
  const cacheRoot =
    readOption(argv, "--cache-root", "-CacheRoot") ??
    path.join(desktopRoot, ".cache", "codex-app");

  return {
    version: readOption(argv, "--version", "-Version"),
    appcastUrl:
      readOption(argv, "--appcast-url", "-AppcastUrl") ??
      "https://persistent.oaistatic.com/codex-app-prod/appcast.xml",
    cacheRoot,
    force: hasFlag(argv, "--force", "-Force"),
  };
}

function firstMatch(text: string, pattern: RegExp, message: string): string {
  const match = text.match(pattern);
  if (!match?.[1]) {
    throw new Error(message);
  }
  return match[1].trim();
}

function findReleaseItem(appcast: string, version?: string): string {
  const items = [...appcast.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map(
    (match) => match[0],
  );
  if (items.length === 0) {
    throw new Error("No Codex app release was found in the appcast.");
  }
  if (!version) {
    return items.find((item) => /<enclosure\b/i.test(item)) ?? items[0];
  }

  const item = items.find((candidate) =>
    candidate.includes(`<sparkle:shortVersionString>${version}</sparkle:shortVersionString>`),
  );
  if (!item) {
    throw new Error(`Codex app version ${version} was not found in the appcast.`);
  }
  return item;
}

function findAppAsar(root: string): string | undefined {
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      const match = findAppAsar(entryPath);
      if (match) {
        return match;
      }
      continue;
    }

    const normalized = entryPath.replaceAll(path.sep, "/");
    if (normalized.endsWith("Codex.app/Contents/Resources/app.asar")) {
      return entryPath;
    }
  }
  return undefined;
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function isPathInside(parentPath: string, childPath: string): boolean {
  const relativePath = path.relative(path.resolve(parentPath), path.resolve(childPath));
  return relativePath === "" || (
    relativePath !== ".." &&
    !relativePath.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relativePath)
  );
}

function resolveLocalMarketplacePath(root: string, relativeSourcePath: string): string {
  if (!relativeSourcePath.trim()) {
    throw new Error("Bundled plugin marketplace source path is empty.");
  }
  if (path.isAbsolute(relativeSourcePath)) {
    throw new Error(`Bundled plugin marketplace source path must be relative: ${relativeSourcePath}`);
  }

  const resolvedPath = path.resolve(root, relativeSourcePath);
  if (!isPathInside(root, resolvedPath)) {
    throw new Error(`Bundled plugin marketplace source path escapes its root: ${relativeSourcePath}`);
  }

  return resolvedPath;
}

function requireBundledPluginName(plugin: MarketplacePlugin, marketplacePath: string): string {
  if (!plugin.name) {
    throw new Error(`Bundled plugin marketplace has an entry without a name: ${marketplacePath}`);
  }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(plugin.name)) {
    throw new Error(`Bundled plugin marketplace has an unsafe plugin name: ${plugin.name}`);
  }
  return plugin.name;
}

function packagedPluginSourcePath(pluginName: string): string {
  return `./plugins/${pluginName}`;
}

export function syncBundledPluginResources(
  appResourcesRoot: string,
  destinationPluginsRoot = bundledPluginsRoot,
): void {
  const sourceMarketplaceRoot = path.join(
    appResourcesRoot,
    "plugins",
    openAiBundledMarketplaceName,
  );
  const sourceMarketplacePath = path.join(
    sourceMarketplaceRoot,
    ".agents",
    "plugins",
    "marketplace.json",
  );

  if (!fs.existsSync(sourceMarketplacePath)) {
    throw new Error(`Missing bundled plugin marketplace: ${sourceMarketplacePath}`);
  }

  const sourceMarketplace = readJsonFile<MarketplaceJson>(sourceMarketplacePath);
  if (!Array.isArray(sourceMarketplace.plugins)) {
    throw new Error(`Bundled plugin marketplace does not list plugins: ${sourceMarketplacePath}`);
  }

  const selectedPlugins = sourceMarketplace.plugins.filter(
    (plugin) => !excludedBundledPluginNames.has(plugin.name ?? ""),
  );
  const selectedPluginNames = new Set(
    selectedPlugins.map((plugin) => requireBundledPluginName(plugin, sourceMarketplacePath)),
  );
  for (const requiredPluginName of requiredBundledPluginNames) {
    if (!selectedPluginNames.has(requiredPluginName)) {
      throw new Error(
        `Bundled plugin marketplace does not list required plugin ${requiredPluginName}: ${sourceMarketplacePath}`,
      );
    }
  }
  if (selectedPlugins.length === 0) {
    throw new Error(`Bundled plugin marketplace has no Windows plugins: ${sourceMarketplacePath}`);
  }

  const destinationMarketplaceRoot = path.join(
    destinationPluginsRoot,
    openAiBundledMarketplaceName,
  );
  const destinationMarketplacePath = path.join(
    destinationMarketplaceRoot,
    ".agents",
    "plugins",
    "marketplace.json",
  );
  const destinationPlugins: MarketplacePlugin[] = [];

  fs.rmSync(destinationMarketplaceRoot, { recursive: true, force: true });
  for (const plugin of selectedPlugins) {
    const pluginName = requireBundledPluginName(plugin, sourceMarketplacePath);
    if (plugin.source?.source !== "local" || !plugin.source.path) {
      throw new Error(
        `Bundled plugin ${pluginName} must use a local source path in ${sourceMarketplacePath}`,
      );
    }

    const sourcePluginRoot = resolveLocalMarketplacePath(sourceMarketplaceRoot, plugin.source.path);
    const sourcePluginJsonPath = path.join(sourcePluginRoot, ".codex-plugin", "plugin.json");
    if (!fs.existsSync(sourcePluginJsonPath)) {
      throw new Error(`Missing bundled plugin manifest: ${sourcePluginJsonPath}`);
    }

    const sourcePluginJson = readJsonFile<PluginJson>(sourcePluginJsonPath);
    if (sourcePluginJson.name !== pluginName) {
      throw new Error(
        `Bundled plugin manifest name mismatch: expected ${pluginName}, got ${
          sourcePluginJson.name ?? "<missing>"
        }`,
      );
    }

    const destinationPluginRoot = path.join(destinationMarketplaceRoot, "plugins", pluginName);
    fs.cpSync(sourcePluginRoot, destinationPluginRoot, { recursive: true, force: true });
    destinationPlugins.push({
      ...plugin,
      source: {
        ...plugin.source,
        source: "local",
        path: packagedPluginSourcePath(pluginName),
      },
    });
  }

  const destinationMarketplace: MarketplaceJson = {
    ...sourceMarketplace,
    plugins: destinationPlugins,
  };
  fs.mkdirSync(path.dirname(destinationMarketplacePath), { recursive: true });
  fs.writeFileSync(
    destinationMarketplacePath,
    `${JSON.stringify(destinationMarketplace, null, 2)}\n`,
    "utf8",
  );

  console.log(
    `Synced bundled plugin resources for Windows: ${destinationPlugins
      .map((plugin) => plugin.name)
      .join(", ")}`,
  );
}

async function downloadFile(url: string, outputPath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }

  fs.writeFileSync(outputPath, Buffer.from(await response.arrayBuffer()));
}

function listPackageRoots(nodeModulesRoot: string): string[] {
  if (!fs.existsSync(nodeModulesRoot)) {
    return [];
  }

  const packageRoots = [];
  for (const entry of fs.readdirSync(nodeModulesRoot, { withFileTypes: true })) {
    const entryPath = path.join(nodeModulesRoot, entry.name);
    if (!entry.isDirectory()) {
      continue;
    }

    if (entry.name.startsWith("@")) {
      for (const scopedEntry of fs.readdirSync(entryPath, { withFileTypes: true })) {
        if (scopedEntry.isDirectory()) {
          packageRoots.push(path.join(entryPath, scopedEntry.name));
        }
      }
      continue;
    }

    packageRoots.push(entryPath);
  }

  return packageRoots;
}

function hasNativePayload(packageRoot: string): boolean {
  if (
    fs.existsSync(path.join(packageRoot, "binding.gyp")) ||
    fs.existsSync(path.join(packageRoot, "prebuilds"))
  ) {
    return true;
  }

  const entries = fs.readdirSync(packageRoot, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(packageRoot, entry.name);
    if (entry.isDirectory() && entry.name !== "node_modules") {
      if (hasNativePayload(entryPath)) {
        return true;
      }
      continue;
    }

    if (
      entry.isFile() &&
      [".node", ".dll", ".dylib", ".so", ".exe"].includes(path.extname(entry.name))
    ) {
      return true;
    }
  }

  return false;
}

function findNativeNodeModules(recoveredRoot: string): NativeNodeModule[] {
  const nodeModulesRoot = path.join(recoveredRoot, "node_modules");
  const nativeModules = [];

  for (const packageRoot of listPackageRoots(nodeModulesRoot)) {
    if (!hasNativePayload(packageRoot)) {
      continue;
    }

    const packageJsonPath = path.join(packageRoot, "package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as {
      name?: string;
      version?: string;
    };
    if (!packageJson.name || !packageJson.version) {
      throw new Error(`Native Node module is missing name or version: ${packageJsonPath}`);
    }

    nativeModules.push({ name: packageJson.name, version: packageJson.version });
  }

  return nativeModules.sort((left, right) => left.name.localeCompare(right.name));
}

function packageRoot(root: string, packageName: string): string {
  return path.join(root, "node_modules", ...packageName.split("/"));
}

function readPackageJson(packageRootPath: string): PackageJson {
  return JSON.parse(fs.readFileSync(path.join(packageRootPath, "package.json"), "utf8")) as PackageJson;
}

function getInstalledPackageVersion(packageName: string): string | undefined {
  const packageRootPath = packageRoot(desktopRoot, packageName);
  if (!fs.existsSync(path.join(packageRootPath, "package.json"))) {
    return undefined;
  }

  return readPackageJson(packageRootPath).version;
}

function findInstalledPackageRoot(packageName: string, fromDirectory: string): string | undefined {
  let currentDirectory = fromDirectory;
  while (currentDirectory.startsWith(desktopRoot)) {
    const candidate = packageRoot(currentDirectory, packageName);
    if (fs.existsSync(path.join(candidate, "package.json"))) {
      return candidate;
    }

    const parentDirectory = path.dirname(currentDirectory);
    if (parentDirectory === currentDirectory) {
      break;
    }
    currentDirectory = parentDirectory;
  }

  return undefined;
}

function collectRuntimePackageRoots(packageNames: string[]): string[] {
  const packageRoots = [];
  const seenPackageRoots = new Set<string>();
  const pendingPackages = packageNames.map((packageName) => ({
    packageName,
    fromDirectory: desktopRoot,
    optional: false,
  }));

  while (pendingPackages.length > 0) {
    const nextPackage = pendingPackages.pop();
    if (!nextPackage) {
      break;
    }

    const packageRootPath = findInstalledPackageRoot(
      nextPackage.packageName,
      nextPackage.fromDirectory,
    );
    if (!packageRootPath) {
      if (nextPackage.optional) {
        continue;
      }
      throw new Error(`Missing installed runtime Node module: ${nextPackage.packageName}`);
    }
    if (seenPackageRoots.has(packageRootPath)) {
      continue;
    }

    seenPackageRoots.add(packageRootPath);
    packageRoots.push(packageRootPath);

    const packageJson = readPackageJson(packageRootPath);
    for (const packageName of Object.keys(packageJson.dependencies ?? {})) {
      pendingPackages.push({ packageName, fromDirectory: packageRootPath, optional: false });
    }
    for (const packageName of Object.keys(packageJson.optionalDependencies ?? {})) {
      pendingPackages.push({ packageName, fromDirectory: packageRootPath, optional: true });
    }
  }

  return packageRoots;
}

function readRuntimeElectronVersion(recoveredRoot: string): string {
  const packageJson = readPackageJson(recoveredRoot);
  const electronVersion = packageJson.devDependencies?.electron ?? packageJson.dependencies?.electron;
  if (!electronVersion) {
    throw new Error("Hydrated app package.json does not list its Electron version.");
  }
  return electronVersion;
}

function runtimeCacheKey(nativeModules: NativeNodeModule[], electronVersion: string): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({ electronVersion, nativeModules, target: "win32-arm64", version: 2 }))
    .digest("hex");
}

function runtimeCacheNodeModulesRoot(
  nativeModules: NativeNodeModule[],
  electronVersion: string,
): string {
  return path.join(
    runtimeNodeModulesCacheRoot,
    runtimeCacheKey(nativeModules, electronVersion),
    "node_modules",
  );
}

function copyPackageRoot(sourcePackageRoot: string, destinationNodeModulesRoot: string): void {
  const relativePackageRoot = path.relative(
    path.join(desktopRoot, "node_modules"),
    sourcePackageRoot,
  );
  const destinationPackageRoot = path.join(destinationNodeModulesRoot, relativePackageRoot);
  fs.mkdirSync(path.dirname(destinationPackageRoot), { recursive: true });
  fs.cpSync(sourcePackageRoot, destinationPackageRoot, { recursive: true, force: true });
}

function restoreNativeNodeModulesFromCache(
  nativeModules: NativeNodeModule[],
  electronVersion: string,
): boolean {
  const cacheNodeModulesRoot = runtimeCacheNodeModulesRoot(nativeModules, electronVersion);
  if (!fs.existsSync(cacheNodeModulesRoot)) {
    return false;
  }

  fs.mkdirSync(path.join(desktopRoot, "node_modules"), { recursive: true });
  fs.cpSync(cacheNodeModulesRoot, path.join(desktopRoot, "node_modules"), {
    recursive: true,
    force: true,
  });
  return true;
}

function saveNativeNodeModulesToCache(
  nativeModules: NativeNodeModule[],
  electronVersion: string,
): void {
  const cacheNodeModulesRoot = runtimeCacheNodeModulesRoot(nativeModules, electronVersion);
  fs.rmSync(cacheNodeModulesRoot, { recursive: true, force: true });
  fs.mkdirSync(cacheNodeModulesRoot, { recursive: true });

  for (const packageRootPath of collectRuntimePackageRoots(
    nativeModules.map((nativeModule) => nativeModule.name),
  )) {
    copyPackageRoot(packageRootPath, cacheNodeModulesRoot);
  }
}

function shouldValidatePePayload(filePath: string): boolean {
  const normalized = filePath.replaceAll(path.sep, "/");
  if (![".dll", ".exe", ".node"].includes(path.extname(filePath))) {
    return false;
  }

  if (/(?:^|\/)(?:darwin-[^/]+|linux-[^/]+|win32-x64|win10-x64)(?:\/|$)/.test(normalized)) {
    return false;
  }

  const prebuildMatch = normalized.match(/\/prebuilds\/([^/]+)\//);
  return !prebuildMatch || prebuildMatch[1] === "win32-arm64";
}

function isArm64Pe(filePath: string): boolean {
  const bytes = fs.readFileSync(filePath);
  if (bytes.length < 0x40 || bytes[0] !== 0x4d || bytes[1] !== 0x5a) {
    return true;
  }

  const peOffset = bytes.readInt32LE(0x3c);
  if (peOffset + 6 > bytes.length) {
    return false;
  }

  return bytes.readUInt16LE(peOffset + 4) === 0xaa64;
}

function hasArm64RuntimePayload(packageRootPath: string): boolean {
  for (const entry of fs.readdirSync(packageRootPath, { withFileTypes: true })) {
    const entryPath = path.join(packageRootPath, entry.name);
    if (entry.isDirectory()) {
      if (!hasArm64RuntimePayload(entryPath)) {
        return false;
      }
      continue;
    }

    if (entry.isFile() && shouldValidatePePayload(entryPath) && !isArm64Pe(entryPath)) {
      return false;
    }
  }

  return true;
}

function nativeNodeModulesReady(nativeModules: NativeNodeModule[]): boolean {
  for (const nativeModule of nativeModules) {
    const packageRootPath = packageRoot(desktopRoot, nativeModule.name);
    if (getInstalledPackageVersion(nativeModule.name) !== nativeModule.version) {
      return false;
    }
    if (!hasArm64RuntimePayload(packageRootPath)) {
      return false;
    }
  }

  return true;
}

function runNpm(args: string[]): void {
  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath && fs.existsSync(npmExecPath)) {
    execFileSync(process.execPath, [npmExecPath, ...args], {
      cwd: desktopRoot,
      stdio: "inherit",
    });
    return;
  }

  execFileSync(
    process.platform === "win32" ? "npm.cmd" : "npm",
    args,
    { cwd: desktopRoot, shell: process.platform === "win32", stdio: "inherit" },
  );
}

function runElectronRebuild(nativeModuleNames: string[], electronVersion: string): void {
  const electronRebuildCli = path.join(
    desktopRoot,
    "node_modules",
    "@electron",
    "rebuild",
    "lib",
    "cli.js",
  );
  if (!fs.existsSync(electronRebuildCli)) {
    throw new Error(`Missing electron-rebuild CLI: ${electronRebuildCli}`);
  }

  execFileSync(
    process.execPath,
    [
      electronRebuildCli,
      "--version",
      electronVersion,
      "--arch",
      "arm64",
      "--module-dir",
      desktopRoot,
      "--which-module",
      nativeModuleNames.join(","),
      "--force",
    ],
    { cwd: desktopRoot, stdio: "inherit" },
  );
}

function syncNativeNodeModules(recoveredRoot: string): void {
  const nativeModules = findNativeNodeModules(recoveredRoot);
  if (nativeModules.length === 0) {
    console.log("Hydrated app has no native Node modules.");
    return;
  }

  const electronVersion = readRuntimeElectronVersion(recoveredRoot);

  if (
    !nativeNodeModulesReady(nativeModules) &&
    restoreNativeNodeModulesFromCache(nativeModules, electronVersion)
  ) {
    console.log("Restored native Node modules from cache.");
  }
  if (nativeNodeModulesReady(nativeModules)) {
    if (!fs.existsSync(runtimeCacheNodeModulesRoot(nativeModules, electronVersion))) {
      saveNativeNodeModulesToCache(nativeModules, electronVersion);
    }
    console.log(
      `Native Node modules already match Windows ARM64: ${
        nativeModules.map((nativeModule) => nativeModule.name).join(", ")
      }`,
    );
    return;
  }

  const missingOrOutdatedModules = nativeModules.filter(
    (nativeModule) => getInstalledPackageVersion(nativeModule.name) !== nativeModule.version,
  );

  if (missingOrOutdatedModules.length > 0) {
    runNpm([
      "install",
      "--no-save",
      "--package-lock=false",
      "--no-audit",
      "--fund=false",
      ...missingOrOutdatedModules.map(
        (nativeModule) => `${nativeModule.name}@${nativeModule.version}`,
      ),
    ]);
  }

  const nativeModuleNames = nativeModules.map((nativeModule) => nativeModule.name);
  runElectronRebuild(nativeModuleNames, electronVersion);
  saveNativeNodeModulesToCache(nativeModules, electronVersion);
  console.log(`Synced native Node modules for Windows ARM64: ${nativeModuleNames.join(", ")}`);
}

function patchWindowsSelfSignedBundle(recoveredRoot: string): void {
  execFileSync(
    process.execPath,
    [
      path.join(desktopRoot, ".cache", "scripts", "patch-windows-self-signed-bundle.js"),
      "--recovered-root",
      recoveredRoot,
    ],
    { stdio: "inherit" },
  );
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  if (!options.appcastUrl.trim()) {
    throw new Error("Missing Codex appcast URL.");
  }

  fs.mkdirSync(options.cacheRoot, { recursive: true });

  const appcastResponse = await fetch(options.appcastUrl);
  if (!appcastResponse.ok) {
    throw new Error(
      `Failed to fetch Codex appcast: ${appcastResponse.status} ${appcastResponse.statusText}`,
    );
  }

  const item = findReleaseItem(await appcastResponse.text(), options.version);
  const selectedVersion = firstMatch(
    item,
    /<sparkle:shortVersionString>([^<]+)<\/sparkle:shortVersionString>/i,
    "The selected Codex app release does not have a version.",
  );
  const selectedBuildNumber =
    item.match(/<sparkle:version>([^<]+)<\/sparkle:version>/i)?.[1]?.trim() ?? "";
  const downloadUrl = firstMatch(
    item,
    /<enclosure\b[^>]*\burl="([^"]+)"/i,
    `Codex app version ${selectedVersion} does not have a full download URL.`,
  );

  const zipPath = path.join(options.cacheRoot, path.basename(new URL(downloadUrl).pathname));
  const extractRoot = path.join(options.cacheRoot, `extract-${selectedVersion}`);
  const recoveredRoot = path.join(desktopRoot, "recovered", "app-asar-extracted");
  const releaseInfoPath = path.join(options.cacheRoot, "latest-release.json");

  if (options.force) {
    fs.rmSync(zipPath, { force: true });
    fs.rmSync(extractRoot, { recursive: true, force: true });
  }

  if (!fs.existsSync(zipPath)) {
    await downloadFile(downloadUrl, zipPath);
  }

  if (!fs.existsSync(extractRoot)) {
    fs.mkdirSync(extractRoot, { recursive: true });
    await extract(zipPath, { dir: extractRoot });
  }

  const appAsar = findAppAsar(extractRoot);
  if (!appAsar) {
    throw new Error("Could not find Codex.app Contents/Resources/app.asar in the downloaded ZIP.");
  }
  syncBundledPluginResources(path.dirname(appAsar));

  execFileSync(
    process.execPath,
    [
      path.join(desktopRoot, "scripts", "refresh-recovered-from-dmg.mjs"),
      "--app-asar",
      appAsar,
      "--output",
      recoveredRoot,
    ],
    { stdio: "inherit" },
  );
  patchWindowsSelfSignedBundle(recoveredRoot);
  syncNativeNodeModules(recoveredRoot);

  fs.writeFileSync(
    releaseInfoPath,
    `${JSON.stringify(
      {
        version: selectedVersion,
        buildNumber: selectedBuildNumber,
        downloadUrl,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log(`Hydrated Codex app ${selectedVersion} from ${downloadUrl}`);
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}

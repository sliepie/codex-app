import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import extract from "extract-zip";
import {
  prepareBetterSqlite3ElectronRebuild,
  prepareElectronHeadersForNativeRebuild,
} from "./patch-better-sqlite3-electron";

type Options = {
  version?: string;
  buildNumber?: string;
  appcastUrl: string;
  cacheRoot: string;
  codexPlusPlusRepo: string;
  codexPlusPlusSha?: string;
  codexPlusPlusTag?: string;
  force: boolean;
};

type NativeNodeModule = {
  name: string;
  version: string;
};

type NativeNodeModuleRuntime = "electron" | "node";

type NativeNodeModulesTarget = {
  label: string;
  nodeModulesRoot: string;
  nativeModules: NativeNodeModule[];
  runtime: NativeNodeModuleRuntime;
};

type NpmEnvironment = Record<string, string | undefined>;

type PackageJson = {
  cpu?: string | string[];
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  main?: string;
  os?: string | string[];
  optionalDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  version?: string;
};

const targetRuntimeArch = "arm64";
const targetRuntimePlatform = "win32";

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

export type CodexPlusPlusRelease = {
  tag_name?: string;
  html_url?: string;
  commitSha?: string;
  zipball_url?: string;
  published_at?: string;
};

type GithubGitRef = {
  object?: {
    sha?: string | null;
    type?: string | null;
    url?: string | null;
  } | null;
};

type GithubGitTag = {
  object?: {
    sha?: string | null;
    type?: string | null;
  } | null;
};

function resolveDesktopRoot(): string {
  return path.basename(__dirname) === "scripts" && path.basename(path.dirname(__dirname)) === ".cache"
    ? path.resolve(__dirname, "..", "..")
    : path.resolve(__dirname, "..");
}

const desktopRoot = resolveDesktopRoot();
const runtimeNodeModulesCacheRoot = path.join(desktopRoot, ".cache", "runtime-node-modules");
const electronNativeModuleCacheInputPaths = [
  "package-lock.json",
  "scripts/hydrate-codex-app.ts",
  "scripts/patch-better-sqlite3-electron.ts",
] as const;
const bundledPluginsRoot = path.join(desktopRoot, "resources", "plugins");
const defaultCodexPlusPlusRepo = "b-nnett/codex-plusplus";
const codexPlusPlusRoot = path.join(desktopRoot, "codex-plusplus");
const openAiBundledMarketplaceName = "openai-bundled";
const excludedBundledPluginNames = new Set(["computer-use", "chrome", "latex"]);
const nodeAbi = require("node-abi") as {
  getAbi(target: string, runtime: "electron" | "node"): string;
};

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
    version: readOption(argv, "--version", "-Version") ?? process.env.CODEX_APP_VERSION,
    buildNumber:
      readOption(argv, "--build-number", "-BuildNumber") ??
      process.env.CODEX_APP_BUILD,
    appcastUrl:
      readOption(argv, "--appcast-url", "-AppcastUrl") ??
      "https://persistent.oaistatic.com/codex-app-prod/appcast.xml",
    cacheRoot,
    codexPlusPlusRepo:
      readOption(argv, "--codex-plusplus-repo", "-CodexPlusPlusRepo") ??
      process.env.CODEX_PLUS_PLUS_REPOSITORY ??
      defaultCodexPlusPlusRepo,
    codexPlusPlusTag:
      readOption(argv, "--codex-plusplus-tag", "-CodexPlusPlusTag") ??
      process.env.CODEX_PLUS_PLUS_TAG,
    codexPlusPlusSha:
      readOption(argv, "--codex-plusplus-sha", "-CodexPlusPlusSha") ??
      process.env.CODEX_PLUS_PLUS_SHA,
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

function releaseItemVersion(item: string): string | undefined {
  return item.match(/<sparkle:shortVersionString>([^<]+)<\/sparkle:shortVersionString>/i)?.[1]?.trim();
}

function releaseItemBuildNumber(item: string): string | undefined {
  return item.match(/<sparkle:version>([^<]+)<\/sparkle:version>/i)?.[1]?.trim();
}

function findReleaseItem(appcast: string, version?: string, buildNumber?: string): string {
  const items = [...appcast.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map(
    (match) => match[0],
  );
  if (items.length === 0) {
    throw new Error("No Codex app release was found in the appcast.");
  }
  if (!version) {
    return items.find((item) => /<enclosure\b/i.test(item)) ?? items[0];
  }

  const item = items.find((candidate) => {
    if (releaseItemVersion(candidate) !== version) {
      return false;
    }
    return !buildNumber || releaseItemBuildNumber(candidate) === buildNumber;
  });
  if (!item) {
    if (buildNumber) {
      throw new Error(`Codex app version ${version} build ${buildNumber} was not found in the appcast.`);
    }
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

  const syncedPluginNames = destinationPlugins.map((plugin) => plugin.name).join(", ") || "none";
  console.log(`Synced bundled plugin resources for Windows: ${syncedPluginNames}`);
}

async function downloadFile(
  url: string,
  outputPath: string,
  headers?: Record<string, string>,
): Promise<void> {
  const response = await fetch(url, headers ? { headers } : undefined);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }

  fs.writeFileSync(outputPath, Buffer.from(await response.arrayBuffer()));
}

function sanitizePathSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, "_");
}

function appExtractCacheSegment(version: string, buildNumber?: string): string {
  return sanitizePathSegment(buildNumber ? `${version}-build-${buildNumber}` : version);
}

function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "sliepie-codex-app-windows-build",
  };
  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

function repositoryApiPath(repository: string): string {
  const parts = repository.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error("Invalid GitHub repository value: " + repository);
  }

  return encodeURIComponent(parts[0]) + "/" + encodeURIComponent(parts[1]);
}

async function fetchCodexPlusPlusRelease(
  repository: string,
  tagName?: string,
): Promise<CodexPlusPlusRelease> {
  const releasePath = tagName
    ? `releases/tags/${encodeURIComponent(tagName)}`
    : "releases/latest";
  const response = await fetch(
    `https://api.github.com/repos/${repositoryApiPath(repository)}/${releasePath}`,
    {
      headers: githubHeaders(),
    },
  );
  if (!response.ok) {
    throw new Error(
      `Failed to fetch Codex++ release: ${response.status} ${response.statusText}`,
    );
  }

  return await response.json() as CodexPlusPlusRelease;
}

async function fetchCodexPlusPlusTagCommitSha(
  repository: string,
  tagName: string,
): Promise<string> {
  const response = await fetch(
    `https://api.github.com/repos/${repositoryApiPath(repository)}/git/ref/tags/${encodeURIComponent(tagName)}`,
    { headers: githubHeaders() },
  );
  if (!response.ok) {
    throw new Error(
      `Failed to resolve Codex++ tag ${tagName}: ${response.status} ${response.statusText}`,
    );
  }

  const ref = (await response.json()) as GithubGitRef;
  const object = ref.object;
  const sha = object?.sha ?? "";
  if (!sha) {
    throw new Error(`Codex++ tag ${tagName} did not include an object SHA.`);
  }

  if (object?.type !== "tag") {
    return sha;
  }

  const tagResponse = await fetch(
    object.url ?? `https://api.github.com/repos/${repositoryApiPath(repository)}/git/tags/${sha}`,
    { headers: githubHeaders() },
  );
  if (!tagResponse.ok) {
    throw new Error(
      `Failed to dereference Codex++ tag ${tagName}: ${tagResponse.status} ${tagResponse.statusText}`,
    );
  }

  const tag = (await tagResponse.json()) as GithubGitTag;
  const commitSha = tag.object?.sha ?? "";
  if (!commitSha || tag.object?.type !== "commit") {
    throw new Error(`Codex++ tag ${tagName} does not point to a commit.`);
  }

  return commitSha;
}

function findCodexPlusPlusSourceRoot(extractRoot: string): string | undefined {
  const pending = [extractRoot];
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) {
      continue;
    }

    const runtimeMainPath = path.join(
      current,
      "packages",
      "installer",
      "assets",
      "runtime",
      "main.js",
    );
    if (fs.existsSync(runtimeMainPath)) {
      return current;
    }

    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        pending.push(path.join(current, entry.name));
      }
    }
  }

  return undefined;
}

export function syncCodexPlusPlusRuntimeAssets(
  sourceRoot: string,
  release: CodexPlusPlusRelease,
  destinationRoot = codexPlusPlusRoot,
  repository = defaultCodexPlusPlusRepo,
): void {
  const runtimeSourceRoot = path.join(
    sourceRoot,
    "packages",
    "installer",
    "assets",
    "runtime",
  );
  const runtimeDestinationRoot = path.join(destinationRoot, "runtime");
  const licensePath = path.join(sourceRoot, "LICENSE");

  for (const fileName of ["main.js", "preload.js"]) {
    const filePath = path.join(runtimeSourceRoot, fileName);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Codex++ release is missing runtime asset ${fileName}.`);
    }
  }
  const preloadSource = fs.readFileSync(path.join(runtimeSourceRoot, "preload.js"), "utf8");
  if (
    !preloadSource.includes("codexpp:settings-surface") ||
    !preloadSource.includes("__codexppSettingsSurfaceVisible") ||
    !/\bdetail\s*:\s*\{[\s\S]*?\bvisible\b/.test(preloadSource)
  ) {
    throw new Error("Codex++ release runtime is missing the settings surface event contract.");
  }
  if (!fs.existsSync(licensePath)) {
    throw new Error("Codex++ release is missing LICENSE.");
  }

  fs.rmSync(runtimeDestinationRoot, { recursive: true, force: true });
  fs.mkdirSync(destinationRoot, { recursive: true });
  fs.cpSync(runtimeSourceRoot, runtimeDestinationRoot, { recursive: true });
  fs.copyFileSync(licensePath, path.join(destinationRoot, "LICENSE"));
  fs.writeFileSync(
    path.join(destinationRoot, "release.json"),
    `${JSON.stringify(
      {
        repo: repository,
        tagName: release.tag_name,
        commitSha: release.commitSha,
        releaseUrl: release.html_url,
        zipballUrl: release.zipball_url,
        publishedAt: release.published_at,
        hydratedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

async function hydrateCodexPlusPlusRuntime(
  cacheRoot: string,
  repository: string,
  force: boolean,
  pinnedTagName?: string,
  pinnedCommitSha?: string,
): Promise<void> {
  const release = await fetchCodexPlusPlusRelease(repository, pinnedTagName);
  const tagName = release.tag_name?.trim();
  if (!tagName) {
    throw new Error("Latest Codex++ release is missing a tag.");
  }
  const commitSha = await fetchCodexPlusPlusTagCommitSha(repository, tagName);
  if (pinnedCommitSha && pinnedCommitSha.toLowerCase() !== commitSha.toLowerCase()) {
    throw new Error(
      `Codex++ tag ${tagName} resolved to ${commitSha}, expected ${pinnedCommitSha}.`,
    );
  }

  const zipballUrl = `https://api.github.com/repos/${repositoryApiPath(repository)}/zipball/${commitSha}`;
  const safeTagName = sanitizePathSegment(`${tagName}-${commitSha.slice(0, 12)}`);
  const codexPlusPlusCacheRoot = path.join(cacheRoot, "codex-plusplus");
  const zipPath = path.join(codexPlusPlusCacheRoot, `${safeTagName}.zip`);
  const extractRoot = path.join(codexPlusPlusCacheRoot, `extract-${safeTagName}`);
  fs.mkdirSync(codexPlusPlusCacheRoot, { recursive: true });

  if (force) {
    fs.rmSync(zipPath, { force: true });
    fs.rmSync(extractRoot, { recursive: true, force: true });
  }

  if (!fs.existsSync(zipPath)) {
    await downloadFile(zipballUrl, zipPath, githubHeaders());
  }

  if (!fs.existsSync(extractRoot)) {
    fs.mkdirSync(extractRoot, { recursive: true });
    await extract(zipPath, { dir: extractRoot });
  }

  const sourceRoot = findCodexPlusPlusSourceRoot(extractRoot);
  if (!sourceRoot) {
    throw new Error("Could not find Codex++ runtime assets in the latest release archive.");
  }

  syncCodexPlusPlusRuntimeAssets(
    sourceRoot,
    {
      ...release,
      commitSha,
      zipball_url: zipballUrl,
    },
    codexPlusPlusRoot,
    repository,
  );
  console.log(`Hydrated Codex++ ${tagName} (${commitSha}) from ${release.html_url ?? zipballUrl}`);
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
  if (fs.existsSync(path.join(packageRoot, "prebuilds"))) {
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
      (entry.name === "binding.gyp" ||
        [".node", ".dll", ".dylib", ".so", ".exe"].includes(path.extname(entry.name)))
    ) {
      return true;
    }
  }

  return false;
}

function findNativeNodeModules(nodeModulesRoot: string): NativeNodeModule[] {
  const nativeModules = [];

  for (const packageRoot of listPackageRoots(nodeModulesRoot)) {
    if (!hasNativePayload(packageRoot)) {
      continue;
    }

    const packageJsonPath = path.join(packageRoot, "package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as PackageJson & {
      name?: string;
    };
    if (!packageJson.name || !packageJson.version) {
      throw new Error(`Native Node module is missing name or version: ${packageJsonPath}`);
    }

    if (!supportsTargetRuntime(packageJson)) {
      console.log(
        `Skipping native Node module not supported on Windows ARM64: ${packageJson.name}@${packageJson.version}`,
      );
      continue;
    }

    nativeModules.push({ name: packageJson.name, version: packageJson.version });
  }

  return nativeModules.sort((left, right) => left.name.localeCompare(right.name));
}

function packageRoot(nodeModulesRoot: string, packageName: string): string {
  return path.join(nodeModulesRoot, ...packageName.split("/"));
}

function readPackageJson(packageRootPath: string): PackageJson {
  return JSON.parse(fs.readFileSync(path.join(packageRootPath, "package.json"), "utf8")) as PackageJson;
}

function packageListAllowsTarget(value: string | string[] | undefined, target: string): boolean {
  if (!value) {
    return true;
  }

  const entries = Array.isArray(value) ? value : [value];
  if (entries.includes(`!${target}`)) {
    return false;
  }

  const allowedEntries = entries.filter((entry) => !entry.startsWith("!"));
  return allowedEntries.length === 0 || allowedEntries.includes(target);
}

function supportsTargetRuntime(packageJson: PackageJson): boolean {
  return (
    packageListAllowsTarget(packageJson.os, targetRuntimePlatform) &&
    packageListAllowsTarget(packageJson.cpu, targetRuntimeArch)
  );
}

function getInstalledPackageVersion(
  nodeModulesRoot: string,
  packageName: string,
): string | undefined {
  const packageRootPath = packageRoot(nodeModulesRoot, packageName);
  if (!fs.existsSync(path.join(packageRootPath, "package.json"))) {
    return undefined;
  }

  return readPackageJson(packageRootPath).version;
}

function findInstalledPackageRoot(
  nodeModulesRoot: string,
  packageName: string,
  fromDirectory: string,
): string | undefined {
  const moduleRoot = path.dirname(nodeModulesRoot);
  let currentDirectory = fromDirectory;
  while (isPathInside(moduleRoot, currentDirectory)) {
    const candidate = path.join(currentDirectory, "node_modules", ...packageName.split("/"));
    if (fs.existsSync(path.join(candidate, "package.json"))) {
      return candidate;
    }

    if (path.resolve(currentDirectory) === path.resolve(moduleRoot)) {
      break;
    }
    const parentDirectory = path.dirname(currentDirectory);
    if (parentDirectory === currentDirectory) {
      break;
    }
    currentDirectory = parentDirectory;
  }

  return undefined;
}

function collectRuntimePackageRoots(
  nodeModulesRoot: string,
  packageNames: string[],
): string[] {
  const packageRoots = [];
  const seenPackageRoots = new Set<string>();
  const moduleRoot = path.dirname(nodeModulesRoot);
  const pendingPackages = packageNames.map((packageName) => ({
    packageName,
    fromDirectory: moduleRoot,
    optional: false,
  }));

  while (pendingPackages.length > 0) {
    const nextPackage = pendingPackages.pop();
    if (!nextPackage) {
      break;
    }

    const packageRootPath = findInstalledPackageRoot(
      nodeModulesRoot,
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
      pendingPackages.push({ packageName, fromDirectory: packageRootPath, optional: true });
    }
    for (const packageName of Object.keys(packageJson.optionalDependencies ?? {})) {
      pendingPackages.push({ packageName, fromDirectory: packageRootPath, optional: true });
    }
  }

  return packageRoots;
}

function readPackageElectronVersion(packageRoot: string, label: string): string {
  const packageJson = readPackageJson(packageRoot);
  const electronVersion = packageJson.devDependencies?.electron ?? packageJson.dependencies?.electron;
  if (!electronVersion) {
    throw new Error(`${label} package.json does not list its Electron version.`);
  }
  return electronVersion;
}

function readBundledNodeVersion(appResourcesRoot: string): string {
  const nodePath = path.join(appResourcesRoot, "node");
  if (!fs.existsSync(nodePath)) {
    throw new Error(`Missing bundled macOS Node executable: ${nodePath}`);
  }

  const binaryText = fs.readFileSync(nodePath).toString("latin1");
  const counts = new Map<string, number>();
  for (const match of binaryText.matchAll(/v\d+\.\d+\.\d+/g)) {
    const version = match[0];
    counts.set(version, (counts.get(version) ?? 0) + 1);
  }

  const candidates = [...counts.entries()]
    .filter(([version]) => Number(version.slice(1).split(".")[0]) >= 20)
    .sort((left, right) => right[1] - left[1]);
  const version = candidates[0]?.[0];
  if (!version) {
    throw new Error("Could not detect bundled macOS Node version.");
  }

  return version;
}

function normalizeRuntimeVersion(version: string): string {
  return version.replace(/^v/i, "");
}

function runtimeAbi(runtime: NativeNodeModuleRuntime, runtimeVersion: string): string {
  return nodeAbi.getAbi(normalizeRuntimeVersion(runtimeVersion), runtime);
}

function cacheInputHash(inputPaths: readonly string[]): string {
  const hash = crypto.createHash("sha256");
  for (const inputPath of inputPaths) {
    hash.update(inputPath);
    hash.update("\0");
    hash.update(fs.readFileSync(path.resolve(desktopRoot, inputPath)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function runtimeCacheKey(
  nativeModules: NativeNodeModule[],
  runtime: NativeNodeModuleRuntime,
  runtimeVersion: string,
): string {
  if (runtime === "electron") {
    return crypto
      .createHash("sha256")
      .update(JSON.stringify({
        electronVersion: runtimeVersion,
        inputHash: cacheInputHash(electronNativeModuleCacheInputPaths),
        nativeModules,
        target: "win32-arm64",
        version: 4,
      }))
      .digest("hex");
  }

  return crypto
    .createHash("sha256")
    .update(JSON.stringify({
      nativeModules,
      runtime,
      runtimeVersion: normalizeRuntimeVersion(runtimeVersion),
      target: "win32-arm64",
      version: 1,
    }))
    .digest("hex");
}

function runtimeCacheNodeModulesRoot(
  nativeModules: NativeNodeModule[],
  runtime: NativeNodeModuleRuntime,
  runtimeVersion: string,
): string {
  return path.join(
    runtimeNodeModulesCacheRoot,
    runtimeCacheKey(nativeModules, runtime, runtimeVersion),
    "node_modules",
  );
}

function copyPackageRoot(
  sourceNodeModulesRoot: string,
  sourcePackageRoot: string,
  destinationNodeModulesRoot: string,
): void {
  const relativePackageRoot = path.relative(
    sourceNodeModulesRoot,
    sourcePackageRoot,
  );
  const destinationPackageRoot = path.join(destinationNodeModulesRoot, relativePackageRoot);
  fs.mkdirSync(path.dirname(destinationPackageRoot), { recursive: true });
  fs.cpSync(sourcePackageRoot, destinationPackageRoot, { recursive: true, force: true });
}

function restoreNativeNodeModulesFromCache(
  nodeModulesRoot: string,
  nativeModules: NativeNodeModule[],
  runtime: NativeNodeModuleRuntime,
  runtimeVersion: string,
): boolean {
  const cacheNodeModulesRoot = runtimeCacheNodeModulesRoot(nativeModules, runtime, runtimeVersion);
  if (!fs.existsSync(cacheNodeModulesRoot)) {
    return false;
  }

  fs.mkdirSync(nodeModulesRoot, { recursive: true });
  fs.cpSync(cacheNodeModulesRoot, nodeModulesRoot, {
    recursive: true,
    force: true,
  });
  return true;
}

function saveNativeNodeModulesToCache(
  nodeModulesRoot: string,
  nativeModules: NativeNodeModule[],
  runtime: NativeNodeModuleRuntime,
  runtimeVersion: string,
): void {
  const cacheNodeModulesRoot = runtimeCacheNodeModulesRoot(nativeModules, runtime, runtimeVersion);
  fs.rmSync(cacheNodeModulesRoot, { recursive: true, force: true });
  fs.mkdirSync(cacheNodeModulesRoot, { recursive: true });

  for (const packageRootPath of collectRuntimePackageRoots(
    nodeModulesRoot,
    nativeModules.map((nativeModule) => nativeModule.name),
  )) {
    copyPackageRoot(nodeModulesRoot, packageRootPath, cacheNodeModulesRoot);
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
    return false;
  }

  const peOffset = bytes.readInt32LE(0x3c);
  if (peOffset + 6 > bytes.length) {
    return false;
  }

  return bytes.readUInt16LE(peOffset + 4) === 0xaa64;
}

function readArm64RuntimePayloadStatus(packageRootPath: string): {
  hasInvalidRuntimePayload: boolean;
  hasTargetRuntimePayload: boolean;
} {
  let hasTargetRuntimePayload = false;

  for (const entry of fs.readdirSync(packageRootPath, { withFileTypes: true })) {
    const entryPath = path.join(packageRootPath, entry.name);
    if (entry.isDirectory()) {
      const childStatus = readArm64RuntimePayloadStatus(entryPath);
      if (childStatus.hasInvalidRuntimePayload) {
        return { hasInvalidRuntimePayload: true, hasTargetRuntimePayload };
      }
      hasTargetRuntimePayload ||= childStatus.hasTargetRuntimePayload;
      continue;
    }

    if (entry.isFile() && shouldValidatePePayload(entryPath)) {
      hasTargetRuntimePayload = true;
      if (!isArm64Pe(entryPath)) {
        return { hasInvalidRuntimePayload: true, hasTargetRuntimePayload };
      }
    }
  }

  return { hasInvalidRuntimePayload: false, hasTargetRuntimePayload };
}

export function hasArm64RuntimePayload(packageRootPath: string): boolean {
  const status = readArm64RuntimePayloadStatus(packageRootPath);
  return status.hasTargetRuntimePayload && !status.hasInvalidRuntimePayload;
}

type RuntimeMetadata = {
  abi?: string;
  arch?: string;
  platform?: string;
  runtime?: string;
};

function readRuntimeMetadata(filePath: string): RuntimeMetadata | undefined {
  if (!fs.existsSync(filePath)) {
    return undefined;
  }

  const source = fs.readFileSync(filePath, "utf8").trim();
  if (!source) {
    return undefined;
  }

  try {
    return JSON.parse(source) as RuntimeMetadata;
  } catch {
    const parts = source.split("-");
    const abi = parts.at(-1);
    return {
      abi,
      arch: parts[0],
      platform: targetRuntimePlatform,
    };
  }
}

function hasRuntimeMetadata(
  packageRootPath: string,
  runtime: NativeNodeModuleRuntime,
  abi: string,
): boolean {
  for (const metadataPath of [
    path.join(packageRootPath, "build", "Release", ".codex-runtime-meta.json"),
    path.join(packageRootPath, "build", "Release", ".forge-meta"),
  ]) {
    const metadata = readRuntimeMetadata(metadataPath);
    if (
      metadata?.abi === abi &&
      metadata.arch === targetRuntimeArch &&
      metadata.platform === targetRuntimePlatform &&
      (!metadata.runtime || metadata.runtime === runtime)
    ) {
      return true;
    }
  }

  return false;
}

function hasNapiPrebuildEvidence(packageRootPath: string): boolean {
  const packageJson = readPackageJson(packageRootPath);
  const scripts = Object.values(packageJson.scripts ?? {});
  return (
    scripts.some((script) => /\bnapi\b/.test(script)) ||
    packageJson.dependencies?.["napi-macros"] !== undefined ||
    packageJson.devDependencies?.["napi-macros"] !== undefined ||
    packageJson.dependencies?.["node-addon-api"] !== undefined ||
    packageJson.devDependencies?.["node-addon-api"] !== undefined
  );
}

function hasMatchingAbiPath(packageRootPath: string, abi: string): boolean {
  const binRoot = path.join(packageRootPath, "bin", `${targetRuntimePlatform}-${targetRuntimeArch}-${abi}`);
  if (fs.existsSync(binRoot) && fs.readdirSync(binRoot).some((entry) => entry.endsWith(".node"))) {
    return true;
  }

  const prebuildRoot = path.join(packageRootPath, "prebuilds", `${targetRuntimePlatform}-${targetRuntimeArch}`);
  if (!fs.existsSync(prebuildRoot)) {
    return false;
  }

  const hasNapiEvidence = hasNapiPrebuildEvidence(packageRootPath);
  return fs.readdirSync(prebuildRoot).some((entry) => {
    if (!entry.endsWith(".node")) {
      return false;
    }

    const tags = entry.split(".").slice(0, -1);
    const runtimeTag = tags.find((tag) => ["electron", "node", "node-webkit"].includes(tag));
    if (runtimeTag && runtimeTag !== "node") {
      return false;
    }

    const abiTag = tags.find((tag) => tag.startsWith("abi"));
    if (abiTag) {
      return abiTag === `abi${abi}`;
    }
    if (tags.includes("napi")) {
      return true;
    }
    return hasNapiEvidence;
  });
}

function hasMatchingRuntimePayload(
  packageRootPath: string,
  runtime: NativeNodeModuleRuntime,
  abi: string,
): boolean {
  return hasRuntimeMetadata(packageRootPath, runtime, abi) || hasMatchingAbiPath(packageRootPath, abi);
}

function writeRuntimeMetadata(
  nodeModulesRoot: string,
  nativeModules: NativeNodeModule[],
  runtime: NativeNodeModuleRuntime,
  abi: string,
): void {
  for (const nativeModule of nativeModules) {
    const packageRootPath = packageRoot(nodeModulesRoot, nativeModule.name);
    if (!hasArm64RuntimePayload(packageRootPath)) {
      continue;
    }

    const metadataPath = path.join(
      packageRootPath,
      "build",
      "Release",
      ".codex-runtime-meta.json",
    );
    if (!fs.existsSync(path.dirname(metadataPath))) {
      continue;
    }

    fs.writeFileSync(
      metadataPath,
      `${JSON.stringify(
        {
          abi,
          arch: targetRuntimeArch,
          platform: targetRuntimePlatform,
          runtime,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  }
}

function nativeNodeModulesReady(
  target: NativeNodeModulesTarget,
  runtimeVersion: string,
): boolean {
  const abi = runtimeAbi(target.runtime, runtimeVersion);
  return target.nativeModules.every((nativeModule) =>
    nativeNodeModuleReady(target, nativeModule, abi),
  );
}

function nativeNodeModuleReady(
  target: NativeNodeModulesTarget,
  nativeModule: NativeNodeModule,
  abi: string,
): boolean {
  const packageRootPath = packageRoot(target.nodeModulesRoot, nativeModule.name);
  return (
    getInstalledPackageVersion(target.nodeModulesRoot, nativeModule.name) === nativeModule.version &&
    hasArm64RuntimePayload(packageRootPath) &&
    hasMatchingRuntimePayload(packageRootPath, target.runtime, abi)
  );
}

function runNpm(args: string[], cwd = desktopRoot, env: NpmEnvironment = process.env): void {
  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath && fs.existsSync(npmExecPath)) {
    execFileSync(process.execPath, [npmExecPath, ...args], {
      cwd,
      env,
      stdio: "inherit",
    });
    return;
  }

  execFileSync(
    process.platform === "win32" ? "npm.cmd" : "npm",
    args,
    { cwd, env, shell: process.platform === "win32", stdio: "inherit" },
  );
}

function nativeNpmInstallEnv(
  target: NativeNodeModulesTarget,
  runtimeVersion: string,
): NpmEnvironment {
  const env = {
    ...process.env,
    npm_config_arch: targetRuntimeArch,
    npm_config_platform: targetRuntimePlatform,
    npm_config_target: normalizeRuntimeVersion(runtimeVersion),
  };

  if (target.runtime === "electron") {
    return {
      ...env,
      npm_config_runtime: "electron",
      npm_config_disturl: "https://electronjs.org/headers",
      npm_config_dist_url: "https://electronjs.org/headers",
    };
  }

  return {
    ...env,
    npm_config_runtime: "node",
  };
}

function findPrebuildInstallBin(
  packageRootPath: string,
  nodeModulesRoot: string,
): string | undefined {
  for (const candidate of [
    path.join(packageRootPath, "node_modules", "prebuild-install", "bin.js"),
    path.join(nodeModulesRoot, "prebuild-install", "bin.js"),
  ]) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

function packageUsesPrebuildInstall(packageRootPath: string): boolean {
  const packageJson = readPackageJson(packageRootPath);
  return /\bprebuild-install\b/.test(packageJson.scripts?.install ?? "");
}

function runElectronPrebuildInstall(
  target: NativeNodeModulesTarget,
  nativeModules: NativeNodeModule[],
  electronVersion: string,
): void {
  const abi = runtimeAbi("electron", electronVersion);
  const env = nativeNpmInstallEnv(target, electronVersion);

  for (const nativeModule of nativeModules) {
    if (nativeNodeModuleReady(target, nativeModule, abi)) {
      continue;
    }

    const packageRootPath = packageRoot(target.nodeModulesRoot, nativeModule.name);
    if (!packageUsesPrebuildInstall(packageRootPath)) {
      continue;
    }

    const prebuildInstallBin = findPrebuildInstallBin(packageRootPath, target.nodeModulesRoot);
    if (!prebuildInstallBin) {
      throw new Error(
        `Missing prebuild-install for ${nativeModule.name}@${nativeModule.version}.`,
      );
    }

    console.log(
      `Installing Windows ARM64 electron prebuild for ${nativeModule.name}@${nativeModule.version} (runtime ${normalizeRuntimeVersion(electronVersion)}, ABI ${abi}).`,
    );
    try {
      execFileSync(
        process.execPath,
        [
          prebuildInstallBin,
          "--runtime",
          "electron",
          "--target",
          normalizeRuntimeVersion(electronVersion),
          "--arch",
          targetRuntimeArch,
          "--platform",
          targetRuntimePlatform,
        ],
        {
          cwd: packageRootPath,
          env,
          stdio: "inherit",
        },
      );
    } catch {
      console.log(
        `No Windows ARM64 electron prebuild was installed for ${nativeModule.name}@${nativeModule.version}; source rebuild remains the last resort.`,
      );
    }
  }
}

function runElectronRebuild(
  nativeModuleNames: string[],
  electronVersion: string,
  moduleRoot: string,
  env: NpmEnvironment = process.env,
): void {
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
      moduleRoot,
      "--which-module",
      nativeModuleNames.join(","),
      "--force",
    ],
    { cwd: desktopRoot, env, stdio: "inherit" },
  );
}

function runNodeGypBuildInstall(
  packageRootPath: string,
  nodeModulesRoot: string,
  nodeVersion: string,
): void {
  const nodeGypBuildBin = path.join(nodeModulesRoot, "node-gyp-build", "bin.js");
  if (!fs.existsSync(nodeGypBuildBin)) {
    throw new Error(`Missing node-gyp-build CLI for Node runtime rebuild: ${nodeGypBuildBin}`);
  }

  const pathValue = process.env.PATH ?? "";
  const pathDelimiter = process.platform === "win32" ? ";" : ":";
  execFileSync(process.execPath, [nodeGypBuildBin], {
    cwd: packageRootPath,
    env: {
      ...process.env,
      PATH: `${path.join(desktopRoot, "node_modules", ".bin")}${pathDelimiter}${pathValue}`,
      npm_config_arch: targetRuntimeArch,
      npm_config_build_from_source: "true",
      npm_config_dist_url: "https://nodejs.org/download/release",
      npm_config_disturl: "https://nodejs.org/download/release",
      npm_config_platform: targetRuntimePlatform,
      npm_config_target: normalizeRuntimeVersion(nodeVersion),
    },
    stdio: "inherit",
  });
}

function runNodeRebuild(
  nativeModules: NativeNodeModule[],
  nodeVersion: string,
  nodeModulesRoot: string,
): void {
  for (const nativeModule of nativeModules) {
    const packageRootPath = packageRoot(nodeModulesRoot, nativeModule.name);
    const packageJson = readPackageJson(packageRootPath);
    if (
      packageJson.scripts?.install !== "node-gyp-build" &&
      !packageJson.dependencies?.["node-gyp-build"]
    ) {
      throw new Error(
        `Unsupported Node runtime native module rebuild script for ${nativeModule.name}@${nativeModule.version}.`,
      );
    }

    runNodeGypBuildInstall(packageRootPath, nodeModulesRoot, nodeVersion);
  }
}

function withTemporaryPackageJson(
  moduleRoot: string,
  nativeModules: NativeNodeModule[],
  callback: () => void,
): void {
  const packageJsonPath = path.join(moduleRoot, "package.json");
  const originalPackageJson = fs.existsSync(packageJsonPath)
    ? fs.readFileSync(packageJsonPath, "utf8")
    : undefined;

  fs.writeFileSync(
    packageJsonPath,
    `${JSON.stringify(
      {
        private: true,
        dependencies: Object.fromEntries(
          nativeModules.map((nativeModule) => [nativeModule.name, nativeModule.version]),
        ),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  try {
    callback();
  } finally {
    if (originalPackageJson === undefined) {
      fs.rmSync(packageJsonPath, { force: true });
    } else {
      fs.writeFileSync(packageJsonPath, originalPackageJson, "utf8");
    }
  }
}

function findNestedNodeModulesRoots(root: string): string[] {
  if (!fs.existsSync(root)) {
    return [];
  }

  const nodeModulesRoots: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name);
    if (!entry.isDirectory()) {
      continue;
    }
    if (entry.name === "node_modules") {
      nodeModulesRoots.push(entryPath);
      continue;
    }

    nodeModulesRoots.push(...findNestedNodeModulesRoots(entryPath));
  }

  return nodeModulesRoots;
}

function nativeTargetLabel(nodeModulesRoot: string): string {
  const relativePath = path.relative(desktopRoot, nodeModulesRoot).replaceAll(path.sep, "/");
  return relativePath || nodeModulesRoot;
}

export function collectNativeNodeModuleTargets(
  recoveredRoot: string,
  pluginsRoot = bundledPluginsRoot,
): NativeNodeModulesTarget[] {
  const nodeModulesRoots: Array<{ nodeModulesRoot: string; runtime: NativeNodeModuleRuntime }> = [
    { nodeModulesRoot: path.join(recoveredRoot, "node_modules"), runtime: "electron" },
    ...findNestedNodeModulesRoots(pluginsRoot).map((nodeModulesRoot) => ({
      nodeModulesRoot,
      runtime: "node" as const,
    })),
  ];
  const seenNodeModulesRoots = new Set<string>();
  const targets: NativeNodeModulesTarget[] = [];

  for (const { nodeModulesRoot, runtime } of nodeModulesRoots) {
    const resolvedNodeModulesRoot = path.resolve(nodeModulesRoot);
    if (seenNodeModulesRoots.has(resolvedNodeModulesRoot)) {
      continue;
    }
    seenNodeModulesRoots.add(resolvedNodeModulesRoot);

    const nativeModules = findNativeNodeModules(nodeModulesRoot);
    if (nativeModules.length === 0) {
      continue;
    }

    targets.push({
      label: nativeTargetLabel(nodeModulesRoot),
      nodeModulesRoot,
      nativeModules,
      runtime,
    });
  }

  return targets;
}

function removeForeignPrebuildsRecursive(nodeModulesRoot: string): void {
  if (!fs.existsSync(nodeModulesRoot)) {
    return;
  }

  for (const entry of fs.readdirSync(nodeModulesRoot, { withFileTypes: true })) {
    const entryPath = path.join(nodeModulesRoot, entry.name);
    if (!entry.isDirectory()) {
      continue;
    }
    if (entry.name === "prebuilds") {
      for (const prebuildEntry of fs.readdirSync(entryPath, { withFileTypes: true })) {
        if (prebuildEntry.isDirectory() && prebuildEntry.name !== "win32-arm64") {
          fs.rmSync(path.join(entryPath, prebuildEntry.name), { recursive: true, force: true });
        }
      }
      continue;
    }

    removeForeignPrebuildsRecursive(entryPath);
  }
}

function removeUnusedNodePtyFallbackPayloads(nodeModulesRoot: string): void {
  const nodePtyRoot = packageRoot(nodeModulesRoot, "node-pty");
  if (!fs.existsSync(nodePtyRoot)) {
    return;
  }

  for (const payloadPath of [
    path.join(
      nodePtyRoot,
      "prebuilds",
      `${targetRuntimePlatform}-${targetRuntimeArch}`,
      "conpty",
    ),
    path.join(nodePtyRoot, "third_party", "conpty"),
    path.join(
      nodePtyRoot,
      "prebuilds",
      `${targetRuntimePlatform}-${targetRuntimeArch}`,
      "winpty.dll",
    ),
    path.join(
      nodePtyRoot,
      "prebuilds",
      `${targetRuntimePlatform}-${targetRuntimeArch}`,
      "winpty-agent.exe",
    ),
  ]) {
    fs.rmSync(payloadPath, { recursive: true, force: true });
  }
}

function removeDebugSymbolPayloads(nodeModulesRoot: string): void {
  if (!fs.existsSync(nodeModulesRoot)) {
    return;
  }

  for (const entry of fs.readdirSync(nodeModulesRoot, { withFileTypes: true })) {
    const entryPath = path.join(nodeModulesRoot, entry.name);
    if (entry.isDirectory()) {
      removeDebugSymbolPayloads(entryPath);
      continue;
    }
    if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".pdb") {
      fs.rmSync(entryPath, { force: true });
    }
  }
}

export function pruneUnusedNativePayloads(nodeModulesRoot: string): void {
  removeForeignPrebuildsRecursive(nodeModulesRoot);
  removeUnusedNodePtyFallbackPayloads(nodeModulesRoot);
  removeDebugSymbolPayloads(nodeModulesRoot);
}

function syncNativeNodeModulesTarget(
  target: NativeNodeModulesTarget,
  runtimeVersion: string,
): void {
  const nativeModules = target.nativeModules;
  const moduleRoot = path.dirname(target.nodeModulesRoot);
  const abi = runtimeAbi(target.runtime, runtimeVersion);

  console.log(
    `Checking Windows ARM64 ${target.runtime} native Node modules in ${target.label}: ${
      nativeModules.map((nativeModule) => nativeModule.name).join(", ")
    } (runtime ${normalizeRuntimeVersion(runtimeVersion)}, ABI ${abi})`,
  );

  if (
    !nativeNodeModulesReady(target, runtimeVersion) &&
    restoreNativeNodeModulesFromCache(
      target.nodeModulesRoot,
      nativeModules,
      target.runtime,
      runtimeVersion,
    )
  ) {
    console.log(`Restored native Node modules from cache for ${target.label}.`);
  }
  pruneUnusedNativePayloads(target.nodeModulesRoot);

  if (nativeNodeModulesReady(target, runtimeVersion)) {
    if (!fs.existsSync(runtimeCacheNodeModulesRoot(nativeModules, target.runtime, runtimeVersion))) {
      saveNativeNodeModulesToCache(
        target.nodeModulesRoot,
        nativeModules,
        target.runtime,
        runtimeVersion,
      );
    }
    console.log(
      `Native Node modules already match Windows ARM64 ${target.runtime} ABI ${abi} in ${target.label}: ${
        nativeModules.map((nativeModule) => nativeModule.name).join(", ")
      }`,
    );
    return;
  }

  const modulesRequiringInstall = nativeModules.filter(
    (nativeModule) => !nativeNodeModuleReady(target, nativeModule, abi),
  );

  if (modulesRequiringInstall.length > 0) {
    withTemporaryPackageJson(moduleRoot, nativeModules, () => {
      runNpm(
        [
          "install",
          "--no-save",
          "--package-lock=false",
          "--no-audit",
          "--fund=false",
          ...(target.runtime === "electron" ? ["--ignore-scripts"] : []),
          ...modulesRequiringInstall.map(
            (nativeModule) => `${nativeModule.name}@${nativeModule.version}`,
          ),
        ],
        moduleRoot,
      );
    });
  }

  const nativeModuleNames = nativeModules.map((nativeModule) => nativeModule.name);
  pruneUnusedNativePayloads(target.nodeModulesRoot);
  if (target.runtime === "electron") {
    runElectronPrebuildInstall(
      target,
      nativeModules.filter((nativeModule) => !nativeNodeModuleReady(target, nativeModule, abi)),
      runtimeVersion,
    );
    writeRuntimeMetadata(target.nodeModulesRoot, nativeModules, target.runtime, abi);
    pruneUnusedNativePayloads(target.nodeModulesRoot);
  }

  if (nativeNodeModulesReady(target, runtimeVersion)) {
    saveNativeNodeModulesToCache(
      target.nodeModulesRoot,
      nativeModules,
      target.runtime,
      runtimeVersion,
    );
    console.log(
      `Synced native Node modules for Windows ARM64 ${target.runtime} ABI ${abi} in ${target.label}: ${nativeModuleNames.join(", ")}`,
    );
    return;
  }

  const modulesRequiringRebuild = nativeModules.filter(
    (nativeModule) => !nativeNodeModuleReady(target, nativeModule, abi),
  );
  const moduleNamesRequiringRebuild = modulesRequiringRebuild.map(
    (nativeModule) => nativeModule.name,
  );

  withTemporaryPackageJson(moduleRoot, nativeModules, () => {
    if (target.runtime === "electron") {
      console.log(
        `Falling back to Electron source rebuild for Windows ARM64 native modules in ${target.label}: ${moduleNamesRequiringRebuild.join(", ")}`,
      );
      const rebuildIncludesBetterSqlite3 = modulesRequiringRebuild.some(
        (nativeModule) => nativeModule.name === "better-sqlite3",
      );
      if (rebuildIncludesBetterSqlite3) {
        prepareBetterSqlite3ElectronRebuild({
          electronVersion: runtimeVersion,
          nodeModulesRoot: target.nodeModulesRoot,
        });
      }
      const rebuildEnv =
        prepareElectronHeadersForNativeRebuild(
          desktopRoot,
          runtimeVersion,
          targetRuntimeArch,
        ) ?? process.env;
      runElectronRebuild(
        moduleNamesRequiringRebuild,
        runtimeVersion,
        moduleRoot,
        rebuildEnv,
      );
      return;
    }

    runNodeRebuild(modulesRequiringRebuild, runtimeVersion, target.nodeModulesRoot);
  });
  writeRuntimeMetadata(target.nodeModulesRoot, nativeModules, target.runtime, abi);
  pruneUnusedNativePayloads(target.nodeModulesRoot);
  if (!nativeNodeModulesReady(target, runtimeVersion)) {
    throw new Error(
      `Native Node modules did not produce Windows ARM64 ${target.runtime} ABI ${abi} payloads in ${target.label}.`,
    );
  }
  saveNativeNodeModulesToCache(
    target.nodeModulesRoot,
    nativeModules,
    target.runtime,
    runtimeVersion,
  );
  console.log(
    `Synced native Node modules for Windows ARM64 ${target.runtime} ABI ${abi} in ${target.label}: ${nativeModuleNames.join(", ")}`,
  );
}

function syncNativeNodeModules(recoveredRoot: string, nodeVersion: string): void {
  const targets = collectNativeNodeModuleTargets(recoveredRoot);
  if (targets.length === 0) {
    console.log("Hydrated app and bundled plugins have no native Node modules.");
    return;
  }

  const electronVersion = readPackageElectronVersion(desktopRoot, "Packaging workspace");
  const recoveredElectronVersion = readPackageElectronVersion(recoveredRoot, "Hydrated app");
  if (normalizeRuntimeVersion(electronVersion) !== normalizeRuntimeVersion(recoveredElectronVersion)) {
    console.log(
      `Using packaging Electron ${normalizeRuntimeVersion(electronVersion)} for Windows ARM64 native modules; hydrated app declares ${normalizeRuntimeVersion(recoveredElectronVersion)}.`,
    );
  }

  for (const target of targets) {
    syncNativeNodeModulesTarget(
      target,
      target.runtime === "electron" ? electronVersion : nodeVersion,
    );
  }
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

function findRecoveredWebviewJavaScriptAssets(recoveredRoot: string): string[] {
  const assetsRoot = path.join(recoveredRoot, "webview", "assets");
  if (!fs.existsSync(assetsRoot)) return [];

  const assets: string[] = [];
  const visit = (current: string): void => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith(".js")) continue;
      assets.push(path.relative(recoveredRoot, entryPath).replace(/\\/g, "/"));
    }
  };

  visit(assetsRoot);
  return assets.sort();
}

function patchRecoveredMarkdownOperationDirectives(recoveredRoot: string): void {
  const diagnostics: string[] = [];
  let matchedDirectiveBundle = false;

  for (const relativePath of findRecoveredWebviewJavaScriptAssets(recoveredRoot)) {
    const filePath = path.join(recoveredRoot, relativePath);
    const source = fs.readFileSync(filePath, "utf8");
    if (!source.includes("codexDirective") || !source.includes("function Ur(")) continue;

    matchedDirectiveBundle = true;
    const patch = patchMarkdownOperationDirectiveCrashSource(source);
    if (!patch) {
      diagnostics.push(relativePath);
      continue;
    }

    if (patch.changed) {
      fs.writeFileSync(filePath, patch.source, "utf8");
    }
    console.log(
      (patch.changed ? "Patched" : "Verified") +
        " recovered Codex markdown operation directive filter in " +
        relativePath +
        " (" +
        patch.strategy +
        ").",
    );
  }

  if (diagnostics.length > 0) {
    throw new Error(
      "Codex markdown operation directive filter could not be patched in " + diagnostics.join(", ") + ".",
    );
  }

  if (!matchedDirectiveBundle) {
    console.log("Recovered Codex markdown operation directive filter was not found; no renderer directive patch was needed.");
  }
}

const codexWindowServicesKey = "__codexpp_window_services__";

type CodexWindowServicesPatch = {
  source: string;
  changed: boolean;
  strategy:
    | "already-patched"
    | "repair-missing-separator"
    | "service-factory-fingerprint"
    | "lifecycle-registration-fingerprint";
  serviceVar?: string;
};

type MarkdownOperationDirectivePatch = {
  source: string;
  changed: boolean;
  strategy: "already-patched" | "operation-directive-filter";
};

type CodexWindowServicesSourceDiagnostics = {
  hasMarker: boolean;
  buildFlavorProperties: number;
  objectCalls: number;
  matchedFingerprints: string[];
  snippet: string | null;
};

type ServiceFactoryAssignment = {
  serviceVar: string;
  callEnd: number;
};

const objectCallPattern = /([$A-Za-z_][$A-Za-z0-9_]*)\s*\(\s*\{/g;
const identPattern = /^[$A-Za-z_][$A-Za-z0-9_]*$/;
const codexWindowServiceFingerprints = [
  "allowDevtools:",
  "allowDebugMenu:",
  "allowInspectElement:",
  "globalState:",
  "getGlobalStateForHost:",
  "desktopRoot:",
  "preloadPath:",
  "repoRoot:",
  "canHideLastLocalWindowToTray:",
  "disposables:",
];

export function patchCodexWindowServicesSource(
  source: string,
  marker = codexWindowServicesKey,
): CodexWindowServicesPatch | null {
  const repaired = repairMalformedMarkerAssignment(source, marker);
  if (repaired) return repaired;

  if (source.includes(markerAssignment(marker))) {
    return { source, changed: false, strategy: "already-patched" };
  }

  const assignment = findWindowServicesFactoryAssignment(source);
  if (!assignment) return patchFromLifecycleRegistration(source, marker);

  const statementEnd = findStatementEnd(source, assignment.callEnd + 1);
  if (statementEnd < 0) {
    throw new Error("Codex window services declaration end could not be identified");
  }

  return {
    source:
      source.slice(0, statementEnd + 1) +
      markerAssignment(marker) +
      assignment.serviceVar +
      ";" +
      source.slice(statementEnd + 1),
    changed: true,
    strategy: "service-factory-fingerprint",
    serviceVar: assignment.serviceVar,
  };
}

export function describeCodexWindowServicesSource(
  source: string,
  marker = codexWindowServicesKey,
): CodexWindowServicesSourceDiagnostics {
  return {
    hasMarker: source.includes(markerAssignment(marker)),
    buildFlavorProperties: countObjectProperty(source, "buildFlavor"),
    objectCalls: countObjectCalls(source),
    matchedFingerprints: matchedWindowServicesFingerprints(source),
    snippet: diagnosticSnippet(source),
  };
}

const markdownTemplateTick = String.fromCharCode(96);
const markdownDirectiveFilterOriginal =
  "function Hr(e){return e.split(" +
  markdownTemplateTick +
  "\n" +
  markdownTemplateTick +
  ").filter(e=>!Ur(e)).join(" +
  markdownTemplateTick +
  "\n" +
  markdownTemplateTick +
  ")}";
const markdownDirectiveFilterReplacement =
  "function Hr(e){let t=!1;return e.split(" +
  markdownTemplateTick +
  "\n" +
  markdownTemplateTick +
  ").filter(e=>{let n=e.trimStart(),r=t;return n.startsWith(\"```\")&&(t=!t),r||!Ur(e)}).join(" +
  markdownTemplateTick +
  "\n" +
  markdownTemplateTick +
  ")}";
const markdownDirectiveInputOriginal = "E=n,ne=T?ar(Hr(E)):E";
const markdownDirectiveInputReplacement = "E=Hr(n),ne=T?ar(E):E";

export function patchMarkdownOperationDirectiveCrashSource(
  source: string,
): MarkdownOperationDirectivePatch | null {
  if (!source.includes("codexDirective") || !source.includes("function Ur(")) return null;

  const alreadyPatched =
    source.includes(markdownDirectiveFilterReplacement) &&
    source.includes(markdownDirectiveInputReplacement);
  if (alreadyPatched) {
    return { source, changed: false, strategy: "already-patched" };
  }

  if (
    !source.includes(markdownDirectiveFilterReplacement) &&
    !source.includes(markdownDirectiveFilterOriginal)
  ) {
    return null;
  }
  if (
    !source.includes(markdownDirectiveInputReplacement) &&
    !source.includes(markdownDirectiveInputOriginal)
  ) {
    return null;
  }

  let patched = source;
  if (!patched.includes(markdownDirectiveFilterReplacement)) {
    patched = patched.replace(markdownDirectiveFilterOriginal, markdownDirectiveFilterReplacement);
  }
  if (!patched.includes(markdownDirectiveInputReplacement)) {
    patched = patched.replace(markdownDirectiveInputOriginal, markdownDirectiveInputReplacement);
  }

  return {
    source: patched,
    changed: patched !== source,
    strategy: "operation-directive-filter",
  };
}

function repairMalformedMarkerAssignment(
  source: string,
  marker: string,
): CodexWindowServicesPatch | null {
  const assignment = findWindowServicesFactoryAssignment(source);
  if (!assignment) return null;

  const assignmentText = markerAssignment(marker);
  const markerIndex = source.indexOf(assignmentText);
  if (markerIndex < 0) return null;

  const valueIndex = markerIndex + assignmentText.length;
  if (!source.startsWith(assignment.serviceVar, valueIndex)) return null;

  const nextIndex = valueIndex + assignment.serviceVar.length;
  if (source[nextIndex] === ";") return null;
  if (!/[$A-Za-z_]/.test(source[nextIndex] ?? "")) return null;

  return {
    source: source.slice(0, nextIndex) + ";" + source.slice(nextIndex),
    changed: true,
    strategy: "repair-missing-separator",
    serviceVar: assignment.serviceVar,
  };
}

function findWindowServicesFactoryAssignment(source: string): ServiceFactoryAssignment | null {
  objectCallPattern.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = objectCallPattern.exec(source)) !== null) {
    const parenStart = match.index + match[0].indexOf("(");
    const serviceVar = findAssignedIdentifierBefore(source, match.index);
    if (!serviceVar) continue;

    const callEnd = findMatchingBracket(source, parenStart, "(", ")");
    if (callEnd < 0) continue;

    const callSource = source.slice(parenStart, callEnd + 1);
    if (!looksLikeWindowServicesFactory(callSource)) continue;

    return { serviceVar, callEnd };
  }

  return null;
}

function patchFromLifecycleRegistration(
  source: string,
  marker: string,
): CodexWindowServicesPatch | null {
  const registration = findWindowServicesLifecycleRegistration(source);
  if (!registration) return null;

  const statementEnd = findStatementEnd(source, registration.callEnd + 1);
  if (statementEnd < 0) {
    throw new Error("Codex window services lifecycle registration end could not be identified");
  }

  return {
    source:
      source.slice(0, statementEnd + 1) +
      markerAssignment(marker) +
      registration.serviceVar +
      ";" +
      source.slice(statementEnd + 1),
    changed: true,
    strategy: "lifecycle-registration-fingerprint",
    serviceVar: registration.serviceVar,
  };
}

function findWindowServicesLifecycleRegistration(source: string): ServiceFactoryAssignment | null {
  objectCallPattern.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = objectCallPattern.exec(source)) !== null) {
    const parenStart = match.index + match[0].indexOf("(");
    const callEnd = findMatchingBracket(source, parenStart, "(", ")");
    if (callEnd < 0) continue;

    const callSource = source.slice(parenStart, callEnd + 1);
    const serviceVar = windowServicesVarFromLifecycleRegistration(callSource);
    if (!serviceVar) continue;

    return { serviceVar, callEnd };
  }

  return null;
}

function windowServicesVarFromLifecycleRegistration(callSource: string): string | null {
  const serviceVar = objectPropertyIdentifierValue(callSource, "windows");
  if (!serviceVar) return null;

  const memberRefs = [
    "ensureHostWindow",
    "hotkeyWindowLifecycleManager",
    "globalDictationLifecycleManager",
  ].filter((property) => hasObjectPropertyMemberRef(callSource, property, serviceVar)).length;
  const standaloneProps = ["flushAndDisposeContexts", "appEvent", "errorReporter"].filter((property) =>
    hasObjectProperty(callSource, property),
  ).length;

  return memberRefs >= 2 && standaloneProps >= 2 ? serviceVar : null;
}

function findAssignedIdentifierBefore(source: string, index: number): string | null {
  const eqIndex = skipWhitespaceBackward(source, index - 1);
  if (source[eqIndex] !== "=") return null;

  const end = skipWhitespaceBackward(source, eqIndex - 1) + 1;
  let start = end;
  while (start > 0 && /[$A-Za-z0-9_]/.test(source[start - 1] ?? "")) start -= 1;

  const identifier = source.slice(start, end);
  return identPattern.test(identifier) ? identifier : null;
}

function looksLikeWindowServicesFactory(callSource: string): boolean {
  return hasObjectProperty(callSource, "buildFlavor") && matchedWindowServicesFingerprints(callSource).length >= 5;
}

function objectPropertyIdentifierValue(source: string, property: string): string | null {
  const pattern = new RegExp(
    "(?:^|[,{}])\\s*" + escapeRegExp(property) + "\\s*:\\s*([$A-Za-z_][$A-Za-z0-9_]*)",
  );
  return pattern.exec(source)?.[1] ?? null;
}

function hasObjectPropertyMemberRef(source: string, property: string, objectName: string): boolean {
  const pattern = new RegExp(
    "(?:^|[,{}])\\s*" +
      escapeRegExp(property) +
      "\\s*:\\s*" +
      escapeRegExp(objectName) +
      "\\." +
      escapeRegExp(property) +
      "\\b",
  );
  return pattern.test(source);
}

function findStatementEnd(source: string, startIndex: number): number {
  let parens = 0;
  let braces = 0;
  let brackets = 0;
  let quote: string | null = null;
  let escaped = false;

  for (let i = startIndex; i < source.length; i += 1) {
    const ch = source[i] ?? "";
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "(") parens += 1;
    else if (ch === ")") parens -= 1;
    else if (ch === "{") braces += 1;
    else if (ch === "}") braces -= 1;
    else if (ch === "[") brackets += 1;
    else if (ch === "]") brackets -= 1;
    else if (ch === ";" && parens === 0 && braces === 0 && brackets === 0) {
      return i;
    }
  }

  return -1;
}

function findMatchingBracket(
  source: string,
  openIndex: number,
  openChar: string,
  closeChar: string,
): number {
  if (source[openIndex] !== openChar) return -1;

  let depth = 0;
  let quote: string | null = null;
  let escaped = false;

  for (let i = openIndex; i < source.length; i += 1) {
    const ch = source[i] ?? "";
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === openChar) depth += 1;
    else if (ch === closeChar) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }

  return -1;
}

function skipWhitespaceBackward(source: string, index: number): number {
  let i = index;
  while (i >= 0 && /\s/.test(source[i] ?? "")) i -= 1;
  return i;
}

function markerAssignment(marker: string): string {
  return "globalThis." + marker + "=";
}

function matchedWindowServicesFingerprints(source: string): string[] {
  const out: string[] = [];
  for (const fingerprint of codexWindowServiceFingerprints) {
    const property = fingerprint.slice(0, -1);
    if (hasObjectProperty(source, property)) out.push(property);
  }
  return out;
}

function hasObjectProperty(source: string, property: string): boolean {
  return objectPropertyRegExp(property).test(source);
}

function countObjectProperty(source: string, property: string): number {
  const matches = source.match(objectPropertyRegExp(property, "g"));
  return matches ? matches.length : 0;
}

function countObjectCalls(source: string): number {
  const matches = source.match(/[$A-Za-z_][$A-Za-z0-9_]*\s*\(\s*\{/g);
  return matches ? matches.length : 0;
}

function objectPropertyRegExp(property: string, flags = ""): RegExp {
  return new RegExp("(?:^|[,{}])\\s*[\"']?" + escapeRegExp(property) + "[\"']?\\s*:", flags);
}

function diagnosticSnippet(source: string): string | null {
  const anchors = [
    source.indexOf("buildFlavor"),
    ...codexWindowServiceFingerprints.map((fingerprint) => source.indexOf(fingerprint.slice(0, -1))),
  ].filter((index) => index >= 0);
  if (anchors.length === 0) return null;

  const anchor = Math.min(...anchors);
  const start = Math.max(0, anchor - 90);
  const end = Math.min(source.length, anchor + 220);
  return source.slice(start, end).replace(/\s+/g, " ");
}

function escapeRegExp(value: string): string {
  return value.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&");
}

function readRecoveredOriginalMain(recoveredRoot: string): string {
  const packageJsonPath = path.join(recoveredRoot, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    return ".vite/build/bootstrap.js";
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as PackageJson;
  const main = typeof packageJson.main === "string" ? packageJson.main.trim() : "";
  return main ? main.replace(/\\/g, "/").replace(/^\.\//, "") : ".vite/build/bootstrap.js";
}

function findRecoveredViteMainBundles(recoveredRoot: string): string[] {
  const buildRoot = path.join(recoveredRoot, ".vite", "build");
  if (!fs.existsSync(buildRoot)) {
    return [];
  }

  return fs
    .readdirSync(buildRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name === "bootstrap.js" || /^main(?:[-.].*)?\.js$/i.test(name))
    .sort()
    .map((name) => path.posix.join(".vite", "build", name));
}

function patchRecoveredCodexWindowServices(recoveredRoot: string): void {
  const candidates = [readRecoveredOriginalMain(recoveredRoot), ...findRecoveredViteMainBundles(recoveredRoot)];
  const seen = new Set<string>();
  const diagnostics: string[] = [];

  for (const relativePath of candidates) {
    const normalized = relativePath.replace(/\\/g, "/").replace(/^\.\//, "");
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    const filePath = path.join(recoveredRoot, normalized);
    if (!fs.existsSync(filePath)) continue;

    const source = fs.readFileSync(filePath, "utf8");
    const patch = patchCodexWindowServicesSource(source);
    if (!patch) {
      const diagnostic = describeCodexWindowServicesSource(source);
      diagnostics.push(normalized + ": " + JSON.stringify(diagnostic));
      continue;
    }

    if (patch.changed) {
      fs.writeFileSync(filePath, patch.source, "utf8");
    }

    console.log(
      "Patched Codex window services in " +
        normalized +
        " via " +
        patch.strategy +
        (patch.serviceVar ? " (" + patch.serviceVar + ")" : ""),
    );
    return;
  }

  throw new Error(
    "Could not patch Codex window services. Checked: " +
      [...seen].join(", ") +
      ". Diagnostics: " +
      diagnostics.join(" | "),
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

  const item = findReleaseItem(await appcastResponse.text(), options.version, options.buildNumber);
  const selectedVersion = firstMatch(
    item,
    /<sparkle:shortVersionString>([^<]+)<\/sparkle:shortVersionString>/i,
    "The selected Codex app release does not have a version.",
  );
  const selectedBuildNumber = releaseItemBuildNumber(item) ?? "";
  if (options.buildNumber && selectedBuildNumber !== options.buildNumber) {
    throw new Error(
      `Codex app version ${selectedVersion} resolved to build ${selectedBuildNumber}, expected ${options.buildNumber}.`,
    );
  }
  const downloadUrl = firstMatch(
    item,
    /<enclosure\b[^>]*\burl="([^"]+)"/i,
    `Codex app version ${selectedVersion} does not have a full download URL.`,
  );
  const expectedDownloadLength = item.match(/<enclosure\b[^>]*\blength="([0-9]+)"/i)?.[1];

  const appCacheSegment = appExtractCacheSegment(selectedVersion, selectedBuildNumber);
  const downloadExtension = path.extname(new URL(downloadUrl).pathname) || ".zip";
  const zipPath = path.join(options.cacheRoot, `${appCacheSegment}${downloadExtension}`);
  const extractDir = `extract-${appCacheSegment}`;
  const extractRoot = path.join(options.cacheRoot, extractDir);
  const recoveredRoot = path.join(desktopRoot, "recovered", "app-asar-extracted");
  const releaseInfoPath = path.join(options.cacheRoot, "latest-release.json");

  if (options.force) {
    fs.rmSync(zipPath, { force: true });
    fs.rmSync(extractRoot, { recursive: true, force: true });
  }

  if (!fs.existsSync(zipPath)) {
    await downloadFile(downloadUrl, zipPath);
  }
  if (expectedDownloadLength) {
    const expectedSize = Number(expectedDownloadLength);
    const actualSize = fs.statSync(zipPath).size;
    if (actualSize !== expectedSize) {
      throw new Error(
        `Downloaded Codex app ZIP size mismatch for ${selectedVersion}: expected ${expectedSize}, got ${actualSize}.`,
      );
    }
  }

  if (!fs.existsSync(extractRoot)) {
    fs.mkdirSync(extractRoot, { recursive: true });
    await extract(zipPath, { dir: extractRoot });
  }

  const appAsar = findAppAsar(extractRoot);
  if (!appAsar) {
    throw new Error("Could not find Codex.app Contents/Resources/app.asar in the downloaded ZIP.");
  }
  const appResourcesRoot = path.dirname(appAsar);
  const nodeVersion = readBundledNodeVersion(appResourcesRoot);
  syncBundledPluginResources(appResourcesRoot);
  await hydrateCodexPlusPlusRuntime(
    options.cacheRoot,
    options.codexPlusPlusRepo,
    options.force,
    options.codexPlusPlusTag,
    options.codexPlusPlusSha,
  );

  execFileSync(
    process.execPath,
    [
      path.join(desktopRoot, ".cache", "scripts", "refresh-recovered-from-dmg.js"),
      "--app-asar",
      appAsar,
      "--output",
      recoveredRoot,
    ],
    { stdio: "inherit" },
  );
  patchWindowsSelfSignedBundle(recoveredRoot);
  patchRecoveredMarkdownOperationDirectives(recoveredRoot);
  patchRecoveredCodexWindowServices(recoveredRoot);
  syncNativeNodeModules(recoveredRoot, nodeVersion);

  fs.writeFileSync(
    releaseInfoPath,
    `${JSON.stringify(
      {
        version: selectedVersion,
        buildNumber: selectedBuildNumber,
        extractDir,
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

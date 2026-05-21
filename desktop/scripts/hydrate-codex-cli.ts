import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import extract from "extract-zip";

type ReleaseAsset = {
  digest?: string | null;
  downloadUrl: string;
  name: string;
  size: number;
};

type ReleaseInfo = {
  tagName: string;
  name: string;
  url: string;
  assets: ReleaseAsset[];
};

type GithubReleaseAsset = {
  browser_download_url?: string | null;
  digest?: string | null;
  name?: string | null;
  size?: number | null;
};

type GithubRelease = {
  assets?: GithubReleaseAsset[] | null;
  html_url?: string | null;
  name?: string | null;
  tag_name?: string | null;
};

type RequiredAsset = {
  assetName: string;
  outputName: string;
};

type Options = {
  codexRepo: string;
  codexTag?: string;
  ripgrepRepo: string;
  nodeDistBaseUrl: string;
  cacheRoot: string;
  force: boolean;
};

function resolveDesktopRoot(): string {
  return path.basename(__dirname) === "scripts" && path.basename(path.dirname(__dirname)) === ".cache"
    ? path.resolve(__dirname, "..", "..")
    : path.resolve(__dirname, "..");
}

const desktopRoot = resolveDesktopRoot();
const codexAppCacheRoot = path.join(desktopRoot, ".cache", "codex-app");

const requiredAssets: RequiredAsset[] = [
  {
    assetName: "codex-aarch64-pc-windows-msvc.exe",
    outputName: "codex.exe",
  },
  {
    assetName: "codex-windows-sandbox-setup-aarch64-pc-windows-msvc.exe",
    outputName: "codex-windows-sandbox-setup.exe",
  },
  {
    assetName: "codex-command-runner-aarch64-pc-windows-msvc.exe",
    outputName: "codex-command-runner.exe",
  },
];

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
  return {
    codexRepo: readOption(argv, "--codex-repo", "-CodexRepo") ?? "openai/codex",
    codexTag: readOption(argv, "--codex-tag", "-CodexTag") ?? process.env.CODEX_CLI_TAG,
    ripgrepRepo:
      readOption(argv, "--ripgrep-repo", "-RipgrepRepo") ?? "BurntSushi/ripgrep",
    nodeDistBaseUrl:
      readOption(argv, "--node-dist-base-url", "-NodeDistBaseUrl") ??
      "https://nodejs.org/dist",
    cacheRoot:
      readOption(argv, "--cache-root", "-CacheRoot") ??
      path.join(desktopRoot, ".cache", "codex-cli"),
    force: hasFlag(argv, "--force", "-Force"),
  };
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

function headersForUrl(url: string): Record<string, string> | undefined {
  const hostname = new URL(url).hostname.toLowerCase();
  return hostname === "api.github.com" || hostname === "github.com"
    ? githubHeaders()
    : undefined;
}

async function downloadFile(url: string, outputPath: string): Promise<void> {
  const response = await fetch(url, { headers: headersForUrl(url) });
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }

  fs.writeFileSync(outputPath, Buffer.from(await response.arrayBuffer()));
}

function sha256(filePath: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function verifySha256(filePath: string, expectedSha: string, label: string): void {
  if (sha256(filePath).toLowerCase() !== expectedSha.toLowerCase()) {
    throw new Error(`Checksum mismatch for ${label}`);
  }
}

function parseSha256(text: string, label: string): string {
  const match = text.match(/\b[a-fA-F0-9]{64}\b/);
  if (!match?.[0]) {
    throw new Error(`Missing SHA-256 checksum for ${label}`);
  }

  return match[0];
}

function parseAssetDigest(digest: string | null | undefined, label: string): string {
  const match = digest?.match(/^sha256:([a-fA-F0-9]{64})$/);
  if (!match?.[1]) {
    throw new Error(`Missing SHA-256 digest for ${label}`);
  }

  return match[1];
}

function verifyAssetDigest(asset: ReleaseAsset, filePath: string): void {
  verifySha256(filePath, parseAssetDigest(asset.digest, asset.name), asset.name);
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { headers: headersForUrl(url) });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

function repositoryApiUrl(repository: string, releasePath: string): URL {
  const parts = repository.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`Invalid GitHub repository value: ${repository}`);
  }

  return new URL(
    `https://api.github.com/repos/${encodeURIComponent(parts[0])}/${encodeURIComponent(parts[1])}${releasePath}`,
  );
}

function normalizeReleaseInfo(release: GithubRelease, repository: string): ReleaseInfo {
  if (!release.tag_name) {
    throw new Error(`GitHub release for ${repository} did not include a tag name.`);
  }

  return {
    tagName: release.tag_name,
    name: release.name ?? "",
    url: release.html_url ?? `https://github.com/${repository}/releases/tag/${release.tag_name}`,
    assets: (release.assets ?? []).map((asset) => {
      if (!asset.name || !asset.browser_download_url) {
        throw new Error(`GitHub release ${release.tag_name} has an asset without a name or download URL.`);
      }

      return {
        digest: asset.digest,
        downloadUrl: asset.browser_download_url,
        name: asset.name,
        size: asset.size ?? 0,
      };
    }),
  };
}

async function fetchGitHubRelease(repository: string, tagName?: string): Promise<ReleaseInfo> {
  const releasePath = tagName
    ? `/releases/tags/${encodeURIComponent(tagName)}`
    : "/releases/latest";
  const response = await fetch(repositoryApiUrl(repository, releasePath), {
    headers: githubHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch GitHub release for ${repository}: ${response.status} ${response.statusText}`);
  }

  return normalizeReleaseInfo((await response.json()) as GithubRelease, repository);
}

function findSingleFile(root: string, fileName: string): string {
  const matches = findSingleFiles(root, fileName);
  if (matches.length !== 1) {
    throw new Error(`Expected one ${fileName} under ${root}, found ${matches.length}.`);
  }
  return matches[0];
}

function findSingleFiles(root: string, fileName: string): string[] {
  const matches = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      matches.push(...findSingleFiles(entryPath, fileName));
      continue;
    }
    if (entry.name === fileName) {
      matches.push(entryPath);
    }
  }
  return matches;
}

function appExtractCacheSegment(version: string, buildNumber?: string): string {
  return (buildNumber ? `${version}-build-${buildNumber}` : version).replace(/[^A-Za-z0-9._-]/g, "_");
}

function appExtractDirCandidates(version: string, buildNumber?: string, extractDir?: string): string[] {
  if (extractDir) {
    return [extractDir];
  }

  const buildKeyedExtractDir = `extract-${appExtractCacheSegment(version, buildNumber)}`;
  const legacyExtractDir = `extract-${appExtractCacheSegment(version)}`;
  return buildNumber ? [buildKeyedExtractDir, legacyExtractDir] : [legacyExtractDir];
}

function appBundleNameForResourcePath(filePath: string): string {
  const normalized = filePath.replaceAll(path.sep, "/");
  const marker = "/Contents/Resources/";
  const markerIndex = normalized.lastIndexOf(marker);
  if (markerIndex < 0) {
    return "";
  }

  const beforeResources = normalized.slice(0, markerIndex);
  const bundleName = beforeResources.slice(beforeResources.lastIndexOf("/") + 1);
  return bundleName.endsWith(".app") ? bundleName : "";
}

function appResourceFileSortKey(filePath: string): string {
  const normalized = filePath.replaceAll(path.sep, "/");
  const appBundleName = appBundleNameForResourcePath(filePath);
  const rank = appBundleName === "Codex.app" ? 0 : appBundleName.startsWith("Codex") ? 1 : 2;
  return `${rank}/${normalized}`;
}

function findAppResourceFile(root: string, fileName: string): string | undefined {
  const matches: string[] = [];

  function walk(currentPath: string): void {
    if (!fs.existsSync(currentPath)) {
      return;
    }

    for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
      const entryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        walk(entryPath);
        continue;
      }

      const normalized = entryPath.replaceAll(path.sep, "/");
      if (entry.name === fileName && normalized.endsWith(`/Contents/Resources/${fileName}`)) {
        matches.push(entryPath);
      }
    }
  }

  walk(root);
  return matches.sort((left, right) => appResourceFileSortKey(left).localeCompare(
    appResourceFileSortKey(right),
  ))[0];
}

function readCodexAppReleaseInfo(): { buildNumber?: string; extractDir?: string; version: string } {
  const releaseInfoPath = path.join(codexAppCacheRoot, "latest-release.json");
  const releaseInfo = JSON.parse(fs.readFileSync(releaseInfoPath, "utf8")) as {
    buildNumber?: string;
    extractDir?: string;
    version?: string;
  };
  if (!releaseInfo.version) {
    throw new Error(`Missing Codex app release version: ${releaseInfoPath}`);
  }
  if (releaseInfo.extractDir && /[\\/]/.test(releaseInfo.extractDir)) {
    throw new Error(`Invalid Codex app extract directory: ${releaseInfo.extractDir}`);
  }

  return {
    buildNumber: releaseInfo.buildNumber,
    extractDir: releaseInfo.extractDir,
    version: releaseInfo.version,
  };
}

function findMacNodePath(): string {
  const { buildNumber, extractDir, version } = readCodexAppReleaseInfo();
  const searchRoots = appExtractDirCandidates(version, buildNumber, extractDir).map((candidate) =>
    path.join(codexAppCacheRoot, candidate),
  );
  const nodePath = searchRoots.map((root) => findAppResourceFile(root, "node")).find(Boolean);
  if (!nodePath) {
    throw new Error(`Missing bundled macOS Node executable under: ${searchRoots.join(", ")}`);
  }

  return nodePath;
}

function readBundledNodeVersion(): string {
  const binaryText = fs.readFileSync(findMacNodePath()).toString("latin1");
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

async function hydrateNodeExe(options: Options, resourcesRoot: string): Promise<ReleaseAsset> {
  const nodeVersion = readBundledNodeVersion();
  const archiveName = `node-${nodeVersion}-win-arm64.zip`;
  const archiveUrl = `${options.nodeDistBaseUrl}/${nodeVersion}/${archiveName}`;
  const archivePath = path.join(options.cacheRoot, archiveName);
  const extractRoot = path.join(options.cacheRoot, `node-${nodeVersion}-win-arm64`);
  const outputPath = path.join(resourcesRoot, "node.exe");

  if (options.force) {
    fs.rmSync(archivePath, { force: true });
    fs.rmSync(extractRoot, { recursive: true, force: true });
  }
  if (!fs.existsSync(archivePath)) {
    await downloadFile(archiveUrl, archivePath);
  }

  const shasums = await fetchText(`${options.nodeDistBaseUrl}/${nodeVersion}/SHASUMS256.txt`);
  const expectedSha = shasums
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/))
    .find((parts) => parts[1] === archiveName)?.[0];
  if (!expectedSha) {
    throw new Error(`Missing Node checksum for ${archiveName}`);
  }
  verifySha256(archivePath, expectedSha, archiveName);

  if (!fs.existsSync(extractRoot)) {
    fs.mkdirSync(extractRoot, { recursive: true });
    await extract(archivePath, { dir: extractRoot });
  }

  fs.copyFileSync(findSingleFile(extractRoot, "node.exe"), outputPath);
  return {
    downloadUrl: archiveUrl,
    name: archiveName,
    size: fs.statSync(archivePath).size,
  };
}

async function hydrateRipgrepExe(options: Options, resourcesRoot: string): Promise<ReleaseAsset> {
  const release = await fetchGitHubRelease(options.ripgrepRepo);
  const version = release.tagName.replace(/^v/, "");
  const assetName = `ripgrep-${version}-aarch64-pc-windows-msvc.zip`;
  const asset = release.assets.find((asset) => asset.name === assetName);
  if (!asset) {
    throw new Error(`Missing ripgrep release asset: ${assetName}`);
  }

  const archivePath = path.join(options.cacheRoot, assetName);
  const extractRoot = path.join(options.cacheRoot, `ripgrep-${version}-aarch64-pc-windows-msvc`);
  const outputPath = path.join(resourcesRoot, "rg.exe");

  if (options.force) {
    fs.rmSync(archivePath, { force: true });
    fs.rmSync(extractRoot, { recursive: true, force: true });
  }
  if (!fs.existsSync(archivePath)) {
    await downloadFile(asset.downloadUrl, archivePath);
  }

  const checksumAsset = release.assets.find((asset) => asset.name === `${assetName}.sha256`);
  if (checksumAsset) {
    verifySha256(
      archivePath,
      parseSha256(await fetchText(checksumAsset.downloadUrl), assetName),
      assetName,
    );
  } else {
    verifyAssetDigest(asset, archivePath);
  }

  if (!fs.existsSync(extractRoot)) {
    fs.mkdirSync(extractRoot, { recursive: true });
    await extract(archivePath, { dir: extractRoot });
  }

  fs.copyFileSync(findSingleFile(extractRoot, "rg.exe"), outputPath);
  return asset;
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  if (!options.codexRepo.trim()) {
    throw new Error("Missing Codex GitHub repository.");
  }

  const resourcesRoot = path.join(desktopRoot, "resources");
  fs.mkdirSync(options.cacheRoot, { recursive: true });
  fs.mkdirSync(resourcesRoot, { recursive: true });

  const release = await fetchGitHubRelease(options.codexRepo, options.codexTag);
  const assetsByName = new Map(release.assets.map((asset) => [asset.name, asset]));
  const releaseCacheRoot = path.join(options.cacheRoot, release.tagName);
  fs.mkdirSync(releaseCacheRoot, { recursive: true });

  const hydratedAssets = [];
  for (const requiredAsset of requiredAssets) {
    const asset = assetsByName.get(requiredAsset.assetName);
    if (!asset) {
      throw new Error(`Missing Codex release asset: ${requiredAsset.assetName}`);
    }

    const downloadPath = path.join(releaseCacheRoot, requiredAsset.assetName);
    const outputPath = path.join(resourcesRoot, requiredAsset.outputName);

    if (options.force) {
      fs.rmSync(downloadPath, { force: true });
    }
    if (!fs.existsSync(downloadPath)) {
      await downloadFile(asset.downloadUrl, downloadPath);
    }
    verifyAssetDigest(asset, downloadPath);

    fs.copyFileSync(downloadPath, outputPath);
    hydratedAssets.push({
      assetName: requiredAsset.assetName,
      outputName: requiredAsset.outputName,
      downloadUrl: asset.downloadUrl,
      size: asset.size,
    });
  }

  const nodeAsset = await hydrateNodeExe(options, resourcesRoot);
  hydratedAssets.push({
    assetName: nodeAsset.name,
    outputName: "node.exe",
    downloadUrl: nodeAsset.downloadUrl,
    size: nodeAsset.size,
  });

  const ripgrepAsset = await hydrateRipgrepExe(options, resourcesRoot);
  hydratedAssets.push({
    assetName: ripgrepAsset.name,
    outputName: "rg.exe",
    downloadUrl: ripgrepAsset.downloadUrl,
    size: ripgrepAsset.size,
  });

  fs.writeFileSync(
    path.join(options.cacheRoot, "latest-release.json"),
    `${JSON.stringify(
      {
        tagName: release.tagName,
        name: release.name,
        htmlUrl: release.url,
        assets: hydratedAssets,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log(`Hydrated Codex CLI ${release.tagName} into ${resourcesRoot}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

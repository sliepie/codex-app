import fs from "node:fs";
import path from "node:path";
import {
  type AcquiredReleaseAsset,
  type ReleaseAsset,
  downloadFile,
  ensureCachedReleaseAsset,
  ensureExtractedZip,
  fetchGitHubRelease,
  fetchText,
  findReleaseAsset,
  verifySha256,
} from "./github-release-assets";
import { installTectonicWindowsPayload } from "./bundled-plugin-windows-payloads";
import {
  formatPeMachine,
  readPeMachine,
  resourceBinaryExceptionById,
} from "./resource-binary-exceptions";

type RequiredAsset = {
  assetName: string;
  outputName: string;
};

type Options = {
  codexRepo: string;
  codexTag?: string;
  ripgrepRepo: string;
  tectonicRepo: string;
  tectonicVersion: string;
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
    tectonicRepo:
      readOption(argv, "--tectonic-repo", "-TectonicRepo") ?? "tectonic-typesetting/tectonic",
    tectonicVersion:
      readOption(argv, "--tectonic-version", "-TectonicVersion") ?? "0.16.9",
    nodeDistBaseUrl:
      readOption(argv, "--node-dist-base-url", "-NodeDistBaseUrl") ??
      "https://nodejs.org/dist",
    cacheRoot:
      readOption(argv, "--cache-root", "-CacheRoot") ??
      path.join(desktopRoot, ".cache", "codex-cli"),
    force: hasFlag(argv, "--force", "-Force"),
  };
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

  await ensureExtractedZip({ archivePath, extractRoot, force: options.force });

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
  const asset = findReleaseAsset(release, assetName, "ripgrep");

  const archivePath = path.join(options.cacheRoot, assetName);
  const extractRoot = path.join(options.cacheRoot, `ripgrep-${version}-aarch64-pc-windows-msvc`);
  const outputPath = path.join(resourcesRoot, "rg.exe");

  await ensureCachedReleaseAsset({
    asset,
    cachePath: archivePath,
    checksum: {
      kind: "sidecar-or-digest",
      release,
      sidecarAssetName: assetName + ".sha256",
    },
    force: options.force,
  });
  await ensureExtractedZip({ archivePath, extractRoot, force: options.force });

  fs.copyFileSync(findSingleFile(extractRoot, "rg.exe"), outputPath);
  return asset;
}

async function hydrateTectonicExe(options: Options, resourcesRoot: string): Promise<AcquiredReleaseAsset> {
  const release = await fetchGitHubRelease(options.tectonicRepo, "tectonic@" + options.tectonicVersion);
  const assetName = "tectonic-" + options.tectonicVersion + "-x86_64-pc-windows-msvc.zip";
  const asset = findReleaseAsset(release, assetName, "Tectonic");

  const archivePath = path.join(options.cacheRoot, assetName);
  const extractRoot = path.join(options.cacheRoot, "tectonic-" + options.tectonicVersion + "-x86_64-pc-windows-msvc");

  const acquiredAsset = await ensureCachedReleaseAsset({
    asset,
    cachePath: archivePath,
    checksum: { kind: "digest" },
    force: options.force,
  });
  await ensureExtractedZip({ archivePath, extractRoot, force: options.force });

  const tectonicPath = findSingleFile(extractRoot, "tectonic.exe");
  const exception = resourceBinaryExceptionById("tectonic");
  const machine = readPeMachine(tectonicPath);
  if (machine !== exception.expectedMachine) {
    throw new Error(
      "Expected " + formatPeMachine(exception.expectedMachine) + " tectonic.exe from " +
        assetName + ", got " + formatPeMachine(machine) + ".",
    );
  }
  installTectonicWindowsPayload(resourcesRoot, tectonicPath);

  return acquiredAsset;
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
  const releaseCacheRoot = path.join(options.cacheRoot, release.tagName);
  fs.mkdirSync(releaseCacheRoot, { recursive: true });

  const hydratedAssets = [];
  for (const requiredAsset of requiredAssets) {
    const asset = findReleaseAsset(release, requiredAsset.assetName, "Codex");

    const downloadPath = path.join(releaseCacheRoot, requiredAsset.assetName);
    const outputPath = path.join(resourcesRoot, requiredAsset.outputName);

    if (options.force) {
      fs.rmSync(downloadPath, { force: true });
    }
    const acquiredAsset = await ensureCachedReleaseAsset({
      asset,
      cachePath: downloadPath,
      checksum: { kind: "digest" },
      force: options.force,
    });

    fs.copyFileSync(downloadPath, outputPath);
    hydratedAssets.push({
      assetName: requiredAsset.assetName,
      outputName: requiredAsset.outputName,
      downloadUrl: asset.downloadUrl,
      sha256: acquiredAsset.sha256,
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

  const tectonicAsset = await hydrateTectonicExe(options, resourcesRoot);
  hydratedAssets.push({
    assetName: tectonicAsset.asset.name,
    outputName: "plugins/*/latex*/bin/tectonic.exe",
    downloadUrl: tectonicAsset.asset.downloadUrl,
    sha256: tectonicAsset.sha256,
    size: tectonicAsset.size,
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

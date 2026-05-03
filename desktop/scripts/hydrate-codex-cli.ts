import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import extract from "extract-zip";

type ReleaseAsset = {
  name: string;
  url: string;
  size: number;
};

type ReleaseInfo = {
  tagName: string;
  name: string;
  url: string;
  assets: ReleaseAsset[];
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

const desktopRoot = process.cwd();
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
    codexTag: readOption(argv, "--codex-tag", "-CodexTag"),
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

async function downloadFile(url: string, outputPath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }

  fs.writeFileSync(outputPath, Buffer.from(await response.arrayBuffer()));
}

function sha256(filePath: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function parseSha256(text: string, label: string): string {
  const match = text.match(/\b[a-fA-F0-9]{64}\b/);
  if (!match?.[0]) {
    throw new Error(`Missing SHA-256 checksum for ${label}`);
  }

  return match[0];
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return response.text();
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

function readCodexAppReleaseInfo(): { version: string } {
  const releaseInfoPath = path.join(codexAppCacheRoot, "latest-release.json");
  const releaseInfo = JSON.parse(fs.readFileSync(releaseInfoPath, "utf8")) as {
    version?: string;
  };
  if (!releaseInfo.version) {
    throw new Error(`Missing Codex app release version: ${releaseInfoPath}`);
  }

  return { version: releaseInfo.version };
}

function findMacNodePath(): string {
  const { version } = readCodexAppReleaseInfo();
  const nodePath = path.join(
    codexAppCacheRoot,
    `extract-${version}`,
    "Codex.app",
    "Contents",
    "Resources",
    "node",
  );
  if (!fs.existsSync(nodePath)) {
    throw new Error(`Missing bundled macOS Node executable: ${nodePath}`);
  }

  return nodePath;
}

function findMacCodexPath(): string {
  const { version } = readCodexAppReleaseInfo();
  const codexPath = path.join(
    codexAppCacheRoot,
    `extract-${version}`,
    "Codex.app",
    "Contents",
    "Resources",
    "codex",
  );
  if (!fs.existsSync(codexPath)) {
    throw new Error(`Missing bundled macOS Codex executable: ${codexPath}`);
  }

  return codexPath;
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

function readBundledCodexCliVersion(): string {
  const binaryText = fs.readFileSync(findMacCodexPath()).toString("latin1");
  const version = binaryText.match(
    /cli_version[^0-9]*([0-9]+\.[0-9]+\.[0-9]+(?:-(?:alpha|beta|rc)\.[0-9]+)?)/,
  )?.[1];
  if (!version) {
    throw new Error("Could not detect bundled macOS Codex CLI version.");
  }

  return version;
}

function resolveCodexReleaseTag(options: Options): string {
  return options.codexTag ?? `rust-v${readBundledCodexCliVersion()}`;
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
  if (sha256(archivePath).toLowerCase() !== expectedSha.toLowerCase()) {
    throw new Error(`Checksum mismatch for ${archiveName}`);
  }

  if (!fs.existsSync(extractRoot)) {
    fs.mkdirSync(extractRoot, { recursive: true });
    await extract(archivePath, { dir: extractRoot });
  }

  fs.copyFileSync(findSingleFile(extractRoot, "node.exe"), outputPath);
  return {
    name: archiveName,
    url: archiveUrl,
    size: fs.statSync(archivePath).size,
  };
}

async function hydrateRipgrepExe(options: Options, resourcesRoot: string): Promise<ReleaseAsset> {
  const releaseJson = execFileSync(
    "gh",
    ["release", "view", "--repo", options.ripgrepRepo, "--json", "tagName,assets"],
    { encoding: "utf8" },
  );
  const release = JSON.parse(releaseJson) as { tagName: string; assets: ReleaseAsset[] };
  const version = release.tagName.replace(/^v/, "");
  const assetName = `ripgrep-${version}-aarch64-pc-windows-msvc.zip`;
  const asset = release.assets.find((asset) => asset.name === assetName);
  if (!asset?.url) {
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
    await downloadFile(asset.url, archivePath);
  }

  const checksumAsset = release.assets.find((asset) => asset.name === `${assetName}.sha256`);
  if (checksumAsset?.url) {
    const expectedSha = parseSha256(await fetchText(checksumAsset.url), assetName);
    if (sha256(archivePath).toLowerCase() !== expectedSha.toLowerCase()) {
      throw new Error(`Checksum mismatch for ${assetName}`);
    }
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

  const releaseJson = execFileSync(
    "gh",
    [
      "release",
      "view",
      resolveCodexReleaseTag(options),
      "--repo",
      options.codexRepo,
      "--json",
      "tagName,name,url,assets",
    ],
    { encoding: "utf8" },
  );
  const release = JSON.parse(releaseJson) as ReleaseInfo;
  const assetsByName = new Map(release.assets.map((asset) => [asset.name, asset]));
  const releaseCacheRoot = path.join(options.cacheRoot, release.tagName);
  fs.mkdirSync(releaseCacheRoot, { recursive: true });

  const hydratedAssets = [];
  for (const requiredAsset of requiredAssets) {
    const asset = assetsByName.get(requiredAsset.assetName);
    if (!asset?.url) {
      throw new Error(`Missing Codex release asset: ${requiredAsset.assetName}`);
    }

    const downloadPath = path.join(releaseCacheRoot, requiredAsset.assetName);
    const outputPath = path.join(resourcesRoot, requiredAsset.outputName);

    if (options.force) {
      fs.rmSync(downloadPath, { force: true });
    }
    if (!fs.existsSync(downloadPath)) {
      await downloadFile(asset.url, downloadPath);
    }

    fs.copyFileSync(downloadPath, outputPath);
    hydratedAssets.push({
      assetName: requiredAsset.assetName,
      outputName: requiredAsset.outputName,
      downloadUrl: asset.url,
      size: asset.size,
    });
  }

  const nodeAsset = await hydrateNodeExe(options, resourcesRoot);
  hydratedAssets.push({
    assetName: nodeAsset.name,
    outputName: "node.exe",
    downloadUrl: nodeAsset.url,
    size: nodeAsset.size,
  });

  const ripgrepAsset = await hydrateRipgrepExe(options, resourcesRoot);
  hydratedAssets.push({
    assetName: ripgrepAsset.name,
    outputName: "rg.exe",
    downloadUrl: ripgrepAsset.url,
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

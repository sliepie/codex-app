import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  type ReleaseAsset,
  downloadFile,
  ensureCachedReleaseAsset,
  ensureExtractedZip,
  fetchGitHubRelease,
  fetchText,
  findReleaseAsset,
  sha256,
  verifySha256,
} from "./github-release-assets";
import { installTectonicWindowsPayload } from "./bundled-plugin-windows-payloads";
import {
  formatPeMachine,
  readPeMachine,
  resourceBinaryExceptionById,
} from "./resource-binary-exceptions";

type CodexNpmPackageFile = {
  sourcePath: string;
  outputName: string;
};

type NpmPackageMetadata = {
  dist?: {
    integrity?: string;
    size?: number;
    tarball?: string;
  };
  name?: string;
  optionalDependencies?: Record<string, string>;
  version?: string;
};

type CodexNpmPackage = {
  integrity: string;
  name: string;
  packageVersion: string;
  rootVersion: string;
  size: number;
  tarballUrl: string;
};

type HydratedAsset = {
  assetName: string;
  downloadUrl: string;
  outputName: string;
  releaseAssetSha256?: string;
  releaseHtmlUrl?: string;
  releaseTagName?: string;
  sha256?: string;
  size: number;
};

type HydratedCodexNpmPackage = {
  metadata: CodexNpmPackage;
  packageIntegrity: string;
  packageSha512: string;
  packageSize: number;
  assets: HydratedAsset[];
};

type Options = {
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

const codexNpmPackageName = "@openai/codex";
const codexNpmPlatformPackageName = "@openai/codex-win32-arm64";
const codexNpmTarget = "aarch64-pc-windows-msvc";
const codexNpmRootVersionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const codexNpmPlatformVersionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?-win32-arm64$/;

const codexNpmPackageFiles: CodexNpmPackageFile[] = [
  {
    sourcePath: "bin/codex.exe",
    outputName: "codex.exe",
  },
  {
    sourcePath: "bin/codex-code-mode-host.exe",
    outputName: "codex-code-mode-host.exe",
  },
  {
    sourcePath: "codex-resources/codex-windows-sandbox-setup.exe",
    outputName: "codex-windows-sandbox-setup.exe",
  },
  {
    sourcePath: "codex-resources/codex-command-runner.exe",
    outputName: "codex-command-runner.exe",
  },
  {
    sourcePath: "codex-path/rg.exe",
    outputName: "rg.exe",
  },
];

function npmPackageVersionUrl(packageName: string, packageVersion: string): string {
  return "https://registry.npmjs.org/" + encodeURIComponent(packageName) + "/" + encodeURIComponent(packageVersion);
}

async function fetchNpmPackageMetadata(packageVersion: string): Promise<NpmPackageMetadata> {
  return JSON.parse(
    await fetchText(npmPackageVersionUrl(codexNpmPackageName, packageVersion)),
  ) as NpmPackageMetadata;
}

async function fetchCodexNpmPackage(): Promise<CodexNpmPackage> {
  const latestMetadata = await fetchNpmPackageMetadata("latest");
  const rootVersion = latestMetadata.version;
  const platformDependency = latestMetadata.optionalDependencies?.[codexNpmPlatformPackageName];
  const packageVersion = platformDependency?.match(/^npm:@openai\/codex@(.+)$/)?.[1];
  if (
    latestMetadata.name !== codexNpmPackageName ||
    !rootVersion ||
    !codexNpmRootVersionPattern.test(rootVersion) ||
    !packageVersion ||
    !codexNpmPlatformVersionPattern.test(packageVersion)
  ) {
    throw new Error("The latest @openai/codex npm package has no Windows ARM64 optional package.");
  }

  const metadata = await fetchNpmPackageMetadata(packageVersion);
  const integrity = metadata.dist?.integrity;
  const tarballUrl = metadata.dist?.tarball;
  const size = metadata.dist?.size;
  if (
    metadata.name !== codexNpmPackageName ||
    metadata.version !== packageVersion ||
    !integrity?.startsWith("sha512-") ||
    !tarballUrl ||
    (size !== undefined && typeof size !== "number")
  ) {
    throw new Error("Invalid npm metadata for " + codexNpmPackageName + "@" + packageVersion);
  }

  return {
    integrity,
    name: metadata.name,
    packageVersion: metadata.version,
    rootVersion,
    size: size ?? 0,
    tarballUrl,
  };
}

function sha512Base64(filePath: string): string {
  return crypto.createHash("sha512").update(fs.readFileSync(filePath)).digest("base64");
}

function verifyNpmPackageIntegrity(
  filePath: string,
  integrity: string,
  label: string,
  actualSha512 = sha512Base64(filePath),
): void {
  const expected = integrity.match(/^sha512-(.+)$/)?.[1];
  if (!expected || actualSha512 !== expected) {
    throw new Error("Integrity mismatch for " + label);
  }
}

async function ensureCachedNpmPackage(
  packageInfo: CodexNpmPackage,
  cachePath: string,
  force: boolean,
): Promise<{ sha512: string; size: number }> {
  if (force) {
    fs.rmSync(cachePath, { force: true });
  }
  if (!fs.existsSync(cachePath)) {
    await downloadFile(packageInfo.tarballUrl, cachePath);
  }

  const size = fs.statSync(cachePath).size;
  if (packageInfo.size > 0 && size !== packageInfo.size) {
    throw new Error(
      "Downloaded " + packageInfo.name + "@" + packageInfo.packageVersion +
        " size mismatch: expected " + packageInfo.size + ", got " + size + ".",
    );
  }
  const sha512 = sha512Base64(cachePath);
  verifyNpmPackageIntegrity(
    cachePath,
    packageInfo.integrity,
    packageInfo.name + "@" + packageInfo.packageVersion,
    sha512,
  );
  return { sha512, size };
}

type ExtractedTarMarker = {
  archiveSha256: string;
  archiveSize: number;
};

function ensureExtractedNpmPackage(
  archivePath: string,
  extractRoot: string,
  force: boolean,
): void {
  const completeMarkerPath = extractRoot + ".complete";
  const marker: ExtractedTarMarker = {
    archiveSha256: sha256(archivePath),
    archiveSize: fs.statSync(archivePath).size,
  };
  if (force) {
    fs.rmSync(extractRoot, { recursive: true, force: true });
    fs.rmSync(completeMarkerPath, { force: true });
  }

  try {
    const currentMarker = JSON.parse(fs.readFileSync(completeMarkerPath, "utf8")) as Partial<ExtractedTarMarker>;
    if (
      fs.existsSync(extractRoot) &&
      currentMarker.archiveSha256 === marker.archiveSha256 &&
      currentMarker.archiveSize === marker.archiveSize
    ) {
      return;
    }
  } catch {
    // Re-extract when the marker is missing or invalid.
  }

  fs.rmSync(extractRoot, { recursive: true, force: true });
  fs.rmSync(completeMarkerPath, { force: true });
  const temporaryExtractRoot = extractRoot + ".tmp-" + process.pid + "-" + Date.now();
  fs.rmSync(temporaryExtractRoot, { recursive: true, force: true });
  try {
    fs.mkdirSync(temporaryExtractRoot, { recursive: true });
    execFileSync("tar", ["-xzf", archivePath, "-C", temporaryExtractRoot], { stdio: "inherit" });
    fs.renameSync(temporaryExtractRoot, extractRoot);
    fs.writeFileSync(completeMarkerPath, JSON.stringify(marker, null, 2) + "\n", "utf8");
  } catch (error) {
    fs.rmSync(temporaryExtractRoot, { recursive: true, force: true });
    fs.rmSync(completeMarkerPath, { force: true });
    throw error;
  }
}

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
  const suffixes =
    fileName === "node"
      ? [`/Contents/Resources/cua_node/bin/${fileName}`, `/Contents/Resources/${fileName}`]
      : [`/Contents/Resources/${fileName}`];

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
      if (entry.name === fileName && suffixes.some((suffix) => normalized.endsWith(suffix))) {
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

function writeCuaNodeManifest(resourcesRoot: string, nodeVersion: string): void {
  const normalizedNodeVersion = nodeVersion.replace(/^v/, "");
  const manifestPath = path.join(resourcesRoot, "cua_node", "manifest.json");
  const manifest = {
    platform: "windows",
    arch: "arm64",
    target: "windows-arm64",
    node_version: normalizedNodeVersion,
    node_archive_path: `${nodeVersion}/node-${nodeVersion}-win-arm64.zip`,
    node_path: "bin/node.exe",
    node_modules: "bin/node_modules",
    node_repl_path: "bin/node_repl.exe",
  };
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

async function hydrateNodeExe(options: Options, resourcesRoot: string): Promise<ReleaseAsset> {
  const nodeVersion = readBundledNodeVersion();
  const archiveName = `node-${nodeVersion}-win-arm64.zip`;
  const archiveUrl = `${options.nodeDistBaseUrl}/${nodeVersion}/${archiveName}`;
  const archivePath = path.join(options.cacheRoot, archiveName);
  const extractRoot = path.join(options.cacheRoot, `node-${nodeVersion}-win-arm64`);
  const outputPath = path.join(resourcesRoot, "cua_node", "bin", "node.exe");

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

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.copyFileSync(findSingleFile(extractRoot, "node.exe"), outputPath);
  writeCuaNodeManifest(resourcesRoot, nodeVersion);
  return {
    downloadUrl: archiveUrl,
    name: archiveName,
    size: fs.statSync(archivePath).size,
  };
}

async function hydrateCodexNpmPackage(
  options: Options,
  resourcesRoot: string,
): Promise<HydratedCodexNpmPackage> {
  const packageInfo = await fetchCodexNpmPackage();
  const archivePath = path.join(options.cacheRoot, `codex-${packageInfo.packageVersion}.tgz`);
  const extractRoot = path.join(options.cacheRoot, `codex-${packageInfo.packageVersion}`);
  const acquiredPackage = await ensureCachedNpmPackage(packageInfo, archivePath, options.force);
  ensureExtractedNpmPackage(archivePath, extractRoot, options.force);

  const packageRoot = path.join(extractRoot, "package");
  const packageJson = JSON.parse(fs.readFileSync(path.join(packageRoot, "package.json"), "utf8")) as {
    name?: string;
    version?: string;
  };
  if (packageJson.name !== packageInfo.name || packageJson.version !== packageInfo.packageVersion) {
    throw new Error("Codex npm package contents do not match registry metadata.");
  }

  const targetRoot = path.join(packageRoot, "vendor", codexNpmTarget);
  const assets: HydratedAsset[] = [];
  for (const packageFile of codexNpmPackageFiles) {
    const sourcePath = path.join(targetRoot, ...packageFile.sourcePath.split("/"));
    if (!fs.existsSync(sourcePath)) {
      throw new Error(
        "Missing " + packageFile.sourcePath + " in " + packageInfo.name + "@" + packageInfo.packageVersion,
      );
    }

    const outputPath = path.join(resourcesRoot, packageFile.outputName);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.copyFileSync(sourcePath, outputPath);
    assets.push({
      assetName: packageFile.sourcePath,
      downloadUrl: packageInfo.tarballUrl,
      outputName: packageFile.outputName,
      sha256: sha256(outputPath),
      size: fs.statSync(outputPath).size,
    });
  }

  return {
    metadata: packageInfo,
    packageIntegrity: packageInfo.integrity,
    packageSha512: acquiredPackage.sha512,
    packageSize: acquiredPackage.size,
    assets,
  };
}

type HydratedTectonicExe = {
  asset: ReleaseAsset;
  executableSha256: string;
  releaseAssetSha256: string;
  releaseHtmlUrl: string;
  releaseTagName: string;
  size: number;
};

function requireExceptionValue(value: string | undefined, label: string): string {
  if (!value) {
    throw new Error("Missing " + label + " in the Tectonic resource binary exception.");
  }

  return value;
}

async function hydrateTectonicExe(
  options: Options,
  resourcesRoot: string,
): Promise<HydratedTectonicExe> {
  const exception = resourceBinaryExceptionById("tectonic");
  const repository = requireExceptionValue(exception.expectedGithubRepository, "repository");
  const releaseTag = requireExceptionValue(exception.expectedGithubReleaseTag, "release tag");
  const assetName = requireExceptionValue(exception.expectedGithubAssetName, "asset name");
  const release = await fetchGitHubRelease(repository, releaseTag);
  const asset = findReleaseAsset(release, assetName, "Tectonic");

  const archivePath = path.join(options.cacheRoot, assetName);
  const extractRoot = path.join(options.cacheRoot, assetName.replace(/\.zip$/i, ""));

  const acquiredAsset = await ensureCachedReleaseAsset({
    asset,
    cachePath: archivePath,
    checksum: { kind: "digest" },
    force: options.force,
  });
  await ensureExtractedZip({ archivePath, extractRoot, force: options.force });

  const tectonicPath = findSingleFile(extractRoot, "tectonic.exe");
  const machine = readPeMachine(tectonicPath);
  if (machine !== exception.expectedMachine) {
    throw new Error(
      "Expected " + formatPeMachine(exception.expectedMachine) + " tectonic.exe from " +
        assetName + ", got " + formatPeMachine(machine) + ".",
    );
  }
  installTectonicWindowsPayload(resourcesRoot, tectonicPath);

  return {
    asset,
    executableSha256: sha256(tectonicPath),
    releaseAssetSha256: acquiredAsset.sha256,
    releaseHtmlUrl: release.url,
    releaseTagName: release.tagName,
    size: acquiredAsset.size,
  };
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const resourcesRoot = path.join(desktopRoot, "resources");
  fs.mkdirSync(options.cacheRoot, { recursive: true });
  fs.mkdirSync(resourcesRoot, { recursive: true });

  const codexPackage = await hydrateCodexNpmPackage(options, resourcesRoot);
  const hydratedAssets: HydratedAsset[] = [...codexPackage.assets];

  const nodeAsset = await hydrateNodeExe(options, resourcesRoot);
  hydratedAssets.push({
    assetName: nodeAsset.name,
    outputName: "cua_node/bin/node.exe",
    downloadUrl: nodeAsset.downloadUrl,
    size: nodeAsset.size,
  });

  const tectonicAsset = await hydrateTectonicExe(options, resourcesRoot);
  hydratedAssets.push({
    assetName: tectonicAsset.asset.name,
    outputName: "plugins/openai-bundled/plugins/latex/bin/tectonic.exe",
    downloadUrl: tectonicAsset.asset.downloadUrl,
    releaseHtmlUrl: tectonicAsset.releaseHtmlUrl,
    releaseTagName: tectonicAsset.releaseTagName,
    releaseAssetSha256: tectonicAsset.releaseAssetSha256,
    sha256: tectonicAsset.executableSha256,
    size: tectonicAsset.size,
  });

  fs.writeFileSync(
    path.join(options.cacheRoot, "latest-release.json"),
    `${JSON.stringify(
      {
        codexNpmPackage: {
          integrity: codexPackage.packageIntegrity,
          name: codexPackage.metadata.name,
          packageVersion: codexPackage.metadata.packageVersion,
          rootVersion: codexPackage.metadata.rootVersion,
          sha512: codexPackage.packageSha512,
          size: codexPackage.packageSize,
          tarballUrl: codexPackage.metadata.tarballUrl,
        },
        assets: hydratedAssets,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log(
    `Hydrated Codex CLI @latest as ${codexPackage.metadata.name}@${codexPackage.metadata.packageVersion} into ${resourcesRoot}`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

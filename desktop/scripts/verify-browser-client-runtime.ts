import fs from "node:fs";
import path from "node:path";

type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  name?: string;
  scripts?: Record<string, string>;
  version?: string;
};

type RuntimeMetadata = {
  abi?: string;
  arch?: string;
  platform?: string;
  runtime?: string;
};

type NodeAbiModule = {
  default?: {
    getAbi?: (target: string, runtime: string) => string;
  };
  getAbi?: (target: string, runtime: string) => string;
};

type VerifyBrowserClientRuntimeOptions = {
  desktopRoot?: string;
};

export type VerifyBrowserClientRuntimeResult = {
  abi: string;
  browserPluginPresent: boolean;
  classicLevelVersion?: string;
  nodeVersion: string;
};

const targetPlatform = "win32";
const targetArch = "arm64";
const browserPluginRelativeRoot = path.join(
  "resources",
  "plugins",
  "openai-bundled",
  "plugins",
  "browser",
);
const classicLevelPackageName = "classic-level";
const nodeAbiModule = require("node-abi") as NodeAbiModule;
const getAbi = nodeAbiModule.getAbi ?? nodeAbiModule.default?.getAbi;

if (typeof getAbi !== "function") {
  throw new Error("node-abi does not expose getAbi().");
}
const resolveNodeAbi = getAbi;

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function normalizeVersion(version: string): string {
  return version.replace(/^v/i, "");
}

function detectNodeVersionFromBinary(filePath: string, label: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing ${label}: ${filePath}`);
  }

  const binaryText = fs.readFileSync(filePath).toString("latin1");
  const counts = new Map<string, number>();
  for (const match of binaryText.matchAll(/v\d+\.\d+\.\d+/g)) {
    const version = match[0];
    counts.set(version, (counts.get(version) ?? 0) + 1);
  }

  const version = [...counts.entries()]
    .filter(([candidate]) => Number(candidate.slice(1).split(".")[0]) >= 20)
    .sort((left, right) => right[1] - left[1])[0]?.[0];
  if (!version) {
    throw new Error(`Could not detect Node version from ${label}: ${filePath}`);
  }

  return version;
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

function readCodexAppReleaseInfo(codexAppCacheRoot: string): {
  buildNumber?: string;
  extractDir?: string;
  version: string;
} {
  const releaseInfoPath = path.join(codexAppCacheRoot, "latest-release.json");
  const releaseInfo = readJson<{
    buildNumber?: string;
    extractDir?: string;
    version?: string;
  }>(releaseInfoPath);
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

function readBundledNodeVersion(desktopRoot: string): string {
  const codexAppCacheRoot = path.join(desktopRoot, ".cache", "codex-app");
  const { buildNumber, extractDir, version } = readCodexAppReleaseInfo(codexAppCacheRoot);
  const candidates = appExtractDirCandidates(version, buildNumber, extractDir).map((candidate) =>
    path.join(codexAppCacheRoot, candidate, "Codex.app", "Contents", "Resources", "node"),
  );
  const nodePath = candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0];
  return detectNodeVersionFromBinary(nodePath, "bundled macOS Node");
}

function readPeMachine(filePath: string): number {
  const bytes = fs.readFileSync(filePath);
  if (bytes.length < 0x40 || bytes[0] !== 0x4d || bytes[1] !== 0x5a) {
    throw new Error(`Expected a PE file: ${filePath}`);
  }

  const peOffset = bytes.readInt32LE(0x3c);
  if (peOffset + 6 > bytes.length) {
    throw new Error(`Invalid PE header: ${filePath}`);
  }

  return bytes.readUInt16LE(peOffset + 4);
}

function assertArm64Pe(filePath: string, label: string): void {
  const machine = readPeMachine(filePath);
  if (machine !== 0xaa64) {
    throw new Error(`${label} is not ARM64: machine 0x${machine.toString(16)}`);
  }
}

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
    return {
      abi: parts.at(-1),
      arch: parts[0],
      platform: targetPlatform,
    };
  }
}

function hasMatchingRuntimeMetadata(packageRoot: string, expectedAbi: string): boolean {
  for (const metadataPath of [
    path.join(packageRoot, "build", "Release", ".codex-runtime-meta.json"),
    path.join(packageRoot, "build", "Release", ".forge-meta"),
  ]) {
    const metadataRoot = path.dirname(metadataPath);
    const metadata = readRuntimeMetadata(metadataPath);
    if (
      metadata?.abi === expectedAbi &&
      metadata.arch === targetArch &&
      metadata.platform === targetPlatform &&
      (!metadata.runtime || metadata.runtime === "node")
    ) {
      return hasArm64NodePayload(metadataRoot);
    }
  }

  return false;
}

function hasNapiPrebuildEvidence(packageRoot: string): boolean {
  const packageJson = readJson<PackageJson>(path.join(packageRoot, "package.json"));
  const scripts = Object.values(packageJson.scripts ?? {});
  return (
    scripts.some((script) => /\bnapi\b/.test(script)) ||
    packageJson.dependencies?.["napi-macros"] !== undefined ||
    packageJson.devDependencies?.["napi-macros"] !== undefined
  );
}

function hasArm64NodePayload(directory: string): boolean {
  if (!fs.existsSync(directory)) {
    return false;
  }

  let found = false;
  for (const entry of fs.readdirSync(directory)) {
    if (!entry.endsWith(".node")) {
      continue;
    }

    const filePath = path.join(directory, entry);
    assertArm64Pe(filePath, `Browser client native payload ${path.relative(directory, filePath)}`);
    found = true;
  }

  return found;
}

function hasMatchingAbiPath(packageRoot: string, expectedAbi: string): boolean {
  const binRoot = path.join(packageRoot, "bin", `${targetPlatform}-${targetArch}-${expectedAbi}`);
  if (hasArm64NodePayload(binRoot)) {
    return true;
  }

  const prebuildRoot = path.join(packageRoot, "prebuilds", `${targetPlatform}-${targetArch}`);
  if (!fs.existsSync(prebuildRoot)) {
    return false;
  }

  const hasNapiEvidence = hasNapiPrebuildEvidence(packageRoot);
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
    let matchesRuntime = false;
    if (abiTag) {
      matchesRuntime = abiTag === `abi${expectedAbi}`;
    } else if (tags.includes("napi")) {
      matchesRuntime = true;
    } else {
      matchesRuntime = hasNapiEvidence;
    }

    if (!matchesRuntime) {
      return false;
    }

    assertArm64Pe(
      path.join(prebuildRoot, entry),
      `Browser client prebuild payload ${entry}`,
    );
    return true;
  });
}

function listNativeEvidence(packageRoot: string): string[] {
  const evidence: string[] = [];

  function walk(current: string): void {
    if (!fs.existsSync(current)) {
      return;
    }

    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "obj") {
          walk(entryPath);
        }
        continue;
      }

      if (entry.name.endsWith(".node") || entry.name === ".forge-meta" || entry.name === ".codex-runtime-meta.json") {
        evidence.push(path.relative(packageRoot, entryPath).replaceAll(path.sep, "/"));
      }
    }
  }

  walk(packageRoot);
  return evidence.length === 0 ? ["<none>"] : evidence;
}

function assertBrowserClientNativeAbi(packageRoot: string, expectedAbi: string, nodeVersion: string): string {
  const packageJsonPath = path.join(packageRoot, "package.json");
  const packageJson = readJson<PackageJson>(packageJsonPath);
  if (packageJson.name !== classicLevelPackageName) {
    throw new Error(
      `Expected ${classicLevelPackageName} package at ${packageRoot}, got ${packageJson.name ?? "<missing>"}.`,
    );
  }

  if (
    hasMatchingRuntimeMetadata(packageRoot, expectedAbi) ||
    hasMatchingAbiPath(packageRoot, expectedAbi)
  ) {
    return packageJson.version ?? "<unknown>";
  }

  throw new Error(
    [
      `Browser client native dependency ${classicLevelPackageName}@${packageJson.version ?? "<unknown>"} does not match Node ${nodeVersion} ABI ${expectedAbi}.`,
      `Expected ${targetPlatform}-${targetArch} payload metadata or path for ABI ${expectedAbi}.`,
      `Found: ${listNativeEvidence(packageRoot).join(", ")}`,
    ].join("\n"),
  );
}

export async function verifyBrowserClientRuntime({
  desktopRoot = process.cwd(),
}: VerifyBrowserClientRuntimeOptions = {}): Promise<VerifyBrowserClientRuntimeResult> {
  const bundledNodeVersion = readBundledNodeVersion(desktopRoot);
  const windowsNodePath = path.join(desktopRoot, "resources", "node.exe");
  assertArm64Pe(windowsNodePath, "Hydrated Windows Node runtime");

  const windowsNodeVersion = detectNodeVersionFromBinary(
    windowsNodePath,
    "hydrated Windows Node runtime",
  );
  if (normalizeVersion(windowsNodeVersion) !== normalizeVersion(bundledNodeVersion)) {
    throw new Error(
      `Hydrated Windows Node version ${windowsNodeVersion} does not match bundled app Node ${bundledNodeVersion}.`,
    );
  }

  const expectedAbi = resolveNodeAbi(normalizeVersion(bundledNodeVersion), "node");
  const browserPluginRoot = path.join(desktopRoot, browserPluginRelativeRoot);
  if (!fs.existsSync(browserPluginRoot)) {
    return {
      abi: expectedAbi,
      browserPluginPresent: false,
      classicLevelVersion: undefined,
      nodeVersion: bundledNodeVersion,
    };
  }

  const browserClientPath = path.join(browserPluginRoot, "scripts", "browser-client.mjs");
  if (!fs.existsSync(browserClientPath)) {
    throw new Error(`Missing browser client: ${browserClientPath}`);
  }

  const classicLevelRoot = path.join(
    browserPluginRoot,
    "scripts",
    "node_modules",
    classicLevelPackageName,
  );
  const classicLevelVersion = assertBrowserClientNativeAbi(
    classicLevelRoot,
    expectedAbi,
    bundledNodeVersion,
  );

  return {
    abi: expectedAbi,
    browserPluginPresent: true,
    classicLevelVersion,
    nodeVersion: bundledNodeVersion,
  };
}

async function main(): Promise<void> {
  const result = await verifyBrowserClientRuntime();
  if (result.browserPluginPresent) {
    console.log(
      `Verified browser client runtime: Node ${result.nodeVersion} ABI ${result.abi}, ${classicLevelPackageName}@${result.classicLevelVersion}.`,
    );
  } else {
    console.log(
      `Verified Windows Node runtime: Node ${result.nodeVersion} ABI ${result.abi}; no bundled browser plugin present.`,
    );
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const targetPlatform = "win32";
const targetArch = "arm64";
const browserUseRelativeRoot = path.join(
  "resources",
  "plugins",
  "openai-bundled",
  "plugins",
  "browser-use",
);
const classicLevelPackageName = "classic-level";
const nodeAbiModule = await import("node-abi");
const getAbi = nodeAbiModule.getAbi ?? nodeAbiModule.default?.getAbi;

if (typeof getAbi !== "function") {
  throw new Error("node-abi does not expose getAbi().");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizeVersion(version) {
  return version.replace(/^v/i, "");
}

function detectNodeVersionFromBinary(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing ${label}: ${filePath}`);
  }

  const binaryText = fs.readFileSync(filePath).toString("latin1");
  const counts = new Map();
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

function readCodexAppReleaseVersion(codexAppCacheRoot) {
  const releaseInfoPath = path.join(codexAppCacheRoot, "latest-release.json");
  const releaseInfo = readJson(releaseInfoPath);
  if (!releaseInfo.version) {
    throw new Error(`Missing Codex app release version: ${releaseInfoPath}`);
  }

  return releaseInfo.version;
}

function readBundledNodeVersion(desktopRoot) {
  const codexAppCacheRoot = path.join(desktopRoot, ".cache", "codex-app");
  const appVersion = readCodexAppReleaseVersion(codexAppCacheRoot);
  return detectNodeVersionFromBinary(
    path.join(
      codexAppCacheRoot,
      `extract-${appVersion}`,
      "Codex.app",
      "Contents",
      "Resources",
      "node",
    ),
    "bundled macOS Node",
  );
}

function readPeMachine(filePath) {
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

function assertArm64Pe(filePath, label) {
  const machine = readPeMachine(filePath);
  if (machine !== 0xaa64) {
    throw new Error(`${label} is not ARM64: machine 0x${machine.toString(16)}`);
  }
}

function readRuntimeMetadata(filePath) {
  if (!fs.existsSync(filePath)) {
    return undefined;
  }

  const source = fs.readFileSync(filePath, "utf8").trim();
  if (!source) {
    return undefined;
  }

  try {
    return JSON.parse(source);
  } catch {
    const parts = source.split("-");
    return {
      abi: parts.at(-1),
      arch: parts[0],
      platform: targetPlatform,
    };
  }
}

function hasMatchingRuntimeMetadata(packageRoot, expectedAbi) {
  for (const metadataPath of [
    path.join(packageRoot, "build", "Release", ".codex-runtime-meta.json"),
    path.join(packageRoot, "build", "Release", ".forge-meta"),
  ]) {
    const metadata = readRuntimeMetadata(metadataPath);
    if (
      metadata?.abi === expectedAbi &&
      metadata.arch === targetArch &&
      metadata.platform === targetPlatform &&
      (!metadata.runtime || metadata.runtime === "node")
    ) {
      return true;
    }
  }

  return false;
}

function hasNapiPrebuildEvidence(packageRoot) {
  const packageJson = readJson(path.join(packageRoot, "package.json"));
  const scripts = Object.values(packageJson.scripts ?? {});
  return (
    scripts.some((script) => /\bnapi\b/.test(script)) ||
    packageJson.dependencies?.["napi-macros"] !== undefined ||
    packageJson.devDependencies?.["napi-macros"] !== undefined
  );
}

function hasMatchingAbiPath(packageRoot, expectedAbi) {
  const binRoot = path.join(packageRoot, "bin", `${targetPlatform}-${targetArch}-${expectedAbi}`);
  if (fs.existsSync(binRoot) && fs.readdirSync(binRoot).some((entry) => entry.endsWith(".node"))) {
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
    if (abiTag) {
      return abiTag === `abi${expectedAbi}`;
    }
    if (tags.includes("napi")) {
      return true;
    }
    return hasNapiEvidence;
  });
}

function listNativeEvidence(packageRoot) {
  const evidence = [];

  function walk(current) {
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

function assertBrowserClientNativeAbi(packageRoot, expectedAbi, nodeVersion) {
  const packageJsonPath = path.join(packageRoot, "package.json");
  const packageJson = readJson(packageJsonPath);
  if (packageJson.name !== classicLevelPackageName) {
    throw new Error(
      `Expected ${classicLevelPackageName} package at ${packageRoot}, got ${packageJson.name ?? "<missing>"}.`,
    );
  }

  if (
    hasMatchingRuntimeMetadata(packageRoot, expectedAbi) ||
    hasMatchingAbiPath(packageRoot, expectedAbi)
  ) {
    return packageJson.version;
  }

  throw new Error(
    [
      `Browser client native dependency ${classicLevelPackageName}@${packageJson.version ?? "<unknown>"} does not match Node ${nodeVersion} ABI ${expectedAbi}.`,
      `Expected ${targetPlatform}-${targetArch} payload metadata or path for ABI ${expectedAbi}.`,
      `Found: ${listNativeEvidence(packageRoot).join(", ")}`,
    ].join("\n"),
  );
}

export async function verifyBrowserClientRuntime({ desktopRoot = process.cwd() } = {}) {
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

  const expectedAbi = getAbi(normalizeVersion(bundledNodeVersion), "node");
  const browserUseRoot = path.join(desktopRoot, browserUseRelativeRoot);
  if (!fs.existsSync(browserUseRoot)) {
    return {
      abi: expectedAbi,
      browserUsePresent: false,
      classicLevelVersion: undefined,
      nodeVersion: bundledNodeVersion,
    };
  }

  const browserClientPath = path.join(browserUseRoot, "scripts", "browser-client.mjs");
  if (!fs.existsSync(browserClientPath)) {
    throw new Error(`Missing browser client: ${browserClientPath}`);
  }

  const classicLevelRoot = path.join(
    browserUseRoot,
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
    browserUsePresent: true,
    classicLevelVersion,
    nodeVersion: bundledNodeVersion,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await verifyBrowserClientRuntime();
    if (result.browserUsePresent) {
      console.log(
        `Verified browser client runtime: Node ${result.nodeVersion} ABI ${result.abi}, ${classicLevelPackageName}@${result.classicLevelVersion}.`,
      );
    } else {
      console.log(
        `Verified Windows Node runtime: Node ${result.nodeVersion} ABI ${result.abi}; no bundled browser-use plugin present.`,
      );
    }
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const peMachine = {
  arm64: 0xaa64,
  x64: 0x8664,
  x86: 0x014c,
} as const;

export type WindowsArm64ResourceBinaryException = {
  expectedArchitecture?: string;
  expectedGithubAssetName?: string;
  expectedGithubAssetSha256?: string;
  expectedGithubReleaseTag?: string;
  expectedGithubRepository?: string;
  expectedMachine: number;
  expectedPackageFamilyName?: string;
  expectedPackageName?: string;
  expectedProductId?: string;
  expectedSourceRelativePath?: string;
  id: string;
  label: string;
  hydratedMetadataRelativePath?: string;
  hydratedOutputName?: string;
  metadataRelativePath?: string;
  packageRelativePath?: string;
  packageRelativePathPattern?: RegExp;
  removalCondition: string;
  requiredInPackage: boolean;
  sourceKind: "github-release" | "store-vendored";
  sourceRelativePath?: string;
  vendoredRelativePath?: string;
};

type StoreBinaryMetadata = {
  architecture?: string;
  packageFamilyName?: string;
  packageName?: string;
  productId?: string;
  sha256?: string;
  sourceRelativePath?: string;
};

type HydratedResourceBinaryMetadata = {
  htmlUrl?: string;
  tagName?: string;
  assets?: Array<{
    assetName?: string;
    downloadUrl?: string;
    outputName?: string;
    releaseHtmlUrl?: string;
    releaseAssetSha256?: string;
    releaseTagName?: string;
    sha256?: string;
  }>;
};

export function normalizeResourcePath(filePath: string): string {
  return filePath.replaceAll("\\", "/").replace(/^\/+/, "");
}

export function formatPeMachine(machine: number): string {
  switch (machine) {
    case peMachine.arm64:
      return "ARM64";
    case peMachine.x64:
      return "x64";
    case peMachine.x86:
      return "x86";
    default:
      return "0x" + machine.toString(16);
  }
}

export function readPeMachine(filePath: string): number {
  const bytes = fs.readFileSync(filePath);
  if (bytes.length < 0x40 || bytes[0] !== 0x4d || bytes[1] !== 0x5a) {
    throw new Error("Expected a PE executable: " + filePath);
  }

  const peOffset = bytes.readInt32LE(0x3c);
  if (peOffset < 0 || peOffset + 6 > bytes.length) {
    throw new Error("Invalid PE header offset in " + filePath + ".");
  }
  if (
    bytes[peOffset] !== 0x50 ||
    bytes[peOffset + 1] !== 0x45 ||
    bytes[peOffset + 2] !== 0 ||
    bytes[peOffset + 3] !== 0
  ) {
    throw new Error("Invalid PE signature in " + filePath + ".");
  }

  return bytes.readUInt16LE(peOffset + 4);
}

export function sha256(filePath: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function resolveDesktopPath(desktopRoot: string, relativePath: string): string {
  return path.join(desktopRoot, ...normalizeResourcePath(relativePath).split("/"));
}

function requireSha256Digest(value: string | undefined, label: string): string {
  if (!value || !/^[a-fA-F0-9]{64}$/.test(value)) {
    throw new Error(label + " has an invalid SHA-256 digest.");
  }

  return value.toLowerCase();
}

function readStoreBinaryMetadata(
  desktopRoot: string,
  exception: WindowsArm64ResourceBinaryException,
): StoreBinaryMetadata {
  if (!exception.metadataRelativePath) {
    throw new Error("Store-vendored exception is missing metadata path: " + exception.id);
  }

  const metadataPath = resolveDesktopPath(desktopRoot, exception.metadataRelativePath);
  if (!fs.existsSync(metadataPath)) {
    throw new Error("Missing Vendored resource binary metadata: " + metadataPath);
  }

  return JSON.parse(fs.readFileSync(metadataPath, "utf8")) as StoreBinaryMetadata;
}

function requireExpectedMetadataValue(
  label: string,
  field: string,
  actual: string | undefined,
  expected: string | undefined,
): void {
  if (expected !== undefined && actual !== expected) {
    throw new Error(
      label + " " + field + " is " + JSON.stringify(actual) +
        ", expected " + JSON.stringify(expected) + ".",
    );
  }
}

function decodedGithubPath(value: string | undefined, label: string): string {
  if (!value) {
    throw new Error(label + " is missing.");
  }

  const url = new URL(value);
  if (url.hostname.toLowerCase() !== "github.com") {
    throw new Error(label + " must be a github.com URL.");
  }

  return url.pathname
    .split("/")
    .map((part) => decodeURIComponent(part))
    .join("/");
}

function requireGithubPath(value: string | undefined, expectedPath: string, label: string): void {
  const actualPath = decodedGithubPath(value, label);
  if (actualPath !== expectedPath) {
    throw new Error(
      label + " path is " + JSON.stringify(actualPath) +
        ", expected " + JSON.stringify(expectedPath) + ".",
    );
  }
}

function expectedGithubReleaseSha256(
  desktopRoot: string,
  exception: WindowsArm64ResourceBinaryException,
): string {
  if (!exception.hydratedMetadataRelativePath || !exception.hydratedOutputName) {
    throw new Error("GitHub-release exception is missing hydrated metadata paths: " + exception.id);
  }

  const metadataPath = resolveDesktopPath(desktopRoot, exception.hydratedMetadataRelativePath);
  if (!fs.existsSync(metadataPath)) {
    throw new Error("Missing hydrated Resource binary metadata: " + metadataPath);
  }

  const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8")) as HydratedResourceBinaryMetadata;
  const asset = metadata.assets?.find((candidate) => candidate.outputName === exception.hydratedOutputName);
  if (!asset) {
    throw new Error(exception.label + " hydrated metadata is missing " + exception.hydratedOutputName + ".");
  }
  if (
    !exception.expectedGithubRepository ||
    !exception.expectedGithubReleaseTag ||
    !exception.expectedGithubAssetName
  ) {
    throw new Error("GitHub-release exception is missing expected source fields: " + exception.id);
  }

  requireExpectedMetadataValue(
    exception.label + " hydrated metadata asset",
    "releaseTagName",
    asset.releaseTagName,
    exception.expectedGithubReleaseTag,
  );
  requireExpectedMetadataValue(
    exception.label + " hydrated metadata asset",
    "assetName",
    asset.assetName,
    exception.expectedGithubAssetName,
  );

  const releasePath = "/" + exception.expectedGithubRepository +
    "/releases/tag/" + exception.expectedGithubReleaseTag;
  const downloadPath = "/" + exception.expectedGithubRepository +
    "/releases/download/" + exception.expectedGithubReleaseTag +
    "/" + exception.expectedGithubAssetName;
  requireGithubPath(asset.releaseHtmlUrl, releasePath, exception.label + " hydrated metadata releaseHtmlUrl");
  requireGithubPath(asset.downloadUrl, downloadPath, exception.label + " hydrated metadata downloadUrl");
  if (exception.expectedGithubAssetSha256 !== undefined) {
    const actualReleaseSha = requireSha256Digest(
      asset.releaseAssetSha256,
      exception.label + " hydrated metadata releaseAssetSha256",
    );
    const expectedReleaseSha = requireSha256Digest(
      exception.expectedGithubAssetSha256,
      exception.label + " expected GitHub release asset",
    );
    if (actualReleaseSha !== expectedReleaseSha) {
      throw new Error(
        exception.label + " hydrated metadata releaseAssetSha256 is " +
          JSON.stringify(actualReleaseSha) + ", expected " +
          JSON.stringify(expectedReleaseSha) + ".",
      );
    }
  }

  return requireSha256Digest(asset.sha256, exception.label + " hydrated metadata");
}

export function expectedResourceBinaryExceptionSha256(
  desktopRoot: string,
  exception: WindowsArm64ResourceBinaryException,
): string {
  if (exception.sourceKind === "store-vendored") {
    validateVendoredResourceBinaryProvenance(desktopRoot, exception);
    return requireSha256Digest(
      readStoreBinaryMetadata(desktopRoot, exception).sha256,
      exception.label + " metadata",
    );
  }

  return expectedGithubReleaseSha256(desktopRoot, exception);
}

export const windowsArm64ResourceBinaryExceptions: WindowsArm64ResourceBinaryException[] = [
  {
    expectedArchitecture: "arm64",
    expectedMachine: peMachine.arm64,
    expectedPackageFamilyName: "OpenAI.Codex_2p2nqsd0c76g0",
    expectedPackageName: "OpenAI.Codex",
    expectedProductId: "9PLM9XGG6VKS",
    expectedSourceRelativePath: "app/resources/cua_node/bin/node_repl.exe",
    id: "node-repl",
    label: "node_repl",
    metadataRelativePath: "resources/node_repl.json",
    packageRelativePath: "resources/node_repl.exe",
    removalCondition: "Remove when node_repl.exe no longer needs to be vendored from the Microsoft Store package.",
    requiredInPackage: true,
    sourceKind: "store-vendored",
    sourceRelativePath: "app/resources/cua_node/bin/node_repl.exe",
    vendoredRelativePath: "resources/node_repl.exe",
  },
  {
    expectedArchitecture: "arm64",
    expectedMachine: peMachine.arm64,
    expectedPackageFamilyName: "OpenAI.Codex_2p2nqsd0c76g0",
    expectedPackageName: "OpenAI.Codex",
    expectedProductId: "9PLM9XGG6VKS",
    expectedSourceRelativePath: "app/resources/plugins/openai-bundled/plugins/chrome/extension-host/windows/arm64/extension-host.exe",
    id: "chrome-extension-host",
    label: "Chrome extension-host",
    metadataRelativePath: "resources/extension-host.json",
    packageRelativePathPattern: /^resources\/plugins\/openai-bundled(?:-beta)?\/plugins\/chrome\/extension-host\/windows\/arm64\/extension-host\.exe$/,
    removalCondition: "Remove when Chrome extension-host.exe no longer needs to be vendored from the Microsoft Store package.",
    requiredInPackage: true,
    sourceKind: "store-vendored",
    sourceRelativePath: "app/resources/plugins/openai-bundled/plugins/chrome/extension-host/windows/arm64/extension-host.exe",
    vendoredRelativePath: "resources/extension-host.exe",
  },
  {
    expectedArchitecture: "x64",
    expectedMachine: peMachine.x64,
    expectedPackageFamilyName: "OpenAI.Codex_2p2nqsd0c76g0",
    expectedPackageName: "OpenAI.Codex",
    expectedProductId: "9PLM9XGG6VKS",
    expectedSourceRelativePath: "app/resources/cua_node/bin/node_modules/@oai/sky/bin/windows/codex-computer-use.exe",
    id: "computer-use",
    label: "Computer Use helper",
    metadataRelativePath: "resources/codex-computer-use.json",
    packageRelativePathPattern: /^resources\/plugins\/openai-bundled(?:-beta)?\/plugins\/computer-use\/node_modules\/@oai\/sky\/bin\/windows\/codex-computer-use\.exe$/,
    removalCondition: "Remove when a Windows ARM64 Computer Use helper can be compiled, downloaded, or otherwise obtained.",
    requiredInPackage: true,
    sourceKind: "store-vendored",
    sourceRelativePath: "app/resources/cua_node/bin/node_modules/@oai/sky/bin/windows/codex-computer-use.exe",
    vendoredRelativePath: "resources/codex-computer-use.exe",
  },
  {
    expectedGithubAssetName: "tectonic-0.16.9-x86_64-pc-windows-msvc.zip",
    expectedGithubAssetSha256: "131a24604785a9600989a3d91225f597df52ac06f00aeffe86fd529f99ee5cdd",
    expectedGithubReleaseTag: "tectonic@0.16.9",
    expectedGithubRepository: "tectonic-typesetting/tectonic",
    expectedMachine: peMachine.x64,
    hydratedMetadataRelativePath: ".cache/codex-cli/latest-release.json",
    hydratedOutputName: "plugins/*/latex*/bin/tectonic.exe",
    id: "tectonic",
    label: "Tectonic",
    packageRelativePathPattern: /^resources\/plugins\/openai-bundled(?:-beta)?\/plugins\/latex(?:-tectonic)?\/bin\/tectonic\.exe$/,
    removalCondition: "Remove when a Windows ARM64 Tectonic build is available for the bundled LaTeX plugin.",
    requiredInPackage: true,
    sourceKind: "github-release",
    sourceRelativePath: "tectonic-typesetting/tectonic release tectonic@0.16.9 asset tectonic-0.16.9-x86_64-pc-windows-msvc.zip",
  },
];

export function resourceBinaryExceptionById(id: string): WindowsArm64ResourceBinaryException {
  const exception = windowsArm64ResourceBinaryExceptions.find((candidate) => candidate.id === id);
  if (!exception) {
    throw new Error("Unknown Windows ARM64 Resource binary exception: " + id);
  }
  return exception;
}

export function matchWindowsArm64ResourceBinaryException(
  packageRelativePath: string,
): WindowsArm64ResourceBinaryException | undefined {
  const normalizedPath = normalizeResourcePath(packageRelativePath);
  return windowsArm64ResourceBinaryExceptions.find((exception) => {
    if (exception.packageRelativePath && normalizeResourcePath(exception.packageRelativePath) === normalizedPath) {
      return true;
    }
    return exception.packageRelativePathPattern?.test(normalizedPath) ?? false;
  });
}

export function isWindowsArm64ResourceBinaryException(
  packageRelativePath: string,
  machine: number,
): boolean {
  const exception = matchWindowsArm64ResourceBinaryException(packageRelativePath);
  return exception?.expectedMachine === machine;
}

export function validateVendoredResourceBinaryProvenance(
  desktopRoot: string,
  exception: WindowsArm64ResourceBinaryException,
): void {
  if (exception.sourceKind !== "store-vendored") {
    return;
  }
  if (!exception.vendoredRelativePath || !exception.metadataRelativePath) {
    throw new Error("Store-vendored exception is missing vendored paths: " + exception.id);
  }

  const binaryPath = resolveDesktopPath(desktopRoot, exception.vendoredRelativePath);
  if (!fs.existsSync(binaryPath)) {
    throw new Error("Missing Vendored resource binary: " + binaryPath);
  }

  const machine = readPeMachine(binaryPath);
  if (machine !== exception.expectedMachine) {
    throw new Error(
      exception.label + " has machine " + formatPeMachine(machine) + ", expected " +
        formatPeMachine(exception.expectedMachine) + ".",
    );
  }

  const metadata = readStoreBinaryMetadata(desktopRoot, exception);
  const checks: Array<[string, string | undefined, string | undefined]> = [
    ["productId", metadata.productId, exception.expectedProductId],
    ["packageName", metadata.packageName, exception.expectedPackageName],
    ["packageFamilyName", metadata.packageFamilyName, exception.expectedPackageFamilyName],
    ["sourceRelativePath", metadata.sourceRelativePath, exception.expectedSourceRelativePath],
    ["architecture", metadata.architecture, exception.expectedArchitecture],
  ];
  for (const [field, actual, expected] of checks) {
    if (expected !== undefined && actual !== expected) {
      throw new Error(
        exception.label + " metadata " + field + " is " + JSON.stringify(actual) +
          ", expected " + JSON.stringify(expected) + ".",
      );
    }
  }

  const expectedSha = requireSha256Digest(metadata.sha256, exception.label + " metadata");
  if (sha256(binaryPath).toLowerCase() !== expectedSha) {
    throw new Error(exception.label + " metadata SHA-256 does not match the vendored binary.");
  }
}

export function validatePackagedResourceBinaryException(
  desktopRoot: string,
  packageFilePath: string,
  exception: WindowsArm64ResourceBinaryException,
): void {
  const machine = readPeMachine(packageFilePath);
  if (machine !== exception.expectedMachine) {
    throw new Error(
      exception.label + " has machine " + formatPeMachine(machine) + ", expected " +
        formatPeMachine(exception.expectedMachine) + ".",
    );
  }

  const expectedSha = expectedResourceBinaryExceptionSha256(desktopRoot, exception);
  if (sha256(packageFilePath).toLowerCase() !== expectedSha) {
    throw new Error(exception.label + " package SHA-256 does not match provenance metadata.");
  }
}

export function validateVendoredResourceBinaryProvenanceForDesktop(desktopRoot: string): void {
  for (const exception of windowsArm64ResourceBinaryExceptions) {
    validateVendoredResourceBinaryProvenance(desktopRoot, exception);
  }
}

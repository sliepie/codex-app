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
  expectedMachine: number;
  expectedPackageFamilyName?: string;
  expectedPackageName?: string;
  expectedProductId?: string;
  expectedSourceRelativePath?: string;
  id: string;
  label: string;
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

  return bytes.readUInt16LE(peOffset + 4);
}

export function sha256(filePath: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

export const windowsArm64ResourceBinaryExceptions: WindowsArm64ResourceBinaryException[] = [
  {
    expectedArchitecture: "x64",
    expectedMachine: peMachine.x64,
    expectedPackageFamilyName: "OpenAI.Codex_2p2nqsd0c76g0",
    expectedPackageName: "OpenAI.Codex",
    expectedProductId: "9PLM9XGG6VKS",
    expectedSourceRelativePath: "app/resources/node_repl.exe",
    id: "node-repl",
    label: "node_repl",
    metadataRelativePath: "resources/node_repl.json",
    packageRelativePath: "resources/node_repl.exe",
    removalCondition: "Remove when a Windows ARM64 node_repl.exe can be compiled, downloaded, or otherwise obtained.",
    requiredInPackage: true,
    sourceKind: "store-vendored",
    sourceRelativePath: "app/resources/node_repl.exe",
    vendoredRelativePath: "resources/node_repl.exe",
  },
  {
    expectedArchitecture: "x64",
    expectedMachine: peMachine.x64,
    expectedPackageFamilyName: "OpenAI.Codex_2p2nqsd0c76g0",
    expectedPackageName: "OpenAI.Codex",
    expectedProductId: "9PLM9XGG6VKS",
    expectedSourceRelativePath: "app/resources/plugins/openai-bundled/plugins/chrome/extension-host/windows/x64/extension-host.exe",
    id: "chrome-extension-host",
    label: "Chrome extension-host",
    metadataRelativePath: "resources/extension-host.json",
    packageRelativePathPattern: /^resources\/plugins\/openai-bundled(?:-beta)?\/plugins\/chrome\/extension-host\/windows\/arm64\/extension-host\.exe$/,
    removalCondition: "Remove when a Windows ARM64 Chrome extension-host.exe can be compiled, downloaded, or otherwise obtained.",
    requiredInPackage: true,
    sourceKind: "store-vendored",
    sourceRelativePath: "app/resources/plugins/openai-bundled/plugins/chrome/extension-host/windows/x64/extension-host.exe",
    vendoredRelativePath: "resources/extension-host.exe",
  },
  {
    expectedMachine: peMachine.x64,
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

  const binaryPath = path.join(desktopRoot, ...normalizeResourcePath(exception.vendoredRelativePath).split("/"));
  const metadataPath = path.join(desktopRoot, ...normalizeResourcePath(exception.metadataRelativePath).split("/"));
  if (!fs.existsSync(binaryPath)) {
    throw new Error("Missing Vendored resource binary: " + binaryPath);
  }
  if (!fs.existsSync(metadataPath)) {
    throw new Error("Missing Vendored resource binary metadata: " + metadataPath);
  }

  const machine = readPeMachine(binaryPath);
  if (machine !== exception.expectedMachine) {
    throw new Error(
      exception.label + " has machine " + formatPeMachine(machine) + ", expected " +
        formatPeMachine(exception.expectedMachine) + ".",
    );
  }

  const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8")) as StoreBinaryMetadata;
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

  const expectedSha = metadata.sha256;
  if (!expectedSha || !/^[a-f0-9]{64}$/.test(expectedSha)) {
    throw new Error(exception.label + " metadata has an invalid SHA-256 digest.");
  }
  if (sha256(binaryPath) !== expectedSha) {
    throw new Error(exception.label + " metadata SHA-256 does not match the vendored binary.");
  }
}

export function validateVendoredResourceBinaryProvenanceForDesktop(desktopRoot: string): void {
  for (const exception of windowsArm64ResourceBinaryExceptions) {
    validateVendoredResourceBinaryProvenance(desktopRoot, exception);
  }
}

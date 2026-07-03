import { execFileSync, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export type AppxPackage = {
  name: string;
  packageFullName: string;
  packageFamilyName: string;
  version: string;
  architecture: string;
  installLocation: string;
};

export type StoreOwlEntry = {
  sourceRelativePath: string;
  kind: "directory" | "file" | "nestedExecutable";
  fileCount?: number;
  size?: number;
  sha256: string;
  architecture?: string;
  containedIn?: string;
  selfSignedMutable?: boolean;
};

export type StoreOwlMetadata = {
  productId: string;
  packageName: string;
  packageFullName: string;
  packageFamilyName: string;
  packageVersion: string;
  architecture: string;
  payloadRoot: string | null;
  runtimeMetadataRelativePath: string;
  entries: StoreOwlEntry[];
};

export function parseArgs(args: string[]): Map<string, string> {
  const parsed = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected argument: ${arg}`);
    }
    const key = arg.slice(2);
    const value = args[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }
    parsed.set(key.toLowerCase(), value);
    index += 1;
  }
  return parsed;
}

export function desktopRoot(): string {
  return path.resolve(__dirname, "..", "..");
}

export function repoRoot(): string {
  return path.resolve(desktopRoot(), "..");
}

export function sha256(filePath: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

export function toSourcePath(relativePath: string): string {
  return relativePath.replaceAll("/", path.sep);
}

export function toMetadataPath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

export function relativeMetadataPath(basePath: string, filePath: string): string {
  return toMetadataPath(path.relative(basePath, filePath));
}

export function repoRelativePathOrNull(filePath: string): string | null {
  const root = repoRoot();
  const resolvedRoot = path.resolve(root);
  const resolvedPath = path.resolve(filePath);
  const relative = path.relative(resolvedRoot, resolvedPath);
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    return toMetadataPath(relative);
  }
  return null;
}

export function getPeMachine(filePath: string): number {
  const bytes = fs.readFileSync(filePath);
  if (bytes.length < 0x40 || bytes[0] !== 0x4d || bytes[1] !== 0x5a) {
    throw new Error(`Expected a PE executable: ${filePath}`);
  }
  const peOffset = bytes.readInt32LE(0x3c);
  if (peOffset < 0 || peOffset + 6 > bytes.length) {
    throw new Error(`Invalid PE header offset in ${filePath}.`);
  }
  if (bytes[peOffset] !== 0x50 || bytes[peOffset + 1] !== 0x45 || bytes[peOffset + 2] !== 0 || bytes[peOffset + 3] !== 0) {
    throw new Error(`Invalid PE signature in ${filePath}.`);
  }
  return bytes.readUInt16LE(peOffset + 4);
}

export function formatPeMachine(machine: number): string {
  switch (machine) {
    case 0x8664:
      return "x64";
    case 0xaa64:
      return "arm64";
    case 0x014c:
      return "x86";
    default:
      return `0x${machine.toString(16).padStart(4, "0")}`;
  }
}

export function isPeFile(filePath: string): boolean {
  const handle = fs.openSync(filePath, "r");
  try {
    const buffer = Buffer.alloc(2);
    if (fs.readSync(handle, buffer, 0, 2, 0) < 2) {
      return false;
    }
    return buffer[0] === 0x4d && buffer[1] === 0x5a;
  } finally {
    fs.closeSync(handle);
  }
}

export function getDirectoryFiles(directoryPath: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(directoryPath, { withFileTypes: true })) {
    const entryPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...getDirectoryFiles(entryPath));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }
  return files.sort((left, right) => left.localeCompare(right));
}

export function directoryDigest(directoryPath: string): { fileCount: number; sha256: string } {
  const entries = getDirectoryFiles(directoryPath).map((filePath) => {
    const relativePath = relativeMetadataPath(directoryPath, filePath);
    const stat = fs.statSync(filePath);
    return `${relativePath} ${stat.size} ${sha256(filePath)}`;
  });
  return {
    fileCount: entries.length,
    sha256: crypto.createHash("sha256").update(entries.join("\n"), "utf8").digest("hex"),
  };
}

export function removeDirectory(directoryPath: string): void {
  fs.rmSync(directoryPath, { recursive: true, force: true });
}

export function copyRecursive(sourcePath: string, destinationPath: string): void {
  const stat = fs.statSync(sourcePath);
  if (stat.isDirectory()) {
    fs.mkdirSync(destinationPath, { recursive: true });
    for (const entry of fs.readdirSync(sourcePath)) {
      copyRecursive(path.join(sourcePath, entry), path.join(destinationPath, entry));
    }
    return;
  }
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.copyFileSync(sourcePath, destinationPath);
}

export function runChecked(command: string, args: string[], options: { allowExitCode?: number } = {}): void {
  const result = spawnSync(command, args, { stdio: "inherit", windowsHide: true });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    if (options.allowExitCode !== undefined && result.status === options.allowExitCode) {
      return;
    }
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}.`);
  }
}

export function getAppxPackages(packageName?: string): AppxPackage[] {
  const query = packageName === undefined || packageName.trim() === ""
    ? "Get-AppxPackage -ErrorAction Stop"
    : `Get-AppxPackage -Name '${escapePowerShellSingleQuoted(packageName)}' -ErrorAction SilentlyContinue`;
  const script = `${query} | Select-Object Name,PackageFullName,PackageFamilyName,Version,Architecture,InstallLocation | ConvertTo-Json -Depth 4`;
  const stdout = execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], {
    encoding: "utf8",
    windowsHide: true,
  }).trim();
  if (stdout === "") {
    return [];
  }
  const parsed: unknown = JSON.parse(stdout);
  const packages = Array.isArray(parsed) ? parsed : [parsed];
  return packages.map((item) => {
    const record = item as Record<string, unknown>;
    return {
      name: String(record.Name ?? ""),
      packageFullName: String(record.PackageFullName ?? ""),
      packageFamilyName: String(record.PackageFamilyName ?? ""),
      version: String(record.Version ?? ""),
      architecture: normalizeAppxArchitecture(record.Architecture),
      installLocation: String(record.InstallLocation ?? ""),
    };
  });
}

export function resolveTargetPackage(options: { packageName?: string; packageFamilyName?: string; packageFullName?: string }): AppxPackage {
  if (!options.packageName && !options.packageFamilyName && !options.packageFullName) {
    throw new Error("Pass --package-name, --package-family-name, or --package-full-name.");
  }
  let packages = getAppxPackages(options.packageName);
  if (options.packageFullName) {
    packages = packages.filter((item) => item.packageFullName === options.packageFullName);
  }
  if (options.packageFamilyName) {
    packages = packages.filter((item) => item.packageFamilyName === options.packageFamilyName);
  }
  if (packages.length === 0) {
    throw new Error(`Package not found: name=${options.packageName ?? ""} family=${options.packageFamilyName ?? ""} fullName=${options.packageFullName ?? ""}`);
  }
  if (packages.length > 1 && !options.packageFamilyName && !options.packageFullName) {
    const matches = packages.map((item) => `${item.packageFullName} [${item.packageFamilyName}]`).join("\n");
    throw new Error(`Package name ${options.packageName ?? ""} matched multiple packages; pass --package-family-name or --package-full-name.\n${matches}`);
  }
  return packages.sort(comparePackageVersionDescending)[0];
}

export function comparePackageVersionDescending(left: AppxPackage, right: AppxPackage): number {
  return compareVersionDescending(left.version, right.version);
}

export function compareVersionDescending(left: string, right: string): number {
  const leftParts = left.split(".").map((part) => Number.parseInt(part, 10));
  const rightParts = right.split(".").map((part) => Number.parseInt(part, 10));
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const diff = (rightParts[index] ?? 0) - (leftParts[index] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}

export function escapePowerShellSingleQuoted(value: string): string {
  return value.replaceAll("'", "''");
}

function normalizeAppxArchitecture(value: unknown): string {
  if (typeof value === "number") {
    switch (value) {
      case 0:
        return "X86";
      case 5:
        return "Arm";
      case 9:
        return "X64";
      case 11:
        return "Neutral";
      case 12:
        return "Arm64";
      default:
        return String(value);
    }
  }
  return String(value ?? "");
}

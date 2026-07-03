import fs from "node:fs";
import path from "node:path";
import {
  StoreOwlEntry,
  StoreOwlMetadata,
  directoryDigest,
  parseArgs,
  repoRoot,
  resolveTargetPackage,
  sha256,
  toSourcePath,
} from "./store-owl-shell-common.js";

function assertFileEntry(installLocation: string, entry: StoreOwlEntry): void {
  const packagePath = path.join(installLocation, toSourcePath(entry.sourceRelativePath));
  if (!fs.existsSync(packagePath) || !fs.statSync(packagePath).isFile()) {
    throw new Error(`Package is missing Store/Owl payload file: ${entry.sourceRelativePath}`);
  }
  if (entry.selfSignedMutable === true) {
    return;
  }
  const stat = fs.statSync(packagePath);
  if (entry.size !== undefined && stat.size !== entry.size) {
    throw new Error(`Store/Owl payload file size mismatch for ${entry.sourceRelativePath}: expected ${entry.size}, got ${stat.size}.`);
  }
  const actualSha256 = sha256(packagePath);
  if (actualSha256 !== entry.sha256) {
    throw new Error(`Store/Owl payload SHA-256 mismatch for ${entry.sourceRelativePath}: expected ${entry.sha256}, got ${actualSha256}.`);
  }
}

function assertDirectoryEntry(installLocation: string, entry: StoreOwlEntry): void {
  const packagePath = path.join(installLocation, toSourcePath(entry.sourceRelativePath));
  if (!fs.existsSync(packagePath) || !fs.statSync(packagePath).isDirectory()) {
    throw new Error(`Package is missing Store/Owl payload directory: ${entry.sourceRelativePath}`);
  }
  const digest = directoryDigest(packagePath);
  if (digest.fileCount !== entry.fileCount) {
    throw new Error(`Store/Owl payload directory file count mismatch for ${entry.sourceRelativePath}: expected ${entry.fileCount}, got ${digest.fileCount}.`);
  }
  if (digest.sha256 !== entry.sha256) {
    throw new Error(`Store/Owl payload directory SHA-256 mismatch for ${entry.sourceRelativePath}: expected ${entry.sha256}, got ${digest.sha256}.`);
  }
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const metadataPath = path.join(repoRoot(), "desktop", "resources", "store-owl-shell.json");
  if (!fs.existsSync(metadataPath)) {
    throw new Error("Missing Store/Owl provenance metadata: desktop/resources/store-owl-shell.json");
  }
  const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8")) as StoreOwlMetadata;
  const appxPackage = resolveTargetPackage({
    packageName: args.get("package-name"),
    packageFamilyName: args.get("package-family-name"),
    packageFullName: args.get("package-full-name"),
  });
  if (metadata.architecture !== appxPackage.architecture) {
    throw new Error(`Store/Owl package architecture mismatch: metadata ${metadata.architecture}, installed ${appxPackage.architecture}.`);
  }
  if (!metadata.runtimeMetadataRelativePath) {
    throw new Error("Store/Owl metadata is missing runtimeMetadataRelativePath.");
  }
  if (!metadata.entries.some((entry) => entry.sourceRelativePath === metadata.runtimeMetadataRelativePath)) {
    throw new Error(`Store/Owl metadata entries must include runtime metadata file: ${metadata.runtimeMetadataRelativePath}`);
  }
  for (const entry of metadata.entries) {
    if (entry.kind === "directory") {
      assertDirectoryEntry(appxPackage.installLocation, entry);
    } else {
      assertFileEntry(appxPackage.installLocation, entry);
    }
  }
  console.log(`Store/Owl payload ok: ${appxPackage.packageFullName}`);
}

main();

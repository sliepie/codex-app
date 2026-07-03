import fs from "node:fs";
import path from "node:path";
import * as asar from "@electron/asar";
import { Pickle } from "@electron/asar/lib/pickle";
import {
  StoreOwlEntry,
  StoreOwlMetadata,
  copyRecursive,
  desktopRoot,
  repoRoot,
  toSourcePath,
} from "./store-owl-shell-common.js";

const preservedPackagedAppRootEntries = new Set(["resources"]);
const codexPlusPlusMain = "codex-plusplus/loader.cjs";
const windowsNativeModuleNames = ["better-sqlite3", "node-pty"];

type AsarHeaderEntry = {
  files?: Record<string, AsarHeaderEntry>;
  size?: number;
  offset?: string;
  unpacked?: boolean;
};

function storeOwlMetadata(): StoreOwlMetadata {
  const metadataPath = path.join(desktopRoot(), "resources", "store-owl-shell.json");
  if (!fs.existsSync(metadataPath)) {
    throw new Error("Missing Store/Owl provenance metadata: desktop/resources/store-owl-shell.json");
  }
  return JSON.parse(fs.readFileSync(metadataPath, "utf8")) as StoreOwlMetadata;
}

function storeOwlPayloadRoot(metadata: StoreOwlMetadata): string {
  const payloadRoot = metadata.payloadRoot
    ? path.resolve(repoRoot(), toSourcePath(metadata.payloadRoot))
    : path.join(desktopRoot(), ".cache", "store-owl-shell", "package");
  if (!fs.existsSync(payloadRoot)) {
    throw new Error(`Missing Store/Owl payload cache: ${payloadRoot}. Run npm --prefix desktop run update:store-package first.`);
  }
  return payloadRoot;
}

export function storeOwlShellPayloadCacheExists(): boolean {
  const metadata = storeOwlMetadata();
  const payloadRoot = metadata.payloadRoot
    ? path.resolve(repoRoot(), toSourcePath(metadata.payloadRoot))
    : path.join(desktopRoot(), ".cache", "store-owl-shell", "package");
  return fs.existsSync(payloadRoot);
}

function copyMetadataEntry(payloadRoot: string, destinationRoot: string, entry: StoreOwlEntry, destinationRelativePath: string): void {
  const sourcePath = path.join(payloadRoot, toSourcePath(entry.sourceRelativePath));
  const destinationPath = path.join(destinationRoot, toSourcePath(destinationRelativePath));
  copyRecursive(sourcePath, destinationPath);
}

function cacheSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}

function hydratedMacAppAsarPath(metadata: StoreOwlMetadata): string {
  const appSegment = cacheSegment(`${metadata.appVersion}-build-${metadata.appBuildNumber}`);
  const appAsarPath = path.join(
    desktopRoot(),
    ".cache",
    "codex-app",
    `extract-${appSegment}`,
    "Codex.app",
    "Contents",
    "Resources",
    "app.asar",
  );
  if (!fs.existsSync(appAsarPath)) {
    throw new Error(
      `Missing Store-matched macOS app archive: ${appAsarPath}. Run npm --prefix desktop run hydrate:app:compiled -- --version ${metadata.appVersion} --build-number ${metadata.appBuildNumber} first.`,
    );
  }
  return appAsarPath;
}

function ensureAsarDirectory(header: AsarHeaderEntry, parts: string[]): AsarHeaderEntry {
  let node = header;
  for (const part of parts) {
    node.files ??= {};
    node.files[part] ??= { files: {} };
    node = node.files[part];
    node.files ??= {};
  }
  return node;
}

function setAsarFile(header: AsarHeaderEntry, relativePath: string, data: Buffer, offset: number): void {
  const parts = relativePath.replace(/\\/g, "/").split("/").filter(Boolean);
  const fileName = parts.pop();
  if (!fileName) {
    throw new Error(`Invalid ASAR file path: ${relativePath}`);
  }

  const parent = ensureAsarDirectory(header, parts);
  parent.files ??= {};
  parent.files[fileName] = {
    size: data.length,
    offset: String(offset),
  };
}

function collectCodexPlusPlusFiles(root: string, prefix = "codex-plusplus"): Array<{ relativePath: string; data: Buffer }> {
  const files: Array<{ relativePath: string; data: Buffer }> = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const sourcePath = path.join(root, entry.name);
    const relativePath = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...collectCodexPlusPlusFiles(sourcePath, relativePath));
      continue;
    }
    if (entry.isFile()) {
      files.push({ relativePath, data: fs.readFileSync(sourcePath) });
    }
  }
  return files;
}

function writeAsarWithAppendedFiles(
  sourceAsarPath: string,
  destinationAsarPath: string,
  appendedFiles: Array<{ relativePath: string; data: Buffer }>,
): void {
  const rawHeader = asar.getRawHeader(sourceAsarPath);
  const header = JSON.parse(JSON.stringify(rawHeader.header)) as AsarHeaderEntry;
  const sourceArchive = fs.readFileSync(sourceAsarPath);
  const payloadStart = 8 + rawHeader.headerSize;
  const originalPayload = sourceArchive.subarray(payloadStart);

  let appendOffset = originalPayload.length;
  for (const file of appendedFiles) {
    setAsarFile(header, file.relativePath, file.data, appendOffset);
    appendOffset += file.data.length;
  }

  const headerPickle = Pickle.createEmpty();
  headerPickle.writeString(JSON.stringify(header));
  const headerBuffer = headerPickle.toBuffer();
  const sizePickle = Pickle.createEmpty();
  sizePickle.writeUInt32(headerBuffer.length);
  const sizeBuffer = sizePickle.toBuffer();

  fs.mkdirSync(path.dirname(destinationAsarPath), { recursive: true });
  const tempAsarPath = `${destinationAsarPath}.tmp-${process.pid}-${Date.now()}`;
  const fd = fs.openSync(tempAsarPath, "w");
  try {
    fs.writeSync(fd, sizeBuffer);
    fs.writeSync(fd, headerBuffer);
    fs.writeSync(fd, originalPayload);
    for (const file of appendedFiles) {
      fs.writeSync(fd, file.data);
    }
  } finally {
    fs.closeSync(fd);
  }

  fs.renameSync(tempAsarPath, destinationAsarPath);
  asar.uncache(destinationAsarPath);
}

function copyHydratedMacAppAsarWithCodexPlusPlus(metadata: StoreOwlMetadata, appRoot: string): void {
  const sourceAsarPath = hydratedMacAppAsarPath(metadata);
  const upstreamPackageJson = JSON.parse(asar.extractFile(sourceAsarPath, "package.json").toString("utf8")) as {
    main?: string;
    __codexpp?: Record<string, unknown>;
  };
  const originalMain = upstreamPackageJson.main || ".vite/build/bootstrap.js";
  const packageJson = {
    ...upstreamPackageJson,
    __codexpp: {
      ...upstreamPackageJson.__codexpp,
      originalMain,
    },
    main: codexPlusPlusMain,
  };
  const appendedFiles = [
    {
      relativePath: "package.json",
      data: Buffer.from(`${JSON.stringify(packageJson, null, 2)}\n`, "utf8"),
    },
    ...collectCodexPlusPlusFiles(path.join(desktopRoot(), "codex-plusplus")),
  ];

  writeAsarWithAppendedFiles(sourceAsarPath, path.join(appRoot, "resources", "app.asar"), appendedFiles);
}

function stageRootLayoutWindowsNativeModules(appRoot: string): void {
  const unpackedRoot = path.join(appRoot, "resources", "app.asar.unpacked");
  const sourceNodeModulesRoot = path.join(unpackedRoot, "recovered", "app-asar-extracted", "node_modules");
  const targetNodeModulesRoot = path.join(unpackedRoot, "node_modules");

  for (const moduleName of windowsNativeModuleNames) {
    const sourceModulePath = path.join(sourceNodeModulesRoot, moduleName);
    if (!fs.existsSync(sourceModulePath)) {
      throw new Error(
        `Missing Windows native module payload for Store/Owl app archive: ${sourceModulePath}. Run the Windows package build before Store/Owl staging.`,
      );
    }

    const targetModulePath = path.join(targetNodeModulesRoot, moduleName);
    fs.rmSync(targetModulePath, { recursive: true, force: true });
    copyRecursive(sourceModulePath, targetModulePath);
  }

  fs.rmSync(path.join(unpackedRoot, "recovered"), { recursive: true, force: true });
}

function removeOldElectronShell(appRoot: string): void {
  for (const entry of fs.readdirSync(appRoot, { withFileTypes: true })) {
    if (preservedPackagedAppRootEntries.has(entry.name)) {
      continue;
    }
    fs.rmSync(path.join(appRoot, entry.name), { recursive: true, force: true });
  }
}

function assertPackagedStoreOwlShell(appRoot: string): void {
  for (const relativePath of ["Codex.exe", "chrome.dll", "owl-shell-runtime.json", "resources"]) {
    if (!fs.existsSync(path.join(appRoot, toSourcePath(relativePath)))) {
      throw new Error(`Store/Owl shell staging did not produce ${relativePath}.`);
    }
  }
}

export function stageStoreOwlShellAppRoot(appRoot: string): void {
  const metadata = storeOwlMetadata();
  const payloadRoot = storeOwlPayloadRoot(metadata);
  removeOldElectronShell(appRoot);

  for (const entry of metadata.entries) {
    if (entry.kind === "nestedExecutable") {
      continue;
    }
    if (
      entry.sourceRelativePath.startsWith("app/resources/") ||
      entry.sourceRelativePath === "app/resources"
    ) {
      continue;
    }
    if (entry.sourceRelativePath.startsWith("app/")) {
      copyMetadataEntry(payloadRoot, appRoot, entry, entry.sourceRelativePath.slice("app/".length));
      continue;
    }
    if (entry.sourceRelativePath === metadata.runtimeMetadataRelativePath) {
      copyMetadataEntry(payloadRoot, appRoot, entry, entry.sourceRelativePath);
    }
  }

  copyHydratedMacAppAsarWithCodexPlusPlus(metadata, appRoot);
  stageRootLayoutWindowsNativeModules(appRoot);
  assertPackagedStoreOwlShell(appRoot);
  console.log(`Staged Store/Owl shell into ${appRoot}`);
}

export function stageStoreOwlMsixRoot(outputRoot: string): void {
  const metadata = storeOwlMetadata();
  const payloadRoot = storeOwlPayloadRoot(metadata);

  for (const entry of metadata.entries) {
    if (entry.kind === "nestedExecutable" || entry.sourceRelativePath.startsWith("app/")) {
      continue;
    }
    copyMetadataEntry(payloadRoot, outputRoot, entry, entry.sourceRelativePath);
  }
}

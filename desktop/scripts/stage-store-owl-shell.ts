import fs from "node:fs";
import path from "node:path";
import {
  StoreOwlEntry,
  StoreOwlMetadata,
  copyRecursive,
  desktopRoot,
  repoRoot,
  toSourcePath,
} from "./store-owl-shell-common.js";

const preservedPackagedAppRootEntries = new Set(["resources"]);

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

function copyHydratedMacAppAsar(metadata: StoreOwlMetadata, appRoot: string): void {
  copyRecursive(hydratedMacAppAsarPath(metadata), path.join(appRoot, "resources", "app.asar"));
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

  copyHydratedMacAppAsar(metadata, appRoot);
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

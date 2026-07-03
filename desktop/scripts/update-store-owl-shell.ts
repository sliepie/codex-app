import fs from "node:fs";
import path from "node:path";
import {
  AppxPackage,
  StoreOwlEntry,
  StoreOwlMetadata,
  compareOrdinal,
  comparePackageVersionDescending,
  copyRecursive,
  desktopRoot,
  directoryDigest,
  formatPeMachine,
  getAppxPackages,
  getDirectoryFiles,
  getPeMachine,
  isPeFile,
  parseArgs,
  relativeMetadataPath,
  removeDirectory,
  repoRelativePathOrNull,
  runChecked,
  sha256,
  toSourcePath,
} from "./store-owl-shell-common.js";

const productId = "9PLM9XGG6VKS";
const packageName = "OpenAI.Codex";
const packageFamilyName = "OpenAI.Codex_2p2nqsd0c76g0";
const requiredArchitecture = "Arm64";
const nativePayloadExtensions = new Set([".exe", ".dll", ".node"]);
const appDirectoriesHydratedFromPublicArtifacts = new Set(["resources"]);
const asar = require("@electron/asar") as {
  extractFile(archive: string, filename: string): Buffer;
};

type StoreAppAsarPackageJson = {
  codexBuildNumber?: string;
  version?: string;
};

function codexAppPackages(): AppxPackage[] {
  return getAppxPackages(packageName)
    .filter((item) => item.packageFamilyName === packageFamilyName)
    .sort(comparePackageVersionDescending);
}

function codexArm64Package(): AppxPackage | undefined {
  return codexAppPackages()
    .filter((item) => item.architecture === requiredArchitecture)
    .sort(comparePackageVersionDescending)[0];
}

function invokeWinget(args: string[], options: { allowNoApplicableUpgrade?: boolean } = {}): void {
  const noApplicableUpgradeExitCode = 2316632107;
  try {
    runChecked("winget", args, { allowExitCode: options.allowNoApplicableUpgrade ? noApplicableUpgradeExitCode : undefined });
  } catch (error) {
    if (options.allowNoApplicableUpgrade && error instanceof Error && error.message.includes(String(noApplicableUpgradeExitCode))) {
      console.log("No newer Codex Store package is available; using the installed package.");
      return;
    }
    throw error;
  }
}

function assertArm64Package(appxPackage: AppxPackage): void {
  if (appxPackage.architecture !== requiredArchitecture) {
    throw new Error(`Official Codex Store package ${appxPackage.packageFullName} is ${appxPackage.architecture}; expected ${requiredArchitecture} for the Windows ARM64 payload.`);
  }
}

function nativePayloadCandidate(filePath: string): boolean {
  const extension = path.extname(filePath).toLowerCase();
  if (!nativePayloadExtensions.has(extension)) {
    return false;
  }
  if (extension === ".node") {
    return isPeFile(filePath);
  }
  return true;
}

function copyStorePath(sourceRoot: string, destinationRoot: string, relativePath: string, kind: "directory" | "file", selfSignedMutable = false): StoreOwlEntry[] {
  const sourcePath = path.join(sourceRoot, toSourcePath(relativePath));
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing Store/Owl shell payload path: ${relativePath}`);
  }
  const destinationPath = path.join(destinationRoot, toSourcePath(relativePath));
  copyRecursive(sourcePath, destinationPath);
  if (kind === "directory") {
    const digest = directoryDigest(destinationPath);
    const directoryEntry: StoreOwlEntry = {
      sourceRelativePath: relativePath,
      kind: "directory",
      fileCount: digest.fileCount,
      sha256: digest.sha256,
    };
    return [directoryEntry, ...nestedNativePayloadEntries(destinationRoot, destinationPath, relativePath)];
  }

  const stat = fs.statSync(destinationPath);
  const entry: StoreOwlEntry = {
    sourceRelativePath: relativePath,
    kind: "file",
    size: stat.size,
    sha256: sha256(destinationPath),
  };
  if (selfSignedMutable) {
    entry.selfSignedMutable = true;
  }
  if (nativePayloadCandidate(destinationPath)) {
    entry.architecture = formatPeMachine(getPeMachine(destinationPath));
  }
  return [entry];
}

function nestedNativePayloadEntries(destinationRoot: string, directoryPath: string, containedIn: string): StoreOwlEntry[] {
  return getDirectoryFiles(directoryPath)
    .filter(nativePayloadCandidate)
    .map((filePath) => ({
      sourceRelativePath: relativeMetadataPath(destinationRoot, filePath),
      kind: "nestedExecutable" as const,
      size: fs.statSync(filePath).size,
      sha256: sha256(filePath),
      architecture: formatPeMachine(getPeMachine(filePath)),
      containedIn,
    }));
}

function copyStorePattern(sourceRoot: string, destinationRoot: string, pattern: RegExp): StoreOwlEntry[] {
  return fs.readdirSync(sourceRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && pattern.test(entry.name))
    .map((entry) => entry.name)
    .sort(compareOrdinal)
    .flatMap((name) => copyStorePath(sourceRoot, destinationRoot, name, "file", false));
}

function copyStoreDirectoryFiles(sourceRoot: string, destinationRoot: string, relativeDirectory: string): StoreOwlEntry[] {
  const sourceDirectory = path.join(sourceRoot, toSourcePath(relativeDirectory));
  if (!fs.existsSync(sourceDirectory)) {
    throw new Error(`Missing Store/Owl shell payload directory: ${relativeDirectory}`);
  }
  return fs.readdirSync(sourceDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort(compareOrdinal)
    .flatMap((name) => copyStorePath(sourceRoot, destinationRoot, `${relativeDirectory}/${name}`, "file"));
}

function copyStoreDirectorySubdirectories(sourceRoot: string, destinationRoot: string, relativeDirectory: string): StoreOwlEntry[] {
  const sourceDirectory = path.join(sourceRoot, toSourcePath(relativeDirectory));
  if (!fs.existsSync(sourceDirectory)) {
    throw new Error(`Missing Store/Owl shell payload directory: ${relativeDirectory}`);
  }
  return fs.readdirSync(sourceDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !appDirectoriesHydratedFromPublicArtifacts.has(entry.name))
    .map((entry) => entry.name)
    .sort(compareOrdinal)
    .flatMap((name) => copyStorePath(sourceRoot, destinationRoot, `${relativeDirectory}/${name}`, "directory"));
}

function readStoreAppAsarPackage(sourceRoot: string): { appBuildNumber: string; appVersion: string } {
  const appAsarPath = path.join(sourceRoot, "app", "resources", "app.asar");
  if (!fs.existsSync(appAsarPath)) {
    throw new Error("Missing Store app archive needed to resolve the matching public macOS appcast version.");
  }

  const packageJson = JSON.parse(asar.extractFile(appAsarPath, "package.json").toString("utf8")) as StoreAppAsarPackageJson;
  if (!packageJson.version || !packageJson.codexBuildNumber) {
    throw new Error("Store app archive package.json is missing version or codexBuildNumber.");
  }
  return {
    appBuildNumber: packageJson.codexBuildNumber,
    appVersion: packageJson.version,
  };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const outputRoot = path.resolve(args.get("output-root") ?? path.join(desktopRoot(), ".cache", "store-owl-shell", "package"));
  const metadataOutputPath = path.resolve(args.get("metadata-output-path") ?? path.join(desktopRoot(), "resources", "store-owl-shell.json"));
  const existingOfficialPackages = codexAppPackages();
  const existingPackage = codexArm64Package();
  const hadOfficialPackageBeforeRun = existingOfficialPackages.length > 0;
  const needsArm64Install = existingPackage === undefined;

  try {
    if (needsArm64Install) {
      invokeWinget([
        "install",
        "--id", productId,
        "--source", "msstore",
        "--exact",
        "--scope", "user",
        "--architecture", "arm64",
        "--silent",
        "--accept-package-agreements",
        "--accept-source-agreements",
        "--authentication-mode", "silent",
        "--disable-interactivity",
      ]);
    } else {
      invokeWinget([
        "upgrade",
        "--id", productId,
        "--source", "msstore",
        "--exact",
        "--scope", "user",
        "--architecture", "arm64",
        "--silent",
        "--include-unknown",
        "--accept-package-agreements",
        "--accept-source-agreements",
        "--authentication-mode", "silent",
        "--disable-interactivity",
      ], { allowNoApplicableUpgrade: true });
    }

    const appxPackage = codexArm64Package();
    if (appxPackage === undefined) {
      throw new Error(`Official Codex Store package family ${packageFamilyName} was not found after winget completed.`);
    }
    assertArm64Package(appxPackage);
    const storeAppAsarPackage = readStoreAppAsarPackage(appxPackage.installLocation);

    removeDirectory(outputRoot);
    fs.mkdirSync(outputRoot, { recursive: true });

    const entries: StoreOwlEntry[] = [];
    for (const payloadPath of [
      { relativePath: "AppxManifest.xml", kind: "file" as const, selfSignedMutable: true },
      { relativePath: "assets", kind: "directory" as const },
    ]) {
      entries.push(...copyStorePath(appxPackage.installLocation, outputRoot, payloadPath.relativePath, payloadPath.kind, payloadPath.selfSignedMutable));
    }
    entries.push(...copyStoreDirectorySubdirectories(appxPackage.installLocation, outputRoot, "app"));
    entries.push(...copyStoreDirectoryFiles(appxPackage.installLocation, outputRoot, "app"));
    entries.push(...copyStorePath(appxPackage.installLocation, outputRoot, "resources.pri", "file", true));
    entries.push(...copyStorePattern(appxPackage.installLocation, outputRoot, /^resources\..*\.pri$/u));
    if (fs.existsSync(path.join(appxPackage.installLocation, "priconfig.xml"))) {
      entries.push(...copyStorePath(appxPackage.installLocation, outputRoot, "priconfig.xml", "file"));
    }

    const runtimeMetadata = {
      appBuildNumber: storeAppAsarPackage.appBuildNumber,
      appVersion: storeAppAsarPackage.appVersion,
      productId,
      packageName: appxPackage.name,
      packageFullName: appxPackage.packageFullName,
      packageFamilyName: appxPackage.packageFamilyName,
      packageVersion: appxPackage.version,
      architecture: appxPackage.architecture,
      payloadRoot: "store-owl-shell/package",
      entries,
    };
    const runtimeMetadataPath = path.join(outputRoot, "owl-shell-runtime.json");
    fs.writeFileSync(runtimeMetadataPath, `${JSON.stringify(runtimeMetadata, null, 2)}\n`);
    const runtimeMetadataEntry: StoreOwlEntry = {
      sourceRelativePath: "owl-shell-runtime.json",
      kind: "file",
      size: fs.statSync(runtimeMetadataPath).size,
      sha256: sha256(runtimeMetadataPath),
    };
    const metadata: StoreOwlMetadata = {
      appBuildNumber: storeAppAsarPackage.appBuildNumber,
      appVersion: storeAppAsarPackage.appVersion,
      productId,
      packageName: appxPackage.name,
      packageFullName: appxPackage.packageFullName,
      packageFamilyName: appxPackage.packageFamilyName,
      packageVersion: appxPackage.version,
      architecture: appxPackage.architecture,
      payloadRoot: repoRelativePathOrNull(outputRoot),
      runtimeMetadataRelativePath: "owl-shell-runtime.json",
      entries: [...entries, runtimeMetadataEntry],
    };
    fs.mkdirSync(path.dirname(metadataOutputPath), { recursive: true });
    fs.writeFileSync(metadataOutputPath, `${JSON.stringify(metadata, null, 2)}\n`);
    console.log(`Updated Store/Owl shell payload at ${outputRoot} from ${appxPackage.packageFullName}.`);
    console.log(`Wrote Store/Owl shell metadata to ${metadataOutputPath}.`);
  } finally {
    if (!hadOfficialPackageBeforeRun) {
      for (const packageToRemove of codexAppPackages()) {
        runChecked("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", `Remove-AppxPackage -Package '${packageToRemove.packageFullName.replaceAll("'", "''")}' -ErrorAction Stop`]);
        console.log(`Uninstalled temporary Codex package ${packageToRemove.packageFullName}.`);
      }
    }
  }
}

main();

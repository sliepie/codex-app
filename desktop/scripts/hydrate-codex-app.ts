import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import extract from "extract-zip";

type Options = {
  version?: string;
  appcastUrl: string;
  cacheRoot: string;
  force: boolean;
};

const desktopRoot = process.cwd();

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
  const cacheRoot =
    readOption(argv, "--cache-root", "-CacheRoot") ??
    path.join(desktopRoot, ".cache", "codex-app");

  return {
    version: readOption(argv, "--version", "-Version"),
    appcastUrl:
      readOption(argv, "--appcast-url", "-AppcastUrl") ??
      "https://persistent.oaistatic.com/codex-app-prod/appcast.xml",
    cacheRoot,
    force: hasFlag(argv, "--force", "-Force"),
  };
}

function firstMatch(text: string, pattern: RegExp, message: string): string {
  const match = text.match(pattern);
  if (!match?.[1]) {
    throw new Error(message);
  }
  return match[1].trim();
}

function findReleaseItem(appcast: string, version?: string): string {
  const items = [...appcast.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map(
    (match) => match[0],
  );
  if (items.length === 0) {
    throw new Error("No Codex app release was found in the appcast.");
  }
  if (!version) {
    return items.find((item) => /<enclosure\b/i.test(item)) ?? items[0];
  }

  const item = items.find((candidate) =>
    candidate.includes(`<sparkle:shortVersionString>${version}</sparkle:shortVersionString>`),
  );
  if (!item) {
    throw new Error(`Codex app version ${version} was not found in the appcast.`);
  }
  return item;
}

function findAppAsar(root: string): string | undefined {
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      const match = findAppAsar(entryPath);
      if (match) {
        return match;
      }
      continue;
    }

    const normalized = entryPath.replaceAll(path.sep, "/");
    if (normalized.endsWith("Codex.app/Contents/Resources/app.asar")) {
      return entryPath;
    }
  }
  return undefined;
}

async function downloadFile(url: string, outputPath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }

  fs.writeFileSync(outputPath, Buffer.from(await response.arrayBuffer()));
}

function listPackageRoots(nodeModulesRoot: string): string[] {
  if (!fs.existsSync(nodeModulesRoot)) {
    return [];
  }

  const packageRoots = [];
  for (const entry of fs.readdirSync(nodeModulesRoot, { withFileTypes: true })) {
    const entryPath = path.join(nodeModulesRoot, entry.name);
    if (!entry.isDirectory()) {
      continue;
    }

    if (entry.name.startsWith("@")) {
      for (const scopedEntry of fs.readdirSync(entryPath, { withFileTypes: true })) {
        if (scopedEntry.isDirectory()) {
          packageRoots.push(path.join(entryPath, scopedEntry.name));
        }
      }
      continue;
    }

    packageRoots.push(entryPath);
  }

  return packageRoots;
}

function hasNativePayload(packageRoot: string): boolean {
  if (
    fs.existsSync(path.join(packageRoot, "binding.gyp")) ||
    fs.existsSync(path.join(packageRoot, "prebuilds"))
  ) {
    return true;
  }

  const entries = fs.readdirSync(packageRoot, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(packageRoot, entry.name);
    if (entry.isDirectory() && entry.name !== "node_modules") {
      if (hasNativePayload(entryPath)) {
        return true;
      }
      continue;
    }

    if (
      entry.isFile() &&
      [".node", ".dll", ".dylib", ".so", ".exe"].includes(path.extname(entry.name))
    ) {
      return true;
    }
  }

  return false;
}

function findNativeNodeModules(recoveredRoot: string): { name: string; version: string }[] {
  const nodeModulesRoot = path.join(recoveredRoot, "node_modules");
  const nativeModules = [];

  for (const packageRoot of listPackageRoots(nodeModulesRoot)) {
    if (!hasNativePayload(packageRoot)) {
      continue;
    }

    const packageJsonPath = path.join(packageRoot, "package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as {
      name?: string;
      version?: string;
    };
    if (!packageJson.name || !packageJson.version) {
      throw new Error(`Native Node module is missing name or version: ${packageJsonPath}`);
    }

    nativeModules.push({ name: packageJson.name, version: packageJson.version });
  }

  return nativeModules.sort((left, right) => left.name.localeCompare(right.name));
}

function getInstalledPackageVersion(packageName: string): string | undefined {
  const packageJsonPath = path.join(
    desktopRoot,
    "node_modules",
    ...packageName.split("/"),
    "package.json",
  );
  if (!fs.existsSync(packageJsonPath)) {
    return undefined;
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as { version?: string };
  return packageJson.version;
}

function runNpm(args: string[]): void {
  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath && fs.existsSync(npmExecPath)) {
    execFileSync(process.execPath, [npmExecPath, ...args], {
      cwd: desktopRoot,
      stdio: "inherit",
    });
    return;
  }

  execFileSync(
    process.platform === "win32" ? "npm.cmd" : "npm",
    args,
    { cwd: desktopRoot, shell: process.platform === "win32", stdio: "inherit" },
  );
}

function syncNativeNodeModules(recoveredRoot: string): void {
  const nativeModules = findNativeNodeModules(recoveredRoot);
  if (nativeModules.length === 0) {
    console.log("Hydrated app has no native Node modules.");
    return;
  }

  const missingOrOutdatedModules = nativeModules.filter(
    (nativeModule) => getInstalledPackageVersion(nativeModule.name) !== nativeModule.version,
  );

  if (missingOrOutdatedModules.length > 0) {
    runNpm([
      "install",
      "--no-save",
      "--package-lock=false",
      "--no-audit",
      "--fund=false",
      ...missingOrOutdatedModules.map(
        (nativeModule) => `${nativeModule.name}@${nativeModule.version}`,
      ),
    ]);
  }

  const nativeModuleNames = nativeModules.map((nativeModule) => nativeModule.name);
  runNpm(["rebuild", ...nativeModuleNames, "--arch=arm64", "--target_arch=arm64"]);
  console.log(`Synced native Node modules for Windows ARM64: ${nativeModuleNames.join(", ")}`);
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  if (!options.appcastUrl.trim()) {
    throw new Error("Missing Codex appcast URL.");
  }

  fs.mkdirSync(options.cacheRoot, { recursive: true });

  const appcastResponse = await fetch(options.appcastUrl);
  if (!appcastResponse.ok) {
    throw new Error(
      `Failed to fetch Codex appcast: ${appcastResponse.status} ${appcastResponse.statusText}`,
    );
  }

  const item = findReleaseItem(await appcastResponse.text(), options.version);
  const selectedVersion = firstMatch(
    item,
    /<sparkle:shortVersionString>([^<]+)<\/sparkle:shortVersionString>/i,
    "The selected Codex app release does not have a version.",
  );
  const selectedBuildNumber =
    item.match(/<sparkle:version>([^<]+)<\/sparkle:version>/i)?.[1]?.trim() ?? "";
  const downloadUrl = firstMatch(
    item,
    /<enclosure\b[^>]*\burl="([^"]+)"/i,
    `Codex app version ${selectedVersion} does not have a full download URL.`,
  );

  const zipPath = path.join(options.cacheRoot, path.basename(new URL(downloadUrl).pathname));
  const extractRoot = path.join(options.cacheRoot, `extract-${selectedVersion}`);
  const recoveredRoot = path.join(desktopRoot, "recovered", "app-asar-extracted");
  const releaseInfoPath = path.join(options.cacheRoot, "latest-release.json");

  if (options.force) {
    fs.rmSync(zipPath, { force: true });
    fs.rmSync(extractRoot, { recursive: true, force: true });
  }

  if (!fs.existsSync(zipPath)) {
    await downloadFile(downloadUrl, zipPath);
  }

  if (!fs.existsSync(extractRoot)) {
    fs.mkdirSync(extractRoot, { recursive: true });
    await extract(zipPath, { dir: extractRoot });
  }

  const appAsar = findAppAsar(extractRoot);
  if (!appAsar) {
    throw new Error("Could not find Codex.app Contents/Resources/app.asar in the downloaded ZIP.");
  }

  execFileSync(
    process.execPath,
    [
      path.join(desktopRoot, "scripts", "refresh-recovered-from-dmg.mjs"),
      "--app-asar",
      appAsar,
      "--output",
      recoveredRoot,
    ],
    { stdio: "inherit" },
  );
  syncNativeNodeModules(recoveredRoot);

  fs.writeFileSync(
    releaseInfoPath,
    `${JSON.stringify(
      {
        version: selectedVersion,
        buildNumber: selectedBuildNumber,
        downloadUrl,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log(`Hydrated Codex app ${selectedVersion} from ${downloadUrl}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

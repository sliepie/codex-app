import { createRequire } from "node:module";
import fs from "node:fs/promises";
import path from "node:path";

const require = createRequire(import.meta.url);
const { initializeProxy } = require("@electron/get");
const { packager } = require("@electron/packager");
const { flipFuses } = require("@electron/fuses");

function readOptionValue(argv, index, optionName) {
  const value = argv[index + 1];
  if (!value || value.startsWith("-")) {
    throw new Error("Missing value for " + optionName);
  }
  return value;
}

function parseForgeArgs(argv) {
  const command = argv[0];
  if (command !== "package" && command !== "make") {
    throw new Error("Expected Forge command to be package or make.");
  }

  const options = {
    dir: process.cwd(),
    interactive: true,
  };

  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--platform" || arg === "-p") {
      options.platform = readOptionValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith("--platform=")) {
      options.platform = arg.slice("--platform=".length);
      continue;
    }

    if (arg === "--arch" || arg === "-a") {
      options.arch = readOptionValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith("--arch=")) {
      options.arch = arg.slice("--arch=".length);
      continue;
    }

    if (command === "make" && arg === "--skip-package") {
      options.skipPackage = true;
      continue;
    }

    if (command === "make" && arg === "--targets") {
      options.overrideTargets = readOptionValue(argv, index, arg).split(",");
      index += 1;
      continue;
    }
    if (command === "make" && arg.startsWith("--targets=")) {
      options.overrideTargets = arg.slice("--targets=".length).split(",");
      continue;
    }

    throw new Error("Unsupported Forge argument: " + arg);
  }

  options.platform ??= process.platform;
  options.arch ??= process.arch;
  return { command, options };
}

function asArray(value) {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function loadForgeConfig(dir) {
  return require(path.join(dir, "forge.config.js"));
}

function readPackageJson(packageRoot) {
  return require(path.join(packageRoot, "package.json"));
}

function applyAutoUnpackNatives(packagerConfig) {
  if (!packagerConfig.asar) {
    return;
  }

  const nativeUnpackPattern = "**/{.**,**}/**/*.node";
  if (packagerConfig.asar === true) {
    packagerConfig.asar = { unpack: nativeUnpackPattern };
    return;
  }

  const existingUnpack = packagerConfig.asar.unpack;
  packagerConfig.asar = {
    ...packagerConfig.asar,
    unpack: existingUnpack
      ? `{${existingUnpack},${nativeUnpackPattern}}`
      : nativeUnpackPattern,
  };
}

function callbackHook(action) {
  return (buildPath, electronVersion, platform, arch, callback) => {
    Promise.resolve()
      .then(() => action(buildPath, electronVersion, platform, arch))
      .then(() => callback(), callback);
  };
}

async function removeDotBinDirectories(root) {
  let entries;
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") {
      return;
    }
    throw error;
  }

  await Promise.all(
    entries.map(async (entry) => {
      if (!entry.isDirectory()) {
        return;
      }

      const entryPath = path.join(root, entry.name);
      if (entry.name === ".bin") {
        await fs.rm(entryPath, { force: true, recursive: true });
        return;
      }

      await removeDotBinDirectories(entryPath);
    }),
  );
}

function findFusesConfig(forgeConfig) {
  return forgeConfig.plugins?.find((plugin) => plugin?.name === "fuses")?.fusesConfig ?? {};
}

function electronExecutablePath(buildPath, platform) {
  if (platform !== "win32") {
    throw new Error("Direct Forge runner only supports win32 packaging.");
  }

  return path.resolve(buildPath, "../..", "electron.exe");
}

async function flipConfiguredFuses(buildPath, _electronVersion, platform, _arch, forgeConfig) {
  const fusesConfig = findFusesConfig(forgeConfig);
  if (Object.keys(fusesConfig).length === 0) {
    return;
  }

  await flipFuses(electronExecutablePath(buildPath, platform), fusesConfig);
}

function createPackagerOptions(options, forgeConfig) {
  const packagerConfig = {
    ...(forgeConfig.packagerConfig ?? {}),
  };
  const afterCopyHooks = asArray(packagerConfig.afterCopy);

  applyAutoUnpackNatives(packagerConfig);
  packagerConfig.afterCopy = [
    callbackHook((buildPath) => removeDotBinDirectories(path.join(buildPath, "node_modules", ".bin"))),
    callbackHook((buildPath, electronVersion, platform, arch) =>
      flipConfiguredFuses(buildPath, electronVersion, platform, arch, forgeConfig),
    ),
    ...afterCopyHooks,
  ];

  return {
    asar: false,
    overwrite: true,
    ignore: [/^\/out\//g],
    quiet: false,
    ...packagerConfig,
    dir: options.dir,
    arch: options.arch,
    platform: options.platform,
    out: path.join(options.dir, "out"),
  };
}

async function runPackage(options) {
  const forgeConfig = loadForgeConfig(options.dir);
  const outputPaths = await packager(createPackagerOptions(options, forgeConfig));
  for (const outputPath of outputPaths) {
    console.log("Packaged Electron app: " + outputPath);
  }
  return outputPaths;
}

function packageRootForOptions(options) {
  const packageJson = readPackageJson(options.dir);
  const appName = packageJson.productName ?? packageJson.name;
  return path.join(options.dir, "out", `${appName}-${options.platform}-${options.arch}`);
}

async function runMake(options) {
  if (!options.skipPackage) {
    await runPackage(options);
  }

  const forgeConfig = loadForgeConfig(options.dir);
  const packageRoot = packageRootForOptions(options);
  const packagedPackageJson = JSON.parse(
    await fs.readFile(path.join(packageRoot, "resources", "app", "package.json"), "utf8"),
  );
  const maker = forgeConfig.makers?.find((candidate) => candidate?.name === "zip");
  if (!maker) {
    throw new Error("Missing ZIP maker in Forge config.");
  }

  await maker.prepareConfig?.(options.arch);
  const artifacts = await maker.make({
    appName: packagedPackageJson.productName ?? "Codex",
    dir: packageRoot,
    forgeConfig,
    makeDir: path.join(options.dir, "out", "make"),
    packageJSON: packagedPackageJson,
    targetArch: options.arch,
    targetPlatform: options.platform,
  });

  let makeResults = [
    {
      artifacts,
      packageJSON: packagedPackageJson,
      platform: options.platform,
      arch: options.arch,
    },
  ];

  if (forgeConfig.hooks?.postMake) {
    makeResults = await forgeConfig.hooks.postMake(forgeConfig, makeResults);
  }

  for (const result of makeResults) {
    for (const artifact of result.artifacts) {
      console.log("Made Electron artifact: " + artifact);
    }
  }
}

async function main() {
  const { command, options } = parseForgeArgs(process.argv.slice(2));
  initializeProxy();

  if (command === "package") {
    await runPackage(options);
    return;
  }

  await runMake(options);
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}

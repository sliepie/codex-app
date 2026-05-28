import * as electronGetModule from "@electron/get";
import * as forgeCoreModule from "@electron-forge/core";

const api = forgeCoreModule.api ?? forgeCoreModule.default?.api;
const initializeProxy =
  electronGetModule.initializeProxy ?? electronGetModule.default?.initializeProxy;

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

  return { command, options };
}

async function main() {
  if (!api) {
    throw new Error("Unable to load Electron Forge core API.");
  }

  const { command, options } = parseForgeArgs(process.argv.slice(2));
  initializeProxy?.();

  if (command === "package") {
    await api.package(options);
    return;
  }

  await api.make(options);
}

async function runWithForgeLiveness(action) {
  // Forge 7 bridges Electron Packager callbacks through promises. Keep Node
  // alive while that bridge is pending, otherwise Node 24 can exit early.
  const keepAlive = setInterval(() => {}, 1000);
  try {
    return await action();
  } finally {
    clearInterval(keepAlive);
  }
}

try {
  await runWithForgeLiveness(main);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}

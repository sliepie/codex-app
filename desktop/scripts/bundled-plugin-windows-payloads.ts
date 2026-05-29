import fs from "node:fs";
import path from "node:path";
import {
  formatPeMachine,
  readPeMachine,
  resourceBinaryExceptionById,
} from "./resource-binary-exceptions";

export type BundledPluginWindowsPayloadOptions = {
  computerUsePath?: string;
  extensionHostPath?: string;
  targetArch?: string;
};

function resolveDesktopRoot(): string {
  return path.basename(__dirname) === "scripts" && path.basename(path.dirname(__dirname)) === ".cache"
    ? path.resolve(__dirname, "..", "..")
    : path.resolve(__dirname, "..");
}

const desktopRoot = resolveDesktopRoot();
const defaultComputerUsePath = path.join(desktopRoot, "resources", "codex-computer-use.exe");
const defaultExtensionHostPath = path.join(desktopRoot, "resources", "extension-host.exe");
const defaultTargetArch = "arm64";

export const openAiBundledMarketplaceNames = ["openai-bundled", "openai-bundled-beta"] as const;

function requireWindowsPayload(payloadPath: string, label: string, command: string): void {
  if (!fs.existsSync(payloadPath)) {
    throw new Error("Missing " + label + ": " + payloadPath + ". Run " + command + ".");
  }
}

function assertExpectedMachine(filePath: string, expectedMachine: number, label: string): void {
  const machine = readPeMachine(filePath);
  if (machine !== expectedMachine) {
    throw new Error(
      label + " has machine " + formatPeMachine(machine) + ", expected " +
        formatPeMachine(expectedMachine) + ".",
    );
  }
}

function syncChromeWindowsPayload(
  destinationPluginRoot: string,
  options: BundledPluginWindowsPayloadOptions,
): void {
  const exception = resourceBinaryExceptionById("chrome-extension-host");
  const extensionHostPath = options.extensionHostPath ?? defaultExtensionHostPath;
  requireWindowsPayload(extensionHostPath, "Chrome extension-host.exe", "npm run update:node-repl");
  assertExpectedMachine(extensionHostPath, exception.expectedMachine, exception.label);

  const extensionHostRoot = path.join(destinationPluginRoot, "extension-host");
  fs.rmSync(extensionHostRoot, { recursive: true, force: true });
  const destinationPath = path.join(
    destinationPluginRoot,
    "extension-host",
    "windows",
    options.targetArch ?? defaultTargetArch,
    "extension-host.exe",
  );
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.copyFileSync(extensionHostPath, destinationPath);
}

function syncComputerUseWindowsPayload(
  destinationPluginRoot: string,
  options: BundledPluginWindowsPayloadOptions,
): void {
  const exception = resourceBinaryExceptionById("computer-use");
  const computerUsePath = options.computerUsePath ?? defaultComputerUsePath;
  requireWindowsPayload(computerUsePath, "codex-computer-use.exe", "npm run update:node-repl");
  assertExpectedMachine(computerUsePath, exception.expectedMachine, exception.label);

  fs.rmSync(path.join(destinationPluginRoot, "Codex Computer Use.app"), { recursive: true, force: true });
  const destinationPath = path.join(
    destinationPluginRoot,
    "node_modules",
    "@oai",
    "sky",
    "bin",
    "windows",
    "codex-computer-use.exe",
  );
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.copyFileSync(computerUsePath, destinationPath);
}

function pruneLatexMacPayload(destinationPluginRoot: string): void {
  const binRoot = path.join(destinationPluginRoot, "bin");
  fs.rmSync(path.join(binRoot, "tectonic"), { force: true });
}

export function syncBundledPluginWindowsPayloads(
  pluginName: string,
  destinationPluginRoot: string,
  options: BundledPluginWindowsPayloadOptions = {},
): void {
  if (pluginName === "computer-use") {
    syncComputerUseWindowsPayload(destinationPluginRoot, options);
  }
  if (pluginName === "chrome") {
    syncChromeWindowsPayload(destinationPluginRoot, options);
  }
  if (pluginName === "latex" || pluginName === "latex-tectonic") {
    pruneLatexMacPayload(destinationPluginRoot);
  }
}

export function findBundledLatexPluginRoots(resourcesRoot: string): string[] {
  const roots: string[] = [];
  for (const marketplaceName of openAiBundledMarketplaceNames) {
    for (const pluginName of ["latex", "latex-tectonic"]) {
      const pluginRoot = path.join(resourcesRoot, "plugins", marketplaceName, "plugins", pluginName);
      if (fs.existsSync(pluginRoot)) {
        roots.push(pluginRoot);
      }
    }
  }

  if (roots.length === 0) {
    throw new Error("Missing bundled LaTeX plugin resources. Run hydrate:app before hydrate:cli.");
  }

  return roots;
}

export function installTectonicWindowsPayload(resourcesRoot: string, tectonicPath: string): void {
  const exception = resourceBinaryExceptionById("tectonic");
  assertExpectedMachine(tectonicPath, exception.expectedMachine, exception.label);

  for (const pluginRoot of findBundledLatexPluginRoots(resourcesRoot)) {
    const binRoot = path.join(pluginRoot, "bin");
    fs.mkdirSync(binRoot, { recursive: true });
    fs.copyFileSync(tectonicPath, path.join(binRoot, "tectonic.exe"));
    fs.rmSync(path.join(binRoot, "tectonic"), { force: true });
  }
}

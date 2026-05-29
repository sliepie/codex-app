const PATCH_MARKER = Symbol.for("codex-app.compact-windows-titlebar.browser-window");
const PRELOAD_SHIM_NAME = "compact-windows-titlebar-preload.cjs";

let patchedElectron = null;
let originalBrowserWindow = null;
let patchedBrowserWindow = null;

function logInfo(api, message) {
  if (typeof api?.log?.info === "function") {
    api.log.info(message);
  }
}

function logWarn(api, message, error) {
  if (typeof api?.log?.warn === "function") {
    api.log.warn(message, error);
    return;
  }

  if (typeof api?.log?.error === "function") {
    api.log.error(message, error);
  }
}

function userRoot(electron, path) {
  if (process.env.CODEX_PLUSPLUS_USER_ROOT) {
    return process.env.CODEX_PLUSPLUS_USER_ROOT;
  }

  return path.join(electron.app.getPath("userData"), "codex-plusplus");
}

function preloadShimSource(originalPreloadPath) {
  return (
    '"use strict";\n' +
    'const electron = require("electron");\n' +
    "const contextBridge = electron && electron.contextBridge;\n" +
    "const originalExposeInMainWorld = contextBridge && contextBridge.exposeInMainWorld;\n" +
    "function withoutApplicationMenuBridge(name, api) {\n" +
    '  if (name !== "electronBridge" || !api || typeof api !== "object") {\n' +
    "    return api;\n" +
    "  }\n" +
    "  const compactApi = { ...api };\n" +
    "  delete compactApi.showApplicationMenu;\n" +
    "  return compactApi;\n" +
    "}\n" +
    "if (typeof originalExposeInMainWorld === \"function\") {\n" +
    "  const wrappedExposeInMainWorld = function(name, api) {\n" +
    "    return originalExposeInMainWorld.call(\n" +
    "      this,\n" +
    "      name,\n" +
    "      withoutApplicationMenuBridge(name, api),\n" +
    "    );\n" +
    "  };\n" +
    "  contextBridge.exposeInMainWorld = wrappedExposeInMainWorld;\n" +
    "  try {\n" +
    "    require(" +
    JSON.stringify(originalPreloadPath) +
    ");\n" +
    "  } finally {\n" +
    "    if (contextBridge.exposeInMainWorld === wrappedExposeInMainWorld) {\n" +
    "      contextBridge.exposeInMainWorld = originalExposeInMainWorld;\n" +
    "    }\n" +
    "  }\n" +
    "} else {\n" +
    "  require(" +
    JSON.stringify(originalPreloadPath) +
    ");\n" +
    "}\n"
  );
}

function ensurePreloadShim(electron, fs, path, originalPreloadPath) {
  const shimDir = path.join(userRoot(electron, path), "generated");
  const shimPath = path.join(shimDir, PRELOAD_SHIM_NAME);
  const source = preloadShimSource(path.resolve(originalPreloadPath));

  fs.mkdirSync(shimDir, { recursive: true });

  let currentSource = null;
  try {
    currentSource = fs.readFileSync(shimPath, "utf8");
  } catch {
    currentSource = null;
  }

  if (currentSource !== source) {
    fs.writeFileSync(shimPath, source, "utf8");
  }

  return shimPath;
}

function patchBrowserWindowOptions(electron, fs, path, options) {
  if (!options || typeof options !== "object") {
    return options;
  }

  const webPreferences = options.webPreferences;
  if (!webPreferences || typeof webPreferences.preload !== "string") {
    return options;
  }

  if (path.basename(webPreferences.preload) === PRELOAD_SHIM_NAME) {
    return options;
  }

  return {
    ...options,
    webPreferences: {
      ...webPreferences,
      preload: ensurePreloadShim(electron, fs, path, webPreferences.preload),
    },
  };
}

function installBrowserWindowPatch(electron, fs, path, api) {
  const BrowserWindow = electron?.BrowserWindow;
  if (typeof BrowserWindow !== "function") {
    return false;
  }

  if (BrowserWindow[PATCH_MARKER]) {
    return true;
  }

  originalBrowserWindow = BrowserWindow;
  patchedBrowserWindow = new Proxy(originalBrowserWindow, {
    construct(target, args, newTarget) {
      const [options, ...rest] = args;
      const patchedOptions = patchBrowserWindowOptions(electron, fs, path, options);
      return Reflect.construct(
        target,
        [patchedOptions, ...rest],
        newTarget === patchedBrowserWindow ? target : newTarget,
      );
    },
  });

  Object.defineProperty(patchedBrowserWindow, PATCH_MARKER, {
    value: true,
  });

  electron.BrowserWindow = patchedBrowserWindow;
  patchedElectron = electron;
  logInfo(api, "Compact Windows titlebar BrowserWindow preload patch installed");
  return true;
}

module.exports = {
  start(api = {}) {
    const platform = api.platform || process.platform;
    if (platform !== "win32") {
      return;
    }

    try {
      const electron = require("electron");
      const fs = require("node:fs");
      const path = require("node:path");
      installBrowserWindowPatch(electron, fs, path, api);
    } catch (error) {
      logWarn(api, "Compact Windows titlebar tweak failed to start", error);
    }
  },

  stop() {
    if (
      patchedElectron &&
      patchedBrowserWindow &&
      patchedElectron.BrowserWindow === patchedBrowserWindow
    ) {
      patchedElectron.BrowserWindow = originalBrowserWindow;
    }

    patchedElectron = null;
    originalBrowserWindow = null;
    patchedBrowserWindow = null;
  },
};

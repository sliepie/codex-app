/* eslint-disable */
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const fallbackOriginalMain = "recovered/app-asar-extracted/.vite/build/bootstrap.js";
const packagedRoot = path.join(__dirname, "..");
const originalMain = readPackagedOriginalMain();
const runtimeDir = path.join(__dirname, "runtime");
const preloadPath = path.join(runtimeDir, "preload.js");
const bundledTweaksDir = path.join(__dirname, "tweaks");
const bundledPluginsDir = path.join(packagedRoot, "resources", "plugins");
const userRoot = resolveUserRoot();
const codexHome = resolveCodexHome();
const configFile = path.join(userRoot, "config.json");
const logFile = path.join(userRoot, "log", "loader.log");
const maxLogBytes = 10 * 1024 * 1024;
const retainedLogBytes = 5 * 1024 * 1024;
const bundledMarketplaceNames = ["openai-bundled", "openai-bundled-beta"];
const browserPluginName = "browser";

function resolveUserRoot() {
  const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
  return path.join(appData, "codex-plusplus");
}

function resolveCodexHome() {
  if (process.env.CODEX_HOME && process.env.CODEX_HOME.trim()) {
    return process.env.CODEX_HOME;
  }
  return path.join(os.homedir(), ".codex");
}

function readPackagedOriginalMain() {
  try {
    const packageJson = readJson(path.join(packagedRoot, "package.json"));
    const configured = packageJson && packageJson.__codexpp && packageJson.__codexpp.originalMain;
    if (typeof configured === "string" && configured.trim()) {
      return configured.trim().replace(/\\/g, "/").replace(/^\.\//, "");
    }
  } catch {
    // Fall back to the historical recovered bootstrap path.
  }

  return fallbackOriginalMain;
}

function appendCappedLog(filePath, message) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  try {
    const size = fs.statSync(filePath).size;
    const messageBytes = Buffer.byteLength(message, "utf8");
    if (size + messageBytes > maxLogBytes) {
      trimLogToRetainedBytes(filePath, size);
    }
  } catch {
    // Missing or unreadable logs are recreated by appendFileSync below.
  }

  fs.appendFileSync(filePath, message, "utf8");
  try {
    const size = fs.statSync(filePath).size;
    if (size > maxLogBytes) {
      trimLogToRetainedBytes(filePath, size);
    }
  } catch {
    // Log trimming is best-effort only.
  }
}

function trimLogToRetainedBytes(filePath, size) {
  const bytesToRead = Math.min(retainedLogBytes, size);
  const buffer = Buffer.allocUnsafe(bytesToRead);
  let fd;
  try {
    fd = fs.openSync(filePath, "r");
    const bytesRead = fs.readSync(
      fd,
      buffer,
      0,
      bytesToRead,
      Math.max(0, size - bytesToRead),
    );
    fs.writeFileSync(filePath, buffer.subarray(0, bytesRead));
  } finally {
    if (fd !== undefined) {
      fs.closeSync(fd);
    }
  }
}

function log(label, error) {
  try {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    appendCappedLog(logFile, `[${new Date().toISOString()}] ${label}: ${message}\n`);
  } catch {
    // Last resort only; the app must keep launching even if Codex++ setup fails.
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function versionParts(version) {
  return String(version ?? "")
    .split(".")
    .map((part) => (/^\d+$/.test(part) ? Number(part) : Number.NaN));
}

function compareVersions(left, right) {
  const leftParts = versionParts(left);
  const rightParts = versionParts(right);
  if (leftParts.some(Number.isNaN) || rightParts.some(Number.isNaN)) {
    return String(left ?? "").localeCompare(String(right ?? ""), undefined, {
      numeric: true,
      sensitivity: "base",
    });
  }

  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const leftValue = leftParts[index] ?? 0;
    const rightValue = rightParts[index] ?? 0;
    if (leftValue !== rightValue) {
      return leftValue > rightValue ? 1 : -1;
    }
  }

  return 0;
}

function bundledVersionIsNewer(bundledVersion, installedVersion) {
  return compareVersions(bundledVersion, installedVersion) > 0;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isSafeTweakId(id) {
  return typeof id === "string" && /^[A-Za-z0-9._-]+$/.test(id) && id !== "." && id !== "..";
}

function isSafeCacheSegment(value) {
  return (
    typeof value === "string" &&
    /^[A-Za-z0-9._-]+$/.test(value) &&
    value !== "." &&
    value !== ".."
  );
}

function isPathInside(parentPath, childPath) {
  const relativePath = path.relative(path.resolve(parentPath), path.resolve(childPath));
  return (
    relativePath === "" ||
    (relativePath !== ".." &&
      !relativePath.startsWith(".." + path.sep) &&
      !path.isAbsolute(relativePath))
  );
}

function assertBundledManifest(manifest, entryName) {
  if (!isPlainObject(manifest)) {
    throw new Error("Expected object in bundled tweak manifest for " + entryName);
  }
  if (!isSafeTweakId(manifest.id)) {
    throw new Error("Invalid bundled tweak id for " + entryName + ": " + String(manifest.id));
  }
  if (typeof manifest.version !== "string" || !manifest.version.trim()) {
    throw new Error("Invalid bundled tweak version for " + manifest.id);
  }
}

function assertBundledBrowserPluginManifest(manifest, sourceDir) {
  if (!isPlainObject(manifest)) {
    throw new Error("Expected object in bundled Browser plugin manifest for " + sourceDir);
  }
  if (manifest.name !== browserPluginName) {
    throw new Error(
      "Invalid bundled Browser plugin name for " + sourceDir + ": " + String(manifest.name),
    );
  }
  if (!isSafeCacheSegment(manifest.version)) {
    throw new Error(
      "Invalid bundled Browser plugin version for " +
        sourceDir +
        ": " +
        String(manifest.version),
    );
  }
}

function resolveBundledPluginSourcePath(marketplaceRoot, relativeSourcePath) {
  if (typeof relativeSourcePath !== "string" || !relativeSourcePath.trim()) {
    throw new Error("Bundled Browser plugin source path is empty.");
  }
  if (path.isAbsolute(relativeSourcePath)) {
    throw new Error("Bundled Browser plugin source path must be relative: " + relativeSourcePath);
  }

  const resolvedPath = path.resolve(marketplaceRoot, relativeSourcePath);
  if (!isPathInside(marketplaceRoot, resolvedPath)) {
    throw new Error("Bundled Browser plugin source path escapes its root: " + relativeSourcePath);
  }

  return resolvedPath;
}

function findBundledBrowserPluginSource() {
  for (const marketplaceName of bundledMarketplaceNames) {
    const marketplaceRoot = path.join(bundledPluginsDir, marketplaceName);
    const marketplacePath = path.join(marketplaceRoot, ".agents", "plugins", "marketplace.json");
    if (!fs.existsSync(marketplacePath)) {
      continue;
    }

    const marketplace = readJson(marketplacePath);
    if (!Array.isArray(marketplace.plugins)) {
      throw new Error("Bundled plugin marketplace does not list plugins: " + marketplacePath);
    }

    const plugin = marketplace.plugins.find(
      (candidate) => isPlainObject(candidate) && candidate.name === browserPluginName,
    );
    if (!plugin) {
      return null;
    }

    const source = plugin.source;
    if (!isPlainObject(source) || source.source !== "local" || typeof source.path !== "string") {
      throw new Error("Bundled Browser plugin must use a local source path in " + marketplacePath);
    }

    return {
      marketplaceName,
      sourceDir: resolveBundledPluginSourcePath(marketplaceRoot, source.path),
    };
  }

  return null;
}

function cachedBrowserPluginIsCurrent(targetDir, expectedVersion) {
  const manifestPath = path.join(targetDir, ".codex-plugin", "plugin.json");
  if (!fs.existsSync(manifestPath)) {
    return false;
  }

  try {
    const manifest = readJson(manifestPath);
    return manifest.name === browserPluginName && manifest.version === expectedVersion;
  } catch {
    return false;
  }
}

function syncBundledBrowserPluginCache() {
  if (!fs.existsSync(bundledPluginsDir)) {
    return;
  }

  const source = findBundledBrowserPluginSource();
  if (!source) {
    return;
  }

  const manifestPath = path.join(source.sourceDir, ".codex-plugin", "plugin.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error("Missing bundled Browser plugin manifest: " + manifestPath);
  }

  const manifest = readJson(manifestPath);
  assertBundledBrowserPluginManifest(manifest, source.sourceDir);

  const targetDir = path.join(
    codexHome,
    "plugins",
    "cache",
    source.marketplaceName,
    browserPluginName,
    manifest.version,
  );
  if (cachedBrowserPluginIsCurrent(targetDir, manifest.version)) {
    return;
  }

  installBundledDirectory(source.sourceDir, targetDir);
}

function readConfigOrEmpty() {
  if (!fs.existsSync(configFile)) {
    return {};
  }

  try {
    const config = readJson(configFile);
    return isPlainObject(config) ? config : {};
  } catch {
    return {};
  }
}

function uniqueSiblingPath(filePath, suffix) {
  const candidate = filePath + suffix;
  if (!fs.existsSync(candidate)) {
    return candidate;
  }

  for (let index = 1; index < 100; index += 1) {
    const indexedCandidate = candidate + "." + index;
    if (!fs.existsSync(indexedCandidate)) {
      return indexedCandidate;
    }
  }

  return candidate + "." + process.pid + "-" + Date.now();
}

function moveInvalidConfigAside(error) {
  const invalidConfigPath = uniqueSiblingPath(configFile, ".invalid");
  try {
    fs.renameSync(configFile, invalidConfigPath);
    log("codex-plusplus config read failed", String(error) + "; moved invalid config to " + invalidConfigPath);
    return true;
  } catch (moveError) {
    log("codex-plusplus invalid config quarantine failed", moveError);
    return false;
  }
}

function isCodexPlusPlusSafeModeEnabled() {
  return readConfigOrEmpty().codexPlusPlus?.safeMode === true;
}

function disableCodexPlusPlusAutoUpdate() {
  let config = {};
  if (fs.existsSync(configFile)) {
    try {
      config = readJson(configFile);
    } catch (error) {
      moveInvalidConfigAside(error);
      config = {};
    }
  }

  if (!config || typeof config !== "object" || Array.isArray(config)) {
    log("codex-plusplus config shape is invalid", "Expected object in config.json");
    config = {};
  }

  let codexPlusPlusConfig = config.codexPlusPlus;
  if (
    codexPlusPlusConfig &&
    (typeof codexPlusPlusConfig !== "object" || Array.isArray(codexPlusPlusConfig))
  ) {
    log("codex-plusplus config shape is invalid", "Expected object in config.codexPlusPlus");
    codexPlusPlusConfig = {};
  }

  if (codexPlusPlusConfig && codexPlusPlusConfig.autoUpdate === false) {
    return;
  }

  config.codexPlusPlus = {
    ...codexPlusPlusConfig,
    autoUpdate: false,
  };
  try {
    writeJson(configFile, config);
  } catch (error) {
    log("codex-plusplus config write failed", error);
  }
}

function copyDirectory(source, target) {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath);
      continue;
    }
    if (entry.isFile()) {
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

function replaceDirectoryFromStaging(stagingDir, targetDir) {
  const parentDir = path.dirname(targetDir);
  const backupDir = path.join(
    parentDir,
    "." + path.basename(targetDir) + ".old-" + process.pid + "-" + Date.now(),
  );

  try {
    if (fs.existsSync(targetDir)) {
      fs.renameSync(targetDir, backupDir);
    }
    fs.renameSync(stagingDir, targetDir);
    fs.rmSync(backupDir, { recursive: true, force: true });
  } catch (error) {
    if (!fs.existsSync(targetDir) && fs.existsSync(backupDir)) {
      try {
        fs.renameSync(backupDir, targetDir);
      } catch (restoreError) {
        log("codex-plusplus bundled tweak restore failed", restoreError);
      }
    }
    throw error;
  }
}

function installBundledDirectory(sourceDir, targetDir) {
  const parentDir = path.dirname(targetDir);
  const stagingDir = path.join(
    parentDir,
    "." + path.basename(targetDir) + ".tmp-" + process.pid + "-" + Date.now(),
  );

  fs.rmSync(stagingDir, { recursive: true, force: true });
  try {
    copyDirectory(sourceDir, stagingDir);
    replaceDirectoryFromStaging(stagingDir, targetDir);
  } finally {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }
}

function installBundledTweak(sourceDir, targetDir) {
  installBundledDirectory(sourceDir, targetDir);
}

function syncBundledTweaks() {
  const tweaksDir = path.join(userRoot, "tweaks");

  if (!fs.existsSync(bundledTweaksDir)) {
    return;
  }

  fs.mkdirSync(tweaksDir, { recursive: true });
  const bundledTweaks = [];

  for (const entry of fs.readdirSync(bundledTweaksDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    try {
      const sourceDir = path.join(bundledTweaksDir, entry.name);
      const manifestPath = path.join(sourceDir, "manifest.json");
      if (!fs.existsSync(manifestPath)) {
        log(
          "codex-plusplus bundled tweak discovery failed for " + entry.name,
          "Missing manifest.json",
        );
        continue;
      }

      const manifest = readJson(manifestPath);
      assertBundledManifest(manifest, entry.name);
      bundledTweaks.push({ entry, manifest });
    } catch (error) {
      log("codex-plusplus bundled tweak discovery failed for " + entry.name, error);
    }
  }

  for (const { entry, manifest } of bundledTweaks) {
    try {
      syncBundledTweak(entry, manifest, tweaksDir);
    } catch (error) {
      log("codex-plusplus bundled tweak sync failed for " + entry.name, error);
    }
  }
}

function syncBundledTweak(entry, manifest, tweaksDir) {
  const sourceDir = path.join(bundledTweaksDir, entry.name);
  const targetDir = path.join(tweaksDir, manifest.id);

  if (fs.existsSync(targetDir)) {
    const installedVersion = readInstalledTweakVersion(targetDir, manifest.id);
    if (!installedVersion || !bundledVersionIsNewer(manifest.version, installedVersion)) {
      return;
    }
  }

  installBundledTweak(sourceDir, targetDir);
}

function readInstalledTweakVersion(targetDir, expectedId) {
  const manifestPath = path.join(targetDir, "manifest.json");
  if (fs.existsSync(manifestPath)) {
    const manifest = readJson(manifestPath);
    if (
      isPlainObject(manifest) &&
      manifest.id === expectedId &&
      typeof manifest.version === "string" &&
      manifest.version.trim() !== ""
    ) {
      return manifest.version;
    }
  }

  return null;
}

function runStartupStep(label, fn) {
  try {
    return fn();
  } catch (error) {
    log(label, error);
    return undefined;
  }
}

function registerPreload(session, label) {
  try {
    const registerPreloadScript = session.registerPreloadScript;
    if (typeof registerPreloadScript === "function") {
      registerPreloadScript.call(session, {
        type: "frame",
        filePath: preloadPath,
        id: "codex-plusplus",
      });
      return;
    }

    if (typeof session.getPreloads === "function" && typeof session.setPreloads === "function") {
      const existing = session.getPreloads();
      if (!existing.includes(preloadPath)) {
        session.setPreloads([...existing, preloadPath]);
      }
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("existing ID")) {
      return;
    }
    log("codex-plusplus early preload registration failed for " + label, error);
  }
}

function registerEarlyPreloadHooks() {
  let electron;
  try {
    electron = require("electron");
  } catch {
    return;
  }

  const app = electron && electron.app;
  const session = electron && electron.session;
  if (!app || !session) {
    return;
  }

  if (typeof app.whenReady === "function") {
    app
      .whenReady()
      .then(() => {
        if (!isCodexPlusPlusSafeModeEnabled() && session.defaultSession) {
          registerPreload(session.defaultSession, "defaultSession");
        }
      })
      .catch((error) => log("codex-plusplus early preload ready hook failed", error));
  }

  if (typeof app.on === "function") {
    app.on("session-created", (createdSession) => {
      if (!isCodexPlusPlusSafeModeEnabled()) {
        registerPreload(createdSession, "session-created");
      }
    });
  }
}

function startCodexPlusPlusIntegration() {
  runStartupStep("codex-plusplus user root setup failed", () => {
    fs.mkdirSync(userRoot, { recursive: true });
  });
  runStartupStep("codex-plusplus bundled tweak sync failed", syncBundledTweaks);
  runStartupStep("codex-plusplus config update failed", disableCodexPlusPlusAutoUpdate);
  process.env.CODEX_PLUSPLUS_USER_ROOT = userRoot;
  process.env.CODEX_PLUSPLUS_RUNTIME = runtimeDir;
  runStartupStep("codex-plusplus runtime startup failed", () => {
    require(path.join(runtimeDir, "main.js"));
  });
}

function scheduleCodexPlusPlusIntegration() {
  if (typeof setImmediate === "function") {
    setImmediate(startCodexPlusPlusIntegration);
    return;
  }
  setTimeout(startCodexPlusPlusIntegration, 0);
}

process.env.CODEX_PLUSPLUS_USER_ROOT = userRoot;
process.env.CODEX_PLUSPLUS_RUNTIME = runtimeDir;
runStartupStep("codex-plusplus bundled Browser plugin cache sync failed", syncBundledBrowserPluginCache);
registerEarlyPreloadHooks();
require(path.join(packagedRoot, originalMain));
scheduleCodexPlusPlusIntegration();

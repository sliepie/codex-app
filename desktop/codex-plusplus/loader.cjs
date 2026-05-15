/* eslint-disable */
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const originalMain = "recovered/app-asar-extracted/.vite/build/bootstrap.js";
const runtimeDir = path.join(__dirname, "runtime");
const bundledTweaksDir = path.join(__dirname, "tweaks");
const userRoot = resolveUserRoot();
const configFile = path.join(userRoot, "config.json");
const logFile = path.join(userRoot, "log", "loader.log");

function resolveUserRoot() {
  const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
  return path.join(appData, "codex-plusplus");
}

function log(label, error) {
  try {
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    const message = error instanceof Error ? error.stack || error.message : String(error);
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${label}: ${message}\n`, "utf8");
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

function disableCodexPlusPlusAutoUpdate() {
  let config = {};
  if (fs.existsSync(configFile)) {
    try {
      config = readJson(configFile);
    } catch (error) {
      log("codex-plusplus config read failed", error);
      return;
    }
  }

  if (!config || typeof config !== "object" || Array.isArray(config)) {
    log("codex-plusplus config shape is invalid", "Expected object in config.json");
    return;
  }

  config.codexPlusPlus = {
    ...config.codexPlusPlus,
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

function syncBundledTweaks() {
  if (!fs.existsSync(bundledTweaksDir)) {
    return;
  }

  const tweaksDir = path.join(userRoot, "tweaks");
  fs.mkdirSync(tweaksDir, { recursive: true });

  for (const entry of fs.readdirSync(bundledTweaksDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const sourceDir = path.join(bundledTweaksDir, entry.name);
    const manifestPath = path.join(sourceDir, "manifest.json");
    if (!fs.existsSync(manifestPath)) {
      continue;
    }

    const manifest = readJson(manifestPath);
    const targetDir = path.join(tweaksDir, manifest.id || entry.name);
    const markerPath = path.join(targetDir, ".codex-app-bundled-tweak.json");
    const marker = {
      source: "codex-app",
      id: manifest.id,
      version: manifest.version,
    };

    if (fs.existsSync(targetDir)) {
      if (!fs.existsSync(markerPath)) {
        continue;
      }
      const current = readJson(markerPath);
      if (!bundledVersionIsNewer(marker.version, current.version)) {
        continue;
      }
      fs.rmSync(targetDir, { recursive: true, force: true });
    }

    copyDirectory(sourceDir, targetDir);
    writeJson(markerPath, marker);
  }
}

try {
  fs.mkdirSync(userRoot, { recursive: true });
  syncBundledTweaks();
  disableCodexPlusPlusAutoUpdate();
  process.env.CODEX_PLUSPLUS_USER_ROOT = userRoot;
  process.env.CODEX_PLUSPLUS_RUNTIME = runtimeDir;
  require(path.join(runtimeDir, "main.js"));
} catch (error) {
  log("codex-plusplus integrated startup failed", error);
}

require(path.join(__dirname, "..", originalMain));

/* eslint-disable */
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const chromeNativeHostName = "com.openai.codexextension";
const chromeNativeHostRegistryKey =
  "HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\" + chromeNativeHostName;

function resolveChromeNativeHostManifestPath(
  environment = process.env,
  homeDirectory = os.homedir(),
) {
  const localAppData =
    environment.LOCALAPPDATA || path.join(homeDirectory, "AppData", "Local");
  return path.join(
    localAppData,
    "OpenAI",
    "extension",
    `${chromeNativeHostName}.json`,
  );
}

function registerChromeNativeHost({
  platform = process.platform,
  manifestPath = resolveChromeNativeHostManifestPath(),
  exists = fs.existsSync,
  readFile = fs.readFileSync,
  runRegistryCommand = execFileSync,
} = {}) {
  if (platform !== "win32") {
    return "skipped";
  }
  if (!exists(manifestPath)) {
    return "manifest-missing";
  }

  let manifest;
  try {
    manifest = JSON.parse(readFile(manifestPath, "utf8"));
  } catch {
    return "manifest-invalid";
  }

  if (
    !manifest ||
    typeof manifest !== "object" ||
    Array.isArray(manifest) ||
    manifest.name !== chromeNativeHostName ||
    manifest.type !== "stdio" ||
    typeof manifest.path !== "string" ||
    !path.isAbsolute(manifest.path) ||
    !exists(manifest.path)
  ) {
    return "host-missing";
  }

  runRegistryCommand(
    "reg.exe",
    [
      "add",
      chromeNativeHostRegistryKey,
      "/ve",
      "/t",
      "REG_SZ",
      "/d",
      manifestPath,
      "/f",
    ],
    { stdio: "ignore", windowsHide: true },
  );
  return "registered";
}

module.exports = {
  chromeNativeHostName,
  chromeNativeHostRegistryKey,
  registerChromeNativeHost,
  resolveChromeNativeHostManifestPath,
};

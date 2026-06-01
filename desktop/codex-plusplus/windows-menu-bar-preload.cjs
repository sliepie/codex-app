"use strict";

const CHANNEL = "codexpp:windows-menu-bar-enabled";
const WRAPPED_MARKER = Symbol.for("codex-app.windows-menu-bar.context-bridge");

function withoutApplicationMenuBridge(name, api) {
  if (name !== "electronBridge" || !api || typeof api !== "object") {
    return api;
  }

  const nextApi = { ...api };
  delete nextApi.showApplicationMenu;
  return nextApi;
}

function windowsMenuBarTweakEnabled(ipcRenderer) {
  if (!ipcRenderer || typeof ipcRenderer.sendSync !== "function") {
    return false;
  }

  try {
    return ipcRenderer.sendSync(CHANNEL) === true;
  } catch {
    return false;
  }
}

function installWindowsMenuBarBridge() {
  const electron = require("electron");
  if (!windowsMenuBarTweakEnabled(electron && electron.ipcRenderer)) {
    return;
  }

  const contextBridge = electron && electron.contextBridge;
  const originalExposeInMainWorld = contextBridge && contextBridge.exposeInMainWorld;
  if (typeof originalExposeInMainWorld !== "function" || originalExposeInMainWorld[WRAPPED_MARKER]) {
    return;
  }

  const wrappedExposeInMainWorld = function exposeWindowsMenuBarBridge(name, api, ...rest) {
    return originalExposeInMainWorld.call(this, name, withoutApplicationMenuBridge(name, api), ...rest);
  };
  Object.defineProperty(wrappedExposeInMainWorld, WRAPPED_MARKER, {
    value: true,
  });

  contextBridge.exposeInMainWorld = wrappedExposeInMainWorld;
}

installWindowsMenuBarBridge();

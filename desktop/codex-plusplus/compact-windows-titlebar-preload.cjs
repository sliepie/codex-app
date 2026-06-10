"use strict";

const CHANNEL = "codexpp:compact-windows-titlebar-enabled";
const WRAPPED_MARKER = Symbol.for("codex-app.compact-windows-titlebar.context-bridge");

function compactElectronBridge(name, api) {
  if (name !== "electronBridge" || !api || typeof api !== "object") {
    return api;
  }

  const compactApi = { ...api };
  delete compactApi.showApplicationMenu;
  return compactApi;
}

function compactTitlebarEnabled(ipcRenderer) {
  if (!ipcRenderer || typeof ipcRenderer.sendSync !== "function") {
    return false;
  }

  try {
    return ipcRenderer.sendSync(CHANNEL) === true;
  } catch {
    return false;
  }
}

function installCompactTitlebarBridge() {
  const electron = require("electron");
  if (!compactTitlebarEnabled(electron && electron.ipcRenderer)) {
    return;
  }

  const contextBridge = electron && electron.contextBridge;
  const originalExposeInMainWorld = contextBridge && contextBridge.exposeInMainWorld;
  if (typeof originalExposeInMainWorld !== "function" || originalExposeInMainWorld[WRAPPED_MARKER]) {
    return;
  }

  const wrappedExposeInMainWorld = function exposeCompactTitlebarBridge(name, api, ...rest) {
    return originalExposeInMainWorld.call(this, name, compactElectronBridge(name, api), ...rest);
  };
  Object.defineProperty(wrappedExposeInMainWorld, WRAPPED_MARKER, {
    value: true,
  });

  contextBridge.exposeInMainWorld = wrappedExposeInMainWorld;
}

installCompactTitlebarBridge();

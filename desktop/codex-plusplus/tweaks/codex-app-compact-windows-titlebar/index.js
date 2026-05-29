const RESERVED_WINDOWS_CONTROLS_WIDTH = 138;
const STYLE_ID = "codex-app-compact-windows-titlebar-style";

function logInfo(api, message) {
  if (typeof api?.log?.info === "function") {
    api.log.info(message);
  }
}

function installStyle() {
  const styleText = `
:root[data-codex-window-type="electron"][data-codex-os="win32"] header.app-header-tint {
  background: transparent !important;
  padding-inline-end: max(var(--spacing-token-safe-header-right, 0px), ${RESERVED_WINDOWS_CONTROLS_WIDTH}px) !important;
}
:root[data-codex-window-type="electron"][data-codex-os="win32"] .main-surface {
  background: linear-gradient(to bottom, transparent 0 var(--height-toolbar), var(--color-token-main-surface-primary) var(--height-toolbar) 100%) !important;
}
`.trim();

  const existingStyle = document.getElementById(STYLE_ID);
  if (existingStyle) {
    existingStyle.textContent = styleText;
    return;
  }

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = styleText;
  document.head.appendChild(style);
}

module.exports = {
  start(api = {}) {
    installStyle();
    logInfo(api, "Compact Windows titlebar preload hook is active after restart or window reload");
  },

  stop() {
    document.getElementById(STYLE_ID)?.remove();
  },
};

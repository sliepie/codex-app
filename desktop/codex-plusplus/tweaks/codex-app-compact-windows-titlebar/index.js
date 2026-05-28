const STYLE_ID = "codex-app-compact-windows-titlebar-style";
const CONTROLS_HOST_ID = "codex-app-compact-windows-titlebar-controls";

const WINDOWS_TOP_BAR_SELECTOR = ".app-header-tint.group\\/windows-top-bar";
const APP_HEADER_SELECTOR =
  ".app-header-tint.draggable.pointer-events-none.fixed.h-toolbar:not(.group\\/windows-top-bar)";
const APP_HEADER_CONTEXT_SELECTOR =
  APP_HEADER_SELECTOR + ' [data-testid="app-shell-header-context-menu-surface"]';
const MAIN_CONTENT_VIEWPORT_SELECTOR = ".app-shell-main-content-viewport";

const HIDDEN_DISPLAY_DECLARATIONS = "display:none!important;";
const TITLEBAR_TINT_DECLARATIONS =
  "background-color:var(--codex-titlebar-tint,transparent)!important;";
const COMPACT_HEADER_DECLARATIONS =
  "top:0!important;height:var(--height-toolbar-sm)!important;" +
  "z-index:50!important;" +
  TITLEBAR_TINT_DECLARATIONS;
const COMPACT_HEADER_CONTEXT_DECLARATIONS =
  "height:var(--height-toolbar-sm)!important;";
const COMPACT_MAIN_CONTENT_DECLARATIONS =
  "--app-shell-main-content-frame-top-offset:var(--height-toolbar-sm)!important;";
const COMPACT_CONTROLS_HOST_DECLARATIONS =
  "position:fixed!important;top:0!important;left:0.5rem!important;" +
  "height:var(--height-toolbar-sm)!important;z-index:70!important;" +
  "display:flex!important;align-items:center!important;pointer-events:auto!important;";
const COMPACT_CONTROLS_DECLARATIONS =
  "height:var(--height-toolbar-sm)!important;display:flex!important;align-items:center!important;";

let movedControls = null;
let originalControlsParent = null;
let originalControlsNextSibling = null;
let titlebarObserver = null;

function cssRule(selectors, declarations) {
  const selector = Array.isArray(selectors) ? selectors.join(",") : selectors;
  return selector + "{" + declarations + "}";
}

const STYLE_RULES = [
  cssRule(WINDOWS_TOP_BAR_SELECTOR, HIDDEN_DISPLAY_DECLARATIONS),
  cssRule("#" + CONTROLS_HOST_ID, COMPACT_CONTROLS_HOST_DECLARATIONS),
  cssRule("#" + CONTROLS_HOST_ID + ">*", COMPACT_CONTROLS_DECLARATIONS),
  cssRule(
    [
      APP_HEADER_SELECTOR,
      APP_HEADER_SELECTOR + '[data-app-shell-header-edge-scroll="true"]',
    ],
    TITLEBAR_TINT_DECLARATIONS,
  ),
  cssRule(APP_HEADER_SELECTOR, COMPACT_HEADER_DECLARATIONS),
  cssRule(APP_HEADER_CONTEXT_SELECTOR, COMPACT_HEADER_CONTEXT_DECLARATIONS),
  cssRule(MAIN_CONTENT_VIEWPORT_SELECTOR, COMPACT_MAIN_CONTENT_DECLARATIONS),
];

function findWindowsTopBarLeftControls(topBar) {
  return (
    Array.from(topBar?.children || []).find((child) => {
      if (!child?.querySelector?.("button")) {
        return false;
      }

      return !child.querySelector?.('button[aria-haspopup="menu"][aria-expanded]');
    }) || null
  );
}

function installStyle() {
  const existingStyle = document.getElementById(STYLE_ID);
  if (existingStyle) {
    existingStyle.textContent = STYLE_RULES.join("\n");
    return;
  }

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = STYLE_RULES.join("\n");
  document.head.appendChild(style);
}

function ensureControlsHost() {
  let host = document.getElementById(CONTROLS_HOST_ID);
  if (host) {
    return host;
  }

  host = document.createElement("div");
  host.id = CONTROLS_HOST_ID;
  host.setAttribute("aria-hidden", "false");
  document.body?.appendChild(host);
  return host;
}

function moveLeftControlsIntoCompactTitlebar() {
  const topBar = document.querySelector?.(WINDOWS_TOP_BAR_SELECTOR);
  const controls = movedControls || findWindowsTopBarLeftControls(topBar);

  if (!topBar || !controls) {
    return;
  }

  const host = ensureControlsHost();
  if (!host || controls.parentElement === host) {
    return;
  }

  if (!movedControls) {
    originalControlsParent = controls.parentElement;
    originalControlsNextSibling = controls.nextSibling;
    movedControls = controls;
  }

  host.appendChild(controls);
}

function restoreMovedControls() {
  titlebarObserver?.disconnect();
  titlebarObserver = null;

  document.getElementById(CONTROLS_HOST_ID)?.remove();

  if (movedControls && originalControlsParent) {
    originalControlsParent.insertBefore(
      movedControls,
      originalControlsNextSibling || null,
    );
  }

  movedControls = null;
  originalControlsParent = null;
  originalControlsNextSibling = null;
}

function installCompactTitlebarControls() {
  moveLeftControlsIntoCompactTitlebar();

  if (typeof MutationObserver !== "function") {
    return;
  }

  titlebarObserver?.disconnect();
  titlebarObserver = new MutationObserver(() => {
    moveLeftControlsIntoCompactTitlebar();
  });
  titlebarObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

module.exports = {
  start() {
    installStyle();
    installCompactTitlebarControls();
  },

  stop() {
    restoreMovedControls();
    document.getElementById(STYLE_ID)?.remove();
  },
};

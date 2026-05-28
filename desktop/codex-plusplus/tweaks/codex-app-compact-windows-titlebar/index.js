const STYLE_ID = "codex-app-compact-windows-titlebar-style";

const WINDOWS_MENU_ROW_SELECTOR =
  '.group\\/windows-top-bar>.flex.items-center.gap-0\\.5.pr-2.pl-1:has(>button[aria-haspopup="menu"][aria-expanded])';
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
  "top:0!important;height:var(--height-toolbar-sm)!important;z-index:50!important;" +
  TITLEBAR_TINT_DECLARATIONS;
const COMPACT_HEADER_CONTEXT_DECLARATIONS =
  "height:var(--height-toolbar-sm)!important;";
const COMPACT_MAIN_CONTENT_DECLARATIONS =
  "--app-shell-main-content-frame-top-offset:var(--height-toolbar-sm)!important;";

function cssRule(selectors, declarations) {
  const selector = Array.isArray(selectors) ? selectors.join(",") : selectors;
  return selector + "{" + declarations + "}";
}

const STYLE_RULES = [
  cssRule(WINDOWS_MENU_ROW_SELECTOR, HIDDEN_DISPLAY_DECLARATIONS),
  cssRule(
    [
      WINDOWS_TOP_BAR_SELECTOR,
      APP_HEADER_SELECTOR,
      APP_HEADER_SELECTOR + '[data-app-shell-header-edge-scroll="true"]',
    ],
    TITLEBAR_TINT_DECLARATIONS,
  ),
  cssRule(APP_HEADER_SELECTOR, COMPACT_HEADER_DECLARATIONS),
  cssRule(APP_HEADER_CONTEXT_SELECTOR, COMPACT_HEADER_CONTEXT_DECLARATIONS),
  cssRule(MAIN_CONTENT_VIEWPORT_SELECTOR, COMPACT_MAIN_CONTENT_DECLARATIONS),
];

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

module.exports = {
  start() {
    installStyle();
  },

  stop() {
    document.getElementById(STYLE_ID)?.remove();
  },
};

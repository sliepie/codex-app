const STYLE_ID = "codex-app-windows-menu-bar-style";

const WINDOWS_MENU_TOP_BAR_SELECTOR = ".group\\/application-menu-top-bar";
const WINDOWS_MENU_ROW_SELECTOR =
  `${WINDOWS_MENU_TOP_BAR_SELECTOR}>div:has(>button[aria-haspopup="menu"][aria-expanded])`;
const WINDOWS_MENU_BAR_HIDDEN_ATTRIBUTE =
  "data-codex-app-ui-hide-windows-menu-bar";
const WINDOWS_MENU_TOP_BAR_HIDDEN_SELECTOR =
  `:root[${WINDOWS_MENU_BAR_HIDDEN_ATTRIBUTE}="true"] ${WINDOWS_MENU_TOP_BAR_SELECTOR}`;
const WINDOWS_MENU_ROW_HIDDEN_SELECTOR =
  `:root[${WINDOWS_MENU_BAR_HIDDEN_ATTRIBUTE}="true"] ${WINDOWS_MENU_ROW_SELECTOR}`;
const LOWER_APP_HEADER_SELECTOR =
  ".app-header-tint.draggable.pointer-events-none.fixed.z-30.flex.h-toolbar.min-w-0.items-center.right-0.top-toolbar-sm";
const LOWER_APP_HEADER_HIDDEN_MENU_SELECTOR =
  `:root[${WINDOWS_MENU_BAR_HIDDEN_ATTRIBUTE}="true"] ${LOWER_APP_HEADER_SELECTOR}`;
const RIGHT_HEADER_SLOT_SELECTOR =
  `${LOWER_APP_HEADER_SELECTOR}>[data-testid="app-shell-header-context-menu-surface"]~[data-test-id="header-shell-slot"]`;
const RIGHT_HEADER_SLOT_HIDDEN_MENU_SELECTOR =
  `:root[${WINDOWS_MENU_BAR_HIDDEN_ATTRIBUTE}="true"] ${RIGHT_HEADER_SLOT_SELECTOR}`;
const EMPTY_LOWER_APP_HEADER_SELECTOR =
  `${LOWER_APP_HEADER_SELECTOR}:not(:has([data-testid="app-shell-header-context-menu-surface"]>*)):not(:has(.no-drag.pointer-events-auto))`;
const NON_SETTINGS_MAIN_SURFACE_SELECTOR =
  "main.main-surface:not(:has([data-settings-panel-slug]))";
const EMPTY_LOWER_APP_HEADER_HIDDEN_MENU_SELECTOR =
  `:root[${WINDOWS_MENU_BAR_HIDDEN_ATTRIBUTE}="true"] ${NON_SETTINGS_MAIN_SURFACE_SELECTOR}>${EMPTY_LOWER_APP_HEADER_SELECTOR}`;
const EMPTY_LOWER_APP_HEADER_MAIN_FRAME_SELECTOR =
  `:root[${WINDOWS_MENU_BAR_HIDDEN_ATTRIBUTE}="true"] ${NON_SETTINGS_MAIN_SURFACE_SELECTOR}:has(>${EMPTY_LOWER_APP_HEADER_SELECTOR}) .app-shell-main-content-frame`;
const LEFT_PANEL_SELECTOR = ".app-shell-left-panel";
const LEFT_PANEL_HIDDEN_MENU_SELECTOR =
  `:root[${WINDOWS_MENU_BAR_HIDDEN_ATTRIBUTE}="true"] ${LEFT_PANEL_SELECTOR}`;
const RIGHT_PANEL_SELECTOR =
  'aside[data-app-shell-focus-area="right-panel"]';
const RIGHT_PANEL_FILL_SELECTOR =
  `${RIGHT_PANEL_SELECTOR}>.absolute.inset-0.min-h-0.min-w-0.overflow-hidden`;
const RIGHT_PANEL_FILL_HIDDEN_MENU_SELECTOR =
  `:root[${WINDOWS_MENU_BAR_HIDDEN_ATTRIBUTE}="true"] ${RIGHT_PANEL_FILL_SELECTOR}`;
const RIGHT_PANEL_SURFACE_SELECTOR =
  `${RIGHT_PANEL_FILL_SELECTOR}>.absolute.top-0.bottom-0.left-0.min-w-0.bg-token-main-surface-primary`;
const RIGHT_PANEL_SURFACE_HIDDEN_MENU_SELECTOR =
  `:root[${WINDOWS_MENU_BAR_HIDDEN_ATTRIBUTE}="true"] ${RIGHT_PANEL_SURFACE_SELECTOR}`;
const WINDOWS_MENU_TOP_BAR_DECLARATIONS =
  "position:fixed!important;inset-inline-start:0!important;top:0!important;width:max-content!important;padding-inline-end:0!important;";
const WINDOWS_MENU_ROW_DECLARATIONS = "display:none!important;";
const LOWER_APP_HEADER_DECLARATIONS =
  "top:0!important;padding-inline-end:var(--spacing-token-safe-header-right)!important;";
const RIGHT_HEADER_SLOT_DECLARATIONS = "width:0!important;";
const EMPTY_LOWER_APP_HEADER_DECLARATIONS = "display:none!important;";
const EMPTY_LOWER_APP_HEADER_MAIN_FRAME_DECLARATIONS =
  "--app-shell-main-content-frame-top-offset:0px!important;border-top:0!important;";
const LEFT_PANEL_DECLARATIONS =
      "padding-top:30px!important;";
const RIGHT_PANEL_FILL_DECLARATIONS =
  "top:var(--height-toolbar)!important;";
const RIGHT_PANEL_SURFACE_DECLARATIONS =
  "border-top:0.5px solid var(--color-token-border-heavy)!important;";
function cssRule(selectors, declarations) {
  const selector = Array.isArray(selectors) ? selectors.join(",") : selectors;
  return `${selector}{${declarations}}`;
}

const STYLE_RULES = [
  cssRule(
    WINDOWS_MENU_TOP_BAR_HIDDEN_SELECTOR,
    WINDOWS_MENU_TOP_BAR_DECLARATIONS,
  ),
  cssRule(WINDOWS_MENU_ROW_HIDDEN_SELECTOR, WINDOWS_MENU_ROW_DECLARATIONS),
  cssRule(LOWER_APP_HEADER_HIDDEN_MENU_SELECTOR, LOWER_APP_HEADER_DECLARATIONS),
  cssRule(RIGHT_HEADER_SLOT_HIDDEN_MENU_SELECTOR, RIGHT_HEADER_SLOT_DECLARATIONS),
  cssRule(
    EMPTY_LOWER_APP_HEADER_HIDDEN_MENU_SELECTOR,
    EMPTY_LOWER_APP_HEADER_DECLARATIONS,
  ),
  cssRule(
    EMPTY_LOWER_APP_HEADER_MAIN_FRAME_SELECTOR,
    EMPTY_LOWER_APP_HEADER_MAIN_FRAME_DECLARATIONS,
  ),
  cssRule(LEFT_PANEL_HIDDEN_MENU_SELECTOR, LEFT_PANEL_DECLARATIONS),
  cssRule(
    RIGHT_PANEL_FILL_HIDDEN_MENU_SELECTOR,
    RIGHT_PANEL_FILL_DECLARATIONS,
  ),
  cssRule(
    RIGHT_PANEL_SURFACE_HIDDEN_MENU_SELECTOR,
    RIGHT_PANEL_SURFACE_DECLARATIONS,
  ),
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

function markWindowsMenuBarHidden() {
  document.documentElement?.setAttribute(
    WINDOWS_MENU_BAR_HIDDEN_ATTRIBUTE,
    "true",
  );
}

module.exports = {
  start() {
    markWindowsMenuBarHidden();
    installStyle();
  },

  stop() {
    document.documentElement?.removeAttribute(WINDOWS_MENU_BAR_HIDDEN_ATTRIBUTE);
    document.getElementById(STYLE_ID)?.remove();
  },
};

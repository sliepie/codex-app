const STYLE_ID = "codex-app-windows-menu-bar-style";

const WINDOWS_MENU_TOP_BAR_SELECTOR =
  "[class*='ApplicationMenuTopBar']";
const WINDOWS_MENU_ROW_SELECTOR =
  `${WINDOWS_MENU_TOP_BAR_SELECTOR}>div:has(>button[aria-haspopup="menu"][aria-expanded])`;
const WINDOWS_MENU_BAR_HIDDEN_ATTRIBUTE =
  "data-codex-app-ui-hide-windows-menu-bar";
const WINDOWS_MENU_TOP_BAR_HIDDEN_SELECTOR =
  `:root[${WINDOWS_MENU_BAR_HIDDEN_ATTRIBUTE}="true"] ${WINDOWS_MENU_TOP_BAR_SELECTOR}`;
const WINDOWS_NAVIGATION_GROUP_HIDDEN_SELECTOR =
  `${WINDOWS_MENU_TOP_BAR_HIDDEN_SELECTOR}>.flex.items-center.gap-1:has([data-app-shell-sidebar-trigger="true"])`;
const WINDOWS_MENU_ROW_HIDDEN_SELECTOR =
  `:root[${WINDOWS_MENU_BAR_HIDDEN_ATTRIBUTE}="true"] ${WINDOWS_MENU_ROW_SELECTOR}`;
const COLLAPSED_NEW_CHAT_ICON_SELECTOR =
  'svg path[d^="M6.33325 1.88379"]';
const LOWER_APP_HEADER_SELECTOR =
  "header[data-app-shell-application-menu-bar='true']";
const LOWER_APP_HEADER_HIDDEN_MENU_SELECTOR =
  `:root[${WINDOWS_MENU_BAR_HIDDEN_ATTRIBUTE}="true"] ${LOWER_APP_HEADER_SELECTOR}`;
const COLLAPSED_LOWER_APP_HEADER_SELECTOR =
  `${LOWER_APP_HEADER_HIDDEN_MENU_SELECTOR}:has(>[data-test-id="header-shell-slot"] ${COLLAPSED_NEW_CHAT_ICON_SELECTOR})`;
const COLLAPSED_HEADER_CONTEXT_SURFACE_SELECTOR =
  `${COLLAPSED_LOWER_APP_HEADER_SELECTOR}>[data-testid="app-shell-header-context-menu-surface"]`;
const COLLAPSED_NEW_CHAT_HEADER_SLOT_SELECTOR =
  `${COLLAPSED_LOWER_APP_HEADER_SELECTOR}>[data-test-id="header-shell-slot"]:has(${COLLAPSED_NEW_CHAT_ICON_SELECTOR})`;
const RIGHT_HEADER_SLOT_SELECTOR =
  `${LOWER_APP_HEADER_SELECTOR}>[data-testid="app-shell-header-context-menu-surface"]~[data-test-id="header-shell-slot"]`;
const RIGHT_HEADER_SLOT_HIDDEN_MENU_SELECTOR =
  `:root[${WINDOWS_MENU_BAR_HIDDEN_ATTRIBUTE}="true"] ${RIGHT_HEADER_SLOT_SELECTOR}`;
const EMPTY_LOWER_APP_HEADER_SELECTOR =
  `${LOWER_APP_HEADER_SELECTOR}:not(:has([data-testid="app-shell-header-context-menu-surface"]>*)):not(:has(.no-drag.pointer-events-auto))`;
const NON_SETTINGS_MAIN_SURFACE_SELECTOR =
  "main[data-app-shell-main-surface]:not(:has([data-settings-panel-slug]))";
const SETTINGS_MAIN_SURFACE_SELECTOR =
  `:root[${WINDOWS_MENU_BAR_HIDDEN_ATTRIBUTE}="true"] main[data-app-shell-main-surface="default"]:has([data-settings-panel-slug])`;
const PROFILE_MAIN_SURFACE_SELECTOR =
  `${SETTINGS_MAIN_SURFACE_SELECTOR}:has([data-settings-panel-slug="profile"][aria-current="page"])`;
const SETTINGS_RENDERER_HEADER_SELECTOR =
  `${SETTINGS_MAIN_SURFACE_SELECTOR} header[data-app-shell-application-menu-bar="false"]`;
const SETTINGS_CONTENT_LAYOUT_SELECTOR =
  `${SETTINGS_MAIN_SURFACE_SELECTOR} [data-app-shell-main-content-layout]`;
const SETTINGS_CONTENT_FRAME_SELECTOR =
  `${SETTINGS_MAIN_SURFACE_SELECTOR} [data-app-shell-thread-edge-divider]`;
const PROFILE_ACTION_GROUP_SELECTOR =
  `${PROFILE_MAIN_SURFACE_SELECTOR} :has(>button[aria-label="Share profile card"])`;
const EMPTY_LOWER_APP_HEADER_HIDDEN_MENU_SELECTOR =
  `:root[${WINDOWS_MENU_BAR_HIDDEN_ATTRIBUTE}="true"] ${NON_SETTINGS_MAIN_SURFACE_SELECTOR}>${EMPTY_LOWER_APP_HEADER_SELECTOR}`;
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
  "position:fixed!important;inset-inline-start:0!important;top:0!important;z-index:43!important;width:100%!important;height:var(--height-toolbar)!important;padding-inline-end:0!important;pointer-events:none!important;-webkit-app-region:drag!important;";
const WINDOWS_NAVIGATION_GROUP_DECLARATIONS =
  "pointer-events:auto!important;-webkit-app-region:no-drag!important;";
const WINDOWS_MENU_ROW_DECLARATIONS = "display:none!important;";
const LOWER_APP_HEADER_DECLARATIONS =
  "top:0!important;padding-inline-end:var(--spacing-token-safe-header-right)!important;";
const COLLAPSED_LOWER_APP_HEADER_DECLARATIONS =
  "left:calc(3 * var(--spacing-token-button-composer) + 2 * var(--spacing))!important;";
const COLLAPSED_HEADER_CONTEXT_SURFACE_DECLARATIONS =
  "margin-inline-start:5px!important;";
const COLLAPSED_NEW_CHAT_HEADER_SLOT_DECLARATIONS =
  "display:none!important;";
const RIGHT_HEADER_SLOT_DECLARATIONS = "width:0!important;";
const EMPTY_LOWER_APP_HEADER_DECLARATIONS = "display:none!important;";
const SETTINGS_RENDERER_HEADER_DECLARATIONS = "display:none!important;";
const SETTINGS_CONTENT_LAYOUT_DECLARATIONS =
  "--app-shell-main-content-frame-top-offset:0px!important;";
const SETTINGS_CONTENT_FRAME_DECLARATIONS = "border-top-width:0!important;";
const PROFILE_ACTION_GROUP_DECLARATIONS =
  "padding-inline-end:var(--spacing-token-safe-header-right)!important;";
const LEFT_PANEL_DECLARATIONS = "margin-top:34px!important;";
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
  cssRule(
    WINDOWS_NAVIGATION_GROUP_HIDDEN_SELECTOR,
    WINDOWS_NAVIGATION_GROUP_DECLARATIONS,
  ),
  cssRule(WINDOWS_MENU_ROW_HIDDEN_SELECTOR, WINDOWS_MENU_ROW_DECLARATIONS),
  cssRule(LOWER_APP_HEADER_HIDDEN_MENU_SELECTOR, LOWER_APP_HEADER_DECLARATIONS),
  cssRule(
    SETTINGS_RENDERER_HEADER_SELECTOR,
    SETTINGS_RENDERER_HEADER_DECLARATIONS,
  ),
  cssRule(
    SETTINGS_CONTENT_LAYOUT_SELECTOR,
    SETTINGS_CONTENT_LAYOUT_DECLARATIONS,
  ),
  cssRule(
    SETTINGS_CONTENT_FRAME_SELECTOR,
    SETTINGS_CONTENT_FRAME_DECLARATIONS,
  ),
  cssRule(PROFILE_ACTION_GROUP_SELECTOR, PROFILE_ACTION_GROUP_DECLARATIONS),
  cssRule(
    COLLAPSED_LOWER_APP_HEADER_SELECTOR,
    COLLAPSED_LOWER_APP_HEADER_DECLARATIONS,
  ),
  cssRule(
    COLLAPSED_HEADER_CONTEXT_SURFACE_SELECTOR,
    COLLAPSED_HEADER_CONTEXT_SURFACE_DECLARATIONS,
  ),
  cssRule(
    COLLAPSED_NEW_CHAT_HEADER_SLOT_SELECTOR,
    COLLAPSED_NEW_CHAT_HEADER_SLOT_DECLARATIONS,
  ),
  cssRule(RIGHT_HEADER_SLOT_HIDDEN_MENU_SELECTOR, RIGHT_HEADER_SLOT_DECLARATIONS),
  cssRule(
    EMPTY_LOWER_APP_HEADER_HIDDEN_MENU_SELECTOR,
    EMPTY_LOWER_APP_HEADER_DECLARATIONS,
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

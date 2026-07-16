const STYLE_ID = "codex-app-ui-overrides-style";

const HIDDEN_DISPLAY_DECLARATIONS = "display:none!important;";
const USAGE_MENU_CONTENT_SELECTOR =
  ".flex.flex-col.text-sm:has(>.grid.items-center.gap-y-1\\.5.py-1)";
const USAGE_MENU_RATE_ROWS_SELECTOR =
  `${USAGE_MENU_CONTENT_SELECTOR}>.grid.items-center.gap-y-1\\.5.py-1`;
const USAGE_MENU_RATE_ROWS_DECLARATIONS =
  "padding-left:calc(var(--padding-row-x) + 1.25rem + 2px)!important;padding-right:var(--padding-row-x)!important;";
const USAGE_MENU_LINK_DECLARATIONS = "display:none!important;";
const USAGE_MENU_RESET_ACTION_SELECTOR =
  `${USAGE_MENU_RATE_ROWS_SELECTOR}~:is(div,button,[role='menuitem']):not(a[href]):has(svg)`;
const INVITE_FRIEND_MENU_ITEM_SELECTOR =
  ":where([role='menu'],[data-radix-popper-content-wrapper]) [role='menuitem']:has(svg path[d^='M12.0368 1.69459'])";
const SIDEBAR_ROOT_SELECTOR =
  ':where(aside,nav,[role="navigation"]):has([data-app-action-sidebar-section-heading])';
const SIDEBAR_ACTIVE_SCROLLED_HEADER_SELECTOR =
  `${SIDEBAR_ROOT_SELECTOR}>.relative.z-10.flex.shrink-0.flex-col.gap-2[class~="after:h-[0.5px]"]`;
const SIDEBAR_HEADER_MODE_AND_SEARCH_SELECTOR =
  `${SIDEBAR_ROOT_SELECTOR}>.relative.z-10.flex.shrink-0.flex-col.gap-2>.ml-2.flex.items-center`;
const SIDEBAR_SCROLL_SELECTOR =
  `${SIDEBAR_ROOT_SELECTOR} [data-app-action-sidebar-scroll]`;
const SIDEBAR_SCROLL_DECLARATIONS =
  "margin-top:0!important;margin-bottom:var(--sidebar-footer-height)!important;padding-top:0!important;padding-bottom:var(--padding-row-x)!important;-webkit-mask-image:none!important;mask-image:none!important;";
const SIDEBAR_TOP_TRIGGER_SELECTOR =
  ".group\\/application-menu-top-bar [data-app-shell-sidebar-trigger]";
const SIDEBAR_TOP_TRIGGER_DECLARATIONS =
  "transform:translateX(4px)!important;";
const SIDEBAR_HELP_BUTTON_SELECTOR =
  `${SIDEBAR_ROOT_SELECTOR} button:has(svg path[d^="M16.585 10C16.585"])`;
const CODEX_PLUSPLUS_SETTINGS_NAV_ROOT_SELECTOR =
  ":where(aside,nav,[role='navigation'],div):has(>[data-codexpp=\"nav-group\"])";
const CODEX_PLUSPLUS_SETTINGS_NAV_SPACER_SELECTORS = [
  `${CODEX_PLUSPLUS_SETTINGS_NAV_ROOT_SELECTOR}>[class~=\"flex-1\"]`,
  `${CODEX_PLUSPLUS_SETTINGS_NAV_ROOT_SELECTOR}>[class~=\"grow\"]`,
];
const CODEX_PLUSPLUS_SETTINGS_NAV_SCROLLBAR_SELECTOR =
  "nav:has([data-settings-panel-slug]) .min-h-0.flex-1.overflow-y-auto.pb-2";
const CODEX_PLUSPLUS_SETTINGS_NAV_SCROLLBAR_DECLARATIONS =
  "margin-right:calc(var(--padding-row-x) * -1)!important;padding-right:var(--padding-row-x)!important;padding-bottom:1.25rem!important;";
const REMOTE_CONVERSATION_HEADER_ACTIONS_SELECTOR =
  ".draggable.grid.w-full.min-w-0.items-center.gap-x-4.electron\\:h-toolbar.extension\\:py-row-y>.flex.items-center.justify-end.gap-1\\.5>.flex.items-center.gap-2";
const REMOTE_CONVERSATION_PR_ACTION_SELECTOR =
  `${REMOTE_CONVERSATION_HEADER_ACTIONS_SELECTOR}>button.shrink-0:last-child`;
function cssRule(selectors, declarations) {
  const selector = Array.isArray(selectors) ? selectors.join(",") : selectors;
  return `${selector}{${declarations}}`;
}

const BASE_STYLE_RULES = [
  cssRule(SIDEBAR_HEADER_MODE_AND_SEARCH_SELECTOR, HIDDEN_DISPLAY_DECLARATIONS),
  cssRule(SIDEBAR_TOP_TRIGGER_SELECTOR, SIDEBAR_TOP_TRIGGER_DECLARATIONS),
  cssRule(INVITE_FRIEND_MENU_ITEM_SELECTOR, HIDDEN_DISPLAY_DECLARATIONS),
];

const SIDEBAR_SCROLL_STYLE_RULES = [
  cssRule(SIDEBAR_SCROLL_SELECTOR, SIDEBAR_SCROLL_DECLARATIONS),
  cssRule(
    SIDEBAR_ACTIVE_SCROLLED_HEADER_SELECTOR,
    "padding-bottom:1px!important;",
  ),
  cssRule(
    `${SIDEBAR_ACTIVE_SCROLLED_HEADER_SELECTOR}::after`,
    HIDDEN_DISPLAY_DECLARATIONS,
  ),
];
const IMAGE_PREVIEW_STYLE_RULES = [
  cssRule(
    ".absolute.top-3.right-3.z-10.flex.items-center.gap-2",
    "top:calc(0.75rem + 26px)!important;",
  ),
];

const REMOTE_CONVERSATION_HEADER_STYLE_RULES = [
  cssRule(REMOTE_CONVERSATION_PR_ACTION_SELECTOR, "order:-1!important;"),
];

const SETTINGS_STYLE_RULES = [
  cssRule(
    "main.main-surface:has(.main-surface>.draggable.flex.items-center.px-panel.electron\\:h-toolbar.extension\\:h-toolbar-sm)>.app-header-tint.draggable.pointer-events-none.fixed.z-30.flex.h-toolbar.min-w-0.items-center",
    "display:none!important;",
  ),
  cssRule(
    ".app-shell-main-content-viewport:has(.main-surface>.draggable.flex.items-center.px-panel.electron\\:h-toolbar.extension\\:h-toolbar-sm)",
    "--app-shell-main-content-frame-top-offset:0px!important;",
  ),
  cssRule(
    ".app-shell-main-content-frame:has(.main-surface>.draggable.flex.items-center.px-panel.electron\\:h-toolbar.extension\\:h-toolbar-sm)",
    "border-top-width:0!important;",
  ),

  cssRule(
    ".main-surface>.draggable.flex.items-center.px-panel.electron\\:h-toolbar.extension\\:h-toolbar-sm:not(:has(*))",
    "display:none!important;",
  ),
  cssRule(
    ".main-surface>.draggable.flex.items-center.px-panel.electron\\:h-toolbar.extension\\:h-toolbar-sm:not(:has(*))+.scrollbar-stable.flex-1.overflow-y-auto.p-panel",
    "padding-top:var(--height-toolbar)!important;padding-bottom:4rem!important;",
  ),
];

const CODEX_PLUSPLUS_SETTINGS_NAV_STYLE_RULES = [
  cssRule(
    CODEX_PLUSPLUS_SETTINGS_NAV_ROOT_SELECTOR,
    "justify-content:flex-start!important;",
  ),
  cssRule(
    CODEX_PLUSPLUS_SETTINGS_NAV_SPACER_SELECTORS,
    "flex:0 0 auto!important;",
  ),
  cssRule(
    `${CODEX_PLUSPLUS_SETTINGS_NAV_ROOT_SELECTOR}>[class~=\"mt-auto\"]`,
    "margin-top:0!important;",
  ),
  cssRule(
    '[data-codexpp="nav-group"],[data-codexpp="pages-group"]',
    "flex:0 0 auto!important;margin-top:0!important;",
  ),
  cssRule(
    CODEX_PLUSPLUS_SETTINGS_NAV_SCROLLBAR_SELECTOR,
    CODEX_PLUSPLUS_SETTINGS_NAV_SCROLLBAR_DECLARATIONS,
  ),
];

const SIDEBAR_FOOTER_STYLE_RULES = [
  cssRule(
    `${SIDEBAR_ROOT_SELECTOR} button:has(svg path[d^="M10.6391 1.67517"]) svg`,
    "margin-right:1px!important;",
  ),
  cssRule(SIDEBAR_HELP_BUTTON_SELECTOR, HIDDEN_DISPLAY_DECLARATIONS),
];

const USAGE_MENU_STYLE_RULES = [
  cssRule(
    [
      USAGE_MENU_RATE_ROWS_SELECTOR,
      USAGE_MENU_RESET_ACTION_SELECTOR,
    ],
    USAGE_MENU_RATE_ROWS_DECLARATIONS,
  ),
  cssRule(
    [
      `${USAGE_MENU_CONTENT_SELECTOR}>a[href="https://openai.com/chatgpt/pricing"]`,
      `${USAGE_MENU_CONTENT_SELECTOR}>a[href^="https://help.openai.com/en/articles/11369540-using-codex"]`,
    ],
    USAGE_MENU_LINK_DECLARATIONS,
  ),
];

const STYLE_RULES = [
  ...BASE_STYLE_RULES,
  ...SIDEBAR_SCROLL_STYLE_RULES,
  ...IMAGE_PREVIEW_STYLE_RULES,
  ...REMOTE_CONVERSATION_HEADER_STYLE_RULES,
  ...SETTINGS_STYLE_RULES,
  ...CODEX_PLUSPLUS_SETTINGS_NAV_STYLE_RULES,
  ...SIDEBAR_FOOTER_STYLE_RULES,
  ...USAGE_MENU_STYLE_RULES,
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

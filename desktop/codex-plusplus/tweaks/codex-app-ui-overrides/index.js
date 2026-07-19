const STYLE_ID = "codex-app-ui-overrides-style";

const HIDDEN_DISPLAY_DECLARATIONS = "display:none!important;";
const USAGE_MENU_CONTENT_CLASS_SELECTOR = ".flex.flex-col.text-sm";
const USAGE_MENU_RATE_ROWS_CLASS_SELECTOR =
  ".grid.items-center.gap-y-1\\.5.py-1";
const USAGE_MENU_CONTENT_SELECTOR =
  `${USAGE_MENU_CONTENT_CLASS_SELECTOR}:has(>${USAGE_MENU_RATE_ROWS_CLASS_SELECTOR})`;
const USAGE_MENU_RATE_ROWS_SELECTOR =
  `${USAGE_MENU_CONTENT_SELECTOR}>${USAGE_MENU_RATE_ROWS_CLASS_SELECTOR}`;
const USAGE_MENU_RATE_LABEL_SELECTOR =
  `${USAGE_MENU_RATE_ROWS_SELECTOR}>span.font-medium`;
const USAGE_MENU_RATE_ROWS_DECLARATIONS =
  "padding-left:calc(var(--padding-row-x) + 1.25rem + 3px)!important;padding-right:var(--padding-row-x)!important;";
const USAGE_MENU_RESET_ACTION_DECLARATIONS =
  "padding-left:calc(var(--padding-row-x) + 1.25rem + 2px)!important;padding-right:var(--padding-row-x)!important;font-weight:400!important;";
const USAGE_MENU_LABEL_DECLARATIONS = "font-weight:400!important;";
const USAGE_MENU_LINK_DECLARATIONS = "display:none!important;";
const USAGE_MENU_RESET_ACTION_SELECTOR =
  `${USAGE_MENU_RATE_ROWS_SELECTOR}~:is(div,button,[role='menuitem']):not(a[href]):has(svg)`;
const INVITE_FRIEND_MENU_ITEM_SELECTOR =
  ":where([role='menu'],[data-radix-popper-content-wrapper]) [role='menuitem']:has(svg path[d^='M12.0368 1.69459'])";
const PET_MENU_ITEM_SELECTOR =
  ":where([role='menu'],[data-radix-popper-content-wrapper]) [role='menuitem']:has(svg path[d^='M12.8124 13.516'])";
const PROFILE_MENU_IDENTITY_SELECTOR =
  "[role='menuitem'] svg path[d^='M10.6391 1.67517']";
const PROFILE_MENU_SELECTOR =
  `:where([role='menu']):has(${PROFILE_MENU_IDENTITY_SELECTOR})`;
const PROFILE_MENU_DECLARATIONS =
  "width:calc(var(--radix-dropdown-menu-trigger-width,var(--radix-popper-anchor-width)) - 2px)!important;";
const PROFILE_MENU_EXPANDED_SELECTOR =
  `[data-radix-popper-content-wrapper]:has(:where([role='menu']) ${PROFILE_MENU_IDENTITY_SELECTOR}):has(:where([role='menu']) ${USAGE_MENU_CONTENT_CLASS_SELECTOR}>${USAGE_MENU_RATE_ROWS_CLASS_SELECTOR})`;
const PROFILE_MENU_EXPANDED_DECLARATIONS = "translate:0 -58px!important;";
const SIDEBAR_ROOT_SELECTOR =
  ':where(aside,nav,[role="navigation"]):has([data-app-action-sidebar-section-heading])';
const SIDEBAR_ROOT_DECLARATIONS =
  "--sidebar-scroll-header-spacing:1px!important;";
const SIDEBAR_COMPACT_THREAD_ROW_SELECTOR =
  `${SIDEBAR_ROOT_SELECTOR} [data-app-action-sidebar-thread-row]`;
const SIDEBAR_COMPACT_THREAD_ROW_DECLARATIONS =
  "height:calc(var(--height-token-row) - 4px)!important;margin-right:-3px!important;";
const SIDEBAR_COMPACT_PROJECT_ROW_SELECTOR =
  `${SIDEBAR_ROOT_SELECTOR} [data-app-action-sidebar-project-row]`;
const SIDEBAR_COMPACT_PROJECT_ROW_DECLARATIONS =
  "height:calc(var(--height-token-row) - 2px)!important;overflow-y:hidden!important;";
const SIDEBAR_COMPACT_PROJECT_CONTENT_SELECTOR =
  `${SIDEBAR_COMPACT_PROJECT_ROW_SELECTOR} [class~="text-base"][class~="py-1"]`;
const SIDEBAR_COMPACT_PROJECT_CONTENT_DECLARATIONS =
  "padding-block:calc(var(--spacing) - 1px)!important;";
const SIDEBAR_PROJECT_CONTENT_WITH_SHOW_MORE_SELECTOR =
  `${SIDEBAR_ROOT_SELECTOR} [role='listitem']:has([data-app-action-sidebar-project-row]) [class~='pt-0.5'][class~='pb-2']:has([role='listitem'][class~='flex'][class~='gap-1'][class~='py-1']>button)`;
const SIDEBAR_PROJECT_CONTENT_WITH_SHOW_MORE_DECLARATIONS =
  "padding-bottom:0!important;";
const SIDEBAR_PROJECT_TITLE_SELECTOR =
  `${SIDEBAR_ROOT_SELECTOR} [data-app-action-sidebar-project-row] span.text-fade-truncate.pr-1`;
const SIDEBAR_PROJECT_TITLE_DECLARATIONS =
  "transform:translateY(-1px)!important;";
const SIDEBAR_NAV_LEADING_ICON_SELECTOR =
  `${SIDEBAR_ROOT_SELECTOR} :is(button,[role='button'])>.flex.min-w-0.items-center.text-base.gap-2>span.flex.w-4.shrink-0`;
const SIDEBAR_PROJECT_LEADING_ICON_SELECTOR =
  `${SIDEBAR_COMPACT_PROJECT_ROW_SELECTOR}>div:first-child>span:first-child`;
const SIDEBAR_LEADING_ICON_DECLARATIONS = "translate:-1px 0!important;";
const SIDEBAR_ACTIVE_PROJECT_ROW_SELECTOR =
  `${SIDEBAR_ROOT_SELECTOR} [role='listitem']:has([data-app-action-sidebar-project-row]):has([data-app-action-sidebar-thread-active='true']) [data-app-action-sidebar-project-row]`;
const SIDEBAR_INTERACTIVE_PROJECT_ROW_SELECTORS = [
  `${SIDEBAR_COMPACT_PROJECT_ROW_SELECTOR}:is(:hover,:focus-within,[aria-current='page'])`,
  SIDEBAR_ACTIVE_PROJECT_ROW_SELECTOR,
];
const SIDEBAR_PROJECT_ROW_ACTION_SELECTOR =
  SIDEBAR_INTERACTIVE_PROJECT_ROW_SELECTORS.map(
    (selector) => `${selector} [class~='col-start-1'][class~='row-start-1']:has(button)`,
  );
const SIDEBAR_PROJECT_ROW_ACTION_ICON_SELECTOR =
  SIDEBAR_PROJECT_ROW_ACTION_SELECTOR.map((selector) => `${selector} svg`);
const SIDEBAR_PROJECT_ROW_ACTION_DECLARATIONS =
  "opacity:1!important;visibility:visible!important;";
const SIDEBAR_HOVER_ACTION_ICON_DECLARATIONS =
  "opacity:1!important;visibility:visible!important;color:var(--color-token-foreground,currentColor)!important;";
const SIDEBAR_PROJECT_ROW_MENU_SELECTOR =
  SIDEBAR_INTERACTIVE_PROJECT_ROW_SELECTORS.map(
    (selector) =>
      `${selector} [class~='w-0'][class~='overflow-hidden'][class~='opacity-0']:has(button[aria-haspopup='menu'])`,
  );
const SIDEBAR_PROJECT_ROW_MENU_ICON_SELECTOR =
  SIDEBAR_PROJECT_ROW_MENU_SELECTOR.map((selector) => `${selector} svg`);
const SIDEBAR_PROJECT_ROW_MENU_DECLARATIONS =
  "width:auto!important;overflow:visible!important;opacity:1!important;visibility:visible!important;";
const SIDEBAR_PROJECT_ROW_MENU_ALIGNMENT_SELECTOR =
  SIDEBAR_INTERACTIVE_PROJECT_ROW_SELECTORS.map(
    (selector) =>
      `${selector}>[class~='flex'][class~='max-w-[50%]'][class~='gap-1']>div:has(button[aria-haspopup='menu'])`,
  );
const SIDEBAR_PROJECT_ROW_MENU_ALIGNMENT_DECLARATIONS =
  "translate:2px 0!important;";
const SIDEBAR_PROJECT_ROW_CONTROLS_SELECTOR =
  `${SIDEBAR_COMPACT_PROJECT_ROW_SELECTOR}>[class~='flex'][class~='max-w-[50%]'][class~='gap-1']`;
const SIDEBAR_PROJECT_ROW_CONTROLS_DECLARATIONS =
  "translate:3px 0!important;align-items:center!important;";
const SIDEBAR_SECTION_ACTIONS_SELECTOR =
  `${SIDEBAR_ROOT_SELECTOR} [data-app-action-sidebar-section-heading] [class~="group/nav-section-title"] [class~="pointer-events-none"][class~="opacity-0"]`;
const SIDEBAR_SECTION_ACTIONS_DECLARATIONS =
  "opacity:1!important;pointer-events:auto!important;";
const SIDEBAR_PRIMARY_SECTION_HEADER_SELECTOR =
  `${SIDEBAR_ROOT_SELECTOR} :is([class~="group/chats-section-header"],[class~="group/projects-section-header"])`;
const SIDEBAR_PRIMARY_SECTION_TITLE_ROW_SELECTOR =
  `${SIDEBAR_ROOT_SELECTOR} [class~="group/nav-section-title"]:has(:is([class~="group/chats-section-header"],[class~="group/projects-section-header"]))`;
const SIDEBAR_PRIMARY_SECTION_TITLE_ROW_DECLARATIONS =
  "padding-right:0!important;";
const SIDEBAR_PRIMARY_SECTION_ACTIONS_SELECTOR =
  `${SIDEBAR_PRIMARY_SECTION_HEADER_SELECTOR}>[class~='flex'][class~='items-center'][class~='gap-1']`;
const SIDEBAR_PRIMARY_SECTION_ACTIONS_DECLARATIONS =
  "translate:1px 0!important;";
const SIDEBAR_CHATS_SECTION_ACTIONS_SELECTOR =
  `${SIDEBAR_ROOT_SELECTOR} [class~="group/chats-section-header"]>[class~='flex'][class~='items-center'][class~='gap-1']`;
const SIDEBAR_CHATS_SECTION_ACTIONS_DECLARATIONS =
  "translate:7px 0!important;";
const SIDEBAR_CHATS_NEW_CHAT_ICON_SELECTOR =
  `${SIDEBAR_ROOT_SELECTOR} [class~="group/chats-section-header"] svg:has(>path[d^="M6.33325 1.88379"])`;
const SIDEBAR_CHATS_NEW_CHAT_ICON_DECLARATIONS =
  "translate:0 -1px!important;";
const SIDEBAR_PRIMARY_SECTION_TITLE_SELECTOR =
  `${SIDEBAR_PRIMARY_SECTION_TITLE_ROW_SELECTOR}>[class~='min-w-0'][class~='flex-1']`;
const SIDEBAR_PRIMARY_SECTION_TITLE_DECLARATIONS =
  "color:var(--color-token-description-foreground)!important;font-weight:400!important;opacity:1!important;";
const SIDEBAR_SECTION_TOGGLE_SELECTOR =
  `${SIDEBAR_ROOT_SELECTOR} :is([data-app-action-sidebar-section-heading="Projects"],[data-app-action-sidebar-section-heading="Pinned"],[data-app-action-sidebar-section-heading="Tasks"]) [data-app-action-sidebar-section-toggle]`;
const SIDEBAR_SECTION_TOGGLE_DECLARATIONS =
  "pointer-events:none!important;cursor:default!important;";
const SIDEBAR_SECTION_TOGGLE_ICON_SELECTOR =
  `${SIDEBAR_SECTION_TOGGLE_SELECTOR}>[class~="opacity-0"]`;
const SIDEBAR_HEADER_MODE_AND_SEARCH_SELECTOR =
  `${SIDEBAR_ROOT_SELECTOR}>.relative.z-10.flex.shrink-0.flex-col.gap-2>.ml-2.flex.items-center`;
const SIDEBAR_SCROLL_SELECTOR =
  `${SIDEBAR_ROOT_SELECTOR} [data-app-action-sidebar-scroll]`;
const SIDEBAR_SCROLL_DECLARATIONS =
  "margin-top:0!important;margin-bottom:var(--sidebar-footer-height)!important;padding-top:0!important;padding-bottom:1rem!important;--sidebar-scroll-header-fade-start:0px!important;--sidebar-scroll-footer-edge:100%!important;";
const SIDEBAR_TOP_TRIGGER_SELECTOR =
  ".group\\/application-menu-top-bar [data-app-shell-sidebar-trigger]";
const SIDEBAR_TOP_TRIGGER_DECLARATIONS =
  "transform:translateX(3px)!important;";
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
  ".draggable.grid.w-full.min-w-0.items-center.gap-x-4.electron\\:h-toolbar.extension\\:py-row-y>.flex.items-center.justify-end.gap-1\\.5>.flex.items-center.gap-0\\.5";
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
  cssRule(PET_MENU_ITEM_SELECTOR, HIDDEN_DISPLAY_DECLARATIONS),
  cssRule(PROFILE_MENU_SELECTOR, PROFILE_MENU_DECLARATIONS),
  cssRule(PROFILE_MENU_EXPANDED_SELECTOR, PROFILE_MENU_EXPANDED_DECLARATIONS),
];

const SIDEBAR_SCROLL_STYLE_RULES = [
  cssRule(SIDEBAR_ROOT_SELECTOR, SIDEBAR_ROOT_DECLARATIONS),
  cssRule(SIDEBAR_SCROLL_SELECTOR, SIDEBAR_SCROLL_DECLARATIONS),
  cssRule(SIDEBAR_COMPACT_THREAD_ROW_SELECTOR, SIDEBAR_COMPACT_THREAD_ROW_DECLARATIONS),
  cssRule(SIDEBAR_COMPACT_PROJECT_ROW_SELECTOR, SIDEBAR_COMPACT_PROJECT_ROW_DECLARATIONS),
  cssRule(SIDEBAR_COMPACT_PROJECT_CONTENT_SELECTOR, SIDEBAR_COMPACT_PROJECT_CONTENT_DECLARATIONS),
  cssRule(
    SIDEBAR_PROJECT_CONTENT_WITH_SHOW_MORE_SELECTOR,
    SIDEBAR_PROJECT_CONTENT_WITH_SHOW_MORE_DECLARATIONS,
  ),
  cssRule(SIDEBAR_PROJECT_TITLE_SELECTOR, SIDEBAR_PROJECT_TITLE_DECLARATIONS),
  cssRule(SIDEBAR_NAV_LEADING_ICON_SELECTOR, SIDEBAR_LEADING_ICON_DECLARATIONS),
  cssRule(SIDEBAR_PROJECT_LEADING_ICON_SELECTOR, SIDEBAR_LEADING_ICON_DECLARATIONS),
  cssRule(SIDEBAR_PROJECT_ROW_ACTION_SELECTOR, SIDEBAR_PROJECT_ROW_ACTION_DECLARATIONS),
  cssRule(SIDEBAR_PROJECT_ROW_ACTION_ICON_SELECTOR, SIDEBAR_HOVER_ACTION_ICON_DECLARATIONS),
  cssRule(SIDEBAR_PROJECT_ROW_MENU_SELECTOR, SIDEBAR_PROJECT_ROW_MENU_DECLARATIONS),
  cssRule(SIDEBAR_PROJECT_ROW_MENU_ICON_SELECTOR, SIDEBAR_HOVER_ACTION_ICON_DECLARATIONS),
  cssRule(SIDEBAR_PROJECT_ROW_MENU_ALIGNMENT_SELECTOR, SIDEBAR_PROJECT_ROW_MENU_ALIGNMENT_DECLARATIONS),
  cssRule(SIDEBAR_PROJECT_ROW_CONTROLS_SELECTOR, SIDEBAR_PROJECT_ROW_CONTROLS_DECLARATIONS),
  cssRule(SIDEBAR_SECTION_ACTIONS_SELECTOR, SIDEBAR_SECTION_ACTIONS_DECLARATIONS),
  cssRule(SIDEBAR_PRIMARY_SECTION_TITLE_ROW_SELECTOR, SIDEBAR_PRIMARY_SECTION_TITLE_ROW_DECLARATIONS),
  cssRule(SIDEBAR_PRIMARY_SECTION_ACTIONS_SELECTOR, SIDEBAR_PRIMARY_SECTION_ACTIONS_DECLARATIONS),
  cssRule(SIDEBAR_CHATS_SECTION_ACTIONS_SELECTOR, SIDEBAR_CHATS_SECTION_ACTIONS_DECLARATIONS),
  cssRule(SIDEBAR_CHATS_NEW_CHAT_ICON_SELECTOR, SIDEBAR_CHATS_NEW_CHAT_ICON_DECLARATIONS),
  cssRule(SIDEBAR_PRIMARY_SECTION_TITLE_SELECTOR, SIDEBAR_PRIMARY_SECTION_TITLE_DECLARATIONS),
  cssRule(SIDEBAR_SECTION_TOGGLE_SELECTOR, SIDEBAR_SECTION_TOGGLE_DECLARATIONS),
  cssRule(SIDEBAR_SECTION_TOGGLE_ICON_SELECTOR, HIDDEN_DISPLAY_DECLARATIONS),
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
  cssRule(SIDEBAR_HELP_BUTTON_SELECTOR, HIDDEN_DISPLAY_DECLARATIONS),
];

const USAGE_MENU_STYLE_RULES = [
  cssRule(USAGE_MENU_RATE_ROWS_SELECTOR, USAGE_MENU_RATE_ROWS_DECLARATIONS),
  cssRule(USAGE_MENU_RATE_LABEL_SELECTOR, USAGE_MENU_LABEL_DECLARATIONS),
  cssRule(USAGE_MENU_RESET_ACTION_SELECTOR, USAGE_MENU_RESET_ACTION_DECLARATIONS),
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

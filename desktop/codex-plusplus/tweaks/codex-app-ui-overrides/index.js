const STYLE_ID = "codex-app-ui-overrides-style";

const VISIBLE_CONTROL_DECLARATIONS =
  "opacity:1!important;pointer-events:auto!important;visibility:visible!important;";
const VISIBLE_FLEX_CONTROL_DECLARATIONS = `display:flex!important;${VISIBLE_CONTROL_DECLARATIONS}`;
const VISIBLE_ICON_DECLARATIONS =
  "opacity:1!important;visibility:visible!important;";
const SIDEBAR_ACTION_BASE_COLOR_DECLARATIONS =
  "color:var(--color-token-description-foreground)!important;";
const SIDEBAR_ACTION_HOVER_COLOR_DECLARATIONS =
  "color:var(--color-token-foreground)!important;";
const HIDDEN_META_RAIL_DECLARATIONS = "display:none!important;";
const SIDEBAR_THREAD_ROW_TITLE_ACTION_RESERVE_DECLARATIONS =
  "padding-right:1.1rem!important;min-width:0!important;";
const HIDDEN_DISPLAY_DECLARATIONS = "display:none!important;";
const SIDEBAR_SECTION_HEADER_SELECTORS = [
  ".group\\/chats-section-header",
  ".group\\/projects-section-header",
];
const SIDEBAR_SECTION_HEADER_ACTIVE_SELECTORS = [
  ":has([data-state='open'])",
];
const SIDEBAR_SECTION_HEADER_ACTION_RAIL_TARGETS = [
  ">div:has(button:not([aria-hidden='true'])[aria-label])",
  ">div:has([role='button']:not([aria-hidden='true'])[aria-label])",
];
const SIDEBAR_SECTION_HEADER_ACTION_CONTROL_TARGETS = [
  ">div:has(button:not([aria-hidden='true'])[aria-label]) button:not([aria-hidden='true'])[aria-label]",
  ">div:has([role='button']:not([aria-hidden='true'])[aria-label]) [role='button']:not([aria-hidden='true'])[aria-label]",
];
const SIDEBAR_SECTION_HEADER_ACTION_HOVER_CONTROL_TARGETS = [
  ">div:has(button:not([aria-hidden='true'])[aria-label]) button:not([aria-hidden='true'])[aria-label]:is(:hover,:focus-visible)",
  ">div:has([role='button']:not([aria-hidden='true'])[aria-label]) [role='button']:not([aria-hidden='true'])[aria-label]:is(:hover,:focus-visible)",
];
const SIDEBAR_SECTION_HEADER_ACTION_ICON_TARGETS = [
  ">div:has(button:not([aria-hidden='true'])[aria-label]) button:not([aria-hidden='true'])[aria-label] svg",
  ">div:has([role='button']:not([aria-hidden='true'])[aria-label]) [role='button']:not([aria-hidden='true'])[aria-label] svg",
];
const SIDEBAR_SECTION_TOGGLE_ICON_TARGETS = [
  ".group\\/section-toggle:is(:hover,:focus-visible) svg",
  ".group\\/section-toggle:is(:hover,:focus-visible) .icon-2xs",
];
const SIDEBAR_PROJECT_ROW_SELECTOR = "[data-app-action-sidebar-project-row]";
const SIDEBAR_PROJECT_ACTION_RAIL_SELECTOR =
  ">div.flex.gap-1:has(>.relative.mr-0\\.5.h-6.min-w-6.shrink-0)";
const SIDEBAR_PROJECT_ACTION_WRAPPER_TARGETS = [
  `${SIDEBAR_PROJECT_ACTION_RAIL_SELECTOR}>div:has(button[aria-haspopup='menu'][aria-label])`,
  `${SIDEBAR_PROJECT_ACTION_RAIL_SELECTOR} span:has(>button:not([aria-hidden='true'])[aria-label])`,
  `${SIDEBAR_PROJECT_ACTION_RAIL_SELECTOR} span:has(>[role='button']:not([aria-hidden='true'])[aria-label])`,
];
const SIDEBAR_PROJECT_ACTION_CONTROL_TARGETS = [
  `${SIDEBAR_PROJECT_ACTION_RAIL_SELECTOR} button:not([aria-hidden='true'])[aria-label]`,
  `${SIDEBAR_PROJECT_ACTION_RAIL_SELECTOR} [role='button']:not([aria-hidden='true'])[aria-label]`,
];
const SIDEBAR_PROJECT_ACTION_HOVER_CONTROL_TARGETS = [
  `${SIDEBAR_PROJECT_ACTION_RAIL_SELECTOR} button:not([aria-hidden='true'])[aria-label]:is(:hover,:focus-visible)`,
  `${SIDEBAR_PROJECT_ACTION_RAIL_SELECTOR} [role='button']:not([aria-hidden='true'])[aria-label]:is(:hover,:focus-visible)`,
];
const SIDEBAR_PROJECT_ACTION_ICON_TARGETS = [
  `${SIDEBAR_PROJECT_ACTION_RAIL_SELECTOR} button:not([aria-hidden='true'])[aria-label] :is(svg,.icon-2xs,.icon-xs,.icon-sm)`,
  `${SIDEBAR_PROJECT_ACTION_RAIL_SELECTOR} [role='button']:not([aria-hidden='true'])[aria-label] :is(svg,.icon-2xs,.icon-xs,.icon-sm)`,
];
const SIDEBAR_PROJECT_ACTION_OVERLAY_TARGETS = [
  `${SIDEBAR_PROJECT_ACTION_RAIL_SELECTOR} .group-hover\\/folder-row\\:hidden`,
];
const SIDEBAR_THREAD_ROW_SELECTOR = "[data-app-action-sidebar-thread-row]";
const SIDEBAR_THREAD_ROW_ACTION_WRAPPER_TARGETS = [
  " .w-4 span:has(>button:not([aria-hidden='true'])[aria-label])",
  " .w-4 span:has(>[role='button']:not([aria-hidden='true'])[aria-label])",
  " >.absolute.right-0.top-0.z-10 span:has(>button:not([aria-hidden='true'])[aria-label])",
  " >.absolute.right-0.top-0.z-10 span:has(>[role='button']:not([aria-hidden='true'])[aria-label])",
];
const SIDEBAR_ACTION_CONTROL_TARGETS = [
  ">:is(div,span):has(button:not([aria-hidden='true'])[aria-label])",
  " button:not([aria-hidden='true'])[aria-label]",
  " [role='button']:not([aria-hidden='true'])[aria-label]",
];
const SIDEBAR_ACTION_HOVER_CONTROL_TARGETS = [
  " button:not([aria-hidden='true'])[aria-label]:is(:hover,:focus-visible)",
  " [role='button']:not([aria-hidden='true'])[aria-label]:is(:hover,:focus-visible)",
];
const SIDEBAR_ACTION_ICON_TARGETS = [
  " button:not([aria-hidden='true'])[aria-label] :is(svg,.icon-2xs,.icon-xs,.icon-sm)",
  " [role='button']:not([aria-hidden='true'])[aria-label] :is(svg,.icon-2xs,.icon-xs,.icon-sm)",
];
const SIDEBAR_THREAD_ROW_META_CONTENT_TARGETS = [
  " .ml-\\[3px\\].flex.items-center.justify-end.gap-1>:not(:is(button:not([aria-hidden='true'])[aria-label],[role='button']:not([aria-hidden='true'])[aria-label])):not(:has(:is(button:not([aria-hidden='true'])[aria-label],[role='button']:not([aria-hidden='true'])[aria-label])))",
];
const SIDEBAR_THREAD_ROW_META_TARGETS = [
  " .ml-\\[3px\\].flex.items-center.justify-end.gap-1",
];
const SIDEBAR_THREAD_ROW_TITLE_TARGETS = [
  " [data-thread-title-trigger]",
];
const SIDEBAR_THREAD_ROW_TITLE_TEXT_TARGETS = [
  " [data-thread-title-trigger]>:first-child",
  " [data-thread-title-trigger] .truncate",
  " [data-thread-title-trigger] .whitespace-pre-wrap",
  " [data-thread-title-trigger] .break-all",
];
const SIDEBAR_THREAD_ROW_TITLE_TEXT_DECLARATIONS =
  "display:block!important;min-width:0!important;max-width:100%!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;word-break:normal!important;";
const SIDEBAR_THREAD_ROW_STOP_BUTTON_DECLARATIONS = "display:none!important;";
const SIDEBAR_THREAD_ROW_STOP_BUTTON_TARGETS = [
  " button[aria-label*='stop' i]",
  " button[title*='stop' i]",
  " button[aria-label*='terminate' i]",
  " button[title*='terminate' i]",
  " [role='button'][aria-label*='stop' i]",
  " [role='button'][title*='stop' i]",
  " [role='button'][aria-label*='terminate' i]",
  " [role='button'][title*='terminate' i]",
];
const USAGE_MENU_CONTENT_SELECTOR =
  ".flex.flex-col.text-sm:has(>.grid.items-center.gap-y-1\\.5.py-1)";
const USAGE_MENU_RATE_ROWS_SELECTOR =
  `${USAGE_MENU_CONTENT_SELECTOR}>.grid.items-center.gap-y-1\\.5.py-1`;
const USAGE_MENU_RATE_ROWS_DECLARATIONS =
  "padding-left:calc(var(--padding-row-x) + 1.25rem + 2px)!important;padding-right:var(--padding-row-x)!important;";
const USAGE_MENU_LINK_DECLARATIONS = "display:none!important;";
const USAGE_MENU_RESET_ACTION_SELECTOR =
  `${USAGE_MENU_RATE_ROWS_SELECTOR}~:is(div,button,[role='menuitem']):not(a[href]):has(svg)`;
const PROFILE_DROPDOWN_CONTENT_SELECTOR =
  '.w-\\[280px\\]>.flex.w-full.min-w-0.flex-col.gap-0';
const PROFILE_DROPDOWN_INVITE_SELECTOR =
  `${PROFILE_DROPDOWN_CONTENT_SELECTOR}>:nth-last-child(2):has(svg path[d^="M16.834"])`;
const SIDEBAR_TRIGGER_SELECTOR =
  '[style*="view-transition-name: sidebar-trigger"]';
const SIDEBAR_TRIGGER_DECLARATIONS = "transform:translateX(2px);";
const SIDEBAR_ROOT_SELECTOR =
  ':where(aside,nav,[role="navigation"]):has([data-app-action-sidebar-section-heading])';
const SIDEBAR_PROJECT_GROUP_OVERFLOW_BUTTON_SELECTOR =
  `${SIDEBAR_ROOT_SELECTOR} [role='list']>[role='listitem'].py-1>button.text-token-description-foreground`;
const SIDEBAR_PROJECT_GROUP_OVERFLOW_BUTTON_DECLARATIONS =
  "margin-left:-0.0625rem!important;";
const CODEX_MOBILE_NAV_ITEM_SELECTORS = [
  `${SIDEBAR_ROOT_SELECTOR} :is(a,button,[role='button'])[aria-label*='codex mobile' i]`,
  `${SIDEBAR_ROOT_SELECTOR} button:has(svg path[d^="M12.75 1.83496C14.2218 1.83496 15.415 3.02816 15.415 4.5V15.5"])`,
  `${SIDEBAR_ROOT_SELECTOR} button:has(svg path[d^="M12.75 1.83496C14.2218 1.83496 15.415 3.02816 15.415 4.5V10.8477"])`,
];
const CODEX_PLUSPLUS_SETTINGS_NAV_ROOT_SELECTOR =
  ":where(aside,nav,[role='navigation'],div):has(>[data-codexpp=\"nav-group\"])";
const CODEX_PLUSPLUS_SETTINGS_NAV_SPACER_SELECTORS = [
  `${CODEX_PLUSPLUS_SETTINGS_NAV_ROOT_SELECTOR}>[class~=\"flex-1\"]`,
  `${CODEX_PLUSPLUS_SETTINGS_NAV_ROOT_SELECTOR}>[class~=\"grow\"]`,
];
const INVITE_FRIEND_MENU_ITEM_SELECTOR = [
  ":where([role='menu'],[data-radix-popper-content-wrapper]) :is(a,button,[role='menuitem'],[role='button'])[aria-label*='invite' i]",
  ":where([role='menu'],[data-radix-popper-content-wrapper]) :is(a,button,[role='menuitem'],[role='button'])[title*='invite' i]",
  ":where([role='menu'],[data-radix-popper-content-wrapper]) :is(a,button,[role='menuitem'],[role='button'])[aria-label*='friend' i]",
  ":where([role='menu'],[data-radix-popper-content-wrapper]) :is(a,button,[role='menuitem'],[role='button'])[title*='friend' i]",
  ":where([role='menu'],[data-radix-popper-content-wrapper]) a[href*='invite' i]",
  ":where([role='menu'],[data-radix-popper-content-wrapper]) a[href*='referral' i]",
];
const INVITE_FRIEND_MENU_ITEM_DECLARATIONS = "display:none!important;";

function cssRule(selectors, declarations) {
  const selector = Array.isArray(selectors) ? selectors.join(",") : selectors;
  return `${selector}{${declarations}}`;
}

function mediaRule(condition, rules) {
  return `@media ${condition}{${rules.join("")}}`;
}

function descendantSelectors(container, targets) {
  return targets.map((target) => `${container}${target}`);
}

function interactiveSelectors(container, targets) {
  return targets.map((target) => `${container}:is(:hover,:focus-within)${target}`);
}

function rowStateSelectors(container, targets, activeSelectors) {
  return targets.flatMap((target) => [
    `${container}:is(:hover,:focus-within)${target}`,
    ...activeSelectors.map((activeSelector) => `${container}${activeSelector}${target}`),
  ]);
}

function sectionHeaderStateSelectors(targets) {
  return SIDEBAR_SECTION_HEADER_SELECTORS.flatMap((selector) =>
    rowStateSelectors(selector, targets, SIDEBAR_SECTION_HEADER_ACTIVE_SELECTORS),
  );
}

const BASE_STYLE_RULES = [
  cssRule(".group\\/application-menu-top-bar", "margin-inline-start:0.5rem;"),
  cssRule(SIDEBAR_TRIGGER_SELECTOR, SIDEBAR_TRIGGER_DECLARATIONS),
  cssRule(CODEX_MOBILE_NAV_ITEM_SELECTORS, HIDDEN_DISPLAY_DECLARATIONS),
];

const SIDEBAR_PIXEL_NUDGE_STYLE_RULES = [
  cssRule(
    [
      '[data-app-action-sidebar-section-heading="Pinned"] [data-app-action-sidebar-thread-row]:not(:has(.absolute.top-0.left-1.z-10)) [data-thread-title-trigger]',
      '[data-app-action-sidebar-section-heading="Chats"] [data-app-action-sidebar-thread-row]:not(:has(.absolute.top-0.left-1.z-10)) [data-thread-title-trigger]',
    ],
    "position:relative!important;left:-2px!important;",
  ),
];
const SIDEBAR_HOVER_CONTROL_STYLE_RULES = [
  cssRule(
    sectionHeaderStateSelectors(SIDEBAR_SECTION_HEADER_ACTION_RAIL_TARGETS),
    VISIBLE_CONTROL_DECLARATIONS,
  ),
  cssRule(
    sectionHeaderStateSelectors(SIDEBAR_SECTION_HEADER_ACTION_CONTROL_TARGETS),
    VISIBLE_CONTROL_DECLARATIONS,
  ),
  cssRule(
    sectionHeaderStateSelectors(SIDEBAR_SECTION_HEADER_ACTION_CONTROL_TARGETS),
    SIDEBAR_ACTION_BASE_COLOR_DECLARATIONS,
  ),
  cssRule(
    sectionHeaderStateSelectors(SIDEBAR_SECTION_HEADER_ACTION_HOVER_CONTROL_TARGETS),
    SIDEBAR_ACTION_HOVER_COLOR_DECLARATIONS,
  ),
  cssRule(
    sectionHeaderStateSelectors(SIDEBAR_SECTION_HEADER_ACTION_ICON_TARGETS),
    VISIBLE_ICON_DECLARATIONS,
  ),
  cssRule(
    SIDEBAR_SECTION_TOGGLE_ICON_TARGETS,
    VISIBLE_ICON_DECLARATIONS,
  ),
  cssRule(
    descendantSelectors(
      SIDEBAR_THREAD_ROW_SELECTOR,
      SIDEBAR_THREAD_ROW_STOP_BUTTON_TARGETS,
    ),
    SIDEBAR_THREAD_ROW_STOP_BUTTON_DECLARATIONS,
  ),
  cssRule(
    rowStateSelectors(SIDEBAR_THREAD_ROW_SELECTOR, SIDEBAR_THREAD_ROW_META_CONTENT_TARGETS, [
      "[data-app-action-sidebar-thread-active='true']",
    ]),
    HIDDEN_META_RAIL_DECLARATIONS,
  ),
  cssRule(
    rowStateSelectors(SIDEBAR_THREAD_ROW_SELECTOR, SIDEBAR_THREAD_ROW_TITLE_TARGETS, [
      "[data-app-action-sidebar-thread-active='true']",
    ]),
    SIDEBAR_THREAD_ROW_TITLE_ACTION_RESERVE_DECLARATIONS,
  ),
  cssRule(
    rowStateSelectors(SIDEBAR_THREAD_ROW_SELECTOR, SIDEBAR_THREAD_ROW_TITLE_TEXT_TARGETS, [
      "[data-app-action-sidebar-thread-active='true']",
    ]),
    SIDEBAR_THREAD_ROW_TITLE_TEXT_DECLARATIONS,
  ),
  cssRule(
    rowStateSelectors(SIDEBAR_THREAD_ROW_SELECTOR, SIDEBAR_THREAD_ROW_ACTION_WRAPPER_TARGETS, [
      "[data-app-action-sidebar-thread-active='true']",
    ]),
    VISIBLE_CONTROL_DECLARATIONS,
  ),
  cssRule(
    rowStateSelectors(SIDEBAR_PROJECT_ROW_SELECTOR, SIDEBAR_PROJECT_ACTION_OVERLAY_TARGETS, [
      "[aria-current='page']",
    ]),
    HIDDEN_DISPLAY_DECLARATIONS,
  ),
  cssRule(
    rowStateSelectors(SIDEBAR_PROJECT_ROW_SELECTOR, SIDEBAR_PROJECT_ACTION_WRAPPER_TARGETS, [
      "[aria-current='page']",
    ]),
    VISIBLE_CONTROL_DECLARATIONS,
  ),
  cssRule(
    rowStateSelectors(SIDEBAR_PROJECT_ROW_SELECTOR, SIDEBAR_PROJECT_ACTION_CONTROL_TARGETS, [
      "[aria-current='page']",
    ]),
    VISIBLE_CONTROL_DECLARATIONS,
  ),
  cssRule(
    rowStateSelectors(SIDEBAR_PROJECT_ROW_SELECTOR, SIDEBAR_PROJECT_ACTION_CONTROL_TARGETS, [
      "[aria-current='page']",
    ]),
    SIDEBAR_ACTION_BASE_COLOR_DECLARATIONS,
  ),
  cssRule(
    rowStateSelectors(
      SIDEBAR_PROJECT_ROW_SELECTOR,
      SIDEBAR_PROJECT_ACTION_HOVER_CONTROL_TARGETS,
      ["[aria-current='page']"],
    ),
    SIDEBAR_ACTION_HOVER_COLOR_DECLARATIONS,
  ),
  cssRule(
    rowStateSelectors(SIDEBAR_THREAD_ROW_SELECTOR, SIDEBAR_ACTION_CONTROL_TARGETS, [
      "[data-app-action-sidebar-thread-active='true']",
    ]),
    VISIBLE_CONTROL_DECLARATIONS,
  ),
  cssRule(
    rowStateSelectors(SIDEBAR_THREAD_ROW_SELECTOR, SIDEBAR_ACTION_CONTROL_TARGETS, [
      "[data-app-action-sidebar-thread-active='true']",
    ]),
    SIDEBAR_ACTION_BASE_COLOR_DECLARATIONS,
  ),
  cssRule(
    rowStateSelectors(SIDEBAR_THREAD_ROW_SELECTOR, SIDEBAR_ACTION_HOVER_CONTROL_TARGETS, [
      "[data-app-action-sidebar-thread-active='true']",
    ]),
    SIDEBAR_ACTION_HOVER_COLOR_DECLARATIONS,
  ),
  cssRule(
    rowStateSelectors(SIDEBAR_PROJECT_ROW_SELECTOR, SIDEBAR_PROJECT_ACTION_ICON_TARGETS, [
      "[aria-current='page']",
    ]),
    VISIBLE_ICON_DECLARATIONS,
  ),
  cssRule(
    rowStateSelectors(SIDEBAR_THREAD_ROW_SELECTOR, SIDEBAR_ACTION_ICON_TARGETS, [
      "[data-app-action-sidebar-thread-active='true']",
    ]),
    VISIBLE_ICON_DECLARATIONS,
  ),
];

const RIGHT_PANEL_TAB_STYLE_RULES = [
  cssRule(
    interactiveSelectors("[data-app-shell-tab-controller='right'] .group\\/tab", [
      " [role='button'].absolute.inset-y-0.start-0",
    ]),
    VISIBLE_FLEX_CONTROL_DECLARATIONS,
  ),
  cssRule(
    interactiveSelectors("[data-app-shell-tab-controller='right'] .group\\/tab", [
      " [role='button'].absolute.inset-y-0.start-0 svg",
      " [role='button'].absolute.inset-y-0.start-0 .icon-xs",
    ]),
    VISIBLE_ICON_DECLARATIONS,
  ),
];

const IMAGE_PREVIEW_STYLE_RULES = [
  cssRule(
    ".absolute.top-3.right-3.z-10.flex.items-center.gap-2",
    "top:calc(0.75rem + 26px)!important;",
  ),
];

const SETTINGS_STYLE_RULES = [
  cssRule(
    ".main-surface>.draggable.flex.items-center.px-panel.electron\\:h-toolbar.extension\\:h-toolbar-sm:not(:has(*))+.scrollbar-stable.flex-1.overflow-y-auto.p-panel",
    "padding-top:0.5rem!important;padding-bottom:4rem!important;",
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
];

const SIDEBAR_FOOTER_STYLE_RULES = [
  cssRule(
    `${SIDEBAR_ROOT_SELECTOR} button:has(svg path[d^="M10.6391 1.67517"]) svg`,
    "margin-right:1px!important;",
  ),
  cssRule(
    SIDEBAR_PROJECT_GROUP_OVERFLOW_BUTTON_SELECTOR,
    SIDEBAR_PROJECT_GROUP_OVERFLOW_BUTTON_DECLARATIONS,
  ),
];

const INVITE_FRIEND_STYLE_RULES = [
  cssRule(INVITE_FRIEND_MENU_ITEM_SELECTOR, INVITE_FRIEND_MENU_ITEM_DECLARATIONS),
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
  cssRule(PROFILE_DROPDOWN_INVITE_SELECTOR, USAGE_MENU_LINK_DECLARATIONS),
];

const STYLE_RULES = [
  ...BASE_STYLE_RULES,
  ...SIDEBAR_PIXEL_NUDGE_STYLE_RULES,
  ...SIDEBAR_HOVER_CONTROL_STYLE_RULES,
  ...RIGHT_PANEL_TAB_STYLE_RULES,
  ...IMAGE_PREVIEW_STYLE_RULES,
  ...SETTINGS_STYLE_RULES,
  ...CODEX_PLUSPLUS_SETTINGS_NAV_STYLE_RULES,
  ...SIDEBAR_FOOTER_STYLE_RULES,
  ...INVITE_FRIEND_STYLE_RULES,
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

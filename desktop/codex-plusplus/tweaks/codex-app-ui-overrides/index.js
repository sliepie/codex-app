const STYLE_ID = "codex-app-ui-overrides-style";

const VISIBLE_CONTROL_DECLARATIONS =
  "opacity:1!important;pointer-events:auto!important;visibility:visible!important;";
const VISIBLE_FLEX_CONTROL_DECLARATIONS = `display:flex!important;${VISIBLE_CONTROL_DECLARATIONS}`;
const VISIBLE_ICON_DECLARATIONS =
  "opacity:1!important;visibility:visible!important;";
const HIDDEN_META_DECLARATIONS =
  "opacity:0!important;pointer-events:none!important;";
const SIDEBAR_CHATS_HEADER_DECLARATIONS =
  "position:relative!important;left:-1px!important;";
const HIDDEN_CONTROL_DECLARATIONS = "opacity:0!important;";
const HIDDEN_DISPLAY_DECLARATIONS = "display:none!important;";
const SIDEBAR_HOVER_CONTROL_MOTION_DECLARATIONS =
  "transition:opacity 120ms ease-out,transform 120ms ease-out!important;transform:translateX(2px)!important;";
const SIDEBAR_HOVER_CONTROL_ACTIVE_MOTION_DECLARATIONS =
  "transform:translateX(0)!important;";
const SIDEBAR_THREAD_ROW_META_MOTION_DECLARATIONS =
  "transition:opacity 120ms ease-out!important;";
const SIDEBAR_PROJECT_ROW_ICON_SELECTOR =
  ">.flex.min-w-0.flex-1.items-center.gap-1.pl-1>.relative.flex.h-6.w-6.items-center.justify-center";
const SIDEBAR_THREAD_ROW_SELECTOR = "[data-app-action-sidebar-thread-row]";
const SIDEBAR_THREAD_ROW_META_TARGETS = [
  " .ml-\\[3px\\].flex.items-center.justify-end.gap-1:not(:has(button))",
  " .ml-\\[3px\\].flex.items-center.justify-end.gap-1>:not(:has(button))",
];
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
const USAGE_MENU_RATE_ROWS_DECLARATIONS =
  "padding-left:calc(var(--padding-row-x) + 1.25rem + 2px)!important;padding-right:var(--padding-row-x)!important;";
const USAGE_MENU_LINK_DECLARATIONS = "display:none!important;";
const CODEX_PLUSPLUS_SETTINGS_NAV_ROOT_SELECTOR =
  ":where(aside,nav,[role='navigation'],div):has(>[data-codexpp=\"nav-group\"])";
const CODEX_PLUSPLUS_SETTINGS_NAV_SPACER_SELECTORS = [
  `${CODEX_PLUSPLUS_SETTINGS_NAV_ROOT_SELECTOR}>[class~=\"flex-1\"]`,
  `${CODEX_PLUSPLUS_SETTINGS_NAV_ROOT_SELECTOR}>[class~=\"grow\"]`,
];
const SIDEBAR_MOBILE_BUTTON_SELECTOR = [
  ":where(aside,nav,[role='navigation']) :is(a,button,[role='button'])[aria-label*='mobile' i]",
  ":where(aside,nav,[role='navigation']) :is(a,button,[role='button'])[title*='mobile' i]",
  ":where(aside,nav,[role='navigation']) :is(a,button,[role='button'])[aria-label*='phone' i]",
  ":where(aside,nav,[role='navigation']) :is(a,button,[role='button'])[title*='phone' i]",
];
const SIDEBAR_MOBILE_BUTTON_DECLARATIONS = "display:none!important;";

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

const BASE_STYLE_RULES = [
  cssRule(".group\\/application-menu-top-bar", "margin-inline-start:0.5rem;"),
  cssRule(
    '[style*="view-transition-name: sidebar-trigger"]',
    "transform:translateX(2px);",
  ),
];

const SIDEBAR_PIXEL_NUDGE_STYLE_RULES = [
  cssRule(
    ".group\\/chats-section-header",
    SIDEBAR_CHATS_HEADER_DECLARATIONS,
  ),
  cssRule(
    [
      '[data-app-action-sidebar-section-heading="Pinned"] [data-app-action-sidebar-thread-row]:not(:has(.absolute.top-0.left-1.z-10)) [data-thread-title-trigger]',
      '[data-app-action-sidebar-section-heading="Chats"] [data-app-action-sidebar-thread-row]:not(:has(.absolute.top-0.left-1.z-10)) [data-thread-title-trigger]',
    ],
    "position:relative!important;left:-2px!important;",
  ),
];
const SIDEBAR_HOVER_CONTROL_MOTION_RULES = [
  cssRule(
    [
      ...descendantSelectors(".group\\/section-toggle", [
        " .group-hover\\/section-toggle\\:opacity-100",
        " .group-focus-visible\\/section-toggle\\:opacity-100",
      ]),
      ...descendantSelectors(".group\\/projects-section-header", [
        " .group-hover\\/projects-section-header\\:opacity-100",
        " .group-focus-within\\/projects-section-header\\:opacity-100",
      ]),
      ...descendantSelectors(".group\\/chats-section-header", [
        " .group-hover\\/chats-section-header\\:opacity-100",
        " .group-focus-within\\/chats-section-header\\:opacity-100",
      ]),
      ...descendantSelectors(".group\\/folder-row", [
        " .group-hover\\/folder-row\\:opacity-100",
      ]),
    ],
    SIDEBAR_HOVER_CONTROL_MOTION_DECLARATIONS,
  ),
  cssRule(
    [
      ...interactiveSelectors(".group\\/section-toggle", [
        " .group-hover\\/section-toggle\\:opacity-100",
        " .group-focus-visible\\/section-toggle\\:opacity-100",
      ]),
      ...interactiveSelectors(".group\\/projects-section-header", [
        " .group-hover\\/projects-section-header\\:opacity-100",
        " .group-focus-within\\/projects-section-header\\:opacity-100",
      ]),
      ...interactiveSelectors(".group\\/chats-section-header", [
        " .group-hover\\/chats-section-header\\:opacity-100",
        " .group-focus-within\\/chats-section-header\\:opacity-100",
      ]),
      ...interactiveSelectors(".group\\/folder-row", [
        " .group-hover\\/folder-row\\:opacity-100",
      ]),
    ],
    SIDEBAR_HOVER_CONTROL_ACTIVE_MOTION_DECLARATIONS,
  ),
];

const SIDEBAR_HOVER_CONTROL_STYLE_RULES = [
  cssRule(
    descendantSelectors(
      SIDEBAR_THREAD_ROW_SELECTOR,
      SIDEBAR_THREAD_ROW_META_TARGETS,
    ),
    SIDEBAR_THREAD_ROW_META_MOTION_DECLARATIONS,
  ),
  cssRule(
    descendantSelectors(
      SIDEBAR_THREAD_ROW_SELECTOR,
      SIDEBAR_THREAD_ROW_STOP_BUTTON_TARGETS,
    ),
    SIDEBAR_THREAD_ROW_STOP_BUTTON_DECLARATIONS,
  ),
  cssRule(
    interactiveSelectors(SIDEBAR_THREAD_ROW_SELECTOR, SIDEBAR_THREAD_ROW_META_TARGETS),
    HIDDEN_META_DECLARATIONS,
  ),
  cssRule(
    interactiveSelectors(".group\\/section-toggle", [
      " .group-hover\\/section-toggle\\:opacity-100",
      " .group-focus-visible\\/section-toggle\\:opacity-100",
    ]),
    VISIBLE_ICON_DECLARATIONS,
  ),
  cssRule(
    interactiveSelectors(".group\\/projects-section-header", [
      " .group-hover\\/projects-section-header\\:opacity-100",
      " .group-focus-within\\/projects-section-header\\:opacity-100",
    ]),
    VISIBLE_CONTROL_DECLARATIONS,
  ),
  cssRule(
    interactiveSelectors(".group\\/chats-section-header", [
      " .group-hover\\/chats-section-header\\:opacity-100",
      " .group-focus-within\\/chats-section-header\\:opacity-100",
    ]),
    VISIBLE_CONTROL_DECLARATIONS,
  ),
  cssRule(
    interactiveSelectors(".group\\/folder-row", [
      " .group-hover\\/folder-row\\:opacity-100",
    ]),
    VISIBLE_CONTROL_DECLARATIONS,
  ),
  cssRule(
    interactiveSelectors(".group\\/folder-row", [
      " .group-hover\\/folder-row\\:opacity-0",
    ]),
    HIDDEN_CONTROL_DECLARATIONS,
  ),
  cssRule(
    interactiveSelectors(".group\\/folder-row", [
      " .group-hover\\/folder-row\\:hidden",
    ]),
    HIDDEN_DISPLAY_DECLARATIONS,
  ),
  cssRule(
    interactiveSelectors(".group\\/folder-row", [
      SIDEBAR_PROJECT_ROW_ICON_SELECTOR +
        " .group-hover\\/folder-row\\:opacity-0",
    ]),
    VISIBLE_ICON_DECLARATIONS,
  ),
  cssRule(
    interactiveSelectors(".group\\/folder-row", [
      SIDEBAR_PROJECT_ROW_ICON_SELECTOR +
        " .group-hover\\/folder-row\\:opacity-100",
    ]),
    HIDDEN_CONTROL_DECLARATIONS,
  ),
  mediaRule(
    "(prefers-reduced-motion:no-preference)",
    SIDEBAR_HOVER_CONTROL_MOTION_RULES,
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
  cssRule(SIDEBAR_MOBILE_BUTTON_SELECTOR, SIDEBAR_MOBILE_BUTTON_DECLARATIONS),
];

const USAGE_MENU_STYLE_RULES = [
  cssRule(
    ".flex.flex-col.text-sm>.grid.items-center.gap-y-1\\.5.py-1",
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
  ...SIDEBAR_PIXEL_NUDGE_STYLE_RULES,
  ...SIDEBAR_HOVER_CONTROL_STYLE_RULES,
  ...RIGHT_PANEL_TAB_STYLE_RULES,
  ...IMAGE_PREVIEW_STYLE_RULES,
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

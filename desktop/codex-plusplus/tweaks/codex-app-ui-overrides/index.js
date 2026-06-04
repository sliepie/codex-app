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
const SIDEBAR_THREAD_TITLE_BASE_DECLARATIONS =
  "box-sizing:border-box!important;min-width:0!important;max-width:100%!important;";
const SIDEBAR_THREAD_TITLE_LEFT_OFFSET_DECLARATIONS =
  "padding-inline-start:1.25rem!important;";
const SIDEBAR_THREAD_TITLE_RIGHT_OFFSET_DECLARATIONS =
  "padding-inline-end:1rem!important;";
const SIDEBAR_THREAD_TITLE_TEXT_DECLARATIONS =
  "display:block!important;min-width:0!important;max-width:100%!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;word-break:normal!important;";
const HIDDEN_CONTROL_DECLARATIONS = "opacity:0!important;";
const HIDDEN_DISPLAY_DECLARATIONS = "display:none!important;";
const SIDEBAR_HOVER_CONTROL_SLIDE_IN_KEYFRAMES_RULE =
  "@keyframes codex-app-sidebar-hover-control-slide-in{from{transform:translateX(2px);}to{transform:translateX(0);}}";
const SIDEBAR_HOVER_CONTROL_MOTION_DECLARATIONS =
  "transition:opacity 120ms ease-out,transform 120ms ease-out!important;transform:translateX(0);";
const SIDEBAR_HOVER_CONTROL_ACTIVE_MOTION_DECLARATIONS =
  "animation:codex-app-sidebar-hover-control-slide-in 120ms ease-out!important;transform:translateX(0);";
const SIDEBAR_HOVER_CONTROL_ACTIVE_STATE_SELECTOR =
  ":is(:active,[aria-expanded=\"true\"],[data-state=\"open\"])";
const SIDEBAR_THREAD_ROW_ACTION_MOTION_DECLARATIONS =
  "transition:opacity 120ms ease-out!important;";
const SIDEBAR_THREAD_ROW_META_MOTION_DECLARATIONS =
  "transition:opacity 120ms ease-out!important;";
const SIDEBAR_PROJECT_ROW_ICON_SELECTOR =
  ">.flex.min-w-0.flex-1.items-center.gap-1.pl-1>.relative.flex.h-6.w-6.items-center.justify-center";
const SIDEBAR_PROJECTS_HEADER_COLLAPSE_CONTROL_TARGET_SELECTOR =
  ':is(button,[role="button"]):is([aria-label*="collapse" i],[aria-label*="revert" i],[title*="collapse" i],[title*="revert" i],[data-testid*="collapse" i],[data-testid*="revert" i])';
const SIDEBAR_PROJECTS_HEADER_COLLAPSE_CONTROL_SELECTOR = [
  `.group\\/projects-section-header ${SIDEBAR_PROJECTS_HEADER_COLLAPSE_CONTROL_TARGET_SELECTOR}`,
  `.group\\/projects-section-header :is(span,div):has(>${SIDEBAR_PROJECTS_HEADER_COLLAPSE_CONTROL_TARGET_SELECTOR}:only-child)`,
];
const SIDEBAR_FOLDER_ROW_ACTIONS_SELECTOR =
  '.group\\/folder-row :is([class~="gap-0.5"],[class~="gap-1"],[class~="gap-1.5"],[class~="gap-2"]):has(>.group-hover\\/folder-row\\:opacity-100)';
const SIDEBAR_FOLDER_ROW_ACTIONS_DECLARATIONS = "gap:0!important;";
const SIDEBAR_THREAD_ROW_SELECTOR = "[data-app-action-sidebar-thread-row]";
const SIDEBAR_THREAD_ROW_WITH_ACTION_SLOT_SELECTOR = `${SIDEBAR_THREAD_ROW_SELECTOR}:has(.absolute.top-0.left-1.z-10,>.absolute.right-0.top-0.z-10)`;
const SIDEBAR_THREAD_ROW_ACTION_SLOT_TARGETS = [
  " .absolute.top-0.left-1.z-10",
  " .w-4 span:has(button)",
  ">.absolute.right-0.top-0.z-10",
];
const SIDEBAR_THREAD_ROW_META_TARGETS = [
  " .ml-\\[3px\\].flex.items-center.justify-end.gap-1:not(:has(button))",
  " .ml-\\[3px\\].flex.items-center.justify-end.gap-1>:not(:has(button))",
];
const SIDEBAR_THREAD_ROW_ACTION_RAIL_TARGETS = [
  " .ml-\\[3px\\].flex.items-center.justify-end.gap-1:has(button)",
];
const SIDEBAR_THREAD_ROW_ACTION_TARGETS = [
  " .absolute.top-0.left-1.z-10",
  " .absolute.top-0.left-1.z-10 button",
  " .w-4 span:has(button)",
  " .w-4 span:has(button) button",
  ">.absolute.right-0.top-0.z-10",
  ">.absolute.right-0.top-0.z-10 button",
];
const SIDEBAR_THREAD_ROW_ACTION_ICON_TARGETS = [
  " .absolute.top-0.left-1.z-10 button svg",
  " .absolute.top-0.left-1.z-10 button .icon-xs",
  " .absolute.top-0.left-1.z-10 button .icon-sm",
  " .w-4 span:has(button) button svg",
  " .w-4 span:has(button) button .icon-2xs",
  " .w-4 span:has(button) button .icon-xs",
  ">.absolute.right-0.top-0.z-10 button svg",
  ">.absolute.right-0.top-0.z-10 button .icon-xs",
  ">.absolute.right-0.top-0.z-10 button .icon-sm",
];
const SIDEBAR_THREAD_ROW_ACTION_PAIR_BUTTON_TARGETS = [
  '>.absolute.right-0.top-0.z-10:has(button[aria-label*="pin" i]):has(button[aria-label*="archive" i]) button:is([aria-label*="pin" i],[aria-label*="archive" i])',
];
const SIDEBAR_THREAD_ROW_ACTION_SLOT_DECLARATIONS = "gap:0!important;";
const SIDEBAR_THREAD_ROW_ACTION_PAIR_BUTTON_DECLARATIONS =
  "width:1rem!important;min-width:1rem!important;max-width:1rem!important;padding:0!important;";
const SIDEBAR_THREAD_ROW_ACTION_RAIL_DECLARATIONS = "gap:0!important;";
const SIDEBAR_THREAD_ROW_GROUP_HOVER_POINTER_TARGETS = [
  " .group-hover\\:pointer-events-auto",
];
const SIDEBAR_THREAD_ROW_GROUP_HOVER_VISIBLE_TARGETS = [
  " .group-hover\\:opacity-100",
];
const SIDEBAR_THREAD_ROW_GROUP_HOVER_MUTED_TARGETS = [
  " .group-hover\\:opacity-50",
];
const SIDEBAR_THREAD_ROW_GROUP_HOVER_HIDDEN_TARGETS = [
  " .group-hover\\:opacity-0",
];
const SIDEBAR_THREAD_ROW_GROUP_HOVER_DISPLAY_TARGETS = [
  " .group-hover\\:hidden",
];
const SIDEBAR_THREAD_ROW_GROUP_HOVER_MIN_WIDTH_RULES = [
  cssRule(
    interactiveSelectors(SIDEBAR_THREAD_ROW_SELECTOR, [
      " .group-hover\\:min-w-5",
    ]),
    "min-width:calc(var(--spacing) * 5)!important;",
  ),
  cssRule(
    interactiveSelectors(SIDEBAR_THREAD_ROW_SELECTOR, [
      " .group-hover\\:min-w-12",
    ]),
    "min-width:calc(var(--spacing) * 9)!important;",
  ),
  cssRule(
    interactiveSelectors(SIDEBAR_THREAD_ROW_SELECTOR, [
      " .group-hover\\:min-w-20",
    ]),
    "min-width:calc(var(--spacing) * 14)!important;",
  ),
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

function statefulContainerSelectors(container, targets, stateSelector) {
  return targets.map((target) => `${container}:has(${stateSelector})${target}`);
}

const BASE_STYLE_RULES = [
  cssRule(".group\\/windows-top-bar", "margin-inline-start:0.5rem;"),
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
  SIDEBAR_HOVER_CONTROL_SLIDE_IN_KEYFRAMES_RULE,
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
    ],
    SIDEBAR_HOVER_CONTROL_MOTION_DECLARATIONS,
  ),
  cssRule(
    [
      ...statefulContainerSelectors(
        ".group\\/section-toggle",
        [
          " .group-hover\\/section-toggle\\:opacity-100",
          " .group-focus-visible\\/section-toggle\\:opacity-100",
        ],
        SIDEBAR_HOVER_CONTROL_ACTIVE_STATE_SELECTOR,
      ),
      ...statefulContainerSelectors(
        ".group\\/projects-section-header",
        [
          " .group-hover\\/projects-section-header\\:opacity-100",
          " .group-focus-within\\/projects-section-header\\:opacity-100",
        ],
        SIDEBAR_HOVER_CONTROL_ACTIVE_STATE_SELECTOR,
      ),
      ...statefulContainerSelectors(
        ".group\\/chats-section-header",
        [
          " .group-hover\\/chats-section-header\\:opacity-100",
          " .group-focus-within\\/chats-section-header\\:opacity-100",
        ],
        SIDEBAR_HOVER_CONTROL_ACTIVE_STATE_SELECTOR,
      ),
    ],
    SIDEBAR_HOVER_CONTROL_ACTIVE_MOTION_DECLARATIONS,
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
    ],
    SIDEBAR_HOVER_CONTROL_ACTIVE_MOTION_DECLARATIONS,
  ),
];

const SIDEBAR_HOVER_CONTROL_STYLE_RULES = [
  cssRule(
    SIDEBAR_PROJECTS_HEADER_COLLAPSE_CONTROL_SELECTOR,
    HIDDEN_DISPLAY_DECLARATIONS,
  ),
  cssRule(
    SIDEBAR_FOLDER_ROW_ACTIONS_SELECTOR,
    SIDEBAR_FOLDER_ROW_ACTIONS_DECLARATIONS,
  ),
  cssRule(
    descendantSelectors(
      SIDEBAR_THREAD_ROW_SELECTOR,
      SIDEBAR_THREAD_ROW_ACTION_SLOT_TARGETS,
    ),
    SIDEBAR_THREAD_ROW_ACTION_MOTION_DECLARATIONS,
  ),
  cssRule(
    descendantSelectors(
      SIDEBAR_THREAD_ROW_SELECTOR,
      SIDEBAR_THREAD_ROW_META_TARGETS,
    ),
    SIDEBAR_THREAD_ROW_META_MOTION_DECLARATIONS,
  ),
  cssRule(
    interactiveSelectors(
      SIDEBAR_THREAD_ROW_SELECTOR,
      SIDEBAR_THREAD_ROW_ACTION_TARGETS,
    ),
    VISIBLE_CONTROL_DECLARATIONS,
  ),
  cssRule(
    descendantSelectors(
      SIDEBAR_THREAD_ROW_SELECTOR,
      SIDEBAR_THREAD_ROW_ACTION_SLOT_TARGETS,
    ),
    SIDEBAR_THREAD_ROW_ACTION_SLOT_DECLARATIONS,
  ),
  cssRule(
    descendantSelectors(
      SIDEBAR_THREAD_ROW_SELECTOR,
      SIDEBAR_THREAD_ROW_ACTION_PAIR_BUTTON_TARGETS,
    ),
    SIDEBAR_THREAD_ROW_ACTION_PAIR_BUTTON_DECLARATIONS,
  ),
  cssRule(
    descendantSelectors(
      SIDEBAR_THREAD_ROW_SELECTOR,
      SIDEBAR_THREAD_ROW_ACTION_RAIL_TARGETS,
    ),
    SIDEBAR_THREAD_ROW_ACTION_RAIL_DECLARATIONS,
  ),
  cssRule(
    interactiveSelectors(
      SIDEBAR_THREAD_ROW_SELECTOR,
      SIDEBAR_THREAD_ROW_ACTION_ICON_TARGETS,
    ),
    VISIBLE_ICON_DECLARATIONS,
  ),
  cssRule(
    interactiveSelectors(
      SIDEBAR_THREAD_ROW_SELECTOR,
      SIDEBAR_THREAD_ROW_GROUP_HOVER_POINTER_TARGETS,
    ),
    "pointer-events:auto!important;",
  ),
  cssRule(
    interactiveSelectors(
      SIDEBAR_THREAD_ROW_SELECTOR,
      SIDEBAR_THREAD_ROW_GROUP_HOVER_VISIBLE_TARGETS,
    ),
    VISIBLE_ICON_DECLARATIONS,
  ),
  cssRule(
    interactiveSelectors(
      SIDEBAR_THREAD_ROW_SELECTOR,
      SIDEBAR_THREAD_ROW_GROUP_HOVER_MUTED_TARGETS,
    ),
    "opacity:.5!important;visibility:visible!important;",
  ),
  cssRule(
    interactiveSelectors(
      SIDEBAR_THREAD_ROW_SELECTOR,
      SIDEBAR_THREAD_ROW_GROUP_HOVER_HIDDEN_TARGETS,
    ),
    HIDDEN_CONTROL_DECLARATIONS,
  ),
  cssRule(
    interactiveSelectors(
      SIDEBAR_THREAD_ROW_SELECTOR,
      SIDEBAR_THREAD_ROW_GROUP_HOVER_DISPLAY_TARGETS,
    ),
    HIDDEN_DISPLAY_DECLARATIONS,
  ),
  ...SIDEBAR_THREAD_ROW_GROUP_HOVER_MIN_WIDTH_RULES,
  cssRule(
    interactiveSelectors(
      SIDEBAR_THREAD_ROW_WITH_ACTION_SLOT_SELECTOR,
      [" [data-thread-title-trigger]"],
    ),
    SIDEBAR_THREAD_TITLE_BASE_DECLARATIONS,
  ),
  cssRule(
    interactiveSelectors(
      `${SIDEBAR_THREAD_ROW_SELECTOR}:has(.absolute.top-0.left-1.z-10)`,
      [" [data-thread-title-trigger]"],
    ),
    SIDEBAR_THREAD_TITLE_LEFT_OFFSET_DECLARATIONS,
  ),
  cssRule(
    interactiveSelectors(
      `${SIDEBAR_THREAD_ROW_SELECTOR}:has(>.absolute.right-0.top-0.z-10)`,
      [" [data-thread-title-trigger]"],
    ),
    SIDEBAR_THREAD_TITLE_RIGHT_OFFSET_DECLARATIONS,
  ),
  cssRule(
    interactiveSelectors(
      SIDEBAR_THREAD_ROW_WITH_ACTION_SLOT_SELECTOR,
      [
        " [data-thread-title-trigger]>:first-child",
        " [data-thread-title-trigger] .truncate",
        " [data-thread-title-trigger] .whitespace-pre-wrap",
        " [data-thread-title-trigger] .break-all",
      ],
    ),
    SIDEBAR_THREAD_TITLE_TEXT_DECLARATIONS,
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

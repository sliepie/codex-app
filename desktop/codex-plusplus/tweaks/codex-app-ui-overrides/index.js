const STYLE_ID = "codex-app-ui-overrides-style";

const VISIBLE_CONTROL_DECLARATIONS =
  "opacity:1!important;pointer-events:auto!important;visibility:visible!important;";
const VISIBLE_FLEX_CONTROL_DECLARATIONS = `display:flex!important;${VISIBLE_CONTROL_DECLARATIONS}`;
const VISIBLE_ICON_DECLARATIONS =
  "opacity:1!important;visibility:visible!important;";
const HIDDEN_META_DECLARATIONS =
  "opacity:0!important;visibility:hidden!important;";
const HIDDEN_CONTROL_DECLARATIONS =
  "display:none!important;opacity:0!important;pointer-events:none!important;visibility:hidden!important;";
const SIDEBAR_THREAD_TITLE_OFFSET_DECLARATIONS =
  "padding-inline-start:1.25rem!important;";
const SIDEBAR_PIN_BUTTON_DECLARATIONS =
  "cursor:pointer!important;";
const SIDEBAR_PROJECT_PIN_BUTTON_DECLARATIONS =
  "cursor:pointer!important;width:1.25rem!important;height:1.25rem!important;min-width:1.25rem!important;flex:0 0 1.25rem!important;";
const SIDEBAR_ABSOLUTE_PIN_BUTTON_DECLARATIONS =
  "cursor:pointer!important;width:1.25rem!important;height:1.25rem!important;";
const SIDEBAR_CHATS_ABSOLUTE_PIN_BUTTON_DECLARATIONS =
  "cursor:pointer!important;width:1rem!important;height:1rem!important;min-width:1rem!important;flex:0 0 1rem!important;";
const SIDEBAR_PIN_ICON_DECLARATIONS =
  "width:0.875rem!important;height:0.875rem!important;min-width:0.875rem!important;min-height:0.875rem!important;";
const SIDEBAR_CHATS_PIN_ICON_DECLARATIONS =
  "width:0.75rem!important;height:0.75rem!important;min-width:0.75rem!important;min-height:0.75rem!important;";
const SIDEBAR_ABSOLUTE_PIN_ICON_DECLARATIONS =
  SIDEBAR_PIN_ICON_DECLARATIONS;
const SIDEBAR_CHATS_THREAD_TITLE_TRANSITION_DECLARATIONS =
  "position:relative!important;left:-2px!important;transition:padding-inline-start 180ms ease,left 180ms ease!important;";
const SIDEBAR_CHATS_THREAD_TITLE_NUDGE_DECLARATIONS =
  "left:-2px!important;";
const SIDEBAR_CHATS_THREAD_TITLE_NO_OFFSET_DECLARATIONS =
  "padding-inline-start:0!important;left:-2px!important;";
const SIDEBAR_CHATS_THREAD_ROW_SELECTOR =
  '[data-app-action-sidebar-section-heading="Chats"] [data-app-action-sidebar-thread-row][data-app-action-sidebar-thread-kind="local"]';
const USAGE_MENU_CONTENT_SELECTOR =
  ".flex.flex-col.text-sm:has(>.grid.items-center.gap-y-1\\.5.py-1)";
const USAGE_MENU_RATE_ROWS_DECLARATIONS =
  "padding-left:calc(var(--padding-row-x) + 1.25rem + 2px)!important;padding-right:var(--padding-row-x)!important;";
const USAGE_MENU_LINK_DECLARATIONS = "display:none!important;";
function cssRule(selectors, declarations) {
  const selector = Array.isArray(selectors) ? selectors.join(",") : selectors;
  return `${selector}{${declarations}}`;
}

function interactiveSelectors(container, targets) {
  return targets.map((target) => `${container}:is(:hover,:focus-within)${target}`);
}

const BASE_STYLE_RULES = [
  cssRule(".group\\/windows-top-bar", "margin-inline-start:0.5rem;"),
  cssRule(
    '[style*="view-transition-name: sidebar-trigger"]',
    "transform:translateX(2px);",
  ),
];

const SIDEBAR_ACTION_STYLE_RULES = [
  cssRule(
    [
      "[data-app-action-sidebar-thread-row] .w-4 span:has(button) button",
      "[data-app-action-sidebar-thread-row]>.absolute.right-0.top-0.z-10 button",
    ],
    SIDEBAR_PIN_BUTTON_DECLARATIONS,
  ),
  cssRule(
    "[data-app-action-sidebar-thread-row] .absolute.top-0.left-1.z-10 button",
    SIDEBAR_ABSOLUTE_PIN_BUTTON_DECLARATIONS,
  ),
  cssRule(
    `${SIDEBAR_CHATS_THREAD_ROW_SELECTOR}>.absolute.top-0.left-1.z-10 button`,
    SIDEBAR_CHATS_ABSOLUTE_PIN_BUTTON_DECLARATIONS,
  ),
  cssRule(
    [
      "[data-app-action-sidebar-thread-row] .w-4 span:has(button) button svg",
      "[data-app-action-sidebar-thread-row] .w-4 span:has(button) button .icon-2xs",
      "[data-app-action-sidebar-thread-row] .w-4 span:has(button) button .icon-xs",
      "[data-app-action-sidebar-thread-row]>.absolute.right-0.top-0.z-10 button svg",
      "[data-app-action-sidebar-thread-row]>.absolute.right-0.top-0.z-10 button .icon-xs",
      "[data-app-action-sidebar-thread-row]>.absolute.right-0.top-0.z-10 button .icon-sm",
    ],
    SIDEBAR_PIN_ICON_DECLARATIONS,
  ),
  cssRule(
    [
      "[data-app-action-sidebar-thread-row] .absolute.top-0.left-1.z-10 button svg",
      "[data-app-action-sidebar-thread-row] .absolute.top-0.left-1.z-10 button .icon-xs",
      "[data-app-action-sidebar-thread-row] .absolute.top-0.left-1.z-10 button .icon-sm",
    ],
    SIDEBAR_ABSOLUTE_PIN_ICON_DECLARATIONS,
  ),
  cssRule(
    [
      `${SIDEBAR_CHATS_THREAD_ROW_SELECTOR}>.absolute.top-0.left-1.z-10 button svg`,
      `${SIDEBAR_CHATS_THREAD_ROW_SELECTOR}>.absolute.top-0.left-1.z-10 button .icon-xs`,
      `${SIDEBAR_CHATS_THREAD_ROW_SELECTOR}>.absolute.top-0.left-1.z-10 button .icon-sm`,
    ],
    SIDEBAR_CHATS_PIN_ICON_DECLARATIONS,
  ),
  cssRule(
    `${SIDEBAR_CHATS_THREAD_ROW_SELECTOR} [data-thread-title-trigger]`,
    SIDEBAR_CHATS_THREAD_TITLE_TRANSITION_DECLARATIONS,
  ),
  cssRule(
    `${SIDEBAR_CHATS_THREAD_ROW_SELECTOR}:not(:hover):not(:focus-within) [data-thread-title-trigger]`,
    SIDEBAR_CHATS_THREAD_TITLE_NUDGE_DECLARATIONS,
  ),
  cssRule(
    "[data-app-action-sidebar-project-row] button",
    SIDEBAR_PROJECT_PIN_BUTTON_DECLARATIONS,
  ),
  cssRule(
    [
      "[data-app-action-sidebar-project-row] button svg",
      "[data-app-action-sidebar-project-row] button .icon-xs",
      "[data-app-action-sidebar-project-row] button .icon-sm",
    ],
    SIDEBAR_PIN_ICON_DECLARATIONS,
  ),
  cssRule(
    interactiveSelectors("[data-app-action-sidebar-project-row]", [
      ">.opacity-0",
      " .opacity-0:has(button)",
      " button.opacity-0",
      " button .opacity-0",
    ]),
    VISIBLE_CONTROL_DECLARATIONS,
  ),
  cssRule(
    interactiveSelectors("[data-app-action-sidebar-project-row]", [
      " button svg",
      " button .icon-xs",
      " button .icon-sm",
    ]),
    VISIBLE_ICON_DECLARATIONS,
  ),
  cssRule(
    interactiveSelectors("[data-app-action-sidebar-thread-row]", [
      " .absolute.top-0.left-1.z-10",
      " .absolute.top-0.left-1.z-10 button",
      " .w-4 span:has(button)",
      " .w-4 span:has(button) button",
      ">.absolute.right-0.top-0.z-10",
      ">.absolute.right-0.top-0.z-10 button",
    ]),
    VISIBLE_CONTROL_DECLARATIONS,
  ),
  cssRule(
    interactiveSelectors("[data-app-action-sidebar-thread-row]", [
      " .w-4 span:has(button) button",
    ]),
    SIDEBAR_PIN_BUTTON_DECLARATIONS,
  ),
  cssRule(
    interactiveSelectors("[data-app-action-sidebar-thread-row]", [
      " .absolute.top-0.left-1.z-10 button",
    ]),
    SIDEBAR_ABSOLUTE_PIN_BUTTON_DECLARATIONS,
  ),
  cssRule(
    interactiveSelectors("[data-app-action-sidebar-thread-row]", [
      " .absolute.top-0.left-1.z-10 button svg",
      " .absolute.top-0.left-1.z-10 button .icon-xs",
      " .absolute.top-0.left-1.z-10 button .icon-sm",
      " .w-4 span:has(button) button svg",
      " .w-4 span:has(button) button .icon-2xs",
      " .w-4 span:has(button) button .icon-xs",
      ">.absolute.right-0.top-0.z-10 button svg",
      ">.absolute.right-0.top-0.z-10 button .icon-xs",
      ">.absolute.right-0.top-0.z-10 button .icon-sm",
    ]),
    VISIBLE_ICON_DECLARATIONS,
  ),
  cssRule(
    interactiveSelectors("[data-app-action-sidebar-thread-row]", [
      " .w-4 span:has(button) button svg",
      " .w-4 span:has(button) button .icon-2xs",
      " .w-4 span:has(button) button .icon-xs",
    ]),
    SIDEBAR_PIN_ICON_DECLARATIONS,
  ),
  cssRule(
    interactiveSelectors("[data-app-action-sidebar-thread-row]", [
      " .absolute.top-0.left-1.z-10 button svg",
      " .absolute.top-0.left-1.z-10 button .icon-xs",
      " .absolute.top-0.left-1.z-10 button .icon-sm",
    ]),
    SIDEBAR_ABSOLUTE_PIN_ICON_DECLARATIONS,
  ),
  cssRule(
    interactiveSelectors(
      "[data-app-action-sidebar-thread-row]:has(.absolute.top-0.left-1.z-10)",
      [" [data-thread-title-trigger]"],
    ),
    SIDEBAR_THREAD_TITLE_OFFSET_DECLARATIONS,
  ),
  cssRule(
    `${SIDEBAR_CHATS_THREAD_ROW_SELECTOR}:has(.absolute.top-0.left-1.z-10):is(:hover,:focus-within) [data-thread-title-trigger]`,
    SIDEBAR_CHATS_THREAD_TITLE_NO_OFFSET_DECLARATIONS,
  ),
  cssRule(
    [
      `${SIDEBAR_CHATS_THREAD_ROW_SELECTOR}>.absolute.top-0.left-1.z-10`,
      `${SIDEBAR_CHATS_THREAD_ROW_SELECTOR}>.absolute.top-0.left-1.z-10 button`,
      `${SIDEBAR_CHATS_THREAD_ROW_SELECTOR}>.absolute.top-0.left-1.z-10 button svg`,
      `${SIDEBAR_CHATS_THREAD_ROW_SELECTOR}>.absolute.top-0.left-1.z-10 button .icon-xs`,
      `${SIDEBAR_CHATS_THREAD_ROW_SELECTOR}>.absolute.top-0.left-1.z-10 button .icon-sm`,
    ],
    HIDDEN_CONTROL_DECLARATIONS,
  ),
  cssRule(
    interactiveSelectors("[data-app-action-sidebar-thread-row]", [
      " .ml-\\[3px\\].flex.items-center.justify-end.gap-1:not(:has(button))",
    ]),
    HIDDEN_META_DECLARATIONS,
  ),
  cssRule(
    interactiveSelectors("[data-app-action-sidebar-thread-row]", [
      " .ml-\\[3px\\].flex.items-center.justify-end.gap-1>:not(:has(button))",
    ]),
    HIDDEN_META_DECLARATIONS,
  ),
  cssRule(
    interactiveSelectors(".group\\/folder-row", [
      ">.opacity-0",
      " .opacity-0:has(button)",
      " button.opacity-0",
      " button .opacity-0",
    ]),
    VISIBLE_CONTROL_DECLARATIONS,
  ),
  cssRule(
    interactiveSelectors(".group\\/folder-row", [
      " button svg",
      " button .icon-xs",
      " button .icon-sm",
    ]),
    VISIBLE_ICON_DECLARATIONS,
  ),
  cssRule(
    [
      ...interactiveSelectors(".group\\/projects-section-header", [
        ">.opacity-0",
        " .opacity-0:has(button)",
      ]),
      ...interactiveSelectors(".group\\/chats-section-header", [
        ">.opacity-0",
        " .opacity-0:has(button)",
      ]),
      ...interactiveSelectors(".group\\/custom-section-header", [
        ">.opacity-0",
        " .opacity-0:has(button)",
      ]),
    ],
    VISIBLE_CONTROL_DECLARATIONS,
  ),
  cssRule(
    [
      ...interactiveSelectors(".group\\/projects-section-header", [
        " button svg",
        " button .icon-xs",
        " button .icon-sm",
      ]),
      ...interactiveSelectors(".group\\/chats-section-header", [
        " button svg",
        " button .icon-xs",
        " button .icon-sm",
      ]),
      ...interactiveSelectors(".group\\/custom-section-header", [
        " button svg",
        " button .icon-xs",
        " button .icon-sm",
      ]),
    ],
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
    ".main-surface>.draggable.flex.items-center.px-panel.electron\\:h-toolbar.extension\\:h-toolbar-sm:not(:has(*)):has(+.scrollbar-stable.flex-1.overflow-y-auto.p-panel)",
    "display:none!important;",
  ),
  cssRule(
    ".main-surface>.draggable.flex.items-center.px-panel.electron\\:h-toolbar.extension\\:h-toolbar-sm:not(:has(*))+.scrollbar-stable.flex-1.overflow-y-auto.p-panel",
    "padding-top:0.5rem!important;padding-bottom:4rem!important;",
  ),
];

const USAGE_MENU_STYLE_RULES = [
  cssRule(
    `${USAGE_MENU_CONTENT_SELECTOR}>.grid.items-center.gap-y-1\\.5.py-1`,
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
  ...SIDEBAR_ACTION_STYLE_RULES,
  ...RIGHT_PANEL_TAB_STYLE_RULES,
  ...IMAGE_PREVIEW_STYLE_RULES,
  ...SETTINGS_STYLE_RULES,
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

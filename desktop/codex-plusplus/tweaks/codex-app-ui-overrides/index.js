const STYLE_ID = "codex-app-ui-overrides-style";
const SIDEBAR_MAX_LEFT = 420;
const REAPPLY_DELAY_MS = 250;
const managedStyles = new Map();

let animationFrame = 0;
let reapplyTimer = 0;
let log = console;

const VISIBLE_CONTROL_DECLARATIONS =
  "opacity:1!important;pointer-events:auto!important;visibility:visible!important;";
const VISIBLE_FLEX_CONTROL_DECLARATIONS = `display:flex!important;${VISIBLE_CONTROL_DECLARATIONS}`;
const VISIBLE_ICON_DECLARATIONS =
  "opacity:1!important;visibility:visible!important;";
const HIDDEN_META_DECLARATIONS =
  "opacity:0!important;visibility:hidden!important;";
const SIDEBAR_THREAD_TITLE_OFFSET_DECLARATIONS =
  "padding-inline-start:1.375rem!important;";
const SIDEBAR_PIN_BUTTON_DECLARATIONS =
  "cursor:pointer!important;";
const SIDEBAR_ABSOLUTE_PIN_BUTTON_DECLARATIONS =
  "cursor:pointer!important;width:1.25rem!important;height:1.25rem!important;";
const SIDEBAR_PIN_ICON_DECLARATIONS =
  "width:0.875rem!important;height:0.875rem!important;min-width:0.875rem!important;min-height:0.875rem!important;";
const SIDEBAR_ABSOLUTE_PIN_ICON_DECLARATIONS =
  SIDEBAR_PIN_ICON_DECLARATIONS;

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

const STYLE_RULES = [
  ...BASE_STYLE_RULES,
  ...SIDEBAR_ACTION_STYLE_RULES,
  ...RIGHT_PANEL_TAB_STYLE_RULES,
  ...IMAGE_PREVIEW_STYLE_RULES,
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

function setManagedStyle(element, property, value) {
  let previous = managedStyles.get(element);
  if (!previous) {
    previous = {};
    managedStyles.set(element, previous);
  }

  if (!(property in previous)) {
    previous[property] = element.style[property] || "";
  }

  if (element.style[property] !== value) {
    element.style[property] = value;
  }
}

function clearManagedStyles() {
  for (const [element, previous] of managedStyles) {
    for (const [property, value] of Object.entries(previous)) {
      element.style[property] = value;
    }
  }
  managedStyles.clear();
}

function classTokens(element) {
  if (typeof element.className !== "string") {
    return [];
  }

  return element.className.split(/\s+/).filter(Boolean);
}

function hasClasses(element, requiredClasses) {
  const tokens = classTokens(element);
  return requiredClasses.every((className) => tokens.includes(className));
}

function closestWithClasses(start, requiredClasses, maxDepth = 6) {
  let current = start;
  let depth = 0;
  while (current && depth <= maxDepth) {
    if (hasClasses(current, requiredClasses)) {
      return current;
    }
    current = current.parentElement;
    depth += 1;
  }

  return null;
}

function visibleInLeftSidebar(element) {
  const rect = element.getBoundingClientRect();
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    rect.left >= 0 &&
    rect.left < SIDEBAR_MAX_LEFT
  );
}

function textNodesMatching(text) {
  if (!document.body) {
    return [];
  }

  const matches = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node.textContent?.trim() === text) {
      matches.push(node);
    }
    node = walker.nextNode();
  }

  return matches;
}

function nudgeChatsHeading() {
  for (const node of textNodesMatching("Chats")) {
    const parent = node.parentElement;
    if (!parent) {
      continue;
    }

    const target = closestWithClasses(parent, ["flex", "min-w-0", "flex-1"]);
    if (target && visibleInLeftSidebar(target)) {
      setManagedStyle(target, "transform", "translateX(1px)");
    }
  }
}

function nudgeNoChatsEmptyState() {
  for (const node of textNodesMatching("No chats")) {
    const target = node.parentElement;
    if (target && visibleInLeftSidebar(target)) {
      setManagedStyle(target, "transform", "translateX(1px)");
    }
  }
}

function nudgeFooterSettingsButton() {
  for (const element of document.querySelectorAll(".min-w-0.flex-1")) {
    if (!element.querySelector(".icon-sm") || !visibleInLeftSidebar(element)) {
      continue;
    }

    const rect = element.getBoundingClientRect();
    if (rect.bottom > window.innerHeight - 180) {
      setManagedStyle(element, "transform", "translateX(-1px)");
    }
  }
}

function applyOverrides() {
  animationFrame = 0;
  try {
    installStyle();
    nudgeChatsHeading();
    nudgeNoChatsEmptyState();
    nudgeFooterSettingsButton();
  } catch (error) {
    log.warn("Codex app UI overrides failed", error);
  }
}

function scheduleApply() {
  if (animationFrame) {
    return;
  }

  animationFrame = window.requestAnimationFrame(applyOverrides);
}

function clearReapplyTimer() {
  if (!reapplyTimer) {
    return;
  }

  window.clearTimeout(reapplyTimer);
  reapplyTimer = 0;
}

function scheduleDelayedApply() {
  scheduleApply();
  clearReapplyTimer();
  reapplyTimer = window.setTimeout(() => {
    reapplyTimer = 0;
    scheduleApply();
  }, REAPPLY_DELAY_MS);
}

function onSettingsSurface(event) {
  if (event?.detail?.visible) {
    scheduleDelayedApply();
  }
}

function addReapplyListeners() {
  window.addEventListener("resize", scheduleDelayedApply);
  window.addEventListener("popstate", scheduleDelayedApply);
  window.addEventListener("hashchange", scheduleDelayedApply);
  window.addEventListener("codexpp:settings-surface", onSettingsSurface);
}

function removeReapplyListeners() {
  window.removeEventListener("resize", scheduleDelayedApply);
  window.removeEventListener("popstate", scheduleDelayedApply);
  window.removeEventListener("hashchange", scheduleDelayedApply);
  window.removeEventListener("codexpp:settings-surface", onSettingsSurface);
}

module.exports = {
  start(api) {
    log = api?.log || console;
    addReapplyListeners();
    scheduleApply();
  },

  stop() {
    if (animationFrame) {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    }
    clearReapplyTimer();
    removeReapplyListeners();

    document.getElementById(STYLE_ID)?.remove();
    clearManagedStyles();
  },
};

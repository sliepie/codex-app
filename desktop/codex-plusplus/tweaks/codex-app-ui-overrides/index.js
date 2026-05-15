const STYLE_ID = "codex-app-ui-overrides-style";
const SIDEBAR_MAX_LEFT = 420;
const managedStyles = new Map();

let observer = null;
let resizeHandler = null;
let animationFrame = 0;
let log = console;

const VISIBLE_CONTROL_DECLARATIONS =
  "opacity:1!important;pointer-events:auto!important;visibility:visible!important;";
const VISIBLE_FLEX_CONTROL_DECLARATIONS = `display:flex!important;${VISIBLE_CONTROL_DECLARATIONS}`;
const VISIBLE_ICON_DECLARATIONS =
  "opacity:1!important;visibility:visible!important;";

function cssRule(selectors, declarations) {
  const selector = Array.isArray(selectors) ? selectors.join(",") : selectors;
  return `${selector}{${declarations}}`;
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
      "[data-app-action-sidebar-project-row]>.opacity-0",
      "[data-app-action-sidebar-project-row] .opacity-0:has(button)",
      "[data-app-action-sidebar-project-row] button.opacity-0",
      "[data-app-action-sidebar-project-row] button .opacity-0",
    ],
    VISIBLE_CONTROL_DECLARATIONS,
  ),
  cssRule(
    [
      "[data-app-action-sidebar-project-row] button svg",
      "[data-app-action-sidebar-project-row] button .icon-xs",
      "[data-app-action-sidebar-project-row] button .icon-sm",
    ],
    VISIBLE_ICON_DECLARATIONS,
  ),
  cssRule(
    [
      "[data-app-action-sidebar-thread-row] .opacity-0:has(button)",
      "[data-app-action-sidebar-thread-row] button.opacity-0",
      "[data-app-action-sidebar-thread-row] button .opacity-0",
    ],
    VISIBLE_CONTROL_DECLARATIONS,
  ),
  cssRule(
    [
      "[data-app-action-sidebar-thread-row] button svg",
      "[data-app-action-sidebar-thread-row] button .icon-xs",
      "[data-app-action-sidebar-thread-row] button .icon-sm",
    ],
    VISIBLE_ICON_DECLARATIONS,
  ),
  cssRule(
    [
      ".group\\/folder-row>.opacity-0",
      ".group\\/folder-row .opacity-0:has(button)",
      ".group\\/folder-row button.opacity-0",
      ".group\\/folder-row button .opacity-0",
    ],
    VISIBLE_CONTROL_DECLARATIONS,
  ),
  cssRule(
    [
      ".group\\/folder-row button svg",
      ".group\\/folder-row button .icon-xs",
      ".group\\/folder-row button .icon-sm",
    ],
    VISIBLE_ICON_DECLARATIONS,
  ),
  cssRule(
    [
      ".group\\/projects-section-header>.opacity-0",
      ".group\\/projects-section-header .opacity-0:has(button)",
      ".group\\/chats-section-header>.opacity-0",
      ".group\\/chats-section-header .opacity-0:has(button)",
      ".group\\/custom-section-header>.opacity-0",
      ".group\\/custom-section-header .opacity-0:has(button)",
    ],
    VISIBLE_CONTROL_DECLARATIONS,
  ),
  cssRule(
    [
      ".group\\/projects-section-header button svg",
      ".group\\/projects-section-header button .icon-xs",
      ".group\\/projects-section-header button .icon-sm",
      ".group\\/chats-section-header button svg",
      ".group\\/chats-section-header button .icon-xs",
      ".group\\/chats-section-header button .icon-sm",
      ".group\\/custom-section-header button svg",
      ".group\\/custom-section-header button .icon-xs",
      ".group\\/custom-section-header button .icon-sm",
    ],
    VISIBLE_ICON_DECLARATIONS,
  ),
];

const RIGHT_PANEL_TAB_STYLE_RULES = [
  cssRule(
    "[data-app-shell-tab-controller='right'] .group\\/tab [role='button'].absolute.inset-y-0.start-0",
    VISIBLE_FLEX_CONTROL_DECLARATIONS,
  ),
  cssRule(
    [
      "[data-app-shell-tab-controller='right'] .group\\/tab [role='button'].absolute.inset-y-0.start-0 svg",
      "[data-app-shell-tab-controller='right'] .group\\/tab [role='button'].absolute.inset-y-0.start-0 .icon-xs",
    ],
    VISIBLE_ICON_DECLARATIONS,
  ),
];

const STYLE_RULES = [
  ...BASE_STYLE_RULES,
  ...SIDEBAR_ACTION_STYLE_RULES,
  ...RIGHT_PANEL_TAB_STYLE_RULES,
];

function installStyle() {
  if (document.getElementById(STYLE_ID)) {
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

function hasLocalThreadData(element) {
  return element.getAttributeNames().some((name) => {
    if (!name.startsWith("data-")) {
      return false;
    }

    const value = element.getAttribute(name) || "";
    const haystack = `${name} ${value}`.toLowerCase();
    return (
      haystack.includes("local") &&
      (haystack.includes("sidebar") || haystack.includes("thread"))
    );
  });
}

function closestSidebarRow(start) {
  let current = start;
  let depth = 0;
  while (current && depth <= 6) {
    if (
      current.matches("a,button,[role='button'],[role='listitem']") ||
      hasClasses(current, ["group"])
    ) {
      return current;
    }
    current = current.parentElement;
    depth += 1;
  }

  return start;
}

function sidebarRowContent(row) {
  const title = row.querySelector(
    "[data-app-action-sidebar-thread-title],[data-thread-title]",
  );
  if (title) {
    return title;
  }

  for (const element of row.querySelectorAll(".min-w-0.flex-1")) {
    if (!element.querySelector("button,[role='button']")) {
      return element;
    }
  }

  return null;
}

function nudgeLocalSidebarRows() {
  for (const element of document.querySelectorAll(
    "[data-testid],[data-kind],[data-type],[data-thread-kind],[data-app-action-sidebar-thread-kind]",
  )) {
    if (!hasLocalThreadData(element)) {
      continue;
    }

    const row = closestSidebarRow(element);
    const target = row ? sidebarRowContent(row) : null;
    if (target && visibleInLeftSidebar(target)) {
      setManagedStyle(target, "transform", "translateX(-4px)");
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

function lowerImagePreviewControls() {
  for (const element of document.querySelectorAll(
    ".absolute.top-3.right-3.z-10.flex.items-center.gap-2",
  )) {
    setManagedStyle(element, "top", "calc(0.75rem + 26px)");
  }
}

function applyOverrides() {
  animationFrame = 0;
  try {
    installStyle();
    nudgeChatsHeading();
    nudgeNoChatsEmptyState();
    nudgeLocalSidebarRows();
    nudgeFooterSettingsButton();
    lowerImagePreviewControls();
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

module.exports = {
  start(api) {
    log = api?.log || console;
    resizeHandler = scheduleApply;
    window.addEventListener("resize", resizeHandler);

    observer = new MutationObserver(scheduleApply);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [
        "class",
        "style",
        "aria-label",
        "data-app-action-sidebar-thread-kind",
        "data-kind",
        "data-testid",
        "data-thread-kind",
        "data-type",
      ],
      childList: true,
      subtree: true,
    });

    scheduleApply();
  },

  stop() {
    if (animationFrame) {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    }
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (resizeHandler) {
      window.removeEventListener("resize", resizeHandler);
      resizeHandler = null;
    }

    document.getElementById(STYLE_ID)?.remove();
    clearManagedStyles();
  },
};

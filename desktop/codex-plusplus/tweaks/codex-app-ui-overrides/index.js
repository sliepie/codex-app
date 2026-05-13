const STYLE_ID = "codex-app-ui-overrides-style";
const SIDEBAR_MAX_LEFT = 420;
const managedStyles = new Map();

let observer = null;
let resizeHandler = null;
let animationFrame = 0;
let log = console;

function installStyle() {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = [
    ".group\\/windows-top-bar{margin-inline-start:0.5rem;}",
    "[style*=\"view-transition-name: sidebar-trigger\"]{transform:translateX(2px);}",
  ].join("\n");
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
  return rect.width > 0 && rect.height > 0 && rect.left >= 0 && rect.left < SIDEBAR_MAX_LEFT;
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
      setManagedStyle(target, "transform", "translateX(2px)");
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
    return haystack.includes("local") && (haystack.includes("sidebar") || haystack.includes("thread"));
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

function nudgeLocalSidebarRows() {
  for (const element of document.querySelectorAll("[data-testid],[data-kind],[data-type],[data-thread-kind]")) {
    if (!hasLocalThreadData(element)) {
      continue;
    }

    const row = closestSidebarRow(element);
    if (row && visibleInLeftSidebar(row)) {
      setManagedStyle(row, "transform", "translateX(-4px)");
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
  for (const element of document.querySelectorAll(".absolute.top-3.right-3.z-10.flex.items-center.gap-2")) {
    setManagedStyle(element, "top", "calc(0.75rem + 26px)");
  }
}

function applyOverrides() {
  animationFrame = 0;
  try {
    installStyle();
    nudgeChatsHeading();
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
      attributeFilter: ["class", "style", "aria-label", "data-kind", "data-testid", "data-thread-kind", "data-type"],
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

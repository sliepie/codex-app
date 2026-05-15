const SECTION_TITLES_TO_HIDE = new Set([
  "Codex++ Updates",
  "Auto-Repair Watcher",
]);
const SIDEBAR_MAX_LEFT = 420;

const hiddenElements = new Map();

let observer = null;
let animationFrame = 0;
let log = console;

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

function hideElement(element) {
  if (!hiddenElements.has(element)) {
    hiddenElements.set(element, element.style.display || "");
  }

  if (element.style.display !== "none") {
    element.style.display = "none";
  }
}

function visibleInLeftSidebar(element) {
  const rect = element.getBoundingClientRect();
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    rect.left >= 0 &&
    rect.right <= SIDEBAR_MAX_LEFT
  );
}

function containsExactText(element, text) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node.textContent?.trim() === text) {
      return true;
    }
    node = walker.nextNode();
  }

  return false;
}

function hasCodexPlusPlusSidebarContext(element) {
  let current = element.parentElement;
  let depth = 0;
  while (current && depth <= 5) {
    if (
      visibleInLeftSidebar(current) &&
      containsExactText(current, "CODEX++")
    ) {
      return true;
    }
    current = current.parentElement;
    depth += 1;
  }

  return false;
}

function clearHiddenElements() {
  for (const [element, display] of hiddenElements) {
    element.style.display = display;
  }
  hiddenElements.clear();
}

function pruneHiddenElements() {
  for (const element of hiddenElements.keys()) {
    if (!element.isConnected) {
      hiddenElements.delete(element);
    }
  }
}

function hideSectionByTitle(title) {
  for (const node of textNodesMatching(title)) {
    const section = node.parentElement?.closest("section");
    if (section) {
      hideElement(section);
    }
  }
}

function hideSidebarUpdateButton() {
  for (const node of textNodesMatching("Update")) {
    const button = node.parentElement?.closest("button,[role='button']");
    if (
      button &&
      visibleInLeftSidebar(button) &&
      hasCodexPlusPlusSidebarContext(button)
    ) {
      hideElement(button);
    }
  }
}

function applyOverrides() {
  animationFrame = 0;
  try {
    pruneHiddenElements();
    for (const title of SECTION_TITLES_TO_HIDE) {
      hideSectionByTitle(title);
    }
    hideSidebarUpdateButton();
  } catch (error) {
    log.warn("Codex++ updater UI overrides failed", error);
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

    observer = new MutationObserver(scheduleApply);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style"],
      characterData: true,
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

    clearHiddenElements();
  },
};

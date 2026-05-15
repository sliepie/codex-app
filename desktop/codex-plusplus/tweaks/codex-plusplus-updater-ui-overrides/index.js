const SECTION_TITLES_TO_HIDE = new Set([
  "Codex++ Updates",
  "Auto-Repair Watcher",
]);

const RELEASES_BUTTON_SELECTORS = [
  'button[title="Open Codex++ releases"]',
  '[data-codexpp="nav-group"] button',
];
const FOLLOW_UP_APPLY_DELAYS_MS = [50, 250, 750];

const hiddenElements = new Map();

let animationFrame = 0;
let followUpTimer = 0;
let clickHandler = null;
let navigationHandler = null;
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

function hideStandaloneUpdateButtons() {
  for (const selector of RELEASES_BUTTON_SELECTORS) {
    for (const element of document.querySelectorAll(selector)) {
      if (element.title === "Open Codex++ releases" || element.textContent?.trim() === "Update") {
        hideElement(element);
      }
    }
  }
}

function applyOverrides() {
  animationFrame = 0;
  try {
    pruneHiddenElements();
    hideStandaloneUpdateButtons();
    for (const title of SECTION_TITLES_TO_HIDE) {
      hideSectionByTitle(title);
    }
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

function clearFollowUpTimer() {
  if (!followUpTimer) {
    return;
  }

  window.clearTimeout(followUpTimer);
  followUpTimer = 0;
}

function scheduleFollowUpApply(attempt = 0) {
  scheduleApply();

  clearFollowUpTimer();
  if (attempt >= FOLLOW_UP_APPLY_DELAYS_MS.length) {
    return;
  }

  followUpTimer = window.setTimeout(() => {
    followUpTimer = 0;
    scheduleFollowUpApply(attempt + 1);
  }, FOLLOW_UP_APPLY_DELAYS_MS[attempt]);
}

module.exports = {
  start(api) {
    log = api?.log || console;

    clickHandler = () => scheduleFollowUpApply();
    navigationHandler = () => scheduleFollowUpApply();

    document.addEventListener("click", clickHandler, true);
    window.addEventListener("hashchange", navigationHandler);
    window.addEventListener("popstate", navigationHandler);

    scheduleFollowUpApply();
  },

  stop() {
    if (animationFrame) {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    }
    clearFollowUpTimer();

    if (clickHandler) {
      document.removeEventListener("click", clickHandler, true);
      clickHandler = null;
    }
    if (navigationHandler) {
      window.removeEventListener("hashchange", navigationHandler);
      window.removeEventListener("popstate", navigationHandler);
      navigationHandler = null;
    }

    clearHiddenElements();
  },
};

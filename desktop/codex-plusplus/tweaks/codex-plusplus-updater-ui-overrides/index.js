const SECTION_TITLES_TO_HIDE = new Set([
  "Codex++ Updates",
  "Auto-Repair Watcher",
]);

const RELEASES_BUTTON_SELECTORS = [
  'button[title="Open Codex++ releases"]',
  '[data-codexpp="nav-group"] button',
];
const INITIAL_REAPPLY_DELAY_MS = 250;

const hiddenElements = new Map();

let animationFrame = 0;
let initialApplyTimer = 0;
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

function clearInitialApplyTimer() {
  if (!initialApplyTimer) {
    return;
  }

  window.clearTimeout(initialApplyTimer);
  initialApplyTimer = 0;
}

function scheduleInitialApply() {
  scheduleApply();

  clearInitialApplyTimer();
  initialApplyTimer = window.setTimeout(() => {
    initialApplyTimer = 0;
    scheduleApply();
  }, INITIAL_REAPPLY_DELAY_MS);
}

function onSettingsSurface(event) {
  if (event?.detail?.visible) {
    scheduleInitialApply();
  }
}

module.exports = {
  start(api) {
    log = api?.log || console;

    window.addEventListener("codexpp:settings-surface", onSettingsSurface);
    scheduleInitialApply();
  },

  stop() {
    if (animationFrame) {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    }
    clearInitialApplyTimer();
    window.removeEventListener("codexpp:settings-surface", onSettingsSurface);

    clearHiddenElements();
  },
};

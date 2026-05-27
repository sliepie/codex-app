const STYLE_ID = "codex-app-ui-overrides-style";

const VISIBLE_CONTROL_DECLARATIONS =
  "opacity:1!important;pointer-events:auto!important;visibility:visible!important;";
const VISIBLE_FLEX_CONTROL_DECLARATIONS = `display:flex!important;${VISIBLE_CONTROL_DECLARATIONS}`;
const VISIBLE_ICON_DECLARATIONS =
  "opacity:1!important;visibility:visible!important;";
const HIDDEN_META_DECLARATIONS =
  "opacity:0!important;visibility:hidden!important;";
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
const SIDEBAR_HOVER_CONTROL_MOTION_DECLARATIONS =
  "transition:opacity 120ms ease-out,transform 120ms ease-out!important;transform:translateX(2px)!important;";
const SIDEBAR_HOVER_CONTROL_ACTIVE_MOTION_DECLARATIONS =
  "transform:translateX(0)!important;";
const SIDEBAR_PROJECT_ROW_ICON_SELECTOR =
  ">.flex.min-w-0.flex-1.items-center.gap-1.pl-1>.relative.flex.h-6.w-6.items-center.justify-center";
const SIDEBAR_FOLDER_ROW_ACTIONS_SELECTOR =
  '.group\\/folder-row :is([class~="gap-0.5"],[class~="gap-1"],[class~="gap-1.5"],[class~="gap-2"]):has(>.group-hover\\/folder-row\\:opacity-100)';
const SIDEBAR_FOLDER_ROW_ACTIONS_DECLARATIONS = "gap:0!important;";
const SIDEBAR_THREAD_ROW_SELECTOR = "[data-app-action-sidebar-thread-row]";
const SIDEBAR_THREAD_ROW_WITH_ACTION_SLOT_SELECTOR = `${SIDEBAR_THREAD_ROW_SELECTOR}:has(.absolute.top-0.left-1.z-10,>.absolute.right-0.top-0.z-10)`;
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
const SIDEBAR_THREAD_ROW_ACTION_SLOT_DECLARATIONS = "gap:0.25rem!important;";
const USAGE_MENU_CONTENT_SELECTOR =
  ".flex.flex-col.text-sm:has(>.grid.items-center.gap-y-1\\.5.py-1)";
const USAGE_MENU_RATE_ROWS_DECLARATIONS =
  "padding-left:calc(var(--padding-row-x) + 1.25rem + 2px)!important;padding-right:var(--padding-row-x)!important;";
const USAGE_MENU_LINK_DECLARATIONS = "display:none!important;";
const WINDOWS_MENU_ROW_SELECTOR =
  '.group\\/windows-top-bar>.flex.items-center.gap-0\\.5.pr-2.pl-1:has(>button[aria-haspopup="menu"][aria-expanded])';
const WINDOWS_MENU_BAR_HIDDEN_ATTRIBUTE =
  "data-codex-app-ui-hide-windows-menu-bar";
const WINDOWS_MENU_ROW_HIDDEN_SELECTOR =
  `:root[${WINDOWS_MENU_BAR_HIDDEN_ATTRIBUTE}="true"] ${WINDOWS_MENU_ROW_SELECTOR}`;
const WINDOWS_MENU_ROW_DECLARATIONS = "display:none!important;";
const WINDOWS_MENU_BAR_STORAGE_KEY = "hideWindowsMenuBar";
const WINDOWS_MENU_BAR_FALLBACK_STORAGE_KEY =
  "codex-app-ui-overrides:hideWindowsMenuBar";
const WINDOWS_MENU_BAR_SETTING_ROW_ID =
  "codex-app-ui-hide-windows-menu-bar-setting";
const WINDOWS_MENU_BAR_SETTING_HOST_SELECTOR =
  ".main-surface .flex.flex-col.rounded-lg.border";
const WINDOWS_MENU_BAR_SETTING_MARKERS = [
  "theme",
  "use pointer cursors",
  "reduce motion",
];
const WINDOWS_MENU_BAR_SETTING_INSERT_BEFORE_MARKERS = ["reduce motion"];
const SWITCH_TRACK_SELECTOR =
  "[data-codex-app-ui-menu-bar-toggle-track]";
const SWITCH_THUMB_SELECTOR =
  "[data-codex-app-ui-menu-bar-toggle-thumb]";
const SWITCH_BUTTON_CLASS =
  "inline-flex items-center text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-token-focus-border focus-visible:rounded-full cursor-interaction";
const SWITCH_TRACK_BASE_CLASS =
  "relative inline-flex shrink-0 items-center rounded-full transition-colors duration-200 ease-out h-5 w-8";
const SWITCH_THUMB_BASE_CLASS =
  "rounded-full border border-[color:var(--gray-0)] bg-[color:var(--gray-0)] shadow-sm transition-transform duration-200 ease-out data-[state=unchecked]:translate-x-0 h-4 w-4 data-[state=unchecked]:translate-x-[2px] data-[state=checked]:translate-x-[14px]";

let windowsMenuBarSettingsObserver = null;
let windowsMenuBarStorage = null;

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
  cssRule(".group\\/windows-top-bar", "margin-inline-start:0.5rem;"),
  cssRule(WINDOWS_MENU_ROW_HIDDEN_SELECTOR, WINDOWS_MENU_ROW_DECLARATIONS),
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
    SIDEBAR_FOLDER_ROW_ACTIONS_SELECTOR,
    SIDEBAR_FOLDER_ROW_ACTIONS_DECLARATIONS,
  ),
  cssRule(
    interactiveSelectors(
      SIDEBAR_THREAD_ROW_SELECTOR,
      SIDEBAR_THREAD_ROW_ACTION_TARGETS,
    ),
    VISIBLE_CONTROL_DECLARATIONS,
  ),
  cssRule(
    interactiveSelectors(SIDEBAR_THREAD_ROW_SELECTOR, [
      " .absolute.top-0.left-1.z-10",
      ">.absolute.right-0.top-0.z-10",
    ]),
    SIDEBAR_THREAD_ROW_ACTION_SLOT_DECLARATIONS,
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
    interactiveSelectors(SIDEBAR_THREAD_ROW_SELECTOR, [
      " .ml-\\[3px\\].flex.items-center.justify-end.gap-1:not(:has(button))",
      " .ml-\\[3px\\].flex.items-center.justify-end.gap-1>:not(:has(button))",
    ]),
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

function compactText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase();
}

function storedBoolean(value) {
  return value !== false && value !== "false";
}

function readFallbackStorage() {
  try {
    const localStorage = window?.localStorage;
    const stored = localStorage?.getItem(WINDOWS_MENU_BAR_FALLBACK_STORAGE_KEY);
    return stored == null ? true : storedBoolean(JSON.parse(stored));
  } catch {
    return true;
  }
}

function writeFallbackStorage(hidden) {
  try {
    window?.localStorage?.setItem(
      WINDOWS_MENU_BAR_FALLBACK_STORAGE_KEY,
      JSON.stringify(hidden),
    );
  } catch {
    // Local storage is best-effort; Codex++ storage is the primary path.
  }
}

function readWindowsMenuBarHidden() {
  try {
    if (windowsMenuBarStorage) {
      return storedBoolean(
        windowsMenuBarStorage.get(WINDOWS_MENU_BAR_STORAGE_KEY, true),
      );
    }
  } catch {
    return readFallbackStorage();
  }

  return readFallbackStorage();
}

function writeWindowsMenuBarHidden(hidden) {
  try {
    windowsMenuBarStorage?.set(WINDOWS_MENU_BAR_STORAGE_KEY, hidden);
  } catch {
    writeFallbackStorage(hidden);
    return;
  }

  writeFallbackStorage(hidden);
}

function applyWindowsMenuBarHiddenState(hidden) {
  document.documentElement?.setAttribute(
    WINDOWS_MENU_BAR_HIDDEN_ATTRIBUTE,
    hidden ? "true" : "false",
  );
  syncWindowsMenuBarSettingControls(hidden);
}

function findAppearanceSettingsHost() {
  const hosts = Array.from(
    document.querySelectorAll(WINDOWS_MENU_BAR_SETTING_HOST_SELECTOR),
  );

  return (
    hosts.find((host) => {
      const text = compactText(host.textContent);
      return WINDOWS_MENU_BAR_SETTING_MARKERS.some((marker) =>
        text.includes(marker),
      );
    }) || null
  );
}

function findSettingsRowByMarkers(host, markers) {
  return (
    Array.from(host.children).find((child) => {
      const text = compactText(child.textContent);
      return markers.some((marker) => text.includes(marker));
    }) || null
  );
}

function createTextElement(className, text) {
  const element = document.createElement("div");
  element.className = className;
  element.textContent = text;
  return element;
}

function createWindowsMenuBarToggle() {
  const button = document.createElement("button");
  button.type = "button";
  button.className = SWITCH_BUTTON_CLASS;
  button.setAttribute("role", "switch");
  button.setAttribute("aria-label", "Hide menu bar");

  const track = document.createElement("span");
  track.setAttribute("data-codex-app-ui-menu-bar-toggle-track", "true");

  const thumb = document.createElement("span");
  thumb.setAttribute("data-codex-app-ui-menu-bar-toggle-thumb", "true");

  track.appendChild(thumb);
  button.appendChild(track);
  button.addEventListener("click", () => {
    const hidden = !readWindowsMenuBarHidden();
    writeWindowsMenuBarHidden(hidden);
    applyWindowsMenuBarHiddenState(hidden);
  });

  return button;
}

function createWindowsMenuBarSettingRow() {
  const row = document.createElement("div");
  row.id = WINDOWS_MENU_BAR_SETTING_ROW_ID;
  row.className = "flex items-center justify-between gap-4 p-3";
  row.setAttribute("data-codex-app-ui-setting", "hide-windows-menu-bar");

  const label = createTextElement(
    "min-w-0 text-sm text-token-text-primary",
    "Hide menu bar",
  );
  const description = createTextElement(
    "text-token-text-secondary min-w-0 text-sm",
    "Hide the Windows File, Edit, View, Window, and Help menu bar",
  );
  const text = document.createElement("div");
  text.className = "flex min-w-0 flex-col gap-1";
  text.append(label, description);

  const left = document.createElement("div");
  left.className = "flex min-w-0 items-center gap-3";
  left.appendChild(text);

  const control = document.createElement("div");
  control.className = "flex shrink-0 items-center gap-2";
  control.appendChild(createWindowsMenuBarToggle());

  row.append(left, control);
  return row;
}

function syncWindowsMenuBarSettingControls(hidden = readWindowsMenuBarHidden()) {
  const row = document.getElementById(WINDOWS_MENU_BAR_SETTING_ROW_ID);
  if (!row) {
    return;
  }

  const state = hidden ? "checked" : "unchecked";
  const button = row.querySelector('button[role="switch"]');
  const track = row.querySelector(SWITCH_TRACK_SELECTOR);
  const thumb = row.querySelector(SWITCH_THUMB_SELECTOR);

  button?.setAttribute("aria-checked", hidden ? "true" : "false");
  button?.setAttribute("data-state", state);

  if (track) {
    track.className = `${SWITCH_TRACK_BASE_CLASS} ${hidden ? "bg-token-charts-blue" : "bg-token-foreground/10"}`;
    track.setAttribute("data-state", state);
  }

  if (thumb) {
    thumb.className = SWITCH_THUMB_BASE_CLASS;
    thumb.setAttribute("data-state", state);
  }
}

function syncWindowsMenuBarSettingRow() {
  const host = findAppearanceSettingsHost();
  const existingRow = document.getElementById(WINDOWS_MENU_BAR_SETTING_ROW_ID);
  const hidden = readWindowsMenuBarHidden();

  if (!host) {
    existingRow?.remove();
    return;
  }

  if (existingRow && host.contains(existingRow)) {
    syncWindowsMenuBarSettingControls(hidden);
    return;
  }

  existingRow?.remove();
  const row = createWindowsMenuBarSettingRow();
  const insertBefore = findSettingsRowByMarkers(
    host,
    WINDOWS_MENU_BAR_SETTING_INSERT_BEFORE_MARKERS,
  );

  if (insertBefore) {
    host.insertBefore(row, insertBefore);
  } else {
    host.appendChild(row);
  }

  syncWindowsMenuBarSettingControls(hidden);
}

function installWindowsMenuBarSetting(api) {
  windowsMenuBarStorage = api?.storage ?? null;
  applyWindowsMenuBarHiddenState(readWindowsMenuBarHidden());
  syncWindowsMenuBarSettingRow();

  if (typeof MutationObserver === "function") {
    windowsMenuBarSettingsObserver?.disconnect();
    windowsMenuBarSettingsObserver = new MutationObserver(() => {
      syncWindowsMenuBarSettingRow();
    });
    windowsMenuBarSettingsObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }
}

function uninstallWindowsMenuBarSetting() {
  windowsMenuBarSettingsObserver?.disconnect();
  windowsMenuBarSettingsObserver = null;
  windowsMenuBarStorage = null;
  document.getElementById(WINDOWS_MENU_BAR_SETTING_ROW_ID)?.remove();
  document.documentElement?.removeAttribute(WINDOWS_MENU_BAR_HIDDEN_ATTRIBUTE);
}

module.exports = {
  start(api) {
    installWindowsMenuBarSetting(api);
    installStyle();
  },

  stop() {
    uninstallWindowsMenuBarSetting();
    document.getElementById(STYLE_ID)?.remove();
  },
};

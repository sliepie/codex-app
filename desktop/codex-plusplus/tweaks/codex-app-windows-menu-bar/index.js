const STYLE_ID = "codex-app-windows-menu-bar-style";

const WINDOWS_MENU_TOP_BAR_SELECTOR = ".group\\/application-menu-top-bar";
const WINDOWS_MENU_BAR_HIDDEN_ATTRIBUTE =
  "data-codex-app-ui-hide-windows-menu-bar";
const WINDOWS_MENU_TOP_BAR_HIDDEN_SELECTOR =
  `:root[${WINDOWS_MENU_BAR_HIDDEN_ATTRIBUTE}="true"] ${WINDOWS_MENU_TOP_BAR_SELECTOR}`;
const LOWER_APP_HEADER_SELECTOR =
  ".app-header-tint.draggable.pointer-events-none.fixed.z-30.flex.h-toolbar.min-w-0.items-center.right-0.top-toolbar-sm";
const LOWER_APP_HEADER_HIDDEN_MENU_SELECTOR =
  `:root[${WINDOWS_MENU_BAR_HIDDEN_ATTRIBUTE}="true"] ${LOWER_APP_HEADER_SELECTOR}`;
const FLOATING_LEFT_PANEL_SELECTOR =
  '[data-pip-obstacle="app-shell-floating-left-panel"]';
const FLOATING_LEFT_PANEL_HIDDEN_MENU_SELECTOR =
  `:root[${WINDOWS_MENU_BAR_HIDDEN_ATTRIBUTE}="true"] ${FLOATING_LEFT_PANEL_SELECTOR}`;
const WINDOWS_MENU_TOP_BAR_DECLARATIONS = "display:none!important;";
const LOWER_APP_HEADER_DECLARATIONS =
  "top:0!important;padding-inline-end:var(--spacing-token-safe-header-right)!important;";
const FLOATING_LEFT_PANEL_DECLARATIONS = "top:0!important;";
const WINDOWS_MENU_BAR_STORAGE_KEY = "hideWindowsMenuBar";
const WINDOWS_MENU_BAR_FALLBACK_STORAGE_KEY =
  "codex-app-ui-overrides:hideWindowsMenuBar";
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

let windowsMenuBarStorage = null;
let windowsMenuBarSettingsHandle = null;

function cssRule(selectors, declarations) {
  const selector = Array.isArray(selectors) ? selectors.join(",") : selectors;
  return `${selector}{${declarations}}`;
}

const STYLE_RULES = [
  cssRule(
    WINDOWS_MENU_TOP_BAR_HIDDEN_SELECTOR,
    WINDOWS_MENU_TOP_BAR_DECLARATIONS,
  ),
  cssRule(LOWER_APP_HEADER_HIDDEN_MENU_SELECTOR, LOWER_APP_HEADER_DECLARATIONS),
  cssRule(FLOATING_LEFT_PANEL_HIDDEN_MENU_SELECTOR, FLOATING_LEFT_PANEL_DECLARATIONS),
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
}

function createTextElement(className, text) {
  const element = document.createElement("div");
  element.className = className;
  element.textContent = text;
  return element;
}

function createWindowsMenuBarToggle(onHiddenChange) {
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
    onHiddenChange?.(hidden);
  });

  return button;
}

function createWindowsMenuBarSettingRow(hidden) {
  const row = document.createElement("div");
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
  control.appendChild(
    createWindowsMenuBarToggle((nextHidden) =>
      syncWindowsMenuBarSettingControls(row, nextHidden),
    ),
  );

  row.append(left, control);
  syncWindowsMenuBarSettingControls(row, hidden);
  return row;
}

function syncWindowsMenuBarSettingControls(row, hidden = readWindowsMenuBarHidden()) {
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

function renderWindowsMenuBarSetting(root) {
  root.appendChild(createWindowsMenuBarSettingRow(readWindowsMenuBarHidden()));
}

function installWindowsMenuBarSetting(api) {
  windowsMenuBarStorage = api?.storage ?? null;
  applyWindowsMenuBarHiddenState(readWindowsMenuBarHidden());
  windowsMenuBarSettingsHandle?.unregister?.();
  windowsMenuBarSettingsHandle = api?.settings?.register?.({
    id: "windows-menu-bar",
    title: "Windows menu bar",
    render: renderWindowsMenuBarSetting,
  }) ?? null;
}

function uninstallWindowsMenuBarSetting() {
  windowsMenuBarSettingsHandle?.unregister?.();
  windowsMenuBarSettingsHandle = null;
  windowsMenuBarStorage = null;
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

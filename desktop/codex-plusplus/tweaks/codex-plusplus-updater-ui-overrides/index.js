const STYLE_ID = "codex-plusplus-updater-ui-overrides-style";

const STYLE_RULES = [
  'button[title="Open Codex++ releases"]{display:none!important;}',
  '[data-codexpp="tweaks-panel"] section:has(> [data-codexpp-config-card]){display:none!important;}',
  '[data-codexpp="tweaks-panel"] section:has(> [data-codexpp-config-card]) + section{display:none!important;}',
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

function logInfo(api, message) {
  if (typeof api?.log?.info === "function") {
    api.log.info(message);
  }
}

module.exports = {
  start(api = {}) {
    logInfo(api, "Compact Windows titlebar preload hook is active after restart or window reload");
  },

  stop() {},
};

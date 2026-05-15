let log = console;

function enableMobilePairingInRenderer() {
  const REQUEST_TIMEOUT_MS = 10000;
  const START_RETRY_DELAY_MS = 1000;
  const MAX_START_ATTEMPTS = 30;
  const LOCAL_HOST_ID = "local";
  const REMOTE_CONTROL_FEATURE = "remote_control";

  window.__codexMobilePairingStop?.();

  const state = {
    requestCounter: 0,
    retryTimer: null,
    running: true,
  };

  window.__codexMobilePairing = state;
  window.__codexMobilePairingStop = () => {
    state.running = false;
    if (state.retryTimer) {
      window.clearTimeout(state.retryTimer);
      state.retryTimer = null;
    }
  };

  function getBridge() {
    return window.electronBridge && typeof window.electronBridge.sendMessageFromView === "function"
      ? window.electronBridge
      : null;
  }

  function nextRequestId() {
    state.requestCounter += 1;
    return "codex-mobile-pairing-" + Date.now() + "-" + state.requestCounter;
  }

  function parseFetchResponse(message) {
    if (message.responseType === "success") {
      if (message.status >= 200 && message.status < 300) {
        return message.bodyJsonString ? JSON.parse(message.bodyJsonString) : null;
      }
      throw new Error(message.bodyJsonString || "Codex action failed with status " + message.status);
    }

    throw new Error(message.error || "Codex action failed with status " + message.status);
  }

  function requestCodexAction(action, params) {
    const bridge = getBridge();
    if (!bridge) {
      return Promise.reject(new Error("Codex Electron bridge is not ready"));
    }

    const requestId = nextRequestId();
    const message = {
      type: "fetch",
      hostId: LOCAL_HOST_ID,
      requestId,
      method: "POST",
      url: "vscode://codex/" + action,
      body: JSON.stringify(params || {}),
    };

    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error("Timed out while calling Codex action: " + action));
      }, REQUEST_TIMEOUT_MS);

      function cleanup() {
        window.clearTimeout(timeout);
        window.removeEventListener("message", onMessage);
      }

      function onMessage(event) {
        const response = event.data;
        if (!response || response.type !== "fetch-response" || response.requestId !== requestId) {
          return;
        }

        cleanup();
        try {
          resolve(parseFetchResponse(response));
        } catch (error) {
          reject(error);
        }
      }

      window.addEventListener("message", onMessage);
      Promise.resolve(bridge.sendMessageFromView(message)).catch((error) => {
        cleanup();
        reject(error);
      });
    });
  }

  function readSharedObject(key) {
    return getBridge()?.getSharedObjectSnapshotValue?.(key);
  }

  function writeSharedObject(key, value) {
    getBridge()?.sendMessageFromView({
      type: "shared-object-set",
      key,
      value,
    });
  }

  function mergeObject(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  async function enableMobilePairing() {
    await requestCodexAction("batch-write-config-value", {
      hostId: LOCAL_HOST_ID,
      edits: [
        {
          keyPath: "features.remote_connections",
          value: true,
          mergeStrategy: "upsert",
        },
        {
          keyPath: "features.remote_control",
          value: true,
          mergeStrategy: "upsert",
        },
        {
          keyPath: "features.workspace_dependencies",
          value: false,
          mergeStrategy: "upsert",
        },
      ],
      filePath: null,
      expectedVersion: null,
      reloadUserConfig: true,
    });

    await requestCodexAction("set-local-app-server-feature-enablement", {
      enabled: true,
      featureName: REMOTE_CONTROL_FEATURE,
    });

    writeSharedObject("local_app_server_feature_enablement", {
      ...mergeObject(readSharedObject("local_app_server_feature_enablement")),
      [REMOTE_CONTROL_FEATURE]: true,
    });

    await requestCodexAction("set-remote-control-connections-enabled", {
      enabled: true,
    });
  }

  function scheduleEnable(attempt = 1) {
    if (!state.running) {
      return;
    }

    if (!getBridge()) {
      if (attempt < MAX_START_ATTEMPTS) {
        state.retryTimer = window.setTimeout(() => scheduleEnable(attempt + 1), START_RETRY_DELAY_MS);
      } else {
        log.warn("Codex mobile pairing tweak could not find the Electron bridge");
      }
      return;
    }

    enableMobilePairing()
      .then(() => {
        log.info("Codex mobile pairing bridge gates enabled");
      })
      .catch((error) => {
        log.warn("Codex mobile pairing tweak failed", error);
      });
  }

  scheduleEnable();
}

module.exports = {
  start(api) {
    log = api?.log || console;
    try {
      enableMobilePairingInRenderer();
    } catch (error) {
      log.warn("Codex mobile pairing tweak failed to start", error);
    }
  },

  stop() {
    try {
      window.__codexMobilePairingStop?.();
    } catch (error) {
      log.warn("Codex mobile pairing tweak failed to stop", error);
    }
  },
};

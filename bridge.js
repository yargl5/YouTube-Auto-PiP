(() => {
  const CONFIG_EVENT = "youtube-auto-pip-config-changed";
  const RESTORE_EVENT = "youtube-auto-pip-restore-inline";
  const CONFIG_ATTRIBUTE = "data-youtube-auto-pip-enabled";

  function publishConfig(enabled) {
    if (!document.documentElement) {
      setTimeout(() => publishConfig(enabled));
      return;
    }

    document.documentElement.setAttribute(CONFIG_ATTRIBUTE, String(enabled));
    window.dispatchEvent(new Event(CONFIG_EVENT));
  }

  chrome.storage.sync.get({ enabled: true }, ({ enabled }) => publishConfig(enabled));

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.enabled) {
      publishConfig(changes.enabled.newValue);
    }
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "youtube-auto-pip-restore") {
      window.dispatchEvent(new Event(RESTORE_EVENT));
    }
  });
})();
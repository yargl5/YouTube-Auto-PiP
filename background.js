chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "youtube-auto-pip-restore" });
  } catch {
    // Active tab is not a YouTube page with the content script.
  }
});
const enabled = document.querySelector("#enabled");
const actionStatus = document.querySelector("#actionStatus");
const logStatus = document.querySelector("#logStatus");
const logCount = document.querySelector("#logCount");
const logsField = document.querySelector("#logs");
let report = "";

function formatReport(response) {
  const header = ["YouTube Auto PiP diagnostics", `version: ${response.version}`, `exportedAt: ${new Date().toISOString()}`, `userAgent: ${response.userAgent}`, `entries: ${response.logs.length}`, ""];
  return [...header, ...response.logs.map((entry) => JSON.stringify(entry))].join("\n");
}

async function refreshLogs() {
  try {
    const response = await chrome.runtime.sendMessage({ type: "youtube-auto-pip-get-logs" });
    if (!response?.ok) throw new Error("Фоновый процесс не ответил.");
    report = formatReport(response);
    logsField.value = report;
    logsField.scrollTop = logsField.scrollHeight;
    logCount.textContent = `${response.logs.length} записей`;
    logStatus.textContent = "";
  } catch (error) { logStatus.textContent = error.message; }
}

chrome.storage.sync.get({ enabled: true }, (settings) => { enabled.checked = settings.enabled; });
enabled.addEventListener("change", () => chrome.storage.sync.set({ enabled: enabled.checked }));
document.querySelector("#refreshLogs").addEventListener("click", refreshLogs);
document.querySelector("#clearLogs").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "youtube-auto-pip-clear-logs" });
  await refreshLogs();
  logStatus.textContent = "Журнал очищен.";
});
document.querySelector("#copyLogs").addEventListener("click", async () => {
  await refreshLogs();
  try { await navigator.clipboard.writeText(report); logStatus.textContent = "Логи скопированы."; }
  catch { logsField.focus(); logsField.select(); logStatus.textContent = "Нажми Ctrl+C."; }
});

document.querySelector("#openNow").addEventListener("click", async () => {
  actionStatus.textContent = "";
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !/^https:\/\/(www|m)\.youtube\.com\/watch/.test(tab.url ?? "")) {
    actionStatus.textContent = "Открой страницу видео YouTube.";
    return;
  }
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id }, world: "MAIN",
      func: async () => {
        const videos = [...document.querySelectorAll("video")];
        const video = videos.find((item) => !item.paused && !item.ended) ?? videos[0];
        if (!video) return "Видео не найдено.";
        if (video.paused) return "Сначала запусти видео.";
        if (document.pictureInPictureElement) return "PiP уже открыт.";
        try { await video.requestPictureInPicture(); return "PiP открыт."; }
        catch (error) { return error?.message || "Chrome заблокировал PiP."; }
      }
    });
    actionStatus.textContent = result.result ?? "Нет ответа от страницы.";
  } catch (error) { actionStatus.textContent = error?.message || "Не удалось открыть PiP."; }
});

refreshLogs();

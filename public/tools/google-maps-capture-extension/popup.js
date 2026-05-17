const statusNode = document.getElementById("status");
const outputNode = document.getElementById("output");
const captureButton = document.getElementById("capture");

const setStatus = (message, isError = false) => {
  statusNode.textContent = message;
  statusNode.style.color = isError ? "#b91c1c" : "#4338ca";
};

captureButton.addEventListener("click", async () => {
  setStatus("Capturing visible Maps data...");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !String(tab.url || "").includes("google.com/maps")) {
      setStatus("Open a Google Maps tab before capturing.", true);
      return;
    }

    const data = await chrome.tabs.sendMessage(tab.id, { type: "WEBVIEW_CAPTURE_MAPS" });
    const text = JSON.stringify(data, null, 2);
    outputNode.value = text;
    await navigator.clipboard.writeText(text);
    setStatus(`Copied ${Array.isArray(data?.items) ? data.items.length : 0} item(s) to clipboard.`);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Capture failed.", true);
  }
});

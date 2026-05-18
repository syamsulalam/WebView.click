const statusNode = document.getElementById("status");
const outputNode = document.getElementById("output");
const captureButton = document.getElementById("capture");
const postButton = document.getElementById("post");
const adminOriginInput = document.getElementById("adminOrigin");

const setStatus = (message, isError = false) => {
  statusNode.textContent = message;
  statusNode.style.color = isError ? "#b91c1c" : "#4338ca";
};

chrome.storage.local.get(["adminOrigin"], (items) => {
  if (items.adminOrigin) adminOriginInput.value = items.adminOrigin;
});

adminOriginInput.addEventListener("change", () => {
  chrome.storage.local.set({ adminOrigin: adminOriginInput.value.replace(/\/$/, "") || "https://webview.click" });
});

const captureFromTab = async (tabId) => {
  try {
    return await chrome.tabs.sendMessage(tabId, { type: "WEBVIEW_CAPTURE_MAPS" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || "");
    if (!/receiving end does not exist|could not establish connection/i.test(message)) {
      throw error;
    }
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"],
    });
    return chrome.tabs.sendMessage(tabId, { type: "WEBVIEW_CAPTURE_MAPS" });
  }
};

const captureCurrentTab = async () => {
  setStatus("Capturing visible Maps data...");
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !String(tab.url || "").includes("google.com/maps")) {
    throw new Error("Open a Google Maps tab before capturing.");
  }

  const data = await captureFromTab(tab.id);
  const text = JSON.stringify(data, null, 2);
  outputNode.value = text;
  await navigator.clipboard.writeText(text);
  return data;
};

captureButton.addEventListener("click", async () => {
  try {
    const data = await captureCurrentTab();
    setStatus(`Copied ${Array.isArray(data?.items) ? data.items.length : 0} item(s) to clipboard.`);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Capture failed.", true);
  }
});

postButton.addEventListener("click", async () => {
  try {
    const data = outputNode.value ? JSON.parse(outputNode.value) : await captureCurrentTab();
    const origin = (adminOriginInput.value || "https://webview.click").replace(/\/$/, "");
    chrome.storage.local.set({ adminOrigin: origin });
    setStatus("Posting captured Maps data to WebView admin...");
    const response = await fetch(`${origin}/api/places/manual-import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      body: JSON.stringify({
        url: data.pageUrl || "",
        capturedItems: Array.isArray(data.items) ? data.items : [],
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.error) {
      throw new Error(result.error || `Admin import failed with HTTP ${response.status}`);
    }
    setStatus(result.message || `Posted ${result.importedCount || 0} item(s) to admin.`);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Post to admin failed.", true);
  }
});

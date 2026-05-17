(() => {
  const compact = (value) => String(value || "").replace(/\s+/g, " ").trim();

  const numberFromText = (value) => {
    const match = String(value || "").match(/(\d+(?:\.\d+)?)/);
    return match ? Number(match[1]) : null;
  };

  const reviewCountFromText = (value) => {
    const match = String(value || "").replace(/,/g, "").match(/\(?(\d+)\)?\s*(?:reviews?)?/i);
    return match ? Number(match[1]) : null;
  };

  const bestNameFromAnchor = (anchor) => {
    const aria = compact(anchor.getAttribute("aria-label"));
    if (aria) return aria.replace(/^View\s+/i, "");
    const text = compact(anchor.textContent);
    if (!text) return "";
    return text.split(/\s{2,}|·/)[0].trim();
  };

  const detailsFromContainer = (container) => {
    const text = compact(container?.innerText || "");
    const websiteAnchor = container?.querySelector('a[data-tooltip*="website" i], a[aria-label*="website" i], a[href^="http"]:not([href*="google."])');
    const phoneButton = container?.querySelector('[data-item-id^="phone"], button[aria-label*="phone" i]');
    const ratingNode = container?.querySelector('[aria-label*="stars" i], span[role="img"][aria-label*="star" i]');
    const lines = text.split(/\n| {2,}/).map(compact).filter(Boolean);
    const addressLine = lines.find((line) => /\d+/.test(line) && !/reviews?|stars?|open|closed|website|phone/i.test(line)) || "";

    return {
      address: addressLine,
      phone: compact(phoneButton?.getAttribute("aria-label") || "").replace(/^phone:\s*/i, ""),
      website: websiteAnchor ? websiteAnchor.href : "",
      rating: numberFromText(ratingNode?.getAttribute("aria-label") || text),
      reviews: reviewCountFromText(text),
      hasWebsite: Boolean(websiteAnchor),
    };
  };

  const captureMapsData = () => {
    const anchors = Array.from(document.querySelectorAll('a[href*="/maps/place"], a[href*="place_id:"]'));
    const seen = new Set();
    const businesses = [];

    for (const anchor of anchors) {
      const url = anchor.href;
      if (!url || seen.has(url)) continue;
      const container = anchor.closest('[role="article"], .Nv2PK, .bfdHYd, .m6QErb, div[jsaction]') || anchor.parentElement;
      const name = bestNameFromAnchor(anchor);
      if (!name || name.length < 2) continue;
      const details = detailsFromContainer(container);
      seen.add(url);
      businesses.push({
        name,
        url,
        mapsUrl: url,
        address: details.address,
        phone: details.phone,
        website: details.website,
        rating: details.rating,
        reviews: details.reviews,
        hasWebsite: details.hasWebsite,
        source: "google_maps_dom",
      });
    }

    const detailPanel = document.querySelector('[role="main"]');
    const panelDetails = detailPanel ? detailsFromContainer(detailPanel) : {};
    const pageTitle = compact(document.querySelector("h1")?.textContent || "");
    if (pageTitle && !businesses.some((item) => item.name === pageTitle)) {
      businesses.unshift({
        name: pageTitle,
        url: location.href,
        mapsUrl: location.href,
        address: panelDetails.address || "",
        phone: panelDetails.phone || "",
        website: panelDetails.website || "",
        rating: panelDetails.rating || null,
        reviews: panelDetails.reviews || null,
        hasWebsite: Boolean(panelDetails.website),
        source: "google_maps_detail_panel",
      });
    }

    return {
      source: "webview_maps_capture_extension",
      capturedAt: new Date().toISOString(),
      pageUrl: location.href,
      items: businesses.slice(0, 80),
    };
  };

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "WEBVIEW_CAPTURE_MAPS") return false;
    sendResponse(captureMapsData());
    return true;
  });
})();

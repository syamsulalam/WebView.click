import JSZip from "jszip";
import { saveAs } from "file-saver";

function absoluteUrl(value: string) {
  if (!value || value.startsWith("#") || value.startsWith("mailto:") || value.startsWith("tel:") || value.startsWith("sms:")) {
    return value;
  }
  try {
    return new URL(value, window.location.origin).toString();
  } catch {
    return value;
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function faviconHref(siteData: any) {
  const svg = siteData?.meta?.faviconSvg || siteData?.brand?.faviconSvg || siteData?.brand?.logoSvg || "";
  if (typeof svg === "string" && svg.trim().startsWith("<svg")) {
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }
  const name = siteData?.meta?.businessName || "Site";
  const initial = String(name).trim().slice(0, 1).toUpperCase() || "S";
  const fallbackSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#111827"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="Arial,sans-serif" font-size="34" font-weight="700" fill="white">${escapeHtml(initial)}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(fallbackSvg)}`;
}

function cleanHtmlClone() {
  const clone = document.documentElement.cloneNode(true) as HTMLElement;

  clone.querySelectorAll("script").forEach((node) => node.remove());
  clone.querySelectorAll(".hide-in-export").forEach((node) => node.remove());
  clone.querySelectorAll("[data-export-remove='true']").forEach((node) => node.remove());

  clone.querySelectorAll("img[src], source[src], video[src], audio[src], iframe[src]").forEach((node) => {
    const element = node as HTMLElement;
    const src = element.getAttribute("src");
    if (src) element.setAttribute("src", absoluteUrl(src));
  });

  clone.querySelectorAll("a[href], link[href]").forEach((node) => {
    const element = node as HTMLElement;
    const href = element.getAttribute("href");
    if (href && !href.startsWith("#")) element.setAttribute("href", absoluteUrl(href));
  });

  clone.querySelectorAll("form").forEach((node) => node.setAttribute("action", "#"));

  return clone;
}

function ownerInlineScript() {
  return `<script>
(function () {
  function pages() {
    return Array.prototype.slice.call(document.querySelectorAll("[data-wv-page]"));
  }
  function activate(pageId, shouldScroll) {
    var allPages = pages();
    var target = allPages.find(function (page) { return page.getAttribute("data-wv-page") === pageId || page.id === pageId; });
    if (!target) {
      var anchorTarget = document.getElementById(pageId);
      if (anchorTarget && shouldScroll !== false) anchorTarget.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    allPages.forEach(function (page) {
      var active = page === target;
      page.classList.toggle("hidden", !active);
      page.classList.toggle("block", active);
    });
    Array.prototype.slice.call(document.querySelectorAll("[data-wv-tab]")).forEach(function (button) {
      var active = button.getAttribute("data-wv-tab") === pageId;
      button.classList.toggle("border-b-2", active);
      button.classList.toggle("border-white", active);
      button.setAttribute("aria-current", active ? "page" : "false");
    });
    if (history.replaceState) history.replaceState(null, "", "#" + pageId);
    if (shouldScroll !== false) window.scrollTo({ top: 0, behavior: "smooth" });
  }
  document.addEventListener("click", function (event) {
    var trigger = event.target && event.target.closest ? event.target.closest("[data-wv-tab], a[href^='#']") : null;
    if (!trigger) return;
    var pageId = trigger.getAttribute("data-wv-tab") || (trigger.getAttribute("href") || "").replace(/^#/, "");
    if (!pageId) return;
    if (pages().some(function (page) { return page.getAttribute("data-wv-page") === pageId || page.id === pageId; })) {
      event.preventDefault();
      activate(pageId, true);
    }
  });
  var initial = (window.location.hash || "").replace(/^#/, "") || (pages()[0] && (pages()[0].getAttribute("data-wv-page") || pages()[0].id));
  if (initial) activate(initial, false);
})();
</script>`;
}

export async function downloadOwnerSiteZip(siteData: any, businessId = "website") {
  const clone = cleanHtmlClone();
  const lang = siteData?.meta?.language || "en";
  const title = siteData?.seo?.title || siteData?.meta?.businessName || "Website";
  const description = siteData?.seo?.description || siteData?.meta?.seoDescription || "";
  const stylesheetLinks = Array.from(document.querySelectorAll<HTMLLinkElement>("link[rel='stylesheet'][href]"))
    .map((link) => `<link rel="stylesheet" href="${absoluteUrl(link.getAttribute("href") || "")}">`)
    .join("\n");
  const bodyHtml = clone.querySelector("body")?.innerHTML || clone.innerHTML;
  const styleTags = Array.from(clone.querySelectorAll("style")).map((style) => style.outerHTML).join("\n");
  const html = `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(String(title))}</title>
  ${description ? `<meta name="description" content="${escapeHtml(String(description))}">` : ""}
  <link rel="icon" href="${faviconHref(siteData)}">
  <link rel="preconnect" href="https://cdn.tailwindcss.com">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css">
  <script src="https://cdn.tailwindcss.com"></script>
  ${stylesheetLinks}
  ${styleTags}
</head>
<body>
${bodyHtml}
${ownerInlineScript()}
</body>
</html>`;

  const zip = new JSZip();
  zip.file("index.html", html);
  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, `${businessId}-website.zip`);
}

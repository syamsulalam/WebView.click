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

function sanitizeFilePart(value: string, fallback = "image") {
  const cleaned = String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return cleaned || fallback;
}

function imageExtension(contentType: string, url = "") {
  const normalized = contentType.toLowerCase();
  if (normalized.includes("png")) return "png";
  if (normalized.includes("webp")) return "webp";
  if (normalized.includes("gif")) return "gif";
  if (normalized.includes("svg")) return "svg";
  if (normalized.includes("jpeg") || normalized.includes("jpg")) return "jpg";
  const pathname = (() => {
    try {
      return new URL(url, window.location.origin).pathname;
    } catch {
      return url;
    }
  })();
  const match = pathname.match(/\.([a-z0-9]{2,5})$/i);
  return match ? match[1].toLowerCase() : "jpg";
}

function nextUniqueFilename(used: Set<string>, filename: string) {
  if (!used.has(filename)) {
    used.add(filename);
    return filename;
  }
  const extensionIndex = filename.lastIndexOf(".");
  const base = extensionIndex > -1 ? filename.slice(0, extensionIndex) : filename;
  const extension = extensionIndex > -1 ? filename.slice(extensionIndex) : "";
  let counter = 2;
  let candidate = `${base}-${counter}${extension}`;
  while (used.has(candidate)) {
    counter += 1;
    candidate = `${base}-${counter}${extension}`;
  }
  used.add(candidate);
  return candidate;
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

async function inlineImagesIntoZip(zip: JSZip, clone: HTMLElement, businessId: string) {
  const imageFolder = zip.folder("img");
  if (!imageFolder) return;

  const slug = sanitizeFilePart(businessId, "business");
  const usedFilenames = new Set<string>();
  const downloaded = new Map<string, string>();
  const images = Array.from(clone.querySelectorAll<HTMLImageElement>("img[src]")).sort((a, b) => {
    const roleA = a.getAttribute("data-wv-image-role") || "";
    const roleB = b.getAttribute("data-wv-image-role") || "";
    const priority = (role: string) => role === "hero" ? 0 : role === "logo" ? 1 : 2;
    return priority(roleA) - priority(roleB);
  });

  for (let index = 0; index < images.length; index += 1) {
    const image = images[index];
    const src = image.getAttribute("src") || "";
    if (!src || src.startsWith("data:") || src.startsWith("blob:")) continue;

    const absoluteSrc = absoluteUrl(src);
    const existingRelativePath = downloaded.get(absoluteSrc);
    if (existingRelativePath) {
      image.setAttribute("src", existingRelativePath);
      image.removeAttribute("srcset");
      image.removeAttribute("loading");
      continue;
    }

    try {
      const response = await fetch(absoluteSrc, { credentials: "include" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const contentType = response.headers.get("content-type") || "";
      if (contentType && !contentType.toLowerCase().startsWith("image/")) {
        throw new Error(`Not an image: ${contentType}`);
      }

      const blob = await response.blob();
      const extension = imageExtension(blob.type || contentType, absoluteSrc);
      const role = sanitizeFilePart(
        image.getAttribute("data-wv-image-role") || image.getAttribute("alt") || (index === 0 ? "hero" : `image-${index + 1}`),
        index === 0 ? "hero" : `image-${index + 1}`,
      );
      const filename = nextUniqueFilename(usedFilenames, `${slug}-${role}.${extension}`);
      const relativePath = `img/${filename}`;

      imageFolder.file(filename, blob);
      downloaded.set(absoluteSrc, relativePath);
      image.setAttribute("src", relativePath);
      image.removeAttribute("srcset");
      image.removeAttribute("loading");
    } catch (error) {
      console.warn(`Could not package image for owner zip: ${absoluteSrc}`, error);
      image.setAttribute("src", absoluteSrc);
    }
  }
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
  Array.prototype.slice.call(document.querySelectorAll("[data-wv-menu]")).forEach(function (menu) {
    var submenu = menu.querySelector("[data-wv-submenu]");
    var timer = null;
    if (!submenu) return;
    function show() {
      if (timer) window.clearTimeout(timer);
      submenu.classList.remove("invisible", "translate-y-2", "opacity-0", "pointer-events-none");
      submenu.classList.add("visible", "translate-y-0", "opacity-100", "pointer-events-auto");
    }
    function hideSoon() {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        submenu.classList.add("invisible", "translate-y-2", "opacity-0", "pointer-events-none");
        submenu.classList.remove("visible", "translate-y-0", "opacity-100", "pointer-events-auto");
      }, 1800);
    }
    menu.addEventListener("mouseenter", show);
    menu.addEventListener("mouseleave", hideSoon);
    submenu.addEventListener("mouseenter", show);
    submenu.addEventListener("mouseleave", hideSoon);
  });
  document.addEventListener("submit", function (event) {
    var form = event.target && event.target.closest ? event.target.closest("[data-wv-mailto]") : null;
    if (!form) return;
    event.preventDefault();
    var data = new FormData(form);
    var business = form.getAttribute("data-wv-business") || document.title || "this business";
    var email = form.getAttribute("data-wv-mailto") || "";
    var lines = [];
    data.forEach(function (value, key) { lines.push(key + ": " + value); });
    var subject = "Website inquiry for " + business;
    var body = lines.length ? lines.join("\\n") : "New inquiry for " + business;
    window.location.href = "mailto:" + email + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
  });
  var initial = (window.location.hash || "").replace(/^#/, "") || (pages()[0] && (pages()[0].getAttribute("data-wv-page") || pages()[0].id));
  if (initial) activate(initial, false);
})();
</script>`;
}

export async function downloadOwnerSiteZip(siteData: any, businessId = "website") {
  const clone = cleanHtmlClone();
  const zip = new JSZip();
  await inlineImagesIntoZip(zip, clone, businessId);
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

  zip.file("index.html", html);
  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, `${businessId}-website.zip`);
}

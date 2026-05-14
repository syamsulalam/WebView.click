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
  const logo = siteData?.brand?.logoImageUrl || siteData?.global?.header?.logoImageUrl || "";
  if (logo) return absoluteUrl(logo);
  const name = siteData?.meta?.businessName || "Site";
  const initial = String(name).trim().slice(0, 1).toUpperCase() || "S";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#111827"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="Arial,sans-serif" font-size="34" font-weight="700" fill="white">${initial}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
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
</body>
</html>`;

  const zip = new JSZip();
  zip.file("index.html", html);
  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, `${businessId}-website.zip`);
}

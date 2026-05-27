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
  clone.querySelectorAll("[data-wv-editable='true']").forEach((node) => {
    const element = node as HTMLElement;
    element.removeAttribute("contenteditable");
    element.removeAttribute("spellcheck");
    element.removeAttribute("suppresscontenteditablewarning");
    element.removeAttribute("data-wv-editable");
    element.removeAttribute("data-wv-edit-key");
    element.classList.remove("cursor-text", "hover:ring-2", "hover:ring-indigo-200", "focus:ring-2", "focus:ring-indigo-500", "focus:ring-offset-2");
  });
  clone.querySelectorAll("[data-wv-button-icon='true']").forEach((node) => {
    const element = node as HTMLElement;
    element.removeAttribute("data-wv-button-icon");
    element.removeAttribute("role");
    element.removeAttribute("tabindex");
    element.removeAttribute("title");
    element.classList.remove("rounded-full", "ring-1", "ring-white/70", "ring-offset-2", "ring-offset-transparent");
  });

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
    if (!src) continue;

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
      if (anchorTarget) {
        var ownerPage = anchorTarget.closest ? anchorTarget.closest("[data-wv-page]") : null;
        var ownerPageId = ownerPage && ownerPage.getAttribute("data-wv-page");
        if (ownerPageId && allPages.some(function (page) { return page.getAttribute("data-wv-page") === ownerPageId || page.id === ownerPageId; })) {
          activate(ownerPageId, false);
          if (shouldScroll !== false) {
            window.setTimeout(function () {
              var currentAnchorTarget = document.getElementById(pageId);
              if (currentAnchorTarget) currentAnchorTarget.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 0);
          }
        } else if (shouldScroll !== false) {
          anchorTarget.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        if (history.replaceState) history.replaceState(null, "", "#" + pageId);
      }
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
    if (pages().some(function (page) { return page.getAttribute("data-wv-page") === pageId || page.id === pageId; }) || document.getElementById(pageId)) {
      event.preventDefault();
      activate(pageId, true);
    }
  });
  document.addEventListener("click", function (event) {
    var ratingButton = event.target && event.target.closest ? event.target.closest("[data-wv-feedback-rating]") : null;
    if (!ratingButton) return;
    var root = ratingButton.closest("[data-wv-feedback]");
    if (!root) return;
    var rating = Number(ratingButton.getAttribute("data-wv-feedback-rating") || "0");
    var reviewUrl = root.getAttribute("data-wv-review-url") || "";
    Array.prototype.slice.call(root.querySelectorAll("[data-wv-feedback-rating]")).forEach(function (button) {
      var value = Number(button.getAttribute("data-wv-feedback-rating") || "0");
      button.setAttribute("aria-checked", value === rating ? "true" : "false");
    });
    var ratingInput = root.querySelector("[data-wv-feedback-rating-input]");
    if (ratingInput) ratingInput.value = String(rating);
    var lowPanel = root.querySelector("[data-wv-feedback-low]");
    var highMessage = root.querySelector("[data-wv-feedback-high]");
    if (rating >= 4 && reviewUrl) {
      window.location.href = reviewUrl;
      return;
    }
    if (lowPanel) lowPanel.classList.toggle("hidden", !(rating > 0 && rating <= 3));
    if (highMessage) highMessage.classList.toggle("hidden", !(rating >= 4));
  });
  Array.prototype.slice.call(document.querySelectorAll("[data-wv-menu]")).forEach(function (menu) {
    var menuKey = menu.getAttribute("data-wv-menu") || "";
    var submenu = menu.querySelector("[data-wv-submenu]") || document.querySelector('[data-wv-submenu][data-wv-menu-key="' + menuKey + '"]');
    var timer = null;
    if (!submenu) return;
    function show() {
      var rect = menu.getBoundingClientRect();
      if (timer) window.clearTimeout(timer);
      submenu.style.left = Math.max(12, Math.min(rect.left, window.innerWidth - 300)) + "px";
      submenu.style.top = rect.bottom + 10 + "px";
      submenu.classList.remove("invisible", "translate-y-2", "opacity-0", "pointer-events-none");
      submenu.classList.add("visible", "translate-y-0", "opacity-100", "pointer-events-auto");
    }
    function hideSoon() {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        submenu.classList.add("invisible", "translate-y-2", "opacity-0", "pointer-events-none");
        submenu.classList.remove("visible", "translate-y-0", "opacity-100", "pointer-events-auto");
        submenu.style.left = "-9999px";
        submenu.style.top = "-9999px";
      }, 1800);
    }
    menu.addEventListener("mouseenter", show);
    menu.addEventListener("mouseleave", hideSoon);
    submenu.addEventListener("mouseenter", show);
    submenu.addEventListener("mouseleave", hideSoon);
  });
  var siteHeader = document.querySelector("[data-wv-site-header]");
  function updateHeaderCompact() {
    if (!siteHeader) return;
    if (window.scrollY > 36) siteHeader.setAttribute("data-wv-header-compact", "true");
    else siteHeader.removeAttribute("data-wv-header-compact");
  }
  updateHeaderCompact();
  window.addEventListener("scroll", updateHeaderCompact, { passive: true });
  var shaderCanvas = document.querySelector("[data-wv-site-canvas]");
  var shaderFrame = 0;
  if (shaderCanvas) {
    window.addEventListener("pointermove", function (event) {
      if (shaderFrame) window.cancelAnimationFrame(shaderFrame);
      shaderFrame = window.requestAnimationFrame(function () {
        shaderCanvas.style.setProperty("--wv-pointer-x", ((event.clientX / Math.max(window.innerWidth, 1)) * 100).toFixed(2));
        shaderCanvas.style.setProperty("--wv-pointer-y", ((event.clientY / Math.max(window.innerHeight, 1)) * 100).toFixed(2));
      });
    }, { passive: true });
  }
  document.addEventListener("submit", function (event) {
    var form = event.target && event.target.closest ? event.target.closest("[data-wv-mailto]") : null;
    if (!form) return;
    event.preventDefault();
    var data = new FormData(form);
    var business = form.getAttribute("data-wv-business") || document.title || "this business";
    var email = form.getAttribute("data-wv-mailto") || "";
    var subject = form.getAttribute("data-wv-subject") || ("Website inquiry for " + business);
    var lines = [];
    data.forEach(function (value, key) { lines.push(key + ": " + value); });
    var body = lines.length ? lines.join("\\n") : "New inquiry for " + business;
    window.location.href = "mailto:" + email + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
  });
  var initial = (window.location.hash || "").replace(/^#/, "") || (pages()[0] && (pages()[0].getAttribute("data-wv-page") || pages()[0].id));
  if (initial) activate(initial, false);
})();
</script>`;
}

function ownerSetupGuide(siteData: any, businessId: string) {
  const businessName = String(siteData?.meta?.businessName || siteData?.businessProfile?.name || "your business");
  const filename = `${sanitizeFilePart(businessId, "website")}-website.zip`;
  const downloadPageUrl = typeof window !== "undefined" ? window.location.href : "";
  return `WEBSITE SETUP GUIDE FOR ${businessName.toUpperCase()}

This zip contains a static website export for ${businessName}.

Original preview/download page:
${downloadPageUrl || "Not available in this export environment."}

EASIER OPTION: DONE-FOR-YOU SETUP

If you do not want to buy a domain, buy hosting, configure DNS, upload files, test SSL, and maintain the website yourself, we can handle the setup for you.

Our setup service is free. You only pay the required third-party costs:

- Domain: $17 / year
- Hosting: $15 / month x 12 months = $180 / year
- Total: $197 / year

That includes domain purchase, hosting purchase, DNS setup, file upload, SSL check, and initial launch. If you prefer to manage everything yourself, follow the technical guide below.

WHAT IS INSIDE THIS ZIP

- index.html: the website page
- img/: website images used by the page
- SETUP-GUIDE.txt: this guide

Keep index.html and the img folder together. If you move index.html without the img folder, images may break.

TECHNICAL SELF-HOSTING GUIDE

1. Buy a domain

Buy a domain from a registrar such as Cloudflare Registrar, Namecheap, GoDaddy, Porkbun, Dynadot, or Google/Squarespace Domains.

Examples:
- yourbusiness.com
- yourbusiness.net
- yourbusiness.co

After buying the domain, keep access to the registrar account. You will need it for DNS or nameserver changes.

2. Buy hosting

You need static website hosting or normal shared hosting that can serve plain HTML files.

Possible hosting types:
- Static hosting: Cloudflare Pages, Netlify, Vercel, GitHub Pages
- Shared hosting: cPanel hosting, Hostinger, Bluehost, SiteGround, Namecheap hosting
- VPS/server hosting: only use this if you understand server maintenance

For a simple static HTML website, static hosting is usually enough.

3. Upload the website files

Upload index.html and the full img folder to the public web root of your hosting.

Common public web root folders:
- public_html
- www
- htdocs
- /var/www/html

The final structure should look like this:

public_html/
  index.html
  img/
    image-files-here.jpg

Do not upload only the index.html file. The img folder must stay beside it.

4. Connect the domain to hosting

There are two common methods.

METHOD A: Change nameservers

Your hosting provider may give you nameservers like:

- ns1.examplehost.com
- ns2.examplehost.com

Go to your domain registrar, find Nameservers, choose Custom Nameservers, and replace the current nameservers with the hosting provider nameservers.

DNS propagation can take a few minutes to 48 hours.

METHOD B: Keep registrar DNS and add records

Your hosting provider may give you an IP address or CNAME target.

Common DNS records:

- A record:
  Name: @
  Value: hosting server IP address

- CNAME record:
  Name: www
  Value: your root domain or hosting target

If your hosting provider gives a special target such as cname.hostingprovider.com, follow their exact value.

5. Enable SSL / HTTPS

After DNS points to hosting, enable SSL in the hosting dashboard.

Look for:
- SSL
- HTTPS
- TLS
- Free Let's Encrypt certificate
- Cloudflare SSL/TLS

Your website should load as:

https://yourdomain.com

If it only loads as http://, visitors may see browser warnings.

6. Test the website

Open your domain in a browser and check:

- The homepage loads
- Images load
- Navigation tabs work
- Phone links work
- Email/contact links work
- Mobile layout works

Also test:

https://yourdomain.com
https://www.yourdomain.com

7. Maintain the website

This is a static export. Future edits require editing index.html and uploading it again.

Maintenance checklist:
- Renew domain every year
- Renew hosting every month/year
- Keep billing card active
- Keep registrar and hosting login safe
- Check SSL renewal
- Re-upload files after content changes
- Keep business phone, address, hours, and service text current

If any of these steps feel too technical, use our done-for-you setup. The setup work is free; you only pay the third-party domain and hosting cost listed above.

Export file: ${filename}
`;
}

function ownerReadmeFirst(siteData: any) {
  const businessName = String(siteData?.meta?.businessName || siteData?.businessProfile?.name || "your business");
  const downloadPageUrl = typeof window !== "undefined" ? window.location.href : "";
  return `README FIRST - WEBSITE SETUP FOR ${businessName.toUpperCase()}

Your website files are included in this zip.

Original preview/download page:
${downloadPageUrl || "Not available in this export environment."}

If you want to handle everything yourself, open SETUP-GUIDE.txt and follow the technical steps for buying a domain, buying hosting, connecting DNS, uploading files, enabling SSL, and maintaining the website.

If you do not want to deal with the technical setup, we can handle it for you.

DONE-FOR-YOU OPTION

Our setup service is free. You only pay the required third-party costs:

- Domain: $17 / year
- Hosting: $15 / month x 12 months = $180 / year
- Total: $197 / year

We handle:

- Domain purchase
- Hosting purchase
- DNS setup
- Website upload
- SSL / HTTPS check
- Initial launch

For self-setup, start with SETUP-GUIDE.txt.
For done-for-you setup, use the setup option from the website preview page where you downloaded this zip.
`;
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
  zip.file("README-FIRST.txt", ownerReadmeFirst(siteData));
  zip.file("SETUP-GUIDE.txt", ownerSetupGuide(siteData, businessId));
  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, `${businessId}-website.zip`);
}

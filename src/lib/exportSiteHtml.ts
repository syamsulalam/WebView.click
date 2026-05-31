import JSZip from "jszip";
import { saveAs } from "file-saver";
import { toJpeg } from "html-to-image";

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

function escapeXml(value: string) {
  return escapeHtml(value).replace(/'/g, "&apos;");
}

function safeJsonForScript(value: any) {
  return JSON.stringify(value, null, 2).replace(/</g, "\\u003c");
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

function normalizeStringList(value: any) {
  const values = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,;\n]+/) : value ? [value] : [];
  const seen = new Set<string>();
  return values
    .map((item: any) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") return String(item.name || item.city || item.label || item.area || item.description || "").trim();
      return "";
    })
    .filter((item: string) => {
      if (!item) return false;
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 20);
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
  clone.querySelectorAll("[data-wv-tool-ui]").forEach((node) => node.remove());
  clone.querySelectorAll("[data-wv-editable='true']").forEach((node) => {
    const element = node as HTMLElement;
    element.removeAttribute("contenteditable");
    element.removeAttribute("spellcheck");
    element.removeAttribute("suppresscontenteditablewarning");
    element.removeAttribute("data-wv-editable");
    element.removeAttribute("data-wv-edit-key");
    element.classList.remove("cursor-text", "hover:ring-2", "hover:ring-indigo-200", "focus:ring-2", "focus:ring-indigo-500", "focus:ring-offset-2");
  });
  clone.querySelectorAll("[data-wv-edit-icon='true']").forEach((node) => {
    const element = node as HTMLElement;
    element.removeAttribute("data-wv-edit-icon");
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

  clone.querySelectorAll<HTMLElement>("[style*='url(']").forEach((element) => {
    const style = element.getAttribute("style") || "";
    const nextStyle = style.replace(/url\((['"]?)([^'")]+)\1\)/g, (match, _quote, rawUrl) => {
      const relativePath = downloaded.get(absoluteUrl(String(rawUrl || "")));
      return relativePath ? `url("${relativePath}")` : match;
    });
    if (nextStyle !== style) element.setAttribute("style", nextStyle);
  });
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

function firstText(...values: any[]) {
  for (const value of values) {
    const text = String(value || "").trim();
    if (text) return text;
  }
  return "";
}

function offeringNames(siteData: any) {
  const raw = [
    ...(Array.isArray(siteData?.products) ? siteData.products : []),
    ...(Array.isArray(siteData?.services) ? siteData.services : []),
    ...(Array.isArray(siteData?.offers) ? siteData.offers : []),
    ...(Array.isArray(siteData?.capabilities) ? siteData.capabilities : []),
  ];
  const seen = new Set<string>();
  return raw
    .map((item: any) => firstText(item?.navLabel, item?.shortLabel, item?.title, item?.name, item?.label))
    .filter((name: string) => {
      const key = name.toLowerCase();
      if (!name || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
}

function pageNames(siteData: any) {
  const pages = Array.isArray(siteData?.pages) ? siteData.pages : [];
  return pages
    .map((page: any) => firstText(page?.title, page?.label, page?.pageId))
    .filter(Boolean)
    .slice(0, 12);
}

function ownerPackageGuideData(siteData: any, businessId: string) {
  const businessProfile = siteData?.businessProfile || {};
  const contact = businessProfile.contact || {};
  const location = siteData?.location || {};
  const sourceData = siteData?.sourceData || {};
  const address = businessProfile.address || {};
  const businessName = firstText(siteData?.meta?.businessName, businessProfile.name, businessId, "your business");
  const downloadPageUrl = typeof window !== "undefined" ? window.location.href : "";
  const serviceAreas = normalizeStringList(
    siteData?.locationServed ||
      siteData?.locationsServed ||
      location.servedAreas ||
      location.serviceAreas ||
      businessProfile.serviceAreas ||
      sourceData.serviceAreas ||
      sourceData.servedAreas ||
      sourceData.locationServed,
  );
  const formattedAddress = firstText(location.formattedAddress, address.formatted, sourceData.formattedAddress);
  const phone = firstText(contact.phoneInternational, contact.phoneNational, businessProfile.phone, sourceData.phone);
  const email = firstText(contact.email, businessProfile.email, sourceData.email);
  const category = firstText(businessProfile.category, sourceData.primaryTypeDisplayName, sourceData.primaryType, siteData?.meta?.industry);
  const generatedAt = new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  const safeName = sanitizeFilePart(businessName, "business");

  return {
    businessName,
    businessId,
    category,
    phone,
    email,
    formattedAddress,
    serviceAreas,
    offerings: offeringNames(siteData),
    pages: pageNames(siteData),
    downloadPageUrl,
    generatedAt,
    zipFilename: `${sanitizeFilePart(businessId, "website")}-website.zip`,
    pdfFilename: `WebView.click Website Package Guide - ${safeName}.pdf`,
    contactEmail: "email@codev.id",
  };
}

function listItems(items: string[], emptyText: string) {
  const values = items.length ? items : [emptyText];
  return values.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function ownerPackageGuideHtml(data: ReturnType<typeof ownerPackageGuideData>) {
  const contactRows = [
    data.phone ? ["Phone", data.phone] : null,
    data.email ? ["Email", data.email] : null,
    data.formattedAddress ? ["Address", data.formattedAddress] : null,
    data.category ? ["Business type", data.category] : null,
    data.serviceAreas.length ? ["Areas served", data.serviceAreas.slice(0, 8).join(", ")] : null,
  ].filter(Boolean) as Array<[string, string]>;
  const pageTotal = data.pages.length || 1;
  const offerCards = [
    {
      title: "Launch it for me",
      price: "$180-$197/year",
      body: "We handle hosting, upload, DNS help, SSL check, and launch testing. If we register the domain, the $17/year domain fee is included in the $197/year total.",
      delivery: "We can deliver this from the current static site package and our existing checkout/setup workflow.",
    },
    {
      title: "Add more pages",
      price: "From $50/action",
      body: "Useful when you want pages for real services, products, areas, menus, FAQs, or seasonal offers.",
      delivery: "We generate or edit pages from the saved site data, then QA the layout and contact buttons.",
    },
    {
      title: "Sticky call or WhatsApp button",
      price: "Simple upgrade",
      body: "Add a floating call or WhatsApp button so mobile visitors can contact you from any page.",
      delivery: "We code the button into the site. For WhatsApp, the message can include the page where the visitor clicked so you get context.",
    },
    {
      title: "Extra focused site",
      price: "Quoted by scope",
      body: "Useful if you have another location, another business, or a separate service line that deserves its own website.",
      delivery: "We generate a separate site with its own copy, pages, and domain plan so it has a clear business purpose.",
    },
    {
      title: "Lead capture polish",
      price: "Simple upgrade",
      body: "Make it easier for visitors to call, email, request a quote, or send a message.",
      delivery: "We improve the contact section, button text, mobile CTAs, and form/email handoff without a complex third-party integration.",
    },
    {
      title: "Monthly care",
      price: "Light retainer",
      body: "Useful if you want small changes, new announcements, or content updates without editing files yourself.",
      delivery: "We update the static site files and republish the site when you send approved changes.",
    },
  ];
  const page = (title: string, eyebrow: string, body: string) => `
    <section class="wv-guide-page">
      <div class="wv-guide-topline">
        <div>
          <p class="wv-guide-brand">WebView.click</p>
          <p class="wv-guide-mini">Website package guide</p>
        </div>
        <p class="wv-guide-date">${escapeHtml(data.generatedAt)}</p>
      </div>
      <p class="wv-guide-eyebrow">${escapeHtml(eyebrow)}</p>
      <h1>${escapeHtml(title)}</h1>
      ${body}
      <footer>
        <span>${escapeHtml(data.businessName)}</span>
        <span>${escapeHtml(data.contactEmail)}</span>
      </footer>
    </section>`;

  return `
<div class="wv-guide-root">
  <style>
    .wv-guide-root { position: fixed; left: -12000px; top: 0; width: 794px; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; color: #0f172a; background: #f8fafc; }
    .wv-guide-page { box-sizing: border-box; position: relative; width: 794px; min-height: 1123px; padding: 56px; overflow: hidden; background: #fff; border: 1px solid #e2e8f0; }
    .wv-guide-page + .wv-guide-page { margin-top: 18px; }
    .wv-guide-page:before { content: ""; position: absolute; inset: 0 0 auto 0; height: 10px; background: #4f46e5; }
    .wv-guide-topline { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; }
    .wv-guide-brand { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 0; color: #111827; }
    .wv-guide-mini, .wv-guide-date { margin: 4px 0 0; font-size: 12px; font-weight: 700; text-transform: uppercase; color: #64748b; }
    .wv-guide-eyebrow { margin: 56px 0 10px; font-size: 12px; font-weight: 800; text-transform: uppercase; color: #4f46e5; }
    .wv-guide-page h1 { margin: 0; max-width: 660px; font-size: 42px; line-height: 1.08; letter-spacing: 0; color: #020617; }
    .wv-guide-page h2 { margin: 0 0 10px; font-size: 20px; line-height: 1.25; color: #020617; }
    .wv-guide-page h3 { margin: 0 0 8px; font-size: 16px; line-height: 1.25; color: #020617; }
    .wv-guide-page p { margin: 0; font-size: 15px; line-height: 1.6; color: #475569; }
    .wv-guide-lead { margin-top: 18px !important; max-width: 640px; font-size: 17px !important; color: #334155 !important; }
    .wv-guide-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 28px; }
    .wv-guide-grid.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .wv-guide-card { border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc; padding: 16px; }
    .wv-guide-card.white { background: #fff; }
    .wv-guide-card strong { display: block; font-size: 21px; color: #020617; }
    .wv-guide-card span { display: block; margin-top: 5px; font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; }
    .wv-guide-table { margin-top: 26px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
    .wv-guide-row { display: grid; grid-template-columns: 1fr auto; gap: 16px; padding: 13px 16px; border-top: 1px solid #e2e8f0; font-size: 14px; color: #334155; }
    .wv-guide-row:first-child { border-top: 0; }
    .wv-guide-row b { color: #020617; }
    .wv-guide-checks { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 24px; }
    .wv-guide-check { border: 1px solid #dbeafe; border-radius: 8px; background: #eff6ff; padding: 12px; font-size: 13px; font-weight: 700; color: #1e3a8a; }
    .wv-guide-list { margin: 18px 0 0; padding-left: 20px; }
    .wv-guide-list li { margin: 7px 0; font-size: 14px; line-height: 1.45; color: #334155; }
    .wv-guide-steps { display: grid; gap: 12px; margin-top: 24px; }
    .wv-guide-step { display: grid; grid-template-columns: 34px 1fr; gap: 12px; align-items: start; border: 1px solid #e2e8f0; border-radius: 8px; padding: 13px; }
    .wv-guide-step-number { display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 999px; background: #4f46e5; color: #fff; font-size: 13px; font-weight: 800; }
    .wv-guide-offers { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 22px; }
    .wv-guide-offer { border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; background: #fff; }
    .wv-guide-price { display: inline-flex; margin: 2px 0 8px; border-radius: 999px; background: #eef2ff; padding: 4px 9px; font-size: 12px; font-weight: 800; color: #4338ca; }
    .wv-guide-delivery { margin-top: 8px !important; border-top: 1px solid #e2e8f0; padding-top: 8px; font-size: 12px !important; color: #64748b !important; }
    .wv-guide-note { margin-top: 24px; border: 1px solid #fde68a; border-radius: 8px; background: #fffbeb; padding: 14px; color: #92400e !important; }
    .wv-guide-cta { margin-top: 28px; border-radius: 8px; background: #111827; padding: 18px; color: #fff !important; }
    .wv-guide-cta p, .wv-guide-cta b { color: #fff !important; }
    .wv-guide-muted { color: #64748b !important; }
    .wv-guide-url { overflow-wrap: anywhere; font-size: 12px !important; color: #4338ca !important; }
    .wv-guide-page footer { position: absolute; left: 56px; right: 56px; bottom: 34px; display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 11px; font-weight: 700; color: #94a3b8; }
  </style>
  ${page(
    `Your starter website package is ready for ${data.businessName}`,
    "Free portfolio sample",
    `
      <p class="wv-guide-lead">This package contains a ready-to-use static website prepared for your business. You can keep the files, host them anywhere, or ask WebView.click to launch it for you.</p>
      <div class="wv-guide-grid">
        <div class="wv-guide-card"><span>Starter site value</span><strong>$997</strong></div>
        <div class="wv-guide-card"><span>Portfolio credit</span><strong>-$997</strong></div>
        <div class="wv-guide-card"><span>Your download today</span><strong>$0</strong></div>
      </div>
      <div class="wv-guide-checks">
        <div class="wv-guide-check">No payment required to download the files.</div>
        <div class="wv-guide-check">You can host it with any provider.</div>
        <div class="wv-guide-check">Setup help is optional.</div>
        <div class="wv-guide-check">The site is personalized for your business.</div>
      </div>
      <div class="wv-guide-table">
        <div class="wv-guide-row"><b>Business</b><span>${escapeHtml(data.businessName)}</span></div>
        <div class="wv-guide-row"><b>Reference</b><span>${escapeHtml(data.businessId)}</span></div>
        <div class="wv-guide-row"><b>Preview page</b><span class="wv-guide-url">${escapeHtml(data.downloadPageUrl || "Not available")}</span></div>
      </div>
    `,
  )}
  ${page(
    "What you received",
    "Package contents",
    `
      <p class="wv-guide-lead">Keep these files together when you upload the website. The images folder must stay beside the HTML file so photos keep working.</p>
      <div class="wv-guide-grid two">
        <div class="wv-guide-card white"><h2>Website files</h2><ul class="wv-guide-list"><li>index.html</li><li>sitemap.xml</li><li>robots.txt</li><li>img/ folder</li><li>This PDF guide</li></ul></div>
        <div class="wv-guide-card white"><h2>Built-in basics</h2><ul class="wv-guide-list"><li>Mobile-friendly static page</li><li>Clickable phone and email links where available</li><li>Basic business search metadata</li><li>Local image files packaged into the zip</li><li>Navigation that works without React</li></ul></div>
      </div>
      <div class="wv-guide-table">
        ${contactRows.length ? contactRows.map(([label, value]) => `<div class="wv-guide-row"><b>${escapeHtml(label)}</b><span>${escapeHtml(value)}</span></div>`).join("") : `<div class="wv-guide-row"><b>Business details</b><span>Review phone, email, address, and hours before launch.</span></div>`}
        <div class="wv-guide-row"><b>Pages included</b><span>${pageTotal}</span></div>
      </div>
      <div class="wv-guide-grid two">
        <div class="wv-guide-card white"><h2>Pages</h2><ul class="wv-guide-list">${listItems(data.pages, "Homepage")}</ul></div>
        <div class="wv-guide-card white"><h2>Services or offers</h2><ul class="wv-guide-list">${listItems(data.offerings, "Review your services before launch")}</ul></div>
      </div>
    `,
  )}
  ${page(
    "How to put it online yourself",
    "Self setup checklist",
    `
      <p class="wv-guide-lead">You can launch this yourself if you are comfortable with domain, hosting, upload, and SSL settings. If this feels annoying, WebView.click can handle it for you.</p>
      <div class="wv-guide-steps">
        ${[
          ["Choose a domain", "Use a domain you already own, or buy a new one from a registrar."],
          ["Choose website hosting", "Use static hosting or normal shared hosting that can serve plain HTML files."],
          ["Upload the files", "Upload index.html, sitemap.xml, robots.txt, and the full img folder together."],
          ["Connect DNS", "Point your domain to the hosting provider using nameservers, A records, or CNAME records."],
          ["Turn on HTTPS", "Enable SSL so the website opens with https:// and does not show browser warnings."],
          ["Test the site", "Open it on desktop and phone. Check photos, menu links, phone links, email links, and contact forms."],
        ].map((step, index) => `<div class="wv-guide-step"><div class="wv-guide-step-number">${index + 1}</div><div><h3>${escapeHtml(step[0])}</h3><p>${escapeHtml(step[1])}</p></div></div>`).join("")}
      </div>
      <p class="wv-guide-note">The website is static. Future changes usually mean editing the file and uploading it again, unless WebView.click hosts and maintains it for you.</p>
    `,
  )}
  ${page(
    "Want us to launch it for you?",
    "Done-for-you setup",
    `
      <p class="wv-guide-lead">This is the easiest next step if you want the website live without touching hosting, DNS, file upload, or SSL settings.</p>
      <div class="wv-guide-grid two">
        <div class="wv-guide-card"><span>If you already own the domain</span><strong>$180/year</strong><p>Managed hosting, upload, DNS help, SSL check, and launch testing.</p></div>
        <div class="wv-guide-card"><span>If we register the domain</span><strong>$197/year</strong><p>Includes the $17/year domain fee plus managed hosting and launch setup.</p></div>
      </div>
      <div class="wv-guide-table">
        <div class="wv-guide-row"><b>We handle</b><span>Hosting setup</span></div>
        <div class="wv-guide-row"><b>We handle</b><span>Website upload</span></div>
        <div class="wv-guide-row"><b>We handle</b><span>Domain/DNS connection help</span></div>
        <div class="wv-guide-row"><b>We handle</b><span>SSL and launch check</span></div>
      </div>
      <div class="wv-guide-cta">
        <b>Reply path</b>
        <p>Email ${escapeHtml(data.contactEmail)} with your business name and preview link. Tell us whether you already own a domain or want a new one.</p>
      </div>
    `,
  )}
  ${page(
    "Useful upgrades after launch",
    "Simple growth options",
    `
      <p class="wv-guide-lead">These upgrades are meant to be practical: clearer contact paths, more useful pages, or another focused site when your business situation needs it.</p>
      <div class="wv-guide-offers">
        ${offerCards.map((offer) => `
          <div class="wv-guide-offer">
            <h3>${escapeHtml(offer.title)}</h3>
            <span class="wv-guide-price">${escapeHtml(offer.price)}</span>
            <p>${escapeHtml(offer.body)}</p>
            <p class="wv-guide-delivery">${escapeHtml(offer.delivery)}</p>
          </div>
        `).join("")}
      </div>
    `,
  )}
  ${page(
    "Recommended next step",
    "Keep it simple",
    `
      <p class="wv-guide-lead">If you do not have a website yet, the best first move is usually to launch this site on a real domain. After it is live, add pages or buttons based on what customers actually ask for.</p>
      <div class="wv-guide-grid two">
        <div class="wv-guide-card white"><h2>If you want to do it yourself</h2><p>Use the self-setup checklist in this PDF and keep all files from the zip together.</p></div>
        <div class="wv-guide-card white"><h2>If you want it handled</h2><p>Contact WebView.click and we can launch the site for you with hosting, DNS help, upload, and SSL check.</p></div>
      </div>
      <div class="wv-guide-table">
        <div class="wv-guide-row"><b>Email</b><span>${escapeHtml(data.contactEmail)}</span></div>
        <div class="wv-guide-row"><b>Business</b><span>${escapeHtml(data.businessName)}</span></div>
        <div class="wv-guide-row"><b>Reference</b><span>${escapeHtml(data.businessId)}</span></div>
        <div class="wv-guide-row"><b>Preview</b><span class="wv-guide-url">${escapeHtml(data.downloadPageUrl || "Not available")}</span></div>
      </div>
      <p class="wv-guide-note">If this website is not useful, no reply is needed. If you want help launching or improving it, send the business name and preview link to ${escapeHtml(data.contactEmail)}.</p>
    `,
  )}
</div>`;
}

function dataUrlToBytes(dataUrl: string) {
  const base64 = dataUrl.split(",")[1] || "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function concatBytes(chunks: Uint8Array[]) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  chunks.forEach((chunk) => {
    output.set(chunk, offset);
    offset += chunk.length;
  });
  return output;
}

function pdfFromJpegs(jpegs: Uint8Array[]) {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0];
  let offset = 0;
  const append = (chunk: string | Uint8Array) => {
    const bytes = typeof chunk === "string" ? encoder.encode(chunk) : chunk;
    chunks.push(bytes);
    offset += bytes.length;
  };
  const objectCount = 2 + jpegs.length * 3;
  const pageRefs = jpegs.map((_, index) => `${3 + index * 3} 0 R`).join(" ");
  const writeObject = (id: number, body: string) => {
    offsets[id] = offset;
    append(`${id} 0 obj\n${body}\nendobj\n`);
  };
  const writeStreamObject = (id: number, dictionary: string, bytes: Uint8Array) => {
    offsets[id] = offset;
    append(`${id} 0 obj\n<< ${dictionary} /Length ${bytes.length} >>\nstream\n`);
    append(bytes);
    append("\nendstream\nendobj\n");
  };

  append("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  writeObject(1, "<< /Type /Catalog /Pages 2 0 R >>");
  writeObject(2, `<< /Type /Pages /Kids [${pageRefs}] /Count ${jpegs.length} >>`);
  jpegs.forEach((jpeg, index) => {
    const pageId = 3 + index * 3;
    const contentId = pageId + 1;
    const imageId = pageId + 2;
    writeObject(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im${index + 1} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    writeStreamObject(contentId, "", encoder.encode(`q\n595.28 0 0 841.89 0 0 cm\n/Im${index + 1} Do\nQ\n`));
    writeStreamObject(imageId, `/Type /XObject /Subtype /Image /Width 794 /Height 1123 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`, jpeg);
  });
  const xrefOffset = offset;
  append(`xref\n0 ${objectCount + 1}\n`);
  append("0000000000 65535 f \n");
  for (let id = 1; id <= objectCount; id += 1) {
    append(`${String(offsets[id] || 0).padStart(10, "0")} 00000 n \n`);
  }
  append(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
  const pdfBytes = concatBytes(chunks);
  const pdfBuffer = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer;
  return new Blob([pdfBuffer], { type: "application/pdf" });
}

async function ownerPackageGuidePdf(siteData: any, businessId: string) {
  const data = ownerPackageGuideData(siteData, businessId);
  const wrapper = document.createElement("div");
  wrapper.innerHTML = ownerPackageGuideHtml(data);
  const root = wrapper.firstElementChild as HTMLElement | null;
  if (!root) throw new Error("Could not build owner PDF guide.");
  document.body.appendChild(root);
  try {
    const pages = Array.from(root.querySelectorAll<HTMLElement>(".wv-guide-page"));
    const jpegs: Uint8Array[] = [];
    for (const page of pages) {
      const jpegDataUrl = await toJpeg(page, {
        width: 794,
        height: 1123,
        quality: 0.92,
        pixelRatio: 1,
        backgroundColor: "#ffffff",
        cacheBust: true,
      });
      jpegs.push(dataUrlToBytes(jpegDataUrl));
    }
    return { filename: data.pdfFilename, blob: pdfFromJpegs(jpegs) };
  } finally {
    root.remove();
  }
}

function exportBaseUrl(siteData: any) {
  const raw =
    siteData?.seo?.canonicalUrl ||
    siteData?.meta?.canonicalUrl ||
    siteData?.meta?.siteUrl ||
    (typeof window !== "undefined" ? window.location.href : "");
  try {
    const base = typeof window !== "undefined" ? window.location.origin : "https://your-domain.example";
    const url = new URL(raw || "https://your-domain.example/", base);
    url.hash = "";
    url.search = "";
    return url.toString().replace(/\/(?:index\.html)?$/i, "/");
  } catch {
    return "https://your-domain.example/";
  }
}

function sitemapXml(siteData: any) {
  const baseUrl = exportBaseUrl(siteData);
  const pages = Array.isArray(siteData?.pages) ? siteData.pages : [];
  const urls = [
    { loc: baseUrl, priority: "1.0" },
    ...pages
      .slice(1)
      .map((page: any) => String(page?.pageId || "").trim())
      .filter(Boolean)
      .map((pageId: string) => ({ loc: `${baseUrl}#${encodeURIComponent(pageId)}`, priority: pageId === "contact" ? "0.8" : "0.7" })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((item) => `  <url>
    <loc>${escapeXml(item.loc)}</loc>
    <changefreq>monthly</changefreq>
    <priority>${item.priority}</priority>
  </url>`).join("\n")}
</urlset>
`;
}

function robotsTxt(siteData: any) {
  const baseUrl = exportBaseUrl(siteData);
  return `User-agent: *
Allow: /

Sitemap: ${baseUrl}sitemap.xml
`;
}

function localBusinessStructuredData(siteData: any) {
  const meta = siteData?.meta || {};
  const businessProfile = siteData?.businessProfile || {};
  const contact = businessProfile.contact || {};
  const location = siteData?.location || {};
  const address = businessProfile.address || {};
  const trust = siteData?.trust || {};
  const sourceData = siteData?.sourceData || {};
  const brand = siteData?.brand || {};
  const socials = Array.isArray(siteData?.global?.footer?.socials) ? siteData.global.footer.socials : [];
  const servedAreas = normalizeStringList(
    siteData?.locationServed ||
      siteData?.locationsServed ||
      location.servedAreas ||
      location.serviceAreas ||
      businessProfile.serviceAreas ||
      sourceData.serviceAreas ||
      sourceData.servedAreas ||
      sourceData.locationServed,
  );
  const name = String(meta.businessName || businessProfile.name || "").trim();
  if (!name) return null;
  const sameAs = [
    sourceData.googleMapsUri,
    ...socials.map((item: any) => item?.href),
  ].filter((item: any) => typeof item === "string" && /^https?:\/\//i.test(item));
  const jsonLd: any = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name,
    url: exportBaseUrl(siteData),
  };
  const description = String(siteData?.seo?.description || meta.seoDescription || businessProfile.shortPitch || "").trim();
  const phone = String(contact.phoneInternational || contact.phoneNational || businessProfile.phone || "").trim();
  const image = String(brand.preferredHeroImage || brand.logoImageUrl || "").trim();
  const formattedAddress = String(location.formattedAddress || address.formatted || sourceData.formattedAddress || "").trim();
  if (description) jsonLd.description = description;
  if (phone) jsonLd.telephone = phone;
  if (image) jsonLd.image = absoluteUrl(image);
  if (formattedAddress) jsonLd.address = { "@type": "PostalAddress", streetAddress: formattedAddress };
  if (servedAreas.length > 0) jsonLd.areaServed = servedAreas.map((area) => ({ "@type": "City", name: area }));
  if (Number(trust.rating || trust.googleRating || 0) > 0) {
    jsonLd.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Number(trust.rating || trust.googleRating || 0),
      reviewCount: Number(trust.reviewCount || 0) || undefined,
    };
  }
  if (sameAs.length > 0) jsonLd.sameAs = sameAs;
  return jsonLd;
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
  const jsonLd = localBusinessStructuredData(siteData);
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
  ${jsonLd ? `<script type="application/ld+json">${safeJsonForScript(jsonLd)}</script>` : ""}
  ${styleTags}
</head>
<body>
${bodyHtml}
${ownerInlineScript()}
</body>
</html>`;

  zip.file("index.html", html);
  zip.file("sitemap.xml", sitemapXml(siteData));
  zip.file("robots.txt", robotsTxt(siteData));
  const ownerGuide = await ownerPackageGuidePdf(siteData, businessId);
  zip.file(ownerGuide.filename, ownerGuide.blob);
  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, `${businessId}-website.zip`);
}

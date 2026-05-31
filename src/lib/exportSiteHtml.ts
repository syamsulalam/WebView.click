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

type PdfGuideLink = { rect: [number, number, number, number]; url: string };
type PdfGuidePage = { content: string[]; links: PdfGuideLink[] };
type PdfGuideIcon = "check" | "download" | "package" | "setup" | "page" | "chat" | "site" | "care" | "mail" | "growth" | "next" | "launch" | "domain";

function pdfText(value: string) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function pdfUri(value: string) {
  return pdfText(value).replace(/\r?\n/g, " ");
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

class SelectablePdfGuide {
  private readonly width = 595.28;
  private readonly height = 841.89;
  private readonly margin = 46;
  private readonly bottom = 780;
  private pages: PdfGuidePage[] = [];
  private page: PdfGuidePage = { content: [], links: [] };
  private y = 0;

  constructor(private readonly data: ReturnType<typeof ownerPackageGuideData>) {
    this.page = this.newPage();
  }

  private newPage() {
    const page: PdfGuidePage = { content: [], links: [] };
    this.pages.push(page);
    this.page = page;
    this.y = 40;
    this.rect(0, 0, this.width, 9, "4f46e5");
    this.text("WebView.click", this.margin, this.y, 18, "bold", "111827");
    this.text("Website package guide", this.margin, this.y + 16, 9, "bold", "64748b");
    this.text(this.data.generatedAt, this.width - this.margin - 90, this.y + 16, 9, "bold", "64748b");
    this.y = 104;
    return page;
  }

  private rgb(hex: string) {
    const clean = hex.replace("#", "");
    const r = parseInt(clean.slice(0, 2), 16) / 255;
    const g = parseInt(clean.slice(2, 4), 16) / 255;
    const b = parseInt(clean.slice(4, 6), 16) / 255;
    return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)}`;
  }

  private rect(x: number, yTop: number, width: number, height: number, fill: string, stroke?: string) {
    const y = this.height - yTop - height;
    if (fill) this.page.content.push(`${this.rgb(fill)} rg ${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f`);
    if (stroke) this.page.content.push(`${this.rgb(stroke)} RG 0.8 w ${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re S`);
  }

  private line(x1: number, y1Top: number, x2: number, y2Top: number, color: string, width = 1) {
    const y1 = this.height - y1Top;
    const y2 = this.height - y2Top;
    this.page.content.push(`${this.rgb(color)} RG ${width.toFixed(2)} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
  }

  private icon(kind: PdfGuideIcon, x: number, yTop: number, size: number, color: string) {
    const s = size;
    if (kind === "check") {
      this.line(x + s * 0.18, yTop + s * 0.55, x + s * 0.42, yTop + s * 0.76, color, 1.8);
      this.line(x + s * 0.42, yTop + s * 0.76, x + s * 0.84, yTop + s * 0.27, color, 1.8);
      return;
    }
    if (kind === "download") {
      this.line(x + s * 0.5, yTop + s * 0.18, x + s * 0.5, yTop + s * 0.68, color, 1.6);
      this.line(x + s * 0.3, yTop + s * 0.5, x + s * 0.5, yTop + s * 0.7, color, 1.6);
      this.line(x + s * 0.7, yTop + s * 0.5, x + s * 0.5, yTop + s * 0.7, color, 1.6);
      this.line(x + s * 0.24, yTop + s * 0.82, x + s * 0.76, yTop + s * 0.82, color, 1.6);
      return;
    }
    if (kind === "mail") {
      this.rect(x + s * 0.16, yTop + s * 0.28, s * 0.68, s * 0.45, "", color);
      this.line(x + s * 0.18, yTop + s * 0.3, x + s * 0.5, yTop + s * 0.56, color, 1);
      this.line(x + s * 0.82, yTop + s * 0.3, x + s * 0.5, yTop + s * 0.56, color, 1);
      return;
    }
    if (kind === "page") {
      this.rect(x + s * 0.26, yTop + s * 0.14, s * 0.48, s * 0.72, "", color);
      this.line(x + s * 0.38, yTop + s * 0.38, x + s * 0.62, yTop + s * 0.38, color, 1);
      this.line(x + s * 0.38, yTop + s * 0.55, x + s * 0.62, yTop + s * 0.55, color, 1);
      return;
    }
    if (kind === "chat") {
      this.rect(x + s * 0.17, yTop + s * 0.2, s * 0.66, s * 0.48, "", color);
      this.line(x + s * 0.32, yTop + s * 0.68, x + s * 0.25, yTop + s * 0.82, color, 1.2);
      this.line(x + s * 0.25, yTop + s * 0.82, x + s * 0.48, yTop + s * 0.68, color, 1.2);
      return;
    }
    if (kind === "site") {
      this.rect(x + s * 0.14, yTop + s * 0.2, s * 0.72, s * 0.58, "", color);
      this.line(x + s * 0.14, yTop + s * 0.36, x + s * 0.86, yTop + s * 0.36, color, 1);
      this.line(x + s * 0.32, yTop + s * 0.58, x + s * 0.68, yTop + s * 0.58, color, 1.4);
      return;
    }
    if (kind === "growth") {
      this.rect(x + s * 0.18, yTop + s * 0.58, s * 0.14, s * 0.24, color);
      this.rect(x + s * 0.43, yTop + s * 0.4, s * 0.14, s * 0.42, color);
      this.rect(x + s * 0.68, yTop + s * 0.24, s * 0.14, s * 0.58, color);
      return;
    }
    if (kind === "next" || kind === "launch") {
      this.line(x + s * 0.2, yTop + s * 0.62, x + s * 0.76, yTop + s * 0.28, color, 1.7);
      this.line(x + s * 0.76, yTop + s * 0.28, x + s * 0.7, yTop + s * 0.55, color, 1.7);
      this.line(x + s * 0.76, yTop + s * 0.28, x + s * 0.48, yTop + s * 0.22, color, 1.7);
      return;
    }
    if (kind === "domain") {
      this.rect(x + s * 0.18, yTop + s * 0.2, s * 0.64, s * 0.6, "", color);
      this.line(x + s * 0.18, yTop + s * 0.5, x + s * 0.82, yTop + s * 0.5, color, 1);
      this.line(x + s * 0.5, yTop + s * 0.2, x + s * 0.5, yTop + s * 0.8, color, 1);
      return;
    }
    if (kind === "care") {
      this.rect(x + s * 0.25, yTop + s * 0.2, s * 0.5, s * 0.56, "", color);
      this.line(x + s * 0.35, yTop + s * 0.52, x + s * 0.48, yTop + s * 0.64, color, 1.5);
      this.line(x + s * 0.48, yTop + s * 0.64, x + s * 0.68, yTop + s * 0.38, color, 1.5);
      return;
    }
    this.rect(x + s * 0.18, yTop + s * 0.28, s * 0.64, s * 0.48, "", color);
    this.line(x + s * 0.18, yTop + s * 0.42, x + s * 0.82, yTop + s * 0.42, color, 1);
  }

  private iconBadge(kind: PdfGuideIcon, x: number, yTop: number, size = 24, fill = "eef2ff", color = "4f46e5") {
    this.rect(x, yTop, size, size, fill);
    this.icon(kind, x + 4, yTop + 4, size - 8, color);
  }

  private text(value: string, x: number, yTop: number, size: number, font: "regular" | "bold" = "regular", color = "334155") {
    const y = this.height - yTop;
    const fontRef = font === "bold" ? "F2" : "F1";
    this.page.content.push(`BT /${fontRef} ${size.toFixed(2)} Tf ${this.rgb(color)} rg ${x.toFixed(2)} ${y.toFixed(2)} Td (${pdfText(value)}) Tj ET`);
  }

  private textWidth(value: string, size: number, bold = false) {
    return String(value || "").length * size * (bold ? 0.55 : 0.5);
  }

  private wrap(value: string, maxWidth: number, size: number, bold = false) {
    const words = String(value || "").split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = "";
    words.forEach((word) => {
      const next = line ? `${line} ${word}` : word;
      if (this.textWidth(next, size, bold) <= maxWidth || !line) {
        line = next;
      } else {
        lines.push(line);
        line = word;
      }
    });
    if (line) lines.push(line);
    return lines.length ? lines : [""];
  }

  private ensure(height: number) {
    if (this.y + height > this.bottom) this.newPage();
  }

  private linkText(value: string, x: number, yTop: number, size: number, url: string, maxWidth = 430, color = "4338ca") {
    const lines = this.wrap(value, maxWidth, size);
    lines.forEach((line, index) => {
      const top = yTop + index * (size + 4);
      this.text(line, x, top, size, "regular", color);
      const width = Math.min(maxWidth, this.textWidth(line, size));
      const y1 = this.height - top - 3;
      const y2 = this.height - top + size + 2;
      this.page.links.push({ rect: [x, y1, x + width, y2], url });
    });
    return lines.length * (size + 4);
  }

  startSection(eyebrow: string, title: string, icon: PdfGuideIcon = "package") {
    if (this.pages.length > 1 || this.y > 120) this.newPage();
    this.text(eyebrow.toUpperCase(), this.margin, this.y, 9, "bold", "4f46e5");
    this.rect(this.margin, this.y + 12, 88, 4, "4f46e5");
    this.iconBadge(icon, this.width - this.margin - 30, this.y - 4, 30);
    this.y += 34;
    this.wrap(title, 500, 28, true).forEach((line) => {
      this.text(line, this.margin, this.y, 28, "bold", "020617");
      this.y += 34;
    });
    this.y += 8;
  }

  paragraph(value: string, options: { color?: string; size?: number; indent?: number } = {}) {
    const size = options.size || 12;
    const indent = options.indent || 0;
    const lines = this.wrap(value, 500 - indent, size);
    this.ensure(lines.length * (size + 5) + 8);
    lines.forEach((line) => {
      this.text(line, this.margin + indent, this.y, size, "regular", options.color || "475569");
      this.y += size + 5;
    });
    this.y += 5;
  }

  subheading(value: string) {
    this.ensure(34);
    this.y += 5;
    this.text(value, this.margin, this.y, 15, "bold", "020617");
    this.y += 24;
  }

  bullets(items: string[]) {
    items.forEach((item) => {
      const lines = this.wrap(item, 470, 11);
      this.ensure(lines.length * 16 + 4);
      this.text("-", this.margin + 4, this.y, 11, "bold", "4f46e5");
      lines.forEach((line, index) => {
        this.text(line, this.margin + 18, this.y + index * 16, 11, "regular", "334155");
      });
      this.y += lines.length * 16 + 3;
    });
    this.y += 8;
  }

  valueCards(items: Array<[string, string, PdfGuideIcon?]>) {
    const gap = 10;
    const cardWidth = (this.width - this.margin * 2 - gap * (items.length - 1)) / items.length;
    this.ensure(88);
    items.forEach(([label, value, icon = "package"], index) => {
      const x = this.margin + index * (cardWidth + gap);
      this.rect(x, this.y, cardWidth, 72, "f8fafc", "e2e8f0");
      this.iconBadge(icon, x + 12, this.y + 13, 22, "eef2ff", value.startsWith("-") ? "047857" : "4f46e5");
      this.text(label.toUpperCase(), x + 42, this.y + 22, 7.4, "bold", "64748b");
      this.text(value, x + 12, this.y + 56, 18, "bold", value.startsWith("-") ? "047857" : "020617");
    });
    this.y += 88;
  }

  checks(items: string[]) {
    const gap = 10;
    const width = (this.width - this.margin * 2 - gap) / 2;
    for (let index = 0; index < items.length; index += 2) {
      this.ensure(50);
      [0, 1].forEach((offset) => {
        const item = items[index + offset];
        if (!item) return;
        const x = this.margin + offset * (width + gap);
        this.rect(x, this.y, width, 38, "eff6ff", "dbeafe");
        this.iconBadge("check", x + 10, this.y + 9, 20, "dbeafe", "1e40af");
        this.text(item, x + 38, this.y + 23, 10, "bold", "1e3a8a");
      });
      this.y += 48;
    }
    this.y += 8;
  }

  keyValueRows(rows: Array<[string, string, string?]>) {
    this.ensure(20);
    this.rect(this.margin, this.y, this.width - this.margin * 2, 1, "e2e8f0");
    this.y += 8;
    rows.forEach(([label, value, url]) => {
      const lines = this.wrap(value, 350, 10);
      const height = Math.max(26, lines.length * 14 + 10);
      this.ensure(height + 4);
      this.text(label, this.margin, this.y + 15, 10, "bold", "020617");
      if (url) {
        this.linkText(value, this.margin + 140, this.y + 15, 10, url, 350);
      } else {
        lines.forEach((line, index) => this.text(line, this.margin + 140, this.y + 15 + index * 14, 10, "regular", "334155"));
      }
      this.y += height;
    });
    this.y += 8;
  }

  numberedStep(number: number, title: string, body: string) {
    const bodyLines = this.wrap(body, 430, 10);
    const height = Math.max(54, bodyLines.length * 14 + 32);
    this.ensure(height + 8);
    this.rect(this.margin, this.y, this.width - this.margin * 2, height, "ffffff", "e2e8f0");
    this.rect(this.margin + 12, this.y + 13, 24, 24, "4f46e5");
    this.text(String(number), this.margin + 20, this.y + 31, 11, "bold", "ffffff");
    this.text(title, this.margin + 50, this.y + 21, 12, "bold", "020617");
    bodyLines.forEach((line, index) => this.text(line, this.margin + 50, this.y + 39 + index * 14, 10, "regular", "475569"));
    this.y += height + 10;
  }

  offerCards(items: Array<{ title: string; price: string; body: string; icon?: PdfGuideIcon }>) {
    const gap = 12;
    const width = (this.width - this.margin * 2 - gap) / 2;
    for (let index = 0; index < items.length; index += 2) {
      const row = items.slice(index, index + 2);
      const prepared = row.map((item) => ({
        ...item,
        titleLines: this.wrap(item.title, width - 42, 12, true),
        bodyLines: this.wrap(item.body, width - 26, 9),
      }));
      const rowHeight = Math.max(...prepared.map((item) => Math.max(100, item.titleLines.length * 15 + item.bodyLines.length * 13 + 52)));
      this.ensure(rowHeight + 12);
      prepared.forEach((item, offset) => {
        const x = this.margin + offset * (width + gap);
        this.rect(x, this.y, width, rowHeight, "ffffff", "e2e8f0");
        this.rect(x, this.y, 5, rowHeight, "4f46e5");
        this.iconBadge(item.icon || "growth", x + 14, this.y + 14, 24, "eef2ff", "4f46e5");
        item.titleLines.forEach((line, lineIndex) => this.text(line, x + 38, this.y + 20 + lineIndex * 15, 12, "bold", "020617"));
        const priceTop = this.y + 20 + item.titleLines.length * 15 + 3;
        this.rect(x + 14, priceTop, this.textWidth(item.price, 8, true) + 18, 17, "eef2ff");
        this.text(item.price, x + 23, priceTop + 12, 8, "bold", "4338ca");
        const bodyTop = priceTop + 30;
        item.bodyLines.forEach((line, lineIndex) => this.text(line, x + 14, bodyTop + lineIndex * 13, 9, "regular", "475569"));
      });
      this.y += rowHeight + 12;
    }
  }

  note(value: string) {
    const lines = this.wrap(value, 470, 10);
    const height = lines.length * 14 + 22;
    this.ensure(height + 10);
    this.rect(this.margin, this.y, this.width - this.margin * 2, height, "fffbeb", "fde68a");
    lines.forEach((line, index) => this.text(line, this.margin + 12, this.y + 19 + index * 14, 10, "regular", "92400e"));
    this.y += height + 10;
  }

  callout(value: string, url: string) {
    const lines = this.wrap(value, 470, 10);
    const height = lines.length * 14 + 34;
    this.ensure(height + 10);
    this.rect(this.margin, this.y, this.width - this.margin * 2, height, "111827");
    this.text("Reply path", this.margin + 14, this.y + 21, 12, "bold", "ffffff");
    lines.forEach((line, index) => this.text(line, this.margin + 14, this.y + 39 + index * 14, 10, "regular", "ffffff"));
    this.page.links.push({ rect: [this.margin, this.height - this.y - height, this.width - this.margin, this.height - this.y], url });
    this.y += height + 10;
  }

  toBlob() {
    this.pages.forEach((page, index) => {
      const yTop = 812;
      page.content.push(`${this.rgb("e2e8f0")} rg ${this.margin.toFixed(2)} ${(this.height - yTop).toFixed(2)} ${(this.width - this.margin * 2).toFixed(2)} 1 re f`);
      this.page = page;
      this.text(`${this.data.businessName} | ${this.data.contactEmail}`, this.margin, 828, 8, "bold", "94a3b8");
      this.text(`Page ${index + 1}`, this.width - this.margin - 34, 828, 8, "bold", "94a3b8");
    });
    return pdfTextPagesToBlob(this.pages, this.width, this.height);
  }
}

function pdfTextPagesToBlob(pages: PdfGuidePage[], width: number, height: number) {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0];
  let offset = 0;
  const append = (chunk: string | Uint8Array) => {
    const bytes = typeof chunk === "string" ? encoder.encode(chunk) : chunk;
    chunks.push(bytes);
    offset += bytes.length;
  };
  const writeObject = (id: number, body: string) => {
    offsets[id] = offset;
    append(`${id} 0 obj\n${body}\nendobj\n`);
  };
  const writeStreamObject = (id: number, body: string) => {
    const bytes = encoder.encode(body);
    offsets[id] = offset;
    append(`${id} 0 obj\n<< /Length ${bytes.length} >>\nstream\n`);
    append(bytes);
    append("\nendstream\nendobj\n");
  };

  const catalogId = 1;
  const pagesId = 2;
  const fontRegularId = 3;
  const fontBoldId = 4;
  let nextId = 5;
  const pageIds = pages.map(() => nextId++);
  const contentIds = pages.map(() => nextId++);
  const annotationIds = pages.map((page) => page.links.map(() => nextId++));
  const objectCount = nextId - 1;

  append("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  writeObject(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  writeObject(pagesId, `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`);
  writeObject(fontRegularId, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  writeObject(fontBoldId, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  pages.forEach((page, index) => {
    const annots = annotationIds[index].length ? ` /Annots [${annotationIds[index].map((id) => `${id} 0 R`).join(" ")}]` : "";
    writeObject(
      pageIds[index],
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${width.toFixed(2)} ${height.toFixed(2)}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentIds[index]} 0 R${annots} >>`,
    );
    writeStreamObject(contentIds[index], page.content.join("\n"));
    page.links.forEach((link, linkIndex) => {
      const [x1, y1, x2, y2] = link.rect;
      writeObject(annotationIds[index][linkIndex], `<< /Type /Annot /Subtype /Link /Rect [${x1.toFixed(2)} ${y1.toFixed(2)} ${x2.toFixed(2)} ${y2.toFixed(2)}] /Border [0 0 0] /A << /S /URI /URI (${pdfUri(link.url)}) >> >>`);
    });
  });
  const xrefOffset = offset;
  append(`xref\n0 ${objectCount + 1}\n`);
  append("0000000000 65535 f \n");
  for (let id = 1; id <= objectCount; id += 1) {
    append(`${String(offsets[id] || 0).padStart(10, "0")} 00000 n \n`);
  }
  append(`trailer\n<< /Size ${objectCount + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
  const pdfBytes = concatBytes(chunks);
  const pdfBuffer = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer;
  return new Blob([pdfBuffer], { type: "application/pdf" });
}

function ownerPackageGuidePdf(siteData: any, businessId: string) {
  const data = ownerPackageGuideData(siteData, businessId);
  const setupMailto = `mailto:${data.contactEmail}?subject=${encodeURIComponent(`Website setup for ${data.businessName}`)}&body=${encodeURIComponent(`Business: ${data.businessName}\nReference: ${data.businessId}\nPreview: ${data.downloadPageUrl || ""}\n\nI want help launching this website.`)}`;
  const contactRows = [
    data.phone ? ["Phone", data.phone] : null,
    data.email ? ["Email", data.email] : null,
    data.formattedAddress ? ["Address", data.formattedAddress] : null,
    data.category ? ["Business type", data.category] : null,
    data.serviceAreas.length ? ["Areas served", data.serviceAreas.slice(0, 8).join(", ")] : null,
  ].filter(Boolean) as Array<[string, string]>;
  const pageTotal = data.pages.length || 1;
  const businessDetailRows: Array<[string, string]> = contactRows.length
    ? contactRows
    : [["Business details", "Review phone, email, address, and hours before launch."]];
  const packageDetailRows: Array<[string, string]> = [...businessDetailRows, ["Pages included", String(pageTotal)]];
  const offers = [
    {
      title: "Launch it for me",
      price: "$180-$197/year",
      body: "Your website goes live without you touching hosting, DNS, upload, or SSL settings. Good if you want the site online without learning the technical parts.",
      icon: "launch" as PdfGuideIcon,
    },
    {
      title: "Add more pages",
      price: "From $50/page",
      body: "Useful when customers need more details before calling, such as separate service pages, menu pages, product pages, FAQ pages, or local area pages.",
      icon: "page" as PdfGuideIcon,
    },
    {
      title: "Sticky call or WhatsApp button",
      price: "$49 one-time",
      body: "Customers can reach you from any page. WhatsApp messages can include the page they clicked from, so you know what they were interested in.",
      icon: "chat" as PdfGuideIcon,
    },
    {
      title: "Extra focused site",
      price: "From $197/year",
      body: "Useful if you have another location, another business, or a separate service line that deserves its own website.",
      icon: "site" as PdfGuideIcon,
    },
    {
      title: "Lead capture polish",
      price: "$99 one-time",
      body: "Make it easier for visitors to call, email, request a quote, or send a message without hunting around the site.",
      icon: "mail" as PdfGuideIcon,
    },
    {
      title: "Monthly care",
      price: "From $49/month",
      body: "Useful if you want small text changes, new announcements, seasonal offers, or page updates handled for you.",
      icon: "care" as PdfGuideIcon,
    },
  ];

  const pdf = new SelectablePdfGuide(data);
  pdf.startSection("Free portfolio sample", `Your starter website package is ready for ${data.businessName}`, "download");
  pdf.paragraph("This package contains a ready-to-use static website prepared for your business. You can keep the files, host them anywhere, or ask WebView.click to launch it for you.");
  pdf.valueCards([["Starter site value", "$997", "site"], ["Portfolio credit", "-$997", "check"], ["Your download today", "$0", "download"]]);
  pdf.checks(["No payment required to download the files.", "You can host it with any provider.", "Setup help is optional.", "The site is personalized for your business."]);
  pdf.keyValueRows([["Business", data.businessName], ["Reference", data.businessId], ["Preview page", data.downloadPageUrl || "Not available", data.downloadPageUrl]]);

  pdf.startSection("Package contents", "What you received", "package");
  pdf.paragraph("Keep these files together when you upload the website. The images folder must stay beside the HTML file so photos keep working.");
  pdf.subheading("Website files");
  pdf.bullets(["index.html", "sitemap.xml", "robots.txt", "img/ folder", "This clickable PDF guide"]);
  pdf.subheading("Built-in basics");
  pdf.bullets(["Mobile-friendly static page.", "Clickable phone and email links where available.", "Basic business search metadata.", "Local image files packaged into the zip.", "Navigation that works without React."]);
  pdf.keyValueRows(packageDetailRows);
  pdf.subheading("Pages included");
  pdf.bullets(data.pages.length ? data.pages : ["Homepage"]);
  pdf.subheading("Services or offers");
  pdf.bullets(data.offerings.length ? data.offerings : ["Review your services before launch."]);

  pdf.startSection("Self setup checklist", "How to put it online yourself", "setup");
  pdf.paragraph("You can launch this yourself if you are comfortable with domain, hosting, upload, and SSL settings. If this feels annoying, WebView.click can handle it for you.");
  [
    ["Choose a domain", "Use a domain you already own, or buy a new one from a registrar."],
    ["Choose website hosting", "Use static hosting or normal shared hosting that can serve plain HTML files."],
    ["Upload the files", "Upload index.html, sitemap.xml, robots.txt, and the full img folder together."],
    ["Connect DNS", "Point your domain to the hosting provider using nameservers, A records, or CNAME records."],
    ["Turn on HTTPS", "Enable SSL so the website opens with https:// and does not show browser warnings."],
    ["Test the site", "Open it on desktop and phone. Check photos, menu links, phone links, email links, and contact forms."],
  ].forEach(([title, body], index) => pdf.numberedStep(index + 1, title, body));
  pdf.note("The website is static. Future changes usually mean editing the file and uploading it again, unless WebView.click hosts and maintains it for you.");

  pdf.startSection("Done-for-you setup", "Want us to launch it for you?", "domain");
  pdf.paragraph("This is the easiest next step if you want the website live without touching hosting, DNS, file upload, or SSL settings.");
  pdf.valueCards([["Already own the domain", "$180/year", "domain"], ["Need us to register it", "$197/year", "launch"]]);
  pdf.keyValueRows([["Included", "Managed hosting setup"], ["Included", "Website upload"], ["Included", "Domain/DNS connection help"], ["Included", "SSL and launch check"]]);
  pdf.callout(`Email ${data.contactEmail} with your business name and preview link. Tell us whether you already own a domain or want a new one. This reply box opens a ready-to-send email.`, setupMailto);

  pdf.startSection("Simple growth options", "Useful upgrades after launch", "growth");
  pdf.paragraph("These upgrades are practical: clearer contact paths, more useful pages, or another focused site when your business situation needs it.");
  pdf.offerCards(offers);

  pdf.startSection("Keep it simple", "Recommended next step", "next");
  pdf.paragraph("If you do not have a website yet, the best first move is usually to launch this site on a real domain. After it is live, add pages or buttons based on what customers actually ask for.");
  pdf.subheading("If you want to do it yourself");
  pdf.paragraph("Use the self-setup checklist in this PDF and keep all files from the zip together.");
  pdf.subheading("If you want it handled");
  pdf.paragraph("Contact WebView.click and we can launch the site for you with hosting, DNS help, upload, and SSL check.");
  pdf.keyValueRows([
    ["Email", data.contactEmail, setupMailto],
    ["Business", data.businessName],
    ["Reference", data.businessId],
    ["Preview", data.downloadPageUrl || "Not available", data.downloadPageUrl],
  ]);
  pdf.note(`If this website is not useful, no reply is needed. If you want help launching or improving it, send the business name and preview link to ${data.contactEmail}.`);

  return { filename: data.pdfFilename, blob: pdf.toBlob() };
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

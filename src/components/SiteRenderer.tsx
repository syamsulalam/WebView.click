import { type CSSProperties, type MouseEvent as ReactMouseEvent, useEffect, useRef, useState } from "react";
import {
  Briefcase,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Facebook,
  Globe,
  Home,
  Image as ImageIcon,
  Images,
  Info,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  PhoneCall,
  Search,
  ShieldCheck,
  Star,
  Truck,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { getShaderPreset, normalizeShaderPreset, normalizeStylePreset, normalizeVisualStyle, siteStylePresetCss } from "../lib/siteStylePresets";
import { fontPairingsForText, getFontPairing, googleFontImportUrl } from "../lib/fontPairings";
import { applyGeneratedSitePageInserts } from "../lib/generatedSitePostProcess";
import EditableText, { type EditableTextTag } from "./EditableText";
import WebsiteActionPanel from "./WebsiteActionPanel";

type SiteRendererProps = {
  siteData: any;
  publicLinks?: { basic: string; premium: string };
  businessId?: string;
  showProspectPanel?: boolean;
  onDownloadZip?: (siteData?: any) => void;
};

function hexToRgb(hex: string) {
  const normalized = hex.trim().replace("#", "");
  const expanded = normalized.length === 3 ? normalized.split("").map((char) => char + char).join("") : normalized;
  if (!/^[0-9a-f]{6}$/i.test(expanded)) return null;
  return {
    r: parseInt(expanded.slice(0, 2), 16),
    g: parseInt(expanded.slice(2, 4), 16),
    b: parseInt(expanded.slice(4, 6), 16),
  };
}

function relativeLuminance(hex: string) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const channel = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

function contrastRatio(hexA: string, hexB: string) {
  const light = Math.max(relativeLuminance(hexA), relativeLuminance(hexB));
  const dark = Math.min(relativeLuminance(hexA), relativeLuminance(hexB));
  return (light + 0.05) / (dark + 0.05);
}

function readableTextForBackground(hex: string) {
  if (!hexToRgb(hex)) return "#0F172A";
  const darkText = "#0F172A";
  const lightText = "#FFFFFF";
  return contrastRatio(hex, lightText) >= contrastRatio(hex, darkText) && contrastRatio(hex, lightText) >= 4.5
    ? lightText
    : darkText;
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0")).join("")}`;
}

function darkenColor(hex: string, factor: number) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return rgbToHex(rgb.r * factor, rgb.g * factor, rgb.b * factor);
}

function readableBrandColor(hex: string, surface = "#FFFFFF") {
  if (!hexToRgb(hex)) return hex;
  let current = hex;
  let factor = 0.86;
  while (contrastRatio(current, surface) < 3 && factor > 0.28) {
    current = darkenColor(hex, factor);
    factor -= 0.1;
  }
  return current;
}

function normalizeSiteData(siteData: any) {
  const meta = siteData?.meta || {};
  const design = siteData?.design || {};
  const themeVariables = design.themeVariables || {};
  const colors = themeVariables.colors || {};
  const typography = themeVariables.typography || design.typography || {};
  const globalConfig = siteData?.global || {};
  const header = globalConfig.header || {};
  const footer = globalConfig.footer || {};
  const navigation = siteData?.navigation || {};
  const pages = Array.isArray(siteData?.pages) ? siteData.pages : [];
  const sourceData = siteData?.sourceData || {};
  const trust = siteData?.trust || globalConfig.socialProof || {};
  const businessProfile = siteData?.businessProfile || {};
  const brand = siteData?.brand || {};
  const offers = Array.isArray(siteData?.offers) ? siteData.offers : [];
  const products = Array.isArray(siteData?.products) ? siteData.products : [];
  const services = Array.isArray(siteData?.services) ? siteData.services : [];
  const capabilities = Array.isArray(siteData?.capabilities) ? siteData.capabilities : [];
  const location = siteData?.location || {};
  const hours = siteData?.hours || {};
  const conversion = siteData?.conversion || {};
  const isIndonesian = meta.language === "id";
  const contactNormalizedSite = {
    ...siteData,
    meta,
    offers,
    products,
    services,
    businessProfile,
    location,
    hours,
    sourceData,
    global: globalConfig,
    navigation: {
      ...navigation,
      headerMenu: Array.isArray(navigation.headerMenu) ? [...navigation.headerMenu] : navigation.headerMenu,
    },
    pages: [...pages],
  };
  applyGeneratedSitePageInserts(contactNormalizedSite, sourceData);
  const normalizedPages = Array.isArray(contactNormalizedSite.pages) ? contactNormalizedSite.pages : pages;
  const normalizedNavigation: any = contactNormalizedSite.navigation && typeof contactNormalizedSite.navigation === "object"
    ? contactNormalizedSite.navigation
    : navigation;
  const normalizedDesign = contactNormalizedSite.design && typeof contactNormalizedSite.design === "object"
    ? contactNormalizedSite.design
    : design;
  const normalizedThemeVariables = normalizedDesign.themeVariables || themeVariables || {};
  const normalizedColors = normalizedThemeVariables.colors || colors || {};
  const normalizedTypography = normalizedThemeVariables.typography || normalizedDesign.typography || typography || {};
  const stylePreset = normalizedDesign.stylePreset || normalizedThemeVariables.stylePreset || brand.visualStyle || "local-clean";
  const visualStyle = normalizedDesign.visualStyle || normalizedDesign.shapeStyle || brand.imageTreatment || "soft-rounded";
  const shaderConfig = normalizedDesign.shaderConfig && typeof normalizedDesign.shaderConfig === "object" ? normalizedDesign.shaderConfig : {};
  const shaderPreset = normalizedDesign.shaderPreset || shaderConfig.preset || normalizedThemeVariables.shaderPreset || "local-aurora";
  const fontPairing = normalizedDesign.fontPairing || normalizedTypography.fontPairing || "montserrat-raleway";
  const designIntent = normalizedDesign.designIntent && typeof normalizedDesign.designIntent === "object"
    ? normalizedDesign.designIntent
    : {
        compositionPattern: normalizedDesign.compositionPattern,
        heroLayout: normalizedDesign.heroLayout,
        mediaStrategy: normalizedDesign.mediaStrategy,
        proofTreatment: normalizedDesign.proofTreatment,
        cardDensity: normalizedDesign.cardDensity,
        ctaTreatment: normalizedDesign.ctaTreatment,
        motionLevel: normalizedDesign.motionLevel,
        sectionRhythm: normalizedDesign.sectionRhythm,
        detailLayout: normalizedDesign.detailLayout,
        antiPatterns: normalizedDesign.antiPatterns,
      };
  const baseHeaderMenu = Array.isArray(normalizedNavigation.headerMenu)
    ? normalizedNavigation.headerMenu
    : normalizedPages.map((page: any) => ({ label: page.pageTitle || page.pageId, href: `#${page.pageId}` }));
  const headerMenu = baseHeaderMenu.filter((item: any) => String(item?.href || "") !== "#feedback");
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
  const headerMenuWithAreas = servedAreas.length > 0 && !headerMenu.some((item: any) => String(item?.href || "") === "#areas-served")
    ? [...headerMenu, { label: isIndonesian ? "Area Layanan" : "Areas Served", href: "#areas-served" }]
    : headerMenu;

  const backgroundColor = normalizedColors.background || "#FFFFFF";
  const primaryColor = readableBrandColor(normalizedColors.primary || "#111827", backgroundColor);
  const secondaryColor = normalizedColors.secondary || "#F3F4F6";
  const accentColor = readableBrandColor(normalizedColors.accent || "#4F46E5", backgroundColor);

  return {
    meta: {
      businessName: meta.businessName || "Demo Business",
      businessId: meta.businessId || "demo-business",
      ...meta,
    },
    colors: {
      primary: primaryColor,
      secondary: secondaryColor,
      accent: accentColor,
      textMain: normalizedColors.textMain || "#1F2937",
      textMuted: normalizedColors.textMuted || "#6B7280",
      background: backgroundColor,
      onPrimary: normalizedColors.onPrimary || normalizedColors.headerText || normalizedColors.buttonPrimaryText || readableTextForBackground(primaryColor),
      onAccent: normalizedColors.onAccent || normalizedColors.buttonAccentText || readableTextForBackground(accentColor),
      onSecondary: normalizedColors.onSecondary || readableTextForBackground(secondaryColor),
      onBackground: normalizedColors.onBackground || readableTextForBackground(backgroundColor),
    },
    typography: {
      headingFont: normalizedTypography.headingFont || "'Inter', sans-serif",
      bodyFont: normalizedTypography.bodyFont || "'Inter', sans-serif",
    },
    stylePreset,
    visualStyle,
    shaderPreset,
    shaderConfig,
    fontPairing,
    fontPairingConfig: normalizedDesign.fontPairingConfig || {},
    designIntent,
    designAudit: normalizedDesign.designAudit || {},
    brand: {
      logoImageUrl: brand.logoImageUrl || header.logoImageUrl || "",
      logoSvg: brand.logoSvg || header.logoSvg || "",
      preferredHeroImage: brand.preferredHeroImage || "",
      palette: Array.isArray(brand.palette) ? brand.palette : [],
      paletteOptions: Array.isArray(brand.paletteOptions) ? brand.paletteOptions : [],
      photoSource: brand.photoSource || "",
      googlePhotoReference: brand.googlePhotoReference || "",
      photoCaption: brand.photoCaption || "",
      photoAttributions: Array.isArray(brand.photoAttributions) ? brand.photoAttributions : [],
    },
    businessProfile: {
      name: businessProfile.name || meta.businessName || "Demo Business",
      typeLabel: businessProfile.typeLabel || meta.niche || "Local business",
      shortPitch: businessProfile.shortPitch || meta.seoDescription || "",
      contact: {
        phoneNational: businessProfile.contact?.phoneNational || "",
        phoneInternational: businessProfile.contact?.phoneInternational || "",
        directionsUrl: businessProfile.contact?.directionsUrl || "",
        ...businessProfile.contact,
      },
      ...businessProfile,
    },
    trust: {
      rating: Number(trust.rating || trust.googleRating || 0),
      reviewCount: Number(trust.reviewCount || 0),
      reviewSummary: trust.reviewSummary || "",
      reviews: Array.isArray(trust.reviews) ? trust.reviews : [],
      badges: Array.isArray(trust.badges) ? trust.badges : [],
    },
    offers,
    products,
    services,
    capabilities,
    sourceData,
    location,
    servedAreas,
    hours,
    conversion: {
      primaryCta: conversion.primaryCta || header.ctaButton || { text: "Hubungi Kami", href: "#contact" },
      secondaryCta: conversion.secondaryCta || { text: meta.language === "id" ? "Lihat Lokasi" : "View Location", href: "#contact" },
      stickyMobileCta: Boolean(conversion.stickyMobileCta),
      ...conversion,
    },
    globalConfig: {
      ...globalConfig,
      header: {
        ctaButton: { text: "Hubungi Kami", href: "#contact" },
        ...header,
        ctaButton: {
          text: header.ctaButton?.text || "Hubungi Kami",
          href: header.ctaButton?.href || "#contact",
        },
      },
      footer: {
        text: footer.text || `© 2026 ${meta.businessName || "Demo Business"}.`,
        ...footer,
      },
    },
    navigation: {
      headerMenu: headerMenuWithAreas,
    },
    pages: normalizedPages,
  };
}

function isUsableImage(src?: string) {
  return Boolean(src && (src.startsWith("http") || src.startsWith("/") || src.startsWith("data:")));
}

function isGooglePlacesImage(src?: string) {
  if (!src) return false;
  try {
    const url = new URL(src, window.location.origin);
    return (
      url.pathname.startsWith("/api/places/photo") ||
      url.hostname.endsWith("googleusercontent.com") ||
      (url.hostname === "maps.googleapis.com" && url.pathname.includes("/place/photo")) ||
      (url.hostname === "places.googleapis.com" && url.pathname.includes("/photos/") && url.pathname.endsWith("/media"))
    );
  } catch {
    return src.startsWith("/api/places/photo");
  }
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
    .slice(0, 12);
}

function attributionText(src?: string, attributions: string[] = [], source = "", caption = "") {
  if (source !== "google_places" && !isGooglePlacesImage(src)) return "";
  const cleanAttributions = attributions.map((item) => String(item).replace(/<[^>]*>/g, "").trim()).filter(Boolean);
  const base = caption || "Photo from Google Business Profile";
  return cleanAttributions.length ? `${base}: ${cleanAttributions.join(", ")}` : base;
}

function inferMenuIconId(key = "") {
  if (key.includes("home") || key.includes("beranda")) return "home";
  if (key.includes("about") || key.includes("tentang")) return "info";
  if (key.includes("service") || key.includes("layanan") || key.includes("menu")) return "service";
  if (key.includes("gallery") || key.includes("galeri")) return "gallery";
  if (key.includes("area") || key.includes("city") || key.includes("lokasi")) return "map";
  if (key.includes("contact") || key.includes("kontak")) return "mail";
  return "image";
}

const siteIconOptions = [
  { id: "home", label: "Home", keywords: "home beranda main" },
  { id: "info", label: "Info", keywords: "about info detail learn" },
  { id: "image", label: "Image", keywords: "image photo picture visual" },
  { id: "gallery", label: "Gallery", keywords: "gallery photos images galeri" },
  { id: "phone", label: "Call", keywords: "phone call tel telepon hubungi whatsapp quote estimate" },
  { id: "mail", label: "Email", keywords: "email mail contact kontak inquiry message" },
  { id: "map", label: "Map", keywords: "map directions location lokasi alamat address visit" },
  { id: "message", label: "Message", keywords: "message chat whatsapp sms text ask consultation" },
  { id: "calendar", label: "Schedule", keywords: "schedule booking appointment calendar time hours" },
  { id: "quote", label: "Quote", keywords: "quote estimate pricing price proposal request" },
  { id: "service", label: "Services", keywords: "service product layanan produk package offer" },
  { id: "star", label: "Review", keywords: "review rating star testimonial trust" },
  { id: "facebook", label: "Facebook", keywords: "facebook social page" },
  { id: "instagram", label: "Instagram", keywords: "instagram social photo" },
  { id: "linkedin", label: "LinkedIn", keywords: "linkedin social professional" },
  { id: "users", label: "Customers", keywords: "customers users team staff people client" },
  { id: "truck", label: "Delivery", keywords: "truck delivery concrete transport" },
  { id: "wrench", label: "Repair", keywords: "repair install service fix maintenance" },
  { id: "shield", label: "Trust", keywords: "trust safe shield reliable professional" },
  { id: "globe", label: "Website", keywords: "website site online learn more visit" },
  { id: "check", label: "Check", keywords: "check confirm submit done start" },
];

function inferCtaIconId(label = "", href = "") {
  const key = `${label} ${href}`.toLowerCase();
  if (key.includes("tel:") || key.includes("phone") || key.includes("telepon") || key.includes("call") || key.includes("hubungi")) return "phone";
  if (key.includes("mailto:") || key.includes("email") || key.includes("contact") || key.includes("kontak")) return "mail";
  if (key.includes("map") || key.includes("direction") || key.includes("lokasi") || key.includes("address")) return "map";
  if (key.includes("message") || key.includes("sms") || key.includes("whatsapp") || key.includes("chat")) return "message";
  if (key.includes("schedule") || key.includes("book") || key.includes("appointment")) return "calendar";
  if (key.includes("estimate") || key.includes("quote") || key.includes("pricing") || key.includes("price")) return "quote";
  if (key.includes("service") || key.includes("product") || key.includes("layanan") || key.includes("produk")) return "service";
  if (key.includes("review") || key.includes("rating")) return "star";
  if (key.includes("website") || key.includes("learn")) return "globe";
  return "check";
}

function renderCtaIcon(iconId: string, size = 16, className = "") {
  const iconProps = { size, className: className || undefined };
  if (iconId === "home") return <Home {...iconProps} />;
  if (iconId === "info") return <Info {...iconProps} />;
  if (iconId === "image") return <ImageIcon {...iconProps} />;
  if (iconId === "gallery") return <Images {...iconProps} />;
  if (iconId === "phone") return <PhoneCall {...iconProps} />;
  if (iconId === "mail") return <Mail {...iconProps} />;
  if (iconId === "map") return <MapPin {...iconProps} />;
  if (iconId === "message") return <MessageCircle {...iconProps} />;
  if (iconId === "calendar") return <Clock {...iconProps} />;
  if (iconId === "quote") return <ClipboardCheck {...iconProps} />;
  if (iconId === "service") return <Briefcase {...iconProps} />;
  if (iconId === "star") return <Star {...iconProps} fill="currentColor" />;
  if (iconId === "facebook") return <Facebook {...iconProps} />;
  if (iconId === "instagram") return <Instagram {...iconProps} />;
  if (iconId === "linkedin") return <Linkedin {...iconProps} />;
  if (iconId === "users") return <Users {...iconProps} />;
  if (iconId === "truck") return <Truck {...iconProps} />;
  if (iconId === "wrench") return <Wrench {...iconProps} />;
  if (iconId === "shield") return <ShieldCheck {...iconProps} />;
  if (iconId === "globe") return <Globe {...iconProps} />;
  return <CheckCircle2 {...iconProps} />;
}

function copyIconCandidates(label = "", description = "") {
  const key = `${label} ${description}`.toLowerCase();
  const candidates: string[] = [];
  if (/\b(phone|call|quote|estimate|pricing|telepon|hubungi|tanya|estimasi)\b/.test(key)) candidates.push("phone");
  if (/\b(email|mail)\b/.test(key)) candidates.push("mail");
  if (/\b(contact|kontak)\b/.test(key)) candidates.push("phone", "mail");
  if (/\b(map|maps|location|address|directions|local|nearby|area|city|dallas|lokasi|alamat|wilayah)\b/.test(key)) candidates.push("map");
  if (/\b(24|hour|hours|open|schedule|scheduling|timing|punctual|on time|availability|booking|weekday|weekend|jam|jadwal|tepat waktu)\b/.test(key)) candidates.push("clock");
  if (/\b(review|rating|recommended|reputation|customers say|testimonial|stars|google rating|ulasan|rating)\b/.test(key)) candidates.push("star", "users");
  if (/\b(customer|client|team|staff|crew|support|communication|responsive|coordination|koordinasi|pelanggan|tim)\b/.test(key)) candidates.push("users");
  if (/\b(truck|delivery|deliver|ready mix|concrete|cement|pour|slab|driveway|flatwork|batch|plant|beton|cor|semen)\b/.test(key)) candidates.push("truck");
  if (/\b(project|scope|planning|plan|site|on-site|inspection|estimate request|intake|timeline|proyek|rencana)\b/.test(key)) candidates.push("clipboard");
  if (/\b(repair|install|build|contractor|construction|service|maintenance|work|fix|layanan|perbaikan|pasang)\b/.test(key)) candidates.push("wrench");
  if (/\b(professional|reliable|trusted|dependable|quality|licensed|safe|care|protect|terpercaya|profesional|andal)\b/.test(key)) candidates.push("shield");
  if (/\b(service|product|offer|menu|package|selection|layanan|produk|paket)\b/.test(key)) candidates.push("briefcase");
  candidates.push("check");
  return Array.from(new Set(candidates));
}

function copyIconId(label = "", description = "", usedIcons?: Set<string>) {
  const fallback = ["check", "shield", "clipboard", "users", "briefcase", "clock", "map", "phone", "star", "truck", "wrench", "mail"];
  const icon = [...copyIconCandidates(label, description), ...fallback].find((item) => !usedIcons?.has(item)) || "check";
  usedIcons?.add(icon);
  return icon === "clock" ? "calendar" : icon === "clipboard" ? "quote" : icon === "briefcase" ? "service" : icon;
}

function inferSocialIconId(platform = "") {
  const key = platform.toLowerCase();
  if (key.includes("instagram")) return "instagram";
  if (key.includes("facebook")) return "facebook";
  if (key.includes("linkedin")) return "linkedin";
  if (key.includes("whatsapp")) return "message";
  return "globe";
}

function phoneHref(value = "") {
  if (!value) return "";
  if (isPlaceholderPhone(value)) return "";
  if (value.startsWith("tel:")) return value;
  const normalized = value.replace(/[^\d+]/g, "");
  return normalized ? `tel:${normalized}` : "";
}

function tidyDanglingCopy(value: unknown) {
  return String(value ?? "").trim().replace(/\s+[a-z]$/g, "").trim();
}

function isPlaceholderPhone(value = "") {
  const digits = value.replace(/\D/g, "");
  return !digits || /^0+$/.test(digits);
}

function mailHref(email = "", subject = "", body = "") {
  const cleanEmail = email.trim();
  if (!cleanEmail) return "";
  const params = new URLSearchParams();
  if (subject) params.set("subject", subject);
  if (body) params.set("body", body);
  const query = params.toString();
  return `mailto:${cleanEmail}${query ? `?${query}` : ""}`;
}

function normalizedFieldName(field: any, index: number) {
  const raw = String(field?.name || field?.id || field?.label || `field_${index}`).toLowerCase();
  if (raw.includes("email")) return "email";
  if (raw.includes("nama") || raw.includes("name")) return "name";
  if (raw.includes("pesan") || raw.includes("message") || raw.includes("note")) return "message";
  if (raw.includes("phone") || raw.includes("telepon") || raw.includes("whatsapp")) return "phone";
  return raw.replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "") || `field_${index}`;
}

function offeringHref(item: any) {
  if (typeof item?.href === "string" && item.href) return item.href;
  if (typeof item?.detailPageId === "string" && item.detailPageId) return `#${item.detailPageId}`;
  if (typeof item?.cta?.href === "string" && item.cta.href) return item.cta.href;
  return "";
}

function priceHintLooksAction(value: unknown) {
  const text = String(value || "").toLowerCase();
  return /\b(contact|estimate|quote|call|consult|ask|hubungi|estimasi|penawaran|telepon|konsultasi|tanya)\b/.test(text);
}

function titleCaseLabel(value = "") {
  const stopWords = new Set(["and", "or", "for", "of", "the", "a", "an", "to", "in", "on", "at", "by", "with", "dan", "atau", "untuk", "di", "ke", "dari", "yang"]);
  return String(value)
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (/^[A-Z0-9]{2,}$/.test(word)) return word;
      if (index > 0 && stopWords.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function formatOfferHeading(value: unknown) {
  const text = String(value || "").trim();
  if (!text) return "";
  return titleCaseLabel(text);
}

function parseHourLine(item: any) {
  const text = typeof item === "string" ? item : item?.text || item?.label || "";
  const normalized = String(text || "").trim();
  if (!normalized) return { day: "", time: "" };
  const parts = normalized.split(/:\s+/);
  if (parts.length > 1) return { day: parts.shift() || "", time: parts.join(": ") };
  const dashParts = normalized.split(/\s+[–-]\s+/);
  if (dashParts.length > 1) return { day: dashParts.shift() || "", time: dashParts.join(" - ") };
  return { day: normalized, time: "" };
}

function compactHoursGroups(items: any[]) {
  const parsed = items.map(parseHourLine).filter((item) => item.day || item.time);
  const groups: Array<{ days: string[]; time: string }> = [];
  parsed.forEach((item) => {
    const time = item.time || item.day;
    const day = item.time ? item.day : "";
    const last = groups[groups.length - 1];
    if (last && last.time === time) {
      if (day) last.days.push(day);
    } else {
      groups.push({ days: day ? [day] : [], time });
    }
  });
  return groups;
}

function shortDayLabel(day = "", isIndonesian = false) {
  const clean = day.trim();
  const lower = clean.toLowerCase();
  const en: Record<string, string> = {
    monday: "Mon",
    tuesday: "Tue",
    wednesday: "Wed",
    thursday: "Thu",
    friday: "Fri",
    saturday: "Sat",
    sunday: "Sun",
  };
  const id: Record<string, string> = {
    senin: "Sen",
    selasa: "Sel",
    rabu: "Rab",
    kamis: "Kam",
    jumat: "Jum",
    sabtu: "Sab",
    minggu: "Min",
  };
  return (isIndonesian ? id[lower] : en[lower]) || clean;
}

function hoursGroupLabel(group: { days: string[]; time: string }, isIndonesian = false) {
  const days = group.days.filter(Boolean);
  if (days.length > 1) return `${shortDayLabel(days[0], isIndonesian)}-${shortDayLabel(days[days.length - 1], isIndonesian)}`;
  if (days.length === 1) return shortDayLabel(days[0], isIndonesian);
  return isIndonesian ? "Jam" : "Hours";
}

function footerHoursLines(items: any[], isIndonesian = false) {
  return compactHoursGroups(items).slice(0, 3).map((group) => `${hoursGroupLabel(group, isIndonesian)}: ${group.time}`);
}

function ImageFrame({
  src,
  label,
  className = "",
  attribution = "",
  exportName = "",
  editMode = false,
  replacementSrc = "",
  onReplace,
  onRestore,
}: {
  src?: string;
  label?: string;
  className?: string;
  attribution?: string;
  exportName?: string;
  editMode?: boolean;
  replacementSrc?: string;
  onReplace?: () => void;
  onRestore?: () => void;
}) {
  const displaySrc = replacementSrc || src;
  const canReplace = editMode && typeof onReplace === "function";
  const canRestore = editMode && Boolean(replacementSrc) && typeof onRestore === "function";

  return (
    <div className={`group relative w-full h-full ${className}`}>
      {isUsableImage(displaySrc) ? (
        <img src={displaySrc} alt={label || ""} data-wv-image-role={exportName || undefined} className="w-full h-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-slate-100 text-xs text-slate-500">
          {label || src || "Image"}
        </div>
      )}
      {attribution && !replacementSrc && (
        <div className="absolute left-2 right-2 bottom-2 rounded bg-black/65 px-2 py-1 text-[11px] leading-snug text-white">
          {attribution}
        </div>
      )}
      {canReplace && (
        <div
          data-export-remove="true"
          className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/45 text-white opacity-0 transition group-hover:opacity-100 focus-within:opacity-100"
        >
          <div className="flex flex-wrap items-center justify-center gap-2 px-3">
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onReplace?.();
              }}
              className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 shadow-xl"
              aria-label={`Change image${label ? ` for ${label}` : ""}`}
            >
              <ImageIcon size={16} />
              Change image
            </button>
            {canRestore && (
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onRestore?.();
                }}
                className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-slate-950/80 px-4 py-2 text-sm font-semibold text-white shadow-xl"
                aria-label={`Restore original image${label ? ` for ${label}` : ""}`}
              >
                <X size={16} />
                Restore original
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function colorsFromSiteData(siteData: any) {
  const colors = siteData?.design?.themeVariables?.colors || {};
  return [colors.primary, colors.accent, colors.secondary].filter((color) => typeof color === "string" && color.trim());
}

function normalizedPaletteOptionsFromBrand(brand: any, siteData: any) {
  const options = Array.isArray(brand.paletteOptions)
    ? brand.paletteOptions.filter((option: any) => Array.isArray(option?.colors) && option.colors.length > 0)
    : [];
  if (options.length > 0) return options;

  const fallbackPalettes = [
    { id: "brand-palette", label: "Saved brand palette", colors: Array.isArray(brand.palette) ? brand.palette : [] },
    { id: "meta-brand-palette", label: "Generated brand palette", colors: Array.isArray(siteData?.meta?.brandPalette) ? siteData.meta.brandPalette : [] },
    { id: "theme-colors", label: "Current site colors", colors: colorsFromSiteData(siteData) },
  ];
  const seen = new Set<string>();
  return fallbackPalettes
    .map((option) => ({ ...option, colors: option.colors.filter((color: unknown) => typeof color === "string" && color.trim()).slice(0, 5) }))
    .filter((option) => {
      if (option.colors.length === 0) return false;
      const key = option.colors.join("|").toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function imageReplacementStorageKey(businessId: string, metaBusinessId = "") {
  const safeId = (businessId || metaBusinessId || "demo")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "demo";
  return `webview.inlineImages.${safeId}`;
}

function siteIconStorageKey(businessId: string, metaBusinessId = "") {
  const safeId = (businessId || metaBusinessId || "demo")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "demo";
  return `webview.inlineIcons.${safeId}`;
}

function legacyButtonIconStorageKey(businessId: string, metaBusinessId = "") {
  const safeId = (businessId || metaBusinessId || "demo")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "demo";
  return `webview.inlineButtonIcons.${safeId}`;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Image file could not be read."));
    reader.onerror = () => reject(reader.error || new Error("Image file could not be read."));
    reader.readAsDataURL(file);
  });
}

async function imageFileToStoredDataUrl(file: File) {
  const originalDataUrl = await readFileAsDataUrl(file);
  const img = new Image();
  img.src = originalDataUrl;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Image file could not be loaded."));
  });

  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
  const width = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
  const height = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return originalDataUrl;
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.88);
}

export default function SiteRenderer({
  siteData,
  publicLinks = { basic: "", premium: "" },
  businessId = "demo",
  showProspectPanel = true,
  onDownloadZip,
}: SiteRendererProps) {
  const initialPage = siteData?.pages?.[0]?.pageId || "home";
  const [activeTab, setActiveTab] = useState(initialPage);
  const [openMenuKey, setOpenMenuKey] = useState("");
  const [navSubmenuPosition, setNavSubmenuPosition] = useState({ left: 0, top: 0 });
  const [headerCompact, setHeaderCompact] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [imageReplacements, setImageReplacements] = useState<Record<string, string>>({});
  const [siteIconOverrides, setSiteIconOverrides] = useState<Record<string, string>>({});
  const [activeIconPickerKey, setActiveIconPickerKey] = useState("");
  const [iconPickerQuery, setIconPickerQuery] = useState("");
  const [feedbackRating, setFeedbackRating] = useState(0);
  const navCloseTimer = useRef<number | undefined>(undefined);
  const imageFileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingImageKey = useRef("");

  const { meta, colors: baseColors, typography, stylePreset, visualStyle, shaderPreset, shaderConfig, fontPairing, designIntent, designAudit, brand, businessProfile, trust, offers, products, services, capabilities, sourceData, location, servedAreas, hours, conversion, globalConfig, navigation, pages } = normalizeSiteData(siteData);
  const imageReplacementKey = imageReplacementStorageKey(businessId, meta.businessId);
  const iconStorageKey = siteIconStorageKey(businessId, meta.businessId);
  const legacyIconStorageKey = legacyButtonIconStorageKey(businessId, meta.businessId);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(imageReplacementKey);
      const parsed = saved ? JSON.parse(saved) : {};
      setImageReplacements(parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {});
    } catch {
      setImageReplacements({});
    }
  }, [imageReplacementKey]);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(iconStorageKey);
      const legacy = window.localStorage.getItem(legacyIconStorageKey);
      const parsed = saved ? JSON.parse(saved) : {};
      const legacyParsed = legacy ? JSON.parse(legacy) : {};
      const next = {
        ...(legacyParsed && typeof legacyParsed === "object" && !Array.isArray(legacyParsed) ? legacyParsed : {}),
        ...(parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {}),
      };
      setSiteIconOverrides(next);
    } catch {
      setSiteIconOverrides({});
    }
  }, [iconStorageKey, legacyIconStorageKey]);
  const fontContext = [
    meta.businessName,
    meta.niche,
    businessProfile.typeLabel,
    Array.isArray(businessProfile.categories) ? businessProfile.categories.join(" ") : "",
    products.map((product: any) => product.title).join(" "),
    services.map((service: any) => service.title).join(" "),
  ].filter(Boolean).join(" ");
  const availableFontPairings = fontPairingsForText(fontContext, 5);
  const [selectedFontPairingId, setSelectedFontPairingId] = useState(fontPairing);
  useEffect(() => {
    setSelectedFontPairingId(fontPairing);
  }, [fontPairing]);
  const activeFontPairing = getFontPairing(selectedFontPairingId);
  const fontImportUrl = googleFontImportUrl([activeFontPairing, ...availableFontPairings]);
  const paletteOptions = normalizedPaletteOptionsFromBrand(brand, siteData);
  const paletteOptionKey = paletteOptions.map((option: any) => option.id).join("|");
  const [selectedPaletteOptionId, setSelectedPaletteOptionId] = useState(paletteOptions[0]?.id || "");
  useEffect(() => {
    setSelectedPaletteOptionId(paletteOptions[0]?.id || "");
  }, [paletteOptionKey]);
  const activePaletteOption = paletteOptions.find((option: any) => option.id === selectedPaletteOptionId) || paletteOptions[0];
  const activePalette = Array.isArray(activePaletteOption?.colors) ? activePaletteOption.colors : [];
  const colors = activePalette.length > 0
    ? {
        ...baseColors,
        primary: activePalette[0] || baseColors.primary,
        accent: activePalette[1] || baseColors.accent,
        secondary: activePalette[2] || baseColors.secondary,
      }
    : baseColors;
  const normalizedSiteData = {
    ...siteData,
    meta,
    brand,
    businessProfile,
    trust,
    offers,
    products,
    services,
    capabilities,
    sourceData,
    location,
    hours,
    conversion,
    designIntent,
    designAudit,
    global: globalConfig,
    navigation,
    pages,
  };
  const actionPanelSiteData = {
    ...normalizedSiteData,
    design: {
      ...(siteData?.design || {}),
      themeVariables: {
        ...(siteData?.design?.themeVariables || {}),
        colors,
      },
    },
    brand: {
      ...(brand || {}),
      palette: activePalette.length > 0 ? activePalette : Array.isArray(brand.palette) ? brand.palette : [],
      paletteOptions,
    },
  };
  const brandPhotoAttribution = (src?: string) => attributionText(src, brand.photoAttributions, brand.photoSource, brand.photoCaption);
  const presetClass = `wv-preset-${normalizeStylePreset(stylePreset)}`;
  const visualClass = `wv-visual-${normalizeVisualStyle(visualStyle)}`;
  const shaderMeta = getShaderPreset(shaderPreset);
  const shaderClass = `wv-shader-${normalizeShaderPreset(shaderPreset)}`;
  const intent = designIntent || {};
  const compositionClass = intent.compositionPattern ? `wv-composition-${String(intent.compositionPattern).replace(/[^a-z0-9-]+/gi, "-").toLowerCase()}` : "";
  const heroLayout = String(intent.heroLayout || "split-media-proof");
  const mediaStrategy = String(intent.mediaStrategy || "real-photo-hero");
  const proofTreatment = String(intent.proofTreatment || "badge-row");
  const cardDensity = String(intent.cardDensity || "standard");
  const ctaTreatment = String(intent.ctaTreatment || "solid-contrast");
  const sectionRhythm = String(intent.sectionRhythm || "balanced-local");
  const detailLayout = String(intent.detailLayout || "scope-detail");
  const homePageId = pages[0]?.pageId || "home";
  const isIndonesian = meta.language === "id";
  const labels = {
    pages: isIndonesian ? "Halaman" : "Pages",
    highlights: isIndonesian ? "Unggulan" : "Highlights",
    contact: isIndonesian ? "Kontak" : "Contact",
    learnMore: isIndonesian ? "Pelajari Lebih Lanjut" : "Learn More",
    manyReviews: isIndonesian ? "banyak" : "many",
    reviews: isIndonesian ? "review" : "reviews",
    offersEyebrow: isIndonesian ? "Layanan" : "Services",
    offersTitle: isIndonesian ? "Yang Kami Tawarkan" : "What We Offer",
    reviewsEyebrow: isIndonesian ? "Ulasan Pelanggan" : "Customer Reviews",
    reviewsTitle: isIndonesian ? "Dipercaya pelanggan lokal" : "Trusted by local customers",
    hoursTitle: isIndonesian ? "Jam Operasional" : "Business Hours",
    locationTitle: isIndonesian ? "Lokasi & Kontak" : "Location & Contact",
    address: isIndonesian ? "Alamat" : "Address",
    phone: isIndonesian ? "Telepon" : "Phone",
    businessHours: isIndonesian ? "Jam Operasional" : "Business Hours",
    openMaps: isIndonesian ? "Buka Google Maps" : "Open Google Maps",
    areasServedEyebrow: isIndonesian ? "Area layanan" : "Areas served",
    areasServedTitle: isIndonesian ? "Melayani pelanggan di sekitar wilayah ini" : "Serving nearby local customers",
    areasServedDescription: isIndonesian
      ? "Hubungi kami untuk memastikan jadwal, rute, dan ketersediaan layanan di lokasi Anda."
      : "Contact us to confirm scheduling, routing, and service availability for your location.",
    feedbackTitle: isIndonesian ? "Bagaimana pengalaman Anda?" : "How was your experience?",
    feedbackDescription: isIndonesian ? "Pilih rating setelah memakai layanan ini." : "Choose a rating after using this service.",
    feedbackSatisfied: isIndonesian ? "Terima kasih. Kami akan membuka Google Review." : "Thanks. We will open Google Reviews.",
    feedbackImprove: isIndonesian ? "Apa yang bisa diperbaiki?" : "What could be improved?",
    feedbackPlaceholder: isIndonesian ? "Tulis keluhan, masukan, atau hal yang perlu ditindaklanjuti..." : "Write the complaint, feedback, or anything that needs follow-up...",
    feedbackSend: isIndonesian ? "Kirim masukan ke pemilik" : "Send feedback to the owner",
    feedbackNoEmail: isIndonesian ? "Email bisnis belum tersedia, jadi feedback belum bisa dikirim otomatis." : "Business email is not available, so feedback cannot be sent automatically yet.",
    heroFallback: isIndonesian ? `Website resmi ${meta.businessName}` : `${meta.businessName} official website`,
    featuresFallback: isIndonesian ? "Mengapa Memilih Kami?" : "Why Choose Us?",
    capabilityFallback: isIndonesian ? "Tersedia di lokasi ini." : "Available from this business.",
  };
  const editKey = (...parts: Array<string | number | undefined>) =>
    [businessId || meta.businessId || "demo", ...parts]
      .filter((part) => part !== undefined && part !== "")
      .map((part) => String(part).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""))
      .join(".");
  const imageEditKey = (...parts: Array<string | number | undefined>) => editKey("image", ...parts);
  const chooseReplacementImage = (key: string) => {
    pendingImageKey.current = key;
    if (imageFileInputRef.current) {
      imageFileInputRef.current.value = "";
      imageFileInputRef.current.click();
    }
  };
  const handleReplacementImageFile = (file?: File) => {
    const key = pendingImageKey.current;
    if (!key || !file || !file.type.startsWith("image/")) return;
    imageFileToStoredDataUrl(file)
      .then((storedDataUrl) => {
        setImageReplacements((current) => {
          const next = { ...current, [key]: storedDataUrl };
          try {
            window.localStorage.setItem(imageReplacementKey, JSON.stringify(next));
          } catch (error) {
            console.warn("Could not save replacement image in browser storage.", error);
          }
          return next;
        });
      })
      .catch((error) => console.warn("Could not prepare replacement image.", error));
  };
  const restoreOriginalImage = (key: string) => {
    setImageReplacements((current) => {
      const next = { ...current };
      delete next[key];
      try {
        if (Object.keys(next).length > 0) {
          window.localStorage.setItem(imageReplacementKey, JSON.stringify(next));
        } else {
          window.localStorage.removeItem(imageReplacementKey);
        }
      } catch (error) {
        console.warn("Could not update replacement image browser storage.", error);
      }
      return next;
    });
  };
  const editableImage = (
    key: string,
    src: string | undefined,
    label: string | undefined,
    attribution = "",
    exportName = "",
    className = "",
  ) => (
    <ImageFrame
      src={src}
      label={label}
      attribution={attribution}
      exportName={exportName}
      className={className}
      editMode={editMode}
      replacementSrc={imageReplacements[key] || ""}
      onReplace={() => chooseReplacementImage(key)}
      onRestore={() => restoreOriginalImage(key)}
    />
  );
  const editableText = (
    id: string,
    value: string | number | null | undefined,
    as: EditableTextTag = "span",
    className = "",
    style?: CSSProperties,
    multiline = false,
  ) => (
    <EditableText
      as={as}
      storageKey={editKey(/^(header|footer)\./.test(id) ? "global" : activeTab, id)}
      className={className}
      style={style}
      multiline={multiline}
      enabled={editMode}
    >
      {value ?? ""}
    </EditableText>
  );
  const saveSiteIconOverride = (key: string, iconId: string) => {
    setSiteIconOverrides((current) => {
      const next = { ...current };
      if (iconId) next[key] = iconId;
      else delete next[key];
      try {
        if (Object.keys(next).length > 0) {
          window.localStorage.setItem(iconStorageKey, JSON.stringify(next));
        } else {
          window.localStorage.removeItem(iconStorageKey);
        }
      } catch (error) {
        console.warn("Could not save site icon selection in browser storage.", error);
      }
      return next;
    });
  };
  const editableSiteIcon = (key: string, fallbackIcon: string, size = 16, className = "") => {
    const iconId = siteIconOverrides[key] || fallbackIcon;
    return (
      <span
        data-wv-edit-icon={editMode ? "true" : undefined}
        className={`inline-flex shrink-0 items-center justify-center ${editMode ? "rounded-full ring-1 ring-white/70 ring-offset-2 ring-offset-transparent" : ""}`}
        role={editMode ? "button" : undefined}
        tabIndex={editMode ? 0 : undefined}
        title={editMode ? "Choose icon" : undefined}
        onClick={editMode ? (event) => {
          event.preventDefault();
          event.stopPropagation();
          setActiveIconPickerKey(key);
          setIconPickerQuery("");
        } : undefined}
        onKeyDown={editMode ? (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.stopPropagation();
            setActiveIconPickerKey(key);
            setIconPickerQuery("");
          }
        } : undefined}
      >
        {renderCtaIcon(iconId, size, className)}
      </span>
    );
  };
  const editableButtonIcon = (key: string, label = "", href = "", size = 16, className = "") =>
    editableSiteIcon(key, inferCtaIconId(label, href), size, className);
  const editableButtonText = (id: string, value: string | number | null | undefined, className = "") =>
    editableText(`button.${id}`, value, "span", className);
  const normalizedAnchorId = (value = "") => String(value || "").replace(/^#/, "").trim().toLowerCase();
  const sectionMatchesTarget = (section: any, targetId: string) => {
    const target = normalizedAnchorId(targetId);
    const sectionIdValue = normalizedAnchorId(sectionId(section));
    if (!target) return false;
    if (sectionIdValue === target) return true;
    if (target === "contact") {
      const type = String(section?.type || "");
      const title = `${section?.content?.title || ""} ${section?.content?.hoursTitle || ""} ${section?.content?.openingHoursTitle || ""}`.toLowerCase();
      return type === "contactForm" || type === "hoursLocation" || sectionIdValue.endsWith("-contact") || title.includes("contact") || title.includes("kontak");
    }
    return false;
  };
  const pageForTarget = (targetId: string) => {
    const target = normalizedAnchorId(targetId);
    if (!target) return null;
    const directPage = pages.find((page: any) => normalizedAnchorId(page.pageId) === target);
    if (directPage) return directPage;
    return pages.find((page: any) => Array.isArray(page.sections) && page.sections.some((section: any) => sectionMatchesTarget(section, target)));
  };
  const scrollToTarget = (targetId: string) => {
    const target = normalizedAnchorId(targetId);
    if (!target) return;
    const exactTarget = document.getElementById(target);
    if (exactTarget) {
      exactTarget.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (target === "contact") {
      const fallbackTarget = document.querySelector<HTMLElement>(
        '[data-wv-section="contact"], [id$="-contact"], [data-wv-section$="-contact"], [data-wv-contact-section="true"]',
      );
      fallbackTarget?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };
  const changeTab = (pageId: string) => {
    const nextPageId = normalizedAnchorId(pageId) || homePageId;
    const targetPage = pageForTarget(nextPageId);
    const directPageExists = Boolean(targetPage && normalizedAnchorId(targetPage.pageId) === nextPageId);
    if (targetPage?.pageId && !directPageExists) {
      setActiveTab(targetPage.pageId);
      window.requestAnimationFrame(() => {
        scrollToTarget(nextPageId);
      });
      return;
    }
    if (!directPageExists) {
      const target = document.getElementById(nextPageId);
      if (target) {
        const ownerPage = target.closest("[data-wv-page]") as HTMLElement | null;
        const ownerPageId = ownerPage?.getAttribute("data-wv-page") || "";
        if (ownerPageId && ownerPageId !== activeTab && pages.some((page: any) => page.pageId === ownerPageId)) {
          setActiveTab(ownerPageId);
          window.requestAnimationFrame(() => {
            document.getElementById(nextPageId)?.scrollIntoView({ behavior: "smooth", block: "start" });
          });
          return;
        }
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      return;
    }
    setActiveTab(targetPage?.pageId || nextPageId);
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  };
  const sectionId = (section: any, fallback = "") => String(section?.id || fallback || "").trim() || undefined;
  const openNavMenu = (key: string, event?: ReactMouseEvent<HTMLElement>) => {
    if (navCloseTimer.current) window.clearTimeout(navCloseTimer.current);
    if (event?.currentTarget) {
      const rect = event.currentTarget.getBoundingClientRect();
      setNavSubmenuPosition({
        left: Math.max(12, Math.min(rect.left, window.innerWidth - 300)),
        top: rect.bottom + 10,
      });
    }
    setOpenMenuKey(key);
  };
  const scheduleNavMenuClose = () => {
    if (navCloseTimer.current) window.clearTimeout(navCloseTimer.current);
    navCloseTimer.current = window.setTimeout(() => setOpenMenuKey(""), 1800);
  };
  useEffect(() => {
    const hashPageId = window.location.hash.replace(/^#/, "");
    if (hashPageId) {
      const targetPage = pageForTarget(hashPageId);
      if (targetPage?.pageId) {
        const isDirectPage = normalizedAnchorId(targetPage.pageId) === normalizedAnchorId(hashPageId);
        setActiveTab(targetPage.pageId);
        window.requestAnimationFrame(() => {
          if (isDirectPage) window.scrollTo({ top: 0, behavior: "smooth" });
          else scrollToTarget(hashPageId);
        });
      }
    }
  }, [pages.map((page: any) => page.pageId).join("|")]);

  const footerPageMenu = [
    ...navigation.headerMenu,
    ...(pages.some((page: any) => page.pageId === "feedback") && !navigation.headerMenu.some((menu: any) => String(menu.href || "") === "#feedback")
      ? [{ label: isIndonesian ? "Feedback" : "Feedback", href: "#feedback" }]
      : []),
  ];
  const footerSocials = Array.isArray(globalConfig.footer.socials) && globalConfig.footer.socials.length > 0
    ? globalConfig.footer.socials
    : [
        { platform: "Instagram", href: "#" },
        { platform: "Facebook", href: "#" },
        { platform: "LinkedIn", href: "#" },
      ];
  const footerHours = Array.isArray(hours.regular) ? footerHoursLines(hours.regular, isIndonesian) : [];
  const footerOfferings = [...products, ...services];
  const footerHighlights = footerOfferings.length > 0 ? footerOfferings : offers.length > 0 ? offers : capabilities;
  const rawPrimaryPhone = businessProfile.contact?.phoneInternational || businessProfile.contact?.phoneNational || "";
  const rawDisplayPhone = businessProfile.contact?.phoneNational || businessProfile.contact?.phoneInternational || "";
  const primaryPhone = isPlaceholderPhone(rawPrimaryPhone) ? "" : rawPrimaryPhone;
  const displayPhone = isPlaceholderPhone(rawDisplayPhone) ? "" : rawDisplayPhone;
  const displayEmail = businessProfile.contact?.email || businessProfile.email || globalConfig.footer.email || "";
  const sourcePlaceId = String(sourceData.placeId || sourceData.place_id || businessProfile.placeId || businessProfile.place_id || "").trim();
  const googleReviewHref = sourcePlaceId
    ? `https://search.google.com/local/writereview?placeid=${encodeURIComponent(sourcePlaceId)}`
    : String(sourceData.googleMapsUri || businessProfile.contact?.directionsUrl || location.directionsUrl || "").trim();

  const customStyles = {
    "--color-primary": colors.primary,
    "--color-secondary": colors.secondary,
    "--color-accent": colors.accent,
    "--color-on-primary": colors.onPrimary,
    "--color-on-secondary": colors.onSecondary,
    "--color-on-accent": colors.onAccent,
    "--color-on-bg": colors.onBackground,
    "--color-text": colors.textMain,
    "--color-bg": colors.background,
  } as React.CSSProperties;
  const siteCanvasStyles = {
    "--wv-shader-opacity": Number.isFinite(Number(shaderConfig.opacity)) ? String(Math.max(0, Math.min(0.5, Number(shaderConfig.opacity)))) : String(shaderMeta.defaultOpacity),
    "--wv-shader-motion": Number.isFinite(Number(shaderConfig.motion)) ? String(Math.max(0, Math.min(1, Number(shaderConfig.motion)))) : String(shaderMeta.defaultMotion),
    fontFamily: activeFontPairing.bodyCss || typography.bodyFont,
    backgroundColor: "var(--color-bg)",
    color: "var(--color-text)",
  } as React.CSSProperties;

  useEffect(() => {
    const canvas = document.querySelector<HTMLElement>("#rendered-site [data-wv-site-canvas]");
    if (!canvas) return;
    let frame = 0;
    const updatePointer = (event: PointerEvent) => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        canvas.style.setProperty("--wv-pointer-x", ((event.clientX / Math.max(window.innerWidth, 1)) * 100).toFixed(2));
        canvas.style.setProperty("--wv-pointer-y", ((event.clientY / Math.max(window.innerHeight, 1)) * 100).toFixed(2));
      });
    };
    window.addEventListener("pointermove", updatePointer, { passive: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", updatePointer);
    };
  }, [shaderPreset]);

  useEffect(() => {
    const updateHeaderState = () => setHeaderCompact(window.scrollY > 36);
    updateHeaderState();
    window.addEventListener("scroll", updateHeaderState, { passive: true });
    return () => window.removeEventListener("scroll", updateHeaderState);
  }, []);

  useEffect(() => {
    const canvas = document.querySelector<HTMLElement>("#rendered-site [data-wv-site-canvas]");
    if (!canvas) return;
    let frame = 0;
    const minScale = 0.58;
    const maxLines = 3;

    const lineHeightFor = (element: HTMLElement) => {
      const styles = window.getComputedStyle(element);
      const fontSize = Number.parseFloat(styles.fontSize) || 48;
      const lineHeight = Number.parseFloat(styles.lineHeight);
      return Number.isFinite(lineHeight) ? lineHeight : fontSize * 0.98;
    };

    const lineMetricsFor = (element: HTMLElement) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const rects = Array.from(range.getClientRects())
        .filter((rect) => rect.width > 1 && rect.height > 1)
        .sort((a, b) => a.top - b.top || a.left - b.left);
      range.detach();

      const lines: Array<{ top: number; left: number; right: number }> = [];
      rects.forEach((rect) => {
        const line = lines.find((item) => Math.abs(item.top - rect.top) < 3);
        if (line) {
          line.left = Math.min(line.left, rect.left);
          line.right = Math.max(line.right, rect.right);
        } else {
          lines.push({ top: rect.top, left: rect.left, right: rect.right });
        }
      });

      const maxLineWidth = lines.reduce((max, line) => Math.max(max, line.right - line.left), 0);
      return {
        lineCount: lines.length || Math.ceil(element.scrollHeight / Math.max(lineHeightFor(element), 1)),
        widthUsage: maxLineWidth / Math.max(element.clientWidth, 1),
      };
    };

    const fitHeading = (heading: HTMLElement) => {
      const page = heading.closest<HTMLElement>("[data-wv-page]");
      if (page && page.getAttribute("data-wv-page") !== activeTab) return;
      heading.style.removeProperty("--wv-hero-heading-size");
      const baseFontSize = Number.parseFloat(window.getComputedStyle(heading).fontSize) || 56;
      const isMobile = window.matchMedia("(max-width: 640px)").matches;
      const maxScale = isMobile ? 1.36 : 1.62;
      const targetWidthUsage = isMobile ? 0.78 : 0.84;
      const maxFontSize = baseFontSize * maxScale;

      const metrics = () => lineMetricsFor(heading);
      const fitsWithinLineLimit = () => {
        const current = metrics();
        return current.lineCount <= maxLines && heading.scrollHeight <= lineHeightFor(heading) * maxLines + 6;
      };
      const setSize = (size: number) => heading.style.setProperty("--wv-hero-heading-size", `${size.toFixed(2)}px`);

      setSize(maxFontSize);
      if (fitsWithinLineLimit() && metrics().widthUsage >= targetWidthUsage) return;

      heading.style.removeProperty("--wv-hero-heading-size");
      const baseFits = fitsWithinLineLimit();
      let low = baseFits ? baseFontSize : baseFontSize * minScale;
      let high = baseFits ? maxFontSize : baseFontSize;
      if (!baseFits) {
        setSize(low);
        if (!fitsWithinLineLimit()) return;
      }
      for (let i = 0; i < 10; i += 1) {
        const mid = (low + high) / 2;
        setSize(mid);
        if (fitsWithinLineLimit()) {
          low = mid;
        } else {
          high = mid;
        }
      }
      setSize(low);
    };

    const fitHeroHeadings = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        canvas.querySelectorAll<HTMLElement>("[data-wv-hero-heading]").forEach(fitHeading);
      });
    };

    fitHeroHeadings();
    const resizeObserver = new ResizeObserver(fitHeroHeadings);
    resizeObserver.observe(canvas);
    canvas.querySelectorAll<HTMLElement>("[data-wv-hero-heading]").forEach((heading) => resizeObserver.observe(heading));
    const fonts = (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts;
    fonts?.ready?.then(fitHeroHeadings).catch(() => undefined);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
    };
  }, [activeTab, selectedFontPairingId, pages.map((page: any) => page.pageId).join("|")]);

  const navSubmenus = navigation.headerMenu
    .map((menu: any, idx: number) => {
      const pageId = String(menu.href || "").replace("#", "");
      return { menu, menuKey: `${pageId}-${idx}`, children: Array.isArray(menu.children) ? menu.children : [] };
    })
    .filter((item: any) => item.children.length > 0);
  const tabPageIdForHref = (href: string) => {
    const pageId = String(href || "").startsWith("#") ? normalizedAnchorId(href) : "";
    return pageForTarget(pageId)?.pageId || "";
  };
  const tabPropsForHref = (href: string) => {
    const pageId = tabPageIdForHref(href);
    return pageId ? { "data-wv-tab": pageId } : {};
  };
  const handleSiteHrefClick = (href: string, event: ReactMouseEvent<HTMLElement>) => {
    const targetId = String(href || "").startsWith("#") ? normalizedAnchorId(href) : "";
    if (targetId && (pageForTarget(targetId) || document.getElementById(targetId))) {
      event.preventDefault();
      changeTab(targetId);
    }
  };
  const contactActionHref = conversion.primaryCta?.href || globalConfig.header.ctaButton.href || (primaryPhone ? phoneHref(primaryPhone) : "") || "#contact";
  const contactSectionHref = tabPageIdForHref("#contact") ? "#contact" : contactActionHref;
  const heroButtonHref = (button: any) => {
    const rawHref = typeof button?.href === "string" ? button.href.trim() : "";
    if (rawHref && rawHref !== "#") return rawHref;

    const label = String(button?.text || "").toLowerCase();
    const callablePhone = phoneHref(primaryPhone || displayPhone);
    if (label.includes("call") || label.includes("phone") || label.includes("telepon") || label.includes("hubungi")) {
      return callablePhone || contactSectionHref || "#contact";
    }
    if (
      label.includes("estimate") ||
      label.includes("quote") ||
      label.includes("request") ||
      label.includes("schedule") ||
      label.includes("booking") ||
      label.includes("contact")
    ) {
      return contactSectionHref || callablePhone || "#contact";
    }
    return contactSectionHref || callablePhone || "#contact";
  };
  const navigateSiteHref = (href: string) => {
    const targetHref = String(href || "").trim();
    if (!targetHref) return;
    if (targetHref.startsWith("#")) {
      changeTab(targetHref.replace("#", ""));
      return;
    }
    window.location.href = targetHref;
  };
  const chooseFeedbackRating = (rating: number) => {
    if (editMode) return;
    setFeedbackRating(rating);
    if (rating >= 4 && googleReviewHref) {
      window.location.href = googleReviewHref;
    }
  };
  const visibleSiteIconOptions = siteIconOptions.filter((option) => {
    const query = iconPickerQuery.trim().toLowerCase();
    if (!query) return true;
    return `${option.label} ${option.keywords}`.toLowerCase().includes(query);
  });

  return (
    <div style={customStyles} id="rendered-site">
      <style>{`
        ${fontImportUrl ? `@import url('${fontImportUrl}');` : ""}
        #rendered-site [data-wv-site-canvas] h1,
        #rendered-site [data-wv-site-canvas] h2,
        #rendered-site [data-wv-site-canvas] h3,
        #rendered-site [data-wv-site-canvas] .wv-heading {
          font-family: ${activeFontPairing.headingCss || typography.headingFont};
        }
      `}</style>
      <div
        data-wv-site-canvas="true"
        data-wv-composition={intent.compositionPattern || undefined}
        data-wv-hero-layout={heroLayout}
        data-wv-media-strategy={mediaStrategy}
        data-wv-proof-treatment={proofTreatment}
        data-wv-card-density={cardDensity}
        data-wv-cta-treatment={ctaTreatment}
        data-wv-section-rhythm={sectionRhythm}
        data-wv-detail-layout={detailLayout}
        style={siteCanvasStyles}
        className={`min-h-screen flex flex-col ${presetClass} ${visualClass} ${shaderClass} ${compositionClass}`}
      >
      <div data-wv-site-shader="true" aria-hidden="true" />
      <header
        data-wv-site-header="true"
        data-wv-header-compact={headerCompact ? "true" : undefined}
        style={{ background: "var(--wv-header-bg)", color: "var(--wv-header-text)" }}
        className={`${headerCompact ? "px-5 py-2.5" : "px-5 py-4"} md:px-12 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 sticky top-0 z-50 shadow-sm`}
      >
        <button
          type="button"
          onClick={() => changeTab(homePageId)}
          data-wv-tab={homePageId}
          className="min-w-0 max-w-full justify-self-start font-bold text-xl tracking-tight leading-tight flex items-center gap-3 text-left hover:opacity-85 transition"
          aria-label={`Go to ${meta.businessName} home`}
        >
          {brand.logoSvg ? <span className="h-8 w-8 shrink-0 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: brand.logoSvg }} /> : null}
          {isUsableImage(brand.logoImageUrl) ? <img src={brand.logoImageUrl} alt="" data-wv-image-role="logo" className="w-8 h-8 rounded-full object-cover" /> : null}
          {editableText("header.businessName", meta.businessName, "span", "min-w-0 truncate leading-tight")}
        </button>
        <nav className="hidden min-w-0 justify-self-center md:flex items-center justify-center gap-4">
          {navigation.headerMenu.map((menu: any, idx: number) => {
            const pageId = menu.href.replace("#", "");
            const children = Array.isArray(menu.children) ? menu.children : [];
            const menuKey = `${pageId}-${idx}`;
            return (
              <div
                key={idx}
                className="relative"
                data-wv-menu={menuKey}
                onMouseEnter={(event) => openNavMenu(menuKey, event)}
                onMouseLeave={scheduleNavMenuClose}
              >
                <button
                  onClick={() => changeTab(pageId)}
                  data-wv-tab={pageId}
                  className={`${headerCompact ? "h-8" : "h-10"} text-[11px] font-bold uppercase tracking-[0.14em] leading-none hover:opacity-80 transition inline-flex items-center gap-1.5 ${activeTab === pageId ? "border-b-2 border-current" : ""}`}
                >
                  {editableSiteIcon(`nav.${idx}`, inferMenuIconId(`${menu.label} ${menu.href}`), 16)}
                  {menu.label}
                  {children.length > 0 && <span className="text-xs opacity-80">▾</span>}
                </button>
              </div>
            );
          })}
        </nav>
        <a
          href={globalConfig.header.ctaButton.href}
          data-wv-tab={tabPageIdForHref(String(globalConfig.header.ctaButton.href || "")) || undefined}
          onClick={(event) => {
            if (editMode) {
              event.preventDefault();
              return;
            }
            const href = String(globalConfig.header.ctaButton.href || "");
            if (href.startsWith("#")) {
              event.preventDefault();
              changeTab(href.replace("#", ""));
            }
          }}
          style={{ backgroundColor: colors.accent, color: colors.onAccent }}
          className={`${headerCompact ? "h-9" : "h-11"} justify-self-end shrink-0 px-4 py-0 rounded-lg font-medium hover:opacity-90 transition text-sm leading-none inline-flex items-center gap-2`}
        >
          {editableButtonIcon("header.cta", globalConfig.header.ctaButton.text, globalConfig.header.ctaButton.href)}
          {editableButtonText("header.cta", globalConfig.header.ctaButton.text)}
        </a>
      </header>
      {navSubmenus.map((submenu: any) => {
        const submenuOpen = openMenuKey === submenu.menuKey;
        return (
          <div
            key={submenu.menuKey}
            data-wv-submenu
            data-wv-site-submenu="true"
            data-wv-menu-key={submenu.menuKey}
            onMouseEnter={() => openNavMenu(submenu.menuKey)}
            onMouseLeave={scheduleNavMenuClose}
            className={`${submenuOpen ? "visible translate-y-0 opacity-100 pointer-events-auto" : "invisible translate-y-2 opacity-0 pointer-events-none"} fixed z-[90] w-80 border border-slate-200 bg-white p-2 text-slate-900 transition duration-200`}
            style={submenuOpen ? { left: navSubmenuPosition.left, top: navSubmenuPosition.top } : { left: -9999, top: -9999 }}
          >
            {submenu.children.map((child: any) => {
              const childPageId = String(child.href || "").replace("#", "");
              return (
                <button
                  key={child.href || child.label}
                  type="button"
                  data-wv-tab={childPageId}
                  onClick={() => changeTab(childPageId)}
                  className="flex w-full gap-2 px-3 py-2 text-left"
                >
                  <span className="mt-0.5 shrink-0 text-slate-500">{editableSiteIcon(`nav.${submenu.menuKey}.child.${child.href || child.label}`, inferMenuIconId(`${child.label} ${child.href}`), 16)}</span>
                  <span>
                    <span className="block text-sm font-semibold">{titleCaseLabel(child.label)}</span>
                    {child.description && <span className="mt-0.5 block text-xs text-slate-500">{child.description}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        );
      })}

      <main className="flex-1">
        {pages.map((page: any) => (
          <div
            key={page.pageId}
            id={page.pageId}
            data-wv-page={page.pageId}
            className={`transition-opacity duration-300 ${activeTab === page.pageId ? "block animate-in fade-in zoom-in-95" : "hidden"}`}
          >
            {(Array.isArray(page.sections) ? page.sections : []).map((section: any) => {
              if (section.type === "hero") {
                const heroContent = section.content || {};
                const heroImage = heroContent.image || brand.preferredHeroImage;
                const pageHasOfferingDetail = (Array.isArray(page.sections) ? page.sections : []).some((pageSection: any) => pageSection?.type === "offeringDetail");
                const heroHeadline = pageHasOfferingDetail
                  ? formatOfferHeading(heroContent.headline || labels.heroFallback)
                  : heroContent.headline || labels.heroFallback;
                const heroSubheadline = tidyDanglingCopy(heroContent.subheadline || businessProfile.shortPitch);
                const isEmergencyHero = heroLayout === "phone-first-emergency";
                const isAuthorityHero = heroLayout === "authority-panel";
                const isMenuHero = heroLayout === "menu-location";
                const isGalleryHero = heroLayout === "gallery-led";
                const isConsultationHero = heroLayout === "consultation-led";
                const heroSectionClass = isEmergencyHero
                  ? "relative overflow-hidden px-6 py-14 md:py-20 bg-slate-950"
                  : isAuthorityHero
                    ? "relative overflow-hidden px-6 py-16 md:py-24 bg-slate-100"
                    : isMenuHero
                      ? "relative overflow-hidden px-6 py-14 md:py-20 bg-orange-50"
                      : isGalleryHero
                        ? "relative overflow-hidden px-6 py-14 md:py-24 bg-stone-50"
                        : isConsultationHero
                          ? "relative overflow-hidden px-6 py-16 md:py-24 bg-slate-50"
                          : "relative overflow-hidden px-6 py-16 md:py-24 bg-white";
                const heroGridClass = isAuthorityHero || isConsultationHero
                  ? "relative z-10 max-w-6xl mx-auto grid md:grid-cols-[0.9fr_1.1fr] gap-10 items-center"
                  : isEmergencyHero
                    ? "relative z-10 max-w-6xl mx-auto grid md:grid-cols-[1.2fr_0.8fr] gap-8 items-center"
                    : "relative z-10 max-w-6xl mx-auto grid md:grid-cols-[1.05fr_0.95fr] gap-10 items-center";
                const heroPanelClass = isEmergencyHero
                  ? "rounded-xl border border-white/10 bg-white/10 p-6 shadow-xl shadow-black/20 backdrop-blur md:p-8"
                  : isAuthorityHero
                    ? "rounded-lg border border-slate-300 bg-white p-6 shadow-lg shadow-slate-900/10 md:p-8"
                    : isMenuHero
                      ? "rounded-2xl border border-orange-100 bg-white/95 p-6 shadow-xl shadow-orange-900/10 backdrop-blur md:p-8"
                      : isGalleryHero
                        ? "rounded-xl border border-stone-200 bg-white/95 p-6 shadow-xl shadow-stone-900/10 backdrop-blur md:p-8"
                        : "rounded-2xl border border-white/70 bg-white/90 p-6 shadow-xl shadow-slate-900/10 backdrop-blur md:p-8";
                const heroHeadingClass = isEmergencyHero
                  ? "text-4xl md:text-6xl font-bold mb-6 leading-tight text-white"
                  : "text-4xl md:text-6xl font-bold mb-6 leading-tight text-slate-950";
                const heroBodyClass = isEmergencyHero ? "text-lg md:text-xl mb-8 text-white/75 max-w-2xl" : "text-lg md:text-xl mb-8 text-slate-600 max-w-2xl";
                const heroProofClass = isEmergencyHero || proofTreatment === "emergency-rail"
                  ? "mt-8 flex flex-wrap gap-2 text-sm text-white/85"
                  : proofTreatment === "authority-bar"
                    ? "mt-8 grid gap-2 text-sm text-slate-700 sm:grid-cols-3"
                    : proofTreatment === "location-strip"
                      ? "mt-8 flex flex-wrap gap-2 text-sm text-orange-950"
                      : proofTreatment === "gallery-proof"
                        ? "mt-8 flex flex-wrap gap-2 text-sm text-stone-700"
                        : "mt-8 flex flex-wrap gap-3 text-sm text-slate-600";
                const heroProofItemClass = isEmergencyHero || proofTreatment === "emergency-rail"
                  ? "inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1"
                  : proofTreatment === "authority-bar"
                    ? "inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                    : proofTreatment === "location-strip"
                      ? "inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1"
                      : proofTreatment === "gallery-proof"
                        ? "inline-flex items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-3 py-1"
                        : "inline-flex items-center gap-2";
                const heroMediaClass = isAuthorityHero
                  ? "h-[340px] md:h-[500px] rounded-lg overflow-hidden border border-slate-300 shadow-xl bg-slate-100"
                  : isEmergencyHero
                    ? "h-[280px] md:h-[460px] rounded-xl overflow-hidden border border-white/15 shadow-2xl bg-slate-900"
                    : isGalleryHero || mediaStrategy === "gallery-grid"
                      ? "h-[360px] md:h-[540px] rounded-xl overflow-hidden border border-stone-200 shadow-xl bg-stone-100"
                      : "h-[360px] md:h-[520px] rounded-2xl overflow-hidden border border-slate-200 shadow-xl bg-slate-100";
                return (
                  <section
                    key={section.id}
                    data-wv-hero-section="true"
                    data-wv-hero-layout={heroLayout}
                    data-wv-media-strategy={mediaStrategy}
                    className={heroSectionClass}
                  >
                    {isUsableImage(heroImage) && (
                      <>
                        <div
                          aria-hidden="true"
                          className="absolute inset-0 bg-cover bg-center opacity-20 blur-sm scale-105"
                          style={{ backgroundImage: `url("${String(heroImage).replace(/"/g, "%22")}")` }}
                        />
                        <div
                          aria-hidden="true"
                          className={isEmergencyHero
                            ? "absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/90 to-slate-950/70"
                            : "absolute inset-0 bg-gradient-to-r from-white via-white/90 to-white/70"}
                        />
                      </>
                    )}
                    <div className={heroGridClass}>
                      <div className={heroPanelClass}>
                        <p className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: colors.accent }}>
                          {editableText(`${section.id}.eyebrow`, businessProfile.typeLabel, "span")}
                        </p>
                        <h1 data-wv-hero-heading="true" className={heroHeadingClass}>
                          {editableText(`${section.id}.headline`, heroHeadline, "span")}
                        </h1>
                        <p className={heroBodyClass}>
                          {editableText(`${section.id}.subheadline`, heroSubheadline, "span", "", undefined, true)}
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3">
                          {(heroContent.buttons || []).map((btn: any, i: number) => {
                            const href = heroButtonHref(btn);
                            const tabPageId = tabPageIdForHref(href);
                            return (
                              <button
                                type="button"
                                key={i}
                                data-wv-tab={tabPageId || undefined}
                                style={{
                                  backgroundColor: btn.style === "primary" ? colors.accent : "transparent",
                                  color: btn.style === "primary" ? colors.onAccent : isEmergencyHero ? "#fff" : colors.textMain,
                                  border: `1px solid ${btn.style === "primary" ? colors.accent : isEmergencyHero ? "rgba(255,255,255,0.35)" : "#CBD5E1"}`,
                                }}
                                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold transition hover:translate-y-[-1px]"
                                onClick={(event) => {
                                  if (editMode) {
                                    event.preventDefault();
                                    return;
                                  }
                                  navigateSiteHref(href);
                                }}
                              >
                                {editableButtonIcon(`${page.pageId}.${section.id}.hero.${i}`, btn.text || labels.learnMore, href)}
                                {editableButtonText(`${page.pageId}.${section.id}.hero.${i}`, btn.text || labels.learnMore)}
                              </button>
                            );
                          })}
                        </div>
                        {(trust.rating > 0 || displayPhone || (Array.isArray(conversion.proofBadges) && conversion.proofBadges.length > 0)) && (
                          <div className={heroProofClass}>
                            {trust.rating > 0 && <span className={heroProofItemClass}><span style={{ color: colors.accent }}>{editableSiteIcon("hero.rating", "star", 16)}</span> {trust.rating.toFixed(1)} {isIndonesian ? "dari" : "from"} {trust.reviewCount || labels.manyReviews} {labels.reviews}</span>}
                            {displayPhone && (
                              <a href={phoneHref(primaryPhone || displayPhone)} className={`${heroProofItemClass} hover:underline`}>
                                {editableSiteIcon("hero.phone", "phone", 16)} {displayPhone}
                              </a>
                            )}
                            {Array.isArray(conversion.proofBadges) && conversion.proofBadges.slice(0, 3).map((badge: string, i: number) => (
                              <span key={`${badge}-${i}`} className={heroProofItemClass}>
                                <span style={{ color: colors.accent }}>{editableSiteIcon(`hero.proof.${i}`, i === 0 ? "check" : "shield", 16)}</span>
                                {editableText(`${section.id}.proof.${i}`, badge, "span")}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className={heroMediaClass}>
                        {editableImage(imageEditKey(page.pageId, section.id, "hero"), heroImage, heroContent.image || meta.businessName, brandPhotoAttribution(heroImage), "hero")}
                      </div>
                    </div>
                  </section>
                );
              }

              if (section.type === "trustBar") {
                const items = section.content?.items || [
                  trust.rating ? { label: "Google Rating", value: trust.rating.toFixed(1), icon: "star" } : null,
                  trust.reviewCount ? { label: "Reviews", value: `${trust.reviewCount}+`, icon: "check" } : null,
                  displayPhone ? { label: "Phone", value: displayPhone, icon: "phone" } : null,
                ].filter(Boolean);
                const usedTrustIcons = new Set<string>();
                const trustSectionClass = proofTreatment === "emergency-rail"
                  ? "px-6 py-5 bg-slate-950 text-white border-y border-white/10"
                  : proofTreatment === "authority-bar"
                    ? "px-6 py-5 bg-white border-y border-slate-300"
                    : proofTreatment === "location-strip"
                      ? "px-6 py-5 bg-orange-50 border-y border-orange-200"
                      : proofTreatment === "gallery-proof"
                        ? "px-6 py-5 bg-stone-50 border-y border-stone-200"
                        : "px-6 py-6 bg-slate-50 border-y border-slate-200";
                const trustCardClass = proofTreatment === "emergency-rail"
                  ? "flex flex-col items-center justify-center gap-2 rounded-lg bg-white/10 border border-white/10 px-4 py-4 text-center"
                  : proofTreatment === "authority-bar"
                    ? "flex flex-col items-center justify-center gap-2 rounded-md bg-slate-50 border border-slate-200 px-4 py-4 text-center"
                    : "flex flex-col items-center justify-center gap-2 rounded-lg bg-white border border-slate-200 px-4 py-4 text-center";
                const trustValueClass = proofTreatment === "emergency-rail" ? "text-xl font-bold text-white" : "text-xl font-bold text-slate-950";
                const trustLabelClass = proofTreatment === "emergency-rail" ? "text-xs uppercase tracking-wide text-white/60" : "text-xs uppercase tracking-wide text-slate-500";
                return (
                  <section key={section.id} data-wv-proof-treatment={proofTreatment} className={trustSectionClass}>
                    <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {items.map((item: any, i: number) => (
                        <div key={i} className={trustCardClass}>
                          <span data-wv-qa-icon="trustBar" className="inline-flex" style={{ color: colors.primary }}>
                            {editableSiteIcon(`${page.pageId}.${section.id}.trust.${i}`, copyIconId(item.label || item.icon || "", item.value || "", usedTrustIcons), 30, "shrink-0")}
                          </span>
                          <div>
                            {editableText(`${section.id}.trust.${i}.value`, item.value, "p", trustValueClass)}
                            {editableText(`${section.id}.trust.${i}.label`, item.label, "p", trustLabelClass)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              }

              if (section.type === "features") {
                const items = section.content?.items || capabilities.filter((item: any) => item.enabled !== false).map((item: any) => ({ title: item.label, description: item.description || labels.capabilityFallback }));
                const usedFeatureIcons = new Set<string>();
                return (
                  <section key={section.id} className="py-20 px-6 bg-black/5">
                    <div className="max-w-6xl mx-auto">
                      {editableText(`${section.id}.title`, section.content?.title || labels.featuresFallback, "h2", "text-3xl font-bold text-center mb-12")}
                      <div className="grid md:grid-cols-3 gap-8">
                        {items.map((item: any, i: number) => (
                          <div key={i} className="bg-white p-7 rounded-xl shadow-sm hover:shadow-md transition border border-slate-100 text-center">
                            <span data-wv-qa-icon="features" className="mx-auto mb-4 inline-flex text-[2.25rem]" style={{ color: colors.accent }}>
                              {editableSiteIcon(`${page.pageId}.${section.id}.feature.${i}`, copyIconId(item.title || item.label || "", item.description || "", usedFeatureIcons), 36, "shrink-0")}
                            </span>
                            {editableText(`${section.id}.item.${i}.title`, item.title, "h3", "text-xl font-semibold mb-2")}
                            {editableText(`${section.id}.item.${i}.description`, item.description, "p", "opacity-70", undefined, true)}
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                );
              }

              if (section.type === "offers") {
                const offersSource = section.content?.items || offers;
                const items = Array.isArray(offersSource) ? offersSource : [];
                const offersGridClass = cardDensity === "compact"
                  ? "grid md:grid-cols-4 gap-4"
                  : cardDensity === "editorial"
                    ? "grid md:grid-cols-2 gap-6"
                    : cardDensity === "image-led"
                      ? "grid md:grid-cols-3 gap-6"
                    : "grid md:grid-cols-3 gap-5";
                const offerImageClass = cardDensity === "compact" ? "h-32" : cardDensity === "editorial" ? "h-52" : cardDensity === "image-led" ? "h-60" : "h-44";
                const offerBodyClass = cardDensity === "compact" ? "p-4 text-center" : cardDensity === "image-led" ? "p-6 text-left" : "p-6 text-center";
                return (
                  <section key={section.id} className="py-20 px-6 bg-white">
                    <div className="max-w-6xl mx-auto">
                      <div className="max-w-2xl mb-10">
                        <p className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: colors.accent }}>{editableText(`${section.id}.eyebrow`, labels.offersEyebrow, "span")}</p>
                        {editableText(`${section.id}.title`, section.content?.title || labels.offersTitle, "h2", "text-3xl md:text-4xl font-bold text-slate-950")}
                        {section.content?.description && editableText(`${section.id}.description`, section.content.description, "p", "mt-3 text-slate-600", undefined, true)}
                      </div>
                      <div className={offersGridClass}>
                        {items.map((offer: any, i: number) => {
                          const cardHref = offeringHref(offer);
                          const priceHref = priceHintLooksAction(offer.priceHint) ? contactActionHref : "";
                          const ctaHref = String(offer.cta?.href || (!priceHref ? cardHref : "") || "");
                          const ctaText = String(offer.cta?.text || (ctaHref ? labels.learnMore : ""));
                          const displayTitle = formatOfferHeading(offer.title || labels.learnMore);
                          const cardLabel = displayTitle || labels.learnMore;
                          const ctaDuplicatesCard = ctaHref && cardHref && ctaHref === cardHref;
                          return (
                            <article
                              key={i}
                              className={`group relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition ${cardHref && !editMode ? "hover:-translate-y-0.5 hover:shadow-md" : ""}`}
                            >
                              {cardHref && !editMode && (
                                <a
                                  href={cardHref}
                                  {...tabPropsForHref(cardHref)}
                                  onClick={(event) => handleSiteHrefClick(cardHref, event)}
                                  className="absolute inset-0 z-0 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                                  style={{ outlineColor: colors.accent }}
                                  aria-label={`${labels.learnMore}: ${cardLabel}`}
                                />
                              )}
                              <div className={`relative z-10 ${editMode ? "pointer-events-auto" : "pointer-events-none"}`}>
                                <div className={offerImageClass}>
                                  {editableImage(imageEditKey(page.pageId, section.id, "offer", i), offer.image, offer.title, brandPhotoAttribution(offer.image), `offer-${offer.title || i + 1}`)}
                                </div>
                                <div className={offerBodyClass}>
                                  {editableText(`${section.id}.offer.${i}.title`, displayTitle, "h3", "text-lg font-bold text-slate-950")}
                                  {editableText(`${section.id}.offer.${i}.description`, offer.description, "p", "mt-2 text-sm text-slate-600", undefined, true)}
                                  {offer.priceHint && (
                                    priceHref && !editMode ? (
                                      <a
                                        href={priceHref}
                                        {...tabPropsForHref(priceHref)}
                                        onClick={(event) => handleSiteHrefClick(priceHref, event)}
                                        className="pointer-events-auto mt-4 inline-flex items-center justify-center gap-2 text-sm font-semibold hover:underline"
                                        style={{ color: colors.accent }}
                                      >
                                        {editableText(`${section.id}.offer.${i}.price`, offer.priceHint, "span")}
                                      </a>
                                    ) : (
                                      editableText(`${section.id}.offer.${i}.price`, offer.priceHint, "p", "mt-4 text-sm font-semibold", { color: colors.accent })
                                    )
                                  )}
                                  {ctaHref && ctaText && !ctaDuplicatesCard && (
                                    <a
                                      href={ctaHref}
                                      {...tabPropsForHref(ctaHref)}
                                      onClick={(event) => {
                                        if (editMode) {
                                          event.preventDefault();
                                          return;
                                        }
                                        handleSiteHrefClick(ctaHref, event);
                                      }}
                                      className="pointer-events-auto mt-5 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition hover:opacity-90"
                                      style={{ backgroundColor: colors.primary, color: colors.onPrimary }}
                                    >
                                      {editableButtonIcon(`${page.pageId}.${section.id}.offer.${i}.cta`, ctaText, ctaHref, 15)}
                                      {editableButtonText(`${page.pageId}.${section.id}.offer.${i}.cta`, ctaText)}
                                    </a>
                                  )}
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  </section>
                );
              }

              if (section.type === "offeringDetail") {
                const detail = section.content || {};
                const highlights = Array.isArray(detail.highlights) ? detail.highlights : [];
                const included = Array.isArray(detail.included) ? detail.included : [];
                const bestFor = Array.isArray(detail.bestFor) ? detail.bestFor : [];
                const detailTitle = formatOfferHeading(detail.title);
                return (
                  <section key={section.id} className="py-20 px-6 bg-white">
                    <div className="max-w-6xl mx-auto grid gap-10 lg:grid-cols-[1.05fr_0.95fr]">
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: colors.accent }}>{editableText(`${section.id}.kind`, detail.kind || "Offering", "span")}</p>
                        {editableText(`${section.id}.title`, detailTitle, "h2", "text-3xl md:text-4xl font-bold text-slate-950")}
                        {editableText(`${section.id}.summary`, detail.summary || detail.description, "p", "mt-4 text-lg text-slate-600", undefined, true)}
                        {highlights.length > 0 && (
                          <div className="mt-8 grid gap-3 sm:grid-cols-2">
                            {highlights.map((item: any, i: number) => (
                              <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                {editableText(`${section.id}.highlight.${i}.title`, item.title || item, "p", "font-semibold text-slate-950")}
                                {item.description && editableText(`${section.id}.highlight.${i}.description`, item.description, "p", "mt-1 text-sm text-slate-600", undefined, true)}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
                        <div className="h-56 overflow-hidden rounded-xl bg-slate-200">
                          {editableImage(imageEditKey(page.pageId, section.id, "detail"), detail.image || brand.preferredHeroImage, detail.title, brandPhotoAttribution(detail.image || brand.preferredHeroImage), `detail-${detail.title || section.id}`)}
                        </div>
                        {detail.priceHint && editableText(`${section.id}.price`, detail.priceHint, "p", "mt-5 text-lg font-bold", { color: colors.accent })}
                        {included.length > 0 && (
                          <div className="mt-5">
                            <p className="font-semibold text-slate-950">{isIndonesian ? "Yang termasuk" : "What's included"}</p>
                            <ul className="mt-3 space-y-2 text-sm text-slate-700">
                              {included.map((item: string, i: number) => <li key={item} className="flex gap-2"><span className="mt-0.5 shrink-0" style={{ color: colors.accent }}>{editableSiteIcon(`${page.pageId}.${section.id}.included.${i}`, "check", 16)}</span>{editableText(`${section.id}.included.${i}`, item, "span")}</li>)}
                            </ul>
                          </div>
                        )}
                        {bestFor.length > 0 && (
                          <div className="mt-5">
                            <p className="font-semibold text-slate-950">{isIndonesian ? "Cocok untuk" : "Best for"}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {bestFor.map((item: string, i: number) => <span key={item} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">{editableText(`${section.id}.bestFor.${i}`, item, "span")}</span>)}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </section>
                );
              }

              if (section.type === "reviews") {
                const reviewsSource = section.content?.reviews || trust.reviews;
                const reviews = Array.isArray(reviewsSource) ? reviewsSource : [];
                return (
                  <section key={section.id} className="py-20 px-6 bg-slate-50">
                    <div className="max-w-6xl mx-auto">
                      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
                        <div>
                          <p className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: colors.accent }}>{editableText(`${section.id}.eyebrow`, labels.reviewsEyebrow, "span")}</p>
                          {editableText(`${section.id}.title`, section.content?.title || labels.reviewsTitle, "h2", "text-3xl md:text-4xl font-bold text-slate-950")}
                        </div>
                        {trust.reviewSummary && editableText(`${section.id}.summary`, trust.reviewSummary, "p", "max-w-xl text-slate-600", undefined, true)}
                      </div>
                      <div className="grid md:grid-cols-3 gap-5">
                        {reviews.map((review: any, i: number) => (
                          <div key={i} className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                            <div className="mb-4 flex justify-center gap-1" style={{ color: colors.accent }}>
                              {Array.from({ length: Math.round(review.rating || 5) }).map((_, idx) => <span key={idx}>{editableSiteIcon(`${page.pageId}.${section.id}.review.${i}.star.${idx}`, "star", 16)}</span>)}
                            </div>
                            <div className="text-slate-700">
                              <span aria-hidden="true" className="wv-heading block text-left text-5xl font-bold leading-[0.72]" style={{ color: colors.accent }}>"</span>
                              {editableText(`${section.id}.review.${i}.text`, review.text, "p", "-mt-1", undefined, true)}
                              <span aria-hidden="true" className="wv-heading -mt-1 block text-right text-5xl font-bold leading-[0.72]" style={{ color: colors.accent }}>"</span>
                            </div>
                            {editableText(`${section.id}.review.${i}.author`, review.authorName || review.author || "Google reviewer", "p", "mt-4 font-semibold text-slate-950")}
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                );
              }

              if (section.type === "hoursLocation") {
                const hoursSource = section.content?.hours || hours.regular || section.content?.openingHours || [];
                const regularHours = Array.isArray(hoursSource) ? hoursSource : [];
                const hoursGroups = compactHoursGroups(regularHours);
                const todayLabel = new Date().toLocaleDateString(isIndonesian ? "id-ID" : "en-US", { weekday: "long" });
                const todayHours = hoursGroups.find((group) => group.days.some((day) => day.toLowerCase().startsWith(todayLabel.toLowerCase().slice(0, 3)))) || hoursGroups[0];
                const hoursTitle = section.content?.hoursTitle || section.content?.openingHoursTitle || labels.hoursTitle;
                return (
                  <section key={section.id} id={sectionId(section, "contact")} data-wv-section={sectionId(section, "contact")} data-wv-contact-section="true" className="py-20 px-6 bg-white">
                    <div data-wv-hours-location-grid="true" className="max-w-6xl mx-auto grid md:grid-cols-2 gap-6">
                      <div className="rounded-xl border border-slate-200 p-8 bg-slate-50">
                        <div data-wv-hours-location-heading="true" className="mb-5 flex items-center gap-3 text-2xl">
                          <span data-wv-qa-icon="hoursLocation" className="inline-flex h-[1.1em] w-[1.1em] shrink-0" style={{ color: colors.accent }}>{editableSiteIcon(`${page.pageId}.${section.id}.hoursIcon`, "calendar", 20)}</span>
                          {editableText(`${section.id}.hoursTitle`, hoursTitle, "h2", "text-2xl font-bold text-slate-950", { ["--wv-title-chars" as any]: String(hoursTitle).length } as CSSProperties)}
                        </div>
                        {todayHours && (
                          <div className="mb-5 rounded-xl border border-white bg-white p-4 shadow-sm">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{isIndonesian ? "Hari ini" : "Today"}</p>
                            <p className="mt-1 text-lg font-bold text-slate-950">{todayHours.time}</p>
                            {todayHours.days.length > 0 && <p className="mt-1 text-sm text-slate-500">{todayHours.days.join(", ")}</p>}
                          </div>
                        )}
                        <div className="space-y-2 text-slate-700">
                          {hoursGroups.length > 0 ? hoursGroups.map((group, i) => (
                            <div key={`${group.days.join("-")}-${group.time}-${i}`} className="flex items-start justify-between gap-4 border-b border-slate-200/70 pb-2 last:border-0 last:pb-0">
                              <p className="font-medium text-slate-950">{group.days.length > 1 ? `${group.days[0]} - ${group.days[group.days.length - 1]}` : group.days[0] || labels.hoursTitle}</p>
                              <p className="text-right text-slate-600">{group.time}</p>
                            </div>
                          )) : (
                            <p className="text-slate-600">{isIndonesian ? "Jam operasional belum tersedia." : "Business hours are not available yet."}</p>
                          )}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-200 p-8 bg-white">
                        <div data-wv-hours-location-heading="true" className="mb-5 flex items-center gap-3 text-2xl">
                          <span data-wv-qa-icon="hoursLocation" className="inline-flex h-[1.1em] w-[1.1em] shrink-0" style={{ color: colors.accent }}>{editableSiteIcon(`${page.pageId}.${section.id}.locationIcon`, "map", 20)}</span>
                          {editableText(`${section.id}.locationTitle`, labels.locationTitle, "h2", "text-2xl font-bold text-slate-950", { ["--wv-title-chars" as any]: labels.locationTitle.length } as CSSProperties)}
                        </div>
                        {editableText(`${section.id}.address`, section.content?.address || location.formattedAddress || businessProfile.address?.formatted || "Alamat belum tersedia.", "p", "text-slate-700", undefined, true)}
                        {(section.content?.phone || displayPhone) && !isPlaceholderPhone(section.content?.phone || displayPhone) && (
                          <div className="mt-3">
                            <a href={phoneHref(section.content?.phone || primaryPhone || displayPhone)} className="inline-flex w-fit items-center gap-2 font-semibold text-slate-950 hover:underline">
                              {editableSiteIcon(`${page.pageId}.${section.id}.phoneIcon`, "phone", 16)} {section.content?.phone || displayPhone}
                            </a>
                          </div>
                        )}
                        {(section.content?.directionsUrl || businessProfile.contact?.directionsUrl || location.directionsUrl) && (
                          <a
                            href={section.content?.directionsUrl || businessProfile.contact?.directionsUrl || location.directionsUrl}
                            onClick={editMode ? (event) => event.preventDefault() : undefined}
                            className="mt-5 inline-flex w-fit items-center gap-2 px-5 py-3 rounded-lg font-semibold"
                            style={{ backgroundColor: colors.primary, color: colors.onPrimary }}
                          >
                            {editableButtonIcon(`${page.pageId}.${section.id}.directions`, labels.openMaps, section.content?.directionsUrl || businessProfile.contact?.directionsUrl || location.directionsUrl, 16)}
                            {editableButtonText(`${page.pageId}.${section.id}.directions`, labels.openMaps)}
                          </a>
                        )}
                      </div>
                    </div>
                  </section>
                );
              }

              if (section.type === "faq") {
                const items = section.content?.items || [];
                return (
                  <section key={section.id} className="py-20 px-6 bg-slate-50">
                    <div className="max-w-4xl mx-auto">
                      {editableText(`${section.id}.title`, section.content?.title || "Pertanyaan Umum", "h2", "text-3xl md:text-4xl font-bold text-slate-950 mb-8")}
                      <div className="space-y-3">
                        {items.map((item: any, i: number) => (
                          <div key={i} className="rounded-xl bg-white border border-slate-200 p-5">
                            {editableText(`${section.id}.faq.${i}.question`, item.question, "h3", "font-semibold text-slate-950")}
                            {editableText(`${section.id}.faq.${i}.answer`, item.answer, "p", "mt-2 text-slate-600", undefined, true)}
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                );
              }

              if (section.type === "finalCta") {
                const content = section.content || {};
                const primaryCta = content.primaryCta || conversion.primaryCta || globalConfig.header.ctaButton || {};
                const secondaryCta = content.secondaryCta || conversion.secondaryCta || {};
                const badges = Array.isArray(content.proofBadges) ? content.proofBadges.slice(0, 4) : [];
                const primaryHref = String(primaryCta.href || contactActionHref || "#contact");
                const secondaryHref = String(secondaryCta.href || "");
                const finalCtaClass = ctaTreatment === "phone-rail"
                  ? "px-6 py-12 bg-slate-950 text-white"
                  : ctaTreatment === "directions-split"
                    ? "px-6 py-16 bg-orange-950 text-white"
                    : ctaTreatment === "consultation-card"
                      ? "px-6 py-16 bg-slate-100 text-slate-950"
                      : ctaTreatment === "estimate-block"
                        ? "px-6 py-16 bg-stone-950 text-white"
                        : ctaTreatment === "booking-pill"
                          ? "px-6 py-16 bg-indigo-950 text-white"
                      : "px-6 py-16 bg-slate-950 text-white";
                const finalCtaPanelClass = ctaTreatment === "consultation-card"
                  ? "mx-auto grid max-w-6xl gap-8 rounded-xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-900/10 md:grid-cols-[1.1fr_0.9fr] md:p-10"
                  : ctaTreatment === "booking-pill"
                    ? "mx-auto grid max-w-6xl gap-8 rounded-[2rem] border border-white/10 bg-white/[0.08] p-7 shadow-2xl shadow-indigo-950/25 md:grid-cols-[1.1fr_0.9fr] md:p-10"
                  : "mx-auto grid max-w-6xl gap-8 rounded-2xl border border-white/10 bg-white/[0.06] p-7 shadow-2xl shadow-slate-950/25 md:grid-cols-[1.1fr_0.9fr] md:p-10";
                const finalCtaMutedClass = ctaTreatment === "consultation-card" ? "mt-4 max-w-2xl text-slate-600" : "mt-4 max-w-2xl text-white/75";
                const finalCtaProofClass = ctaTreatment === "consultation-card" ? "mt-4 text-sm font-semibold text-slate-600" : "mt-4 text-sm font-semibold text-white/80";
                const finalSecondaryClass = ctaTreatment === "consultation-card"
                  ? "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-5 py-3 text-sm font-bold text-slate-800 transition hover:-translate-y-0.5 hover:bg-slate-50"
                  : "inline-flex items-center justify-center gap-2 rounded-lg border border-white/20 px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-white/10";
                const finalBadgeClass = ctaTreatment === "consultation-card"
                  ? "inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700"
                  : "inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/85";
                return (
                  <section key={section.id} data-wv-cta-treatment={ctaTreatment} className={finalCtaClass}>
                    <div className={finalCtaPanelClass}>
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: colors.accent }}>
                          {editableText(`${section.id}.eyebrow`, content.eyebrow || (isIndonesian ? "Langkah berikutnya" : "Next step"), "span")}
                        </p>
                        {editableText(`${section.id}.headline`, content.headline || (isIndonesian ? "Siap membahas kebutuhan Anda?" : "Ready to discuss your next step?"), "h2", "mt-3 text-3xl font-bold leading-tight md:text-4xl")}
                        {editableText(`${section.id}.description`, content.description || businessProfile.shortPitch, "p", finalCtaMutedClass, undefined, true)}
                        {content.proofLine && editableText(`${section.id}.proofLine`, content.proofLine, "p", finalCtaProofClass, undefined, true)}
                      </div>
                      <div className="flex flex-col justify-center gap-4">
                        <div className="flex flex-col gap-3 sm:flex-row md:flex-col lg:flex-row">
                          <a
                            href={primaryHref}
                            {...tabPropsForHref(primaryHref)}
                            onClick={(event) => {
                              if (editMode) {
                                event.preventDefault();
                                return;
                              }
                              handleSiteHrefClick(primaryHref, event);
                            }}
                            className="inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-bold transition hover:-translate-y-0.5"
                            style={{ backgroundColor: colors.accent, color: colors.onAccent }}
                          >
                            {editableButtonIcon(`${page.pageId}.${section.id}.primary`, primaryCta.text || globalConfig.header.ctaButton.text, primaryHref, 16)}
                            {editableButtonText(`${page.pageId}.${section.id}.primary`, primaryCta.text || globalConfig.header.ctaButton.text)}
                          </a>
                          {secondaryHref && (
                            <a
                              href={secondaryHref}
                              {...tabPropsForHref(secondaryHref)}
                              onClick={(event) => {
                                if (editMode) {
                                  event.preventDefault();
                                  return;
                                }
                                handleSiteHrefClick(secondaryHref, event);
                              }}
                              className={finalSecondaryClass}
                            >
                              {editableButtonIcon(`${page.pageId}.${section.id}.secondary`, secondaryCta.text || (isIndonesian ? "Lihat lokasi" : "View location"), secondaryHref, 16)}
                              {editableButtonText(`${page.pageId}.${section.id}.secondary`, secondaryCta.text || (isIndonesian ? "Lihat lokasi" : "View location"))}
                            </a>
                          )}
                        </div>
                        {badges.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {badges.map((badge: string, i: number) => (
                              <span key={`${badge}-${i}`} className={finalBadgeClass}>
                                {editableSiteIcon(`${page.pageId}.${section.id}.badge.${i}`, i === 0 ? "shield" : "check", 14)}
                                {editableText(`${section.id}.badge.${i}`, badge, "span")}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </section>
                );
              }

              if (section.type === "textImageBlock") {
                return (
                  <section key={section.id} className="py-20 px-6">
                    <div className={`max-w-6xl mx-auto flex flex-col md:flex-row gap-12 items-center ${section.content.layout === "imageRight" ? "md:flex-row-reverse" : ""}`}>
                      <div className="flex-1">
                        {editableText(`${section.id}.title`, section.content.title, "h2", "text-3xl font-bold mb-6")}
                        <div className="opacity-80 prose max-w-none" dangerouslySetInnerHTML={{ __html: section.content.bodyHtml }} />
                      </div>
                      <div className="flex-1 w-full relative h-[400px] bg-gray-100 rounded-xl overflow-hidden shadow-lg border border-gray-200">
                        {editableImage(imageEditKey(page.pageId, section.id, "text-image"), section.content.image, section.content.title, brandPhotoAttribution(section.content.image), `section-${section.content.title || section.id}`)}
                      </div>
                    </div>
                  </section>
                );
              }

              if (section.type === "teamGrid") {
                return (
                  <section key={section.id} className="py-20 px-6 bg-black/5">
                    <div className="max-w-6xl mx-auto">
                      {editableText(`${section.id}.title`, section.content.title, "h2", "text-3xl font-bold text-center mb-12")}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {section.content.members.map((member: any, i: number) => (
                          <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 text-center pb-6">
                            <div className="h-48 bg-gray-200 mb-4">
                              {editableImage(imageEditKey(page.pageId, section.id, "member", i), member.image, member.name, brandPhotoAttribution(member.image), `team-${member.name || i + 1}`)}
                            </div>
                            {editableText(`${section.id}.member.${i}.name`, member.name, "h3", "text-lg font-semibold")}
                            {editableText(`${section.id}.member.${i}.role`, member.role, "p", "text-sm opacity-60 font-medium")}
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                );
              }

              if (section.type === "gridCards") {
                return (
                  <section key={section.id} className="py-20 px-6">
                    <div className="max-w-6xl mx-auto">
                      <div className="text-center mb-12">
                        {editableText(`${section.id}.title`, section.content.title, "h2", "text-3xl font-bold mb-4")}
                        {editableText(`${section.id}.description`, section.content.description, "p", "opacity-70 max-w-2xl mx-auto", undefined, true)}
                      </div>
                      <div className="grid md:grid-cols-3 gap-8">
                        {section.content.cards.map((card: any, i: number) => (
                          <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-md border border-gray-100">
                            <div className="h-48 bg-gray-200">
                              {editableImage(imageEditKey(page.pageId, section.id, "card", i), card.image, card.title, brandPhotoAttribution(card.image), `card-${card.title || i + 1}`)}
                            </div>
                            <div className="p-6 text-center">
                              {editableText(`${section.id}.card.${i}.title`, card.title, "h3", "text-xl font-bold mb-2")}
                              {editableText(`${section.id}.card.${i}.description`, card.description, "p", "opacity-70 mb-4", undefined, true)}
                              {card.price && editableText(`${section.id}.card.${i}.price`, card.price, "p", "font-semibold text-lg", { color: colors.accent })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                );
              }

              if (section.type === "imageGallery") {
                return (
                  <section key={section.id} className="py-20 px-6 bg-black/5">
                    <div className="max-w-6xl mx-auto">
                      {editableText(`${section.id}.title`, section.content.title, "h2", "text-3xl font-bold text-center mb-12")}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {section.content.images.map((img: string, i: number) => (
                          <div key={i} className="h-64 bg-gray-200 rounded-xl overflow-hidden">
                            {editableImage(imageEditKey(page.pageId, section.id, "gallery", i), img, `Gallery ${i + 1}`, brandPhotoAttribution(img), `gallery-${i + 1}`)}
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                );
              }

              if (section.type === "feedback") {
                const feedbackEmail = section.content?.email || displayEmail;
                const feedbackSubject = `${meta.businessName} customer feedback`;
                const lowRatingSelected = feedbackRating > 0 && feedbackRating <= 3;
                const highRatingSelected = feedbackRating >= 4;
                return (
                  <section
                    key={section.id}
                    id={sectionId(section, "feedback")}
                    data-wv-section={sectionId(section, "feedback")}
                    data-wv-feedback="true"
                    data-wv-review-url={googleReviewHref}
                    className="py-20 px-6 bg-slate-50"
                  >
                    <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                      {editableText(`${section.id}.title`, section.content?.title || labels.feedbackTitle, "h2", "text-3xl md:text-4xl font-bold text-slate-950")}
                      {editableText(`${section.id}.description`, section.content?.description || labels.feedbackDescription, "p", "mx-auto mt-3 max-w-2xl text-slate-600", undefined, true)}
                      <div className="mt-8 flex justify-center gap-2" role="radiogroup" aria-label="Satisfaction rating">
                        {[1, 2, 3, 4, 5].map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            data-wv-feedback-rating={rating}
                            onClick={() => chooseFeedbackRating(rating)}
                            className={`inline-flex h-12 w-12 items-center justify-center rounded-full border text-slate-500 transition hover:-translate-y-0.5 hover:bg-slate-50 ${feedbackRating >= rating ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"}`}
                            style={feedbackRating >= rating ? { color: colors.accent } : undefined}
                            aria-label={`${rating} star${rating === 1 ? "" : "s"}`}
                            aria-checked={feedbackRating === rating}
                            role="radio"
                          >
                            {editableSiteIcon(`${page.pageId}.${section.id}.feedbackRating.${rating}`, "star", 24)}
                          </button>
                        ))}
                      </div>
                      {highRatingSelected && googleReviewHref && (
                        <p data-wv-feedback-high className="mt-5 text-sm font-medium text-emerald-700">{labels.feedbackSatisfied}</p>
                      )}
                      {highRatingSelected && !googleReviewHref && (
                        <p data-wv-feedback-high className="mt-5 text-sm font-medium text-amber-700">
                          {isIndonesian ? "Link Google Review belum tersedia untuk bisnis ini." : "Google Review link is not available for this business yet."}
                        </p>
                      )}
                      <div data-wv-feedback-low className={`${lowRatingSelected ? "" : "hidden"} mt-8 text-left`}>
                        <h3 className="text-lg font-semibold text-slate-950">{labels.feedbackImprove}</h3>
                        <form
                          className="mt-4 space-y-4"
                          data-wv-mailto={feedbackEmail}
                          data-wv-business={meta.businessName}
                          data-wv-subject={feedbackSubject}
                          onSubmit={(event) => {
                            event.preventDefault();
                            if (editMode) return;
                            const formData = new FormData(event.currentTarget);
                            const message = String(formData.get("feedback") || "").trim();
                            const rating = String(formData.get("rating") || feedbackRating || "");
                            const body = [`Rating: ${rating}/5`, message ? `Feedback:\n${message}` : ""].filter(Boolean).join("\n\n");
                            window.location.href = mailHref(feedbackEmail, feedbackSubject, body) || `mailto:?subject=${encodeURIComponent(feedbackSubject)}&body=${encodeURIComponent(body)}`;
                          }}
                        >
                          <input type="hidden" name="rating" value={feedbackRating || ""} data-wv-feedback-rating-input="true" />
                          <textarea
                            name="feedback"
                            required
                            rows={5}
                            placeholder={labels.feedbackPlaceholder}
                            className="w-full rounded-xl border border-slate-300 bg-white p-4 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          {!feedbackEmail && <p className="text-xs font-medium text-amber-700">{labels.feedbackNoEmail}</p>}
                          <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold hover:opacity-90" style={{ backgroundColor: colors.primary, color: colors.onPrimary }}>
                            {editableButtonIcon(`${page.pageId}.${section.id}.feedbackSubmit`, labels.feedbackSend, `mailto:${feedbackEmail}`, 16)}
                            {editableButtonText(`${page.pageId}.${section.id}.feedbackSubmit`, labels.feedbackSend)}
                          </button>
                        </form>
                      </div>
                    </div>
                  </section>
                );
              }

              if (section.type === "contactForm") {
                const contactEmail = section.content?.email || displayEmail;
                const rawContactPhone = section.content?.phone || displayPhone;
                const contactPhone = isPlaceholderPhone(rawContactPhone) ? "" : rawContactPhone;
                const formConfig = section.content?.formConfig || {};
                const formFields = Array.isArray(formConfig.fields) ? formConfig.fields : [
                  { label: isIndonesian ? "Nama" : "Name", type: "text", required: true },
                  { label: "Email", type: "email", required: true },
                  { label: isIndonesian ? "Pesan" : "Message", type: "textarea", required: true },
                ];
                return (
                  <section key={section.id} id={sectionId(section, "contact")} data-wv-section={sectionId(section, "contact")} data-wv-contact-section="true" className="py-20 px-6">
                    <div className="max-w-5xl mx-auto bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col md:flex-row border border-gray-100">
                      <div style={{ backgroundColor: colors.primary, color: colors.onPrimary }} className="p-10 md:w-2/5">
                        {editableText(`${section.id}.title`, section.content.title, "h2", "text-2xl font-bold mb-6")}
                        <div className="space-y-4 text-sm opacity-90">
                          <p><strong>{labels.address}:</strong><br />{editableText(`${section.id}.contactAddress`, section.content.address, "span", "", undefined, true)}</p>
                          {contactPhone && (
                            <p>
                              <strong>{labels.phone}:</strong><br />
                              <a href={phoneHref(contactPhone)} className="inline-flex items-center gap-2 hover:underline">{editableSiteIcon(`${page.pageId}.${section.id}.contactPhoneIcon`, "phone", 15)}{contactPhone}</a>
                            </p>
                          )}
                          {contactEmail && (
                            <p>
                              <strong>Email:</strong><br />
                              <a href={mailHref(contactEmail)} className="inline-flex items-center gap-2 hover:underline">{editableSiteIcon(`${page.pageId}.${section.id}.contactEmailIcon`, "mail", 15)}{contactEmail}</a>
                            </p>
                          )}
                          <div>
                            <strong>{labels.businessHours}:</strong>
                            <ul className="mt-1 space-y-1">
                              {(Array.isArray(section.content.openingHours) ? section.content.openingHours : []).map((h: string, i: number) => <li key={i}>{editableText(`${section.id}.contactHours.${i}`, h, "span")}</li>)}
                            </ul>
                          </div>
                        </div>
                      </div>
                      <div className="p-10 md:w-3/5">
                        {editableText(`${section.id}.formHeading`, formConfig.heading || (isIndonesian ? "Kirim pertanyaan" : "Send an Inquiry"), "h3", "text-xl font-bold mb-6")}
                        <form
                          className="space-y-4"
                          data-wv-mailto={contactEmail}
                          data-wv-business={meta.businessName}
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (editMode) return;
                            const formData = new FormData(e.currentTarget);
                            const entries = Array.from(formData.entries()).map(([key, value]) => `${key}: ${String(value)}`);
                            const name = String(formData.get("name") || "");
                            const email = String(formData.get("email") || "");
                            const message = String(formData.get("message") || "");
                            const body = [
                              name ? `Name: ${name}` : "",
                              email ? `Email: ${email}` : "",
                              message ? `Message:\n${message}` : "",
                              entries.length ? `\nAll fields:\n${entries.join("\n")}` : "",
                            ].filter(Boolean).join("\n");
                            const subject = `Website inquiry for ${meta.businessName}`;
                            const mailto = mailHref(contactEmail, subject, body || `New inquiry for ${meta.businessName}`)
                              || `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body || `New inquiry for ${meta.businessName}`)}`;
                            window.location.href = mailto;
                          }}
                        >
                          {formFields.map((f: any, i: number) => {
                            const fieldName = normalizedFieldName(f, i);
                            return (
                              <div key={i}>
                                <label className="block text-sm font-medium opacity-80 mb-1">{editableText(`${section.id}.field.${i}.label`, f.label, "span")}</label>
                                {f.type === "textarea" ? (
                                  <textarea name={fieldName} required={f.required} className="w-full border border-gray-300 rounded-lg p-3 bg-transparent" rows={4}></textarea>
                                ) : (
                                  <input name={fieldName} required={f.required} type={f.type} className="w-full border border-gray-300 rounded-lg p-3 bg-transparent" />
                                )}
                              </div>
                            );
                          })}
                          <button type="submit" style={{ backgroundColor: colors.accent, color: colors.onAccent }} className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium hover:opacity-90 transition pt-2">
                            {editableButtonIcon(`${page.pageId}.${section.id}.contactSubmit`, formConfig.buttonText || (isIndonesian ? "Kirim Pesan" : "Send Message"), `mailto:${contactEmail}`, 16)}
                            {editableButtonText(`${page.pageId}.${section.id}.contactSubmit`, formConfig.buttonText || (isIndonesian ? "Kirim Pesan" : "Send Message"))}
                          </button>
                        </form>
                      </div>
                    </div>
                  </section>
                );
              }

              return <div key={section.id} className="py-20 text-center opacity-50">[Section: {section.type}]</div>;
            })}
            {page.pageId === homePageId && servedAreas.length > 0 && (
              <section id="areas-served" data-wv-section="areas-served" className="px-6 py-14 bg-white">
                <div className="mx-auto grid max-w-6xl gap-6 rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-sm md:grid-cols-[0.85fr_1.15fr] md:p-8">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: colors.accent }}>
                      {editableText("areasServed.eyebrow", labels.areasServedEyebrow, "span")}
                    </p>
                    {editableText("areasServed.title", labels.areasServedTitle, "h2", "mt-2 text-2xl font-bold text-slate-950 md:text-3xl")}
                    {editableText("areasServed.description", labels.areasServedDescription, "p", "mt-3 text-sm leading-6 text-slate-600", undefined, true)}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {servedAreas.map((area: string, i: number) => (
                      <span key={area} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
                        <span className="shrink-0" style={{ color: colors.accent }}>{editableSiteIcon(`areasServed.${i}`, "map", 15)}</span>
                        {editableText(`areasServed.area.${i}`, area, "span")}
                      </span>
                    ))}
                  </div>
                </div>
              </section>
            )}
          </div>
        ))}
      </main>

      <footer data-wv-site-footer="true" style={{ backgroundColor: colors.primary, color: colors.onPrimary }} className="px-6 py-14 text-sm">
        <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[1.3fr_0.8fr_0.8fr_1fr]">
          <div>
            <button type="button" data-wv-tab={homePageId} onClick={() => changeTab(homePageId)} className="mb-4 flex items-center gap-3 text-left text-lg font-bold hover:opacity-85">
              {brand.logoSvg ? <span className="w-8 h-8 [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: brand.logoSvg }} /> : null}
              {isUsableImage(brand.logoImageUrl) ? <img src={brand.logoImageUrl} alt="" data-wv-image-role="logo" className="w-8 h-8 rounded-full object-cover" /> : null}
              {editableText("footer.businessName", meta.businessName, "span")}
            </button>
            {editableText("footer.shortPitch", businessProfile.shortPitch || meta.seoDescription || globalConfig.footer.text, "p", "max-w-sm opacity-80", undefined, true)}
            <div className="mt-5 flex gap-2">
              {footerSocials.map((social: any) => (
                <a key={social.platform} href={social.href || "#"} className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20" aria-label={social.platform}>
                  {editableSiteIcon(`footer.social.${social.platform}`, inferSocialIconId(social.platform), 18)}
                </a>
              ))}
            </div>
          </div>
          <div>
            <p className="wv-heading mb-4 text-[1.05rem] font-semibold leading-tight">{labels.pages}</p>
            <div className="space-y-2 opacity-85">
              {footerPageMenu.map((menu: any, i: number) => (
                <button key={menu.href} type="button" data-wv-tab={menu.href.replace("#", "")} onClick={() => changeTab(menu.href.replace("#", ""))} className="flex items-center gap-2 hover:opacity-100">
                  {editableSiteIcon(`footer.nav.${i}.${menu.href || menu.label}`, inferMenuIconId(`${menu.label} ${menu.href}`), 16)}
                  {menu.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="wv-heading mb-4 text-[1.05rem] font-semibold leading-tight">{labels.highlights}</p>
            <div className="space-y-2 opacity-85">
              {footerHighlights.slice(0, 6).map((item: any) => {
                const href = offeringHref(item);
                const label = titleCaseLabel(item.title || item.label);
                if (href.startsWith("#")) {
                  const pageId = href.replace("#", "");
                  return (
                    <button key={label} type="button" data-wv-tab={pageId} onClick={() => changeTab(pageId)} className="block text-left hover:opacity-100 hover:underline">
                      {label}
                    </button>
                  );
                }
                if (href) {
                  return <a key={label} href={href} className="block hover:opacity-100 hover:underline">{label}</a>;
                }
                return <p key={label}>{label}</p>;
              })}
            </div>
          </div>
          <div>
            <p className="wv-heading mb-4 text-[1.05rem] font-semibold leading-tight">{labels.contact}</p>
            <div className="space-y-3 opacity-85">
              {(displayPhone || globalConfig.header.ctaButton?.href) && (
                <p className="flex gap-2">
                  <span className="mt-0.5 shrink-0">{editableSiteIcon("footer.phone", "phone", 16)}</span>
                  {phoneHref(primaryPhone || displayPhone || globalConfig.header.ctaButton.href) ? (
                    <a href={phoneHref(primaryPhone || displayPhone || globalConfig.header.ctaButton.href)} className="hover:underline">{displayPhone || globalConfig.header.ctaButton.href}</a>
                  ) : (
                    <span>{displayPhone || globalConfig.header.ctaButton.href}</span>
                  )}
                </p>
              )}
              {displayEmail && (
                <p className="flex gap-2">
                  <span className="mt-0.5 shrink-0">{editableSiteIcon("footer.email", "mail", 16)}</span>
                  <a href={mailHref(displayEmail)} className="hover:underline">{displayEmail}</a>
                </p>
              )}
              {(location.formattedAddress || businessProfile.address?.formatted) && (
                <p className="flex gap-2"><span className="mt-0.5 shrink-0">{editableSiteIcon("footer.address", "map", 16)}</span> <span>{location.formattedAddress || businessProfile.address.formatted}</span></p>
              )}
              {footerHours.length > 0 && (
                <div className="flex gap-2"><span className="mt-0.5 shrink-0">{editableSiteIcon("footer.hours", "calendar", 16)}</span> <div>{footerHours.map((item: string) => <p key={item}>{item}</p>)}</div></div>
              )}
            </div>
          </div>
        </div>
        <div className="mx-auto mt-10 max-w-6xl border-t border-white/15 pt-6 text-xs opacity-70">
          <p>{globalConfig.footer.text}</p>
        </div>
      </footer>

      {conversion.stickyMobileCta && (
        <div className="md:hidden fixed bottom-0 inset-x-0 z-[110] bg-white border-t border-slate-200 p-3 flex gap-2">
          <a
            href={conversion.primaryCta?.href || globalConfig.header.ctaButton.href}
            onClick={editMode ? (event) => event.preventDefault() : undefined}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-3 font-semibold"
            style={{ backgroundColor: colors.accent, color: colors.onAccent }}
          >
            {editableButtonIcon("sticky.primary", conversion.primaryCta?.text || globalConfig.header.ctaButton.text, conversion.primaryCta?.href || globalConfig.header.ctaButton.href)}
            {editableButtonText("sticky.primary", conversion.primaryCta?.text || globalConfig.header.ctaButton.text)}
          </a>
          {conversion.secondaryCta?.href && (
            <a
              href={conversion.secondaryCta.href}
              onClick={editMode ? (event) => event.preventDefault() : undefined}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-3 font-semibold border border-slate-300 text-slate-800"
            >
              {editableButtonIcon("sticky.secondary", conversion.secondaryCta.text || (isIndonesian ? "Lokasi" : "Location"), conversion.secondaryCta.href)}
              {editableButtonText("sticky.secondary", conversion.secondaryCta.text || (isIndonesian ? "Lokasi" : "Location"))}
            </a>
          )}
        </div>
      )}
      </div>

      {editMode && activeIconPickerKey && (
        <div
          data-export-remove="true"
          data-wv-tool-ui="button-icon-picker"
          className="hide-in-export fixed bottom-24 left-5 z-[230] w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl md:bottom-24"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-950">Site icon</p>
            <button type="button" onClick={() => setActiveIconPickerKey("")} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100" aria-label="Close icon picker">
              <X size={16} />
            </button>
          </div>
          <label className="mb-3 flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600">
            <Search size={15} />
            <input
              value={iconPickerQuery}
              onChange={(event) => setIconPickerQuery(event.target.value)}
              className="min-w-0 flex-1 bg-transparent outline-none"
              placeholder="Search site icons..."
              autoFocus
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                saveSiteIconOverride(activeIconPickerKey, "");
                setActiveIconPickerKey("");
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              {renderCtaIcon("check", 16)}
              Auto
            </button>
            {visibleSiteIconOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  saveSiteIconOverride(activeIconPickerKey, option.id);
                  setActiveIconPickerKey("");
                }}
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm font-semibold hover:bg-indigo-50 ${
                  siteIconOverrides[activeIconPickerKey] === option.id ? "border-indigo-300 bg-indigo-50 text-indigo-800" : "border-slate-200 text-slate-700"
                }`}
              >
                {renderCtaIcon(option.id, 16)}
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div data-export-remove="true" data-wv-tool-ui="inline-edit-panel" className="hide-in-export fixed bottom-20 left-5 z-[210] flex max-w-[calc(100vw-2.5rem)] flex-col items-start gap-2 md:bottom-5">
        {editMode && (
          <div className="max-w-xs rounded-lg border border-indigo-100 bg-white/95 px-3 py-2 text-xs font-medium text-slate-700 shadow-xl backdrop-blur">
            Click text or button labels to edit them. Click site icons to choose a different icon. Click images to replace or restore them. Changes are saved in this browser and included in the downloaded site.
          </div>
        )}
        <input
          ref={imageFileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => handleReplacementImageFile(event.target.files?.[0])}
          aria-hidden="true"
        />
        <button
          type="button"
          onClick={() => setEditMode((value) => !value)}
          className={`inline-flex items-center gap-3 rounded-full border px-6 py-4 text-sm font-semibold shadow-2xl backdrop-blur-md transition ${editMode ? "border-indigo-200 bg-indigo-600 text-white hover:bg-indigo-700" : "border-gray-200 bg-white/90 text-gray-900 hover:bg-white"}`}
          aria-pressed={editMode}
        >
          {editMode ? <X size={18} /> : <Pencil size={18} />}
          {editMode ? "Done" : "Edit"}
        </button>
      </div>

      {showProspectPanel && (
        <WebsiteActionPanel
          siteData={actionPanelSiteData}
          businessId={businessId}
          variant="public"
          onDownloadZip={onDownloadZip}
          fontPairings={availableFontPairings}
          selectedFontPairing={activeFontPairing.id}
          onFontPairingChange={setSelectedFontPairingId}
          paletteOptions={paletteOptions}
          selectedPaletteOption={activePaletteOption?.id || ""}
          onPaletteOptionChange={setSelectedPaletteOptionId}
        />
      )}

      <style>{`
        @media print { .hide-in-export { display: none !important; } }
        ${siteStylePresetCss}
        #rendered-site [data-wv-hero-section] [data-wv-hero-heading] {
          font-size: var(--wv-hero-heading-size, clamp(2.45rem, 6vw, 5.55rem)) !important;
          line-height: 0.96 !important;
          text-wrap: balance;
          overflow-wrap: normal;
        }
        @media (max-width: 767px) {
          #rendered-site [data-wv-hero-section] [data-wv-hero-heading] {
            font-size: var(--wv-hero-heading-size, clamp(2.2rem, 11vw, 3.35rem)) !important;
          }
        }
        #rendered-site [data-wv-site-canvas] > [data-wv-site-shader] {
          flex: 0 0 0;
          width: 0;
          height: 0;
        }
        #rendered-site [data-wv-site-header] {
          min-height: 4.5rem;
          margin: 0;
          border-bottom: 1px solid var(--wv-header-border);
          box-shadow: var(--wv-header-shadow) !important;
          line-height: 1.15;
          backdrop-filter: blur(var(--wv-header-blur));
          -webkit-backdrop-filter: blur(var(--wv-header-blur));
          transition: min-height 180ms ease, padding-block 180ms ease, box-shadow 180ms ease, border-color 180ms ease, background 180ms ease, backdrop-filter 180ms ease;
        }
        #rendered-site [data-wv-site-header]::after {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          bottom: -1px;
          height: 2px;
          background: var(--wv-header-accent-line);
          opacity: 0.8;
          pointer-events: none;
        }
        #rendered-site [data-wv-site-header][data-wv-header-compact="true"] {
          background: var(--wv-header-bg-compact) !important;
          min-height: 3.5rem;
          border-bottom-color: var(--wv-header-border-compact);
          box-shadow: var(--wv-header-shadow-compact) !important;
          padding-top: 0.625rem !important;
          padding-bottom: 0.625rem !important;
        }
        #rendered-site [data-wv-site-header] :where(a, button) {
          line-height: 1;
        }
        #rendered-site [data-wv-site-header] [data-wv-image-role="logo"] {
          width: 2rem;
          height: 2rem;
          flex: none;
        }
        #rendered-site [data-wv-site-submenu] {
          background: var(--wv-header-submenu-bg) !important;
          color: var(--wv-header-submenu-text) !important;
          border-radius: var(--wv-header-submenu-radius) !important;
          border-color: var(--wv-header-submenu-border) !important;
          box-shadow: var(--wv-header-submenu-shadow) !important;
          backdrop-filter: blur(var(--wv-header-submenu-blur));
          -webkit-backdrop-filter: blur(var(--wv-header-submenu-blur));
          font-family: ${activeFontPairing.bodyCss || typography.bodyFont};
          line-height: 1.35;
          overflow: hidden;
          isolation: isolate;
        }
        #rendered-site [data-wv-site-submenu]::before {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          top: -12px;
          height: 12px;
          pointer-events: auto;
        }
        #rendered-site [data-wv-site-submenu],
        #rendered-site [data-wv-site-submenu] * {
          text-wrap: initial;
        }
        #rendered-site [data-wv-site-submenu] :where(button, a) {
          border-radius: 10px !important;
          box-shadow: none !important;
          transform: none !important;
          transition: background-color 150ms ease, color 150ms ease, opacity 150ms ease;
        }
        #rendered-site [data-wv-site-submenu] :where(button, a):hover {
          background: var(--wv-header-submenu-hover-bg);
          box-shadow: none !important;
          transform: none !important;
        }
        #rendered-site [data-wv-site-submenu] .text-slate-500 {
          color: var(--wv-header-submenu-muted) !important;
        }
        #rendered-site [data-wv-site-submenu] svg {
          flex: none;
        }
        #rendered-site [data-wv-hours-location-grid] {
          --wv-hours-heading-size: clamp(1.05rem, 2.1vw, 1.5rem);
        }
        #rendered-site [data-wv-hours-location-heading] {
          min-width: 0;
          font-size: var(--wv-hours-heading-size);
          line-height: 1.1;
        }
        #rendered-site [data-wv-hours-location-heading] h2 {
          min-width: 0;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: min(var(--wv-hours-heading-size), calc((21rem - 2.75rem) / max(var(--wv-title-chars, 18), 1) * 1.85)) !important;
          line-height: 1.1 !important;
        }
        @media (max-width: 767px) {
          #rendered-site [data-wv-hours-location-grid] {
            --wv-hours-heading-size: clamp(1rem, 5vw, 1.35rem);
          }
        }
        #rendered-site [data-wv-site-footer] {
          --wv-footer-muted: rgba(255, 255, 255, 0.78);
          --wv-footer-border: rgba(255, 255, 255, 0.16);
          position: relative;
          z-index: 1;
          overflow: hidden;
          line-height: 1.55;
        }
        #rendered-site [data-wv-site-footer],
        #rendered-site [data-wv-site-footer] * {
          text-wrap: initial;
        }
        #rendered-site [data-wv-site-footer] img {
          filter: none !important;
          transform: none !important;
          transition: none !important;
        }
        #rendered-site [data-wv-site-footer] [data-wv-image-role="logo"] {
          width: 2rem;
          height: 2rem;
          flex: none;
          border-radius: 9999px !important;
          clip-path: none !important;
        }
        #rendered-site [data-wv-site-footer] :where(a, button) {
          box-shadow: none !important;
          transform: none !important;
          transition: opacity 160ms ease, color 160ms ease, background-color 160ms ease;
        }
        #rendered-site [data-wv-site-footer] :where(a, button):hover {
          box-shadow: none !important;
          transform: none !important;
        }
        #rendered-site [data-wv-site-footer] :where(p, a, button, span) {
          letter-spacing: 0;
        }
        #rendered-site [data-wv-site-footer] > div:first-child {
          align-items: start;
        }
        #rendered-site [data-wv-site-footer] > div:last-child {
          border-color: var(--wv-footer-border) !important;
        }
        #rendered-site [data-wv-site-footer] svg {
          flex: none;
        }
        #rendered-site [data-wv-site-footer] .opacity-85 {
          opacity: 1;
          color: var(--wv-footer-muted);
        }
        #rendered-site [data-wv-site-footer] .opacity-80 {
          opacity: 1;
          color: var(--wv-footer-muted);
        }
        #rendered-site [data-wv-site-footer] .opacity-70 {
          opacity: 1;
          color: rgba(255, 255, 255, 0.68);
        }
        #rendered-site [data-wv-tool-ui],
        #rendered-site [data-wv-tool-ui] *,
        #rendered-site [data-wv-format-toolbar],
        #rendered-site [data-wv-format-toolbar] * {
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
          letter-spacing: 0 !important;
          text-transform: none !important;
        }
        #rendered-site [data-wv-format-toolbar] {
          align-items: center;
          border-color: #e2e8f0 !important;
          border-radius: 0.5rem !important;
          background: #ffffff !important;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.12) !important;
          color: #334155 !important;
          font-style: normal !important;
          font-weight: 700 !important;
          line-height: 1 !important;
        }
        #rendered-site [data-wv-format-toolbar] button {
          display: inline-flex;
          width: 2rem;
          height: 1.75rem;
          align-items: center;
          justify-content: center;
          padding: 0 !important;
          border-radius: 0;
          box-shadow: none !important;
          color: #334155;
          font: 700 0.75rem/1 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
          transform: none !important;
          text-decoration: none !important;
        }
        #rendered-site [data-wv-format-toolbar] [data-wv-format-command="italic"] {
          font-style: italic !important;
        }
        #rendered-site [data-wv-format-toolbar] [data-wv-format-command="underline"] {
          text-decoration: underline !important;
        }
      `}</style>
    </div>
  );
}

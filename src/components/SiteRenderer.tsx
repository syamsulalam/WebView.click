import { type CSSProperties, type MouseEvent as ReactMouseEvent, useEffect, useRef, useState } from "react";
import {
  Briefcase,
  CheckCircle2,
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
  Star,
  X,
} from "lucide-react";
import { getShaderPreset, normalizeShaderPreset, normalizeStylePreset, normalizeVisualStyle, siteStylePresetCss } from "../lib/siteStylePresets";
import { fontPairingsForText, getFontPairing, googleFontImportUrl } from "../lib/fontPairings";
import EditableText, { type EditableTextTag } from "./EditableText";
import WebsiteActionPanel from "./WebsiteActionPanel";

type SiteRendererProps = {
  siteData: any;
  publicLinks?: { basic: string; premium: string };
  businessId?: string;
  showProspectPanel?: boolean;
  onDownloadZip?: () => void;
};

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
  const stylePreset = design.stylePreset || themeVariables.stylePreset || brand.visualStyle || "local-clean";
  const visualStyle = design.visualStyle || design.shapeStyle || brand.imageTreatment || "soft-rounded";
  const shaderConfig = design.shaderConfig && typeof design.shaderConfig === "object" ? design.shaderConfig : {};
  const shaderPreset = design.shaderPreset || shaderConfig.preset || themeVariables.shaderPreset || "local-aurora";
  const fontPairing = design.fontPairing || typography.fontPairing || "montserrat-raleway";

  return {
    meta: {
      businessName: meta.businessName || "Demo Business",
      businessId: meta.businessId || "demo-business",
      ...meta,
    },
    colors: {
      primary: colors.primary || "#111827",
      secondary: colors.secondary || "#F3F4F6",
      accent: colors.accent || "#4F46E5",
      textMain: colors.textMain || "#1F2937",
      textMuted: colors.textMuted || "#6B7280",
      background: colors.background || "#FFFFFF",
    },
    typography: {
      headingFont: typography.headingFont || "'Inter', sans-serif",
      bodyFont: typography.bodyFont || "'Inter', sans-serif",
    },
    stylePreset,
    visualStyle,
    shaderPreset,
    shaderConfig,
    fontPairing,
    fontPairingConfig: design.fontPairingConfig || {},
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
    location,
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
      headerMenu: Array.isArray(navigation.headerMenu)
        ? navigation.headerMenu
        : pages.map((page: any) => ({ label: page.pageTitle || page.pageId, href: `#${page.pageId}` })),
    },
    pages,
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

function attributionText(src?: string, attributions: string[] = [], source = "", caption = "") {
  if (source !== "google_places" && !isGooglePlacesImage(src)) return "";
  const cleanAttributions = attributions.map((item) => String(item).replace(/<[^>]*>/g, "").trim()).filter(Boolean);
  const base = caption || "Photo from Google Business Profile";
  return cleanAttributions.length ? `${base}: ${cleanAttributions.join(", ")}` : base;
}

function menuIcon(label = "", href = "") {
  const key = `${label} ${href}`.toLowerCase();
  if (key.includes("home") || key.includes("beranda")) return <Home size={16} />;
  if (key.includes("about") || key.includes("tentang")) return <Info size={16} />;
  if (key.includes("service") || key.includes("layanan") || key.includes("menu")) return <Briefcase size={16} />;
  if (key.includes("gallery") || key.includes("galeri")) return <Images size={16} />;
  if (key.includes("contact") || key.includes("kontak")) return <Mail size={16} />;
  return <ImageIcon size={16} />;
}

function socialIcon(platform = "") {
  const key = platform.toLowerCase();
  if (key.includes("instagram")) return <Instagram size={18} />;
  if (key.includes("facebook")) return <Facebook size={18} />;
  if (key.includes("linkedin")) return <Linkedin size={18} />;
  if (key.includes("whatsapp")) return <MessageCircle size={18} />;
  return <Globe size={18} />;
}

function buttonIcon(label = "", href = "", size = 16, className = "") {
  const key = `${label} ${href}`.toLowerCase();
  const iconProps = { size, className: className || undefined };
  if (key.includes("tel:") || key.includes("phone") || key.includes("telepon") || key.includes("call") || key.includes("hubungi")) return <PhoneCall {...iconProps} />;
  if (key.includes("mailto:") || key.includes("email") || key.includes("contact") || key.includes("kontak")) return <Mail {...iconProps} />;
  if (key.includes("map") || key.includes("direction") || key.includes("lokasi")) return <MapPin {...iconProps} />;
  if (key.includes("service") || key.includes("product") || key.includes("layanan") || key.includes("produk")) return <Briefcase {...iconProps} />;
  return <CheckCircle2 {...iconProps} />;
}

function phoneHref(value = "") {
  if (!value) return "";
  if (isPlaceholderPhone(value)) return "";
  if (value.startsWith("tel:")) return value;
  const normalized = value.replace(/[^\d+]/g, "");
  return normalized ? `tel:${normalized}` : "";
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
  if (typeof item?.cta?.href === "string" && item.cta.href) return item.cta.href;
  if (typeof item?.detailPageId === "string" && item.detailPageId) return `#${item.detailPageId}`;
  return "";
}

function titleCaseLabel(value = "") {
  const stopWords = new Set(["and", "or", "for", "of", "the", "a", "an", "to", "in", "on", "at", "by", "with"]);
  return String(value)
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index > 0 && stopWords.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function ImageFrame({
  src,
  label,
  className = "",
  attribution = "",
  exportName = "",
}: {
  src?: string;
  label?: string;
  className?: string;
  attribution?: string;
  exportName?: string;
}) {
  if (isUsableImage(src)) {
    return (
      <div className={`relative w-full h-full ${className}`}>
        <img src={src} alt={label || ""} data-wv-image-role={exportName || undefined} className="w-full h-full object-cover" />
        {attribution && (
          <div className="absolute left-2 right-2 bottom-2 rounded bg-black/65 px-2 py-1 text-[11px] leading-snug text-white">
            {attribution}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`w-full h-full bg-slate-100 flex items-center justify-center text-xs text-slate-500 ${className}`}>
      {label || src || "Image"}
    </div>
  );
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
  const navCloseTimer = useRef<number | undefined>(undefined);

  const { meta, colors: baseColors, typography, stylePreset, visualStyle, shaderPreset, shaderConfig, fontPairing, brand, businessProfile, trust, offers, products, services, capabilities, location, hours, conversion, globalConfig, navigation, pages } = normalizeSiteData(siteData);
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
  const paletteOptions = Array.isArray(brand.paletteOptions) ? brand.paletteOptions.filter((option: any) => Array.isArray(option?.colors) && option.colors.length > 0) : [];
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
  const brandPhotoAttribution = (src?: string) => attributionText(src, brand.photoAttributions, brand.photoSource, brand.photoCaption);
  const presetClass = `wv-preset-${normalizeStylePreset(stylePreset)}`;
  const visualClass = `wv-visual-${normalizeVisualStyle(visualStyle)}`;
  const shaderMeta = getShaderPreset(shaderPreset);
  const shaderClass = `wv-shader-${normalizeShaderPreset(shaderPreset)}`;
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
    openMaps: isIndonesian ? "Buka Google Maps" : "Open Google Maps",
    heroFallback: isIndonesian ? `Website resmi ${meta.businessName}` : `${meta.businessName} official website`,
    featuresFallback: isIndonesian ? "Mengapa Memilih Kami?" : "Why Choose Us?",
    capabilityFallback: isIndonesian ? "Tersedia di lokasi ini." : "Available from this business.",
  };
  const editKey = (...parts: Array<string | number | undefined>) =>
    [businessId || meta.businessId || "demo", ...parts]
      .filter((part) => part !== undefined && part !== "")
      .map((part) => String(part).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""))
      .join(".");
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
  const changeTab = (pageId: string) => {
    const nextPageId = pageId || homePageId;
    if (!pages.some((page: any) => page.pageId === nextPageId)) {
      const target = document.getElementById(nextPageId);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setActiveTab(nextPageId);
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  };
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
  const footerSocials = Array.isArray(globalConfig.footer.socials) && globalConfig.footer.socials.length > 0
    ? globalConfig.footer.socials
    : [
        { platform: "Instagram", href: "#" },
        { platform: "Facebook", href: "#" },
        { platform: "LinkedIn", href: "#" },
      ];
  const footerHours = Array.isArray(hours.regular) ? hours.regular.slice(0, 3) : [];
  const footerOfferings = [...products, ...services];
  const footerHighlights = footerOfferings.length > 0 ? footerOfferings : offers.length > 0 ? offers : capabilities;
  const rawPrimaryPhone = businessProfile.contact?.phoneInternational || businessProfile.contact?.phoneNational || "";
  const rawDisplayPhone = businessProfile.contact?.phoneNational || businessProfile.contact?.phoneInternational || "";
  const primaryPhone = isPlaceholderPhone(rawPrimaryPhone) ? "" : rawPrimaryPhone;
  const displayPhone = isPlaceholderPhone(rawDisplayPhone) ? "" : rawDisplayPhone;
  const displayEmail = businessProfile.contact?.email || businessProfile.email || globalConfig.footer.email || "";

  const customStyles = {
    "--color-primary": colors.primary,
    "--color-secondary": colors.secondary,
    "--color-accent": colors.accent,
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

  const navSubmenus = navigation.headerMenu
    .map((menu: any, idx: number) => {
      const pageId = String(menu.href || "").replace("#", "");
      return { menu, menuKey: `${pageId}-${idx}`, children: Array.isArray(menu.children) ? menu.children : [] };
    })
    .filter((item: any) => item.children.length > 0);

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
      <div data-wv-site-canvas="true" style={siteCanvasStyles} className={`min-h-screen flex flex-col ${presetClass} ${visualClass} ${shaderClass}`}>
      <div data-wv-site-shader="true" aria-hidden="true" />
      <header
        data-wv-site-header="true"
        data-wv-header-compact={headerCompact ? "true" : undefined}
        style={{ backgroundColor: colors.primary, color: "#fff" }}
        className={`${headerCompact ? "px-5 py-2.5" : "px-5 py-4"} md:px-12 flex justify-between items-center sticky top-0 z-50 shadow-sm`}
      >
        <button
          type="button"
          onClick={() => changeTab(homePageId)}
          data-wv-tab={homePageId}
          className="min-w-0 font-bold text-xl tracking-tight leading-tight flex items-center gap-3 text-left hover:opacity-85 transition"
          aria-label={`Go to ${meta.businessName} home`}
        >
          {brand.logoSvg ? <span className="w-8 h-8 [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: brand.logoSvg }} /> : null}
          {isUsableImage(brand.logoImageUrl) ? <img src={brand.logoImageUrl} alt="" data-wv-image-role="logo" className="w-8 h-8 rounded-full object-cover" /> : null}
          {editableText("header.businessName", meta.businessName, "span", "leading-tight")}
        </button>
        <nav className="hidden md:flex items-center gap-5">
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
                  className={`${headerCompact ? "h-8" : "h-10"} text-sm font-medium leading-none hover:opacity-80 transition inline-flex items-center gap-1.5 ${activeTab === pageId ? "border-b-2 border-white" : ""}`}
                >
                  {menuIcon(menu.label, menu.href)}
                  {menu.label}
                  {children.length > 0 && <span className="text-xs opacity-80">▾</span>}
                </button>
              </div>
            );
          })}
        </nav>
        <a
          href={globalConfig.header.ctaButton.href}
          data-wv-tab={String(globalConfig.header.ctaButton.href || "").startsWith("#") ? String(globalConfig.header.ctaButton.href).replace("#", "") : undefined}
          onClick={(event) => {
            const href = String(globalConfig.header.ctaButton.href || "");
            if (href.startsWith("#")) {
              event.preventDefault();
              changeTab(href.replace("#", ""));
            }
          }}
          style={{ backgroundColor: colors.accent }}
          className={`${headerCompact ? "h-9" : "h-11"} shrink-0 px-4 py-0 rounded-lg text-white font-medium hover:opacity-90 transition text-sm leading-none inline-flex items-center gap-2`}
        >
          {buttonIcon(globalConfig.header.ctaButton.text, globalConfig.header.ctaButton.href)}
          {globalConfig.header.ctaButton.text}
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
                  <span className="mt-0.5 shrink-0 text-slate-500">{menuIcon(child.label, child.href)}</span>
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
                return (
                  <section key={section.id} className="px-6 py-16 md:py-24 bg-white">
                    <div className="max-w-6xl mx-auto grid md:grid-cols-[1.05fr_0.95fr] gap-10 items-center">
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: colors.accent }}>
                          {editableText(`${section.id}.eyebrow`, businessProfile.typeLabel, "span")}
                        </p>
                        <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight text-slate-950">
                          {editableText(`${section.id}.headline`, heroContent.headline || labels.heroFallback, "span")}
                        </h1>
                        <p className="text-lg md:text-xl mb-8 text-slate-600 max-w-2xl">
                          {editableText(`${section.id}.subheadline`, heroContent.subheadline || businessProfile.shortPitch, "span", "", undefined, true)}
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3">
                          {(heroContent.buttons || []).map((btn: any, i: number) => {
                            const href = typeof btn.href === "string" ? btn.href : "#";
                            return (
                              <button
                                key={i}
                                data-wv-tab={href.startsWith("#") ? href.replace("#", "") : undefined}
                                style={{
                                  backgroundColor: btn.style === "primary" ? colors.accent : "transparent",
                                  color: btn.style === "primary" ? "#fff" : colors.textMain,
                                  border: `1px solid ${btn.style === "primary" ? colors.accent : "#CBD5E1"}`,
                                }}
                                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold transition hover:translate-y-[-1px]"
                                onClick={() => {
                                  if (href.startsWith("#")) changeTab(href.replace("#", ""));
                                  else if (href) window.location.href = href;
                                }}
                              >
                                {buttonIcon(btn.text, href)}
                                {btn.text || labels.learnMore}
                              </button>
                            );
                          })}
                        </div>
                        {(trust.rating > 0 || displayPhone) && (
                          <div className="mt-8 flex flex-wrap gap-4 text-sm text-slate-600">
                            {trust.rating > 0 && <span className="inline-flex items-center gap-2"><Star size={16} fill={colors.accent} color={colors.accent} /> {trust.rating.toFixed(1)} {isIndonesian ? "dari" : "from"} {trust.reviewCount || labels.manyReviews} {labels.reviews}</span>}
                            {displayPhone && (
                              <a href={phoneHref(primaryPhone || displayPhone)} className="inline-flex items-center gap-2 hover:underline">
                                <Phone size={16} /> {displayPhone}
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="h-[360px] md:h-[520px] rounded-2xl overflow-hidden border border-slate-200 shadow-xl bg-slate-100">
                        <ImageFrame src={heroImage} label={heroContent.image || meta.businessName} attribution={brandPhotoAttribution(heroImage)} exportName="hero" />
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
                return (
                  <section key={section.id} className="px-6 py-6 bg-slate-50 border-y border-slate-200">
                    <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {items.map((item: any, i: number) => (
                        <div key={i} className="flex flex-col items-center justify-center gap-2 rounded-lg bg-white border border-slate-200 px-4 py-4 text-center">
                          {item.icon === "star" ? (
                            <Star data-wv-qa-icon="trustBar" size={30} className="shrink-0" style={{ color: colors.primary }} />
                          ) : item.icon === "phone" ? (
                            <Phone data-wv-qa-icon="trustBar" size={30} className="shrink-0" style={{ color: colors.primary }} />
                          ) : (
                            <CheckCircle2 data-wv-qa-icon="trustBar" size={30} className="shrink-0" style={{ color: colors.primary }} />
                          )}
                          <div>
                            {editableText(`${section.id}.trust.${i}.value`, item.value, "p", "text-xl font-bold text-slate-950")}
                            {editableText(`${section.id}.trust.${i}.label`, item.label, "p", "text-xs uppercase tracking-wide text-slate-500")}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              }

              if (section.type === "features") {
                const items = section.content?.items || capabilities.filter((item: any) => item.enabled !== false).map((item: any) => ({ title: item.label, description: item.description || labels.capabilityFallback }));
                return (
                  <section key={section.id} className="py-20 px-6 bg-black/5">
                    <div className="max-w-6xl mx-auto">
                      {editableText(`${section.id}.title`, section.content?.title || labels.featuresFallback, "h2", "text-3xl font-bold text-center mb-12")}
                      <div className="grid md:grid-cols-3 gap-8">
                        {items.map((item: any, i: number) => (
                          <div key={i} className="bg-white p-7 rounded-xl shadow-sm hover:shadow-md transition border border-slate-100 text-center">
                            {item.iconSvg ? (
                              <span data-wv-qa-icon="features" className="mx-auto mb-4 inline-flex h-9 w-9 text-[2.25rem] [&>svg]:h-full [&>svg]:w-full" style={{ color: colors.accent }} dangerouslySetInnerHTML={{ __html: item.iconSvg }} />
                            ) : (
                              <span data-wv-qa-icon="features" className="mx-auto mb-4 inline-flex text-[2.25rem]" style={{ color: colors.accent }}>
                                {buttonIcon(item.title || item.label || "", "", 36, "shrink-0")}
                              </span>
                            )}
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
                return (
                  <section key={section.id} className="py-20 px-6 bg-white">
                    <div className="max-w-6xl mx-auto">
                      <div className="max-w-2xl mb-10">
                        <p className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: colors.accent }}>{editableText(`${section.id}.eyebrow`, labels.offersEyebrow, "span")}</p>
                        {editableText(`${section.id}.title`, section.content?.title || labels.offersTitle, "h2", "text-3xl md:text-4xl font-bold text-slate-950")}
                        {section.content?.description && editableText(`${section.id}.description`, section.content.description, "p", "mt-3 text-slate-600", undefined, true)}
                      </div>
                      <div className="grid md:grid-cols-3 gap-5">
                        {items.map((offer: any, i: number) => (
                          <div key={i} className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                            <div className="h-44">
                              <ImageFrame src={offer.image} label={offer.title} attribution={brandPhotoAttribution(offer.image)} exportName={`offer-${offer.title || i + 1}`} />
                            </div>
                            <div className="p-6 text-center">
                              {editableText(`${section.id}.offer.${i}.title`, offer.title, "h3", "text-lg font-bold text-slate-950")}
                              {editableText(`${section.id}.offer.${i}.description`, offer.description, "p", "mt-2 text-sm text-slate-600", undefined, true)}
                              {offer.priceHint && editableText(`${section.id}.offer.${i}.price`, offer.priceHint, "p", "mt-4 text-sm font-semibold", { color: colors.accent })}
                            </div>
                          </div>
                        ))}
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
                return (
                  <section key={section.id} className="py-20 px-6 bg-white">
                    <div className="max-w-6xl mx-auto grid gap-10 lg:grid-cols-[1.05fr_0.95fr]">
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: colors.accent }}>{editableText(`${section.id}.kind`, detail.kind || "Offering", "span")}</p>
                        {editableText(`${section.id}.title`, detail.title, "h2", "text-3xl md:text-4xl font-bold text-slate-950")}
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
                          <ImageFrame src={detail.image || brand.preferredHeroImage} label={detail.title} attribution={brandPhotoAttribution(detail.image || brand.preferredHeroImage)} exportName={`detail-${detail.title || section.id}`} />
                        </div>
                        {detail.priceHint && editableText(`${section.id}.price`, detail.priceHint, "p", "mt-5 text-lg font-bold", { color: colors.accent })}
                        {included.length > 0 && (
                          <div className="mt-5">
                            <p className="font-semibold text-slate-950">{isIndonesian ? "Yang termasuk" : "What's included"}</p>
                            <ul className="mt-3 space-y-2 text-sm text-slate-700">
                              {included.map((item: string, i: number) => <li key={item} className="flex gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0" style={{ color: colors.accent }} />{editableText(`${section.id}.included.${i}`, item, "span")}</li>)}
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
                              {Array.from({ length: Math.round(review.rating || 5) }).map((_, idx) => <Star key={idx} size={16} fill="currentColor" />)}
                            </div>
                            <div className="text-slate-700">
                              <span aria-hidden="true" className="wv-heading block text-left text-5xl font-bold leading-none" style={{ color: colors.accent }}>"</span>
                              {editableText(`${section.id}.review.${i}.text`, review.text, "p", "mt-1", undefined, true)}
                              <span aria-hidden="true" className="wv-heading mt-2 block text-right text-5xl font-bold leading-none" style={{ color: colors.accent }}>"</span>
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
                return (
                  <section key={section.id} className="py-20 px-6 bg-white">
                    <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-6">
                      <div className="rounded-xl border border-slate-200 p-8 bg-slate-50">
                        <div className="mb-5 flex items-center gap-3 text-2xl">
                          <Clock data-wv-qa-icon="hoursLocation" className="h-[1.1em] w-[1.1em] shrink-0" style={{ color: colors.accent }} />
                          {editableText(`${section.id}.hoursTitle`, section.content?.title || labels.hoursTitle, "h2", "text-2xl font-bold text-slate-950")}
                        </div>
                        <div className="space-y-2 text-slate-700">
                          {regularHours.map((item: any, i: number) => editableText(`${section.id}.hours.${i}`, typeof item === "string" ? item : item.text || JSON.stringify(item), "p"))}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-200 p-8 bg-white">
                        <div className="mb-5 flex items-center gap-3 text-2xl">
                          <MapPin data-wv-qa-icon="hoursLocation" className="h-[1.1em] w-[1.1em] shrink-0" style={{ color: colors.accent }} />
                          {editableText(`${section.id}.locationTitle`, labels.locationTitle, "h2", "text-2xl font-bold text-slate-950")}
                        </div>
                        {editableText(`${section.id}.address`, section.content?.address || location.formattedAddress || businessProfile.address?.formatted || "Alamat belum tersedia.", "p", "text-slate-700", undefined, true)}
                        {(section.content?.phone || displayPhone) && !isPlaceholderPhone(section.content?.phone || displayPhone) && (
                          <div className="mt-3">
                            <a href={phoneHref(section.content?.phone || primaryPhone || displayPhone)} className="inline-flex w-fit items-center gap-2 font-semibold text-slate-950 hover:underline">
                              <Phone size={16} /> {section.content?.phone || displayPhone}
                            </a>
                          </div>
                        )}
                        {(section.content?.directionsUrl || businessProfile.contact?.directionsUrl || location.directionsUrl) && (
                          <a href={section.content?.directionsUrl || businessProfile.contact?.directionsUrl || location.directionsUrl} className="mt-5 inline-flex w-fit items-center gap-2 px-5 py-3 rounded-lg text-white font-semibold" style={{ backgroundColor: colors.primary }}>
                            <MapPin size={16} />
                            {labels.openMaps}
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

              if (section.type === "textImageBlock") {
                return (
                  <section key={section.id} className="py-20 px-6">
                    <div className={`max-w-6xl mx-auto flex flex-col md:flex-row gap-12 items-center ${section.content.layout === "imageRight" ? "md:flex-row-reverse" : ""}`}>
                      <div className="flex-1">
                        {editableText(`${section.id}.title`, section.content.title, "h2", "text-3xl font-bold mb-6")}
                        <div className="opacity-80 prose max-w-none" dangerouslySetInnerHTML={{ __html: section.content.bodyHtml }} />
                      </div>
                      <div className="flex-1 w-full relative h-[400px] bg-gray-100 rounded-xl overflow-hidden shadow-lg border border-gray-200">
                        <ImageFrame src={section.content.image} label={section.content.title} attribution={brandPhotoAttribution(section.content.image)} exportName={`section-${section.content.title || section.id}`} />
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
                              <ImageFrame src={member.image} label={member.name} attribution={brandPhotoAttribution(member.image)} exportName={`team-${member.name || i + 1}`} />
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
                              <ImageFrame src={card.image} label={card.title} attribution={brandPhotoAttribution(card.image)} exportName={`card-${card.title || i + 1}`} />
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
                            <ImageFrame src={img} label={`Gallery ${i + 1}`} attribution={brandPhotoAttribution(img)} exportName={`gallery-${i + 1}`} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                );
              }

              if (section.type === "contactForm") {
                const contactEmail = section.content?.email || displayEmail;
                const rawContactPhone = section.content?.phone || displayPhone;
                const contactPhone = isPlaceholderPhone(rawContactPhone) ? "" : rawContactPhone;
                const formFields = Array.isArray(section.content?.formConfig?.fields) ? section.content.formConfig.fields : [];
                return (
                  <section key={section.id} className="py-20 px-6">
                    <div className="max-w-5xl mx-auto bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col md:flex-row border border-gray-100">
                      <div style={{ backgroundColor: colors.primary, color: "#fff" }} className="p-10 md:w-2/5">
                        {editableText(`${section.id}.title`, section.content.title, "h2", "text-2xl font-bold mb-6")}
                        <div className="space-y-4 text-sm opacity-90">
                          <p><strong>Alamat:</strong><br />{editableText(`${section.id}.contactAddress`, section.content.address, "span", "", undefined, true)}</p>
                          {contactPhone && (
                            <p>
                              <strong>Telepon:</strong><br />
                              <a href={phoneHref(contactPhone)} className="inline-flex items-center gap-2 hover:underline"><Phone size={15} />{contactPhone}</a>
                            </p>
                          )}
                          {contactEmail && (
                            <p>
                              <strong>Email:</strong><br />
                              <a href={mailHref(contactEmail)} className="inline-flex items-center gap-2 hover:underline"><Mail size={15} />{contactEmail}</a>
                            </p>
                          )}
                          <div>
                            <strong>Jam Operasional:</strong>
                            <ul className="mt-1 space-y-1">
                              {(Array.isArray(section.content.openingHours) ? section.content.openingHours : []).map((h: string, i: number) => <li key={i}>{editableText(`${section.id}.contactHours.${i}`, h, "span")}</li>)}
                            </ul>
                          </div>
                        </div>
                      </div>
                      <div className="p-10 md:w-3/5">
                        {editableText(`${section.id}.formHeading`, section.content.formConfig.heading, "h3", "text-xl font-bold mb-6")}
                        <form
                          className="space-y-4"
                          data-wv-mailto={contactEmail}
                          data-wv-business={meta.businessName}
                          onSubmit={(e) => {
                            e.preventDefault();
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
                          <button type="submit" style={{ backgroundColor: colors.accent, color: "#fff" }} className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium hover:opacity-90 transition pt-2">
                            <Mail size={16} />
                            {section.content.formConfig.buttonText}
                          </button>
                        </form>
                      </div>
                    </div>
                  </section>
                );
              }

              return <div key={section.id} className="py-20 text-center opacity-50">[Section: {section.type}]</div>;
            })}
          </div>
        ))}
      </main>

      <footer data-wv-site-footer="true" style={{ backgroundColor: colors.primary, color: "#fff" }} className="px-6 py-14 text-sm">
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
                  {socialIcon(social.platform)}
                </a>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-4 font-semibold">{labels.pages}</p>
            <div className="space-y-2 opacity-85">
              {navigation.headerMenu.map((menu: any) => (
                <button key={menu.href} type="button" data-wv-tab={menu.href.replace("#", "")} onClick={() => changeTab(menu.href.replace("#", ""))} className="flex items-center gap-2 hover:opacity-100">
                  {menuIcon(menu.label, menu.href)}
                  {menu.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-4 font-semibold">{labels.highlights}</p>
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
            <p className="mb-4 font-semibold">{labels.contact}</p>
            <div className="space-y-3 opacity-85">
              {(displayPhone || globalConfig.header.ctaButton?.href) && (
                <p className="flex gap-2">
                  <Phone size={16} className="mt-0.5 shrink-0" />
                  {phoneHref(primaryPhone || displayPhone || globalConfig.header.ctaButton.href) ? (
                    <a href={phoneHref(primaryPhone || displayPhone || globalConfig.header.ctaButton.href)} className="hover:underline">{displayPhone || globalConfig.header.ctaButton.href}</a>
                  ) : (
                    <span>{displayPhone || globalConfig.header.ctaButton.href}</span>
                  )}
                </p>
              )}
              {displayEmail && (
                <p className="flex gap-2">
                  <Mail size={16} className="mt-0.5 shrink-0" />
                  <a href={mailHref(displayEmail)} className="hover:underline">{displayEmail}</a>
                </p>
              )}
              {(location.formattedAddress || businessProfile.address?.formatted) && (
                <p className="flex gap-2"><MapPin size={16} className="mt-0.5 shrink-0" /> <span>{location.formattedAddress || businessProfile.address.formatted}</span></p>
              )}
              {footerHours.length > 0 && (
                <div className="flex gap-2"><Clock size={16} className="mt-0.5 shrink-0" /> <div>{footerHours.map((item: string) => <p key={item}>{item}</p>)}</div></div>
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
          <a href={conversion.primaryCta?.href || globalConfig.header.ctaButton.href} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-3 text-white font-semibold" style={{ backgroundColor: colors.accent }}>
            {buttonIcon(conversion.primaryCta?.text || globalConfig.header.ctaButton.text, conversion.primaryCta?.href || globalConfig.header.ctaButton.href)}
            {conversion.primaryCta?.text || globalConfig.header.ctaButton.text}
          </a>
          {conversion.secondaryCta?.href && (
            <a href={conversion.secondaryCta.href} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-3 font-semibold border border-slate-300 text-slate-800">
              {buttonIcon(conversion.secondaryCta.text, conversion.secondaryCta.href)}
              {conversion.secondaryCta.text || (isIndonesian ? "Lokasi" : "Location")}
            </a>
          )}
        </div>
      )}
      </div>

      <div data-export-remove="true" data-wv-tool-ui="inline-edit-panel" className="hide-in-export fixed bottom-20 left-5 z-[210] flex max-w-[calc(100vw-2.5rem)] flex-col items-start gap-2 md:bottom-5">
        {editMode && (
          <div className="max-w-xs rounded-lg border border-indigo-100 bg-white/95 px-3 py-2 text-xs font-medium text-slate-700 shadow-xl backdrop-blur">
            Click site text to edit it. Changes are saved in this browser and included in the downloaded site.
          </div>
        )}
        <button
          type="button"
          onClick={() => setEditMode((value) => !value)}
          className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold shadow-xl transition ${editMode ? "border-indigo-200 bg-indigo-600 text-white hover:bg-indigo-700" : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"}`}
          aria-pressed={editMode}
        >
          {editMode ? <X size={16} /> : <Pencil size={16} />}
          {editMode ? "Done editing" : "Edit text"}
        </button>
      </div>

      {showProspectPanel && (
        <WebsiteActionPanel
          siteData={siteData}
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
        #rendered-site [data-wv-site-canvas] > [data-wv-site-shader] {
          flex: 0 0 0;
          width: 0;
          height: 0;
        }
        #rendered-site [data-wv-site-header] {
          min-height: 4.5rem;
          margin: 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.14);
          box-shadow: 0 10px 28px rgba(15, 23, 42, 0.10) !important;
          line-height: 1.15;
          transition: min-height 180ms ease, padding-block 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
        }
        #rendered-site [data-wv-site-header][data-wv-header-compact="true"] {
          min-height: 3.5rem;
          border-bottom-color: rgba(255, 255, 255, 0.18);
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08) !important;
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
          border-radius: 14px !important;
          border-color: rgba(15, 23, 42, 0.12) !important;
          box-shadow: 0 22px 50px rgba(15, 23, 42, 0.18) !important;
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
          background: rgba(15, 23, 42, 0.055);
          box-shadow: none !important;
          transform: none !important;
        }
        #rendered-site [data-wv-site-submenu] svg {
          flex: none;
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

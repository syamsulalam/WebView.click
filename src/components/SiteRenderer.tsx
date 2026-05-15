import { useRef, useState } from "react";
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
  Phone,
  PhoneCall,
  Star,
} from "lucide-react";
import { normalizeStylePreset, siteStylePresetCss } from "../lib/siteStylePresets";
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
    brand: {
      logoImageUrl: brand.logoImageUrl || header.logoImageUrl || "",
      logoSvg: brand.logoSvg || header.logoSvg || "",
      preferredHeroImage: brand.preferredHeroImage || "",
      palette: Array.isArray(brand.palette) ? brand.palette : [],
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

function buttonIcon(label = "", href = "") {
  const key = `${label} ${href}`.toLowerCase();
  if (key.includes("tel:") || key.includes("phone") || key.includes("telepon") || key.includes("call") || key.includes("hubungi")) return <PhoneCall size={16} />;
  if (key.includes("mailto:") || key.includes("email") || key.includes("contact") || key.includes("kontak")) return <Mail size={16} />;
  if (key.includes("map") || key.includes("direction") || key.includes("lokasi")) return <MapPin size={16} />;
  if (key.includes("service") || key.includes("product") || key.includes("layanan") || key.includes("produk")) return <Briefcase size={16} />;
  return <CheckCircle2 size={16} />;
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
  const navCloseTimer = useRef<number | undefined>(undefined);

  const { meta, colors, typography, stylePreset, brand, businessProfile, trust, offers, products, services, capabilities, location, hours, conversion, globalConfig, navigation, pages } = normalizeSiteData(siteData);
  const brandPhotoAttribution = (src?: string) => attributionText(src, brand.photoAttributions, brand.photoSource, brand.photoCaption);
  const presetClass = `wv-preset-${normalizeStylePreset(stylePreset)}`;
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
  const openNavMenu = (key: string) => {
    if (navCloseTimer.current) window.clearTimeout(navCloseTimer.current);
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
  const footerHighlights = offers.length > 0 ? offers : products.length > 0 ? products : services.length > 0 ? services : capabilities;
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
    fontFamily: typography.bodyFont,
    backgroundColor: "var(--color-bg)",
    color: "var(--color-text)",
  } as React.CSSProperties;

  return (
    <div style={customStyles} className={`min-h-screen flex flex-col ${presetClass}`} id="rendered-site">
      <header style={{ backgroundColor: colors.primary, color: "#fff" }} className="py-4 px-6 md:px-12 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <button
          type="button"
          onClick={() => changeTab(homePageId)}
          data-wv-tab={homePageId}
          className="font-bold text-xl tracking-tight flex items-center gap-3 text-left hover:opacity-85 transition"
          aria-label={`Go to ${meta.businessName} home`}
        >
          {brand.logoSvg ? <span className="w-8 h-8 [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: brand.logoSvg }} /> : null}
          {isUsableImage(brand.logoImageUrl) ? <img src={brand.logoImageUrl} alt="" data-wv-image-role="logo" className="w-8 h-8 rounded-full object-cover" /> : null}
          <span>{meta.businessName}</span>
        </button>
        <nav className="hidden md:flex gap-6">
          {navigation.headerMenu.map((menu: any, idx: number) => {
            const pageId = menu.href.replace("#", "");
            const children = Array.isArray(menu.children) ? menu.children : [];
            const menuKey = `${pageId}-${idx}`;
            const submenuOpen = openMenuKey === menuKey;
            return (
              <div
                key={idx}
                className="relative"
                data-wv-menu={menuKey}
                onMouseEnter={() => openNavMenu(menuKey)}
                onMouseLeave={scheduleNavMenuClose}
              >
                <button
                  onClick={() => changeTab(pageId)}
                  data-wv-tab={pageId}
                  className={`text-sm font-medium hover:opacity-80 transition inline-flex items-center gap-1.5 ${activeTab === pageId ? "border-b-2 border-white" : ""}`}
                >
                  {menuIcon(menu.label, menu.href)}
                  {menu.label}
                  {children.length > 0 && <span className="text-xs opacity-80">▾</span>}
                </button>
                {children.length > 0 && (
                  <div
                    data-wv-submenu
                    onMouseEnter={() => openNavMenu(menuKey)}
                    onMouseLeave={scheduleNavMenuClose}
                    className={`${submenuOpen ? "visible translate-y-0 opacity-100 pointer-events-auto" : "invisible translate-y-2 opacity-0 pointer-events-none"} absolute left-0 top-full z-[80] mt-3 w-72 rounded-xl border border-slate-200 bg-white p-2 text-slate-900 shadow-2xl transition duration-200`}
                  >
                    {children.map((child: any) => {
                      const childPageId = String(child.href || "").replace("#", "");
                      return (
                        <button
                          key={child.href || child.label}
                          type="button"
                          data-wv-tab={childPageId}
                          onClick={() => changeTab(childPageId)}
                          className="flex w-full gap-2 rounded-lg px-3 py-2 text-left hover:bg-slate-50"
                        >
                          <span className="mt-0.5 shrink-0 text-slate-500">{menuIcon(child.label, child.href)}</span>
                          <span>
                            <span className="block text-sm font-semibold">{child.label}</span>
                            {child.description && <span className="mt-0.5 block text-xs text-slate-500">{child.description}</span>}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
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
          className="px-5 py-2 rounded-lg text-white font-medium hover:opacity-90 transition text-sm inline-flex items-center gap-2"
        >
          {buttonIcon(globalConfig.header.ctaButton.text, globalConfig.header.ctaButton.href)}
          {globalConfig.header.ctaButton.text}
        </a>
      </header>

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
                          {businessProfile.typeLabel}
                        </p>
                        <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight text-slate-950" style={{ fontFamily: typography.headingFont }}>
                          {heroContent.headline || labels.heroFallback}
                        </h1>
                        <p className="text-lg md:text-xl mb-8 text-slate-600 max-w-2xl">
                          {heroContent.subheadline || businessProfile.shortPitch}
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
                        <div key={i} className="flex items-center gap-3 rounded-lg bg-white border border-slate-200 px-4 py-4">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: colors.secondary, color: colors.primary }}>
                            {item.icon === "star" ? <Star size={18} /> : item.icon === "phone" ? <Phone size={18} /> : <CheckCircle2 size={18} />}
                          </div>
                          <div>
                            <p className="text-xl font-bold text-slate-950">{item.value}</p>
                            <p className="text-xs uppercase tracking-wide text-slate-500">{item.label}</p>
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
                      <h2 className="text-3xl font-bold text-center mb-12">{section.content?.title || labels.featuresFallback}</h2>
                      <div className="grid md:grid-cols-3 gap-8">
                        {items.map((item: any, i: number) => (
                          <div key={i} className="bg-white p-7 rounded-xl shadow-sm hover:shadow-md transition border border-slate-100">
                            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: colors.secondary, color: colors.accent }}>
                              {item.iconSvg ? (
                                <span className="h-6 w-6 [&>svg]:h-6 [&>svg]:w-6" dangerouslySetInnerHTML={{ __html: item.iconSvg }} />
                              ) : (
                                buttonIcon(item.title || item.label || "", "")
                              )}
                            </div>
                            <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                            <p className="opacity-70">{item.description}</p>
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
                        <p className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: colors.accent }}>{labels.offersEyebrow}</p>
                        <h2 className="text-3xl md:text-4xl font-bold text-slate-950">{section.content?.title || labels.offersTitle}</h2>
                        {section.content?.description && <p className="mt-3 text-slate-600">{section.content.description}</p>}
                      </div>
                      <div className="grid md:grid-cols-3 gap-5">
                        {items.map((offer: any, i: number) => (
                          <div key={i} className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                            <div className="h-44">
                              <ImageFrame src={offer.image} label={offer.title} attribution={brandPhotoAttribution(offer.image)} exportName={`offer-${offer.title || i + 1}`} />
                            </div>
                            <div className="p-6">
                              <h3 className="text-lg font-bold text-slate-950">{offer.title}</h3>
                              <p className="mt-2 text-sm text-slate-600">{offer.description}</p>
                              {offer.priceHint && <p className="mt-4 text-sm font-semibold" style={{ color: colors.accent }}>{offer.priceHint}</p>}
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
                        <p className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: colors.accent }}>{detail.kind || "Offering"}</p>
                        <h2 className="text-3xl md:text-4xl font-bold text-slate-950">{detail.title}</h2>
                        <p className="mt-4 text-lg text-slate-600">{detail.summary || detail.description}</p>
                        {highlights.length > 0 && (
                          <div className="mt-8 grid gap-3 sm:grid-cols-2">
                            {highlights.map((item: any, i: number) => (
                              <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                <p className="font-semibold text-slate-950">{item.title || item}</p>
                                {item.description && <p className="mt-1 text-sm text-slate-600">{item.description}</p>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
                        <div className="h-56 overflow-hidden rounded-xl bg-slate-200">
                          <ImageFrame src={detail.image || brand.preferredHeroImage} label={detail.title} attribution={brandPhotoAttribution(detail.image || brand.preferredHeroImage)} exportName={`detail-${detail.title || section.id}`} />
                        </div>
                        {detail.priceHint && <p className="mt-5 text-lg font-bold" style={{ color: colors.accent }}>{detail.priceHint}</p>}
                        {included.length > 0 && (
                          <div className="mt-5">
                            <p className="font-semibold text-slate-950">{isIndonesian ? "Yang termasuk" : "What's included"}</p>
                            <ul className="mt-3 space-y-2 text-sm text-slate-700">
                              {included.map((item: string) => <li key={item} className="flex gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0" style={{ color: colors.accent }} />{item}</li>)}
                            </ul>
                          </div>
                        )}
                        {bestFor.length > 0 && (
                          <div className="mt-5">
                            <p className="font-semibold text-slate-950">{isIndonesian ? "Cocok untuk" : "Best for"}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {bestFor.map((item: string) => <span key={item} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">{item}</span>)}
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
                          <p className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: colors.accent }}>{labels.reviewsEyebrow}</p>
                          <h2 className="text-3xl md:text-4xl font-bold text-slate-950">{section.content?.title || labels.reviewsTitle}</h2>
                        </div>
                        {trust.reviewSummary && <p className="max-w-xl text-slate-600">{trust.reviewSummary}</p>}
                      </div>
                      <div className="grid md:grid-cols-3 gap-5">
                        {reviews.map((review: any, i: number) => (
                          <div key={i} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                            <div className="flex gap-1 mb-4" style={{ color: colors.accent }}>
                              {Array.from({ length: Math.round(review.rating || 5) }).map((_, idx) => <Star key={idx} size={16} fill="currentColor" />)}
                            </div>
                            <p className="text-slate-700">"{review.text}"</p>
                            <p className="mt-4 font-semibold text-slate-950">{review.authorName || review.author || "Google reviewer"}</p>
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
                        <div className="flex items-center gap-3 mb-5">
                          <Clock size={22} style={{ color: colors.accent }} />
                          <h2 className="text-2xl font-bold text-slate-950">{section.content?.title || labels.hoursTitle}</h2>
                        </div>
                        <div className="space-y-2 text-slate-700">
                          {regularHours.map((item: any, i: number) => <p key={i}>{typeof item === "string" ? item : item.text || JSON.stringify(item)}</p>)}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-200 p-8 bg-white">
                        <div className="flex items-center gap-3 mb-5">
                          <MapPin size={22} style={{ color: colors.accent }} />
                          <h2 className="text-2xl font-bold text-slate-950">{labels.locationTitle}</h2>
                        </div>
                        <p className="text-slate-700">{section.content?.address || location.formattedAddress || businessProfile.address?.formatted || "Alamat belum tersedia."}</p>
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
                      <h2 className="text-3xl md:text-4xl font-bold text-slate-950 mb-8">{section.content?.title || "Pertanyaan Umum"}</h2>
                      <div className="space-y-3">
                        {items.map((item: any, i: number) => (
                          <div key={i} className="rounded-xl bg-white border border-slate-200 p-5">
                            <h3 className="font-semibold text-slate-950">{item.question}</h3>
                            <p className="mt-2 text-slate-600">{item.answer}</p>
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
                        <h2 className="text-3xl font-bold mb-6">{section.content.title}</h2>
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
                      <h2 className="text-3xl font-bold text-center mb-12">{section.content.title}</h2>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {section.content.members.map((member: any, i: number) => (
                          <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 text-center pb-6">
                            <div className="h-48 bg-gray-200 mb-4">
                              <ImageFrame src={member.image} label={member.name} attribution={brandPhotoAttribution(member.image)} exportName={`team-${member.name || i + 1}`} />
                            </div>
                            <h3 className="text-lg font-semibold">{member.name}</h3>
                            <p className="text-sm opacity-60 font-medium">{member.role}</p>
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
                        <h2 className="text-3xl font-bold mb-4">{section.content.title}</h2>
                        <p className="opacity-70 max-w-2xl mx-auto">{section.content.description}</p>
                      </div>
                      <div className="grid md:grid-cols-3 gap-8">
                        {section.content.cards.map((card: any, i: number) => (
                          <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-md border border-gray-100">
                            <div className="h-48 bg-gray-200">
                              <ImageFrame src={card.image} label={card.title} attribution={brandPhotoAttribution(card.image)} exportName={`card-${card.title || i + 1}`} />
                            </div>
                            <div className="p-6">
                              <h3 className="text-xl font-bold mb-2">{card.title}</h3>
                              <p className="opacity-70 mb-4">{card.description}</p>
                              {card.price && <p className="font-semibold text-lg" style={{ color: colors.accent }}>{card.price}</p>}
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
                      <h2 className="text-3xl font-bold text-center mb-12">{section.content.title}</h2>
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
                        <h2 className="text-2xl font-bold mb-6">{section.content.title}</h2>
                        <div className="space-y-4 text-sm opacity-90">
                          <p><strong>Alamat:</strong><br />{section.content.address}</p>
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
                              {(Array.isArray(section.content.openingHours) ? section.content.openingHours : []).map((h: string, i: number) => <li key={i}>{h}</li>)}
                            </ul>
                          </div>
                        </div>
                      </div>
                      <div className="p-10 md:w-3/5">
                        <h3 className="text-xl font-bold mb-6">{section.content.formConfig.heading}</h3>
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
                                <label className="block text-sm font-medium opacity-80 mb-1">{f.label}</label>
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

      <footer style={{ backgroundColor: colors.primary, color: "#fff" }} className="px-6 py-14 text-sm">
        <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[1.3fr_0.8fr_0.8fr_1fr]">
          <div>
            <button type="button" data-wv-tab={homePageId} onClick={() => changeTab(homePageId)} className="mb-4 flex items-center gap-3 text-left text-lg font-bold hover:opacity-85">
              {brand.logoSvg ? <span className="w-8 h-8 [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: brand.logoSvg }} /> : null}
              {isUsableImage(brand.logoImageUrl) ? <img src={brand.logoImageUrl} alt="" data-wv-image-role="logo" className="w-8 h-8 rounded-full object-cover" /> : null}
              <span>{meta.businessName}</span>
            </button>
            <p className="max-w-sm opacity-80">{businessProfile.shortPitch || meta.seoDescription || globalConfig.footer.text}</p>
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
                const label = item.title || item.label;
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

      {showProspectPanel && (
        <WebsiteActionPanel
          siteData={siteData}
          businessId={businessId}
          variant="public"
          onDownloadZip={onDownloadZip}
        />
      )}

      <style>{`
        @media print { .hide-in-export { display: none !important; } }
        ${siteStylePresetCss}
      `}</style>
    </div>
  );
}

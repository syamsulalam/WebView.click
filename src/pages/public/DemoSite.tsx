import { type PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, GripHorizontal, ShieldCheck, Shuffle, XCircle } from "lucide-react";
import templateSchema from "../../../JSON/template-schema.json";
import SiteRenderer from "../../components/SiteRenderer";
import WebsiteActionPanel from "../../components/WebsiteActionPanel";
import { downloadOwnerSiteZip } from "../../lib/exportSiteHtml";
import { fontPairingsForText, getFontPairing } from "../../lib/fontPairings";
import { applyGeneratedSitePageInserts } from "../../lib/generatedSitePostProcess";
import { getShaderPreset, siteShaderPresets, siteStylePresets } from "../../lib/siteStylePresets";

const demoIndustries = [
  {
    id: "cafe",
    label: "Cafe",
    businessName: "Maple & Main Coffee",
    typeLabel: "Neighborhood cafe",
    niche: "cafe",
    categories: ["cafe", "coffee shop", "bakery"],
    pitch: "Fresh coffee, baked goods, and a warm local spot for quick meetings or slow mornings.",
    address: "1420 Main Street, Austin, TX",
    services: ["Espresso Bar", "Fresh Pastries", "Catering Coffee Boxes"],
    styles: ["cafe-warm", "education-friendly", "pet-care-friendly"],
    shaders: ["cafe-heat", "local-aurora", "organic-dapple"],
  },
  {
    id: "contractor",
    label: "Contractor",
    businessName: "Summit Ridge Concrete",
    typeLabel: "Concrete contractor",
    niche: "concrete contractor",
    categories: ["concrete contractor", "driveway contractor", "foundation repair"],
    pitch: "Concrete driveways, patios, and repair work for homeowners who want a clean estimate and durable finish.",
    address: "780 Quarry Road, Denver, CO",
    services: ["Driveway Replacement", "Patio Concrete", "Foundation Repair"],
    styles: ["contractor-rugged", "auto-shop-steel", "security-trust"],
    shaders: ["industrial-grid", "property-depth", "local-aurora"],
  },
  {
    id: "professional",
    label: "Professional",
    businessName: "Northstar Tax & Advisory",
    typeLabel: "Tax and advisory firm",
    niche: "tax accountant",
    categories: ["tax accountant", "bookkeeping service", "financial consultant"],
    pitch: "Tax planning, bookkeeping, and advisory support for owners who need clear answers before deadlines.",
    address: "315 Market Street, Raleigh, NC",
    services: ["Business Tax Prep", "Monthly Bookkeeping", "Advisory Consultation"],
    styles: ["legal-authority", "financial-trust", "real-estate-premium"],
    shaders: ["legal-vellum", "property-depth", "none"],
  },
  {
    id: "salon",
    label: "Salon / Spa",
    businessName: "Velvet Room Med Spa",
    typeLabel: "Med spa and beauty studio",
    niche: "med spa",
    categories: ["med spa", "skin care clinic", "beauty salon"],
    pitch: "Polished skin and beauty treatments with a calm booking path and premium consultation feel.",
    address: "225 Palm Avenue, Scottsdale, AZ",
    services: ["Facial Treatments", "Skin Consultation", "Beauty Maintenance"],
    styles: ["salon-soft-luxe", "dental-clean", "real-estate-premium"],
    shaders: ["salon-silk", "aqua-caustics", "local-aurora"],
  },
  {
    id: "emergency",
    label: "Emergency",
    businessName: "RapidFlow Plumbing",
    typeLabel: "Emergency plumbing service",
    niche: "emergency plumber",
    categories: ["plumber", "emergency plumber", "water heater repair"],
    pitch: "Fast help for leaks, clogs, and urgent plumbing problems with a phone-first response path.",
    address: "98 Service Lane, Tampa, FL",
    services: ["Emergency Leak Repair", "Drain Clearing", "Water Heater Service"],
    styles: ["security-trust", "contractor-rugged", "cleaning-fresh"],
    shaders: ["industrial-grid", "aqua-caustics", "local-aurora"],
  },
  {
    id: "cleaning",
    label: "Cleaning",
    businessName: "BrightPath Cleaning Co.",
    typeLabel: "Residential and office cleaning",
    niche: "cleaning service",
    categories: ["cleaning service", "janitorial service", "maid service"],
    pitch: "Reliable home and office cleaning with checklist-friendly service options and simple booking.",
    address: "54 Brookline Avenue, Charlotte, NC",
    services: ["Recurring Home Cleaning", "Move-Out Cleaning", "Office Cleaning"],
    styles: ["cleaning-fresh", "pool-aqua", "dental-clean"],
    shaders: ["aqua-caustics", "local-aurora", "organic-dapple"],
  },
];

function pickSeeded<T>(items: T[], seed: number, fallback: T): T {
  if (!items.length) return fallback;
  return items[Math.abs(seed) % items.length] || fallback;
}

function demoPaletteForStyle(styleId: string) {
  return siteStylePresets.find((preset) => preset.id === styleId)?.recommendedColors || ["#111827", "#4F46E5", "#F8FAFC"];
}

function buildDemoIndustrySite(template: any, demo: typeof demoIndustries[number], nonce: number) {
  const site = structuredClone(template);
  const stylePreset = pickSeeded(demo.styles, nonce, demo.styles[0]);
  const shaderPreset = pickSeeded(demo.shaders, nonce + 1, demo.shaders[0]);
  const palette = demoPaletteForStyle(stylePreset);
  const businessId = `demo-${demo.id}`;
  const services = demo.services.map((title, index) => ({
    id: title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    type: "service",
    title,
    navLabel: title.split(/\s+/).slice(0, 2).join(" "),
    summary: `${title} for local customers who want a clear next step from ${demo.businessName}.`,
    description: `${demo.businessName} helps customers understand scope, timing, and the easiest way to get started with ${title.toLowerCase()}.`,
    priceHint: index === 0 ? "Request a clear estimate" : "Ask about availability",
    detailPageId: `service-${index + 1}`,
    bestFor: ["Local customers", "Clear next steps", "Service comparison"],
    included: ["Scope overview", "Next-step guidance", "Contact path"],
    highlights: [{ title: "Built around local intent", description: "The page keeps proof, service fit, and the primary action close together." }],
  }));
  site.meta = { ...(site.meta || {}), businessId, businessName: demo.businessName, niche: demo.niche, seoDescription: demo.pitch };
  site.businessProfile = { ...(site.businessProfile || {}), name: demo.businessName, typeLabel: demo.typeLabel, categories: demo.categories, shortPitch: demo.pitch };
  site.sourceData = { ...(site.sourceData || {}), name: demo.businessName, searchQuery: demo.niche, formattedAddress: demo.address, types: demo.categories, rating: 4.8, user_ratings_total: 127 };
  site.location = { ...(site.location || {}), formattedAddress: demo.address, servedAreas: ["Downtown", "North Side", "Nearby neighborhoods"] };
  site.trust = { ...(site.trust || {}), rating: 4.8, reviewCount: 127, reviewSummary: "Local customers mention clear communication and reliable service." };
  site.services = services;
  site.products = [];
  site.offers = services;
  site.brand = {
    ...(site.brand || {}),
    palette,
    paletteOptions: [
      { id: `${demo.id}-primary`, label: `${demo.label} palette`, colors: palette },
      ...(Array.isArray(site.brand?.paletteOptions) ? site.brand.paletteOptions : []),
    ],
  };
  site.design = {
    ...(site.design || {}),
    stylePreset,
    shaderPreset,
    themeVariables: {
      ...(site.design?.themeVariables || {}),
      colors: {
        ...(site.design?.themeVariables?.colors || {}),
        primary: palette[0],
        accent: palette[1],
        secondary: palette[2],
      },
    },
  };
  const home = Array.isArray(site.pages) ? site.pages.find((page: any) => page.pageId === "home") : null;
  const hero = Array.isArray(home?.sections) ? home.sections.find((section: any) => section.type === "hero") : null;
  if (hero) {
    hero.content = {
      ...(hero.content || {}),
      headline: `${demo.businessName} helps local customers choose the right next step`,
      subheadline: demo.pitch,
      buttons: [
        { text: demo.id === "emergency" ? "Call Now" : "Request a Consultation", href: "#contact", style: "primary" },
        { text: "View Services", href: "#services", style: "outline" },
      ],
    };
  }
  return site;
}

function emptyVisualQa() {
  return {
    navbar: {
      exists: false,
      compact: false,
      height: 0,
      heightOk: false,
      shadowBlur: 0,
      shadowOk: false,
      treatment: "",
      presetLayerOk: false,
      backdropBlur: 0,
      blurOk: false,
    },
    submenu: {
      count: 0,
      radius: 0,
      shadowBlur: 0,
      styleOk: false,
    },
    icons: {
      features: { count: 0, minSize: 0, sizeOk: false },
      trustBar: { count: 0, minSize: 0, sizeOk: false },
      hoursLocation: { count: 0, minSize: 0, sizeOk: false, relativeOk: false },
    },
  };
}

function maxShadowBlur(boxShadow: string) {
  const pxValues = Array.from(boxShadow.matchAll(/(-?\d+(?:\.\d+)?)px/g)).map((match) => Math.abs(Number(match[1])));
  const blurValues = pxValues.filter((_, index) => index % 4 === 2);
  return blurValues.length ? Math.max(...blurValues) : 0;
}

function cssBlurPx(value: string) {
  const match = value.match(/blur\((\d+(?:\.\d+)?)px\)/);
  return match ? Math.round(Number(match[1])) : 0;
}

function iconStats(group: "features" | "trustBar" | "hoursLocation", minExpectedSize: number) {
  const elements = Array.from(document.querySelectorAll<HTMLElement>(`[data-wv-qa-icon="${group}"]`));
  const sizes = elements
    .map((element) => {
      const rect = element.getBoundingClientRect();
      return Math.min(rect.width, rect.height);
    })
    .filter((size) => Number.isFinite(size) && size > 0);
  const minSize = sizes.length ? Math.round(Math.min(...sizes)) : 0;
  return {
    count: elements.length,
    minSize,
    sizeOk: elements.length > 0 && minSize >= minExpectedSize,
  };
}

export default function DemoSite() {
  const templateData = templateSchema as any;
  const [selectedDemoId, setSelectedDemoId] = useState("cafe");
  const [styleNonce, setStyleNonce] = useState(0);
  const selectedDemo = demoIndustries.find((item) => item.id === selectedDemoId) || demoIndustries[0];
  const baseSiteData = useMemo(() => buildDemoIndustrySite(templateData, selectedDemo, styleNonce), [selectedDemo, styleNonce, templateData]);
  const [selectedPreset, setSelectedPreset] = useState(baseSiteData.design?.stylePreset || "cafe-warm");
  const [selectedShaderPreset, setSelectedShaderPreset] = useState(baseSiteData.design?.shaderPreset || "cafe-heat");
  const fontOptions = fontPairingsForText([
    baseSiteData.meta?.businessName,
    baseSiteData.meta?.niche,
    baseSiteData.businessProfile?.typeLabel,
    Array.isArray(baseSiteData.businessProfile?.categories) ? baseSiteData.businessProfile.categories.join(" ") : "",
  ].filter(Boolean).join(" "), 5);
  const [selectedFontPairing, setSelectedFontPairing] = useState(baseSiteData.design?.fontPairing || fontOptions[0]?.id || "montserrat-raleway");
  const paletteOptions = Array.isArray(baseSiteData.brand?.paletteOptions) ? baseSiteData.brand.paletteOptions : [];
  const [selectedPaletteOption, setSelectedPaletteOption] = useState(paletteOptions[0]?.id || "");
  const [inspectorMinimized, setInspectorMinimized] = useState(false);
  const [inspectorPosition, setInspectorPosition] = useState({ x: 16, y: 92 });
  const [boundaryQaOpen, setBoundaryQaOpen] = useState(false);
  const [boundaryQa, setBoundaryQa] = useState({
    canvasFound: false,
    toolCount: 0,
    leakingToolCount: 0,
    actionPanelOutsideCanvas: false,
    inspectorOutsideCanvas: false,
    headerBoundaryFound: false,
    footerBoundaryFound: false,
    submenuOverlayCount: 0,
    submenuOverlaysOutsideHeader: false,
  });
  const [visualQa, setVisualQa] = useState(emptyVisualQa);
  const dragState = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const fontPairingMeta = getFontPairing(selectedFontPairing);
  const shaderPresetMeta = getShaderPreset(selectedShaderPreset);
  const activePaletteOption = paletteOptions.find((option: any) => option.id === selectedPaletteOption) || paletteOptions[0];
  const activePalette = Array.isArray(activePaletteOption?.colors) ? activePaletteOption.colors : baseSiteData.brand?.palette || [];
  const orderedPaletteOptions = activePaletteOption
    ? [activePaletteOption, ...paletteOptions.filter((option: any) => option.id !== activePaletteOption.id)]
    : paletteOptions;
  const siteData = {
    ...baseSiteData,
    design: {
      ...baseSiteData.design,
      stylePreset: selectedPreset,
      shaderPreset: selectedShaderPreset,
      shaderConfig: {
        ...(baseSiteData.design?.shaderConfig || {}),
        preset: selectedShaderPreset,
        label: shaderPresetMeta.label,
        description: shaderPresetMeta.description,
        defaultOpacity: shaderPresetMeta.defaultOpacity,
        defaultMotion: shaderPresetMeta.defaultMotion,
        allowedValues: siteShaderPresets.map((item) => item.id),
      },
      fontPairing: selectedFontPairing,
      fontPairingConfig: {
        ...(baseSiteData.design?.fontPairingConfig || {}),
        label: fontPairingMeta.label,
        headingFont: fontPairingMeta.headingFont,
        bodyFont: fontPairingMeta.bodyFont,
        mood: fontPairingMeta.mood,
        allowedValues: fontOptions.map((item) => item.id),
      },
      themeVariables: {
        ...(baseSiteData.design?.themeVariables || {}),
        typography: {
          ...(baseSiteData.design?.themeVariables?.typography || {}),
          headingFont: fontPairingMeta.headingCss,
          bodyFont: fontPairingMeta.bodyCss,
        },
        colors: {
          ...(baseSiteData.design?.themeVariables?.colors || {}),
          primary: activePalette[0] || baseSiteData.design?.themeVariables?.colors?.primary,
          accent: activePalette[1] || baseSiteData.design?.themeVariables?.colors?.accent,
          secondary: activePalette[2] || baseSiteData.design?.themeVariables?.colors?.secondary,
        },
      },
    },
    brand: {
      ...baseSiteData.brand,
      palette: activePalette,
      paletteOptions: orderedPaletteOptions,
    },
  };
  const panelSiteData = structuredClone(siteData);
  applyGeneratedSitePageInserts(panelSiteData, panelSiteData.sourceData || {});
  const pages = Array.isArray(panelSiteData?.pages) ? panelSiteData.pages : [];
  const sections = pages.flatMap((page: any) =>
    Array.isArray(page.sections) ? page.sections.map((section: any) => `${page.pageId}:${section.type}`) : [],
  );
  const missingFields = [
    !siteData?.meta ? "meta" : "",
    !siteData?.design?.themeVariables?.colors ? "design.themeVariables.colors" : "",
    !siteData?.design?.themeVariables?.typography && !siteData?.design?.typography ? "design.themeVariables.typography" : "",
    !siteData?.global?.header ? "global.header" : "",
    !siteData?.navigation?.headerMenu ? "navigation.headerMenu" : "",
    !Array.isArray(siteData?.pages) ? "pages[]" : "",
  ].filter(Boolean);

  useEffect(() => {
    const nextFontOptions = fontPairingsForText([
      baseSiteData.meta?.businessName,
      baseSiteData.meta?.niche,
      baseSiteData.businessProfile?.typeLabel,
      Array.isArray(baseSiteData.businessProfile?.categories) ? baseSiteData.businessProfile.categories.join(" ") : "",
    ].filter(Boolean).join(" "), 5);
    setSelectedPreset(baseSiteData.design?.stylePreset || selectedDemo.styles[0] || "local-clean");
    setSelectedShaderPreset(baseSiteData.design?.shaderPreset || selectedDemo.shaders[0] || "local-aurora");
    setSelectedFontPairing(nextFontOptions[styleNonce % Math.max(1, nextFontOptions.length)]?.id || baseSiteData.design?.fontPairing || "montserrat-raleway");
    setSelectedPaletteOption(baseSiteData.brand?.paletteOptions?.[0]?.id || "");
  }, [baseSiteData, selectedDemo, styleNonce]);

  const handleDownloadZip = async (downloadSiteData = panelSiteData) => {
    await downloadOwnerSiteZip(downloadSiteData, downloadSiteData?.meta?.businessId || "webview-demo");
  };

  useEffect(() => {
    if (!boundaryQaOpen) return;

    const inspectBoundary = () => {
      const canvas = document.querySelector("[data-wv-site-canvas]");
      const tools = Array.from(document.querySelectorAll("[data-wv-tool-ui]"));
      const leakingTools = canvas ? tools.filter((tool) => canvas.contains(tool)) : [];
      const actionPanel = document.querySelector("[data-wv-tool-ui='website-action-panel']");
      const inspector = document.querySelector("[data-wv-tool-ui='demo-inspector']");
      const navbar = document.querySelector<HTMLElement>("[data-wv-site-header]");
      const footer = document.querySelector<HTMLElement>("[data-wv-site-footer]");
      const submenus = Array.from(document.querySelectorAll<HTMLElement>("[data-wv-submenu]"));
      const navbarRect = navbar?.getBoundingClientRect();
      const navbarStyles = navbar ? window.getComputedStyle(navbar) : null;
      const navbarShadowBlur = navbarStyles ? maxShadowBlur(navbarStyles.boxShadow) : 0;
      const navbarCompact = navbar?.getAttribute("data-wv-header-compact") === "true";
      const headerTreatment = navbarStyles?.getPropertyValue("--wv-header-treatment").trim() || "";
      const headerBackdropBlur = navbarStyles ? cssBlurPx(navbarStyles.backdropFilter || navbarStyles.getPropertyValue("-webkit-backdrop-filter") || "") : 0;
      const headerBlurExpected = headerTreatment === "soft-glass" || headerTreatment === "warm-translucent";
      const submenuStyles = submenus[0] ? window.getComputedStyle(submenus[0]) : null;
      const submenuRadius = submenuStyles ? Math.round(Number.parseFloat(submenuStyles.borderTopLeftRadius) || 0) : 0;
      const submenuShadowBlur = submenuStyles ? maxShadowBlur(submenuStyles.boxShadow) : 0;
      const features = iconStats("features", 28);
      const trustBar = iconStats("trustBar", 28);
      const hoursLocation = iconStats("hoursLocation", 24);
      const firstHoursIcon = document.querySelector<HTMLElement>('[data-wv-qa-icon="hoursLocation"]');
      const firstHoursHeading = firstHoursIcon?.parentElement?.querySelector("h2");
      const hoursHeadingFontSize = firstHoursHeading ? Number.parseFloat(window.getComputedStyle(firstHoursHeading).fontSize) : 0;

      setBoundaryQa({
        canvasFound: Boolean(canvas),
        toolCount: tools.length,
        leakingToolCount: leakingTools.length,
        actionPanelOutsideCanvas: Boolean(canvas && actionPanel && !canvas.contains(actionPanel)),
        inspectorOutsideCanvas: Boolean(canvas && inspector && !canvas.contains(inspector)),
        headerBoundaryFound: Boolean(canvas && navbar && canvas.contains(navbar)),
        footerBoundaryFound: Boolean(canvas && footer && canvas.contains(footer)),
        submenuOverlayCount: submenus.length,
        submenuOverlaysOutsideHeader: submenus.length > 0 && submenus.every((submenu) => !navbar?.contains(submenu)),
      });
      setVisualQa({
        navbar: {
          exists: Boolean(navbar),
          compact: navbarCompact,
          height: Math.round(navbarRect?.height || 0),
          heightOk: Boolean(navbarRect && navbarRect.height <= (navbarCompact ? 60 : 76)),
          shadowBlur: Math.round(navbarShadowBlur),
          shadowOk: !navbar || navbarShadowBlur <= (navbarCompact ? 30 : 54),
          treatment: headerTreatment,
          presetLayerOk: Boolean(headerTreatment && navbarStyles?.getPropertyValue("--wv-header-bg").trim() && navbarStyles?.getPropertyValue("--wv-header-submenu-bg").trim()),
          backdropBlur: headerBackdropBlur,
          blurOk: Boolean(navbarStyles && (headerBlurExpected ? headerBackdropBlur > 0 : headerBackdropBlur === 0)),
        },
        submenu: {
          count: submenus.length,
          radius: submenuRadius,
          shadowBlur: Math.round(submenuShadowBlur),
          styleOk: Boolean(submenus.length && submenuRadius >= 6 && submenuShadowBlur >= 18),
        },
        icons: {
          features,
          trustBar,
          hoursLocation: {
            ...hoursLocation,
            relativeOk: Boolean(hoursLocation.minSize && hoursHeadingFontSize && hoursLocation.minSize >= Math.round(hoursHeadingFontSize * 0.9)),
          },
        },
      });
    };

    inspectBoundary();
    const timeout = window.setTimeout(inspectBoundary, 80);
    window.addEventListener("scroll", inspectBoundary, { passive: true });
    window.addEventListener("resize", inspectBoundary);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("scroll", inspectBoundary);
      window.removeEventListener("resize", inspectBoundary);
    };
  }, [boundaryQaOpen, inspectorMinimized, selectedFontPairing, selectedPaletteOption, selectedPreset, selectedShaderPreset]);

  const beginInspectorDrag = (event: PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("button, a, select")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragState.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: inspectorPosition.x,
      originY: inspectorPosition.y,
    };
  };

  const moveInspector = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragState.current) return;
    const maxX = Math.max(8, window.innerWidth - (inspectorMinimized ? 220 : 380));
    const maxY = Math.max(8, window.innerHeight - (inspectorMinimized ? 52 : 280));
    setInspectorPosition({
      x: Math.min(maxX, Math.max(8, dragState.current.originX + event.clientX - dragState.current.startX)),
      y: Math.min(maxY, Math.max(8, dragState.current.originY + event.clientY - dragState.current.startY)),
    });
  };

  const endInspectorDrag = () => {
    dragState.current = null;
  };

  return (
    <div className="relative">
      {boundaryQaOpen && (
        <style data-export-remove="true">{`
          [data-wv-site-canvas] {
            outline: 3px solid rgba(16, 185, 129, 0.85) !important;
            outline-offset: -3px !important;
          }

          [data-wv-tool-ui] {
            outline: 3px dashed rgba(99, 102, 241, 0.9) !important;
            outline-offset: 4px !important;
          }

          [data-wv-site-canvas] [data-wv-tool-ui] {
            outline: 4px solid rgba(220, 38, 38, 0.95) !important;
          }

          [data-wv-site-header] {
            outline: 3px solid rgba(245, 158, 11, 0.9) !important;
            outline-offset: -3px !important;
          }

          [data-wv-site-footer] {
            outline: 3px solid rgba(168, 85, 247, 0.9) !important;
            outline-offset: -3px !important;
          }

          [data-wv-site-submenu] {
            outline: 3px solid rgba(251, 146, 60, 0.9) !important;
            outline-offset: -3px !important;
          }

          [data-wv-qa-icon] {
            outline: 2px solid rgba(14, 165, 233, 0.9) !important;
            outline-offset: 3px !important;
          }
        `}</style>
      )}
      <div
        data-wv-tool-ui="demo-inspector"
        className={`hide-in-export fixed z-[200] rounded-2xl border border-slate-200 bg-white/95 text-sm text-slate-700 shadow-xl backdrop-blur ${inspectorMinimized ? "w-auto max-w-[min(220px,calc(100vw-1rem))] px-2 py-1.5" : "w-[min(360px,calc(100vw-2rem))] p-4"}`}
        style={{ left: inspectorPosition.x, top: inspectorPosition.y }}
        onPointerDown={beginInspectorDrag}
        onPointerMove={moveInspector}
        onPointerUp={endInspectorDrag}
        onPointerCancel={endInspectorDrag}
      >
        <div className={`flex items-start justify-between gap-3 ${inspectorMinimized ? "items-center" : ""}`}>
          <div className="flex min-w-0 items-start gap-2">
            <GripHorizontal size={16} className="mt-0.5 shrink-0 cursor-grab text-slate-400" />
            <div className="min-w-0">
            <p className="font-semibold text-slate-950">Demo JSON Sample</p>
            {!inspectorMinimized && <p className="text-xs text-slate-500 mt-1">Source: JSON/template-schema.json</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!inspectorMinimized && <a href="/admin/schema" className="text-xs font-medium text-indigo-700 hover:underline">Schema</a>}
            {!inspectorMinimized && (
              <button
                type="button"
                onClick={() => setBoundaryQaOpen((value) => !value)}
                className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold ${boundaryQaOpen ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
              >
                <ShieldCheck size={14} />
                QA
              </button>
            )}
            <button
              type="button"
              onClick={() => setInspectorMinimized((value) => !value)}
              className="rounded-lg border border-slate-200 p-1 text-slate-500 hover:bg-slate-50"
              aria-label={inspectorMinimized ? "Expand demo inspector" : "Minimize demo inspector"}
            >
              {inspectorMinimized ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>
          </div>
        </div>
        {inspectorMinimized ? (
          <p className="sr-only">{siteData.meta.businessName} · {sections.length} sections · {selectedPreset}</p>
        ) : (
          <>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-slate-50 border border-slate-100 p-2">
              <p className="text-slate-500">Business</p>
              <p className="font-medium text-slate-900 truncate">{siteData.meta.businessName}</p>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-100 p-2">
              <p className="text-slate-500">Sections</p>
              <p className="font-medium text-slate-900">{sections.length}</p>
            </div>
          </div>
          <label className="mt-3 block text-xs">
            <span className="mb-1 block font-medium text-slate-600">Industry demo</span>
            <div className="flex gap-2">
              <select
                value={selectedDemoId}
                onChange={(event) => {
                  setSelectedDemoId(event.target.value);
                  setStyleNonce((value) => value + 1);
                }}
                className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {demoIndustries.map((demo) => (
                  <option key={demo.id} value={demo.id}>{demo.label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setStyleNonce((value) => value + 1)}
                className="inline-flex items-center justify-center rounded-lg border border-indigo-200 px-2 text-indigo-700 hover:bg-indigo-50"
                aria-label="Randomize this industry style"
              >
                <Shuffle size={14} />
              </button>
            </div>
          </label>
          <label className="mt-3 block text-xs">
            <span className="mb-1 block font-medium text-slate-600">Style preset</span>
            <select
              value={selectedPreset}
              onChange={(event) => setSelectedPreset(event.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {siteStylePresets.map((preset) => (
                <option key={preset.id} value={preset.id}>{preset.label}</option>
              ))}
            </select>
          </label>
          <label className="mt-3 block text-xs">
            <span className="mb-1 block font-medium text-slate-600">Shader preset</span>
            <select
              value={selectedShaderPreset}
              onChange={(event) => setSelectedShaderPreset(event.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {siteShaderPresets.map((preset) => (
                <option key={preset.id} value={preset.id}>{preset.label}</option>
              ))}
            </select>
            <span className="mt-1 block text-[11px] text-slate-500">{shaderPresetMeta.description}</span>
          </label>
          {boundaryQaOpen && (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-slate-700">
              <p className="flex items-center gap-1.5 font-semibold text-emerald-900">
                <ShieldCheck size={14} />
                Visual QA checklist
              </p>
              <div className="mt-2 space-y-1.5">
                {[
                  ["Generated site canvas exists", boundaryQa.canvasFound],
                  ["Header boundary exists in canvas", boundaryQa.headerBoundaryFound],
                  ["Footer boundary exists in canvas", boundaryQa.footerBoundaryFound],
                  [`Submenu overlays outside header (${boundaryQa.submenuOverlayCount})`, boundaryQa.submenuOverlaysOutsideHeader],
                  [`Tool UI found outside canvas (${boundaryQa.toolCount})`, boundaryQa.toolCount > 0 && boundaryQa.leakingToolCount === 0],
                  ["Download/setup panel outside website CSS", boundaryQa.actionPanelOutsideCanvas],
                  ["Demo inspector outside website CSS", boundaryQa.inspectorOutsideCanvas],
                ].map(([label, passed]) => (
                  <p key={String(label)} className="flex items-center gap-2">
                    {passed ? <CheckCircle2 size={14} className="text-emerald-700" /> : <XCircle size={14} className="text-red-600" />}
                    <span>{label}</span>
                  </p>
                ))}
              </div>
              <div className="mt-3 border-t border-emerald-200 pt-2">
                <p className="font-semibold text-emerald-900">Navbar</p>
                <div className="mt-1.5 space-y-1.5">
                  {[
                    [`Preset header layer active (${visualQa.navbar.treatment || "none"})`, visualQa.navbar.exists && visualQa.navbar.presetLayerOk],
                    [`Height fits ${visualQa.navbar.compact ? "scrolled" : "top"} state (${visualQa.navbar.height}px)`, visualQa.navbar.exists && visualQa.navbar.heightOk],
                    [`Shadow fits ${visualQa.navbar.compact ? "scrolled" : "top"} state (${visualQa.navbar.shadowBlur}px blur)`, visualQa.navbar.exists && visualQa.navbar.shadowOk],
                    [`Blur matches treatment (${visualQa.navbar.backdropBlur}px)`, visualQa.navbar.exists && visualQa.navbar.blurOk],
                    [`Submenu uses header preset variables (${visualQa.submenu.count}, radius ${visualQa.submenu.radius}px, shadow ${visualQa.submenu.shadowBlur}px)`, visualQa.submenu.styleOk],
                  ].map(([label, passed]) => (
                    <p key={String(label)} className="flex items-center gap-2">
                      {passed ? <CheckCircle2 size={14} className="text-emerald-700" /> : <XCircle size={14} className="text-red-600" />}
                      <span>{label}</span>
                    </p>
                  ))}
                </div>
              </div>
              <div className="mt-3 border-t border-emerald-200 pt-2">
                <p className="font-semibold text-emerald-900">Icons</p>
                <div className="mt-1.5 space-y-1.5">
                  {[
                    [`Feature icons large enough (${visualQa.icons.features.count}, min ${visualQa.icons.features.minSize}px)`, visualQa.icons.features.sizeOk],
                    [`Trust bar icons large enough (${visualQa.icons.trustBar.count}, min ${visualQa.icons.trustBar.minSize}px)`, visualQa.icons.trustBar.sizeOk],
                    [`Hours/location icons large enough (${visualQa.icons.hoursLocation.count}, min ${visualQa.icons.hoursLocation.minSize}px)`, visualQa.icons.hoursLocation.sizeOk],
                    ["Hours/location icons track subheading size", visualQa.icons.hoursLocation.relativeOk],
                  ].map(([label, passed]) => (
                    <p key={String(label)} className="flex items-center gap-2">
                      {passed ? <CheckCircle2 size={14} className="text-emerald-700" /> : <XCircle size={14} className="text-red-600" />}
                      <span>{label}</span>
                    </p>
                  ))}
                </div>
              </div>
              <p className="mt-2 text-[11px] text-slate-500">Green outline is generated website. Blue dashed outline is WebView.click tool UI. Red means leakage.</p>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {sections.map((section: string) => (
              <span key={section} className="rounded-full bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-700">
                {section}
              </span>
            ))}
          </div>
          {missingFields.length > 0 && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <p className="font-semibold">JSON memakai fallback renderer</p>
              <p className="mt-1">Field hilang: {missingFields.join(", ")}</p>
            </div>
          )}
          </>
        )}
      </div>
      <SiteRenderer
        siteData={siteData}
        businessId={siteData.meta.businessId}
        showProspectPanel={false}
      />
      <WebsiteActionPanel
        siteData={panelSiteData}
        businessId={siteData.meta.businessId}
        variant="demo"
        onDownloadZip={handleDownloadZip}
        fontPairings={fontOptions}
        selectedFontPairing={selectedFontPairing}
        onFontPairingChange={setSelectedFontPairing}
        paletteOptions={paletteOptions}
        selectedPaletteOption={selectedPaletteOption}
        onPaletteOptionChange={setSelectedPaletteOption}
      />
    </div>
  );
}

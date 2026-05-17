import { type PointerEvent, useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, GripHorizontal, ShieldCheck, XCircle } from "lucide-react";
import templateSchema from "../../../JSON/template-schema.json";
import SiteRenderer from "../../components/SiteRenderer";
import WebsiteActionPanel from "../../components/WebsiteActionPanel";
import { downloadOwnerSiteZip } from "../../lib/exportSiteHtml";
import { fontPairingsForText, getFontPairing } from "../../lib/fontPairings";
import { getShaderPreset, siteShaderPresets, siteStylePresets } from "../../lib/siteStylePresets";

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
  const baseSiteData = templateSchema as any;
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
  const pages = Array.isArray(siteData?.pages) ? siteData.pages : [];
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

  const handleDownloadZip = async () => {
    await downloadOwnerSiteZip(siteData, siteData.meta?.businessId || "webview-demo");
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
        <style>{`
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
        siteData={siteData}
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

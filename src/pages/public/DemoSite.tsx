import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import templateSchema from "../../../JSON/template-schema.json";
import SiteRenderer from "../../components/SiteRenderer";
import WebsiteActionPanel from "../../components/WebsiteActionPanel";
import { downloadOwnerSiteZip } from "../../lib/exportSiteHtml";
import { siteStylePresets } from "../../lib/siteStylePresets";

export default function DemoSite() {
  const baseSiteData = templateSchema as any;
  const [selectedPreset, setSelectedPreset] = useState(baseSiteData.design?.stylePreset || "cafe-warm");
  const [inspectorMinimized, setInspectorMinimized] = useState(false);
  const siteData = {
    ...baseSiteData,
    design: {
      ...baseSiteData.design,
      stylePreset: selectedPreset,
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

  return (
    <div className="relative">
      <div className="hide-in-export fixed top-4 right-4 z-[200] w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white/95 backdrop-blur shadow-xl p-4 text-sm text-slate-700">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-slate-950">Demo JSON Sample</p>
            {!inspectorMinimized && <p className="text-xs text-slate-500 mt-1">Source: JSON/template-schema.json</p>}
          </div>
          <div className="flex items-center gap-2">
            {!inspectorMinimized && <a href="/admin/schema" className="text-xs font-medium text-indigo-700 hover:underline">Schema</a>}
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
          <p className="mt-2 text-xs text-slate-500">{siteData.meta.businessName} · {sections.length} sections · {selectedPreset}</p>
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
      />
    </div>
  );
}

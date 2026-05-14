import { useState } from "react";
import { saveAs } from "file-saver";
import JSZip from "jszip";
import { ArrowRight, Download, Globe2, Loader2, X } from "lucide-react";
import templateSchema from "../../../JSON/template-schema.json";
import SiteRenderer from "../../components/SiteRenderer";
import { siteStylePresets } from "../../lib/siteStylePresets";

export default function DemoSite() {
  const baseSiteData = templateSchema as any;
  const [selectedPreset, setSelectedPreset] = useState(baseSiteData.design?.stylePreset || "cafe-warm");
  const siteData = {
    ...baseSiteData,
    design: {
      ...baseSiteData.design,
      stylePreset: selectedPreset,
    },
  };
  const [panelOpen, setPanelOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [domain, setDomain] = useState("");
  const [email, setEmail] = useState("");
  const [checkoutStatus, setCheckoutStatus] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
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
    const zip = new JSZip();
    const htmlContent = document.documentElement.outerHTML.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
    zip.file("index.html", `<!doctype html>\n<html lang="${siteData.meta?.language || "id"}">\n${htmlContent}\n</html>`);
    zip.file("site-data.json", JSON.stringify(siteData, null, 2));
    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, `${siteData.meta?.businessId || "webview-demo"}-website.zip`);
  };

  const handleCheckout = async () => {
    setCheckoutLoading(true);
    setCheckoutStatus("Preparing checkout...");
    try {
      const response = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: siteData.meta?.businessId || "demo-site",
          businessName: siteData.meta?.businessName || "Demo Site",
          domain,
          email,
        }),
      });
      const data = await response.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      setCheckoutStatus(data.message || "Checkout request saved. Payment is still in mock mode.");
      if (data.adminNotifyUrl) {
        window.open(data.adminNotifyUrl, "_blank");
      }
    } catch (error) {
      console.error(error);
      setCheckoutStatus("Checkout request failed. Please try again.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <div className="relative">
      <div className="fixed top-4 right-4 z-[200] w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white/95 backdrop-blur shadow-xl p-4 text-sm text-slate-700">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-slate-950">Demo JSON Sample</p>
            <p className="text-xs text-slate-500 mt-1">Source: JSON/template-schema.json</p>
          </div>
          <a href="/admin/schema" className="text-xs font-medium text-indigo-700 hover:underline">Schema</a>
        </div>
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
      </div>
      <SiteRenderer
        siteData={siteData}
        businessId={siteData.meta.businessId}
        showProspectPanel={false}
      />
      <div className="fixed bottom-5 right-5 z-[210]">
        {panelOpen && (
          <div className="mb-3 w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <p className="font-semibold text-slate-950">Get this website</p>
              <button type="button" onClick={() => setPanelOpen(false)} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <button
                type="button"
                onClick={handleDownloadZip}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left hover:bg-slate-100"
              >
                <span>
                  <span className="block font-semibold text-slate-950">Download Free</span>
                  <span className="block text-xs text-slate-500">Static HTML + JSON, Google photos stay hotlinked/proxied.</span>
                </span>
                <Download size={18} />
              </button>
              <button
                type="button"
                onClick={() => setCheckoutOpen(true)}
                className="flex w-full items-center justify-between rounded-xl bg-indigo-600 px-4 py-3 text-left text-white hover:bg-indigo-700"
              >
                <span>
                  <span className="block font-semibold">$197 Domain + Hosting</span>
                  <span className="block text-xs text-indigo-100">$15/month x 12 months + free setup.</span>
                </span>
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => setPanelOpen((value) => !value)}
          className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-2xl hover:bg-slate-800"
        >
          <Download size={18} />
          Download / Setup
        </button>
      </div>

      {checkoutOpen && (
        <div className="fixed inset-0 z-[240] flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <p className="font-semibold text-slate-950">Domain + Hosting Setup</p>
                <p className="text-xs text-slate-500">$197 total: domain 1 year, hosting 1 year, free setup.</p>
              </div>
              <button type="button" onClick={() => setCheckoutOpen(false)} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Desired domain</span>
                <div className="relative">
                  <Globe2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    value={domain}
                    onChange={(event) => setDomain(event.target.value)}
                    placeholder="examplebusiness.com"
                    className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Email</span>
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </label>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                Lemon Squeezy checkout will open automatically when API key, store ID, and variant ID are configured in admin settings. Until then this records a mock checkout request.
              </div>
              {checkoutStatus && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{checkoutStatus}</div>}
              <button
                type="button"
                onClick={handleCheckout}
                disabled={checkoutLoading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {checkoutLoading ? <Loader2 className="animate-spin" size={18} /> : <ArrowRight size={18} />}
                Continue to payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

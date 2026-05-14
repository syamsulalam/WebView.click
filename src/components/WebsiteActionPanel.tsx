import { useState } from "react";
import { ArrowRight, CircleHelp, Download, Globe2, Loader2, X } from "lucide-react";
import { buildDomain, domainExtensions, normalizeDomainLabel } from "../lib/domainExtensions";

type WebsiteActionPanelProps = {
  siteData: any;
  businessId?: string;
  variant: "demo" | "public";
  onDownloadZip?: () => void;
};

function InfoTooltip({ text, light = false }: { text: string; light?: boolean }) {
  return (
    <span className="group relative inline-flex">
      <CircleHelp size={15} className={light ? "text-indigo-100" : "text-slate-400"} />
      <span className="pointer-events-none absolute bottom-full right-0 z-20 mb-2 w-64 rounded-xl bg-slate-950 px-3 py-2 text-xs leading-relaxed text-white opacity-0 shadow-xl transition group-hover:opacity-100">
        {text}
      </span>
    </span>
  );
}

export default function WebsiteActionPanel({ siteData, businessId = "demo-site", variant, onDownloadZip }: WebsiteActionPanelProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [domainLabel, setDomainLabel] = useState(normalizeDomainLabel(siteData?.meta?.businessName || businessId));
  const [selectedTld, setSelectedTld] = useState(".com");
  const [extensionQuery, setExtensionQuery] = useState("");
  const [email, setEmail] = useState("");
  const [checkoutStatus, setCheckoutStatus] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [domainCheckLoading, setDomainCheckLoading] = useState(false);
  const [domainCheck, setDomainCheck] = useState<any>(null);

  const selectedDomain = buildDomain(domainLabel, selectedTld);
  const filteredExtensions = domainExtensions.filter((extension) => {
    const query = extensionQuery.toLowerCase().replace(/^\./, "");
    return !query || extension.tld.includes(query) || extension.category.toLowerCase().includes(query);
  });
  const groupedExtensions = filteredExtensions.reduce<Record<string, typeof domainExtensions>>((groups, extension) => {
    groups[extension.category] = [...(groups[extension.category] || []), extension];
    return groups;
  }, {});

  const handleCheckout = async () => {
    setCheckoutLoading(true);
    setCheckoutStatus("Preparing checkout...");
    try {
      const response = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: siteData?.meta?.businessId || businessId,
          businessName: siteData?.meta?.businessName || "Demo Site",
          domain: selectedDomain,
          email,
        }),
      });
      const data = await response.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      setCheckoutStatus(data.message || "Checkout request saved. We will follow up for setup.");
      if (data.adminNotifyUrl) window.open(data.adminNotifyUrl, "_blank");
    } catch (error) {
      console.error(error);
      setCheckoutStatus("Checkout request failed. Please try again.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleCheckDomain = async () => {
    setDomainCheckLoading(true);
    setDomainCheck(null);
    try {
      const response = await fetch(`/api/domains/check?domain=${encodeURIComponent(selectedDomain)}`);
      setDomainCheck(await response.json());
    } catch (error) {
      console.error(error);
      setDomainCheck({ status: "error", message: "Domain check failed. We can still confirm availability during setup." });
    } finally {
      setDomainCheckLoading(false);
    }
  };

  const panelPosition = variant === "demo"
    ? "fixed bottom-5 right-5 z-[210]"
    : "fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 hide-in-export";

  return (
    <>
      <div className={panelPosition}>
        {panelOpen && (
          <div className="mb-3 w-[min(380px,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <p className="font-semibold text-slate-950">Get this website</p>
              <button type="button" onClick={() => setPanelOpen(false)} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3 p-4">
              {onDownloadZip && (
                <button
                  type="button"
                  onClick={onDownloadZip}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left hover:bg-slate-100"
                >
                  <span>
                    <span className="flex items-center gap-1.5 font-semibold text-slate-950">
                      Download your free site
                      <InfoTooltip text="You receive the static site files. You can upload them to your own hosting provider and point your own domain yourself." />
                    </span>
                    <span className="block text-xs text-slate-500">Host it yourself and point your own domain.</span>
                  </span>
                  <Download size={18} />
                </button>
              )}
              <button
                type="button"
                onClick={() => setCheckoutOpen(true)}
                className="flex w-full items-center justify-between rounded-xl bg-indigo-600 px-4 py-3 text-left text-white hover:bg-indigo-700"
              >
                <span>
                  <span className="flex items-center gap-1.5 font-semibold">
                    Done-for-you website setup
                    <InfoTooltip light text="We handle domain purchase, hosting purchase, site upload, DNS pointing, and setup. The $197/year includes a $17/year domain allowance and $180/year hosting." />
                  </span>
                  <span className="block text-xs text-indigo-100">$197/year: domain + hosting + setup handled for you.</span>
                </span>
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => setPanelOpen((value) => !value)}
          className={variant === "demo"
            ? "inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-2xl hover:bg-slate-800"
            : "inline-flex items-center gap-3 rounded-full border border-gray-200 bg-white/90 px-6 py-4 text-sm font-semibold text-gray-900 shadow-2xl backdrop-blur-md hover:bg-white"}
        >
          <Download size={18} />
          {variant === "demo" ? "Download / Setup" : "Download / Setup ($197/year)"}
        </button>
      </div>

      {checkoutOpen && (
        <div className="fixed inset-0 z-[240] flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <p className="font-semibold text-slate-950">Done-for-you website setup</p>
                <p className="text-xs text-slate-500">$197/year total. We buy and connect the domain, hosting, and site for you.</p>
              </div>
              <button type="button" onClick={() => setCheckoutOpen(false)} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <p><strong>$17/year domain allowance</strong> for the extension you choose.</p>
                <p><strong>$180/year hosting</strong> ($15/month x 12 months).</p>
                <p><strong>Free setup</strong>: we buy the domain, buy hosting, upload the site, connect DNS, and point hosting to the domain.</p>
              </div>
              <div className="grid grid-cols-[1fr_128px] gap-2">
                <div className="relative">
                  <Globe2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    value={domainLabel}
                    onChange={(event) => {
                      setDomainLabel(normalizeDomainLabel(event.target.value));
                      setDomainCheck(null);
                    }}
                    placeholder="examplebusiness"
                    className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <select
                  value={selectedTld}
                  onChange={(event) => {
                    setSelectedTld(event.target.value);
                    setDomainCheck(null);
                  }}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {domainExtensions.map((extension) => <option key={extension.tld} value={extension.tld}>{extension.tld}</option>)}
                </select>
              </div>
              <input
                value={extensionQuery}
                onChange={(event) => setExtensionQuery(event.target.value)}
                placeholder="Filter extensions, e.g. com, business, budget"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="max-h-40 space-y-3 overflow-y-auto pr-1">
                {Object.entries(groupedExtensions).map(([category, extensions]) => (
                  <div key={category}>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{category}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {extensions.map((extension) => (
                        <button
                          type="button"
                          key={extension.tld}
                          onClick={() => {
                            setSelectedTld(extension.tld);
                            setDomainCheck(null);
                          }}
                          className={`rounded-full border px-2.5 py-1 text-xs font-medium ${selectedTld === extension.tld ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}
                        >
                          {extension.tld}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
                <div>
                  <p className="font-semibold text-slate-950">{selectedDomain}</p>
                  <p className="text-xs text-slate-500">Availability is a pre-check; final confirmation happens during purchase.</p>
                </div>
                <button type="button" onClick={handleCheckDomain} disabled={domainCheckLoading || !domainLabel} className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
                  {domainCheckLoading ? "Checking..." : "Check"}
                </button>
              </div>
              {domainCheck && (
                <div className={`rounded-xl border p-3 text-sm ${
                  domainCheck.available === true
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : domainCheck.available === false
                      ? "border-red-200 bg-red-50 text-red-800"
                      : "border-amber-200 bg-amber-50 text-amber-900"
                }`}>
                  <p className="font-semibold">{domainCheck.message || domainCheck.status}</p>
                  {domainCheck.provider && <p className="mt-1 text-xs opacity-75">Checked via {domainCheck.provider}. Final registration is confirmed during purchase.</p>}
                </div>
              )}
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email for setup updates"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                Lemon Squeezy checkout opens when API key, store ID, and variant ID are configured. Until then this records a mock checkout request.
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
    </>
  );
}

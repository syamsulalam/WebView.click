import { useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, CircleHelp, Copy, Download, ExternalLink, Globe2, Loader2, X } from "lucide-react";
import { buildDomain, domainExtensions, normalizeDomainLabel } from "../lib/domainExtensions";
import type { FontPairing } from "../lib/fontPairings";

type WebsiteActionPanelProps = {
  siteData: any;
  businessId?: string;
  variant: "demo" | "public";
  onDownloadZip?: (siteData?: any) => void;
  fontPairings?: FontPairing[];
  selectedFontPairing?: string;
  onFontPairingChange?: (id: string) => void;
  paletteOptions?: any[];
  selectedPaletteOption?: string;
  onPaletteOptionChange?: (id: string) => void;
};

type DomainMode = "new" | "owned";
type SetupStep = "choice" | "domain" | "payment";

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

function normalizeFullDomain(value: string) {
  return value
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .replace(/[^a-z0-9.-]+/g, "")
    .replace(/^\.+|\.+$/g, "");
}

export default function WebsiteActionPanel({
  siteData,
  businessId = "demo-site",
  variant,
  onDownloadZip,
  fontPairings = [],
  selectedFontPairing = "",
  onFontPairingChange,
  paletteOptions = [],
  selectedPaletteOption = "",
  onPaletteOptionChange,
}: WebsiteActionPanelProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [setupStep, setSetupStep] = useState<SetupStep>("choice");
  const [domainMode, setDomainMode] = useState<DomainMode>("new");
  const [domainLabel, setDomainLabel] = useState(normalizeDomainLabel(siteData?.meta?.businessName || businessId));
  const [ownedDomain, setOwnedDomain] = useState("");
  const [selectedTld, setSelectedTld] = useState(".com");
  const [extensionQuery, setExtensionQuery] = useState("");
  const [email, setEmail] = useState("");
  const [checkoutStatus, setCheckoutStatus] = useState("");
  const [checkoutDetails, setCheckoutDetails] = useState<any>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [domainCheckLoading, setDomainCheckLoading] = useState(false);
  const [domainCheck, setDomainCheck] = useState<any>(null);

  const selectedDomain = domainMode === "owned" ? normalizeFullDomain(ownedDomain) : buildDomain(domainLabel, selectedTld);
  const filteredExtensions = domainExtensions.filter((extension) => {
    const query = extensionQuery.toLowerCase().replace(/^\./, "");
    return !query || extension.tld.includes(query) || extension.category.toLowerCase().includes(query);
  });
  const selectedExtension = domainExtensions.find((extension) => extension.tld === selectedTld);
  const visibleExtensions = selectedExtension && !filteredExtensions.some((extension) => extension.tld === selectedTld)
    ? [selectedExtension, ...filteredExtensions]
    : filteredExtensions;
  const extensionCategories = Array.from(new Set(visibleExtensions.map((extension) => extension.category)));
  const ownedDomainLooksUsable = domainMode === "owned" && (
    domainCheck?.available === false ||
    domainCheck?.status === "registered" ||
    domainCheck?.status === "dns_exists" ||
    domainCheck?.fallback?.status === "dns_exists"
  );
  const newDomainLooksAvailable = domainMode === "new" && domainCheck?.available === true;
  const domainReady = ownedDomainLooksUsable || newDomainLooksAvailable;
  const canContinue = domainMode === "owned"
    ? Boolean(selectedDomain && ownedDomainLooksUsable)
    : newDomainLooksAvailable;

  const resetCheck = () => {
    setDomainCheck(null);
    setCheckoutStatus("");
    setCheckoutDetails(null);
  };

  const openSetup = (mode: DomainMode) => {
    setDomainMode(mode);
    setSetupStep("domain");
    resetCheck();
  };

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
          domainMode,
          domainCheck,
          email,
        }),
      });
      const data = await response.json();
      if (data.checkoutUrl && !data.requiresManualReview) {
        window.location.href = data.checkoutUrl;
        return;
      }
      if (data.checkoutUrl) {
        setCheckoutDetails(data);
        setSetupStep("payment");
        setCheckoutStatus("");
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

  const copyPaymentReference = async () => {
    const reference = String(checkoutDetails?.paymentReference || "");
    if (!reference) return;
    try {
      await navigator.clipboard.writeText(reference);
      setCheckoutStatus("Payment reference copied.");
    } catch {
      setCheckoutStatus("Could not copy automatically. Select and copy the reference manually.");
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
      setDomainCheck({ status: "error", available: null, message: "Domain check failed. We can still confirm availability during setup." });
    } finally {
      setDomainCheckLoading(false);
    }
  };

  const panelPosition = variant === "demo"
    ? "fixed bottom-5 right-5 z-[210] hide-in-export"
    : "fixed bottom-5 right-5 z-[100] hide-in-export";

  return (
    <>
      <div className={panelPosition} data-wv-tool-ui="website-action-panel">
        {panelOpen && (
          <div className="mb-3 w-[min(380px,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <p className="font-semibold text-slate-950">Get this website</p>
              <button type="button" onClick={() => setPanelOpen(false)} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3 p-4">
              {fontPairings.length > 1 && onFontPairingChange && (
                <label className="block rounded-xl border border-slate-200 bg-white p-3">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-950">
                    Font style
                    <InfoTooltip text="Choose an industry-matched font pairing before download. The exported HTML keeps the selected look." />
                  </span>
                  <select
                    value={selectedFontPairing}
                    onChange={(event) => onFontPairingChange(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {fontPairings.map((pairing) => (
                      <option key={pairing.id} value={pairing.id}>
                        {pairing.label}
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 block text-xs text-slate-500">
                    {fontPairings.find((pairing) => pairing.id === selectedFontPairing)?.mood || fontPairings[0]?.mood}
                  </span>
                </label>
              )}
              {paletteOptions.length > 0 && onPaletteOptionChange && (
                <label className="block rounded-xl border border-slate-200 bg-white p-3">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-950">
                    Color palette
                    <InfoTooltip text="Choose a palette extracted from business photos before download. The exported HTML keeps the selected colors." />
                  </span>
                  <select
                    value={selectedPaletteOption}
                    onChange={(event) => onPaletteOptionChange(event.target.value)}
                    disabled={paletteOptions.length < 2}
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {paletteOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label || option.id}
                      </option>
                    ))}
                  </select>
                  <span className="mt-2 flex overflow-hidden rounded-full border border-slate-200">
                    {(paletteOptions.find((option) => option.id === selectedPaletteOption)?.colors || paletteOptions[0]?.colors || []).slice(0, 5).map((color: string) => (
                      <span key={color} className="h-5 flex-1" style={{ backgroundColor: color }} />
                    ))}
                  </span>
                  {paletteOptions.length < 2 && (
                    <span className="mt-1 block text-xs text-slate-500">Only one saved palette is available for this site.</span>
                  )}
                </label>
              )}
              {onDownloadZip && (
                <button
                  type="button"
                  onClick={() => onDownloadZip(siteData)}
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
                onClick={() => {
                  setCheckoutOpen(true);
                  setSetupStep("choice");
                  setCheckoutDetails(null);
                  setCheckoutStatus("");
                }}
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
          Download / Setup
        </button>
      </div>

      {checkoutOpen && (
        <div className="fixed inset-0 z-[240] flex items-center justify-center bg-slate-950/50 p-4" data-wv-tool-ui="website-checkout-modal">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <p className="font-semibold text-slate-950">Done-for-you website setup</p>
                <p className="text-xs text-slate-500">$197/year total. We buy/connect the domain, hosting, and site.</p>
              </div>
              <button type="button" onClick={() => setCheckoutOpen(false)} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4 p-5">
              {setupStep === "choice" && (
                <>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                    <p><strong>$17/year domain allowance</strong> if we register a new domain.</p>
                    <p><strong>$180/year hosting</strong> ($15/month x 12 months).</p>
                    <p><strong>Free setup</strong>: upload site, connect DNS, and point hosting.</p>
                    <a href="/terms-refund" target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs font-semibold text-indigo-700 hover:underline">
                      Terms and refund policy
                    </a>
                  </div>
                  <button type="button" onClick={() => openSetup("new")} className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-left hover:bg-slate-50">
                    <span>
                      <span className="block font-semibold text-slate-950">Register a new domain</span>
                      <span className="block text-xs text-slate-500">Choose an extension, check availability, then continue.</span>
                    </span>
                    <ArrowRight size={18} />
                  </button>
                  <button type="button" onClick={() => openSetup("owned")} className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-left hover:bg-slate-50">
                    <span>
                      <span className="block font-semibold text-slate-950">I already own a domain</span>
                      <span className="block text-xs text-slate-500">Enter your domain. We will help point it to Cloudflare/hosting.</span>
                    </span>
                    <ArrowRight size={18} />
                  </button>
                </>
              )}

              {setupStep === "domain" && (
                <>
                  <button type="button" onClick={() => setSetupStep("choice")} className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900">
                    <ArrowLeft size={16} />
                    Back
                  </button>

                  {domainMode === "new" ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-[minmax(0,1fr)_106px_68px] gap-2">
                        <div className="relative min-w-0">
                          <Globe2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                          <input
                            value={domainLabel}
                            onChange={(event) => {
                              setDomainLabel(normalizeDomainLabel(event.target.value));
                              resetCheck();
                            }}
                            placeholder="examplebusiness"
                            className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <select
                          value={selectedTld}
                          onChange={(event) => {
                            setSelectedTld(event.target.value);
                            resetCheck();
                          }}
                          className="w-full min-w-0 rounded-xl border border-slate-300 px-2 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          {extensionCategories.map((category) => (
                            <optgroup key={category} label={category}>
                              {visibleExtensions.filter((extension) => extension.category === category).map((extension) => (
                                <option key={extension.tld} value={extension.tld}>{extension.tld}</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                        <button type="button" onClick={handleCheckDomain} disabled={domainCheckLoading || !domainLabel} className="rounded-xl bg-slate-950 px-3 py-2.5 text-xs font-semibold text-white disabled:opacity-50">
                          {domainCheckLoading ? "..." : "Check"}
                        </button>
                      </div>
                      <details className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <summary className="cursor-pointer text-xs font-semibold text-slate-600">Filter extensions</summary>
                        <input
                          value={extensionQuery}
                          onChange={(event) => setExtensionQuery(event.target.value)}
                          placeholder="Search .com, business, budget"
                          className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        {extensionQuery && filteredExtensions.length === 0 && (
                          <p className="mt-2 text-xs text-amber-700">No matching extension. The current selected extension stays available.</p>
                        )}
                      </details>
                    </div>
                  ) : (
                    <div className="grid grid-cols-[1fr_86px] gap-2">
                      <input
                        value={ownedDomain}
                        onChange={(event) => {
                          setOwnedDomain(normalizeFullDomain(event.target.value));
                          resetCheck();
                        }}
                        placeholder="yourdomain.com"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button type="button" onClick={handleCheckDomain} disabled={domainCheckLoading || !selectedDomain} className="rounded-xl bg-slate-950 px-3 py-2.5 text-xs font-semibold text-white disabled:opacity-50">
                        {domainCheckLoading ? "..." : "Check"}
                      </button>
                    </div>
                  )}

                  <div className="rounded-xl border border-slate-200 p-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-950">{selectedDomain || "Enter a domain"}</p>
                        <p className="text-xs text-slate-500">Availability/registrar check is a pre-check; final confirmation happens during setup.</p>
                      </div>
                      {domainReady && <CheckCircle2 className="shrink-0 text-emerald-600" size={20} />}
                    </div>
                    {domainCheck && (
                      <div className={`mt-3 rounded-lg border p-3 ${
                        domainReady
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : domainCheck.available === false || domainCheck.status === "error"
                            ? "border-red-200 bg-red-50 text-red-800"
                            : "border-amber-200 bg-amber-50 text-amber-900"
                      }`}>
                        <p className="font-semibold">{domainCheck.message || domainCheck.status}</p>
                        {domainMode === "owned" && domainCheck.available === true && (
                          <p className="mt-2 text-xs">
                            This domain looks unregistered. If you already own it, check the spelling or enter the domain currently visible in your registrar account.
                          </p>
                        )}
                        {domainMode === "owned" && domainCheck.available !== true && (
                          <p className="mt-2 text-xs">
                            During setup, we will ask you to change nameservers to our Cloudflare nameservers, or add DNS records we provide if you prefer keeping your current nameservers.
                          </p>
                        )}
                        {domainCheck.registrar && <p className="mt-1 text-xs opacity-80">Registrar signal: {domainCheck.registrar}</p>}
                        {Array.isArray(domainCheck.nameservers) && domainCheck.nameservers.length > 0 && (
                          <p className="mt-1 text-xs opacity-80">Current nameservers: {domainCheck.nameservers.slice(0, 3).join(", ")}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {canContinue && (
                    <>
                      <input
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="Email for setup updates"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                        Secure checkout opens when the selected payment processor is configured. Until then this records a mock checkout request for follow-up.
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
                    </>
                  )}
                </>
              )}

              {setupStep === "payment" && checkoutDetails && (
                <>
                  <button type="button" onClick={() => setSetupStep("domain")} className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900">
                    <ArrowLeft size={16} />
                    Back
                  </button>
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    <p className="font-semibold">{checkoutDetails.processor === "paypal" ? "PayPal payment note" : "Manual payment note"}</p>
                    <p className="mt-1 text-xs leading-relaxed">
                      {checkoutDetails.paymentInstructions || "Include the business name, requested domain, and payment reference so we can match the payment quickly."}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payment reference</p>
                    <div className="mt-1 flex items-center gap-2">
                      <code className="min-w-0 flex-1 break-all rounded-lg bg-white px-2 py-1 text-xs text-slate-900">{checkoutDetails.paymentReference || selectedDomain}</code>
                      <button type="button" onClick={copyPaymentReference} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-100" aria-label="Copy payment reference">
                        <Copy size={15} />
                      </button>
                    </div>
                  </div>
                  {checkoutDetails.riskWarning && (
                    <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs leading-relaxed text-slate-600">
                      {checkoutDetails.riskWarning}
                    </div>
                  )}
                  {checkoutStatus && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{checkoutStatus}</div>}
                  <a
                    href={checkoutDetails.checkoutUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700"
                  >
                    <ExternalLink size={18} />
                    Open payment link
                  </a>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

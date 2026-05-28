import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, CheckCircle2, CircleHelp, Copy, Download, ExternalLink, Globe2, Loader2, Minus, Plus, X } from "lucide-react";
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
type SetupMode = "base" | "addons";
type SetupStep = "offer" | "plan" | "addons-count" | "addons-details" | "domain" | "payment";
type BillingCadence = "upfront" | "annual_recurring";
type EditPageRequest = { pageId: string; notes: string };

declare global {
  interface Window {
    paypal?: {
      Buttons: (options: Record<string, unknown>) => { render: (selectorOrElement: string | HTMLElement) => Promise<void> };
    };
  }
}

function InfoTooltip({ text, light = false }: { text: string; light?: boolean }) {
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const tooltipRef = useRef<HTMLSpanElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0, placement: "top" as "top" | "bottom" });

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const tooltipWidth = tooltipRef.current?.offsetWidth || 256;
    const tooltipHeight = tooltipRef.current?.offsetHeight || 96;
    const sideMargin = 12;
    const minLeft = tooltipWidth / 2 + sideMargin;
    const maxLeft = window.innerWidth - tooltipWidth / 2 - sideMargin;
    const anchorCenter = rect.left + rect.width / 2;
    const hasRoomAbove = rect.top > tooltipHeight + 12;
    const placement = hasRoomAbove ? "top" : "bottom";

    setPosition({
      left: Math.min(Math.max(anchorCenter, minLeft), Math.max(minLeft, maxLeft)),
      top: placement === "top" ? rect.top - 8 : rect.bottom + 8,
      placement,
    });
  }, []);

  const show = () => {
    updatePosition();
    setVisible(true);
  };

  useEffect(() => {
    if (!visible) return;
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [visible, updatePosition]);

  return (
    <span
      ref={anchorRef}
      className="inline-flex"
      onMouseEnter={show}
      onMouseLeave={() => setVisible(false)}
      onFocus={show}
      onBlur={() => setVisible(false)}
    >
      <CircleHelp size={15} className={light ? "text-indigo-100" : "text-slate-400"} />
      {visible && typeof document !== "undefined" && createPortal(
        <span
          ref={tooltipRef}
          role="tooltip"
          className={`pointer-events-none fixed z-[100001] w-64 -translate-x-1/2 rounded-xl bg-slate-950 px-3 py-2 text-xs leading-relaxed text-white opacity-100 shadow-2xl ${position.placement === "top" ? "-translate-y-full" : ""}`}
          style={{ left: position.left, top: position.top }}
        >
          {text}
        </span>,
        document.body,
      )}
    </span>
  );
}

function normalizeFullDomain(value: string) {
  return sanitizeOwnedDomainInput(value)
    .replace(/\.+$/g, "");
}

function sanitizeOwnedDomainInput(value: string) {
  return value
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .replace(/[^a-z0-9.-]+/g, "")
    .replace(/^\.+/g, "");
}

function addOnDiscountRate(totalPageActions: number) {
  if (totalPageActions >= 10) return 0.2;
  if (totalPageActions >= 5) return 0.1;
  return 0;
}

function termDiscountRate(years: number) {
  if (years >= 10) return 0.5;
  if (years >= 2) return Math.min(0.4, (years - 1) * 0.05);
  return 0;
}

function checkoutEstimate(newPages: number, editedPages: number, termYears = 1, billingCadence: BillingCadence = "upfront", domainMode: DomainMode = "new") {
  const hostingAnnual = 180;
  const domainAnnual = domainMode === "new" ? 17 : 0;
  const baseAnnual = hostingAnnual + domainAnnual;
  const unit = 10;
  const years = Math.max(1, Math.min(10, Math.floor(termYears) || 1));
  const planDiscountRate = termDiscountRate(years);
  const hostingAfterDiscount = Math.round(hostingAnnual * (1 - planDiscountRate) * 100) / 100;
  const annualAfterDiscount = hostingAfterDiscount + domainAnnual;
  const packageDueToday = billingCadence === "annual_recurring" ? annualAfterDiscount : annualAfterDiscount * years;
  const packageTermTotal = annualAfterDiscount * years;
  const packageSavings = Math.round((hostingAnnual * years - hostingAfterDiscount * years) * 100) / 100;
  const totalPageActions = Math.max(0, newPages) + Math.max(0, editedPages);
  const discountRate = addOnDiscountRate(totalPageActions);
  const addOnGross = totalPageActions * unit;
  const addOnDiscount = Math.round(addOnGross * discountRate * 100) / 100;
  const addOnTotal = addOnGross - addOnDiscount;
  return {
    base: baseAnnual,
    baseAnnual,
    hostingAnnual,
    hostingAfterDiscount,
    domainAnnual,
    termYears: years,
    billingCadence,
    termDiscountRate: planDiscountRate,
    annualAfterDiscount,
    packageDueToday,
    packageTermTotal,
    packageSavings,
    unit,
    totalPageActions,
    discountRate,
    addOnTotal,
    addOnDiscount,
    total: packageDueToday + addOnTotal,
  };
}

function resizeStringList(values: string[], length: number) {
  return Array.from({ length }, (_, index) => values[index] || "");
}

function resizeEditRequests(values: EditPageRequest[], length: number, fallbackPageId: string) {
  return Array.from({ length }, (_, index) => ({
    pageId: values[index]?.pageId || fallbackPageId,
    notes: values[index]?.notes || "",
  }));
}

function pageLabel(page: any, index: number) {
  return String(page?.title || page?.label || page?.name || page?.pageTitle || page?.pageId || `Page ${index + 1}`);
}

function PageCountStepper({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
      <span className="text-sm font-semibold text-slate-800">{label}</span>
      <div className="inline-flex items-center gap-2">
        <button type="button" onClick={() => onChange(Math.max(0, value - 1))} className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label={`Decrease ${label}`}>
          <Minus size={14} />
        </button>
        <span className="w-8 text-center text-sm font-semibold text-slate-950">{value}</span>
        <button type="button" onClick={() => onChange(Math.min(50, value + 1))} className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label={`Increase ${label}`}>
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

function formatUsd(value: number) {
  return `$${Number(value || 0).toFixed(Number.isInteger(value) ? 0 : 2)}`;
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
  const [setupMode, setSetupMode] = useState<SetupMode>("base");
  const [setupStep, setSetupStep] = useState<SetupStep>("offer");
  const [termYears, setTermYears] = useState(1);
  const [billingCadence, setBillingCadence] = useState<BillingCadence>("upfront");
  const [domainMode, setDomainMode] = useState<DomainMode>("new");
  const [domainLabel, setDomainLabel] = useState(normalizeDomainLabel(siteData?.meta?.businessName || businessId));
  const [ownedDomain, setOwnedDomain] = useState("");
  const [selectedTld, setSelectedTld] = useState(".com");
  const [extensionQuery, setExtensionQuery] = useState("");
  const [email, setEmail] = useState("");
  const [checkoutStatus, setCheckoutStatus] = useState("");
  const [checkoutDetails, setCheckoutDetails] = useState<any>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [paypalLoading, setPaypalLoading] = useState(false);
  const [paypalRenderedKey, setPaypalRenderedKey] = useState("");
  const [domainCheckLoading, setDomainCheckLoading] = useState(false);
  const [domainCheck, setDomainCheck] = useState<any>(null);
  const [domainQuoteLoading, setDomainQuoteLoading] = useState(false);
  const [domainQuote, setDomainQuote] = useState<any>(null);
  const [domainQuoteStatus, setDomainQuoteStatus] = useState("");
  const [ownedDomainConfirmed, setOwnedDomainConfirmed] = useState(false);
  const [newPages, setNewPages] = useState(0);
  const [editedPages, setEditedPages] = useState(0);
  const [newPageRequests, setNewPageRequests] = useState<string[]>([]);
  const [editPageRequests, setEditPageRequests] = useState<EditPageRequest[]>([]);
  const paypalButtonsRef = useRef<HTMLDivElement | null>(null);

  const existingPageOptions = useMemo(() => {
    const pages = Array.isArray(siteData?.pages) ? siteData.pages : [];
    const options = pages.map((page: any, index: number) => ({
      id: String(page?.pageId || `page-${index + 1}`),
      label: pageLabel(page, index),
    }));
    return options.length ? options : [{ id: "home", label: "Home" }];
  }, [siteData?.pages]);
  const hasPageActions = newPages + editedPages > 0;
  const setupSteps: SetupStep[] = setupMode === "addons"
    ? (hasPageActions
      ? ["offer", "plan", "addons-count", "addons-details", "domain", "payment"]
      : ["offer", "plan", "addons-count", "domain", "payment"])
    : ["offer", "plan", "domain", "payment"];
  const setupStepIndex = Math.max(0, setupSteps.indexOf(setupStep));
  const backStep = setupStep === "payment"
    ? "domain"
    : setupStep === "domain"
      ? (setupMode === "addons" ? (hasPageActions ? "addons-details" : "addons-count") : "plan")
      : setupStep === "addons-count"
        ? "plan"
      : setupStep === "addons-details"
        ? "addons-count"
        : setupStep === "plan"
          ? "offer"
        : "offer";
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
  const domainQuoteBlocksCheckout = domainMode === "new" && domainQuote?.supportedForMvp === false;
  const domainReady = ownedDomainLooksUsable || newDomainLooksAvailable;
  const canContinue = domainMode === "owned"
    ? Boolean(selectedDomain && ownedDomainLooksUsable && ownedDomainConfirmed)
    : Boolean(newDomainLooksAvailable && !domainQuoteLoading && !domainQuoteBlocksCheckout);
  const estimate = useMemo(() => checkoutEstimate(newPages, editedPages, termYears, billingCadence, domainMode), [newPages, editedPages, termYears, billingCadence, domainMode]);
  const addOnDetailsComplete = newPageRequests.every((value) => value.trim())
    && editPageRequests.every((request) => request.pageId && request.notes.trim());
  const setupRequest = useMemo(() => ({
    newPages,
    editedPages,
    newPageRequests: newPageRequests.map((title, index) => ({ index: index + 1, title: title.trim() })),
    editPageRequests: editPageRequests.map((request, index) => ({
      index: index + 1,
      pageId: request.pageId,
      pageLabel: existingPageOptions.find((page) => page.id === request.pageId)?.label || request.pageId,
      notes: request.notes.trim(),
    })),
  }), [newPages, editedPages, newPageRequests, editPageRequests, existingPageOptions]);

  const resetCheck = () => {
    setDomainCheck(null);
    setDomainQuote(null);
    setDomainQuoteStatus("");
    setDomainQuoteLoading(false);
    setCheckoutStatus("");
    setCheckoutDetails(null);
  };

  useEffect(() => {
    setNewPageRequests((current) => resizeStringList(current, newPages));
  }, [newPages]);

  useEffect(() => {
    setEditPageRequests((current) => resizeEditRequests(current, editedPages, existingPageOptions[0]?.id || "home"));
  }, [editedPages, existingPageOptions]);

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
          domainQuote: domainMode === "new" ? domainQuote : null,
          email,
          addOns: {
            newPages,
            editedPages,
          },
          setupRequest,
          billingPlan: {
            termYears,
            billingCadence,
            termDiscountRate: estimate.termDiscountRate,
            annualAfterDiscountUsd: estimate.annualAfterDiscount,
            hostingAnnualUsd: estimate.hostingAnnual,
            hostingAfterDiscountUsd: estimate.hostingAfterDiscount,
            domainAnnualUsd: estimate.domainAnnual,
            packageTermTotalUsd: estimate.packageTermTotal,
            packageDueTodayUsd: estimate.packageDueToday,
          },
        }),
      });
      const data = await response.json();
      if (data.paypalInline) {
        setCheckoutDetails(data);
        setSetupStep("payment");
        setCheckoutStatus("");
        return;
      }
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

  useEffect(() => {
    if (setupStep !== "payment" || !checkoutDetails?.paypalInline || !checkoutDetails?.paypalClientId) return;
    const isSubscription = Boolean(checkoutDetails.paypalSubscriptionPlanId);
    const paypalTargetId = isSubscription ? checkoutDetails.paypalSubscriptionPlanId : checkoutDetails.paypalOrderId;
    if (!paypalTargetId) return;
    const renderKey = `${checkoutDetails.paypalClientId}:${isSubscription ? "subscription" : "order"}:${paypalTargetId}`;
    if (paypalRenderedKey === renderKey) return;
    let cancelled = false;
    const loadPayPal = async () => {
      setPaypalLoading(true);
      setCheckoutStatus("Loading secure PayPal checkout...");
      const sdkUrl = isSubscription
        ? `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(checkoutDetails.paypalClientId)}&currency=USD&components=buttons&vault=true&intent=subscription`
        : `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(checkoutDetails.paypalClientId)}&currency=USD&intent=capture&components=buttons`;
      document.querySelectorAll<HTMLScriptElement>('script[src^="https://www.paypal.com/sdk/js"]').forEach((script) => {
        if (script.src !== sdkUrl) {
          script.remove();
          window.paypal = undefined;
        }
      });
      if (!document.querySelector(`script[src="${sdkUrl}"]`)) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = sdkUrl;
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("PayPal SDK failed to load."));
          document.head.appendChild(script);
        });
      }
      if (cancelled || !paypalButtonsRef.current || !window.paypal?.Buttons) return;
      paypalButtonsRef.current.innerHTML = "";
      await window.paypal.Buttons({
        style: { layout: "vertical", shape: "rect", label: "paypal" },
        ...(isSubscription ? {
          createSubscription: (_data: unknown, actions: any) => actions.subscription.create({
            plan_id: checkoutDetails.paypalSubscriptionPlanId,
            custom_id: checkoutDetails.paymentReference,
            subscriber: email ? { email_address: email } : undefined,
          }),
        } : {
          createOrder: () => checkoutDetails.paypalOrderId,
        }),
        onApprove: async (data: any) => {
          setPaypalLoading(true);
          setCheckoutStatus(isSubscription ? "Activating PayPal yearly billing..." : "Capturing PayPal payment...");
          try {
            const response = await fetch(isSubscription ? "/api/payments/paypal-subscription-approved" : "/api/payments/paypal-capture-order", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(isSubscription ? {
                subscriptionId: data.subscriptionID,
                paymentReference: checkoutDetails.paymentReference,
                businessId: siteData?.meta?.businessId || businessId,
              } : {
                orderId: data.orderID || checkoutDetails.paypalOrderId,
                paymentReference: checkoutDetails.paymentReference,
                businessId: siteData?.meta?.businessId || businessId,
              }),
            });
            const capture = await response.json().catch(() => ({}));
            if (!response.ok || !capture.success) {
              throw new Error(capture.error || capture.message || "PayPal capture failed.");
            }
            setCheckoutDetails((current: any) => ({ ...current, captured: true, capture }));
            setCheckoutStatus(isSubscription ? "Yearly billing is active. We will start the domain, hosting, DNS, and launch setup." : "Payment captured. We will start the domain, hosting, DNS, and launch setup.");
          } finally {
            setPaypalLoading(false);
          }
        },
        onCancel: () => setCheckoutStatus("PayPal checkout was cancelled. You can try again or contact us for help."),
        onError: (error: unknown) => {
          console.error(error);
          setCheckoutStatus(error instanceof Error ? error.message : "PayPal checkout failed. Please try again.");
        },
      }).render(paypalButtonsRef.current);
      if (!cancelled) {
        setPaypalRenderedKey(renderKey);
        setCheckoutStatus("");
      }
    };
    loadPayPal()
      .catch((error) => {
        console.error(error);
        if (!cancelled) setCheckoutStatus(error instanceof Error ? error.message : "PayPal checkout could not load.");
      })
      .finally(() => {
        if (!cancelled) setPaypalLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [setupStep, checkoutDetails?.paypalInline, checkoutDetails?.paypalClientId, checkoutDetails?.paypalOrderId, checkoutDetails?.paypalSubscriptionPlanId, checkoutDetails?.paymentReference, paypalRenderedKey, siteData?.meta?.businessId, businessId, email]);

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
    setDomainQuote(null);
    setDomainQuoteStatus("");
    try {
      const response = await fetch(`/api/domains/check?domain=${encodeURIComponent(selectedDomain)}`);
      const check = await response.json();
      setDomainCheck(check);
      if (domainMode === "new" && check?.available === true) {
        setDomainQuoteLoading(true);
        try {
          const quoteResponse = await fetch("/api/domains/quote", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ domain: selectedDomain }),
          });
          const quote = await quoteResponse.json().catch(() => ({}));
          if (quoteResponse.ok) {
            setDomainQuote(quote);
            setDomainQuoteStatus(quote.supportedForMvp === false
              ? "This domain needs manual review before checkout because the registrar price or status does not fit the included $17/year domain fee."
              : "Domain pre-check completed. The included $17/year domain fee still applies.");
          } else if (quoteResponse.status === 409) {
            setDomainQuoteStatus("You can continue; we will confirm the domain manually during setup.");
          } else {
            setDomainQuoteStatus("You can continue; we will confirm the domain manually during setup.");
          }
        } catch (quoteError) {
          console.error(quoteError);
          setDomainQuoteStatus("You can continue; we will confirm the domain manually during setup.");
        } finally {
          setDomainQuoteLoading(false);
        }
      }
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
                  <div className="flex items-center gap-2">
                    <InfoTooltip text="Choose an industry-matched font pairing before download. The exported HTML keeps the selected look." />
                    <span className="w-24 shrink-0 text-sm font-semibold text-slate-950">Font style</span>
                    <select
                      value={selectedFontPairing}
                      onChange={(event) => onFontPairingChange(event.target.value)}
                      className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {fontPairings.map((pairing) => (
                        <option key={pairing.id} value={pairing.id}>
                          {pairing.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <span className="mt-1 block text-xs text-slate-500">
                    {fontPairings.find((pairing) => pairing.id === selectedFontPairing)?.mood || fontPairings[0]?.mood}
                  </span>
                </label>
              )}
              {paletteOptions.length > 1 && onPaletteOptionChange && (
                <label className="block rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex items-center gap-2">
                    <InfoTooltip text="Choose a palette extracted from business photos before download. The exported HTML keeps the selected colors." />
                    <span className="w-24 shrink-0 text-sm font-semibold text-slate-950">Color palette</span>
                    <select
                      value={selectedPaletteOption}
                      onChange={(event) => onPaletteOptionChange(event.target.value)}
                      className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {paletteOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label || option.id}
                        </option>
                      ))}
                    </select>
                  </div>
                  <span className="mt-2 flex overflow-hidden rounded-full border border-slate-200">
                    {(paletteOptions.find((option) => option.id === selectedPaletteOption)?.colors || paletteOptions[0]?.colors || []).slice(0, 5).map((color: string) => (
                      <span key={color} className="h-5 flex-1" style={{ backgroundColor: color }} />
                    ))}
                  </span>
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
                  setSetupMode("base");
                  setSetupStep("offer");
                  setCheckoutDetails(null);
                  setPaypalRenderedKey("");
                  setCheckoutStatus("");
                  setOwnedDomainConfirmed(false);
                }}
                className="flex w-full items-center justify-between rounded-xl bg-indigo-600 px-4 py-3 text-left text-white hover:bg-indigo-700"
              >
                <span>
                  <span className="flex items-center gap-1.5 font-semibold">
                    Done-for-you website setup
                    <InfoTooltip light text="We handle domain purchase when needed, managed hosting, site upload, DNS pointing, SSL, and launch setup. If you already own the domain, the $17/year domain fee is removed." />
                  </span>
                  <span className="block text-xs text-indigo-100">$180/year hosting, plus $17/year only if we register the domain.</span>
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
          <div className="max-h-[min(92vh,780px)] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <p className="font-semibold text-slate-950">Done-for-you website setup</p>
                <p className="text-xs text-slate-500">Step {setupStepIndex + 1} of {setupSteps.length}: managed hosting, domain, SSL, and setup handled for you.</p>
              </div>
              <button type="button" onClick={() => setCheckoutOpen(false)} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4 p-5">
              {setupStep === "offer" && (
                <>
                  <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-5 text-center text-sm leading-6 text-slate-700">
                    <div>
                      <p className="text-base font-semibold leading-6 text-slate-950">Your generated website is free.</p>
                      <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-slate-600">
                        Pay only for the yearly infrastructure and setup work needed to put it online for your business.
                      </p>
                    </div>
                    <div className="grid gap-2 text-left sm:grid-cols-2">
                      <div className="rounded-lg border border-slate-200 bg-white p-3">
                        <p className="text-lg font-bold leading-none text-slate-950">$180/year</p>
                        <p className="mt-2 text-xs leading-5 text-slate-500">Managed hosting, SSL, fast global delivery, upload, and launch setup.</p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-3">
                        <p className="text-lg font-bold leading-none text-slate-950">$17/year</p>
                        <p className="mt-2 text-xs leading-5 text-slate-500">Domain fee only when we register a new domain for you.</p>
                      </div>
                    </div>
                    <div className="rounded-xl border border-indigo-100 bg-white px-4 py-3">
                      <p className="text-sm font-semibold leading-6 text-slate-950">
                        $197/year with a new domain, or $180/year when you already own one.
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Domain choice and any optional page work come after you pick the billing term.
                      </p>
                    </div>
                    <a href="/terms-refund" target="_blank" rel="noreferrer" className="inline-flex justify-center text-xs font-semibold text-indigo-700 hover:underline">
                      Terms and refund policy
                    </a>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSetupMode("base");
                      setNewPages(0);
                      setEditedPages(0);
                      setNewPageRequests([]);
                      setEditPageRequests([]);
                      setSetupStep("plan");
                      resetCheck();
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700"
                  >
                    Pick your term / discount
                    <ArrowRight size={18} />
                  </button>
                </>
              )}

              {setupStep === "plan" && (
                <>
                  <button type="button" onClick={() => setSetupStep("offer")} className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900">
                    <ArrowLeft size={16} />
                    Back
                  </button>
                  <div className="space-y-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-950">
                        Choose your term
                        <InfoTooltip text="Longer terms reduce only the managed hosting price. The $17/year domain fee still applies when we register a new domain. Page add/edit work is one-time and not multiplied by years." />
                      </p>
                      <div className="mt-3 grid grid-cols-5 gap-2">
                        {Array.from({ length: 10 }, (_, index) => index + 1).map((years) => {
                          const discount = termDiscountRate(years);
                          const active = termYears === years;
                          return (
                            <button
                              key={years}
                              type="button"
                              onClick={() => setTermYears(years)}
                              className={`rounded-xl border px-2 py-2 text-center text-xs font-semibold ${
                                active ? "border-indigo-300 bg-indigo-50 text-indigo-900" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                              }`}
                            >
                              <span className="block">{years}y</span>
                              <span className="block text-[11px] opacity-75">{discount ? `${Math.round(discount * 100)}% off` : "standard"}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="text-sm font-semibold text-slate-950">Billing</p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setBillingCadence("upfront")}
                          className={`rounded-xl border px-3 py-2 text-left text-sm ${billingCadence === "upfront" ? "border-indigo-300 bg-indigo-50 text-indigo-900" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
                        >
                          <span className="block font-semibold">Pay once</span>
                          <span className="block text-xs opacity-75">Best value, full term today.</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setBillingCadence("annual_recurring")}
                          className={`rounded-xl border px-3 py-2 text-left text-sm ${billingCadence === "annual_recurring" ? "border-indigo-300 bg-indigo-50 text-indigo-900" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
                        >
                          <span className="block font-semibold">Yearly billing</span>
                          <span className="block text-xs opacity-75">First discounted year today.</span>
                        </button>
                      </div>
                      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                        <p className="font-semibold text-slate-950">
                          Due today: {formatUsd(estimate.total)}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-slate-600">
                          {termYears > 1
                            ? `${termYears}-year term at ${Math.round(estimate.termDiscountRate * 100)}% off hosting: ${formatUsd(estimate.hostingAfterDiscount)}/year hosting${estimate.domainAnnual ? ` + ${formatUsd(estimate.domainAnnual)}/year domain fee` : ""}. ${billingCadence === "upfront" ? `Total package term cost: ${formatUsd(estimate.packageTermTotal)}.` : `PayPal auto-bills ${formatUsd(estimate.annualAfterDiscount)}/year for ${termYears} year${termYears === 1 ? "" : "s"} before any page work.`}`
                            : `1-year plan at ${formatUsd(estimate.hostingAnnual)}/year hosting${estimate.domainAnnual ? ` + ${formatUsd(estimate.domainAnnual)}/year domain fee` : ""}.`}
                        </p>
                        {estimate.packageSavings > 0 && (
                          <p className="mt-1 text-xs font-semibold text-emerald-700">
                            Hosting savings across the term: {formatUsd(estimate.packageSavings)}.
                          </p>
                        )}
                        <p className="mt-1 text-xs text-slate-500">
                          If you choose "I own one" on the domain step, the $17/year domain fee is removed.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSetupMode("base");
                        setNewPages(0);
                        setEditedPages(0);
                        setNewPageRequests([]);
                        setEditPageRequests([]);
                        setSetupStep("domain");
                        resetCheck();
                      }}
                      className="flex min-h-[78px] items-center justify-between gap-3 rounded-xl bg-indigo-600 px-4 py-3 text-left text-white hover:bg-indigo-700"
                    >
                      <span>
                        <span className="block font-semibold leading-5">Continue to domain</span>
                        <span className="mt-1 block text-xs leading-5 text-indigo-100">No extra page work right now.</span>
                      </span>
                      <ArrowRight size={18} className="shrink-0" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSetupMode("addons");
                        setSetupStep("addons-count");
                      }}
                      className="flex min-h-[78px] items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-left text-slate-900 hover:bg-indigo-100"
                    >
                      <span>
                        <span className="inline-flex items-center gap-1.5 font-semibold leading-5">
                          Add / edit pages
                          <InfoTooltip text="$10 per additional generated page or existing-page edit. 5-9 actions get 10% off; 10+ actions get 20% off." />
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-slate-600">Optional page instructions before domain.</span>
                      </span>
                      <ArrowRight size={18} className="shrink-0" />
                    </button>
                  </div>
                </>
              )}

              {setupStep === "addons-count" && (
                <>
                  <button type="button" onClick={() => setSetupStep("plan")} className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900">
                    <ArrowLeft size={16} />
                    Back
                  </button>
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-950">
                          Page work
                          <InfoTooltip text="$10 per additional generated page or page edit. 5-9 actions get 10% off; 10+ actions get 20% off." />
                        </p>
                        <p className="mt-1 text-xs text-slate-600">Optional. Leave both at 0 if you only want domain, hosting, and setup for the generated site.</p>
                      </div>
                      <span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-indigo-700">{formatUsd(estimate.total)}</span>
                    </div>
                    <div className="mt-3 space-y-2">
                      <PageCountStepper label="Pages to add" value={newPages} onChange={setNewPages} />
                      <PageCountStepper label="Pages to edit" value={editedPages} onChange={setEditedPages} />
                    </div>
                    {estimate.totalPageActions > 0 && (
                      <p className="mt-2 text-xs text-slate-600">
                        Add-ons: ${estimate.addOnTotal.toFixed(2)}
                        {estimate.addOnDiscount > 0 ? ` after $${estimate.addOnDiscount.toFixed(2)} bulk discount` : ""}.
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (estimate.totalPageActions > 0) {
                        setSetupStep("addons-details");
                        return;
                      }
                      setSetupStep("domain");
                      resetCheck();
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700"
                  >
                    <ArrowRight size={18} />
                    {estimate.totalPageActions > 0 ? "Continue to page details" : "Continue to domain"}
                  </button>
                </>
              )}

              {setupStep === "addons-details" && (
                <>
                  <button type="button" onClick={() => setSetupStep("addons-count")} className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900">
                    <ArrowLeft size={16} />
                    Back
                  </button>
                  <div className="space-y-3">
                    {newPageRequests.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-slate-950">Pages to add</p>
                        {newPageRequests.map((value, index) => (
                          <label key={`new-page-${index}`} className="block">
                            <span className="mb-1 block text-xs font-semibold text-slate-500">Page to add #{index + 1}</span>
                            <input
                              value={value}
                              onChange={(event) => setNewPageRequests((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))}
                              placeholder="Example: Financing, Fleet Services, Service Areas"
                              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </label>
                        ))}
                      </div>
                    )}
                    {editPageRequests.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-slate-950">Pages to edit</p>
                        {editPageRequests.map((request, index) => (
                          <div key={`edit-page-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <label className="block">
                              <span className="mb-1 block text-xs font-semibold text-slate-500">Page to edit #{index + 1}</span>
                              <select
                                value={request.pageId}
                                onChange={(event) => setEditPageRequests((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, pageId: event.target.value } : item))}
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                              >
                                {existingPageOptions.map((page) => (
                                  <option key={page.id} value={page.id}>{page.label}</option>
                                ))}
                              </select>
                            </label>
                            <label className="mt-2 block">
                              <span className="mb-1 block text-xs font-semibold text-slate-500">What should we edit?</span>
                              <textarea
                                value={request.notes}
                                onChange={(event) => setEditPageRequests((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, notes: event.target.value } : item))}
                                rows={3}
                                placeholder="Example: update pricing, replace headline, add service area details"
                                className="w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                            </label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                    Total today: <strong>{formatUsd(estimate.total)}</strong>. Your page instructions will be saved in the order note for admin fulfillment.
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSetupStep("domain");
                      resetCheck();
                    }}
                    disabled={!addOnDetailsComplete}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    <ArrowRight size={18} />
                    Continue to domain
                  </button>
                </>
              )}

              {setupStep === "domain" && (
                <>
                  <button type="button" onClick={() => setSetupStep(backStep)} className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900">
                    <ArrowLeft size={16} />
                    Back
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDomainMode("new");
                        setOwnedDomainConfirmed(false);
                        resetCheck();
                      }}
                      className={`rounded-xl border px-3 py-2 text-left text-sm ${domainMode === "new" ? "border-indigo-300 bg-indigo-50 text-indigo-900" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
                    >
                      <span className="block font-semibold">New domain</span>
                      <span className="block text-xs opacity-75">$17/year domain fee</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDomainMode("owned");
                        setOwnedDomainConfirmed(false);
                        resetCheck();
                      }}
                      className={`rounded-xl border px-3 py-2 text-left text-sm ${domainMode === "owned" ? "border-indigo-300 bg-indigo-50 text-indigo-900" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
                    >
                      <span className="block font-semibold">I own one</span>
                      <span className="block text-xs opacity-75">We help point DNS</span>
                    </button>
                  </div>

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
                          setOwnedDomain(sanitizeOwnedDomainInput(event.target.value));
                          setOwnedDomainConfirmed(false);
                          resetCheck();
                        }}
                        placeholder="yourdomain.com"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button type="button" onClick={handleCheckDomain} disabled={domainCheckLoading || !selectedDomain} className="rounded-xl bg-slate-950 px-3 py-2.5 text-xs font-semibold text-white disabled:opacity-50">
                        {domainCheckLoading ? "..." : "Check"}
                      </button>
                      <label className="col-span-2 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                        <input
                          type="checkbox"
                          checked={ownedDomainConfirmed}
                          onChange={(event) => setOwnedDomainConfirmed(event.target.checked)}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>
                          I confirm this is my domain and I can update DNS records, change nameservers, or give WebView.click delegated access for setup.
                        </span>
                      </label>
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
                            During setup, we will ask you to use our managed nameservers, or add DNS records we provide if you prefer keeping your current nameservers.
                          </p>
                        )}
                        {domainCheck.registrar && <p className="mt-1 text-xs opacity-80">Registrar signal: {domainCheck.registrar}</p>}
                        {Array.isArray(domainCheck.nameservers) && domainCheck.nameservers.length > 0 && (
                          <p className="mt-1 text-xs opacity-80">Current nameservers: {domainCheck.nameservers.slice(0, 3).join(", ")}</p>
                        )}
                        {domainMode === "owned" && ownedDomainLooksUsable && !ownedDomainConfirmed && (
                          <p className="mt-2 text-xs">
                            Confirm ownership above so we know you can update DNS or provide access during setup.
                          </p>
                        )}
                        {domainMode === "new" && (
                          <p className="mt-2 text-xs">
                            Domain fee: $17/year. Hosting discounts do not change the domain fee.
                          </p>
                        )}
                      </div>
                    )}
                    {domainMode === "new" && (domainQuoteLoading || domainQuoteStatus) && (
                      <div className={`mt-3 rounded-lg border p-3 text-xs ${
                        domainQuote?.supportedForMvp === false
                          ? "border-amber-200 bg-amber-50 text-amber-900"
                          : "border-slate-200 bg-slate-50 text-slate-600"
                      }`}>
                        <p className="font-semibold">
                          {domainQuoteLoading ? "Checking registrar quote..." : domainQuoteStatus}
                        </p>
                        <p className="mt-1 opacity-80">Your setup team will verify the final domain details before launch.</p>
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
                        Total today: <strong>{formatUsd(estimate.total)}</strong>. Secure checkout opens when the selected payment processor is configured. Until then this records a mock checkout request for follow-up.
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
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-950">Order total</p>
                        <p className="mt-1 text-xs leading-relaxed">
                          Managed hosting: {formatUsd(estimate.hostingAfterDiscount)}/year{estimate.termDiscountRate ? ` after ${Math.round(estimate.termDiscountRate * 100)}% term discount` : ""}{estimate.domainAnnual ? `, plus ${formatUsd(estimate.domainAnnual)}/year domain fee` : ", with no domain fee because you own the domain"}. Includes SSL, DNS/upload, generated site launch, and setup.
                        </p>
                        {checkoutDetails.pricing?.totalPageActions > 0 && (
                          <p className="mt-1 text-xs leading-relaxed">
                            Additional page/edit work: {checkoutDetails.pricing.totalPageActions} action{checkoutDetails.pricing.totalPageActions === 1 ? "" : "s"} for ${Number(checkoutDetails.pricing.addOnUsd || 0).toFixed(2)}.
                          </p>
                        )}
                        {billingCadence === "annual_recurring" && (
                          <p className="mt-1 text-xs leading-relaxed">
                            Yearly PayPal billing selected. PayPal will auto-bill the yearly package for the selected {termYears}-year term.
                          </p>
                        )}
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-sm font-bold text-indigo-700">${Number(checkoutDetails.amountUsd || estimate.total).toFixed(2)}</span>
                    </div>
                  </div>
                  {checkoutDetails.setupNote && (
                    <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                      <p className="font-semibold text-slate-950">Order note</p>
                      <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-slate-600">{checkoutDetails.setupNote}</p>
                    </div>
                  )}
                  {!checkoutDetails.paypalInline && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                      <p className="font-semibold">{checkoutDetails.processor === "paypal" ? "PayPal payment note" : "Manual payment note"}</p>
                      <p className="mt-1 text-xs leading-relaxed">
                        {checkoutDetails.paymentInstructions || "Include the business name, requested domain, and payment reference so we can match the payment quickly."}
                      </p>
                    </div>
                  )}
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
                  {checkoutDetails.paypalInline ? (
                    <div className="space-y-3">
                      {checkoutDetails.captured ? (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                          <p className="font-semibold">Payment received</p>
                          <p className="mt-1 text-xs">We will start setup and contact you for any DNS/domain access needed.</p>
                        </div>
                      ) : (
                        <>
                          <div ref={paypalButtonsRef} className="min-h-[48px]" />
                          {paypalLoading && (
                            <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                              <Loader2 className="animate-spin" size={16} />
                              PayPal checkout loading...
                            </div>
                          )}
                          {checkoutDetails.checkoutUrl && (
                            <a
                              href={checkoutDetails.checkoutUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              <ExternalLink size={16} />
                              Open PayPal fallback
                            </a>
                          )}
                        </>
                      )}
                    </div>
                  ) : (
                    <a
                      href={checkoutDetails.checkoutUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700"
                    >
                      <ExternalLink size={18} />
                      Open payment link
                    </a>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

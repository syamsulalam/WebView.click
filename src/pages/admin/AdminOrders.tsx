import { useEffect, useMemo, useState } from "react";
import { Check, Copy, ExternalLink, FileText, RefreshCw } from "lucide-react";
import HelpTooltip from "../../components/HelpTooltip";
import { useAdminToast } from "../../components/AdminToast";

function parseRawJson(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function setupSummary(order: any) {
  const raw = parseRawJson(order.raw_json) as any;
  const request = raw.setupRequest || {};
  const note = String(raw.setupNote || request.setupNote || "").trim();
  return {
    note: note || "No setup note recorded.",
    mode: request.mode || "unknown",
    newPages: Number(request.newPages || 0),
    editedPages: Number(request.editedPages || 0),
    newPageRequests: Array.isArray(request.newPageRequests) ? request.newPageRequests : [],
    editPageRequests: Array.isArray(request.editPageRequests) ? request.editPageRequests : [],
    raw,
  };
}

function domainQuoteSummary(raw: any) {
  const quote = raw?.domainQuote && typeof raw.domainQuote === "object" ? raw.domainQuote : null;
  if (!quote?.domain) {
    return {
      hasQuote: false,
      provider: "",
      domain: "",
      registrationUsd: 0,
      renewalUsd: 0,
      premium: false,
      supportedForMvp: false,
      checkedAt: "",
      label: "No registrar quote",
      detail: "Manual domain confirmation",
    };
  }
  const registrationUsd = Number(quote.registrationUsd || 0);
  const renewalUsd = Number(quote.renewalUsd || 0);
  const provider = String(quote.provider || "registrar").replace(/_/g, " ");
  return {
    hasQuote: true,
    provider,
    domain: String(quote.domain || ""),
    registrationUsd,
    renewalUsd,
    premium: quote.premium === true,
    supportedForMvp: quote.supportedForMvp !== false,
    checkedAt: String(quote.checkedAt || ""),
    label: `${provider} · ${registrationUsd ? `$${registrationUsd.toFixed(2)}` : "price n/a"}`,
    detail: [
      quote.premium === true ? "premium" : "",
      quote.supportedForMvp === false ? "manual review" : "ready",
      renewalUsd ? `renewal $${renewalUsd.toFixed(2)}` : "",
    ].filter(Boolean).join(" · "),
  };
}

function billingSummary(raw: any) {
  const pricing = raw?.pricing && typeof raw.pricing === "object" ? raw.pricing : {};
  const termYears = Number(pricing.termYears || raw?.billingPlan?.termYears || 1) || 1;
  const cadence = String(pricing.billingCadence || raw?.billingPlan?.billingCadence || "upfront");
  const discountRate = Number(pricing.termDiscountRate || raw?.billingPlan?.termDiscountRate || 0) || 0;
  const annual = Number(pricing.annualDiscountedUsd || raw?.billingPlan?.annualDiscountedUsd || 197) || 197;
  const hosting = Number(pricing.hostingAfterDiscountUsd || raw?.billingPlan?.hostingAfterDiscountUsd || annual) || annual;
  const domain = Number(pricing.domainAnnualUsd || raw?.billingPlan?.domainAnnualUsd || 0) || 0;
  const termTotal = Number(pricing.packageTermTotalUsd || raw?.billingPlan?.packageTermTotalUsd || annual * termYears) || annual * termYears;
  const paypalSubscription = raw?.paypalSubscription && typeof raw.paypalSubscription === "object" ? raw.paypalSubscription : null;
  const planCached = raw?.paypalSubscriptionPlanCached === true;
  return {
    termYears,
    cadence,
    discountRate,
    annual,
    hosting,
    domain,
    termTotal,
    paypalSubscriptionId: String(paypalSubscription?.id || raw?.paypalSubscriptionPlanId || ""),
    paypalPlanId: String(raw?.paypalSubscriptionPlanId || paypalSubscription?.plan_id || ""),
    planCached,
    label: `${termYears} year${termYears === 1 ? "" : "s"} · ${cadence === "annual_recurring" ? "yearly billing" : "pay once"}`,
  };
}

function fulfillmentNote(order: any, setup: ReturnType<typeof setupSummary>) {
  const raw = setup.raw as any;
  const quote = domainQuoteSummary(raw);
  const billing = billingSummary(raw);
  const domain = String(raw.requestedDomain || raw.domain || "").trim();
  const domainMode = String(raw.domainMode || "").trim();
  const previewUrl = order.business_id ? `${window.location.origin}/${order.business_id}` : "";
  const billingPriceSplit = `hosting $${billing.hosting.toFixed(2)}${billing.domain ? ` + domain $${billing.domain.toFixed(2)}` : " + no domain fee"}`;
  const lines = [
    "WebView.click setup fulfillment",
    `Business: ${order.business_name || order.business_id || "-"}`,
    order.business_id ? `Business ID: ${order.business_id}` : "",
    previewUrl ? `Preview: ${previewUrl}` : "",
    `Payment status: ${order.payment_status || "pending"}`,
    `Amount: $${Number(order.amount_usd || 0).toFixed(2)}`,
    `Processor: ${order.processor || "-"}`,
    `Payment reference: ${order.payment_reference || "-"}`,
    order.transaction_id ? `Transaction ID: ${order.transaction_id}` : "",
    order.payer_email || order.lead_email ? `Customer email: ${order.payer_email || order.lead_email}` : "",
    `Billing: ${billing.label}`,
    `Package annual: $${billing.annual.toFixed(2)} (${billingPriceSplit})${billing.discountRate ? ` after ${Math.round(billing.discountRate * 100)}% hosting discount` : ""}`,
    `Package term total: $${billing.termTotal.toFixed(2)}`,
    billing.paypalPlanId ? `PayPal plan: ${billing.paypalPlanId}${billing.planCached ? " (cached/reused)" : ""}` : "",
    billing.paypalSubscriptionId ? `PayPal subscription: ${billing.paypalSubscriptionId}` : "",
    domain ? `Requested domain: ${domain}` : "Requested domain: -",
    domainMode ? `Domain mode: ${domainMode === "owned" ? "Customer-owned domain" : "New domain registration"}` : "",
    quote.hasQuote ? `Registrar quote: ${quote.label} (${quote.detail})` : "Registrar quote: not captured",
    quote.hasQuote && quote.checkedAt ? `Registrar quote checked: ${quote.checkedAt}` : "",
    "",
    "Setup note:",
    setup.note,
  ].filter((line) => line !== "");
  return lines.join("\n");
}

function formatDate(value: unknown) {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) return "No date";
  return date.toLocaleString();
}

export default function AdminOrders() {
  const { showToast } = useAdminToast();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [copiedOrderId, setCopiedOrderId] = useState("");

  const fetchOrders = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/leads/payments");
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
      setOrders(Array.isArray(data) ? data : []);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Could not load orders.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const visibleOrders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return orders.filter((order) => {
      if (statusFilter !== "all" && String(order.payment_status || "") !== statusFilter) return false;
      if (!normalizedQuery) return true;
      const setup = setupSummary(order);
      const quote = domainQuoteSummary(setup.raw);
      const billing = billingSummary(setup.raw);
      return [
        order.business_name,
        order.business_id,
        order.payer_email,
        order.payment_reference,
        order.transaction_id,
        setup.note,
        quote.provider,
        quote.domain,
        quote.label,
        quote.detail,
        billing.label,
        billing.paypalSubscriptionId,
        billing.paypalPlanId,
      ].some((value) => String(value || "").toLowerCase().includes(normalizedQuery));
    });
  }, [orders, query, statusFilter]);

  const copyFulfillmentNote = async (order: any, setup: ReturnType<typeof setupSummary>) => {
    try {
      await navigator.clipboard.writeText(fulfillmentNote(order, setup));
      setCopiedOrderId(order.id);
      window.setTimeout(() => setCopiedOrderId(""), 1400);
      showToast({ kind: "success", title: "Fulfillment note copied", message: `${order.business_name || order.business_id || "Order"} note is ready to paste.` });
    } catch {
      showToast({ kind: "error", title: "Could not copy note", message: "Select the setup note manually and copy it." });
    }
  };

  return (
    <div className="mx-auto max-w-7xl p-8 font-sans">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="inline-flex items-center gap-2 text-3xl font-semibold text-gray-900">
            Setup Orders
            <HelpTooltip text="Orders are checkout rows from the payment ledger. Page add/edit instructions are stored from the buyer checkout flow in lead_payments.raw_json." />
          </h1>
          <p className="mt-1 text-sm text-slate-500">Review paid and pending done-for-you setup requests, including requested page additions and edits.</p>
        </div>
        <button
          type="button"
          onClick={fetchOrders}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
          </select>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search business, email, payment reference, transaction, or setup note"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      <div className="grid gap-4">
        {visibleOrders.map((order) => {
          const setup = setupSummary(order);
          const quote = domainQuoteSummary(setup.raw);
          const billing = billingSummary(setup.raw);
          return (
            <article key={order.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <FileText size={18} className="shrink-0 text-indigo-600" />
                    <h2 className="truncate text-lg font-semibold text-slate-950">{order.business_name || order.business_id}</h2>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {order.business_id} · {formatDate(order.created_at || order.updated_at)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${order.payment_status === "paid" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                    {order.payment_status || "pending"}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                    ${Number(order.amount_usd || 0).toFixed(2)}
                  </span>
                  {order.business_id && (
                    <a href={`/${order.business_id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                      Preview
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payment</p>
                  <p className="mt-1 text-slate-800">{order.processor || "processor unknown"}</p>
                  <p className="mt-1 break-all text-xs text-slate-500">{order.transaction_id || order.payment_reference || "No transaction/reference recorded"}</p>
                  {order.payer_email && <p className="mt-1 break-all text-xs text-slate-500">{order.payer_email}</p>}
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Billing</p>
                  <p className="mt-1 text-slate-800">{billing.label}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    ${billing.annual.toFixed(2)}/year · hosting ${billing.hosting.toFixed(2)}{billing.domain ? ` + domain ${billing.domain.toFixed(2)}` : " + no domain fee"}{billing.discountRate ? ` · ${Math.round(billing.discountRate * 100)}% hosting off` : ""} · ${billing.termTotal.toFixed(2)} term value
                  </p>
                  {billing.paypalSubscriptionId && <p className="mt-1 break-all text-xs text-indigo-700">PayPal subscription: {billing.paypalSubscriptionId}</p>}
                  {billing.paypalPlanId && <p className="mt-1 break-all text-xs text-slate-500">Plan: {billing.paypalPlanId}{billing.planCached ? " · cached" : ""}</p>}
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Domain quote</p>
                    <HelpTooltip text="Internal registrar quote captured before checkout when registrar credentials are configured. If missing, fulfillment should confirm the domain manually." widthClass="w-72" />
                  </div>
                  <p className="mt-1 capitalize text-slate-800">{quote.label}</p>
                  <p className={`mt-1 text-xs font-semibold ${quote.hasQuote && quote.supportedForMvp ? "text-emerald-700" : quote.hasQuote ? "text-amber-700" : "text-slate-500"}`}>
                    {quote.detail}
                  </p>
                  {quote.hasQuote && quote.domain && <p className="mt-1 break-all text-xs text-slate-500">{quote.domain}</p>}
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm md:col-span-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Setup note</p>
                    <button
                      type="button"
                      onClick={() => copyFulfillmentNote(order, setup)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      {copiedOrderId === order.id ? <Check size={13} /> : <Copy size={13} />}
                      {copiedOrderId === order.id ? "Copied" : "Copy fulfillment note"}
                    </button>
                  </div>
                  <p className="mt-1 whitespace-pre-line text-slate-800">{setup.note}</p>
                  {(setup.newPages > 0 || setup.editedPages > 0) && (
                    <p className="mt-2 text-xs font-semibold text-indigo-700">
                      {setup.newPages} page{setup.newPages === 1 ? "" : "s"} to add · {setup.editedPages} page{setup.editedPages === 1 ? "" : "s"} to edit
                    </p>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {!loading && visibleOrders.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          No setup orders match the current filters.
        </div>
      )}
    </div>
  );
}

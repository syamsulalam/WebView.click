import { useEffect, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, CircleDashed, Copy, ListChecks, RefreshCw } from "lucide-react";
import AdminDocsReader from "../../components/AdminDocsReader";
import HelpTooltip from "../../components/HelpTooltip";
import HoverTooltip from "../../components/HoverTooltip";
import { readAdminApiDiagnosticHistory, readLatestAdminApiDiagnostic, recordAdminApiDiagnostic, type AdminApiDiagnostic } from "../../lib/adminDiagnostics";

type Stats = {
  totalLeads: number;
  conversionRate: number;
  totalRevenue: number;
  dailyUsage?: DailyUsage;
};

const emptyStats: Stats = { totalLeads: 0, conversionRate: 0, totalRevenue: 0 };

type DailyUsageCounter = {
  key: string;
  label: string;
  count: number;
  warnAt: number;
  dangerAt: number;
  level: "ok" | "warn" | "danger" | "unknown";
};

type DailyUsage = {
  date: string;
  timezone: string;
  counters: DailyUsageCounter[];
  history?: Array<{ date: string; counters: DailyUsageCounter[] }>;
};

type ReadinessLevel = "ready" | "partial" | "missing";

type ReadinessItem = {
  key: string;
  label: string;
  level: ReadinessLevel;
  detail: string;
  href: string;
  tooltip: string;
};

type PagesDeploymentLogs = {
  configured?: boolean;
  missingKeys?: string[];
  projectName?: string;
  environment?: string;
  deploymentId?: string;
  deployment?: {
    id?: string;
    url?: string;
    environment?: string;
    status?: string;
    branch?: string;
    commitHash?: string;
    commitMessage?: string;
    createdOn?: string;
    modifiedOn?: string;
  } | null;
  logs?: Array<{ ts?: string; line: string }>;
  total?: number;
  includesContainerLogs?: boolean;
  error?: string;
  fetchedAt?: string;
};

function toNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>(emptyStats);
  const [activities, setActivities] = useState<any[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [pagesLogs, setPagesLogs] = useState<PagesDeploymentLogs | null>(null);
  const [pagesLogsLoading, setPagesLogsLoading] = useState(false);
  const [latestDashboardApiDiagnostic, setLatestDashboardApiDiagnostic] = useState<AdminApiDiagnostic | null>(null);
  const [diagnosticBundleCopied, setDiagnosticBundleCopied] = useState(false);
  const [usageHistoryDays, setUsageHistoryDays] = useState<7 | 30>(7);
  const [loading, setLoading] = useState(true);
  const [apiWarning, setApiWarning] = useState("");

  const fetchJson = async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) {
      const text = await response.text();
      const error = new Error(`${url} returned ${response.status}: ${text.substring(0, 140)}`);
      Object.assign(error, { requestPath: url, status: response.status });
      throw error;
    }
    return response.json() as Promise<unknown>;
  };

  const recordDashboardApiWarning = (source: string, warning: string, error: unknown, requestPath: string) => {
    const errorLike = error as { message?: unknown; status?: unknown; requestPath?: unknown };
    const diagnostic = recordAdminApiDiagnostic({
      source,
      title: "Dashboard API warning",
      message: warning,
      rawMessage: error instanceof Error ? error.message : String(error || warning),
      requestPath: typeof errorLike?.requestPath === "string" ? errorLike.requestPath : requestPath,
      status: typeof errorLike?.status === "number" ? errorLike.status : undefined,
    });
    setLatestDashboardApiDiagnostic(diagnostic);
    setApiWarning(warning);
  };

  const fetchPagesLogs = () => {
    setPagesLogsLoading(true);
    fetchJson("/api/cloudflare/pages-logs?limit=80")
      .then((data) => setPagesLogs(data && typeof data === "object" ? data as PagesDeploymentLogs : null))
      .catch((error) => {
        console.error(error);
        setPagesLogs({ configured: true, logs: [], error: error instanceof Error ? error.message : "Cloudflare Pages logs failed." });
      })
      .finally(() => setPagesLogsLoading(false));
  };

  useEffect(() => {
    Promise.all([
      fetchJson("/api/stats").catch((error) => {
        console.error(error);
        recordDashboardApiWarning("Dashboard stats", "API stats belum siap. Dashboard menampilkan angka default sementara.", error, "/api/stats");
        return emptyStats;
      }),
      fetchJson("/api/activities").catch((error) => {
        console.error(error);
        recordDashboardApiWarning("Dashboard activities", "API activities belum siap. Dashboard tetap bisa dibuka dengan data kosong sementara.", error, "/api/activities");
        return [];
      }),
      fetchJson("/api/settings").catch((error) => {
        console.error(error);
        recordDashboardApiWarning("Dashboard settings", "Settings belum bisa dibaca. Readiness setup memakai state kosong sementara.", error, "/api/settings");
        return {};
      })
    ]).then(([statsData, activitiesData, settingsData]) => {
      const safeStats = statsData && typeof statsData === "object" ? statsData as Partial<Stats> : emptyStats;
      setStats({
        totalLeads: toNumber(safeStats.totalLeads),
        conversionRate: toNumber(safeStats.conversionRate),
        totalRevenue: toNumber(safeStats.totalRevenue),
        dailyUsage: Array.isArray((safeStats as any).dailyUsage?.counters) ? (safeStats as any).dailyUsage as DailyUsage : undefined,
      });
      setActivities(Array.isArray(activitiesData) ? activitiesData : []);
      setSettings(settingsData && typeof settingsData === "object" ? settingsData as Record<string, string> : {});
      setLoading(false);
    }).catch(e => {
      console.error(e);
      recordDashboardApiWarning("Dashboard admin", "API admin belum merespons normal. Dashboard menampilkan state kosong sementara.", e, "/admin");
      setLoading(false);
    });
    fetchPagesLogs();
  }, []);

  const aiProviderKeys = ["OPENROUTER_API_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY", "KIE_API_KEY", "OPENCODE_API_KEY"];
  const configuredAiKeys = aiProviderKeys.filter((key) => String(settings?.[key] || "").trim());
  const lemonReady = Boolean(
    String(settings?.LEMON_SQUEEZY_API_KEY || "").trim()
    && String(settings?.LEMON_SQUEEZY_STORE_ID || "").trim()
    && String(settings?.LEMON_SQUEEZY_VARIANT_ID || "").trim(),
  );
  const activePaymentProcessor = String(settings?.PAYMENT_PROCESSOR || "mock").trim();
  const paypalLink = String(settings?.PAYPAL_BUSINESS_URL || "").trim();
  const paypalRiskAcknowledged = String(settings?.PAYPAL_RISK_ACKNOWLEDGED || "") === "true";
  const paypalLooksPersonal = /paypal\.me\//i.test(paypalLink) || String(settings?.PAYPAL_ACCOUNT_MODE || "") === "personal_bridge";
  const paypalLiveMode = String(settings?.PAYPAL_IS_PRODUCTION || "") === "true";
  const paypalActiveClientId = String(paypalLiveMode ? settings?.PAYPAL_LIVE_CLIENT_ID || settings?.PAYPAL_CLIENT_ID || "" : settings?.PAYPAL_SANDBOX_CLIENT_ID || settings?.PAYPAL_CLIENT_ID || "").trim();
  const paypalActiveClientSecret = String(paypalLiveMode ? settings?.PAYPAL_LIVE_CLIENT_SECRET || settings?.PAYPAL_CLIENT_SECRET || "" : settings?.PAYPAL_SANDBOX_CLIENT_SECRET || settings?.PAYPAL_CLIENT_SECRET || "").trim();
  const paypalApiReady = Boolean(paypalActiveClientId && paypalActiveClientSecret);
  const paypalReady = Boolean(paypalApiReady && paypalRiskAcknowledged && !paypalLooksPersonal);
  const paypalPartial = Boolean((paypalApiReady || paypalLink) && (!paypalRiskAcknowledged || paypalLooksPersonal));
  const processorReady = (
    (activePaymentProcessor === "xendit" && String(settings?.XENDIT_SECRET_KEY || "").trim())
    || (activePaymentProcessor === "midtrans" && String(settings?.MIDTRANS_SERVER_KEY || "").trim())
    || (activePaymentProcessor === "doku" && String(settings?.DOKU_CLIENT_ID || "").trim() && String(settings?.DOKU_SECRET_KEY || "").trim())
    || (activePaymentProcessor === "paypal" && paypalReady)
    || (activePaymentProcessor === "wise" && String(settings?.WISE_PAYMENT_URL || "").trim())
    || (activePaymentProcessor === "payoneer" && String(settings?.PAYONEER_PAYMENT_URL || "").trim())
    || (activePaymentProcessor === "lemon_squeezy_legacy" && lemonReady)
  );
  const manualPaymentFallback = Boolean(
    String(settings?.PAYMENT_LINK_BASIC || "").trim()
    || String(settings?.PAYMENT_LINK_PREMIUM || "").trim()
    || String(settings?.PAYPAL_BUSINESS_URL || "").trim()
    || String(settings?.WISE_PAYMENT_URL || "").trim()
    || String(settings?.PAYONEER_PAYMENT_URL || "").trim()
    || String(settings?.ADMIN_WHATSAPP_NUMBER || "").trim(),
  );
  const paymentPartial = manualPaymentFallback || (activePaymentProcessor === "paypal" && paypalPartial);
  const readinessItems: ReadinessItem[] = [
    {
      key: "places",
      label: "Google Places",
      level: String(settings?.GOOGLE_PLACES_API_KEY || "").trim() ? "ready" : "missing",
      detail: String(settings?.GOOGLE_PLACES_API_KEY || "").trim()
        ? "Search, details, reviews, and photo proxy can run."
        : "Missing Places key blocks prospect search/details.",
      href: "/admin/settings#settings-google-places",
      tooltip: "Required for Google Maps prospect search, Place Details, reviews, and photo proxy calls.",
    },
    {
      key: "ai",
      label: "AI Generation",
      level: configuredAiKeys.length > 0 ? "ready" : "missing",
      detail: configuredAiKeys.length > 0
        ? `${configuredAiKeys.length} provider key${configuredAiKeys.length === 1 ? "" : "s"} configured.`
        : "No AI provider key found for generation.",
      href: "/admin/settings#settings-ai-provider",
      tooltip: "At least one AI provider key is needed for generate/regenerate actions that require AI copy enrichment.",
    },
    {
      key: "payment",
      label: "Payment Setup",
      level: processorReady ? "ready" : paymentPartial ? "partial" : "missing",
      detail: processorReady
        ? `${activePaymentProcessor || "Selected"} checkout is configured.`
        : paymentPartial
          ? activePaymentProcessor === "paypal" && paypalPartial
            ? "PayPal link exists, but account-risk checklist is not fully ready."
            : "Manual/mock checkout fallback is available."
          : "Missing checkout and manual fallback settings.",
      href: "/admin/settings#settings-payment",
      tooltip: "Payment processor readiness checks the selected rail: Xendit, Midtrans, DOKU, PayPal Business, Wise, Payoneer, or legacy Lemon. Missing keys fall back to mock checkout.",
    },
  ];

  const readinessStyle = (level: ReadinessLevel) => {
    if (level === "ready") return "border-emerald-200 bg-emerald-50 text-emerald-800";
    if (level === "partial") return "border-amber-200 bg-amber-50 text-amber-800";
    return "border-red-200 bg-red-50 text-red-800";
  };

  const readinessIcon = (level: ReadinessLevel) => {
    if (level === "ready") return <CheckCircle2 size={16} />;
    if (level === "partial") return <CircleDashed size={16} />;
    return <AlertTriangle size={16} />;
  };
  const usageCounters = stats.dailyUsage?.counters || [];
  const usageHistory = (stats.dailyUsage?.history || []).slice(usageHistoryDays === 7 ? -7 : -30);
  const usageHistoryMax = Math.max(1, ...usageHistory.flatMap((day) => day.counters.map((counter) => counter.count)));
  const usageStyle = (level: DailyUsageCounter["level"]) => {
    if (level === "danger") return "border-red-200 bg-red-50 text-red-800";
    if (level === "warn") return "border-amber-200 bg-amber-50 text-amber-800";
    if (level === "unknown") return "border-slate-200 bg-slate-50 text-slate-600";
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  };
  const usageLabel = (level: DailyUsageCounter["level"]) => {
    if (level === "danger") return "High";
    if (level === "warn") return "Watch";
    if (level === "unknown") return "Unknown";
    return "OK";
  };

  const buildDiagnosticBundle = () => {
    const storedHistory = readAdminApiDiagnosticHistory();
    const latestDiagnostic = latestDashboardApiDiagnostic || readLatestAdminApiDiagnostic();
    const diagnosticHistory = latestDashboardApiDiagnostic && storedHistory[0]?.capturedAt !== latestDashboardApiDiagnostic.capturedAt
      ? [latestDashboardApiDiagnostic, ...storedHistory].slice(0, 5)
      : storedHistory.slice(0, 5);
    const historyLines = diagnosticHistory.length
      ? diagnosticHistory.map((item, index) => [
        `${index + 1}. ${item.capturedAt || "unknown time"} - ${item.source || item.title || "unknown source"}`,
        `   Path/status: ${item.requestPath || "unknown"} / ${item.status ? `HTTP ${item.status}` : "unknown"}`,
        item.provider || item.model ? `   Provider/model: ${item.provider || "unknown"} / ${item.model || "unknown"}` : "",
        `   Message: ${item.message || item.rawMessage || "unknown"}`,
      ].filter(Boolean).join("\n")).join("\n")
      : "(no API diagnostic history captured in this browser session)";
    const deployment = pagesLogs?.deployment;
    const logLines = (pagesLogs?.logs || [])
      .slice(-80)
      .map((log) => `[${log.ts || "-"}] ${log.line}`)
      .join("\n") || "(no deployment log lines loaded)";
    return [
      "WebView.click diagnostic bundle",
      `Generated: ${new Date().toISOString()}`,
      `Admin page: ${typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : "/admin"}`,
      "",
      "Latest API warning",
      `Captured: ${latestDiagnostic?.capturedAt || "none"}`,
      `Source: ${latestDiagnostic?.source || "unknown"}`,
      `Title: ${latestDiagnostic?.title || "none"}`,
      `Message: ${apiWarning || latestDiagnostic?.message || "No API warning captured in this browser session."}`,
      `Request path: ${latestDiagnostic?.requestPath || "unknown"}`,
      `Status: ${latestDiagnostic?.status ? `HTTP ${latestDiagnostic.status}` : "unknown"}`,
      latestDiagnostic?.provider ? `Provider: ${latestDiagnostic.provider}` : "",
      latestDiagnostic?.model ? `Model: ${latestDiagnostic.model}` : "",
      latestDiagnostic?.rawMessage ? `Raw error: ${latestDiagnostic.rawMessage}` : "",
      "",
      "Recent API warning history",
      historyLines,
      "",
      "Cloudflare Pages deployment",
      `Configured: ${pagesLogs?.configured === false ? "no" : "yes"}`,
      `Project: ${pagesLogs?.projectName || "unknown"}`,
      `Environment: ${pagesLogs?.environment || deployment?.environment || "unknown"}`,
      `Deployment ID: ${pagesLogs?.deploymentId || deployment?.id || "unknown"}`,
      `Status: ${deployment?.status || "unknown"}`,
      `Branch: ${deployment?.branch || "unknown"}`,
      `Commit: ${deployment?.commitHash || "unknown"}`,
      `Fetched: ${pagesLogs?.fetchedAt || "not loaded"}`,
      pagesLogs?.error ? `Logs API error: ${pagesLogs.error}` : "",
      pagesLogs?.missingKeys?.length ? `Missing keys: ${pagesLogs.missingKeys.join(", ")}` : "",
      "",
      "Latest deployment log lines",
      logLines,
    ].filter((line) => line !== "").join("\n");
  };

  const copyDiagnosticBundle = async () => {
    try {
      await navigator.clipboard.writeText(buildDiagnosticBundle());
      setDiagnosticBundleCopied(true);
      window.setTimeout(() => setDiagnosticBundleCopied(false), 1400);
    } catch {
      setDiagnosticBundleCopied(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto font-sans bg-gray-50/50 min-h-[calc(100vh-64px)] rounded-3xl mt-4 border border-gray-100">
      <div className="mb-8 flex items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold text-gray-900 tracking-tight">Overview</h1>
        <AdminDocsReader
          pathname="/admin"
          defaultDocId="admin-workflow-audit"
          tooltip="Open admin workflow docs for dashboard QA."
          buttonClassName="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-white hover:text-indigo-700"
          iconSize={18}
        />
      </div>
      {apiWarning && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <p className="font-semibold">Mode fallback aktif</p>
          <p className="mt-1">{apiWarning}</p>
        </div>
      )}
      
      {loading ? (
        <div className="animate-pulse space-y-8">
          <div className="grid grid-cols-3 gap-6">
            <div className="h-32 bg-gray-200 rounded-2xl"></div>
            <div className="h-32 bg-gray-200 rounded-2xl"></div>
            <div className="h-32 bg-gray-200 rounded-2xl"></div>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm transition hover:shadow-md">
              <p className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium uppercase tracking-wide text-gray-500">
                Total Leads Scraped
                <HelpTooltip text="Total lead/prospect count reported by /api/stats. If the stats endpoint is in fallback mode, this can show zero while the CRM pages still have data." />
              </p>
              <p className="text-4xl font-semibold text-gray-900">{stats.totalLeads}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm transition hover:shadow-md">
              <p className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium uppercase tracking-wide text-gray-500">
                Conversion Rate
                <HelpTooltip text="High-level CRM conversion metric from /api/stats. Use it as a dashboard signal, not as the source of truth for individual prospect status." />
              </p>
              <p className="text-4xl font-semibold text-gray-900">{stats.conversionRate.toFixed(1)}%</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm transition hover:shadow-md">
              <p className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium uppercase tracking-wide text-gray-500">
                Total Revenue
                <HelpTooltip text="Revenue total returned by /api/stats. Checkout/mock checkout details still live in the lead status and payment records." />
              </p>
              <p className="text-4xl font-semibold text-green-600">${stats.totalRevenue.toFixed(2)}</p>
            </div>
          </div>

          <div className="mb-12 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="inline-flex items-center gap-1.5 text-lg font-semibold text-gray-900">
                  Setup readiness
                  <HelpTooltip text="Quick check for the setup pieces that block prospect search, AI generation, or checkout before you enter each workflow." />
                </h2>
                <p className="mt-1 text-sm text-gray-500">Missing items should be fixed in Settings before heavy prospecting or generation.</p>
              </div>
              <div className="flex items-center gap-2">
                <AdminDocsReader
                  pathname="/admin"
                  defaultDocId="setup-panduan"
                  tooltip="Open setup docs for readiness checks."
                  buttonClassName="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-indigo-700"
                  iconSize={16}
                />
                <a href="/admin/settings" className="text-sm font-semibold text-indigo-700 hover:underline">Open Settings</a>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {readinessItems.map((item) => (
                <a
                  key={item.key}
                  href={item.href}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-indigo-200 hover:bg-white"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-950">
                        {item.label}
                        <HelpTooltip text={item.tooltip} />
                      </p>
                      <p className="mt-2 text-xs leading-relaxed text-slate-600">{item.detail}</p>
                    </div>
                    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold ${readinessStyle(item.level)}`}>
                      {readinessIcon(item.level)}
                      {item.level === "ready" ? "Ready" : item.level === "partial" ? "Partial" : "Missing"}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </div>

          <div className="mb-12 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="inline-flex items-center gap-1.5 text-lg font-semibold text-gray-900">
                  Daily usage guardrails
                  <HelpTooltip text="UTC-day counters for quota-sensitive workflows. Counts increase only when the app performs live Google Places search/details, live remote AI model validation, or a site generation attempt." />
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {stats.dailyUsage?.date ? `Tracking ${stats.dailyUsage.date} (${stats.dailyUsage.timezone || "UTC"} reset).` : "Usage counters are not available yet."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold">
                  {[7, 30].map((days) => (
                    <HoverTooltip key={days} text={`Show ${days} days of UTC usage history for quota-sensitive workflows.`} widthClass="w-52">
                      <button
                        type="button"
                        onClick={() => setUsageHistoryDays(days as 7 | 30)}
                        className={`px-3 py-2 ${usageHistoryDays === days ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-white"}`}
                      >
                        {days}d
                      </button>
                    </HoverTooltip>
                  ))}
                </div>
                <HoverTooltip text="Open the generation job audit page to inspect failures, retries, preflight blocks, and copy patch status.">
                  <a href="/admin/jobs" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-indigo-700 hover:bg-indigo-50" aria-label="Review generation jobs">
                    <ListChecks size={16} />
                  </a>
                </HoverTooltip>
                <AdminDocsReader
                  pathname="/admin"
                  defaultDocId="free-tier-limits-audit"
                  tooltip="Open free-tier and quota guardrail docs."
                  buttonClassName="inline-flex h-9 w-9 items-center justify-center rounded-lg text-indigo-700 hover:bg-indigo-50"
                  iconSize={16}
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              {usageCounters.map((item) => {
                const ratio = item.dangerAt > 0 ? Math.min(100, Math.round((item.count / item.dangerAt) * 100)) : 0;
                return (
                  <div key={item.key} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-950">{item.label}</p>
                      <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${usageStyle(item.level)}`}>
                        {usageLabel(item.level)}
                      </span>
                    </div>
                    <p className="mt-3 text-3xl font-semibold text-slate-950">{item.count}</p>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                      <div className={`h-full ${item.level === "danger" ? "bg-red-500" : item.level === "warn" ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${ratio}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-slate-500">Warn {item.warnAt} / High {item.dangerAt}</p>
                  </div>
                );
              })}
              {!usageCounters.length && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 md:col-span-4">
                  No usage data returned by `/api/stats` yet.
                </div>
              )}
            </div>
            {usageHistory.length > 0 && (
              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-950">
                    Usage history
                    <HelpTooltip text="Small bar history for the last 7 or 30 UTC days. Use it to spot spikes after deploys, batch generation, or workflow changes." />
                  </p>
                  <p className="text-xs text-slate-500">Max day count: {usageHistoryMax}</p>
                </div>
                <div className="space-y-3">
                  {usageCounters.map((counter) => (
                    <div key={`history-${counter.key}`}>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-700">{counter.label}</p>
                        <p className="text-[11px] text-slate-500">Warn {counter.warnAt} / High {counter.dangerAt}</p>
                      </div>
                      <div className="flex h-14 items-end gap-1">
                        {usageHistory.map((day) => {
                          const dayCounter = day.counters.find((item) => item.key === counter.key);
                          const count = dayCounter?.count || 0;
                          const height = Math.max(3, Math.round((count / Math.max(1, counter.dangerAt)) * 52));
                          const level = dayCounter?.level || "ok";
                          return (
                            <div key={`${counter.key}-${day.date}`} className="group relative flex flex-1 items-end justify-center">
                              <div
                                className={`w-full rounded-t ${level === "danger" ? "bg-red-500" : level === "warn" ? "bg-amber-500" : "bg-emerald-500"}`}
                                style={{ height: `${Math.min(52, height)}px` }}
                              />
                              <span className="pointer-events-none absolute bottom-full mb-1 hidden whitespace-nowrap rounded bg-slate-950 px-2 py-1 text-[11px] font-semibold text-white shadow-lg group-hover:block">
                                {day.date}: {count}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mb-12 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="inline-flex items-center gap-1.5 text-lg font-semibold text-gray-900">
                  Latest deployment logs
                  <HelpTooltip text="Reads Cloudflare Pages deployment history logs for the latest production deployment. This is deployment history output, not live Functions tail streaming." />
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {pagesLogs?.configured === false
                    ? "Configure Cloudflare Pages log credentials in Settings."
                    : pagesLogs?.deploymentId
                      ? `${pagesLogs.projectName || "Pages project"} deployment ${String(pagesLogs.deploymentId).slice(0, 8)}`
                      : "Cloudflare Pages deployment logs."}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <HoverTooltip text="Copy the last 5 API warnings, request paths/statuses, and current Cloudflare deployment log lines.">
                  <button
                    type="button"
                    onClick={copyDiagnosticBundle}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-indigo-700 hover:bg-indigo-50"
                    aria-label="Copy diagnostic bundle"
                  >
                    {diagnosticBundleCopied ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </HoverTooltip>
                <HoverTooltip text="Reload latest Cloudflare Pages deployment logs.">
                  <button
                    type="button"
                    onClick={fetchPagesLogs}
                    disabled={pagesLogsLoading}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"
                    aria-label="Refresh Cloudflare Pages deployment logs"
                  >
                    <RefreshCw size={16} className={pagesLogsLoading ? "animate-spin" : ""} />
                  </button>
                </HoverTooltip>
                <a href="/admin/settings#settings-cloudflare-observability" className="text-sm font-semibold text-indigo-700 hover:underline">Settings</a>
              </div>
            </div>
            {pagesLogs?.configured === false ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <p className="font-semibold">Cloudflare Pages logs not configured</p>
                <p className="mt-1 text-xs leading-relaxed">
                  Missing: {(pagesLogs.missingKeys || []).join(", ") || "Cloudflare Pages settings"}. Add Account ID, Pages project name, and a token with Pages Read permission.
                </p>
              </div>
            ) : pagesLogs?.error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
                <p className="font-semibold">Could not read Cloudflare deployment logs</p>
                <p className="mt-1 text-xs leading-relaxed">{pagesLogs.error}</p>
              </div>
            ) : pagesLogsLoading && !pagesLogs ? (
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                <RefreshCw size={16} className="animate-spin" />
                Loading Cloudflare deployment logs...
              </div>
            ) : (
              <div className="space-y-3">
                {pagesLogs?.deployment && (
                  <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 sm:grid-cols-4">
                    <div>
                      <p className="font-semibold uppercase tracking-wide text-slate-500">Status</p>
                      <p className="mt-1 font-semibold text-slate-900">{pagesLogs.deployment.status || "-"}</p>
                    </div>
                    <div>
                      <p className="font-semibold uppercase tracking-wide text-slate-500">Branch</p>
                      <p className="mt-1 truncate font-semibold text-slate-900">{pagesLogs.deployment.branch || "-"}</p>
                    </div>
                    <div>
                      <p className="font-semibold uppercase tracking-wide text-slate-500">Commit</p>
                      <p className="mt-1 truncate font-mono text-slate-900">{pagesLogs.deployment.commitHash ? pagesLogs.deployment.commitHash.slice(0, 10) : "-"}</p>
                    </div>
                    <div>
                      <p className="font-semibold uppercase tracking-wide text-slate-500">Fetched</p>
                      <p className="mt-1 font-semibold text-slate-900">{pagesLogs.fetchedAt ? new Date(pagesLogs.fetchedAt).toLocaleString() : "-"}</p>
                    </div>
                  </div>
                )}
                {(pagesLogs?.logs || []).length > 0 ? (
                  <div className="max-h-72 overflow-auto rounded-xl border border-slate-200 bg-slate-950 p-3">
                    {(pagesLogs?.logs || []).map((log, index) => (
                      <div key={`${log.ts || index}:${index}`} className="grid grid-cols-[9rem_1fr] gap-3 border-b border-white/5 py-1.5 text-xs last:border-b-0">
                        <span className="font-mono text-slate-400">{log.ts ? new Date(log.ts).toLocaleTimeString() : "-"}</span>
                        <span className="whitespace-pre-wrap break-words font-mono text-slate-100">{log.line}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    No deployment log lines returned yet.
                  </div>
                )}
                <p className="text-xs text-slate-500">
                  Showing {(pagesLogs?.logs || []).length} of {pagesLogs?.total || 0} deployment log line{Number(pagesLogs?.total || 0) === 1 ? "" : "s"}.
                  {pagesLogs?.includesContainerLogs ? " Includes container logs." : ""}
                </p>
              </div>
            )}
          </div>
          
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h2 className="inline-flex items-center gap-1.5 text-lg font-semibold text-gray-900">
                Aktivitas CRM Terkini
                <HelpTooltip text="Recent CRM activity from /api/activities, useful for spotting prospect views, checkout attempts, or workflow events." />
              </h2>
            </div>
            {activities.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {activities.map((act) => (
                  <div key={act.id} className="p-6 flex items-start gap-4 hover:bg-gray-50/50 transition">
                    <div className="mt-1 w-2 h-2 rounded-full bg-indigo-500" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{act.business_name || "Unknown Lead"}</p>
                      <p className="text-sm text-gray-600 mt-1">{act.description}</p>
                      <p className="text-xs text-gray-400 mt-2">{new Date(act.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center">
                <p className="text-gray-500 mb-2">Belum ada aktivitas CRM.</p>
                <p className="text-sm text-gray-400">Gunakan menu CRM Leads untuk mencari prospek baru di Google Maps dan men-generate JSON website AI.</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

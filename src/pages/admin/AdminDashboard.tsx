import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, CircleDashed } from "lucide-react";
import HelpTooltip from "../../components/HelpTooltip";

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

function toNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>(emptyStats);
  const [activities, setActivities] = useState<any[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [usageHistoryDays, setUsageHistoryDays] = useState<7 | 30>(7);
  const [loading, setLoading] = useState(true);
  const [apiWarning, setApiWarning] = useState("");

  useEffect(() => {
    const fetchJson = async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`${url} returned ${response.status}: ${text.substring(0, 140)}`);
      }
      return response.json() as Promise<unknown>;
    };

    Promise.all([
      fetchJson("/api/stats").catch((error) => {
        console.error(error);
        setApiWarning("API stats belum siap. Dashboard menampilkan angka default sementara.");
        return emptyStats;
      }),
      fetchJson("/api/activities").catch((error) => {
        console.error(error);
        setApiWarning("API activities belum siap. Dashboard tetap bisa dibuka dengan data kosong sementara.");
        return [];
      }),
      fetchJson("/api/settings").catch((error) => {
        console.error(error);
        setApiWarning("Settings belum bisa dibaca. Readiness setup memakai state kosong sementara.");
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
      setApiWarning("API admin belum merespons normal. Dashboard menampilkan state kosong sementara.");
      setLoading(false);
    });
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
  const paypalReady = Boolean(paypalLink && paypalRiskAcknowledged && !paypalLooksPersonal);
  const paypalPartial = Boolean(paypalLink && (!paypalRiskAcknowledged || paypalLooksPersonal));
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

  return (
    <div className="p-8 max-w-6xl mx-auto font-sans bg-gray-50/50 min-h-[calc(100vh-64px)] rounded-3xl mt-4 border border-gray-100">
      <h1 className="text-3xl font-semibold mb-8 text-gray-900 tracking-tight">Overview</h1>
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
              <a href="/admin/settings" className="text-sm font-semibold text-indigo-700 hover:underline">Open Settings</a>
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
                    <button
                      key={days}
                      type="button"
                      onClick={() => setUsageHistoryDays(days as 7 | 30)}
                      className={`px-3 py-2 ${usageHistoryDays === days ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-white"}`}
                    >
                      {days}d
                    </button>
                  ))}
                </div>
                <a href="/admin/jobs" className="text-sm font-semibold text-indigo-700 hover:underline">Review Jobs</a>
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

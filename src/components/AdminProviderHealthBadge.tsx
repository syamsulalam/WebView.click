import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { aiReadinessRefreshEvent } from "../lib/aiReadiness";
import { getProviderHealth, type ProviderHealthSummary } from "../lib/providerHealth";
import HelpTooltip from "./HelpTooltip";
import HoverTooltip from "./HoverTooltip";

type AdminProviderHealthBadgeProps = {
  provider: string;
  model: string;
  className?: string;
};

function failureRateClass(rate: number, total: number) {
  if (!total) return "border-slate-200 bg-slate-50 text-slate-700";
  if (rate >= 0.5) return "border-red-200 bg-red-50 text-red-800";
  if (rate >= 0.2) return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-emerald-200 bg-emerald-50 text-emerald-800";
}

export default function AdminProviderHealthBadge({ provider, model, className = "" }: AdminProviderHealthBadgeProps) {
  const [health, setHealth] = useState<ProviderHealthSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    const refresh = () => setRefreshVersion((value) => value + 1);
    window.addEventListener(aiReadinessRefreshEvent, refresh);
    return () => window.removeEventListener(aiReadinessRefreshEvent, refresh);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getProviderHealth(provider, model)
      .then((result) => {
        if (!cancelled) setHealth(result);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [provider, model, refreshVersion]);

  const total = Number(health?.total || 0);
  const failed = Number(health?.failed || 0);
  const rate = Number(health?.failureRate || 0);
  const percent = Math.round(rate * 100);
  const topKind = health?.topFailureKind?.kind || health?.latestFailure?.failureKind || "";
  const recommendation = health?.serviceCopyRecommendation;
  const title = health
    ? `${failed}/${total} generation attempts failed in the last 24h${topKind ? `. Most common: ${topKind}` : ""}.${recommendation?.reason ? ` Service-copy recommendation: ${recommendation.reason}` : ""}${health.latestFailure?.actionHint ? ` Latest hint: ${health.latestFailure.actionHint}` : ""}`
    : "No provider health data loaded yet.";

  return (
    <HoverTooltip text={title} className="max-w-full">
    <span
      className={`inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold ${failureRateClass(rate, total)} ${className}`}
    >
      <Activity size={13} />
      {loading ? "Checking 24h failure rate" : total ? `${percent}% fail · ${failed}/${total} 24h` : "No 24h attempts"}
      {topKind && <span className="max-w-[150px] truncate opacity-80">{topKind}</span>}
      {recommendation?.mode === "slow" && <span className="rounded bg-white/70 px-1.5 py-0.5 text-[10px]">slow suggested</span>}
      <HelpTooltip
        widthClass="w-72"
        text="Uses local generation job history only. It shows failed attempts divided by all attempts for this provider/model in the last 24 hours, so you can avoid flaky models before batch generation."
      />
    </span>
    </HoverTooltip>
  );
}

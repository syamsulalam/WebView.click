import { useEffect, useState } from "react";
import { Gauge, Loader2 } from "lucide-react";
import { aiReadinessRefreshEvent } from "../lib/aiReadiness";
import {
  AI_SERVICE_COPY_PROVIDER_MODES_KEY,
  aiServiceCopyModeKey,
  parseAiServiceCopyProviderModes,
} from "../lib/aiSlowProviderMode";
import { getProviderHealth, type ProviderHealthSummary } from "../lib/providerHealth";
import HoverTooltip from "./HoverTooltip";

type ProviderServiceCopyModeBadgeProps = {
  provider: string;
  model: string;
  currentSlowMode?: boolean;
  settings?: Record<string, unknown>;
  onSettingsChange?: (nextSettings: Record<string, string>) => void;
  className?: string;
};

export default function ProviderServiceCopyModeBadge({
  provider,
  model,
  currentSlowMode = false,
  settings = {},
  onSettingsChange,
  className = "",
}: ProviderServiceCopyModeBadgeProps) {
  const [health, setHealth] = useState<ProviderHealthSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    const refresh = () => setRefreshVersion((value) => value + 1);
    window.addEventListener(aiReadinessRefreshEvent, refresh);
    return () => window.removeEventListener(aiReadinessRefreshEvent, refresh);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!provider) return;
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

  const recommendation = health?.serviceCopyRecommendation;
  if (!loading && recommendation?.mode !== "slow" && !currentSlowMode) return null;

  const applySlowMode = async () => {
    if (!provider || !model || currentSlowMode || saving) return;
    setSaving(true);
    setSaveError("");
    try {
      const modes = parseAiServiceCopyProviderModes(settings?.[AI_SERVICE_COPY_PROVIDER_MODES_KEY]);
      const key = aiServiceCopyModeKey(provider, model);
      const nextModes = {
        ...modes,
        [key]: {
          ...(modes[key] || {}),
          provider,
          model,
          slowMode: true,
          serviceCopyBatchSize: 1,
          updatedAt: new Date().toISOString(),
        },
      };
      const nextSettings = {
        ...(settings as Record<string, string>),
        [AI_SERVICE_COPY_PROVIDER_MODES_KEY]: JSON.stringify(nextModes, null, 2),
      };
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [AI_SERVICE_COPY_PROVIDER_MODES_KEY]: nextSettings[AI_SERVICE_COPY_PROVIDER_MODES_KEY] }),
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`Save failed with HTTP ${response.status}${text ? `: ${text.slice(0, 160)}` : ""}`);
      }
      onSettingsChange?.(nextSettings);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save slow mode.");
    } finally {
      setSaving(false);
    }
  };

  const text = recommendation?.mode === "slow"
    ? `${recommendation.reason || "Recent provider/edge failures suggest using slow mode for service copy."} Current setting: ${currentSlowMode ? "slow" : "standard"}.${saveError ? ` Save error: ${saveError}` : ""}`
    : currentSlowMode
      ? "Slow provider mode is currently active for this provider/model. Service copy will run smaller requests."
      : "Checking provider/model retry recommendation from recent job history.";

  return (
    <HoverTooltip text={text} widthClass="w-80">
      <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
        recommendation?.mode === "slow" && !currentSlowMode
          ? "border-amber-200 bg-amber-50 text-amber-900"
          : "border-sky-200 bg-sky-50 text-sky-800"
      } ${className}`}>
        {loading ? <Loader2 className="animate-spin" size={13} /> : <Gauge size={13} />}
        {recommendation?.mode === "slow" && !currentSlowMode ? "Recommended: Slow mode" : "Slow mode active"}
        {recommendation?.mode === "slow" && !currentSlowMode && (
          <button
            type="button"
            onClick={applySlowMode}
            disabled={saving}
            className="ml-1 rounded-md bg-white/80 px-1.5 py-0.5 text-[10px] font-bold text-amber-950 ring-1 ring-inset ring-amber-200 hover:bg-white disabled:opacity-60"
          >
            {saving ? "Saving" : "Apply"}
          </button>
        )}
      </span>
    </HoverTooltip>
  );
}

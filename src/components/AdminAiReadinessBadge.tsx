import { useEffect, useState } from "react";
import { aiReadinessRefreshEvent, checkAiReadiness, type AiReadinessResult } from "../lib/aiReadiness";

type AdminAiReadinessBadgeProps = {
  provider?: string;
  model?: string;
  hasApiKey?: boolean | null;
  requiresAi: boolean;
  remoteValidate?: boolean;
  className?: string;
};

function compactModelName(model = "") {
  return model.replace(/^~/, "") || "No model selected";
}

export default function AdminAiReadinessBadge({
  provider = "",
  model = "",
  hasApiKey = null,
  requiresAi,
  remoteValidate = false,
  className = "",
}: AdminAiReadinessBadgeProps) {
  const [preflight, setPreflight] = useState<AiReadinessResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const modelLabel = compactModelName(model);

  useEffect(() => {
    const refresh = () => setRefreshVersion((value) => value + 1);
    window.addEventListener(aiReadinessRefreshEvent, refresh);
    return () => window.removeEventListener(aiReadinessRefreshEvent, refresh);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setPreflight(null);
    if (!requiresAi || !provider || !model) {
      setChecking(false);
      return () => {
        cancelled = true;
      };
    }
    setChecking(true);
    checkAiReadiness(provider, model, true, remoteValidate)
      .then((result) => {
        if (!cancelled) setPreflight(result);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [provider, model, requiresAi, remoteValidate, refreshVersion]);

  const modeClass = requiresAi
    ? "border-indigo-200 bg-indigo-50 text-indigo-800"
    : "border-sky-200 bg-sky-50 text-sky-800";
  const resolvedKeyStatus = requiresAi && preflight && typeof preflight.keyPresent === "boolean"
    ? preflight.keyPresent
    : hasApiKey;
  const keyLabel = !requiresAi
    ? "No AI key needed"
    : resolvedKeyStatus === true
      ? "Key present"
      : resolvedKeyStatus === false
        ? "Key missing"
        : "Key unknown";
  const keyClass = !requiresAi
    ? "border-slate-200 bg-slate-50 text-slate-600"
    : resolvedKeyStatus === true
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : resolvedKeyStatus === false
        ? "border-red-200 bg-red-50 text-red-800"
        : "border-amber-200 bg-amber-50 text-amber-800";
  const preflightLabel = !requiresAi
    ? ""
      : checking
      ? remoteValidate ? "Checking provider" : "Checking model"
      : preflight?.ready
        ? remoteValidate && preflight.remoteValidation?.supported !== false ? "Provider ok" : "Preflight ok"
        : preflight?.providerSupported === false
          ? "Provider invalid"
          : preflight?.modelKnown === false
            ? "Model invalid"
            : preflight?.remoteValidation?.valid === false
              ? "Provider failed"
            : preflight
              ? "Preflight failed"
              : "Preflight pending";
  const preflightClass = preflight?.ready
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : checking || !preflight
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-red-200 bg-red-50 text-red-800";
  const titleMessage = preflight?.message || `${requiresAi ? "This click requires an AI copy patch." : "This click only refreshes/resaves gathered data."} Provider: ${provider || "none"}. Model: ${modelLabel}. ${keyLabel}.`;

  return (
    <span
      className={`inline-flex max-w-full flex-wrap items-center gap-1.5 align-middle text-[10px] font-semibold leading-none ${className}`}
      title={titleMessage}
    >
      <span className={`rounded-full border px-2 py-1 ${modeClass}`}>
        {requiresAi ? "AI required" : "Data resave"}
      </span>
      <span className={`rounded-full border px-2 py-1 ${keyClass}`}>
        {keyLabel}
      </span>
      <span className="inline-block max-w-[180px] truncate rounded-full border border-slate-200 bg-white px-2 py-1 text-slate-700">
        {provider ? `${provider} / ${modelLabel}` : modelLabel}
      </span>
      {requiresAi && (
        <span className={`rounded-full border px-2 py-1 ${preflightClass}`}>
          {preflightLabel}
        </span>
      )}
    </span>
  );
}

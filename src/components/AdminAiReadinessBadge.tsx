import { useEffect, useState } from "react";
import { Check, Copy, Info } from "lucide-react";
import { aiReadinessRefreshEvent, checkAiReadiness, type AiReadinessResult } from "../lib/aiReadiness";
import { getLastProviderFailure, type ProviderFailureSummary } from "../lib/providerFailure";

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
  const [lastFailure, setLastFailure] = useState<ProviderFailureSummary | null>(null);
  const [checking, setChecking] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
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

  useEffect(() => {
    let cancelled = false;
    setLastFailure(null);
    if (!requiresAi || !provider) {
      return () => {
        cancelled = true;
      };
    }
    getLastProviderFailure(provider, model)
      .then((failure) => {
        if (!cancelled) setLastFailure(failure);
      });
    return () => {
      cancelled = true;
    };
  }, [provider, model, requiresAi, refreshVersion]);

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
  const lastFailureAge = (() => {
    const createdAt = lastFailure?.createdAt ? new Date(lastFailure.createdAt).getTime() : 0;
    if (!createdAt) return "";
    const minutes = Math.max(1, Math.round((Date.now() - createdAt) / 60_000));
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    return `${hours}h ago`;
  })();
  const lastFailureLabel = lastFailure
    ? `${lastFailure.failureKind || "provider error"}${lastFailure.httpStatus ? ` HTTP ${lastFailure.httpStatus}` : ""}${lastFailureAge ? ` · ${lastFailureAge}` : ""}`
    : "";
  const lastFailureTitle = lastFailure
    ? `${lastFailure.message || lastFailure.error || "Last provider failure."}${lastFailure.actionHint ? ` ${lastFailure.actionHint}` : ""}`
    : "";
  const copyPayload = [
    `Provider: ${provider || "none"}`,
    `Model: ${modelLabel}`,
    `Readiness: ${preflightLabel || "not checked"}`,
    `Readiness message: ${preflight?.message || titleMessage}`,
    preflight?.remoteValidation?.message ? `Remote validation: ${preflight.remoteValidation.message}` : "",
    lastFailure ? `Last failure: ${lastFailureLabel}` : "",
    lastFailure?.message ? `Failure message: ${lastFailure.message}` : "",
    lastFailure?.actionHint ? `Action hint: ${lastFailure.actionHint}` : "",
    lastFailure?.rawSnippet ? `Raw snippet: ${lastFailure.rawSnippet}` : lastFailure?.error ? `Raw error: ${lastFailure.error}` : "",
  ].filter(Boolean).join("\n");

  const copyDetails = async () => {
    try {
      await navigator.clipboard.writeText(copyPayload);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };

  return (
    <span
      className={`relative inline-flex max-w-full flex-wrap items-center gap-1.5 align-middle text-[10px] font-semibold leading-none ${className}`}
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
      {requiresAi && lastFailure && (
        <span
          className={`inline-block max-w-[240px] truncate rounded-full border px-2 py-1 ${
            lastFailure.retryable === true
              ? "border-amber-200 bg-amber-50 text-amber-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          Last fail: {lastFailureLabel}
        </span>
      )}
      {requiresAi && (
        <button
          type="button"
          onClick={() => setDetailsOpen((value) => !value)}
          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50"
          aria-expanded={detailsOpen}
        >
          <Info size={11} />
          Provider details
        </button>
      )}
      {detailsOpen && (
        <span className="absolute right-0 top-full z-[260] mt-2 w-[min(92vw,420px)] rounded-2xl border border-slate-200 bg-white p-3 text-left text-xs leading-relaxed text-slate-700 shadow-2xl">
          <span className="mb-2 flex items-start justify-between gap-2">
            <span>
              <span className="block font-semibold text-slate-950">AI provider details</span>
              <span className="mt-0.5 block text-[11px] text-slate-500">{provider || "No provider"} / {modelLabel}</span>
            </span>
            <button
              type="button"
              onClick={copyDetails}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </span>
          <span className="block rounded-xl border border-slate-200 bg-slate-50 p-2">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Readiness</span>
            <span className="mt-1 block whitespace-pre-wrap">{preflight?.message || titleMessage}</span>
          </span>
          {preflight?.remoteValidation?.message && (
            <span className="mt-2 block rounded-xl border border-slate-200 bg-white p-2">
              <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Remote validation</span>
              <span className="mt-1 block whitespace-pre-wrap">{preflight.remoteValidation.message}</span>
            </span>
          )}
          {lastFailure && (
            <span className="mt-2 block rounded-xl border border-amber-200 bg-amber-50 p-2 text-amber-950">
              <span className="block text-[11px] font-semibold uppercase tracking-wide opacity-70">Last failure</span>
              <span className="mt-1 block font-semibold">{lastFailureLabel}</span>
              <span className="mt-1 block whitespace-pre-wrap">{lastFailure.message || lastFailure.error || lastFailureTitle}</span>
              {lastFailure.actionHint && <span className="mt-1 block whitespace-pre-wrap opacity-90">{lastFailure.actionHint}</span>}
            </span>
          )}
        </span>
      )}
    </span>
  );
}

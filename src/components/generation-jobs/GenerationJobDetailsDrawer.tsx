import { Check, Copy, Loader2, RotateCw, X } from "lucide-react";
import {
  CHUNKED_GENERATION_STEPS,
  chunkedGenerationState,
  chunkedStepBadgeClass,
  chunkedStepStatus,
  chunkedStepStatusLabel,
  type ChunkedGenerationStep,
} from "../../lib/generationJobState";
import { formatCooldownRemaining } from "../../lib/providerCooldown";
import AdminAiReadinessBadge from "../AdminAiReadinessBadge";
import AdminDocsReader from "../AdminDocsReader";
import HelpTooltip from "../HelpTooltip";
import HoverTooltip from "../HoverTooltip";
import {
  auditStatusClass,
  auditStatusLabel,
  copyAuditItems,
  copyAuditSummary,
  normalizeOfferingCopyCoverage,
  offeringCopyCoverage,
  offeringCopyCoverageClass,
  offeringCopyCoverageLabel,
  offeringCopyCoverageTooltip,
} from "./jobUtils";

type GenerationJobDetailsDrawerProps = {
  job: any;
  fallbackProvider: string;
  fallbackModel: string;
  providerKeyStatus: Record<string, boolean | null | undefined>;
  retryingJobId: string;
  retryingChunkStep: string;
  retryOverrideJobId: string;
  copiedKey: string;
  onClose: () => void;
  onCopyValue: (key: string, value: string) => void | Promise<void>;
  onRetryGenerationJob: (job: any) => void | Promise<void>;
  onRetryChunkedStep: (job: any, step?: ChunkedGenerationStep) => void | Promise<void>;
};

export default function GenerationJobDetailsDrawer({
  job,
  fallbackProvider,
  fallbackModel,
  providerKeyStatus,
  retryingJobId,
  retryingChunkStep,
  retryOverrideJobId,
  copiedKey,
  onClose,
  onCopyValue,
  onRetryGenerationJob,
  onRetryChunkedStep,
}: GenerationJobDetailsDrawerProps) {
  const auditItems = copyAuditItems(job);
  const auditSummary = copyAuditSummary(job);
  const offeringCoverage = offeringCopyCoverage(job);
  const coverageDelta = job?.metadata?.copyOnlyRetryCoverageDelta && typeof job.metadata.copyOnlyRetryCoverageDelta === "object"
    ? job.metadata.copyOnlyRetryCoverageDelta
    : job?.copyOnlyRetryCoverageDelta && typeof job.copyOnlyRetryCoverageDelta === "object"
      ? job.copyOnlyRetryCoverageDelta
      : null;
  const previousCoverage = coverageDelta?.before ? normalizeOfferingCopyCoverage(coverageDelta.before, true) : null;
  const deltaAfterCoverage = coverageDelta?.after ? normalizeOfferingCopyCoverage(coverageDelta.after, true) : null;
  const afterCoverage = deltaAfterCoverage || offeringCoverage;
  const coverageGain = previousCoverage?.recorded && afterCoverage.recorded
    ? Number(afterCoverage.changed || 0) - Number(previousCoverage.changed || 0)
    : null;
  const aiReadiness = job?.metadata?.aiReadiness || null;
  const remoteValidation = job?.metadata?.remoteValidation || aiReadiness?.remoteValidation || null;
  const providerCooldown = job?.metadata?.providerCooldown || null;
  const aiFailure = job?.metadata?.aiFailure || job?.metadata?.providerFailure || null;
  const chunkedState = chunkedGenerationState(job);
  const returnedOutline = job?.metadata?.offeringOutline && typeof job.metadata.offeringOutline === "object"
    ? job.metadata.offeringOutline
    : null;
  const returnedCopyPatch = job?.metadata?.copyPatch && typeof job.metadata.copyPatch === "object"
    ? job.metadata.copyPatch
    : null;
  const returnedSiteCopyPatch = job?.metadata?.siteCopyPatch && typeof job.metadata.siteCopyPatch === "object"
    ? job.metadata.siteCopyPatch
    : null;
  const returnedOfferingCopyPatch = job?.metadata?.offeringCopyPatch && typeof job.metadata.offeringCopyPatch === "object"
    ? job.metadata.offeringCopyPatch
    : null;
  const provider = job?.provider || fallbackProvider;
  const selectedReadiness = {
    provider,
    model: job?.model || fallbackModel,
    hasApiKey: providerKeyStatus[provider] ?? null,
  };
  const returnedWorkSections = [
    {
      key: "outline",
      title: "AI returned outline",
      helper: "Raw parsed offering outline returned by the outline step before deterministic pages/navigation are rebuilt.",
      value: returnedOutline,
      copyKey: `${job.id}:ai-outline`,
      empty: "No AI outline has been recorded for this job yet.",
    },
    {
      key: "copyPatch",
      title: "AI returned combined copy patch",
      helper: "Combined copy patch applied before final save. Compare this with the copy audit below to see whether AI omitted a field, returned unchanged wording, or the patch did not map onto the final site JSON.",
      value: returnedCopyPatch,
      copyKey: `${job.id}:ai-copy-patch`,
      empty: "No AI copy patch has been recorded for this job yet.",
    },
    {
      key: "siteCopyPatch",
      title: "AI returned site copy patch",
      helper: "Homepage/meta/general-site copy returned by the site copy chunk.",
      value: returnedSiteCopyPatch,
      copyKey: `${job.id}:ai-site-copy-patch`,
      empty: "No separate site copy patch has been recorded for this job yet.",
    },
    {
      key: "offeringCopyPatch",
      title: "AI returned offering copy patch",
      helper: "Service/product detail copy returned by the offering copy chunk.",
      value: returnedOfferingCopyPatch,
      copyKey: `${job.id}:ai-offering-copy-patch`,
      empty: "No separate offering copy patch has been recorded for this job yet.",
    },
  ];

  return (
    <div className="fixed inset-0 z-[250] flex justify-end bg-slate-950/30" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        aria-label="Close job details"
      />
      <aside className="relative flex h-full w-full max-w-xl flex-col overflow-hidden bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">Generation job</p>
            <h2 className="mt-1 truncate text-lg font-bold text-slate-950">
              {job.prospectName || job.metadata?.businessName || job.businessId || job.id}
            </h2>
            <p className="mt-1 truncate text-xs text-slate-500">{job.id}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {job.businessId && (
              <div className="flex flex-wrap items-center justify-end gap-2">
                <HoverTooltip text="Retry with the current copy brief. If the brief hash changed, the first click warns and the second click confirms.">
                  <button
                    type="button"
                    onClick={() => onRetryGenerationJob(job)}
                    disabled={Boolean(retryingJobId || retryingChunkStep)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
                  >
                    {retryingJobId === job.id ? <Loader2 className="animate-spin" size={14} /> : <RotateCw size={14} />}
                    {retryOverrideJobId === job.id ? "Retry anyway" : "Retry"}
                  </button>
                </HoverTooltip>
                <AdminAiReadinessBadge
                  provider={selectedReadiness.provider}
                  model={selectedReadiness.model}
                  hasApiKey={selectedReadiness.hasApiKey}
                  requiresAi
                />
              </div>
            )}
            <AdminDocsReader
              pathname="/admin/jobs"
              defaultDocId="admin-workflow-audit"
              tooltip="Open generation job QA docs in the admin docs reader."
              buttonClassName="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-indigo-700"
              iconSize={17}
            />
            <HoverTooltip text="Close job details drawer.">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close job details"
              >
                <X size={18} />
              </button>
            </HoverTooltip>
          </div>
        </div>
        <div className="flex-1 space-y-4 overflow-auto p-5 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["Status", job.status || "-"],
              ["Provider", job.provider || "-"],
              ["Model", job.model || "-"],
              ["Business ID", job.businessId || "-"],
              ["Place ID", job.placeId || "-"],
              ["Created", job.createdAt ? new Date(job.createdAt).toLocaleString() : "-"],
              ["Updated", job.updatedAt ? new Date(job.updatedAt).toLocaleString() : "-"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-1 break-words font-medium text-slate-900">{value}</p>
              </div>
            ))}
          </div>

          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="font-semibold text-slate-950">Error</h3>
              {job.error && (
                <HoverTooltip text="Copy the raw job error for production QA or provider support.">
                  <button
                    type="button"
                    onClick={() => onCopyValue(`${job.id}:error`, job.error)}
                    className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200"
                  >
                    {copiedKey === `${job.id}:error` ? <Check size={12} /> : <Copy size={12} />}
                    Copy
                  </button>
                </HoverTooltip>
              )}
            </div>
            <pre className="max-h-40 overflow-auto rounded-xl border border-slate-200 bg-slate-950 p-3 text-xs text-slate-100">
              {job.error || "No error recorded."}
            </pre>
          </section>

          {chunkedState.chunked && (
            <section>
              <div className="mb-2">
                <h3 className="inline-flex items-center gap-1.5 font-semibold text-slate-950">
                  Chunked generation
                  <HelpTooltip text="Shows the D1-backed outline, site copy, offering copy, and finalize steps for this job. Failed steps can be retried without starting a new generation job." />
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Next step: {chunkedState.nextStep || "none"}{chunkedState.failureStep ? ` - Failed step: ${chunkedState.failureStep}` : ""}
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-4">
                {CHUNKED_GENERATION_STEPS.map((step) => {
                  const status = chunkedStepStatus(job, step.key);
                  const retryKey = `${job.id}:${step.key}`;
                  const canRunStep = chunkedState.retryStep === step.key || (job.status === "running" && chunkedState.nextStep === step.key);
                  return (
                    <div key={step.key} className={`rounded-xl border p-3 ${chunkedStepBadgeClass(status)}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide opacity-75">{step.label}</p>
                          <p className="mt-1 font-semibold">{chunkedStepStatusLabel(status)}</p>
                        </div>
                        {status === "complete" && <Check size={16} />}
                        {status === "running" && <Loader2 className="animate-spin" size={16} />}
                      </div>
                      {canRunStep && (
                        <HoverTooltip text={`${job.status === "failed" ? "Retry" : "Run"} only the ${step.label} step for this chunked job.`}>
                          <button
                            type="button"
                            onClick={() => onRetryChunkedStep(job, step.key)}
                            disabled={Boolean(retryingChunkStep || retryingJobId)}
                            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-800 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 disabled:opacity-50"
                          >
                            {retryingChunkStep === retryKey ? <Loader2 className="animate-spin" size={13} /> : <RotateCw size={13} />}
                            {job.status === "failed" ? `Retry ${step.label}` : `Run ${step.label}`}
                          </button>
                        </HoverTooltip>
                      )}
                    </div>
                  );
                })}
              </div>
              {(job.metadata?.failureMessage || job.metadata?.offeringOutlineError) && (
                <p className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                  {job.metadata?.failureMessage || job.metadata?.offeringOutlineError}
                </p>
              )}
            </section>
          )}

          <section>
            <div className="mb-2">
              <h3 className="inline-flex items-center gap-1.5 font-semibold text-slate-950">
                AI returned work
                <HelpTooltip text="Shows the parsed JSON returned by AI for chunked outline, site-copy, and offering-copy steps. Use this with the copy audit to debug why regenerated copy did or did not change." />
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Inspect the model output before and after WebView.click applies it to the saved site.
              </p>
            </div>
            <div className="space-y-3">
              {returnedWorkSections.map((section) => (
                <article key={section.key} className="rounded-xl border border-slate-200 bg-white">
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{section.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{section.helper}</p>
                    </div>
                    {section.value && (
                      <HoverTooltip text={`Copy ${section.title.toLowerCase()} JSON.`}>
                        <button
                          type="button"
                          onClick={() => onCopyValue(section.copyKey, JSON.stringify(section.value, null, 2))}
                          className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200"
                        >
                          {copiedKey === section.copyKey ? <Check size={12} /> : <Copy size={12} />}
                          Copy
                        </button>
                      </HoverTooltip>
                    )}
                  </div>
                  {section.value ? (
                    <pre className="max-h-72 overflow-auto rounded-b-xl bg-slate-950 p-3 text-xs text-slate-100">
                      {JSON.stringify(section.value, null, 2)}
                    </pre>
                  ) : (
                    <p className="px-3 py-3 text-xs text-slate-500">{section.empty}</p>
                  )}
                </article>
              ))}
            </div>
          </section>

          {job.metadata?.preflightBlocked && aiReadiness && (
            <section>
              <div className="mb-2">
                <h3 className="font-semibold text-slate-950">AI readiness block</h3>
                <p className="mt-0.5 text-xs text-slate-500">Why this attempt stopped before `/api/sites/generate`.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {[
                  ["Key", aiReadiness.keyPresent === true ? "Present" : aiReadiness.keyPresent === false ? "Missing" : "Unknown", aiReadiness.keyPresent === true],
                  ["Local model", aiReadiness.modelKnown === true ? "Known" : aiReadiness.modelKnown === false ? "Not in registry" : "Unknown", aiReadiness.modelKnown === true],
                  ["Remote route", remoteValidation?.valid === true ? "Valid" : remoteValidation?.valid === false ? "Failed" : remoteValidation?.supported === false ? "Not supported" : "Not checked", remoteValidation?.valid === true || remoteValidation?.supported === false],
                ].map(([label, value, ok]) => (
                  <div key={String(label)} className={`rounded-xl border p-3 ${ok ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{String(label)}</p>
                    <p className={`mt-1 font-semibold ${ok ? "text-emerald-800" : "text-red-800"}`}>{String(value)}</p>
                  </div>
                ))}
              </div>
              <p className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                {remoteValidation?.message || aiReadiness.message || job.error}
              </p>
            </section>
          )}

          {job.metadata?.cooldownBlocked && providerCooldown && (
            <section>
              <div className="mb-2">
                <h3 className="font-semibold text-slate-950">Provider cooldown block</h3>
                <p className="mt-0.5 text-xs text-slate-500">This attempt stopped before `/api/sites/generate` because the selected provider had an active shared cooldown.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {[
                  ["Provider", providerCooldown.provider || job.provider || "-"],
                  ["Remaining", Number(providerCooldown.until || 0) > Date.now() ? formatCooldownRemaining(providerCooldown) : "Expired"],
                  ["Action", job.metadata?.preflightAction || "-"],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{String(label)}</p>
                    <p className="mt-1 font-semibold text-amber-900">{String(value || "-")}</p>
                  </div>
                ))}
              </div>
              <p className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                {providerCooldown.reason || job.error}
              </p>
            </section>
          )}

          {aiFailure && (
            <section>
              <div className="mb-2">
                <h3 className="font-semibold text-slate-950">Provider failure diagnostics</h3>
                <p className="mt-0.5 text-xs text-slate-500">Granular reason captured from the provider response or network stage.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-4">
                {[
                  ["Kind", aiFailure.failureKind || "-"],
                  ["HTTP", aiFailure.httpStatus || "-"],
                  ["Stage", aiFailure.stage || "-"],
                  ["Retryable", aiFailure.retryable === true ? "Yes" : aiFailure.retryable === false ? "No" : "Unknown"],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{String(label)}</p>
                    <p className="mt-1 font-semibold text-slate-950">{String(value)}</p>
                  </div>
                ))}
              </div>
              <p className="mt-2 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700">
                {aiFailure.actionHint || aiFailure.message || job.error}
              </p>
              {aiFailure.endpoint && (
                <HoverTooltip text={aiFailure.endpoint} widthClass="w-96">
                  <span className="mt-2 block truncate rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-[11px] text-slate-600">
                    {aiFailure.endpoint}
                  </span>
                </HoverTooltip>
              )}
            </section>
          )}

          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <h3 className="inline-flex items-center gap-1.5 font-semibold text-slate-950">
                  AI copy audit
                  <HelpTooltip text="Compares source copy sent to AI with final saved copy. This helps identify whether a job used AI wording or fell back to gathered Google data." />
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">Source copy sent to AI and final copy saved after patch/fallback.</p>
              </div>
              {auditItems.length > 0 && (
                <HoverTooltip text="Copy source-vs-saved AI copy audit JSON for this job.">
                  <button
                    type="button"
                    onClick={() => onCopyValue(`${job.id}:copy-audit`, JSON.stringify({ summary: auditSummary, items: auditItems }, null, 2))}
                    className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200"
                  >
                    {copiedKey === `${job.id}:copy-audit` ? <Check size={12} /> : <Copy size={12} />}
                    Copy
                  </button>
                </HoverTooltip>
              )}
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                ["Sent", auditSummary.sourceSentencesSentToAi ?? auditSummary.targetFieldsSentToAi ?? 0],
                ["AI changed", Number(auditSummary.aiRewritten || 0) + Number(auditSummary.aiFilledBlank || 0)],
                ["Fallback/kept", Number(auditSummary.fallbackSource || 0) + Number(auditSummary.sourceKept || 0)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                  <p className="mt-1 text-lg font-bold text-slate-950">{String(value)}</p>
                </div>
              ))}
            </div>
            {(offeringCoverage.total > 0 || job.metadata?.offeringCopyPatch || previousCoverage) && (
              <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Offering copy coverage
                      <HelpTooltip text="Counts service/product offerings whose saved summary, description, highlights, or detail-page FAQ changed during the offering-copy chunk." />
                    </h4>
                    <p className="mt-1 text-xs text-slate-600">{offeringCopyCoverageTooltip(offeringCoverage)}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${offeringCopyCoverageClass(offeringCoverage)}`}>
                    {offeringCopyCoverageLabel(offeringCoverage)}
                  </span>
                </div>
                {offeringCoverage.recorded && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-4">
                    {[
                      ["Summary", offeringCoverage.summaryChanged],
                      ["Description", offeringCoverage.descriptionChanged],
                      ["Highlights", offeringCoverage.highlightsChanged],
                      ["FAQ", offeringCoverage.faqChanged],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{String(label)}</p>
                        <p className="mt-0.5 font-bold text-slate-950">{String(value)}</p>
                      </div>
                    ))}
                  </div>
                )}
                {previousCoverage && (
                  <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50 p-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
                      Copy-only retry delta
                    </p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                      <div className="rounded-md bg-white p-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Before</p>
                        <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${offeringCopyCoverageClass(previousCoverage)}`}>
                          {offeringCopyCoverageLabel(previousCoverage)}
                        </span>
                      </div>
                      <div className="rounded-md bg-white p-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">After</p>
                        <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${offeringCopyCoverageClass(afterCoverage)}`}>
                          {offeringCopyCoverageLabel(afterCoverage)}
                        </span>
                      </div>
                      <div className="rounded-md bg-white p-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Delta</p>
                        <p className={`mt-1 font-bold ${Number(coverageGain || 0) > 0 ? "text-emerald-700" : Number(coverageGain || 0) < 0 ? "text-red-700" : "text-slate-700"}`}>
                          {coverageGain === null ? "n/a" : `${coverageGain >= 0 ? "+" : ""}${coverageGain} services`}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            {auditItems.length > 0 ? (
              <div className="mt-3 max-h-[42vh] space-y-2 overflow-auto rounded-xl border border-slate-200 bg-white p-2">
                {auditItems.map((item: any, index: number) => (
                  <article key={`${item.path || index}:${index}`} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-950">{item.label || item.path || "copy field"}</p>
                        <p className="mt-0.5 truncate font-mono text-[10px] text-slate-500">{item.path}</p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${auditStatusClass(String(item.status || ""))}`}>
                        {auditStatusLabel(String(item.status || ""))}
                      </span>
                    </div>
                    <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                      <div>
                        <p className="mb-1 font-semibold uppercase tracking-wide text-slate-400">Sent/source</p>
                        <p className="break-words rounded-md bg-white p-2 text-slate-700">{item.before || "Blank target"}</p>
                      </div>
                      <div>
                        <p className="mb-1 font-semibold uppercase tracking-wide text-slate-400">Saved/final</p>
                        <p className="break-words rounded-md bg-white p-2 text-slate-900">{item.after || "Blank after save"}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                No sentence-level copy audit was recorded for this older job. Retry the job to create granular AI/fallback metadata.
              </div>
            )}
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="font-semibold text-slate-950">Raw metadata</h3>
              <HoverTooltip text="Copy raw generation job metadata JSON.">
                <button
                  type="button"
                  onClick={() => onCopyValue(`${job.id}:metadata`, JSON.stringify(job.metadata || {}, null, 2))}
                  className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200"
                >
                  {copiedKey === `${job.id}:metadata` ? <Check size={12} /> : <Copy size={12} />}
                  Copy
                </button>
              </HoverTooltip>
            </div>
            <pre className="max-h-[45vh] overflow-auto rounded-xl border border-slate-200 bg-slate-950 p-3 text-xs text-slate-100">
              {JSON.stringify(job.metadata || {}, null, 2)}
            </pre>
          </section>
        </div>
      </aside>
    </div>
  );
}

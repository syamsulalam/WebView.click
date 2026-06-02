export type GenerationJobCounts = {
  all: number;
  failed: number;
  preflight: number;
  fallback: number;
  patch: number;
  noRewrite: number;
  lowOfferingCoverage: number;
  safeMode: number;
};

export function shortHash(value: unknown) {
  const text = String(value || "").trim();
  return text ? text.slice(0, 8) : "";
}

export function patchApplied(job: any) {
  return job?.metadata?.copyPatchApplied === true;
}

export function cooldownBlocked(job: any) {
  return job?.metadata?.cooldownBlocked === true;
}

export function aiRewriteCount(job: any) {
  return Number(job?.metadata?.copyAuditSummary?.aiRewritten || 0);
}

export function noAiRewrite(job: any) {
  return patchApplied(job) && aiRewriteCount(job) === 0;
}

export function copyAuditItems(job: any) {
  const items = job?.metadata?.copyAuditItems;
  return Array.isArray(items) ? items : [];
}

export function copyAuditSummary(job: any) {
  const summary = job?.metadata?.copyAuditSummary;
  return summary && typeof summary === "object" ? summary : {};
}

export function normalizeOfferingCopyCoverage(coverage: any, recorded = true) {
  if (coverage && typeof coverage === "object" && !Array.isArray(coverage)) {
    const items = Array.isArray(coverage.items) ? coverage.items : [];
    return {
      total: Number(coverage.total ?? items.length ?? 0),
      changed: Number(coverage.changed ?? items.filter((item: any) => item?.changed).length ?? 0),
      summaryChanged: Number(coverage.summaryChanged ?? items.filter((item: any) => item?.summaryChanged).length ?? 0),
      descriptionChanged: Number(coverage.descriptionChanged ?? items.filter((item: any) => item?.descriptionChanged).length ?? 0),
      highlightsChanged: Number(coverage.highlightsChanged ?? items.filter((item: any) => item?.highlightsChanged).length ?? 0),
      faqChanged: Number(coverage.faqChanged ?? items.filter((item: any) => item?.faqChanged).length ?? 0),
      items,
      recorded,
    };
  }
  return {
    total: 0,
    changed: 0,
    summaryChanged: 0,
    descriptionChanged: 0,
    highlightsChanged: 0,
    faqChanged: 0,
    items: [],
    recorded: false,
  };
}

export function offeringCopyCoverage(job: any) {
  const coverage = job?.metadata?.offeringCopyCoverage;
  if (coverage && typeof coverage === "object" && !Array.isArray(coverage)) {
    return normalizeOfferingCopyCoverage(coverage, true);
  }

  const patchOfferings = Array.isArray(job?.metadata?.offeringCopyPatch?.offerings)
    ? job.metadata.offeringCopyPatch.offerings
    : Array.isArray(job?.metadata?.copyPatch?.offerings)
      ? job.metadata.copyPatch.offerings
      : [];
  return {
    total: patchOfferings.length,
    changed: 0,
    summaryChanged: 0,
    descriptionChanged: 0,
    highlightsChanged: 0,
    faqChanged: 0,
    items: patchOfferings,
    recorded: false,
  };
}

export function offeringCopyCoverageClass(coverage: ReturnType<typeof offeringCopyCoverage>) {
  if (!coverage.total) return "bg-slate-100 text-slate-600";
  if (!coverage.recorded) return "bg-slate-100 text-slate-700";
  const ratio = coverage.changed / coverage.total;
  if (ratio >= 0.8) return "bg-emerald-100 text-emerald-800";
  if (ratio >= 0.5) return "bg-amber-100 text-amber-900";
  return "bg-red-100 text-red-800";
}

export function offeringCopyCoverageLabel(coverage: ReturnType<typeof offeringCopyCoverage>) {
  if (!coverage.total) return "services -";
  return coverage.recorded ? `services ${coverage.changed}/${coverage.total}` : `services ?/${coverage.total}`;
}

export function offeringCopyCoverageTooltip(coverage: ReturnType<typeof offeringCopyCoverage>) {
  if (!coverage.total) return "No service/product offering coverage was recorded for this job.";
  if (!coverage.recorded) return "This older job has offering patch data but no saved before-vs-after coverage summary.";
  return `Offering copy changed ${coverage.changed} of ${coverage.total} services/products. Summary ${coverage.summaryChanged}, description ${coverage.descriptionChanged}, highlights ${coverage.highlightsChanged}, FAQ ${coverage.faqChanged}.`;
}

export function lowOfferingCopyCoverage(job: any) {
  const coverage = offeringCopyCoverage(job);
  return coverage.recorded && coverage.total > 0 && coverage.changed / coverage.total < 0.5;
}

export function offeringCopySafeModeActive(job: any) {
  const mode = job?.metadata?.offeringCopyMode;
  return job?.metadata?.offeringCopyForceBatchSizeOne === true
    || (mode && typeof mode === "object" && !Array.isArray(mode) && (mode.forcedBatchSize === 1 || mode.forcedBy));
}

export function offeringCopySafeModeTooltip(job: any) {
  const reason = String(job?.metadata?.offeringCopyForceBatchSizeReason || job?.metadata?.offeringCopyMode?.forcedReason || "").trim();
  const at = String(job?.metadata?.offeringCopyForceBatchSizeAt || "").trim();
  const reasonLabel = reason === "client_retry_after_transient_failure"
    ? "browser retry after a transient edge/provider failure"
    : reason === "server_transient_failure"
      ? "server caught a transient offering-copy failure"
      : reason || "transient edge/provider failure";
  return `Safe mode is active for this job: service copy is forced to 1 service/product per request after ${reasonLabel}.${at ? ` Activated ${new Date(at).toLocaleString()}.` : ""}`;
}

export function auditStatusLabel(status: string) {
  if (status === "ai_rewritten") return "AI rewritten";
  if (status === "ai_filled_blank") return "AI filled";
  if (status === "source_kept") return "Source kept";
  if (status === "fallback_source") return "Fallback source";
  if (status === "missing_after") return "Missing after";
  return status || "Unknown";
}

export function auditStatusClass(status: string) {
  if (status === "ai_rewritten" || status === "ai_filled_blank") return "bg-emerald-100 text-emerald-800";
  if (status === "fallback_source") return "bg-amber-100 text-amber-900";
  if (status === "missing_after") return "bg-red-100 text-red-800";
  return "bg-slate-100 text-slate-700";
}

export function filterJobs(jobs: any[], filter: string) {
  if (filter === "failed") return jobs.filter((job) => job.status === "failed");
  if (filter === "preflight") return jobs.filter((job) => job?.metadata?.preflightBlocked === true);
  if (filter === "fallback") return jobs.filter((job) => !patchApplied(job));
  if (filter === "patch") return jobs.filter((job) => patchApplied(job));
  if (filter === "noRewrite") return jobs.filter((job) => noAiRewrite(job));
  if (filter === "lowOfferingCoverage") return jobs.filter((job) => lowOfferingCopyCoverage(job));
  if (filter === "safeMode") return jobs.filter((job) => offeringCopySafeModeActive(job));
  return jobs;
}

export function sortJobs(jobs: any[], sort: string) {
  return [...jobs].sort((a, b) => {
    if (sort === "failed") return Number(b.status === "failed") - Number(a.status === "failed");
    if (sort === "preflight") return Number(b?.metadata?.preflightBlocked === true) - Number(a?.metadata?.preflightBlocked === true);
    if (sort === "fallback") return Number(!patchApplied(b)) - Number(!patchApplied(a));
    if (sort === "patch") return Number(patchApplied(b)) - Number(patchApplied(a));
    if (sort === "noRewrite") return Number(noAiRewrite(b)) - Number(noAiRewrite(a));
    if (sort === "lowOfferingCoverage") return Number(lowOfferingCopyCoverage(b)) - Number(lowOfferingCopyCoverage(a));
    if (sort === "safeMode") return Number(offeringCopySafeModeActive(b)) - Number(offeringCopySafeModeActive(a));
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });
}

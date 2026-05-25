export type GenerationJobCounts = {
  all: number;
  failed: number;
  preflight: number;
  fallback: number;
  patch: number;
  noRewrite: number;
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
  return jobs;
}

export function sortJobs(jobs: any[], sort: string) {
  return [...jobs].sort((a, b) => {
    if (sort === "failed") return Number(b.status === "failed") - Number(a.status === "failed");
    if (sort === "preflight") return Number(b?.metadata?.preflightBlocked === true) - Number(a?.metadata?.preflightBlocked === true);
    if (sort === "fallback") return Number(!patchApplied(b)) - Number(!patchApplied(a));
    if (sort === "patch") return Number(patchApplied(b)) - Number(patchApplied(a));
    if (sort === "noRewrite") return Number(noAiRewrite(b)) - Number(noAiRewrite(a));
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });
}

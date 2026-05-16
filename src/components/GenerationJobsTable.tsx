import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Copy, ExternalLink, FileText, Loader2, RefreshCw, RotateCw, Search, X } from "lucide-react";
import { useLocalStorageState } from "../lib/localStorageState";

type GenerationJobsTableProps = {
  storageKeyPrefix: string;
  fallbackProvider: string;
  fallbackModel: string;
  limit?: number;
  variant?: "compact" | "full";
  className?: string;
  showFullPageLink?: boolean;
  serverBackedFilters?: boolean;
  serverBackedSearch?: boolean;
  onJobsLoaded?: (jobs: any[]) => void;
};

type GenerationJobCounts = {
  all: number;
  failed: number;
  fallback: number;
  patch: number;
  noRewrite: number;
};

function shortHash(value: unknown) {
  const text = String(value || "").trim();
  return text ? text.slice(0, 8) : "";
}

async function sha256Json(value: unknown) {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value)));
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function patchApplied(job: any) {
  return job?.metadata?.copyPatchApplied === true;
}

function aiRewriteCount(job: any) {
  return Number(job?.metadata?.copyAuditSummary?.aiRewritten || 0);
}

function noAiRewrite(job: any) {
  return patchApplied(job) && aiRewriteCount(job) === 0;
}

function copyAuditItems(job: any) {
  const items = job?.metadata?.copyAuditItems;
  return Array.isArray(items) ? items : [];
}

function copyAuditSummary(job: any) {
  const summary = job?.metadata?.copyAuditSummary;
  return summary && typeof summary === "object" ? summary : {};
}

function auditStatusLabel(status: string) {
  if (status === "ai_rewritten") return "AI rewritten";
  if (status === "ai_filled_blank") return "AI filled";
  if (status === "source_kept") return "Source kept";
  if (status === "fallback_source") return "Fallback source";
  if (status === "missing_after") return "Missing after";
  return status || "Unknown";
}

function auditStatusClass(status: string) {
  if (status === "ai_rewritten" || status === "ai_filled_blank") return "bg-emerald-100 text-emerald-800";
  if (status === "fallback_source") return "bg-amber-100 text-amber-900";
  if (status === "missing_after") return "bg-red-100 text-red-800";
  return "bg-slate-100 text-slate-700";
}

function filterJobs(jobs: any[], filter: string) {
  if (filter === "failed") return jobs.filter((job) => job.status === "failed");
  if (filter === "fallback") return jobs.filter((job) => !patchApplied(job));
  if (filter === "patch") return jobs.filter((job) => patchApplied(job));
  if (filter === "noRewrite") return jobs.filter((job) => noAiRewrite(job));
  return jobs;
}

function sortJobs(jobs: any[], sort: string) {
  return [...jobs].sort((a, b) => {
    if (sort === "failed") return Number(b.status === "failed") - Number(a.status === "failed");
    if (sort === "fallback") return Number(!patchApplied(b)) - Number(!patchApplied(a));
    if (sort === "patch") return Number(patchApplied(b)) - Number(patchApplied(a));
    if (sort === "noRewrite") return Number(noAiRewrite(b)) - Number(noAiRewrite(a));
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });
}

export default function GenerationJobsTable({
  storageKeyPrefix,
  fallbackProvider,
  fallbackModel,
  limit,
  variant = "full",
  className = "",
  showFullPageLink = false,
  serverBackedFilters = false,
  serverBackedSearch = false,
  onJobsLoaded,
}: GenerationJobsTableProps) {
  const [jobs, setJobs] = useState<any[]>([]);
  const [remoteCounts, setRemoteCounts] = useState<GenerationJobCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useLocalStorageState(`${storageKeyPrefix}.filter`, "all");
  const [sort, setSort] = useLocalStorageState(`${storageKeyPrefix}.sort`, "newest");
  const [searchQuery, setSearchQuery] = useLocalStorageState(`${storageKeyPrefix}.search`, "");
  const [searchInput, setSearchInput] = useState(searchQuery);
  const [retryingJobId, setRetryingJobId] = useState("");
  const [retryOverrideJobId, setRetryOverrideJobId] = useState("");
  const [copiedKey, setCopiedKey] = useState("");
  const [selectedJob, setSelectedJob] = useState<any>(null);

  const compact = variant === "compact";
  const requestLimit = Math.max(1, Math.min(500, limit || (compact ? 100 : 200)));
  const localCounts = useMemo(() => ({
    all: jobs.length,
    failed: jobs.filter((job) => job.status === "failed").length,
    fallback: jobs.filter((job) => !patchApplied(job)).length,
    patch: jobs.filter((job) => patchApplied(job)).length,
    noRewrite: jobs.filter((job) => noAiRewrite(job)).length,
  }), [jobs]);
  const counts = remoteCounts || localCounts;
  const visibleJobs = useMemo(
    () => sortJobs(serverBackedFilters ? jobs : filterJobs(jobs, filter), sort),
    [jobs, filter, sort, serverBackedFilters],
  );
  const serverFilterKey = serverBackedFilters ? filter : "";
  const serverSearchKey = serverBackedSearch ? searchQuery.trim() : "";
  const activeTotal = remoteCounts
    ? Number(remoteCounts[filter as keyof GenerationJobCounts] ?? remoteCounts.all)
    : jobs.length;
  const canLoadMore = serverBackedFilters && !compact && Boolean(remoteCounts) && jobs.length < activeTotal;
  const selectedAuditItems = copyAuditItems(selectedJob);
  const selectedAuditSummary = copyAuditSummary(selectedJob);

  const fetchJobs = async (append = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    try {
      const params = new URLSearchParams({ limit: String(requestLimit) });
      if (append) {
        params.set("offset", String(jobs.length));
      }
      if (serverBackedFilters) {
        params.set("counts", "1");
        if (filter === "failed") params.set("status", "failed");
        if (filter === "fallback") params.set("patch", "fallback");
        if (filter === "patch") params.set("patch", "applied");
        if (filter === "noRewrite") params.set("aiRewrite", "zero");
      }
      if (serverBackedSearch && searchQuery.trim()) {
        params.set("q", searchQuery.trim());
      }
      const response = await fetch(`/api/generation-jobs?${params.toString()}`);
      const data = await response.json().catch(() => []);
      if (!response.ok) {
        throw new Error(data?.error || `Jobs request failed with HTTP ${response.status}`);
      }
      const rows = Array.isArray(data) ? data : Array.isArray(data?.jobs) ? data.jobs : [];
      if (!Array.isArray(data) && data?.counts) {
        setRemoteCounts({
          all: Number(data.counts.all || 0),
          failed: Number(data.counts.failed || 0),
          fallback: Number(data.counts.fallback || 0),
          patch: Number(data.counts.patch || 0),
          noRewrite: Number(data.counts.noRewrite || 0),
        });
      } else if (!serverBackedFilters) {
        setRemoteCounts(null);
      }
      const nextRows = append ? [...jobs, ...rows] : rows;
      setJobs(nextRows);
      onJobsLoaded?.(nextRows);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load generation jobs.");
    } finally {
      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [requestLimit, serverFilterKey, serverSearchKey]);

  const applySearch = (event?: FormEvent) => {
    event?.preventDefault();
    setSearchQuery(searchInput.trim());
  };

  const clearSearch = () => {
    setSearchInput("");
    setSearchQuery("");
  };

  const copyValue = async (key: string, value: string) => {
    const text = String(value || "").trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((current) => current === key ? "" : current), 1200);
    } catch {
      setMessage("Could not copy to clipboard. Select the ID text manually.");
    }
  };

  const retryGenerationJob = async (job: any) => {
    if (!job.businessId) return;
    setRetryingJobId(job.id);
    try {
      const briefResponse = await fetch(`/api/sites/${encodeURIComponent(job.businessId)}/copy-brief`);
      const briefData = await briefResponse.json().catch(() => ({}));
      if (!briefResponse.ok || briefData.error) {
        throw new Error(briefData.error || `Copy brief returned ${briefResponse.status}`);
      }
      const currentBriefHash = await sha256Json(briefData.copyTargetBrief || {});
      const previousBriefHash = String(job.metadata?.copyBriefHash || "");
      if (previousBriefHash && previousBriefHash !== currentBriefHash && retryOverrideJobId !== job.id) {
        setRetryOverrideJobId(job.id);
        setMessage(`Brief changed for ${job.businessId}. Previous ${shortHash(previousBriefHash)}, current ${shortHash(currentBriefHash)}. Click Retry anyway to use the current brief.`);
        return;
      }

      const siteResponse = await fetch(`/api/sites/${encodeURIComponent(job.businessId)}`);
      const siteJson = await siteResponse.json().catch(() => ({}));
      if (!siteResponse.ok || siteJson.error) {
        throw new Error(siteJson.error || `Site JSON returned ${siteResponse.status}`);
      }

      const meta = siteJson.meta || {};
      const brand = siteJson.brand || {};
      const contact = siteJson.businessProfile?.contact || {};
      const response = await fetch("/api/sites/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: job.provider || fallbackProvider,
          model: job.model || fallbackModel,
          jsonContent: siteJson,
          businessId: job.businessId,
          businessName: meta.businessName || job.metadata?.businessName || job.prospectName || job.businessId,
          phone: contact.phoneInternational || contact.phoneNational || "",
          originData: siteJson.sourceData || {},
          brandPalette: meta.brandPalette || brand.palette || [],
          paletteOptions: brand.paletteOptions || [],
          selectedLogoImageUrl: brand.logoImageUrl || "",
          selectedLogoReference: brand.googlePhotoReference || "",
          selectedLogoSource: brand.photoSource || "",
          selectedLogoAttributions: brand.photoAttributions || [],
          selectedLogoPriority: brand.selectedPhotoPriority || "",
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.error) {
        throw new Error(result.error || `Retry failed with HTTP ${response.status}`);
      }
      setRetryOverrideJobId("");
      setMessage(`Retried ${job.businessId}. New job created from current brief ${shortHash(currentBriefHash)}.`);
      fetchJobs();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Retry generation job failed.");
    } finally {
      setRetryingJobId("");
    }
  };

  const filterOptions = [
    { value: "all", label: "All", count: counts.all },
    { value: "failed", label: "Failed", count: counts.failed },
    { value: "fallback", label: "Fallback", count: counts.fallback },
    { value: "patch", label: "Patch", count: counts.patch },
    { value: "noRewrite", label: "No rewrite", count: counts.noRewrite },
  ];

  return (
    <div className={`${compact ? "rounded-xl border border-slate-200 bg-white p-4" : "rounded-2xl border border-slate-200 bg-white shadow-sm"} ${className}`}>
      <div className={`flex flex-col gap-3 ${compact ? "mb-3" : "border-b border-slate-100 p-4"} lg:flex-row lg:items-center lg:justify-between`}>
        <div>
          <p className={compact ? "font-semibold text-slate-900" : "text-sm font-semibold text-slate-950"}>Generation jobs</p>
          {!compact && <p className="mt-1 text-xs text-slate-500">Filter, sort, and retry generation attempts.</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {serverBackedSearch && !compact && (
            <form onSubmit={applySearch} className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 sm:w-80">
              <Search size={15} className="shrink-0 text-slate-400" />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search business, ID, place ID"
                className="min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-800 outline-none placeholder:text-slate-400"
              />
              {searchQuery && (
                <button type="button" onClick={clearSearch} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Clear search">
                  <X size={14} />
                </button>
              )}
              <button type="submit" className="rounded-md bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white hover:bg-slate-700">
                Search
              </button>
            </form>
          )}
          <div className="inline-flex overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold">
            {filterOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFilter(option.value)}
                className={`${compact ? "px-2.5 py-1.5" : "px-3 py-2"} ${filter === option.value ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-white"}`}
              >
                {option.label} {option.count}
              </button>
            ))}
          </div>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            className={`${compact ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm lg:w-56"} w-full rounded-lg border border-slate-200 bg-white font-semibold text-slate-700 sm:w-auto`}
            aria-label="Sort generation jobs"
          >
            <option value="newest">Newest first</option>
            <option value="failed">Failed first</option>
            <option value="fallback">Fallback first</option>
            <option value="patch">Patch applied first</option>
            <option value="noRewrite">No AI rewrite first</option>
          </select>
          {showFullPageLink && <Link to="/admin/jobs" className="text-xs font-semibold text-indigo-700 hover:underline">Full jobs page</Link>}
          <button type="button" onClick={() => fetchJobs()} className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:underline">
            {loading ? <Loader2 className="animate-spin" size={12} /> : <RefreshCw size={12} />}
            Refresh jobs
          </button>
        </div>
      </div>

      {message && (
        <div className={`${compact ? "mb-3" : "m-4 mb-0"} rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900`}>
          {message}
        </div>
      )}

      <div className={`${compact ? "max-h-80 rounded-lg border border-slate-100" : ""} overflow-auto`}>
        {visibleJobs.length > 0 ? (
          <>
            <table className={`${compact ? "min-w-[920px] text-xs" : "min-w-[980px] text-sm"} w-full text-left`}>
              <thead className={`sticky top-0 z-10 bg-slate-50 ${compact ? "text-[11px]" : "text-xs"} uppercase tracking-wide text-slate-500`}>
                <tr>
                  <th className={`${compact ? "px-3 py-2" : "px-4 py-3"} font-semibold`}>Job</th>
                  <th className={`${compact ? "px-3 py-2" : "px-4 py-3"} font-semibold`}>Status</th>
                  <th className={`${compact ? "px-3 py-2" : "px-4 py-3"} font-semibold`}>Model</th>
                  <th className={`${compact ? "px-3 py-2" : "px-4 py-3"} font-semibold`}>Brief</th>
                  <th className={`${compact ? "px-3 py-2" : "px-4 py-3"} font-semibold`}>Patch</th>
                  <th className={`${compact ? "px-3 py-2" : "px-4 py-3"} font-semibold`}>Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {visibleJobs.map((job) => {
                  const briefHash = shortHash(job.metadata?.copyBriefHash);
                  const patchHash = shortHash(job.metadata?.copyPatchHash);
                  const applied = patchApplied(job);
                  return (
                    <tr key={job.id} className="align-top hover:bg-slate-50">
                    <td className={`${compact ? "max-w-[260px] px-3 py-2" : "max-w-[320px] px-4 py-3"}`}>
                      <p className="truncate font-semibold text-slate-950">{job.prospectName || job.metadata?.businessName || job.businessId || job.placeId}</p>
                      <p className={`${compact ? "text-[11px]" : "text-xs"} mt-0.5 truncate text-slate-500`}>{job.businessId || job.placeId || job.id}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => copyValue(`${job.id}:job`, job.id)}
                          className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-200"
                          title="Copy job ID"
                        >
                          {copiedKey === `${job.id}:job` ? <Check size={11} /> : <Copy size={11} />}
                          Job ID
                        </button>
                        {job.businessId && (
                          <button
                            type="button"
                            onClick={() => copyValue(`${job.id}:business`, job.businessId)}
                            className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-200"
                            title="Copy business ID"
                          >
                            {copiedKey === `${job.id}:business` ? <Check size={11} /> : <Copy size={11} />}
                            Business ID
                          </button>
                        )}
                      </div>
                      {job.error && <p className={`${compact ? "text-[11px]" : "text-xs"} mt-2 line-clamp-2 font-medium text-red-700`}>{job.error}</p>}
                    </td>
                      <td className={`${compact ? "px-3 py-2" : "px-4 py-3"}`}>
                        <span className={`rounded-full ${compact ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"} font-semibold ${
                          job.status === "success" ? "bg-emerald-100 text-emerald-800" : job.status === "failed" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                        }`}>{job.status || "unknown"}</span>
                        <p className={`${compact ? "text-[11px]" : "text-xs"} mt-2 text-slate-500`}>{job.createdAt ? new Date(job.createdAt).toLocaleString() : ""}</p>
                      </td>
                      <td className={`${compact ? "max-w-[180px] px-3 py-2" : "max-w-[210px] px-4 py-3"}`}>
                        <p className="truncate font-medium text-slate-800">{job.provider || "-"}</p>
                        <p className={`${compact ? "text-[11px]" : "text-xs"} truncate text-slate-500`}>{job.model || "-"}</p>
                      </td>
                      <td className={`${compact ? "px-3 py-2" : "px-4 py-3"}`}>
                        {briefHash ? (
                          <span title={job.metadata?.copyBriefHash} className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-semibold text-slate-700">{briefHash}</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className={`${compact ? "px-3 py-2" : "px-4 py-3"}`}>
                        <div className="flex flex-col items-start gap-1.5">
                          {patchHash ? (
                            <span title={job.metadata?.copyPatchHash} className="rounded-md bg-indigo-100 px-2 py-1 font-mono text-xs font-semibold text-indigo-800">{patchHash}</span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${applied ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                            {applied ? (compact ? "applied" : "patch applied") : (compact ? "fallback" : "fallback only")}
                          </span>
                        </div>
                      </td>
                      <td className={`${compact ? "px-3 py-2" : "px-4 py-3"}`}>
                        <div className="flex flex-col items-start gap-2">
                          {job.businessId && (
                            <a href={`/${job.businessId}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-indigo-700 hover:underline">
                              Preview {!compact && <ExternalLink size={12} />}
                            </a>
                          )}
                          {job.businessId && (
                            <button
                              type="button"
                              onClick={() => retryGenerationJob(job)}
                              disabled={Boolean(retryingJobId)}
                              className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-indigo-700 disabled:opacity-50"
                              title="Retry with the current copy brief. If the brief hash changed, the first click warns and the second click confirms."
                            >
                              {retryingJobId === job.id ? <Loader2 className="animate-spin" size={13} /> : <RotateCw size={13} />}
                              {retryOverrideJobId === job.id ? "Retry anyway" : "Retry"}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setSelectedJob(job)}
                            className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-indigo-700"
                            title="Open raw job details"
                          >
                            <FileText size={13} />
                            Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {serverBackedFilters && !compact && remoteCounts && (
              <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
                <span>Showing {jobs.length} of {activeTotal} matching jobs{searchQuery ? ` for "${searchQuery}"` : ""}</span>
                {canLoadMore && (
                  <button
                    type="button"
                    onClick={() => fetchJobs(true)}
                    disabled={loadingMore}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    {loadingMore ? <Loader2 className="animate-spin" size={15} /> : <RefreshCw size={15} />}
                    Load more
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          <div className={`${compact ? "py-6" : "py-16"} text-center text-sm text-slate-500`}>
            {loading ? "Loading generation jobs..." : jobs.length === 0 && filter === "all" ? "No generation jobs yet." : "No jobs match this filter."}
          </div>
        )}
      </div>
      {selectedJob && (
        <div className="fixed inset-0 z-[250] flex justify-end bg-slate-950/30" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            onClick={() => setSelectedJob(null)}
            aria-label="Close job details"
          />
          <aside className="relative flex h-full w-full max-w-xl flex-col overflow-hidden bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">Generation job</p>
                <h2 className="mt-1 truncate text-lg font-bold text-slate-950">
                  {selectedJob.prospectName || selectedJob.metadata?.businessName || selectedJob.businessId || selectedJob.id}
                </h2>
                <p className="mt-1 truncate text-xs text-slate-500">{selectedJob.id}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {selectedJob.businessId && (
                  <button
                    type="button"
                    onClick={() => retryGenerationJob(selectedJob)}
                    disabled={Boolean(retryingJobId)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
                    title="Retry with the current copy brief. If the brief hash changed, the first click warns and the second click confirms."
                  >
                    {retryingJobId === selectedJob.id ? <Loader2 className="animate-spin" size={14} /> : <RotateCw size={14} />}
                    {retryOverrideJobId === selectedJob.id ? "Retry anyway" : "Retry"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedJob(null)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Close job details"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="flex-1 space-y-4 overflow-auto p-5 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ["Status", selectedJob.status || "-"],
                  ["Provider", selectedJob.provider || "-"],
                  ["Model", selectedJob.model || "-"],
                  ["Business ID", selectedJob.businessId || "-"],
                  ["Place ID", selectedJob.placeId || "-"],
                  ["Created", selectedJob.createdAt ? new Date(selectedJob.createdAt).toLocaleString() : "-"],
                  ["Updated", selectedJob.updatedAt ? new Date(selectedJob.updatedAt).toLocaleString() : "-"],
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
                  {selectedJob.error && (
                    <button
                      type="button"
                      onClick={() => copyValue(`${selectedJob.id}:error`, selectedJob.error)}
                      className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200"
                    >
                      {copiedKey === `${selectedJob.id}:error` ? <Check size={12} /> : <Copy size={12} />}
                      Copy
                    </button>
                  )}
                </div>
                <pre className="max-h-40 overflow-auto rounded-xl border border-slate-200 bg-slate-950 p-3 text-xs text-slate-100">
                  {selectedJob.error || "No error recorded."}
                </pre>
              </section>

              <section>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-slate-950">AI copy audit</h3>
                    <p className="mt-0.5 text-xs text-slate-500">Source copy sent to AI and final copy saved after patch/fallback.</p>
                  </div>
                  {selectedAuditItems.length > 0 && (
                    <button
                      type="button"
                      onClick={() => copyValue(`${selectedJob.id}:copy-audit`, JSON.stringify({ summary: selectedAuditSummary, items: selectedAuditItems }, null, 2))}
                      className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200"
                    >
                      {copiedKey === `${selectedJob.id}:copy-audit` ? <Check size={12} /> : <Copy size={12} />}
                      Copy
                    </button>
                  )}
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    ["Sent", selectedAuditSummary.sourceSentencesSentToAi ?? selectedAuditSummary.targetFieldsSentToAi ?? 0],
                    ["AI changed", Number(selectedAuditSummary.aiRewritten || 0) + Number(selectedAuditSummary.aiFilledBlank || 0)],
                    ["Fallback/kept", Number(selectedAuditSummary.fallbackSource || 0) + Number(selectedAuditSummary.sourceKept || 0)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                      <p className="mt-1 text-lg font-bold text-slate-950">{String(value)}</p>
                    </div>
                  ))}
                </div>
                {selectedAuditItems.length > 0 ? (
                  <div className="mt-3 max-h-[42vh] space-y-2 overflow-auto rounded-xl border border-slate-200 bg-white p-2">
                    {selectedAuditItems.map((item: any, index: number) => (
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
                  <button
                    type="button"
                    onClick={() => copyValue(`${selectedJob.id}:metadata`, JSON.stringify(selectedJob.metadata || {}, null, 2))}
                    className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200"
                  >
                    {copiedKey === `${selectedJob.id}:metadata` ? <Check size={12} /> : <Copy size={12} />}
                    Copy
                  </button>
                </div>
                <pre className="max-h-[45vh] overflow-auto rounded-xl border border-slate-200 bg-slate-950 p-3 text-xs text-slate-100">
                  {JSON.stringify(selectedJob.metadata || {}, null, 2)}
                </pre>
              </section>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

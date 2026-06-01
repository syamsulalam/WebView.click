import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Copy, ExternalLink, FileText, Loader2, RefreshCw, RotateCw, Search, X } from "lucide-react";
import { useLocalStorageState } from "../lib/localStorageState";
import { chunkedGenerationState } from "../lib/generationJobState";
import { resolveAiServiceCopyProviderMode, serviceCopyPlanText } from "../lib/aiSlowProviderMode";
import AdminAiReadinessBadge from "./AdminAiReadinessBadge";
import HelpTooltip from "./HelpTooltip";
import HoverTooltip from "./HoverTooltip";
import GenerationJobDetailsDrawer from "./generation-jobs/GenerationJobDetailsDrawer";
import { useGenerationJobRetry } from "./generation-jobs/useGenerationJobRetry";
import ProviderServiceCopyModeBadge from "./ProviderServiceCopyModeBadge";
import {
  cooldownBlocked,
  filterJobs,
  lowOfferingCopyCoverage,
  noAiRewrite,
  offeringCopyCoverage,
  offeringCopyCoverageClass,
  offeringCopyCoverageLabel,
  offeringCopyCoverageTooltip,
  patchApplied,
  shortHash,
  sortJobs,
  type GenerationJobCounts,
} from "./generation-jobs/jobUtils";

type GenerationJobsTableProps = {
  storageKeyPrefix: string;
  fallbackProvider: string;
  fallbackModel: string;
  providerKeyStatus?: Record<string, boolean | null | undefined>;
  settings?: Record<string, unknown>;
  onSettingsChange?: (nextSettings: Record<string, string>) => void;
  limit?: number;
  variant?: "compact" | "full";
  className?: string;
  showFullPageLink?: boolean;
  serverBackedFilters?: boolean;
  serverBackedSearch?: boolean;
  initialSearchQuery?: string;
  openJobId?: string;
  onJobsLoaded?: (jobs: any[]) => void;
};

export default function GenerationJobsTable({
  storageKeyPrefix,
  fallbackProvider,
  fallbackModel,
  providerKeyStatus = {},
  settings = {},
  onSettingsChange,
  limit,
  variant = "full",
  className = "",
  showFullPageLink = false,
  serverBackedFilters = false,
  serverBackedSearch = false,
  initialSearchQuery = "",
  openJobId = "",
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
  const [copiedKey, setCopiedKey] = useState("");
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [autoOpenedJobId, setAutoOpenedJobId] = useState("");

  const compact = variant === "compact";
  const requestLimit = Math.max(1, Math.min(500, limit || (compact ? 100 : 200)));
  const localCounts = useMemo(() => ({
    all: jobs.length,
    failed: jobs.filter((job) => job.status === "failed").length,
    preflight: jobs.filter((job) => job?.metadata?.preflightBlocked === true).length,
    fallback: jobs.filter((job) => !patchApplied(job)).length,
    patch: jobs.filter((job) => patchApplied(job)).length,
    noRewrite: jobs.filter((job) => noAiRewrite(job)).length,
    lowOfferingCoverage: jobs.filter((job) => lowOfferingCopyCoverage(job)).length,
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

  const retryReadiness = (job: any) => {
    const provider = job?.provider || fallbackProvider;
    return {
      provider,
      model: job?.model || fallbackModel,
      hasApiKey: providerKeyStatus[provider] ?? null,
    };
  };

  const serviceCopyContext = (job: any, reset = false) => {
    const provider = job?.provider || fallbackProvider;
    const model = job?.model || fallbackModel;
    const coverage = offeringCopyCoverage(job);
    const total = Number(job?.metadata?.offeringCopyTotal || coverage.total || 0);
    const completed = Number(job?.metadata?.offeringCopyCursor || 0);
    return {
      provider,
      model,
      mode: resolveAiServiceCopyProviderMode(settings, provider, model),
      estimate: serviceCopyPlanText({ provider, model, settings, total, completed, reset }),
    };
  };

  const {
    retryingJobId,
    retryingChunkStep,
    retryingCopyOnlyJobId,
    retryOverrideJobId,
    retryGenerationJob,
    retryChunkedStep,
    retryCopyOnly,
  } = useGenerationJobRetry({
    fallbackProvider,
    fallbackModel,
    setJobs,
    setSelectedJob,
    setMessage,
    refreshJobs: () => fetchJobs(),
  });

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
        if (filter === "preflight") params.set("preflight", "blocked");
        if (filter === "fallback") params.set("patch", "fallback");
        if (filter === "patch") params.set("patch", "applied");
        if (filter === "noRewrite") params.set("aiRewrite", "zero");
        if (filter === "lowOfferingCoverage") params.set("offeringCoverage", "low");
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
          preflight: Number(data.counts.preflight || 0),
          fallback: Number(data.counts.fallback || 0),
          patch: Number(data.counts.patch || 0),
          noRewrite: Number(data.counts.noRewrite || 0),
          lowOfferingCoverage: Number(data.counts.lowOfferingCoverage || 0),
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

  useEffect(() => {
    const incomingSearch = initialSearchQuery.trim();
    if (!incomingSearch) return;
    setFilter("all");
    setSearchInput(incomingSearch);
    setSearchQuery(incomingSearch);
  }, [initialSearchQuery, setFilter, setSearchQuery]);

  useEffect(() => {
    if (!openJobId) {
      setAutoOpenedJobId("");
      return;
    }
    if (autoOpenedJobId === openJobId) return;
    const matchingJob = jobs.find((job) => job.id === openJobId);
    if (!matchingJob) return;
    setSelectedJob(matchingJob);
    setAutoOpenedJobId(openJobId);
  }, [openJobId, jobs, autoOpenedJobId]);

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

  const exportVisibleJobs = async () => {
    const copyOnlyRetryChangedDelta = (job: any) => {
      const delta = job.metadata?.copyOnlyRetryCoverageDelta;
      if (!delta || typeof delta !== "object") return null;
      const beforeChanged = Number(delta.before?.changed);
      const afterChanged = Number(delta.after?.changed);
      return Number.isFinite(beforeChanged) && Number.isFinite(afterChanged) ? afterChanged - beforeChanged : null;
    };
    const payload = {
      exportedAt: new Date().toISOString(),
      source: "generation_jobs_table",
      filter,
      sort,
      searchQuery,
      count: visibleJobs.length,
      jobs: visibleJobs.map((job) => ({
        id: job.id,
        status: job.status,
        provider: job.provider,
        model: job.model,
        businessId: job.businessId,
        placeId: job.placeId,
        prospectName: job.prospectName || job.metadata?.businessName || "",
        error: job.error || "",
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        generationMode: job.metadata?.generationMode || "",
        failureStage: job.metadata?.failureStage || "",
        failureMessage: job.metadata?.failureMessage || "",
        preflightBlocked: job.metadata?.preflightBlocked === true,
        cooldownBlocked: job.metadata?.cooldownBlocked === true,
        providerCooldown: job.metadata?.providerCooldown || null,
        aiReadiness: job.metadata?.aiReadiness || null,
        remoteValidation: job.metadata?.remoteValidation || job.metadata?.aiReadiness?.remoteValidation || null,
        copyPatchApplied: job.metadata?.copyPatchApplied === true,
        copyAuditSummary: job.metadata?.copyAuditSummary || null,
        offeringCopyCoverage: job.metadata?.offeringCopyCoverage || null,
        offeringCopyMode: job.metadata?.offeringCopyMode || null,
        conversionPagePattern: job.metadata?.conversionPagePattern || job.metadata?.conversionAudit?.pagePattern || "",
        conversionPrimaryAction: job.metadata?.conversionPrimaryAction || job.metadata?.conversionAudit?.primaryAction || "",
        conversionAudit: job.metadata?.conversionAudit || null,
        designIntent: job.metadata?.designIntent || null,
        designAudit: job.metadata?.designAudit || null,
        copyOnlyRetryCoverageDelta: job.metadata?.copyOnlyRetryCoverageDelta || null,
        copyOnlyRetryChangedDelta: copyOnlyRetryChangedDelta(job),
      })),
    };
    await copyValue("jobs:compact-export", JSON.stringify(payload, null, 2));
  };

  const filterOptions = [
    { value: "all", label: "All", count: counts.all },
    { value: "failed", label: "Failed", count: counts.failed },
    { value: "preflight", label: "Preflight blocked", count: counts.preflight },
    { value: "fallback", label: "Fallback", count: counts.fallback },
    { value: "patch", label: "Patch", count: counts.patch },
    { value: "noRewrite", label: "No rewrite", count: counts.noRewrite },
    { value: "lowOfferingCoverage", label: "Low service copy", count: counts.lowOfferingCoverage },
  ];

  const copyRetryModeForJob = (job: any): "offerings" | "allCopy" | "" => {
    const canRetryCopyChunks = Boolean(job.metadata?.chunked || job.metadata?.parentGenerationJobId);
    if (!canRetryCopyChunks) return "";
    if (lowOfferingCopyCoverage(job)) return "offerings";
    if (noAiRewrite(job)) return "allCopy";
    if (filter === "lowOfferingCoverage") return "offerings";
    if (filter === "noRewrite") return "allCopy";
    return "";
  };

  const chunkedStepLabel = (step: string) => {
    if (step === "outline") return "Outline";
    if (step === "siteCopy") return "Site copy";
    if (step === "offeringCopy") return "Service copy";
    if (step === "finalize") return "Finalize";
    return step || "step";
  };

  return (
    <div className={`${compact ? "rounded-xl border border-slate-200 bg-white p-4" : "rounded-2xl border border-slate-200 bg-white shadow-sm"} ${className}`}>
      <div className={`flex flex-col gap-3 ${compact ? "mb-3" : "border-b border-slate-100 p-4"} lg:flex-row lg:items-center lg:justify-between`}>
        <div>
          <p className={`${compact ? "font-semibold text-slate-900" : "text-sm font-semibold text-slate-950"} inline-flex items-center gap-1.5`}>
            Generation jobs
            <HelpTooltip
              widthClass="w-80"
              text="Preflight blocked means AI readiness or provider cooldown stopped the click before full generation. Fallback means no AI copy patch was applied. Patch means AI copy was merged into the deterministic site JSON. No rewrite means the patch ran but did not change source copy. Low service copy means fewer than half of service/product pages changed summary, description, highlights, or FAQ."
            />
          </p>
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
                <HoverTooltip text="Clear the generation jobs search query.">
                  <button type="button" onClick={clearSearch} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Clear search">
                    <X size={14} />
                  </button>
                </HoverTooltip>
              )}
              <HoverTooltip text="Search generation jobs by business, job ID, place ID, or metadata.">
                <button type="submit" className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-slate-900 text-white hover:bg-slate-700" aria-label="Search generation jobs">
                  <Search size={13} />
                </button>
              </HoverTooltip>
            </form>
          )}
          <div className="inline-flex items-center gap-1.5">
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
            {!compact && <HelpTooltip text="These filters can be server-backed on the full jobs page, so older jobs outside the first loaded page can still be found." />}
          </div>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            className={`${compact ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm lg:w-56"} w-full rounded-lg border border-slate-200 bg-white font-semibold text-slate-700 sm:w-auto`}
            aria-label="Sort generation jobs"
          >
            <option value="newest">Newest first</option>
            <option value="failed">Failed first</option>
            <option value="preflight">Preflight blocked first</option>
            <option value="fallback">Fallback first</option>
            <option value="patch">Patch applied first</option>
            <option value="noRewrite">No AI rewrite first</option>
            <option value="lowOfferingCoverage">Low service copy first</option>
          </select>
          <HoverTooltip text="Copy compact JSON for the currently visible generation jobs.">
            <button
              type="button"
              onClick={exportVisibleJobs}
              disabled={!visibleJobs.length}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50"
              aria-label="Export visible generation jobs"
            >
              {copiedKey === "jobs:compact-export" ? <Check size={12} /> : <Copy size={12} />}
            </button>
          </HoverTooltip>
          {showFullPageLink && <Link to="/admin/jobs" className="text-xs font-semibold text-indigo-700 hover:underline">Full jobs page</Link>}
          <HoverTooltip text="Reload generation jobs from D1 with the current filters.">
            <button type="button" onClick={() => fetchJobs()} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-indigo-700 hover:bg-indigo-50" aria-label="Refresh generation jobs">
              {loading ? <Loader2 className="animate-spin" size={12} /> : <RefreshCw size={12} />}
            </button>
          </HoverTooltip>
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
                  const displayBriefHash = job.metadata?.finalCopyBriefHash || job.metadata?.copyBriefHash;
                  const briefHash = shortHash(displayBriefHash);
                  const patchHash = shortHash(job.metadata?.copyPatchHash);
                  const applied = patchApplied(job);
                  const blockedByCooldown = cooldownBlocked(job);
                  const readiness = retryReadiness(job);
                  const chunkedState = chunkedGenerationState(job);
                  const offeringCoverage = offeringCopyCoverage(job);
                  const copyRetryMode = copyRetryModeForJob(job);
                  const copyRetryKey = copyRetryMode ? `${job.id}:${copyRetryMode}` : "";
                  const chunkedRunnableStep = chunkedState.retryStep || (job.status === "running" ? chunkedState.nextStep : "");
                  const chunkedRetryKey = chunkedRunnableStep ? `${job.id}:${chunkedRunnableStep}` : "";
                  const offeringCopyCursor = Number(job.metadata?.offeringCopyCursor || 0);
                  const offeringCopyTotal = Number(job.metadata?.offeringCopyTotal || 0);
                  const offeringCopyInProgress = chunkedState.chunked && offeringCopyTotal > 0 && chunkedState.nextStep === "offeringCopy";
                  const chunkedServiceCopyContext = chunkedRunnableStep === "offeringCopy" ? serviceCopyContext(job) : null;
                  const copyRetryServiceCopyContext = copyRetryMode === "offerings" || copyRetryMode === "allCopy" ? serviceCopyContext(job, true) : null;
                  return (
                    <tr key={job.id} className="align-top hover:bg-slate-50">
                    <td className={`${compact ? "max-w-[260px] px-3 py-2" : "max-w-[320px] px-4 py-3"}`}>
                      <p className="truncate font-semibold text-slate-950">{job.prospectName || job.metadata?.businessName || job.businessId || job.placeId}</p>
                      <p className={`${compact ? "text-[11px]" : "text-xs"} mt-0.5 truncate text-slate-500`}>{job.businessId || job.placeId || job.id}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <HoverTooltip text="Copy job ID" widthClass="w-28">
                          <button
                            type="button"
                            onClick={() => copyValue(`${job.id}:job`, job.id)}
                            className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-200"
                          >
                            {copiedKey === `${job.id}:job` ? <Check size={11} /> : <Copy size={11} />}
                            Job ID
                          </button>
                        </HoverTooltip>
                        {job.businessId && (
                          <HoverTooltip text="Copy business ID" widthClass="w-36">
                            <button
                              type="button"
                              onClick={() => copyValue(`${job.id}:business`, job.businessId)}
                              className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-200"
                            >
                              {copiedKey === `${job.id}:business` ? <Check size={11} /> : <Copy size={11} />}
                              Business ID
                            </button>
                          </HoverTooltip>
                        )}
                      </div>
                      {job.error && <p className={`${compact ? "text-[11px]" : "text-xs"} mt-2 line-clamp-2 font-medium text-red-700`}>{job.error}</p>}
                    </td>
                      <td className={`${compact ? "px-3 py-2" : "px-4 py-3"}`}>
                        <span className={`rounded-full ${compact ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"} font-semibold ${
                          job.status === "success" ? "bg-emerald-100 text-emerald-800" : job.status === "failed" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                        }`}>{job.status || "unknown"}</span>
                        {blockedByCooldown && (
                          <span className="mt-1.5 block w-fit rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                            cooldown blocked
                          </span>
                        )}
                        {chunkedState.chunked && (
                          <span className="mt-1.5 block w-fit rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-800">
                            {job.status === "success" ? "chunked done" : `chunked ${chunkedState.nextStep || chunkedState.failureStep || "pending"}`}
                          </span>
                        )}
                        {offeringCopyInProgress && (
                          <span className="mt-1.5 block w-fit rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-800">
                            service copy {Math.min(offeringCopyCursor, offeringCopyTotal)}/{offeringCopyTotal}
                          </span>
                        )}
                        <p className={`${compact ? "text-[11px]" : "text-xs"} mt-2 text-slate-500`}>{job.createdAt ? new Date(job.createdAt).toLocaleString() : ""}</p>
                      </td>
                      <td className={`${compact ? "max-w-[180px] px-3 py-2" : "max-w-[210px] px-4 py-3"}`}>
                        <p className="truncate font-medium text-slate-800">{job.provider || "-"}</p>
                        <p className={`${compact ? "text-[11px]" : "text-xs"} truncate text-slate-500`}>{job.model || "-"}</p>
                      </td>
                      <td className={`${compact ? "px-3 py-2" : "px-4 py-3"}`}>
                        {briefHash ? (
                          <HoverTooltip text={displayBriefHash} widthClass="w-80">
                            <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-semibold text-slate-700">{briefHash}</span>
                          </HoverTooltip>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className={`${compact ? "px-3 py-2" : "px-4 py-3"}`}>
                        <div className="flex flex-col items-start gap-1.5">
                          {patchHash ? (
                            <HoverTooltip text={job.metadata?.copyPatchHash} widthClass="w-80">
                              <span className="rounded-md bg-indigo-100 px-2 py-1 font-mono text-xs font-semibold text-indigo-800">{patchHash}</span>
                            </HoverTooltip>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${applied ? "bg-emerald-100 text-emerald-800" : blockedByCooldown ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-600"}`}>
                            {applied ? (compact ? "applied" : "patch applied") : blockedByCooldown ? "blocked before AI" : (compact ? "fallback" : "fallback only")}
                          </span>
                          {(offeringCoverage.total > 0 || job.metadata?.offeringCopyPatch) && (
                            <HoverTooltip text={offeringCopyCoverageTooltip(offeringCoverage)} widthClass="w-80">
                              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${offeringCopyCoverageClass(offeringCoverage)}`}>
                                {offeringCopyCoverageLabel(offeringCoverage)}
                              </span>
                            </HoverTooltip>
                          )}
                          {job.metadata?.conversionAudit && (
                            <HoverTooltip
                              text={`Pattern: ${job.metadata?.conversionPagePattern || job.metadata.conversionAudit.pagePattern || "-"}; primary action: ${job.metadata?.conversionPrimaryAction || job.metadata.conversionAudit.primaryAction || "-"}; flags: ${(job.metadata.conversionAudit.flags || []).join(", ") || "none"}`}
                              widthClass="w-80"
                            >
                              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                Array.isArray(job.metadata.conversionAudit.flags) && job.metadata.conversionAudit.flags.length
                                  ? "bg-amber-100 text-amber-900"
                                  : "bg-emerald-100 text-emerald-800"
                              }`}>
                                conversion {Array.isArray(job.metadata.conversionAudit.flags) && job.metadata.conversionAudit.flags.length ? `${job.metadata.conversionAudit.flags.length} flags` : "ready"}
                              </span>
                            </HoverTooltip>
                          )}
                          {job.metadata?.designAudit && (
                            <HoverTooltip
                              text={`Layout: ${job.metadata?.designAudit?.heroLayout || job.metadata?.designIntent?.heroLayout || "-"}; media: ${job.metadata?.designAudit?.mediaStrategy || job.metadata?.designIntent?.mediaStrategy || "-"}; flags: ${(job.metadata.designAudit.flags || []).join(", ") || "none"}`}
                              widthClass="w-80"
                            >
                              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                Array.isArray(job.metadata.designAudit.flags) && job.metadata.designAudit.flags.length
                                  ? "bg-amber-100 text-amber-900"
                                  : "bg-sky-100 text-sky-800"
                              }`}>
                                design {Array.isArray(job.metadata.designAudit.flags) && job.metadata.designAudit.flags.length ? `${job.metadata.designAudit.flags.length} flags` : "ready"}
                              </span>
                            </HoverTooltip>
                          )}
                        </div>
                      </td>
                      <td className={`${compact ? "px-3 py-2" : "px-4 py-3"}`}>
                        <div className="flex flex-col items-start gap-2">
                          {job.businessId && (
                            <a href={`/${job.businessId}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-indigo-700 hover:underline">
                              {compact ? "Preview" : "Open preview"} <ExternalLink size={12} />
                            </a>
                          )}
                          {job.businessId && (
                            <div className="flex flex-wrap items-center gap-2">
                              {chunkedState.chunked && chunkedRunnableStep && (
                                <HoverTooltip text={`${chunkedServiceCopyContext ? `${chunkedServiceCopyContext.estimate} ` : ""}Continue only the current chunked step. Use this when a job stopped midway after a provider/edge error.`} widthClass="w-80">
                                  <button
                                    type="button"
                                    onClick={() => retryChunkedStep(job, chunkedRunnableStep as any)}
                                    disabled={Boolean(retryingJobId || retryingChunkStep || retryingCopyOnlyJobId)}
                                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold disabled:opacity-50 ${
                                      job.status === "failed"
                                        ? "bg-red-50 text-red-800 hover:bg-red-100"
                                        : "bg-amber-50 text-amber-900 hover:bg-amber-100"
                                    }`}
                                    aria-label={`${job.status === "failed" ? "Retry failed" : "Resume"} ${chunkedStepLabel(chunkedRunnableStep)} step`}
                                  >
                                    {retryingChunkStep === chunkedRetryKey ? <Loader2 className="animate-spin" size={13} /> : <RotateCw size={13} />}
                                    {job.status === "failed" ? "Retry" : "Resume"} {chunkedStepLabel(chunkedRunnableStep)}
                                  </button>
                                </HoverTooltip>
                              )}
                              {copyRetryMode && (
                                <HoverTooltip text={copyRetryMode === "offerings"
                                  ? `${copyRetryServiceCopyContext?.estimate || ""} Retry only the offering-copy chunk, then finalize to save service page copy and short submenu labels. Uses the chunked parent job when this row is a final save job.`
                                  : `${copyRetryServiceCopyContext?.estimate || ""} Retry site-copy and offering-copy chunks, then finalize. This fills missing About-page copy and service submenu labels without rerunning the outline step.`
                                } widthClass="w-80">
                                  <button
                                    type="button"
                                    onClick={() => retryCopyOnly(job, copyRetryMode)}
                                    disabled={Boolean(retryingJobId || retryingChunkStep || retryingCopyOnlyJobId)}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-800 hover:bg-indigo-100 disabled:opacity-50"
                                    aria-label={copyRetryMode === "offerings" ? "Retry service copy and submenu labels" : "Retry missing copy chunks"}
                                  >
                                    {retryingCopyOnlyJobId === copyRetryKey ? <Loader2 className="animate-spin" size={13} /> : <RotateCw size={13} />}
                                    {copyRetryMode === "offerings" ? "Improve services" : "Fill missing copy"}
                                  </button>
                                </HoverTooltip>
                              )}
                              {(chunkedServiceCopyContext || copyRetryServiceCopyContext) && (
                                <ProviderServiceCopyModeBadge
                                  provider={(chunkedServiceCopyContext || copyRetryServiceCopyContext)!.provider}
                                  model={(chunkedServiceCopyContext || copyRetryServiceCopyContext)!.model}
                                  currentSlowMode={(chunkedServiceCopyContext || copyRetryServiceCopyContext)!.mode.slowMode}
                                  settings={settings}
                                  onSettingsChange={onSettingsChange}
                                />
                              )}
                              <HoverTooltip text="Start a brand-new full generation retry from the current saved site and current copy brief. This is heavier than resuming a chunked step.">
                                <button
                                  type="button"
                                  onClick={() => retryGenerationJob(job)}
                                  disabled={Boolean(retryingJobId || retryingChunkStep || retryingCopyOnlyJobId)}
                                  className={`${compact ? "h-8 w-8 justify-center" : "h-8 px-2.5"} inline-flex items-center gap-1.5 rounded-lg text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50`}
                                  aria-label={retryOverrideJobId === job.id ? "Retry generation job anyway" : "Retry generation job"}
                                >
                                  {retryingJobId === job.id ? <Loader2 className="animate-spin" size={13} /> : <RotateCw size={13} />}
                                  {!compact && <span className="text-xs font-semibold">{retryOverrideJobId === job.id ? "Retry anyway" : "Full retry"}</span>}
                                </button>
                              </HoverTooltip>
                              <AdminAiReadinessBadge
                                provider={readiness.provider}
                                model={readiness.model}
                                hasApiKey={readiness.hasApiKey}
                                requiresAi
                              />
                            </div>
                          )}
                          <HoverTooltip text="Open generation job drawer with raw metadata, chunked step status, returned AI work, and retry-step controls.">
                            <button
                              type="button"
                              onClick={() => setSelectedJob(job)}
                              className={`${compact ? "h-8 w-8 justify-center" : "h-8 px-2.5"} inline-flex items-center gap-1.5 rounded-lg text-slate-700 hover:bg-indigo-50 hover:text-indigo-700`}
                              aria-label="Open generation job details"
                            >
                              <FileText size={13} />
                              {!compact && <span className="text-xs font-semibold">Job details</span>}
                            </button>
                          </HoverTooltip>
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
                  <HoverTooltip text="Load the next page of matching generation jobs from D1.">
                    <button
                      type="button"
                      onClick={() => fetchJobs(true)}
                      disabled={loadingMore}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      aria-label="Load more generation jobs"
                    >
                      {loadingMore ? <Loader2 className="animate-spin" size={15} /> : <RefreshCw size={15} />}
                    </button>
                  </HoverTooltip>
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
        <GenerationJobDetailsDrawer
          job={selectedJob}
          fallbackProvider={fallbackProvider}
          fallbackModel={fallbackModel}
          providerKeyStatus={providerKeyStatus}
          settings={settings}
          onSettingsChange={onSettingsChange}
          retryingJobId={retryingJobId}
          retryingChunkStep={retryingChunkStep}
          retryOverrideJobId={retryOverrideJobId}
          copiedKey={copiedKey}
          onClose={() => setSelectedJob(null)}
          onCopyValue={copyValue}
          onRetryGenerationJob={retryGenerationJob}
          onRetryChunkedStep={retryChunkedStep}
        />
      )}
    </div>
  );
}

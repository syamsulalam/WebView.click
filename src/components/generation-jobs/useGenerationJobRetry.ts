import { useState, type Dispatch, type SetStateAction } from "react";
import { checkAiReadiness, logAiReadinessBlockedJob } from "../../lib/aiReadiness";
import { readApiJson } from "../../lib/apiResponse";
import { postChunkedGenerateSite } from "../../lib/adminSiteGeneration";
import {
  CHUNKED_GENERATION_STEPS,
  chunkedGenerationState,
  type ChunkedGenerationStep,
} from "../../lib/generationJobState";
import { formatCooldownRemaining, getSharedProviderCooldown, logProviderCooldownBlockedJob } from "../../lib/providerCooldown";
import { useAdminToast } from "../AdminToast";
import { offeringCopyCoverage, shortHash } from "./jobUtils";

type UseGenerationJobRetryOptions = {
  fallbackProvider: string;
  fallbackModel: string;
  setJobs: Dispatch<SetStateAction<any[]>>;
  setSelectedJob: Dispatch<SetStateAction<any>>;
  setMessage: Dispatch<SetStateAction<string>>;
  refreshJobs: () => void | Promise<void>;
};

async function sha256Json(value: unknown) {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value)));
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isTransientStepError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return /HTTP\s*(502|503|504|524)|Cloudflare\/HTML|temporar|upstream network|network_error|provider_temporary|empty_response|returned HTML|did not return normally/i.test(message);
}

export function useGenerationJobRetry({
  fallbackProvider,
  fallbackModel,
  setJobs,
  setSelectedJob,
  setMessage,
  refreshJobs,
}: UseGenerationJobRetryOptions) {
  const { showApiError } = useAdminToast();
  const [retryingJobId, setRetryingJobId] = useState("");
  const [retryingChunkStep, setRetryingChunkStep] = useState("");
  const [retryingCopyOnlyJobId, setRetryingCopyOnlyJobId] = useState("");
  const [retryOverrideJobId, setRetryOverrideJobId] = useState("");

  const retryGenerationJob = async (job: any) => {
    if (!job.businessId) return;
    setRetryingJobId(job.id);
    try {
      const retryProvider = job.provider || fallbackProvider;
      const retryModel = job.model || fallbackModel;
      const cooldown = await getSharedProviderCooldown(retryProvider, true);
      if (cooldown) {
        const message = `${retryProvider} is cooling down for ${formatCooldownRemaining(cooldown)} after a quota/rate-limit error. Retry is paused to avoid another 429.`;
        await logProviderCooldownBlockedJob({
          provider: retryProvider,
          model: retryModel,
          cooldown,
          action: "job_retry",
          businessId: job.businessId,
          placeId: job.placeId,
          businessName: job.prospectName || job.metadata?.businessName || job.businessId,
          message,
        });
        throw new Error(message);
      }

      const readiness = await checkAiReadiness(retryProvider, retryModel, true, true);
      if (!readiness.ready) {
        const message = readiness.message || "AI provider/model is not ready. Check /admin/settings before retrying.";
        await logAiReadinessBlockedJob({
          provider: retryProvider,
          model: retryModel,
          readiness,
          action: "job_retry",
          businessId: job.businessId,
          placeId: job.placeId,
          businessName: job.prospectName || job.metadata?.businessName || job.businessId,
          message,
        });
        throw new Error(message);
      }

      const briefResponse = await fetch(`/api/sites/${encodeURIComponent(job.businessId)}/copy-brief`);
      const briefData = await briefResponse.json().catch(() => ({}));
      if (!briefResponse.ok || briefData.error) {
        throw new Error(briefData.error || `Copy brief returned ${briefResponse.status}`);
      }
      const currentBriefHash = await sha256Json(briefData.copyTargetBrief || {});
      const previousBriefHash = String(job.metadata?.finalCopyBriefHash || job.metadata?.copyBriefHash || "");
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
      await postChunkedGenerateSite({
        requireAi: true,
        provider: retryProvider,
        model: retryModel,
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
      }, "Retry generation job");
      setRetryOverrideJobId("");
      setMessage(`Retried ${job.businessId}. New job created from current brief ${shortHash(currentBriefHash)}.`);
      void refreshJobs();
    } catch (error) {
      if (!(error instanceof Error && error.message.includes("cooling down"))) {
        showApiError(error, { source: "Retry generation job", provider: job?.provider || fallbackProvider, model: job?.model || fallbackModel });
      }
      setMessage(error instanceof Error ? error.message : "Retry generation job failed.");
    } finally {
      setRetryingJobId("");
    }
  };

  const runChunkedStepRequest = async (jobId: string, step: ChunkedGenerationStep, label: string, extraBody: Record<string, unknown> = {}) => {
    let data: any = null;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const response = await fetch(`/api/generation-jobs/${encodeURIComponent(jobId)}/run-step`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ step, ...extraBody }),
        });
        data = await readApiJson<any>(response, `${label} ${step} step`);
        break;
      } catch (error) {
        if (attempt >= 2 || !isTransientStepError(error)) throw error;
        for (let seconds = 60; seconds > 0; seconds -= 1) {
          setMessage(`${step} hit a temporary provider/edge failure. Auto retry in ${seconds}s...`);
          await sleep(1000);
        }
        setMessage(`Retrying ${step} step now...`);
      }
    }
    return data;
  };

  const runOfferingCopyUntilFinalizeReady = async (
    jobId: string,
    label: string,
    firstExtraBody: Record<string, unknown> = {},
  ) => {
    let data: any = null;
    for (let attempt = 0; attempt < 24; attempt += 1) {
      data = await runChunkedStepRequest(jobId, "offeringCopy", label, attempt === 0 ? firstExtraBody : {});
      const completed = Number(data?.progress?.completed ?? data?.metadata?.offeringCopyCursor ?? 0);
      const total = Number(data?.progress?.total ?? data?.metadata?.offeringCopyTotal ?? 0);
      const itemTitle = String(data?.progress?.itemTitle || data?.metadata?.offeringCopyLastItem?.title || "").trim();
      if (total > 0) {
        setMessage(`Service copy ${Math.min(completed, total)}/${total}${itemTitle ? `: ${itemTitle}` : ""}`);
      }
      if (data?.completedStep === "offeringCopy" || data?.nextStep !== "offeringCopy") return data;
    }
    throw new Error("Service copy is still not ready to finalize after 24 item retries. Refresh jobs and resume Service copy again.");
  };

  const resolveChunkedRetryJob = async (job: any) => {
    if (chunkedGenerationState(job).chunked) return job;
    const parentId = String(job?.metadata?.parentGenerationJobId || "");
    if (!parentId) throw new Error("This job does not have a chunked parent job for copy-only retry.");
    const response = await fetch(`/api/generation-jobs?limit=20&q=${encodeURIComponent(parentId)}`);
    const data = await readApiJson<any>(response, "Load parent chunked generation job");
    const rows = Array.isArray(data) ? data : Array.isArray(data?.jobs) ? data.jobs : [];
    const parentJob = rows.find((row: any) => row.id === parentId);
    if (!parentJob) throw new Error(`Parent chunked job ${parentId} was not found.`);
    if (!chunkedGenerationState(parentJob).chunked) throw new Error(`Parent job ${parentId} is not a chunked generation job.`);
    return parentJob;
  };

  const loadGenerationJobById = async (jobId: string) => {
    if (!jobId) return null;
    const response = await fetch(`/api/generation-jobs?limit=20&q=${encodeURIComponent(jobId)}`);
    const data = await readApiJson<any>(response, "Load generation job");
    const rows = Array.isArray(data) ? data : Array.isArray(data?.jobs) ? data.jobs : [];
    return rows.find((row: any) => row.id === jobId) || null;
  };

  const retryChunkedStep = async (job: any, requestedStep?: ChunkedGenerationStep) => {
    const state = chunkedGenerationState(job);
    const step = requestedStep || state.retryStep || state.nextStep;
    if (!state.chunked || !step) return;
    const retryKey = `${job.id}:${step}`;
    setRetryingChunkStep(retryKey);
    try {
      const data = step === "offeringCopy"
        ? await runOfferingCopyUntilFinalizeReady(job.id, "Retry")
        : await runChunkedStepRequest(job.id, step, "Retry");
      const nextStatus = data.completedStep === "finalize" ? "success" : "running";
      const nextJob = {
        ...job,
        businessId: data.result?.businessId || job.businessId,
        status: nextStatus,
        error: "",
        metadata: data.metadata || job.metadata,
        updatedAt: new Date().toISOString(),
      };
      setJobs((currentJobs) => currentJobs.map((currentJob) => currentJob.id === job.id ? { ...currentJob, ...nextJob } : currentJob));
      setSelectedJob((currentJob: any) => currentJob?.id === job.id ? { ...currentJob, ...nextJob } : currentJob);
      setMessage(data.completedStep === "finalize"
        ? `Finalized ${job.businessId || job.id}. The generated site was saved.`
        : `${CHUNKED_GENERATION_STEPS.find((item) => item.key === step)?.label || step} step completed. Next step: ${data.nextStep || "done"}.`
      );
      void refreshJobs();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : `Retry ${step} step failed.`;
      const failedMetadata = {
        ...(job.metadata || {}),
        failureStage: `chunked_${step}`,
        failureMessage: errorMessage,
        nextStep: step,
      };
      const failedJob = {
        ...job,
        status: "failed",
        error: errorMessage,
        metadata: failedMetadata,
        updatedAt: new Date().toISOString(),
      };
      setJobs((currentJobs) => currentJobs.map((currentJob) => currentJob.id === job.id ? { ...currentJob, ...failedJob } : currentJob));
      setSelectedJob((currentJob: any) => currentJob?.id === job.id ? { ...currentJob, ...failedJob } : currentJob);
      showApiError(error, { source: `Retry ${step} generation step`, provider: job?.provider || fallbackProvider, model: job?.model || fallbackModel });
      setMessage(errorMessage);
      void refreshJobs();
    } finally {
      setRetryingChunkStep("");
    }
  };

  const retryCopyOnly = async (job: any, mode: "offerings" | "allCopy") => {
    const retryKey = `${job.id}:${mode}`;
    setRetryingCopyOnlyJobId(retryKey);
    try {
      const previousCoverage = offeringCopyCoverage(job);
      const chunkedJob = await resolveChunkedRetryJob(job);
      const steps: ChunkedGenerationStep[] = mode === "offerings"
        ? ["offeringCopy", "finalize"]
        : ["siteCopy", "offeringCopy", "finalize"];
      let data: any = null;
      for (const step of steps) {
        setMessage(`${mode === "offerings" ? "Retrying service copy" : "Retrying copy chunks"}: ${step}...`);
        const retryDeltaBody = step === "finalize"
          ? {
              copyOnlyRetryCoverageDelta: {
                mode,
                repairedTargets: mode === "offerings" ? ["serviceCopy", "serviceNavLabels"] : ["aboutPage", "serviceCopy", "serviceNavLabels"],
                sourceJobId: job.id,
                parentGenerationJobId: chunkedJob.id,
                before: previousCoverage,
              },
            }
          : {};
        data = step === "offeringCopy"
          ? await runOfferingCopyUntilFinalizeReady(
              chunkedJob.id,
              mode === "offerings" ? "Retry service copy" : "Retry copy chunks",
              { resetOfferingCopy: true },
            )
          : await runChunkedStepRequest(chunkedJob.id, step, mode === "offerings" ? "Retry service copy" : "Retry copy chunks", retryDeltaBody);
      }
      const refreshedJob = {
        ...chunkedJob,
        businessId: data?.result?.businessId || chunkedJob.businessId || job.businessId,
        status: "success",
        error: "",
        metadata: data?.metadata || chunkedJob.metadata,
        updatedAt: new Date().toISOString(),
      };
      setJobs((currentJobs) => currentJobs.map((currentJob) => currentJob.id === refreshedJob.id ? { ...currentJob, ...refreshedJob } : currentJob));
      const finalJobId = String(data?.result?.generationJobId || "");
      const finalJob = finalJobId ? await loadGenerationJobById(finalJobId) : null;
      if (finalJob) {
        const persistedDelta = finalJob.metadata?.copyOnlyRetryCoverageDelta;
        const finalJobWithDelta = persistedDelta ? finalJob : {
          ...finalJob,
          metadata: {
            ...(finalJob.metadata || {}),
            copyOnlyRetryCoverageDelta: {
              mode,
              sourceJobId: job.id,
              parentGenerationJobId: chunkedJob.id,
              before: previousCoverage,
              after: offeringCopyCoverage(finalJob),
            },
          },
        };
        setJobs((currentJobs) => currentJobs.some((currentJob) => currentJob.id === finalJob.id)
          ? currentJobs.map((currentJob) => currentJob.id === finalJob.id ? { ...currentJob, ...finalJobWithDelta } : currentJob)
          : [finalJobWithDelta, ...currentJobs]
        );
        setSelectedJob(finalJobWithDelta);
      } else {
        setSelectedJob((currentJob: any) => currentJob?.id === refreshedJob.id ? { ...currentJob, ...refreshedJob } : currentJob);
      }
      setMessage(mode === "offerings"
        ? `Retried service copy and submenu labels for ${job.businessId || chunkedJob.businessId || job.id} and opened the final save job.`
        : `Filled missing About copy plus service copy/submenu labels for ${job.businessId || chunkedJob.businessId || job.id} and opened the final save job.`
      );
      void refreshJobs();
    } catch (error) {
      const source = mode === "offerings" ? "Retry service copy only" : "Retry copy chunks";
      showApiError(error, { source, provider: job?.provider || fallbackProvider, model: job?.model || fallbackModel });
      setMessage(error instanceof Error ? error.message : `${source} failed.`);
      void refreshJobs();
    } finally {
      setRetryingCopyOnlyJobId("");
    }
  };

  return {
    retryingJobId,
    retryingChunkStep,
    retryingCopyOnlyJobId,
    retryOverrideJobId,
    retryGenerationJob,
    retryChunkedStep,
    retryCopyOnly,
  };
}

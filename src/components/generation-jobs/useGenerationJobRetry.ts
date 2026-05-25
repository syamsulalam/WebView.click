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
import { shortHash } from "./jobUtils";

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

  const retryChunkedStep = async (job: any, requestedStep?: ChunkedGenerationStep) => {
    const state = chunkedGenerationState(job);
    const step = requestedStep || state.retryStep || state.nextStep;
    if (!state.chunked || !step) return;
    const retryKey = `${job.id}:${step}`;
    setRetryingChunkStep(retryKey);
    try {
      const response = await fetch(`/api/generation-jobs/${encodeURIComponent(job.id)}/run-step`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step }),
      });
      const data = await readApiJson<any>(response, `Retry ${step} step`);
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

  return {
    retryingJobId,
    retryingChunkStep,
    retryOverrideJobId,
    retryGenerationJob,
    retryChunkedStep,
  };
}

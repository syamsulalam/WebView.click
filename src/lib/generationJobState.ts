export const CHUNKED_GENERATION_STEPS = [
  { key: "outline", label: "Outline" },
  { key: "siteCopy", label: "Site copy" },
  { key: "offeringCopy", label: "Offering copy" },
  { key: "finalize", label: "Finalize" },
] as const;

export type ChunkedGenerationStep = typeof CHUNKED_GENERATION_STEPS[number]["key"];
export type ChunkedStepStatus = "idle" | "pending" | "running" | "failed" | "complete";

export function normalizeChunkedStep(value: unknown): ChunkedGenerationStep | "" {
  const text = String(value || "").replace(/^chunked_/, "");
  if (text === "copy") return "siteCopy";
  return CHUNKED_GENERATION_STEPS.some((step) => step.key === text) ? text as ChunkedGenerationStep : "";
}

export function chunkedGenerationState(job: any) {
  const metadata = job?.metadata || {};
  const chunked = metadata.chunked === true;
  const step = String(metadata.step || "");
  const nextStep = normalizeChunkedStep(metadata.nextStep);
  const failureStep = normalizeChunkedStep(metadata.failureStage);
  const outlineDone = Boolean(metadata.offeringOutlineHash || step === "outline_complete" || step === "copy_complete" || step === "siteCopy_complete" || step === "offeringCopy_complete" || step === "finalize_complete");
  const siteCopyDone = Boolean(metadata.siteCopyPatchHash || metadata.copyPatchHash || step === "copy_complete" || step === "siteCopy_complete" || step === "offeringCopy_complete" || step === "finalize_complete");
  const offeringCopyDone = Boolean(metadata.offeringCopyPatchHash || step === "offeringCopy_complete" || step === "finalize_complete");
  const finalizeDone = Boolean(job?.status === "success" || step === "finalize_complete");
  const doneByStep: Record<ChunkedGenerationStep, boolean> = {
    outline: outlineDone,
    siteCopy: siteCopyDone,
    offeringCopy: offeringCopyDone,
    finalize: finalizeDone,
  };
  const retryStep = job?.status === "failed" ? (failureStep || nextStep) : "";
  const activeStep = job?.status === "running" ? nextStep : "";
  return { chunked, doneByStep, nextStep, failureStep, retryStep, activeStep };
}

export function chunkedStepStatus(job: any, step: ChunkedGenerationStep): ChunkedStepStatus {
  const state = chunkedGenerationState(job);
  if (!state.chunked) return "idle";
  if (state.doneByStep[step]) return "complete";
  if (state.retryStep === step) return "failed";
  if (state.activeStep === step) return "running";
  return "pending";
}

export function chunkedStepBadgeClass(status: ChunkedStepStatus | string) {
  if (status === "complete") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "failed") return "border-red-200 bg-red-50 text-red-800";
  if (status === "running") return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-slate-200 bg-slate-50 text-slate-500";
}

export function chunkedStepStatusLabel(status: ChunkedStepStatus | string) {
  if (status === "complete") return "Done";
  if (status === "failed") return "Failed";
  if (status === "running") return "Running";
  return "Pending";
}

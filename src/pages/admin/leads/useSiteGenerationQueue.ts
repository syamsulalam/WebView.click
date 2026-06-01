import { useState } from "react";
import {
  buildScaffoldGeneratePayload,
  ensureAiGenerationReady,
  ensureNoProviderCooldown,
  isAdminGenerationBlockedError,
  postChunkedGenerateSite,
  resolveLeadGeneratePhotoSelection,
} from "../../../lib/adminSiteGeneration";
import { formatCooldownRemaining } from "../../../lib/providerCooldown";

type UseSiteGenerationQueueParams = {
  activeProviderKey: string;
  activeModel: string;
  searchQuery: string;
  logoSelections: Record<string, any>;
  paletteOptionsByPlace: Record<string, any[]>;
  showToast: (toast: any) => void;
  showApiError: (error: unknown, details?: any) => void;
  getPlaceKey: (place: any) => string;
  mapsQueryPlaceholder: (place: any) => boolean;
  hasGatheredDetails: (place: any) => boolean;
  mergePlaceWithDetails: (place: any) => any;
  buildPaletteOptionsForPlace: (placeKey: string, place: any) => Promise<any[]>;
  setGenerationMessages: (value: any) => void;
  fetchLeads: () => void;
  fetchProspectDrafts: () => void;
  fetchGenerationJobs: () => void;
};

export default function useSiteGenerationQueue({
  activeProviderKey,
  activeModel,
  searchQuery,
  logoSelections,
  paletteOptionsByPlace,
  showToast,
  showApiError,
  getPlaceKey,
  mapsQueryPlaceholder,
  hasGatheredDetails,
  mergePlaceWithDetails,
  buildPaletteOptionsForPlace,
  setGenerationMessages,
  fetchLeads,
  fetchProspectDrafts,
  fetchGenerationJobs,
}: UseSiteGenerationQueueParams) {
  const [batchQueueRunning, setBatchQueueRunning] = useState(false);
  const [batchMessage, setBatchMessage] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingPlaceKey, setGeneratingPlaceKey] = useState("");

  const handleGenerateSite = async (place: any) => {
    const placeKey = getPlaceKey(place);
    try {
      await ensureAiGenerationReady({
        provider: activeProviderKey,
        model: activeModel,
        action: "lead_generate",
        businessName: place?.name || placeKey,
        placeId: String(place?.place_id || place?.id || ""),
        readinessMessage: "AI provider/model is not ready. Check /admin/settings before generating.",
        cooldownMessage: (cooldown) => `${activeProviderKey} is cooling down for ${formatCooldownRemaining(cooldown)} after a quota/rate-limit error. Batch generation is paused to avoid repeated 429 failures.`,
        cooldownActions: ["Wait for the cooldown to end, then retry one prospect.", "Switch provider/model before continuing a batch."],
      });

      if (mapsQueryPlaceholder(place)) {
        throw new Error("This row is a Maps search/query placeholder, not a specific business listing. Import captured listing JSON or choose a real Google business result before generating.");
      }
      if (!hasGatheredDetails(place)) {
        throw new Error("Gather Google Places details first so the generated site has phone, direct Maps URL, reviews, and photos.");
      }

      const fullPlace = mergePlaceWithDetails(place);
      setIsGenerating(true);
      setGeneratingPlaceKey(placeKey);
      setGenerationMessages(prev => ({ ...prev, [placeKey]: { type: "success", text: "Generating site JSON..." } }));
      const paletteOptions = await buildPaletteOptionsForPlace(placeKey, fullPlace);

      const selection = resolveLeadGeneratePhotoSelection({
        place: fullPlace,
        placeKey,
        logoSelections,
        paletteOptionsByPlace: {
          ...paletteOptionsByPlace,
          [placeKey]: paletteOptions,
        },
        photoMaxWidth: 960,
      });
      const payload = buildScaffoldGeneratePayload({
        place: fullPlace,
        requireAi: true,
        provider: activeProviderKey,
        model: activeModel,
        imageUrl: selection.selectedImageUrl,
        palette: selection.brandPalette,
        paletteOptions: selection.paletteOptions,
        selectedPhotoReference: selection.selectedReference,
        selectedPhotoSource: selection.selectedPhotoSource,
        selectedPhotoAttributions: selection.selectedAttributions,
        selectedPhotoPriority: selection.selectedPhotoPriority,
        searchQuery,
      });
      const data = await postChunkedGenerateSite(payload, "Generate site", (step, progress) => {
        const labels: Record<string, string> = {
          outline: "Inferring service/product pages...",
          copy: "Writing AI-enriched copy...",
          siteCopy: "Writing homepage and site copy...",
          offeringCopy: "Writing service detail copy...",
          finalize: "Saving generated site...",
        };
        const retryText = progress?.status === "retry_wait"
          ? ` ${step} hit a temporary provider/edge failure. Auto retry in ${progress.retryInSeconds}s...`
          : progress?.status === "retrying"
            ? ` Retrying ${step} now...`
            : "";
        setGenerationMessages(prev => ({ ...prev, [placeKey]: { type: "success", text: `${labels[step] || "Generating site JSON..."}${retryText}` } }));
      });

      fetchLeads();
      fetchProspectDrafts();
      fetchGenerationJobs();
      setGenerationMessages(prev => ({
        ...prev,
        [placeKey]: {
          type: "success",
          text: data.generatedWithAi === false
            ? "Site saved with fallback copy only. Check Jobs for the AI copy patch error."
            : "Site generated with AI-enriched copy. Preview is ready.",
          businessId: data.businessId || payload.businessId,
        },
      }));
      return true;
    } catch (e) {
      if (isAdminGenerationBlockedError(e) && e.kind === "cooldown") {
        setBatchMessage(e.message);
        showToast({ kind: "warning", title: e.title || `${activeProviderKey} cooldown active`, message: e.message, actions: e.actions });
      } else if (!isAdminGenerationBlockedError(e)) {
        console.error(e);
        showApiError(e, { source: "Generate site", provider: activeProviderKey, model: activeModel });
      }
      setGenerationMessages(prev => ({
        ...prev,
        [placeKey]: { type: "error", text: e instanceof Error ? e.message : "Generate site gagal. Hasil pencarian tetap disimpan di layar." },
      }));
      fetchGenerationJobs();
      return false;
    } finally {
      setIsGenerating(false);
      setGeneratingPlaceKey("");
    }
  };

  const startBatchGenerate = async (
    selectedVisibleProspects: any[],
    setSelectedProspects: (value: Record<string, boolean>) => void,
  ) => {
    if (selectedVisibleProspects.length === 0 || batchQueueRunning) return;
    setBatchQueueRunning(true);
    setBatchMessage(`Starting queue for ${selectedVisibleProspects.length} prospects...`);
    let pausedForCooldown = false;
    for (let index = 0; index < selectedVisibleProspects.length; index += 1) {
      const place = selectedVisibleProspects[index];
      try {
        await ensureNoProviderCooldown({
          provider: activeProviderKey,
          model: activeModel,
          action: "lead_batch_generate",
          businessName: place?.name || getPlaceKey(place),
          placeId: String(place?.place_id || place?.id || ""),
          cooldownMessage: (cooldown) => `${activeProviderKey} is cooling down for ${formatCooldownRemaining(cooldown)} after a quota/rate-limit error. Queue paused before prospect ${index + 1}/${selectedVisibleProspects.length}.`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Batch queue paused by provider cooldown.";
        setBatchMessage(message);
        if (isAdminGenerationBlockedError(error) && error.kind === "cooldown") {
          showToast({ kind: "warning", title: error.title || `${activeProviderKey} cooldown active`, message, actions: error.actions });
        }
        pausedForCooldown = true;
        break;
      }
      setBatchMessage(`Generating ${index + 1}/${selectedVisibleProspects.length}: ${place.name}`);
      const generated = await handleGenerateSite(place);
      if (!generated) {
        try {
          await ensureNoProviderCooldown({
            provider: activeProviderKey,
            model: activeModel,
            action: "lead_batch_generate",
            businessName: place?.name || getPlaceKey(place),
            placeId: String(place?.place_id || place?.id || ""),
            cooldownMessage: (cooldown) => `${activeProviderKey} is cooling down for ${formatCooldownRemaining(cooldown)} after a quota/rate-limit error. Queue paused after prospect ${index + 1}/${selectedVisibleProspects.length}.`,
          });
        } catch {
          pausedForCooldown = true;
          break;
        }
      }
    }
    setBatchQueueRunning(false);
    if (!pausedForCooldown) setBatchMessage("Batch queue finished.");
    if (!pausedForCooldown) setSelectedProspects({});
    fetchGenerationJobs();
  };

  return {
    batchQueueRunning,
    batchMessage,
    setBatchMessage,
    isGenerating,
    generatingPlaceKey,
    handleGenerateSite,
    startBatchGenerate,
  };
}

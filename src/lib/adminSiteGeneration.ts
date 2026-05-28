import { AiReadinessResult, checkAiReadiness, logAiReadinessBlockedJob } from "./aiReadiness";
import { readApiJson } from "./apiResponse";
import { buildGeneratedSiteScaffold, businessSlug, photoAttributions, photoReference, placeDisplayName, placePhone } from "./generatedSiteScaffold";
import { formatCooldownRemaining, getSharedProviderCooldown, logProviderCooldownBlockedJob, ProviderCooldown } from "./providerCooldown";

export type AdminGenerationBlockKind = "cooldown" | "readiness" | "validation";

export class AdminGenerationBlockedError extends Error {
  kind: AdminGenerationBlockKind;
  title?: string;
  actions?: string[];
  cooldown?: ProviderCooldown;
  readiness?: AiReadinessResult;

  constructor(message: string, options: {
    kind: AdminGenerationBlockKind;
    title?: string;
    actions?: string[];
    cooldown?: ProviderCooldown;
    readiness?: AiReadinessResult;
  }) {
    super(message);
    this.name = "AdminGenerationBlockedError";
    this.kind = options.kind;
    this.title = options.title;
    this.actions = options.actions;
    this.cooldown = options.cooldown;
    this.readiness = options.readiness;
  }
}

type GenerationAuditTarget = {
  action: string;
  businessId?: string;
  businessName?: string;
  placeId?: string;
};

type AiPreflightInput = GenerationAuditTarget & {
  provider: string;
  model: string;
  readinessMessage?: string;
  cooldownMessage?: (cooldown: ProviderCooldown) => string;
  cooldownActions?: string[];
};

export function isAdminGenerationBlockedError(error: unknown): error is AdminGenerationBlockedError {
  return error instanceof AdminGenerationBlockedError;
}

export function mapsQueryPlaceId(placeId: string) {
  return String(placeId || "").startsWith("maps:");
}

export function mapsQueryPlaceholder(place: { place_id?: string; id?: string; manualImport?: boolean }) {
  const placeId = String(place?.place_id || place?.id || "");
  return mapsQueryPlaceId(placeId) && !place?.manualImport;
}

export async function ensureNoProviderCooldown(input: AiPreflightInput) {
  const cooldown = await getSharedProviderCooldown(input.provider, true);
  if (!cooldown) return null;

  const message = input.cooldownMessage
    ? input.cooldownMessage(cooldown)
    : `${input.provider} is cooling down for ${formatCooldownRemaining(cooldown)} after a quota/rate-limit error.`;
  await logProviderCooldownBlockedJob({
    provider: input.provider,
    model: input.model,
    cooldown,
    action: input.action,
    businessId: input.businessId,
    businessName: input.businessName,
    placeId: input.placeId,
    message,
  });
  throw new AdminGenerationBlockedError(message, {
    kind: "cooldown",
    title: `${input.provider} cooldown active`,
    actions: input.cooldownActions || ["Wait for the cooldown to end, then retry one site.", "Switch provider/model if this is urgent."],
    cooldown,
  });
}

export async function ensureAiGenerationReady(input: AiPreflightInput) {
  await ensureNoProviderCooldown(input);

  const readiness = await checkAiReadiness(input.provider, input.model, true, true);
  if (readiness.ready) return readiness;

  const message = readiness.message || input.readinessMessage || "AI provider/model is not ready. Check /admin/settings before generating.";
  await logAiReadinessBlockedJob({
    provider: input.provider,
    model: input.model,
    readiness,
    action: input.action,
    businessId: input.businessId,
    businessName: input.businessName,
    placeId: input.placeId,
    message,
  });
  throw new AdminGenerationBlockedError(message, {
    kind: "readiness",
    title: "AI readiness blocked",
    actions: ["Check the provider key and selected model in /admin/settings.", "Refresh AI readiness after saving settings, then retry."],
    readiness,
  });
}

export async function fetchGooglePlaceDetails(placeId: string) {
  const response = await fetch(`/api/places/details?placeId=${encodeURIComponent(placeId)}`);
  const text = await response.text();
  let details: any = {};
  try {
    details = text ? JSON.parse(text) : {};
  } catch {
    details = { error: `Place Details response bukan JSON: ${text.slice(0, 120)}` };
  }
  if (response.ok && details.result) return details.result;
  throw new Error(details.error || `Place Details returned HTTP ${response.status}`);
}

export type GenerateSitePayloadInput = {
  place: any;
  provider?: string;
  model?: string;
  requireAi: boolean;
  businessId?: string;
  businessName?: string;
  phone?: string;
  imageUrl?: string;
  palette?: string[];
  paletteOptions?: any[];
  selectedPhotoReference?: string;
  selectedPhotoSource?: string;
  selectedPhotoAttributions?: string[];
  selectedPhotoPriority?: string;
  searchQuery?: string;
};

export function buildScaffoldGeneratePayload(input: GenerateSitePayloadInput) {
  const businessName = input.businessName || placeDisplayName(input.place);
  const businessId = input.businessId || businessSlug(businessName, input.place?.place_id || input.place?.id || "");
  const palette = Array.isArray(input.palette) ? input.palette : [];
  const paletteOptions = Array.isArray(input.paletteOptions) ? input.paletteOptions : [];
  const scaffoldPlace = input.businessName && !input.place?.displayName
    ? { ...input.place, displayName: { text: businessName } }
    : input.place;
  const jsonContent = buildGeneratedSiteScaffold(scaffoldPlace, {
    businessId,
    imageUrl: input.imageUrl || "",
    palette,
    paletteOptions,
    selectedPhotoReference: input.selectedPhotoReference || "",
    selectedPhotoSource: input.imageUrl ? (input.selectedPhotoSource || "google_places") : "",
    selectedPhotoAttributions: Array.isArray(input.selectedPhotoAttributions) ? input.selectedPhotoAttributions : [],
    selectedPhotoPriority: input.selectedPhotoPriority || "",
    searchQuery: input.searchQuery,
  });

  return {
    requireAi: input.requireAi,
    provider: input.provider || "",
    model: input.model || "",
    jsonContent,
    businessId,
    businessName,
    phone: input.phone ?? placePhone(input.place),
    originData: input.place,
    brandPalette: palette,
    paletteOptions,
    selectedLogoImageUrl: input.imageUrl || "",
    selectedLogoReference: input.selectedPhotoReference || "",
    selectedLogoSource: input.imageUrl ? (input.selectedPhotoSource || "google_places") : "",
    selectedLogoAttributions: Array.isArray(input.selectedPhotoAttributions) ? input.selectedPhotoAttributions : [],
    selectedLogoPriority: input.selectedPhotoPriority || "",
  };
}

export function firstPlacePhotoWithReference(place: any) {
  return Array.isArray(place?.photos) ? place.photos.find((photo: any) => photoReference(photo)) : null;
}

export function googlePlacePhotoUrl(reference: string, maxWidth = 960) {
  return reference ? `/api/places/photo?reference=${encodeURIComponent(reference)}&maxwidth=${maxWidth}` : "";
}

export function googlePlacePhotoUrlForPhoto(photo: any, maxWidth = 320) {
  return googlePlacePhotoUrl(photoReference(photo), maxWidth);
}

export function photoPriority(photo: any, businessName = "") {
  const attributions = photoAttributions(photo).join(" ").toLowerCase();
  const nameTokens = businessName.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2);
  if (attributions && nameTokens.some((token) => attributions.includes(token))) return 0;
  if (!attributions) return 1;
  return 2;
}

export function photoPriorityLabel(photo: any, businessName = "") {
  const priority = photoPriority(photo, businessName);
  if (priority === 0) return "Owner-like";
  if (priority === 1) return "No attribution";
  return "UGC/attributed";
}

export function sortedPhotosForPlace(place: any) {
  const businessName = placeDisplayName(place);
  return [...(Array.isArray(place?.photos) ? place.photos : [])].sort((a, b) =>
    photoPriority(a, businessName) - photoPriority(b, businessName),
  );
}

export type AdminPhotoSelection = {
  url: string;
  reference: string;
  palette: string[];
  attributions: string[];
  priorityLabel: string;
  source: string;
};

export function buildPhotoSelection(input: {
  photo: any;
  imageUrl: string;
  businessName?: string;
  palette?: string[];
  source?: string;
}): AdminPhotoSelection {
  const businessName = input.businessName || "";
  return {
    url: input.imageUrl,
    reference: photoReference(input.photo),
    palette: Array.isArray(input.palette) ? input.palette : [],
    attributions: photoAttributions(input.photo),
    priorityLabel: photoPriorityLabel(input.photo, businessName),
    source: input.source || "google_places",
  };
}

export function buildPaletteOptionForPhoto(input: {
  photo: any;
  index: number;
  colors: string[];
  sourceImageUrl: string;
  businessName?: string;
}) {
  const businessName = input.businessName || "";
  return {
    id: `places-photo-${input.index + 1}`,
    label: `${photoPriorityLabel(input.photo, businessName)} palette ${input.index + 1}`,
    colors: input.colors,
    sourceImageUrl: input.sourceImageUrl,
    photoReference: photoReference(input.photo),
    attributions: photoAttributions(input.photo),
    priorityLabel: photoPriorityLabel(input.photo, businessName),
  };
}

export function buildProspectSelectionPayload(input: {
  selection?: AdminPhotoSelection;
  palette?: string[];
  paletteOptions?: any[];
}) {
  return {
    ...(input.selection ? {
      photo: {
        url: input.selection.url,
        reference: input.selection.reference,
        attributions: input.selection.attributions,
        priorityLabel: input.selection.priorityLabel,
        source: input.selection.source,
      },
    } : {}),
    ...(input.palette ? { palette: input.palette } : {}),
    ...(input.paletteOptions ? { paletteOptions: input.paletteOptions } : {}),
  };
}

export async function saveProspectSelection(placeId: string, payload: Record<string, unknown>) {
  if (!placeId) return false;
  try {
    const response = await fetch(`/api/prospects/${encodeURIComponent(placeId)}/selection`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function resolveLeadGeneratePhotoSelection(input: {
  place: any;
  placeKey: string;
  logoSelections: Record<string, AdminPhotoSelection | undefined>;
  paletteOptionsByPlace: Record<string, any[] | undefined>;
  selectedPalette?: string[];
  photoMaxWidth?: number;
}) {
  const logoSelection = input.logoSelections[input.place?.place_id || input.place?.name] || input.logoSelections[input.placeKey];
  const fallbackPhoto = sortedPhotosForPlace(input.place)[0];
  const fallbackImageUrl = fallbackPhoto ? googlePlacePhotoUrlForPhoto(fallbackPhoto, input.photoMaxWidth || 960) : "";
  const selectedLogoUrl = logoSelection?.url || (logoSelection?.reference ? googlePlacePhotoUrl(logoSelection.reference, input.photoMaxWidth || 960) : "");
  const selectedImageUrl = selectedLogoUrl || fallbackImageUrl;
  const selectedReference = logoSelection?.reference || (fallbackPhoto ? photoReference(fallbackPhoto) : "");
  const selectedAttributions = logoSelection?.attributions || (fallbackPhoto ? photoAttributions(fallbackPhoto) : []);
  const paletteOptions = input.paletteOptionsByPlace[input.placeKey] || input.place?.paletteOptions || [];
  const selectedPalette = Array.isArray(input.selectedPalette) && input.selectedPalette.length > 0 ? input.selectedPalette : [];
  const logoPalette = Array.isArray(logoSelection?.palette) && logoSelection.palette.length > 0 ? logoSelection.palette : [];
  const firstPaletteOption = Array.isArray(paletteOptions[0]?.colors) && paletteOptions[0].colors.length > 0 ? paletteOptions[0].colors : [];
  const brandPalette = logoPalette.length > 0 ? logoPalette : selectedPalette.length > 0 ? selectedPalette : firstPaletteOption;

  return {
    logoSelection,
    fallbackPhoto,
    selectedImageUrl,
    selectedReference,
    selectedAttributions,
    paletteOptions,
    brandPalette,
    selectedPhotoSource: selectedImageUrl ? (logoSelection?.source || "google_places") : "",
    selectedPhotoPriority: logoSelection?.priorityLabel || "",
  };
}

export function buildSelectedPhotoGeneratePayload(input: {
  place: any;
  selectedPhoto?: any;
  provider?: string;
  model?: string;
  requireAi: boolean;
  businessId?: string;
  businessName?: string;
  phone?: string;
  palette?: string[];
  paletteOptions?: any[];
  searchQuery?: string;
  photoMaxWidth?: number;
}) {
  const fallbackPhoto = firstPlacePhotoWithReference(input.place);
  const fallbackReference = fallbackPhoto ? photoReference(fallbackPhoto) : "";
  const selectedReference = input.selectedPhoto?.reference || fallbackReference;
  const selectedImageUrl = input.selectedPhoto?.url || googlePlacePhotoUrl(selectedReference, input.photoMaxWidth || 960);
  const selectedPhotoAttributions = Array.isArray(input.selectedPhoto?.attributions) && input.selectedPhoto.attributions.length > 0
    ? input.selectedPhoto.attributions
    : fallbackPhoto ? photoAttributions(fallbackPhoto) : [];

  return buildScaffoldGeneratePayload({
    place: input.place,
    provider: input.provider,
    model: input.model,
    requireAi: input.requireAi,
    businessId: input.businessId,
    businessName: input.businessName,
    phone: input.phone,
    imageUrl: selectedImageUrl,
    palette: input.palette,
    paletteOptions: input.paletteOptions,
    selectedPhotoReference: selectedReference,
    selectedPhotoSource: selectedImageUrl ? (input.selectedPhoto?.source || "google_places") : "",
    selectedPhotoAttributions,
    selectedPhotoPriority: input.selectedPhoto?.priorityLabel || "",
    searchQuery: input.searchQuery,
  });
}

export async function postGenerateSite(payload: Record<string, unknown>, label = "Generate site") {
  const response = await fetch("/api/sites/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return readApiJson<any>(response, label);
}

type ChunkedGenerateProgress = {
  status: "running" | "retry_wait" | "retrying" | "complete";
  attempt: number;
  retryInSeconds?: number;
  message?: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isTransientChunkedGenerationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return /HTTP\s*(502|503|504|524)|Cloudflare\/HTML|temporar|upstream network|network_error|provider_temporary|empty_response|returned HTML|did not return normally/i.test(message);
}

export async function postChunkedGenerateSite(
  payload: Record<string, unknown>,
  label = "Generate site",
  onStep?: (step: string, progress?: ChunkedGenerateProgress) => void,
) {
  const startResponse = await fetch("/api/generation-jobs/chunked-start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const start = await readApiJson<any>(startResponse, `${label} start`);
  const jobId = start.id;
  if (!jobId) throw new Error("Chunked generation did not return a job id.");

  return runChunkedGenerationJob(start, label, onStep);
}

export async function runChunkedGenerationJob(
  start: Record<string, unknown>,
  label = "Generate site",
  onStep?: (step: string, progress?: ChunkedGenerateProgress) => void,
) {
  const jobId = String(start.id || "");
  if (!jobId) throw new Error("Chunked generation did not return a job id.");

  let result: any = start;
  const steps = ["outline", "siteCopy", "offeringCopy", "finalize"];
  const firstStepIndex = Math.max(0, steps.indexOf(String(start.nextStep || "outline")));
  for (const step of steps.slice(firstStepIndex)) {
    for (let itemAttempt = 0; itemAttempt < 24; itemAttempt += 1) {
      let attempt = 1;
      while (attempt <= 2) {
        onStep?.(step, { status: attempt === 1 ? "running" : "retrying", attempt });
        try {
          const stepResponse = await fetch(`/api/generation-jobs/${encodeURIComponent(jobId)}/run-step`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ step }),
          });
          result = await readApiJson<any>(stepResponse, `${label} ${step}`);
          onStep?.(step, {
            status: "complete",
            attempt,
            message: result?.progress?.total
              ? `Service copy ${result.progress.completed}/${result.progress.total}`
              : undefined,
          });
          break;
        } catch (error) {
          if (attempt >= 2 || !isTransientChunkedGenerationError(error)) throw error;
          for (let seconds = 60; seconds > 0; seconds -= 1) {
            onStep?.(step, {
              status: "retry_wait",
              attempt,
              retryInSeconds: seconds,
              message: error instanceof Error ? error.message : String(error || ""),
            });
            await sleep(1000);
          }
          attempt += 1;
        }
      }
      if (step !== "offeringCopy" || result?.nextStep !== "offeringCopy") break;
      if (itemAttempt >= 23) throw new Error("Service copy is still not ready to finalize after 24 item requests. Resume Service copy from /admin/jobs.");
    }
  }

  return result.result || result;
}

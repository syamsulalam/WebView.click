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

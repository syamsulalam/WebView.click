import { applyGeneratedSitePageInserts, repairOfferingNavLabels, repairServiceCardImages } from "../../../src/lib/generatedSitePostProcess";
import { fontPairingsForText, fontPairingVariantForText } from "../../../src/lib/fontPairings";
import { asString } from "../_shared/response";
import {
  applyAiCopyPatch,
  applyAiOfferingOutline,
  buildAiCopyAudit,
  buildAiCopyTargetBrief,
  collectAiCopyAuditTargets,
  generateAiCopyPatch,
  generateAiOfferingOutline,
  type AiSiteGenerationDeps,
} from "../ai/siteGeneration";
import {
  compactSiteManifest,
  migrateOldSiteJsonRowsToR2,
  normalizeImageFilenames,
  publicR2Url,
  readSiteJsonFromStorage,
  siteSummaryFromJson,
  type SiteStorageDeps,
  uploadImageAssetsToR2,
  uploadJsonToR2,
} from "./storage";

type D1PreparedStatementLike = {
  bind: (...values: unknown[]) => D1PreparedStatementLike;
  all: <R = unknown>() => Promise<{ results?: R[] }>;
  first: <R = unknown>() => Promise<R | null>;
  run: () => Promise<unknown>;
};

type D1DatabaseLike = {
  prepare: (query: string) => D1PreparedStatementLike;
};

type R2BucketLike = {
  put: (key: string, value: ReadableStream | ArrayBuffer | ArrayBufferView | string, options?: { httpMetadata?: { contentType?: string } }) => Promise<unknown>;
  get?: (key: string) => Promise<{ text: () => Promise<string> } | null>;
};

type SitesEnv = Record<string, unknown> & {
  R2?: R2BucketLike;
  R2_PUBLIC_BASE_URL?: string;
};

export type SitesHandlerDeps = {
  templateSchema: Record<string, unknown>;
  json: (data: unknown, status?: number) => Response;
  errorJson: (error: string, status?: number, details?: unknown) => Response;
  readJsonBody: (request: Request) => Promise<Record<string, unknown>>;
  asString: (value: unknown, fallback?: string) => string;
  normalizeBusinessId: (name: string) => string;
  placeIdFromPlace: (place: unknown) => string;
  parseJsonObject: (value: string | null | undefined) => Record<string, unknown>;
  tableColumns: (db: unknown, table: string) => Promise<Set<string>>;
  ensureRequiredColumns: (db: unknown, specs: unknown[]) => Promise<void>;
  generateRequiredColumns: unknown[];
  createGenerationJob: (db: unknown, values: Record<string, unknown>) => Promise<void>;
  updateGenerationJob: (db: unknown, jobId: string, values: Record<string, unknown>) => Promise<void>;
  incrementDailyUsage: (db: unknown, key: "site_generation") => Promise<void>;
  updateProspectRecord: (db: unknown, placeId: string, values: Record<string, unknown>) => Promise<void>;
  upsertLeadRecord: (db: unknown, values: Record<string, unknown>) => Promise<void>;
  insertCrmActivitySafe: (db: unknown, values: Record<string, unknown>) => Promise<void>;
  saveJsonSiteRecord: (db: unknown, businessId: string, jsonContent: string, options?: Record<string, unknown>) => Promise<void>;
  siteStorageDeps: SiteStorageDeps;
  aiSiteGenerationDeps: AiSiteGenerationDeps;
  sha256Json: (value: unknown) => Promise<string>;
};

function isWeakGoogleMapsSearchUrl(value: unknown): boolean {
  if (typeof value !== "string" || !value.trim()) return true;
  try {
    const url = new URL(value);
    return url.hostname.includes("google.") && url.pathname.includes("/maps/search") && url.searchParams.has("query");
  } catch {
    return false;
  }
}

function visualStyleForBusiness(text: string): string {
  const key = text.toLowerCase();
  if (/(contractor|concrete|roof|construction|builder|paving|masonry|auto|mechanic|security|locksmith)/i.test(key)) return "industrial-diagonal";
  if (/(law|legal|attorney|finance|financial|real estate|property|accounting|consulting)/i.test(key)) return "boxy-editorial";
  if (/(medical|doctor|cleaning|pool|service|repair|maintenance|clinic|dental)/i.test(key)) return "clean-minimal";
  if (/(gym|fitness|trainer|boxing|martial|crossfit|sport)/i.test(key)) return "bold-sport";
  return "soft-rounded";
}

function shaderPresetForBusiness(text: string) {
  const key = text.toLowerCase();
  if (/(contractor|concrete|roof|construction|builder|paving|masonry|auto|mechanic|security|locksmith|hvac|plumb|electric)/i.test(key)) return { id: "industrial-grid", label: "Industrial Grid", description: "Subtle diagonal/grid energy for hands-on trades and mechanical businesses.", defaultOpacity: 0.22, defaultMotion: 0.35 };
  if (/(pool|spa|water|aquatic|cleaning|pressure washing|dental|clinic|medical|fresh)/i.test(key)) return { id: "aqua-caustics", label: "Aqua Caustics", description: "Light refraction bands for pool, cleaning, dental, and water-forward services.", defaultOpacity: 0.26, defaultMotion: 0.5 };
  if (/(landscap|garden|lawn|tree|nursery|florist|yard|irrigation|mulch|arborist|organic)/i.test(key)) return { id: "organic-dapple", label: "Organic Dapple", description: "Leafy dappled light for outdoor, garden, lawn, and nature-oriented businesses.", defaultOpacity: 0.24, defaultMotion: 0.4 };
  if (/(cafe|coffee|bakery|restaurant|bar|food|bistro|brunch|tea|pizza|taco|diner)/i.test(key)) return { id: "cafe-heat", label: "Cafe Heat", description: "Warm roast-like glow and gentle grain for cafes, bakeries, restaurants, and food brands.", defaultOpacity: 0.26, defaultMotion: 0.45 };
  if (/(salon|spa|massage|beauty|nail|lashes|brow|esthetician|hair|luxe)/i.test(key)) return { id: "salon-silk", label: "Salon Silk", description: "Soft flowing satin bands for beauty, salon, spa, and premium lifestyle services.", defaultOpacity: 0.25, defaultMotion: 0.5 };
  if (/(gym|fitness|trainer|martial|boxing|yoga|pilates|crossfit|workout|sport|energy)/i.test(key)) return { id: "fitness-pulse", label: "Fitness Pulse", description: "High-contrast energetic pulse for gyms, training, martial arts, and sports.", defaultOpacity: 0.24, defaultMotion: 0.65 };
  if (/(law|attorney|legal|notary|immigration|tax|accountant|accounting|bookkeeping|financial|finance|insurance|advisor|mortgage|professional)/i.test(key)) return { id: "legal-vellum", label: "Legal Vellum", description: "Quiet paper-grain and authority lines for law, finance, accounting, and professional services.", defaultOpacity: 0.18, defaultMotion: 0.2 };
  if (/(real estate|realtor|property|broker|home staging|apartment|rental|mortgage|premium)/i.test(key)) return { id: "property-depth", label: "Property Depth", description: "Measured depth gradients for real estate, property, staging, and premium home services.", defaultOpacity: 0.22, defaultMotion: 0.3 };
  return { id: "local-aurora", label: "Local Aurora", description: "Soft palette clouds that make general local sites feel richer without becoming decorative.", defaultOpacity: 0.28, defaultMotion: 0.55 };
}

function fontPairingForBusiness(text: string, seed = text) {
  const options = fontPairingsForText(text, 5);
  const selected = fontPairingVariantForText(text, seed, 5);
  return {
    id: selected.id,
    label: selected.label,
    headingFont: selected.headingFont,
    bodyFont: selected.bodyFont,
    headingCss: selected.headingCss,
    bodyCss: selected.bodyCss,
    mood: selected.mood,
    allowedValues: options.map((item) => item.id),
  };
}

function fontPairingDesignInputs(siteJson: Record<string, unknown>, businessName: string, businessId: string, originData: Record<string, unknown> = {}) {
  const sourceData = siteJson.sourceData && typeof siteJson.sourceData === "object" ? siteJson.sourceData as Record<string, unknown> : {};
  const location = siteJson.location && typeof siteJson.location === "object" ? siteJson.location as Record<string, unknown> : {};
  const profile = siteJson.businessProfile && typeof siteJson.businessProfile === "object" ? siteJson.businessProfile as Record<string, unknown> : {};
  const meta = siteJson.meta && typeof siteJson.meta === "object" ? siteJson.meta as Record<string, unknown> : {};
  const categories = Array.isArray(profile.categories) ? profile.categories : [];
  const address = asString(originData.formatted_address, asString(originData.formattedAddress, asString(location.formattedAddress, asString(sourceData.formattedAddress))));
  const placeId = asString(originData.place_id, asString(originData.id, asString(sourceData.placeId)));
  const context = [
    businessName,
    address,
    asString(meta.niche, asString(profile.typeLabel)),
    categories.join(" "),
    Array.isArray(originData.types) ? originData.types.join(" ") : "",
    asString(sourceData.searchQuery),
    asString(originData.searchQuery),
  ].filter(Boolean).join(" ");
  const seed = [
    businessName,
    businessId,
    placeId,
    address,
  ].filter(Boolean).join(" ");
  return { context, seed };
}

function applySeededFontPairing(siteJson: Record<string, unknown>, businessName: string, businessId: string, originData: Record<string, unknown> = {}, force = false) {
  const { context, seed } = fontPairingDesignInputs(siteJson, businessName, businessId, originData);
  const designConfig = siteJson.design && typeof siteJson.design === "object" ? siteJson.design as Record<string, unknown> : {};
  const previousPairing = asString(designConfig.fontPairing);
  const fontPairingConfig = designConfig.fontPairingConfig && typeof designConfig.fontPairingConfig === "object" ? designConfig.fontPairingConfig as Record<string, unknown> : {};
  const shouldRefreshFontPairing = force || !previousPairing || asString(fontPairingConfig.selectionMode) !== "stable_seeded_business_variant";
  const fontPairingMeta = fontPairingForBusiness(context, seed);
  if (shouldRefreshFontPairing) {
    designConfig.fontPairing = fontPairingMeta.id;
    designConfig.fontPairingConfig = {
      label: fontPairingMeta.label,
      headingFont: fontPairingMeta.headingFont,
      bodyFont: fontPairingMeta.bodyFont,
      mood: fontPairingMeta.mood,
      allowedValues: fontPairingMeta.allowedValues,
      selectionMode: "stable_seeded_business_variant",
      seed,
      selectionRule: "Choose an industry-matched Google Font pairing; owners can switch among these matching options before download.",
    };
  }
  const themeVariables = designConfig.themeVariables && typeof designConfig.themeVariables === "object" ? designConfig.themeVariables as Record<string, unknown> : {};
  const typography = themeVariables.typography && typeof themeVariables.typography === "object" ? themeVariables.typography as Record<string, unknown> : {};
  typography.headingFont = shouldRefreshFontPairing ? fontPairingMeta.headingCss : typography.headingFont || fontPairingMeta.headingCss;
  typography.bodyFont = shouldRefreshFontPairing ? fontPairingMeta.bodyCss : typography.bodyFont || fontPairingMeta.bodyCss;
  themeVariables.typography = typography;
  designConfig.themeVariables = themeVariables;
  siteJson.design = designConfig;
  return {
    changed: shouldRefreshFontPairing && previousPairing !== fontPairingMeta.id,
    fontPairing: fontPairingMeta.id,
    fontPairingLabel: fontPairingMeta.label,
    seed,
  };
}

function faviconSvgFromBusinessName(name: string, background = "#111827") {
  const initial = (name.trim().slice(0, 1).toUpperCase() || "S").replace(/[<>&"]/g, "");
  const safeBackground = /^#[0-9a-f]{3,8}$/i.test(background) ? background : "#111827";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${safeBackground}"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="Arial,sans-serif" font-size="34" font-weight="700" fill="white">${initial}</text></svg>`;
}

function hexToRgb(hex: string) {
  const normalized = hex.trim().replace("#", "");
  const expanded = normalized.length === 3 ? normalized.split("").map((char) => char + char).join("") : normalized;
  if (!/^[0-9a-f]{6}$/i.test(expanded)) return null;
  return {
    r: parseInt(expanded.slice(0, 2), 16),
    g: parseInt(expanded.slice(2, 4), 16),
    b: parseInt(expanded.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0")).join("")}`;
}

function relativeLuminance(hex: string) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const channel = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

function darkenForWhiteText(hex: string) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  let factor = 0.82;
  let current = hex;
  while (relativeLuminance(current) > 0.32 && factor > 0.32) {
    current = rgbToHex(rgb.r * factor, rgb.g * factor, rgb.b * factor);
    factor -= 0.12;
  }
  return current;
}

function normalizeSiteColorContrast(finalJson: Record<string, unknown>) {
  const design = finalJson.design && typeof finalJson.design === "object" ? finalJson.design as Record<string, unknown> : {};
  const themeVariables = design.themeVariables && typeof design.themeVariables === "object" ? design.themeVariables as Record<string, unknown> : {};
  const colors = themeVariables.colors && typeof themeVariables.colors === "object" ? themeVariables.colors as Record<string, unknown> : {};
  for (const key of ["primary", "accent"]) {
    const value = colors[key];
    if (typeof value === "string" && value.startsWith("#") && relativeLuminance(value) > 0.32) {
      colors[key] = darkenForWhiteText(value);
    }
  }
  themeVariables.colors = colors;
  design.themeVariables = themeVariables;
  finalJson.design = design;
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function restoredJsonFromGenerationMetadata(metadata: Record<string, unknown>) {
  const payload = objectValue(metadata.payload);
  const baseJson = objectValue(payload?.jsonContent);
  if (!payload || !baseJson) return null;
  const finalJson = structuredClone(baseJson) as Record<string, unknown>;
  const originData = objectValue(payload.originData) || {};
  const outline = objectValue(metadata.offeringOutline);
  if (outline) applyAiOfferingOutline(finalJson, outline);
  applyGeneratedSitePageInserts(finalJson, originData);
  const copyPatch = objectValue(metadata.copyPatch);
  if (copyPatch) applyAiCopyPatch(finalJson, copyPatch);
  applyGeneratedSitePageInserts(finalJson, originData);
  return { finalJson, payload, originData };
}

export async function handleSites(deps: SitesHandlerDeps, request: Request, db: D1DatabaseLike, env: SitesEnv, segments: string[]): Promise<Response> {
  const {
    templateSchema,
    json,
    errorJson,
    readJsonBody,
    asString,
    normalizeBusinessId,
    placeIdFromPlace,
    parseJsonObject,
    tableColumns,
    ensureRequiredColumns,
    generateRequiredColumns,
    createGenerationJob,
    updateGenerationJob,
    incrementDailyUsage,
    updateProspectRecord,
    upsertLeadRecord,
    insertCrmActivitySafe,
    saveJsonSiteRecord,
    siteStorageDeps,
    aiSiteGenerationDeps,
    sha256Json,
  } = deps;

  if (request.method === "GET" && segments.length === 1) {
    await ensureRequiredColumns(db, [
      { table: "json_sites", column: "r2_json_key", definition: "TEXT" },
      { table: "json_sites", column: "r2_json_url", definition: "TEXT" },
      { table: "json_sites", column: "json_summary", definition: "TEXT" },
      { table: "json_sites", column: "last_preview_error", definition: "TEXT" },
      { table: "json_sites", column: "last_preview_error_at", definition: "DATETIME" },
      { table: "json_sites", column: "updated_at", definition: "DATETIME" },
      { table: "leads", column: "status", definition: "TEXT DEFAULT 'scraped'" },
      { table: "leads", column: "last_contacted", definition: "DATETIME" },
      { table: "leads", column: "last_viewed_at", definition: "DATETIME" },
      { table: "leads", column: "last_downloaded_at", definition: "DATETIME" },
      { table: "leads", column: "setup_followup_contacted_at", definition: "DATETIME" },
      { table: "leads", column: "view_count", definition: "INTEGER DEFAULT 0" },
      { table: "leads", column: "download_count", definition: "INTEGER DEFAULT 0" },
      { table: "leads", column: "updated_at", definition: "DATETIME" },
      { table: "places_prospects", column: "status", definition: "TEXT DEFAULT 'new'" },
      { table: "places_prospects", column: "generated_business_id", definition: "TEXT" },
      { table: "places_prospects", column: "updated_at", definition: "DATETIME" },
    ]);
    const columns = await tableColumns(db, "json_sites");
    const selectedColumns = [
      columns.has("id") ? "id" : "",
      "business_id",
      "json_content",
      columns.has("r2_json_key") ? "r2_json_key" : "",
      columns.has("r2_json_url") ? "r2_json_url" : "",
      columns.has("json_summary") ? "json_summary" : "",
      columns.has("last_preview_error") ? "last_preview_error" : "",
      columns.has("last_preview_error_at") ? "last_preview_error_at" : "",
      columns.has("created_at") ? "created_at" : "",
      columns.has("updated_at") ? "updated_at" : "",
    ].filter(Boolean);

    const orderColumn = columns.has("updated_at") ? "updated_at" : columns.has("created_at") ? "created_at" : "business_id";
    const rows = await db
      .prepare(
        `SELECT ${selectedColumns.map((column) => `s.${column}`).join(", ")},
          (SELECT l.status FROM leads l WHERE l.business_id = s.business_id LIMIT 1) AS lead_status,
          (SELECT l.last_contacted FROM leads l WHERE l.business_id = s.business_id LIMIT 1) AS lead_last_contacted,
          (SELECT l.last_viewed_at FROM leads l WHERE l.business_id = s.business_id LIMIT 1) AS lead_last_viewed_at,
          (SELECT l.view_count FROM leads l WHERE l.business_id = s.business_id LIMIT 1) AS lead_view_count,
          (SELECT l.last_downloaded_at FROM leads l WHERE l.business_id = s.business_id LIMIT 1) AS lead_last_downloaded_at,
          (SELECT l.download_count FROM leads l WHERE l.business_id = s.business_id LIMIT 1) AS lead_download_count,
          (SELECT l.setup_followup_contacted_at FROM leads l WHERE l.business_id = s.business_id LIMIT 1) AS lead_setup_followup_contacted_at,
          (SELECT p.status FROM places_prospects p WHERE p.generated_business_id = s.business_id ORDER BY datetime(p.updated_at) DESC LIMIT 1) AS prospect_status,
          (SELECT j.id FROM generation_jobs j WHERE j.business_id = s.business_id ORDER BY datetime(j.created_at) DESC LIMIT 1) AS latest_generation_job_id,
          (SELECT j.status FROM generation_jobs j WHERE j.business_id = s.business_id ORDER BY datetime(j.created_at) DESC LIMIT 1) AS latest_generation_job_status,
          (SELECT j.updated_at FROM generation_jobs j WHERE j.business_id = s.business_id ORDER BY datetime(j.created_at) DESC LIMIT 1) AS latest_generation_job_updated_at
         FROM json_sites s
         ORDER BY s.${orderColumn} DESC`,
      )
      .all<{
        id?: string;
        business_id: string;
        json_content: string;
        r2_json_key?: string;
        r2_json_url?: string;
        json_summary?: string;
        last_preview_error?: string;
        last_preview_error_at?: string;
        created_at?: string;
        updated_at?: string;
        lead_status?: string;
        lead_last_contacted?: string;
        lead_last_viewed_at?: string;
        lead_view_count?: number;
        lead_last_downloaded_at?: string;
        lead_download_count?: number;
        lead_setup_followup_contacted_at?: string;
        prospect_status?: string;
        latest_generation_job_id?: string;
        latest_generation_job_status?: string;
        latest_generation_job_updated_at?: string;
      }>();

    return json((rows.results || []).map((row) => {
      try {
      let parsed: Record<string, unknown> = {};
      try {
        parsed = parseJsonObject(row.json_summary);
        if (!Object.keys(parsed).length) {
          const jsonContent = parseJsonObject(row.json_content);
          parsed = jsonContent.storageOnly === true && jsonContent.summary && typeof jsonContent.summary === "object"
            ? jsonContent.summary as Record<string, unknown>
            : jsonContent;
        } else {
          const jsonContent = parseJsonObject(row.json_content);
          if (
            (
              parsed.hasMissingServiceCardImages === undefined ||
              parsed.duplicateServiceCardImageCount === undefined ||
              parsed.needsServiceCardImageRepair === undefined ||
              parsed.needsAboutNavRepair === undefined ||
              parsed.lastImageRepairAt === undefined ||
              parsed.lastVisualVariationAt === undefined
            ) &&
            jsonContent.storageOnly !== true &&
            Array.isArray(jsonContent.pages)
          ) {
            parsed = { ...siteSummaryFromJson(siteStorageDeps, jsonContent, row.business_id), ...parsed };
          }
        }
      } catch {
        parsed = {};
      }
      const summary = parsed.businessName ? parsed : siteSummaryFromJson(siteStorageDeps, parsed, row.business_id);
      return {
        id: row.id || row.business_id,
        businessId: row.business_id,
        businessName: asString(summary.businessName, row.business_id),
        niche: asString(summary.niche, ""),
        language: asString(summary.language, ""),
        region: asString(summary.region, ""),
        rating: typeof summary.rating === "number" ? summary.rating : null,
        reviewCount: typeof summary.reviewCount === "number" ? summary.reviewCount : null,
        createdAt: row.created_at || "",
        updatedAt: row.updated_at || row.created_at || "",
        previewUrl: `/${row.business_id}`,
        googleMapsUrl: asString(summary.googleMapsUrl, ""),
        generatedWithAi: summary.generatedWithAi === true,
        generationMode: asString(summary.generationMode, ""),
        aiProvider: asString(summary.aiProvider, ""),
        aiModel: asString(summary.aiModel, ""),
        serviceCardImageTotal: typeof summary.serviceCardImageTotal === "number" ? summary.serviceCardImageTotal : null,
        missingServiceCardImageCount: typeof summary.missingServiceCardImageCount === "number" ? summary.missingServiceCardImageCount : null,
        duplicateServiceCardImageCount: typeof summary.duplicateServiceCardImageCount === "number" ? summary.duplicateServiceCardImageCount : null,
        hasMissingServiceCardImages: summary.hasMissingServiceCardImages === true,
        hasDuplicateServiceCardImages: summary.hasDuplicateServiceCardImages === true,
        needsServiceCardImageRepair: summary.needsServiceCardImageRepair === true,
        hasAboutPage: summary.hasAboutPage === true,
        serviceNavLabelTotal: typeof summary.serviceNavLabelTotal === "number" ? summary.serviceNavLabelTotal : null,
        missingServiceNavLabelCount: typeof summary.missingServiceNavLabelCount === "number" ? summary.missingServiceNavLabelCount : null,
        needsAboutNavRepair: summary.needsAboutNavRepair === true || summary.needsAboutNavRepair === undefined,
        aboutNavAuditKnown: summary.needsAboutNavRepair !== undefined,
        lastImageRepairAt: asString(summary.lastImageRepairAt, ""),
        fontPairing: asString(summary.fontPairing, ""),
        fontPairingLabel: asString(summary.fontPairingLabel, ""),
        lastVisualVariationAt: asString(summary.lastVisualVariationAt, ""),
        leadStatus: row.lead_status || "",
        lastContactedAt: row.lead_last_contacted || "",
        lastViewedAt: row.lead_last_viewed_at || "",
        viewCount: Number(row.lead_view_count || 0) || 0,
        lastDownloadedAt: row.lead_last_downloaded_at || "",
        downloadCount: Number(row.lead_download_count || 0) || 0,
        setupFollowUpContactedAt: row.lead_setup_followup_contacted_at || "",
        prospectStatus: row.prospect_status || "",
        contacted: Boolean(row.lead_last_contacted || row.lead_status === "contacted" || row.prospect_status === "contacted"),
        r2JsonUrl: row.r2_json_url || "",
        storageMode: row.r2_json_key ? "r2" : "legacy_d1",
        lastPreviewError: row.last_preview_error || "",
        lastPreviewErrorAt: row.last_preview_error_at || "",
        needsRecovery: Boolean(row.last_preview_error),
        latestGenerationJobId: row.latest_generation_job_id || "",
        latestGenerationJobStatus: row.latest_generation_job_status || "",
        latestGenerationJobUpdatedAt: row.latest_generation_job_updated_at || "",
      };
      } catch (error) {
        console.error(`Site list row summary failed for ${row.business_id}:`, error);
        return {
          id: row.id || row.business_id,
          businessId: row.business_id,
          businessName: row.business_id,
          niche: "Site summary needs repair",
          language: "",
          region: "",
          rating: null,
          reviewCount: null,
          createdAt: row.created_at || "",
          updatedAt: row.updated_at || row.created_at || "",
          previewUrl: `/${row.business_id}`,
          googleMapsUrl: "",
          generatedWithAi: false,
          generationMode: "summary_error",
          aiProvider: "",
          aiModel: "",
          serviceCardImageTotal: null,
          missingServiceCardImageCount: null,
          duplicateServiceCardImageCount: null,
          hasMissingServiceCardImages: false,
          hasDuplicateServiceCardImages: false,
          needsServiceCardImageRepair: false,
          hasAboutPage: false,
          serviceNavLabelTotal: null,
          missingServiceNavLabelCount: null,
          needsAboutNavRepair: true,
          aboutNavAuditKnown: false,
          lastImageRepairAt: "",
          fontPairing: "",
          fontPairingLabel: "",
          lastVisualVariationAt: "",
          leadStatus: row.lead_status || "",
          lastContactedAt: row.lead_last_contacted || "",
          lastViewedAt: row.lead_last_viewed_at || "",
          viewCount: Number(row.lead_view_count || 0) || 0,
          lastDownloadedAt: row.lead_last_downloaded_at || "",
          downloadCount: Number(row.lead_download_count || 0) || 0,
          setupFollowUpContactedAt: row.lead_setup_followup_contacted_at || "",
          prospectStatus: row.prospect_status || "",
          contacted: Boolean(row.lead_last_contacted || row.lead_status === "contacted" || row.prospect_status === "contacted"),
          r2JsonUrl: row.r2_json_url || "",
          storageMode: row.r2_json_key ? "r2" : "legacy_d1",
          lastPreviewError: row.last_preview_error || "",
          lastPreviewErrorAt: row.last_preview_error_at || "",
          needsRecovery: true,
          latestGenerationJobId: row.latest_generation_job_id || "",
          latestGenerationJobStatus: row.latest_generation_job_status || "",
          latestGenerationJobUpdatedAt: row.latest_generation_job_updated_at || "",
        };
      }
    }));
  }

  if (request.method === "POST" && segments.length === 2 && segments[1] === "migrate-r2") {
    return migrateOldSiteJsonRowsToR2(siteStorageDeps, request, db, env);
  }

  if (request.method === "POST" && segments.length === 2 && segments[1] === "scan-r2-health") {
    if (!env.R2?.get) {
      return errorJson("R2 binding is not configured. Cannot scan R2 JSON health.", 400);
    }
    const body = await readJsonBody(request).catch(() => ({}));
    const limit = Math.max(1, Math.min(25, Math.floor(Number(body.limit || 10))));
    const offset = Math.max(0, Math.floor(Number(body.offset || 0)));
    await ensureRequiredColumns(db, [
      { table: "json_sites", column: "r2_json_key", definition: "TEXT" },
      { table: "json_sites", column: "last_preview_error", definition: "TEXT" },
      { table: "json_sites", column: "last_preview_error_at", definition: "DATETIME" },
      { table: "json_sites", column: "updated_at", definition: "DATETIME" },
    ]);

    const rows = await db
      .prepare(
        `SELECT business_id, json_content, r2_json_key
         FROM json_sites
         WHERE COALESCE(r2_json_key, '') <> ''
         ORDER BY datetime(COALESCE(updated_at, created_at, '1970-01-01')) DESC
         LIMIT ? OFFSET ?`,
      )
      .bind(limit, offset)
      .all<{ business_id: string; json_content: string; r2_json_key?: string }>();
    const totalRow = await db
      .prepare("SELECT COUNT(*) AS total FROM json_sites WHERE COALESCE(r2_json_key, '') <> ''")
      .first<{ total?: number }>();

    let ok = 0;
    let failed = 0;
    const failures: Array<{ businessId: string; error: string }> = [];
    for (const row of rows.results || []) {
      try {
        await readSiteJsonFromStorage(siteStorageDeps, row, env);
        ok += 1;
        await db
          .prepare("UPDATE json_sites SET last_preview_error = NULL, last_preview_error_at = NULL WHERE business_id = ?")
          .bind(row.business_id)
          .run();
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : String(error);
        failures.push({ businessId: row.business_id, error: message.slice(0, 300) });
        await db
          .prepare("UPDATE json_sites SET last_preview_error = ?, last_preview_error_at = ? WHERE business_id = ?")
          .bind(message.slice(0, 1000), new Date().toISOString(), row.business_id)
          .run();
      }
    }

    const scanned = (rows.results || []).length;
    const total = Number(totalRow?.total || 0);
    const nextOffset = offset + scanned;
    return json({
      success: true,
      scanned,
      ok,
      failed,
      failures,
      offset,
      nextOffset,
      total,
      hasMore: nextOffset < total && scanned > 0,
    });
  }

  if (request.method === "POST" && segments.length === 3 && segments[2] === "outreach-contacted") {
    const businessId = segments[1];
    const body = await readJsonBody(request);
    const channel = asString(body.channel, "unknown").trim() || "unknown";
    const action = asString(body.action, "outreach").trim() || "outreach";
    const contact = asString(body.contact).trim();
    const now = new Date().toISOString();

    await ensureRequiredColumns(db, [
      { table: "leads", column: "status", definition: "TEXT DEFAULT 'scraped'" },
      { table: "leads", column: "last_contacted", definition: "DATETIME" },
      { table: "leads", column: "setup_followup_contacted_at", definition: "DATETIME" },
      { table: "leads", column: "updated_at", definition: "DATETIME" },
      { table: "places_prospects", column: "status", definition: "TEXT DEFAULT 'new'" },
      { table: "places_prospects", column: "generated_business_id", definition: "TEXT" },
      { table: "places_prospects", column: "updated_at", definition: "DATETIME" },
    ]);

    const leadColumns = await tableColumns(db, "leads");
    const lead = await db.prepare("SELECT id, status FROM leads WHERE business_id = ?").bind(businessId).first<{ id: string; status?: string }>();
    const isSetupFollowUp = action.startsWith("setup_upsell_") || action.startsWith("setup_followup_");
    let leadUpdated = false;
    if (lead?.id) {
      const updates: Array<{ column: string; value: unknown; expression?: string }> = [];
      if (leadColumns.has("status")) {
        updates.push({
          column: "status",
          value: "contacted",
          expression: "CASE WHEN status IN ('won_paid', 'checkout_pending', 'viewed') THEN status ELSE ? END",
        });
      }
      if (leadColumns.has("last_contacted")) updates.push({ column: "last_contacted", value: now });
      if (isSetupFollowUp && leadColumns.has("setup_followup_contacted_at")) updates.push({ column: "setup_followup_contacted_at", value: now });
      if (leadColumns.has("updated_at")) updates.push({ column: "updated_at", value: now });
      if (updates.length) {
        await db
          .prepare(`UPDATE leads SET ${updates.map((item) => `${item.column} = ${item.expression || "?"}`).join(", ")} WHERE id = ?`)
          .bind(...updates.map((item) => item.value), lead.id)
          .run();
        leadUpdated = true;
      }
      await insertCrmActivitySafe(db, {
        id: crypto.randomUUID(),
        lead_id: lead.id,
        staff_id: "admin",
        activity_type: "outreach_contacted",
        description: `Owner outreach ${action} via ${channel}${contact ? ` (${contact})` : ""}.`,
      });
    }

    const prospectColumns = await tableColumns(db, "places_prospects");
    let prospectUpdated = false;
    if (prospectColumns.has("generated_business_id") && prospectColumns.has("status")) {
      await db
        .prepare(
          `UPDATE places_prospects
           SET status = CASE WHEN status IN ('site_generated', 'skipped') THEN status ELSE 'contacted' END${prospectColumns.has("updated_at") ? ", updated_at = ?" : ""}
           WHERE generated_business_id = ?`,
        )
        .bind(...(prospectColumns.has("updated_at") ? [now] : []), businessId)
        .run();
      prospectUpdated = true;
    }

    return json({
      success: true,
      businessId,
      leadUpdated,
      prospectUpdated,
      lastContactedAt: now,
      setupFollowUpContactedAt: isSetupFollowUp ? now : undefined,
    });
  }

  if (request.method === "POST" && segments.length === 3 && segments[2] === "downloaded") {
    const businessId = segments[1];
    const body = await readJsonBody(request).catch(() => ({}));
    const source = asString(body.source, "website_action_panel").trim() || "website_action_panel";
    const now = new Date().toISOString();

    await ensureRequiredColumns(db, [
      { table: "leads", column: "download_count", definition: "INTEGER DEFAULT 0" },
      { table: "leads", column: "last_downloaded_at", definition: "DATETIME" },
      { table: "leads", column: "updated_at", definition: "DATETIME" },
      { table: "crm_activities", column: "staff_id", definition: "TEXT" },
      { table: "crm_activities", column: "description", definition: "TEXT" },
    ]);

    const lead = await db.prepare("SELECT id FROM leads WHERE business_id = ?").bind(businessId).first<{ id: string }>();
    let leadUpdated = false;
    if (lead?.id) {
      await db
        .prepare(
          `UPDATE leads
           SET download_count = COALESCE(download_count, 0) + 1,
               last_downloaded_at = ?,
               updated_at = ?
           WHERE id = ?`,
        )
        .bind(now, now, lead.id)
        .run();
      leadUpdated = true;
      await insertCrmActivitySafe(db, {
        id: crypto.randomUUID(),
        lead_id: lead.id,
        staff_id: "system",
        activity_type: "site_downloaded",
        description: `Free static website package downloaded from ${source}.`,
      });
    }

    return json({
      success: true,
      businessId,
      leadUpdated,
      lastDownloadedAt: now,
    });
  }

  if (request.method === "POST" && segments.length === 3 && segments[2] === "ai-fill-about-nav-start") {
    const startStartedMs = Date.now();
    const businessId = segments[1];
    const body = await readJsonBody(request).catch(() => ({}));
    const provider = asString(body.provider);
    const model = asString(body.model);
    await ensureRequiredColumns(db, [
      { table: "json_sites", column: "r2_json_key", definition: "TEXT" },
      { table: "json_sites", column: "r2_json_url", definition: "TEXT" },
      { table: "json_sites", column: "json_summary", definition: "TEXT" },
      { table: "json_sites", column: "updated_at", definition: "DATETIME" },
    ]);
    const columns = await tableColumns(db, "json_sites");
    const selectedColumns = [
      "business_id",
      "json_content",
      columns.has("r2_json_key") ? "r2_json_key" : "",
    ].filter(Boolean);
    const row = await db
      .prepare(`SELECT ${selectedColumns.join(", ")} FROM json_sites WHERE business_id = ?`)
      .bind(businessId)
      .first<{ business_id: string; json_content: string; r2_json_key?: string }>();
    if (!row?.json_content) return errorJson("Site not found", 404);

    const siteJson = await readSiteJsonFromStorage(siteStorageDeps, row, env);
    if (!siteJson || typeof siteJson !== "object" || Array.isArray(siteJson)) {
      return errorJson("Saved site JSON is not an object and cannot start About/nav AI fill.", 422);
    }
    const beforeSummary = siteSummaryFromJson(siteStorageDeps, siteJson, businessId);
    const originData = siteJson.sourceData && typeof siteJson.sourceData === "object" ? siteJson.sourceData as Record<string, unknown> : {};
    const navRepair = repairOfferingNavLabels(siteJson);
    applyGeneratedSitePageInserts(siteJson, originData);
    const aboutNavFillStartedAt = new Date().toISOString();
    const meta = siteJson.meta && typeof siteJson.meta === "object" ? siteJson.meta as Record<string, unknown> : {};
    siteJson.meta = { ...meta, lastAboutNavFillStartedAt: aboutNavFillStartedAt };
    const storage = siteJson.storage && typeof siteJson.storage === "object" ? siteJson.storage as Record<string, unknown> : {};
    let r2JsonKey = asString(storage.r2JsonKey, asString(row.r2_json_key));
    let r2JsonUrl = asString(storage.r2JsonUrl);
    if (r2JsonKey || env.R2) {
      const nextKey = await uploadJsonToR2(siteJson, env, businessId);
      if (nextKey) {
        r2JsonKey = nextKey;
        r2JsonUrl = publicR2Url(env, nextKey);
        siteJson.storage = { ...storage, r2JsonKey, r2JsonUrl };
        await uploadJsonToR2(siteJson, env, businessId);
      }
    }
    const jsonSummary = siteSummaryFromJson(siteStorageDeps, siteJson, businessId);
    const d1JsonContent = r2JsonKey
      ? JSON.stringify(compactSiteManifest(siteStorageDeps, siteJson, env, businessId, r2JsonKey))
      : JSON.stringify(siteJson);
    await saveJsonSiteRecord(db, businessId, d1JsonContent, {
      r2_json_key: r2JsonKey || null,
      r2_json_url: r2JsonUrl || null,
      json_summary: JSON.stringify(jsonSummary),
    });

    const profile = siteJson.businessProfile && typeof siteJson.businessProfile === "object" ? siteJson.businessProfile as Record<string, unknown> : {};
    const updatedMeta = siteJson.meta && typeof siteJson.meta === "object" ? siteJson.meta as Record<string, unknown> : {};
    const businessName = asString(updatedMeta.businessName, asString(profile.name, businessId));
    const contact = profile.contact && typeof profile.contact === "object" ? profile.contact as Record<string, unknown> : {};
    const jobId = crypto.randomUUID();
    const payload = {
      requireAi: true,
      skipAiOfferingOutline: true,
      siteCopyFocus: "about",
      offeringCopyFocus: "navLabels",
      provider,
      model,
      jsonContent: siteJson,
      businessId,
      businessName,
      phone: asString(contact.phoneInternational, asString(contact.phoneNational)),
      originData,
      brandPalette: siteJson.meta && typeof siteJson.meta === "object" ? (siteJson.meta as Record<string, unknown>).brandPalette || [] : [],
      paletteOptions: siteJson.brand && typeof siteJson.brand === "object" ? (siteJson.brand as Record<string, unknown>).paletteOptions || [] : [],
    };
    const metadata = {
      businessName,
      generationMode: "chunked_ai_generation",
      chunked: true,
      step: "outline_complete",
      nextStep: "siteCopy",
      payload,
      copyPatchApplied: false,
      offeringOutlineSkipped: true,
      createdFor: "about_nav_ai_fill_retryable_flow",
      aboutNavDeterministicRepair: {
        before: beforeSummary,
        after: jsonSummary,
        navLabelsChanged: navRepair.changed,
        startedAt: aboutNavFillStartedAt,
      },
      aboutNavTiming: {
        start: {
          status: "complete",
          attempts: 1,
          totalDurationMs: Math.max(0, Date.now() - startStartedMs),
          lastDurationMs: Math.max(0, Date.now() - startStartedMs),
          lastStartedAt: new Date(startStartedMs).toISOString(),
          lastCompletedAt: new Date().toISOString(),
          storageMode: r2JsonKey ? "r2" : "legacy_d1",
          navLabelsChanged: navRepair.changed,
        },
      },
      checkedAt: aboutNavFillStartedAt,
    };
    await ensureRequiredColumns(db, generateRequiredColumns);
    await createGenerationJob(db, {
      id: jobId,
      business_id: businessId,
      place_id: asString(originData.placeId, asString(originData.place_id)),
      provider,
      model,
      status: "running",
      metadata_json: JSON.stringify(metadata),
    });
    return json({
      success: true,
      id: jobId,
      nextStep: "siteCopy",
      deterministic: metadata.aboutNavDeterministicRepair,
      storageMode: r2JsonKey ? "r2" : "legacy_d1",
    });
  }

  if (request.method === "POST" && segments.length === 3 && segments[2] === "ai-fill-about-nav-finalize") {
    const finalizeStartedMs = Date.now();
    const businessId = segments[1];
    const body = await readJsonBody(request).catch(() => ({}));
    const copyPatchSource = body.copyPatch || body.prepatchedCopyPatch;
    const copyPatch = copyPatchSource && typeof copyPatchSource === "object" && !Array.isArray(copyPatchSource)
      ? copyPatchSource as Record<string, unknown>
      : null;
    await ensureRequiredColumns(db, [
      { table: "json_sites", column: "r2_json_key", definition: "TEXT" },
      { table: "json_sites", column: "r2_json_url", definition: "TEXT" },
      { table: "json_sites", column: "json_summary", definition: "TEXT" },
      { table: "json_sites", column: "updated_at", definition: "DATETIME" },
      { table: "leads", column: "status", definition: "TEXT DEFAULT 'scraped'" },
      { table: "leads", column: "last_contacted", definition: "DATETIME" },
      { table: "leads", column: "updated_at", definition: "DATETIME" },
      { table: "places_prospects", column: "status", definition: "TEXT DEFAULT 'new'" },
      { table: "places_prospects", column: "generated_business_id", definition: "TEXT" },
      { table: "places_prospects", column: "updated_at", definition: "DATETIME" },
    ]);
    const columns = await tableColumns(db, "json_sites");
    const selectedColumns = [
      "business_id",
      "json_content",
      columns.has("r2_json_key") ? "r2_json_key" : "",
    ].filter(Boolean);
    const row = await db
      .prepare(`SELECT ${selectedColumns.join(", ")} FROM json_sites WHERE business_id = ?`)
      .bind(businessId)
      .first<{ business_id: string; json_content: string; r2_json_key?: string }>();
    if (!row?.json_content) return errorJson("Site not found", 404);

    const siteJson = await readSiteJsonFromStorage(siteStorageDeps, row, env);
    if (!siteJson || typeof siteJson !== "object" || Array.isArray(siteJson)) {
      return errorJson("Saved site JSON is not an object and cannot finalize About/nav AI fill.", 422);
    }
    const originData = siteJson.sourceData && typeof siteJson.sourceData === "object" ? siteJson.sourceData as Record<string, unknown> : {};
    applyGeneratedSitePageInserts(siteJson, originData);
    if (copyPatch) applyAiCopyPatch(siteJson, copyPatch);

    const finalizedAt = new Date().toISOString();
    const meta = siteJson.meta && typeof siteJson.meta === "object" ? siteJson.meta as Record<string, unknown> : {};
    siteJson.meta = {
      ...meta,
      generatedWithAi: true,
      generationMode: "ai_copy_patch",
      aiProvider: asString(body.provider, asString(meta.aiProvider)),
      aiModel: asString(body.model, asString(meta.aiModel)),
      lastAboutNavFillAt: finalizedAt,
      lastAboutNavFillJobId: asString(body.parentGenerationJobId),
    };

    const storage = siteJson.storage && typeof siteJson.storage === "object" ? siteJson.storage as Record<string, unknown> : {};
    let r2JsonKey = asString(storage.r2JsonKey, asString(row.r2_json_key));
    let r2JsonUrl = asString(storage.r2JsonUrl);
    if (r2JsonKey || env.R2) {
      const nextKey = await uploadJsonToR2(siteJson, env, businessId);
      if (nextKey) {
        r2JsonKey = nextKey;
        r2JsonUrl = publicR2Url(env, nextKey);
        siteJson.storage = { ...storage, r2JsonKey, r2JsonUrl };
        await uploadJsonToR2(siteJson, env, businessId);
      }
    }
    const jsonSummary = siteSummaryFromJson(siteStorageDeps, siteJson, businessId);
    const d1JsonContent = r2JsonKey
      ? JSON.stringify(compactSiteManifest(siteStorageDeps, siteJson, env, businessId, r2JsonKey))
      : JSON.stringify(siteJson);
    await saveJsonSiteRecord(db, businessId, d1JsonContent, {
      r2_json_key: r2JsonKey || null,
      r2_json_url: r2JsonUrl || null,
      json_summary: JSON.stringify(jsonSummary),
    });
    return json({
      success: true,
      businessId,
      finalizedAt,
      finalizeDurationMs: Math.max(0, Date.now() - finalizeStartedMs),
      summary: jsonSummary,
      storageMode: r2JsonKey ? "r2" : "legacy_d1",
    });
  }

  if (request.method === "POST" && segments.length === 3 && segments[2] === "resave-json-summary") {
    const businessId = segments[1];
    await ensureRequiredColumns(db, [
      { table: "json_sites", column: "r2_json_key", definition: "TEXT" },
      { table: "json_sites", column: "r2_json_url", definition: "TEXT" },
      { table: "json_sites", column: "json_summary", definition: "TEXT" },
      { table: "json_sites", column: "updated_at", definition: "DATETIME" },
    ]);
    const columns = await tableColumns(db, "json_sites");
    const selectedColumns = [
      "business_id",
      "json_content",
      columns.has("r2_json_key") ? "r2_json_key" : "",
    ].filter(Boolean);
    const row = await db
      .prepare(`SELECT ${selectedColumns.join(", ")} FROM json_sites WHERE business_id = ?`)
      .bind(businessId)
      .first<{ business_id: string; json_content: string; r2_json_key?: string }>();
    if (!row?.json_content) return errorJson("Site not found", 404);

    let siteJson: Record<string, unknown>;
    try {
      const savedJson = await readSiteJsonFromStorage(siteStorageDeps, row, env);
      if (!savedJson || typeof savedJson !== "object" || Array.isArray(savedJson)) {
        return errorJson("Saved site JSON is not an object and cannot be re-saved.", 422);
      }
      siteJson = savedJson as Record<string, unknown>;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return errorJson(`Cannot repair this site without readable full JSON. ${message}`, 409);
    }

    const originData = siteJson.sourceData && typeof siteJson.sourceData === "object" ? siteJson.sourceData as Record<string, unknown> : {};
    applyGeneratedSitePageInserts(siteJson, originData);
    const repairedAt = new Date().toISOString();
    const meta = siteJson.meta && typeof siteJson.meta === "object" ? siteJson.meta as Record<string, unknown> : {};
    siteJson.meta = { ...meta, lastJsonSummaryRepairAt: repairedAt };

    const storage = siteJson.storage && typeof siteJson.storage === "object" ? siteJson.storage as Record<string, unknown> : {};
    let r2JsonKey = asString(storage.r2JsonKey, asString(row.r2_json_key));
    let r2JsonUrl = asString(storage.r2JsonUrl);
    if (r2JsonKey || env.R2) {
      const nextKey = await uploadJsonToR2(siteJson, env, businessId);
      if (nextKey) {
        r2JsonKey = nextKey;
        r2JsonUrl = publicR2Url(env, nextKey);
        siteJson.storage = { ...storage, r2JsonKey, r2JsonUrl };
        await uploadJsonToR2(siteJson, env, businessId);
      }
    }
    const jsonSummary = siteSummaryFromJson(siteStorageDeps, siteJson, businessId);
    const d1JsonContent = r2JsonKey
      ? JSON.stringify(compactSiteManifest(siteStorageDeps, siteJson, env, businessId, r2JsonKey))
      : JSON.stringify(siteJson);
    await saveJsonSiteRecord(db, businessId, d1JsonContent, {
      r2_json_key: r2JsonKey || null,
      r2_json_url: r2JsonUrl || null,
      json_summary: JSON.stringify(jsonSummary),
    });
    return json({
      success: true,
      businessId,
      repairedAt,
      summary: jsonSummary,
      storageMode: r2JsonKey ? "r2" : "legacy_d1",
    });
  }

  if (request.method === "POST" && segments.length === 3 && segments[2] === "restore-from-latest-job") {
    const businessId = segments[1];
    await ensureRequiredColumns(db, [
      { table: "json_sites", column: "r2_json_key", definition: "TEXT" },
      { table: "json_sites", column: "r2_json_url", definition: "TEXT" },
      { table: "json_sites", column: "json_summary", definition: "TEXT" },
      { table: "json_sites", column: "updated_at", definition: "DATETIME" },
      { table: "generation_jobs", column: "business_id", definition: "TEXT" },
      { table: "generation_jobs", column: "status", definition: "TEXT" },
      { table: "generation_jobs", column: "metadata_json", definition: "TEXT" },
      { table: "generation_jobs", column: "updated_at", definition: "DATETIME" },
    ]);

    const candidates = await db
      .prepare(
        `SELECT id, metadata_json, updated_at, created_at
         FROM generation_jobs
         WHERE business_id = ? AND status = 'success'
         ORDER BY datetime(COALESCE(updated_at, created_at)) DESC
         LIMIT 12`,
      )
      .bind(businessId)
      .all<{ id: string; metadata_json?: string; updated_at?: string; created_at?: string }>();

    let restored: ReturnType<typeof restoredJsonFromGenerationMetadata> = null;
    let sourceJobId = "";
    const checkedJobIds = new Set<string>();
    const tryMetadata = async (jobId: string, metadataJson?: string) => {
      if (!jobId || checkedJobIds.has(jobId)) return false;
      checkedJobIds.add(jobId);
      const metadata = parseJsonObject(metadataJson);
      const direct = restoredJsonFromGenerationMetadata(metadata);
      if (direct) {
        restored = direct;
        sourceJobId = jobId;
        return true;
      }
      const parentId = asString(metadata.parentGenerationJobId);
      if (!parentId || checkedJobIds.has(parentId)) return false;
      const parent = await db
        .prepare("SELECT id, metadata_json FROM generation_jobs WHERE id = ? LIMIT 1")
        .bind(parentId)
        .first<{ id: string; metadata_json?: string }>();
      if (!parent?.id) return false;
      checkedJobIds.add(parent.id);
      const parentRestored = restoredJsonFromGenerationMetadata(parseJsonObject(parent.metadata_json));
      if (!parentRestored) return false;
      restored = parentRestored;
      sourceJobId = parent.id;
      return true;
    };

    for (const candidate of candidates.results || []) {
      if (await tryMetadata(candidate.id, candidate.metadata_json)) break;
    }

    if (!restored) {
      return errorJson("No recent successful generation job contained enough saved payload/copy patch metadata to restore this site JSON.", 409, {
        businessId,
        checkedJobs: Array.from(checkedJobIds),
      });
    }

    const restoredAt = new Date().toISOString();
    const finalJson = restored.finalJson;
    const payload = restored.payload;
    const originData = restored.originData;
    const meta = finalJson.meta && typeof finalJson.meta === "object" ? finalJson.meta as Record<string, unknown> : {};
    const businessName = asString(meta.businessName, asString(payload.businessName, businessId));
    finalJson.meta = {
      ...meta,
      businessId,
      businessName,
      lastRestoredFromGenerationJobAt: restoredAt,
      restoredFromGenerationJobId: sourceJobId,
    };
    applySeededFontPairing(finalJson, businessName, businessId, originData);
    normalizeSiteColorContrast(finalJson);

    let r2JsonKey = "";
    let r2JsonUrl = "";
    if (env.R2) {
      const nextKey = await uploadJsonToR2(finalJson, env, businessId);
      if (nextKey) {
        r2JsonKey = nextKey;
        r2JsonUrl = publicR2Url(env, nextKey);
        const storage = finalJson.storage && typeof finalJson.storage === "object" ? finalJson.storage as Record<string, unknown> : {};
        finalJson.storage = { ...storage, r2JsonKey, r2JsonUrl };
        await uploadJsonToR2(finalJson, env, businessId);
      }
    }
    const jsonSummary = siteSummaryFromJson(siteStorageDeps, finalJson, businessId);
    const d1JsonContent = r2JsonKey
      ? JSON.stringify(compactSiteManifest(siteStorageDeps, finalJson, env, businessId, r2JsonKey))
      : JSON.stringify(finalJson);
    await saveJsonSiteRecord(db, businessId, d1JsonContent, {
      r2_json_key: r2JsonKey || null,
      r2_json_url: r2JsonUrl || null,
      json_summary: JSON.stringify(jsonSummary),
    });
    return json({
      success: true,
      businessId,
      restoredAt,
      sourceJobId,
      summary: jsonSummary,
      storageMode: r2JsonKey ? "r2" : "legacy_d1",
    });
  }

  if (request.method === "POST" && segments.length === 3 && segments[2] === "repair-service-images") {
    const businessId = segments[1];
    await ensureRequiredColumns(db, [
      { table: "json_sites", column: "r2_json_key", definition: "TEXT" },
      { table: "json_sites", column: "r2_json_url", definition: "TEXT" },
      { table: "json_sites", column: "json_summary", definition: "TEXT" },
      { table: "json_sites", column: "updated_at", definition: "DATETIME" },
    ]);
    const columns = await tableColumns(db, "json_sites");
    const selectedColumns = [
      "business_id",
      "json_content",
      columns.has("r2_json_key") ? "r2_json_key" : "",
    ].filter(Boolean);
    const row = await db
      .prepare(`SELECT ${selectedColumns.join(", ")} FROM json_sites WHERE business_id = ?`)
      .bind(businessId)
      .first<{ business_id: string; json_content: string; r2_json_key?: string }>();
    if (!row?.json_content) return errorJson("Site not found", 404);

    const siteJson = await readSiteJsonFromStorage(siteStorageDeps, row, env);
    if (!siteJson || typeof siteJson !== "object" || Array.isArray(siteJson)) {
      return errorJson("Saved site JSON is not an object and cannot be repaired.", 422);
    }
    const originData = siteJson.sourceData && typeof siteJson.sourceData === "object" ? siteJson.sourceData as Record<string, unknown> : {};
    const repairResult = repairServiceCardImages(siteJson, originData);
    applyGeneratedSitePageInserts(siteJson, originData);
    const imageRepairAt = new Date().toISOString();
    const meta = siteJson.meta && typeof siteJson.meta === "object" ? siteJson.meta as Record<string, unknown> : {};
    siteJson.meta = { ...meta, lastImageRepairAt: imageRepairAt };
    const storage = siteJson.storage && typeof siteJson.storage === "object" ? siteJson.storage as Record<string, unknown> : {};
    let r2JsonKey = asString(storage.r2JsonKey, asString(row.r2_json_key));
    let r2JsonUrl = asString(storage.r2JsonUrl);
    if (r2JsonKey || env.R2) {
      const nextKey = await uploadJsonToR2(siteJson, env, businessId);
      if (nextKey) {
        r2JsonKey = nextKey;
        r2JsonUrl = publicR2Url(env, nextKey);
        siteJson.storage = { ...storage, r2JsonKey, r2JsonUrl };
        await uploadJsonToR2(siteJson, env, businessId);
      }
    }
    const jsonSummary = siteSummaryFromJson(siteStorageDeps, siteJson, businessId);
    const d1JsonContent = r2JsonKey
      ? JSON.stringify(compactSiteManifest(siteStorageDeps, siteJson, env, businessId, r2JsonKey))
      : JSON.stringify(siteJson);
    await saveJsonSiteRecord(db, businessId, d1JsonContent, {
      r2_json_key: r2JsonKey || null,
      r2_json_url: r2JsonUrl || null,
      json_summary: JSON.stringify(jsonSummary),
    });
    return json({
      success: true,
      businessId,
      changed: repairResult.changed,
      availableImages: repairResult.availableImages,
      lastImageRepairAt: imageRepairAt,
      storageMode: r2JsonKey ? "r2" : "legacy_d1",
    });
  }

  if (request.method === "POST" && segments.length === 3 && segments[2] === "refresh-visual-variation") {
    const businessId = segments[1];
    await ensureRequiredColumns(db, [
      { table: "json_sites", column: "r2_json_key", definition: "TEXT" },
      { table: "json_sites", column: "r2_json_url", definition: "TEXT" },
      { table: "json_sites", column: "json_summary", definition: "TEXT" },
      { table: "json_sites", column: "updated_at", definition: "DATETIME" },
    ]);
    const columns = await tableColumns(db, "json_sites");
    const selectedColumns = [
      "business_id",
      "json_content",
      columns.has("r2_json_key") ? "r2_json_key" : "",
    ].filter(Boolean);
    const row = await db
      .prepare(`SELECT ${selectedColumns.join(", ")} FROM json_sites WHERE business_id = ?`)
      .bind(businessId)
      .first<{ business_id: string; json_content: string; r2_json_key?: string }>();
    if (!row?.json_content) return errorJson("Site not found", 404);

    const siteJson = await readSiteJsonFromStorage(siteStorageDeps, row, env);
    if (!siteJson || typeof siteJson !== "object" || Array.isArray(siteJson)) {
      return errorJson("Saved site JSON is not an object and cannot refresh visual variation.", 422);
    }
    const meta = siteJson.meta && typeof siteJson.meta === "object" ? siteJson.meta as Record<string, unknown> : {};
    const profile = siteJson.businessProfile && typeof siteJson.businessProfile === "object" ? siteJson.businessProfile as Record<string, unknown> : {};
    const businessName = asString(meta.businessName, asString(profile.name, businessId));
    const sourceData = siteJson.sourceData && typeof siteJson.sourceData === "object" ? siteJson.sourceData as Record<string, unknown> : {};
    const body = await readJsonBody(request).catch(() => ({}));
    const variationResult = applySeededFontPairing(siteJson, businessName, businessId, sourceData, true);
    const incomingPaletteOptions = Array.isArray(body.paletteOptions)
      ? body.paletteOptions.filter((option) => option && typeof option === "object" && Array.isArray((option as Record<string, unknown>).colors))
      : [];
    let paletteOptionsChanged = false;
    if (incomingPaletteOptions.length > 0) {
      const brand = siteJson.brand && typeof siteJson.brand === "object" ? siteJson.brand as Record<string, unknown> : {};
      const existingPaletteOptions = Array.isArray(brand.paletteOptions) ? brand.paletteOptions : [];
      const existingKeys = new Set(existingPaletteOptions.map((option) => {
        const record = option && typeof option === "object" ? option as Record<string, unknown> : {};
        return asString(record.sourceImageUrl, asString(record.photoReference, asString(record.id)));
      }).filter(Boolean));
      const mergedPaletteOptions = [...existingPaletteOptions];
      incomingPaletteOptions.forEach((option) => {
        const record = option as Record<string, unknown>;
        const key = asString(record.sourceImageUrl, asString(record.photoReference, asString(record.id)));
        if (key && existingKeys.has(key)) return;
        if (key) existingKeys.add(key);
        mergedPaletteOptions.push(option);
      });
      if (mergedPaletteOptions.length > existingPaletteOptions.length) {
        paletteOptionsChanged = true;
        brand.paletteOptions = mergedPaletteOptions;
        const firstOption = mergedPaletteOptions.find((option) => option && typeof option === "object" && Array.isArray((option as Record<string, unknown>).colors)) as Record<string, unknown> | undefined;
        if (firstOption && (!Array.isArray(brand.palette) || (brand.palette as unknown[]).length === 0)) {
          brand.palette = firstOption.colors;
        }
        siteJson.brand = brand;
      }
    }
    const visualVariationAt = new Date().toISOString();
    siteJson.meta = { ...meta, lastVisualVariationAt: visualVariationAt };
    const storage = siteJson.storage && typeof siteJson.storage === "object" ? siteJson.storage as Record<string, unknown> : {};
    let r2JsonKey = asString(storage.r2JsonKey, asString(row.r2_json_key));
    let r2JsonUrl = asString(storage.r2JsonUrl);
    if (r2JsonKey || env.R2) {
      const nextKey = await uploadJsonToR2(siteJson, env, businessId);
      if (nextKey) {
        r2JsonKey = nextKey;
        r2JsonUrl = publicR2Url(env, nextKey);
        siteJson.storage = { ...storage, r2JsonKey, r2JsonUrl };
        await uploadJsonToR2(siteJson, env, businessId);
      }
    }
    const jsonSummary = siteSummaryFromJson(siteStorageDeps, siteJson, businessId);
    const d1JsonContent = r2JsonKey
      ? JSON.stringify(compactSiteManifest(siteStorageDeps, siteJson, env, businessId, r2JsonKey))
      : JSON.stringify(siteJson);
    await saveJsonSiteRecord(db, businessId, d1JsonContent, {
      r2_json_key: r2JsonKey || null,
      r2_json_url: r2JsonUrl || null,
      json_summary: JSON.stringify(jsonSummary),
    });
    return json({
      success: true,
      businessId,
      changed: variationResult.changed,
      paletteOptionsChanged,
      fontPairing: variationResult.fontPairing,
      fontPairingLabel: variationResult.fontPairingLabel,
      paletteOptionCount: Array.isArray((siteJson.brand as Record<string, unknown> | undefined)?.paletteOptions)
        ? ((siteJson.brand as Record<string, unknown>).paletteOptions as unknown[]).length
        : 0,
      lastVisualVariationAt: visualVariationAt,
      storageMode: r2JsonKey ? "r2" : "legacy_d1",
    });
  }

  if (request.method === "GET" && segments.length === 3 && segments[2] === "copy-brief") {
    const businessId = segments[1];
    const columns = await tableColumns(db, "json_sites");
    const selectedColumns = [
      "business_id",
      "json_content",
      columns.has("r2_json_key") ? "r2_json_key" : "",
    ].filter(Boolean);
    const row = await db
      .prepare(`SELECT ${selectedColumns.join(", ")} FROM json_sites WHERE business_id = ?`)
      .bind(businessId)
      .first<{ business_id: string; json_content: string; r2_json_key?: string }>();
    if (!row?.json_content) {
      return errorJson("Site not found", 404);
    }
    const siteJson = await readSiteJsonFromStorage(siteStorageDeps, row, env);
    const meta = siteJson?.meta && typeof siteJson.meta === "object" ? siteJson.meta as Record<string, unknown> : {};
    const profile = siteJson?.businessProfile && typeof siteJson.businessProfile === "object" ? siteJson.businessProfile as Record<string, unknown> : {};
    const brief = buildAiCopyTargetBrief(siteJson, {}, asString(meta.businessName, asString(profile.name, businessId)));
    return json({
      businessId,
      generationMode: asString(meta.generationMode),
      aiProvider: asString(meta.aiProvider),
      aiModel: asString(meta.aiModel),
      note: "This is the stored-site copy brief shape sent to AI. During regenerate, fresh Google Places details may add newer facts before the copy patch call.",
      copyTargetBrief: brief,
    });
  }

  if (request.method === "POST" && segments.length === 2 && segments[1] === "generate") {
    const body = await readJsonBody(request);
    const businessName = asString(body.businessName, "Untitled Business");
    const businessId = asString(body.businessId, normalizeBusinessId(businessName));
    const phone = asString(body.phone);
    const originData = body.originData && typeof body.originData === "object" ? body.originData as Record<string, unknown> : {};
    const provider = asString(body.provider, "mock");
    const model = asString(body.model, "mock-json");
    const brandPalette = Array.isArray(body.brandPalette) ? body.brandPalette.filter((item) => typeof item === "string") as string[] : [];
    const selectedLogoImageUrl = asString(body.selectedLogoImageUrl);
    const selectedLogoReference = asString(body.selectedLogoReference);
    const selectedLogoSource = asString(body.selectedLogoSource, selectedLogoImageUrl.startsWith("/api/places/photo") ? "google_places" : "");
    const selectedLogoAttributions = Array.isArray(body.selectedLogoAttributions)
      ? body.selectedLogoAttributions.filter((item) => typeof item === "string") as string[]
      : [];
    const selectedLogoPriority = asString(body.selectedLogoPriority);
    const paletteOptions = Array.isArray(body.paletteOptions) ? body.paletteOptions : [];
    const skipAiCopyPatch = body.skipAiCopyPatch === true;
    const prepatchedWithAi = body.prepatchedWithAi === true;
    const prepatchedOfferingOutline = body.prepatchedOfferingOutline && typeof body.prepatchedOfferingOutline === "object" && !Array.isArray(body.prepatchedOfferingOutline)
      ? body.prepatchedOfferingOutline as Record<string, unknown>
      : null;
    const prepatchedCopyPatch = body.prepatchedCopyPatch && typeof body.prepatchedCopyPatch === "object" && !Array.isArray(body.prepatchedCopyPatch)
      ? body.prepatchedCopyPatch as Record<string, unknown>
      : null;
    const prepatchedCopyAuditSummary = body.prepatchedCopyAuditSummary && typeof body.prepatchedCopyAuditSummary === "object" && !Array.isArray(body.prepatchedCopyAuditSummary)
      ? body.prepatchedCopyAuditSummary as Record<string, unknown>
      : null;
    const prepatchedCopyAuditItems = Array.isArray(body.prepatchedCopyAuditItems) ? body.prepatchedCopyAuditItems : [];
    const prepatchedSiteCopyPatch = body.prepatchedSiteCopyPatch && typeof body.prepatchedSiteCopyPatch === "object" && !Array.isArray(body.prepatchedSiteCopyPatch)
      ? body.prepatchedSiteCopyPatch as Record<string, unknown>
      : null;
    const prepatchedSiteCopyAuditSummary = body.prepatchedSiteCopyAuditSummary && typeof body.prepatchedSiteCopyAuditSummary === "object" && !Array.isArray(body.prepatchedSiteCopyAuditSummary)
      ? body.prepatchedSiteCopyAuditSummary as Record<string, unknown>
      : null;
    const prepatchedSiteCopyAuditItems = Array.isArray(body.prepatchedSiteCopyAuditItems) ? body.prepatchedSiteCopyAuditItems : [];
    const prepatchedOfferingCopyPatch = body.prepatchedOfferingCopyPatch && typeof body.prepatchedOfferingCopyPatch === "object" && !Array.isArray(body.prepatchedOfferingCopyPatch)
      ? body.prepatchedOfferingCopyPatch as Record<string, unknown>
      : null;
    const prepatchedOfferingCopyAuditSummary = body.prepatchedOfferingCopyAuditSummary && typeof body.prepatchedOfferingCopyAuditSummary === "object" && !Array.isArray(body.prepatchedOfferingCopyAuditSummary)
      ? body.prepatchedOfferingCopyAuditSummary as Record<string, unknown>
      : null;
    const prepatchedOfferingCopyAuditItems = Array.isArray(body.prepatchedOfferingCopyAuditItems) ? body.prepatchedOfferingCopyAuditItems : [];
    const prepatchedOfferingCopyCoverage = body.prepatchedOfferingCopyCoverage && typeof body.prepatchedOfferingCopyCoverage === "object" && !Array.isArray(body.prepatchedOfferingCopyCoverage)
      ? body.prepatchedOfferingCopyCoverage as Record<string, unknown>
      : null;
    const prepatchedCopyOnlyRetryCoverageDelta = body.prepatchedCopyOnlyRetryCoverageDelta && typeof body.prepatchedCopyOnlyRetryCoverageDelta === "object" && !Array.isArray(body.prepatchedCopyOnlyRetryCoverageDelta)
      ? body.prepatchedCopyOnlyRetryCoverageDelta as Record<string, unknown>
      : null;
    const originPlaceId = placeIdFromPlace(originData);
    const jobId = crypto.randomUUID();
    const jobMetadata: Record<string, unknown> = {
      businessName,
      selectedLogoReference,
      selectedLogoPriority,
      generationMode: "deterministic_json_with_optional_ai_copy_patch",
      copyBriefHash: "",
      copyPatchHash: "",
      copyPatchApplied: false,
    };

    await ensureRequiredColumns(db, generateRequiredColumns);

    await createGenerationJob(db, {
      id: jobId,
      business_id: businessId,
      place_id: originPlaceId,
      provider,
      model,
      status: "running",
      metadata_json: JSON.stringify(jobMetadata),
    });
    await incrementDailyUsage(db, "site_generation");

    try {

    let finalJson = body.jsonContent && typeof body.jsonContent === "object"
      ? body.jsonContent as Record<string, unknown>
      : structuredClone(templateSchema) as Record<string, unknown>;
    let aiGenerated = prepatchedWithAi;
    if (skipAiCopyPatch) {
      jobMetadata.copyPatchApplied = prepatchedWithAi;
      jobMetadata.copyPatchSkipped = true;
      jobMetadata.parentGenerationJobId = asString(body.parentGenerationJobId);
      if (prepatchedOfferingOutline) jobMetadata.offeringOutline = prepatchedOfferingOutline;
      if (prepatchedCopyPatch) jobMetadata.copyPatch = prepatchedCopyPatch;
      if (prepatchedSiteCopyPatch) jobMetadata.siteCopyPatch = prepatchedSiteCopyPatch;
      if (prepatchedOfferingCopyPatch) jobMetadata.offeringCopyPatch = prepatchedOfferingCopyPatch;
      if (asString(body.prepatchedCopyBriefHash)) jobMetadata.copyBriefHash = asString(body.prepatchedCopyBriefHash);
      if (asString(body.prepatchedCopyPatchHash)) jobMetadata.copyPatchHash = asString(body.prepatchedCopyPatchHash);
      if (asString(body.prepatchedSiteCopyBriefHash)) jobMetadata.siteCopyBriefHash = asString(body.prepatchedSiteCopyBriefHash);
      if (asString(body.prepatchedSiteCopyPatchHash)) jobMetadata.siteCopyPatchHash = asString(body.prepatchedSiteCopyPatchHash);
      if (prepatchedSiteCopyAuditSummary) jobMetadata.siteCopyAuditSummary = prepatchedSiteCopyAuditSummary;
      if (prepatchedSiteCopyAuditItems.length) jobMetadata.siteCopyAuditItems = prepatchedSiteCopyAuditItems;
      if (asString(body.prepatchedOfferingCopyBriefHash)) jobMetadata.offeringCopyBriefHash = asString(body.prepatchedOfferingCopyBriefHash);
      if (asString(body.prepatchedOfferingCopyPatchHash)) jobMetadata.offeringCopyPatchHash = asString(body.prepatchedOfferingCopyPatchHash);
      if (prepatchedOfferingCopyAuditSummary) jobMetadata.offeringCopyAuditSummary = prepatchedOfferingCopyAuditSummary;
      if (prepatchedOfferingCopyAuditItems.length) jobMetadata.offeringCopyAuditItems = prepatchedOfferingCopyAuditItems;
      if (prepatchedOfferingCopyCoverage) jobMetadata.offeringCopyCoverage = prepatchedOfferingCopyCoverage;
      if (prepatchedCopyOnlyRetryCoverageDelta) jobMetadata.copyOnlyRetryCoverageDelta = prepatchedCopyOnlyRetryCoverageDelta;
    } else {
      try {
        const outlineResult = await generateAiOfferingOutline(aiSiteGenerationDeps, db, env, body, finalJson, originData, businessName);
        if (outlineResult) {
          const outlineApplyResult = applyAiOfferingOutline(finalJson, outlineResult.outline);
          jobMetadata.offeringOutline = outlineResult.outline;
          jobMetadata.offeringOutlineHash = outlineResult.outlineHash;
          jobMetadata.offeringOutlineApplied = outlineApplyResult.applied;
          jobMetadata.offeringOutlineCount = outlineApplyResult.count;
          jobMetadata.offeringOutlineRepairAttempted = Boolean(outlineResult.repairAttempted);
          if (outlineResult.repairError) jobMetadata.offeringOutlineInitialParseError = outlineResult.repairError;
        }
      } catch (error) {
        jobMetadata.offeringOutlineApplied = false;
        jobMetadata.offeringOutlineError = error instanceof Error ? error.message : String(error);
        console.error("AI offering outline failed, continuing with scaffold offerings:", error);
      }
    }
    applyGeneratedSitePageInserts(finalJson, originData);
    const copyBrief = buildAiCopyTargetBrief(finalJson, originData, businessName);
    const copyAuditTargets = collectAiCopyAuditTargets(finalJson);
    const currentCopyBriefHash = await sha256Json(copyBrief);
    jobMetadata.copyBriefHash = skipAiCopyPatch && asString(body.prepatchedCopyBriefHash)
      ? asString(body.prepatchedCopyBriefHash)
      : currentCopyBriefHash;
    if (skipAiCopyPatch) jobMetadata.finalCopyBriefHash = currentCopyBriefHash;
    jobMetadata.copyAuditSummary = {
      targetFieldsSentToAi: copyAuditTargets.length,
      sourceSentencesSentToAi: copyAuditTargets.filter((target) => target.before).length,
      aiRewritten: 0,
      aiFilledBlank: 0,
      sourceKept: 0,
      fallbackSource: 0,
      missingAfter: 0,
      storedItems: 0,
    };
    if (skipAiCopyPatch && prepatchedCopyAuditSummary) {
      jobMetadata.copyAuditSummary = prepatchedCopyAuditSummary;
      jobMetadata.copyAuditItems = prepatchedCopyAuditItems;
    }
    await updateGenerationJob(db, jobId, { metadata_json: JSON.stringify(jobMetadata) });

    if (!skipAiCopyPatch) {
      try {
        const copyPatchResult = await generateAiCopyPatch(aiSiteGenerationDeps, db, env, body, finalJson);
        if (copyPatchResult) {
          applyAiCopyPatch(finalJson, copyPatchResult.patch);
          const copyAudit = buildAiCopyAudit(copyAuditTargets, finalJson, true);
          jobMetadata.copyPatch = copyPatchResult.patch;
          jobMetadata.copyBriefHash = copyPatchResult.copyBriefHash || jobMetadata.copyBriefHash;
          jobMetadata.copyPatchHash = copyPatchResult.copyPatchHash;
          jobMetadata.copyPatchApplied = true;
          jobMetadata.copyAuditSummary = copyAudit.summary;
          jobMetadata.copyAuditItems = copyAudit.items;
          aiGenerated = true;
        } else if (body.requireAi === true) {
          throw new Error("AI copy patch did not return JSON. Check provider/model/API key settings.");
        }
      } catch (error) {
        if (body.requireAi === true) {
          throw error;
        }
        jobMetadata.copyPatchError = error instanceof Error ? error.message : String(error);
        console.error("AI copy patch failed, using submitted JSON:", error);
      }
    }
    if (!aiGenerated) {
      const fallbackAudit = buildAiCopyAudit(copyAuditTargets, finalJson, false);
      jobMetadata.copyAuditSummary = fallbackAudit.summary;
      jobMetadata.copyAuditItems = fallbackAudit.items;
    }

    const metaConfig = finalJson.meta && typeof finalJson.meta === "object" ? finalJson.meta as Record<string, unknown> : {};
    metaConfig.businessId = businessId;
    metaConfig.generatedWithAi = aiGenerated;
    metaConfig.generationMode = aiGenerated ? "ai_copy_patch" : asString(metaConfig.generationMode, provider && model ? "submitted_json_ai_fallback" : "submitted_json");
    metaConfig.aiProvider = provider || "";
    metaConfig.aiModel = model || "";
    metaConfig.generatedAt = new Date().toISOString();
    if (brandPalette.length) {
      metaConfig.brandPalette = brandPalette;
    }
    if (typeof metaConfig.faviconSvg !== "string") {
      metaConfig.faviconSvg = faviconSvgFromBusinessName(businessName, brandPalette[0] || "#111827");
    }
    finalJson.meta = metaConfig;

    const designConfig = finalJson.design && typeof finalJson.design === "object" ? finalJson.design as Record<string, unknown> : {};
    const allowedVisualStyles = ["soft-rounded", "boxy-editorial", "industrial-diagonal", "clean-minimal", "bold-sport"];
    const visualDesignContext = [
      businessName,
      asString(originData.formatted_address, asString(originData.formattedAddress)),
      Array.isArray(originData.types) ? originData.types.join(" ") : "",
      asString(originData.searchQuery),
    ].filter(Boolean).join(" ");
    if (!allowedVisualStyles.includes(asString(designConfig.visualStyle))) {
      designConfig.visualStyle = visualStyleForBusiness(visualDesignContext);
    }
    if (!designConfig.visualStyleConfig || typeof designConfig.visualStyleConfig !== "object") {
      designConfig.visualStyleConfig = {
        label: asString(designConfig.visualStyle).replace(/-/g, " "),
        description: "Controls shape language, image treatment, borders, and visual edge style on top of the industry preset.",
        allowedValues: allowedVisualStyles,
        selectionRule: "Use the visual structure that best matches the business niche and desired feel.",
      };
    }
    const shaderMeta = shaderPresetForBusiness(visualDesignContext);
    const allowedShaderPresets = ["none", "local-aurora", "industrial-grid", "aqua-caustics", "organic-dapple", "cafe-heat", "salon-silk", "fitness-pulse", "legal-vellum", "property-depth"];
    if (!allowedShaderPresets.includes(asString(designConfig.shaderPreset))) {
      designConfig.shaderPreset = shaderMeta.id;
    }
    if (!designConfig.shaderConfig || typeof designConfig.shaderConfig !== "object") {
      designConfig.shaderConfig = {
        preset: designConfig.shaderPreset,
        label: shaderMeta.label,
        description: shaderMeta.description,
        defaultOpacity: shaderMeta.defaultOpacity,
        defaultMotion: shaderMeta.defaultMotion,
        allowedValues: allowedShaderPresets,
        selectionRule: "Choose a lightweight CSS procedural shader that matches the industry mood. Use none for maximum restraint.",
      };
    }
    finalJson.design = designConfig;
    applySeededFontPairing(finalJson, businessName, businessId, originData);

    const originMapsUrl = asString(originData.url, asString(originData.googleMapsUri));
    const originWebsiteUrl = asString(originData.website, asString(originData.websiteUri));
    const sourceData = finalJson.sourceData && typeof finalJson.sourceData === "object" ? finalJson.sourceData as Record<string, unknown> : {};
    sourceData.provider = sourceData.provider || "google_places";
    sourceData.placeId = sourceData.placeId || originPlaceId;
    if (originMapsUrl && isWeakGoogleMapsSearchUrl(sourceData.googleMapsUri)) {
      sourceData.googleMapsUri = originMapsUrl;
    }
    sourceData.websiteUri = sourceData.websiteUri || originWebsiteUrl || null;
    sourceData.hasWebsite = Boolean(sourceData.hasWebsite || originWebsiteUrl);
    sourceData.businessStatus = sourceData.businessStatus || asString(originData.business_status, asString(originData.businessStatus));
    sourceData.lastSyncedAt = new Date().toISOString();
    finalJson.sourceData = sourceData;

    if (originMapsUrl || phone) {
      const businessProfile = finalJson.businessProfile && typeof finalJson.businessProfile === "object" ? finalJson.businessProfile as Record<string, unknown> : {};
      const contact = businessProfile.contact && typeof businessProfile.contact === "object" ? businessProfile.contact as Record<string, unknown> : {};
      if (originMapsUrl && isWeakGoogleMapsSearchUrl(contact.directionsUrl)) {
        contact.directionsUrl = originMapsUrl;
      }
      if (phone) {
        contact.phoneNational = contact.phoneNational || phone;
        contact.phoneInternational = contact.phoneInternational || phone;
      }
      businessProfile.contact = contact;
      finalJson.businessProfile = businessProfile;
    }

    if (originMapsUrl) {
      const location = finalJson.location && typeof finalJson.location === "object" ? finalJson.location as Record<string, unknown> : {};
      if (isWeakGoogleMapsSearchUrl(location.directionsUrl)) {
        location.directionsUrl = originMapsUrl;
      }
      finalJson.location = location;
    }

    if (selectedLogoImageUrl) {
      const globalConfig = finalJson.global && typeof finalJson.global === "object" ? finalJson.global as Record<string, unknown> : {};
      const headerConfig = globalConfig.header && typeof globalConfig.header === "object" ? globalConfig.header as Record<string, unknown> : {};
      headerConfig.logoImageUrl = selectedLogoImageUrl;
      globalConfig.header = headerConfig;
      finalJson.global = globalConfig;

      const brand = finalJson.brand && typeof finalJson.brand === "object" ? finalJson.brand as Record<string, unknown> : {};
      brand.logoImageUrl = selectedLogoImageUrl;
      brand.photoSource = selectedLogoSource;
      brand.googlePhotoReference = selectedLogoReference;
      brand.photoCaption = selectedLogoSource === "google_places" ? "Photo from Google Business Profile" : "";
      brand.photoAttributions = selectedLogoAttributions;
      if (selectedLogoPriority) {
        brand.selectedPhotoPriority = selectedLogoPriority;
      }
      finalJson.brand = brand;
    }

    if (paletteOptions.length) {
      const brand = finalJson.brand && typeof finalJson.brand === "object" ? finalJson.brand as Record<string, unknown> : {};
      brand.paletteOptions = paletteOptions;
      if (!Array.isArray(brand.palette) || !(brand.palette as unknown[]).length) {
        const firstOption = paletteOptions.find((option) => option && typeof option === "object" && Array.isArray((option as Record<string, unknown>).colors)) as Record<string, unknown> | undefined;
        if (firstOption) brand.palette = firstOption.colors;
      }
      finalJson.brand = brand;
    }

    if (brandPalette.length) {
      const design = finalJson.design && typeof finalJson.design === "object" ? finalJson.design as Record<string, unknown> : {};
      const themeVariables = design.themeVariables && typeof design.themeVariables === "object" ? design.themeVariables as Record<string, unknown> : {};
      const colors = themeVariables.colors && typeof themeVariables.colors === "object" ? themeVariables.colors as Record<string, unknown> : {};
      colors.primary = colors.primary || brandPalette[0];
      colors.accent = colors.accent || brandPalette[1] || brandPalette[0];
      colors.secondary = colors.secondary || brandPalette[2] || "#F3F4F6";
      themeVariables.colors = colors;
      design.themeVariables = themeVariables;
      finalJson.design = design;
    }

    applyGeneratedSitePageInserts(finalJson, originData);
    normalizeSiteColorContrast(finalJson);

    try {
      normalizeImageFilenames(finalJson, businessId);
      const assetKeys = await uploadImageAssetsToR2(finalJson, env, new URL(request.url).origin, businessId);
      const jsonKey = await uploadJsonToR2(finalJson, env, businessId);
      if (jsonKey || assetKeys.length) {
        finalJson.storage = {
          ...(finalJson.storage && typeof finalJson.storage === "object" ? finalJson.storage as Record<string, unknown> : {}),
          r2JsonKey: jsonKey,
          r2JsonUrl: jsonKey ? publicR2Url(env, jsonKey) : "",
          r2AssetKeys: assetKeys,
        };
        if (jsonKey) {
          await uploadJsonToR2(finalJson, env, businessId);
        }
      }
    } catch (error) {
      console.error("R2 sync failed, continuing with D1 site save:", error);
      finalJson.storage = {
        ...(finalJson.storage && typeof finalJson.storage === "object" ? finalJson.storage as Record<string, unknown> : {}),
        r2SyncError: error instanceof Error ? error.message : String(error),
      };
    }

    const leadId = crypto.randomUUID();
    const niche = asString(originData.types instanceof Array ? originData.types[0] : originData.niche, "general");
    const address = asString(originData.formatted_address);
    const websiteUrl = asString(originData.website);
    const rating = typeof originData.rating === "number" ? originData.rating : null;
    const reviews = typeof originData.user_ratings_total === "number" ? originData.user_ratings_total : null;

    await upsertLeadRecord(db, {
      id: leadId,
      business_id: businessId,
      business_name: businessName,
      niche,
      phone,
      website_url: websiteUrl,
      rating,
      reviews,
      address,
      status: "scraped",
      view_count: 0,
      updated_at: new Date().toISOString(),
    });

    const storage = finalJson.storage && typeof finalJson.storage === "object" ? finalJson.storage as Record<string, unknown> : {};
    const r2JsonKey = asString(storage.r2JsonKey);
    const r2JsonUrl = asString(storage.r2JsonUrl);
    const jsonSummary = siteSummaryFromJson(siteStorageDeps, finalJson, businessId);
    const d1JsonContent = r2JsonKey
      ? JSON.stringify(compactSiteManifest(siteStorageDeps, finalJson, env, businessId, r2JsonKey))
      : JSON.stringify(finalJson);

    await saveJsonSiteRecord(db, businessId, d1JsonContent, {
      r2_json_key: r2JsonKey || null,
      r2_json_url: r2JsonUrl || null,
      json_summary: JSON.stringify(jsonSummary),
    });

    const leadRow = await db.prepare("SELECT id FROM leads WHERE business_id = ?").bind(businessId).first<{ id: string }>();
    if (leadRow?.id) {
      await insertCrmActivitySafe(db, {
        id: crypto.randomUUID(),
        lead_id: leadRow.id,
        staff_id: "system",
        activity_type: "note_added",
        description: `Website generated successfully using deterministic JSON plus AI copy patch from ${provider} (${model}).`,
      });
    }

    await updateGenerationJob(db, jobId, { status: "success", error: null, metadata_json: JSON.stringify(jobMetadata) });
    await updateProspectRecord(db, originPlaceId, {
      status: "site_generated",
      generated_business_id: businessId,
      last_error: null,
      generated_at: new Date().toISOString(),
    });

    return json({
      success: true,
      businessId,
      generationJobId: jobId,
      generatedWithAi: aiGenerated,
      generationMode: metaConfig.generationMode,
      copyPatchApplied: Boolean(jobMetadata.copyPatchApplied),
      copyPatchError: jobMetadata.copyPatchError || "",
    });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const readiness = error && typeof error === "object" && "aiReadiness" in error
        ? (error as { aiReadiness?: unknown }).aiReadiness
        : null;
      const aiFailure = error && typeof error === "object" && "aiFailure" in error
        ? (error as { aiFailure?: unknown }).aiFailure
        : null;
      jobMetadata.failureStage = readiness ? "ai_readiness_preflight" : "site_generate";
      jobMetadata.failureMessage = message;
      if (readiness) {
        jobMetadata.preflightBlocked = true;
        jobMetadata.aiReadiness = readiness;
        jobMetadata.remoteValidation = typeof readiness === "object" && readiness && "remoteValidation" in readiness
          ? (readiness as { remoteValidation?: unknown }).remoteValidation
          : null;
      }
      if (aiFailure) {
        jobMetadata.aiFailure = aiFailure;
        jobMetadata.providerFailure = aiFailure;
        if (typeof aiFailure === "object" && aiFailure && "failureKind" in aiFailure) {
          jobMetadata.failureStage = asString((aiFailure as { stage?: unknown }).stage, "site_generate");
        }
      }
      await updateGenerationJob(db, jobId, { status: "failed", error: message, metadata_json: JSON.stringify(jobMetadata) });
      await updateProspectRecord(db, originPlaceId, { last_error: message });
      const statusCode = body.requireAi === true
        ? (/api key|provider and model|required|unsupported|invalid|not found|HTTP 4\d\d/i.test(message) ? 400 : 502)
        : 500;
      return errorJson(message, statusCode);
    }
  }

  if (request.method === "GET" && segments.length === 2) {
    const businessId = segments[1];
    const columns = await tableColumns(db, "json_sites");
    const selectedColumns = [
      "business_id",
      "json_content",
      columns.has("r2_json_key") ? "r2_json_key" : "",
      columns.has("last_preview_error") ? "last_preview_error" : "",
    ].filter(Boolean);
    const row = await db
      .prepare(`SELECT ${selectedColumns.join(", ")} FROM json_sites WHERE business_id = ?`)
      .bind(businessId)
      .first<{ business_id: string; json_content: string; r2_json_key?: string; last_preview_error?: string }>();
    if (!row?.json_content) {
      return errorJson("Site not found", 404);
    }
    try {
      const siteJson = await readSiteJsonFromStorage(siteStorageDeps, row, env);
      if (row.last_preview_error && columns.has("last_preview_error") && columns.has("last_preview_error_at")) {
        try {
          await db
            .prepare("UPDATE json_sites SET last_preview_error = NULL, last_preview_error_at = NULL WHERE business_id = ?")
            .bind(businessId)
            .run();
        } catch (clearError) {
          console.error(`Failed to clear preview error marker for ${businessId}:`, clearError);
        }
      }
      return json(siteJson);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      try {
        await ensureRequiredColumns(db, [
          { table: "json_sites", column: "last_preview_error", definition: "TEXT" },
          { table: "json_sites", column: "last_preview_error_at", definition: "DATETIME" },
        ]);
        await db
          .prepare("UPDATE json_sites SET last_preview_error = ?, last_preview_error_at = ? WHERE business_id = ?")
          .bind(message.slice(0, 1000), new Date().toISOString(), businessId)
          .run();
      } catch (markerError) {
        console.error(`Failed to store preview error marker for ${businessId}:`, markerError);
      }
      return errorJson(message, 502);
    }
  }

  return errorJson("Not Found", 404);
}


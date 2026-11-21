import templateSchema from "../../JSON/template-schema.json";
import { authenticateAdmin, isPublicApiRequest } from "./_shared/adminAccess";
import { createGenerationJob, ensureColumn, ensureRequiredColumns, getDailyUsage, getDb, getSetting, incrementDailyUsage, insertCrmActivitySafe, isMissingColumnError, reserveDailyUsage, saveJsonSiteRecord, tableColumns, updateGenerationJob, updateProspectRecord, upsertLeadRecord } from "./_shared/db";
import { asString, corsHeaders, errorJson, json, normalizeBusinessId, parseJsonArray, parseJsonObject, readJsonBody, sha256Json } from "./_shared/response";
import { checkoutRequiredColumns, databaseRepairReport, generateRequiredColumns, paymentLedgerRequiredColumns, prospectDetailsRequiredColumns, prospectListRequiredColumns, prospectStatusRequiredColumns, prospectWebsiteCheckRequiredColumns, selectionRequiredColumns } from "./_shared/schema";
import type { D1Database, Env, PagesContext } from "./_shared/types";
import { buildAiFailureDiagnostics, extractProviderErrorDetails, getAiReadiness, handleAiProviderFailure, handleAiProviderHealth, handleAiReadiness, kieModelConfigs, type AiReadinessDeps } from "./ai/readiness";
import { applyAiCopyPatch, applyAiOfferingOutline, buildAiCopyAudit, collectAiCopyAuditTargets, generateAiCopyPatch, generateAiOfferingOutline, type AiSiteGenerationDeps } from "./ai/siteGeneration";
import { handleAudits, type AuditsDeps } from "./audits/handler";
import { handleCloudflare, type CloudflareDeps } from "./cloudflare/handler";
import { handleDomains, quoteDomainForCheckout, type DomainsDeps } from "./domains/handler";
import { handleGenerationJobs, type GenerationJobsDeps } from "./generationJobs/handler";
import { handleLeads, type LeadsDeps } from "./leads/handler";
import { handleOutreach, type OutreachDeps } from "./outreach/handler";
import { handlePayments, type PaymentsDeps } from "./payments/handler";
import { handlePlacesCache, handlePlacesDetails, handlePlacesHistory, handlePlacesManualDuplicateMerge, handlePlacesManualDuplicates, handlePlacesManualImport, handlePlacesPhoto, handlePlacesSearch, placeIdFromPlace, type PlacesDeps } from "./places/handler";
import { handleProspects, type ProspectsDeps } from "./prospects/handler";
import { handleProviderCooldowns, insertProviderCooldownEvent, type ProviderCooldownDeps } from "./providerCooldowns/handler";
import { handleActivities, handleStats, type StatsDeps } from "./stats/handler";
import { handlePublicSettings, handleSettings, type SettingsDeps } from "./settings/handler";
import { handleSites, type SitesHandlerDeps } from "./sites/handler";
import { type SiteStorageDeps } from "./sites/storage";

const settingsDeps: SettingsDeps = {
  json,
  errorJson,
  readJsonBody,
  tableColumns,
};

const statsDeps: StatsDeps = {
  json,
  getDailyUsage,
};

const leadsDeps: LeadsDeps = {
  json,
  errorJson,
  readJsonBody,
  asString,
  tableColumns,
  ensureRequiredColumns: ensureRequiredColumns as LeadsDeps["ensureRequiredColumns"],
  paymentLedgerRequiredColumns,
  insertCrmActivitySafe,
  isMissingColumnError,
  ensureColumn,
};

const outreachDeps: OutreachDeps = {
  json,
  errorJson,
  readJsonBody,
  asString,
  insertCrmActivitySafe,
};

const aiReadinessDeps: AiReadinessDeps = {
  json,
  errorJson,
  readJsonBody,
  asString,
  parseJsonObject,
  getSetting: getSetting as AiReadinessDeps["getSetting"],
  reserveDailyUsage: reserveDailyUsage as AiReadinessDeps["reserveDailyUsage"],
};

const providerCooldownDeps: ProviderCooldownDeps = {
  json,
  errorJson,
  readJsonBody,
  asString,
  parseJsonObject,
};

const domainsDeps: DomainsDeps = {
  json,
  errorJson,
  readJsonBody,
  getSetting: getSetting as DomainsDeps["getSetting"],
};

const cloudflareDeps: CloudflareDeps = {
  json,
  errorJson,
  getSetting: getSetting as CloudflareDeps["getSetting"],
};

const paymentsDeps: PaymentsDeps = {
  json,
  errorJson,
  readJsonBody,
  asString,
  ensureRequiredColumns: ensureRequiredColumns as PaymentsDeps["ensureRequiredColumns"],
  checkoutRequiredColumns,
  paymentLedgerRequiredColumns,
  getSetting: getSetting as PaymentsDeps["getSetting"],
  quoteNewDomain: (db, env, domain, fee) => quoteDomainForCheckout(domainsDeps, db, env, domain, fee),
  upsertLeadRecord: upsertLeadRecord as PaymentsDeps["upsertLeadRecord"],
  insertCrmActivitySafe: insertCrmActivitySafe as PaymentsDeps["insertCrmActivitySafe"],
};

const aiSiteGenerationDeps: AiSiteGenerationDeps = {
  reserveProviderCall: (db) => reserveDailyUsage(db as D1Database, "ai_provider_calls"),
  getSetting: getSetting as AiSiteGenerationDeps["getSetting"],
  getAiReadiness: (db, env, provider, model, requiresAi, remoteValidate, refreshRemoteValidation) =>
    getAiReadiness(aiReadinessDeps, db as D1Database, env, provider, model, requiresAi, remoteValidate, refreshRemoteValidation),
  buildAiFailureDiagnostics,
  extractProviderErrorDetails,
  kieModelConfigs,
};

const siteStorageDeps: SiteStorageDeps = {
  json,
  errorJson,
  readJsonBody,
  asString,
  parseJsonObject,
  ensureRequiredColumns: ensureRequiredColumns as SiteStorageDeps["ensureRequiredColumns"],
  saveJsonSiteRecord: saveJsonSiteRecord as SiteStorageDeps["saveJsonSiteRecord"],
};

const auditsDeps: AuditsDeps = {
  json,
  errorJson,
  parseJsonObject,
  parseJsonArray,
  asString,
  ensureRequiredColumns: ensureRequiredColumns as AuditsDeps["ensureRequiredColumns"],
  sha256Json,
  siteStorageDeps,
};

const sitesHandlerDeps: SitesHandlerDeps = {
  templateSchema: templateSchema as Record<string, unknown>,
  json,
  errorJson,
  readJsonBody,
  asString,
  normalizeBusinessId,
  placeIdFromPlace,
  parseJsonObject,
  tableColumns: tableColumns as SitesHandlerDeps["tableColumns"],
  ensureRequiredColumns: ensureRequiredColumns as SitesHandlerDeps["ensureRequiredColumns"],
  generateRequiredColumns,
  createGenerationJob: createGenerationJob as SitesHandlerDeps["createGenerationJob"],
  updateGenerationJob: updateGenerationJob as SitesHandlerDeps["updateGenerationJob"],
  incrementDailyUsage: incrementDailyUsage as SitesHandlerDeps["incrementDailyUsage"],
  updateProspectRecord: updateProspectRecord as SitesHandlerDeps["updateProspectRecord"],
  upsertLeadRecord: upsertLeadRecord as SitesHandlerDeps["upsertLeadRecord"],
  insertCrmActivitySafe: insertCrmActivitySafe as SitesHandlerDeps["insertCrmActivitySafe"],
  saveJsonSiteRecord: saveJsonSiteRecord as SitesHandlerDeps["saveJsonSiteRecord"],
  siteStorageDeps,
  aiSiteGenerationDeps,
  sha256Json,
};

const generationJobsDeps: GenerationJobsDeps = {
  templateSchema: templateSchema as Record<string, unknown>,
  json,
  errorJson,
  readJsonBody,
  asString,
  normalizeBusinessId,
  placeIdFromPlace,
  parseJsonObject,
  ensureRequiredColumns: ensureRequiredColumns as GenerationJobsDeps["ensureRequiredColumns"],
  generateRequiredColumns,
  createGenerationJob: createGenerationJob as GenerationJobsDeps["createGenerationJob"],
  updateGenerationJob: updateGenerationJob as GenerationJobsDeps["updateGenerationJob"],
  updateProspectRecord: updateProspectRecord as GenerationJobsDeps["updateProspectRecord"],
  insertProviderCooldownEvent: insertProviderCooldownEvent as GenerationJobsDeps["insertProviderCooldownEvent"],
  getSetting: getSetting as GenerationJobsDeps["getSetting"],
  generateAiOfferingOutline: (db, env, body, siteJson, originData, businessName) => generateAiOfferingOutline(aiSiteGenerationDeps, db, env, body, siteJson, originData, businessName),
  applyAiOfferingOutline,
  generateAiCopyPatch: (db, env, body, siteJsonOverride) => generateAiCopyPatch(aiSiteGenerationDeps, db, env, body, siteJsonOverride),
  applyAiCopyPatch,
  collectAiCopyAuditTargets,
  buildAiCopyAudit,
  handleSites: (request, db, env, segments) => handleSites(sitesHandlerDeps, request, db as D1Database, env as Env, segments),
};

const placesDeps: PlacesDeps = {
  json,
  errorJson,
  readJsonBody,
  asString,
  parseJsonObject,
  parseJsonArray,
  tableColumns: tableColumns as PlacesDeps["tableColumns"],
  ensureRequiredColumns: ensureRequiredColumns as PlacesDeps["ensureRequiredColumns"],
  updateProspectRecord: updateProspectRecord as PlacesDeps["updateProspectRecord"],
  getSetting: getSetting as PlacesDeps["getSetting"],
  reserveDailyUsage: reserveDailyUsage as PlacesDeps["reserveDailyUsage"],
  isMissingColumnError,
  prospectListRequiredColumns,
  prospectWebsiteCheckRequiredColumns,
  prospectDetailsRequiredColumns,
  prospectStatusRequiredColumns,
};

const prospectsDeps: ProspectsDeps = {
  json,
  errorJson,
  readJsonBody,
  asString,
  ensureRequiredColumns: ensureRequiredColumns as ProspectsDeps["ensureRequiredColumns"],
  updateProspectRecord: updateProspectRecord as ProspectsDeps["updateProspectRecord"],
  placesDeps,
  prospectListRequiredColumns,
  prospectStatusRequiredColumns,
  selectionRequiredColumns,
};

async function route(context: PagesContext): Promise<Response> {
  const { request, env } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(request.url);
  let segments: string[];
  try {
    segments = url.pathname.replace(/^\/api(?:\/|$)/, "").split("/").filter(Boolean).map(decodeURIComponent);
  } catch {
    return errorJson("Invalid API path.", 400);
  }
  if (segments.some((segment) => /[/\\\p{Cc}]/u.test(segment))) return errorJson("Invalid API path.", 400);

  let adminId: string | undefined;
  if (!isPublicApiRequest(request.method, segments, url.searchParams)) {
    const admin = await authenticateAdmin(request, env);
    if (typeof admin !== "string") {
      const message = admin === 401 ? "Sign in required." : admin === 403 ? "Admin access required." : "Admin authentication unavailable.";
      return errorJson(message, admin);
    }
    adminId = admin;
  }
  if (request.method === "GET" && segments.length === 0) {
    return json({ ok: true, service: "webview-click-api" });
  }

  try {
    const db = getDb(env);

    if (segments[0] === "settings") {
      return handleSettings(settingsDeps, request, db, env);
    }

    if (request.method === "GET" && segments[0] === "public-settings") {
      return handlePublicSettings(settingsDeps, db);
    }

    if (request.method === "GET" && segments[0] === "schema") {
      return json(templateSchema);
    }

    if (request.method === "POST" && segments[0] === "schema" && segments[1] === "repair") {
      return json(await databaseRepairReport(db));
    }

    if (request.method === "GET" && segments[0] === "activities") {
      return handleActivities(statsDeps, db);
    }

    if (request.method === "GET" && segments[0] === "stats") {
      return handleStats(statsDeps, db);
    }

    if (segments[0] === "leads") {
      return handleLeads(leadsDeps, request, db, segments, adminId);
    }

    if (segments[0] === "outreach") {
      return handleOutreach(outreachDeps, request, db, segments);
    }

    if (segments[0] === "prospects") {
      return handleProspects(prospectsDeps, request, db, segments, url);
    }

    if (segments[0] === "generation-jobs") {
      return handleGenerationJobs(generationJobsDeps, request, db, env, segments);
    }

    if (segments[0] === "audits") {
      return handleAudits(auditsDeps, request, db, env, url, segments);
    }

    if (segments[0] === "ai" && segments[1] === "readiness") {
      return handleAiReadiness(aiReadinessDeps, request, db, env);
    }

    if (segments[0] === "ai" && segments[1] === "provider-failure") {
      return handleAiProviderFailure(aiReadinessDeps, request, db);
    }

    if (segments[0] === "ai" && segments[1] === "provider-health") {
      return handleAiProviderHealth(aiReadinessDeps, request, db);
    }

    if (segments[0] === "provider-cooldowns") {
      return handleProviderCooldowns(providerCooldownDeps, request, db, url, segments);
    }

    if (request.method === "GET" && segments[0] === "places" && segments[1] === "photo") {
      return handlePlacesPhoto(placesDeps, url, db, env);
    }

    if (request.method === "GET" && segments[0] === "places" && segments[1] === "details") {
      return handlePlacesDetails(placesDeps, url, db, env);
    }

    if (segments[0] === "places" && segments[1] === "cache") {
      return handlePlacesCache(placesDeps, request, db, segments);
    }

    if (request.method === "GET" && segments[0] === "places" && segments[1] === "history") {
      return handlePlacesHistory(placesDeps, url, db);
    }

    if (request.method === "GET" && segments[0] === "places" && segments[1] === "manual-duplicates") {
      return handlePlacesManualDuplicates(placesDeps, url, db);
    }

    if (request.method === "POST" && segments[0] === "places" && segments[1] === "manual-duplicates" && segments[2] === "merge") {
      return handlePlacesManualDuplicateMerge(placesDeps, request, db);
    }

    if (segments[0] === "places" && segments[1] === "manual-import") {
      return handlePlacesManualImport(placesDeps, request, db);
    }

    if (request.method === "GET" && segments[0] === "places" && segments[1] === "search") {
      return handlePlacesSearch(placesDeps, url, db, env);
    }

    if (segments[0] === "sites") {
      return handleSites(sitesHandlerDeps, request, db, env, segments);
    }

    if (segments[0] === "payments") {
      return handlePayments(paymentsDeps, request, db, env, segments);
    }

    if (segments[0] === "domains") {
      return handleDomains(domainsDeps, request, db, env, url, segments);
    }

    if (segments[0] === "cloudflare") {
      return handleCloudflare(cloudflareDeps, request, db, env, segments);
    }

    return errorJson("Not Found", 404);
  } catch (error) {
    console.error("API request failed", { method: request.method, scope: segments[0] });
    return errorJson("The request could not be completed.", 500);
  }
}

export const onRequest = route;

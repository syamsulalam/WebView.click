export type GenerationJobsDeps = {
  templateSchema: Record<string, unknown>;
  json: (data: unknown, status?: number) => Response;
  errorJson: (error: string, status?: number, details?: unknown) => Response;
  readJsonBody: (request: Request) => Promise<Record<string, unknown>>;
  asString: (value: unknown, fallback?: string) => string;
  normalizeBusinessId: (name: string) => string;
  placeIdFromPlace: (place: unknown) => string;
  parseJsonObject: (value: string | null | undefined) => Record<string, unknown>;
  ensureRequiredColumns: (db: unknown, specs: unknown[]) => Promise<void>;
  generateRequiredColumns: unknown[];
  createGenerationJob: (db: unknown, values: Record<string, unknown>) => Promise<void>;
  updateGenerationJob: (db: unknown, jobId: string, values: Record<string, unknown>) => Promise<void>;
  updateProspectRecord: (db: unknown, placeId: string, values: Record<string, unknown>) => Promise<void>;
  insertProviderCooldownEvent: (db: unknown, values: Record<string, unknown>) => Promise<void>;
  generateAiOfferingOutline: (db: unknown, env: unknown, body: Record<string, unknown>, siteJson: Record<string, unknown>, originData: unknown, businessName: string) => Promise<{ outline: Record<string, unknown>; outlineHash: string; repairAttempted?: boolean; repairError?: string } | null>;
  applyAiOfferingOutline: (siteJson: Record<string, unknown>, outline: Record<string, unknown>) => { applied: boolean; count: number };
  generateAiCopyPatch: (db: unknown, env: unknown, body: Record<string, unknown>, siteJsonOverride?: Record<string, unknown>) => Promise<{ patch: Record<string, unknown>; copyBriefHash: string; copyPatchHash: string } | null>;
  applyAiCopyPatch: (siteJson: Record<string, unknown>, patch: Record<string, unknown>) => Record<string, unknown>;
  collectAiCopyAuditTargets: (siteJson: Record<string, unknown>, options?: { focus?: string }) => any[];
  buildAiCopyAudit: (targets: any[], siteJson: Record<string, unknown>, patchApplied: boolean) => { summary: Record<string, unknown>; items: unknown[] };
  handleSites: (request: Request, db: unknown, env: unknown, segments: string[]) => Promise<Response>;
};

type D1PreparedStatementLike = {
  bind: (...values: unknown[]) => D1PreparedStatementLike;
  all: <R = unknown>() => Promise<{ results?: R[] }>;
  first: <R = unknown>() => Promise<R | null>;
};

type D1DatabaseLike = {
  prepare: (query: string) => D1PreparedStatementLike;
};
type EnvLike = unknown;
function chunkedGenerationPayload(metadata: Record<string, unknown>) {
  const payload = metadata.payload && typeof metadata.payload === "object" && !Array.isArray(metadata.payload)
    ? metadata.payload as Record<string, unknown>
    : {};
  return payload;
}

function chunkedGenerationBaseJson(deps: GenerationJobsDeps, payload: Record<string, unknown>) {
  return payload.jsonContent && typeof payload.jsonContent === "object" && !Array.isArray(payload.jsonContent)
    ? structuredClone(payload.jsonContent as Record<string, unknown>)
    : structuredClone(deps.templateSchema) as Record<string, unknown>;
}

function chunkedGenerationJsonWithOutline(deps: GenerationJobsDeps, metadata: Record<string, unknown>) {
  const payload = chunkedGenerationPayload(metadata);
  const finalJson = chunkedGenerationBaseJson(deps, payload);
  const outline = metadata.offeringOutline && typeof metadata.offeringOutline === "object" && !Array.isArray(metadata.offeringOutline)
    ? metadata.offeringOutline as Record<string, unknown>
    : null;
  if (outline) deps.applyAiOfferingOutline(finalJson, outline);
  return { payload, finalJson };
}

function objectPatch(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function mergeCopyPatch(...patches: Array<Record<string, unknown> | null>) {
  const merged: Record<string, unknown> = {};
  const structuredKeys = new Set(["metaCopy", "sections", "offers", "offerings", "faq", "conversion", "footer", "hero"]);
  for (const patch of patches) {
    if (!patch) continue;
    const metaCopy = objectPatch(patch.metaCopy);
    if (metaCopy) merged.metaCopy = { ...(objectPatch(merged.metaCopy) || {}), ...metaCopy };
    const sections = objectPatch(patch.sections);
    if (sections) merged.sections = { ...(objectPatch(merged.sections) || {}), ...sections };
    if (Array.isArray(patch.offers)) merged.offers = patch.offers;
    if (Array.isArray(patch.offerings)) merged.offerings = patch.offerings;
    if (Array.isArray(patch.faq)) merged.faq = patch.faq;
    const conversion = objectPatch(patch.conversion);
    if (conversion) merged.conversion = { ...(objectPatch(merged.conversion) || {}), ...conversion };
    const footer = objectPatch(patch.footer);
    if (footer) merged.footer = { ...(objectPatch(merged.footer) || {}), ...footer };
    const hero = objectPatch(patch.hero);
    if (hero) merged.hero = { ...(objectPatch(merged.hero) || {}), ...hero };
    Object.entries(patch).forEach(([key, value]) => {
      if (!structuredKeys.has(key)) merged[key] = value;
    });
  }
  return merged;
}

function mergeCopyAudits(...audits: Array<{ summary?: Record<string, unknown>; items?: unknown[] } | null>) {
  const items = audits.flatMap((audit) => Array.isArray(audit?.items) ? audit.items as unknown[] : []);
  const summary = {
    targetFieldsSentToAi: 0,
    sourceSentencesSentToAi: 0,
    aiRewritten: 0,
    aiFilledBlank: 0,
    sourceKept: 0,
    fallbackSource: 0,
    missingAfter: 0,
    storedItems: Math.min(items.length, 160),
  };
  for (const audit of audits) {
    const source = audit?.summary || {};
    for (const key of Object.keys(summary) as Array<keyof typeof summary>) {
      if (key === "storedItems") continue;
      summary[key] += Number(source[key] || 0);
    }
  }
  return { summary, items: items.slice(0, 160) };
}

async function sha256Json(value: unknown) {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value)));
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function stringValue(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function records(value: unknown) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object" && !Array.isArray(item)) as Array<Record<string, unknown>> : [];
}

function stableText(value: unknown) {
  if (typeof value === "string" || typeof value === "number") return String(value).replace(/\s+/g, " ").trim();
  if (Array.isArray(value)) return JSON.stringify(value.map((item) => objectPatch(item) || stringValue(item)).filter(Boolean));
  if (value && typeof value === "object") return JSON.stringify(value);
  return "";
}

function firstSection(page: Record<string, unknown> | undefined, type: string) {
  return records(page?.sections).find((section) => stringValue(section.type) === type);
}

function faqItemsForPage(page: Record<string, unknown> | undefined) {
  return records(objectPatch(firstSection(page, "faq")?.content)?.items);
}

function buildOfferingCopyCoverage(beforeJson: Record<string, unknown>, afterJson: Record<string, unknown>) {
  const beforeOfferings = [...records(beforeJson.products), ...records(beforeJson.services)];
  const afterOfferings = [...records(afterJson.products), ...records(afterJson.services)];
  const beforePages = records(beforeJson.pages);
  const afterPages = records(afterJson.pages);
  const beforeById = new Map(beforeOfferings.map((item) => [stringValue(item.id), item]));
  const beforePageById = new Map(beforePages.map((page) => [stringValue(page.pageId), page]));
  const items = afterOfferings.map((after, index) => {
    const id = stringValue(after.id);
    const before = beforeById.get(id) || beforeOfferings[index] || {};
    const detailPageId = stringValue(after.detailPageId || before.detailPageId);
    const beforePage = beforePageById.get(detailPageId);
    const afterPage = afterPages.find((page) => stringValue(page.pageId) === detailPageId);
    const summaryChanged = stableText(before.summary) !== stableText(after.summary);
    const descriptionChanged = stableText(before.description) !== stableText(after.description);
    const highlightsChanged = stableText(before.highlights) !== stableText(after.highlights);
    const faqChanged = stableText(faqItemsForPage(beforePage)) !== stableText(faqItemsForPage(afterPage));
    const changed = summaryChanged || descriptionChanged || highlightsChanged || faqChanged;
    return {
      id,
      type: stringValue(after.type) || stringValue(before.type) || "service",
      title: stringValue(after.title) || stringValue(before.title) || `Offering ${index + 1}`,
      changed,
      summaryChanged,
      descriptionChanged,
      highlightsChanged,
      faqChanged,
    };
  });
  return {
    total: items.length,
    changed: items.filter((item) => item.changed).length,
    summaryChanged: items.filter((item) => item.summaryChanged).length,
    descriptionChanged: items.filter((item) => item.descriptionChanged).length,
    highlightsChanged: items.filter((item) => item.highlightsChanged).length,
    faqChanged: items.filter((item) => item.faqChanged).length,
    items,
  };
}

function copyOnlyRetryCoverageDeltaFromRequest(body: Record<string, unknown>, afterCoverage: unknown, parentGenerationJobId: string) {
  const context = objectPatch(body.copyOnlyRetryCoverageDelta) || objectPatch(body.copyOnlyRetryContext);
  const before = objectPatch(context?.before);
  const after = objectPatch(afterCoverage);
  if (!context || !before || !after) return null;
  const mode = stringValue(context.mode);
  return {
    mode: mode === "offerings" || mode === "allCopy" ? mode : "copy",
    sourceJobId: stringValue(context.sourceJobId),
    parentGenerationJobId: stringValue(context.parentGenerationJobId) || parentGenerationJobId,
    before: { ...before, recorded: before.recorded !== false },
    after: { ...after, recorded: true },
    recordedAt: new Date().toISOString(),
  };
}

export async function handleGenerationJobs(deps: GenerationJobsDeps, request: Request, db: D1DatabaseLike, env: EnvLike, segments: string[]): Promise<Response> {
  if (request.method === "POST" && segments[1] === "chunked-start") {
    const body = await deps.readJsonBody(request);
    const businessName = deps.asString(body.businessName, "Untitled Business");
    const businessId = deps.asString(body.businessId, deps.normalizeBusinessId(businessName));
    const originData = body.originData && typeof body.originData === "object" ? body.originData as Record<string, unknown> : {};
    const provider = deps.asString(body.provider);
    const model = deps.asString(body.model);
    const placeId = deps.placeIdFromPlace(originData);
    const id = crypto.randomUUID();
    const metadata = {
      businessName,
      generationMode: "chunked_ai_generation",
      chunked: true,
      step: "outline_pending",
      nextStep: "outline",
      payload: body,
      copyPatchApplied: false,
      createdFor: "outline_site_offering_finalize_retryable_flow",
      checkedAt: new Date().toISOString(),
    };
    await deps.ensureRequiredColumns(db, deps.generateRequiredColumns);
    await deps.createGenerationJob(db, {
      id,
      business_id: businessId,
      place_id: placeId,
      provider,
      model,
      status: "running",
      metadata_json: JSON.stringify(metadata),
    });
    return deps.json({ success: true, id, nextStep: "outline" });
  }

  if (request.method === "POST" && segments.length === 3 && segments[2] === "run-step") {
    const jobId = segments[1];
    const body = await deps.readJsonBody(request);
    await deps.ensureRequiredColumns(db, deps.generateRequiredColumns);
    const row = await db
      .prepare("SELECT * FROM generation_jobs WHERE id = ?")
      .bind(jobId)
      .first<{ id: string; business_id?: string; place_id?: string; provider?: string; model?: string; status?: string; error?: string; metadata_json?: string }>();
    if (!row) return deps.errorJson("Generation job not found", 404);
    const metadata = deps.parseJsonObject(row.metadata_json);
    if (metadata.chunked !== true) return deps.errorJson("Generation job is not a chunked job.", 400);
    const payload = chunkedGenerationPayload(metadata);
    if (!Object.keys(payload).length) return deps.errorJson("Chunked generation payload is missing.", 400);
    const businessName = deps.asString(payload.businessName, deps.asString(metadata.businessName, row.business_id || "Untitled Business"));
    const requestedStep = deps.asString(body.step, deps.asString(metadata.nextStep, "outline"));

    try {
      if (requestedStep === "outline") {
        const finalJson = chunkedGenerationBaseJson(deps, payload);
        const outlineResult = await deps.generateAiOfferingOutline(db, env, payload, finalJson, payload.originData || {}, businessName);
        if (outlineResult) {
          const outlineApplyResult = deps.applyAiOfferingOutline(finalJson, outlineResult.outline);
          metadata.offeringOutline = outlineResult.outline;
          metadata.offeringOutlineHash = outlineResult.outlineHash;
          metadata.offeringOutlineApplied = outlineApplyResult.applied;
          metadata.offeringOutlineCount = outlineApplyResult.count;
          metadata.offeringOutlineRepairAttempted = Boolean(outlineResult.repairAttempted);
          if (outlineResult.repairError) metadata.offeringOutlineInitialParseError = outlineResult.repairError;
        } else {
          metadata.offeringOutlineApplied = false;
          metadata.offeringOutlineError = "AI offering outline returned no usable JSON.";
        }
        metadata.step = "outline_complete";
        metadata.nextStep = "siteCopy";
        metadata.updatedAt = new Date().toISOString();
        await deps.updateGenerationJob(db, jobId, { status: "running", error: null, metadata_json: JSON.stringify(metadata) });
        return deps.json({ success: true, id: jobId, completedStep: "outline", nextStep: "siteCopy", metadata });
      }

      if (requestedStep === "copy" || requestedStep === "siteCopy") {
        const { finalJson } = chunkedGenerationJsonWithOutline(deps, metadata);
        const copyAuditTargets = deps.collectAiCopyAuditTargets(finalJson, { focus: "site" });
        const copyPatchResult = await deps.generateAiCopyPatch(db, env, { ...payload, copyPatchFocus: "site" }, finalJson);
        if (!copyPatchResult) {
          throw new Error("AI site copy patch did not return JSON for chunked generation.");
        }
        const patchedJson = structuredClone(finalJson) as Record<string, unknown>;
        deps.applyAiCopyPatch(patchedJson, copyPatchResult.patch);
        const copyAudit = deps.buildAiCopyAudit(copyAuditTargets, patchedJson, true);
        metadata.siteCopyPatch = copyPatchResult.patch;
        metadata.siteCopyBriefHash = copyPatchResult.copyBriefHash;
        metadata.siteCopyPatchHash = copyPatchResult.copyPatchHash;
        metadata.siteCopyAuditSummary = copyAudit.summary;
        metadata.siteCopyAuditItems = copyAudit.items;
        metadata.copyPatch = copyPatchResult.patch;
        metadata.copyBriefHash = copyPatchResult.copyBriefHash;
        metadata.copyPatchHash = copyPatchResult.copyPatchHash;
        metadata.copyPatchApplied = true;
        metadata.copyAuditSummary = copyAudit.summary;
        metadata.copyAuditItems = copyAudit.items;
        metadata.step = "siteCopy_complete";
        metadata.nextStep = "offeringCopy";
        metadata.updatedAt = new Date().toISOString();
        await deps.updateGenerationJob(db, jobId, { status: "running", error: null, metadata_json: JSON.stringify(metadata) });
        return deps.json({ success: true, id: jobId, completedStep: "siteCopy", nextStep: "offeringCopy", metadata });
      }

      if (requestedStep === "offeringCopy") {
        const { finalJson } = chunkedGenerationJsonWithOutline(deps, metadata);
        const sitePatch = objectPatch(metadata.siteCopyPatch) || objectPatch(metadata.copyPatch);
        if (sitePatch) deps.applyAiCopyPatch(finalJson, sitePatch);
        const copyAuditTargets = deps.collectAiCopyAuditTargets(finalJson, { focus: "offerings" });
        const offeringPatchResult = await deps.generateAiCopyPatch(db, env, { ...payload, copyPatchFocus: "offerings" }, finalJson);
        if (!offeringPatchResult) {
          throw new Error("AI offering copy patch did not return JSON for chunked generation.");
        }
        const combinedPatch = mergeCopyPatch(sitePatch, offeringPatchResult.patch);
        const patchedJson = structuredClone(finalJson) as Record<string, unknown>;
        deps.applyAiCopyPatch(patchedJson, offeringPatchResult.patch);
        const offeringCopyCoverage = buildOfferingCopyCoverage(finalJson, patchedJson);
        const copyAudit = deps.buildAiCopyAudit(copyAuditTargets, patchedJson, true);
        const combinedAudit = mergeCopyAudits(
          { summary: objectPatch(metadata.siteCopyAuditSummary) || undefined, items: Array.isArray(metadata.siteCopyAuditItems) ? metadata.siteCopyAuditItems : [] },
          copyAudit,
        );
        metadata.offeringCopyPatch = offeringPatchResult.patch;
        metadata.offeringCopyBriefHash = offeringPatchResult.copyBriefHash;
        metadata.offeringCopyPatchHash = offeringPatchResult.copyPatchHash;
        metadata.offeringCopyAuditSummary = copyAudit.summary;
        metadata.offeringCopyAuditItems = copyAudit.items;
        metadata.offeringCopyCoverage = offeringCopyCoverage;
        metadata.copyPatch = combinedPatch;
        metadata.copyBriefHash = offeringPatchResult.copyBriefHash;
        metadata.copyPatchHash = await sha256Json(combinedPatch);
        metadata.copyPatchApplied = true;
        metadata.copyAuditSummary = combinedAudit.summary;
        metadata.copyAuditItems = combinedAudit.items;
        metadata.step = "offeringCopy_complete";
        metadata.nextStep = "finalize";
        metadata.updatedAt = new Date().toISOString();
        await deps.updateGenerationJob(db, jobId, { status: "running", error: null, metadata_json: JSON.stringify(metadata) });
        return deps.json({ success: true, id: jobId, completedStep: "offeringCopy", nextStep: "finalize", metadata });
      }

      if (requestedStep === "finalize") {
        const { payload: storedPayload, finalJson } = chunkedGenerationJsonWithOutline(deps, metadata);
        const copyPatch = metadata.copyPatch && typeof metadata.copyPatch === "object" && !Array.isArray(metadata.copyPatch)
          ? metadata.copyPatch as Record<string, unknown>
          : null;
        if (copyPatch) deps.applyAiCopyPatch(finalJson, copyPatch);
        const copyOnlyRetryCoverageDelta = copyOnlyRetryCoverageDeltaFromRequest(body, metadata.offeringCopyCoverage, jobId);
        const finalizeBody = {
          ...storedPayload,
          requireAi: false,
          provider: deps.asString(storedPayload.provider),
          model: deps.asString(storedPayload.model),
          jsonContent: finalJson,
          skipAiCopyPatch: true,
          prepatchedWithAi: Boolean(copyPatch),
          prepatchedOfferingOutline: metadata.offeringOutline || null,
          prepatchedCopyPatch: copyPatch || null,
          prepatchedCopyBriefHash: metadata.copyBriefHash || "",
          prepatchedCopyPatchHash: metadata.copyPatchHash || "",
          prepatchedCopyAuditSummary: metadata.copyAuditSummary || null,
          prepatchedCopyAuditItems: Array.isArray(metadata.copyAuditItems) ? metadata.copyAuditItems : [],
          prepatchedSiteCopyPatch: metadata.siteCopyPatch || null,
          prepatchedSiteCopyBriefHash: metadata.siteCopyBriefHash || "",
          prepatchedSiteCopyPatchHash: metadata.siteCopyPatchHash || "",
          prepatchedSiteCopyAuditSummary: metadata.siteCopyAuditSummary || null,
          prepatchedSiteCopyAuditItems: Array.isArray(metadata.siteCopyAuditItems) ? metadata.siteCopyAuditItems : [],
          prepatchedOfferingCopyPatch: metadata.offeringCopyPatch || null,
          prepatchedOfferingCopyBriefHash: metadata.offeringCopyBriefHash || "",
          prepatchedOfferingCopyPatchHash: metadata.offeringCopyPatchHash || "",
          prepatchedOfferingCopyAuditSummary: metadata.offeringCopyAuditSummary || null,
          prepatchedOfferingCopyAuditItems: Array.isArray(metadata.offeringCopyAuditItems) ? metadata.offeringCopyAuditItems : [],
          prepatchedOfferingCopyCoverage: metadata.offeringCopyCoverage || null,
          prepatchedCopyOnlyRetryCoverageDelta: copyOnlyRetryCoverageDelta,
          parentGenerationJobId: jobId,
        };
        const finalizeRequest = new Request(new URL("/api/sites/generate", request.url), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(finalizeBody),
        });
        const finalizeResponse = await deps.handleSites(finalizeRequest, db, env, ["sites", "generate"]);
        const finalizeData = await finalizeResponse.json().catch(() => ({}));
        if (!finalizeResponse.ok || finalizeData.error) {
          throw new Error(deps.asString(finalizeData.error, `Finalize failed with HTTP ${finalizeResponse.status}`));
        }
        metadata.step = "finalize_complete";
        metadata.nextStep = "";
        metadata.finalizeResult = finalizeData;
        metadata.updatedAt = new Date().toISOString();
        await deps.updateGenerationJob(db, jobId, { status: "success", error: null, metadata_json: JSON.stringify(metadata) });
        return deps.json({ success: true, id: jobId, completedStep: "finalize", result: finalizeData, metadata });
      }

      return deps.errorJson(`Unsupported chunked generation step: ${requestedStep}`, 400);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      metadata.failureStage = `chunked_${requestedStep}`;
      metadata.failureMessage = message;
      metadata.nextStep = requestedStep;
      metadata.updatedAt = new Date().toISOString();
      await deps.updateGenerationJob(db, jobId, { status: "failed", error: message, metadata_json: JSON.stringify(metadata) });
      return deps.errorJson(message, 502);
    }
  }

  if (request.method === "POST" && segments[1] === "cooldown-blocked") {
    const body = await deps.readJsonBody(request);
    const provider = deps.asString(body.provider);
    const model = deps.asString(body.model);
    const businessId = deps.asString(body.businessId);
    const placeId = deps.asString(body.placeId);
    const businessName = deps.asString(body.businessName, businessId || placeId || "Unknown business");
    const action = deps.asString(body.action, "generate");
    const cooldown = body.cooldown && typeof body.cooldown === "object" ? body.cooldown as Record<string, unknown> : {};
    const cooldownUntil = Number(cooldown.until || body.cooldownUntil || 0);
    const message = deps.asString(
      body.message,
      `${provider || "Provider"} generation was blocked by an active provider cooldown.`,
    );
    const id = crypto.randomUUID();
    const metadata = {
      businessName,
      generationMode: "provider_cooldown_blocked",
      preflightBlocked: true,
      cooldownBlocked: true,
      preflightAction: action,
      failureStage: "provider_cooldown",
      failureMessage: message,
      providerCooldown: {
        provider: deps.asString(cooldown.provider, provider),
        until: Number.isFinite(cooldownUntil) ? cooldownUntil : null,
        reason: deps.asString(cooldown.reason),
        rawMessage: deps.asString(cooldown.rawMessage || cooldown.raw_message).slice(0, 4000),
      },
      copyPatchApplied: false,
      checkedAt: new Date().toISOString(),
    };

    await deps.ensureRequiredColumns(db, deps.generateRequiredColumns);
    await deps.createGenerationJob(db, {
      id,
      business_id: businessId,
      place_id: placeId,
      provider,
      model,
      status: "failed",
      error: message,
      metadata_json: JSON.stringify(metadata),
    });
    if (placeId) {
      await deps.updateProspectRecord(db, placeId, { last_error: message });
    }
    await deps.insertProviderCooldownEvent(db, {
      provider,
      eventType: "blocked",
      cooldownUntil: Number.isFinite(cooldownUntil) ? cooldownUntil : null,
      reason: message,
      rawMessage: deps.asString(cooldown.rawMessage || cooldown.raw_message),
      metadata: {
        action,
        businessId,
        placeId,
        businessName,
        generationJobId: id,
      },
    });
    return deps.json({ success: true, id });
  }

  if (request.method === "POST" && segments[1] === "preflight-failure") {
    const body = await deps.readJsonBody(request);
    const provider = deps.asString(body.provider);
    const model = deps.asString(body.model);
    const businessId = deps.asString(body.businessId);
    const placeId = deps.asString(body.placeId);
    const businessName = deps.asString(body.businessName, businessId || placeId || "Unknown business");
    const action = deps.asString(body.action, "generate");
    const readiness = body.readiness && typeof body.readiness === "object" ? body.readiness as Record<string, unknown> : {};
    const message = deps.asString(body.message, deps.asString(readiness.message, "AI readiness preflight blocked this action."));
    const id = crypto.randomUUID();
    const metadata = {
      businessName,
      generationMode: "ai_readiness_preflight_blocked",
      preflightBlocked: true,
      preflightAction: action,
      failureStage: "ai_readiness_preflight",
      failureMessage: message,
      aiReadiness: readiness,
      remoteValidation: readiness.remoteValidation || null,
      copyPatchApplied: false,
      checkedAt: new Date().toISOString(),
    };

    await deps.ensureRequiredColumns(db, deps.generateRequiredColumns);
    await deps.createGenerationJob(db, {
      id,
      business_id: businessId,
      place_id: placeId,
      provider,
      model,
      status: "failed",
      error: message,
      metadata_json: JSON.stringify(metadata),
    });
    if (placeId) {
      await deps.updateProspectRecord(db, placeId, { last_error: message });
    }
    return deps.json({ success: true, id });
  }

  if (request.method !== "GET") {
    return deps.errorJson("Not Found", 404);
  }

  const url = new URL(request.url);
  const requestedLimit = Number(url.searchParams.get("limit") || "100");
  const limit = Math.min(500, Math.max(1, Number.isFinite(requestedLimit) ? Math.floor(requestedLimit) : 100));
  const requestedOffset = Number(url.searchParams.get("offset") || "0");
  const offset = Math.min(100000, Math.max(0, Number.isFinite(requestedOffset) ? Math.floor(requestedOffset) : 0));
  const status = String(url.searchParams.get("status") || "").trim().toLowerCase();
  const patch = String(url.searchParams.get("patch") || "").trim().toLowerCase();
  const aiRewrite = String(url.searchParams.get("aiRewrite") || "").trim().toLowerCase();
  const offeringCoverage = String(url.searchParams.get("offeringCoverage") || "").trim().toLowerCase();
  const preflight = String(url.searchParams.get("preflight") || "").trim().toLowerCase();
  const query = String(url.searchParams.get("q") || "").trim().slice(0, 120);
  const includeCounts = url.searchParams.get("counts") === "1";
  const allowedStatuses = new Set(["running", "success", "failed"]);
  const searchWhere: string[] = [];
  const searchBindings: unknown[] = [];

  if (query) {
    const like = `%${query}%`;
    searchWhere.push("(j.business_id LIKE ? OR j.place_id LIKE ? OR j.id LIKE ? OR p.business_name LIKE ? OR j.metadata_json LIKE ?)");
    searchBindings.push(like, like, like, like, like);
  }

  const where = [...searchWhere];
  const bindings: unknown[] = [...searchBindings];

  if (allowedStatuses.has(status)) {
    where.push("j.status = ?");
    bindings.push(status);
  }
  if (preflight === "blocked") {
    where.push(`j.metadata_json LIKE '%"preflightBlocked":true%'`);
  }
  if (patch === "applied") {
    where.push(`j.metadata_json LIKE '%"copyPatchApplied":true%'`);
  } else if (patch === "fallback") {
    where.push(`(j.metadata_json IS NULL OR j.metadata_json NOT LIKE '%"copyPatchApplied":true%')`);
  }
  if (aiRewrite === "zero") {
    where.push(`j.metadata_json LIKE '%"copyPatchApplied":true%' AND j.metadata_json LIKE '%"aiRewritten":0%'`);
  }
  const lowOfferingCoverageSql = `(CASE
    WHEN json_valid(j.metadata_json) THEN
      CASE
        WHEN CAST(COALESCE(json_extract(j.metadata_json, '$.offeringCopyCoverage.total'), 0) AS REAL) > 0
          AND (
            CAST(COALESCE(json_extract(j.metadata_json, '$.offeringCopyCoverage.changed'), 0) AS REAL)
            / CAST(json_extract(j.metadata_json, '$.offeringCopyCoverage.total') AS REAL)
          ) < 0.5
        THEN 1
        ELSE 0
      END
    ELSE 0
  END) = 1`;
  if (offeringCoverage === "low") {
    where.push(lowOfferingCoverageSql);
  }

  bindings.push(limit, offset);
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const rows = await db
    .prepare(
      `SELECT j.*, p.business_name AS prospect_name
       FROM generation_jobs j
       LEFT JOIN places_prospects p ON p.place_id = j.place_id
       ${whereSql}
       ORDER BY datetime(j.created_at) DESC
       LIMIT ? OFFSET ?`,
    )
    .bind(...bindings)
    .all<{
      id: string;
      business_id?: string;
      place_id?: string;
      provider?: string;
      model?: string;
      status?: string;
      error?: string;
      metadata_json?: string;
      created_at?: string;
      updated_at?: string;
      prospect_name?: string;
    }>();

  const jobs = (rows.results || []).map((row) => ({
    id: row.id,
    businessId: row.business_id || "",
    placeId: row.place_id || "",
    prospectName: row.prospect_name || "",
    provider: row.provider || "",
    model: row.model || "",
    status: row.status || "",
    error: row.error || "",
    metadata: deps.parseJsonObject(row.metadata_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  if (includeCounts) {
    const searchWhereSql = searchWhere.length ? `WHERE ${searchWhere.join(" AND ")}` : "";
    const countsStatement = db.prepare(
      `SELECT
        COUNT(*) AS all_count,
        SUM(CASE WHEN j.status = 'failed' THEN 1 ELSE 0 END) AS failed_count,
        SUM(CASE WHEN j.metadata_json LIKE '%"preflightBlocked":true%' THEN 1 ELSE 0 END) AS preflight_count,
        SUM(CASE WHEN j.metadata_json LIKE '%"copyPatchApplied":true%' THEN 1 ELSE 0 END) AS patch_count,
        SUM(CASE WHEN j.metadata_json IS NULL OR j.metadata_json NOT LIKE '%"copyPatchApplied":true%' THEN 1 ELSE 0 END) AS fallback_count,
        SUM(CASE WHEN j.metadata_json LIKE '%"copyPatchApplied":true%' AND j.metadata_json LIKE '%"aiRewritten":0%' THEN 1 ELSE 0 END) AS no_rewrite_count,
        SUM(CASE WHEN ${lowOfferingCoverageSql} THEN 1 ELSE 0 END) AS low_offering_coverage_count
       FROM generation_jobs j
       LEFT JOIN places_prospects p ON p.place_id = j.place_id
       ${searchWhereSql}`,
    );
    const counts = searchBindings.length
      ? await countsStatement.bind(...searchBindings).first<{ all_count?: number; failed_count?: number; preflight_count?: number; patch_count?: number; fallback_count?: number; no_rewrite_count?: number; low_offering_coverage_count?: number }>()
      : await countsStatement.first<{ all_count?: number; failed_count?: number; preflight_count?: number; patch_count?: number; fallback_count?: number; no_rewrite_count?: number; low_offering_coverage_count?: number }>();
    return deps.json({
      jobs,
      counts: {
        all: Number(counts?.all_count || 0),
        failed: Number(counts?.failed_count || 0),
        preflight: Number(counts?.preflight_count || 0),
        fallback: Number(counts?.fallback_count || 0),
        patch: Number(counts?.patch_count || 0),
        noRewrite: Number(counts?.no_rewrite_count || 0),
        lowOfferingCoverage: Number(counts?.low_offering_coverage_count || 0),
      },
    });
  }

  return deps.json(jobs);
}


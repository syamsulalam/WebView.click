type D1PreparedStatementLike = {
  bind: (...values: unknown[]) => D1PreparedStatementLike;
  all: <R = unknown>() => Promise<{ results?: R[] }>;
};

type D1DatabaseLike = {
  prepare: (query: string) => D1PreparedStatementLike;
};

type R2BucketLike = {
  put: (key: string, value: ReadableStream | ArrayBuffer | ArrayBufferView | string, options?: { httpMetadata?: { contentType?: string } }) => Promise<unknown>;
  get?: (key: string) => Promise<{ text: () => Promise<string> } | null>;
};

type SiteStorageEnv = {
  R2?: R2BucketLike;
  R2_PUBLIC_BASE_URL?: string;
};

export type SiteStorageDeps = {
  json: (data: unknown, status?: number) => Response;
  errorJson: (error: string, status?: number, details?: unknown) => Response;
  readJsonBody: (request: Request) => Promise<Record<string, unknown>>;
  asString: (value: unknown, fallback?: string) => string;
  parseJsonObject: (value: string | null | undefined) => Record<string, unknown>;
  ensureRequiredColumns: (db: unknown, specs: unknown[]) => Promise<void>;
  saveJsonSiteRecord: (db: unknown, businessId: string, jsonContent: string, options?: Record<string, unknown>) => Promise<void>;
};

function extensionFromContentType(contentType: string | null) {
  if (!contentType) return "bin";
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("svg")) return "svg";
  if (contentType.includes("gif")) return "gif";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  return "bin";
}

export function publicR2Url(env: SiteStorageEnv, key: string) {
  const configuredBaseUrl = typeof env.R2_PUBLIC_BASE_URL === "string" ? env.R2_PUBLIC_BASE_URL : "";
  const baseUrl = (configuredBaseUrl || "https://assets.webview.click").replace(/\/$/, "");
  return `${baseUrl}/${key}`;
}

function isImageField(key: string) {
  const normalized = key.toLowerCase();
  return normalized.includes("image") || normalized.includes("logo") || normalized.includes("photo") || normalized.includes("gallery");
}

function isImageMetadataField(key: string) {
  const normalized = key.toLowerCase();
  return (
    normalized.includes("attribution") ||
    normalized.includes("reference") ||
    normalized.includes("source") ||
    normalized.includes("caption") ||
    normalized.includes("priority") ||
    normalized.includes("author") ||
    normalized.includes("provider")
  );
}

function isImageAssetField(key: string) {
  return isImageField(key) && !isImageMetadataField(key);
}

export function normalizeImageFilenames(value: unknown, businessId: string, hint = "asset"): unknown {
  if (Array.isArray(value)) {
    return value.map((item, index) => {
      if (typeof item === "string" && isImageAssetField(hint) && item && !item.startsWith("http") && !item.startsWith("/") && !item.startsWith("data:")) {
        const parts = item.split(".");
        const extension = parts.length > 1 ? parts.pop() || "jpg" : "jpg";
        const cleanHint = hint.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "image";
        return `${businessId}-${cleanHint}-${index + 1}.${extension}`;
      }
      return normalizeImageFilenames(item, businessId, `${hint}-${index + 1}`);
    });
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const objectValue = value as Record<string, unknown>;
  for (const [key, childValue] of Object.entries(objectValue)) {
    if (typeof childValue === "string" && isImageAssetField(key) && childValue && !childValue.startsWith("http") && !childValue.startsWith("/") && !childValue.startsWith("data:")) {
      const parts = childValue.split(".");
      const extension = parts.length > 1 ? parts.pop() || "jpg" : "jpg";
      const cleanHint = key.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || hint;
      objectValue[key] = `${businessId}-${cleanHint}.${extension}`;
    } else {
      objectValue[key] = normalizeImageFilenames(childValue, businessId, key);
    }
  }

  return objectValue;
}

function isGooglePlacesPhotoUrl(value: string) {
  try {
    const url = new URL(value, "https://webview.click");
    const host = url.hostname.toLowerCase();
    return (
      url.pathname.startsWith("/api/places/photo") ||
      host.endsWith("googleusercontent.com") ||
      (host === "maps.googleapis.com" && url.pathname.includes("/place/photo")) ||
      (host === "places.googleapis.com" && url.pathname.includes("/photos/") && url.pathname.endsWith("/media"))
    );
  } catch {
    return value.startsWith("/api/places/photo");
  }
}

function collectImageUrls(value: unknown, urls: Set<string>, keyHint = "") {
  if (Array.isArray(value)) {
    value.forEach((item) => {
      if (typeof item === "string" && isImageAssetField(keyHint) && (item.startsWith("http") || item.startsWith("/api/")) && !isGooglePlacesPhotoUrl(item)) {
        urls.add(item);
      } else {
        collectImageUrls(item, urls, keyHint);
      }
    });
    return;
  }

  if (!value || typeof value !== "object") return;

  for (const [key, childValue] of Object.entries(value as Record<string, unknown>)) {
    if (typeof childValue === "string" && isImageAssetField(key) && (childValue.startsWith("http") || childValue.startsWith("/api/")) && !isGooglePlacesPhotoUrl(childValue)) {
      urls.add(childValue);
    } else {
      collectImageUrls(childValue, urls, key);
    }
  }
}

function replaceStringValue(value: unknown, from: string, to: string): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => replaceStringValue(item, from, to));
  }

  if (!value || typeof value !== "object") {
    return value === from ? to : value;
  }

  const objectValue = value as Record<string, unknown>;
  for (const [key, childValue] of Object.entries(objectValue)) {
    objectValue[key] = replaceStringValue(childValue, from, to);
  }
  return objectValue;
}

export async function uploadImageAssetsToR2(finalJson: Record<string, unknown>, env: SiteStorageEnv, origin: string, businessId: string) {
  if (!env.R2) {
    return [] as string[];
  }

  const urls = new Set<string>();
  collectImageUrls(finalJson, urls);
  const assetKeys: string[] = [];
  let index = 1;

  for (const imageUrl of urls) {
    try {
      const absoluteUrl = new URL(imageUrl, origin).toString();
      const response = await fetch(absoluteUrl);
      if (!response.ok) continue;
      const contentType = response.headers.get("content-type");
      if (!contentType?.startsWith("image/")) continue;
      const extension = extensionFromContentType(contentType);
      const key = `sites/${businessId}/assets/${businessId}-asset-${String(index).padStart(2, "0")}.${extension}`;
      await env.R2.put(key, await response.arrayBuffer(), { httpMetadata: { contentType } });
      const publicUrl = publicR2Url(env, key);
      replaceStringValue(finalJson, imageUrl, publicUrl);
      assetKeys.push(key);
      index += 1;
    } catch (error) {
      console.error("R2 asset upload failed:", error);
    }
  }

  return assetKeys;
}

export async function uploadJsonToR2(finalJson: Record<string, unknown>, env: SiteStorageEnv, businessId: string) {
  if (!env.R2) return "";
  const key = `sites/${businessId}/${businessId}.json`;
  await env.R2.put(key, JSON.stringify(finalJson, null, 2), { httpMetadata: { contentType: "application/json; charset=utf-8" } });
  return key;
}

export function siteSummaryFromJson(deps: Pick<SiteStorageDeps, "asString">, parsed: Record<string, unknown>, businessId: string) {
  const { asString } = deps;
  const meta = parsed.meta && typeof parsed.meta === "object" ? parsed.meta as Record<string, unknown> : {};
  const businessProfile = parsed.businessProfile && typeof parsed.businessProfile === "object" ? parsed.businessProfile as Record<string, unknown> : {};
  const trust = parsed.trust && typeof parsed.trust === "object" ? parsed.trust as Record<string, unknown> : {};
  const sourceData = parsed.sourceData && typeof parsed.sourceData === "object" ? parsed.sourceData as Record<string, unknown> : {};
  const contact = businessProfile.contact && typeof businessProfile.contact === "object" ? businessProfile.contact as Record<string, unknown> : {};
  return {
    businessName: asString(meta.businessName, asString(businessProfile.name, businessId)),
    niche: asString(meta.niche, asString(businessProfile.typeLabel, "")),
    language: asString(meta.language, ""),
    region: asString(meta.region, ""),
    rating: typeof trust.rating === "number" ? trust.rating : null,
    reviewCount: typeof trust.reviewCount === "number" ? trust.reviewCount : null,
    googleMapsUrl: asString(sourceData.googleMapsUri, asString(contact.directionsUrl, "")),
    generatedWithAi: meta.generatedWithAi === true,
    generationMode: asString(meta.generationMode),
    aiProvider: asString(meta.aiProvider),
    aiModel: asString(meta.aiModel),
  };
}

export function compactSiteManifest(deps: Pick<SiteStorageDeps, "asString">, finalJson: Record<string, unknown>, env: SiteStorageEnv, businessId: string, jsonKey: string) {
  return {
    storageOnly: true,
    businessId,
    r2JsonKey: jsonKey,
    r2JsonUrl: jsonKey ? publicR2Url(env, jsonKey) : "",
    summary: siteSummaryFromJson(deps, finalJson, businessId),
    updatedAt: new Date().toISOString(),
  };
}

export async function readSiteJsonFromStorage(deps: Pick<SiteStorageDeps, "asString" | "parseJsonObject">, row: { business_id: string; json_content?: string; r2_json_key?: string }, env: SiteStorageEnv) {
  const parsed = deps.parseJsonObject(row.json_content);
  const r2Key = deps.asString(row.r2_json_key, deps.asString(parsed.r2JsonKey));
  const storageOnly = parsed.storageOnly === true || Boolean(r2Key);

  if (r2Key && env.R2?.get) {
    const object = await env.R2.get(r2Key);
    const text = object ? await object.text() : "";
    if (text) return JSON.parse(text);
  }

  if (!storageOnly && row.json_content) {
    return JSON.parse(row.json_content);
  }

  throw new Error(`Site JSON for ${row.business_id} is stored in R2 but could not be read.`);
}

export async function migrateOldSiteJsonRowsToR2(deps: SiteStorageDeps, request: Request, db: D1DatabaseLike, env: SiteStorageEnv) {
  if (!env.R2) {
    return deps.errorJson("R2 binding is not configured. Cannot migrate site JSON out of D1.", 400);
  }

  const body = await deps.readJsonBody(request);
  const limit = Math.max(1, Math.min(100, Number(body.limit || 25)));
  await deps.ensureRequiredColumns(db, [
    { table: "json_sites", column: "r2_json_key", definition: "TEXT" },
    { table: "json_sites", column: "r2_json_url", definition: "TEXT" },
    { table: "json_sites", column: "json_summary", definition: "TEXT" },
    { table: "json_sites", column: "updated_at", definition: "DATETIME" },
  ]);

  const rows = await db
    .prepare(
      `SELECT business_id, json_content, r2_json_key
       FROM json_sites
       WHERE COALESCE(r2_json_key, '') = ''
       ORDER BY datetime(COALESCE(updated_at, created_at, '1970-01-01')) ASC
       LIMIT ?`,
    )
    .bind(limit)
    .all<{ business_id: string; json_content: string; r2_json_key?: string }>();

  const migrated: Array<{ businessId: string; r2JsonKey: string }> = [];
  const skipped: Array<{ businessId: string; reason: string }> = [];
  const failed: Array<{ businessId: string; error: string }> = [];

  for (const row of rows.results || []) {
    try {
      const parsed = deps.parseJsonObject(row.json_content);
      if (!Object.keys(parsed).length) {
        skipped.push({ businessId: row.business_id, reason: "json_content is not valid JSON" });
        continue;
      }

      const manifestKey = deps.asString(parsed.r2JsonKey);
      if (parsed.storageOnly === true && manifestKey) {
        await deps.saveJsonSiteRecord(db, row.business_id, row.json_content, {
          r2_json_key: manifestKey,
          r2_json_url: deps.asString(parsed.r2JsonUrl, publicR2Url(env, manifestKey)),
          json_summary: JSON.stringify(parsed.summary && typeof parsed.summary === "object" ? parsed.summary : {}),
        });
        skipped.push({ businessId: row.business_id, reason: "already compact manifest; backfilled r2 columns" });
        continue;
      }

      const businessId = deps.asString(parsed?.meta && typeof parsed.meta === "object" ? (parsed.meta as Record<string, unknown>).businessId : "", row.business_id);
      const key = `sites/${row.business_id}/${row.business_id}.json`;
      const storage = parsed.storage && typeof parsed.storage === "object" ? parsed.storage as Record<string, unknown> : {};
      storage.r2JsonKey = key;
      storage.r2JsonUrl = publicR2Url(env, key);
      parsed.storage = storage;
      const summary = siteSummaryFromJson(deps, parsed, businessId || row.business_id);

      await env.R2.put(key, JSON.stringify(parsed, null, 2), { httpMetadata: { contentType: "application/json; charset=utf-8" } });
      await deps.saveJsonSiteRecord(db, row.business_id, JSON.stringify(compactSiteManifest(deps, parsed, env, row.business_id, key)), {
        r2_json_key: key,
        r2_json_url: publicR2Url(env, key),
        json_summary: JSON.stringify(summary),
      });
      migrated.push({ businessId: row.business_id, r2JsonKey: key });
    } catch (error) {
      failed.push({ businessId: row.business_id, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return deps.json({
    success: failed.length === 0,
    checked: rows.results?.length || 0,
    migratedCount: migrated.length,
    skippedCount: skipped.length,
    failedCount: failed.length,
    migrated,
    skipped,
    failed,
  }, failed.length ? 207 : 200);
}

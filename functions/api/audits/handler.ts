import { buildMarketingAudit, normalizeAuditCompetitor, normalizeAuditTargetFromSources, parseCityFromAddress, type MarketingAudit, type MarketingAuditSnapshotMeta } from "../../../src/lib/marketingAudit";
import { readSiteJsonFromStorage, type SiteStorageDeps } from "../sites/storage";

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

type AuditEnv = Record<string, unknown> & {
  R2?: R2BucketLike;
};

export type AuditsDeps = {
  json: (data: unknown, status?: number) => Response;
  errorJson: (error: string, status?: number, details?: unknown) => Response;
  parseJsonObject: (value: string | null | undefined) => Record<string, unknown>;
  parseJsonArray: (value: string | null | undefined) => unknown[];
  asString: (value: unknown, fallback?: string) => string;
  ensureRequiredColumns: (db: D1DatabaseLike, specs: unknown[]) => Promise<void>;
  sha256Json: (value: unknown) => Promise<string>;
  siteStorageDeps: Pick<SiteStorageDeps, "asString" | "parseJsonObject">;
};

type SiteRow = {
  business_id: string;
  json_content?: string;
  r2_json_key?: string;
};

type ProspectRow = {
  place_id: string;
  query_key?: string;
  query?: string;
  business_name?: string;
  address?: string;
  phone?: string;
  website_url?: string;
  maps_url?: string;
  rating?: number;
  reviews?: number;
  niche?: string;
  result_json?: string;
  details_json?: string;
  selected_photo_json?: string;
  generated_business_id?: string;
};

type LeadRow = {
  business_id: string;
  business_name?: string;
  niche?: string;
  phone?: string;
  gmb_url?: string;
  website_url?: string;
  rating?: number;
  reviews?: number;
  address?: string;
};

type MarketingAuditRow = {
  id: string;
  business_id: string;
  place_id?: string;
  r2_json_key: string;
  score?: number;
  confidence?: string;
  query?: string;
  source_hash?: string;
  created_at?: string;
  created_by?: string;
};

const auditSnapshotColumns = [
  { table: "marketing_audits", column: "business_id", definition: "TEXT" },
  { table: "marketing_audits", column: "place_id", definition: "TEXT" },
  { table: "marketing_audits", column: "r2_json_key", definition: "TEXT" },
  { table: "marketing_audits", column: "score", definition: "INTEGER" },
  { table: "marketing_audits", column: "confidence", definition: "TEXT" },
  { table: "marketing_audits", column: "query", definition: "TEXT" },
  { table: "marketing_audits", column: "source_hash", definition: "TEXT" },
  { table: "marketing_audits", column: "created_at", definition: "DATETIME" },
  { table: "marketing_audits", column: "created_by", definition: "TEXT" },
];

function normalizeSearchQuery(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function compactText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function firstString(...values: unknown[]) {
  return values.map((value) => typeof value === "string" ? value.trim() : "").find(Boolean) || "";
}

function safeJsonObject(deps: AuditsDeps, value: string | undefined) {
  return deps.parseJsonObject(value || "");
}

function safeJsonArray(deps: AuditsDeps, value: string | undefined) {
  return deps.parseJsonArray(value || "");
}

function snapshotMeta(row: MarketingAuditRow | null | undefined, stale?: boolean, liveSourceHash?: string): MarketingAuditSnapshotMeta | null {
  if (!row) return null;
  const score = Number(row.score);
  return {
    id: row.id,
    businessId: row.business_id,
    placeId: row.place_id || undefined,
    r2JsonKey: row.r2_json_key,
    score: Number.isFinite(score) ? score : undefined,
    confidence: row.confidence || undefined,
    query: row.query || undefined,
    sourceHash: row.source_hash || undefined,
    createdAt: row.created_at || undefined,
    createdBy: row.created_by || undefined,
    stale,
    liveSourceHash,
  };
}

async function ensureAuditSnapshotSchema(deps: AuditsDeps, db: D1DatabaseLike) {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS marketing_audits (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      place_id TEXT,
      r2_json_key TEXT NOT NULL,
      score INTEGER,
      confidence TEXT,
      query TEXT,
      source_hash TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT
    )`,
  ).run();
  await deps.ensureRequiredColumns(db, auditSnapshotColumns);
}

function prospectForAudit(deps: AuditsDeps, row: ProspectRow | null): Record<string, unknown> | null {
  if (!row) return null;
  return {
    ...row,
    result_json_parsed: safeJsonObject(deps, row.result_json),
    details_json_parsed: safeJsonObject(deps, row.details_json),
    selected_photo_parsed: safeJsonObject(deps, row.selected_photo_json),
  };
}

async function loadSiteJson(deps: AuditsDeps, db: D1DatabaseLike, env: AuditEnv, businessId: string) {
  await deps.ensureRequiredColumns(db, [
    { table: "json_sites", column: "r2_json_key", definition: "TEXT" },
    { table: "json_sites", column: "json_content", definition: "TEXT" },
  ]);
  const row = await db
    .prepare("SELECT business_id, json_content, r2_json_key FROM json_sites WHERE business_id = ?")
    .bind(businessId)
    .first<SiteRow>();
  if (!row?.json_content) return { row: null, siteJson: null };
  const siteJson = await readSiteJsonFromStorage(deps.siteStorageDeps, row, env);
  return {
    row,
    siteJson: siteJson && typeof siteJson === "object" && !Array.isArray(siteJson) ? siteJson as Record<string, unknown> : null,
  };
}

async function loadProspect(db: D1DatabaseLike, id: string, siteBusinessId = "") {
  return db
    .prepare(
      `SELECT *
       FROM places_prospects
       WHERE generated_business_id = ?
          OR place_id = ?
       ORDER BY CASE WHEN generated_business_id = ? THEN 0 ELSE 1 END
       LIMIT 1`,
    )
    .bind(siteBusinessId || id, id, siteBusinessId || id)
    .first<ProspectRow>();
}

async function loadLead(db: D1DatabaseLike, id: string, siteBusinessId = "") {
  return db
    .prepare("SELECT * FROM leads WHERE business_id = ? OR business_id = ? LIMIT 1")
    .bind(siteBusinessId || id, id)
    .first<LeadRow>();
}

function queryFromTarget(target: ReturnType<typeof normalizeAuditTargetFromSources>) {
  if (target.query) return target.query;
  const city = target.city || parseCityFromAddress(target.address || "");
  return compactText([target.category || target.niche || target.types?.[0], city].filter(Boolean).join(" "));
}

async function loadCachedCompetitors(deps: AuditsDeps, db: D1DatabaseLike, query: string) {
  const queryKey = normalizeSearchQuery(query);
  if (!queryKey) return { rows: [], source: "inferred_none" as const };
  const cache = await db
    .prepare("SELECT results_json FROM places_search_cache WHERE query_key = ? LIMIT 1")
    .bind(queryKey)
    .first<{ results_json?: string }>();
  const rows = safeJsonArray(deps, cache?.results_json)
    .map(normalizeAuditCompetitor)
    .filter((item): item is NonNullable<ReturnType<typeof normalizeAuditCompetitor>> => Boolean(item));
  return { rows, source: rows.length ? "cached_query" as const : "inferred_none" as const };
}

async function latestSnapshotRow(deps: AuditsDeps, db: D1DatabaseLike, businessId: string) {
  await ensureAuditSnapshotSchema(deps, db);
  return db
    .prepare(
      `SELECT *
       FROM marketing_audits
       WHERE business_id = ?
       ORDER BY datetime(COALESCE(created_at, '1970-01-01')) DESC
       LIMIT 1`,
    )
    .bind(businessId)
    .first<MarketingAuditRow>();
}

async function snapshotRowById(deps: AuditsDeps, db: D1DatabaseLike, businessId: string, snapshotId: string) {
  await ensureAuditSnapshotSchema(deps, db);
  if (snapshotId === "latest") return latestSnapshotRow(deps, db, businessId);
  return db
    .prepare("SELECT * FROM marketing_audits WHERE business_id = ? AND id = ? LIMIT 1")
    .bind(businessId, snapshotId)
    .first<MarketingAuditRow>();
}

async function buildLiveAudit(deps: AuditsDeps, db: D1DatabaseLike, env: AuditEnv, id: string) {
  const { row: siteRow, siteJson } = await loadSiteJson(deps, db, env, id).catch(() => ({ row: null, siteJson: null }));
  const canonicalBusinessId = siteRow?.business_id || id;
  const prospectRow = await loadProspect(db, id, canonicalBusinessId);
  const leadRow = await loadLead(db, id, canonicalBusinessId);
  const prospect = prospectForAudit(deps, prospectRow);
  const target = normalizeAuditTargetFromSources({
    businessId: canonicalBusinessId,
    siteJson,
    prospect,
    lead: leadRow,
  });
  target.query = firstString(target.query, prospectRow?.query, queryFromTarget(target));
  const competitors = await loadCachedCompetitors(deps, db, target.query || "");
  const profileDataSource: MarketingAudit["source"]["profileDataSource"] = siteJson ? "generated_site" : prospectRow ? "prospect_details" : "lead_fallback";
  const audit = buildMarketingAudit({
    target,
    competitors: competitors.rows,
    siteJson,
    profileDataSource,
    competitorDataSource: competitors.source,
  });
  const sourceHash = await deps.sha256Json({
    target,
    competitors: competitors.rows,
    profileDataSource,
    competitorDataSource: competitors.source,
  });
  audit.sourceHash = sourceHash;
  return { audit, sourceHash };
}

async function readSnapshotAudit(deps: AuditsDeps, env: AuditEnv, row: MarketingAuditRow, liveSourceHash: string) {
  if (!env.R2?.get) {
    throw new Error("R2 binding is not configured. Cannot read saved audit snapshot JSON.");
  }
  const object = await env.R2.get(row.r2_json_key);
  const text = object ? await object.text() : "";
  if (!text) throw new Error(`Saved audit snapshot JSON is missing in R2: ${row.r2_json_key}`);
  const parsed = JSON.parse(text) as MarketingAudit;
  parsed.snapshot = snapshotMeta(row, Boolean(row.source_hash && row.source_hash !== liveSourceHash), liveSourceHash);
  parsed.sourceHash = parsed.sourceHash || row.source_hash || "";
  return parsed;
}

async function listSnapshots(deps: AuditsDeps, db: D1DatabaseLike, businessId: string) {
  await ensureAuditSnapshotSchema(deps, db);
  const rows = await db
    .prepare(
      `SELECT *
       FROM marketing_audits
       WHERE business_id = ?
       ORDER BY datetime(COALESCE(created_at, '1970-01-01')) DESC
       LIMIT 25`,
    )
    .bind(businessId)
    .all<MarketingAuditRow>();
  return (rows.results || []).map((row) => snapshotMeta(row)).filter(Boolean);
}

async function saveSnapshot(deps: AuditsDeps, db: D1DatabaseLike, env: AuditEnv, audit: MarketingAudit, sourceHash: string) {
  if (!env.R2?.put) {
    return deps.errorJson("R2 binding is not configured. Cannot save audit snapshot JSON.", 400);
  }
  await ensureAuditSnapshotSchema(deps, db);
  const id = crypto.randomUUID();
  const key = `audits/${audit.businessId}/${id}.json`;
  const createdAt = new Date().toISOString();
  audit.sourceHash = sourceHash;
  const row: MarketingAuditRow = {
    id,
    business_id: audit.businessId,
    place_id: audit.source.placeId || "",
    r2_json_key: key,
    score: audit.score.total,
    confidence: audit.confidence,
    query: audit.source.query || "",
    source_hash: sourceHash,
    created_at: createdAt,
    created_by: "admin",
  };
  audit.snapshot = snapshotMeta(row, false, sourceHash);
  await env.R2.put(key, JSON.stringify(audit, null, 2), { httpMetadata: { contentType: "application/json; charset=utf-8" } });
  await db
    .prepare(
      `INSERT INTO marketing_audits (id, business_id, place_id, r2_json_key, score, confidence, query, source_hash, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(row.id, row.business_id, row.place_id || null, row.r2_json_key, row.score || 0, row.confidence || "", row.query || "", row.source_hash || "", row.created_at, row.created_by || "admin")
    .run();
  audit.latestSnapshot = audit.snapshot;
  return deps.json({ success: true, audit, snapshot: audit.snapshot });
}

export async function handleAudits(deps: AuditsDeps, request: Request, db: D1DatabaseLike, env: AuditEnv, url: URL, segments: string[]): Promise<Response> {
  if (segments.length < 2 || segments.length > 3) {
    return deps.errorJson("Not Found", 404);
  }

  const id = decodeURIComponent(segments[1] || "").trim();
  if (!id) return deps.errorJson("Missing businessId", 400);

  const live = await buildLiveAudit(deps, db, env, id);

  if (segments.length === 3 && segments[2] === "snapshots") {
    if (request.method === "GET") {
      return deps.json({ snapshots: await listSnapshots(deps, db, live.audit.businessId) });
    }
    if (request.method === "POST") {
      return saveSnapshot(deps, db, env, live.audit, live.sourceHash);
    }
  }

  if (request.method !== "GET" || segments.length !== 2) {
    return deps.errorJson("Not Found", 404);
  }

  const snapshotId = url.searchParams.get("snapshot") || "";
  if (snapshotId) {
    const row = await snapshotRowById(deps, db, live.audit.businessId, snapshotId);
    if (!row) return deps.errorJson("Audit snapshot not found", 404);
    return deps.json(await readSnapshotAudit(deps, env, row, live.sourceHash));
  }

  live.audit.latestSnapshot = snapshotMeta(await latestSnapshotRow(deps, db, live.audit.businessId));

  return deps.json(live.audit);
}

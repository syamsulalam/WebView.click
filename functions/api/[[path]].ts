import templateSchema from "../../JSON/template-schema.json";
import { applyGeneratedSitePageInserts } from "../../src/lib/generatedSitePostProcess";
import { applyAiCopyPatch, applyAiOfferingOutline, buildAiCopyAudit, buildAiCopyTargetBrief, collectAiCopyAuditTargets, generateAiCopyPatch, generateAiOfferingOutline, type AiSiteGenerationDeps } from "./ai/siteGeneration";
import { handleGenerationJobs, type GenerationJobsDeps } from "./generationJobs/handler";
import { asNumber, handlePlacesCache, handlePlacesDetails, handlePlacesManualImport, handlePlacesSearch, normalizeSearchQuery, placeIdFromPlace, type PlacesDeps } from "./places/handler";
import { compactSiteManifest, migrateOldSiteJsonRowsToR2, normalizeImageFilenames, publicR2Url, readSiteJsonFromStorage, siteSummaryFromJson, type SiteStorageDeps, uploadImageAssetsToR2, uploadJsonToR2 } from "./sites/storage";

type D1Result<T = unknown> = {
  results?: T[];
  success?: boolean;
  meta?: unknown;
  error?: string;
};

type D1PreparedStatement<T = unknown> = {
  bind: (...values: unknown[]) => D1PreparedStatement<T>;
  all: <R = T>() => Promise<D1Result<R>>;
  first: <R = T>() => Promise<R | null>;
  run: () => Promise<D1Result<T>>;
};

type D1Database = {
  prepare: <T = unknown>(query: string) => D1PreparedStatement<T>;
  batch: <T = unknown>(statements: D1PreparedStatement<T>[]) => Promise<D1Result<T>[]>;
  exec: (query: string) => Promise<D1Result>;
};

type R2Bucket = {
  put: (key: string, value: ReadableStream | ArrayBuffer | ArrayBufferView | string, options?: { httpMetadata?: { contentType?: string } }) => Promise<unknown>;
  get?: (key: string) => Promise<{ text: () => Promise<string> } | null>;
};

type Env = {
  DB?: D1Database;
  R2?: R2Bucket;
  R2_PUBLIC_BASE_URL?: string;
  GOOGLE_PLACES_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  OPENAI_API_KEY?: string;
  GEMINI_API_KEY?: string;
  KIE_API_KEY?: string;
  OPENCODE_API_KEY?: string;
  OPENCODE_BASE_URL?: string;
  LEMON_SQUEEZY_API_KEY?: string;
  LEMON_SQUEEZY_STORE_ID?: string;
  LEMON_SQUEEZY_VARIANT_ID?: string;
  ADMIN_WHATSAPP_NUMBER?: string;
};

type PagesContext = {
  request: Request;
  env: Env & Record<string, unknown>;
};

type LeadRow = {
  id: string;
  business_id: string;
  business_name: string;
  status: string;
  view_count?: number;
};

type SettingRow = {
  key: string;
  value: string;
};

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

const dailyUsageLimits = {
  places_search: { label: "Places search", warnAt: 50, dangerAt: 100 },
  places_details: { label: "Places details", warnAt: 250, dangerAt: 500 },
  ai_readiness_remote: { label: "Remote AI readiness", warnAt: 50, dangerAt: 100 },
  site_generation: { label: "Site generation", warnAt: 30, dangerAt: 75 },
} as const;

type DailyUsageKey = keyof typeof dailyUsageLimits;

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
  "access-control-allow-headers": "content-type,authorization",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...jsonHeaders,
      ...corsHeaders,
    },
  });
}

function errorJson(error: string, status = 500, details?: unknown): Response {
  return json({ error, details }, status);
}

function getDb(env: Env): D1Database {
  if (!env.DB) {
    throw new Error("Cloudflare D1 binding `DB` is not configured.");
  }
  return env.DB;
}

async function tableColumns(db: D1Database, table: string): Promise<Set<string>> {
  const rows = await db.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
  return new Set((rows.results || []).map((row) => row.name));
}

async function addColumnIfMissing(db: D1Database, table: string, column: string, definition: string) {
  const columns = await tableColumns(db, table);
  if (!columns.has(column)) {
    try {
      await db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.toLowerCase().includes("duplicate column name")) return;
      if (definition.toLowerCase().includes("default")) {
        const definitionWithoutDefault = definition.replace(/\s+DEFAULT\s+('[^']*'|"[^"]*"|[^\s,]+)/i, "");
        await db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definitionWithoutDefault}`);
        return;
      }
      throw error;
    }
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isMissingColumnError(error: unknown, column?: string) {
  const message = errorMessage(error).toLowerCase();
  return (message.includes("no column named") || message.includes("no such column")) && (!column || message.includes(column.toLowerCase()));
}

async function ensureColumn(db: D1Database, table: string, column: string, definition: string) {
  try {
    await addColumnIfMissing(db, table, column, definition);
  } catch (error) {
    console.error(`D1 self-healing failed for ${table}.${column}:`, error);
  }
}

type ColumnSpec = { table: string; column: string; definition: string };

async function ensureRequiredColumn(db: D1Database, table: string, column: string, definition: string) {
  await addColumnIfMissing(db, table, column, definition);
  const columns = await tableColumns(db, table);
  if (!columns.has(column)) {
    throw new Error(`D1 self-healing failed: ${table}.${column} is still missing after ALTER TABLE.`);
  }
}

async function ensureRequiredColumns(db: D1Database, specs: ColumnSpec[]) {
  for (const spec of specs) {
    await ensureRequiredColumn(db, spec.table, spec.column, spec.definition);
  }
}

const generateRequiredColumns: ColumnSpec[] = [
  { table: "leads", column: "niche", definition: "TEXT" },
  { table: "leads", column: "phone", definition: "TEXT" },
  { table: "leads", column: "website_url", definition: "TEXT" },
  { table: "leads", column: "rating", definition: "REAL" },
  { table: "leads", column: "reviews", definition: "INTEGER" },
  { table: "leads", column: "address", definition: "TEXT" },
  { table: "leads", column: "status", definition: "TEXT DEFAULT 'scraped'" },
  { table: "leads", column: "view_count", definition: "INTEGER DEFAULT 0" },
  { table: "leads", column: "updated_at", definition: "DATETIME" },
  { table: "json_sites", column: "id", definition: "TEXT" },
  { table: "json_sites", column: "r2_json_key", definition: "TEXT" },
  { table: "json_sites", column: "r2_json_url", definition: "TEXT" },
  { table: "json_sites", column: "json_summary", definition: "TEXT" },
  { table: "json_sites", column: "updated_at", definition: "DATETIME" },
  { table: "generation_jobs", column: "business_id", definition: "TEXT" },
  { table: "generation_jobs", column: "place_id", definition: "TEXT" },
  { table: "generation_jobs", column: "provider", definition: "TEXT" },
  { table: "generation_jobs", column: "model", definition: "TEXT" },
  { table: "generation_jobs", column: "status", definition: "TEXT" },
  { table: "generation_jobs", column: "error", definition: "TEXT" },
  { table: "generation_jobs", column: "metadata_json", definition: "TEXT" },
  { table: "generation_jobs", column: "updated_at", definition: "DATETIME" },
  { table: "places_prospects", column: "status", definition: "TEXT DEFAULT 'new'" },
  { table: "places_prospects", column: "generated_business_id", definition: "TEXT" },
  { table: "places_prospects", column: "last_error", definition: "TEXT" },
  { table: "places_prospects", column: "generated_at", definition: "DATETIME" },
  { table: "places_prospects", column: "updated_at", definition: "DATETIME" },
  { table: "crm_activities", column: "staff_id", definition: "TEXT" },
  { table: "crm_activities", column: "description", definition: "TEXT" },
];

const checkoutRequiredColumns: ColumnSpec[] = [
  { table: "leads", column: "niche", definition: "TEXT" },
  { table: "leads", column: "email", definition: "TEXT" },
  { table: "leads", column: "status", definition: "TEXT DEFAULT 'scraped'" },
  { table: "leads", column: "view_count", definition: "INTEGER DEFAULT 0" },
  { table: "leads", column: "updated_at", definition: "DATETIME" },
  { table: "crm_activities", column: "staff_id", definition: "TEXT" },
  { table: "crm_activities", column: "description", definition: "TEXT" },
];

const selectionRequiredColumns: ColumnSpec[] = [
  { table: "places_prospects", column: "selected_photo_json", definition: "TEXT" },
  { table: "places_prospects", column: "selected_palette_json", definition: "TEXT" },
  { table: "places_prospects", column: "palette_options_json", definition: "TEXT" },
  { table: "places_prospects", column: "updated_at", definition: "DATETIME" },
];

const prospectStatusRequiredColumns: ColumnSpec[] = [
  { table: "places_prospects", column: "status", definition: "TEXT DEFAULT 'new'" },
  { table: "places_prospects", column: "updated_at", definition: "DATETIME" },
];

const prospectDetailsRequiredColumns: ColumnSpec[] = [
  { table: "places_prospects", column: "details_json", definition: "TEXT" },
  { table: "places_prospects", column: "phone", definition: "TEXT" },
  { table: "places_prospects", column: "website_url", definition: "TEXT" },
  { table: "places_prospects", column: "maps_url", definition: "TEXT" },
  { table: "places_prospects", column: "website_check_status", definition: "TEXT" },
  { table: "places_prospects", column: "website_checked_at", definition: "DATETIME" },
  { table: "places_prospects", column: "details_loaded_at", definition: "DATETIME" },
  { table: "places_prospects", column: "updated_at", definition: "DATETIME" },
];

const prospectListRequiredColumns: ColumnSpec[] = [
  { table: "places_prospects", column: "website_url", definition: "TEXT" },
  { table: "places_prospects", column: "website_check_status", definition: "TEXT" },
  { table: "places_prospects", column: "website_checked_at", definition: "DATETIME" },
  { table: "places_prospects", column: "palette_options_json", definition: "TEXT" },
  { table: "places_prospects", column: "generated_business_id", definition: "TEXT" },
  { table: "places_prospects", column: "updated_at", definition: "DATETIME" },
];

const prospectWebsiteCheckRequiredColumns: ColumnSpec[] = [
  { table: "places_prospects", column: "phone", definition: "TEXT" },
  { table: "places_prospects", column: "website_url", definition: "TEXT" },
  { table: "places_prospects", column: "maps_url", definition: "TEXT" },
  { table: "places_prospects", column: "website_check_status", definition: "TEXT" },
  { table: "places_prospects", column: "website_checked_at", definition: "DATETIME" },
  { table: "places_prospects", column: "updated_at", definition: "DATETIME" },
];

async function upsertLeadRecord(db: D1Database, values: Record<string, unknown>) {
  const columns = await tableColumns(db, "leads");
  const missingProvidedColumns = Object.entries(values)
    .filter(([, value]) => value !== undefined)
    .map(([column]) => column)
    .filter((column) => !columns.has(column));
  if (missingProvidedColumns.length) {
    throw new Error(`D1 schema is missing required leads column(s): ${missingProvidedColumns.join(", ")}`);
  }
  const entries = Object.entries(values).filter(([column, value]) => columns.has(column) && value !== undefined);
  if (!entries.some(([column]) => column === "business_id")) {
    throw new Error("Cannot upsert lead without business_id column.");
  }
  const insertColumns = entries.map(([column]) => column);
  const placeholders = entries.map(() => "?");
  const updateColumns = insertColumns.filter((column) => !["id", "business_id"].includes(column));
  const updateClause = updateColumns.length
    ? updateColumns.map((column) => `${column} = excluded.${column}`).join(", ")
    : "business_id = excluded.business_id";

  await db
    .prepare(
      `INSERT INTO leads (${insertColumns.join(", ")})
       VALUES (${placeholders.join(", ")})
       ON CONFLICT(business_id) DO UPDATE SET ${updateClause}`,
    )
    .bind(...entries.map(([, value]) => value))
    .run();
}

async function saveJsonSiteRecord(db: D1Database, businessId: string, jsonContent: string, options: Record<string, unknown> = {}) {
  const columns = await tableColumns(db, "json_sites");
  const values: Record<string, unknown> = {
    id: crypto.randomUUID(),
    business_id: businessId,
    json_content: jsonContent,
    r2_json_key: options.r2_json_key,
    r2_json_url: options.r2_json_url,
    json_summary: options.json_summary,
    updated_at: new Date().toISOString(),
  };
  const requiredColumns = ["business_id", "json_content"];
  const missingProvidedColumns = requiredColumns.filter((column) => !columns.has(column));
  if (missingProvidedColumns.length) {
    throw new Error(`D1 schema is missing required json_sites column(s): ${missingProvidedColumns.join(", ")}`);
  }
  const entries = Object.entries(values).filter(([column, value]) => columns.has(column) && value !== undefined);
  const updateColumns = entries.map(([column]) => column).filter((column) => !["id", "business_id"].includes(column));
  const updateClause = updateColumns.length
    ? updateColumns.map((column) => `${column} = excluded.${column}`).join(", ")
    : "json_content = excluded.json_content";

  await db
    .prepare(
      `INSERT INTO json_sites (${entries.map(([column]) => column).join(", ")})
       VALUES (${entries.map(() => "?").join(", ")})
       ON CONFLICT(business_id) DO UPDATE SET ${updateClause}`,
    )
    .bind(...entries.map(([, value]) => value))
    .run();
}

async function createGenerationJob(db: D1Database, values: Record<string, unknown>) {
  const columns = await tableColumns(db, "generation_jobs");
  const allValues = {
    ...values,
    updated_at: new Date().toISOString(),
  };
  const missingProvidedColumns = Object.keys(allValues).filter((column) => !columns.has(column));
  if (missingProvidedColumns.length) {
    throw new Error(`D1 schema is missing required generation_jobs column(s): ${missingProvidedColumns.join(", ")}`);
  }
  const entries = Object.entries({
    ...allValues,
  }).filter(([column]) => columns.has(column));
  if (!entries.length) return;
  await db
    .prepare(
      `INSERT INTO generation_jobs (${entries.map(([column]) => column).join(", ")})
       VALUES (${entries.map(() => "?").join(", ")})`,
    )
    .bind(...entries.map(([, value]) => value))
    .run();
}

async function updateGenerationJob(db: D1Database, jobId: string, values: Record<string, unknown>) {
  const columns = await tableColumns(db, "generation_jobs");
  const allValues = {
    ...values,
    updated_at: new Date().toISOString(),
  };
  const missingProvidedColumns = Object.keys(allValues).filter((column) => !columns.has(column));
  if (missingProvidedColumns.length) {
    throw new Error(`D1 schema is missing required generation_jobs column(s): ${missingProvidedColumns.join(", ")}`);
  }
  const entries = Object.entries(allValues).filter(([column]) => columns.has(column));
  if (!entries.length) return;
  await db
    .prepare(`UPDATE generation_jobs SET ${entries.map(([column]) => `${column} = ?`).join(", ")} WHERE id = ?`)
    .bind(...entries.map(([, value]) => value), jobId)
    .run();
}

async function updateProspectRecord(db: D1Database, placeId: string, values: Record<string, unknown>) {
  if (!placeId) return;
  const columns = await tableColumns(db, "places_prospects");
  const allValues = {
    ...values,
    updated_at: new Date().toISOString(),
  };
  const missingProvidedColumns = Object.keys(allValues).filter((column) => !columns.has(column));
  if (missingProvidedColumns.length) {
    throw new Error(`D1 schema is missing required places_prospects column(s): ${missingProvidedColumns.join(", ")}`);
  }
  const entries = Object.entries(allValues).filter(([column]) => columns.has(column));
  if (!entries.length) return;
  await db
    .prepare(`UPDATE places_prospects SET ${entries.map(([column]) => `${column} = ?`).join(", ")} WHERE place_id = ?`)
    .bind(...entries.map(([, value]) => value), placeId)
    .run();
}

async function insertCrmActivitySafe(db: D1Database, values: Record<string, unknown>) {
  try {
    const columns = await tableColumns(db, "crm_activities");
    const entries = Object.entries(values).filter(([column]) => columns.has(column));
    if (!entries.length) return;
    await db
      .prepare(
        `INSERT INTO crm_activities (${entries.map(([column]) => column).join(", ")})
         VALUES (${entries.map(() => "?").join(", ")})`,
      )
      .bind(...entries.map(([, value]) => value))
      .run();
  } catch (error) {
    console.error("CRM activity insert failed, continuing:", error);
  }
}

async function setupTables(db: D1Database) {
  const createStatements = [
    "CREATE TABLE IF NOT EXISTS leads (id TEXT PRIMARY KEY, business_id TEXT UNIQUE NOT NULL, business_name TEXT NOT NULL, niche TEXT, email TEXT, phone TEXT, gmb_url TEXT, website_url TEXT, rating REAL, reviews INTEGER, address TEXT, status TEXT DEFAULT 'scraped', view_count INTEGER DEFAULT 0, last_viewed_at DATETIME, last_contacted DATETIME, staff_id TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS subscriptions (id TEXT PRIMARY KEY, lead_id TEXT NOT NULL, package_type TEXT NOT NULL, amount_paid REAL DEFAULT 0.00, payment_status TEXT DEFAULT 'unpaid', payment_method TEXT, payment_reference TEXT, subscription_start_date DATETIME, subscription_end_date DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE)",
    "CREATE TABLE IF NOT EXISTS crm_activities (id TEXT PRIMARY KEY, lead_id TEXT NOT NULL, staff_id TEXT, activity_type TEXT NOT NULL, description TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE)",
    "CREATE TABLE IF NOT EXISTS json_sites (id TEXT PRIMARY KEY, business_id TEXT UNIQUE NOT NULL, json_content TEXT NOT NULL, r2_json_key TEXT, r2_json_url TEXT, json_summary TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS ai_readiness_cache (cache_key TEXT PRIMARY KEY, provider TEXT NOT NULL, model TEXT NOT NULL, key_hash TEXT, validation_json TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, expires_at DATETIME NOT NULL)",
    "CREATE TABLE IF NOT EXISTS daily_usage_counters (usage_date TEXT NOT NULL, counter_key TEXT NOT NULL, count INTEGER DEFAULT 0, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (usage_date, counter_key))",
    "CREATE TABLE IF NOT EXISTS provider_cooldowns (provider_key TEXT PRIMARY KEY, provider TEXT NOT NULL, until_ms INTEGER NOT NULL, reason TEXT, raw_message TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS provider_cooldown_events (id TEXT PRIMARY KEY, provider_key TEXT NOT NULL, provider TEXT NOT NULL, event_type TEXT NOT NULL, cooldown_until_ms INTEGER, reason TEXT, raw_message TEXT, metadata_json TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS places_search_cache (query_key TEXT PRIMARY KEY, query TEXT NOT NULL, results_json TEXT NOT NULL, provider_status TEXT, result_count INTEGER DEFAULT 0, hit_count INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, expires_at DATETIME)",
    "CREATE TABLE IF NOT EXISTS places_prospects (place_id TEXT PRIMARY KEY, query_key TEXT, query TEXT, business_name TEXT NOT NULL, address TEXT, phone TEXT, website_url TEXT, maps_url TEXT, rating REAL, reviews INTEGER, niche TEXT, status TEXT DEFAULT 'new', result_json TEXT NOT NULL, details_json TEXT, selected_photo_json TEXT, selected_palette_json TEXT, palette_options_json TEXT, website_check_status TEXT, website_checked_at DATETIME, generated_business_id TEXT, last_error TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, generated_at DATETIME, details_loaded_at DATETIME)",
    "CREATE TABLE IF NOT EXISTS generation_jobs (id TEXT PRIMARY KEY, business_id TEXT, place_id TEXT, provider TEXT, model TEXT, status TEXT NOT NULL, error TEXT, metadata_json TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
  ];

  for (const statement of createStatements) {
    await db.exec(statement);
  }

  await addColumnIfMissing(db, "leads", "email", "TEXT");
  await addColumnIfMissing(db, "leads", "phone", "TEXT");
  await addColumnIfMissing(db, "leads", "gmb_url", "TEXT");
  await addColumnIfMissing(db, "leads", "website_url", "TEXT");
  await addColumnIfMissing(db, "leads", "rating", "REAL");
  await addColumnIfMissing(db, "leads", "reviews", "INTEGER");
  await addColumnIfMissing(db, "leads", "address", "TEXT");
  await addColumnIfMissing(db, "leads", "view_count", "INTEGER DEFAULT 0");
  await addColumnIfMissing(db, "leads", "last_viewed_at", "DATETIME");
  await addColumnIfMissing(db, "leads", "staff_id", "TEXT");
  await addColumnIfMissing(db, "leads", "updated_at", "DATETIME");
  await addColumnIfMissing(db, "json_sites", "updated_at", "DATETIME");
  await addColumnIfMissing(db, "json_sites", "r2_json_key", "TEXT");
  await addColumnIfMissing(db, "json_sites", "r2_json_url", "TEXT");
  await addColumnIfMissing(db, "json_sites", "json_summary", "TEXT");
  await addColumnIfMissing(db, "ai_readiness_cache", "provider", "TEXT");
  await addColumnIfMissing(db, "ai_readiness_cache", "model", "TEXT");
  await addColumnIfMissing(db, "ai_readiness_cache", "key_hash", "TEXT");
  await addColumnIfMissing(db, "ai_readiness_cache", "validation_json", "TEXT");
  await addColumnIfMissing(db, "ai_readiness_cache", "created_at", "DATETIME");
  await addColumnIfMissing(db, "ai_readiness_cache", "expires_at", "DATETIME");
  await addColumnIfMissing(db, "daily_usage_counters", "usage_date", "TEXT");
  await addColumnIfMissing(db, "daily_usage_counters", "counter_key", "TEXT");
  await addColumnIfMissing(db, "daily_usage_counters", "count", "INTEGER DEFAULT 0");
  await addColumnIfMissing(db, "daily_usage_counters", "updated_at", "DATETIME");
  await addColumnIfMissing(db, "provider_cooldowns", "provider_key", "TEXT");
  await addColumnIfMissing(db, "provider_cooldowns", "provider", "TEXT");
  await addColumnIfMissing(db, "provider_cooldowns", "until_ms", "INTEGER");
  await addColumnIfMissing(db, "provider_cooldowns", "reason", "TEXT");
  await addColumnIfMissing(db, "provider_cooldowns", "raw_message", "TEXT");
  await addColumnIfMissing(db, "provider_cooldowns", "created_at", "DATETIME");
  await addColumnIfMissing(db, "provider_cooldowns", "updated_at", "DATETIME");
  await addColumnIfMissing(db, "provider_cooldown_events", "provider_key", "TEXT");
  await addColumnIfMissing(db, "provider_cooldown_events", "provider", "TEXT");
  await addColumnIfMissing(db, "provider_cooldown_events", "event_type", "TEXT");
  await addColumnIfMissing(db, "provider_cooldown_events", "cooldown_until_ms", "INTEGER");
  await addColumnIfMissing(db, "provider_cooldown_events", "reason", "TEXT");
  await addColumnIfMissing(db, "provider_cooldown_events", "raw_message", "TEXT");
  await addColumnIfMissing(db, "provider_cooldown_events", "metadata_json", "TEXT");
  await addColumnIfMissing(db, "provider_cooldown_events", "created_at", "DATETIME");
  await addColumnIfMissing(db, "places_search_cache", "provider_status", "TEXT");
  await addColumnIfMissing(db, "places_search_cache", "result_count", "INTEGER DEFAULT 0");
  await addColumnIfMissing(db, "places_search_cache", "hit_count", "INTEGER DEFAULT 0");
  await addColumnIfMissing(db, "places_search_cache", "expires_at", "DATETIME");
  await addColumnIfMissing(db, "places_prospects", "query_key", "TEXT");
  await addColumnIfMissing(db, "places_prospects", "query", "TEXT");
  await addColumnIfMissing(db, "places_prospects", "business_name", "TEXT");
  await addColumnIfMissing(db, "places_prospects", "address", "TEXT");
  await addColumnIfMissing(db, "places_prospects", "phone", "TEXT");
  await addColumnIfMissing(db, "places_prospects", "website_url", "TEXT");
  await addColumnIfMissing(db, "places_prospects", "maps_url", "TEXT");
  await addColumnIfMissing(db, "places_prospects", "rating", "REAL");
  await addColumnIfMissing(db, "places_prospects", "reviews", "INTEGER");
  await addColumnIfMissing(db, "places_prospects", "niche", "TEXT");
  await addColumnIfMissing(db, "places_prospects", "status", "TEXT DEFAULT 'new'");
  await addColumnIfMissing(db, "places_prospects", "result_json", "TEXT");
  await addColumnIfMissing(db, "places_prospects", "details_json", "TEXT");
  await addColumnIfMissing(db, "places_prospects", "selected_photo_json", "TEXT");
  await addColumnIfMissing(db, "places_prospects", "selected_palette_json", "TEXT");
  await addColumnIfMissing(db, "places_prospects", "palette_options_json", "TEXT");
  await addColumnIfMissing(db, "places_prospects", "website_check_status", "TEXT");
  await addColumnIfMissing(db, "places_prospects", "website_checked_at", "DATETIME");
  await addColumnIfMissing(db, "places_prospects", "generated_business_id", "TEXT");
  await addColumnIfMissing(db, "places_prospects", "last_error", "TEXT");
  await addColumnIfMissing(db, "places_prospects", "generated_at", "DATETIME");
  await addColumnIfMissing(db, "places_prospects", "details_loaded_at", "DATETIME");
  await addColumnIfMissing(db, "generation_jobs", "business_id", "TEXT");
  await addColumnIfMissing(db, "generation_jobs", "place_id", "TEXT");
  await addColumnIfMissing(db, "generation_jobs", "provider", "TEXT");
  await addColumnIfMissing(db, "generation_jobs", "model", "TEXT");
  await addColumnIfMissing(db, "generation_jobs", "status", "TEXT");
  await addColumnIfMissing(db, "generation_jobs", "error", "TEXT");
  await addColumnIfMissing(db, "generation_jobs", "metadata_json", "TEXT");
  await addColumnIfMissing(db, "generation_jobs", "updated_at", "DATETIME");
}

async function databaseRepairReport(db: D1Database) {
  const startedAt = new Date().toISOString();
  await setupTables(db);
  const tables = ["leads", "subscriptions", "crm_activities", "json_sites", "system_settings", "ai_readiness_cache", "daily_usage_counters", "provider_cooldowns", "provider_cooldown_events", "places_search_cache", "places_prospects", "generation_jobs"];
  const summary: Record<string, string[]> = {};
  for (const table of tables) {
    summary[table] = Array.from(await tableColumns(db, table)).sort();
  }
  return {
    success: true,
    repairedAt: new Date().toISOString(),
    startedAt,
    tables: summary,
  };
}

async function getSetting(db: D1Database, env: Env, key: keyof Env & string): Promise<string | undefined> {
  const row = await db.prepare("SELECT value FROM system_settings WHERE key = ?").bind(key).first<SettingRow>();
  return row?.value || (typeof env[key] === "string" ? env[key] : undefined);
}

function usageDateUtc(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function usageDateDaysAgo(daysAgo: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return usageDateUtc(date);
}

async function incrementDailyUsage(db: D1Database, counterKey: DailyUsageKey, amount = 1) {
  try {
    await db
      .prepare(
        `INSERT INTO daily_usage_counters (usage_date, counter_key, count, updated_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(usage_date, counter_key) DO UPDATE SET
           count = count + excluded.count,
           updated_at = CURRENT_TIMESTAMP`,
      )
      .bind(usageDateUtc(), counterKey, Math.max(1, Math.floor(amount)))
      .run();
  } catch (error) {
    console.error(`Daily usage counter failed for ${counterKey}:`, error);
  }
}

async function getDailyUsage(db: D1Database) {
  const date = usageDateUtc();
  const historyDates = Array.from({ length: 30 }, (_, index) => usageDateDaysAgo(29 - index));
  const emptyCounts = Object.fromEntries(Object.keys(dailyUsageLimits).map((key) => [key, 0])) as Record<DailyUsageKey, number>;
  try {
    const rows = await db
      .prepare("SELECT usage_date, counter_key, count FROM daily_usage_counters WHERE usage_date >= ? ORDER BY usage_date ASC")
      .bind(historyDates[0])
      .all<{ usage_date: string; counter_key: DailyUsageKey; count: number }>();
    const countsByDate = Object.fromEntries(historyDates.map((historyDate) => [historyDate, { ...emptyCounts }])) as Record<string, Record<DailyUsageKey, number>>;
    for (const row of rows.results || []) {
      if (row.usage_date in countsByDate && row.counter_key in dailyUsageLimits) {
        countsByDate[row.usage_date][row.counter_key] = Number(row.count || 0);
      }
    }
    const todayCounts = countsByDate[date] || { ...emptyCounts };
    const countersForCounts = (counts: Record<DailyUsageKey, number>) => Object.entries(dailyUsageLimits).map(([key, limit]) => {
      const count = counts[key as DailyUsageKey] || 0;
      return {
        key,
        label: limit.label,
        count,
        warnAt: limit.warnAt,
        dangerAt: limit.dangerAt,
        level: count >= limit.dangerAt ? "danger" : count >= limit.warnAt ? "warn" : "ok",
      };
    });
    return {
      date,
      timezone: "UTC",
      counters: countersForCounts(todayCounts),
      history: historyDates.map((historyDate) => ({
        date: historyDate,
        counters: countersForCounts(countsByDate[historyDate] || { ...emptyCounts }),
      })),
    };
  } catch (error) {
    console.error("Daily usage stats fallback:", error);
    return {
      date,
      timezone: "UTC",
      counters: Object.entries(dailyUsageLimits).map(([key, limit]) => ({
        key,
        label: limit.label,
        count: 0,
        warnAt: limit.warnAt,
        dangerAt: limit.dangerAt,
        level: "unknown",
      })),
      history: [],
    };
  }
}

const aiProviderKeyMap: Record<string, keyof Env & string> = {
  OpenRouter: "OPENROUTER_API_KEY",
  OpenAI: "OPENAI_API_KEY",
  Gemini: "GEMINI_API_KEY",
  KIE: "KIE_API_KEY",
  Opencode: "OPENCODE_API_KEY",
};

const aiProviderModels: Record<string, string[]> = {
  OpenAI: ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-4.1"],
  Gemini: ["gemini-3.1-pro-preview", "gemini-3-flash-preview", "gemini-3.1-flash-lite", "gemini-2.5-pro"],
  OpenRouter: [
    "~anthropic/claude-sonnet-latest",
    "anthropic/claude-sonnet-latest",
    "~openai/gpt-latest",
    "openai/gpt-latest",
    "~google/gemini-pro-latest",
    "google/gemini-pro-latest",
    "~google/gemini-flash-latest",
    "google/gemini-flash-latest",
    "qwen/qwen3.6-max-preview",
    "qwen/qwen3.6-flash",
  ],
  KIE: ["kie/gemini-2.5-flash", "kie/gemini-3-flash", "kie/gpt-5-4", "kie/gemini-3.1-pro", "kie/gpt-5-5", "kie/gpt-5-2"],
  Opencode: ["opencode-default", "qwen/qwen3.6-flash", "qwen/qwen3.6-max-preview", "custom-model"],
};

const kieModelConfigs: Record<string, { endpoint: string; model?: string; mode: "chat" | "responses" }> = {
  "kie/gemini-2.5-flash": { endpoint: "https://api.kie.ai/gemini-2.5-flash/v1/chat/completions", mode: "chat" },
  "kie/gemini-3-flash": { endpoint: "https://api.kie.ai/gemini-3-flash/v1/chat/completions", mode: "chat" },
  "kie/gpt-5-4": { endpoint: "https://api.kie.ai/codex/v1/responses", model: "gpt-5-4", mode: "responses" },
  "kie/gemini-3.1-pro": { endpoint: "https://api.kie.ai/gemini-3.1-pro/v1/chat/completions", mode: "chat" },
  "kie/gpt-5-5": { endpoint: "https://api.kie.ai/codex/v1/responses", model: "gpt-5-5", mode: "responses" },
  "kie/gpt-5-2": { endpoint: "https://api.kie.ai/gpt-5-2/v1/chat/completions", mode: "chat" },
};

const remoteAiReadinessCacheTtlMs = 2 * 60 * 1000;

type AiFailureDiagnostics = {
  provider: string;
  model: string;
  endpoint?: string;
  stage: string;
  failureKind: string;
  httpStatus?: number;
  providerCode?: string;
  providerStatus?: string;
  retryable: boolean;
  message: string;
  rawSnippet?: string;
  actionHint: string;
  checkedAt: string;
};

function normalizeAiModel(provider: string, model: string) {
  return model;
}

function extractProviderErrorDetails(text: string) {
  const snippet = text.replace(/\s+/g, " ").trim().slice(0, 600);
  if (!text) {
    return { message: "", rawSnippet: "", providerCode: "", providerStatus: "" };
  }
  try {
    const payload = JSON.parse(text);
    const error = payload?.error && typeof payload.error === "object" ? payload.error : {};
    const message = asString(
      error.message,
      asString(payload.message, asString(payload.msg, asString(payload.error, snippet))),
    );
    return {
      message,
      rawSnippet: snippet,
      providerCode: asString(error.code, asString(payload.code)),
      providerStatus: asString(error.status, asString(error.type, asString(payload.status))),
    };
  } catch {
    return { message: snippet, rawSnippet: snippet, providerCode: "", providerStatus: "" };
  }
}

function classifyAiFailure(status: number | undefined, providerStatus: string, message: string, stage = "provider_http") {
  const raw = `${providerStatus} ${message}`.toLowerCase();
  if (stage === "provider_network" || /fetch failed|network|dns|econn|socket|tls/i.test(raw)) {
    return {
      failureKind: "network_error",
      retryable: true,
      actionHint: "Retry once after a short wait. If it repeats, switch provider or check upstream connectivity.",
    };
  }
  if (stage === "provider_empty_response") {
    return {
      failureKind: "empty_response",
      retryable: true,
      actionHint: "Retry once. If it repeats, switch model/provider because the provider returned no usable content.",
    };
  }
  if (stage === "provider_invalid_json") {
    return {
      failureKind: "invalid_json",
      retryable: false,
      actionHint: "Switch to a stronger model or reduce prompt complexity; the provider returned text that could not be parsed as JSON.",
    };
  }
  if (stage === "provider_cooldown" || /cooldown|cooling down/i.test(raw)) {
    return {
      failureKind: "provider_cooldown",
      retryable: true,
      actionHint: "Wait for the shared provider cooldown to end, or switch provider/model.",
    };
  }
  if (status === 429 || /quota|rate limit|too many requests|resource_exhausted|requests per minute|tokens per minute|rpm|tpm/i.test(raw)) {
    return {
      failureKind: "quota_or_rate_limit",
      retryable: true,
      actionHint: "Wait for the cooldown, reduce batch size, or switch provider/model before retrying.",
    };
  }
  if (status === 402 || /credit|insufficient|balance|billing/i.test(raw)) {
    return {
      failureKind: "credits_or_billing",
      retryable: false,
      actionHint: "Check provider credits/billing, then refresh AI readiness before retrying.",
    };
  }
  if (status === 401 || status === 403 || /unauthorized|forbidden|permission|invalid key|api key|access denied|ip whitelist|ip allowlist|allowlist|server ip/i.test(raw)) {
    return {
      failureKind: "auth_or_permission",
      retryable: false,
      actionHint: /ip whitelist|ip allowlist|allowlist|server ip/i.test(raw)
        ? "Remove or update the provider IP whitelist for this API key. Cloudflare Pages Functions egress may not match a single fixed server IP."
        : "Verify the saved API key, project permissions, and model access in Settings.",
    };
  }
  if (status === 400 || status === 404 || status === 422 || /model.*not|not found|unsupported|invalid model|invalid_argument|validation|bad request/i.test(raw)) {
    return {
      failureKind: "bad_request_or_model",
      retryable: false,
      actionHint: "Check the selected provider/model and request format. Refresh AI readiness before trying again.",
    };
  }
  if (status === 455 || status === 500 || status === 502 || status === 503 || status === 504 || /unavailable|overloaded|timeout|timed out|upstream|temporary|maintenance/i.test(raw)) {
    return {
      failureKind: "provider_temporary",
      retryable: true,
      actionHint: "Wait a minute and retry once, or switch provider/model if this blocks a batch.",
    };
  }
  return {
    failureKind: "unknown_provider_error",
    retryable: false,
    actionHint: "Open the raw error in Jobs, then retry only after changing provider, model, input, or quota state.",
  };
}

function buildAiFailureDiagnostics(input: {
  provider: string;
  model: string;
  endpoint?: string;
  stage: string;
  httpStatus?: number;
  message: string;
  rawSnippet?: string;
  providerCode?: string;
  providerStatus?: string;
}): AiFailureDiagnostics {
  const classified = classifyAiFailure(input.httpStatus, input.providerStatus || input.providerCode || "", input.message, input.stage);
  return {
    provider: input.provider,
    model: input.model,
    endpoint: input.endpoint,
    stage: input.stage,
    failureKind: classified.failureKind,
    httpStatus: input.httpStatus,
    providerCode: input.providerCode,
    providerStatus: input.providerStatus,
    retryable: classified.retryable,
    message: input.message,
    rawSnippet: input.rawSnippet,
    actionHint: classified.actionHint,
    checkedAt: new Date().toISOString(),
  };
}

async function aiReadinessCacheKey(provider: string, model: string, key: string) {
  const keyHash = key ? (await sha256Hex(key)).slice(0, 16) : "no-key";
  return {
    keyHash,
    cacheKey: `${provider.trim().toLowerCase()}::${model.trim().toLowerCase()}::${keyHash}`,
  };
}

async function getCachedRemoteAiValidation(db: D1Database, cacheKey: string) {
  const now = new Date().toISOString();
  const row = await db
    .prepare(
      `SELECT validation_json, expires_at
       FROM ai_readiness_cache
       WHERE cache_key = ? AND expires_at > ?`,
    )
    .bind(cacheKey, now)
    .first<{ validation_json?: string; expires_at?: string }>();
  if (!row?.validation_json) return null;
  return {
    ...parseJsonObject(row.validation_json),
    cacheHit: true,
    cacheExpiresAt: row.expires_at,
  };
}

async function putCachedRemoteAiValidation(
  db: D1Database,
  cacheKey: string,
  provider: string,
  model: string,
  keyHash: string,
  validation: Record<string, unknown>,
) {
  const now = new Date();
  const nowIso = now.toISOString();
  const expiresAt = new Date(now.getTime() + remoteAiReadinessCacheTtlMs).toISOString();
  const validationJson = JSON.stringify({
    ...validation,
    cacheHit: false,
    cacheStoredAt: nowIso,
    cacheExpiresAt: expiresAt,
  });

  await db
    .prepare(
      `INSERT INTO ai_readiness_cache (cache_key, provider, model, key_hash, validation_json, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(cache_key) DO UPDATE SET
         provider = excluded.provider,
         model = excluded.model,
         key_hash = excluded.key_hash,
         validation_json = excluded.validation_json,
         created_at = excluded.created_at,
         expires_at = excluded.expires_at`,
    )
    .bind(cacheKey, provider, model, keyHash, validationJson, nowIso, expiresAt)
    .run();

  await db
    .prepare("DELETE FROM ai_readiness_cache WHERE expires_at <= ?")
    .bind(nowIso)
    .run()
    .catch((error) => console.error("AI readiness cache cleanup failed:", error));
}

async function validateAiModelRemotely(db: D1Database, env: Env, provider: string, model: string) {
  const normalizedProvider = provider.trim();
  const normalizedModel = normalizeAiModel(normalizedProvider, model.trim());
  const checkedAt = new Date().toISOString();
  const baseResult = {
    requested: true,
    checkedAt,
    provider: normalizedProvider,
    model,
    normalizedModel,
  };
  const errorSnippet = async (response: Response) => {
    const text = await response.text().catch(() => "");
    if (!text) return `HTTP ${response.status}`;
    try {
      const payload = JSON.parse(text);
      return asString(payload.error?.message, asString(payload.error, asString(payload.message, text.slice(0, 180))));
    } catch {
      return text.slice(0, 180);
    }
  };

  if (normalizedProvider === "OpenRouter") {
    const key = await getSetting(db, env, "OPENROUTER_API_KEY");
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: key ? { authorization: `Bearer ${key}` } : {},
    });
    if (!response.ok) {
      return {
        ...baseResult,
        supported: true,
        valid: false,
        status: response.status,
        message: `OpenRouter model list validation failed: ${await errorSnippet(response)}`,
      };
    }
    const payload = await response.json().catch(() => ({})) as { data?: Array<Record<string, unknown>> };
    const aliases = normalizedModel.startsWith("~")
      ? [normalizedModel, normalizedModel.slice(1)]
      : [normalizedModel];
    const match = (payload.data || []).find((item) => aliases.includes(asString(item.id)) || aliases.includes(asString(item.canonical_slug)));
    const matchedModel = match ? asString(match.id, asString(match.canonical_slug)).replace(/^~/, "") : "";
    if (matchedModel) {
      const endpointPath = matchedModel.split("/").map((part) => encodeURIComponent(part)).join("/");
      const endpointResponse = await fetch(`https://openrouter.ai/api/v1/models/${endpointPath}/endpoints`, {
        headers: key ? { authorization: `Bearer ${key}` } : {},
      });
      if (!endpointResponse.ok) {
        return {
          ...baseResult,
          supported: true,
          valid: false,
          matchedModel,
          status: endpointResponse.status,
          message: `OpenRouter endpoint validation failed for ${model}: ${await errorSnippet(endpointResponse)}`,
        };
      }
      const endpointPayload = await endpointResponse.json().catch(() => ({})) as { data?: unknown; endpoints?: unknown };
      const endpointData = endpointPayload.data;
      const endpoints = Array.isArray(endpointData)
        ? endpointData
        : endpointData && typeof endpointData === "object" && Array.isArray((endpointData as Record<string, unknown>).endpoints)
          ? (endpointData as Record<string, unknown>).endpoints as unknown[]
          : Array.isArray(endpointPayload.endpoints)
            ? endpointPayload.endpoints
            : [];
      return {
        ...baseResult,
        supported: true,
        valid: endpoints.length > 0,
        matchedModel,
        endpointCount: endpoints.length,
        message: endpoints.length > 0
          ? `OpenRouter model and endpoint metadata found for ${model}.`
          : `OpenRouter model ${model} exists, but no routable endpoints were returned.`,
      };
    }
    return {
      ...baseResult,
      supported: true,
      valid: Boolean(match),
      matchedModel,
      message: match
        ? `OpenRouter model routing metadata found for ${model}.`
        : `OpenRouter model list does not include ${model}.`,
    };
  }

  if (normalizedProvider === "OpenAI") {
    const key = await getSetting(db, env, "OPENAI_API_KEY");
    const response = await fetch(`https://api.openai.com/v1/models/${encodeURIComponent(normalizedModel)}`, {
      headers: { authorization: `Bearer ${key}` },
    });
    return {
      ...baseResult,
      supported: true,
      valid: response.ok,
      status: response.status,
      message: response.ok
        ? `OpenAI model metadata found for ${model}.`
        : `OpenAI model validation failed for ${model}: ${await errorSnippet(response)}`,
    };
  }

  if (normalizedProvider === "Gemini") {
    const key = await getSetting(db, env, "GEMINI_API_KEY");
    const modelPath = normalizedModel.startsWith("models/") ? normalizedModel : `models/${normalizedModel}`;
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${modelPath}?key=${encodeURIComponent(key || "")}`);
    return {
      ...baseResult,
      supported: true,
      valid: response.ok,
      status: response.status,
      message: response.ok
        ? `Gemini model metadata found for ${model}.`
        : `Gemini model validation failed for ${model}: ${await errorSnippet(response)}`,
    };
  }

  if (normalizedProvider === "KIE") {
    const key = await getSetting(db, env, "KIE_API_KEY");
    const kieConfig = kieModelConfigs[normalizedModel];
    if (!kieConfig) {
      return {
        ...baseResult,
        supported: true,
        valid: false,
        message: `KIE.ai model is not configured for generation in WebView.click: ${model}.`,
      };
    }
    const response = await fetch("https://api.kie.ai/api/v1/chat/credit", {
      headers: { authorization: `Bearer ${key}` },
    });
    const payload = await response.clone().json().catch(() => null) as { code?: number; msg?: string; data?: number } | null;
    const remainingCredits = typeof payload?.data === "number" ? payload.data : null;
    const providerOk = response.ok && payload !== null && (payload.code === 200 || payload.msg === "success");
    return {
      ...baseResult,
      supported: true,
      valid: providerOk && (remainingCredits === null || remainingCredits > 0),
      status: response.status,
      endpoint: kieConfig.endpoint,
      remainingCredits,
      message: providerOk
        ? remainingCredits === 0
          ? `KIE.ai key is valid, but the account has no remaining credits for ${model}.`
          : `KIE.ai key/credits check passed and ${model} is mapped to ${kieConfig.endpoint}.`
        : `KIE.ai key/credit validation failed for ${model}: ${payload?.msg || await errorSnippet(response)}`,
    };
  }

  return {
    ...baseResult,
    supported: false,
    valid: null,
    message: `${normalizedProvider || "Selected provider"} does not expose a lightweight model metadata check in WebView.click yet.`,
  };
}

async function getAiReadiness(db: D1Database, env: Env, provider: string, model: string, requiresAi = true, remoteValidate = false, refreshRemoteValidation = false) {
  const normalizedProvider = provider.trim();
  const normalizedModel = normalizeAiModel(normalizedProvider, model.trim());
  if (!requiresAi) {
    return {
      ready: true,
      requiresAi,
      provider: normalizedProvider,
      model,
      normalizedModel,
      keyPresent: false,
      providerSupported: true,
      modelKnown: true,
      remoteValidation: { requested: remoteValidate, supported: false, valid: null, cacheHit: false },
      message: "This action only resaves gathered data and does not require AI.",
      checkedAt: new Date().toISOString(),
    };
  }

  const keyName = aiProviderKeyMap[normalizedProvider];
  const providerSupported = Boolean(keyName);
  const providerModels = aiProviderModels[normalizedProvider] || [];
  const modelKnown = providerSupported && providerModels.includes(model.trim());
  const key = keyName ? await getSetting(db, env, keyName) : "";
  const keyPresent = Boolean(String(key || "").trim());
  let message = "AI provider key and model look ready.";
  if (!providerSupported) {
    message = `Unsupported AI provider: ${normalizedProvider || "(blank)"}.`;
  } else if (!model.trim()) {
    message = `Select an AI model for ${normalizedProvider}.`;
  } else if (!modelKnown) {
    message = `${normalizedProvider} model is not in the supported WebView.click model list: ${model}.`;
  } else if (!keyPresent) {
    message = `${normalizedProvider} API key is not configured. Set it in /admin/settings first.`;
  }

  let remoteValidation: Record<string, unknown> = {
    requested: remoteValidate,
    supported: false,
    valid: null,
    cacheHit: false,
  };
  let remoteReady = true;
  if (remoteValidate && providerSupported && modelKnown && keyPresent) {
    try {
      const { cacheKey, keyHash } = await aiReadinessCacheKey(normalizedProvider, normalizedModel, key || "");
      let cachedValidation: Record<string, unknown> | null = null;
      if (!refreshRemoteValidation) {
        try {
          cachedValidation = await getCachedRemoteAiValidation(db, cacheKey);
        } catch (cacheError) {
          console.error("AI readiness cache read failed, continuing without cache:", cacheError);
        }
      }
      if (cachedValidation) {
        remoteValidation = cachedValidation;
      } else {
        if (["OpenRouter", "OpenAI", "Gemini", "KIE"].includes(normalizedProvider)) {
          await incrementDailyUsage(db, "ai_readiness_remote");
        }
        remoteValidation = await validateAiModelRemotely(db, env, normalizedProvider, model.trim());
      }
      if (!cachedValidation && remoteValidation.supported === true) {
        try {
          await putCachedRemoteAiValidation(db, cacheKey, normalizedProvider, normalizedModel, keyHash, remoteValidation);
        } catch (cacheError) {
          console.error("AI readiness cache write failed, continuing with live validation:", cacheError);
        }
      }
      if (remoteValidation.supported === true) {
        remoteReady = remoteValidation.valid === true;
        if (remoteReady) {
          message = `${message} Remote model validation passed${remoteValidation.cacheHit ? " from server cache" : ""}.`;
        } else {
          message = asString(remoteValidation.message, `${normalizedProvider} remote model validation failed for ${model}.`);
        }
      } else {
        message = `${message} Remote model validation is not supported for ${normalizedProvider}.`;
      }
    } catch (error) {
      remoteReady = false;
      remoteValidation = {
        requested: true,
        supported: true,
        valid: false,
        cacheHit: false,
        message: error instanceof Error ? error.message : String(error),
        checkedAt: new Date().toISOString(),
      };
      message = `${normalizedProvider} remote model validation failed: ${remoteValidation.message}`;
    }
  }

  return {
    ready: providerSupported && modelKnown && keyPresent && remoteReady,
    requiresAi,
    provider: normalizedProvider,
    model,
    normalizedModel,
    keyName: keyName || "",
    keyPresent,
    providerSupported,
    modelKnown,
    remoteValidation,
    message,
    checkedAt: new Date().toISOString(),
  };
}

async function handleAiReadiness(request: Request, db: D1Database, env: Env): Promise<Response> {
  let provider = "";
  let model = "";
  let requiresAi = true;
  let remoteValidate = false;
  let refreshRemoteValidation = false;
  if (request.method === "GET") {
    const url = new URL(request.url);
    provider = url.searchParams.get("provider") || "";
    model = url.searchParams.get("model") || "";
    requiresAi = !["0", "false", "no"].includes((url.searchParams.get("requiresAi") || "1").toLowerCase());
    remoteValidate = ["1", "true", "yes"].includes((url.searchParams.get("remoteValidate") || url.searchParams.get("validateRemote") || "0").toLowerCase());
    refreshRemoteValidation = ["1", "true", "yes"].includes((url.searchParams.get("refresh") || url.searchParams.get("bypassCache") || "0").toLowerCase());
  } else if (request.method === "POST") {
    const body = await readJsonBody(request);
    provider = asString(body.provider);
    model = asString(body.model);
    requiresAi = body.requiresAi !== false;
    remoteValidate = body.remoteValidate === true
      || body.validateRemote === true
      || ["1", "true", "yes"].includes(asString(body.remoteValidate || body.validateRemote).toLowerCase());
    refreshRemoteValidation = body.refresh === true
      || body.bypassCache === true
      || ["1", "true", "yes"].includes(asString(body.refresh || body.bypassCache).toLowerCase());
  } else {
    return errorJson("Method not allowed", 405);
  }
  const result = await getAiReadiness(db, env, provider, model, requiresAi, remoteValidate, refreshRemoteValidation);
  return json(result);
}

async function handleAiProviderFailure(request: Request, db: D1Database): Promise<Response> {
  if (request.method !== "GET") return errorJson("Method not allowed", 405);
  const url = new URL(request.url);
  const provider = String(url.searchParams.get("provider") || "").trim();
  const model = String(url.searchParams.get("model") || "").trim();
  if (!provider) return errorJson("provider is required", 400);

  const bindings: unknown[] = [provider];
  let modelSql = "";
  if (model) {
    modelSql = "AND model = ?";
    bindings.push(model);
  }

  const row = await db
    .prepare(
      `SELECT id, business_id, place_id, provider, model, error, metadata_json, created_at
       FROM generation_jobs
       WHERE status = 'failed'
         AND provider = ?
         ${modelSql}
         AND datetime(created_at) >= datetime('now', '-14 days')
       ORDER BY datetime(created_at) DESC
       LIMIT 1`,
    )
    .bind(...bindings)
    .first<{
      id: string;
      business_id?: string;
      place_id?: string;
      provider?: string;
      model?: string;
      error?: string;
      metadata_json?: string;
      created_at?: string;
    }>();

  if (!row) return json({ failure: null });

  const metadata = parseJsonObject(row.metadata_json);
  const storedFailure = metadata.aiFailure && typeof metadata.aiFailure === "object"
    ? metadata.aiFailure as Record<string, unknown>
    : metadata.providerFailure && typeof metadata.providerFailure === "object"
      ? metadata.providerFailure as Record<string, unknown>
      : null;
  const message = asString(storedFailure?.message, asString(metadata.failureMessage, row.error || ""));
  const httpStatus = Number(storedFailure?.httpStatus || message.match(/HTTP\s+(\d{3})/i)?.[1] || 0) || undefined;
  const fallbackFailure = buildAiFailureDiagnostics({
    provider: row.provider || provider,
    model: row.model || model,
    endpoint: asString(storedFailure?.endpoint),
    stage: asString(storedFailure?.stage, asString(metadata.failureStage, "site_generate")),
    httpStatus,
    message,
    rawSnippet: asString(storedFailure?.rawSnippet, row.error || ""),
    providerCode: asString(storedFailure?.providerCode),
    providerStatus: asString(storedFailure?.providerStatus),
  });
  const failure = {
    ...fallbackFailure,
    ...(storedFailure || {}),
    provider: row.provider || provider,
    model: row.model || model,
    jobId: row.id,
    businessId: row.business_id || "",
    placeId: row.place_id || "",
    createdAt: row.created_at || "",
    error: row.error || "",
  };

  return json({ failure });
}

async function handleAiProviderHealth(request: Request, db: D1Database): Promise<Response> {
  if (request.method !== "GET") return errorJson("Method not allowed", 405);
  const url = new URL(request.url);
  const provider = String(url.searchParams.get("provider") || "").trim();
  const model = String(url.searchParams.get("model") || "").trim();
  if (!provider) return errorJson("provider is required", 400);

  const bindings: unknown[] = [provider];
  let modelSql = "";
  if (model) {
    modelSql = "AND model = ?";
    bindings.push(model);
  }

  const aggregate = await db
    .prepare(
      `SELECT
         COUNT(*) AS total_count,
         SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS success_count,
         SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_count,
         SUM(CASE WHEN metadata_json LIKE '%"preflightBlocked":true%' THEN 1 ELSE 0 END) AS preflight_count,
         SUM(CASE WHEN metadata_json LIKE '%"cooldownBlocked":true%' THEN 1 ELSE 0 END) AS cooldown_count
       FROM generation_jobs
       WHERE provider = ?
         ${modelSql}
         AND datetime(created_at) >= datetime('now', '-24 hours')`,
    )
    .bind(...bindings)
    .first<{
      total_count?: number;
      success_count?: number;
      failed_count?: number;
      preflight_count?: number;
      cooldown_count?: number;
    }>();

  const failureRows = await db
    .prepare(
      `SELECT error, metadata_json, created_at
       FROM generation_jobs
       WHERE status = 'failed'
         AND provider = ?
         ${modelSql}
         AND datetime(created_at) >= datetime('now', '-24 hours')
       ORDER BY datetime(created_at) DESC
       LIMIT 50`,
    )
    .bind(...bindings)
    .all<{ error?: string; metadata_json?: string; created_at?: string }>();

  const failureKinds = new Map<string, number>();
  let latestFailure: Record<string, unknown> | null = null;
  for (const row of failureRows.results || []) {
    const metadata = parseJsonObject(row.metadata_json);
    const storedFailure = metadata.aiFailure && typeof metadata.aiFailure === "object"
      ? metadata.aiFailure as Record<string, unknown>
      : metadata.providerFailure && typeof metadata.providerFailure === "object"
        ? metadata.providerFailure as Record<string, unknown>
        : null;
    const message = asString(storedFailure?.message, asString(metadata.failureMessage, row.error || ""));
    const httpStatus = Number(storedFailure?.httpStatus || message.match(/HTTP\s+(\d{3})/i)?.[1] || 0) || undefined;
    const fallbackFailure = buildAiFailureDiagnostics({
      provider,
      model,
      endpoint: asString(storedFailure?.endpoint),
      stage: asString(storedFailure?.stage, asString(metadata.failureStage, "site_generate")),
      httpStatus,
      message,
      rawSnippet: asString(storedFailure?.rawSnippet, row.error || ""),
      providerCode: asString(storedFailure?.providerCode),
      providerStatus: asString(storedFailure?.providerStatus),
    });
    const failure = {
      ...fallbackFailure,
      ...(storedFailure || {}),
      createdAt: row.created_at || "",
      error: row.error || "",
    };
    const kind = asString(failure.failureKind, "unknown_provider_error");
    failureKinds.set(kind, (failureKinds.get(kind) || 0) + 1);
    if (!latestFailure) latestFailure = failure;
  }

  const total = Number(aggregate?.total_count || 0);
  const failed = Number(aggregate?.failed_count || 0);
  const failureRate = total > 0 ? failed / total : 0;
  const topFailureKind = [...failureKinds.entries()].sort((a, b) => b[1] - a[1])[0] || null;

  return json({
    provider,
    model,
    windowHours: 24,
    total,
    success: Number(aggregate?.success_count || 0),
    failed,
    preflightBlocked: Number(aggregate?.preflight_count || 0),
    cooldownBlocked: Number(aggregate?.cooldown_count || 0),
    failureRate,
    topFailureKind: topFailureKind ? { kind: topFailureKind[0], count: topFailureKind[1] } : null,
    latestFailure,
    checkedAt: new Date().toISOString(),
  });
}

function providerCooldownKey(provider = "") {
  return provider.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") || "api-provider";
}

function providerCooldownRowToJson(row: { provider?: string; until_ms?: number; reason?: string; raw_message?: string } | null) {
  if (!row?.until_ms || Number(row.until_ms) <= Date.now()) return null;
  return {
    provider: row.provider || "",
    until: Number(row.until_ms),
    reason: row.reason || "",
    rawMessage: row.raw_message || "",
  };
}

async function insertProviderCooldownEvent(db: D1Database, input: {
  provider: string;
  eventType: string;
  cooldownUntil?: number | null;
  reason?: string;
  rawMessage?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await db
      .prepare(
        `INSERT INTO provider_cooldown_events
          (id, provider_key, provider, event_type, cooldown_until_ms, reason, raw_message, metadata_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        providerCooldownKey(input.provider),
        input.provider,
        input.eventType,
        input.cooldownUntil || null,
        (input.reason || "").slice(0, 500),
        (input.rawMessage || "").slice(0, 4000),
        JSON.stringify(input.metadata || {}),
      )
      .run();
    await pruneProviderCooldownEvents(db);
  } catch (error) {
    console.error("Provider cooldown event insert failed, continuing:", error);
  }
}

async function pruneProviderCooldownEvents(db: D1Database) {
  try {
    await db
      .prepare("DELETE FROM provider_cooldown_events WHERE datetime(created_at) < datetime('now', '-45 days')")
      .run();
    await db
      .prepare(
        `DELETE FROM provider_cooldown_events
         WHERE id NOT IN (
           SELECT id FROM provider_cooldown_events
           ORDER BY datetime(created_at) DESC
           LIMIT 500
         )`,
      )
      .run();
  } catch (error) {
    console.error("Provider cooldown event prune failed, continuing:", error);
  }
}

async function handleProviderCooldowns(request: Request, db: D1Database, url: URL, segments: string[]): Promise<Response> {
  if (request.method === "GET" && segments[1] === "history") {
    const requestedLimit = Number(url.searchParams.get("limit") || "20");
    const limit = Math.min(100, Math.max(1, Number.isFinite(requestedLimit) ? Math.floor(requestedLimit) : 20));
    const provider = url.searchParams.get("provider") || "";
    const providerKey = provider ? providerCooldownKey(provider) : "";
    const sql = providerKey
      ? `SELECT id, provider, event_type, cooldown_until_ms, reason, raw_message, metadata_json, created_at
         FROM provider_cooldown_events
         WHERE provider_key = ?
         ORDER BY datetime(created_at) DESC
         LIMIT ?`
      : `SELECT id, provider, event_type, cooldown_until_ms, reason, raw_message, metadata_json, created_at
         FROM provider_cooldown_events
         ORDER BY datetime(created_at) DESC
         LIMIT ?`;
    const rows = providerKey
      ? await db.prepare(sql).bind(providerKey, limit).all<{ id: string; provider: string; event_type: string; cooldown_until_ms?: number; reason?: string; raw_message?: string; metadata_json?: string; created_at?: string }>()
      : await db.prepare(sql).bind(limit).all<{ id: string; provider: string; event_type: string; cooldown_until_ms?: number; reason?: string; raw_message?: string; metadata_json?: string; created_at?: string }>();
    return json((rows.results || []).map((row) => ({
      id: row.id,
      provider: row.provider || "",
      eventType: row.event_type || "",
      cooldownUntil: Number(row.cooldown_until_ms || 0) || null,
      reason: row.reason || "",
      rawMessage: row.raw_message || "",
      metadata: parseJsonObject(row.metadata_json),
      createdAt: row.created_at || "",
    })));
  }

  if (request.method === "GET") {
    const provider = url.searchParams.get("provider") || "";
    const providerKey = providerCooldownKey(provider);
    const row = await db
      .prepare("SELECT provider, until_ms, reason, raw_message FROM provider_cooldowns WHERE provider_key = ?")
      .bind(providerKey)
      .first<{ provider: string; until_ms: number; reason?: string; raw_message?: string }>();
    const cooldown = providerCooldownRowToJson(row);
    if (!cooldown && row) {
      await db.prepare("DELETE FROM provider_cooldowns WHERE provider_key = ?").bind(providerKey).run();
    }
    return json({ cooldown });
  }

  if (request.method === "POST") {
    const body = await readJsonBody(request);
    const provider = asString(body.provider).trim();
    if (!provider) return errorJson("provider is required", 400);
    const providerKey = providerCooldownKey(provider);
    const untilMs = Math.floor(Number(body.until || body.untilMs || 0));
    const cooldownMs = Math.floor(Number(body.cooldownMs || 0));
    const computedUntil = cooldownMs > 0 ? Date.now() + cooldownMs : untilMs;
    if (!Number.isFinite(computedUntil) || computedUntil <= Date.now()) {
      return errorJson("until or cooldownMs must be in the future", 400);
    }
    const cappedUntil = Math.min(computedUntil, Date.now() + 24 * 60 * 60 * 1000);
    const reason = asString(body.reason).slice(0, 500);
    const rawMessage = asString(body.rawMessage || body.raw_message).slice(0, 4000);
    await db
      .prepare(
        `INSERT INTO provider_cooldowns (provider_key, provider, until_ms, reason, raw_message, updated_at)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(provider_key) DO UPDATE SET
           provider = excluded.provider,
           until_ms = CASE
             WHEN excluded.until_ms > provider_cooldowns.until_ms THEN excluded.until_ms
             ELSE provider_cooldowns.until_ms
           END,
           reason = excluded.reason,
           raw_message = excluded.raw_message,
           updated_at = CURRENT_TIMESTAMP`,
      )
      .bind(providerKey, provider, cappedUntil, reason, rawMessage)
      .run();
    await insertProviderCooldownEvent(db, {
      provider,
      eventType: "set",
      cooldownUntil: cappedUntil,
      reason,
      rawMessage,
      metadata: { source: "api_provider_cooldown_post" },
    });
    const row = await db
      .prepare("SELECT provider, until_ms, reason, raw_message FROM provider_cooldowns WHERE provider_key = ?")
      .bind(providerKey)
      .first<{ provider: string; until_ms: number; reason?: string; raw_message?: string }>();
    return json({ success: true, cooldown: providerCooldownRowToJson(row) });
  }

  if (request.method === "DELETE") {
    const provider = url.searchParams.get("provider") || "";
    const providerKey = providerCooldownKey(provider);
    const row = await db
      .prepare("SELECT provider, until_ms, reason, raw_message FROM provider_cooldowns WHERE provider_key = ?")
      .bind(providerKey)
      .first<{ provider: string; until_ms: number; reason?: string; raw_message?: string }>();
    await db.prepare("DELETE FROM provider_cooldowns WHERE provider_key = ?").bind(providerKey).run();
    await insertProviderCooldownEvent(db, {
      provider: provider || row?.provider || "API provider",
      eventType: "clear",
      cooldownUntil: row?.until_ms || null,
      reason: "Manual cooldown clear",
      rawMessage: row?.raw_message || "",
      metadata: { previousReason: row?.reason || "" },
    });
    return json({ success: true, cooldown: null });
  }

  return errorJson("Method not allowed", 405);
}

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function normalizeWhatsAppNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  return digits;
}

function normalizeBusinessId(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug || crypto.randomUUID();
}

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

function fontPairingForBusiness(text: string) {
  const key = text.toLowerCase();
  if (/(contractor|concrete|roof|construction|builder|paving|masonry|mechanic|auto|security|locksmith)/i.test(key)) {
    return { id: "bebas-source", label: "Bebas Neue + Source Sans Pro", headingFont: "Bebas Neue", bodyFont: "Source Sans Pro", headingCss: "'Bebas Neue', sans-serif", bodyCss: "'Source Sans Pro', sans-serif", mood: "strong, condensed, direct", allowedValues: ["bebas-source", "archivo-hind", "oswald-nunito", "fjalla-merriweather-sans", "alfa-chivo"] };
  }
  if (/(law|legal|attorney|finance|financial|insurance|accounting|consulting)/i.test(key)) {
    return { id: "merriweather-lora", label: "Merriweather + Lora", headingFont: "Merriweather", bodyFont: "Lora", headingCss: "'Merriweather', serif", bodyCss: "'Lora', serif", mood: "serious, editorial, authoritative", allowedValues: ["merriweather-lora", "vollkorn-pt-sans", "gravitas-poppins", "ibm-plex", "montserrat-raleway"] };
  }
  if (/(dental|doctor|medical|clinic|health|wellness|spa|salon|beauty)/i.test(key)) {
    return { id: "nixie-prompt", label: "Nixie One + Prompt", headingFont: "Nixie One", bodyFont: "Prompt", headingCss: "'Nixie One', serif", bodyCss: "'Prompt', sans-serif", mood: "light, modern, composed", allowedValues: ["nixie-prompt", "poiret-didact", "sacramento-barlow", "francois-karla", "arvo-roboto"] };
  }
  if (/(restaurant|cafe|coffee|bakery|bar|food)/i.test(key)) {
    return { id: "lobster-open-sans", label: "Lobster + Open Sans", headingFont: "Lobster", bodyFont: "Open Sans", headingCss: "'Lobster', cursive", bodyCss: "'Open Sans', sans-serif", mood: "playful, friendly, casual", allowedValues: ["lobster-open-sans", "ultra-slabo", "abril-work-sans", "courgette-libre", "montserrat-raleway"] };
  }
  if (/(real estate|property|realtor|interior|architecture|design)/i.test(key)) {
    return { id: "abril-work-sans", label: "Abril Fatface + Work Sans", headingFont: "Abril Fatface", bodyFont: "Work Sans", headingCss: "'Abril Fatface', serif", bodyCss: "'Work Sans', sans-serif", mood: "editorial, premium, confident", allowedValues: ["abril-work-sans", "gravitas-poppins", "architects-abel", "roboto-mono-spectral", "montserrat-raleway"] };
  }
  if (/(gym|fitness|trainer|boxing|sport|martial|crossfit)/i.test(key)) {
    return { id: "fugaz-lato", label: "Fugaz One + Lato", headingFont: "Fugaz One", bodyFont: "Lato", headingCss: "'Fugaz One', sans-serif", bodyCss: "'Lato', sans-serif", mood: "dynamic, warm, sporty", allowedValues: ["fugaz-lato", "monoton-rubik", "bebas-source", "alfa-chivo", "oswald-nunito"] };
  }
  return { id: "montserrat-raleway", label: "Montserrat + Raleway", headingFont: "Montserrat", bodyFont: "Raleway", headingCss: "'Montserrat', sans-serif", bodyCss: "'Raleway', sans-serif", mood: "geometric, polished, approachable", allowedValues: ["montserrat-raleway", "arvo-roboto", "francois-karla", "rokkitt-raleway", "ibm-plex"] };
}

function manualShortHash(value: string) {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(index);
  }
  return Math.abs(hash >>> 0).toString(36);
}

function parseJsonObject(value: string | null | undefined) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

async function sha256Hex(value: string) {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

async function sha256Base64(value: string) {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToBase64(new Uint8Array(buffer));
}

async function hmacSha256Base64(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return bytesToBase64(new Uint8Array(signature));
}

async function sha256Json(value: unknown) {
  return sha256Hex(JSON.stringify(value));
}

function parseJsonArray(value: string | null | undefined) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
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

async function handleSettings(request: Request, db: D1Database): Promise<Response> {
  if (request.method === "GET") {
    try {
      const rows = await db.prepare("SELECT key, value FROM system_settings").all<SettingRow>();
      const settings = Object.fromEntries((rows.results || []).map((row) => [row.key, row.value]));
      return json(settings);
    } catch (error) {
      console.error("Settings fallback:", error);
      return json({});
    }
  }

  if (request.method === "POST") {
    const settings = await readJsonBody(request);
    const columns = await tableColumns(db, "system_settings");
    const statements = Object.entries(settings)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => {
        const values: Record<string, unknown> = {
          key,
          value: String(value),
          updated_at: new Date().toISOString(),
        };
        const entries = Object.entries(values).filter(([column]) => columns.has(column));
        const updateColumns = entries.map(([column]) => column).filter((column) => column !== "key");
        return db
          .prepare(
            `INSERT INTO system_settings (${entries.map(([column]) => column).join(", ")})
             VALUES (${entries.map(() => "?").join(", ")})
             ON CONFLICT(key) DO UPDATE SET ${updateColumns.map((column) => `${column} = excluded.${column}`).join(", ")}`,
          )
          .bind(...entries.map(([, entryValue]) => entryValue));
      });

    if (statements.length > 0) {
      await db.batch(statements);
    }

    return json({ success: true });
  }

  return errorJson("Method Not Allowed", 405);
}

async function handlePublicSettings(db: D1Database): Promise<Response> {
  const rows = await db
    .prepare("SELECT key, value FROM system_settings WHERE key IN ('PAYMENT_LINK_BASIC', 'PAYMENT_LINK_PREMIUM')")
    .all<SettingRow>();
  const settings = Object.fromEntries((rows.results || []).map((row) => [row.key, row.value]));
  return json(settings);
}

async function handleActivities(db: D1Database): Promise<Response> {
  try {
    const activities = await db
      .prepare(
        `SELECT c.*, l.business_name
         FROM crm_activities c
         LEFT JOIN leads l ON c.lead_id = l.id
         ORDER BY c.created_at DESC
         LIMIT 10`,
      )
      .all();
    return json(activities.results || []);
  } catch (error) {
    console.error("Activities fallback:", error);
    return json([]);
  }
}

async function handleStats(db: D1Database): Promise<Response> {
  try {
    const leadsCount = await db.prepare("SELECT COUNT(*) as count FROM leads").first<{ count: number }>();
    const paidCount = await db.prepare("SELECT COUNT(*) as count FROM leads WHERE status='won_paid'").first<{ count: number }>();
    const revenueData = await db
      .prepare("SELECT SUM(amount_paid) as total_revenue FROM subscriptions WHERE payment_status='paid'")
      .first<{ total_revenue: number | null }>();

    const totalLeads = Number(leadsCount?.count || 0);
    const paidLeads = Number(paidCount?.count || 0);
    return json({
      totalLeads,
      conversionRate: totalLeads > 0 ? (paidLeads / totalLeads) * 100 : 0,
      totalRevenue: Number(revenueData?.total_revenue || 0),
      dailyUsage: await getDailyUsage(db),
    });
  } catch (error) {
    console.error("Stats fallback:", error);
    return json({
      totalLeads: 0,
      conversionRate: 0,
      totalRevenue: 0,
      dailyUsage: await getDailyUsage(db),
    });
  }
}

async function handleLeads(request: Request, db: D1Database, segments: string[]): Promise<Response> {
  if (request.method === "GET" && segments.length === 1) {
    const leads = await db.prepare("SELECT * FROM leads ORDER BY created_at DESC").all<LeadRow>();
    return json(leads.results || []);
  }

  if (request.method === "PUT" && segments.length === 3 && segments[2] === "status") {
    const id = segments[1];
    const body = await readJsonBody(request);
    const status = asString(body.status, "scraped");
    const staffId = asString(body.staffId, "system");

    const leadColumns = await tableColumns(db, "leads");
    const leadUpdates = [
      leadColumns.has("status") ? { column: "status", value: status } : null,
      leadColumns.has("updated_at") ? { column: "updated_at", value: new Date().toISOString() } : null,
    ].filter(Boolean) as Array<{ column: string; value: unknown }>;
    if (leadUpdates.length) {
      await db
        .prepare(`UPDATE leads SET ${leadUpdates.map((item) => `${item.column} = ?`).join(", ")} WHERE id = ?`)
        .bind(...leadUpdates.map((item) => item.value), id)
        .run();
    }
    await insertCrmActivitySafe(db, {
      id: crypto.randomUUID(),
      lead_id: id,
      staff_id: staffId,
      activity_type: "status_changed",
      description: `Status updated to ${status}`,
    });

    return json({ success: true });
  }

  if (request.method === "POST" && segments.length === 3 && segments[2] === "ping") {
    const businessId = segments[1];
    try {
      await db
        .prepare(
          `UPDATE leads
           SET view_count = COALESCE(view_count, 0) + 1,
               last_viewed_at = CURRENT_TIMESTAMP,
               status = CASE WHEN status = 'contacted' THEN 'viewed' ELSE status END
           WHERE business_id = ?`,
        )
        .bind(businessId)
        .run();
    } catch (error) {
      if (!isMissingColumnError(error)) throw error;
      await ensureColumn(db, "leads", "view_count", "INTEGER DEFAULT 0");
      await ensureColumn(db, "leads", "last_viewed_at", "DATETIME");
      await db
        .prepare("UPDATE leads SET status = CASE WHEN status = 'contacted' THEN 'viewed' ELSE status END WHERE business_id = ?")
        .bind(businessId)
        .run();
    }
    return json({ success: true });
  }

  return errorJson("Not Found", 404);
}

type ProspectDbRow = {
  place_id: string;
  query?: string;
  business_name: string;
  address?: string;
  phone?: string;
  website_url?: string;
  maps_url?: string;
  rating?: number;
  reviews?: number;
  niche?: string;
  status?: string;
  result_json?: string;
  details_json?: string;
  selected_photo_json?: string;
  selected_palette_json?: string;
  palette_options_json?: string;
  website_check_status?: string;
  website_checked_at?: string;
  generated_business_id?: string;
  last_error?: string;
  updated_at?: string;
  details_loaded_at?: string;
  generated_at?: string;
};

function prospectRowToPlace(row: ProspectDbRow, searchQueryOverride = "") {
  return {
    ...parseJsonObject(row.result_json),
    ...parseJsonObject(row.details_json),
    place_id: row.place_id,
    name: row.business_name,
    formatted_address: row.address,
    formatted_phone_number: row.phone,
    website: row.website_url,
    url: row.maps_url,
    rating: row.rating,
    user_ratings_total: row.reviews,
    types: row.niche ? [row.niche] : [],
    prospectStatus: row.status || "new",
    generatedBusinessId: row.generated_business_id || "",
    lastError: row.last_error || "",
    searchQuery: searchQueryOverride || row.query || "",
    selectedPhoto: parseJsonObject(row.selected_photo_json),
    selectedPalette: parseJsonArray(row.selected_palette_json),
    paletteOptions: parseJsonArray(row.palette_options_json),
    websiteCheckStatus: row.website_check_status || "",
    websiteCheckedAt: row.website_checked_at || "",
    updatedAt: row.updated_at,
    detailsLoadedAt: row.details_loaded_at,
    generatedAt: row.generated_at,
  };
}

function manualDuplicateNormalize(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b(llc|inc|corp|corporation|co|company|ltd|limited|services?|service|the)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function manualDuplicateUrlKey(value: unknown) {
  const text = String(value || "").trim();
  if (!text) return "";
  try {
    const parsed = new URL(text);
    const placeMatch = parsed.pathname.match(/\/maps\/place\/([^/@]+)/i);
    if (placeMatch?.[1]) return `url:${manualDuplicateNormalize(decodeURIComponent(placeMatch[1].replace(/\+/g, " ")))}`;
    return `url:${parsed.hostname}${parsed.pathname}`.toLowerCase();
  } catch {
    const match = text.match(/\/maps\/place\/([^/@?#]+)/i);
    return match?.[1] ? `url:${manualDuplicateNormalize(decodeURIComponent(match[1].replace(/\+/g, " ")))}` : "";
  }
}

function manualDuplicateKeys(row: ProspectDbRow) {
  const result = parseJsonObject(row.result_json);
  const details = parseJsonObject(row.details_json);
  const keys = new Set<string>();
  const nameKey = manualDuplicateNormalize(row.business_name || result.name || details.name);
  const addressKey = manualDuplicateNormalize(row.address || result.formatted_address || result.address || details.formatted_address);
  const cid = asString(result.googleMapsCid) || asString(result.cid);
  const urlKey = manualDuplicateUrlKey(row.maps_url || result.url || result.mapsUrl || result.googleMapsUri || result.manualSourceUrl);

  if (cid) keys.add(`cid:${cid}`);
  if (urlKey && !urlKey.endsWith("manual google maps listing")) keys.add(urlKey);
  if (nameKey.length >= 5 && !["manual google maps listing", "manual maps prospect"].includes(nameKey)) keys.add(`name:${nameKey}`);
  if (nameKey.length >= 5 && addressKey.length >= 8) keys.add(`name-address:${nameKey}|${addressKey}`);
  if (addressKey.length >= 12) keys.add(`address:${addressKey}`);
  return Array.from(keys);
}

function isManualProspectRow(row: ProspectDbRow) {
  const result = parseJsonObject(row.result_json);
  return row.place_id.startsWith("manual:") || Boolean(result.manualImport || result.manualSourceUrl || result.googleMapsCid);
}

function duplicateGroupReason(key: string) {
  if (key.startsWith("cid:")) return "Same Google Maps CID from manual capture.";
  if (key.startsWith("url:")) return "Same Google Maps place URL/name.";
  if (key.startsWith("name-address:")) return "Same normalized business name and address.";
  if (key.startsWith("address:")) return "Same normalized address.";
  return "Same normalized business name.";
}

function hasMergeValue(value: unknown) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value) && value !== 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
  return Boolean(value);
}

function mergeObjectsPreferringPresent(primary: Record<string, unknown>, secondary: Record<string, unknown>) {
  const merged = { ...secondary };
  for (const [key, value] of Object.entries(primary)) {
    if (hasMergeValue(value) || !hasMergeValue(merged[key])) {
      merged[key] = value;
    }
  }
  return merged;
}

async function handlePlacesManualDuplicateMerge(request: Request, db: D1Database): Promise<Response> {
  if (request.method !== "POST") return errorJson("Not Found", 404);
  const body = await readJsonBody(request);
  const keepPlaceId = asString(body.keepPlaceId).trim();
  const duplicatePlaceId = asString(body.duplicatePlaceId).trim();

  if (!keepPlaceId || !duplicatePlaceId) {
    return errorJson("Missing keepPlaceId or duplicatePlaceId", 400);
  }
  if (keepPlaceId === duplicatePlaceId) {
    return errorJson("Cannot merge a prospect into itself.", 400);
  }

  await ensureRequiredColumns(db, [...prospectDetailsRequiredColumns, ...prospectStatusRequiredColumns]);
  const keepRow = await db.prepare("SELECT * FROM places_prospects WHERE place_id = ?").bind(keepPlaceId).first<ProspectDbRow>();
  const duplicateRow = await db.prepare("SELECT * FROM places_prospects WHERE place_id = ?").bind(duplicatePlaceId).first<ProspectDbRow>();

  if (!keepRow) return errorJson("Keep prospect was not found.", 404);
  if (!duplicateRow) return errorJson("Duplicate prospect was not found.", 404);

  const copiedFields: string[] = [];
  const updates: Record<string, unknown> = {};
  const copyIfMissing = (column: keyof ProspectDbRow, label = String(column)) => {
    if (!hasMergeValue(keepRow[column]) && hasMergeValue(duplicateRow[column])) {
      updates[column] = duplicateRow[column];
      copiedFields.push(label);
    }
  };

  copyIfMissing("address");
  copyIfMissing("phone");
  copyIfMissing("website_url", "website");
  copyIfMissing("maps_url", "maps URL");
  copyIfMissing("rating");
  copyIfMissing("reviews");
  copyIfMissing("niche");
  copyIfMissing("website_check_status", "website status");
  copyIfMissing("website_checked_at", "website checked time");
  copyIfMissing("details_loaded_at", "details loaded time");

  const mergedResultJson = mergeObjectsPreferringPresent(parseJsonObject(keepRow.result_json), parseJsonObject(duplicateRow.result_json));
  const mergedDetailsJson = mergeObjectsPreferringPresent(parseJsonObject(keepRow.details_json), parseJsonObject(duplicateRow.details_json));
  if (hasMergeValue(mergedResultJson)) updates.result_json = JSON.stringify(mergedResultJson);
  if (hasMergeValue(mergedDetailsJson)) updates.details_json = JSON.stringify(mergedDetailsJson);

  if (Object.keys(updates).length > 0) {
    await updateProspectRecord(db, keepPlaceId, updates);
  }
  await updateProspectRecord(db, duplicatePlaceId, { status: "skipped" });

  const mergedRow = await db.prepare("SELECT * FROM places_prospects WHERE place_id = ?").bind(keepPlaceId).first<ProspectDbRow>();
  return json({
    success: true,
    copiedFields,
    skippedPlaceId: duplicatePlaceId,
    keepPlaceId,
    prospect: mergedRow ? prospectRowToPlace(mergedRow) : null,
  });
}

async function handlePlacesManualDuplicates(url: URL, db: D1Database): Promise<Response> {
  const limit = Math.max(50, Math.min(1000, Number(url.searchParams.get("limit") || 500)));
  await ensureRequiredColumns(db, prospectListRequiredColumns);
  const rows = await db
    .prepare(
      `SELECT *
       FROM places_prospects
       WHERE COALESCE(status, 'new') <> 'skipped'
       ORDER BY datetime(updated_at) DESC
       LIMIT ?`,
    )
    .bind(limit)
    .all<ProspectDbRow>();

  const allRows = rows.results || [];
  const rowMap = new Map(allRows.map((row) => [row.place_id, row]));
  const keyMap = new Map<string, Set<string>>();
  for (const row of allRows) {
    for (const key of manualDuplicateKeys(row)) {
      if (!keyMap.has(key)) keyMap.set(key, new Set());
      keyMap.get(key)?.add(row.place_id);
    }
  }

  const seenGroups = new Set<string>();
  const groups: Array<Record<string, unknown>> = [];
  for (const [key, ids] of keyMap.entries()) {
    if (ids.size < 2) continue;
    const groupRows = Array.from(ids).map((id) => rowMap.get(id)).filter((row): row is ProspectDbRow => Boolean(row));
    if (!groupRows.some(isManualProspectRow)) continue;
    const signature = groupRows.map((row) => row.place_id).sort().join("|");
    if (seenGroups.has(signature)) continue;
    seenGroups.add(signature);
    groups.push({
      id: manualShortHash(signature),
      key,
      reason: duplicateGroupReason(key),
      manualCount: groupRows.filter(isManualProspectRow).length,
      prospects: groupRows
        .sort((a, b) => {
          const aScore = (a.generated_business_id ? 4 : 0) + (a.details_loaded_at ? 2 : 0) + (a.website_url || a.phone || a.address ? 1 : 0);
          const bScore = (b.generated_business_id ? 4 : 0) + (b.details_loaded_at ? 2 : 0) + (b.website_url || b.phone || b.address ? 1 : 0);
          return bScore - aScore;
        })
        .map((row) => ({
          ...prospectRowToPlace(row),
          duplicateManualImport: isManualProspectRow(row),
        })),
    });
  }

  return json({
    success: true,
    count: groups.length,
    groups: groups.slice(0, 50),
  });
}

function summarizeSearchProspects(prospects: Array<Record<string, unknown>>) {
  return prospects.reduce((summary, prospect) => {
    const website = asString(prospect.website);
    const websiteStatus = asString(prospect.websiteCheckStatus);
    const status = asString(prospect.prospectStatus);
    summary.total += 1;
    if (website || websiteStatus === "has_website") summary.hasWebsite += 1;
    else if (websiteStatus === "no_website") summary.noWebsite += 1;
    else summary.websiteUnknown += 1;
    if (asString(prospect.detailsLoadedAt) || status === "details_loaded" || Array.isArray(prospect.reviews)) summary.detailsLoaded += 1;
    if (asString(prospect.generatedBusinessId) || status === "site_generated") summary.generated += 1;
    if (status === "skipped") summary.skipped += 1;
    if (asString(prospect.lastError)) summary.errors += 1;
    return summary;
  }, {
    total: 0,
    hasWebsite: 0,
    noWebsite: 0,
    websiteUnknown: 0,
    detailsLoaded: 0,
    generated: 0,
    skipped: 0,
    errors: 0,
  });
}

async function handlePlacesHistory(url: URL, db: D1Database): Promise<Response> {
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") || 25)));
  await ensureRequiredColumns(db, prospectListRequiredColumns);
  const historyRows = await db
    .prepare(
      `SELECT query_key, query, results_json, provider_status, result_count, hit_count, updated_at, expires_at
       FROM places_search_cache
       ORDER BY datetime(updated_at) DESC
       LIMIT ?`,
    )
    .bind(limit)
    .all<{
      query_key: string;
      query: string;
      results_json: string;
      provider_status?: string;
      result_count?: number;
      hit_count?: number;
      updated_at?: string;
      expires_at?: string;
    }>();

  const searches = (historyRows.results || []).map((row) => {
    const rawResults = parseJsonArray(row.results_json).filter((item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === "object" && !Array.isArray(item),
    );
    const placeIds = rawResults.map((place) => placeIdFromPlace(place)).filter(Boolean);
    return { row, rawResults, placeIds };
  });

  const uniquePlaceIds = Array.from(new Set(searches.flatMap((item) => item.placeIds)));
  const prospectMap = new Map<string, ReturnType<typeof prospectRowToPlace>>();
  for (let index = 0; index < uniquePlaceIds.length; index += 80) {
    const batch = uniquePlaceIds.slice(index, index + 80);
    if (batch.length === 0) continue;
    const prospectRows = await db
      .prepare(
        `SELECT p.*,
                l.business_id AS lead_business_id,
                l.status AS lead_status
         FROM places_prospects p
         LEFT JOIN leads l ON l.business_id = p.generated_business_id
         WHERE p.place_id IN (${batch.map(() => "?").join(", ")})`,
      )
      .bind(...batch)
      .all<ProspectDbRow>();

    for (const row of prospectRows.results || []) {
      prospectMap.set(row.place_id, prospectRowToPlace(row));
    }
  }

  return json(searches.map(({ row, rawResults }) => {
    const prospects = rawResults.map((rawPlace) => {
      const placeId = placeIdFromPlace(rawPlace);
      const stored = prospectMap.get(placeId);
      return {
        ...rawPlace,
        ...(stored || {}),
        place_id: placeId,
        searchQuery: row.query,
        searchHistoryQueryKey: row.query_key,
      };
    });
    return {
      queryKey: row.query_key,
      query: row.query,
      providerStatus: row.provider_status || "",
      resultCount: row.result_count ?? rawResults.length,
      hitCount: row.hit_count || 0,
      updatedAt: row.updated_at || "",
      expiresAt: row.expires_at || "",
      summary: summarizeSearchProspects(prospects),
      prospects,
    };
  }));
}

async function handleProspects(request: Request, db: D1Database, segments: string[], url: URL): Promise<Response> {
  if (request.method === "GET" && segments.length === 1) {
    const status = url.searchParams.get("status") || "";
    const website = url.searchParams.get("website") || "";
    const query = normalizeSearchQuery(url.searchParams.get("query") || "");
    const minRating = asNumber(url.searchParams.get("minRating"));
    const minReviews = asNumber(url.searchParams.get("minReviews"));
    const city = normalizeSearchQuery(url.searchParams.get("city") || "");
    const state = normalizeSearchQuery(url.searchParams.get("state") || "");
    const niche = normalizeSearchQuery(url.searchParams.get("niche") || "");
    await ensureRequiredColumns(db, prospectListRequiredColumns);
    const rows = await db
      .prepare(
        `SELECT p.*,
                l.business_id AS lead_business_id,
                l.status AS lead_status
         FROM places_prospects p
         LEFT JOIN leads l ON l.business_id = p.generated_business_id
         WHERE (? = '' OR p.status = ?)
           AND (? = ''
             OR (? = 'none' AND COALESCE(p.website_url, '') = '' AND COALESCE(p.website_check_status, '') = 'no_website')
             OR (? = 'unknown' AND COALESCE(p.website_url, '') = '' AND COALESCE(p.website_check_status, '') = '')
             OR (? = 'has' AND COALESCE(p.website_url, '') <> ''))
           AND (? = '' OR lower(p.business_name || ' ' || COALESCE(p.address, '') || ' ' || COALESCE(p.query, '')) LIKE '%' || ? || '%')
           AND (? IS NULL OR COALESCE(p.rating, 0) >= ?)
           AND (? IS NULL OR COALESCE(p.reviews, 0) >= ?)
           AND (? = '' OR lower(COALESCE(p.address, '')) LIKE '%' || ? || '%')
           AND (? = '' OR lower(COALESCE(p.address, '')) LIKE '%' || ? || '%')
           AND (? = '' OR lower(COALESCE(p.niche, '')) LIKE '%' || ? || '%')
         ORDER BY datetime(p.updated_at) DESC
         LIMIT 100`,
      )
      .bind(
        status,
        status,
        website,
        website,
        website,
        website,
        query,
        query,
        minRating,
        minRating,
        minReviews,
        minReviews,
        city,
        city,
        state,
        state,
        niche,
        niche,
      )
      .all<ProspectDbRow>();

    return json((rows.results || []).map((row) => prospectRowToPlace(row)));
  }

  if (request.method === "PUT" && segments.length === 3 && segments[2] === "status") {
    const placeId = decodeURIComponent(segments[1]);
    const body = await readJsonBody(request);
    const status = asString(body.status, "new");
    await ensureRequiredColumns(db, prospectStatusRequiredColumns);
    await updateProspectRecord(db, placeId, { status });
    return json({ success: true });
  }

  if (request.method === "PUT" && segments.length === 3 && segments[2] === "selection") {
    const placeId = decodeURIComponent(segments[1]);
    const body = await readJsonBody(request);
    const photo = body.photo && typeof body.photo === "object" ? body.photo : {};
    const palette = Array.isArray(body.palette) ? body.palette.filter((item) => typeof item === "string") : [];
    const paletteOptions = Array.isArray(body.paletteOptions) ? body.paletteOptions : [];
    await ensureRequiredColumns(db, selectionRequiredColumns);
    const updates: Record<string, unknown> = {};
    if ("photo" in body) updates.selected_photo_json = JSON.stringify(photo);
    if ("palette" in body) updates.selected_palette_json = JSON.stringify(palette);
    if ("paletteOptions" in body) updates.palette_options_json = JSON.stringify(paletteOptions);
    await updateProspectRecord(db, placeId, updates);
    return json({ success: true });
  }

  return errorJson("Not Found", 404);
}


const aiSiteGenerationDeps: AiSiteGenerationDeps = {
  getSetting: getSetting as AiSiteGenerationDeps["getSetting"],
  getAiReadiness: getAiReadiness as AiSiteGenerationDeps["getAiReadiness"],
  buildAiFailureDiagnostics,
  extractProviderErrorDetails,
  kieModelConfigs,
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
  generateAiOfferingOutline: (db, env, body, siteJson, originData, businessName) => generateAiOfferingOutline(aiSiteGenerationDeps, db, env, body, siteJson, originData, businessName),
  applyAiOfferingOutline,
  generateAiCopyPatch: (db, env, body, siteJsonOverride) => generateAiCopyPatch(aiSiteGenerationDeps, db, env, body, siteJsonOverride),
  applyAiCopyPatch,
  handleSites: handleSites as GenerationJobsDeps["handleSites"],
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

const placesDeps: PlacesDeps = {
  json,
  errorJson,
  readJsonBody,
  asString,
  parseJsonObject,
  tableColumns: tableColumns as PlacesDeps["tableColumns"],
  ensureRequiredColumns: ensureRequiredColumns as PlacesDeps["ensureRequiredColumns"],
  updateProspectRecord: updateProspectRecord as PlacesDeps["updateProspectRecord"],
  getSetting: getSetting as PlacesDeps["getSetting"],
  incrementDailyUsage: incrementDailyUsage as PlacesDeps["incrementDailyUsage"],
  isMissingColumnError,
  prospectListRequiredColumns,
  prospectWebsiteCheckRequiredColumns,
  prospectDetailsRequiredColumns,
};

async function handlePlacesPhoto(url: URL, db: D1Database, env: Env): Promise<Response> {
  const reference = url.searchParams.get("reference");
  const maxWidth = url.searchParams.get("maxwidth") || "320";
  const placesKey = await getSetting(db, env, "GOOGLE_PLACES_API_KEY");

  if (!reference) {
    return errorJson("Missing photo reference", 400);
  }

  if (!placesKey) {
    return errorJson("Google Places API key is not configured", 400);
  }

  const photoUrl = new URL("https://maps.googleapis.com/maps/api/place/photo");
  photoUrl.searchParams.set("maxwidth", maxWidth);
  photoUrl.searchParams.set("photo_reference", reference);
  photoUrl.searchParams.set("key", placesKey);

  const response = await fetch(photoUrl.toString(), { redirect: "follow" });
  if (!response.ok || !response.body) {
    return errorJson("Could not fetch Google Places photo", response.status || 500);
  }

  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", "*");
  headers.set("cache-control", "public, max-age=86400");
  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

async function handleSites(request: Request, db: D1Database, env: Env, segments: string[]): Promise<Response> {
  if (request.method === "GET" && segments.length === 1) {
    await ensureRequiredColumns(db, [
      { table: "json_sites", column: "r2_json_key", definition: "TEXT" },
      { table: "json_sites", column: "r2_json_url", definition: "TEXT" },
      { table: "json_sites", column: "json_summary", definition: "TEXT" },
      { table: "json_sites", column: "updated_at", definition: "DATETIME" },
    ]);
    const columns = await tableColumns(db, "json_sites");
    const selectedColumns = [
      columns.has("id") ? "id" : "",
      "business_id",
      "json_content",
      columns.has("r2_json_key") ? "r2_json_key" : "",
      columns.has("r2_json_url") ? "r2_json_url" : "",
      columns.has("json_summary") ? "json_summary" : "",
      columns.has("created_at") ? "created_at" : "",
      columns.has("updated_at") ? "updated_at" : "",
    ].filter(Boolean);

    const orderColumn = columns.has("updated_at") ? "updated_at" : columns.has("created_at") ? "created_at" : "business_id";
    const rows = await db
      .prepare(`SELECT ${selectedColumns.join(", ")} FROM json_sites ORDER BY ${orderColumn} DESC`)
      .all<{ id?: string; business_id: string; json_content: string; r2_json_key?: string; r2_json_url?: string; json_summary?: string; created_at?: string; updated_at?: string }>();

    return json((rows.results || []).map((row) => {
      let parsed: Record<string, unknown> = {};
      try {
        parsed = parseJsonObject(row.json_summary);
        if (!Object.keys(parsed).length) {
          const jsonContent = parseJsonObject(row.json_content);
          parsed = jsonContent.storageOnly === true && jsonContent.summary && typeof jsonContent.summary === "object"
            ? jsonContent.summary as Record<string, unknown>
            : jsonContent;
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
        r2JsonUrl: row.r2_json_url || "",
        storageMode: row.r2_json_key ? "r2" : "legacy_d1",
      };
    }));
  }

  if (request.method === "POST" && segments.length === 2 && segments[1] === "migrate-r2") {
    return migrateOldSiteJsonRowsToR2(siteStorageDeps, request, db, env);
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
    } else {
      try {
        const outlineResult = await generateAiOfferingOutline(aiSiteGenerationDeps, db, env, body, finalJson, originData, businessName);
        if (outlineResult) {
          const outlineApplyResult = applyAiOfferingOutline(finalJson, outlineResult.outline);
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
    const copyBrief = buildAiCopyTargetBrief(finalJson, originData, businessName);
    const copyAuditTargets = collectAiCopyAuditTargets(finalJson);
    jobMetadata.copyBriefHash = await sha256Json(copyBrief);
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
    await updateGenerationJob(db, jobId, { metadata_json: JSON.stringify(jobMetadata) });

    if (!skipAiCopyPatch) {
      try {
        const copyPatchResult = await generateAiCopyPatch(aiSiteGenerationDeps, db, env, body, finalJson);
        if (copyPatchResult) {
          applyAiCopyPatch(finalJson, copyPatchResult.patch);
          const copyAudit = buildAiCopyAudit(copyAuditTargets, finalJson, true);
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
    const designContext = [
      businessName,
      asString(originData.formatted_address, asString(originData.formattedAddress)),
      Array.isArray(originData.types) ? originData.types.join(" ") : "",
      asString(originData.searchQuery),
    ].filter(Boolean).join(" ");
    if (!allowedVisualStyles.includes(asString(designConfig.visualStyle))) {
      designConfig.visualStyle = visualStyleForBusiness(designContext);
    }
    if (!designConfig.visualStyleConfig || typeof designConfig.visualStyleConfig !== "object") {
      designConfig.visualStyleConfig = {
        label: asString(designConfig.visualStyle).replace(/-/g, " "),
        description: "Controls shape language, image treatment, borders, and visual edge style on top of the industry preset.",
        allowedValues: allowedVisualStyles,
        selectionRule: "Use the visual structure that best matches the business niche and desired feel.",
      };
    }
    const shaderMeta = shaderPresetForBusiness(designContext);
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
    const fontPairingMeta = fontPairingForBusiness(designContext);
    if (!asString(designConfig.fontPairing)) {
      designConfig.fontPairing = fontPairingMeta.id;
    }
    if (!designConfig.fontPairingConfig || typeof designConfig.fontPairingConfig !== "object") {
      designConfig.fontPairingConfig = {
        label: fontPairingMeta.label,
        headingFont: fontPairingMeta.headingFont,
        bodyFont: fontPairingMeta.bodyFont,
        mood: fontPairingMeta.mood,
        allowedValues: fontPairingMeta.allowedValues,
        selectionRule: "Choose an industry-matched Google Font pairing; owners can switch among these matching options before download.",
      };
    }
    const themeVariables = designConfig.themeVariables && typeof designConfig.themeVariables === "object" ? designConfig.themeVariables as Record<string, unknown> : {};
    const typography = themeVariables.typography && typeof themeVariables.typography === "object" ? themeVariables.typography as Record<string, unknown> : {};
    typography.headingFont = typography.headingFont || fontPairingMeta.headingCss;
    typography.bodyFont = typography.bodyFont || fontPairingMeta.bodyCss;
    themeVariables.typography = typography;
    designConfig.themeVariables = themeVariables;
    finalJson.design = designConfig;

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
    ].filter(Boolean);
    const row = await db
      .prepare(`SELECT ${selectedColumns.join(", ")} FROM json_sites WHERE business_id = ?`)
      .bind(businessId)
      .first<{ business_id: string; json_content: string; r2_json_key?: string }>();
    if (!row?.json_content) {
      return errorJson("Site not found", 404);
    }
    try {
      return json(await readSiteJsonFromStorage(siteStorageDeps, row, env));
    } catch (error) {
      return errorJson(error instanceof Error ? error.message : String(error), 502);
    }
  }

  return errorJson("Not Found", 404);
}

async function handlePayments(request: Request, db: D1Database, env: Env, segments: string[]): Promise<Response> {
  if (request.method !== "POST" || segments[1] !== "checkout") {
    return errorJson("Not Found", 404);
  }

  const body = await readJsonBody(request);
  const businessId = normalizeBusinessId(asString(body.businessId, "demo-site"));
  const businessName = asString(body.businessName, "Demo Site");
  const requestedDomain = asString(body.domain);
  const domainMode = asString(body.domainMode, "new") === "owned" ? "owned" : "new";
  const customerEmail = asString(body.email);
  const origin = new URL(request.url).origin;
  const [
    selectedProcessorRaw,
    adminWhatsAppSetting,
    paymentAmountUsdSetting,
    usdToIdrRateSetting,
    packageNameSetting,
    packageDescriptionSetting,
    xenditSecretKey,
    midtransServerKey,
    midtransProductionSetting,
    dokuClientId,
    dokuSecretKey,
    dokuProductionSetting,
    paypalBusinessUrl,
    wisePaymentUrl,
    payoneerPaymentUrl,
    lemonApiKey,
    lemonStoreId,
    lemonVariantId,
  ] = await Promise.all([
    getSetting(db, env, "PAYMENT_PROCESSOR"),
    getSetting(db, env, "ADMIN_WHATSAPP_NUMBER"),
    getSetting(db, env, "PAYMENT_USD_AMOUNT"),
    getSetting(db, env, "PAYMENT_USD_TO_IDR_RATE"),
    getSetting(db, env, "PAYMENT_PACKAGE_NAME"),
    getSetting(db, env, "PAYMENT_PACKAGE_DESCRIPTION"),
    getSetting(db, env, "XENDIT_SECRET_KEY"),
    getSetting(db, env, "MIDTRANS_SERVER_KEY"),
    getSetting(db, env, "MIDTRANS_IS_PRODUCTION"),
    getSetting(db, env, "DOKU_CLIENT_ID"),
    getSetting(db, env, "DOKU_SECRET_KEY"),
    getSetting(db, env, "DOKU_IS_PRODUCTION"),
    getSetting(db, env, "PAYPAL_BUSINESS_URL"),
    getSetting(db, env, "WISE_PAYMENT_URL"),
    getSetting(db, env, "PAYONEER_PAYMENT_URL"),
    getSetting(db, env, "LEMON_SQUEEZY_API_KEY"),
    getSetting(db, env, "LEMON_SQUEEZY_STORE_ID"),
    getSetting(db, env, "LEMON_SQUEEZY_VARIANT_ID"),
  ]);
  const selectedProcessor = asString(selectedProcessorRaw, "mock").toLowerCase();
  const paymentProcessor = ["xendit", "midtrans", "doku", "paypal", "wise", "payoneer", "lemon_squeezy_legacy"].includes(selectedProcessor)
    ? selectedProcessor
    : "mock";
  const paymentAmountUsd = Math.max(1, Number(paymentAmountUsdSetting || 197) || 197);
  const usdToIdrRate = Math.max(1, Number(usdToIdrRateSetting || 16000) || 16000);
  const amountIdr = Math.max(1000, Math.round(paymentAmountUsd * usdToIdrRate));
  const amountCents = Math.round(paymentAmountUsd * 100);
  const packageName = packageNameSetting || "WebView.click Done-for-you Website Setup";
  const packageDescription = packageDescriptionSetting || `$${paymentAmountUsd} total: domain/hosting coordination and done-for-you website setup.`;
  const adminWhatsApp = adminWhatsAppSetting || "081233838173";
  const orderId = `wv-${Date.now()}-${businessId}`.replace(/[^a-zA-Z0-9._~-]+/g, "-").slice(0, 50);

  const notifyText = encodeURIComponent(
    `WebView.click checkout request\nBusiness: ${businessName}\nDomain: ${requestedDomain || "-"}\nDomain mode: ${domainMode === "owned" ? "customer-owned domain" : "new domain registration"}\nProcessor: ${paymentProcessor}\nPackage: $${paymentAmountUsd} done-for-you website setup`,
  );
  const adminNotifyUrl = `https://wa.me/${normalizeWhatsAppNumber(adminWhatsApp)}?text=${notifyText}`;

  await ensureRequiredColumns(db, checkoutRequiredColumns);

  const leadId = crypto.randomUUID();
  await upsertLeadRecord(db, {
    id: leadId,
    business_id: businessId,
    business_name: businessName,
    niche: "demo",
    email: customerEmail,
    status: "checkout_pending",
    view_count: 0,
    updated_at: new Date().toISOString(),
  });

  const row = await db.prepare("SELECT id FROM leads WHERE business_id = ?").bind(businessId).first<{ id: string }>();
  if (row?.id) {
    await insertCrmActivitySafe(db, {
      id: crypto.randomUUID(),
      lead_id: row.id,
      staff_id: "system",
      activity_type: "checkout_pending",
      description: `Payment processor: ${paymentProcessor}. Domain request: ${requestedDomain || "not provided"} (${domainMode}). Amount: $${paymentAmountUsd} / approx IDR ${amountIdr}. Admin WA: ${adminNotifyUrl}`,
    });
  }

  const mockResponse = (message: string, missing: string[] = []) => json({
    success: true,
    mock: true,
    processor: paymentProcessor,
    checkoutUrl: "",
    adminNotifyUrl,
    amountUsd: paymentAmountUsd,
    amountIdr,
    missing,
    message,
  });

  if (paymentProcessor === "xendit") {
    if (!xenditSecretKey) {
      return mockResponse("Xendit belum dikonfigurasi. Checkout disimpan sebagai mock checkout_pending.", ["XENDIT_SECRET_KEY"]);
    }
    const response = await fetch("https://api.xendit.co/v2/invoices", {
      method: "POST",
      headers: {
        authorization: `Basic ${btoa(`${xenditSecretKey}:`)}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        external_id: orderId,
        amount: amountIdr,
        description: `${packageName} for ${businessName}`,
        payer_email: customerEmail || undefined,
        invoice_duration: 86400,
        success_redirect_url: `${origin}/admin/leads`,
        failure_redirect_url: `${origin}/admin/leads`,
        currency: "IDR",
        items: [{ name: packageName, quantity: 1, price: amountIdr, category: "services" }],
        metadata: { businessId, businessName, requestedDomain, domainMode, amountUsd: paymentAmountUsd },
      }),
    });
    const data = await response.json().catch(() => ({})) as { invoice_url?: string; error_code?: string; message?: string };
    if (!response.ok || !data.invoice_url) {
      return json({
        success: false,
        mock: true,
        processor: paymentProcessor,
        checkoutUrl: "",
        adminNotifyUrl,
        error: data.message || data.error_code || `Xendit returned HTTP ${response.status}`,
        message: "Xendit checkout belum berhasil dibuat. Request tetap dicatat sebagai checkout_pending.",
      }, 502);
    }
    return json({
      success: true,
      mock: false,
      processor: paymentProcessor,
      checkoutUrl: data.invoice_url,
      adminNotifyUrl,
      amountUsd: paymentAmountUsd,
      amountIdr,
    });
  }

  if (paymentProcessor === "midtrans") {
    if (!midtransServerKey) {
      return mockResponse("Midtrans belum dikonfigurasi. Checkout disimpan sebagai mock checkout_pending.", ["MIDTRANS_SERVER_KEY"]);
    }
    const isProduction = midtransProductionSetting === "true";
    const endpoint = isProduction
      ? "https://app.midtrans.com/snap/v1/transactions"
      : "https://app.sandbox.midtrans.com/snap/v1/transactions";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        authorization: `Basic ${btoa(`${midtransServerKey}:`)}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        transaction_details: { order_id: orderId, gross_amount: amountIdr },
        item_details: [{ id: "webview-setup", price: amountIdr, quantity: 1, name: packageName.slice(0, 50) }],
        customer_details: { first_name: businessName.slice(0, 30), email: customerEmail || undefined },
        credit_card: { secure: true },
        custom_field1: businessId,
        custom_field2: requestedDomain,
        custom_field3: domainMode,
      }),
    });
    const data = await response.json().catch(() => ({})) as { redirect_url?: string; token?: string; error_messages?: unknown };
    if (!response.ok || !data.redirect_url) {
      return json({
        success: false,
        mock: true,
        processor: paymentProcessor,
        checkoutUrl: "",
        adminNotifyUrl,
        error: data.error_messages || `Midtrans returned HTTP ${response.status}`,
        message: "Midtrans checkout belum berhasil dibuat. Request tetap dicatat sebagai checkout_pending.",
      }, 502);
    }
    return json({
      success: true,
      mock: false,
      processor: paymentProcessor,
      checkoutUrl: data.redirect_url,
      adminNotifyUrl,
      amountUsd: paymentAmountUsd,
      amountIdr,
    });
  }

  if (paymentProcessor === "doku") {
    if (!dokuClientId || !dokuSecretKey) {
      return mockResponse("DOKU belum dikonfigurasi. Checkout disimpan sebagai mock checkout_pending.", ["DOKU_CLIENT_ID", "DOKU_SECRET_KEY"]);
    }
    const isProduction = dokuProductionSetting === "true";
    const requestTarget = "/checkout/v1/payment";
    const endpoint = isProduction
      ? `https://api.doku.com${requestTarget}`
      : `https://api-sandbox.doku.com${requestTarget}`;
    const requestId = crypto.randomUUID();
    const requestTimestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    const dokuBody = {
      order: {
        amount: amountIdr,
        invoice_number: orderId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 30),
        currency: "IDR",
        callback_url: `${origin}/admin/leads`,
        callback_url_result: `${origin}/admin/leads`,
        language: "EN",
        auto_redirect: true,
        line_items: [{ id: "webviewsetup", name: packageName.slice(0, 80), quantity: 1, price: amountIdr, category: "services" }],
      },
      payment: { payment_due_date: 1440, type: "SALE" },
      customer: {
        id: businessId.slice(0, 50),
        name: businessName.slice(0, 80),
        email: customerEmail || undefined,
        country: "US",
      },
    };
    const bodyText = JSON.stringify(dokuBody);
    const digest = await sha256Base64(bodyText);
    const signaturePayload = [
      `Client-Id:${dokuClientId}`,
      `Request-Id:${requestId}`,
      `Request-Timestamp:${requestTimestamp}`,
      `Request-Target:${requestTarget}`,
      `Digest:${digest}`,
    ].join("\n");
    const signature = `HMACSHA256=${await hmacSha256Base64(dokuSecretKey, signaturePayload)}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Client-Id": dokuClientId,
        "Request-Id": requestId,
        "Request-Timestamp": requestTimestamp,
        Signature: signature,
        "content-type": "application/json",
      },
      body: bodyText,
    });
    const data = await response.json().catch(() => ({})) as { response?: { payment?: { url?: string } }; error_messages?: unknown; message?: unknown };
    const checkoutUrl = data.response?.payment?.url || "";
    if (!response.ok || !checkoutUrl) {
      return json({
        success: false,
        mock: true,
        processor: paymentProcessor,
        checkoutUrl: "",
        adminNotifyUrl,
        error: data.error_messages || data.message || `DOKU returned HTTP ${response.status}`,
        message: "DOKU checkout belum berhasil dibuat. Request tetap dicatat sebagai checkout_pending.",
      }, 502);
    }
    return json({
      success: true,
      mock: false,
      processor: paymentProcessor,
      checkoutUrl,
      adminNotifyUrl,
      amountUsd: paymentAmountUsd,
      amountIdr,
    });
  }

  if (paymentProcessor === "paypal") {
    if (!paypalBusinessUrl) return mockResponse("PayPal Business link belum dikonfigurasi. Checkout disimpan sebagai mock checkout_pending.", ["PAYPAL_BUSINESS_URL"]);
    return json({ success: true, mock: false, processor: paymentProcessor, checkoutUrl: paypalBusinessUrl, adminNotifyUrl, amountUsd: paymentAmountUsd, amountIdr });
  }

  if (paymentProcessor === "wise") {
    if (!wisePaymentUrl) return mockResponse("Wise payment/request link belum dikonfigurasi. Checkout disimpan sebagai mock checkout_pending.", ["WISE_PAYMENT_URL"]);
    return json({ success: true, mock: false, processor: paymentProcessor, checkoutUrl: wisePaymentUrl, adminNotifyUrl, amountUsd: paymentAmountUsd, amountIdr });
  }

  if (paymentProcessor === "payoneer") {
    if (!payoneerPaymentUrl) return mockResponse("Payoneer payment request link belum dikonfigurasi. Checkout disimpan sebagai mock checkout_pending.", ["PAYONEER_PAYMENT_URL"]);
    return json({ success: true, mock: false, processor: paymentProcessor, checkoutUrl: payoneerPaymentUrl, adminNotifyUrl, amountUsd: paymentAmountUsd, amountIdr });
  }

  if (paymentProcessor === "lemon_squeezy_legacy") {
    if (!lemonApiKey || !lemonStoreId || !lemonVariantId) {
      return mockResponse("Legacy Lemon Squeezy belum lengkap. Checkout disimpan sebagai mock checkout_pending.", ["LEMON_SQUEEZY_API_KEY", "LEMON_SQUEEZY_STORE_ID", "LEMON_SQUEEZY_VARIANT_ID"]);
    }
    const checkoutResponse = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
      method: "POST",
      headers: {
        accept: "application/vnd.api+json",
        authorization: `Bearer ${lemonApiKey}`,
        "content-type": "application/vnd.api+json",
      },
      body: JSON.stringify({
        data: {
          type: "checkouts",
          attributes: {
            custom_price: amountCents,
            product_options: {
              name: packageName,
              description: packageDescription,
              redirect_url: `${origin}/admin/leads`,
            },
            checkout_data: {
              email: customerEmail || undefined,
              custom: {
                business_id: businessId,
                business_name: businessName,
                requested_domain: requestedDomain,
                domain_mode: domainMode,
                admin_whatsapp: adminWhatsApp,
              },
            },
          },
          relationships: {
            store: { data: { type: "stores", id: lemonStoreId } },
            variant: { data: { type: "variants", id: lemonVariantId } },
          },
        },
      }),
    });

    const checkoutData = await checkoutResponse.json() as { data?: { attributes?: { url?: string } }; errors?: unknown };
    if (!checkoutResponse.ok || !checkoutData.data?.attributes?.url) {
      return json({
        success: false,
        mock: true,
        processor: paymentProcessor,
        checkoutUrl: "",
        adminNotifyUrl,
        error: checkoutData.errors || `Lemon Squeezy returned HTTP ${checkoutResponse.status}`,
        message: "Legacy Lemon checkout belum berhasil dibuat. Request tetap dicatat sebagai checkout_pending.",
      }, 502);
    }

    return json({
      success: true,
      mock: false,
      processor: paymentProcessor,
      checkoutUrl: checkoutData.data.attributes.url,
      adminNotifyUrl,
      amountUsd: paymentAmountUsd,
      amountIdr,
    });
  }

  return mockResponse("Payment processor belum dipilih atau masih mock. Checkout disimpan sebagai checkout_pending.");
}

function normalizeDomainInput(value: string) {
  return value
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .replace(/[^a-z0-9.-]+/g, "")
    .replace(/^\.+|\.+$/g, "");
}

async function checkDomainViaRdapNet(domain: string) {
  const response = await fetch(`https://rdap.net/domain/${encodeURIComponent(domain)}`, {
    headers: { accept: "application/rdap+json, application/json" },
  });

  if (response.status === 404) {
    return {
      provider: "rdap.net",
      status: "candidate_available",
      available: true,
      message: `${domain} looks available from RDAP. Final availability is confirmed during registrar purchase.`,
    };
  }

  if (response.status === 200) {
    const data = await response.json() as {
      entities?: Array<{
        roles?: string[];
        vcardArray?: [string, unknown[]];
      }>;
      nameservers?: Array<{ ldhName?: string; unicodeName?: string }>;
      links?: Array<{ rel?: string; href?: string }>;
    };
    const registrarEntity = Array.isArray(data.entities)
      ? data.entities.find((entity) => Array.isArray(entity.roles) && entity.roles.includes("registrar"))
      : undefined;
    const registrarVcardEntry = Array.isArray(registrarEntity?.vcardArray?.[1])
      ? (registrarEntity.vcardArray[1] as unknown[]).find((entry) => Array.isArray(entry) && entry[0] === "fn")
      : undefined;
    const registrar = Array.isArray(registrarVcardEntry) && typeof registrarVcardEntry[3] === "string"
      ? registrarVcardEntry[3]
      : undefined;
    const nameservers = Array.isArray(data.nameservers)
      ? data.nameservers
          .map((nameserver) => nameserver.ldhName || nameserver.unicodeName)
          .filter((nameserver): nameserver is string => Boolean(nameserver))
      : [];
    const rdapUrl = Array.isArray(data.links)
      ? data.links.find((link) => link.rel === "self")?.href
      : undefined;

    return {
      provider: "rdap.net",
      status: "registered",
      available: false,
      message: `${domain} appears to be registered.`,
      registrar: typeof registrar === "string" ? registrar : undefined,
      nameservers,
      rdapUrl,
    };
  }

  return {
    provider: "rdap.net",
    status: "inconclusive",
    available: null,
    message: `RDAP returned HTTP ${response.status}. Try another extension or check again later.`,
  };
}

async function checkDomainViaGoogleDns(domain: string) {
  const response = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=SOA`, {
    headers: { accept: "application/json" },
  });
  const data = await response.json() as { Status?: number; Answer?: unknown[] };

  if (data.Status === 0 && Array.isArray(data.Answer) && data.Answer.length > 0) {
    return {
      provider: "Google Public DNS",
      status: "dns_exists",
      available: false,
      message: `${domain} has DNS records and is likely already in use.`,
    };
  }

  return {
    provider: "Google Public DNS",
    status: "dns_no_soa",
    available: null,
    message: `${domain} has no SOA answer. This is not enough to confirm availability, but it is a useful fallback signal.`,
  };
}

async function handleDomains(url: URL, segments: string[]): Promise<Response> {
  if (segments[1] !== "check") {
    return errorJson("Not Found", 404);
  }

  const domain = normalizeDomainInput(url.searchParams.get("domain") || "");
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.[a-z0-9.-]{2,}$/.test(domain)) {
    return errorJson("Invalid domain format", 400);
  }

  try {
    const rdap = await checkDomainViaRdapNet(domain);
    if (rdap.available !== null) return json(rdap);
    const dns = await checkDomainViaGoogleDns(domain);
    return json({
      ...rdap,
      fallback: dns,
      message: `${rdap.message} Fallback DNS signal: ${dns.message}`,
    });
  } catch (error) {
    console.error("Domain check failed:", error);
    try {
      return json(await checkDomainViaGoogleDns(domain));
    } catch (fallbackError) {
      console.error("Domain fallback check failed:", fallbackError);
      return json({
        provider: "domain-check-fallback",
        status: "inconclusive",
        available: null,
        message: "Domain availability check is temporarily unavailable. We can still confirm it during setup.",
      });
    }
  }
}

async function route(context: PagesContext): Promise<Response> {
  const { request, env } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(request.url);
  const segments = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);

  try {
    const db = getDb(env);
    try {
      await setupTables(db);
    } catch (setupError) {
      console.error("DB setup fallback:", setupError);
    }

    if (segments.length === 0) {
      return json({ ok: true, service: "webview-click-api" });
    }

    if (segments[0] === "settings") {
      return handleSettings(request, db);
    }

    if (request.method === "GET" && segments[0] === "public-settings") {
      return handlePublicSettings(db);
    }

    if (request.method === "GET" && segments[0] === "schema") {
      return json(templateSchema);
    }

    if (request.method === "POST" && segments[0] === "schema" && segments[1] === "repair") {
      return json(await databaseRepairReport(db));
    }

    if (request.method === "GET" && segments[0] === "activities") {
      return handleActivities(db);
    }

    if (request.method === "GET" && segments[0] === "stats") {
      return handleStats(db);
    }

    if (segments[0] === "leads") {
      return handleLeads(request, db, segments);
    }

    if (segments[0] === "prospects") {
      return handleProspects(request, db, segments, url);
    }

    if (segments[0] === "generation-jobs") {
      return handleGenerationJobs(generationJobsDeps, request, db, env, segments);
    }

    if (segments[0] === "ai" && segments[1] === "readiness") {
      return handleAiReadiness(request, db, env);
    }

    if (segments[0] === "ai" && segments[1] === "provider-failure") {
      return handleAiProviderFailure(request, db);
    }

    if (segments[0] === "ai" && segments[1] === "provider-health") {
      return handleAiProviderHealth(request, db);
    }

    if (segments[0] === "provider-cooldowns") {
      return handleProviderCooldowns(request, db, url, segments);
    }

    if (request.method === "GET" && segments[0] === "places" && segments[1] === "photo") {
      return handlePlacesPhoto(url, db, env);
    }

    if (request.method === "GET" && segments[0] === "places" && segments[1] === "details") {
      return handlePlacesDetails(placesDeps, url, db, env);
    }

    if (segments[0] === "places" && segments[1] === "cache") {
      return handlePlacesCache(placesDeps, request, db, segments);
    }

    if (request.method === "GET" && segments[0] === "places" && segments[1] === "history") {
      return handlePlacesHistory(url, db);
    }

    if (request.method === "GET" && segments[0] === "places" && segments[1] === "manual-duplicates") {
      return handlePlacesManualDuplicates(url, db);
    }

    if (request.method === "POST" && segments[0] === "places" && segments[1] === "manual-duplicates" && segments[2] === "merge") {
      return handlePlacesManualDuplicateMerge(request, db);
    }

    if (segments[0] === "places" && segments[1] === "manual-import") {
      return handlePlacesManualImport(placesDeps, request, db);
    }

    if (request.method === "GET" && segments[0] === "places" && segments[1] === "search") {
      return handlePlacesSearch(placesDeps, url, db, env);
    }

    if (segments[0] === "sites") {
      return handleSites(request, db, env, segments);
    }

    if (segments[0] === "payments") {
      return handlePayments(request, db, env, segments);
    }

    if (request.method === "GET" && segments[0] === "domains") {
      return handleDomains(url, segments);
    }

    return errorJson("Not Found", 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("API error:", error);
    return errorJson(message, 500);
  }
}

export const onRequest = route;

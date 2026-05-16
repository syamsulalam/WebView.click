import templateSchema from "../../JSON/template-schema.json";

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
  const tables = ["leads", "subscriptions", "crm_activities", "json_sites", "system_settings", "places_search_cache", "places_prospects", "generation_jobs"];
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

function normalizeSearchQuery(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
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

function asNumber(value: unknown): number | null {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function placeString(place: Record<string, unknown>, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = place[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return fallback;
}

function placeArray(place: Record<string, unknown>, key: string) {
  const value = place[key];
  return Array.isArray(value) ? value : [];
}

function placeIdFromPlace(place: Record<string, unknown>) {
  const explicitId = placeString(place, ["place_id", "id"]);
  if (explicitId) return explicitId;
  return normalizeBusinessId(`${placeString(place, ["name"], "unknown")}-${placeString(place, ["formatted_address", "formattedAddress", "vicinity"])}`);
}

function prospectFromPlace(place: Record<string, unknown>, fallbackQuery = "", fallbackQueryKey = "") {
  const placeId = placeIdFromPlace(place);
  const types = placeArray(place, "types");
  const rating = asNumber(place.rating);
  const reviews = asNumber(place.user_ratings_total) ?? asNumber(place.userRatingCount);
  return {
    placeId,
    queryKey: fallbackQueryKey,
    query: fallbackQuery,
    businessName: placeString(place, ["name"], "Untitled Business"),
    address: placeString(place, ["formatted_address", "formattedAddress", "vicinity"]),
    phone: placeString(place, ["formatted_phone_number", "international_phone_number", "nationalPhoneNumber"]),
    websiteUrl: placeString(place, ["website", "websiteUri"]),
    mapsUrl: placeString(place, ["url", "googleMapsUri"]),
    rating,
    reviews,
    niche: typeof types[0] === "string" ? types[0] : "general",
  };
}

async function upsertProspectsFromPlaces(db: D1Database, queryKey: string, query: string, results: unknown[]) {
  const columns = await tableColumns(db, "places_prospects");
  const statements = results
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    .map((place) => {
      const prospect = prospectFromPlace(place, query, queryKey);
      const values: Record<string, unknown> = {
        place_id: prospect.placeId,
        query_key: prospect.queryKey,
        query: prospect.query,
        business_name: prospect.businessName,
        address: prospect.address,
        phone: ("formatted_phone_number" in place || "international_phone_number" in place || "nationalPhoneNumber" in place) ? prospect.phone : undefined,
        website_url: ("website" in place || "websiteUri" in place) ? prospect.websiteUrl : undefined,
        maps_url: ("url" in place || "googleMapsUri" in place) ? prospect.mapsUrl : undefined,
        website_check_status: "websiteCheckStatus" in place ? placeString(place, ["websiteCheckStatus"]) : undefined,
        website_checked_at: "websiteCheckedAt" in place ? placeString(place, ["websiteCheckedAt"]) : undefined,
        rating: prospect.rating,
        reviews: prospect.reviews,
        niche: prospect.niche,
        status: "new",
        result_json: JSON.stringify(place),
        updated_at: new Date().toISOString(),
      };
      const entries = Object.entries(values).filter(([column]) => columns.has(column));
      const updateColumns = entries.map(([column]) => column).filter((column) => !["place_id", "status"].includes(column));
      const updateClause = updateColumns.length
        ? updateColumns.map((column) => `${column} = excluded.${column}`).join(", ")
        : "place_id = excluded.place_id";
      return db
        .prepare(
          `INSERT INTO places_prospects (${entries.map(([column]) => column).join(", ")})
           VALUES (${entries.map(() => "?").join(", ")})
           ON CONFLICT(place_id) DO UPDATE SET ${updateClause}`,
        )
        .bind(...entries.map(([, value]) => value));
    });

  if (statements.length) {
    await db.batch(statements);
  }
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

function extensionFromContentType(contentType: string | null) {
  if (!contentType) return "bin";
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("svg")) return "svg";
  if (contentType.includes("gif")) return "gif";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  return "bin";
}

function publicR2Url(env: Env, key: string) {
  const configuredBaseUrl = typeof env.R2_PUBLIC_BASE_URL === "string" ? env.R2_PUBLIC_BASE_URL : "";
  const baseUrl = (configuredBaseUrl || "https://assets.webview.click").replace(/\/$/, "");
  return `${baseUrl}/${key}`;
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
    });
  } catch (error) {
    console.error("Stats fallback:", error);
    return json({
      totalLeads: 0,
      conversionRate: 0,
      totalRevenue: 0,
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

async function handlePlacesSearch(url: URL, db: D1Database, env: Env): Promise<Response> {
  const query = (url.searchParams.get("query") || "").trim();
  const queryKey = normalizeSearchQuery(query);
  const refresh = url.searchParams.get("refresh") === "1";
  const websitePrecheck = url.searchParams.get("websitePrecheck") === "1";
  const precheckLimit = Math.max(0, Math.min(20, Number(url.searchParams.get("precheckLimit") || 10)));
  const placesKey = await getSetting(db, env, "GOOGLE_PLACES_API_KEY");

  if (!queryKey) {
    return errorJson("Missing query", 400);
  }

  if (!refresh) {
    let cached: { query: string; results_json: string; provider_status?: string; result_count?: number; updated_at?: string; expires_at?: string } | null = null;
    try {
      cached = await db
        .prepare(
          `SELECT query, results_json, provider_status, result_count, updated_at, expires_at
           FROM places_search_cache
           WHERE query_key = ? AND (expires_at IS NULL OR datetime(expires_at) > datetime('now'))`,
        )
        .bind(queryKey)
        .first<{ query: string; results_json: string; provider_status?: string; result_count?: number; updated_at?: string; expires_at?: string }>();
    } catch (error) {
      if (!isMissingColumnError(error)) throw error;
      cached = await db
        .prepare("SELECT query, results_json FROM places_search_cache WHERE query_key = ?")
        .bind(queryKey)
        .first<{ query: string; results_json: string }>();
    }

    if (cached?.results_json) {
      try {
        await db
          .prepare("UPDATE places_search_cache SET hit_count = COALESCE(hit_count, 0) + 1, updated_at = CURRENT_TIMESTAMP WHERE query_key = ?")
          .bind(queryKey)
          .run();
      } catch (error) {
        if (!isMissingColumnError(error)) throw error;
      }

      let cachedResults = JSON.parse(cached.results_json);
      if (websitePrecheck && placesKey && Array.isArray(cachedResults)) {
        cachedResults = await precheckWebsiteForPlaces(db, placesKey, cachedResults, precheckLimit);
      }

      return json({
        cached: true,
        status: cached.provider_status || "CACHE_HIT",
        queryKey,
        query: cached.query,
        resultCount: cached.result_count || 0,
        updatedAt: cached.updated_at,
        expiresAt: cached.expires_at,
        websitePrecheck,
        results: cachedResults,
      });
    }
  }

  const mockResult = {
    place_id: "mock-place",
    name: `Kedai Kopi Senja ${query}`,
    formatted_address: "Jl. Sudirman No 123",
    rating: 4.8,
    user_ratings_total: 120,
    business_status: "OPERATIONAL",
    websiteCheckStatus: "no_website",
    websiteCheckedAt: new Date().toISOString(),
  };

  if (!placesKey || placesKey.length < 10) {
    await upsertProspectsFromPlaces(db, queryKey, query, [mockResult]);
    return json({
      mock: true,
      status: "MOCK_NO_API_KEY",
      queryKey,
      query,
      results: [mockResult],
    });
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${encodeURIComponent(placesKey)}`,
    );
    const data = await response.json() as { status?: string; results?: unknown[]; error_message?: string };

    if (!response.ok) {
      return json({
        status: "GOOGLE_HTTP_ERROR",
        error: data.error_message || `Google Places returned HTTP ${response.status}`,
        results: [],
      });
    }

    if (data.status && data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      const refererRestriction = data.error_message?.toLowerCase().includes("referer restrictions");
      return json({
        status: data.status,
        error: data.error_message || `Google Places status: ${data.status}`,
        hint: refererRestriction
          ? "Google Places key ini dipakai dari Cloudflare Pages Function/server-side, jadi tidak boleh memakai HTTP referrer restriction. Buat server key terpisah: Application restrictions = None, API restrictions = Places API, lalu simpan di /admin/settings sebagai GOOGLE_PLACES_API_KEY."
          : "Cek Google Cloud Console: pastikan billing aktif, Places API yang sesuai aktif, dan API key disimpan sebagai GOOGLE_PLACES_API_KEY.",
        results: [],
      });
    }

    const rawResults = Array.isArray(data.results) ? data.results : [];
    const results = websitePrecheck ? await precheckWebsiteForPlaces(db, placesKey, rawResults, precheckLimit) : rawResults;
    await upsertProspectsFromPlaces(db, queryKey, query, results);
    const cacheExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    try {
      await db
        .prepare(
          `INSERT INTO places_search_cache (query_key, query, results_json, provider_status, result_count, expires_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(query_key) DO UPDATE SET
             query = excluded.query,
             results_json = excluded.results_json,
             provider_status = excluded.provider_status,
             result_count = excluded.result_count,
             expires_at = excluded.expires_at,
             updated_at = CURRENT_TIMESTAMP`,
        )
        .bind(queryKey, query, JSON.stringify(results), data.status || "OK", results.length, cacheExpiresAt)
        .run();
    } catch (error) {
      if (!isMissingColumnError(error)) throw error;
      await db
        .prepare(
          `INSERT INTO places_search_cache (query_key, query, results_json)
           VALUES (?, ?, ?)
           ON CONFLICT(query_key) DO UPDATE SET query = excluded.query, results_json = excluded.results_json`,
        )
        .bind(queryKey, query, JSON.stringify(results))
        .run();
    }

    if (results.length === 0) {
      return json({
        status: data.status || "ZERO_RESULTS",
        cached: false,
        results: [],
      });
    }

    return json({
      status: data.status || "OK",
      cached: false,
      queryKey,
      websitePrecheck,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Places search failed:", error);
    return json({
      status: "PLACES_FETCH_FAILED",
      error: message,
      results: [],
    });
  }
}

async function fetchPlaceDetailsLegacy(placeId: string, placesKey: string, fields: string[]) {
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=${encodeURIComponent(fields.join(","))}&key=${encodeURIComponent(placesKey)}`,
  );
  const data = await response.json() as { status?: string; result?: Record<string, unknown>; error_message?: string };
  return { response, data };
}

async function precheckWebsiteForPlaces(db: D1Database, placesKey: string, results: unknown[], limit: number) {
  if (!limit || !placesKey) return results;
  await ensureRequiredColumns(db, prospectWebsiteCheckRequiredColumns);
  const checkedAt = new Date().toISOString();
  const next: unknown[] = [];

  for (let index = 0; index < results.length; index += 1) {
    const item = results[index];
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      next.push(item);
      continue;
    }

    const place = item as Record<string, unknown>;
    const placeId = placeIdFromPlace(place);
    if (index >= limit || !placeId) {
      next.push(place);
      continue;
    }

    try {
      const { data } = await fetchPlaceDetailsLegacy(placeId, placesKey, [
        "place_id",
        "name",
        "formatted_phone_number",
        "international_phone_number",
        "website",
        "url",
        "types",
        "business_status",
      ]);
      if (data.status && data.status !== "OK") {
        const errored = { ...place, websiteCheckStatus: "error", websiteCheckedAt: checkedAt, websiteCheckError: data.error_message || data.status };
        await updateProspectRecord(db, placeId, {
          website_check_status: "error",
          website_checked_at: checkedAt,
        });
        next.push(errored);
        continue;
      }

      const detail = data.result && typeof data.result === "object" ? data.result : {};
      const prospect = prospectFromPlace({ ...place, ...detail });
      const status = prospect.websiteUrl ? "has_website" : "no_website";
      const merged = {
        ...place,
        ...detail,
        formatted_phone_number: prospect.phone,
        website: prospect.websiteUrl,
        url: prospect.mapsUrl,
        websiteCheckStatus: status,
        websiteCheckedAt: checkedAt,
      };
      await updateProspectRecord(db, placeId, {
        phone: prospect.phone,
        website_url: prospect.websiteUrl,
        maps_url: prospect.mapsUrl,
        website_check_status: status,
        website_checked_at: checkedAt,
      });
      next.push(merged);
    } catch (error) {
      console.error("Places website precheck failed:", error);
      await updateProspectRecord(db, placeId, {
        website_check_status: "error",
        website_checked_at: checkedAt,
      });
      next.push({
        ...place,
        websiteCheckStatus: "error",
        websiteCheckedAt: checkedAt,
        websiteCheckError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return next;
}

async function handlePlacesDetails(url: URL, db: D1Database, env: Env): Promise<Response> {
  const placeId = url.searchParams.get("placeId") || url.searchParams.get("place_id") || "";
  const placesKey = await getSetting(db, env, "GOOGLE_PLACES_API_KEY");

  if (!placeId) {
    return errorJson("Missing placeId", 400);
  }

  if (!placesKey) {
    return errorJson("Google Places API key is not configured", 400);
  }

  const fields = [
    "place_id",
    "name",
    "formatted_address",
    "formatted_phone_number",
    "international_phone_number",
    "website",
    "url",
    "opening_hours",
    "rating",
    "reviews",
    "user_ratings_total",
    "types",
    "business_status",
    "photos",
  ].join(",");

  try {
    const { response, data } = await fetchPlaceDetailsLegacy(placeId, placesKey, fields.split(","));

    if (!response.ok || (data.status && data.status !== "OK")) {
      return json({
        status: data.status || "GOOGLE_HTTP_ERROR",
        error: data.error_message || `Google Places Details returned HTTP ${response.status}`,
        result: null,
      }, response.ok ? 200 : response.status);
    }

    if (data.result && typeof data.result === "object") {
      const prospect = prospectFromPlace(data.result);
      await ensureRequiredColumns(db, prospectDetailsRequiredColumns);
      await updateProspectRecord(db, placeId, {
        details_json: JSON.stringify(data.result),
        phone: prospect.phone,
        website_url: prospect.websiteUrl,
        maps_url: prospect.mapsUrl,
        website_check_status: prospect.websiteUrl ? "has_website" : "no_website",
        website_checked_at: new Date().toISOString(),
        details_loaded_at: new Date().toISOString(),
      });
    }

    return json({
      status: data.status || "OK",
      result: data.result || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Places details failed:", error);
    return json({
      status: "PLACES_DETAILS_FAILED",
      error: message,
      result: null,
    });
  }
}

async function handlePlacesCache(request: Request, db: D1Database, segments: string[]): Promise<Response> {
  if (request.method !== "POST" || segments[2] !== "trim") {
    return errorJson("Not Found", 404);
  }

  const body = await readJsonBody(request);
  const olderThanDays = Math.max(1, Math.min(365, Number(body.olderThanDays || 30)));
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();
  const result = await db
    .prepare(
      `DELETE FROM places_search_cache
       WHERE datetime(updated_at) < datetime(?) OR (expires_at IS NOT NULL AND datetime(expires_at) < datetime('now'))`,
    )
    .bind(cutoff)
    .run();

  return json({ success: true, olderThanDays, result });
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

async function handleGenerationJobs(request: Request, db: D1Database): Promise<Response> {
  if (request.method !== "GET") {
    return errorJson("Not Found", 404);
  }

  const url = new URL(request.url);
  const requestedLimit = Number(url.searchParams.get("limit") || "100");
  const limit = Math.min(500, Math.max(1, Number.isFinite(requestedLimit) ? Math.floor(requestedLimit) : 100));
  const requestedOffset = Number(url.searchParams.get("offset") || "0");
  const offset = Math.min(100000, Math.max(0, Number.isFinite(requestedOffset) ? Math.floor(requestedOffset) : 0));
  const status = String(url.searchParams.get("status") || "").trim().toLowerCase();
  const patch = String(url.searchParams.get("patch") || "").trim().toLowerCase();
  const aiRewrite = String(url.searchParams.get("aiRewrite") || "").trim().toLowerCase();
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
  if (patch === "applied") {
    where.push(`j.metadata_json LIKE '%"copyPatchApplied":true%'`);
  } else if (patch === "fallback") {
    where.push(`(j.metadata_json IS NULL OR j.metadata_json NOT LIKE '%"copyPatchApplied":true%')`);
  }
  if (aiRewrite === "zero") {
    where.push(`j.metadata_json LIKE '%"copyPatchApplied":true%' AND j.metadata_json LIKE '%"aiRewritten":0%'`);
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
    metadata: parseJsonObject(row.metadata_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  if (includeCounts) {
    const searchWhereSql = searchWhere.length ? `WHERE ${searchWhere.join(" AND ")}` : "";
    const countsStatement = db.prepare(
      `SELECT
        COUNT(*) AS all_count,
        SUM(CASE WHEN j.status = 'failed' THEN 1 ELSE 0 END) AS failed_count,
        SUM(CASE WHEN j.metadata_json LIKE '%"copyPatchApplied":true%' THEN 1 ELSE 0 END) AS patch_count,
        SUM(CASE WHEN j.metadata_json IS NULL OR j.metadata_json NOT LIKE '%"copyPatchApplied":true%' THEN 1 ELSE 0 END) AS fallback_count,
        SUM(CASE WHEN j.metadata_json LIKE '%"copyPatchApplied":true%' AND j.metadata_json LIKE '%"aiRewritten":0%' THEN 1 ELSE 0 END) AS no_rewrite_count
       FROM generation_jobs j
       LEFT JOIN places_prospects p ON p.place_id = j.place_id
       ${searchWhereSql}`,
    );
    const counts = searchBindings.length
      ? await countsStatement.bind(...searchBindings).first<{ all_count?: number; failed_count?: number; patch_count?: number; fallback_count?: number; no_rewrite_count?: number }>()
      : await countsStatement.first<{ all_count?: number; failed_count?: number; patch_count?: number; fallback_count?: number; no_rewrite_count?: number }>();
    return json({
      jobs,
      counts: {
        all: Number(counts?.all_count || 0),
        failed: Number(counts?.failed_count || 0),
        fallback: Number(counts?.fallback_count || 0),
        patch: Number(counts?.patch_count || 0),
        noRewrite: Number(counts?.no_rewrite_count || 0),
      },
    });
  }

  return json(jobs);
}

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

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function safeCopyText(value: unknown, maxLength = 420) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function safeCopyArray(value: unknown, maxItems = 6, maxLength = 160) {
  return Array.isArray(value)
    ? value.map((item) => safeCopyText(item, maxLength)).filter(Boolean).slice(0, maxItems)
    : [];
}

function safeCopyPairs(value: unknown, maxItems = 6) {
  return Array.isArray(value)
    ? value
        .map((item) => {
          const source = objectValue(item);
          const title = safeCopyText(source.title, 90);
          const description = safeCopyText(source.description, 260);
          return title || description ? { title, description } : null;
        })
        .filter(Boolean)
        .slice(0, maxItems)
    : [];
}

function firstSectionByType(siteJson: Record<string, unknown>, type: string) {
  const pages = Array.isArray(siteJson.pages) ? siteJson.pages as Array<Record<string, unknown>> : [];
  for (const page of pages) {
    const sections = Array.isArray(page.sections) ? page.sections as Array<Record<string, unknown>> : [];
    const found = sections.find((section) => asString(section.type) === type);
    if (found) return found;
  }
  return null;
}

function sectionById(siteJson: Record<string, unknown>, id: string) {
  const pages = Array.isArray(siteJson.pages) ? siteJson.pages as Array<Record<string, unknown>> : [];
  for (const page of pages) {
    const sections = Array.isArray(page.sections) ? page.sections as Array<Record<string, unknown>> : [];
    const found = sections.find((section) => asString(section.id) === id);
    if (found) return found;
  }
  return null;
}

function findOffering(siteJson: Record<string, unknown>, patch: Record<string, unknown>) {
  const id = asString(patch.id);
  const detailPageId = asString(patch.detailPageId);
  const title = safeCopyText(patch.title, 120).toLowerCase();
  const products = Array.isArray(siteJson.products) ? siteJson.products as Array<Record<string, unknown>> : [];
  const services = Array.isArray(siteJson.services) ? siteJson.services as Array<Record<string, unknown>> : [];
  const all = [...products, ...services];
  return all.find((item) =>
    (id && asString(item.id) === id) ||
    (detailPageId && asString(item.detailPageId) === detailPageId) ||
    (title && asString(item.title).toLowerCase() === title)
  ) || null;
}

function applyTextIfPresent(target: Record<string, unknown>, key: string, source: Record<string, unknown>, sourceKey = key, maxLength = 420) {
  if (!(sourceKey in source)) return;
  const value = safeCopyText(source[sourceKey], maxLength);
  if (value) target[key] = value;
}

type AiCopyAuditTarget = {
  path: Array<string | number>;
  pathLabel: string;
  label: string;
  before: string;
};

type AiCopyAuditItem = {
  path: string;
  label: string;
  before: string;
  after: string;
  status: "ai_rewritten" | "ai_filled_blank" | "source_kept" | "fallback_source" | "missing_after";
};

function copyAuditText(value: unknown, maxLength = 260) {
  return safeCopyText(value, maxLength);
}

function copyAuditPathLabel(path: Array<string | number>) {
  return path.reduce((result, part) => (
    typeof part === "number" ? `${result}[${part}]` : result ? `${result}.${part}` : part
  ), "" as string);
}

function readCopyAuditPath(root: unknown, path: Array<string | number>) {
  let cursor = root;
  for (const part of path) {
    if (typeof part === "number") {
      if (!Array.isArray(cursor)) return undefined;
      cursor = cursor[part];
    } else {
      const source = objectValue(cursor);
      if (!(part in source)) return undefined;
      cursor = source[part];
    }
  }
  return cursor;
}

function pushCopyAuditTarget(
  targets: AiCopyAuditTarget[],
  path: Array<string | number>,
  label: string,
  value: unknown,
  includeBlank = false,
) {
  const before = copyAuditText(value);
  if (!before && !includeBlank) return;
  targets.push({ path, pathLabel: copyAuditPathLabel(path), label, before });
}

function collectSectionCopyAuditTargets(
  targets: AiCopyAuditTarget[],
  section: Record<string, unknown>,
  path: Array<string | number>,
) {
  const content = objectValue(section.content);
  const sectionName = asString(section.id, asString(section.type, "section"));
  (["title", "headline", "subheadline", "description", "summary"] as const).forEach((field) => {
    pushCopyAuditTarget(targets, [...path, "content", field], `${sectionName} ${field}`, content[field]);
  });

  const items = Array.isArray(content.items) ? content.items as Array<Record<string, unknown>> : [];
  items.slice(0, 8).forEach((item, index) => {
    (["title", "label", "value", "description", "question", "answer"] as const).forEach((field) => {
      pushCopyAuditTarget(targets, [...path, "content", "items", index, field], `${sectionName} item ${index + 1} ${field}`, item[field]);
    });
  });
}

function collectAiCopyAuditTargets(siteJson: Record<string, unknown>) {
  const targets: AiCopyAuditTarget[] = [];
  const meta = objectValue(siteJson.meta);
  const businessProfile = objectValue(siteJson.businessProfile);
  const seo = objectValue(siteJson.seo);

  pushCopyAuditTarget(targets, ["meta", "seoTitle"], "meta SEO title", meta.seoTitle, true);
  pushCopyAuditTarget(targets, ["meta", "seoDescription"], "meta SEO description", meta.seoDescription, true);
  pushCopyAuditTarget(targets, ["businessProfile", "shortPitch"], "business short pitch", businessProfile.shortPitch, true);
  pushCopyAuditTarget(targets, ["seo", "cityLandingPhrase"], "SEO city phrase", seo.cityLandingPhrase, true);

  const pages = Array.isArray(siteJson.pages) ? siteJson.pages as Array<Record<string, unknown>> : [];
  pages.slice(0, 12).forEach((page, pageIndex) => {
    const sections = Array.isArray(page.sections) ? page.sections as Array<Record<string, unknown>> : [];
    sections.slice(0, 16).forEach((section, sectionIndex) => {
      const type = asString(section.type);
      if (!["hero", "features", "offers", "offeringDetail", "reviews", "hoursLocation", "faq", "gridCards", "textImageBlock"].includes(type)) return;
      collectSectionCopyAuditTargets(targets, section, ["pages", pageIndex, "sections", sectionIndex]);
    });
  });

  const offers = Array.isArray(siteJson.offers) ? siteJson.offers as Array<Record<string, unknown>> : [];
  offers.slice(0, 12).forEach((offer, index) => {
    pushCopyAuditTarget(targets, ["offers", index, "title"], `offer ${index + 1} title`, offer.title);
    pushCopyAuditTarget(targets, ["offers", index, "description"], `offer ${index + 1} description`, offer.description);
    pushCopyAuditTarget(targets, ["offers", index, "priceHint"], `offer ${index + 1} price hint`, offer.priceHint);
  });

  const offerings = [
    ...(Array.isArray(siteJson.products) ? siteJson.products as Array<Record<string, unknown>> : []),
    ...(Array.isArray(siteJson.services) ? siteJson.services as Array<Record<string, unknown>> : []),
  ];
  const offeringRoots = [
    ...(Array.isArray(siteJson.products) ? (siteJson.products as Array<Record<string, unknown>>).map((_, index) => ["products", index] as Array<string | number>) : []),
    ...(Array.isArray(siteJson.services) ? (siteJson.services as Array<Record<string, unknown>>).map((_, index) => ["services", index] as Array<string | number>) : []),
  ];
  offerings.slice(0, 16).forEach((offering, index) => {
    const rootPath = offeringRoots[index];
    const name = asString(offering.title, `offering ${index + 1}`);
    if (!rootPath) return;
    (["title", "summary", "description", "priceHint"] as const).forEach((field) => {
      pushCopyAuditTarget(targets, [...rootPath, field], `${name} ${field}`, offering[field]);
    });
    (["bestFor", "included", "relatedReviewKeywords"] as const).forEach((field) => {
      const values = Array.isArray(offering[field]) ? offering[field] as unknown[] : [];
      values.slice(0, 8).forEach((value, itemIndex) => {
        pushCopyAuditTarget(targets, [...rootPath, field, itemIndex], `${name} ${field} ${itemIndex + 1}`, value);
      });
    });
    const highlights = Array.isArray(offering.highlights) ? offering.highlights as Array<Record<string, unknown>> : [];
    highlights.slice(0, 6).forEach((highlight, itemIndex) => {
      pushCopyAuditTarget(targets, [...rootPath, "highlights", itemIndex, "title"], `${name} highlight ${itemIndex + 1} title`, highlight.title);
      pushCopyAuditTarget(targets, [...rootPath, "highlights", itemIndex, "description"], `${name} highlight ${itemIndex + 1} description`, highlight.description);
    });
  });

  return targets.slice(0, 180);
}

function buildAiCopyAudit(targets: AiCopyAuditTarget[], siteJson: Record<string, unknown>, patchApplied: boolean) {
  const items = targets.map((target) => {
    const after = copyAuditText(readCopyAuditPath(siteJson, target.path));
    let status: AiCopyAuditItem["status"] = "source_kept";
    if (!patchApplied) {
      status = "fallback_source";
    } else if (target.before && after && target.before !== after) {
      status = "ai_rewritten";
    } else if (!target.before && after) {
      status = "ai_filled_blank";
    } else if (target.before && !after) {
      status = "missing_after";
    }
    return {
      path: target.pathLabel,
      label: target.label,
      before: target.before,
      after,
      status,
    };
  }).filter((item) => item.before || item.after) as AiCopyAuditItem[];

  const summary = items.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    summary: {
      targetFieldsSentToAi: targets.length,
      sourceSentencesSentToAi: targets.filter((target) => target.before).length,
      aiRewritten: summary.ai_rewritten || 0,
      aiFilledBlank: summary.ai_filled_blank || 0,
      sourceKept: summary.source_kept || 0,
      fallbackSource: summary.fallback_source || 0,
      missingAfter: summary.missing_after || 0,
      storedItems: Math.min(items.length, 120),
    },
    items: items.slice(0, 120),
  };
}

function applyButtonTextPatch(buttons: unknown, patchButtons: unknown) {
  if (!Array.isArray(buttons) || !Array.isArray(patchButtons)) return;
  patchButtons.slice(0, buttons.length).forEach((patchButton, index) => {
    const target = objectValue(buttons[index]);
    const text = safeCopyText(objectValue(patchButton).text, 80);
    if (text) target.text = text;
  });
}

function applySectionCopyPatch(section: Record<string, unknown>, patch: Record<string, unknown>) {
  const content = objectValue(section.content);
  applyTextIfPresent(content, "title", patch, "title", 140);
  applyTextIfPresent(content, "headline", patch, "headline", 160);
  applyTextIfPresent(content, "subheadline", patch, "subheadline", 360);
  applyTextIfPresent(content, "description", patch, "description", 420);
  applyTextIfPresent(content, "summary", patch, "summary", 420);
  applyTextIfPresent(content, "kind", patch, "kind", 60);
  applyTextIfPresent(content, "priceHint", patch, "priceHint", 80);
  applyButtonTextPatch(content.buttons, patch.buttons);

  const itemsPatch = Array.isArray(patch.items) ? patch.items as Array<Record<string, unknown>> : [];
  const contentItems = Array.isArray(content.items) ? content.items as Array<Record<string, unknown>> : [];
  itemsPatch.slice(0, contentItems.length).forEach((itemPatch, index) => {
    const target = objectValue(contentItems[index]);
    applyTextIfPresent(target, "title", itemPatch, "title", 90);
    applyTextIfPresent(target, "label", itemPatch, "label", 80);
    applyTextIfPresent(target, "value", itemPatch, "value", 80);
    applyTextIfPresent(target, "description", itemPatch, "description", 260);
    applyTextIfPresent(target, "question", itemPatch, "question", 140);
    applyTextIfPresent(target, "answer", itemPatch, "answer", 360);
  });

  if (Array.isArray(patch.highlights)) content.highlights = safeCopyPairs(patch.highlights, 4);
  if (Array.isArray(patch.included)) content.included = safeCopyArray(patch.included, 8, 100);
  if (Array.isArray(patch.bestFor)) content.bestFor = safeCopyArray(patch.bestFor, 6, 80);
  if (Array.isArray(patch.faq)) {
    content.items = (patch.faq as unknown[]).map((item) => {
      const source = objectValue(item);
      const question = safeCopyText(source.question, 140);
      const answer = safeCopyText(source.answer, 420);
      return question && answer ? { question, answer } : null;
    }).filter(Boolean).slice(0, 6);
  }
  section.content = content;
}

function applyOfferingCopyPatch(siteJson: Record<string, unknown>, patch: Record<string, unknown>) {
  const offering = findOffering(siteJson, patch);
  if (!offering) return;
  applyTextIfPresent(offering, "title", patch, "title", 120);
  applyTextIfPresent(offering, "summary", patch, "summary", 360);
  applyTextIfPresent(offering, "description", patch, "description", 700);
  applyTextIfPresent(offering, "priceHint", patch, "priceHint", 80);
  if (Array.isArray(patch.bestFor)) offering.bestFor = safeCopyArray(patch.bestFor, 6, 80);
  if (Array.isArray(patch.included)) offering.included = safeCopyArray(patch.included, 8, 100);
  if (Array.isArray(patch.highlights)) offering.highlights = safeCopyPairs(patch.highlights, 4);
  if (Array.isArray(patch.relatedReviewKeywords)) offering.relatedReviewKeywords = safeCopyArray(patch.relatedReviewKeywords, 8, 40);

  const detailPageId = asString(offering.detailPageId);
  const pages = Array.isArray(siteJson.pages) ? siteJson.pages as Array<Record<string, unknown>> : [];
  const page = pages.find((item) => asString(item.pageId) === detailPageId);
  if (!page) return;
  if (offering.title) page.pageTitle = offering.title;
  const sections = Array.isArray(page.sections) ? page.sections as Array<Record<string, unknown>> : [];
  sections.forEach((section) => {
    const sectionType = asString(section.type);
    if (sectionType === "hero") {
      applySectionCopyPatch(section, objectValue(patch.hero));
    }
    if (sectionType === "offeringDetail") {
      applySectionCopyPatch(section, {
        title: offering.title,
        summary: offering.summary || offering.description,
        priceHint: offering.priceHint,
        bestFor: offering.bestFor,
        included: offering.included,
        highlights: offering.highlights,
      });
    }
    if (sectionType === "features") {
      applySectionCopyPatch(section, objectValue(patch.features));
    }
    if (sectionType === "faq") {
      applySectionCopyPatch(section, { title: safeCopyText(patch.faqTitle, 140), faq: patch.faq });
    }
  });
}

function applyAiCopyPatch(siteJson: Record<string, unknown>, patch: Record<string, unknown>) {
  const metaCopy = objectValue(patch.metaCopy);
  const meta = objectValue(siteJson.meta);
  applyTextIfPresent(meta, "seoTitle", metaCopy, "seoTitle", 160);
  applyTextIfPresent(meta, "seoDescription", metaCopy, "seoDescription", 260);
  siteJson.meta = meta;

  const businessProfile = objectValue(siteJson.businessProfile);
  applyTextIfPresent(businessProfile, "shortPitch", metaCopy, "shortPitch", 420);
  siteJson.businessProfile = businessProfile;

  const seo = objectValue(siteJson.seo);
  applyTextIfPresent(seo, "title", metaCopy, "seoTitle", 160);
  applyTextIfPresent(seo, "description", metaCopy, "seoDescription", 260);
  applyTextIfPresent(seo, "cityLandingPhrase", metaCopy, "cityLandingPhrase", 120);
  siteJson.seo = seo;

  const heroPatch = objectValue(patch.hero);
  const heroSection = heroPatch.id ? sectionById(siteJson, asString(heroPatch.id)) : firstSectionByType(siteJson, "hero");
  if (heroSection) applySectionCopyPatch(heroSection, heroPatch);

  const sectionsPatch = objectValue(patch.sections);
  Object.entries(sectionsPatch).forEach(([sectionId, sectionPatch]) => {
    const section = sectionById(siteJson, sectionId);
    if (section) applySectionCopyPatch(section, objectValue(sectionPatch));
  });

  const offersPatch = Array.isArray(patch.offers) ? patch.offers as Array<Record<string, unknown>> : [];
  const offers = Array.isArray(siteJson.offers) ? siteJson.offers as Array<Record<string, unknown>> : [];
  offersPatch.slice(0, offers.length).forEach((offerPatch, index) => {
    const target = objectValue(offers[index]);
    applyTextIfPresent(target, "title", offerPatch, "title", 120);
    applyTextIfPresent(target, "description", offerPatch, "description", 420);
    applyTextIfPresent(target, "priceHint", offerPatch, "priceHint", 80);
  });

  const offeringsPatch = Array.isArray(patch.offerings) ? patch.offerings as Array<Record<string, unknown>> : [];
  offeringsPatch.forEach((offeringPatch) => applyOfferingCopyPatch(siteJson, objectValue(offeringPatch)));

  const faqPatch = Array.isArray(patch.faq) ? patch.faq : [];
  if (faqPatch.length) {
    const faqSection = firstSectionByType(siteJson, "faq");
    if (faqSection) applySectionCopyPatch(faqSection, { faq: faqPatch, title: safeCopyText(patch.faqTitle, 140) });
  }

  const conversionPatch = objectValue(patch.conversion);
  const conversion = objectValue(siteJson.conversion);
  const primaryCta = objectValue(conversion.primaryCta);
  const secondaryCta = objectValue(conversion.secondaryCta);
  applyTextIfPresent(primaryCta, "text", conversionPatch, "primaryCtaText", 80);
  applyTextIfPresent(secondaryCta, "text", conversionPatch, "secondaryCtaText", 80);
  conversion.primaryCta = primaryCta;
  conversion.secondaryCta = secondaryCta;
  siteJson.conversion = conversion;

  const globalConfig = objectValue(siteJson.global);
  const header = objectValue(globalConfig.header);
  const headerCta = objectValue(header.ctaButton);
  applyTextIfPresent(headerCta, "text", conversionPatch, "headerCtaText", 80);
  header.ctaButton = headerCta;
  globalConfig.header = header;
  const footerPatch = objectValue(patch.footer);
  const footer = objectValue(globalConfig.footer);
  applyTextIfPresent(footer, "text", footerPatch, "text", 180);
  globalConfig.footer = footer;
  siteJson.global = globalConfig;

  return siteJson;
}

function textItemsFromArray(value: unknown, maxItems = 6) {
  return Array.isArray(value)
    ? value.slice(0, maxItems).map((item) => {
      if (typeof item === "string" || typeof item === "number") return safeCopyText(item, 160);
      const source = objectValue(item);
      return {
        title: safeCopyText(source.title || source.label || source.question, 120),
        description: safeCopyText(source.description || source.answer || source.value, 260),
      };
    }).filter(Boolean)
    : [];
}

function sectionCopyTarget(section: Record<string, unknown>) {
  const content = objectValue(section.content);
  return {
    sectionId: asString(section.id),
    type: asString(section.type),
    title: safeCopyText(content.title, 140),
    headline: safeCopyText(content.headline, 160),
    subheadline: safeCopyText(content.subheadline, 300),
    description: safeCopyText(content.description || content.summary, 360),
    items: textItemsFromArray(content.items || content.highlights || content.buttons, 6),
  };
}

function businessFactsForAiCopy(originData: unknown, siteJson: Record<string, unknown>, businessName: string) {
  const origin = objectValue(originData);
  const meta = objectValue(siteJson.meta);
  const profile = objectValue(siteJson.businessProfile);
  const trust = objectValue(siteJson.trust);
  const contact = objectValue(profile.contact);
  const address = objectValue(profile.address);
  const hours = objectValue(siteJson.hours);
  const reviews = Array.isArray(trust.reviews)
    ? (trust.reviews as Array<Record<string, unknown>>).slice(0, 5).map((review) => ({
      rating: typeof review.rating === "number" ? review.rating : undefined,
      text: safeCopyText(review.text, 420),
      authorName: safeCopyText(review.authorName || review.author, 80),
    }))
    : [];

  return {
    businessName,
    language: asString(meta.language),
    niche: asString(meta.niche),
    primaryType: asString(profile.primaryType, Array.isArray(origin.types) ? asString(origin.types[0]) : ""),
    typeLabel: asString(profile.typeLabel),
    categories: Array.isArray(profile.categories) ? profile.categories.map((item) => safeCopyText(item, 60)).filter(Boolean).slice(0, 8) : [],
    address: safeCopyText(address.formatted || origin.formatted_address || origin.formattedAddress, 220),
    city: safeCopyText(address.city, 80),
    state: safeCopyText(address.state, 80),
    country: safeCopyText(address.country, 80),
    phone: safeCopyText(contact.phoneNational || contact.phoneInternational || origin.formatted_phone_number || origin.nationalPhoneNumber || origin.international_phone_number, 80),
    businessStatus: safeCopyText(origin.business_status || origin.businessStatus || objectValue(siteJson.sourceData).businessStatus, 80),
    rating: typeof trust.rating === "number" ? trust.rating : typeof origin.rating === "number" ? origin.rating : null,
    reviewCount: typeof trust.reviewCount === "number" ? trust.reviewCount : typeof origin.user_ratings_total === "number" ? origin.user_ratings_total : typeof origin.userRatingCount === "number" ? origin.userRatingCount : null,
    hours: Array.isArray(hours.regular) ? hours.regular.map((item) => safeCopyText(item, 120)).filter(Boolean).slice(0, 8) : [],
    reviews,
  };
}

function buildAiCopyTargetBrief(siteJson: Record<string, unknown>, originData: unknown, businessName: string) {
  const pages = Array.isArray(siteJson.pages) ? siteJson.pages as Array<Record<string, unknown>> : [];
  const offers = Array.isArray(siteJson.offers) ? siteJson.offers as Array<Record<string, unknown>> : [];
  const products = Array.isArray(siteJson.products) ? siteJson.products as Array<Record<string, unknown>> : [];
  const services = Array.isArray(siteJson.services) ? siteJson.services as Array<Record<string, unknown>> : [];
  return {
    facts: businessFactsForAiCopy(originData, siteJson, businessName),
    metaCopyTargets: {
      seoTitle: safeCopyText(objectValue(siteJson.meta).seoTitle, 160),
      seoDescription: safeCopyText(objectValue(siteJson.meta).seoDescription, 260),
      shortPitch: safeCopyText(objectValue(siteJson.businessProfile).shortPitch, 420),
      cityLandingPhrase: safeCopyText(objectValue(siteJson.seo).cityLandingPhrase, 140),
    },
    sectionTargets: pages.flatMap((page) => {
      const sections = Array.isArray(page.sections) ? page.sections as Array<Record<string, unknown>> : [];
      return sections
        .filter((section) => ["hero", "features", "offers", "offeringDetail", "reviews", "hoursLocation", "faq", "gridCards", "textImageBlock"].includes(asString(section.type)))
        .map(sectionCopyTarget);
    }).slice(0, 30),
    offers: offers.map((offer, index) => ({
      index,
      title: safeCopyText(offer.title, 120),
      description: safeCopyText(offer.description, 360),
      priceHint: safeCopyText(offer.priceHint, 80),
    })).slice(0, 12),
    offerings: [...products, ...services].map((item) => ({
      id: asString(item.id),
      type: asString(item.type),
      title: safeCopyText(item.title, 120),
      summary: safeCopyText(item.summary, 360),
      description: safeCopyText(item.description, 520),
      priceHint: safeCopyText(item.priceHint, 80),
      bestFor: safeCopyArray(item.bestFor, 6, 80),
      included: safeCopyArray(item.included, 8, 100),
      highlights: safeCopyPairs(item.highlights, 4),
      relatedReviewKeywords: safeCopyArray(item.relatedReviewKeywords, 8, 40),
    })).slice(0, 16),
  };
}

async function generateAiCopyPatch(
  db: D1Database,
  env: Env,
  body: Record<string, unknown>,
): Promise<{ patch: Record<string, unknown>; copyBriefHash: string; copyPatchHash: string } | null> {
  const provider = asString(body.provider);
  const model = asString(body.model);
  const requireAi = body.requireAi === true;
  const businessName = asString(body.businessName);
  const originData = body.originData || {};
  const submittedJson = body.jsonContent && typeof body.jsonContent === "object" && !Array.isArray(body.jsonContent)
    ? body.jsonContent as Record<string, unknown>
    : null;
  const copyTargetBrief = buildAiCopyTargetBrief(submittedJson || {}, originData, businessName);

  if (!provider || !model) {
    if (requireAi) {
      throw new Error("AI provider and model are required for this generate action.");
    }
    return null;
  }

  const missingKey = (label: string) => {
    if (requireAi) {
      throw new Error(`${label} API key is not configured. Set it in /admin/settings first.`);
    }
    return null;
  };

  const apiError = async (providerName: string, response: Response) => {
    const text = await response.text().catch(() => "");
    let message = text.slice(0, 240);
    try {
      const payload = text ? JSON.parse(text) : {};
      message = asString(payload.error?.message, asString(payload.message, message));
    } catch {
      // Keep raw text snippet.
    }
    const finalMessage = `${providerName} API returned HTTP ${response.status}${message ? `: ${message}` : ""}`;
    if (requireAi) throw new Error(finalMessage);
    console.error(finalMessage);
    return null;
  };

  const copyPatchSchema = {
    metaCopy: {
      seoTitle: "Specific local SEO title, max 70 chars.",
      seoDescription: "Specific description using verified data, max 155 chars.",
      shortPitch: "One beefy but truthful pitch paragraph.",
      cityLandingPhrase: "Local service phrase.",
    },
    hero: {
      headline: "Strong client-facing headline.",
      subheadline: "Specific paragraph using business name, category, location, rating/reviews, phone, and verified strengths.",
      buttons: [{ text: "CTA text only. Do not provide href." }],
    },
    sections: {
      "section-id-from-scaffold": {
        title: "Improved title.",
        description: "Improved supporting copy.",
        items: [{ title: "Item title", description: "Item description" }],
      },
    },
    offers: [{ title: "Offer title", description: "Offer description", priceHint: "Contact for estimate" }],
    offerings: [{
      id: "existing product/service id from scaffold",
      title: "Title Case offering name",
      summary: "Specific non-thin summary.",
      description: "Longer service/product copy.",
      priceHint: "Contact for estimate",
      bestFor: ["specific use case"],
      included: ["specific deliverable"],
      highlights: [{ title: "Benefit", description: "Why it matters" }],
      relatedReviewKeywords: ["keyword"],
      hero: { headline: "Detail page headline", subheadline: "Detail page subheadline", buttons: [{ text: "CTA text" }] },
      features: { title: "Feature section title", items: [{ title: "Feature", description: "Feature detail" }] },
      faqTitle: "FAQ title",
      faq: [{ question: "Question", answer: "Answer" }],
    }],
    faqTitle: "Home FAQ title",
    faq: [{ question: "Question", answer: "Answer" }],
    conversion: {
      headerCtaText: "Short CTA",
      primaryCtaText: "Primary CTA",
      secondaryCtaText: "Secondary CTA",
    },
    footer: { text: "Copyright/footer line only." },
  };
  const systemMsg =
    "You are a practical local-business copywriter. You DO NOT generate full website JSON. " +
    "You only return a small JSON copy patch matching this schema, with no markdown and no extra keys:\n" +
    `${JSON.stringify(copyPatchSchema)}\n\n` +
    "Critical rules: you are not given full website JSON, page IDs, navigation hrefs, image URLs, maps URLs, sourceData, palette, font, visual style, favicon, CSS, or storage fields. Do not mention or create them. " +
    "Use only facts from the provided copy target brief. If a fact is missing, write honest copy like 'contact for availability' instead of inventing. " +
    "Make the copy much less templated: mention the actual business name, exact city/area when available, category/type, rating/review count when available, phone if available, operating status, hours if useful, and review themes if reviews exist. " +
    "For US businesses write English. For Indonesian businesses write Indonesian. If meta.language is explicit, follow it. Do not mix languages. " +
    "Every offering needs beefy copy: a specific title, summary, description, 3-5 bestFor items, 3-6 included items, 2-4 highlights, a detailed hero, 3 feature items, and 3-5 FAQ items. " +
    "Keep titles in Title Case except small connector words like for, and, of, to, in. Return plain text only; no HTML; no markdown; no SVG.";
  const userMsg = `Business Name: ${businessName}
Copy target brief. This is not full website JSON and contains only facts plus editable copy targets:
${JSON.stringify(copyTargetBrief)}

Return only the copy patch JSON.`;

  let responseContent = "";

  if (provider === "OpenRouter") {
    const key = await getSetting(db, env, "OPENROUTER_API_KEY");
    if (!key) return missingKey("OpenRouter");
    const apiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemMsg },
          { role: "user", content: userMsg },
        ],
      }),
    });
    if (!apiRes.ok) return apiError("OpenRouter", apiRes);
    const aiJson = await apiRes.json() as { choices?: Array<{ message?: { content?: string } }> };
    responseContent = aiJson.choices?.[0]?.message?.content || "";
  } else if (provider === "OpenAI") {
    const key = await getSetting(db, env, "OPENAI_API_KEY");
    if (!key) return missingKey("OpenAI");
    const apiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemMsg },
          { role: "user", content: userMsg },
        ],
      }),
    });
    if (!apiRes.ok) return apiError("OpenAI", apiRes);
    const aiJson = await apiRes.json() as { choices?: Array<{ message?: { content?: string } }> };
    responseContent = aiJson.choices?.[0]?.message?.content || "";
  } else if (provider === "Gemini") {
    const key = await getSetting(db, env, "GEMINI_API_KEY");
    if (!key) return missingKey("Gemini");
    const apiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemMsg }] },
        contents: [{ parts: [{ text: userMsg }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    });
    if (!apiRes.ok) return apiError("Gemini", apiRes);
    const aiJson = await apiRes.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    responseContent = aiJson.candidates?.[0]?.content?.parts?.[0]?.text || "";
  } else if (provider === "KIE") {
    const key = await getSetting(db, env, "KIE_API_KEY");
    if (!key) return missingKey("KIE.ai");

    const kieModelMap: Record<string, { endpoint: string; model?: string; mode: "chat" | "responses" }> = {
      "kie/gpt-5-5": { endpoint: "https://api.kie.ai/codex/v1/responses", model: "gpt-5-5", mode: "responses" },
      "kie/gpt-5-2": { endpoint: "https://api.kie.ai/gpt-5-2/v1/chat/completions", mode: "chat" },
      "kie/gemini-3.1-pro": { endpoint: "https://api.kie.ai/gemini-3.1-pro/v1/chat/completions", mode: "chat" },
      "kie/gemini-3-flash": { endpoint: "https://api.kie.ai/gemini-3-flash/v1/chat/completions", mode: "chat" },
    };
    const kieConfig = kieModelMap[model] || kieModelMap["kie/gemini-3-flash"];

    if (kieConfig.mode === "responses") {
      const apiRes = await fetch(kieConfig.endpoint, {
        method: "POST",
        headers: {
          authorization: `Bearer ${key}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: kieConfig.model,
          stream: false,
          input: [
            {
              role: "user",
              content: [
                { type: "input_text", text: `${systemMsg}\n\n${userMsg}` },
              ],
            },
          ],
          reasoning: { effort: "high" },
        }),
      });
      if (!apiRes.ok) return apiError("KIE.ai", apiRes);
      const aiJson = await apiRes.json() as { output?: Array<{ content?: Array<{ text?: string }> }> };
      responseContent = aiJson.output
        ?.flatMap((item) => item.content || [])
        .map((item) => item.text || "")
        .join("\n") || "";
    } else {
      const apiRes = await fetch(kieConfig.endpoint, {
        method: "POST",
        headers: {
          authorization: `Bearer ${key}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemMsg },
            { role: "user", content: userMsg },
          ],
          stream: false,
          reasoning_effort: "high",
        }),
      });
      if (!apiRes.ok) return apiError("KIE.ai", apiRes);
      const aiJson = await apiRes.json() as { choices?: Array<{ message?: { content?: string } }> };
      responseContent = aiJson.choices?.[0]?.message?.content || "";
    }
  } else if (provider === "Opencode") {
    const key = await getSetting(db, env, "OPENCODE_API_KEY");
    const endpoint = await getSetting(db, env, "OPENCODE_BASE_URL") || "https://api.opencode.example.com/v1/chat/completions";
    if (!key) return missingKey("Opencode");
    const apiRes = await fetch(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemMsg },
          { role: "user", content: userMsg },
        ],
      }),
    });
    if (!apiRes.ok) return apiError("Opencode", apiRes);
    const aiJson = await apiRes.json() as { choices?: Array<{ message?: { content?: string } }> };
    responseContent = aiJson.choices?.[0]?.message?.content || "";
  } else if (requireAi) {
    throw new Error(`Unsupported AI provider: ${provider}`);
  }

  if (!responseContent) {
    if (requireAi) {
      throw new Error(`${provider} did not return JSON content for model ${model}.`);
    }
    return null;
  }

  const cleaned = responseContent.replace(/```json/g, "").replace(/```/g, "").trim();
  try {
    const patch = JSON.parse(cleaned) as Record<string, unknown>;
    return {
      patch,
      copyBriefHash: await sha256Json(copyTargetBrief),
      copyPatchHash: await sha256Json(patch),
    };
  } catch (error) {
    if (requireAi) {
      throw new Error(`${provider} returned invalid JSON for model ${model}: ${error instanceof Error ? error.message : String(error)}`);
    }
    throw error;
  }
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

function normalizeImageFilenames(value: unknown, businessId: string, hint = "asset"): unknown {
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

async function uploadImageAssetsToR2(finalJson: Record<string, unknown>, env: Env, origin: string, businessId: string) {
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

async function uploadJsonToR2(finalJson: Record<string, unknown>, env: Env, businessId: string) {
  if (!env.R2) return "";
  const key = `sites/${businessId}/${businessId}.json`;
  await env.R2.put(key, JSON.stringify(finalJson, null, 2), { httpMetadata: { contentType: "application/json; charset=utf-8" } });
  return key;
}

function siteSummaryFromJson(parsed: Record<string, unknown>, businessId: string) {
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

function compactSiteManifest(finalJson: Record<string, unknown>, env: Env, businessId: string, jsonKey: string) {
  return {
    storageOnly: true,
    businessId,
    r2JsonKey: jsonKey,
    r2JsonUrl: jsonKey ? publicR2Url(env, jsonKey) : "",
    summary: siteSummaryFromJson(finalJson, businessId),
    updatedAt: new Date().toISOString(),
  };
}

function photoReferenceFromPlacePhoto(photo: unknown) {
  if (!photo || typeof photo !== "object" || Array.isArray(photo)) return "";
  const record = photo as Record<string, unknown>;
  return asString(record.photo_reference, asString(record.reference, asString(record.name)));
}

function googlePlacesPhotoProxyUrl(reference: string, maxWidth = 960) {
  return `/api/places/photo?reference=${encodeURIComponent(reference)}&maxwidth=${maxWidth}`;
}

function addUniqueImageUrl(target: string[], value: unknown) {
  const url = asString(value).trim();
  if (!url || target.includes(url)) return;
  target.push(url);
}

function collectGalleryImages(finalJson: Record<string, unknown>, originData: Record<string, unknown>) {
  const images: string[] = [];
  const brand = finalJson.brand && typeof finalJson.brand === "object" ? finalJson.brand as Record<string, unknown> : {};
  addUniqueImageUrl(images, brand.preferredHeroImage);
  addUniqueImageUrl(images, brand.logoImageUrl);

  for (const key of ["products", "services", "offers"]) {
    const items = Array.isArray(finalJson[key]) ? finalJson[key] as Array<Record<string, unknown>> : [];
    for (const item of items) {
      addUniqueImageUrl(images, item.image);
    }
  }

  const photos = Array.isArray(originData.photos) ? originData.photos : [];
  for (const photo of photos) {
    const reference = photoReferenceFromPlacePhoto(photo);
    if (reference) addUniqueImageUrl(images, googlePlacesPhotoProxyUrl(reference, 960));
  }

  return images.filter((image) => !image.startsWith("data:")).slice(0, 8);
}

function ensureGalleryPage(finalJson: Record<string, unknown>, originData: Record<string, unknown>) {
  const pages = Array.isArray(finalJson.pages) ? finalJson.pages as Array<Record<string, unknown>> : [];
  const hasGallery = pages.some((page) =>
    asString(page.pageId) === "gallery" ||
    (Array.isArray(page.sections) && (page.sections as Array<Record<string, unknown>>).some((section) => asString(section.type) === "imageGallery")),
  );
  if (hasGallery) return;

  const galleryImages = collectGalleryImages(finalJson, originData);
  if (galleryImages.length < 2) return;

  const meta = finalJson.meta && typeof finalJson.meta === "object" ? finalJson.meta as Record<string, unknown> : {};
  const isIndonesian = asString(meta.language).toLowerCase().startsWith("id");
  pages.push({
    pageId: "gallery",
    pageTitle: isIndonesian ? "Galeri" : "Gallery",
    sections: [
      {
        type: "imageGallery",
        id: "gallery-main",
        content: {
          title: isIndonesian ? "Galeri Foto" : "Photo Gallery",
          description: isIndonesian ? "Foto profil bisnis dan visual yang tersedia dari data Google Business Profile." : "Business profile photos and available visuals from Google Business Profile data.",
          images: galleryImages,
        },
      },
    ],
  });
  finalJson.pages = pages;

  const navigation = finalJson.navigation && typeof finalJson.navigation === "object" ? finalJson.navigation as Record<string, unknown> : {};
  const headerMenu = Array.isArray(navigation.headerMenu) ? navigation.headerMenu as Array<Record<string, unknown>> : [];
  if (!headerMenu.some((item) => asString(item.href) === "#gallery")) {
    const galleryItem = { label: isIndonesian ? "Galeri" : "Gallery", href: "#gallery" };
    const contactIndex = headerMenu.findIndex((item) => /contact|kontak/i.test(asString(item.label)) || asString(item.href) === "#contact");
    if (contactIndex >= 0) {
      headerMenu.splice(contactIndex, 0, galleryItem);
    } else {
      headerMenu.push(galleryItem);
    }
    navigation.headerMenu = headerMenu;
    finalJson.navigation = navigation;
  }
}

async function readSiteJsonFromStorage(row: { business_id: string; json_content?: string; r2_json_key?: string }, env: Env) {
  const parsed = parseJsonObject(row.json_content);
  const r2Key = asString(row.r2_json_key, asString(parsed.r2JsonKey));
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

async function migrateOldSiteJsonRowsToR2(request: Request, db: D1Database, env: Env) {
  if (!env.R2) {
    return errorJson("R2 binding is not configured. Cannot migrate site JSON out of D1.", 400);
  }

  const body = await readJsonBody(request);
  const limit = Math.max(1, Math.min(100, Number(body.limit || 25)));
  await ensureRequiredColumns(db, [
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
      const parsed = parseJsonObject(row.json_content);
      if (!Object.keys(parsed).length) {
        skipped.push({ businessId: row.business_id, reason: "json_content is not valid JSON" });
        continue;
      }

      const manifestKey = asString(parsed.r2JsonKey);
      if (parsed.storageOnly === true && manifestKey) {
        await saveJsonSiteRecord(db, row.business_id, row.json_content, {
          r2_json_key: manifestKey,
          r2_json_url: asString(parsed.r2JsonUrl, publicR2Url(env, manifestKey)),
          json_summary: JSON.stringify(parsed.summary && typeof parsed.summary === "object" ? parsed.summary : {}),
        });
        skipped.push({ businessId: row.business_id, reason: "already compact manifest; backfilled r2 columns" });
        continue;
      }

      const businessId = asString(parsed?.meta && typeof parsed.meta === "object" ? (parsed.meta as Record<string, unknown>).businessId : "", row.business_id);
      const key = `sites/${row.business_id}/${row.business_id}.json`;
      const storage = parsed.storage && typeof parsed.storage === "object" ? parsed.storage as Record<string, unknown> : {};
      storage.r2JsonKey = key;
      storage.r2JsonUrl = publicR2Url(env, key);
      parsed.storage = storage;
      const summary = siteSummaryFromJson(parsed, businessId || row.business_id);

      await env.R2.put(key, JSON.stringify(parsed, null, 2), { httpMetadata: { contentType: "application/json; charset=utf-8" } });
      await saveJsonSiteRecord(db, row.business_id, JSON.stringify(compactSiteManifest(parsed, env, row.business_id, key)), {
        r2_json_key: key,
        r2_json_url: publicR2Url(env, key),
        json_summary: JSON.stringify(summary),
      });
      migrated.push({ businessId: row.business_id, r2JsonKey: key });
    } catch (error) {
      failed.push({ businessId: row.business_id, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return json({
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
      const summary = parsed.businessName ? parsed : siteSummaryFromJson(parsed, row.business_id);
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
    return migrateOldSiteJsonRowsToR2(request, db, env);
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
    const siteJson = await readSiteJsonFromStorage(row, env);
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

    try {

    let finalJson = body.jsonContent && typeof body.jsonContent === "object"
      ? body.jsonContent as Record<string, unknown>
      : structuredClone(templateSchema) as Record<string, unknown>;
    let aiGenerated = false;
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

    try {
      const copyPatchResult = await generateAiCopyPatch(db, env, body);
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
    if (!allowedVisualStyles.includes(asString(designConfig.visualStyle))) {
      designConfig.visualStyle = visualStyleForBusiness([
        businessName,
        asString(originData.formatted_address, asString(originData.formattedAddress)),
        Array.isArray(originData.types) ? originData.types.join(" ") : "",
        asString(originData.searchQuery),
      ].filter(Boolean).join(" "));
    }
    if (!designConfig.visualStyleConfig || typeof designConfig.visualStyleConfig !== "object") {
      designConfig.visualStyleConfig = {
        label: asString(designConfig.visualStyle).replace(/-/g, " "),
        description: "Controls shape language, image treatment, borders, and visual edge style on top of the industry preset.",
        allowedValues: allowedVisualStyles,
        selectionRule: "Use the visual structure that best matches the business niche and desired feel.",
      };
    }
    const fontPairingMeta = fontPairingForBusiness([
      businessName,
      asString(originData.formatted_address, asString(originData.formattedAddress)),
      Array.isArray(originData.types) ? originData.types.join(" ") : "",
      asString(originData.searchQuery),
    ].filter(Boolean).join(" "));
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

    ensureGalleryPage(finalJson, originData);
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
    const jsonSummary = siteSummaryFromJson(finalJson, businessId);
    const d1JsonContent = r2JsonKey
      ? JSON.stringify(compactSiteManifest(finalJson, env, businessId, r2JsonKey))
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

    return json({ success: true, businessId });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      jobMetadata.failureStage = "site_generate";
      jobMetadata.failureMessage = message;
      await updateGenerationJob(db, jobId, { status: "failed", error: message, metadata_json: JSON.stringify(jobMetadata) });
      await updateProspectRecord(db, originPlaceId, { last_error: message });
      const statusCode = body.requireAi === true
        ? (/api key|provider and model|required|unsupported/i.test(message) ? 400 : 502)
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
      return json(await readSiteJsonFromStorage(row, env));
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
  const amountCents = 19700;
  const adminWhatsApp = await getSetting(db, env, "ADMIN_WHATSAPP_NUMBER") || "081233838173";
  const apiKey = await getSetting(db, env, "LEMON_SQUEEZY_API_KEY");
  const storeId = await getSetting(db, env, "LEMON_SQUEEZY_STORE_ID");
  const variantId = await getSetting(db, env, "LEMON_SQUEEZY_VARIANT_ID");

  const notifyText = encodeURIComponent(
    `WebView.click checkout request\nBusiness: ${businessName}\nDomain: ${requestedDomain || "-"}\nDomain mode: ${domainMode === "owned" ? "customer-owned domain" : "new domain registration"}\nPackage: $197 domain + hosting 1 year + free setup`,
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
      description: `Domain request: ${requestedDomain || "not provided"} (${domainMode}). Admin WA: ${adminNotifyUrl}`,
    });
  }

  if (!apiKey || !storeId || !variantId) {
    return json({
      success: true,
      mock: true,
      checkoutUrl: "",
      adminNotifyUrl,
      message: "Lemon Squeezy belum dikonfigurasi. Checkout disimpan sebagai mock checkout_pending.",
    });
  }

  const origin = new URL(request.url).origin;
  const checkoutResponse = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
    method: "POST",
    headers: {
      accept: "application/vnd.api+json",
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/vnd.api+json",
    },
    body: JSON.stringify({
      data: {
        type: "checkouts",
        attributes: {
          custom_price: amountCents,
          product_options: {
            name: "WebView.click Domain + Hosting + Free Setup",
            description: "$197 total: domain 1 year, hosting 1 year ($15/month x 12), and free setup.",
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
          store: { data: { type: "stores", id: storeId } },
          variant: { data: { type: "variants", id: variantId } },
        },
      },
    }),
  });

  const checkoutData = await checkoutResponse.json() as { data?: { attributes?: { url?: string } }; errors?: unknown };
  if (!checkoutResponse.ok || !checkoutData.data?.attributes?.url) {
    return json({
      success: false,
      mock: true,
      checkoutUrl: "",
      adminNotifyUrl,
      error: checkoutData.errors || `Lemon Squeezy returned HTTP ${checkoutResponse.status}`,
      message: "Checkout real belum berhasil dibuat. Request tetap dicatat sebagai checkout_pending.",
    }, 502);
  }

  return json({
    success: true,
    mock: false,
    checkoutUrl: checkoutData.data.attributes.url,
    adminNotifyUrl,
  });
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
      return handleGenerationJobs(request, db);
    }

    if (request.method === "GET" && segments[0] === "places" && segments[1] === "photo") {
      return handlePlacesPhoto(url, db, env);
    }

    if (request.method === "GET" && segments[0] === "places" && segments[1] === "details") {
      return handlePlacesDetails(url, db, env);
    }

    if (segments[0] === "places" && segments[1] === "cache") {
      return handlePlacesCache(request, db, segments);
    }

    if (request.method === "GET" && segments[0] === "places" && segments[1] === "history") {
      return handlePlacesHistory(url, db);
    }

    if (request.method === "GET" && segments[0] === "places" && segments[1] === "search") {
      return handlePlacesSearch(url, db, env);
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

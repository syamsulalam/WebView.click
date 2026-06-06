import { addColumnIfMissing, tableColumns, type ColumnSpec } from "./db";
import type { D1Database } from "./types";

export const generateRequiredColumns: ColumnSpec[] = [
  { table: "leads", column: "niche", definition: "TEXT" },
  { table: "leads", column: "phone", definition: "TEXT" },
  { table: "leads", column: "website_url", definition: "TEXT" },
  { table: "leads", column: "rating", definition: "REAL" },
  { table: "leads", column: "reviews", definition: "INTEGER" },
  { table: "leads", column: "address", definition: "TEXT" },
  { table: "leads", column: "status", definition: "TEXT DEFAULT 'scraped'" },
  { table: "leads", column: "view_count", definition: "INTEGER DEFAULT 0" },
  { table: "leads", column: "owner_view_count", definition: "INTEGER DEFAULT 0" },
  { table: "leads", column: "owner_last_viewed_at", definition: "DATETIME" },
  { table: "leads", column: "download_count", definition: "INTEGER DEFAULT 0" },
  { table: "leads", column: "last_downloaded_at", definition: "DATETIME" },
  { table: "leads", column: "setup_followup_contacted_at", definition: "DATETIME" },
  { table: "leads", column: "updated_at", definition: "DATETIME" },
  { table: "json_sites", column: "id", definition: "TEXT" },
  { table: "json_sites", column: "r2_json_key", definition: "TEXT" },
  { table: "json_sites", column: "r2_json_url", definition: "TEXT" },
  { table: "json_sites", column: "json_summary", definition: "TEXT" },
  { table: "json_sites", column: "last_preview_error", definition: "TEXT" },
  { table: "json_sites", column: "last_preview_error_at", definition: "DATETIME" },
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

export const checkoutRequiredColumns: ColumnSpec[] = [
  { table: "leads", column: "niche", definition: "TEXT" },
  { table: "leads", column: "email", definition: "TEXT" },
  { table: "leads", column: "status", definition: "TEXT DEFAULT 'scraped'" },
  { table: "leads", column: "view_count", definition: "INTEGER DEFAULT 0" },
  { table: "leads", column: "download_count", definition: "INTEGER DEFAULT 0" },
  { table: "leads", column: "last_downloaded_at", definition: "DATETIME" },
  { table: "leads", column: "setup_followup_contacted_at", definition: "DATETIME" },
  { table: "leads", column: "updated_at", definition: "DATETIME" },
  { table: "crm_activities", column: "staff_id", definition: "TEXT" },
  { table: "crm_activities", column: "description", definition: "TEXT" },
];

export const paymentLedgerRequiredColumns: ColumnSpec[] = [
  { table: "lead_payments", column: "lead_id", definition: "TEXT" },
  { table: "lead_payments", column: "business_id", definition: "TEXT" },
  { table: "lead_payments", column: "processor", definition: "TEXT" },
  { table: "lead_payments", column: "payment_status", definition: "TEXT DEFAULT 'pending'" },
  { table: "lead_payments", column: "amount_usd", definition: "REAL DEFAULT 0" },
  { table: "lead_payments", column: "amount_idr", definition: "INTEGER DEFAULT 0" },
  { table: "lead_payments", column: "transaction_id", definition: "TEXT" },
  { table: "lead_payments", column: "payer_email", definition: "TEXT" },
  { table: "lead_payments", column: "payment_reference", definition: "TEXT" },
  { table: "lead_payments", column: "proof_notes", definition: "TEXT" },
  { table: "lead_payments", column: "raw_json", definition: "TEXT" },
  { table: "lead_payments", column: "verified_at", definition: "DATETIME" },
  { table: "lead_payments", column: "verified_by", definition: "TEXT" },
  { table: "lead_payments", column: "updated_at", definition: "DATETIME" },
];

export const selectionRequiredColumns: ColumnSpec[] = [
  { table: "places_prospects", column: "selected_photo_json", definition: "TEXT" },
  { table: "places_prospects", column: "selected_palette_json", definition: "TEXT" },
  { table: "places_prospects", column: "palette_options_json", definition: "TEXT" },
  { table: "places_prospects", column: "updated_at", definition: "DATETIME" },
];

export const prospectStatusRequiredColumns: ColumnSpec[] = [
  { table: "places_prospects", column: "status", definition: "TEXT DEFAULT 'new'" },
  { table: "places_prospects", column: "updated_at", definition: "DATETIME" },
];

export const prospectDetailsRequiredColumns: ColumnSpec[] = [
  { table: "places_prospects", column: "details_json", definition: "TEXT" },
  { table: "places_prospects", column: "phone", definition: "TEXT" },
  { table: "places_prospects", column: "website_url", definition: "TEXT" },
  { table: "places_prospects", column: "maps_url", definition: "TEXT" },
  { table: "places_prospects", column: "website_check_status", definition: "TEXT" },
  { table: "places_prospects", column: "website_checked_at", definition: "DATETIME" },
  { table: "places_prospects", column: "details_loaded_at", definition: "DATETIME" },
  { table: "places_prospects", column: "updated_at", definition: "DATETIME" },
];

export const prospectListRequiredColumns: ColumnSpec[] = [
  { table: "places_prospects", column: "website_url", definition: "TEXT" },
  { table: "places_prospects", column: "website_check_status", definition: "TEXT" },
  { table: "places_prospects", column: "website_checked_at", definition: "DATETIME" },
  { table: "places_prospects", column: "palette_options_json", definition: "TEXT" },
  { table: "places_prospects", column: "generated_business_id", definition: "TEXT" },
  { table: "places_prospects", column: "updated_at", definition: "DATETIME" },
];

export const prospectWebsiteCheckRequiredColumns: ColumnSpec[] = [
  { table: "places_prospects", column: "phone", definition: "TEXT" },
  { table: "places_prospects", column: "website_url", definition: "TEXT" },
  { table: "places_prospects", column: "maps_url", definition: "TEXT" },
  { table: "places_prospects", column: "website_check_status", definition: "TEXT" },
  { table: "places_prospects", column: "website_checked_at", definition: "DATETIME" },
  { table: "places_prospects", column: "updated_at", definition: "DATETIME" },
];

export async function setupTables(db: D1Database) {
  const createStatements = [
    "CREATE TABLE IF NOT EXISTS leads (id TEXT PRIMARY KEY, business_id TEXT UNIQUE NOT NULL, business_name TEXT NOT NULL, niche TEXT, email TEXT, phone TEXT, gmb_url TEXT, website_url TEXT, rating REAL, reviews INTEGER, address TEXT, status TEXT DEFAULT 'scraped', view_count INTEGER DEFAULT 0, owner_view_count INTEGER DEFAULT 0, download_count INTEGER DEFAULT 0, last_viewed_at DATETIME, owner_last_viewed_at DATETIME, last_contacted DATETIME, last_downloaded_at DATETIME, setup_followup_contacted_at DATETIME, staff_id TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS subscriptions (id TEXT PRIMARY KEY, lead_id TEXT NOT NULL, package_type TEXT NOT NULL, amount_paid REAL DEFAULT 0.00, payment_status TEXT DEFAULT 'unpaid', payment_method TEXT, payment_reference TEXT, subscription_start_date DATETIME, subscription_end_date DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE)",
    "CREATE TABLE IF NOT EXISTS lead_payments (id TEXT PRIMARY KEY, lead_id TEXT NOT NULL, business_id TEXT, processor TEXT, payment_status TEXT DEFAULT 'pending', amount_usd REAL DEFAULT 0, amount_idr INTEGER DEFAULT 0, transaction_id TEXT, payer_email TEXT, payment_reference TEXT, proof_notes TEXT, raw_json TEXT, verified_at DATETIME, verified_by TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE)",
    "CREATE TABLE IF NOT EXISTS crm_activities (id TEXT PRIMARY KEY, lead_id TEXT NOT NULL, staff_id TEXT, activity_type TEXT NOT NULL, description TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE)",
    "CREATE TABLE IF NOT EXISTS json_sites (id TEXT PRIMARY KEY, business_id TEXT UNIQUE NOT NULL, json_content TEXT NOT NULL, r2_json_key TEXT, r2_json_url TEXT, json_summary TEXT, last_preview_error TEXT, last_preview_error_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS ai_readiness_cache (cache_key TEXT PRIMARY KEY, provider TEXT NOT NULL, model TEXT NOT NULL, key_hash TEXT, validation_json TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, expires_at DATETIME NOT NULL)",
    "CREATE TABLE IF NOT EXISTS daily_usage_counters (usage_date TEXT NOT NULL, counter_key TEXT NOT NULL, count INTEGER DEFAULT 0, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (usage_date, counter_key))",
    "CREATE TABLE IF NOT EXISTS provider_cooldowns (provider_key TEXT PRIMARY KEY, provider TEXT NOT NULL, until_ms INTEGER NOT NULL, reason TEXT, raw_message TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS provider_cooldown_events (id TEXT PRIMARY KEY, provider_key TEXT NOT NULL, provider TEXT NOT NULL, event_type TEXT NOT NULL, cooldown_until_ms INTEGER, reason TEXT, raw_message TEXT, metadata_json TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS marketing_audits (id TEXT PRIMARY KEY, business_id TEXT NOT NULL, place_id TEXT, r2_json_key TEXT NOT NULL, score INTEGER, confidence TEXT, query TEXT, source_hash TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, created_by TEXT)",
    "CREATE TABLE IF NOT EXISTS outreach_events (id TEXT PRIMARY KEY, lead_id TEXT, business_id TEXT NOT NULL, channel TEXT NOT NULL, campaign TEXT, source TEXT, event_type TEXT NOT NULL, tracking_token TEXT, url TEXT, metadata_json TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
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
  await addColumnIfMissing(db, "leads", "owner_view_count", "INTEGER DEFAULT 0");
  await addColumnIfMissing(db, "leads", "owner_last_viewed_at", "DATETIME");
  await addColumnIfMissing(db, "leads", "download_count", "INTEGER DEFAULT 0");
  await addColumnIfMissing(db, "leads", "last_viewed_at", "DATETIME");
  await addColumnIfMissing(db, "leads", "last_downloaded_at", "DATETIME");
  await addColumnIfMissing(db, "leads", "setup_followup_contacted_at", "DATETIME");
  await addColumnIfMissing(db, "leads", "staff_id", "TEXT");
  await addColumnIfMissing(db, "leads", "updated_at", "DATETIME");
  await addColumnIfMissing(db, "lead_payments", "business_id", "TEXT");
  await addColumnIfMissing(db, "lead_payments", "processor", "TEXT");
  await addColumnIfMissing(db, "lead_payments", "payment_status", "TEXT DEFAULT 'pending'");
  await addColumnIfMissing(db, "lead_payments", "amount_usd", "REAL DEFAULT 0");
  await addColumnIfMissing(db, "lead_payments", "amount_idr", "INTEGER DEFAULT 0");
  await addColumnIfMissing(db, "lead_payments", "transaction_id", "TEXT");
  await addColumnIfMissing(db, "lead_payments", "payer_email", "TEXT");
  await addColumnIfMissing(db, "lead_payments", "payment_reference", "TEXT");
  await addColumnIfMissing(db, "lead_payments", "proof_notes", "TEXT");
  await addColumnIfMissing(db, "lead_payments", "raw_json", "TEXT");
  await addColumnIfMissing(db, "lead_payments", "verified_at", "DATETIME");
  await addColumnIfMissing(db, "lead_payments", "verified_by", "TEXT");
  await addColumnIfMissing(db, "lead_payments", "updated_at", "DATETIME");
  await addColumnIfMissing(db, "system_settings", "updated_at", "DATETIME");
  await addColumnIfMissing(db, "json_sites", "updated_at", "DATETIME");
  await addColumnIfMissing(db, "json_sites", "r2_json_key", "TEXT");
  await addColumnIfMissing(db, "json_sites", "r2_json_url", "TEXT");
  await addColumnIfMissing(db, "json_sites", "json_summary", "TEXT");
  await addColumnIfMissing(db, "json_sites", "last_preview_error", "TEXT");
  await addColumnIfMissing(db, "json_sites", "last_preview_error_at", "DATETIME");
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
  await addColumnIfMissing(db, "marketing_audits", "business_id", "TEXT");
  await addColumnIfMissing(db, "marketing_audits", "place_id", "TEXT");
  await addColumnIfMissing(db, "marketing_audits", "r2_json_key", "TEXT");
  await addColumnIfMissing(db, "marketing_audits", "score", "INTEGER");
  await addColumnIfMissing(db, "marketing_audits", "confidence", "TEXT");
  await addColumnIfMissing(db, "marketing_audits", "query", "TEXT");
  await addColumnIfMissing(db, "marketing_audits", "source_hash", "TEXT");
  await addColumnIfMissing(db, "marketing_audits", "created_at", "DATETIME");
  await addColumnIfMissing(db, "marketing_audits", "created_by", "TEXT");
  await addColumnIfMissing(db, "outreach_events", "lead_id", "TEXT");
  await addColumnIfMissing(db, "outreach_events", "business_id", "TEXT");
  await addColumnIfMissing(db, "outreach_events", "channel", "TEXT");
  await addColumnIfMissing(db, "outreach_events", "campaign", "TEXT");
  await addColumnIfMissing(db, "outreach_events", "source", "TEXT");
  await addColumnIfMissing(db, "outreach_events", "event_type", "TEXT");
  await addColumnIfMissing(db, "outreach_events", "tracking_token", "TEXT");
  await addColumnIfMissing(db, "outreach_events", "url", "TEXT");
  await addColumnIfMissing(db, "outreach_events", "metadata_json", "TEXT");
  await addColumnIfMissing(db, "outreach_events", "created_at", "DATETIME");
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

export async function databaseRepairReport(db: D1Database) {
  const startedAt = new Date().toISOString();
  await setupTables(db);
  const tables = ["leads", "subscriptions", "lead_payments", "crm_activities", "json_sites", "system_settings", "ai_readiness_cache", "daily_usage_counters", "provider_cooldowns", "provider_cooldown_events", "marketing_audits", "outreach_events", "places_search_cache", "places_prospects", "generation_jobs"];
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

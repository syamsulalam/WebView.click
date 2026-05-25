import type { D1Database, Env, SettingRow } from "./types";

const dailyUsageLimits = {
  places_search: { label: "Places search", warnAt: 50, dangerAt: 100 },
  places_details: { label: "Places details", warnAt: 250, dangerAt: 500 },
  ai_readiness_remote: { label: "Remote AI readiness", warnAt: 50, dangerAt: 100 },
  site_generation: { label: "Site generation", warnAt: 30, dangerAt: 75 },
} as const;

export type DailyUsageKey = keyof typeof dailyUsageLimits;

export type ColumnSpec = { table: string; column: string; definition: string };

export function getDb(env: Env): D1Database {
  if (!env.DB) {
    throw new Error("Cloudflare D1 binding `DB` is not configured.");
  }
  return env.DB;
}

export async function tableColumns(db: D1Database, table: string): Promise<Set<string>> {
  const rows = await db.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
  return new Set((rows.results || []).map((row) => row.name));
}

export async function addColumnIfMissing(db: D1Database, table: string, column: string, definition: string) {
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

export function isMissingColumnError(error: unknown, column?: string) {
  const message = errorMessage(error).toLowerCase();
  return (message.includes("no column named") || message.includes("no such column")) && (!column || message.includes(column.toLowerCase()));
}

export async function ensureColumn(db: D1Database, table: string, column: string, definition: string) {
  try {
    await addColumnIfMissing(db, table, column, definition);
  } catch (error) {
    console.error(`D1 self-healing failed for ${table}.${column}:`, error);
  }
}

async function ensureRequiredColumn(db: D1Database, table: string, column: string, definition: string) {
  await addColumnIfMissing(db, table, column, definition);
  const columns = await tableColumns(db, table);
  if (!columns.has(column)) {
    throw new Error(`D1 self-healing failed: ${table}.${column} is still missing after ALTER TABLE.`);
  }
}

export async function ensureRequiredColumns(db: D1Database, specs: ColumnSpec[]) {
  for (const spec of specs) {
    await ensureRequiredColumn(db, spec.table, spec.column, spec.definition);
  }
}

export async function upsertLeadRecord(db: D1Database, values: Record<string, unknown>) {
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

export async function saveJsonSiteRecord(db: D1Database, businessId: string, jsonContent: string, options: Record<string, unknown> = {}) {
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

export async function createGenerationJob(db: D1Database, values: Record<string, unknown>) {
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

export async function updateGenerationJob(db: D1Database, jobId: string, values: Record<string, unknown>) {
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

export async function updateProspectRecord(db: D1Database, placeId: string, values: Record<string, unknown>) {
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

export async function insertCrmActivitySafe(db: D1Database, values: Record<string, unknown>) {
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

export async function getSetting(db: D1Database, env: Env, key: keyof Env & string): Promise<string | undefined> {
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

export async function incrementDailyUsage(db: D1Database, counterKey: DailyUsageKey, amount = 1) {
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

export async function getDailyUsage(db: D1Database) {
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

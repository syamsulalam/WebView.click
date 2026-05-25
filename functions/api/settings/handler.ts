import type { D1Database, SettingRow } from "../_shared/types";

export type SettingsDeps = {
  json: (data: unknown, status?: number) => Response;
  errorJson: (error: string, status?: number, details?: unknown) => Response;
  readJsonBody: (request: Request) => Promise<Record<string, unknown>>;
  tableColumns: (db: D1Database, table: string) => Promise<Set<string>>;
};

export async function handleSettings(deps: SettingsDeps, request: Request, db: D1Database): Promise<Response> {
  if (request.method === "GET") {
    try {
      const rows = await db.prepare("SELECT key, value FROM system_settings").all<SettingRow>();
      const settings = Object.fromEntries((rows.results || []).map((row) => [row.key, row.value]));
      return deps.json(settings);
    } catch (error) {
      console.error("Settings fallback:", error);
      return deps.json({});
    }
  }

  if (request.method === "POST") {
    const settings = await deps.readJsonBody(request);
    const columns = await deps.tableColumns(db, "system_settings");
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

    return deps.json({ success: true });
  }

  return deps.errorJson("Method Not Allowed", 405);
}

export async function handlePublicSettings(deps: Pick<SettingsDeps, "json">, db: D1Database): Promise<Response> {
  const rows = await db
    .prepare("SELECT key, value FROM system_settings WHERE key IN ('PAYMENT_LINK_BASIC', 'PAYMENT_LINK_PREMIUM')")
    .all<SettingRow>();
  const settings = Object.fromEntries((rows.results || []).map((row) => [row.key, row.value]));
  return deps.json(settings);
}

import type { D1Database, LeadRow } from "../_shared/types";

export type LeadsDeps = {
  json: (data: unknown, status?: number) => Response;
  errorJson: (error: string, status?: number, details?: unknown) => Response;
  readJsonBody: (request: Request) => Promise<Record<string, unknown>>;
  asString: (value: unknown, fallback?: string) => string;
  tableColumns: (db: D1Database, table: string) => Promise<Set<string>>;
  insertCrmActivitySafe: (db: D1Database, values: Record<string, unknown>) => Promise<void>;
  isMissingColumnError: (error: unknown, column?: string) => boolean;
  ensureColumn: (db: D1Database, table: string, column: string, definition: string) => Promise<void>;
};

export async function handleLeads(deps: LeadsDeps, request: Request, db: D1Database, segments: string[]): Promise<Response> {
  if (request.method === "GET" && segments.length === 1) {
    const leads = await db.prepare("SELECT * FROM leads ORDER BY created_at DESC").all<LeadRow>();
    return deps.json(leads.results || []);
  }

  if (request.method === "PUT" && segments.length === 3 && segments[2] === "status") {
    const id = segments[1];
    const body = await deps.readJsonBody(request);
    const status = deps.asString(body.status, "scraped");
    const staffId = deps.asString(body.staffId, "system");

    const leadColumns = await deps.tableColumns(db, "leads");
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
    await deps.insertCrmActivitySafe(db, {
      id: crypto.randomUUID(),
      lead_id: id,
      staff_id: staffId,
      activity_type: "status_changed",
      description: `Status updated to ${status}`,
    });

    return deps.json({ success: true });
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
      if (!deps.isMissingColumnError(error)) throw error;
      await deps.ensureColumn(db, "leads", "view_count", "INTEGER DEFAULT 0");
      await deps.ensureColumn(db, "leads", "last_viewed_at", "DATETIME");
      await db
        .prepare("UPDATE leads SET status = CASE WHEN status = 'contacted' THEN 'viewed' ELSE status END WHERE business_id = ?")
        .bind(businessId)
        .run();
    }
    return deps.json({ success: true });
  }

  return deps.errorJson("Not Found", 404);
}

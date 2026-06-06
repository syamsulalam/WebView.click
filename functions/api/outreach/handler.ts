import type { D1Database } from "../_shared/types";

export type OutreachDeps = {
  json: (data: unknown, status?: number) => Response;
  errorJson: (error: string, status?: number, details?: unknown) => Response;
  readJsonBody: (request: Request) => Promise<Record<string, unknown>>;
  asString: (value: unknown, fallback?: string) => string;
  insertCrmActivitySafe: (db: D1Database, values: Record<string, unknown>) => Promise<void>;
};

const allowedEvents = new Set([
  "link_created",
  "email_sent_manual",
  "email_sent_api",
  "owner_viewed",
  "reply_positive",
  "reply_negative",
  "opted_out",
]);

function cleanEventType(value: string) {
  const eventType = value.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_");
  return allowedEvents.has(eventType) ? eventType : "link_created";
}

function cleanChannel(value: string) {
  const channel = value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_");
  return channel || "email";
}

function cleanCampaign(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9_.:-]+/g, "-").slice(0, 80) || "free_site_10000";
}

export async function handleOutreach(deps: OutreachDeps, request: Request, db: D1Database, segments: string[]): Promise<Response> {
  if (request.method === "GET" && segments.length === 2 && segments[1] === "summary") {
    const eventRows = await db
      .prepare(
        `SELECT
           business_id,
           MAX(CASE WHEN event_type IN ('email_sent_manual', 'email_sent_api') THEN created_at ELSE NULL END) AS last_sent_at,
           MAX(CASE WHEN event_type = 'link_created' THEN created_at ELSE NULL END) AS last_link_created_at,
           MAX(CASE WHEN event_type = 'owner_viewed' THEN created_at ELSE NULL END) AS last_owner_viewed_at,
           SUM(CASE WHEN event_type IN ('email_sent_manual', 'email_sent_api') THEN 1 ELSE 0 END) AS sent_count,
           SUM(CASE WHEN event_type = 'link_created' THEN 1 ELSE 0 END) AS link_created_count,
           SUM(CASE WHEN event_type = 'owner_viewed' THEN 1 ELSE 0 END) AS owner_view_count
         FROM outreach_events
         GROUP BY business_id`,
      )
      .all<Record<string, unknown>>();

    const totals = await db
      .prepare(
        `SELECT
           COUNT(*) AS event_count,
           COUNT(DISTINCT CASE WHEN event_type IN ('email_sent_manual', 'email_sent_api') THEN business_id END) AS businesses_sent,
           COUNT(DISTINCT CASE WHEN event_type = 'link_created' THEN business_id END) AS links_created,
           COUNT(DISTINCT CASE WHEN event_type = 'owner_viewed' THEN business_id END) AS businesses_viewed
         FROM outreach_events`,
      )
      .first<Record<string, unknown>>();

    return deps.json({
      totals: totals || { event_count: 0, businesses_sent: 0, links_created: 0, businesses_viewed: 0 },
      byBusinessId: eventRows.results || [],
    });
  }

  if (request.method === "POST" && segments.length === 2 && segments[1] === "events") {
    const body = await deps.readJsonBody(request);
    const businessId = deps.asString(body.businessId).trim();
    const leadIdFromBody = deps.asString(body.leadId).trim();
    if (!businessId) return deps.errorJson("businessId is required.", 400);

    const channel = cleanChannel(deps.asString(body.channel, "email"));
    const eventType = cleanEventType(deps.asString(body.eventType, "link_created"));
    const campaign = cleanCampaign(deps.asString(body.campaign, "free_site_10000"));
    const source = deps.asString(body.source, "admin_reachout").trim().slice(0, 120);
    const trackingToken = deps.asString(body.trackingToken).trim().slice(0, 160);
    const url = deps.asString(body.url).trim().slice(0, 2000);
    const metadata = body.metadata && typeof body.metadata === "object" ? body.metadata : {};

    const lead = leadIdFromBody
      ? await db.prepare("SELECT id, business_name, status FROM leads WHERE id = ?").bind(leadIdFromBody).first<{ id: string; business_name?: string; status?: string }>()
      : await db.prepare("SELECT id, business_name, status FROM leads WHERE business_id = ?").bind(businessId).first<{ id: string; business_name?: string; status?: string }>();
    const leadId = lead?.id || leadIdFromBody;
    const now = new Date().toISOString();

    await db
      .prepare(
        `INSERT INTO outreach_events (
          id, lead_id, business_id, channel, campaign, source, event_type, tracking_token, url, metadata_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        leadId || null,
        businessId,
        channel,
        campaign,
        source,
        eventType,
        trackingToken || null,
        url || null,
        JSON.stringify(metadata),
        now,
      )
      .run();

    if (lead?.id && (eventType === "email_sent_manual" || eventType === "email_sent_api")) {
      await db
        .prepare(
          `UPDATE leads
           SET last_contacted = ?,
               updated_at = ?,
               status = CASE WHEN status IN ('won_paid', 'checkout_pending', 'viewed') THEN status ELSE 'contacted' END
           WHERE id = ?`,
        )
        .bind(now, now, lead.id)
        .run();
      await deps.insertCrmActivitySafe(db, {
        id: crypto.randomUUID(),
        lead_id: lead.id,
        staff_id: "admin",
        activity_type: "email_outreach_sent",
        description: `Free-site reachout marked sent via ${channel}. Campaign: ${campaign}.`,
      });
    }

    return deps.json({ success: true, businessId, leadId, eventType, channel, campaign, recordedAt: now });
  }

  return deps.errorJson("Not Found", 404);
}

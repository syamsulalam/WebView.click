import type { D1Database, LeadRow } from "../_shared/types";

export type LeadsDeps = {
  json: (data: unknown, status?: number) => Response;
  errorJson: (error: string, status?: number, details?: unknown) => Response;
  readJsonBody: (request: Request) => Promise<Record<string, unknown>>;
  asString: (value: unknown, fallback?: string) => string;
  tableColumns: (db: D1Database, table: string) => Promise<Set<string>>;
  ensureRequiredColumns: (db: D1Database, specs: unknown[]) => Promise<void>;
  paymentLedgerRequiredColumns: unknown[];
  insertCrmActivitySafe: (db: D1Database, values: Record<string, unknown>) => Promise<void>;
  isMissingColumnError: (error: unknown, column?: string) => boolean;
  ensureColumn: (db: D1Database, table: string, column: string, definition: string) => Promise<void>;
};

function paymentRowsQuery(whereClause = "") {
  const ownerTrackedPayment = "(p.payment_status <> 'pending' OR COALESCE(p.raw_json, '') LIKE '%\"crmOwnerSession\":true%')";
  return `
    SELECT
      p.*,
      l.business_name,
      l.email AS lead_email,
      l.status AS lead_status,
      l.created_at AS lead_created_at
    FROM lead_payments p
    LEFT JOIN leads l ON l.id = p.lead_id
    WHERE ${ownerTrackedPayment}${whereClause ? ` AND ${whereClause}` : ""}
    ORDER BY datetime(COALESCE(p.verified_at, p.updated_at, p.created_at)) DESC
  `;
}

function csvValue(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function paymentRowsCsv(rows: Array<Record<string, unknown>>) {
  const headers = [
    "business_name",
    "business_id",
    "lead_status",
    "processor",
    "payment_status",
    "amount_usd",
    "transaction_id",
    "payer_email",
    "payment_reference",
    "proof_notes",
    "verified_at",
  ];
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvValue(row[header])).join(",")),
  ].join("\n");
}

function realOwnerRequest(request: Request) {
  const url = new URL(request.url);
  return (url.searchParams.get("owner") === "1" || url.searchParams.get("review") === "owner" || url.searchParams.get("claim") === "1")
    && url.searchParams.get("ownerPreview") !== "1"
    && url.searchParams.get("reviewPreview") !== "1";
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return /^\+?[0-9\s().-]{7,20}$/.test(value) && digits.length >= 7 && digits.length <= 15 && !/^1?0{7,}$/.test(digits);
}

export async function handleLeads(deps: LeadsDeps, request: Request, db: D1Database, segments: string[]): Promise<Response> {
  if (request.method === "GET" && segments.length === 1) {
    let leads;
    try {
      await deps.ensureColumn(db, "leads", "owner_view_count", "INTEGER DEFAULT 0");
      await deps.ensureColumn(db, "leads", "owner_last_viewed_at", "DATETIME");
      leads = await db.prepare(`
        SELECT
          l.*,
          l.owner_view_count,
          l.owner_last_viewed_at,
          p.payment_status,
          p.processor AS payment_processor,
          p.amount_usd AS payment_amount_usd,
          p.transaction_id AS payment_transaction_id,
          p.payer_email AS payment_payer_email,
          p.payment_reference,
          p.proof_notes AS payment_proof_notes,
          p.verified_at AS payment_verified_at
        FROM leads l
        LEFT JOIN lead_payments p ON p.id = (
          SELECT latest.id
          FROM lead_payments latest
          WHERE latest.lead_id = l.id
            AND (latest.payment_status <> 'pending' OR COALESCE(latest.raw_json, '') LIKE '%"crmOwnerSession":true%')
          ORDER BY datetime(COALESCE(latest.verified_at, latest.updated_at, latest.created_at)) DESC
          LIMIT 1
        )
        ORDER BY datetime(l.created_at) DESC
      `).all<LeadRow>();
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
      if (!deps.isMissingColumnError(error) && !message.includes("no such table: lead_payments")) throw error;
      leads = await db.prepare("SELECT * FROM leads ORDER BY created_at DESC").all<LeadRow>();
    }
    const rows = (leads.results || []).map((lead: Record<string, unknown>) => {
      const ownerViewCount = Number(lead.owner_view_count || 0) || 0;
      const paymentStatus = String(lead.payment_status || "");
      const resetCheckoutPending = lead.status === "checkout_pending" && paymentStatus !== "pending" && paymentStatus !== "paid";
      const resetViewed = lead.status === "viewed" && ownerViewCount <= 0;
      return {
        ...lead,
        status: resetCheckoutPending || resetViewed ? (ownerViewCount > 0 ? "viewed" : (lead.last_contacted ? "contacted" : "scraped")) : lead.status,
        view_count: ownerViewCount,
        last_viewed_at: lead.owner_last_viewed_at || null,
      };
    });
    return deps.json(rows);
  }

  if (request.method === "GET" && segments.length === 2 && segments[1] === "payments") {
    await deps.ensureRequiredColumns(db, deps.paymentLedgerRequiredColumns);
    const url = new URL(request.url);
    const status = deps.asString(url.searchParams.get("status"));
    const rows = status
      ? await db.prepare(paymentRowsQuery("p.payment_status = ?")).bind(status).all<Record<string, unknown>>()
      : await db.prepare(paymentRowsQuery()).all<Record<string, unknown>>();
    if (url.searchParams.get("format") === "csv") {
      return new Response(paymentRowsCsv(rows.results || []), {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="webview-payment-ledger-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }
    return deps.json(rows.results || []);
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

  if (request.method === "PUT" && segments.length === 3 && segments[2] === "contact") {
    const id = segments[1];
    const body = await deps.readJsonBody(request);
    const email = deps.asString(body.email).trim();
    const phone = deps.asString(body.phone).trim();
    const staffId = deps.asString(body.staffId, "admin");

    if (email && (!validEmail(email) || /^hello@example\.com$/i.test(email))) return deps.errorJson("Enter a valid email address.", 400);
    if (phone && !validPhone(phone)) return deps.errorJson("Enter a valid phone number with 7-15 digits.", 400);
    if (!email && !phone) return deps.errorJson("Email or phone is required.", 400);

    await deps.ensureColumn(db, "leads", "email", "TEXT");
    await deps.ensureColumn(db, "leads", "phone", "TEXT");
    await deps.ensureColumn(db, "leads", "updated_at", "DATETIME");
    const updates = [
      email ? { column: "email", value: email } : null,
      phone ? { column: "phone", value: phone } : null,
      { column: "updated_at", value: new Date().toISOString() },
    ].filter(Boolean) as Array<{ column: string; value: unknown }>;
    await db.prepare(`UPDATE leads SET ${updates.map((item) => `${item.column} = ?`).join(", ")} WHERE id = ?`).bind(...updates.map((item) => item.value), id).run();
    await deps.insertCrmActivitySafe(db, {
      id: crypto.randomUUID(),
      lead_id: id,
      staff_id: staffId,
      activity_type: "contact_updated",
      description: `${email ? "Email updated. " : ""}${phone ? "Phone updated." : ""}`.trim(),
    });

    return deps.json({ success: true, email, phone });
  }

  if (request.method === "POST" && segments.length === 3 && segments[2] === "payment-verified") {
    await deps.ensureRequiredColumns(db, deps.paymentLedgerRequiredColumns);
    const id = segments[1];
    const body = await deps.readJsonBody(request);
    const processor = deps.asString(body.processor, "paypal");
    const transactionId = deps.asString(body.transactionId).trim();
    const payerEmail = deps.asString(body.payerEmail).trim();
    const paymentReference = deps.asString(body.paymentReference).trim();
    const proofNotes = deps.asString(body.proofNotes).trim();
    const verifiedBy = deps.asString(body.verifiedBy, "admin");
    const amountUsd = Math.max(0, Number(body.amountUsd || 0) || 0);
    const amountIdr = Math.max(0, Math.round(Number(body.amountIdr || 0) || 0));

    if (!transactionId) return deps.errorJson("Transaction ID is required.", 400);
    if (!amountUsd) return deps.errorJson("Amount USD must be greater than 0.", 400);

    const lead = await db.prepare("SELECT id, business_id, business_name, email FROM leads WHERE id = ?").bind(id).first<{
      id: string;
      business_id: string;
      business_name: string;
      email?: string;
    }>();
    if (!lead?.id) return deps.errorJson("Lead not found.", 404);

    const verifiedAt = new Date().toISOString();
    const existingTransaction = await db.prepare("SELECT id, payment_status FROM lead_payments WHERE transaction_id = ? AND transaction_id <> '' LIMIT 1").bind(transactionId).first<{ id: string; payment_status?: string }>();
    if (existingTransaction?.id && existingTransaction.payment_status === "paid") {
      return deps.errorJson("This transaction ID is already recorded as paid.", 409);
    }
    const pendingPayment = await db
      .prepare(
        `SELECT id FROM lead_payments
         WHERE lead_id = ? AND payment_status = 'pending' AND (? = '' OR payment_reference = ?)
         ORDER BY datetime(created_at) DESC
         LIMIT 1`,
      )
      .bind(lead.id, paymentReference, paymentReference)
      .first<{ id: string }>();
    const paymentId = pendingPayment?.id || crypto.randomUUID();
    if (pendingPayment?.id) {
      await db
        .prepare(
          `UPDATE lead_payments
           SET processor = ?, payment_status = 'paid', amount_usd = ?, amount_idr = ?, transaction_id = ?, payer_email = ?,
               payment_reference = COALESCE(NULLIF(?, ''), payment_reference), proof_notes = ?, raw_json = ?, verified_at = ?, verified_by = ?, updated_at = ?
           WHERE id = ?`,
        )
        .bind(
          processor,
          amountUsd,
          amountIdr,
          transactionId,
          payerEmail,
          paymentReference,
          proofNotes,
          JSON.stringify({ source: "admin_manual_verification", processor, transactionId, payerEmail, paymentReference, proofNotes }),
          verifiedAt,
          verifiedBy,
          verifiedAt,
          paymentId,
        )
        .run();
    } else {
      await db
        .prepare(
          `INSERT INTO lead_payments (
            id, lead_id, business_id, processor, payment_status, amount_usd, amount_idr,
            transaction_id, payer_email, payment_reference, proof_notes, raw_json, verified_at, verified_by, updated_at
          ) VALUES (?, ?, ?, ?, 'paid', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          paymentId,
          lead.id,
          lead.business_id,
          processor,
          amountUsd,
          amountIdr,
          transactionId,
          payerEmail,
          paymentReference,
          proofNotes,
          JSON.stringify({ source: "admin_manual_verification", processor, transactionId, payerEmail, paymentReference, proofNotes }),
          verifiedAt,
          verifiedBy,
          verifiedAt,
        )
        .run();
    }

    const subscription = await db.prepare("SELECT id FROM subscriptions WHERE lead_id = ? ORDER BY datetime(created_at) DESC LIMIT 1").bind(lead.id).first<{ id: string }>();
    if (subscription?.id) {
      await db
        .prepare(
          `UPDATE subscriptions
           SET package_type = ?, amount_paid = ?, payment_status = 'paid', payment_method = ?, payment_reference = ?, subscription_start_date = COALESCE(subscription_start_date, ?), updated_at = ?
           WHERE id = ?`,
        )
        .bind("managed_launch_support", amountUsd, processor, transactionId, verifiedAt, verifiedAt, subscription.id)
        .run();
    } else {
      await db
        .prepare(
          `INSERT INTO subscriptions (id, lead_id, package_type, amount_paid, payment_status, payment_method, payment_reference, subscription_start_date, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'paid', ?, ?, ?, ?, ?)`,
        )
        .bind(crypto.randomUUID(), lead.id, "managed_launch_support", amountUsd, processor, transactionId, verifiedAt, verifiedAt, verifiedAt)
        .run();
    }

    await db
      .prepare("UPDATE leads SET status = 'won_paid', email = COALESCE(NULLIF(?, ''), email), updated_at = ? WHERE id = ?")
      .bind(payerEmail, verifiedAt, lead.id)
      .run();

    await deps.insertCrmActivitySafe(db, {
      id: crypto.randomUUID(),
      lead_id: lead.id,
      staff_id: verifiedBy,
      activity_type: "payment_verified",
      description: `Payment verified via ${processor}. Amount: $${amountUsd}. Transaction: ${transactionId}. Payer: ${payerEmail || "not recorded"}. Reference: ${paymentReference || "not recorded"}. Notes: ${proofNotes || "-"}`,
    });

    return deps.json({
      success: true,
      payment: {
        id: paymentId,
        leadId: lead.id,
        businessId: lead.business_id,
        processor,
        paymentStatus: "paid",
        amountUsd,
        amountIdr,
        transactionId,
        payerEmail,
        paymentReference,
        proofNotes,
        verifiedAt,
      },
    });
  }

  if (request.method === "POST" && segments.length === 3 && segments[2] === "ping") {
    const businessId = segments[1];
    if (!realOwnerRequest(request)) return deps.json({ success: true, tracked: false, reason: "not_owner_review_url" });
    const url = new URL(request.url);
    const channel = deps.asString(url.searchParams.get("wv_channel"), deps.asString(url.searchParams.get("utm_medium"), "unknown")).trim().slice(0, 80) || "unknown";
    const source = deps.asString(url.searchParams.get("wv_source"), deps.asString(url.searchParams.get("utm_source"), "public_preview")).trim().slice(0, 120);
    const campaign = deps.asString(url.searchParams.get("wv_campaign"), deps.asString(url.searchParams.get("utm_campaign"), "free_site_10000")).trim().slice(0, 120);
    const trackingToken = deps.asString(url.searchParams.get("wv_token")).trim().slice(0, 160);
    const leadIdParam = deps.asString(url.searchParams.get("wv_lead")).trim().slice(0, 160);
    try {
      await db
        .prepare(
          `UPDATE leads
           SET owner_view_count = COALESCE(owner_view_count, 0) + 1,
               owner_last_viewed_at = CURRENT_TIMESTAMP,
               status = CASE WHEN status = 'contacted' THEN 'viewed' ELSE status END
           WHERE business_id = ?`,
        )
        .bind(businessId)
        .run();
      const lead = await db.prepare("SELECT id FROM leads WHERE business_id = ?").bind(businessId).first<{ id: string }>();
      await db
        .prepare(
          `INSERT INTO outreach_events (
            id, lead_id, business_id, channel, campaign, source, event_type, tracking_token, url, metadata_json, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'owner_viewed', ?, ?, ?, CURRENT_TIMESTAMP)`,
        )
        .bind(
          crypto.randomUUID(),
          lead?.id || leadIdParam || null,
          businessId,
          channel,
          campaign,
          source,
          trackingToken || null,
          request.url,
          JSON.stringify({ source: "public_owner_ping" }),
        )
        .run();
    } catch (error) {
      if (!deps.isMissingColumnError(error)) throw error;
      await deps.ensureColumn(db, "leads", "view_count", "INTEGER DEFAULT 0");
      await deps.ensureColumn(db, "leads", "last_viewed_at", "DATETIME");
      await deps.ensureColumn(db, "leads", "owner_view_count", "INTEGER DEFAULT 0");
      await deps.ensureColumn(db, "leads", "owner_last_viewed_at", "DATETIME");
      await db
        .prepare("UPDATE leads SET owner_view_count = COALESCE(owner_view_count, 0) + 1, owner_last_viewed_at = CURRENT_TIMESTAMP, status = CASE WHEN status = 'contacted' THEN 'viewed' ELSE status END WHERE business_id = ?")
        .bind(businessId)
        .run();
    }
    return deps.json({ success: true });
  }

  return deps.errorJson("Not Found", 404);
}

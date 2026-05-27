import type { D1Database, SettingRow } from "../_shared/types";

export type SettingsDeps = {
  json: (data: unknown, status?: number) => Response;
  errorJson: (error: string, status?: number, details?: unknown) => Response;
  readJsonBody: (request: Request) => Promise<Record<string, unknown>>;
  tableColumns: (db: D1Database, table: string) => Promise<Set<string>>;
};

export async function handleSettings(deps: SettingsDeps, request: Request, db: D1Database): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname.endsWith("/settings/paypal-plan-cache")) {
    try {
      const rows = await db
        .prepare("SELECT key, value, updated_at FROM system_settings WHERE key LIKE 'PAYPAL_SUBSCRIPTION_PLAN__%' ORDER BY updated_at DESC")
        .all<SettingRow & { updated_at?: string }>();
      const plans = (rows.results || []).map((row) => {
        let parsed: Record<string, unknown> = {};
        try {
          parsed = JSON.parse(row.value || "{}") as Record<string, unknown>;
        } catch {
          parsed = {};
        }
        return {
          key: row.key,
          mode: String(parsed.mode || ""),
          domainMode: String(parsed.domainMode || ""),
          termYears: Number(parsed.termYears || 0),
          annualUsd: Number(parsed.annualUsd || 0),
          hostingAfterDiscountUsd: Number(parsed.hostingAfterDiscountUsd || 0),
          domainAnnualUsd: Number(parsed.domainAnnualUsd || 0),
          setupFeeUsd: Number(parsed.setupFeeUsd || 0),
          planId: String(parsed.planId || ""),
          productId: String(parsed.productId || ""),
          planStatus: String(parsed.planStatus || ""),
          updatedAt: String(parsed.updatedAt || row.updated_at || ""),
        };
      });
      return deps.json({ success: true, plans });
    } catch (error) {
      console.error("PayPal plan cache fetch failed:", error);
      return deps.json({ success: true, plans: [] });
    }
  }

  if (request.method === "GET" && url.pathname.endsWith("/settings/payment-smoke")) {
    const recordFrom = (value: unknown): Record<string, unknown> => (
      value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
    );
    const stringFrom = (...values: unknown[]) => values.map((value) => String(value || "").trim()).find(Boolean) || "";

    try {
      const rows = await db
        .prepare(
          `SELECT processor, payment_status, amount_usd, transaction_id, payment_reference, payer_email, proof_notes, verified_at, updated_at, raw_json
           FROM lead_payments
           WHERE processor = 'paypal' AND payment_status = 'paid'
           ORDER BY datetime(COALESCE(verified_at, updated_at)) DESC
           LIMIT 20`,
        )
        .all<{
          processor?: string;
          payment_status?: string;
          amount_usd?: number;
          transaction_id?: string;
          payment_reference?: string;
          payer_email?: string;
          proof_notes?: string;
          verified_at?: string;
          updated_at?: string;
          raw_json?: string;
        }>();
      const events = (rows.results || []).map((row) => {
        let raw: Record<string, unknown> = {};
        try {
          raw = JSON.parse(row.raw_json || "{}") as Record<string, unknown>;
        } catch {
          raw = {};
        }
        const order = recordFrom(raw.order);
        const paypalSubscription = recordFrom(raw.paypalSubscription);
        const event = recordFrom(raw.event);
        const eventResource = recordFrom(event.resource);
        const paypalOrderId = stringFrom(order.id);
        const paypalSubscriptionId = stringFrom(paypalSubscription.id, eventResource.billing_agreement_id);
        const referenceCandidates = [
          row.transaction_id,
          row.payment_reference,
          paypalOrderId,
          paypalSubscriptionId,
          stringFrom(raw.paymentReference),
        ].map((value) => String(value || "").trim()).filter(Boolean);
        return {
          processor: row.processor || "paypal",
          status: row.payment_status || "",
          amountUsd: Number(row.amount_usd || 0),
          transactionId: row.transaction_id || "",
          paymentReference: row.payment_reference || "",
          payerEmail: row.payer_email || "",
          proofNotes: row.proof_notes || "",
          source: String(raw.source || ""),
          paypalOrderId,
          paypalSubscriptionId,
          referenceCandidates,
          verifiedAt: row.verified_at || "",
          updatedAt: row.updated_at || "",
          isSubscription: String(raw.source || "").includes("subscription") || String(row.proof_notes || "").toLowerCase().includes("subscription"),
        };
      });
      return deps.json({ success: true, events });
    } catch (error) {
      console.error("Payment smoke fetch failed:", error);
      return deps.json({ success: true, events: [] });
    }
  }

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

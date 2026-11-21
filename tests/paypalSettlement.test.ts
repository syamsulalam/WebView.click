import assert from "node:assert/strict";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import test from "node:test";
import { asString, errorJson, json, readJsonBody } from "../functions/api/_shared/response";
import { setupTables } from "../functions/api/_shared/schema";
import { handlePayments, type PaymentsDeps } from "../functions/api/payments/handler";

test("subscription approval awaits settlement and an early sale can be retried once", async (t) => {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  const reference = "example | local-order";
  const subscriptionId = "I-EXAMPLE";
  const subscription = { id: subscriptionId, custom_id: reference, plan_id: "P-EXAMPLE", status: "ACTIVE" };
  const db = {
    async exec(query: string) { sqlite.exec(query); },
    prepare(query: string) {
      let values: SQLInputValue[] = [];
      return {
        bind(...params: SQLInputValue[]) { values = params; return this; },
        async first() { return sqlite.prepare(query).get(...values) ?? null; },
        async all() { return { results: sqlite.prepare(query).all(...values) }; },
        async run() { return sqlite.prepare(query).run(...values); },
      };
    },
    async batch(statements: Array<{ run: () => Promise<unknown> }>) {
      sqlite.exec("BEGIN");
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
  await setupTables(db as never);
  sqlite.exec("INSERT INTO leads (id, business_id, business_name, status) VALUES ('lead', 'example', 'Example', 'contacted')");
  sqlite.prepare(`INSERT INTO lead_payments (id, lead_id, business_id, processor, payment_status, amount_usd, payment_reference, raw_json)
    VALUES ('pending', 'lead', 'example', 'paypal', 'pending', 197, ?, ?)`)
    .run(reference, JSON.stringify({ paypalMode: "sandbox", paypalSubscriptionPlanId: "P-EXAMPLE", pricing: { annualDiscountedUsd: 197 } }));
  const settings: Record<string, string> = {
    PAYPAL_SANDBOX_CLIENT_ID: "mock-client",
    PAYPAL_SANDBOX_CLIENT_SECRET: "mock-secret",
    PAYPAL_SANDBOX_WEBHOOK_ID: "mock-webhook",
  };
  const deps: PaymentsDeps = {
    asString, errorJson, json, readJsonBody, ensureRequiredColumns: async () => {},
    checkoutRequiredColumns: [], paymentLedgerRequiredColumns: [], getSetting: async (_, __, key) => settings[key],
    upsertLeadRecord: async () => {}, insertCrmActivitySafe: async () => {},
  };
  t.mock.method(globalThis, "fetch", async (input: URL | string) => {
    const url = String(input);
    if (url.endsWith("/v1/oauth2/token")) return Response.json({ access_token: "mock-token" });
    if (url.endsWith("/verify-webhook-signature")) return Response.json({ verification_status: "SUCCESS" });
    if (url.endsWith(`/billing/subscriptions/${subscriptionId}`)) return Response.json(subscription);
    assert.fail("Unexpected provider call");
  });
  const post = (action: string, body: unknown) => handlePayments(deps, new Request(`https://webview.click/api/payments/${action}`, {
    method: "POST",
    headers: {
      "content-type": "application/json", "paypal-auth-algo": "mock", "paypal-cert-url": "mock",
      "paypal-transmission-id": "mock", "paypal-transmission-sig": "mock", "paypal-transmission-time": "mock",
    },
    body: JSON.stringify(body),
  }), db as never, {}, ["payments", action]);
  const sale = { event_type: "PAYMENT.SALE.COMPLETED", resource: {
    id: "SETTLEMENT1", billing_agreement_id: subscriptionId, state: "completed", amount: { total: "197.00", currency: "USD" },
  } };
  assert.equal((await post("paypal-webhook", sale)).status, 503);
  const approval = await post("paypal-subscription-approved", { paymentReference: reference, subscriptionId });
  assert.equal((await approval.json()).status, "awaiting_settlement");
  assert.equal(sqlite.prepare("SELECT status FROM leads WHERE id = 'lead'").get()?.status, "contacted");
  assert.equal((await post("paypal-webhook", sale)).status, 200);
  assert.equal((await post("paypal-webhook", sale)).status, 200);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM lead_payments WHERE payment_status = 'paid'").get()?.count, 1);
  assert.equal(sqlite.prepare("SELECT amount_paid FROM subscriptions").get()?.amount_paid, 197);
  assert.equal(sqlite.prepare("SELECT status FROM leads WHERE id = 'lead'").get()?.status, "won_paid");
});

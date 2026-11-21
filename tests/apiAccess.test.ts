import assert from "node:assert/strict";
import test from "node:test";
import { onRequest } from "../functions/api/[[path]]";
import { isPublicApiRequest } from "../functions/api/_shared/adminAccess";
import { isCredentialSetting } from "../functions/api/_shared/secrets";

test("public API routes match exact methods and paths", () => {
  const classify = (method: string, path: string, query = "") =>
    isPublicApiRequest(method, path.split("/"), new URLSearchParams(query));
  assert.equal(classify("GET", "sites/example-site"), true);
  assert.equal(classify("POST", "payments/checkout"), true);
  assert.equal(classify("POST", "payments/paypal-webhook"), true);
  assert.equal(classify("GET", "audits/example-site"), true);
  assert.equal(classify("GET", "audits/example-site", "snapshot=example"), false);
  assert.equal(classify("POST", "sites/generate"), false);
  assert.equal(classify("POST", "sites/example-site/screenshot"), false);
  assert.equal(classify("POST", "payments/checkout/private"), false);
  assert.equal(classify("GET", "settings"), false);
});

test("missing Clerk bindings fail closed before database access", async () => {
  const env = { get DB(): never { throw new Error("Unexpected database access"); } };
  const request = new Request("https://webview.click/api/settings");
  const response = await onRequest({ request, env });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const health = await onRequest({ request: new Request("https://webview.click/api"), env });
  assert.equal(health.status, 200);
});

test("credential detection covers stored provider secrets", () => {
  for (const key of ["CLOUDFLARE_API_TOKEN", "GEMINI_API_KEY", "PAYPAL_LIVE_CLIENT_SECRET", "SPACESHIP_API_SECRET", "CLERK_SECRET_KEY", "MIDTRANS_SERVER_KEY"]) {
    assert.equal(isCredentialSetting(key), true, key);
  }
  assert.equal(isCredentialSetting("PAYMENT_LINK_BASIC"), false);
});

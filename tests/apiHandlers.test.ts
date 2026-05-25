import assert from "node:assert/strict";
import test from "node:test";
import { ensureRequiredColumns, tableColumns } from "../functions/api/_shared/db";
import { asString, errorJson, json, normalizeBusinessId, parseJsonArray, parseJsonObject, readJsonBody, sha256Json } from "../functions/api/_shared/response";
import { handlePayments } from "../functions/api/payments/handler";
import { handleProspects } from "../functions/api/prospects/handler";
import { handleSites, type SitesHandlerDeps } from "../functions/api/sites/handler";
import type { PlacesDeps } from "../functions/api/places/handler";

type ProspectRow = {
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

class ProspectStatement {
  values: unknown[] = [];

  constructor(private rows: ProspectRow[]) {}

  bind(...values: unknown[]) {
    this.values = values;
    return this;
  }

  async all<T>() {
    const [
      status,
      ,
      website,
      ,
      ,
      ,
      query,
      ,
      minRating,
      ,
      minReviews,
      ,
      city,
      ,
      state,
      ,
      niche,
    ] = this.values;

    const normalized = (value: unknown) => String(value || "").toLowerCase();
    const results = this.rows.filter((row) => {
      const text = normalized(`${row.business_name} ${row.address || ""} ${row.query || ""}`);
      if (status && row.status !== status) return false;
      if (website === "none" && !(!row.website_url && row.website_check_status === "no_website")) return false;
      if (website === "unknown" && !(!row.website_url && !row.website_check_status)) return false;
      if (website === "has" && !row.website_url) return false;
      if (query && !text.includes(normalized(query))) return false;
      if (typeof minRating === "number" && Number(row.rating || 0) < minRating) return false;
      if (typeof minReviews === "number" && Number(row.reviews || 0) < minReviews) return false;
      if (city && !normalized(row.address).includes(normalized(city))) return false;
      if (state && !normalized(row.address).includes(normalized(state))) return false;
      if (niche && !normalized(row.niche).includes(normalized(niche))) return false;
      return true;
    });
    return { results: results as T[] };
  }
}

class ProspectDb {
  lastStatement?: ProspectStatement;

  constructor(private rows: ProspectRow[]) {}

  prepare() {
    this.lastStatement = new ProspectStatement(this.rows);
    return this.lastStatement;
  }
}

function placesDeps(): PlacesDeps {
  return {
    json,
    errorJson,
    readJsonBody,
    asString,
    parseJsonObject,
    parseJsonArray,
    tableColumns: async () => new Set<string>(),
    ensureRequiredColumns: async () => undefined,
    updateProspectRecord: async () => undefined,
    getSetting: async () => undefined,
    incrementDailyUsage: async () => undefined,
    isMissingColumnError: () => false,
    prospectListRequiredColumns: [],
    prospectWebsiteCheckRequiredColumns: [],
    prospectDetailsRequiredColumns: [],
    prospectStatusRequiredColumns: [],
  };
}

test("prospects handler applies list filters and returns normalized prospect rows", async () => {
  const requiredColumnCalls: unknown[][] = [];
  const db = new ProspectDb([
    {
      place_id: "place-good",
      query: "roof repair dallas",
      business_name: "North Dallas Roof Repair",
      address: "100 Main St, Dallas, TX",
      phone: "555-0100",
      rating: 4.8,
      reviews: 86,
      niche: "roofing_contractor",
      status: "new",
      result_json: JSON.stringify({ business_status: "OPERATIONAL" }),
      selected_palette_json: JSON.stringify(["#111111", "#eeeeee"]),
      palette_options_json: JSON.stringify([{ source: "photo", colors: ["#111111"] }]),
      website_check_status: "no_website",
    },
    {
      place_id: "place-low-rating",
      query: "roof repair dallas",
      business_name: "Budget Roof Patch",
      address: "200 Side St, Dallas, TX",
      rating: 3.9,
      reviews: 120,
      niche: "roofing_contractor",
      status: "new",
      website_check_status: "no_website",
    },
    {
      place_id: "place-has-site",
      query: "roof repair dallas",
      business_name: "Plano Roof Co",
      address: "10 Plano Rd, Plano, TX",
      website_url: "https://example.com",
      rating: 4.9,
      reviews: 200,
      niche: "roofing_contractor",
      status: "new",
      website_check_status: "has_website",
    },
  ]);

  const response = await handleProspects({
    json,
    errorJson,
    readJsonBody,
    asString,
    ensureRequiredColumns: async (_db, specs) => {
      requiredColumnCalls.push(specs);
    },
    updateProspectRecord: async () => undefined,
    placesDeps: placesDeps(),
    prospectListRequiredColumns: [{ table: "places_prospects", column: "website_url", definition: "TEXT" }],
    prospectStatusRequiredColumns: [],
    selectionRequiredColumns: [],
  }, new Request("https://webview.click/api/prospects?status=new&website=none&query=roof&minRating=4.5&minReviews=50&city=dallas&state=tx&niche=roofing"), db as never, ["prospects"], new URL("https://webview.click/api/prospects?status=new&website=none&query=roof&minRating=4.5&minReviews=50&city=dallas&state=tx&niche=roofing"));

  assert.equal(response.status, 200);
  const payload = await response.json() as Array<Record<string, unknown>>;
  assert.equal(payload.length, 1);
  assert.equal(payload[0].place_id, "place-good");
  assert.equal(payload[0].name, "North Dallas Roof Repair");
  assert.equal(payload[0].websiteCheckStatus, "no_website");
  assert.deepEqual(payload[0].selectedPalette, ["#111111", "#eeeeee"]);
  assert.equal(requiredColumnCalls.length, 1);
  assert.equal(db.lastStatement?.values[0], "new");
  assert.equal(db.lastStatement?.values[2], "none");
  assert.equal(db.lastStatement?.values[8], 4.5);
  assert.equal(db.lastStatement?.values[10], 50);
});

test("sites generate endpoint saves site JSON and updates job, lead, prospect, and activity records", async () => {
  const calls = {
    requiredColumns: [] as unknown[][],
    createdJobs: [] as Array<Record<string, unknown>>,
    updatedJobs: [] as Array<{ jobId: string; values: Record<string, unknown> }>,
    usage: [] as string[],
    leads: [] as Array<Record<string, unknown>>,
    prospects: [] as Array<{ placeId: string; values: Record<string, unknown> }>,
    activities: [] as Array<Record<string, unknown>>,
    sites: [] as Array<{ businessId: string; jsonContent: string; options: Record<string, unknown> }>,
  };

  const deps: SitesHandlerDeps = {
    templateSchema: {},
    json,
    errorJson,
    readJsonBody,
    asString,
    normalizeBusinessId,
    placeIdFromPlace: (place) => asString((place as Record<string, unknown>).place_id),
    parseJsonObject,
    tableColumns: async () => new Set(["business_id", "json_content"]),
    ensureRequiredColumns: async (_db, specs) => {
      calls.requiredColumns.push(specs);
    },
    generateRequiredColumns: [{ table: "json_sites", column: "json_summary", definition: "TEXT" }],
    createGenerationJob: async (_db, values) => {
      calls.createdJobs.push(values);
    },
    updateGenerationJob: async (_db, jobId, values) => {
      calls.updatedJobs.push({ jobId, values });
    },
    incrementDailyUsage: async (_db, key) => {
      calls.usage.push(key);
    },
    updateProspectRecord: async (_db, placeId, values) => {
      calls.prospects.push({ placeId, values });
    },
    upsertLeadRecord: async (_db, values) => {
      calls.leads.push(values);
    },
    insertCrmActivitySafe: async (_db, values) => {
      calls.activities.push(values);
    },
    saveJsonSiteRecord: async (_db, businessId, jsonContent, options = {}) => {
      calls.sites.push({ businessId, jsonContent, options });
    },
    siteStorageDeps: {
      json,
      errorJson,
      readJsonBody,
      asString,
      parseJsonObject,
      ensureRequiredColumns,
      saveJsonSiteRecord: async () => undefined,
    },
    aiSiteGenerationDeps: {
      getSetting: async () => undefined,
      getAiReadiness: async () => ({ ready: true }),
      buildAiFailureDiagnostics: (input: Record<string, unknown>) => input,
      extractProviderErrorDetails: () => ({ message: "", rawSnippet: "", providerCode: "", providerStatus: "" }),
      kieModelConfigs: {},
    },
    sha256Json,
  };

  const db = {
    prepare(query: string) {
      return {
        bind() {
          return this;
        },
        async first() {
          if (query.includes("SELECT id FROM leads")) return { id: "lead-1" };
          return null;
        },
        async all() {
          return { results: [] };
        },
        async run() {
          return { success: true };
        },
      };
    },
  };

  const payload = {
    businessName: "North Dallas Roof Repair",
    businessId: "north-dallas-roof-repair",
    phone: "555-0100",
    provider: "mock",
    model: "mock-json",
    skipAiCopyPatch: true,
    originData: {
      place_id: "place-good",
      types: ["roofing_contractor"],
      formatted_address: "100 Main St, Dallas, TX",
      website: "",
      rating: 4.8,
      user_ratings_total: 86,
      url: "https://www.google.com/maps/place/North+Dallas+Roof+Repair",
    },
    brandPalette: ["#f8fafc", "#0f172a", "#e5e7eb"],
    selectedLogoImageUrl: "/api/places/photo?reference=photo-1&maxwidth=960",
    selectedLogoReference: "photo-1",
    selectedLogoPriority: "hero",
    paletteOptions: [{ source: "photo-1", colors: ["#f8fafc", "#0f172a"] }],
    jsonContent: {
      meta: { language: "en", businessName: "North Dallas Roof Repair" },
      businessProfile: { name: "North Dallas Roof Repair", contact: {}, address: {} },
      navigation: { headerMenu: [{ label: "Home", href: "#home" }] },
      design: { themeVariables: { colors: {} } },
      brand: {},
      sourceData: { googleMapsUri: "https://www.google.com/maps/search/?api=1&query=North%20Dallas%20Roof%20Repair" },
      location: {},
      pages: [{ pageId: "home", sections: [{ type: "hero", id: "home-hero", content: { headline: "Roof repair" } }] }],
      services: [{ id: "roof-repair", title: "Roof Repair", summary: "Fix roof leaks.", detailPageId: "service-roof-repair" }],
      products: [],
      offers: [],
    },
  };

  const response = await handleSites(
    deps,
    new Request("https://webview.click/api/sites/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
    db as never,
    {},
    ["sites", "generate"],
  );

  assert.equal(response.status, 200);
  const result = await response.json() as Record<string, unknown>;
  assert.equal(result.success, true);
  assert.equal(result.businessId, "north-dallas-roof-repair");
  assert.equal(result.generatedWithAi, false);
  assert.equal(result.copyPatchApplied, false);

  assert.equal(calls.createdJobs.length, 1);
  assert.equal(calls.createdJobs[0].business_id, "north-dallas-roof-repair");
  assert.equal(calls.createdJobs[0].place_id, "place-good");
  assert.deepEqual(calls.usage, ["site_generation"]);

  const successJob = calls.updatedJobs.find((item) => item.values.status === "success");
  assert.ok(successJob);
  const jobMetadata = JSON.parse(asString(successJob.values.metadata_json));
  assert.equal(jobMetadata.copyPatchSkipped, true);
  assert.equal(jobMetadata.copyPatchApplied, false);

  assert.equal(calls.leads.length, 1);
  assert.equal(calls.leads[0].business_id, "north-dallas-roof-repair");
  assert.equal(calls.leads[0].niche, "roofing_contractor");
  assert.equal(calls.leads[0].phone, "555-0100");

  assert.equal(calls.prospects.length, 1);
  assert.equal(calls.prospects[0].placeId, "place-good");
  assert.equal(calls.prospects[0].values.status, "site_generated");
  assert.equal(calls.prospects[0].values.generated_business_id, "north-dallas-roof-repair");

  assert.equal(calls.activities.length, 1);
  assert.equal(calls.sites.length, 1);
  assert.equal(calls.sites[0].businessId, "north-dallas-roof-repair");
  const savedJson = JSON.parse(calls.sites[0].jsonContent);
  assert.equal(savedJson.meta.businessId, "north-dallas-roof-repair");
  assert.equal(savedJson.meta.generationMode, "submitted_json_ai_fallback");
  assert.equal(savedJson.meta.aiProvider, "mock");
  assert.equal(savedJson.global.header.logoImageUrl, "/api/places/photo?reference=photo-1&maxwidth=960");
  assert.equal(savedJson.brand.logoImageUrl, "/api/places/photo?reference=photo-1&maxwidth=960");
  assert.equal(savedJson.brand.googlePhotoReference, "photo-1");
  assert.equal(savedJson.brand.selectedPhotoPriority, "hero");
  assert.deepEqual(savedJson.brand.paletteOptions, [{ source: "photo-1", colors: ["#f8fafc", "#0f172a"] }]);
  assert.equal(savedJson.sourceData.placeId, "place-good");
  assert.equal(savedJson.sourceData.googleMapsUri, "https://www.google.com/maps/place/North+Dallas+Roof+Repair");
  assert.ok(Array.isArray(savedJson.pages));
  assert.ok(savedJson.pages.some((page: Record<string, unknown>) => page.pageId === "contact"));
  assert.ok(calls.sites[0].options.json_summary);
});

test("sites generate endpoint saves compact D1 manifest when R2 JSON storage is available", async () => {
  const calls = {
    sites: [] as Array<{ businessId: string; jsonContent: string; options: Record<string, unknown> }>,
    r2Puts: [] as Array<{ key: string; text: string; contentType: string }>,
  };

  const deps: SitesHandlerDeps = {
    templateSchema: {},
    json,
    errorJson,
    readJsonBody,
    asString,
    normalizeBusinessId,
    placeIdFromPlace: (place) => asString((place as Record<string, unknown>).place_id),
    parseJsonObject,
    tableColumns: async () => new Set(["business_id", "json_content", "r2_json_key", "r2_json_url", "json_summary"]),
    ensureRequiredColumns: async () => undefined,
    generateRequiredColumns: [],
    createGenerationJob: async () => undefined,
    updateGenerationJob: async () => undefined,
    incrementDailyUsage: async () => undefined,
    updateProspectRecord: async () => undefined,
    upsertLeadRecord: async () => undefined,
    insertCrmActivitySafe: async () => undefined,
    saveJsonSiteRecord: async (_db, businessId, jsonContent, options = {}) => {
      calls.sites.push({ businessId, jsonContent, options });
    },
    siteStorageDeps: {
      json,
      errorJson,
      readJsonBody,
      asString,
      parseJsonObject,
      ensureRequiredColumns,
      saveJsonSiteRecord: async () => undefined,
    },
    aiSiteGenerationDeps: {
      getSetting: async () => undefined,
      getAiReadiness: async () => ({ ready: true }),
      buildAiFailureDiagnostics: (input: Record<string, unknown>) => input,
      extractProviderErrorDetails: () => ({ message: "", rawSnippet: "", providerCode: "", providerStatus: "" }),
      kieModelConfigs: {},
    },
    sha256Json,
  };

  const db = {
    prepare() {
      return {
        bind() {
          return this;
        },
        async first() {
          return null;
        },
        async all() {
          return { results: [] };
        },
        async run() {
          return { success: true };
        },
      };
    },
  };

  const payload = {
    businessName: "Austin Emergency Plumbing",
    businessId: "austin-emergency-plumbing",
    provider: "mock",
    model: "mock-json",
    skipAiCopyPatch: true,
    originData: {
      place_id: "place-r2",
      types: ["plumber"],
      formatted_address: "400 Water St, Austin, TX",
      rating: 4.7,
      user_ratings_total: 143,
      url: "https://www.google.com/maps/place/Austin+Emergency+Plumbing",
    },
    jsonContent: {
      meta: { language: "en", businessName: "Austin Emergency Plumbing", niche: "plumber" },
      businessProfile: { name: "Austin Emergency Plumbing", contact: {}, address: {} },
      navigation: { headerMenu: [{ label: "Home", href: "#home" }] },
      design: { themeVariables: { colors: {} } },
      brand: {},
      sourceData: { googleMapsUri: "https://www.google.com/maps/place/Austin+Emergency+Plumbing" },
      location: {},
      trust: { rating: 4.7, reviewCount: 143 },
      pages: [{ pageId: "home", sections: [{ type: "hero", id: "home-hero", content: { headline: "Emergency plumbing" } }] }],
      services: [{ id: "emergency-plumbing", title: "Emergency Plumbing", summary: "Fast plumbing help.", detailPageId: "service-emergency-plumbing" }],
      products: [],
      offers: [],
    },
  };

  const response = await handleSites(
    deps,
    new Request("https://webview.click/api/sites/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
    db as never,
    {
      R2_PUBLIC_BASE_URL: "https://assets.example.test",
      R2: {
        async put(key: string, value: ReadableStream | ArrayBuffer | ArrayBufferView | string, options?: { httpMetadata?: { contentType?: string } }) {
          const text = typeof value === "string"
            ? value
            : value instanceof ArrayBuffer
              ? new TextDecoder().decode(value)
              : ArrayBuffer.isView(value)
                ? new TextDecoder().decode(value)
                : "";
          calls.r2Puts.push({ key, text, contentType: options?.httpMetadata?.contentType || "" });
        },
      },
    },
    ["sites", "generate"],
  );

  assert.equal(response.status, 200);
  assert.equal(calls.r2Puts.length, 2);
  assert.equal(calls.r2Puts[0].key, "sites/austin-emergency-plumbing/austin-emergency-plumbing.json");
  assert.equal(calls.r2Puts[1].contentType, "application/json; charset=utf-8");

  assert.equal(calls.sites.length, 1);
  const savedSite = calls.sites[0];
  assert.equal(savedSite.businessId, "austin-emergency-plumbing");
  assert.equal(savedSite.options.r2_json_key, "sites/austin-emergency-plumbing/austin-emergency-plumbing.json");
  assert.equal(savedSite.options.r2_json_url, "https://assets.example.test/sites/austin-emergency-plumbing/austin-emergency-plumbing.json");

  const manifest = JSON.parse(savedSite.jsonContent);
  assert.equal(manifest.storageOnly, true);
  assert.equal(manifest.businessId, "austin-emergency-plumbing");
  assert.equal(manifest.r2JsonKey, "sites/austin-emergency-plumbing/austin-emergency-plumbing.json");
  assert.equal(manifest.r2JsonUrl, "https://assets.example.test/sites/austin-emergency-plumbing/austin-emergency-plumbing.json");
  assert.equal(manifest.summary.businessName, "Austin Emergency Plumbing");
  assert.equal(manifest.summary.rating, 4.7);
  assert.equal(manifest.pages, undefined);

  const r2Json = JSON.parse(calls.r2Puts[1].text);
  assert.equal(r2Json.storage.r2JsonKey, "sites/austin-emergency-plumbing/austin-emergency-plumbing.json");
  assert.equal(r2Json.storage.r2JsonUrl, "https://assets.example.test/sites/austin-emergency-plumbing/austin-emergency-plumbing.json");
  assert.ok(Array.isArray(r2Json.pages));
});

test("payments checkout creates PayPal inline order with add-on pricing", async () => {
  const originalFetch = globalThis.fetch;
  const fetchCalls: Array<{ url: string; body: string }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    fetchCalls.push({ url, body: String(init?.body || "") });
    if (url.endsWith("/v1/oauth2/token")) {
      return new Response(JSON.stringify({ access_token: "sandbox-token" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (url.endsWith("/v2/checkout/orders")) {
      return new Response(JSON.stringify({
        id: "PAYPAL-ORDER-123",
        status: "CREATED",
        links: [{ rel: "payer-action", href: "https://www.sandbox.paypal.com/checkoutnow?token=PAYPAL-ORDER-123" }],
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ message: "unexpected fetch" }), { status: 500 });
  }) as typeof fetch;

  const ledgerRows: Array<Record<string, unknown>> = [];
  const activities: Array<Record<string, unknown>> = [];
  const settings: Record<string, string> = {
    PAYMENT_PROCESSOR: "paypal",
    PAYMENT_USD_AMOUNT: "197",
    PAYMENT_ADDON_PAGE_USD: "10",
    PAYMENT_USD_TO_IDR_RATE: "16000",
    PAYPAL_SANDBOX_CLIENT_ID: "sandbox-client",
    PAYPAL_SANDBOX_CLIENT_SECRET: "sandbox-secret",
    PAYPAL_IS_PRODUCTION: "false",
    PAYPAL_RISK_ACKNOWLEDGED: "true",
  };

  const db = {
    prepare(query: string) {
      return {
        values: [] as unknown[],
        bind(...values: unknown[]) {
          this.values = values;
          return this;
        },
        async first() {
          if (query.includes("SELECT id FROM leads")) return { id: "lead-1" };
          return null;
        },
        async all() {
          return { results: [] };
        },
        async run() {
          if (query.includes("INSERT INTO lead_payments")) {
            const rawJson = String(this.values[10] || "{}");
            ledgerRows.push({
              businessId: this.values[2],
              processor: this.values[3],
              amountUsd: this.values[4],
              amountIdr: this.values[5],
              payerEmail: this.values[6],
              paymentReference: this.values[7],
              rawJson,
            });
          }
          return { success: true };
        },
      };
    },
  };

  try {
    const response = await handlePayments({
      json,
      errorJson,
      readJsonBody,
      asString,
      ensureRequiredColumns: async () => undefined,
      checkoutRequiredColumns: [],
      paymentLedgerRequiredColumns: [],
      getSetting: async (_db, _env, key) => settings[key],
      upsertLeadRecord: async () => undefined,
      insertCrmActivitySafe: async (_db, values) => {
        activities.push(values);
      },
    }, new Request("https://webview.click/api/payments/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        businessId: "north-dallas-roof-repair",
        businessName: "North Dallas Roof Repair",
        requestedDomain: "northdallasroof.com",
        domainMode: "new",
        email: "owner@example.com",
        addOns: { newPages: 3, editedPages: 2 },
      }),
    }), db as never, {}, ["payments", "checkout"]);

    assert.equal(response.status, 200);
    const payload = await response.json() as Record<string, any>;
    assert.equal(payload.success, true);
    assert.equal(payload.processor, "paypal");
    assert.equal(payload.paypalInline, true);
    assert.equal(payload.paypalClientId, "sandbox-client");
    assert.equal(payload.paypalMode, "sandbox");
    assert.equal(payload.paypalOrderId, "PAYPAL-ORDER-123");
    assert.equal(payload.checkoutUrl, "https://www.sandbox.paypal.com/checkoutnow?token=PAYPAL-ORDER-123");
    assert.equal(payload.amountUsd, 242);
    assert.equal(payload.pricing.totalPageActions, 5);
    assert.equal(payload.pricing.discountRate, 0.1);
    assert.equal(payload.requiresManualReview, false);

    const orderBody = JSON.parse(fetchCalls.find((call) => call.url.endsWith("/v2/checkout/orders"))?.body || "{}");
    assert.equal(orderBody.intent, "CAPTURE");
    assert.equal(orderBody.purchase_units[0].amount.value, "242.00");
    assert.equal(orderBody.purchase_units[0].items.length, 2);
    assert.equal(orderBody.purchase_units[0].items[1].unit_amount.value, "45.00");
    assert.equal(orderBody.purchase_units[0].payment_source, undefined);
    assert.equal(orderBody.payment_source.paypal.experience_context.shipping_preference, "NO_SHIPPING");
    assert.equal(orderBody.payment_source.paypal.experience_context.user_action, "PAY_NOW");

    assert.equal(ledgerRows.length, 1);
    assert.equal(ledgerRows[0].processor, "paypal");
    assert.equal(ledgerRows[0].amountUsd, 242);
    const raw = JSON.parse(String(ledgerRows[0].rawJson));
    assert.equal(raw.pricing.totalPageActions, 5);
    assert.equal(raw.pricing.addOnUsd, 45);
    assert.equal(activities.length, 1);
    assert.equal(activities[0].activity_type, "checkout_pending");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("payments checkout falls back to PayPal Business link when order creation fails", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/v1/oauth2/token")) {
      return new Response(JSON.stringify({ access_token: "sandbox-token" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ message: "sandbox order rejected" }), {
      status: 422,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  const settings: Record<string, string> = {
    PAYMENT_PROCESSOR: "paypal",
    PAYPAL_SANDBOX_CLIENT_ID: "sandbox-client",
    PAYPAL_SANDBOX_CLIENT_SECRET: "sandbox-secret",
    PAYPAL_IS_PRODUCTION: "false",
    PAYPAL_BUSINESS_URL: "https://www.paypal.com/paypalme/webviewclick",
  };

  const db = {
    prepare(query: string) {
      return {
        bind() {
          return this;
        },
        async first() {
          if (query.includes("SELECT id FROM leads")) return { id: "lead-1" };
          return null;
        },
        async all() {
          return { results: [] };
        },
        async run() {
          return { success: true };
        },
      };
    },
  };

  try {
    const response = await handlePayments({
      json,
      errorJson,
      readJsonBody,
      asString,
      ensureRequiredColumns: async () => undefined,
      checkoutRequiredColumns: [],
      paymentLedgerRequiredColumns: [],
      getSetting: async (_db, _env, key) => settings[key],
      upsertLeadRecord: async () => undefined,
      insertCrmActivitySafe: async () => undefined,
    }, new Request("https://webview.click/api/payments/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        businessId: "north-dallas-roof-repair",
        businessName: "North Dallas Roof Repair",
        requestedDomain: "northdallasroof.com",
        domainMode: "new",
        email: "owner@example.com",
      }),
    }), db as never, {}, ["payments", "checkout"]);

    assert.equal(response.status, 200);
    const payload = await response.json() as Record<string, unknown>;
    assert.equal(payload.success, true);
    assert.equal(payload.mock, false);
    assert.equal(payload.checkoutUrl, "https://www.paypal.com/paypalme/webviewclick");
    assert.equal(payload.requiresManualReview, true);
    assert.equal(payload.manualConfirmationRequired, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

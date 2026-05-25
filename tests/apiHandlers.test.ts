import assert from "node:assert/strict";
import test from "node:test";
import { ensureRequiredColumns, tableColumns } from "../functions/api/_shared/db";
import { asString, errorJson, json, normalizeBusinessId, parseJsonArray, parseJsonObject, readJsonBody, sha256Json } from "../functions/api/_shared/response";
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

type D1Result<T = unknown> = {
  results?: T[];
  success?: boolean;
  meta?: unknown;
  error?: string;
};

type D1PreparedStatement<T = unknown> = {
  bind: (...values: unknown[]) => D1PreparedStatement<T>;
  all: <R = T>() => Promise<D1Result<R>>;
  first: <R = T>() => Promise<R | null>;
  run: () => Promise<D1Result<T>>;
};

type D1DatabaseLike = {
  prepare: <T = unknown>(query: string) => D1PreparedStatement<T>;
  batch: <T = unknown>(statements: D1PreparedStatement<T>[]) => Promise<D1Result<T>[]>;
};

type ProspectDbRow = {
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
  result_json?: string;
  details_json?: string;
  status?: string;
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

export type PlacesDeps = {
  json: (data: unknown, status?: number) => Response;
  errorJson: (error: string, status?: number, details?: unknown) => Response;
  readJsonBody: (request: Request) => Promise<Record<string, unknown>>;
  asString: (value: unknown, fallback?: string) => string;
  parseJsonObject: (value: string | null | undefined) => Record<string, unknown>;
  parseJsonArray: (value: string | null | undefined) => unknown[];
  tableColumns: (db: D1DatabaseLike, table: string) => Promise<Set<string>>;
  ensureRequiredColumns: (db: D1DatabaseLike, specs: unknown[]) => Promise<void>;
  updateProspectRecord: (db: D1DatabaseLike, placeId: string, values: Record<string, unknown>) => Promise<void>;
  getSetting: (db: D1DatabaseLike, env: unknown, key: string) => Promise<string | undefined>;
  incrementDailyUsage: (db: D1DatabaseLike, counterKey: "places_search" | "places_details", amount?: number) => Promise<void>;
  isMissingColumnError: (error: unknown, column?: string) => boolean;
  prospectListRequiredColumns: unknown[];
  prospectWebsiteCheckRequiredColumns: unknown[];
  prospectDetailsRequiredColumns: unknown[];
  prospectStatusRequiredColumns: unknown[];
};

export function normalizeSearchQuery(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function asNumber(value: unknown): number | null {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function placeString(place: Record<string, unknown>, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = place[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return fallback;
}

function placeArray(place: Record<string, unknown>, key: string) {
  const value = place[key];
  return Array.isArray(value) ? value : [];
}

function normalizePlaceBusinessId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || crypto.randomUUID();
}

export function placeIdFromPlace(place: Record<string, unknown>) {
  const explicitId = placeString(place, ["place_id", "id"]);
  if (explicitId) return explicitId;
  return normalizePlaceBusinessId(`${placeString(place, ["name"], "unknown")}-${placeString(place, ["formatted_address", "formattedAddress", "vicinity"])}`);
}

function prospectFromPlace(place: Record<string, unknown>, fallbackQuery = "", fallbackQueryKey = "") {
  const placeId = placeIdFromPlace(place);
  const types = placeArray(place, "types");
  const rating = asNumber(place.rating);
  const reviews = asNumber(place.user_ratings_total) ?? asNumber(place.userRatingCount);
  return {
    placeId,
    queryKey: fallbackQueryKey,
    query: fallbackQuery,
    businessName: placeString(place, ["name"], "Untitled Business"),
    address: placeString(place, ["formatted_address", "formattedAddress", "vicinity"]),
    phone: placeString(place, ["formatted_phone_number", "international_phone_number", "nationalPhoneNumber"]),
    websiteUrl: placeString(place, ["website", "websiteUri"]),
    mapsUrl: placeString(place, ["url", "googleMapsUri"]),
    rating,
    reviews,
    niche: typeof types[0] === "string" ? types[0] : "general",
  };
}

export function prospectRowToPlace(deps: PlacesDeps, row: ProspectDbRow, searchQueryOverride = "") {
  return {
    ...deps.parseJsonObject(row.result_json),
    ...deps.parseJsonObject(row.details_json),
    place_id: row.place_id,
    name: row.business_name,
    formatted_address: row.address,
    formatted_phone_number: row.phone,
    website: row.website_url,
    url: row.maps_url,
    rating: row.rating,
    user_ratings_total: row.reviews,
    types: row.niche ? [row.niche] : [],
    prospectStatus: row.status || "new",
    generatedBusinessId: row.generated_business_id || "",
    lastError: row.last_error || "",
    searchQuery: searchQueryOverride || row.query || "",
    selectedPhoto: deps.parseJsonObject(row.selected_photo_json),
    selectedPalette: deps.parseJsonArray(row.selected_palette_json),
    paletteOptions: deps.parseJsonArray(row.palette_options_json),
    websiteCheckStatus: row.website_check_status || "",
    websiteCheckedAt: row.website_checked_at || "",
    updatedAt: row.updated_at,
    detailsLoadedAt: row.details_loaded_at,
    generatedAt: row.generated_at,
  };
}

function compactText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function manualShortHash(value: string) {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(index);
  }
  return Math.abs(hash >>> 0).toString(36);
}

function manualMapsUrlType(value: string): "listing" | "search" | "unknown" {
  const lower = value.toLowerCase();
  if (lower.includes("/maps/search")) {
    return "search";
  }
  if (lower.includes("/maps/place") || lower.includes("place_id:") || lower.includes("query_place_id=") || lower.includes("cid=") || /!1s[^!]+/.test(value)) {
    return "listing";
  }
  if (lower.includes("maps?q=") || lower.includes("search/")) {
    return "search";
  }
  return lower.includes("google.") || lower.includes("maps.app.goo.gl") || lower.includes("goo.gl/maps") ? "search" : "unknown";
}

function decodeMapsPathLabel(value: string) {
  const decoded = decodeURIComponent(value.replace(/\+/g, " "));
  return compactText(decoded.replace(/[@!].*$/, "").replace(/[-_]+/g, " "));
}

function manualQueryFromMapsUrl(value: string, fallback = "") {
  try {
    const parsed = new URL(value);
    const query = parsed.searchParams.get("q") || parsed.searchParams.get("query") || parsed.searchParams.get("destination") || "";
    if (query) return compactText(query.replace(/^place_id:/i, ""));
    const segments = parsed.pathname.split("/").map((segment) => segment.trim()).filter(Boolean);
    const placeIndex = segments.findIndex((segment) => segment === "place" || segment === "search");
    if (placeIndex >= 0 && segments[placeIndex + 1]) return decodeMapsPathLabel(segments[placeIndex + 1]);
  } catch {
    const match = value.match(/\/maps\/(?:place|search)\/([^/?#]+)/i);
    if (match?.[1]) return decodeMapsPathLabel(match[1]);
  }
  return fallback;
}

function manualPlaceIdFromMapsUrl(value: string) {
  try {
    const parsed = new URL(value);
    const queryPlaceId = parsed.searchParams.get("query_place_id") || parsed.searchParams.get("place_id");
    if (queryPlaceId) return queryPlaceId;
  } catch {
    // Fall through to regex extraction for copied or partial Maps URLs.
  }
  const placeIdMatch = value.match(/place_id:([^&?#]+)/i);
  if (placeIdMatch?.[1]) return decodeURIComponent(placeIdMatch[1]);
  return "";
}

function parseManualCapturedItems(deps: PlacesDeps, body: Record<string, unknown>) {
  const directItems = Array.isArray(body.capturedItems) ? body.capturedItems : [];
  if (directItems.length) return directItems;

  const text = deps.asString(body.capturedText).trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === "object") {
      const object = parsed as Record<string, unknown>;
      for (const key of ["items", "businesses", "listings", "results", "prospects"]) {
        if (Array.isArray(object[key])) return object[key] as unknown[];
      }
      return [object];
    }
  } catch {
    return [];
  }
  return [];
}

function manualPlaceFromCapturedItem(item: Record<string, unknown>, fallbackUrl: string, fallbackQuery: string, index: number) {
  const url = placeString(item, ["url", "mapsUrl", "googleMapsUri", "link"], fallbackUrl);
  const nameFromUrl = manualQueryFromMapsUrl(url);
  const name = compactText(placeString(item, ["name", "title", "businessName"], nameFromUrl || `Manual Maps prospect ${index + 1}`));
  const address = compactText(placeString(item, ["formatted_address", "formattedAddress", "address", "vicinity"]));
  const website = placeString(item, ["website", "websiteUrl", "websiteUri"]);
  const explicitPlaceId = placeString(item, ["place_id", "placeId", "id"]);
  const cid = placeString(item, ["cid"]);
  const googlePlaceId = manualPlaceIdFromMapsUrl(url);
  const externalId = explicitPlaceId && !/^0x[0-9a-f]+:0x[0-9a-f]+$/i.test(explicitPlaceId) && !explicitPlaceId.startsWith("/")
    ? explicitPlaceId
    : googlePlaceId;
  const placeId = externalId || `manual:${manualShortHash(`${name}|${address}|${url}|${cid}|${index}`)}`;
  const rawReviews = asNumber(item.user_ratings_total) ?? asNumber(item.userRatingCount) ?? asNumber(item.reviews) ?? asNumber(item.reviewCount);
  const hasWebsite = item.hasWebsite;
  const websiteStatus = website
    ? "has_website"
    : hasWebsite === false || placeString(item, ["websiteCheckStatus", "websiteStatus"]) === "no_website"
      ? "no_website"
      : "";
  const types = Array.isArray(item.types)
    ? item.types
    : [placeString(item, ["category", "niche", "type"], fallbackQuery || "manual_import")].filter(Boolean);

  return {
    ...item,
    place_id: placeId,
    name,
    formatted_address: address,
    formatted_phone_number: placeString(item, ["formatted_phone_number", "phone", "phoneNumber", "telephone"]),
    website,
    url,
    googleMapsUri: url,
    rating: asNumber(item.rating),
    user_ratings_total: rawReviews,
    types,
    websiteCheckStatus: websiteStatus,
    websiteCheckedAt: websiteStatus ? new Date().toISOString() : "",
    manualImport: true,
    manualSourceUrl: fallbackUrl,
    googleMapsCid: cid,
  };
}

async function cacheManualPlacesSearch(deps: PlacesDeps, db: D1DatabaseLike, queryKey: string, query: string, places: Record<string, unknown>[]) {
  if (!queryKey || !query || !places.length) return;
  const cacheExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  try {
    await db
      .prepare(
        `INSERT INTO places_search_cache (query_key, query, results_json, provider_status, result_count, expires_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(query_key) DO UPDATE SET
           query = excluded.query,
           results_json = excluded.results_json,
           provider_status = excluded.provider_status,
           result_count = excluded.result_count,
           expires_at = excluded.expires_at,
           updated_at = CURRENT_TIMESTAMP`,
      )
      .bind(queryKey, query, JSON.stringify(places), "MANUAL_CAPTURE", places.length, cacheExpiresAt)
      .run();
  } catch (error) {
    if (!deps.isMissingColumnError(error)) throw error;
    await db
      .prepare(
        `INSERT INTO places_search_cache (query_key, query, results_json)
         VALUES (?, ?, ?)
         ON CONFLICT(query_key) DO UPDATE SET query = excluded.query, results_json = excluded.results_json`,
      )
      .bind(queryKey, query, JSON.stringify(places))
      .run();
  }
}

async function upsertProspectsFromPlaces(deps: PlacesDeps, db: D1DatabaseLike, queryKey: string, query: string, results: unknown[]) {
  const columns = await deps.tableColumns(db, "places_prospects");
  const statements = results
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    .map((place) => {
      const prospect = prospectFromPlace(place, query, queryKey);
      const values: Record<string, unknown> = {
        place_id: prospect.placeId,
        query_key: prospect.queryKey,
        query: prospect.query,
        business_name: prospect.businessName,
        address: prospect.address,
        phone: ("formatted_phone_number" in place || "international_phone_number" in place || "nationalPhoneNumber" in place) ? prospect.phone : undefined,
        website_url: ("website" in place || "websiteUri" in place) ? prospect.websiteUrl : undefined,
        maps_url: ("url" in place || "googleMapsUri" in place) ? prospect.mapsUrl : undefined,
        website_check_status: "websiteCheckStatus" in place ? placeString(place, ["websiteCheckStatus"]) : undefined,
        website_checked_at: "websiteCheckedAt" in place ? placeString(place, ["websiteCheckedAt"]) : undefined,
        rating: prospect.rating,
        reviews: prospect.reviews,
        niche: prospect.niche,
        status: "new",
        result_json: JSON.stringify(place),
        updated_at: new Date().toISOString(),
      };
      const entries = Object.entries(values).filter(([column]) => columns.has(column));
      const updateColumns = entries.map(([column]) => column).filter((column) => !["place_id", "status"].includes(column));
      const updateClause = updateColumns.length
        ? updateColumns.map((column) => `${column} = excluded.${column}`).join(", ")
        : "place_id = excluded.place_id";
      return db
        .prepare(
          `INSERT INTO places_prospects (${entries.map(([column]) => column).join(", ")})
           VALUES (${entries.map(() => "?").join(", ")})
           ON CONFLICT(place_id) DO UPDATE SET ${updateClause}`,
        )
        .bind(...entries.map(([, value]) => value));
    });

  if (statements.length) {
    await db.batch(statements);
  }
}

export async function handlePlacesManualImport(deps: PlacesDeps, request: Request, db: D1DatabaseLike): Promise<Response> {
  if (request.method !== "POST") return deps.errorJson("Not Found", 404);
  const body = await deps.readJsonBody(request);
  const sourceUrl = deps.asString(body.url).trim();
  const capturedItems = parseManualCapturedItems(deps, body);
  const urlType = sourceUrl ? manualMapsUrlType(sourceUrl) : "unknown";
  const inferredQuery = compactText(deps.asString(body.query) || manualQueryFromMapsUrl(sourceUrl, urlType === "listing" ? "Manual Google Maps listing" : "Manual Google Maps search"));
  const query = inferredQuery || "Manual Google Maps import";
  const queryKey = normalizeSearchQuery(`manual ${query}`);

  if (!sourceUrl && capturedItems.length === 0) {
    return deps.errorJson("Paste a Google Maps URL or captured listing JSON first.", 400);
  }

  if (capturedItems.length === 0 && urlType !== "listing") {
    return deps.json({
      success: true,
      importedCount: 0,
      urlType,
      query,
      needsBrowserCapture: true,
      message: "Search-result Maps URLs need browser capture JSON because the business cards are rendered inside your browser.",
      prospects: [],
    });
  }

  const places = capturedItems.length > 0
    ? capturedItems
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
      .map((item, index) => manualPlaceFromCapturedItem(item, sourceUrl, query, index))
    : [manualPlaceFromCapturedItem({
      name: manualQueryFromMapsUrl(sourceUrl, "Manual Google Maps listing"),
      url: sourceUrl,
      types: ["manual_import"],
    }, sourceUrl, query, 0)];

  await deps.ensureRequiredColumns(db, deps.prospectListRequiredColumns);
  await upsertProspectsFromPlaces(deps, db, queryKey, query, places);
  if (urlType === "search" || places.length > 1) {
    await cacheManualPlacesSearch(deps, db, queryKey, query, places);
  }

  return deps.json({
    success: true,
    importedCount: places.length,
    urlType,
    query,
    queryKey,
    needsBrowserCapture: false,
    message: capturedItems.length === 0 && urlType === "listing"
      ? "1 manual listing draft imported from the URL. Use the capture helper on the open Maps listing if you need phone, rating, reviews, website, and hours without the Places API."
      : `${places.length} manual Google Maps prospect${places.length === 1 ? "" : "s"} imported.`,
    prospects: places,
  });
}

async function fetchPlaceDetailsLegacy(placeId: string, placesKey: string, fields: string[]) {
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=${encodeURIComponent(fields.join(","))}&key=${encodeURIComponent(placesKey)}`,
  );
  const data = await response.json() as { status?: string; result?: Record<string, unknown>; error_message?: string };
  return { response, data };
}

async function precheckWebsiteForPlaces(deps: PlacesDeps, db: D1DatabaseLike, placesKey: string, results: unknown[], limit: number) {
  if (!limit || !placesKey) return results;
  await deps.ensureRequiredColumns(db, deps.prospectWebsiteCheckRequiredColumns);
  const checkedAt = new Date().toISOString();
  const next: unknown[] = [];

  for (let index = 0; index < results.length; index += 1) {
    const item = results[index];
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      next.push(item);
      continue;
    }

    const place = item as Record<string, unknown>;
    const placeId = placeIdFromPlace(place);
    if (index >= limit || !placeId) {
      next.push(place);
      continue;
    }

    try {
      await deps.incrementDailyUsage(db, "places_details");
      const { data } = await fetchPlaceDetailsLegacy(placeId, placesKey, [
        "place_id",
        "name",
        "formatted_phone_number",
        "international_phone_number",
        "website",
        "url",
        "types",
        "business_status",
      ]);
      if (data.status && data.status !== "OK") {
        const errored = { ...place, websiteCheckStatus: "error", websiteCheckedAt: checkedAt, websiteCheckError: data.error_message || data.status };
        await deps.updateProspectRecord(db, placeId, {
          website_check_status: "error",
          website_checked_at: checkedAt,
        });
        next.push(errored);
        continue;
      }

      const detail = data.result && typeof data.result === "object" ? data.result : {};
      const prospect = prospectFromPlace({ ...place, ...detail });
      const status = prospect.websiteUrl ? "has_website" : "no_website";
      const merged = {
        ...place,
        ...detail,
        formatted_phone_number: prospect.phone,
        website: prospect.websiteUrl,
        url: prospect.mapsUrl,
        websiteCheckStatus: status,
        websiteCheckedAt: checkedAt,
      };
      await deps.updateProspectRecord(db, placeId, {
        phone: prospect.phone,
        website_url: prospect.websiteUrl,
        maps_url: prospect.mapsUrl,
        website_check_status: status,
        website_checked_at: checkedAt,
      });
      next.push(merged);
    } catch (error) {
      console.error("Places website precheck failed:", error);
      await deps.updateProspectRecord(db, placeId, {
        website_check_status: "error",
        website_checked_at: checkedAt,
      });
      next.push({
        ...place,
        websiteCheckStatus: "error",
        websiteCheckedAt: checkedAt,
        websiteCheckError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return next;
}

export async function handlePlacesSearch(deps: PlacesDeps, url: URL, db: D1DatabaseLike, env: unknown): Promise<Response> {
  const query = (url.searchParams.get("query") || "").trim();
  const queryKey = normalizeSearchQuery(query);
  const refresh = url.searchParams.get("refresh") === "1";
  const websitePrecheck = url.searchParams.get("websitePrecheck") === "1";
  const precheckLimit = Math.max(0, Math.min(20, Number(url.searchParams.get("precheckLimit") || 10)));
  const placesKey = await deps.getSetting(db, env, "GOOGLE_PLACES_API_KEY");

  if (!queryKey) {
    return deps.errorJson("Missing query", 400);
  }

  if (!refresh) {
    let cached: { query: string; results_json: string; provider_status?: string; result_count?: number; updated_at?: string; expires_at?: string } | null = null;
    try {
      cached = await db
        .prepare(
          `SELECT query, results_json, provider_status, result_count, updated_at, expires_at
           FROM places_search_cache
           WHERE query_key = ? AND (expires_at IS NULL OR datetime(expires_at) > datetime('now'))`,
        )
        .bind(queryKey)
        .first<{ query: string; results_json: string; provider_status?: string; result_count?: number; updated_at?: string; expires_at?: string }>();
    } catch (error) {
      if (!deps.isMissingColumnError(error)) throw error;
      cached = await db
        .prepare("SELECT query, results_json FROM places_search_cache WHERE query_key = ?")
        .bind(queryKey)
        .first<{ query: string; results_json: string }>();
    }

    if (cached?.results_json) {
      try {
        await db
          .prepare("UPDATE places_search_cache SET hit_count = COALESCE(hit_count, 0) + 1, updated_at = CURRENT_TIMESTAMP WHERE query_key = ?")
          .bind(queryKey)
          .run();
      } catch (error) {
        if (!deps.isMissingColumnError(error)) throw error;
      }

      let cachedResults = JSON.parse(cached.results_json);
      if (websitePrecheck && placesKey && Array.isArray(cachedResults)) {
        cachedResults = await precheckWebsiteForPlaces(deps, db, placesKey, cachedResults, precheckLimit);
      }

      return deps.json({
        cached: true,
        status: cached.provider_status || "CACHE_HIT",
        queryKey,
        query: cached.query,
        resultCount: cached.result_count || 0,
        updatedAt: cached.updated_at,
        expiresAt: cached.expires_at,
        websitePrecheck,
        results: cachedResults,
      });
    }
  }

  const mockResult = {
    place_id: "mock-place",
    name: `Kedai Kopi Senja ${query}`,
    formatted_address: "Jl. Sudirman No 123",
    rating: 4.8,
    user_ratings_total: 120,
    business_status: "OPERATIONAL",
    websiteCheckStatus: "no_website",
    websiteCheckedAt: new Date().toISOString(),
  };

  if (!placesKey || placesKey.length < 10) {
    await upsertProspectsFromPlaces(deps, db, queryKey, query, [mockResult]);
    return deps.json({
      mock: true,
      status: "MOCK_NO_API_KEY",
      queryKey,
      query,
      results: [mockResult],
    });
  }

  try {
    await deps.incrementDailyUsage(db, "places_search");
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${encodeURIComponent(placesKey)}`,
    );
    const data = await response.json() as { status?: string; results?: unknown[]; error_message?: string };

    if (!response.ok) {
      return deps.json({
        status: "GOOGLE_HTTP_ERROR",
        error: data.error_message || `Google Places returned HTTP ${response.status}`,
        results: [],
      });
    }

    if (data.status && data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      const refererRestriction = data.error_message?.toLowerCase().includes("referer restrictions");
      return deps.json({
        status: data.status,
        error: data.error_message || `Google Places status: ${data.status}`,
        hint: refererRestriction
          ? "Google Places key ini dipakai dari Cloudflare Pages Function/server-side, jadi tidak boleh memakai HTTP referrer restriction. Buat server key terpisah: Application restrictions = None, API restrictions = Places API, lalu simpan di /admin/settings sebagai GOOGLE_PLACES_API_KEY."
          : "Cek Google Cloud Console: pastikan billing aktif, Places API yang sesuai aktif, dan API key disimpan sebagai GOOGLE_PLACES_API_KEY.",
        results: [],
      });
    }

    const rawResults = Array.isArray(data.results) ? data.results : [];
    const results = websitePrecheck ? await precheckWebsiteForPlaces(deps, db, placesKey, rawResults, precheckLimit) : rawResults;
    await upsertProspectsFromPlaces(deps, db, queryKey, query, results);
    const cacheExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    try {
      await db
        .prepare(
          `INSERT INTO places_search_cache (query_key, query, results_json, provider_status, result_count, expires_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(query_key) DO UPDATE SET
             query = excluded.query,
             results_json = excluded.results_json,
             provider_status = excluded.provider_status,
             result_count = excluded.result_count,
             expires_at = excluded.expires_at,
             updated_at = CURRENT_TIMESTAMP`,
        )
        .bind(queryKey, query, JSON.stringify(results), data.status || "OK", results.length, cacheExpiresAt)
        .run();
    } catch (error) {
      if (!deps.isMissingColumnError(error)) throw error;
      await db
        .prepare(
          `INSERT INTO places_search_cache (query_key, query, results_json)
           VALUES (?, ?, ?)
           ON CONFLICT(query_key) DO UPDATE SET query = excluded.query, results_json = excluded.results_json`,
        )
        .bind(queryKey, query, JSON.stringify(results))
        .run();
    }

    if (results.length === 0) {
      return deps.json({
        status: data.status || "ZERO_RESULTS",
        cached: false,
        results: [],
      });
    }

    return deps.json({
      status: data.status || "OK",
      cached: false,
      queryKey,
      websitePrecheck,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Places search failed:", error);
    return deps.json({
      status: "PLACES_FETCH_FAILED",
      error: message,
      results: [],
    });
  }
}

export async function handlePlacesDetails(deps: PlacesDeps, url: URL, db: D1DatabaseLike, env: unknown): Promise<Response> {
  const placeId = url.searchParams.get("placeId") || url.searchParams.get("place_id") || "";

  if (!placeId) {
    return deps.errorJson("Missing placeId", 400);
  }

  if (placeId.startsWith("manual:") || placeId.startsWith("cid:") || placeId.startsWith("maps:") || /^0x[0-9a-f]+/i.test(placeId)) {
    await deps.ensureRequiredColumns(db, deps.prospectDetailsRequiredColumns);
    const row = await db
      .prepare("SELECT * FROM places_prospects WHERE place_id = ?")
      .bind(placeId)
      .first<ProspectDbRow>();
    if (!row) {
      if (placeId.startsWith("maps:")) {
        return deps.errorJson("This Maps search/query placeholder is not a business listing. Select a specific business result or import a captured listing before gathering details.", 400);
      }
      return deps.errorJson("Manual prospect was not found.", 404);
    }

    const result = {
      ...deps.parseJsonObject(row.result_json),
      ...deps.parseJsonObject(row.details_json),
      place_id: row.place_id,
      name: row.business_name,
      formatted_address: row.address,
      formatted_phone_number: row.phone,
      website: row.website_url,
      url: row.maps_url,
      rating: row.rating,
      user_ratings_total: row.reviews,
      types: row.niche ? [row.niche] : ["manual_import"],
    };
    const hasUsefulManualDetails = Boolean(row.phone || row.address || row.website_url || row.rating || row.reviews || row.details_json);
    if (!hasUsefulManualDetails) {
      return deps.json({
        status: "MANUAL_CAPTURE_REQUIRED",
        error: "This manual URL-only prospect does not include Google Places details. Open the listing in Google Maps and use the capture helper to import visible details.",
        result: null,
      }, 400);
    }

    await deps.updateProspectRecord(db, placeId, {
      details_json: JSON.stringify(result),
      website_check_status: row.website_url ? "has_website" : row.website_check_status || "",
      website_checked_at: row.website_url || row.website_check_status ? new Date().toISOString() : row.website_checked_at,
      details_loaded_at: new Date().toISOString(),
      status: "details_loaded",
    });

    return deps.json({
      status: "MANUAL_DETAILS",
      result,
    });
  }

  const placesKey = await deps.getSetting(db, env, "GOOGLE_PLACES_API_KEY");

  if (!placesKey) {
    return deps.errorJson("Google Places API key is not configured", 400);
  }

  const fields = [
    "place_id",
    "name",
    "formatted_address",
    "formatted_phone_number",
    "international_phone_number",
    "website",
    "url",
    "opening_hours",
    "rating",
    "reviews",
    "user_ratings_total",
    "types",
    "business_status",
    "photos",
  ].join(",");

  try {
    await deps.incrementDailyUsage(db, "places_details");
    const { response, data } = await fetchPlaceDetailsLegacy(placeId, placesKey, fields.split(","));

    if (!response.ok || (data.status && data.status !== "OK")) {
      return deps.json({
        status: data.status || "GOOGLE_HTTP_ERROR",
        error: data.error_message || `Google Places Details returned HTTP ${response.status}`,
        result: null,
      }, response.ok ? 200 : response.status);
    }

    if (data.result && typeof data.result === "object") {
      const prospect = prospectFromPlace(data.result);
      await deps.ensureRequiredColumns(db, deps.prospectDetailsRequiredColumns);
      await deps.updateProspectRecord(db, placeId, {
        details_json: JSON.stringify(data.result),
        phone: prospect.phone,
        website_url: prospect.websiteUrl,
        maps_url: prospect.mapsUrl,
        website_check_status: prospect.websiteUrl ? "has_website" : "no_website",
        website_checked_at: new Date().toISOString(),
        details_loaded_at: new Date().toISOString(),
      });
    }

    return deps.json({
      status: data.status || "OK",
      result: data.result || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Places details failed:", error);
    return deps.json({
      status: "PLACES_DETAILS_FAILED",
      error: message,
      result: null,
    });
  }
}

export async function handlePlacesCache(deps: PlacesDeps, request: Request, db: D1DatabaseLike, segments: string[]): Promise<Response> {
  if (request.method !== "POST" || segments[2] !== "trim") {
    return deps.errorJson("Not Found", 404);
  }

  const body = await deps.readJsonBody(request);
  const olderThanDays = Math.max(1, Math.min(365, Number(body.olderThanDays || 30)));
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();
  const result = await db
    .prepare(
      `DELETE FROM places_search_cache
       WHERE datetime(updated_at) < datetime(?) OR (expires_at IS NOT NULL AND datetime(expires_at) < datetime('now'))`,
    )
    .bind(cutoff)
    .run();

  return deps.json({ success: true, olderThanDays, result });
}

function manualDuplicateNormalize(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b(llc|inc|corp|corporation|co|company|ltd|limited|services?|service|the)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function manualDuplicateUrlKey(value: unknown) {
  const text = String(value || "").trim();
  if (!text) return "";
  try {
    const parsed = new URL(text);
    const placeMatch = parsed.pathname.match(/\/maps\/place\/([^/@]+)/i);
    if (placeMatch?.[1]) return `url:${manualDuplicateNormalize(decodeURIComponent(placeMatch[1].replace(/\+/g, " ")))}`;
    return `url:${parsed.hostname}${parsed.pathname}`.toLowerCase();
  } catch {
    const match = text.match(/\/maps\/place\/([^/@?#]+)/i);
    return match?.[1] ? `url:${manualDuplicateNormalize(decodeURIComponent(match[1].replace(/\+/g, " ")))}` : "";
  }
}

function manualDuplicateKeys(deps: PlacesDeps, row: ProspectDbRow) {
  const result = deps.parseJsonObject(row.result_json);
  const details = deps.parseJsonObject(row.details_json);
  const keys = new Set<string>();
  const nameKey = manualDuplicateNormalize(row.business_name || result.name || details.name);
  const addressKey = manualDuplicateNormalize(row.address || result.formatted_address || result.address || details.formatted_address);
  const cid = deps.asString(result.googleMapsCid) || deps.asString(result.cid);
  const urlKey = manualDuplicateUrlKey(row.maps_url || result.url || result.mapsUrl || result.googleMapsUri || result.manualSourceUrl);

  if (cid) keys.add(`cid:${cid}`);
  if (urlKey && !urlKey.endsWith("manual google maps listing")) keys.add(urlKey);
  if (nameKey.length >= 5 && !["manual google maps listing", "manual maps prospect"].includes(nameKey)) keys.add(`name:${nameKey}`);
  if (nameKey.length >= 5 && addressKey.length >= 8) keys.add(`name-address:${nameKey}|${addressKey}`);
  if (addressKey.length >= 12) keys.add(`address:${addressKey}`);
  return Array.from(keys);
}

function isManualProspectRow(deps: PlacesDeps, row: ProspectDbRow) {
  const result = deps.parseJsonObject(row.result_json);
  return row.place_id.startsWith("manual:") || Boolean(result.manualImport || result.manualSourceUrl || result.googleMapsCid);
}

function duplicateGroupReason(key: string) {
  if (key.startsWith("cid:")) return "Same Google Maps CID from manual capture.";
  if (key.startsWith("url:")) return "Same Google Maps place URL/name.";
  if (key.startsWith("name-address:")) return "Same normalized business name and address.";
  if (key.startsWith("address:")) return "Same normalized address.";
  return "Same normalized business name.";
}

function hasMergeValue(value: unknown) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value) && value !== 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
  return Boolean(value);
}

function mergeObjectsPreferringPresent(primary: Record<string, unknown>, secondary: Record<string, unknown>) {
  const merged = { ...secondary };
  for (const [key, value] of Object.entries(primary)) {
    if (hasMergeValue(value) || !hasMergeValue(merged[key])) {
      merged[key] = value;
    }
  }
  return merged;
}

export async function handlePlacesManualDuplicateMerge(deps: PlacesDeps, request: Request, db: D1DatabaseLike): Promise<Response> {
  if (request.method !== "POST") return deps.errorJson("Not Found", 404);
  const body = await deps.readJsonBody(request);
  const keepPlaceId = deps.asString(body.keepPlaceId).trim();
  const duplicatePlaceId = deps.asString(body.duplicatePlaceId).trim();

  if (!keepPlaceId || !duplicatePlaceId) {
    return deps.errorJson("Missing keepPlaceId or duplicatePlaceId", 400);
  }
  if (keepPlaceId === duplicatePlaceId) {
    return deps.errorJson("Cannot merge a prospect into itself.", 400);
  }

  await deps.ensureRequiredColumns(db, [...deps.prospectDetailsRequiredColumns, ...deps.prospectStatusRequiredColumns]);
  const keepRow = await db.prepare("SELECT * FROM places_prospects WHERE place_id = ?").bind(keepPlaceId).first<ProspectDbRow>();
  const duplicateRow = await db.prepare("SELECT * FROM places_prospects WHERE place_id = ?").bind(duplicatePlaceId).first<ProspectDbRow>();

  if (!keepRow) return deps.errorJson("Keep prospect was not found.", 404);
  if (!duplicateRow) return deps.errorJson("Duplicate prospect was not found.", 404);

  const copiedFields: string[] = [];
  const updates: Record<string, unknown> = {};
  const copyIfMissing = (column: keyof ProspectDbRow, label = String(column)) => {
    if (!hasMergeValue(keepRow[column]) && hasMergeValue(duplicateRow[column])) {
      updates[column] = duplicateRow[column];
      copiedFields.push(label);
    }
  };

  copyIfMissing("address");
  copyIfMissing("phone");
  copyIfMissing("website_url", "website");
  copyIfMissing("maps_url", "maps URL");
  copyIfMissing("rating");
  copyIfMissing("reviews");
  copyIfMissing("niche");
  copyIfMissing("website_check_status", "website status");
  copyIfMissing("website_checked_at", "website checked time");
  copyIfMissing("details_loaded_at", "details loaded time");

  const mergedResultJson = mergeObjectsPreferringPresent(deps.parseJsonObject(keepRow.result_json), deps.parseJsonObject(duplicateRow.result_json));
  const mergedDetailsJson = mergeObjectsPreferringPresent(deps.parseJsonObject(keepRow.details_json), deps.parseJsonObject(duplicateRow.details_json));
  if (hasMergeValue(mergedResultJson)) updates.result_json = JSON.stringify(mergedResultJson);
  if (hasMergeValue(mergedDetailsJson)) updates.details_json = JSON.stringify(mergedDetailsJson);

  if (Object.keys(updates).length > 0) {
    await deps.updateProspectRecord(db, keepPlaceId, updates);
  }
  await deps.updateProspectRecord(db, duplicatePlaceId, { status: "skipped" });

  const mergedRow = await db.prepare("SELECT * FROM places_prospects WHERE place_id = ?").bind(keepPlaceId).first<ProspectDbRow>();
  return deps.json({
    success: true,
    copiedFields,
    skippedPlaceId: duplicatePlaceId,
    keepPlaceId,
    prospect: mergedRow ? prospectRowToPlace(deps, mergedRow) : null,
  });
}

export async function handlePlacesManualDuplicates(deps: PlacesDeps, url: URL, db: D1DatabaseLike): Promise<Response> {
  const limit = Math.max(50, Math.min(1000, Number(url.searchParams.get("limit") || 500)));
  await deps.ensureRequiredColumns(db, deps.prospectListRequiredColumns);
  const rows = await db
    .prepare(
      `SELECT *
       FROM places_prospects
       WHERE COALESCE(status, 'new') <> 'skipped'
       ORDER BY datetime(updated_at) DESC
       LIMIT ?`,
    )
    .bind(limit)
    .all<ProspectDbRow>();

  const allRows = rows.results || [];
  const rowMap = new Map(allRows.map((row) => [row.place_id, row]));
  const keyMap = new Map<string, Set<string>>();
  for (const row of allRows) {
    for (const key of manualDuplicateKeys(deps, row)) {
      if (!keyMap.has(key)) keyMap.set(key, new Set());
      keyMap.get(key)?.add(row.place_id);
    }
  }

  const seenGroups = new Set<string>();
  const groups: Array<Record<string, unknown>> = [];
  for (const [key, ids] of keyMap.entries()) {
    if (ids.size < 2) continue;
    const groupRows = Array.from(ids).map((id) => rowMap.get(id)).filter((row): row is ProspectDbRow => Boolean(row));
    if (!groupRows.some((row) => isManualProspectRow(deps, row))) continue;
    const signature = groupRows.map((row) => row.place_id).sort().join("|");
    if (seenGroups.has(signature)) continue;
    seenGroups.add(signature);
    groups.push({
      id: manualShortHash(signature),
      key,
      reason: duplicateGroupReason(key),
      manualCount: groupRows.filter((row) => isManualProspectRow(deps, row)).length,
      prospects: groupRows
        .sort((a, b) => {
          const aScore = (a.generated_business_id ? 4 : 0) + (a.details_loaded_at ? 2 : 0) + (a.website_url || a.phone || a.address ? 1 : 0);
          const bScore = (b.generated_business_id ? 4 : 0) + (b.details_loaded_at ? 2 : 0) + (b.website_url || b.phone || b.address ? 1 : 0);
          return bScore - aScore;
        })
        .map((row) => ({
          ...prospectRowToPlace(deps, row),
          duplicateManualImport: isManualProspectRow(deps, row),
        })),
    });
  }

  return deps.json({
    success: true,
    count: groups.length,
    groups: groups.slice(0, 50),
  });
}

function summarizeSearchProspects(deps: PlacesDeps, prospects: Array<Record<string, unknown>>) {
  return prospects.reduce((summary, prospect) => {
    const website = deps.asString(prospect.website);
    const websiteStatus = deps.asString(prospect.websiteCheckStatus);
    const status = deps.asString(prospect.prospectStatus);
    summary.total += 1;
    if (website || websiteStatus === "has_website") summary.hasWebsite += 1;
    else if (websiteStatus === "no_website") summary.noWebsite += 1;
    else summary.websiteUnknown += 1;
    if (deps.asString(prospect.detailsLoadedAt) || status === "details_loaded" || Array.isArray(prospect.reviews)) summary.detailsLoaded += 1;
    if (deps.asString(prospect.generatedBusinessId) || status === "site_generated") summary.generated += 1;
    if (status === "skipped") summary.skipped += 1;
    if (deps.asString(prospect.lastError)) summary.errors += 1;
    return summary;
  }, {
    total: 0,
    hasWebsite: 0,
    noWebsite: 0,
    websiteUnknown: 0,
    detailsLoaded: 0,
    generated: 0,
    skipped: 0,
    errors: 0,
  });
}

export async function handlePlacesHistory(deps: PlacesDeps, url: URL, db: D1DatabaseLike): Promise<Response> {
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") || 25)));
  await deps.ensureRequiredColumns(db, deps.prospectListRequiredColumns);
  const historyRows = await db
    .prepare(
      `SELECT query_key, query, results_json, provider_status, result_count, hit_count, updated_at, expires_at
       FROM places_search_cache
       ORDER BY datetime(updated_at) DESC
       LIMIT ?`,
    )
    .bind(limit)
    .all<{
      query_key: string;
      query: string;
      results_json: string;
      provider_status?: string;
      result_count?: number;
      hit_count?: number;
      updated_at?: string;
      expires_at?: string;
    }>();

  const searches = (historyRows.results || []).map((row) => {
    const rawResults = deps.parseJsonArray(row.results_json).filter((item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === "object" && !Array.isArray(item),
    );
    const placeIds = rawResults.map((place) => placeIdFromPlace(place)).filter(Boolean);
    return { row, rawResults, placeIds };
  });

  const uniquePlaceIds = Array.from(new Set(searches.flatMap((item) => item.placeIds)));
  const prospectMap = new Map<string, ReturnType<typeof prospectRowToPlace>>();
  for (let index = 0; index < uniquePlaceIds.length; index += 80) {
    const batch = uniquePlaceIds.slice(index, index + 80);
    if (batch.length === 0) continue;
    const prospectRows = await db
      .prepare(
        `SELECT p.*,
                l.business_id AS lead_business_id,
                l.status AS lead_status
         FROM places_prospects p
         LEFT JOIN leads l ON l.business_id = p.generated_business_id
         WHERE p.place_id IN (${batch.map(() => "?").join(", ")})`,
      )
      .bind(...batch)
      .all<ProspectDbRow>();

    for (const row of prospectRows.results || []) {
      prospectMap.set(row.place_id, prospectRowToPlace(deps, row));
    }
  }

  return deps.json(searches.map(({ row, rawResults }) => {
    const prospects = rawResults.map((rawPlace) => {
      const placeId = placeIdFromPlace(rawPlace);
      const stored = prospectMap.get(placeId);
      return {
        ...rawPlace,
        ...(stored || {}),
        place_id: placeId,
        searchQuery: row.query,
        searchHistoryQueryKey: row.query_key,
      };
    });
    return {
      queryKey: row.query_key,
      query: row.query,
      providerStatus: row.provider_status || "",
      resultCount: row.result_count ?? rawResults.length,
      hitCount: row.hit_count || 0,
      updatedAt: row.updated_at || "",
      expiresAt: row.expires_at || "",
      summary: summarizeSearchProspects(deps, prospects),
      prospects,
    };
  }));
}

export async function handlePlacesPhoto(deps: PlacesDeps, url: URL, db: D1DatabaseLike, env: unknown): Promise<Response> {
  const reference = url.searchParams.get("reference");
  const maxWidth = url.searchParams.get("maxwidth") || "320";
  const placesKey = await deps.getSetting(db, env, "GOOGLE_PLACES_API_KEY");

  if (!reference) {
    return deps.errorJson("Missing photo reference", 400);
  }

  if (!placesKey) {
    return deps.errorJson("Google Places API key is not configured", 400);
  }

  const photoUrl = new URL("https://maps.googleapis.com/maps/api/place/photo");
  photoUrl.searchParams.set("maxwidth", maxWidth);
  photoUrl.searchParams.set("photo_reference", reference);
  photoUrl.searchParams.set("key", placesKey);

  const response = await fetch(photoUrl.toString(), { redirect: "follow" });
  if (!response.ok || !response.body) {
    return deps.errorJson("Could not fetch Google Places photo", response.status || 500);
  }

  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", "*");
  headers.set("cache-control", "public, max-age=86400");
  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

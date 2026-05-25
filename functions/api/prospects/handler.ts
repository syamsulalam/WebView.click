import type { D1Database } from "../_shared/types";
import { asNumber, normalizeSearchQuery, prospectRowToPlace, type PlacesDeps } from "../places/handler";

export type ProspectsDeps = {
  json: (data: unknown, status?: number) => Response;
  errorJson: (error: string, status?: number, details?: unknown) => Response;
  readJsonBody: (request: Request) => Promise<Record<string, unknown>>;
  asString: (value: unknown, fallback?: string) => string;
  ensureRequiredColumns: (db: D1Database, specs: unknown[]) => Promise<void>;
  updateProspectRecord: (db: D1Database, placeId: string, values: Record<string, unknown>) => Promise<void>;
  placesDeps: PlacesDeps;
  prospectListRequiredColumns: unknown[];
  prospectStatusRequiredColumns: unknown[];
  selectionRequiredColumns: unknown[];
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

export async function handleProspects(deps: ProspectsDeps, request: Request, db: D1Database, segments: string[], url: URL): Promise<Response> {
  if (request.method === "GET" && segments.length === 1) {
    const status = url.searchParams.get("status") || "";
    const website = url.searchParams.get("website") || "";
    const query = normalizeSearchQuery(url.searchParams.get("query") || "");
    const minRating = asNumber(url.searchParams.get("minRating"));
    const minReviews = asNumber(url.searchParams.get("minReviews"));
    const city = normalizeSearchQuery(url.searchParams.get("city") || "");
    const state = normalizeSearchQuery(url.searchParams.get("state") || "");
    const niche = normalizeSearchQuery(url.searchParams.get("niche") || "");
    await deps.ensureRequiredColumns(db, deps.prospectListRequiredColumns);
    const rows = await db
      .prepare(
        `SELECT p.*,
                l.business_id AS lead_business_id,
                l.status AS lead_status
         FROM places_prospects p
         LEFT JOIN leads l ON l.business_id = p.generated_business_id
         WHERE (? = '' OR p.status = ?)
           AND (? = ''
             OR (? = 'none' AND COALESCE(p.website_url, '') = '' AND COALESCE(p.website_check_status, '') = 'no_website')
             OR (? = 'unknown' AND COALESCE(p.website_url, '') = '' AND COALESCE(p.website_check_status, '') = '')
             OR (? = 'has' AND COALESCE(p.website_url, '') <> ''))
           AND (? = '' OR lower(p.business_name || ' ' || COALESCE(p.address, '') || ' ' || COALESCE(p.query, '')) LIKE '%' || ? || '%')
           AND (? IS NULL OR COALESCE(p.rating, 0) >= ?)
           AND (? IS NULL OR COALESCE(p.reviews, 0) >= ?)
           AND (? = '' OR lower(COALESCE(p.address, '')) LIKE '%' || ? || '%')
           AND (? = '' OR lower(COALESCE(p.address, '')) LIKE '%' || ? || '%')
           AND (? = '' OR lower(COALESCE(p.niche, '')) LIKE '%' || ? || '%')
         ORDER BY datetime(p.updated_at) DESC
         LIMIT 100`,
      )
      .bind(
        status,
        status,
        website,
        website,
        website,
        website,
        query,
        query,
        minRating,
        minRating,
        minReviews,
        minReviews,
        city,
        city,
        state,
        state,
        niche,
        niche,
      )
      .all<ProspectDbRow>();

    return deps.json((rows.results || []).map((row) => prospectRowToPlace(deps.placesDeps, row)));
  }

  if (request.method === "PUT" && segments.length === 3 && segments[2] === "status") {
    const placeId = decodeURIComponent(segments[1]);
    const body = await deps.readJsonBody(request);
    const status = deps.asString(body.status, "new");
    await deps.ensureRequiredColumns(db, deps.prospectStatusRequiredColumns);
    await deps.updateProspectRecord(db, placeId, { status });
    return deps.json({ success: true });
  }

  if (request.method === "PUT" && segments.length === 3 && segments[2] === "selection") {
    const placeId = decodeURIComponent(segments[1]);
    const body = await deps.readJsonBody(request);
    const photo = body.photo && typeof body.photo === "object" ? body.photo : {};
    const palette = Array.isArray(body.palette) ? body.palette.filter((item) => typeof item === "string") : [];
    const paletteOptions = Array.isArray(body.paletteOptions) ? body.paletteOptions : [];
    await deps.ensureRequiredColumns(db, deps.selectionRequiredColumns);
    const updates: Record<string, unknown> = {};
    if ("photo" in body) updates.selected_photo_json = JSON.stringify(photo);
    if ("palette" in body) updates.selected_palette_json = JSON.stringify(palette);
    if ("paletteOptions" in body) updates.palette_options_json = JSON.stringify(paletteOptions);
    await deps.updateProspectRecord(db, placeId, updates);
    return deps.json({ success: true });
  }

  return deps.errorJson("Not Found", 404);
}

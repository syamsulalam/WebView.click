import templateSchema from "../../JSON/template-schema.json";

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

type D1Database = {
  prepare: <T = unknown>(query: string) => D1PreparedStatement<T>;
  batch: <T = unknown>(statements: D1PreparedStatement<T>[]) => Promise<D1Result<T>[]>;
  exec: (query: string) => Promise<D1Result>;
};

type R2Bucket = {
  put: (key: string, value: ReadableStream | ArrayBuffer | ArrayBufferView | string, options?: { httpMetadata?: { contentType?: string } }) => Promise<unknown>;
};

type Env = {
  DB?: D1Database;
  R2?: R2Bucket;
  R2_PUBLIC_BASE_URL?: string;
  GOOGLE_PLACES_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  OPENAI_API_KEY?: string;
  GEMINI_API_KEY?: string;
  KIE_API_KEY?: string;
  OPENCODE_API_KEY?: string;
  OPENCODE_BASE_URL?: string;
};

type PagesContext = {
  request: Request;
  env: Env & Record<string, unknown>;
};

type LeadRow = {
  id: string;
  business_id: string;
  business_name: string;
  status: string;
  view_count?: number;
};

type SettingRow = {
  key: string;
  value: string;
};

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PUT,OPTIONS",
  "access-control-allow-headers": "content-type,authorization",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...jsonHeaders,
      ...corsHeaders,
    },
  });
}

function errorJson(error: string, status = 500, details?: unknown): Response {
  return json({ error, details }, status);
}

function getDb(env: Env): D1Database {
  if (!env.DB) {
    throw new Error("Cloudflare D1 binding `DB` is not configured.");
  }
  return env.DB;
}

async function tableColumns(db: D1Database, table: string): Promise<Set<string>> {
  const rows = await db.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
  return new Set((rows.results || []).map((row) => row.name));
}

async function addColumnIfMissing(db: D1Database, table: string, column: string, definition: string) {
  const columns = await tableColumns(db, table);
  if (!columns.has(column)) {
    await db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

async function setupTables(db: D1Database) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      business_id TEXT UNIQUE NOT NULL,
      business_name TEXT NOT NULL,
      niche TEXT,
      email TEXT,
      phone TEXT,
      gmb_url TEXT,
      website_url TEXT,
      rating REAL,
      reviews INTEGER,
      address TEXT,
      status TEXT DEFAULT 'scraped',
      view_count INTEGER DEFAULT 0,
      last_viewed_at DATETIME,
      last_contacted DATETIME,
      staff_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      package_type TEXT NOT NULL,
      amount_paid REAL DEFAULT 0.00,
      payment_status TEXT DEFAULT 'unpaid',
      payment_method TEXT,
      payment_reference TEXT,
      subscription_start_date DATETIME,
      subscription_end_date DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS crm_activities (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      staff_id TEXT,
      activity_type TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS json_sites (
      id TEXT PRIMARY KEY,
      business_id TEXT UNIQUE NOT NULL,
      json_content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await addColumnIfMissing(db, "leads", "email", "TEXT");
  await addColumnIfMissing(db, "leads", "phone", "TEXT");
  await addColumnIfMissing(db, "leads", "gmb_url", "TEXT");
  await addColumnIfMissing(db, "leads", "website_url", "TEXT");
  await addColumnIfMissing(db, "leads", "rating", "REAL");
  await addColumnIfMissing(db, "leads", "reviews", "INTEGER");
  await addColumnIfMissing(db, "leads", "address", "TEXT");
  await addColumnIfMissing(db, "leads", "view_count", "INTEGER DEFAULT 0");
  await addColumnIfMissing(db, "leads", "last_viewed_at", "DATETIME");
  await addColumnIfMissing(db, "leads", "staff_id", "TEXT");
  await addColumnIfMissing(db, "leads", "updated_at", "DATETIME");
  await addColumnIfMissing(db, "json_sites", "updated_at", "DATETIME");
}

async function getSetting(db: D1Database, env: Env, key: keyof Env & string): Promise<string | undefined> {
  const row = await db.prepare("SELECT value FROM system_settings WHERE key = ?").bind(key).first<SettingRow>();
  return row?.value || (typeof env[key] === "string" ? env[key] : undefined);
}

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function normalizeBusinessId(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug || crypto.randomUUID();
}

function extensionFromContentType(contentType: string | null) {
  if (!contentType) return "bin";
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("svg")) return "svg";
  if (contentType.includes("gif")) return "gif";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  return "bin";
}

function publicR2Url(env: Env, key: string) {
  const configuredBaseUrl = typeof env.R2_PUBLIC_BASE_URL === "string" ? env.R2_PUBLIC_BASE_URL : "";
  const baseUrl = (configuredBaseUrl || "https://assets.webview.click").replace(/\/$/, "");
  return `${baseUrl}/${key}`;
}

async function handleSettings(request: Request, db: D1Database): Promise<Response> {
  if (request.method === "GET") {
    try {
      const rows = await db.prepare("SELECT key, value FROM system_settings").all<SettingRow>();
      const settings = Object.fromEntries((rows.results || []).map((row) => [row.key, row.value]));
      return json(settings);
    } catch (error) {
      console.error("Settings fallback:", error);
      return json({});
    }
  }

  if (request.method === "POST") {
    const settings = await readJsonBody(request);
    const statements = Object.entries(settings)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) =>
        db
          .prepare(
            `INSERT INTO system_settings (key, value, updated_at)
             VALUES (?, ?, CURRENT_TIMESTAMP)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
          )
          .bind(key, String(value)),
      );

    if (statements.length > 0) {
      await db.batch(statements);
    }

    return json({ success: true });
  }

  return errorJson("Method Not Allowed", 405);
}

async function handlePublicSettings(db: D1Database): Promise<Response> {
  const rows = await db
    .prepare("SELECT key, value FROM system_settings WHERE key IN ('PAYMENT_LINK_BASIC', 'PAYMENT_LINK_PREMIUM')")
    .all<SettingRow>();
  const settings = Object.fromEntries((rows.results || []).map((row) => [row.key, row.value]));
  return json(settings);
}

async function handleActivities(db: D1Database): Promise<Response> {
  try {
    const activities = await db
      .prepare(
        `SELECT c.*, l.business_name
         FROM crm_activities c
         LEFT JOIN leads l ON c.lead_id = l.id
         ORDER BY c.created_at DESC
         LIMIT 10`,
      )
      .all();
    return json(activities.results || []);
  } catch (error) {
    console.error("Activities fallback:", error);
    return json([]);
  }
}

async function handleStats(db: D1Database): Promise<Response> {
  try {
    const leadsCount = await db.prepare("SELECT COUNT(*) as count FROM leads").first<{ count: number }>();
    const paidCount = await db.prepare("SELECT COUNT(*) as count FROM leads WHERE status='won_paid'").first<{ count: number }>();
    const revenueData = await db
      .prepare("SELECT SUM(amount_paid) as total_revenue FROM subscriptions WHERE payment_status='paid'")
      .first<{ total_revenue: number | null }>();

    const totalLeads = Number(leadsCount?.count || 0);
    const paidLeads = Number(paidCount?.count || 0);
    return json({
      totalLeads,
      conversionRate: totalLeads > 0 ? (paidLeads / totalLeads) * 100 : 0,
      totalRevenue: Number(revenueData?.total_revenue || 0),
    });
  } catch (error) {
    console.error("Stats fallback:", error);
    return json({
      totalLeads: 0,
      conversionRate: 0,
      totalRevenue: 0,
    });
  }
}

async function handleLeads(request: Request, db: D1Database, segments: string[]): Promise<Response> {
  if (request.method === "GET" && segments.length === 1) {
    const leads = await db.prepare("SELECT * FROM leads ORDER BY created_at DESC").all<LeadRow>();
    return json(leads.results || []);
  }

  if (request.method === "PUT" && segments.length === 3 && segments[2] === "status") {
    const id = segments[1];
    const body = await readJsonBody(request);
    const status = asString(body.status, "scraped");
    const staffId = asString(body.staffId, "system");

    await db.batch([
      db.prepare("UPDATE leads SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(status, id),
      db
        .prepare(
          `INSERT INTO crm_activities (id, lead_id, staff_id, activity_type, description)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(crypto.randomUUID(), id, staffId, "status_changed", `Status updated to ${status}`),
    ]);

    return json({ success: true });
  }

  if (request.method === "POST" && segments.length === 3 && segments[2] === "ping") {
    const businessId = segments[1];
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
    return json({ success: true });
  }

  return errorJson("Not Found", 404);
}

async function handlePlacesSearch(url: URL, db: D1Database, env: Env): Promise<Response> {
  const query = url.searchParams.get("query") || "";
  const placesKey = await getSetting(db, env, "GOOGLE_PLACES_API_KEY");

  const mockResult = {
    place_id: "mock-place",
    name: `Kedai Kopi Senja ${query}`,
    formatted_address: "Jl. Sudirman No 123",
    rating: 4.8,
    user_ratings_total: 120,
    business_status: "OPERATIONAL",
  };

  if (!placesKey || placesKey.length < 10) {
    return json({
      mock: true,
      status: "MOCK_NO_API_KEY",
      results: [mockResult],
    });
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${encodeURIComponent(placesKey)}`,
    );
    const data = await response.json() as { status?: string; results?: unknown[]; error_message?: string };

    if (!response.ok) {
      return json({
        status: "GOOGLE_HTTP_ERROR",
        error: data.error_message || `Google Places returned HTTP ${response.status}`,
        results: [],
      });
    }

    if (data.status && data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      const refererRestriction = data.error_message?.toLowerCase().includes("referer restrictions");
      return json({
        status: data.status,
        error: data.error_message || `Google Places status: ${data.status}`,
        hint: refererRestriction
          ? "Google Places key ini dipakai dari Cloudflare Pages Function/server-side, jadi tidak boleh memakai HTTP referrer restriction. Buat server key terpisah: Application restrictions = None, API restrictions = Places API, lalu simpan di /admin/settings sebagai GOOGLE_PLACES_API_KEY."
          : "Cek Google Cloud Console: pastikan billing aktif, Places API yang sesuai aktif, dan API key disimpan sebagai GOOGLE_PLACES_API_KEY.",
        results: [],
      });
    }

    if (!Array.isArray(data.results) || data.results.length === 0) {
      return json({
        status: data.status || "ZERO_RESULTS",
        results: [],
      });
    }

    return json({
      status: data.status || "OK",
      results: data.results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Places search failed:", error);
    return json({
      status: "PLACES_FETCH_FAILED",
      error: message,
      results: [],
    });
  }
}

async function handlePlacesPhoto(url: URL, db: D1Database, env: Env): Promise<Response> {
  const reference = url.searchParams.get("reference");
  const maxWidth = url.searchParams.get("maxwidth") || "320";
  const placesKey = await getSetting(db, env, "GOOGLE_PLACES_API_KEY");

  if (!reference) {
    return errorJson("Missing photo reference", 400);
  }

  if (!placesKey) {
    return errorJson("Google Places API key is not configured", 400);
  }

  const photoUrl = new URL("https://maps.googleapis.com/maps/api/place/photo");
  photoUrl.searchParams.set("maxwidth", maxWidth);
  photoUrl.searchParams.set("photo_reference", reference);
  photoUrl.searchParams.set("key", placesKey);

  const response = await fetch(photoUrl.toString(), { redirect: "follow" });
  if (!response.ok || !response.body) {
    return errorJson("Could not fetch Google Places photo", response.status || 500);
  }

  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", "*");
  headers.set("cache-control", "public, max-age=86400");
  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

async function generateAiJson(
  db: D1Database,
  env: Env,
  body: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const provider = asString(body.provider);
  const model = asString(body.model);
  const businessName = asString(body.businessName);
  const originData = body.originData || {};
  const brandPalette = Array.isArray(body.brandPalette) ? body.brandPalette : [];
  const selectedLogoImageUrl = asString(body.selectedLogoImageUrl);

  if (!provider || !model) {
    return null;
  }

  const systemMsg =
    `You are an expert web designer and copywriter. Generate a strictly typed JSON output formatted to this exact schema:\n` +
    `${JSON.stringify(templateSchema)}\n\n` +
    "Use the business info provided to fill in the text, adjust colors based on their niche, and provide engaging copywriting. If brandPalette is provided, use those colors as primary/accent/secondary inspiration. If selectedLogoImageUrl is provided, preserve it as the header logo image. ONLY output JSON, no markdown formatting.";
  const userMsg = `Business Name: ${businessName}\nData: ${JSON.stringify(originData)}\nBrand palette: ${JSON.stringify(brandPalette)}\nSelected logo image: ${selectedLogoImageUrl}`;

  let responseContent = "";

  if (provider === "OpenRouter") {
    const key = await getSetting(db, env, "OPENROUTER_API_KEY");
    if (!key) return null;
    const apiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemMsg },
          { role: "user", content: userMsg },
        ],
      }),
    });
    const aiJson = await apiRes.json() as { choices?: Array<{ message?: { content?: string } }> };
    responseContent = aiJson.choices?.[0]?.message?.content || "";
  } else if (provider === "OpenAI") {
    const key = await getSetting(db, env, "OPENAI_API_KEY");
    if (!key) return null;
    const apiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemMsg },
          { role: "user", content: userMsg },
        ],
      }),
    });
    const aiJson = await apiRes.json() as { choices?: Array<{ message?: { content?: string } }> };
    responseContent = aiJson.choices?.[0]?.message?.content || "";
  } else if (provider === "Gemini") {
    const key = await getSetting(db, env, "GEMINI_API_KEY");
    if (!key) return null;
    const apiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemMsg }] },
        contents: [{ parts: [{ text: userMsg }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    });
    const aiJson = await apiRes.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    responseContent = aiJson.candidates?.[0]?.content?.parts?.[0]?.text || "";
  } else if (provider === "KIE") {
    const key = await getSetting(db, env, "KIE_API_KEY");
    if (!key) return null;

    const kieModelMap: Record<string, { endpoint: string; model?: string; mode: "chat" | "responses" }> = {
      "kie/gpt-5-5": { endpoint: "https://api.kie.ai/codex/v1/responses", model: "gpt-5-5", mode: "responses" },
      "kie/gpt-5-2": { endpoint: "https://api.kie.ai/gpt-5-2/v1/chat/completions", mode: "chat" },
      "kie/gemini-3.1-pro": { endpoint: "https://api.kie.ai/gemini-3.1-pro/v1/chat/completions", mode: "chat" },
      "kie/gemini-3-flash": { endpoint: "https://api.kie.ai/gemini-3-flash/v1/chat/completions", mode: "chat" },
    };
    const kieConfig = kieModelMap[model] || kieModelMap["kie/gemini-3-flash"];

    if (kieConfig.mode === "responses") {
      const apiRes = await fetch(kieConfig.endpoint, {
        method: "POST",
        headers: {
          authorization: `Bearer ${key}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: kieConfig.model,
          stream: false,
          input: [
            {
              role: "user",
              content: [
                { type: "input_text", text: `${systemMsg}\n\n${userMsg}` },
              ],
            },
          ],
          reasoning: { effort: "high" },
        }),
      });
      const aiJson = await apiRes.json() as { output?: Array<{ content?: Array<{ text?: string }> }> };
      responseContent = aiJson.output
        ?.flatMap((item) => item.content || [])
        .map((item) => item.text || "")
        .join("\n") || "";
    } else {
      const apiRes = await fetch(kieConfig.endpoint, {
        method: "POST",
        headers: {
          authorization: `Bearer ${key}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemMsg },
            { role: "user", content: userMsg },
          ],
          stream: false,
          reasoning_effort: "high",
        }),
      });
      const aiJson = await apiRes.json() as { choices?: Array<{ message?: { content?: string } }> };
      responseContent = aiJson.choices?.[0]?.message?.content || "";
    }
  } else if (provider === "Opencode") {
    const key = await getSetting(db, env, "OPENCODE_API_KEY");
    const endpoint = await getSetting(db, env, "OPENCODE_BASE_URL") || "https://api.opencode.example.com/v1/chat/completions";
    if (!key) return null;
    const apiRes = await fetch(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemMsg },
          { role: "user", content: userMsg },
        ],
      }),
    });
    const aiJson = await apiRes.json() as { choices?: Array<{ message?: { content?: string } }> };
    responseContent = aiJson.choices?.[0]?.message?.content || "";
  }

  if (!responseContent) {
    return null;
  }

  const cleaned = responseContent.replace(/```json/g, "").replace(/```/g, "").trim();
  return JSON.parse(cleaned) as Record<string, unknown>;
}

function isImageField(key: string) {
  const normalized = key.toLowerCase();
  return normalized.includes("image") || normalized.includes("logo") || normalized.includes("photo") || normalized.includes("gallery");
}

function normalizeImageFilenames(value: unknown, businessId: string, hint = "asset"): unknown {
  if (Array.isArray(value)) {
    return value.map((item, index) => {
      if (typeof item === "string" && isImageField(hint) && item && !item.startsWith("http") && !item.startsWith("/") && !item.startsWith("data:")) {
        const parts = item.split(".");
        const extension = parts.length > 1 ? parts.pop() || "jpg" : "jpg";
        const cleanHint = hint.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "image";
        return `${businessId}-${cleanHint}-${index + 1}.${extension}`;
      }
      return normalizeImageFilenames(item, businessId, `${hint}-${index + 1}`);
    });
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const objectValue = value as Record<string, unknown>;
  for (const [key, childValue] of Object.entries(objectValue)) {
    if (typeof childValue === "string" && isImageField(key) && childValue && !childValue.startsWith("http") && !childValue.startsWith("/") && !childValue.startsWith("data:")) {
      const parts = childValue.split(".");
      const extension = parts.length > 1 ? parts.pop() || "jpg" : "jpg";
      const cleanHint = key.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || hint;
      objectValue[key] = `${businessId}-${cleanHint}.${extension}`;
    } else {
      objectValue[key] = normalizeImageFilenames(childValue, businessId, key);
    }
  }

  return objectValue;
}

function collectImageUrls(value: unknown, urls: Set<string>, keyHint = "") {
  if (Array.isArray(value)) {
    value.forEach((item) => {
      if (typeof item === "string" && isImageField(keyHint) && (item.startsWith("http") || item.startsWith("/api/"))) {
        urls.add(item);
      } else {
        collectImageUrls(item, urls, keyHint);
      }
    });
    return;
  }

  if (!value || typeof value !== "object") return;

  for (const [key, childValue] of Object.entries(value as Record<string, unknown>)) {
    if (typeof childValue === "string" && isImageField(key) && (childValue.startsWith("http") || childValue.startsWith("/api/"))) {
      urls.add(childValue);
    } else {
      collectImageUrls(childValue, urls, key);
    }
  }
}

function replaceStringValue(value: unknown, from: string, to: string): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => replaceStringValue(item, from, to));
  }

  if (!value || typeof value !== "object") {
    return value === from ? to : value;
  }

  const objectValue = value as Record<string, unknown>;
  for (const [key, childValue] of Object.entries(objectValue)) {
    objectValue[key] = replaceStringValue(childValue, from, to);
  }
  return objectValue;
}

async function uploadImageAssetsToR2(finalJson: Record<string, unknown>, env: Env, origin: string, businessId: string) {
  if (!env.R2) {
    return [] as string[];
  }

  const urls = new Set<string>();
  collectImageUrls(finalJson, urls);
  const assetKeys: string[] = [];
  let index = 1;

  for (const imageUrl of urls) {
    try {
      const absoluteUrl = new URL(imageUrl, origin).toString();
      const response = await fetch(absoluteUrl);
      if (!response.ok) continue;
      const contentType = response.headers.get("content-type");
      if (!contentType?.startsWith("image/")) continue;
      const extension = extensionFromContentType(contentType);
      const key = `sites/${businessId}/assets/${businessId}-asset-${String(index).padStart(2, "0")}.${extension}`;
      await env.R2.put(key, await response.arrayBuffer(), { httpMetadata: { contentType } });
      const publicUrl = publicR2Url(env, key);
      replaceStringValue(finalJson, imageUrl, publicUrl);
      assetKeys.push(key);
      index += 1;
    } catch (error) {
      console.error("R2 asset upload failed:", error);
    }
  }

  return assetKeys;
}

async function uploadJsonToR2(finalJson: Record<string, unknown>, env: Env, businessId: string) {
  if (!env.R2) return "";
  const key = `sites/${businessId}/${businessId}.json`;
  await env.R2.put(key, JSON.stringify(finalJson, null, 2), { httpMetadata: { contentType: "application/json; charset=utf-8" } });
  return key;
}

async function handleSites(request: Request, db: D1Database, env: Env, segments: string[]): Promise<Response> {
  if (request.method === "POST" && segments.length === 2 && segments[1] === "generate") {
    const body = await readJsonBody(request);
    const businessName = asString(body.businessName, "Untitled Business");
    const businessId = asString(body.businessId, normalizeBusinessId(businessName));
    const phone = asString(body.phone);
    const originData = body.originData && typeof body.originData === "object" ? body.originData as Record<string, unknown> : {};
    const provider = asString(body.provider, "mock");
    const model = asString(body.model, "mock-json");
    const brandPalette = Array.isArray(body.brandPalette) ? body.brandPalette.filter((item) => typeof item === "string") as string[] : [];
    const selectedLogoImageUrl = asString(body.selectedLogoImageUrl);

    let finalJson = body.jsonContent && typeof body.jsonContent === "object"
      ? body.jsonContent as Record<string, unknown>
      : structuredClone(templateSchema) as Record<string, unknown>;

    try {
      const generated = await generateAiJson(db, env, body);
      if (generated) {
        finalJson = generated;
      }
    } catch (error) {
      console.error("AI generation failed, using submitted JSON:", error);
    }

    if (finalJson.meta && typeof finalJson.meta === "object") {
      (finalJson.meta as Record<string, unknown>).businessId = businessId;
      if (brandPalette.length) {
        (finalJson.meta as Record<string, unknown>).brandPalette = brandPalette;
      }
    }

    if (selectedLogoImageUrl) {
      const globalConfig = finalJson.global && typeof finalJson.global === "object" ? finalJson.global as Record<string, unknown> : {};
      const headerConfig = globalConfig.header && typeof globalConfig.header === "object" ? globalConfig.header as Record<string, unknown> : {};
      headerConfig.logoImageUrl = selectedLogoImageUrl;
      globalConfig.header = headerConfig;
      finalJson.global = globalConfig;
    }

    if (brandPalette.length) {
      const design = finalJson.design && typeof finalJson.design === "object" ? finalJson.design as Record<string, unknown> : {};
      const themeVariables = design.themeVariables && typeof design.themeVariables === "object" ? design.themeVariables as Record<string, unknown> : {};
      const colors = themeVariables.colors && typeof themeVariables.colors === "object" ? themeVariables.colors as Record<string, unknown> : {};
      colors.primary = colors.primary || brandPalette[0];
      colors.accent = colors.accent || brandPalette[1] || brandPalette[0];
      colors.secondary = colors.secondary || brandPalette[2] || "#F3F4F6";
      themeVariables.colors = colors;
      design.themeVariables = themeVariables;
      finalJson.design = design;
    }

    normalizeImageFilenames(finalJson, businessId);
    const assetKeys = await uploadImageAssetsToR2(finalJson, env, new URL(request.url).origin, businessId);
    const jsonKey = await uploadJsonToR2(finalJson, env, businessId);
    if (jsonKey || assetKeys.length) {
      finalJson.storage = {
        ...(finalJson.storage && typeof finalJson.storage === "object" ? finalJson.storage as Record<string, unknown> : {}),
        r2JsonKey: jsonKey,
        r2JsonUrl: jsonKey ? publicR2Url(env, jsonKey) : "",
        r2AssetKeys: assetKeys,
      };
      if (jsonKey) {
        await uploadJsonToR2(finalJson, env, businessId);
      }
    }

    const leadId = crypto.randomUUID();
    const niche = asString(originData.types instanceof Array ? originData.types[0] : originData.niche, "general");
    const address = asString(originData.formatted_address);
    const websiteUrl = asString(originData.website);
    const rating = typeof originData.rating === "number" ? originData.rating : null;
    const reviews = typeof originData.user_ratings_total === "number" ? originData.user_ratings_total : null;

    await db
      .prepare(
        `INSERT INTO leads (id, business_id, business_name, niche, phone, website_url, rating, reviews, address, status, view_count, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'scraped', 0, CURRENT_TIMESTAMP)
         ON CONFLICT(business_id) DO UPDATE SET
           business_name = excluded.business_name,
           niche = excluded.niche,
           phone = excluded.phone,
           website_url = excluded.website_url,
           rating = excluded.rating,
           reviews = excluded.reviews,
           address = excluded.address,
           updated_at = CURRENT_TIMESTAMP`,
      )
      .bind(leadId, businessId, businessName, niche, phone, websiteUrl, rating, reviews, address)
      .run();

    try {
      await db
        .prepare(
          `INSERT INTO json_sites (id, business_id, json_content, updated_at)
           VALUES (?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(business_id) DO UPDATE SET json_content = excluded.json_content, updated_at = CURRENT_TIMESTAMP`,
        )
        .bind(crypto.randomUUID(), businessId, JSON.stringify(finalJson))
        .run();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.toLowerCase().includes("no column named id")) {
        throw error;
      }
      await db
        .prepare(
          `INSERT INTO json_sites (business_id, json_content)
           VALUES (?, ?)
           ON CONFLICT(business_id) DO UPDATE SET json_content = excluded.json_content, updated_at = CURRENT_TIMESTAMP`,
        )
        .bind(businessId, JSON.stringify(finalJson))
        .run();
    }

    const leadRow = await db.prepare("SELECT id FROM leads WHERE business_id = ?").bind(businessId).first<{ id: string }>();
    if (leadRow?.id) {
      await db
        .prepare(
          `INSERT INTO crm_activities (id, lead_id, staff_id, activity_type, description)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(crypto.randomUUID(), leadRow.id, "system", "note_added", `AI Website generated successfully using ${provider} (${model}).`)
        .run();
    }

    return json({ success: true, businessId });
  }

  if (request.method === "GET" && segments.length === 2) {
    const businessId = segments[1];
    const row = await db.prepare("SELECT json_content FROM json_sites WHERE business_id = ?").bind(businessId).first<{ json_content: string }>();
    if (!row?.json_content) {
      return errorJson("Site not found", 404);
    }
    return json(JSON.parse(row.json_content));
  }

  return errorJson("Not Found", 404);
}

async function route(context: PagesContext): Promise<Response> {
  const { request, env } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(request.url);
  const segments = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);

  try {
    const db = getDb(env);
    try {
      await setupTables(db);
    } catch (setupError) {
      console.error("DB setup fallback:", setupError);
    }

    if (segments.length === 0) {
      return json({ ok: true, service: "webview-click-api" });
    }

    if (segments[0] === "settings") {
      return handleSettings(request, db);
    }

    if (request.method === "GET" && segments[0] === "public-settings") {
      return handlePublicSettings(db);
    }

    if (request.method === "GET" && segments[0] === "schema") {
      return json(templateSchema);
    }

    if (request.method === "GET" && segments[0] === "activities") {
      return handleActivities(db);
    }

    if (request.method === "GET" && segments[0] === "stats") {
      return handleStats(db);
    }

    if (segments[0] === "leads") {
      return handleLeads(request, db, segments);
    }

    if (request.method === "GET" && segments[0] === "places" && segments[1] === "photo") {
      return handlePlacesPhoto(url, db, env);
    }

    if (request.method === "GET" && segments[0] === "places" && segments[1] === "search") {
      return handlePlacesSearch(url, db, env);
    }

    if (segments[0] === "sites") {
      return handleSites(request, db, env, segments);
    }

    return errorJson("Not Found", 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("API error:", error);
    return errorJson(message, 500);
  }
}

export const onRequest = route;

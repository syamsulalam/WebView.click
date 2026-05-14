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

type Env = {
  DB?: D1Database;
  R2?: unknown;
  GOOGLE_PLACES_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  OPENAI_API_KEY?: string;
  GEMINI_API_KEY?: string;
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

  const migrations = [
    "ALTER TABLE leads ADD COLUMN email TEXT",
    "ALTER TABLE leads ADD COLUMN phone TEXT",
    "ALTER TABLE leads ADD COLUMN gmb_url TEXT",
    "ALTER TABLE leads ADD COLUMN website_url TEXT",
    "ALTER TABLE leads ADD COLUMN rating REAL",
    "ALTER TABLE leads ADD COLUMN reviews INTEGER",
    "ALTER TABLE leads ADD COLUMN address TEXT",
    "ALTER TABLE leads ADD COLUMN view_count INTEGER DEFAULT 0",
    "ALTER TABLE leads ADD COLUMN last_viewed_at DATETIME",
    "ALTER TABLE leads ADD COLUMN staff_id TEXT",
    "ALTER TABLE leads ADD COLUMN updated_at DATETIME",
    "ALTER TABLE json_sites ADD COLUMN updated_at DATETIME",
  ];

  for (const migration of migrations) {
    try {
      await db.exec(migration);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.toLowerCase().includes("duplicate column")) {
        throw error;
      }
    }
  }
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

async function handleSettings(request: Request, db: D1Database): Promise<Response> {
  if (request.method === "GET") {
    const rows = await db.prepare("SELECT key, value FROM system_settings").all<SettingRow>();
    const settings = Object.fromEntries((rows.results || []).map((row) => [row.key, row.value]));
    return json(settings);
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
  const activities = await db
    .prepare(
      `SELECT c.*, l.business_name
       FROM crm_activities c
       JOIN leads l ON c.lead_id = l.id
       ORDER BY c.created_at DESC
       LIMIT 10`,
    )
    .all();
  return json(activities.results || []);
}

async function handleStats(db: D1Database): Promise<Response> {
  const leadsCount = await db.prepare("SELECT COUNT(*) as count FROM leads").first<{ count: number }>();
  const paidCount = await db.prepare("SELECT COUNT(*) as count FROM leads WHERE status='won_paid'").first<{ count: number }>();
  const revenueData = await db
    .prepare("SELECT SUM(amount_paid) as total_revenue FROM subscriptions WHERE payment_status='paid'")
    .first<{ total_revenue: number | null }>();

  const totalLeads = leadsCount?.count || 0;
  const paidLeads = paidCount?.count || 0;
  return json({
    totalLeads,
    conversionRate: totalLeads > 0 ? (paidLeads / totalLeads) * 100 : 0,
    totalRevenue: revenueData?.total_revenue || 0,
  });
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

  if (!placesKey || placesKey.length < 10) {
    return json({
      mock: true,
      results: [
        {
          place_id: "mock-place",
          name: `Kedai Kopi Senja ${query}`,
          formatted_address: "Jl. Sudirman No 123",
          rating: 4.8,
          user_ratings_total: 120,
          business_status: "OPERATIONAL",
        },
      ],
    });
  }

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${encodeURIComponent(placesKey)}`,
  );
  const data = await response.json();
  return json(data, response.ok ? 200 : response.status);
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

  if (!provider || !model) {
    return null;
  }

  const systemMsg =
    `You are an expert web designer and copywriter. Generate a strictly typed JSON output formatted to this exact schema:\n` +
    `${JSON.stringify(templateSchema)}\n\n` +
    "Use the business info provided to fill in the text, adjust colors based on their niche, and provide engaging copywriting. ONLY output JSON, no markdown formatting.";
  const userMsg = `Business Name: ${businessName}\nData: ${JSON.stringify(originData)}`;

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

async function handleSites(request: Request, db: D1Database, env: Env, segments: string[]): Promise<Response> {
  if (request.method === "POST" && segments.length === 2 && segments[1] === "generate") {
    const body = await readJsonBody(request);
    const businessName = asString(body.businessName, "Untitled Business");
    const businessId = asString(body.businessId, normalizeBusinessId(businessName));
    const phone = asString(body.phone);
    const originData = body.originData && typeof body.originData === "object" ? body.originData as Record<string, unknown> : {};
    const provider = asString(body.provider, "mock");
    const model = asString(body.model, "mock-json");

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
    await setupTables(db);

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

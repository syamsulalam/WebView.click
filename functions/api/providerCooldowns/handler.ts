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
};

export type ProviderCooldownDeps = {
  json: (data: unknown, status?: number) => Response;
  errorJson: (error: string, status?: number, details?: unknown) => Response;
  readJsonBody: (request: Request) => Promise<Record<string, unknown>>;
  asString: (value: unknown, fallback?: string) => string;
  parseJsonObject: (value: string | null | undefined) => Record<string, unknown>;
};

function providerCooldownKey(provider = "") {
  return provider.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") || "api-provider";
}

function providerCooldownRowToJson(row: { provider?: string; until_ms?: number; reason?: string; raw_message?: string } | null) {
  if (!row?.until_ms || Number(row.until_ms) <= Date.now()) return null;
  return {
    provider: row.provider || "",
    until: Number(row.until_ms),
    reason: row.reason || "",
    rawMessage: row.raw_message || "",
  };
}

async function pruneProviderCooldownEvents(db: D1DatabaseLike) {
  try {
    await db.prepare("DELETE FROM provider_cooldown_events WHERE datetime(created_at) < datetime('now', '-45 days')").run();
    await db
      .prepare(
        `DELETE FROM provider_cooldown_events
         WHERE id NOT IN (
           SELECT id FROM provider_cooldown_events
           ORDER BY datetime(created_at) DESC
           LIMIT 500
         )`,
      )
      .run();
  } catch (error) {
    console.error("Provider cooldown event prune failed, continuing:", error);
  }
}

export async function insertProviderCooldownEvent(db: D1DatabaseLike, input: {
  provider: string;
  eventType: string;
  cooldownUntil?: number | null;
  reason?: string;
  rawMessage?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await db
      .prepare(
        `INSERT INTO provider_cooldown_events
          (id, provider_key, provider, event_type, cooldown_until_ms, reason, raw_message, metadata_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        providerCooldownKey(input.provider),
        input.provider,
        input.eventType,
        input.cooldownUntil || null,
        (input.reason || "").slice(0, 500),
        (input.rawMessage || "").slice(0, 4000),
        JSON.stringify(input.metadata || {}),
      )
      .run();
    await pruneProviderCooldownEvents(db);
  } catch (error) {
    console.error("Provider cooldown event insert failed, continuing:", error);
  }
}

export async function handleProviderCooldowns(deps: ProviderCooldownDeps, request: Request, db: D1DatabaseLike, url: URL, segments: string[]): Promise<Response> {
  if (request.method === "GET" && segments[1] === "history") {
    const requestedLimit = Number(url.searchParams.get("limit") || "20");
    const limit = Math.min(100, Math.max(1, Number.isFinite(requestedLimit) ? Math.floor(requestedLimit) : 20));
    const provider = url.searchParams.get("provider") || "";
    const providerKey = provider ? providerCooldownKey(provider) : "";
    const sql = providerKey
      ? `SELECT id, provider, event_type, cooldown_until_ms, reason, raw_message, metadata_json, created_at
         FROM provider_cooldown_events
         WHERE provider_key = ?
         ORDER BY datetime(created_at) DESC
         LIMIT ?`
      : `SELECT id, provider, event_type, cooldown_until_ms, reason, raw_message, metadata_json, created_at
         FROM provider_cooldown_events
         ORDER BY datetime(created_at) DESC
         LIMIT ?`;
    const rows = providerKey
      ? await db.prepare(sql).bind(providerKey, limit).all<{ id: string; provider: string; event_type: string; cooldown_until_ms?: number; reason?: string; raw_message?: string; metadata_json?: string; created_at?: string }>()
      : await db.prepare(sql).bind(limit).all<{ id: string; provider: string; event_type: string; cooldown_until_ms?: number; reason?: string; raw_message?: string; metadata_json?: string; created_at?: string }>();
    return deps.json((rows.results || []).map((row) => ({
      id: row.id,
      provider: row.provider || "",
      eventType: row.event_type || "",
      cooldownUntil: Number(row.cooldown_until_ms || 0) || null,
      reason: row.reason || "",
      rawMessage: row.raw_message || "",
      metadata: deps.parseJsonObject(row.metadata_json),
      createdAt: row.created_at || "",
    })));
  }

  if (request.method === "GET") {
    const provider = url.searchParams.get("provider") || "";
    const providerKey = providerCooldownKey(provider);
    const row = await db
      .prepare("SELECT provider, until_ms, reason, raw_message FROM provider_cooldowns WHERE provider_key = ?")
      .bind(providerKey)
      .first<{ provider: string; until_ms: number; reason?: string; raw_message?: string }>();
    const cooldown = providerCooldownRowToJson(row);
    if (!cooldown && row) {
      await db.prepare("DELETE FROM provider_cooldowns WHERE provider_key = ?").bind(providerKey).run();
    }
    return deps.json({ cooldown });
  }

  if (request.method === "POST") {
    const body = await deps.readJsonBody(request);
    const provider = deps.asString(body.provider).trim();
    if (!provider) return deps.errorJson("provider is required", 400);
    const providerKey = providerCooldownKey(provider);
    const untilMs = Math.floor(Number(body.until || body.untilMs || 0));
    const cooldownMs = Math.floor(Number(body.cooldownMs || 0));
    const computedUntil = cooldownMs > 0 ? Date.now() + cooldownMs : untilMs;
    if (!Number.isFinite(computedUntil) || computedUntil <= Date.now()) {
      return deps.errorJson("until or cooldownMs must be in the future", 400);
    }
    const cappedUntil = Math.min(computedUntil, Date.now() + 24 * 60 * 60 * 1000);
    const reason = deps.asString(body.reason).slice(0, 500);
    const rawMessage = deps.asString(body.rawMessage || body.raw_message).slice(0, 4000);
    await db
      .prepare(
        `INSERT INTO provider_cooldowns (provider_key, provider, until_ms, reason, raw_message, updated_at)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(provider_key) DO UPDATE SET
           provider = excluded.provider,
           until_ms = CASE
             WHEN excluded.until_ms > provider_cooldowns.until_ms THEN excluded.until_ms
             ELSE provider_cooldowns.until_ms
           END,
           reason = excluded.reason,
           raw_message = excluded.raw_message,
           updated_at = CURRENT_TIMESTAMP`,
      )
      .bind(providerKey, provider, cappedUntil, reason, rawMessage)
      .run();
    await insertProviderCooldownEvent(db, {
      provider,
      eventType: "set",
      cooldownUntil: cappedUntil,
      reason,
      rawMessage,
      metadata: { source: "api_provider_cooldown_post" },
    });
    const row = await db
      .prepare("SELECT provider, until_ms, reason, raw_message FROM provider_cooldowns WHERE provider_key = ?")
      .bind(providerKey)
      .first<{ provider: string; until_ms: number; reason?: string; raw_message?: string }>();
    return deps.json({ success: true, cooldown: providerCooldownRowToJson(row) });
  }

  if (request.method === "DELETE") {
    const provider = url.searchParams.get("provider") || "";
    const providerKey = providerCooldownKey(provider);
    const row = await db
      .prepare("SELECT provider, until_ms, reason, raw_message FROM provider_cooldowns WHERE provider_key = ?")
      .bind(providerKey)
      .first<{ provider: string; until_ms: number; reason?: string; raw_message?: string }>();
    await db.prepare("DELETE FROM provider_cooldowns WHERE provider_key = ?").bind(providerKey).run();
    await insertProviderCooldownEvent(db, {
      provider: provider || row?.provider || "API provider",
      eventType: "clear",
      cooldownUntil: row?.until_ms || null,
      reason: "Manual cooldown clear",
      rawMessage: row?.raw_message || "",
      metadata: { previousReason: row?.reason || "" },
    });
    return deps.json({ success: true, cooldown: null });
  }

  return deps.errorJson("Method not allowed", 405);
}

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

export type AiReadinessDeps = {
  json: (data: unknown, status?: number) => Response;
  errorJson: (error: string, status?: number, details?: unknown) => Response;
  readJsonBody: (request: Request) => Promise<Record<string, unknown>>;
  asString: (value: unknown, fallback?: string) => string;
  parseJsonObject: (value: string | null | undefined) => Record<string, unknown>;
  getSetting: (db: D1DatabaseLike, env: unknown, key: string) => Promise<string | undefined>;
  incrementDailyUsage: (db: D1DatabaseLike, counterKey: "ai_readiness_remote", amount?: number) => Promise<void>;
};

export const aiProviderKeyMap: Record<string, string> = {
  OpenRouter: "OPENROUTER_API_KEY",
  OpenAI: "OPENAI_API_KEY",
  Gemini: "GEMINI_API_KEY",
  KIE: "KIE_API_KEY",
  Opencode: "OPENCODE_API_KEY",
};

export const aiProviderModels: Record<string, string[]> = {
  OpenAI: ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-4.1"],
  Gemini: ["gemini-3.1-pro-preview", "gemini-3-flash-preview", "gemini-3.1-flash-lite", "gemini-2.5-pro"],
  OpenRouter: [
    "~anthropic/claude-sonnet-latest",
    "anthropic/claude-sonnet-latest",
    "~openai/gpt-latest",
    "openai/gpt-latest",
    "~google/gemini-pro-latest",
    "google/gemini-pro-latest",
    "~google/gemini-flash-latest",
    "google/gemini-flash-latest",
    "qwen/qwen3.6-max-preview",
    "qwen/qwen3.6-flash",
  ],
  KIE: ["kie/gemini-2.5-flash", "kie/gemini-3-flash", "kie/gpt-5-4", "kie/gemini-3.1-pro", "kie/gpt-5-5", "kie/gpt-5-2"],
  Opencode: ["opencode-default", "qwen/qwen3.6-flash", "qwen/qwen3.6-max-preview", "custom-model"],
};

export const kieModelConfigs: Record<string, { endpoint: string; model?: string; mode: "chat" | "responses" }> = {
  "kie/gemini-2.5-flash": { endpoint: "https://api.kie.ai/gemini-2.5-flash/v1/chat/completions", mode: "chat" },
  "kie/gemini-3-flash": { endpoint: "https://api.kie.ai/gemini-3-flash/v1/chat/completions", mode: "chat" },
  "kie/gpt-5-4": { endpoint: "https://api.kie.ai/codex/v1/responses", model: "gpt-5-4", mode: "responses" },
  "kie/gemini-3.1-pro": { endpoint: "https://api.kie.ai/gemini-3.1-pro/v1/chat/completions", mode: "chat" },
  "kie/gpt-5-5": { endpoint: "https://api.kie.ai/codex/v1/responses", model: "gpt-5-5", mode: "responses" },
  "kie/gpt-5-2": { endpoint: "https://api.kie.ai/gpt-5-2/v1/chat/completions", mode: "chat" },
};

const remoteAiReadinessCacheTtlMs = 2 * 60 * 1000;

type AiFailureDiagnostics = {
  provider: string;
  model: string;
  endpoint?: string;
  stage: string;
  failureKind: string;
  httpStatus?: number;
  providerCode?: string;
  providerStatus?: string;
  retryable: boolean;
  message: string;
  rawSnippet?: string;
  actionHint: string;
  checkedAt: string;
};

async function sha256Hex(value: string) {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normalizeAiModel(provider: string, model: string) {
  return model;
}

export function extractProviderErrorDetails(text: string) {
  const snippet = text.replace(/\s+/g, " ").trim().slice(0, 600);
  if (!text) {
    return { message: "", rawSnippet: "", providerCode: "", providerStatus: "" };
  }
  try {
    const payload = JSON.parse(text);
    const error = payload?.error && typeof payload.error === "object" ? payload.error : {};
    const message = typeof error.message === "string"
      ? error.message
      : typeof payload.message === "string"
        ? payload.message
        : typeof payload.msg === "string"
          ? payload.msg
          : typeof payload.error === "string"
            ? payload.error
            : snippet;
    return {
      message,
      rawSnippet: snippet,
      providerCode: typeof error.code === "string" ? error.code : typeof payload.code === "string" ? payload.code : "",
      providerStatus: typeof error.status === "string" ? error.status : typeof error.type === "string" ? error.type : typeof payload.status === "string" ? payload.status : "",
    };
  } catch {
    return { message: snippet, rawSnippet: snippet, providerCode: "", providerStatus: "" };
  }
}

function classifyAiFailure(status: number | undefined, providerStatus: string, message: string, stage = "provider_http") {
  const raw = `${providerStatus} ${message}`.toLowerCase();
  if (stage === "provider_network" || /fetch failed|network|dns|econn|socket|tls/i.test(raw)) {
    return { failureKind: "network_error", retryable: true, actionHint: "Retry once after a short wait. If it repeats, switch provider or check upstream connectivity." };
  }
  if (stage === "provider_empty_response") {
    return { failureKind: "empty_response", retryable: true, actionHint: "Retry once. If it repeats, switch model/provider because the provider returned no usable content." };
  }
  if (stage === "provider_invalid_json") {
    return { failureKind: "invalid_json", retryable: false, actionHint: "Switch to a stronger model or reduce prompt complexity; the provider returned text that could not be parsed as JSON." };
  }
  if (stage === "provider_cooldown" || /cooldown|cooling down/i.test(raw)) {
    return { failureKind: "provider_cooldown", retryable: true, actionHint: "Wait for the shared provider cooldown to end, or switch provider/model." };
  }
  if (status === 429 || /quota|rate limit|too many requests|resource_exhausted|requests per minute|tokens per minute|rpm|tpm/i.test(raw)) {
    return { failureKind: "quota_or_rate_limit", retryable: true, actionHint: "Wait for the cooldown, reduce batch size, or switch provider/model before retrying." };
  }
  if (status === 402 || /credit|insufficient|balance|billing/i.test(raw)) {
    return { failureKind: "credits_or_billing", retryable: false, actionHint: "Check provider credits/billing, then refresh AI readiness before retrying." };
  }
  if (status === 401 || status === 403 || /unauthorized|forbidden|permission|invalid key|api key|access denied|ip whitelist|ip allowlist|allowlist|server ip/i.test(raw)) {
    return {
      failureKind: "auth_or_permission",
      retryable: false,
      actionHint: /ip whitelist|ip allowlist|allowlist|server ip/i.test(raw)
        ? "Remove or update the provider IP whitelist for this API key. Cloudflare Pages Functions egress may not match a single fixed server IP."
        : "Verify the saved API key, project permissions, and model access in Settings.",
    };
  }
  if (status === 400 || status === 404 || status === 422 || /model.*not|not found|unsupported|invalid model|invalid_argument|validation|bad request/i.test(raw)) {
    return { failureKind: "bad_request_or_model", retryable: false, actionHint: "Check the selected provider/model and request format. Refresh AI readiness before trying again." };
  }
  if (status === 455 || status === 500 || status === 502 || status === 503 || status === 504 || /unavailable|overloaded|timeout|timed out|upstream|temporary|maintenance/i.test(raw)) {
    return { failureKind: "provider_temporary", retryable: true, actionHint: "Wait a minute and retry once, or switch provider/model if this blocks a batch." };
  }
  return { failureKind: "unknown_provider_error", retryable: false, actionHint: "Open the raw error in Jobs, then retry only after changing provider, model, input, or quota state." };
}

export function buildAiFailureDiagnostics(input: {
  provider: string;
  model: string;
  endpoint?: string;
  stage: string;
  httpStatus?: number;
  message: string;
  rawSnippet?: string;
  providerCode?: string;
  providerStatus?: string;
}): AiFailureDiagnostics {
  const classified = classifyAiFailure(input.httpStatus, input.providerStatus || input.providerCode || "", input.message, input.stage);
  return {
    provider: input.provider,
    model: input.model,
    endpoint: input.endpoint,
    stage: input.stage,
    failureKind: classified.failureKind,
    httpStatus: input.httpStatus,
    providerCode: input.providerCode,
    providerStatus: input.providerStatus,
    retryable: classified.retryable,
    message: input.message,
    rawSnippet: input.rawSnippet,
    actionHint: classified.actionHint,
    checkedAt: new Date().toISOString(),
  };
}

async function aiReadinessCacheKey(provider: string, model: string, key: string) {
  const keyHash = key ? (await sha256Hex(key)).slice(0, 16) : "no-key";
  return {
    keyHash,
    cacheKey: `${provider.trim().toLowerCase()}::${model.trim().toLowerCase()}::${keyHash}`,
  };
}

async function getCachedRemoteAiValidation(deps: AiReadinessDeps, db: D1DatabaseLike, cacheKey: string) {
  const now = new Date().toISOString();
  const row = await db
    .prepare(
      `SELECT validation_json, expires_at
       FROM ai_readiness_cache
       WHERE cache_key = ? AND expires_at > ?`,
    )
    .bind(cacheKey, now)
    .first<{ validation_json?: string; expires_at?: string }>();
  if (!row?.validation_json) return null;
  return {
    ...deps.parseJsonObject(row.validation_json),
    cacheHit: true,
    cacheExpiresAt: row.expires_at,
  };
}

async function putCachedRemoteAiValidation(
  db: D1DatabaseLike,
  cacheKey: string,
  provider: string,
  model: string,
  keyHash: string,
  validation: Record<string, unknown>,
) {
  const now = new Date();
  const nowIso = now.toISOString();
  const expiresAt = new Date(now.getTime() + remoteAiReadinessCacheTtlMs).toISOString();
  const validationJson = JSON.stringify({ ...validation, cacheHit: false, cacheStoredAt: nowIso, cacheExpiresAt: expiresAt });

  await db
    .prepare(
      `INSERT INTO ai_readiness_cache (cache_key, provider, model, key_hash, validation_json, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(cache_key) DO UPDATE SET
         provider = excluded.provider,
         model = excluded.model,
         key_hash = excluded.key_hash,
         validation_json = excluded.validation_json,
         created_at = excluded.created_at,
         expires_at = excluded.expires_at`,
    )
    .bind(cacheKey, provider, model, keyHash, validationJson, nowIso, expiresAt)
    .run();

  await db.prepare("DELETE FROM ai_readiness_cache WHERE expires_at <= ?").bind(nowIso).run()
    .catch((error) => console.error("AI readiness cache cleanup failed:", error));
}

async function validateAiModelRemotely(deps: AiReadinessDeps, db: D1DatabaseLike, env: unknown, provider: string, model: string) {
  const normalizedProvider = provider.trim();
  const normalizedModel = normalizeAiModel(normalizedProvider, model.trim());
  const checkedAt = new Date().toISOString();
  const baseResult = { requested: true, checkedAt, provider: normalizedProvider, model, normalizedModel };
  const errorSnippet = async (response: Response) => {
    const text = await response.text().catch(() => "");
    if (!text) return `HTTP ${response.status}`;
    try {
      const payload = JSON.parse(text);
      return deps.asString(payload.error?.message, deps.asString(payload.error, deps.asString(payload.message, text.slice(0, 180))));
    } catch {
      return text.slice(0, 180);
    }
  };

  if (normalizedProvider === "OpenRouter") {
    const key = await deps.getSetting(db, env, "OPENROUTER_API_KEY");
    const response = await fetch("https://openrouter.ai/api/v1/models", { headers: key ? { authorization: `Bearer ${key}` } : {} });
    if (!response.ok) {
      return { ...baseResult, supported: true, valid: false, status: response.status, message: `OpenRouter model list validation failed: ${await errorSnippet(response)}` };
    }
    const payload = await response.json().catch(() => ({})) as { data?: Array<Record<string, unknown>> };
    const aliases = normalizedModel.startsWith("~") ? [normalizedModel, normalizedModel.slice(1)] : [normalizedModel];
    const match = (payload.data || []).find((item) => aliases.includes(deps.asString(item.id)) || aliases.includes(deps.asString(item.canonical_slug)));
    const matchedModel = match ? deps.asString(match.id, deps.asString(match.canonical_slug)).replace(/^~/, "") : "";
    if (matchedModel) {
      const endpointPath = matchedModel.split("/").map((part) => encodeURIComponent(part)).join("/");
      const endpointResponse = await fetch(`https://openrouter.ai/api/v1/models/${endpointPath}/endpoints`, { headers: key ? { authorization: `Bearer ${key}` } : {} });
      if (!endpointResponse.ok) {
        return { ...baseResult, supported: true, valid: false, matchedModel, status: endpointResponse.status, message: `OpenRouter endpoint validation failed for ${model}: ${await errorSnippet(endpointResponse)}` };
      }
      const endpointPayload = await endpointResponse.json().catch(() => ({})) as { data?: unknown; endpoints?: unknown };
      const endpointData = endpointPayload.data;
      const endpoints = Array.isArray(endpointData)
        ? endpointData
        : endpointData && typeof endpointData === "object" && Array.isArray((endpointData as Record<string, unknown>).endpoints)
          ? (endpointData as Record<string, unknown>).endpoints as unknown[]
          : Array.isArray(endpointPayload.endpoints)
            ? endpointPayload.endpoints
            : [];
      return {
        ...baseResult,
        supported: true,
        valid: endpoints.length > 0,
        matchedModel,
        endpointCount: endpoints.length,
        message: endpoints.length > 0 ? `OpenRouter model and endpoint metadata found for ${model}.` : `OpenRouter model ${model} exists, but no routable endpoints were returned.`,
      };
    }
    return { ...baseResult, supported: true, valid: Boolean(match), matchedModel, message: match ? `OpenRouter model routing metadata found for ${model}.` : `OpenRouter model list does not include ${model}.` };
  }

  if (normalizedProvider === "OpenAI") {
    const key = await deps.getSetting(db, env, "OPENAI_API_KEY");
    const response = await fetch(`https://api.openai.com/v1/models/${encodeURIComponent(normalizedModel)}`, { headers: { authorization: `Bearer ${key}` } });
    return { ...baseResult, supported: true, valid: response.ok, status: response.status, message: response.ok ? `OpenAI model metadata found for ${model}.` : `OpenAI model validation failed for ${model}: ${await errorSnippet(response)}` };
  }

  if (normalizedProvider === "Gemini") {
    const key = await deps.getSetting(db, env, "GEMINI_API_KEY");
    const modelPath = normalizedModel.startsWith("models/") ? normalizedModel : `models/${normalizedModel}`;
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${modelPath}?key=${encodeURIComponent(key || "")}`);
    return { ...baseResult, supported: true, valid: response.ok, status: response.status, message: response.ok ? `Gemini model metadata found for ${model}.` : `Gemini model validation failed for ${model}: ${await errorSnippet(response)}` };
  }

  if (normalizedProvider === "KIE") {
    const key = await deps.getSetting(db, env, "KIE_API_KEY");
    const kieConfig = kieModelConfigs[normalizedModel];
    if (!kieConfig) {
      return { ...baseResult, supported: true, valid: false, message: `KIE.ai model is not configured for generation in WebView.click: ${model}.` };
    }
    const response = await fetch("https://api.kie.ai/api/v1/chat/credit", { headers: { authorization: `Bearer ${key}` } });
    const payload = await response.clone().json().catch(() => null) as { code?: number; msg?: string; data?: number } | null;
    const remainingCredits = typeof payload?.data === "number" ? payload.data : null;
    const providerOk = response.ok && payload !== null && (payload.code === 200 || payload.msg === "success");
    return {
      ...baseResult,
      supported: true,
      valid: providerOk && (remainingCredits === null || remainingCredits > 0),
      status: response.status,
      endpoint: kieConfig.endpoint,
      remainingCredits,
      message: providerOk
        ? remainingCredits === 0
          ? `KIE.ai key is valid, but the account has no remaining credits for ${model}.`
          : `KIE.ai key/credits check passed and ${model} is mapped to ${kieConfig.endpoint}.`
        : `KIE.ai key/credit validation failed for ${model}: ${payload?.msg || await errorSnippet(response)}`,
    };
  }

  return { ...baseResult, supported: false, valid: null, message: `${normalizedProvider || "Selected provider"} does not expose a lightweight model metadata check in WebView.click yet.` };
}

export async function getAiReadiness(deps: AiReadinessDeps, db: D1DatabaseLike, env: unknown, provider: string, model: string, requiresAi = true, remoteValidate = false, refreshRemoteValidation = false) {
  const normalizedProvider = provider.trim();
  const normalizedModel = normalizeAiModel(normalizedProvider, model.trim());
  if (!requiresAi) {
    return {
      ready: true,
      requiresAi,
      provider: normalizedProvider,
      model,
      normalizedModel,
      keyPresent: false,
      providerSupported: true,
      modelKnown: true,
      remoteValidation: { requested: remoteValidate, supported: false, valid: null, cacheHit: false },
      message: "This action only resaves gathered data and does not require AI.",
      checkedAt: new Date().toISOString(),
    };
  }

  const keyName = aiProviderKeyMap[normalizedProvider];
  const providerSupported = Boolean(keyName);
  const providerModels = aiProviderModels[normalizedProvider] || [];
  const modelKnown = providerSupported && providerModels.includes(model.trim());
  const key = keyName ? await deps.getSetting(db, env, keyName) : "";
  const keyPresent = Boolean(String(key || "").trim());
  let message = "AI provider key and model look ready.";
  if (!providerSupported) message = `Unsupported AI provider: ${normalizedProvider || "(blank)"}.`;
  else if (!model.trim()) message = `Select an AI model for ${normalizedProvider}.`;
  else if (!modelKnown) message = `${normalizedProvider} model is not in the supported WebView.click model list: ${model}.`;
  else if (!keyPresent) message = `${normalizedProvider} API key is not configured. Set it in /admin/settings first.`;

  let remoteValidation: Record<string, unknown> = { requested: remoteValidate, supported: false, valid: null, cacheHit: false };
  let remoteReady = true;
  if (remoteValidate && providerSupported && modelKnown && keyPresent) {
    try {
      const { cacheKey, keyHash } = await aiReadinessCacheKey(normalizedProvider, normalizedModel, key || "");
      let cachedValidation: Record<string, unknown> | null = null;
      if (!refreshRemoteValidation) {
        try {
          cachedValidation = await getCachedRemoteAiValidation(deps, db, cacheKey);
        } catch (cacheError) {
          console.error("AI readiness cache read failed, continuing without cache:", cacheError);
        }
      }
      if (cachedValidation) {
        remoteValidation = cachedValidation;
      } else {
        if (["OpenRouter", "OpenAI", "Gemini", "KIE"].includes(normalizedProvider)) {
          await deps.incrementDailyUsage(db, "ai_readiness_remote");
        }
        remoteValidation = await validateAiModelRemotely(deps, db, env, normalizedProvider, model.trim());
      }
      if (!cachedValidation && remoteValidation.supported === true) {
        try {
          await putCachedRemoteAiValidation(db, cacheKey, normalizedProvider, normalizedModel, keyHash, remoteValidation);
        } catch (cacheError) {
          console.error("AI readiness cache write failed, continuing with live validation:", cacheError);
        }
      }
      if (remoteValidation.supported === true) {
        remoteReady = remoteValidation.valid === true;
        message = remoteReady
          ? `${message} Remote model validation passed${remoteValidation.cacheHit ? " from server cache" : ""}.`
          : deps.asString(remoteValidation.message, `${normalizedProvider} remote model validation failed for ${model}.`);
      } else {
        message = `${message} Remote model validation is not supported for ${normalizedProvider}.`;
      }
    } catch (error) {
      remoteReady = false;
      remoteValidation = { requested: true, supported: true, valid: false, cacheHit: false, message: error instanceof Error ? error.message : String(error), checkedAt: new Date().toISOString() };
      message = `${normalizedProvider} remote model validation failed: ${remoteValidation.message}`;
    }
  }

  return {
    ready: providerSupported && modelKnown && keyPresent && remoteReady,
    requiresAi,
    provider: normalizedProvider,
    model,
    normalizedModel,
    keyName: keyName || "",
    keyPresent,
    providerSupported,
    modelKnown,
    remoteValidation,
    message,
    checkedAt: new Date().toISOString(),
  };
}

export async function handleAiReadiness(deps: AiReadinessDeps, request: Request, db: D1DatabaseLike, env: unknown): Promise<Response> {
  let provider = "";
  let model = "";
  let requiresAi = true;
  let remoteValidate = false;
  let refreshRemoteValidation = false;
  if (request.method === "GET") {
    const url = new URL(request.url);
    provider = url.searchParams.get("provider") || "";
    model = url.searchParams.get("model") || "";
    requiresAi = !["0", "false", "no"].includes((url.searchParams.get("requiresAi") || "1").toLowerCase());
    remoteValidate = ["1", "true", "yes"].includes((url.searchParams.get("remoteValidate") || url.searchParams.get("validateRemote") || "0").toLowerCase());
    refreshRemoteValidation = ["1", "true", "yes"].includes((url.searchParams.get("refresh") || url.searchParams.get("bypassCache") || "0").toLowerCase());
  } else if (request.method === "POST") {
    const body = await deps.readJsonBody(request);
    provider = deps.asString(body.provider);
    model = deps.asString(body.model);
    requiresAi = body.requiresAi !== false;
    remoteValidate = body.remoteValidate === true || body.validateRemote === true || ["1", "true", "yes"].includes(deps.asString(body.remoteValidate || body.validateRemote).toLowerCase());
    refreshRemoteValidation = body.refresh === true || body.bypassCache === true || ["1", "true", "yes"].includes(deps.asString(body.refresh || body.bypassCache).toLowerCase());
  } else {
    return deps.errorJson("Method not allowed", 405);
  }
  const result = await getAiReadiness(deps, db, env, provider, model, requiresAi, remoteValidate, refreshRemoteValidation);
  return deps.json(result);
}

export async function handleAiProviderFailure(deps: AiReadinessDeps, request: Request, db: D1DatabaseLike): Promise<Response> {
  if (request.method !== "GET") return deps.errorJson("Method not allowed", 405);
  const url = new URL(request.url);
  const provider = String(url.searchParams.get("provider") || "").trim();
  const model = String(url.searchParams.get("model") || "").trim();
  if (!provider) return deps.errorJson("provider is required", 400);

  const bindings: unknown[] = [provider];
  let modelSql = "";
  if (model) {
    modelSql = "AND model = ?";
    bindings.push(model);
  }

  const row = await db
    .prepare(
      `SELECT id, business_id, place_id, provider, model, error, metadata_json, created_at
       FROM generation_jobs
       WHERE status = 'failed'
         AND provider = ?
         ${modelSql}
         AND datetime(created_at) >= datetime('now', '-14 days')
       ORDER BY datetime(created_at) DESC
       LIMIT 1`,
    )
    .bind(...bindings)
    .first<{ id: string; business_id?: string; place_id?: string; provider?: string; model?: string; error?: string; metadata_json?: string; created_at?: string }>();

  if (!row) return deps.json({ failure: null });

  const metadata = deps.parseJsonObject(row.metadata_json);
  const storedFailure = metadata.aiFailure && typeof metadata.aiFailure === "object"
    ? metadata.aiFailure as Record<string, unknown>
    : metadata.providerFailure && typeof metadata.providerFailure === "object"
      ? metadata.providerFailure as Record<string, unknown>
      : null;
  const message = deps.asString(storedFailure?.message, deps.asString(metadata.failureMessage, row.error || ""));
  const httpStatus = Number(storedFailure?.httpStatus || message.match(/HTTP\s+(\d{3})/i)?.[1] || 0) || undefined;
  const fallbackFailure = buildAiFailureDiagnostics({
    provider: row.provider || provider,
    model: row.model || model,
    endpoint: deps.asString(storedFailure?.endpoint),
    stage: deps.asString(storedFailure?.stage, deps.asString(metadata.failureStage, "site_generate")),
    httpStatus,
    message,
    rawSnippet: deps.asString(storedFailure?.rawSnippet, row.error || ""),
    providerCode: deps.asString(storedFailure?.providerCode),
    providerStatus: deps.asString(storedFailure?.providerStatus),
  });
  return deps.json({
    failure: {
      ...fallbackFailure,
      ...(storedFailure || {}),
      provider: row.provider || provider,
      model: row.model || model,
      jobId: row.id,
      businessId: row.business_id || "",
      placeId: row.place_id || "",
      createdAt: row.created_at || "",
      error: row.error || "",
    },
  });
}

export async function handleAiProviderHealth(deps: AiReadinessDeps, request: Request, db: D1DatabaseLike): Promise<Response> {
  if (request.method !== "GET") return deps.errorJson("Method not allowed", 405);
  const url = new URL(request.url);
  const provider = String(url.searchParams.get("provider") || "").trim();
  const model = String(url.searchParams.get("model") || "").trim();
  if (!provider) return deps.errorJson("provider is required", 400);

  const bindings: unknown[] = [provider];
  let modelSql = "";
  if (model) {
    modelSql = "AND model = ?";
    bindings.push(model);
  }

  const aggregate = await db
    .prepare(
      `SELECT
         COUNT(*) AS total_count,
         SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS success_count,
         SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_count,
         SUM(CASE WHEN metadata_json LIKE '%"preflightBlocked":true%' THEN 1 ELSE 0 END) AS preflight_count,
         SUM(CASE WHEN metadata_json LIKE '%"cooldownBlocked":true%' THEN 1 ELSE 0 END) AS cooldown_count
       FROM generation_jobs
       WHERE provider = ?
         ${modelSql}
         AND datetime(created_at) >= datetime('now', '-24 hours')`,
    )
    .bind(...bindings)
    .first<{ total_count?: number; success_count?: number; failed_count?: number; preflight_count?: number; cooldown_count?: number }>();

  const failureRows = await db
    .prepare(
      `SELECT error, metadata_json, created_at
       FROM generation_jobs
       WHERE status = 'failed'
         AND provider = ?
         ${modelSql}
         AND datetime(created_at) >= datetime('now', '-24 hours')
       ORDER BY datetime(created_at) DESC
       LIMIT 50`,
    )
    .bind(...bindings)
    .all<{ error?: string; metadata_json?: string; created_at?: string }>();

  const failureKinds = new Map<string, number>();
  let slowModeSignalCount = 0;
  let latestFailure: Record<string, unknown> | null = null;
  for (const row of failureRows.results || []) {
    const metadata = deps.parseJsonObject(row.metadata_json);
    const storedFailure = metadata.aiFailure && typeof metadata.aiFailure === "object"
      ? metadata.aiFailure as Record<string, unknown>
      : metadata.providerFailure && typeof metadata.providerFailure === "object"
        ? metadata.providerFailure as Record<string, unknown>
        : null;
    const message = deps.asString(storedFailure?.message, deps.asString(metadata.failureMessage, row.error || ""));
    const httpStatus = Number(storedFailure?.httpStatus || message.match(/HTTP\s+(\d{3})/i)?.[1] || 0) || undefined;
    const fallbackFailure = buildAiFailureDiagnostics({
      provider,
      model,
      endpoint: deps.asString(storedFailure?.endpoint),
      stage: deps.asString(storedFailure?.stage, deps.asString(metadata.failureStage, "site_generate")),
      httpStatus,
      message,
      rawSnippet: deps.asString(storedFailure?.rawSnippet, row.error || ""),
      providerCode: deps.asString(storedFailure?.providerCode),
      providerStatus: deps.asString(storedFailure?.providerStatus),
    });
    const failure = { ...fallbackFailure, ...(storedFailure || {}), createdAt: row.created_at || "", error: row.error || "" };
    const kind = deps.asString(failure.failureKind, "unknown_provider_error");
    const status = Number(failure.httpStatus || 0);
    const stage = deps.asString(failure.stage);
    const textForSignal = `${deps.asString(failure.message)} ${deps.asString(failure.error)} ${deps.asString(failure.rawSnippet)}`;
    failureKinds.set(kind, (failureKinds.get(kind) || 0) + 1);
    if (
      status === 524 ||
      kind === "provider_temporary" ||
      kind === "network_error" ||
      kind === "empty_response" ||
      /Cloudflare\/HTML|Cloudflare timeout|returned HTML|did not return normally|timeout/i.test(textForSignal) ||
      /chunked_offeringCopy|offeringCopy/i.test(stage)
    ) {
      slowModeSignalCount += 1;
    }
    if (!latestFailure) latestFailure = failure;
  }

  const total = Number(aggregate?.total_count || 0);
  const failed = Number(aggregate?.failed_count || 0);
  const failureRate = total > 0 ? failed / total : 0;
  const topFailureKind = [...failureKinds.entries()].sort((a, b) => b[1] - a[1])[0] || null;

  return deps.json({
    provider,
    model,
    windowHours: 24,
    total,
    success: Number(aggregate?.success_count || 0),
    failed,
    preflightBlocked: Number(aggregate?.preflight_count || 0),
    cooldownBlocked: Number(aggregate?.cooldown_count || 0),
    failureRate,
    topFailureKind: topFailureKind ? { kind: topFailureKind[0], count: topFailureKind[1] } : null,
    latestFailure,
    serviceCopyRecommendation: slowModeSignalCount > 0
      ? {
          mode: "slow",
          reason: `${slowModeSignalCount} recent provider/edge failure${slowModeSignalCount === 1 ? "" : "s"} may benefit from smaller service-copy batches.`,
          signalCount: slowModeSignalCount,
        }
      : null,
    checkedAt: new Date().toISOString(),
  });
}

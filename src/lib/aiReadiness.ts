export type AiReadinessResult = {
  ready: boolean;
  requiresAi: boolean;
  provider: string;
  model: string;
  normalizedModel?: string;
  keyPresent?: boolean;
  providerSupported?: boolean;
  modelKnown?: boolean;
  remoteValidation?: {
    requested?: boolean;
    supported?: boolean;
    valid?: boolean | null;
    status?: number;
    matchedModel?: string;
    endpointCount?: number;
    cacheHit?: boolean;
    cacheStoredAt?: string;
    cacheExpiresAt?: string;
    message?: string;
    checkedAt?: string;
  };
  message?: string;
  checkedAt?: string;
};

const readinessCache = new Map<string, { promise: Promise<AiReadinessResult>; expiresAt: number }>();
const readinessCacheTtlMs = 30_000;
let serverRefreshUntil = 0;
export const aiReadinessRefreshEvent = "webview:ai-readiness-refresh";

export function clearAiReadinessCache() {
  readinessCache.clear();
  serverRefreshUntil = Date.now() + 5_000;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(aiReadinessRefreshEvent));
  }
}

export async function logAiReadinessBlockedJob(input: {
  provider: string;
  model: string;
  readiness: AiReadinessResult;
  action: string;
  businessId?: string;
  placeId?: string;
  businessName?: string;
  message?: string;
}) {
  try {
    await fetch("/api/generation-jobs/preflight-failure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    // Logging must not hide the actionable readiness message from the admin.
  }
}

export async function checkAiReadiness(provider: string, model: string, requiresAi = true, remoteValidate = false): Promise<AiReadinessResult> {
  const params = new URLSearchParams({
    provider,
    model,
    requiresAi: requiresAi ? "1" : "0",
    remoteValidate: remoteValidate ? "1" : "0",
  });
  const forceServerRefresh = remoteValidate && serverRefreshUntil > Date.now();
  if (forceServerRefresh) {
    params.set("refresh", "1");
  }
  const cacheKey = params.toString();
  const cached = readinessCache.get(cacheKey);
  if (!cached || cached.expiresAt < Date.now()) {
    readinessCache.set(cacheKey, {
      expiresAt: Date.now() + readinessCacheTtlMs,
      promise: fetch(`/api/ai/readiness?${params.toString()}`)
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          return {
            ready: false,
            requiresAi,
            provider,
            model,
            message: data?.error || `AI readiness check failed with HTTP ${response.status}`,
          } as AiReadinessResult;
        }
        return data as AiReadinessResult;
      })
      .catch((error) => ({
        ready: false,
        requiresAi,
        provider,
        model,
        message: error instanceof Error ? error.message : "AI readiness check failed.",
      })),
    });
  }
  return readinessCache.get(cacheKey)!.promise;
}

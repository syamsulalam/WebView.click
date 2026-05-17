export type AiReadinessResult = {
  ready: boolean;
  requiresAi: boolean;
  provider: string;
  model: string;
  normalizedModel?: string;
  keyPresent?: boolean;
  providerSupported?: boolean;
  modelKnown?: boolean;
  message?: string;
  checkedAt?: string;
};

const readinessCache = new Map<string, { promise: Promise<AiReadinessResult>; expiresAt: number }>();
const readinessCacheTtlMs = 30_000;
export const aiReadinessRefreshEvent = "webview:ai-readiness-refresh";

export function clearAiReadinessCache() {
  readinessCache.clear();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(aiReadinessRefreshEvent));
  }
}

export async function checkAiReadiness(provider: string, model: string, requiresAi = true): Promise<AiReadinessResult> {
  const params = new URLSearchParams({
    provider,
    model,
    requiresAi: requiresAi ? "1" : "0",
  });
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

export type ProviderHealthSummary = {
  provider: string;
  model: string;
  windowHours: number;
  total: number;
  success: number;
  failed: number;
  preflightBlocked: number;
  cooldownBlocked: number;
  failureRate: number;
  topFailureKind?: { kind: string; count: number } | null;
  latestFailure?: {
    failureKind?: string;
    httpStatus?: number;
    message?: string;
    actionHint?: string;
    retryable?: boolean;
    createdAt?: string;
  } | null;
  checkedAt?: string;
};

const providerHealthCache = new Map<string, { promise: Promise<ProviderHealthSummary | null>; expiresAt: number }>();
const providerHealthCacheTtlMs = 30_000;

export function clearProviderHealthCache() {
  providerHealthCache.clear();
}

export async function getProviderHealth(provider: string, model = "") {
  const trimmedProvider = provider.trim();
  if (!trimmedProvider) return null;
  const cacheKey = `${trimmedProvider}::${model.trim()}`;
  const cached = providerHealthCache.get(cacheKey);
  if (!cached || cached.expiresAt < Date.now()) {
    const params = new URLSearchParams({ provider: trimmedProvider });
    if (model.trim()) params.set("model", model.trim());
    providerHealthCache.set(cacheKey, {
      expiresAt: Date.now() + providerHealthCacheTtlMs,
      promise: fetch(`/api/ai/provider-health?${params.toString()}`)
        .then(async (response) => {
          const data = await response.json().catch(() => ({}));
          if (!response.ok) return null;
          return data as ProviderHealthSummary;
        })
        .catch(() => null),
    });
  }
  return providerHealthCache.get(cacheKey)!.promise;
}

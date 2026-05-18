export type ProviderFailureSummary = {
  provider: string;
  model: string;
  jobId?: string;
  businessId?: string;
  placeId?: string;
  createdAt?: string;
  endpoint?: string;
  stage?: string;
  failureKind?: string;
  httpStatus?: number;
  providerCode?: string;
  providerStatus?: string;
  retryable?: boolean;
  message?: string;
  rawSnippet?: string;
  actionHint?: string;
  error?: string;
};

const providerFailureCache = new Map<string, { promise: Promise<ProviderFailureSummary | null>; expiresAt: number }>();
const providerFailureCacheTtlMs = 30_000;

export function clearProviderFailureCache() {
  providerFailureCache.clear();
}

export async function getLastProviderFailure(provider: string, model = "") {
  const trimmedProvider = provider.trim();
  if (!trimmedProvider) return null;
  const cacheKey = `${trimmedProvider}::${model.trim()}`;
  const cached = providerFailureCache.get(cacheKey);
  if (!cached || cached.expiresAt < Date.now()) {
    const params = new URLSearchParams({ provider: trimmedProvider });
    if (model.trim()) params.set("model", model.trim());
    providerFailureCache.set(cacheKey, {
      expiresAt: Date.now() + providerFailureCacheTtlMs,
      promise: fetch(`/api/ai/provider-failure?${params.toString()}`)
        .then(async (response) => {
          const data = await response.json().catch(() => ({}));
          if (!response.ok) return null;
          return (data?.failure || null) as ProviderFailureSummary | null;
        })
        .catch(() => null),
    });
  }
  return providerFailureCache.get(cacheKey)!.promise;
}

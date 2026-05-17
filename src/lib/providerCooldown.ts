export type ProviderCooldown = {
  provider: string;
  until: number;
  reason: string;
  rawMessage?: string;
};

const storagePrefix = "webview.admin.providerCooldown.";
const remoteCache = new Map<string, { cooldown: ProviderCooldown | null; expiresAt: number }>();
const remoteCacheTtlMs = 5_000;
export const providerCooldownEvent = "webview:provider-cooldown";

function normalizeProvider(provider = "") {
  return provider.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") || "api-provider";
}

function writeLocalCooldown(cooldown: ProviderCooldown, dispatch = true) {
  const normalized = normalizeProvider(cooldown.provider);
  window.localStorage.setItem(`${storagePrefix}${normalized}`, JSON.stringify(cooldown));
  remoteCache.set(normalized, { cooldown, expiresAt: Date.now() + remoteCacheTtlMs });
  if (dispatch) window.dispatchEvent(new CustomEvent(providerCooldownEvent, { detail: cooldown }));
}

function clearLocalCooldown(provider: string, cacheNull = false, dispatch = false) {
  const normalized = normalizeProvider(provider);
  window.localStorage.removeItem(`${storagePrefix}${normalized}`);
  if (cacheNull) remoteCache.set(normalized, { cooldown: null, expiresAt: Date.now() + remoteCacheTtlMs });
  if (dispatch) window.dispatchEvent(new CustomEvent(providerCooldownEvent, { detail: { provider, cleared: true } }));
}

function persistProviderCooldown(cooldown: ProviderCooldown) {
  fetch("/api/provider-cooldowns", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cooldown),
  }).catch(() => {
    // Local cooldown still protects this tab if the shared D1 write fails.
  });
}

export function setProviderCooldown(provider: string, cooldownMs: number, reason: string, rawMessage?: string) {
  const normalized = normalizeProvider(provider);
  const until = Date.now() + Math.max(5_000, cooldownMs);
  const cooldown: ProviderCooldown = {
    provider,
    until,
    reason,
    rawMessage,
  };
  writeLocalCooldown(cooldown);
  persistProviderCooldown(cooldown);
  remoteCache.set(normalized, { cooldown, expiresAt: Date.now() + remoteCacheTtlMs });
  return cooldown;
}

export function getProviderCooldown(provider: string): ProviderCooldown | null {
  const normalized = normalizeProvider(provider);
  const raw = window.localStorage.getItem(`${storagePrefix}${normalized}`);
  if (!raw) return null;
  try {
    const cooldown = JSON.parse(raw) as ProviderCooldown;
    if (!cooldown?.until || cooldown.until <= Date.now()) {
      clearLocalCooldown(provider);
      return null;
    }
    return cooldown;
  } catch {
    clearLocalCooldown(provider);
    return null;
  }
}

export async function getSharedProviderCooldown(provider: string, forceRemote = false): Promise<ProviderCooldown | null> {
  const normalized = normalizeProvider(provider);
  const local = getProviderCooldown(provider);
  if (local) return local;

  const cached = remoteCache.get(normalized);
  if (!forceRemote && cached && cached.expiresAt > Date.now()) return cached.cooldown;

  try {
    const response = await fetch(`/api/provider-cooldowns?provider=${encodeURIComponent(provider)}`);
    const data = await response.json().catch(() => ({}));
    const remote = data?.cooldown as ProviderCooldown | null;
    if (response.ok && remote?.until && remote.until > Date.now()) {
      writeLocalCooldown(remote);
      return remote;
    }
    clearLocalCooldown(provider, true);
    return null;
  } catch {
    return local;
  }
}

export async function clearSharedProviderCooldown(provider: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/provider-cooldowns?provider=${encodeURIComponent(provider)}`, { method: "DELETE" });
    clearLocalCooldown(provider, true, true);
    return response.ok;
  } catch {
    clearLocalCooldown(provider, true, true);
    return false;
  }
}

export async function logProviderCooldownBlockedJob(input: {
  provider: string;
  model?: string;
  cooldown: ProviderCooldown;
  action: string;
  businessId?: string;
  placeId?: string;
  businessName?: string;
  message?: string;
}) {
  try {
    await fetch("/api/generation-jobs/cooldown-blocked", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    // Cooldown blocking must still protect the provider if job audit logging fails.
  }
}

export function formatCooldownRemaining(cooldown: ProviderCooldown | null) {
  if (!cooldown) return "";
  const remainingMs = Math.max(0, cooldown.until - Date.now());
  const seconds = Math.ceil(remainingMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.ceil(seconds / 60)}m`;
}

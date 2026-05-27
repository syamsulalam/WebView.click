export type DomainsDeps = {
  json: (data: unknown, status?: number) => Response;
  errorJson: (error: string, status?: number, details?: unknown) => Response;
  readJsonBody: (request: Request) => Promise<Record<string, unknown>>;
  getSetting: (db: D1DatabaseLike, env: unknown, key: string) => Promise<string | undefined>;
};

type D1DatabaseLike = {
  prepare: (query: string) => unknown;
};

type DomainProvider = "cloudflare_registrar" | "name_com" | "dynadot" | "spaceship";

type DomainQuote = {
  provider: DomainProvider;
  domain: string;
  registrable: boolean;
  currency: string;
  registrationUsd?: number;
  renewalUsd?: number;
  premium?: boolean;
  reason?: string;
  checkedAt: string;
  expiresAt: string;
  withinMaxPrice: boolean;
  raw?: unknown;
};

type ProviderConfig = {
  provider: DomainProvider;
  requiredKeys: string[];
  values: Record<string, string>;
};

const domainProviders: Array<{ provider: DomainProvider; label: string; requiredKeys: string[] }> = [
  { provider: "cloudflare_registrar", label: "Cloudflare Registrar", requiredKeys: ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"] },
  { provider: "name_com", label: "Name.com", requiredKeys: ["NAME_COM_USERNAME", "NAME_COM_API_TOKEN"] },
  { provider: "dynadot", label: "Dynadot", requiredKeys: ["DYNADOT_API_KEY"] },
  { provider: "spaceship", label: "Spaceship", requiredKeys: ["SPACESHIP_API_KEY", "SPACESHIP_API_SECRET"] },
];

const providerOptionalKeys: Record<DomainProvider, string[]> = {
  cloudflare_registrar: [],
  name_com: ["NAME_COM_ENV"],
  dynadot: ["DYNADOT_ENV"],
  spaceship: [],
};

function normalizeDomainInput(value: string) {
  return value
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .replace(/[^a-z0-9.-]+/g, "")
    .replace(/^\.+|\.+$/g, "");
}

function objectValue(value: unknown) {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value.replace(/[^0-9.]+/g, ""));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function domainTld(domain: string) {
  return domain.split(".").pop() || "";
}

function quoteExpiry(now = new Date()) {
  return new Date(now.getTime() + 15 * 60 * 1000).toISOString();
}

function normalizeProvider(value: string): DomainProvider | undefined {
  const normalized = value.trim().toLowerCase().replace(/[-\s]+/g, "_");
  if (normalized === "cloudflare" || normalized === "cloudflare_registrar") return "cloudflare_registrar";
  if (normalized === "name" || normalized === "name_com" || normalized === "name.com") return "name_com";
  if (normalized === "dynadot") return "dynadot";
  if (normalized === "spaceship") return "spaceship";
  return undefined;
}

function envString(env: unknown, key: string) {
  const value = objectValue(env)[key];
  return typeof value === "string" ? value.trim() : "";
}

async function configValue(deps: DomainsDeps, db: D1DatabaseLike, env: unknown, key: string) {
  return envString(env, key) || (await deps.getSetting(db, env, key))?.trim() || "";
}

async function providerConfig(deps: DomainsDeps, db: D1DatabaseLike, env: unknown, provider: DomainProvider): Promise<ProviderConfig> {
  const info = domainProviders.find((item) => item.provider === provider);
  if (!info) throw new Error(`Unsupported registrar provider: ${provider}`);
  const keys = [...info.requiredKeys, ...providerOptionalKeys[provider]];
  const entries = await Promise.all(keys.map(async (key) => [key, await configValue(deps, db, env, key)] as const));
  const values = Object.fromEntries(entries);
  return { provider, requiredKeys: info.requiredKeys, values };
}

function missingConfig(config: ProviderConfig) {
  return config.requiredKeys.filter((key) => !config.values[key]);
}

function makeQuote(
  provider: DomainProvider,
  domain: string,
  values: Partial<DomainQuote>,
  maxUsd: number,
  raw?: unknown,
): DomainQuote {
  const checkedAt = new Date().toISOString();
  const registrationUsd = values.registrationUsd;
  return {
    provider,
    domain,
    registrable: Boolean(values.registrable),
    currency: values.currency || "USD",
    registrationUsd,
    renewalUsd: values.renewalUsd,
    premium: values.premium,
    reason: values.reason,
    checkedAt,
    expiresAt: quoteExpiry(new Date(checkedAt)),
    withinMaxPrice: !registrationUsd || registrationUsd <= maxUsd,
    raw,
  };
}

async function fetchJson(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorData = objectValue(data);
    const errors = Array.isArray(errorData.errors) ? errorData.errors : [];
    const message = firstString(objectValue(errors[0]).message, errorData.message, `Provider request failed with HTTP ${response.status}`);
    throw new Error(message);
  }
  return data;
}

async function quoteCloudflare(config: ProviderConfig, domain: string, maxUsd: number) {
  const accountId = config.values.CLOUDFLARE_ACCOUNT_ID;
  const token = config.values.CLOUDFLARE_API_TOKEN;
  const data = await fetchJson(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/registrar/domain-check`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({ domains: [domain] }),
  });
  const result = objectValue(objectValue(data).result);
  const cloudflareDomains = result.domains;
  const domainResult = objectValue(Array.isArray(cloudflareDomains) ? cloudflareDomains[0] : undefined);
  const pricing = objectValue(domainResult.pricing);
  return makeQuote("cloudflare_registrar", domain, {
    registrable: domainResult.registrable === true,
    currency: firstString(pricing.currency, "USD"),
    registrationUsd: firstNumber(pricing.registration_cost),
    renewalUsd: firstNumber(pricing.renewal_cost),
    premium: firstString(domainResult.tier) === "premium" || firstString(domainResult.reason) === "domain_premium",
    reason: firstString(domainResult.reason),
  }, maxUsd, data);
}

async function quoteNameCom(config: ProviderConfig, domain: string, maxUsd: number) {
  const username = config.values.NAME_COM_USERNAME;
  const token = config.values.NAME_COM_API_TOKEN;
  const env = firstString(config.values.NAME_COM_ENV).toLowerCase();
  const baseUrl = env === "sandbox" || env === "dev" || env === "test" ? "https://api.dev.name.com" : "https://api.name.com";
  const data = await fetchJson(`${baseUrl}/core/v1/domains:checkAvailability`, {
    method: "POST",
    headers: {
      authorization: `Basic ${btoa(`${username}:${token}`)}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({ domainNames: [domain], purchaseType: "registration" }),
  });
  const nameComResults = objectValue(data).results;
  const result = objectValue(Array.isArray(nameComResults) ? nameComResults[0] : undefined);
  return makeQuote("name_com", domain, {
    registrable: result.purchasable === true,
    currency: "USD",
    registrationUsd: firstNumber(result.purchasePrice),
    renewalUsd: firstNumber(result.renewalPrice),
    premium: result.premium === true,
    reason: firstString(result.reason),
  }, maxUsd, data);
}

async function quoteDynadot(config: ProviderConfig, domain: string, maxUsd: number) {
  const apiKey = config.values.DYNADOT_API_KEY;
  const env = firstString(config.values.DYNADOT_ENV).toLowerCase();
  const baseUrl = env === "sandbox" || env === "dev" || env === "test" ? "https://api-sandbox.dynadot.com/api3.json" : "https://api.dynadot.com/api3.json";
  const url = new URL(baseUrl);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("command", "search");
  url.searchParams.set("domain0", domain);
  url.searchParams.set("show_price", "1");
  url.searchParams.set("currency", "USD");
  const data = await fetchJson(url.toString(), { headers: { accept: "application/json" } });
  const response = objectValue(objectValue(data).SearchResponse);
  const results = response.SearchResults;
  const result = objectValue(Array.isArray(results) ? results[0] : results);
  const priceText = firstString(result.Price);
  const premium = /premium/i.test(priceText) && !/not premium/i.test(priceText);
  return makeQuote("dynadot", domain, {
    registrable: firstString(result.Available).toLowerCase() === "yes",
    currency: "USD",
    registrationUsd: firstNumber(priceText),
    premium,
    reason: firstString(response.Status, response.Error),
  }, maxUsd, data);
}

async function quoteSpaceship(config: ProviderConfig, domain: string, maxUsd: number) {
  const data = await fetchJson(`https://spaceship.dev/api/v1/domains/${encodeURIComponent(domain)}/available`, {
    headers: {
      "X-API-Key": config.values.SPACESHIP_API_KEY,
      "X-API-Secret": config.values.SPACESHIP_API_SECRET,
      accept: "application/json",
    },
  });
  const body = objectValue(data);
  const prices = Array.isArray(body.premiumPricing) ? body.premiumPricing : [];
  const registerPrice = objectValue(prices.find((item) => firstString(objectValue(item).operation).toLowerCase() === "register"));
  return makeQuote("spaceship", domain, {
    registrable: firstString(body.result).toLowerCase() === "available",
    currency: firstString(registerPrice.currency, "USD"),
    registrationUsd: firstNumber(registerPrice.price),
    premium: firstString(body.result).toLowerCase() === "premium",
    reason: firstString(body.result),
  }, maxUsd, data);
}

async function quoteWithProvider(deps: DomainsDeps, db: D1DatabaseLike, env: unknown, provider: DomainProvider, domain: string, maxUsd: number) {
  const config = await providerConfig(deps, db, env, provider);
  const missing = missingConfig(config);
  if (missing.length) {
    throw new Error(`Missing ${provider} configuration: ${missing.join(", ")}`);
  }

  if (provider === "cloudflare_registrar") return quoteCloudflare(config, domain, maxUsd);
  if (provider === "name_com") return quoteNameCom(config, domain, maxUsd);
  if (provider === "dynadot") return quoteDynadot(config, domain, maxUsd);
  return quoteSpaceship(config, domain, maxUsd);
}

async function handleProviderStatus(deps: DomainsDeps, db: D1DatabaseLike, env: unknown) {
  const configuredDefault = normalizeProvider(await configValue(deps, db, env, "DOMAIN_REGISTRAR_PROVIDER")) || "cloudflare_registrar";
  const maxRegistrationUsd = firstNumber(await configValue(deps, db, env, "DOMAIN_REGISTRATION_MAX_USD")) || 17;
  const providers = await Promise.all(domainProviders.map(async (info) => {
    const config = await providerConfig(deps, db, env, info.provider);
    const missing = missingConfig(config);
    return {
      provider: info.provider,
      label: info.label,
      configured: missing.length === 0,
      missingKeys: missing,
      active: info.provider === configuredDefault,
    };
  }));
  return deps.json({ defaultProvider: configuredDefault, maxRegistrationUsd, providers });
}

async function handleRegistrarQuote(deps: DomainsDeps, request: Request, db: D1DatabaseLike, env: unknown) {
  const body = await deps.readJsonBody(request);
  const domain = normalizeDomainInput(firstString(body.domain));
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.[a-z0-9.-]{2,}$/.test(domain)) {
    return deps.errorJson("Invalid domain format", 400);
  }

  const provider = normalizeProvider(firstString(body.provider) || await configValue(deps, db, env, "DOMAIN_REGISTRAR_PROVIDER")) || "cloudflare_registrar";
  const maxRegistrationUsd = firstNumber(body.maxRegistrationUsd, await configValue(deps, db, env, "DOMAIN_REGISTRATION_MAX_USD")) || 17;
  try {
    const quote = await quoteWithProvider(deps, db, env, provider, domain, maxRegistrationUsd);
    const unsupported = quote.premium || !quote.withinMaxPrice || !quote.registrable;
    return deps.json({
      ...quote,
      tld: domainTld(domain),
      maxRegistrationUsd,
      supportedForMvp: !unsupported,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.startsWith("Missing ") ? 409 : 502;
    return deps.errorJson(message, status, { provider, domain });
  }
}

async function checkDomainViaRdapNet(domain: string) {
  const response = await fetch(`https://rdap.net/domain/${encodeURIComponent(domain)}`, {
    headers: { accept: "application/rdap+json, application/json" },
  });

  if (response.status === 404) {
    return {
      provider: "rdap.net",
      status: "candidate_available",
      available: true,
      message: `${domain} looks available from RDAP. Final availability is confirmed during registrar purchase.`,
    };
  }

  if (response.status === 200) {
    const data = await response.json() as {
      entities?: Array<{ roles?: string[]; vcardArray?: [string, unknown[]] }>;
      nameservers?: Array<{ ldhName?: string; unicodeName?: string }>;
      links?: Array<{ rel?: string; href?: string }>;
    };
    const registrarEntity = Array.isArray(data.entities)
      ? data.entities.find((entity) => Array.isArray(entity.roles) && entity.roles.includes("registrar"))
      : undefined;
    const registrarVcardEntry = Array.isArray(registrarEntity?.vcardArray?.[1])
      ? (registrarEntity.vcardArray[1] as unknown[]).find((entry) => Array.isArray(entry) && entry[0] === "fn")
      : undefined;
    const registrar = Array.isArray(registrarVcardEntry) && typeof registrarVcardEntry[3] === "string"
      ? registrarVcardEntry[3]
      : undefined;
    const nameservers = Array.isArray(data.nameservers)
      ? data.nameservers.map((nameserver) => nameserver.ldhName || nameserver.unicodeName).filter((nameserver): nameserver is string => Boolean(nameserver))
      : [];
    const rdapUrl = Array.isArray(data.links) ? data.links.find((link) => link.rel === "self")?.href : undefined;

    return {
      provider: "rdap.net",
      status: "registered",
      available: false,
      message: `${domain} appears to be registered.`,
      registrar: typeof registrar === "string" ? registrar : undefined,
      nameservers,
      rdapUrl,
    };
  }

  return {
    provider: "rdap.net",
    status: "inconclusive",
    available: null,
    message: `RDAP returned HTTP ${response.status}. Try another extension or check again later.`,
  };
}

async function checkDomainViaGoogleDns(domain: string) {
  const response = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=SOA`, {
    headers: { accept: "application/json" },
  });
  const data = await response.json() as { Status?: number; Answer?: unknown[] };

  if (data.Status === 0 && Array.isArray(data.Answer) && data.Answer.length > 0) {
    return {
      provider: "Google Public DNS",
      status: "dns_exists",
      available: false,
      message: `${domain} has DNS records and is likely already in use.`,
    };
  }

  return {
    provider: "Google Public DNS",
    status: "dns_no_soa",
    available: null,
    message: `${domain} has no SOA answer. This is not enough to confirm availability, but it is a useful fallback signal.`,
  };
}

export async function handleDomains(deps: DomainsDeps, request: Request, db: D1DatabaseLike, env: unknown, url: URL, segments: string[]): Promise<Response> {
  if (request.method === "GET" && segments[1] === "providers") {
    return handleProviderStatus(deps, db, env);
  }

  if (request.method === "POST" && segments[1] === "quote") {
    return handleRegistrarQuote(deps, request, db, env);
  }

  if (request.method !== "GET" || segments[1] !== "check") {
    return deps.errorJson("Not Found", 404);
  }

  const domain = normalizeDomainInput(url.searchParams.get("domain") || "");
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.[a-z0-9.-]{2,}$/.test(domain)) {
    return deps.errorJson("Invalid domain format", 400);
  }

  try {
    const rdap = await checkDomainViaRdapNet(domain);
    if (rdap.available !== null) return deps.json(rdap);
    const dns = await checkDomainViaGoogleDns(domain);
    return deps.json({
      ...rdap,
      fallback: dns,
      message: `${rdap.message} Fallback DNS signal: ${dns.message}`,
    });
  } catch (error) {
    console.error("Domain check failed:", error);
    try {
      return deps.json(await checkDomainViaGoogleDns(domain));
    } catch (fallbackError) {
      console.error("Domain fallback check failed:", fallbackError);
      return deps.json({
        provider: "domain-check-fallback",
        status: "inconclusive",
        available: null,
        message: "Domain availability check is temporarily unavailable. We can still confirm it during setup.",
      });
    }
  }
}

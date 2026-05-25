export type DomainsDeps = {
  json: (data: unknown, status?: number) => Response;
  errorJson: (error: string, status?: number, details?: unknown) => Response;
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

export async function handleDomains(deps: DomainsDeps, url: URL, segments: string[]): Promise<Response> {
  if (segments[1] !== "check") {
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

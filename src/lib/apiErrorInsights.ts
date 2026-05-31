export type ApiErrorInsight = {
  title: string;
  meaning: string;
  actions: string[];
  severity: "error" | "warning" | "info";
  rawMessage: string;
  cooldownMs?: number;
  cooldownProvider?: string;
};

type ApiErrorInput = {
  message?: string;
  status?: number;
  provider?: string;
  model?: string;
  source?: string;
};

function textFromError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message || "");
  }
  return String(error || "Unknown API error.");
}

function providerLabel(provider = "", message = "") {
  if (provider === "KIE") return "KIE.ai";
  if (provider) return provider;
  if (/gemini|generativelanguage/i.test(message)) return "Gemini";
  if (/openrouter/i.test(message)) return "OpenRouter";
  if (/openai/i.test(message)) return "OpenAI";
  if (/kie\.?ai|api\.kie/i.test(message)) return "KIE.ai";
  if (/google places|places api/i.test(message)) return "Google Places";
  return "API provider";
}

function retryDelay(message: string) {
  const match = message.match(/retry(?:\s|_)?(?:delay|in)?[^\d]*(\d+(?:\.\d+)?)\s*(s|sec|seconds|m|minute|minutes)?/i);
  if (!match) return "";
  const unit = (match[2] || "seconds").toLowerCase();
  return `${Math.ceil(Number(match[1]))} ${unit.startsWith("m") ? "minutes" : "seconds"}`;
}

function retryDelayMs(message: string) {
  const match = message.match(/retry(?:\s|_)?(?:delay|in)?[^\d]*(\d+(?:\.\d+)?)\s*(s|sec|seconds|m|minute|minutes)?/i);
  if (!match) return 0;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return 0;
  const unit = (match[2] || "seconds").toLowerCase();
  return Math.max(1_000, value * (unit.startsWith("m") ? 60_000 : 1_000));
}

function cooldownFor429(provider: string, message: string) {
  const retryMs = retryDelayMs(message);
  if (retryMs) return retryMs;
  const lower = message.toLowerCase();
  if (provider === "KIE.ai") return 30_000;
  if (provider === "OpenRouter") return 75_000;
  if (provider === "OpenAI" && /insufficient_quota|quota.*exceeded|billing/i.test(lower)) return 15 * 60_000;
  if (/requests per day|daily|per day|rpd/i.test(message)) return 30 * 60_000;
  return 90_000;
}

export function interpretApiError(error: unknown, input: ApiErrorInput = {}): ApiErrorInsight {
  const rawMessage = input.message || textFromError(error);
  const status = input.status || Number(rawMessage.match(/HTTP\s+(\d{3})/i)?.[1] || 0);
  const provider = providerLabel(input.provider, rawMessage);
  const modelSuffix = input.model ? ` (${input.model})` : "";
  const sourcePrefix = input.source ? `${input.source}: ` : "";
  const delay = retryDelay(rawMessage);

  if (status === 429 || /quota exceeded|resource_exhausted|rate limit|too many requests/i.test(rawMessage)) {
    const isGemini = /gemini|generativelanguage|resource_exhausted/i.test(rawMessage) || provider === "Gemini";
    const rpm = /requests per minute|request limit per minute|rpm/i.test(rawMessage);
    const tpm = /tokens per minute|input token|output token|tpm/i.test(rawMessage);
    const rpd = /requests per day|daily|per day|rpd/i.test(rawMessage);
    const dimension = rpm ? "request-per-minute" : tpm ? "token-per-minute" : rpd ? "daily request" : "rate or quota";
    return {
      title: `${sourcePrefix}${provider} quota/rate limit hit`,
      meaning: isGemini
        ? `Gemini refused this request because the project exceeded a ${dimension} limit${modelSuffix}. Gemini limits are evaluated per project, so retrying immediately with the same project/key can keep failing.`
        : `${provider} refused this request because the account/key exceeded a ${dimension} limit${modelSuffix}.`,
      actions: [
        delay ? `Wait at least ${delay}, then retry once.` : "Wait 60-90 seconds, then retry once.",
        "Avoid batch retrying the same failed job until the daily usage guardrail drops back to OK.",
        isGemini ? "Switch to a lower-volume Gemini model, use a different provider, or raise/upgrade the Gemini quota in Google AI Studio." : "Check provider billing, credits, and rate limits before retrying.",
        "Open /admin/jobs and filter Preflight blocked or Failed to confirm whether this was a settings issue or a provider quota issue.",
      ],
      severity: "warning",
      rawMessage,
      cooldownMs: cooldownFor429(provider, rawMessage),
      cooldownProvider: input.provider || provider,
    };
  }

  if (/ip whitelist|ip allowlist|allowlist|server ip/i.test(rawMessage)) {
    return {
      title: `${sourcePrefix}${provider} IP whitelist rejected the request`,
      meaning: `${provider} rejected the configured key because the Cloudflare Pages Function outbound IP is not allowed${modelSuffix}. This is a provider key restriction, not a copy-generation prompt problem.`,
      actions: [
        "Open the provider dashboard and remove the IP whitelist for this API key, or add the actual server egress IP if the provider supports a stable one.",
        "For Cloudflare Pages Functions, avoid single-IP allowlists unless you have a stable egress/proxy strategy.",
        "After changing the provider setting, click Refresh AI readiness and retry once.",
      ],
      severity: "error",
      rawMessage,
    };
  }

  if (status === 401 || status === 402 || status === 403 || /api key|permission_denied|unauthorized|forbidden|invalid key|billing|insufficient credits/i.test(rawMessage)) {
    return {
      title: `${sourcePrefix}${provider} key or permission problem`,
      meaning: `${provider} did not accept the configured key, project permission, billing/credit state, or model access${modelSuffix}.`,
      actions: [
        "Open /admin/settings and verify the provider key is saved in the correct field.",
        "Check provider billing/project access and whether this model is available for that key.",
        "Click Refresh AI readiness after saving the key, then retry generation once.",
      ],
      severity: "error",
      rawMessage,
    };
  }

  if (status === 400 || /invalid_argument|malformed|bad request|model .*not|not found|unsupported/i.test(rawMessage)) {
    return {
      title: `${sourcePrefix}${provider} rejected the request`,
      meaning: `The provider rejected the request format, model name, or a required field${modelSuffix}. This is usually configuration or payload shape, not a temporary outage.`,
      actions: [
        "Verify the selected provider/model in /admin/settings or the page selector.",
        "Use Refresh AI readiness to catch bad model routing before generating.",
        "Check the failed job detail drawer for the raw provider message.",
      ],
      severity: "error",
      rawMessage,
    };
  }

  if (/Cloudflare\/HTML|returned Cloudflare|Pages Function|deployment is failing at the edge|instead of JSON|non-JSON response|Response bukan JSON/i.test(rawMessage)) {
    return {
      title: `${sourcePrefix}Cloudflare Pages Function returned HTML`,
      meaning: `WebView.click expected JSON from its own API, but Cloudflare returned an HTML error page. This usually means the Pages Function crashed, the deployment is unhealthy, or Cloudflare temporarily failed before the provider response could be returned.`,
      actions: [
        "Check the raw error for the API label that failed, such as Load parent chunked generation job or Finalize.",
        "Check Cloudflare Pages Functions logs for the matching timestamp and fix any runtime exception shown there.",
        "After deploying the fix or confirming Cloudflare recovered, refresh /admin/jobs and retry once.",
      ],
      severity: "error",
      rawMessage,
    };
  }

  if (status === 455 || status === 500 || status === 502 || status === 503 || /unavailable|overloaded|timeout|timed out|fetch failed/i.test(rawMessage)) {
    return {
      title: `${sourcePrefix}${provider} temporary service failure`,
      meaning: `${provider} or an upstream network call failed temporarily${modelSuffix}. The request may work after capacity recovers.`,
      actions: [
        "Wait a minute, then retry once.",
        "If it repeats, switch provider/model for this generation.",
        "Check /admin/jobs for repeated failures before batch generating more prospects.",
      ],
      severity: "warning",
      rawMessage,
    };
  }

  return {
    title: `${sourcePrefix}API request failed`,
    meaning: `The API returned an error that WebView.click could not classify yet${modelSuffix}.`,
    actions: [
      "Read the raw message below and check the matching provider/settings page.",
      "Open /admin/jobs for the failed generation row and raw metadata.",
      "Retry only after changing the input, provider, model, or quota state.",
    ],
    severity: "error",
    rawMessage,
  };
}

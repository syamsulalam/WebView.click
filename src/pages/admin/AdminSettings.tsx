import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, Copy, Loader2, RefreshCw, RotateCcw, Save, ShieldAlert, SlidersHorizontal } from "lucide-react";
import { aiModelPrices, defaultInputTokens, defaultOutputTokens, estimateCostUsd, formatUsd } from "../../lib/aiPricing";
import { useLocalStorageState } from "../../lib/localStorageState";
import { clearAiReadinessCache } from "../../lib/aiReadiness";
import {
  AI_SERVICE_COPY_PROVIDER_MODES_KEY,
  aiServiceCopyModeKey,
  parseAiServiceCopyProviderModes,
  resolveAiServiceCopyProviderMode,
} from "../../lib/aiSlowProviderMode";
import HelpTooltip from "../../components/HelpTooltip";
import HoverTooltip from "../../components/HoverTooltip";
import AdminDocsReader from "../../components/AdminDocsReader";
import AdminAiReadinessBadge from "../../components/AdminAiReadinessBadge";
import AdminAiReadinessRefreshButton from "../../components/AdminAiReadinessRefreshButton";
import AdminProviderCooldownBadge from "../../components/AdminProviderCooldownBadge";
import AdminProviderHealthBadge from "../../components/AdminProviderHealthBadge";
import { providerCooldownEvent } from "../../lib/providerCooldown";
import {
  defaultProspectScoreWeights,
  parseProspectScoreWeights,
  prospectScoringPresets,
  prospectScoreWeightFields,
  scoreThresholdOptions,
  serializeProspectScoreWeights,
  type ProspectScoreWeightKey,
} from "../../lib/prospectScoring";

type ProviderKey = "OPENROUTER" | "OPENAI" | "GEMINI" | "KIE" | "OPENCODE";
type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";
type ProviderCooldownEvent = {
  id: string;
  provider: string;
  eventType: "set" | "clear" | "blocked" | string;
  cooldownUntil?: number | null;
  reason?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
};

const initialSettings: Record<string, string> = {
  OPENROUTER_API_KEY: "",
  OPENAI_API_KEY: "",
  GEMINI_API_KEY: "",
  KIE_API_KEY: "",
  OPENCODE_API_KEY: "",
  OPENCODE_BASE_URL: "",
  GOOGLE_PLACES_API_KEY: "",
  PAYMENT_PROCESSOR: "mock",
  PAYMENT_USD_AMOUNT: "197",
  PAYMENT_DOMAIN_FEE_USD: "17",
  PAYMENT_ADDON_PAGE_USD: "10",
  PAYMENT_USD_TO_IDR_RATE: "16000",
  PAYMENT_PACKAGE_NAME: "WebView.click Done-for-you Website Setup",
  PAYMENT_PACKAGE_DESCRIPTION: "$180/year managed hosting, plus $17/year domain fee only when WebView.click registers the domain; SSL, DNS/upload, generated site launch, and free setup included.",
  XENDIT_SECRET_KEY: "",
  MIDTRANS_SERVER_KEY: "",
  MIDTRANS_CLIENT_KEY: "",
  MIDTRANS_IS_PRODUCTION: "false",
  DOKU_CLIENT_ID: "",
  DOKU_SECRET_KEY: "",
  DOKU_IS_PRODUCTION: "false",
  PAYPAL_BUSINESS_URL: "",
  PAYPAL_ACCOUNT_MODE: "business",
  PAYPAL_RISK_ACKNOWLEDGED: "false",
  PAYPAL_PAYMENT_NOTE: "Please pay as goods/services or invoice payment, not Friends and Family. Include the business name, requested domain, and WebView.click payment reference in the payment note.",
  PAYPAL_CLIENT_ID: "",
  PAYPAL_CLIENT_SECRET: "",
  PAYPAL_SANDBOX_CLIENT_ID: "",
  PAYPAL_SANDBOX_CLIENT_SECRET: "",
  PAYPAL_SANDBOX_WEBHOOK_ID: "",
  PAYPAL_LIVE_CLIENT_ID: "",
  PAYPAL_LIVE_CLIENT_SECRET: "",
  PAYPAL_LIVE_WEBHOOK_ID: "",
  PAYPAL_WEBHOOK_ID: "",
  PAYPAL_CONTROLLED_LIVE_TEST_REFERENCE: "",
  PAYPAL_IS_PRODUCTION: "false",
  WISE_PAYMENT_URL: "",
  PAYONEER_PAYMENT_URL: "",
  PAYMENT_LINK_BASIC: "",
  PAYMENT_LINK_PREMIUM: "",
  LEMON_SQUEEZY_API_KEY: "",
  LEMON_SQUEEZY_STORE_ID: "",
  LEMON_SQUEEZY_VARIANT_ID: "",
  ADMIN_WHATSAPP_NUMBER: "081233838173",
  SCORING_PRESET: "balanced",
  SCORING_MIN_SCORE_DEFAULT: "0",
  SCORING_WEIGHTS_JSON: serializeProspectScoreWeights(defaultProspectScoreWeights),
  AI_SERVICE_COPY_PROVIDER_MODES_JSON: "",
  DOMAIN_REGISTRAR_PROVIDER: "cloudflare_registrar",
  DOMAIN_REGISTRATION_MAX_USD: "17",
  CLOUDFLARE_ACCOUNT_ID: "",
  CLOUDFLARE_API_TOKEN: "",
  NAME_COM_USERNAME: "",
  NAME_COM_API_TOKEN: "",
  NAME_COM_ENV: "production",
  DYNADOT_API_KEY: "",
  DYNADOT_ENV: "production",
  SPACESHIP_API_KEY: "",
  SPACESHIP_API_SECRET: "",
};

const providerOptions: Array<{
  key: ProviderKey;
  label: string;
  description: string;
  fields: Array<{ key: string; label: string; type: "password" | "text"; placeholder: string; helper?: string }>;
}> = [
  {
    key: "KIE",
    label: "KIE.ai",
    description: "Aggregator API yang mengklaim harga biasanya 30-50% lebih murah dari API official, dan beberapa model sampai 80%.",
    fields: [
      { key: "KIE_API_KEY", label: "KIE.ai API Key", type: "password", placeholder: "Bearer token dari kie.ai/api-key" },
    ],
  },
  {
    key: "OPENROUTER",
    label: "OpenRouter",
    description: "Router multi-model untuk Claude, OpenAI, Gemini, Qwen, dan model gratis/berbayar lain.",
    fields: [
      { key: "OPENROUTER_API_KEY", label: "OpenRouter API Key", type: "password", placeholder: "sk-or-v1-..." },
    ],
  },
  {
    key: "OPENAI",
    label: "OpenAI",
    description: "Provider langsung untuk GPT-5.5, GPT-5.4, dan model OpenAI lain.",
    fields: [
      { key: "OPENAI_API_KEY", label: "OpenAI API Key", type: "password", placeholder: "sk-proj-..." },
    ],
  },
  {
    key: "GEMINI",
    label: "Gemini",
    description: "Provider langsung Google Gemini API untuk Gemini 3.1 Pro, Flash, dan Flash-Lite.",
    fields: [
      { key: "GEMINI_API_KEY", label: "Gemini API Key", type: "password", placeholder: "AIzaSy..." },
    ],
  },
  {
    key: "OPENCODE",
    label: "Opencode",
    description: "Endpoint custom OpenAI-compatible. Isi base URL sesuai gateway yang dipakai.",
    fields: [
      { key: "OPENCODE_API_KEY", label: "Opencode API Key", type: "password", placeholder: "sk-opencode-..." },
      {
        key: "OPENCODE_BASE_URL",
        label: "Opencode Base URL",
        type: "text",
        placeholder: "https://api.example.com/v1/chat/completions",
        helper: "Harus endpoint chat completions yang kompatibel dengan format OpenAI.",
      },
    ],
  },
];

const pricingProviderApiKeyMap: Record<string, string> = {
  OpenRouter: "OPENROUTER_API_KEY",
  OpenAI: "OPENAI_API_KEY",
  Gemini: "GEMINI_API_KEY",
  KIE: "KIE_API_KEY",
  Opencode: "OPENCODE_API_KEY",
};

const paymentProcessorOptions = [
  { value: "mock", label: "Mock / manual follow-up", helper: "No external payment call. Saves checkout_pending and shows admin follow-up." },
  { value: "xendit", label: "Xendit hosted invoice", helper: "Recommended first live option for an Indonesia merchant accepting cards and local methods." },
  { value: "midtrans", label: "Midtrans Snap", helper: "Indonesia-local gateway with broad local methods and card checkout." },
  { value: "doku", label: "DOKU Checkout", helper: "Indonesia-local hosted checkout with Client ID + Secret Key HMAC signing." },
  { value: "paypal", label: "PayPal Business Checkout", helper: "Inline PayPal one-time checkout and yearly subscriptions when active API keys are filled; fallback link remains available." },
  { value: "wise", label: "Wise payment/request link", helper: "Manual invoice/bank-transfer style fallback for larger B2B clients." },
  { value: "payoneer", label: "Payoneer payment request", helper: "Manual payment request fallback for clients who prefer Payoneer." },
  { value: "lemon_squeezy_legacy", label: "Lemon Squeezy legacy", helper: "Legacy only. Lemon Squeezy prohibits web development/services for this offer." },
];

const offerConversionGroup = {
  title: "Offer and conversion",
  description: "Shown as USD to US clients, then converted to IDR for Indonesia-local gateways.",
  fields: [
    { key: "PAYMENT_USD_AMOUNT", label: "New-domain annual total USD", type: "number", placeholder: "197", tooltip: "Customer-facing yearly total when WebView.click registers the domain. The domain fee is separated below so owned-domain buyers pay hosting only." },
    { key: "PAYMENT_DOMAIN_FEE_USD", label: "Domain fee USD", type: "number", placeholder: "17", tooltip: "Yearly domain fee charged only when WebView.click registers the domain. Term discounts apply to hosting only, never this domain fee." },
    { key: "PAYMENT_ADDON_PAGE_USD", label: "Page/edit add-on USD", type: "number", placeholder: "10", tooltip: "Flat fee per additional generated page or edit action before bulk discount. Current checkout applies 10% off for 5-9 actions and 20% off for 10+ actions." },
    { key: "PAYMENT_USD_TO_IDR_RATE", label: "USD to IDR rate", type: "number", placeholder: "16000", tooltip: "Manual conversion rate used before sending IDR amount to Xendit, Midtrans, or DOKU. Update this if exchange rates move." },
    { key: "PAYMENT_PACKAGE_NAME", label: "Package name", placeholder: "WebView.click Done-for-you Website Setup", tooltip: "Name sent to hosted checkout/invoice providers." },
    { key: "PAYMENT_PACKAGE_DESCRIPTION", label: "Package description", placeholder: "$197 total...", tooltip: "Description sent to checkout providers and useful for payment dispute clarity." },
  ],
} satisfies {
  title: string;
  description: string;
  fields: Array<{ key: string; label: string; type?: "text" | "password" | "number" | "select"; placeholder?: string; tooltip: string }>;
};

const paymentFieldGroups: Array<{
  title: string;
  description: string;
  processors?: string[];
  fields: Array<{ key: string; label: string; type?: "text" | "password" | "number" | "select"; placeholder?: string; tooltip: string; options?: Array<{ value: string; label: string }> }>;
}> = [
  {
    title: "Xendit",
    description: "Use hosted invoice creation. Keep the key secret; it is only used server-side.",
    processors: ["xendit"],
    fields: [
      { key: "XENDIT_SECRET_KEY", label: "Secret API key", type: "password", placeholder: "xnd_development_... / xnd_production_...", tooltip: "Xendit secret key for creating hosted invoices from /api/payments/checkout." },
    ],
  },
  {
    title: "Midtrans",
    description: "Use Snap Redirect. Sandbox and production keys are different.",
    processors: ["midtrans"],
    fields: [
      { key: "MIDTRANS_SERVER_KEY", label: "Server key", type: "password", placeholder: "SB-Mid-server-... / Mid-server-...", tooltip: "Server-side key used to create Midtrans Snap transactions. Do not expose it in public pages." },
      { key: "MIDTRANS_CLIENT_KEY", label: "Client key", placeholder: "SB-Mid-client-... / Mid-client-...", tooltip: "Client key for reference/readiness. Current flow uses hosted Snap redirect from the server response." },
      { key: "MIDTRANS_IS_PRODUCTION", label: "Mode", type: "select", tooltip: "Use sandbox while testing. Switch to production only after Midtrans account approval and test checkout.", options: [{ value: "false", label: "Sandbox" }, { value: "true", label: "Production" }] },
    ],
  },
  {
    title: "DOKU",
    description: "Use DOKU Checkout with signed backend requests.",
    processors: ["doku"],
    fields: [
      { key: "DOKU_CLIENT_ID", label: "Client ID", placeholder: "BRN-... / MCH-...", tooltip: "DOKU Client ID from Back Office > API Keys / Service." },
      { key: "DOKU_SECRET_KEY", label: "Secret Key", type: "password", placeholder: "DOKU secret key", tooltip: "Secret Key used to sign DOKU Checkout requests with HMAC-SHA256." },
      { key: "DOKU_IS_PRODUCTION", label: "Mode", type: "select", tooltip: "Use sandbox while testing. Switch to production only after DOKU approval and callback testing.", options: [{ value: "false", label: "Sandbox" }, { value: "true", label: "Production" }] },
    ],
  },
  {
    title: "PayPal Business",
    description: "Use PayPal Checkout Orders API. Store sandbox and live credentials separately, then switch mode with the toggle.",
    processors: ["paypal"],
    fields: [
      { key: "PAYPAL_SANDBOX_CLIENT_ID", label: "Sandbox API key / Client ID", placeholder: "Sandbox REST app API key / client ID", tooltip: "PayPal may label this API key or Client ID. It is the public sandbox ID used by the PayPal JavaScript SDK and Orders API when mode is Sandbox." },
      { key: "PAYPAL_SANDBOX_CLIENT_SECRET", label: "Sandbox API secret", type: "password", placeholder: "Sandbox REST app secret", tooltip: "Server-side sandbox secret used to create/capture sandbox PayPal Orders. Never expose it in public pages." },
      { key: "PAYPAL_SANDBOX_WEBHOOK_ID", label: "Sandbox Webhook ID", placeholder: "Sandbox webhook ID from PayPal app", tooltip: "Webhook ID created in the sandbox REST app. It must match the sandbox API key/secret for signature verification." },
      { key: "PAYPAL_LIVE_CLIENT_ID", label: "Live API key / Client ID", placeholder: "Live REST app API key / client ID", tooltip: "PayPal may label this API key or Client ID. It is the public live ID used by the PayPal JavaScript SDK and Orders API when mode is Live." },
      { key: "PAYPAL_LIVE_CLIENT_SECRET", label: "Live API secret", type: "password", placeholder: "Live REST app secret", tooltip: "Server-side live secret used to create/capture live PayPal Orders. Never expose it in public pages." },
      { key: "PAYPAL_LIVE_WEBHOOK_ID", label: "Live Webhook ID", placeholder: "Live webhook ID from PayPal app", tooltip: "Webhook ID created in the live REST app. It must match the live API key/secret for signature verification." },
      { key: "PAYPAL_BUSINESS_URL", label: "PayPal fallback link", placeholder: "https://www.paypal.com/...", tooltip: "Optional fallback PayPal Business checkout/invoice/payment link if API order creation fails or credentials are not ready." },
      { key: "PAYPAL_ACCOUNT_MODE", label: "Fallback account mode", type: "select", tooltip: "Only relevant when using a manual PayPal fallback link. Business is preferred; Personal bridge should only be temporary low-volume testing.", options: [{ value: "business", label: "Business / invoice link" }, { value: "personal_bridge", label: "Personal temporary bridge" }] },
      { key: "PAYPAL_RISK_ACKNOWLEDGED", label: "PayPal risk checklist", type: "select", tooltip: "Set to acknowledged only after reviewing the PayPal risk checklist below and preparing delivery/payment records.", options: [{ value: "false", label: "Not acknowledged" }, { value: "true", label: "Acknowledged" }] },
      { key: "PAYPAL_PAYMENT_NOTE", label: "Fallback payment note", placeholder: "Ask buyer to include business, domain, and reference", tooltip: "Only used when checkout falls back to a manual PayPal link. API checkout stores the reference on the PayPal order and captures automatically." },
      { key: "PAYPAL_WEBHOOK_ID", label: "Legacy shared Webhook ID", placeholder: "Legacy shared webhook ID", tooltip: "Legacy fallback only. Prefer sandbox/live webhook IDs so signature verification always matches the active PayPal mode." },
      { key: "ADMIN_WHATSAPP_NUMBER", label: "Admin WhatsApp number", placeholder: "62812...", tooltip: "Fallback contact if the PayPal/manual checkout needs admin follow-up." },
    ],
  },
  {
    title: "Wise",
    description: "Use a Wise request/payment link for manual reconciliation.",
    processors: ["wise"],
    fields: [
      { key: "WISE_PAYMENT_URL", label: "Wise payment/request link", placeholder: "https://wise.com/...", tooltip: "Wise request/payment link or invoice link for clients who can pay by bank transfer-style rails." },
      { key: "ADMIN_WHATSAPP_NUMBER", label: "Admin WhatsApp number", placeholder: "62812...", tooltip: "Fallback contact if Wise checkout needs admin follow-up." },
    ],
  },
  {
    title: "Payoneer",
    description: "Use a Payoneer payment request link for manual reconciliation.",
    processors: ["payoneer"],
    fields: [
      { key: "PAYONEER_PAYMENT_URL", label: "Payoneer payment request link", placeholder: "https://payoneer.com/...", tooltip: "Payoneer payment request link for clients who prefer Payoneer." },
      { key: "ADMIN_WHATSAPP_NUMBER", label: "Admin WhatsApp number", placeholder: "62812...", tooltip: "Fallback contact if Payoneer checkout needs admin follow-up." },
    ],
  },
  {
    title: "Manual follow-up",
    description: "Mock checkout records checkout_pending and routes the buyer to admin follow-up.",
    processors: ["mock"],
    fields: [
      { key: "ADMIN_WHATSAPP_NUMBER", label: "Admin WhatsApp number", placeholder: "62812...", tooltip: "Used when checkout is mock or fails, so the admin still receives a follow-up-ready message." },
    ],
  },
  {
    title: "Legacy links",
    description: "Kept for compatibility. Lemon Squeezy is not recommended for web development/service sales.",
    processors: ["lemon_squeezy_legacy"],
    fields: [
      { key: "PAYMENT_LINK_BASIC", label: "Basic package URL", placeholder: "Legacy/basic payment link", tooltip: "Legacy public setting. Prefer selected processor checkout for the done-for-you flow." },
      { key: "PAYMENT_LINK_PREMIUM", label: "Premium package URL", placeholder: "Legacy/premium payment link", tooltip: "Legacy public setting. Prefer selected processor checkout for the done-for-you flow." },
      { key: "LEMON_SQUEEZY_API_KEY", label: "Lemon API Key", type: "password", placeholder: "Lemon Squeezy API Key", tooltip: "Legacy only. Lemon Squeezy prohibits services including web development in its prohibited-products docs." },
      { key: "LEMON_SQUEEZY_STORE_ID", label: "Lemon Store ID", placeholder: "Store ID", tooltip: "Legacy Lemon Squeezy store ID." },
      { key: "LEMON_SQUEEZY_VARIANT_ID", label: "Lemon Variant ID", placeholder: "Variant ID", tooltip: "Legacy Lemon Squeezy variant ID." },
    ],
  },
];

const domainRegistrarOptions = [
  { value: "cloudflare_registrar", label: "Cloudflare Registrar", requiredKeys: ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"] },
  { value: "name_com", label: "Name.com", requiredKeys: ["NAME_COM_USERNAME", "NAME_COM_API_TOKEN"] },
  { value: "dynadot", label: "Dynadot", requiredKeys: ["DYNADOT_API_KEY"] },
  { value: "spaceship", label: "Spaceship", requiredKeys: ["SPACESHIP_API_KEY", "SPACESHIP_API_SECRET"] },
];

const fallbackDomainRegistrarOption = {
  value: "cloudflare_registrar",
  label: "Cloudflare Registrar",
  requiredKeys: ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"],
};

const domainRegistrarFieldGroups: Array<{
  title: string;
  description: string;
  providers?: string[];
  fields: Array<{ key: string; label: string; type?: "text" | "password" | "number" | "select"; placeholder?: string; tooltip: string; options?: Array<{ value: string; label: string }> }>;
}> = [
  {
    title: "Quote behavior",
    description: "Controls the non-billable registrar quote captured before payment. Empty provider credentials do not block checkout.",
    fields: [
      { key: "DOMAIN_REGISTRAR_PROVIDER", label: "Default registrar", type: "select", tooltip: "Provider used by /api/domains/quote when the buyer checks a new domain. Only score 7.0+ registrars are available.", options: domainRegistrarOptions.map((option) => ({ value: option.value, label: option.label })) },
      { key: "DOMAIN_REGISTRATION_MAX_USD", label: "Max internal domain cost", type: "number", placeholder: "17", tooltip: "Internal guardrail for registrar quote. Buyers still see the included $17/year domain fee; this protects margin and flags expensive or premium domains." },
    ],
  },
  {
    title: "Cloudflare Registrar",
    description: "Preferred registrar when your Cloudflare account has Registrar API access.",
    providers: ["cloudflare_registrar"],
    fields: [
      { key: "CLOUDFLARE_ACCOUNT_ID", label: "Account ID", placeholder: "Cloudflare account ID", tooltip: "Cloudflare account ID used by the server-side Registrar API quote adapter." },
      { key: "CLOUDFLARE_API_TOKEN", label: "API token", type: "password", placeholder: "Cloudflare API token", tooltip: "Server-side token with scoped Registrar permissions. Leave empty until the account is ready; checkout still works with manual domain confirmation." },
    ],
  },
  {
    title: "Name.com",
    description: "JSON API fallback with sandbox/production separation.",
    providers: ["name_com"],
    fields: [
      { key: "NAME_COM_ENV", label: "Mode", type: "select", tooltip: "Use sandbox for test quotes, production for live registrar quote capture.", options: [{ value: "production", label: "Production" }, { value: "sandbox", label: "Sandbox" }] },
      { key: "NAME_COM_USERNAME", label: "Username", placeholder: "Name.com username", tooltip: "Name.com API username for server-side quote checks." },
      { key: "NAME_COM_API_TOKEN", label: "API token", type: "password", placeholder: "Name.com API token", tooltip: "Name.com API token. Leave empty until ready; checkout still saves orders without registrar quotes." },
    ],
  },
  {
    title: "Dynadot",
    description: "Fallback registrar adapter using the Dynadot search API with price output.",
    providers: ["dynadot"],
    fields: [
      { key: "DYNADOT_ENV", label: "Mode", type: "select", tooltip: "Use sandbox while testing; production checks the live Dynadot account.", options: [{ value: "production", label: "Production" }, { value: "sandbox", label: "Sandbox" }] },
      { key: "DYNADOT_API_KEY", label: "API key", type: "password", placeholder: "Dynadot API key", tooltip: "Dynadot API key for server-side quote checks. Empty credentials keep checkout in manual-confirmation mode." },
    ],
  },
  {
    title: "Spaceship",
    description: "Lower-cost registrar fallback to test after primary providers.",
    providers: ["spaceship"],
    fields: [
      { key: "SPACESHIP_API_KEY", label: "API key", type: "password", placeholder: "Spaceship API key", tooltip: "Spaceship API key for server-side quote checks." },
      { key: "SPACESHIP_API_SECRET", label: "API secret", type: "password", placeholder: "Spaceship API secret", tooltip: "Spaceship API secret. Keep it server-side only; leave empty until ready." },
    ],
  },
];

function cooldownEventLabel(eventType = "") {
  if (eventType === "set") return "Cooldown set";
  if (eventType === "clear") return "Cooldown cleared";
  if (eventType === "blocked") return "Attempt blocked";
  return eventType || "Cooldown event";
}

function cooldownEventClass(eventType = "") {
  if (eventType === "clear") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (eventType === "blocked") return "border-red-200 bg-red-50 text-red-800";
  return "border-amber-200 bg-amber-50 text-amber-900";
}

type PaypalPlanCacheRow = {
  key: string;
  mode: string;
  domainMode: string;
  termYears: number;
  annualUsd: number;
  hostingAfterDiscountUsd: number;
  domainAnnualUsd: number;
  setupFeeUsd: number;
  planId: string;
  productId: string;
  planStatus: string;
  updatedAt: string;
};

type PaymentSmokeEvent = {
  processor: string;
  status: string;
  amountUsd: number;
  transactionId: string;
  paymentReference: string;
  payerEmail: string;
  proofNotes: string;
  source: string;
  paypalOrderId: string;
  paypalSubscriptionId: string;
  referenceCandidates: string[];
  verifiedAt: string;
  updatedAt: string;
  isSubscription: boolean;
};

function moneyLabel(value: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}

export default function AdminSettings() {
  const [settings, setSettings] = useState<Record<string, string>>(initialSettings);
  const [selectedProvider, setSelectedProvider] = useLocalStorageState<ProviderKey>("webview.adminSettings.selectedProvider", "OPENROUTER");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [message, setMessage] = useState("");
  const [dirty, setDirty] = useState(false);
  const [pricingProvider, setPricingProvider] = useLocalStorageState("webview.adminSettings.pricingProvider", "OpenRouter");
  const [pricingModel, setPricingModel] = useLocalStorageState("webview.adminSettings.pricingModel", "~anthropic/claude-sonnet-latest");
  const [inputTokens, setInputTokens] = useState(defaultInputTokens);
  const [outputTokens, setOutputTokens] = useState(defaultOutputTokens);
  const [cooldownEvents, setCooldownEvents] = useState<ProviderCooldownEvent[]>([]);
  const [cooldownEventsLoading, setCooldownEventsLoading] = useState(false);
  const [paypalPlanCache, setPaypalPlanCache] = useState<PaypalPlanCacheRow[]>([]);
  const [paypalPlanCacheLoading, setPaypalPlanCacheLoading] = useState(false);
  const [copiedPaypalPlanId, setCopiedPaypalPlanId] = useState("");
  const [paymentSmokeEvents, setPaymentSmokeEvents] = useState<PaymentSmokeEvent[]>([]);
  const [paymentSmokeLoading, setPaymentSmokeLoading] = useState(false);
  const [openSettingSections, setOpenSettingSections] = useLocalStorageState<Record<string, boolean>>(
    "webview.adminSettings.openSections",
    {},
  );

  const settingsSectionOpen = (sectionKey: string) => Boolean(openSettingSections[sectionKey]);
  const toggleSettingsSection = (sectionKey: string) => {
    setOpenSettingSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  const selectedProviderConfig = useMemo(
    () => providerOptions.find((provider) => provider.key === selectedProvider) || providerOptions[0],
    [selectedProvider],
  );

  useEffect(() => {
    if (!providerOptions.some((provider) => provider.key === selectedProvider)) {
      setSelectedProvider("OPENROUTER");
    }
  }, [selectedProvider]);

  useEffect(() => {
    const providerModels = aiModelPrices.filter((item) => item.provider === pricingProvider);
    if (providerModels.length === 0) {
      setPricingProvider("OpenRouter");
      setPricingModel("~anthropic/claude-sonnet-latest");
      return;
    }

    if (!providerModels.some((item) => item.model === pricingModel)) {
      setPricingModel(providerModels[0].model);
    }
  }, [pricingProvider, pricingModel]);

  const fetchCooldownHistory = () => {
    setCooldownEventsLoading(true);
    fetch("/api/provider-cooldowns/history?limit=8")
      .then((response) => response.ok ? response.json() : [])
      .then((data) => setCooldownEvents(Array.isArray(data) ? data : []))
      .catch(() => setCooldownEvents([]))
      .finally(() => setCooldownEventsLoading(false));
  };

  const exportCooldownHistory = async () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      source: "admin_settings_provider_cooldown_history",
      count: cooldownEvents.length,
      events: cooldownEvents.map((event) => ({
        provider: event.provider,
        eventType: event.eventType,
        createdAt: event.createdAt,
        cooldownUntil: event.cooldownUntil || null,
        reason: event.reason || "",
        action: event.metadata?.action || "",
        businessId: event.metadata?.businessId || "",
        placeId: event.metadata?.placeId || "",
        generationJobId: event.metadata?.generationJobId || "",
      })),
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setMessage("Provider cooldown history copied for support/debug.");
      window.setTimeout(() => setMessage((current) => current === "Provider cooldown history copied for support/debug." ? "" : current), 3000);
    } catch {
      setMessage("Could not copy cooldown history. Select the visible rows manually.");
    }
  };

  const fetchPaypalPlanCache = () => {
    setPaypalPlanCacheLoading(true);
    fetch("/api/settings/paypal-plan-cache")
      .then((response) => response.ok ? response.json() : { plans: [] })
      .then((data) => setPaypalPlanCache(Array.isArray(data?.plans) ? data.plans : []))
      .catch(() => setPaypalPlanCache([]))
      .finally(() => setPaypalPlanCacheLoading(false));
  };

  const fetchPaymentSmoke = () => {
    setPaymentSmokeLoading(true);
    fetch("/api/settings/payment-smoke")
      .then((response) => response.ok ? response.json() : { events: [] })
      .then((data) => setPaymentSmokeEvents(Array.isArray(data?.events) ? data.events : []))
      .catch(() => setPaymentSmokeEvents([]))
      .finally(() => setPaymentSmokeLoading(false));
  };

  const copyPaypalPlanId = async (planId: string) => {
    if (!planId) return;
    try {
      await navigator.clipboard.writeText(planId);
      setCopiedPaypalPlanId(planId);
      setMessage("PayPal plan ID copied.");
      window.setTimeout(() => {
        setCopiedPaypalPlanId((current) => current === planId ? "" : current);
        setMessage((current) => current === "PayPal plan ID copied." ? "" : current);
      }, 1600);
    } catch {
      setMessage("Could not copy PayPal plan ID. Select it manually.");
    }
  };

  useEffect(() => {
    fetchCooldownHistory();
    fetchPaypalPlanCache();
    fetchPaymentSmoke();
    window.addEventListener("focus", fetchCooldownHistory);
    window.addEventListener(providerCooldownEvent, fetchCooldownHistory);
    return () => {
      window.removeEventListener("focus", fetchCooldownHistory);
      window.removeEventListener(providerCooldownEvent, fetchCooldownHistory);
    };
  }, []);

  useEffect(() => {
    fetch("/api/settings")
      .then(async (response) => {
        if (!response.ok) {
          const text = await response.text();
          throw new Error(`Server error ${response.status}: ${text.substring(0, 120)}`);
        }
        return response.json();
      })
      .then((data) => {
        setSettings((prev) => ({ ...prev, ...data }));
        setLoading(false);
      })
      .catch((err) => {
        console.error("Settings fetch error:", err);
        setSaveStatus("error");
        setMessage("Settings belum bisa dibaca dari API. Cek binding D1 dan deploy Pages Functions.");
        setLoading(false);
      });
  }, []);

  const saveSettings = async (nextSettings: Record<string, string>, showSavedMessage = true) => {
    setSaving(true);
    setSaveStatus("saving");
    setMessage("Menyimpan perubahan...");

    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextSettings),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Server error ${response.status}: ${text.substring(0, 120)}`);
      }

      clearAiReadinessCache();
      setDirty(false);
      setSaveStatus("saved");
      setMessage(showSavedMessage ? "Perubahan tersimpan otomatis." : "Perubahan tersimpan.");
      window.setTimeout(() => {
        setSaveStatus((current) => current === "saved" ? "idle" : current);
        setMessage((current) => current === "Perubahan tersimpan otomatis." || current === "Perubahan tersimpan." ? "" : current);
      }, 3500);
    } catch (error) {
      console.error(error);
      setSaveStatus("error");
      setMessage("Gagal menyimpan. Perubahan masih ada di form, coba klik Simpan lagi.");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (loading || !dirty) return;

    setSaveStatus("dirty");
    setMessage("Ada perubahan belum tersimpan. Auto-save akan berjalan sebentar lagi.");

    const timer = window.setTimeout(() => {
      void saveSettings(settings);
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [settings, dirty, loading]);

  const handleChange = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const scoringWeights = useMemo(
    () => parseProspectScoreWeights(settings.SCORING_WEIGHTS_JSON),
    [settings.SCORING_WEIGHTS_JSON],
  );

  const updateScoringWeight = (key: ProspectScoreWeightKey, value: string) => {
    const numeric = Number(value);
    const nextWeights = {
      ...scoringWeights,
      [key]: Number.isFinite(numeric) ? numeric : 0,
    };
    setSettings((prev) => ({
      ...prev,
      SCORING_PRESET: "custom",
      SCORING_WEIGHTS_JSON: serializeProspectScoreWeights(nextWeights),
    }));
    setDirty(true);
  };

  const applyScoringPreset = (presetKey: string) => {
    const preset = prospectScoringPresets.find((item) => item.key === presetKey);
    if (!preset) {
      handleChange("SCORING_PRESET", presetKey);
      return;
    }
    setSettings((prev) => ({
      ...prev,
      SCORING_PRESET: preset.key,
      SCORING_MIN_SCORE_DEFAULT: preset.defaultThreshold,
      SCORING_WEIGHTS_JSON: serializeProspectScoreWeights(preset.weights),
    }));
    setDirty(true);
  };

  const resetScoringWeights = () => {
    applyScoringPreset("balanced");
  };

  const handleManualSave = () => {
    void saveSettings(settings, false);
  };

  const pricingModels = aiModelPrices.filter((item) => item.provider === pricingProvider);
  const pricingEstimate = estimateCostUsd(pricingProvider, pricingModel, inputTokens, outputTokens);
  const pricingProviderKeyReady = Boolean(String(settings?.[pricingProviderApiKeyMap[pricingProvider]] || "").trim());
  const serviceCopyProviderModes = useMemo(
    () => parseAiServiceCopyProviderModes(settings[AI_SERVICE_COPY_PROVIDER_MODES_KEY]),
    [settings[AI_SERVICE_COPY_PROVIDER_MODES_KEY]],
  );
  const serviceCopyModeKey = aiServiceCopyModeKey(pricingProvider, pricingModel);
  const selectedServiceCopyMode = resolveAiServiceCopyProviderMode(settings, pricingProvider, pricingModel);
  const updateSelectedServiceCopyMode = (updates: { slowMode?: boolean; serviceCopyBatchSize?: number }) => {
    const nextMode = {
      ...(serviceCopyProviderModes[serviceCopyModeKey] || {}),
      provider: pricingProvider,
      model: pricingModel,
      slowMode: updates.slowMode ?? selectedServiceCopyMode.slowMode,
      serviceCopyBatchSize: updates.serviceCopyBatchSize ?? selectedServiceCopyMode.serviceCopyBatchSize,
      updatedAt: new Date().toISOString(),
    };
    if (nextMode.slowMode) nextMode.serviceCopyBatchSize = 1;
    const nextModes = {
      ...serviceCopyProviderModes,
      [serviceCopyModeKey]: nextMode,
    };
    handleChange(AI_SERVICE_COPY_PROVIDER_MODES_KEY, JSON.stringify(nextModes, null, 2));
  };
  const activePaymentProcessor = settings.PAYMENT_PROCESSOR || "mock";
  const activeDomainRegistrar = settings.DOMAIN_REGISTRAR_PROVIDER || "cloudflare_registrar";
  const activeDomainRegistrarOption = domainRegistrarOptions.find((option) => option.value === activeDomainRegistrar) || fallbackDomainRegistrarOption;
  const visibleDomainRegistrarFieldGroups = domainRegistrarFieldGroups.filter((group) => !group.providers || group.providers.includes(activeDomainRegistrar));
  const missingDomainRegistrarKeys = activeDomainRegistrarOption.requiredKeys.filter((key) => !String(settings[key] || "").trim());
  const domainRegistrarConfigured = missingDomainRegistrarKeys.length === 0;
  const visiblePaymentFieldGroups = paymentFieldGroups.filter((group) => !group.processors || group.processors.includes(activePaymentProcessor));
  const paypalSelected = activePaymentProcessor === "paypal";
  const paypalLink = String(settings.PAYPAL_BUSINESS_URL || "").trim();
  const paypalLooksPersonal = /paypal\.me\//i.test(paypalLink) || settings.PAYPAL_ACCOUNT_MODE === "personal_bridge";
  const shouldShowPayPalRisk = paypalSelected || Boolean(paypalLink) || settings.PAYPAL_ACCOUNT_MODE === "personal_bridge";
  const paypalRiskAcknowledged = settings.PAYPAL_RISK_ACKNOWLEDGED === "true";
  const paypalGuardrailNeedsAttention = Boolean((paypalSelected && !paypalRiskAcknowledged) || paypalLooksPersonal);
  const paypalProductionSetting = settings.PAYPAL_IS_PRODUCTION || "false";
  const paypalLiveMode = paypalProductionSetting === "true";
  const activePaypalModeLabel = paypalLiveMode ? "Live" : "Sandbox";
  const activePaypalClientId = String(
    paypalLiveMode
      ? settings.PAYPAL_LIVE_CLIENT_ID || settings.PAYPAL_CLIENT_ID || ""
      : settings.PAYPAL_SANDBOX_CLIENT_ID || settings.PAYPAL_CLIENT_ID || "",
  ).trim();
  const activePaypalClientSecret = String(
    paypalLiveMode
      ? settings.PAYPAL_LIVE_CLIENT_SECRET || settings.PAYPAL_CLIENT_SECRET || ""
      : settings.PAYPAL_SANDBOX_CLIENT_SECRET || settings.PAYPAL_CLIENT_SECRET || "",
  ).trim();
  const paypalActiveCredentialsMissing = paypalSelected && (!activePaypalClientId || !activePaypalClientSecret);
  const paypalGuardrailMessage = paypalLooksPersonal
    ? "Personal/PayPal.me fallback detected. Prefer Business Checkout, keep proof of delivery, and avoid Friends and Family."
    : "Keep delivery records and payment references. New PayPal sellers can still see holds or reviews.";
  const paypalLiveClientIdReady = Boolean(String(settings.PAYPAL_LIVE_CLIENT_ID || settings.PAYPAL_CLIENT_ID || "").trim());
  const paypalLiveClientSecretReady = Boolean(String(settings.PAYPAL_LIVE_CLIENT_SECRET || settings.PAYPAL_CLIENT_SECRET || "").trim());
  const paypalLiveWebhookReady = Boolean(String(settings.PAYPAL_LIVE_WEBHOOK_ID || settings.PAYPAL_WEBHOOK_ID || "").trim());
  const paypalLiveClientIdDetail = settings.PAYPAL_LIVE_CLIENT_ID ? "Present" : settings.PAYPAL_CLIENT_ID ? "Present via legacy fallback" : "Missing";
  const paypalLiveClientSecretDetail = settings.PAYPAL_LIVE_CLIENT_SECRET ? "Present" : settings.PAYPAL_CLIENT_SECRET ? "Present via legacy fallback" : "Missing";
  const paypalLiveWebhookDetail = settings.PAYPAL_LIVE_WEBHOOK_ID ? "Present" : settings.PAYPAL_WEBHOOK_ID ? "Present via legacy fallback" : "Missing";
  const paypalPlanCacheReady = paypalPlanCache.some((plan) => plan.mode === "live");
  const lastPaypalSuccess = paymentSmokeEvents[0];
  const lastPaypalSubscriptionSuccess = paymentSmokeEvents.find((event) => event.isSubscription);
  const controlledLiveTestReference = String(settings.PAYPAL_CONTROLLED_LIVE_TEST_REFERENCE || "").trim();
  const normalizedControlledLiveTestReference = controlledLiveTestReference.toLowerCase();
  const controlledLiveTestMatch = normalizedControlledLiveTestReference
    ? paymentSmokeEvents.find((event) => {
      const candidates = [
        event.transactionId,
        event.paymentReference,
        event.paypalOrderId,
        event.paypalSubscriptionId,
        ...(Array.isArray(event.referenceCandidates) ? event.referenceCandidates : []),
      ];
      return candidates.some((candidate) => String(candidate || "").trim().toLowerCase() === normalizedControlledLiveTestReference);
    })
    : null;
  const controlledLiveTestDetail = !controlledLiveTestReference
    ? "Paste the order, capture, subscription, or WebView.click reference used for the controlled live test"
    : controlledLiveTestMatch
      ? `Matched paid row · ${controlledLiveTestMatch.updatedAt ? new Date(controlledLiveTestMatch.updatedAt).toLocaleString() : "no date"}`
      : "Recorded, but not found in recent paid PayPal rows";
  const paymentSmokeItems = [
    { label: "Live client ID", ok: paypalLiveClientIdReady, detail: paypalLiveClientIdDetail },
    { label: "Live client secret", ok: paypalLiveClientSecretReady, detail: paypalLiveClientSecretDetail },
    { label: "Live webhook ID", ok: paypalLiveWebhookReady, detail: paypalLiveWebhookDetail },
    { label: "Live plan cache", ok: paypalPlanCacheReady, detail: paypalPlanCacheReady ? `${paypalPlanCache.filter((plan) => plan.mode === "live").length} live plan${paypalPlanCache.filter((plan) => plan.mode === "live").length === 1 ? "" : "s"}` : "No live plans yet" },
    { label: "Successful PayPal payment", ok: Boolean(lastPaypalSuccess), detail: lastPaypalSuccess ? `${moneyLabel(lastPaypalSuccess.amountUsd)} · ${lastPaypalSuccess.updatedAt ? new Date(lastPaypalSuccess.updatedAt).toLocaleString() : "no date"}` : "No paid PayPal row yet" },
    { label: "Successful subscription event", ok: Boolean(lastPaypalSubscriptionSuccess), detail: lastPaypalSubscriptionSuccess ? `${lastPaypalSubscriptionSuccess.transactionId || "subscription"} · ${lastPaypalSubscriptionSuccess.updatedAt ? new Date(lastPaypalSubscriptionSuccess.updatedAt).toLocaleString() : "no date"}` : "No subscription success yet" },
    { label: "Controlled live test reference", ok: Boolean(controlledLiveTestMatch), detail: controlledLiveTestDetail },
  ];
  const paymentSmokeReadyForTraffic = paymentSmokeItems.every((item) => item.ok);

  if (loading) {
    return <div className="p-8 flex items-center justify-center">Loading settings...</div>;
  }

  const statusIcon = saveStatus === "saving"
    ? <Loader2 size={18} className="animate-spin" />
    : saveStatus === "saved"
      ? <CheckCircle2 size={18} />
      : <AlertCircle size={18} />;

  return (
    <div className="p-8 max-w-5xl mx-auto font-sans">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-8">
        <div>
          <h1 className="mb-1 inline-flex items-center gap-2 text-3xl font-semibold text-gray-900">
            Pengaturan Sistem (D1)
            <HelpTooltip text="Settings are stored in Cloudflare D1 and used by Pages Functions for search, AI generation, checkout, and prospect scoring." />
          </h1>
          <p className="text-gray-500 text-sm">Kelola API keys dan payment links yang tersimpan di Cloudflare D1.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleManualSave}
            disabled={saving}
            className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition flex items-center justify-center gap-2 shadow-sm"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {saving ? "Menyimpan..." : "Simpan Sekarang"}
          </button>
          <HelpTooltip text="Most changes auto-save after a short delay. Use this button when you want to force-save immediately before testing another admin page." />
        </div>
      </div>

      {message && (
        <div
          className={`mb-6 rounded-2xl border px-5 py-4 text-sm flex items-start gap-3 ${
            saveStatus === "error"
              ? "border-red-200 bg-red-50 text-red-900"
              : saveStatus === "saved"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          <div className="mt-0.5">{statusIcon}</div>
          <div>
            <p className="font-semibold">
              {saveStatus === "error" ? "Perlu dicek" : saveStatus === "saved" ? "Tersimpan" : "Auto-save aktif"}
            </p>
            <p className="mt-1">{message}</p>
          </div>
        </div>
      )}

      <div id="settings-ai-provider" className="scroll-mt-24 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex w-full items-center justify-between gap-2 hover:bg-slate-50">
          <button
            type="button"
            onClick={() => toggleSettingsSection("aiProvider")}
            className="flex min-w-0 flex-1 items-center justify-between gap-4 px-6 py-4 text-left"
          >
            <div>
              <h2 className="inline-flex items-center gap-1.5 text-lg font-semibold text-gray-900">
                AI Provider Credentials
                <HelpTooltip text="Expand only when editing API keys. Generation provider/model selection still happens in Leads and Sites." />
              </h2>
              <p className="mt-1 text-xs text-gray-500">{selectedProviderConfig.label} selected for credential editing.</p>
            </div>
            <ChevronDown size={18} className={`text-slate-500 transition ${settingsSectionOpen("aiProvider") ? "rotate-180" : ""}`} />
          </button>
          <div className="pr-6">
            <AdminDocsReader
              pathname="/admin/settings"
              defaultDocId="ai-models-research"
              tooltip="Open AI model and provider setup docs."
              buttonClassName="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-indigo-700"
              iconSize={17}
            />
          </div>
        </div>
        {settingsSectionOpen("aiProvider") && (
        <div className="grid border-t border-gray-100 md:grid-cols-[240px_1fr]">
          <aside className="border-b md:border-b-0 md:border-r border-gray-100 p-4 bg-gray-50">
            <p className="mb-3 inline-flex items-center gap-1.5 px-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              AI Provider
              <HelpTooltip text="Choose which provider credential to edit. This does not force the generator model; /admin/leads and /admin/sites still choose provider/model per generation." />
            </p>
            <div className="space-y-1">
              {providerOptions.map((provider) => (
                <button
                  key={provider.key}
                  type="button"
                  onClick={() => setSelectedProvider(provider.key)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                    selectedProvider === provider.key
                      ? "bg-white text-indigo-700 shadow-sm border border-indigo-100"
                      : "text-gray-600 hover:bg-white"
                  }`}
                >
                  {provider.label}
                </button>
              ))}
            </div>
          </aside>

          <section className="p-6 md:p-8">
            <div className="mb-6">
              <h2 className="inline-flex items-center gap-1.5 text-xl font-semibold text-gray-900">
                {selectedProviderConfig.label}
                <HelpTooltip text="Only the selected provider fields are shown here, but all provider keys remain stored in settings if previously saved." />
              </h2>
              <p className="text-sm text-gray-500 mt-1">{selectedProviderConfig.description}</p>
            </div>

            <div className="space-y-5">
              {selectedProviderConfig.fields.map((field) => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
                  {field.helper && <p className="text-xs text-gray-500 mb-2">{field.helper}</p>}
                  <input
                    type={field.type}
                    value={settings[field.key] || ""}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm"
                  />
                </div>
              ))}
            </div>
          </section>
        </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6 mt-6">
        <div id="settings-google-places" className="scroll-mt-24 bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <button
            type="button"
            onClick={() => toggleSettingsSection("googlePlaces")}
            className="flex w-full items-center justify-between gap-4 text-left"
          >
            <div>
              <h2 className="mb-2 inline-flex items-center gap-1.5 text-lg font-semibold text-gray-900">
                Google Places
                <HelpTooltip text="Server-side key used for Places search, details, reviews, and photo proxy calls. It should be API-restricted, not HTTP-referrer restricted." />
              </h2>
              <p className="text-xs text-gray-500">
                Dipakai dari Cloudflare Pages Function. Expand only when rotating the Places key.
              </p>
            </div>
            <ChevronDown size={18} className={`shrink-0 text-slate-500 transition ${settingsSectionOpen("googlePlaces") ? "rotate-180" : ""}`} />
          </button>
          {settingsSectionOpen("googlePlaces") && (
          <div className="mt-4">
            <p className="mb-3 text-xs text-gray-500">
              Jangan gunakan HTTP referrer restriction untuk key ini; pakai API restriction ke Places API saja.
            </p>
            <input
              type="password"
              value={settings.GOOGLE_PLACES_API_KEY || ""}
              onChange={(e) => handleChange("GOOGLE_PLACES_API_KEY", e.target.value)}
              placeholder="AIzaSy..."
              className="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          )}
        </div>

        <div id="settings-offer-conversion" className="scroll-mt-24 bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <button
            type="button"
            onClick={() => toggleSettingsSection("offerConversion")}
            className="flex w-full items-start justify-between gap-4 text-left"
          >
            <div>
              <h2 className="inline-flex items-center gap-1.5 text-lg font-semibold text-gray-900">
                Offer & Conversion
                <HelpTooltip text="Pricing and package copy shown to buyers and sent to checkout providers. Keep this separate from gateway credentials so payment setup stays focused." />
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">
                ${settings.PAYMENT_USD_AMOUNT || "197"}/year new-domain total, ${settings.PAYMENT_DOMAIN_FEE_USD || "17"}/year domain fee, ${settings.PAYMENT_ADDON_PAGE_USD || "10"} page/edit add-ons, IDR rate {settings.PAYMENT_USD_TO_IDR_RATE || "16000"}.
              </p>
            </div>
            <ChevronDown size={18} className={`mt-1 shrink-0 text-slate-500 transition ${settingsSectionOpen("offerConversion") ? "rotate-180" : ""}`} />
          </button>

          {settingsSectionOpen("offerConversion") && (
          <div className="mt-4">
            <p className="mb-4 text-xs leading-relaxed text-gray-500">
              {offerConversionGroup.description}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {offerConversionGroup.fields.map((field) => (
                <label key={field.key} className="text-sm">
                  <span className="mb-1 flex items-center gap-1.5 font-medium text-gray-700">
                    {field.label}
                    <HelpTooltip text={field.tooltip} widthClass="w-72" />
                  </span>
                  <input
                    type={field.type || "text"}
                    value={settings[field.key] || ""}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full rounded-lg border border-gray-300 bg-white p-2.5 font-mono text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </label>
              ))}
            </div>
          </div>
          )}
        </div>

        <div id="settings-payment" className="scroll-mt-24 bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex w-full items-start justify-between gap-3">
            <button
              type="button"
              onClick={() => toggleSettingsSection("payment")}
              className="flex min-w-0 flex-1 items-center justify-between gap-4 text-left"
            >
              <div>
                <h2 className="mb-2 inline-flex items-center gap-1.5 text-lg font-semibold text-gray-900">
                  Payment Setup
                  <HelpTooltip text="Select the checkout rail used by the public Download / Setup panel. If the selected rail is missing keys, checkout stays in mock mode and records checkout_pending for follow-up." />
                </h2>
                <p className="text-xs leading-relaxed text-gray-500">
                  Active processor: {paymentProcessorOptions.find((option) => option.value === activePaymentProcessor)?.label || activePaymentProcessor}
                </p>
                {paypalActiveCredentialsMissing && (
                  <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                    <AlertCircle size={13} />
                    PayPal {activePaypalModeLabel} keys missing
                  </p>
                )}
              </div>
              <ChevronDown size={18} className={`text-slate-500 transition ${settingsSectionOpen("payment") ? "rotate-180" : ""}`} />
            </button>
            <AdminDocsReader
              pathname="/admin/settings"
              defaultDocId={paypalSelected ? "paypal-express-checkout" : "payment-processor-research"}
              tooltip="Open payment setup docs."
              buttonClassName="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-indigo-700"
              iconSize={17}
            />
          </div>

          {settingsSectionOpen("payment") && (
          <div className="mt-4">
          <p className="mb-4 text-xs leading-relaxed text-gray-500">
            Lemon Squeezy is kept only as legacy because its prohibited-products docs disallow web development/services. Prefer Xendit, Midtrans, DOKU, or PayPal Business Checkout for live checkout, with Wise/Payoneer as manual fallback links.
          </p>

          {paypalActiveCredentialsMissing && (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
              <AlertCircle size={18} className="mt-0.5 shrink-0 text-amber-700" />
              <div>
                <p className="font-semibold">PayPal {activePaypalModeLabel} credentials are incomplete</p>
                <p className="mt-1 text-xs leading-relaxed">
                  You selected PayPal checkout, but the active {activePaypalModeLabel.toLowerCase()} API key / Client ID or secret is missing. Add both before leaving Settings, or checkout will fall back to manual/mock follow-up instead of inline PayPal capture.
                </p>
              </div>
            </div>
          )}

          <label className="block text-sm">
            <span className="mb-1 flex items-center gap-1.5 font-medium text-gray-700">
              Active payment processor
              <HelpTooltip text="This controls /api/payments/checkout. Select mock while keys are missing; switch to Xendit, Midtrans, DOKU, or PayPal after account approval and sandbox testing." />
            </span>
            <select
              value={settings.PAYMENT_PROCESSOR || "mock"}
              onChange={(e) => handleChange("PAYMENT_PROCESSOR", e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500"
            >
              {paymentProcessorOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-gray-500">
              {paymentProcessorOptions.find((option) => option.value === (settings.PAYMENT_PROCESSOR || "mock"))?.helper}
            </span>
          </label>

          {shouldShowPayPalRisk && (
          <div className={`mt-4 rounded-xl border px-3 py-2.5 ${paypalGuardrailNeedsAttention ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"}`}>
            <div className="flex items-start gap-2.5">
              <ShieldAlert size={17} className={paypalGuardrailNeedsAttention ? "mt-0.5 shrink-0 text-amber-700" : "mt-0.5 shrink-0 text-slate-500"} />
              <div className="min-w-0 flex-1">
                <p className={`inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${paypalGuardrailNeedsAttention ? "text-amber-950" : "text-slate-700"}`}>
                  PayPal guardrails
                  <HelpTooltip text="API Checkout captures payment directly and stores a PayPal order reference. Still keep delivery records and avoid Personal/Friends-and-Family style payments for business sales." widthClass="w-80" />
                </p>
                <p className={`mt-0.5 text-xs leading-relaxed ${paypalGuardrailNeedsAttention ? "text-amber-900" : "text-slate-600"}`}>
                  {paypalGuardrailMessage}
                </p>
                {paypalSelected && !paypalRiskAcknowledged && (
                  <p className="mt-2 rounded-lg border border-amber-300 bg-white/70 px-2 py-1.5 text-xs font-medium text-amber-950">
                    Set the risk checklist to Acknowledged after reviewing the docs and preparing delivery records.
                  </p>
                )}
              </div>
            </div>
          </div>
          )}

          <div className="mt-5 space-y-5">
            {visiblePaymentFieldGroups.map((group) => (
              <section key={group.title} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3">
                  <p className="text-sm font-semibold text-slate-900">{group.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{group.description}</p>
                </div>
                {group.title === "PayPal Business" && (
                  <div className="mb-4 rounded-xl border border-slate-200 bg-white p-3">
                    <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-gray-700">
                      PayPal mode
                      <HelpTooltip text="Sandbox uses your PayPal sandbox REST app credentials for test orders. Live uses your live REST app credentials for real buyer payments." widthClass="w-72" />
                    </div>
                    <div className="inline-flex rounded-lg border border-slate-300 bg-slate-100 p-1">
                      {[
                        { value: "false", label: "Sandbox" },
                        { value: "true", label: "Live" },
                      ].map((option) => {
                        const active = paypalProductionSetting === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => handleChange("PAYPAL_IS_PRODUCTION", option.value)}
                            className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                              active
                                ? "bg-white text-indigo-700 shadow-sm"
                                : "text-slate-600 hover:bg-white/70 hover:text-slate-900"
                            }`}
                            aria-pressed={active}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-slate-500">
                      Showing {activePaypalModeLabel.toLowerCase()} credentials only. The other mode stays saved and is used after you toggle back.
                    </p>
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  {group.fields
                    .filter((field) => {
                      if (group.title !== "PayPal Business") return true;
                      if (field.key.startsWith("PAYPAL_SANDBOX_")) return !paypalLiveMode;
                      if (field.key.startsWith("PAYPAL_LIVE_")) return paypalLiveMode;
                      if (field.key === "PAYPAL_WEBHOOK_ID") return Boolean(settings.PAYPAL_WEBHOOK_ID);
                      if (field.key === "PAYPAL_PAYMENT_NOTE") return Boolean(paypalLink);
                      if (field.key === "PAYPAL_ACCOUNT_MODE") return Boolean(paypalLink) || settings.PAYPAL_ACCOUNT_MODE === "personal_bridge";
                      return true;
                    })
                    .map((field) => (
                    <label key={field.key} className="text-sm">
                      <span className="mb-1 flex items-center gap-1.5 font-medium text-gray-700">
                        {field.label}
                        <HelpTooltip text={field.tooltip} widthClass="w-72" />
                      </span>
                      {field.type === "select" ? (
                        <select
                          value={settings[field.key] || "false"}
                          onChange={(e) => handleChange(field.key, e.target.value)}
                          className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          {(field.options || []).map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={field.type || "text"}
                          value={settings[field.key] || ""}
                          onChange={(e) => handleChange(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          className="w-full rounded-lg border border-gray-300 bg-white p-2.5 font-mono text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      )}
                    </label>
                  ))}
                </div>
              </section>
            ))}
            {paypalSelected && (
              <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                        Payment smoke test
                        <HelpTooltip text="Small pre-live checklist. It does not prove the payment flow is perfect; it shows whether live PayPal keys, webhook ID, cached plans, and recent successful PayPal rows exist." widthClass="w-80" />
                      </p>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${paymentSmokeReadyForTraffic ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                        {paymentSmokeReadyForTraffic ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                        {paymentSmokeReadyForTraffic ? "Ready for traffic" : "Not ready for traffic"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">Use this before sending buyer traffic to the checkout page.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      fetchPaypalPlanCache();
                      fetchPaymentSmoke();
                    }}
                    disabled={paymentSmokeLoading || paypalPlanCacheLoading}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                  >
                    <RefreshCw size={14} className={paymentSmokeLoading || paypalPlanCacheLoading ? "animate-spin" : ""} />
                    Refresh
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {paymentSmokeItems.map((item) => (
                    <div key={item.label} className={`rounded-lg border p-3 ${item.ok ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
                      <div className="flex items-start gap-2">
                        {item.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-700" /> : <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-700" />}
                        <div className="min-w-0">
                          <p className={`text-xs font-semibold ${item.ok ? "text-emerald-950" : "text-amber-950"}`}>{item.label}</p>
                          <p className={`mt-0.5 break-words text-xs ${item.ok ? "text-emerald-800" : "text-amber-800"}`}>{item.detail}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className={`mt-3 rounded-lg border p-3 ${controlledLiveTestMatch ? "border-emerald-200 bg-white" : "border-amber-200 bg-white"}`}>
                  <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <label htmlFor="paypal-controlled-live-test-reference" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                      Controlled live payment reference
                      <HelpTooltip text="Paste the exact PayPal order/capture/subscription ID or WebView.click payment reference from your own controlled live test. The checklist only goes green when it matches a recent paid PayPal ledger row." widthClass="w-80" />
                    </label>
                    <button
                      type="button"
                      onClick={() => handleChange("PAYPAL_CONTROLLED_LIVE_TEST_REFERENCE", lastPaypalSuccess?.transactionId || lastPaypalSuccess?.paypalSubscriptionId || lastPaypalSuccess?.paypalOrderId || lastPaypalSuccess?.paymentReference || "")}
                      disabled={!lastPaypalSuccess}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Use last paid row
                    </button>
                  </div>
                  <input
                    id="paypal-controlled-live-test-reference"
                    type="text"
                    value={settings.PAYPAL_CONTROLLED_LIVE_TEST_REFERENCE || ""}
                    onChange={(event) => handleChange("PAYPAL_CONTROLLED_LIVE_TEST_REFERENCE", event.target.value)}
                    placeholder="Example: WebView.click payment reference, PayPal capture ID, order ID, or subscription ID"
                    className="w-full rounded-lg border border-slate-300 bg-white p-2.5 font-mono text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className={`mt-2 text-xs ${controlledLiveTestMatch ? "text-emerald-700" : "text-amber-800"}`}>{controlledLiveTestDetail}</p>
                </div>
                {lastPaypalSuccess && (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600">
                    <p className="font-semibold text-slate-900">Last successful PayPal row</p>
                    <p className="mt-1 break-all">
                      {lastPaypalSuccess.transactionId || "No transaction ID"} · {lastPaypalSuccess.source || lastPaypalSuccess.proofNotes || "paypal"} · {lastPaypalSuccess.paymentReference || "no reference"}
                    </p>
                  </div>
                )}
                <p className="mt-3 rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs leading-relaxed text-amber-900">
                  This checklist is not a substitute for a controlled live or sandbox payment. It only confirms configuration and recent ledger evidence.
                </p>
              </section>
            )}
            {paypalSelected && (
              <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                      PayPal plan cache
                      <HelpTooltip text="Read-only list of cached PayPal subscription plans. Checkout reuses a plan only when mode, term, domain mode, annual price, hosting price, domain fee, and setup fee are an exact match." widthClass="w-80" />
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">Cached plans prevent a new PayPal Product/Plan for every yearly-billing checkout.</p>
                  </div>
                  <button
                    type="button"
                    onClick={fetchPaypalPlanCache}
                    disabled={paypalPlanCacheLoading}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                  >
                    <RefreshCw size={14} className={paypalPlanCacheLoading ? "animate-spin" : ""} />
                    Refresh
                  </button>
                </div>
                {paypalPlanCache.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-white p-3 text-xs text-slate-500">
                    No cached PayPal subscription plans yet. The first yearly-billing checkout for a price/term combination will create and cache one.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500">
                        <tr>
                          <th className="px-3 py-2 font-semibold">Mode</th>
                          <th className="px-3 py-2 font-semibold">Term</th>
                          <th className="px-3 py-2 font-semibold">Domain</th>
                          <th className="px-3 py-2 font-semibold">Annual</th>
                          <th className="px-3 py-2 font-semibold">Setup</th>
                          <th className="px-3 py-2 font-semibold">Plan</th>
                          <th className="px-3 py-2 font-semibold">Updated</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {paypalPlanCache.map((plan) => (
                          <tr key={plan.key} className="align-top">
                            <td className="px-3 py-2 font-semibold capitalize text-slate-800">{plan.mode || "-"}</td>
                            <td className="px-3 py-2 text-slate-700">{plan.termYears || "-"}y</td>
                            <td className="px-3 py-2 text-slate-700">{plan.domainMode === "owned" ? "Owned" : "New"}</td>
                            <td className="px-3 py-2 text-slate-700">
                              <span className="block font-semibold">{moneyLabel(plan.annualUsd)}</span>
                              <span className="block text-slate-500">hosting {moneyLabel(plan.hostingAfterDiscountUsd)}{plan.domainAnnualUsd ? ` + domain ${moneyLabel(plan.domainAnnualUsd)}` : ""}</span>
                            </td>
                            <td className="px-3 py-2 text-slate-700">{moneyLabel(plan.setupFeeUsd)}</td>
                            <td className="px-3 py-2">
                              <div className="flex items-start gap-1.5">
                                <code className="block max-w-[180px] break-all rounded bg-slate-100 px-1.5 py-1 text-[11px] text-slate-800">{plan.planId || "-"}</code>
                                {plan.planId && (
                                  <HoverTooltip text="Copy PayPal plan ID for dashboard comparison.">
                                    <button
                                      type="button"
                                      onClick={() => copyPaypalPlanId(plan.planId)}
                                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 hover:text-indigo-700"
                                      aria-label="Copy PayPal plan ID"
                                    >
                                      {copiedPaypalPlanId === plan.planId ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                                    </button>
                                  </HoverTooltip>
                                )}
                              </div>
                              <span className="mt-1 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">{plan.planStatus || "cached"}</span>
                            </td>
                            <td className="px-3 py-2 text-slate-500">{plan.updatedAt ? new Date(plan.updatedAt).toLocaleString() : "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}
          </div>
          </div>
          )}
        </div>
      </div>

      <div id="settings-domain-registrar" className="mt-6 scroll-mt-24 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <button
          type="button"
          onClick={() => toggleSettingsSection("domainRegistrar")}
          className="flex w-full items-start justify-between gap-4 text-left"
        >
          <div>
            <h2 className="mb-2 inline-flex items-center gap-1.5 text-lg font-semibold text-gray-900">
              Domain Registrar
              <HelpTooltip text="Optional automation for real registrar quote capture. If credentials are empty, public checkout still works and the order remains manual-confirmation friendly." widthClass="w-80" />
            </h2>
            <p className="text-xs leading-relaxed text-gray-500">
              Active registrar: {activeDomainRegistrarOption.label}. Buyer-facing checkout still shows the included $17/year domain fee.
            </p>
            {!domainRegistrarConfigured && (
              <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                <AlertCircle size={13} />
                Registrar quote not configured
              </p>
            )}
          </div>
          <ChevronDown size={18} className={`mt-1 shrink-0 text-slate-500 transition ${settingsSectionOpen("domainRegistrar") ? "rotate-180" : ""}`} />
        </button>

        {settingsSectionOpen("domainRegistrar") && (
          <div className="mt-4 space-y-5">
            {!domainRegistrarConfigured && (
              <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                <AlertCircle size={18} className="mt-0.5 shrink-0 text-amber-700" />
                <div>
                  <p className="font-semibold">Domain quotes are optional until credentials are filled</p>
                  <p className="mt-1 text-xs leading-relaxed">
                    Missing keys: {missingDomainRegistrarKeys.join(", ")}. Buyers can still check domains and pay; admin fulfillment will confirm final registrar price manually.
                  </p>
                </div>
              </div>
            )}
            {visibleDomainRegistrarFieldGroups.map((group) => (
              <section key={group.title} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3">
                  <p className="text-sm font-semibold text-slate-900">{group.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{group.description}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {group.fields.map((field) => (
                    <label key={field.key} className="text-sm">
                      <span className="mb-1 flex items-center gap-1.5 font-medium text-gray-700">
                        {field.label}
                        <HelpTooltip text={field.tooltip} widthClass="w-72" />
                      </span>
                      {field.type === "select" ? (
                        <select
                          value={settings[field.key] || field.options?.[0]?.value || ""}
                          onChange={(e) => handleChange(field.key, e.target.value)}
                          className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          {(field.options || []).map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={field.type || "text"}
                          value={settings[field.key] || ""}
                          onChange={(e) => handleChange(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          className="w-full rounded-lg border border-gray-300 bg-white p-2.5 font-mono text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      )}
                    </label>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className={`${settingsSectionOpen("scoring") ? "mb-5" : ""} flex flex-col gap-3 md:flex-row md:items-start md:justify-between`}>
          <button
            type="button"
            onClick={() => toggleSettingsSection("scoring")}
            className="flex min-w-0 flex-1 items-start justify-between gap-4 text-left"
          >
            <div>
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={19} className="text-indigo-600" />
              <h2 className="text-lg font-semibold text-gray-900">Prospect Scoring</h2>
              <HelpTooltip text="Setting ini dipakai oleh /admin/leads untuk mengurutkan dan menyaring prospek. Angka positif menaikkan prioritas, angka negatif menurunkan prioritas." />
            </div>
            <p className="mt-1 text-sm text-gray-500">Tune prioritas prospek tanpa edit kode.</p>
            </div>
            <ChevronDown size={18} className={`mt-1 shrink-0 text-slate-500 transition ${settingsSectionOpen("scoring") ? "rotate-180" : ""}`} />
          </button>
          {settingsSectionOpen("scoring") && (
          <HoverTooltip text="Restore the Balanced prospect scoring preset and default threshold used by /admin/leads filters.">
            <button
              type="button"
              onClick={resetScoringWeights}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              aria-label="Reset prospect scoring weights"
            >
              <RotateCcw size={16} />
            </button>
          </HoverTooltip>
          )}
        </div>

        {settingsSectionOpen("scoring") && (
        <div className="grid gap-5 md:grid-cols-[260px_1fr]">
          <div className="space-y-4">
            <label className="text-sm">
              <span className="mb-1 flex items-center gap-1.5 font-medium text-gray-700">
                Preset
                <HelpTooltip text="Preset mengisi threshold dan bobot scoring sekaligus. Mengubah weight manual akan menandai preset sebagai Custom." />
              </span>
              <select
                value={settings.SCORING_PRESET || "balanced"}
                onChange={(event) => applyScoringPreset(event.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500"
              >
                {prospectScoringPresets.map((preset) => (
                  <option key={preset.key} value={preset.key}>{preset.label}</option>
                ))}
                <option value="custom">Custom</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                {prospectScoringPresets.find((preset) => preset.key === settings.SCORING_PRESET)?.description || "Manual scoring weights."}
              </p>
            </label>

            <label className="text-sm">
              <span className="mb-1 flex items-center gap-1.5 font-medium text-gray-700">
                Default threshold
                <HelpTooltip text="Nilai ini menjadi default filter Min score di /admin/leads setelah settings terbaca. Admin tetap bisa mengganti filter sementara di halaman leads." />
              </span>
              <select
                value={settings.SCORING_MIN_SCORE_DEFAULT || "0"}
                onChange={(event) => {
                  setSettings((prev) => ({
                    ...prev,
                    SCORING_PRESET: "custom",
                    SCORING_MIN_SCORE_DEFAULT: event.target.value,
                  }));
                  setDirty(true);
                }}
                className="w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500"
              >
                {scoreThresholdOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {prospectScoreWeightFields.map((field) => (
              <label key={field.key} className="text-sm">
                <span className="mb-1 flex items-center gap-1.5 font-medium text-gray-700">
                  {field.label}
                  <HelpTooltip text={field.hint} widthClass="w-64" />
                </span>
                <input
                  type="number"
                  value={scoringWeights[field.key]}
                  onChange={(event) => updateScoringWeight(field.key, event.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500"
                />
              </label>
            ))}
          </div>
        </div>
        )}
      </div>

      <div className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <button
          type="button"
          onClick={() => toggleSettingsSection("aiEstimator")}
          className={`${settingsSectionOpen("aiEstimator") ? "mb-5" : ""} flex w-full items-center justify-between gap-4 text-left`}
        >
          <div className="flex flex-col gap-1">
            <h2 className="inline-flex items-center gap-1.5 text-lg font-semibold text-gray-900">
              Estimator Biaya AI
              <HelpTooltip text="Local estimate for one generated site JSON using the selected pricing table. Actual provider billing can differ by tokenization and provider-side rounding." />
            </h2>
            <p className="text-sm text-gray-500">
              Perkiraan biaya per generate JSON. KIE.ai ditampilkan sebagai estimasi diskon karena pricing detail live ada di dashboard KIE.
            </p>
          </div>
          <ChevronDown size={18} className={`shrink-0 text-slate-500 transition ${settingsSectionOpen("aiEstimator") ? "rotate-180" : ""}`} />
        </button>
        {settingsSectionOpen("aiEstimator") && (
        <>
        <div className="grid md:grid-cols-5 gap-4">
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-sm font-medium text-gray-700">
              Provider
              <HelpTooltip text="Pricing provider used only for this calculator. It does not change the generation provider selected in Leads/Sites." />
            </label>
            <select
              value={pricingProvider}
              onChange={(e) => {
                const provider = e.target.value;
                const firstModel = aiModelPrices.find((item) => item.provider === provider)?.model || "";
                setPricingProvider(provider);
                setPricingModel(firstModel);
              }}
              className="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              {Array.from(new Set(aiModelPrices.map((item) => item.provider))).map((provider) => (
                <option key={provider} value={provider}>{provider}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-sm font-medium text-gray-700">
              Model
              <HelpTooltip text="Selected model for this estimator and readiness check. Leads/Sites have their own saved generation model selectors." />
            </label>
            <select
              value={pricingModel}
              onChange={(e) => setPricingModel(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              {pricingModels.map((model) => (
                <option key={model.model} value={model.model}>{model.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <AdminAiReadinessRefreshButton
              className="mb-0.5"
              onRefresh={() => {
                setSaveStatus("idle");
                setMessage("AI readiness cache cleared. Badges will recheck the selected provider/model.");
              }}
            />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-sm font-medium text-gray-700">
              Input tokens
              <HelpTooltip text="Approximate prompt/input token count for one generate. Larger gathered data and copy briefs raise this number." />
            </label>
            <input
              type="number"
              min={0}
              value={inputTokens}
              onChange={(e) => setInputTokens(Number(e.target.value) || 0)}
              className="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-sm font-medium text-gray-700">
              Output tokens
              <HelpTooltip text="Approximate generated JSON/output size. Richer sites with products, services, galleries, and detail pages usually need more output tokens." />
            </label>
            <input
              type="number"
              min={0}
              value={outputTokens}
              onChange={(e) => setOutputTokens(Number(e.target.value) || 0)}
              className="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="inline-flex items-center gap-1.5 font-semibold text-slate-900">
              AI readiness
              <HelpTooltip text="Checks the selected pricing provider/model against saved Settings keys, the local model registry, and supported provider metadata without running a paid generation." />
            </p>
            <p className="mt-0.5 text-xs text-slate-500">Use this to verify a newly saved key before returning to Leads or Sites.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AdminAiReadinessBadge
              provider={pricingProvider}
              model={pricingModel}
              hasApiKey={pricingProviderKeyReady}
              requiresAi
              remoteValidate
            />
            <AdminProviderCooldownBadge provider={pricingProvider} />
            <AdminProviderHealthBadge provider={pricingProvider} model={pricingModel} />
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="inline-flex items-center gap-1.5 font-semibold text-slate-900">
                Service copy speed mode
                <HelpTooltip text="Saved per provider/model. Slow provider mode caps service-copy retries to one service per Pages Function request so slow providers are less likely to return Cloudflare 524 timeout pages." widthClass="w-80" />
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                Current model: {pricingProvider} / {pricingModel}. Jobs will show the estimated service-copy request count before retrying.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border border-slate-300 bg-slate-100 p-1">
                {[
                  { value: false, label: "Standard" },
                  { value: true, label: "Slow" },
                ].map((option) => {
                  const active = selectedServiceCopyMode.slowMode === option.value;
                  return (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => updateSelectedServiceCopyMode({ slowMode: option.value, serviceCopyBatchSize: option.value ? 1 : 2 })}
                      className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                        active ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:bg-white/70 hover:text-slate-900"
                      }`}
                      aria-pressed={active}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                Max per request
                <select
                  value={selectedServiceCopyMode.serviceCopyBatchSize}
                  onChange={(event) => updateSelectedServiceCopyMode({ serviceCopyBatchSize: Number(event.target.value) })}
                  disabled={selectedServiceCopyMode.slowMode}
                  className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-500"
                >
                  {[1, 2, 3, 4].map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <p className="mt-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
            {selectedServiceCopyMode.slowMode
              ? "Slow mode is on: service copy runs one service/product per request for this provider/model."
              : `Standard mode is on: service copy can ask for up to ${selectedServiceCopyMode.serviceCopyBatchSize} services/products per request for this provider/model.`}
          </p>
        </div>
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="inline-flex items-center gap-1.5 font-semibold text-slate-900">
                Provider cooldown history
                <HelpTooltip text="Recent shared cooldown events stored in D1: quota/rate-limit cooldowns, blocked generate/retry attempts, and manual clears." />
              </p>
              <p className="mt-0.5 text-xs text-slate-500">Useful when checking whether a provider was cleared, retried, or still causing blocked attempts.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <HoverTooltip text="Copy compact provider cooldown events for debugging provider blocks across tabs or deploys.">
                <button
                  type="button"
                  onClick={exportCooldownHistory}
                  disabled={!cooldownEvents.length}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  aria-label="Copy provider cooldown history"
                >
                  <Copy size={14} />
                </button>
              </HoverTooltip>
              <HoverTooltip text="Reload recent provider cooldown events from D1 without leaving Settings.">
                <button
                  type="button"
                  onClick={fetchCooldownHistory}
                  disabled={cooldownEventsLoading}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  aria-label="Refresh provider cooldown history"
                >
                  <RotateCcw size={13} className={cooldownEventsLoading ? "animate-spin" : ""} />
                </button>
              </HoverTooltip>
            </div>
          </div>
          <div className="space-y-2">
            {cooldownEvents.map((event) => {
              const action = String(event.metadata?.action || "");
              const until = Number(event.cooldownUntil || 0);
              return (
                <div key={event.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cooldownEventClass(event.eventType)}`}>
                      {cooldownEventLabel(event.eventType)}
                    </span>
                    <span className="text-xs font-semibold text-slate-900">{event.provider || "Provider"}</span>
                    {action && <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600">{action}</span>}
                    <span className="ml-auto text-[11px] text-slate-500">{event.createdAt ? new Date(event.createdAt).toLocaleString() : ""}</span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-600">
                    {event.reason || "No reason recorded."}
                  </p>
                  {until > 0 && (
                    <p className="mt-1 text-[11px] font-medium text-slate-500">
                      Cooldown until {new Date(until).toLocaleString()}
                    </p>
                  )}
                </div>
              );
            })}
            {!cooldownEvents.length && (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                No provider cooldown events recorded yet.
              </div>
            )}
          </div>
        </div>
        <div className="mt-5 rounded-xl bg-slate-50 border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Total estimasi</p>
          <p className="text-3xl font-semibold text-slate-900 mt-1">{formatUsd(pricingEstimate.total)}</p>
          {pricingEstimate.price?.note && <p className="text-xs text-slate-500 mt-2">{pricingEstimate.price.note}</p>}
        </div>
        </>
        )}
      </div>
    </div>
  );
}

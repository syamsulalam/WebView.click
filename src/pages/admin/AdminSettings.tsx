import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, Copy, Loader2, RotateCcw, Save, ShieldAlert, SlidersHorizontal } from "lucide-react";
import { aiModelPrices, defaultInputTokens, defaultOutputTokens, estimateCostUsd, formatUsd } from "../../lib/aiPricing";
import { useLocalStorageState } from "../../lib/localStorageState";
import { clearAiReadinessCache } from "../../lib/aiReadiness";
import HelpTooltip from "../../components/HelpTooltip";
import HoverTooltip from "../../components/HoverTooltip";
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
  PAYMENT_USD_TO_IDR_RATE: "16000",
  PAYMENT_PACKAGE_NAME: "WebView.click Done-for-you Website Setup",
  PAYMENT_PACKAGE_DESCRIPTION: "$197 total: domain/hosting coordination and done-for-you website setup.",
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
  PAYPAL_WEBHOOK_ID: "",
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
  { value: "paypal", label: "PayPal Business link", helper: "Fallback link. Use Business, not Personal, for commercial volume." },
  { value: "wise", label: "Wise payment/request link", helper: "Manual invoice/bank-transfer style fallback for larger B2B clients." },
  { value: "payoneer", label: "Payoneer payment request", helper: "Manual payment request fallback for clients who prefer Payoneer." },
  { value: "lemon_squeezy_legacy", label: "Lemon Squeezy legacy", helper: "Legacy only. Lemon Squeezy prohibits web development/services for this offer." },
];

const paymentFieldGroups: Array<{
  title: string;
  description: string;
  processors?: string[];
  fields: Array<{ key: string; label: string; type?: "text" | "password" | "number" | "select"; placeholder?: string; tooltip: string; options?: Array<{ value: string; label: string }> }>;
}> = [
  {
    title: "Offer and conversion",
    description: "Shown as USD to US clients, then converted to IDR for Indonesia-local gateways.",
    fields: [
      { key: "PAYMENT_USD_AMOUNT", label: "USD amount", type: "number", placeholder: "197", tooltip: "Customer-facing USD price for the done-for-you setup offer. Local Indonesia gateways receive an IDR conversion." },
      { key: "PAYMENT_USD_TO_IDR_RATE", label: "USD to IDR rate", type: "number", placeholder: "16000", tooltip: "Manual conversion rate used before sending IDR amount to Xendit, Midtrans, or DOKU. Update this if exchange rates move." },
      { key: "PAYMENT_PACKAGE_NAME", label: "Package name", placeholder: "WebView.click Done-for-you Website Setup", tooltip: "Name sent to hosted checkout/invoice providers." },
      { key: "PAYMENT_PACKAGE_DESCRIPTION", label: "Package description", placeholder: "$197 total...", tooltip: "Description sent to checkout providers and useful for payment dispute clarity." },
    ],
  },
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
    description: "Use PayPal Business or invoice links for manual checkout. Webhook credentials can stay empty until the Business app is ready.",
    processors: ["paypal"],
    fields: [
      { key: "PAYPAL_BUSINESS_URL", label: "PayPal Business link", placeholder: "https://www.paypal.com/...", tooltip: "Use a PayPal Business checkout/invoice/payment link. Avoid relying on PayPal Personal for business volume." },
      { key: "PAYPAL_ACCOUNT_MODE", label: "PayPal account mode", type: "select", tooltip: "Business is the target mode. Personal bridge is only for temporary low-volume testing while you upgrade.", options: [{ value: "business", label: "Business / invoice link" }, { value: "personal_bridge", label: "Personal temporary bridge" }] },
      { key: "PAYPAL_RISK_ACKNOWLEDGED", label: "PayPal risk checklist", type: "select", tooltip: "Set to acknowledged only after reviewing the PayPal risk checklist below and preparing delivery/payment records.", options: [{ value: "false", label: "Not acknowledged" }, { value: "true", label: "Acknowledged" }] },
      { key: "PAYPAL_PAYMENT_NOTE", label: "PayPal payment note instruction", placeholder: "Ask buyer to include business, domain, and reference", tooltip: "Shown before opening PayPal so the buyer sends a trackable business payment and does not use Friends and Family." },
      { key: "PAYPAL_CLIENT_ID", label: "PayPal Client ID", placeholder: "Business REST app client ID", tooltip: "Optional until you upgrade to PayPal Business. Used by /api/payments/paypal-webhook to verify webhook signatures." },
      { key: "PAYPAL_CLIENT_SECRET", label: "PayPal Client Secret", type: "password", placeholder: "Business REST app secret", tooltip: "Optional until PayPal Business is ready. Keep secret; only Pages Functions use it for webhook verification." },
      { key: "PAYPAL_WEBHOOK_ID", label: "PayPal Webhook ID", placeholder: "Webhook ID from PayPal app", tooltip: "Optional. The webhook endpoint safely acknowledges events while this is empty, and verifies signatures when configured." },
      { key: "PAYPAL_IS_PRODUCTION", label: "PayPal API mode", type: "select", tooltip: "Use sandbox until the PayPal Business app and webhook have been tested.", options: [{ value: "false", label: "Sandbox" }, { value: "true", label: "Production" }] },
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

  useEffect(() => {
    fetchCooldownHistory();
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
  const activePaymentProcessor = settings.PAYMENT_PROCESSOR || "mock";
  const visiblePaymentFieldGroups = paymentFieldGroups.filter((group) => !group.processors || group.processors.includes(activePaymentProcessor));
  const paypalSelected = activePaymentProcessor === "paypal";
  const paypalLink = String(settings.PAYPAL_BUSINESS_URL || "").trim();
  const paypalLooksPersonal = /paypal\.me\//i.test(paypalLink) || settings.PAYPAL_ACCOUNT_MODE === "personal_bridge";
  const shouldShowPayPalRisk = paypalSelected || Boolean(paypalLink) || settings.PAYPAL_ACCOUNT_MODE === "personal_bridge";
  const paypalRiskAcknowledged = settings.PAYPAL_RISK_ACKNOWLEDGED === "true";
  const paypalRiskItems = [
    { label: "Use goods/services, invoice, or business checkout. Do not ask buyers to use Friends and Family.", done: paypalRiskAcknowledged },
    { label: "Include business name, requested domain, and payment reference in every payment note.", done: Boolean(String(settings.PAYPAL_PAYMENT_NOTE || "").trim()) },
    { label: "Keep proof of delivery: demo URL, payment reference, setup messages, DNS notes, and handover confirmation.", done: paypalRiskAcknowledged },
    { label: "Use Personal only as a short bridge; upgrade to Business before regular commercial volume.", done: !paypalLooksPersonal || paypalRiskAcknowledged },
  ];

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
        <button
          type="button"
          onClick={() => toggleSettingsSection("aiProvider")}
          className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left hover:bg-slate-50"
        >
          <div>
            <h2 className="inline-flex items-center gap-1.5 text-lg font-semibold text-gray-900">
              AI Provider Credentials
              <HelpTooltip text="Expand only when editing API keys. Generation provider/model selection still happens in Leads and Sites." />
            </h2>
            <p className="mt-1 text-xs text-gray-500">{selectedProviderConfig.label} selected for credential editing.</p>
          </div>
          <ChevronDown size={18} className={`shrink-0 text-slate-500 transition ${settingsSectionOpen("aiProvider") ? "rotate-180" : ""}`} />
        </button>
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

        <div id="settings-payment" className="scroll-mt-24 bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <button
            type="button"
            onClick={() => toggleSettingsSection("payment")}
            className="flex w-full items-center justify-between gap-4 text-left"
          >
            <div>
              <h2 className="mb-2 inline-flex items-center gap-1.5 text-lg font-semibold text-gray-900">
                Payment Setup
                <HelpTooltip text="Select the checkout rail used by the public Download / Setup panel. If the selected rail is missing keys, checkout stays in mock mode and records checkout_pending for follow-up." />
              </h2>
              <p className="text-xs leading-relaxed text-gray-500">
                Active processor: {paymentProcessorOptions.find((option) => option.value === activePaymentProcessor)?.label || activePaymentProcessor}
              </p>
            </div>
            <ChevronDown size={18} className={`shrink-0 text-slate-500 transition ${settingsSectionOpen("payment") ? "rotate-180" : ""}`} />
          </button>

          {settingsSectionOpen("payment") && (
          <div className="mt-4">
          <p className="mb-4 text-xs leading-relaxed text-gray-500">
            Lemon Squeezy is kept only as legacy because its prohibited-products docs disallow web development/services. Prefer Xendit, Midtrans, or DOKU for Indonesia merchant checkout, with PayPal Business/Wise/Payoneer as fallback links.
          </p>

          <label className="block text-sm">
            <span className="mb-1 flex items-center gap-1.5 font-medium text-gray-700">
              Active payment processor
              <HelpTooltip text="This controls /api/payments/checkout. Select mock while keys are missing; switch to Xendit, Midtrans, or DOKU after account approval and sandbox testing." />
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
          <div className={`mt-4 rounded-xl border p-4 ${paypalSelected ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"}`}>
            <div className="flex items-start gap-3">
              <ShieldAlert size={20} className={paypalSelected ? "mt-0.5 shrink-0 text-amber-700" : "mt-0.5 shrink-0 text-slate-500"} />
              <div className="min-w-0 flex-1">
                <p className={`inline-flex items-center gap-1.5 text-sm font-semibold ${paypalSelected ? "text-amber-950" : "text-slate-900"}`}>
                  PayPal account-risk guardrails
                  <HelpTooltip text="PayPal Personal is risky for recurring commercial sales. The checkout adds a payment reference and note step for PayPal/manual rails, but account risk still depends on your PayPal account history, dispute rate, volume pattern, and compliance." widthClass="w-80" />
                </p>
                <p className={`mt-1 text-xs leading-relaxed ${paypalSelected ? "text-amber-900" : "text-slate-600"}`}>
                  {paypalSelected
                    ? paypalLooksPersonal
                      ? "PayPal is active and appears to be a Personal/PayPal.me bridge. Keep volume low, use goods/services, and upgrade to Business as soon as repeat sales start."
                      : "PayPal is active. Use this as a recognizable fallback rail, keep delivery records, and expect possible holds on new or unusual seller activity."
                    : "These controls are ready if you switch the active processor to PayPal."}
                </p>
                <div className="mt-3 grid gap-2">
                  {paypalRiskItems.map((item) => (
                    <div key={item.label} className="flex items-start gap-2 text-xs">
                      <CheckCircle2 size={14} className={`mt-0.5 shrink-0 ${item.done ? "text-emerald-600" : "text-slate-400"}`} />
                      <span className={paypalSelected && !item.done ? "text-amber-950" : "text-slate-600"}>{item.label}</span>
                    </div>
                  ))}
                </div>
                {paypalSelected && !paypalRiskAcknowledged && (
                  <p className="mt-3 rounded-lg border border-amber-300 bg-white/70 p-2 text-xs font-medium text-amber-950">
                    Set PayPal risk checklist to Acknowledged after you review the docs and prepare records. Checkout still works, but the buyer-facing payment step will include an admin-not-acknowledged warning.
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
                <div className="grid gap-3 sm:grid-cols-2">
                  {group.fields.map((field) => (
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
          </div>
          </div>
          )}
        </div>
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
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <RotateCcw size={16} />
              Reset weights
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

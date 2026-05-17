import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, RotateCcw, Save, SlidersHorizontal } from "lucide-react";
import { aiModelPrices, defaultInputTokens, defaultOutputTokens, estimateCostUsd, formatUsd } from "../../lib/aiPricing";
import { useLocalStorageState } from "../../lib/localStorageState";
import { clearAiReadinessCache } from "../../lib/aiReadiness";
import HelpTooltip from "../../components/HelpTooltip";
import AdminAiReadinessBadge from "../../components/AdminAiReadinessBadge";
import AdminAiReadinessRefreshButton from "../../components/AdminAiReadinessRefreshButton";
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

const initialSettings: Record<string, string> = {
  OPENROUTER_API_KEY: "",
  OPENAI_API_KEY: "",
  GEMINI_API_KEY: "",
  KIE_API_KEY: "",
  OPENCODE_API_KEY: "",
  OPENCODE_BASE_URL: "",
  GOOGLE_PLACES_API_KEY: "",
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
        <div className="grid md:grid-cols-[240px_1fr]">
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
      </div>

      <div className="grid md:grid-cols-2 gap-6 mt-6">
        <div id="settings-google-places" className="scroll-mt-24 bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 className="mb-2 inline-flex items-center gap-1.5 text-lg font-semibold text-gray-900">
            Google Places
            <HelpTooltip text="Server-side key used for Places search, details, reviews, and photo proxy calls. It should be API-restricted, not HTTP-referrer restricted." />
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            Dipakai dari Cloudflare Pages Function. Jangan gunakan HTTP referrer restriction untuk key ini; pakai API restriction ke Places API saja.
          </p>
          <input
            type="password"
            value={settings.GOOGLE_PLACES_API_KEY || ""}
            onChange={(e) => handleChange("GOOGLE_PLACES_API_KEY", e.target.value)}
            placeholder="AIzaSy..."
            className="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>

        <div id="settings-payment" className="scroll-mt-24 bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 className="mb-4 inline-flex items-center gap-1.5 text-lg font-semibold text-gray-900">
            Payment Links
            <HelpTooltip text="Used by checkout/setup flows. Lemon Squeezy settings enable real checkout; WhatsApp remains useful for mock checkout or manual setup follow-up." />
          </h2>
          <div className="space-y-4">
            <input
              type="text"
              value={settings.PAYMENT_LINK_BASIC || ""}
              onChange={(e) => handleChange("PAYMENT_LINK_BASIC", e.target.value)}
              placeholder="Basic package URL"
              className="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm"
            />
            <input
              type="text"
              value={settings.PAYMENT_LINK_PREMIUM || ""}
              onChange={(e) => handleChange("PAYMENT_LINK_PREMIUM", e.target.value)}
              placeholder="Premium package URL"
              className="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm"
            />
            <input
              type="password"
              value={settings.LEMON_SQUEEZY_API_KEY || ""}
              onChange={(e) => handleChange("LEMON_SQUEEZY_API_KEY", e.target.value)}
              placeholder="Lemon Squeezy API Key"
              className="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={settings.LEMON_SQUEEZY_STORE_ID || ""}
                onChange={(e) => handleChange("LEMON_SQUEEZY_STORE_ID", e.target.value)}
                placeholder="Store ID"
                className="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm"
              />
              <input
                type="text"
                value={settings.LEMON_SQUEEZY_VARIANT_ID || ""}
                onChange={(e) => handleChange("LEMON_SQUEEZY_VARIANT_ID", e.target.value)}
                placeholder="Variant ID"
                className="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm"
              />
            </div>
            <input
              type="text"
              value={settings.ADMIN_WHATSAPP_NUMBER || ""}
              onChange={(e) => handleChange("ADMIN_WHATSAPP_NUMBER", e.target.value)}
              placeholder="Admin WhatsApp number"
              className="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm"
            />
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={19} className="text-indigo-600" />
              <h2 className="text-lg font-semibold text-gray-900">Prospect Scoring</h2>
              <HelpTooltip text="Setting ini dipakai oleh /admin/leads untuk mengurutkan dan menyaring prospek. Angka positif menaikkan prioritas, angka negatif menurunkan prioritas." />
            </div>
            <p className="mt-1 text-sm text-gray-500">Tune prioritas prospek tanpa edit kode.</p>
          </div>
          <button
            type="button"
            onClick={resetScoringWeights}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <RotateCcw size={16} />
            Reset weights
          </button>
        </div>

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
      </div>

      <div className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col gap-1 mb-5">
          <h2 className="inline-flex items-center gap-1.5 text-lg font-semibold text-gray-900">
            Estimator Biaya AI
            <HelpTooltip text="Local estimate for one generated site JSON using the selected pricing table. Actual provider billing can differ by tokenization and provider-side rounding." />
          </h2>
          <p className="text-sm text-gray-500">
            Perkiraan biaya per generate JSON. KIE.ai ditampilkan sebagai estimasi diskon karena pricing detail live ada di dashboard KIE.
          </p>
        </div>
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
              className="w-full py-2.5"
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
          <AdminAiReadinessBadge
            provider={pricingProvider}
            model={pricingModel}
            hasApiKey={pricingProviderKeyReady}
            requiresAi
            remoteValidate
          />
        </div>
        <div className="mt-5 rounded-xl bg-slate-50 border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Total estimasi</p>
          <p className="text-3xl font-semibold text-slate-900 mt-1">{formatUsd(pricingEstimate.total)}</p>
          {pricingEstimate.price?.note && <p className="text-xs text-slate-500 mt-2">{pricingEstimate.price.note}</p>}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Save } from "lucide-react";
import { aiModelPrices, defaultInputTokens, defaultOutputTokens, estimateCostUsd, formatUsd } from "../../lib/aiPricing";

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

export default function AdminSettings() {
  const [settings, setSettings] = useState<Record<string, string>>(initialSettings);
  const [selectedProvider, setSelectedProvider] = useState<ProviderKey>("OPENROUTER");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [message, setMessage] = useState("");
  const [dirty, setDirty] = useState(false);
  const [pricingProvider, setPricingProvider] = useState("OpenRouter");
  const [pricingModel, setPricingModel] = useState("~anthropic/claude-sonnet-latest");
  const [inputTokens, setInputTokens] = useState(defaultInputTokens);
  const [outputTokens, setOutputTokens] = useState(defaultOutputTokens);

  const selectedProviderConfig = useMemo(
    () => providerOptions.find((provider) => provider.key === selectedProvider) || providerOptions[0],
    [selectedProvider],
  );

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

  const handleManualSave = () => {
    void saveSettings(settings, false);
  };

  const pricingModels = aiModelPrices.filter((item) => item.provider === pricingProvider);
  const pricingEstimate = estimateCostUsd(pricingProvider, pricingModel, inputTokens, outputTokens);

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
          <h1 className="text-3xl font-semibold text-gray-900 mb-1">Pengaturan Sistem (D1)</h1>
          <p className="text-gray-500 text-sm">Kelola API keys dan payment links yang tersimpan di Cloudflare D1.</p>
        </div>
        <button
          onClick={handleManualSave}
          disabled={saving}
          className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition flex items-center justify-center gap-2 shadow-sm"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          {saving ? "Menyimpan..." : "Simpan Sekarang"}
        </button>
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

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="grid md:grid-cols-[240px_1fr]">
          <aside className="border-b md:border-b-0 md:border-r border-gray-100 p-4 bg-gray-50">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-2 mb-3">AI Provider</p>
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
              <h2 className="text-xl font-semibold text-gray-900">{selectedProviderConfig.label}</h2>
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
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Google Places</h2>
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

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Links</h2>
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
          </div>
        </div>
      </div>

      <div className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col gap-1 mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Estimator Biaya AI</h2>
          <p className="text-sm text-gray-500">
            Perkiraan biaya per generate JSON. KIE.ai ditampilkan sebagai estimasi diskon karena pricing detail live ada di dashboard KIE.
          </p>
        </div>
        <div className="grid md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Input tokens</label>
            <input
              type="number"
              min={0}
              value={inputTokens}
              onChange={(e) => setInputTokens(Number(e.target.value) || 0)}
              className="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Output tokens</label>
            <input
              type="number"
              min={0}
              value={outputTokens}
              onChange={(e) => setOutputTokens(Number(e.target.value) || 0)}
              className="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
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

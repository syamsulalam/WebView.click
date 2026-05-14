import { useEffect, useState } from "react";
import { Save, Loader2, CheckCircle2 } from "lucide-react";

export default function AdminSettings() {
  const [settings, setSettings] = useState<Record<string, string>>({
    OPENROUTER_API_KEY: "",
    OPENAI_API_KEY: "",
    GEMINI_API_KEY: "",
    OPENCODE_API_KEY: "",
    OPENCODE_BASE_URL: "",
    GOOGLE_PLACES_API_KEY: "",
    PAYMENT_LINK_BASIC: "",
    PAYMENT_LINK_PREMIUM: ""
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then(async (r) => {
        if (!r.ok) {
          const text = await r.text();
          throw new Error(`Server error ${r.status}: ${text.substring(0, 100)}`);
        }
        return r.json();
      })
      .then(data => {
        setSettings(prev => ({ ...prev, ...data }));
        setLoading(false);
      })
      .catch(err => {
        console.error("Settings fetch error:", err);
        setLoading(false); // Stop loading even on error
      });
  }, []);

  const handleChange = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch(e) {
      console.error(e);
      alert("Gagal menyimpan settings.");
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="p-8 flex items-center justify-center">Loading settings...</div>;
  }

  return (
    <div className="p-8 max-w-4xl mx-auto font-sans">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 mb-1">Pengaturan Sistem (D1)</h1>
          <p className="text-gray-500 text-sm">Kelola API Keys yang disimpan di Database, tanpa perlu hardcode di environment.</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition flex items-center gap-2 shadow-sm"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : saved ? <CheckCircle2 size={18} /> : <Save size={18} />}
          {saving ? "Menyimpan..." : saved ? "Tersimpan" : "Simpan Perubahan"}
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden space-y-6 p-8">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-100 pb-3 mb-5">AI Generation Providers</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">OpenRouter API Key</label>
              <input 
                type="password" 
                value={settings.OPENROUTER_API_KEY || ""}
                onChange={(e) => handleChange("OPENROUTER_API_KEY", e.target.value)}
                placeholder="sk-or-v1-..."
                className="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">OpenAI API Key</label>
              <input 
                type="password" 
                value={settings.OPENAI_API_KEY || ""}
                onChange={(e) => handleChange("OPENAI_API_KEY", e.target.value)}
                placeholder="sk-proj-..."
                className="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gemini API Key</label>
              <input 
                type="password" 
                value={settings.GEMINI_API_KEY || ""}
                onChange={(e) => handleChange("GEMINI_API_KEY", e.target.value)}
                placeholder="AIzaSy..."
                className="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none" 
              />
            </div>
            <div className="flex gap-4">
               <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Opencode API Key</label>
                <input 
                  type="password" 
                  value={settings.OPENCODE_API_KEY || ""}
                  onChange={(e) => handleChange("OPENCODE_API_KEY", e.target.value)}
                  placeholder="sk-opencode-..."
                  className="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none" 
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Opencode Base URL</label>
                <input 
                  type="text" 
                  value={settings.OPENCODE_BASE_URL || ""}
                  onChange={(e) => handleChange("OPENCODE_BASE_URL", e.target.value)}
                  placeholder="https://api.opencode.example.com/v1/chat/completions"
                  className="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm" 
                />
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4">
          <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-100 pb-3 mb-5">Integrasi Eksternal</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Google Places API Key</label>
              <p className="text-xs text-gray-500 mb-2">Digunakan untuk fitur Search di CRM Leads (Scraping Data GMB).</p>
              <input 
                type="password" 
                value={settings.GOOGLE_PLACES_API_KEY || ""}
                onChange={(e) => handleChange("GOOGLE_PLACES_API_KEY", e.target.value)}
                placeholder="AIzaSy..."
                className="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none" 
              />
            </div>
          </div>
        </div>

        <div className="pt-4">
          <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-100 pb-3 mb-5">Payment Links (Klien)</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Basic Package Link</label>
              <input 
                type="text" 
                value={settings.PAYMENT_LINK_BASIC || ""}
                onChange={(e) => handleChange("PAYMENT_LINK_BASIC", e.target.value)}
                placeholder="https://paypal.me/..."
                className="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Premium Package Link</label>
              <input 
                type="text" 
                value={settings.PAYMENT_LINK_PREMIUM || ""}
                onChange={(e) => handleChange("PAYMENT_LINK_PREMIUM", e.target.value)}
                placeholder="https://lemon.squeezy.com/..."
                className="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm" 
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle } from "lucide-react";

type Language = "en" | "id";

export default function HubPage() {
  const navigate = useNavigate();
  const [lang, setLang] = useState<Language>("en");

  useEffect(() => {
    // Memori lokal: Cek jika prospek sering mengunjungi situsnya
    const savedId = localStorage.getItem("savedBusinessId");
    if (savedId) {
      navigate(`/${savedId}`);
    }
  }, [navigate]);

  const content = {
    en: {
      title: "WebView.click",
      description: "Automated Website Platform for Modern Businesses. If you have a unique ID, enter your URL directly (e.g., webview.click/businessname).",
      contactBtn: "Contact Our Team"
    },
    id: {
      title: "WebView.click",
      description: "Platform Website Otomatis untuk Bisnis Modern. Jika Anda memiliki ID unik, masukkan URL Anda secara langsung (contoh: webview.click/namabisnis).",
      contactBtn: "Hubungi Tim Kami"
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6 flex-col">
      <div className="absolute top-4 right-4 bg-white shadow-sm border border-gray-100 rounded-full p-1 flex items-center gap-1">
        <button 
          onClick={() => setLang("en")}
          className={`flex items-center justify-center w-10 h-10 rounded-full transition ${lang === "en" ? "bg-indigo-50 border border-indigo-100 shadow-inner" : "hover:bg-gray-50 grayscale opacity-60 hover:grayscale-0 hover:opacity-100"}`}
          title="English"
        >
          <span className="text-xl leading-none">🇺🇸</span>
        </button>
        <button 
          onClick={() => setLang("id")}
          className={`flex items-center justify-center w-10 h-10 rounded-full transition ${lang === "id" ? "bg-indigo-50 border border-indigo-100 shadow-inner" : "hover:bg-gray-50 grayscale opacity-60 hover:grayscale-0 hover:opacity-100"}`}
          title="Bahasa Indonesia"
        >
          <span className="text-xl leading-none">🇮🇩</span>
        </button>
      </div>

      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden p-8 text-center space-y-4">
        <h1 className="text-2xl font-bold font-sans text-gray-900">{content[lang].title}</h1>
        <p className="text-gray-500 font-sans">
          {content[lang].description}
        </p>
        <div className="pt-4">
          <a
            href="https://wa.me/6281234567890"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 font-medium text-white rounded-xl hover:bg-indigo-700 transition"
          >
            <MessageCircle size={20} />
            {content[lang].contactBtn}
          </a>
        </div>
      </div>
    </div>
  );
}

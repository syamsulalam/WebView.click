import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function HubPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // Memori lokal: Cek jika prospek sering mengunjungi situsnya
    const savedId = localStorage.getItem("savedBusinessId");
    if (savedId) {
      navigate(`/\${savedId}`);
    }
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6 flex-col">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden p-8 text-center space-y-4">
        <h1 className="text-2xl font-bold font-sans text-gray-900">WebView.click</h1>
        <p className="text-gray-500 font-sans">
          Platform Website Otomatis untuk Bisnis Modern. Jika Anda memiliki ID unik, masukkan URL Anda secara langsung (contoh: webview.click/namabisnis).
        </p>
        <div className="pt-4">
          <a
            href="https://wa.me/6281234567890"
            className="w-full inline-block px-4 py-2 bg-indigo-600 font-medium text-white rounded-lg hover:bg-indigo-700 transition"
          >
            Hubungi Tim Kami
          </a>
        </div>
      </div>
    </div>
  );
}

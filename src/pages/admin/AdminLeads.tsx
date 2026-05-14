import { useEffect, useState } from "react";
import { Search, Loader2, Camera, ExternalLink, Mail, MessageSquare } from "lucide-react";
import * as htmlToImage from "html-to-image";

export default function AdminLeads() {
  const [leads, setLeads] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const fetchLeads = () => {
    fetch("/api/leads")
      .then(r => r.json())
      .then(setLeads);
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const handleSearch = async () => {
    if (!searchQuery) return;
    setIsSearching(true);
    try {
      const res = await fetch(`/api/places/search?query=\${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch (e) {
      console.error(e);
    }
    setIsSearching(false);
  };

  const handleGenerateSite = async (place: any) => {
    setIsGenerating(true);
    
    // Simulate AI generation process with a mock JSON
    // A Real implementation would send 'place' to an OpenAI endpoint on our server
    const businessId = place.name.toLowerCase().replace(/[^a-z0-9]/g, '-') + "-" + Math.floor(Math.random() * 1000);
    const mockJson = {
      meta: {
        businessName: place.name,
        businessId: businessId,
        niche: "general",
        seoDescription: `Website resmi untuk \${place.name}.`,
      },
      design: {
        themeVariables: {
          colors: {
            primary: "#111827",
            secondary: "#F3F4F6",
            accent: "#4F46E5",
            textMain: "#1F2937",
            textMuted: "#6B7280",
            background: "#FFFFFF"
          },
          typography: {
            headingFont: "'Inter', sans-serif",
            bodyFont: "'Inter', sans-serif"
          }
        }
      },
      global: {
        header: {
          ctaButton: { text: "Hubungi WA", href: "https://wa.me/123" }
        },
        footer: { text: `© 2026 \${place.name}. All rights reserved.` }
      },
      navigation: {
        headerMenu: [
          { label: "Beranda", href: "#home" },
          { label: "Layanan", href: "#services" },
          { label: "Kontak", href: "#contact" }
        ]
      },
      pages: [
        {
          pageId: "home",
          sections: [
            {
              type: "hero",
              id: "hero-1",
              content: {
                headline: `Selamat datang di \${place.name}`,
                subheadline: place.formatted_address,
                buttons: [{ text: "Hubungi Kami", href: "#contact", style: "primary" }]
              }
            }
          ]
        }
      ]
    };

    try {
      await fetch("/api/sites/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonContent: mockJson,
          businessId,
          businessName: place.name,
          phone: "0000000000",
        })
      });
      fetchLeads();
      setSearchResults([]);
      setSearchQuery("");
    } catch (e) {
      console.error(e);
    }
    
    setIsGenerating(false);
  };

  const updateStatus = async (id: string, newStatus: string) => {
    await fetch(`/api/leads/\${id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus })
    });
    fetchLeads();
  };

  return (
    <div className="p-8 max-w-7xl mx-auto font-sans">
      <h1 className="text-3xl font-semibold mb-8 text-gray-900">CRM Leads</h1>

      {/* SEARCH SECTION */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm mb-8">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Cari Prospek Baru (Google Maps)</h2>
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Contoh: Kedai Kopi di Senopati" 
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <button 
            onClick={handleSearch}
            disabled={isSearching}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition flex items-center justify-center min-w-[120px]"
          >
            {isSearching ? <Loader2 className="animate-spin" size={20} /> : "Cari"}
          </button>
        </div>

        {searchResults.length > 0 && (
          <div className="mt-6 space-y-4">
            {searchResults.map((place, idx) => (
              <div key={idx} className="flex items-center justify-between p-4 border border-gray-100 rounded-xl bg-gray-50">
                <div>
                  <h3 className="font-semibold text-gray-900">{place.name}</h3>
                  <p className="text-sm text-gray-500">{place.formatted_address}</p>
                </div>
                <button 
                  onClick={() => handleGenerateSite(place)}
                  disabled={isGenerating}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
                >
                  Generate Site
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* LEADS TABLE */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-sm font-medium text-gray-500">
                <th className="p-4">Bisnis</th>
                <th className="p-4">Preview URL</th>
                <th className="p-4">Status & Views</th>
                <th className="p-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-gray-50 transition">
                  <td className="p-4">
                    <p className="font-medium text-gray-900">{lead.business_name}</p>
                    <p className="text-xs text-gray-500">{new Date(lead.created_at).toLocaleDateString()}</p>
                  </td>
                  <td className="p-4">
                    <a 
                      href={`/\${lead.business_id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-600 hover:text-indigo-800 text-sm flex items-center gap-1"
                    >
                      /{lead.business_id} <ExternalLink size={14} />
                    </a>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1">
                      <select 
                        value={lead.status} 
                        onChange={(e) => updateStatus(lead.id, e.target.value)}
                        className="text-sm border border-gray-300 rounded p-1 bg-white text-gray-700 w-32"
                      >
                        <option value="scraped">Scraped</option>
                        <option value="contacted">Contacted</option>
                        <option value="viewed">Viewed</option>
                        <option value="negotiating">Negotiating</option>
                        <option value="won_paid">Won (Paid)</option>
                        <option value="lost">Lost</option>
                      </select>
                      {lead.view_count > 0 && (
                        <span className="text-xs text-emerald-600 font-medium">
                          Dilihat {lead.view_count}x
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-right flex items-center justify-end gap-2">
                    {/* Instant screenshot feature (mock logic for demo) */}
                    <button className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded group relative">
                      <Camera size={18} />
                      <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-[9999] pointer-events-none">
                        Screenshot Preview
                      </span>
                    </button>
                    <a href={`mailto:\${lead.email || 'hello@example.com'}`} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded group relative">
                      <Mail size={18} />
                      <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-[9999] pointer-events-none">
                        Send Email
                      </span>
                    </a>
                    <a href={`sms:+10000000000`} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded group relative">
                      <MessageSquare size={18} />
                      <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-[9999] pointer-events-none">
                        Send SMS
                      </span>
                    </a>
                  </td>
                </tr>
              ))}
              {leads.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-500">Belum ada prospek. Gunakan fitur pencarian di atas.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

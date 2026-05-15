import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Globe2, RefreshCw, Search, Sparkles } from "lucide-react";

type SiteRow = {
  id: string;
  businessId: string;
  businessName: string;
  niche?: string;
  language?: string;
  region?: string;
  rating?: number | null;
  reviewCount?: number | null;
  createdAt?: string;
  updatedAt?: string;
  previewUrl: string;
};

export default function AdminSites() {
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const fetchSites = async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch("/api/sites");
      const text = await response.text();
      let data: unknown = [];
      try {
        data = text ? JSON.parse(text) : [];
      } catch {
        throw new Error(`Response bukan JSON: ${text.slice(0, 120)}`);
      }
      if (!response.ok) {
        throw new Error((data as { error?: string }).error || `Sites API returned ${response.status}`);
      }
      setSites(Array.isArray(data) ? (data as SiteRow[]) : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat daftar situs.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSites();
  }, []);

  const filteredSites = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return sites;
    return sites.filter((site) => [
      site.businessName,
      site.businessId,
      site.niche,
      site.language,
      site.region,
    ].filter(Boolean).join(" ").toLowerCase().includes(needle));
  }, [query, sites]);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Generated Sites</p>
          <h1 className="mt-2 text-3xl font-bold text-gray-900">Situs yang berhasil dibuat</h1>
          <p className="mt-2 text-gray-500">Daftar ini membaca semua JSON website yang tersimpan di D1.</p>
        </div>
        <button
          type="button"
          onClick={fetchSites}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
        >
          <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="mb-5 flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <Search size={18} className="text-gray-400" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cari nama bisnis, slug, niche, bahasa..."
          className="w-full bg-transparent text-sm outline-none"
        />
      </div>

      {error && (
        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="grid grid-cols-[1.4fr_1fr_0.6fr_0.8fr_0.8fr] gap-4 border-b border-gray-100 bg-gray-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <span>Business</span>
          <span>Slug</span>
          <span>Locale</span>
          <span>Updated</span>
          <span className="text-right">Actions</span>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-3 px-5 py-10 text-sm text-gray-500">
            <RefreshCw size={18} className="animate-spin" />
            Memuat daftar situs...
          </div>
        ) : filteredSites.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <Sparkles size={28} className="mx-auto text-gray-300" />
            <p className="mt-3 font-semibold text-gray-800">Belum ada situs yang cocok.</p>
            <p className="mt-1 text-sm text-gray-500">Generate dari CRM Leads, lalu refresh halaman ini.</p>
          </div>
        ) : (
          filteredSites.map((site) => (
            <div key={site.businessId} className="grid grid-cols-[1.4fr_1fr_0.6fr_0.8fr_0.8fr] items-center gap-4 border-b border-gray-100 px-5 py-4 text-sm last:border-b-0">
              <div className="min-w-0">
                <p className="truncate font-semibold text-gray-900">{site.businessName}</p>
                <p className="mt-1 truncate text-xs text-gray-500">{site.niche || "No niche"}{site.rating ? ` · ${site.rating.toFixed(1)} rating` : ""}{site.reviewCount ? ` · ${site.reviewCount} reviews` : ""}</p>
              </div>
              <code className="truncate rounded-lg bg-gray-50 px-2 py-1 text-xs text-gray-600">{site.businessId}</code>
              <span className="text-gray-600">{[site.language, site.region].filter(Boolean).join("-") || "-"}</span>
              <span className="text-xs text-gray-500">{site.updatedAt ? new Date(site.updatedAt).toLocaleString() : "-"}</span>
              <div className="flex justify-end gap-2">
                <a
                  href={site.previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                >
                  <Globe2 size={14} />
                  Preview
                </a>
                <a
                  href={site.previewUrl}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  <ExternalLink size={14} />
                  Open
                </a>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

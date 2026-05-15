import { useEffect, useMemo, useState } from "react";
import { Brain, ChevronDown, Database, Globe2, MapPin, RefreshCw, RotateCw, Search, Sparkles, X } from "lucide-react";
import { aiModelPrices } from "../../lib/aiPricing";
import { useLocalStorageState } from "../../lib/localStorageState";

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
  googleMapsUrl?: string;
};

type RegenerateMode = "resave" | "ai";

function gatheredSnapshot(siteData: any) {
  return {
    sourceData: siteData?.sourceData || {},
    businessProfile: siteData?.businessProfile || {},
    location: siteData?.location || {},
    hours: siteData?.hours || {},
    trust: siteData?.trust || {},
    brand: siteData?.brand || {},
    productServiceStrategy: siteData?.productServiceStrategy || {},
    products: Array.isArray(siteData?.products) ? siteData.products : [],
    services: Array.isArray(siteData?.services) ? siteData.services : [],
  };
}

export default function AdminSites() {
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [activeData, setActiveData] = useState<{ site: SiteRow; data: any } | null>(null);
  const [actionMessage, setActionMessage] = useState("");
  const [regeneratingId, setRegeneratingId] = useState("");
  const [openRegenerateMenu, setOpenRegenerateMenu] = useState("");
  const [regenerateProvider, setRegenerateProvider] = useLocalStorageState("webview.adminSites.regenerateProvider", "OpenRouter");
  const [regenerateModel, setRegenerateModel] = useLocalStorageState("webview.adminSites.regenerateModel", "~anthropic/claude-sonnet-latest");

  const providerOptions = useMemo<string[]>(() => Array.from(new Set(aiModelPrices.map((item) => item.provider))), []);
  const activeRegenerateProvider = providerOptions.includes(regenerateProvider) ? regenerateProvider : "OpenRouter";
  const regenerateModels = aiModelPrices.filter((item) => item.provider === activeRegenerateProvider);
  const activeRegenerateModel = regenerateModels.some((item) => item.model === regenerateModel)
    ? regenerateModel
    : regenerateModels[0]?.model || "";
  const activeRegenerateModelLabel = regenerateModels.find((item) => item.model === activeRegenerateModel)?.label || activeRegenerateModel;

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

  useEffect(() => {
    if (activeRegenerateProvider !== regenerateProvider) {
      setRegenerateProvider(activeRegenerateProvider);
      return;
    }
    if (regenerateModels.length > 0 && !regenerateModels.some((item) => item.model === regenerateModel)) {
      setRegenerateModel(regenerateModels[0].model);
    }
  }, [activeRegenerateProvider, regenerateProvider, regenerateModel, regenerateModels, setRegenerateProvider, setRegenerateModel]);

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

  const fetchSiteJson = async (site: SiteRow) => {
    const response = await fetch(`/api/sites/${encodeURIComponent(site.businessId)}`);
    const text = await response.text();
    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`Response bukan JSON: ${text.slice(0, 120)}`);
    }
    if (!response.ok || data.error) {
      throw new Error(data.error || `Site JSON returned ${response.status}`);
    }
    return data;
  };

  const handleSeeGatheredData = async (site: SiteRow) => {
    setActionMessage("");
    try {
      const siteJson = await fetchSiteJson(site);
      setActiveData({ site, data: gatheredSnapshot(siteJson) });
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Gagal memuat gathered data.");
    }
  };

  const handleRegenerate = async (site: SiteRow, mode: RegenerateMode) => {
    setRegeneratingId(site.businessId);
    setActionMessage("");
    try {
      const siteJson = await fetchSiteJson(site);
      const sourceData = siteJson?.sourceData || {};
      let originData: any = {
        name: site.businessName,
        place_id: sourceData.placeId || "",
        url: sourceData.googleMapsUri || site.googleMapsUrl || "",
        website: sourceData.websiteUri || "",
        rating: site.rating || undefined,
        user_ratings_total: site.reviewCount || undefined,
      };
      let detailsGathered = false;
      let detailsError = "";

      if (sourceData.placeId) {
        const detailsResponse = await fetch(`/api/places/details?placeId=${encodeURIComponent(sourceData.placeId)}`);
        const detailsText = await detailsResponse.text();
        let details: any = {};
        try {
          details = detailsText ? JSON.parse(detailsText) : {};
        } catch {
          details = { error: `Place Details response bukan JSON: ${detailsText.slice(0, 120)}` };
        }
        if (detailsResponse.ok && details.result) {
          originData = { ...originData, ...details.result };
          detailsGathered = true;
        } else {
          detailsError = details.error || `Place Details returned HTTP ${detailsResponse.status}`;
        }
      }

      if (mode === "resave" && !sourceData.placeId) {
        throw new Error("Site lama ini belum punya sourceData.placeId, jadi Google Places tidak bisa di-gather ulang.");
      }
      if (mode === "resave" && !detailsGathered) {
        throw new Error(detailsError || "Google Places details belum berhasil di-gather ulang.");
      }

      const contact = siteJson?.businessProfile?.contact || {};
      const provider = mode === "ai" ? activeRegenerateProvider : "";
      const model = mode === "ai" ? activeRegenerateModel : "";
      const response = await fetch("/api/sites/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          model,
          jsonContent: siteJson,
          businessId: site.businessId,
          businessName: site.businessName,
          phone: contact.phoneInternational || contact.phoneNational || "",
          originData,
          brandPalette: siteJson?.meta?.brandPalette || siteJson?.brand?.palette || [],
          selectedLogoImageUrl: siteJson?.brand?.logoImageUrl || "",
          selectedLogoReference: siteJson?.brand?.googlePhotoReference || "",
          selectedLogoSource: siteJson?.brand?.photoSource || "",
          selectedLogoAttributions: siteJson?.brand?.photoAttributions || [],
          selectedLogoPriority: siteJson?.brand?.selectedPhotoPriority || "",
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.error) {
        throw new Error(result.error || `Regenerate failed with HTTP ${response.status}`);
      }
      setActionMessage(
        mode === "ai"
          ? `AI regenerated ${site.businessName} with ${activeRegenerateProvider} / ${activeRegenerateModelLabel}.`
          : `Re-gathered Google data and resaved ${site.businessName} without an AI call.`
      );
      fetchSites();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Regenerate gagal.");
    } finally {
      setRegeneratingId("");
    }
  };

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
      {actionMessage && (
        <div className="mb-5 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-800">
          {actionMessage}
        </div>
      )}

      <div className="overflow-visible rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="grid grid-cols-[1.3fr_0.9fr_0.5fr_0.8fr_1.5fr] gap-4 border-b border-gray-100 bg-gray-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
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
            <div key={site.businessId} className="grid grid-cols-[1.3fr_0.9fr_0.5fr_0.8fr_1.5fr] items-center gap-4 border-b border-gray-100 px-5 py-4 text-sm last:border-b-0">
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
                {site.googleMapsUrl && (
                  <a
                    href={site.googleMapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    <MapPin size={14} />
                    Maps
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => handleSeeGatheredData(site)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  <Database size={14} />
                  Data
                </button>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setOpenRegenerateMenu(openRegenerateMenu === site.businessId ? "" : site.businessId)}
                    disabled={Boolean(regeneratingId)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <RotateCw size={14} className={regeneratingId === site.businessId ? "animate-spin" : ""} />
                    Regen
                    <ChevronDown size={14} />
                  </button>
                  {openRegenerateMenu === site.businessId && (
                    <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-2xl border border-gray-200 bg-white p-3 text-left shadow-xl">
                      <div className="mb-3">
                        <p className="text-xs font-semibold text-gray-900">Regenerate option</p>
                        <p className="mt-1 text-[11px] leading-4 text-gray-500">Re-gather fixes stale Google data like fallback Maps URLs. AI regenerate rebuilds the JSON with a smarter model.</p>
                      </div>

                      <div className="mb-3 grid grid-cols-1 gap-2">
                        <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                          Provider
                          <select
                            value={activeRegenerateProvider}
                            onChange={(event) => {
                              const nextProvider = event.target.value;
                              const firstModel = aiModelPrices.find((item) => item.provider === nextProvider)?.model || "";
                              setRegenerateProvider(nextProvider);
                              setRegenerateModel(firstModel);
                            }}
                            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold normal-case tracking-normal text-gray-800 outline-none focus:border-indigo-400"
                          >
                            {providerOptions.map((provider) => (
                              <option key={provider} value={provider}>{provider}</option>
                            ))}
                          </select>
                        </label>
                        <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                          Model
                          <select
                            value={activeRegenerateModel}
                            onChange={(event) => setRegenerateModel(event.target.value)}
                            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold normal-case tracking-normal text-gray-800 outline-none focus:border-indigo-400"
                          >
                            {regenerateModels.map((model) => (
                              <option key={model.model} value={model.model}>{model.label}</option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <div className="grid grid-cols-1 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setOpenRegenerateMenu("");
                            handleRegenerate(site, "ai");
                          }}
                          disabled={!activeRegenerateModel || Boolean(regeneratingId)}
                          className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                          <Brain size={14} />
                          AI regenerate with selected model
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenRegenerateMenu("");
                            handleRegenerate(site, "resave");
                          }}
                          disabled={Boolean(regeneratingId)}
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          <RotateCw size={14} />
                          Re-gather Google data + resave
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {activeData && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[86vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-gray-900">Gathered data</p>
                <p className="text-xs text-gray-500">{activeData.site.businessName} · {activeData.site.businessId}</p>
              </div>
              <button type="button" onClick={() => setActiveData(null)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>
            <pre className="max-h-[70vh] overflow-auto bg-slate-950 p-5 text-xs leading-relaxed text-slate-100">
              {JSON.stringify(activeData.data, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

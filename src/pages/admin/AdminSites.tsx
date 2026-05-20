import { useEffect, useMemo, useState } from "react";
import { Brain, ChevronDown, Database, FileText, Globe2, MapPin, Play, RefreshCw, RotateCw, Search, Sparkles, X } from "lucide-react";
import { aiModelPrices } from "../../lib/aiPricing";
import { useLocalStorageState } from "../../lib/localStorageState";
import { readApiJson } from "../../lib/apiResponse";
import { isPlaceholderPhone } from "../../lib/generatedSiteScaffold";
import {
  buildScaffoldGeneratePayload,
  ensureAiGenerationReady,
  fetchGooglePlaceDetails,
  isAdminGenerationBlockedError,
  mapsQueryPlaceId,
  mapsQueryPlaceholder,
  postGenerateSite,
  resolveLeadGeneratePhotoSelection,
} from "../../lib/adminSiteGeneration";
import HelpTooltip from "../../components/HelpTooltip";
import HoverTooltip from "../../components/HoverTooltip";
import AdminAiReadinessBadge from "../../components/AdminAiReadinessBadge";
import AdminAiReadinessRefreshButton from "../../components/AdminAiReadinessRefreshButton";
import { useAdminToast } from "../../components/AdminToast";
import AdminProviderCooldownBadge from "../../components/AdminProviderCooldownBadge";
import { formatCooldownRemaining } from "../../lib/providerCooldown";

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
  r2JsonUrl?: string;
  storageMode?: "r2" | "legacy_d1";
  generatedWithAi?: boolean;
  generationMode?: string;
  aiProvider?: string;
  aiModel?: string;
};

type RegenerateMode = "resave" | "ai";

function generationBadge(site: SiteRow) {
  if (site.generationMode === "ai_copy_patch" || site.generatedWithAi) {
    return {
      label: "AI Copy Patch",
      title: `Copy was enriched by AI${site.aiProvider ? ` via ${site.aiProvider}` : ""}${site.aiModel ? ` / ${site.aiModel}` : ""}. Structure and protected fields stayed deterministic.`,
      className: "bg-indigo-100 text-indigo-800",
    };
  }
  if (site.generationMode === "google_places_fallback" || site.generationMode === "submitted_json_ai_fallback") {
    return {
      label: "Fallback Only",
      title: "Site was built from gathered Google data/scaffold without a successful AI copy patch.",
      className: "bg-slate-100 text-slate-700",
    };
  }
  return {
    label: site.generationMode || "Unknown Mode",
    title: "Generation mode metadata is missing or from an older site row.",
    className: "bg-amber-100 text-amber-800",
  };
}

const providerApiKeyMap: Record<string, string> = {
  OpenRouter: "OPENROUTER_API_KEY",
  OpenAI: "OPENAI_API_KEY",
  Gemini: "GEMINI_API_KEY",
  KIE: "KIE_API_KEY",
  Opencode: "OPENCODE_API_KEY",
};

type ProspectRow = {
  place_id: string;
  name: string;
  formatted_address?: string;
  formattedAddress?: string;
  formatted_phone_number?: string;
  international_phone_number?: string;
  nationalPhoneNumber?: string;
  website?: string;
  websiteUri?: string;
  url?: string;
  googleMapsUri?: string;
  rating?: number | null;
  user_ratings_total?: number | null;
  userRatingCount?: number | null;
  types?: string[];
  photos?: any[];
  selectedPhoto?: {
    url?: string;
    reference?: string;
    attributions?: string[];
    priorityLabel?: string;
    source?: string;
  };
  selectedPalette?: string[];
  paletteOptions?: any[];
  updatedAt?: string;
  detailsLoadedAt?: string;
  generatedBusinessId?: string;
};

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

function prospectPhone(prospect: ProspectRow) {
  const phone = prospect.formatted_phone_number || prospect.international_phone_number || prospect.nationalPhoneNumber || "";
  return isPlaceholderPhone(phone) ? "" : phone;
}

function isMapsQueryPlaceholder(prospect: ProspectRow) {
  return mapsQueryPlaceholder(prospect);
}

export default function AdminSites() {
  const { showApiError, showToast } = useAdminToast();
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [gatheredProspects, setGatheredProspects] = useState<ProspectRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [activeData, setActiveData] = useState<{ title: string; subtitle: string; data: any } | null>(null);
  const [regeneratingId, setRegeneratingId] = useState("");
  const [generatingProspectId, setGeneratingProspectId] = useState("");
  const [openRegenerateMenu, setOpenRegenerateMenu] = useState("");
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [regenerateProvider, setRegenerateProvider] = useLocalStorageState("webview.adminSites.regenerateProvider", "OpenRouter");
  const [regenerateModel, setRegenerateModel] = useLocalStorageState("webview.adminSites.regenerateModel", "~anthropic/claude-sonnet-latest");
  const notifyAction = (
    kind: "success" | "error" | "warning" | "info",
    title: string,
    message?: string,
    actions?: string[],
  ) => {
    showToast({ kind, title, message, actions });
  };

  const providerOptions = useMemo<string[]>(() => Array.from(new Set(aiModelPrices.map((item) => item.provider))), []);
  const activeRegenerateProvider = providerOptions.includes(regenerateProvider) ? regenerateProvider : "OpenRouter";
  const regenerateModels = aiModelPrices.filter((item) => item.provider === activeRegenerateProvider);
  const activeRegenerateModel = regenerateModels.some((item) => item.model === regenerateModel)
    ? regenerateModel
    : regenerateModels[0]?.model || "";
  const activeRegenerateModelLabel = regenerateModels.find((item) => item.model === activeRegenerateModel)?.label || activeRegenerateModel;
  const providerKeyStatus = Object.keys(providerApiKeyMap).reduce<Record<string, boolean | null>>((acc, provider) => {
    const key = providerApiKeyMap[provider];
    acc[provider] = settingsLoaded ? Boolean(String(settings?.[key] || "").trim()) : null;
    return acc;
  }, {});
  const activeRegenerateKeyReady = providerKeyStatus[activeRegenerateProvider] ?? null;

  const fetchSites = async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch("/api/sites");
      const data = await readApiJson<unknown>(response, "Sites API");
      setSites(Array.isArray(data) ? (data as SiteRow[]) : []);

      const prospectResponse = await fetch("/api/prospects?status=details_loaded");
      const prospectData = await readApiJson<unknown>(prospectResponse, "Prospects API");
      setGatheredProspects(Array.isArray(prospectData)
        ? (prospectData as ProspectRow[]).filter((item) => item.place_id && !item.generatedBusinessId)
        : []);

      const settingsResponse = await fetch("/api/settings");
      if (settingsResponse.ok) {
        const settingsData = await settingsResponse.json().catch(() => ({}));
        setSettings(settingsData && typeof settingsData === "object" ? settingsData : {});
      }
      setSettingsLoaded(true);
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

  const filteredGatheredProspects = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return gatheredProspects;
    return gatheredProspects.filter((prospect) => [
      prospect.name,
      prospect.place_id,
      prospect.formatted_address,
      prospect.formattedAddress,
      Array.isArray(prospect.types) ? prospect.types.join(" ") : "",
    ].filter(Boolean).join(" ").toLowerCase().includes(needle));
  }, [gatheredProspects, query]);

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
    try {
      const siteJson = await fetchSiteJson(site);
      setActiveData({ title: "Gathered data", subtitle: `${site.businessName} · ${site.businessId}`, data: gatheredSnapshot(siteJson) });
    } catch (err) {
      showApiError(err, { source: "Gathered data" });
    }
  };

  const handleSeeCopyBrief = async (site: SiteRow) => {
    try {
      const response = await fetch(`/api/sites/${encodeURIComponent(site.businessId)}/copy-brief`);
      const text = await response.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(`Response bukan JSON: ${text.slice(0, 120)}`);
      }
      if (!response.ok || data.error) {
        throw new Error(data.error || `Copy brief returned ${response.status}`);
      }
      setActiveData({ title: "AI copy brief", subtitle: `${site.businessName} · ${site.businessId}`, data });
    } catch (err) {
      showApiError(err, { source: "AI copy brief" });
    }
  };

  const handleSeeProspectData = (prospect: ProspectRow) => {
    setActiveData({
      title: "Gathered prospect data",
      subtitle: `${prospect.name} · ${prospect.place_id}`,
      data: {
        googlePlace: prospect,
        selectedPhoto: prospect.selectedPhoto || {},
        selectedPalette: prospect.selectedPalette || [],
        paletteOptions: prospect.paletteOptions || [],
      },
    });
  };

  const handleGenerateProspect = async (prospect: ProspectRow) => {
    const placeId = prospect.place_id;
    setGeneratingProspectId(placeId);
    try {
      await ensureAiGenerationReady({
        provider: activeRegenerateProvider,
        model: activeRegenerateModel,
        action: "sites_first_generate",
        businessName: prospect.name,
        placeId,
        readinessMessage: "AI provider/model is not ready. Check /admin/settings before generating.",
        cooldownMessage: (cooldown) => `${activeRegenerateProvider} is cooling down for ${formatCooldownRemaining(cooldown)} after a quota/rate-limit error.`,
      });
      if (isMapsQueryPlaceholder(prospect)) {
        throw new Error("This row is a Maps search/query placeholder, not a specific business listing. Import captured listing JSON or choose a real Google business result before generating.");
      }

      let originData: any = { ...prospect };
      originData = { ...originData, ...await fetchGooglePlaceDetails(placeId) };

      const paletteOptions = Array.isArray(prospect.paletteOptions) ? prospect.paletteOptions : [];
      const selectedPalette = Array.isArray(prospect.selectedPalette) && prospect.selectedPalette.length > 0
        ? prospect.selectedPalette
        : Array.isArray(paletteOptions[0]?.colors) ? paletteOptions[0].colors : [];
      const selectedPhoto = prospect.selectedPhoto || {};
      const selectedPhotoSelection = selectedPhoto.url || selectedPhoto.reference
        ? {
            url: selectedPhoto.url || "",
            reference: selectedPhoto.reference || "",
            palette: selectedPalette,
            attributions: Array.isArray(selectedPhoto.attributions) ? selectedPhoto.attributions : [],
            priorityLabel: selectedPhoto.priorityLabel || "",
            source: selectedPhoto.source || "google_places",
          }
        : undefined;
      const selection = resolveLeadGeneratePhotoSelection({
        place: { ...originData, paletteOptions },
        placeKey: placeId,
        logoSelections: selectedPhotoSelection ? { [placeId]: selectedPhotoSelection } : {},
        paletteOptionsByPlace: { [placeId]: paletteOptions },
        selectedPalette,
        photoMaxWidth: 960,
      });
      const payload = buildScaffoldGeneratePayload({
        place: originData,
        requireAi: true,
        provider: activeRegenerateProvider,
        model: activeRegenerateModel,
        businessName: prospect.name || originData.name || "Untitled Business",
        phone: prospectPhone({ ...prospect, ...originData }),
        imageUrl: selection.selectedImageUrl,
        palette: selection.brandPalette,
        paletteOptions: selection.paletteOptions,
        selectedPhotoReference: selection.selectedReference,
        selectedPhotoSource: selection.selectedPhotoSource,
        selectedPhotoAttributions: selection.selectedAttributions,
        selectedPhotoPriority: selection.selectedPhotoPriority,
        searchQuery: (prospect as ProspectRow & { query?: string }).query || "",
      });
      await postGenerateSite(payload, "Generate site");
      const requiredKey = providerApiKeyMap[activeRegenerateProvider];
      const hasProviderKey = requiredKey && String(settings?.[requiredKey] || "").trim();
      notifyAction(
        hasProviderKey ? "success" : "warning",
        hasProviderKey ? "Site generated" : "AI key needed",
        hasProviderKey
          ? `Generated ${prospect.name} with AI-enriched copy from ${activeRegenerateProvider}.`
          : `AI generation needs a ${activeRegenerateProvider} API key in /admin/settings.`,
      );
      fetchSites();
    } catch (err) {
      if (isAdminGenerationBlockedError(err) && err.kind === "cooldown") {
        showToast({ kind: "warning", title: err.title || `${activeRegenerateProvider} cooldown active`, message: err.message, actions: err.actions });
      } else {
        showApiError(err, { source: "Generate site", provider: activeRegenerateProvider, model: activeRegenerateModel });
      }
    } finally {
      setGeneratingProspectId("");
    }
  };

  const handleRegenerate = async (site: SiteRow, mode: RegenerateMode) => {
    setRegeneratingId(site.businessId);
    try {
      if (mode === "ai") {
        await ensureAiGenerationReady({
          provider: activeRegenerateProvider,
          model: activeRegenerateModel,
          action: "sites_ai_regenerate",
          businessId: site.businessId,
          businessName: site.businessName,
          readinessMessage: "AI provider/model is not ready. Check /admin/settings before regenerating.",
          cooldownMessage: (cooldown) => `${activeRegenerateProvider} is cooling down for ${formatCooldownRemaining(cooldown)} after a quota/rate-limit error.`,
        });
      }

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
      const sourcePlaceId = String(sourceData.placeId || "");

      if (sourcePlaceId && !mapsQueryPlaceId(sourcePlaceId)) {
        try {
          originData = { ...originData, ...await fetchGooglePlaceDetails(sourcePlaceId) };
          detailsGathered = true;
        } catch (err) {
          detailsError = err instanceof Error ? err.message : "Place Details failed.";
        }
      } else if (sourcePlaceId) {
        detailsError = "Saved sourceData.placeId is a Maps search/query placeholder, not a specific business listing.";
      }

      if (mode === "resave" && !sourcePlaceId) {
        throw new Error("Site lama ini belum punya sourceData.placeId, jadi Google Places tidak bisa di-gather ulang.");
      }
      if (mode === "resave" && !detailsGathered) {
        throw new Error(detailsError || "Google Places details belum berhasil di-gather ulang.");
      }

      const contact = siteJson?.businessProfile?.contact || {};
      const provider = mode === "ai" ? activeRegenerateProvider : "";
      const model = mode === "ai" ? activeRegenerateModel : "";
      await postGenerateSite({
        requireAi: mode === "ai",
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
      });
      const successMessage =
        mode === "ai"
          ? `AI copy patch regenerated ${site.businessName} with ${activeRegenerateProvider} / ${activeRegenerateModelLabel}.`
          : `Re-gathered Google data and resaved ${site.businessName} without an AI call.`;
      notifyAction(
        "success",
        mode === "ai" ? "AI copy patch regenerated" : "Google data resaved",
        successMessage,
      );
      fetchSites();
    } catch (err) {
      if (isAdminGenerationBlockedError(err) && err.kind === "cooldown") {
        showToast({ kind: "warning", title: err.title || `${activeRegenerateProvider} cooldown active`, message: err.message, actions: err.actions });
      } else {
        showApiError(err, { source: mode === "ai" ? "AI regenerate" : "Re-gather/resave", provider: activeRegenerateProvider, model: activeRegenerateModel });
      }
    } finally {
      setRegeneratingId("");
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-indigo-600">
            Generated Sites
            <HelpTooltip text="Saved site JSON manifests and gathered prospects ready to generate. Use this page to preview, inspect data, and regenerate without returning to search." />
          </p>
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
      <div className="mb-6 overflow-visible rounded-2xl border border-emerald-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-emerald-100 bg-emerald-50 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-900">
              Ready to Generate
              <HelpTooltip text="Prospects already have gathered Place Details but no saved generated site yet. The provider/model selectors apply to the Generate buttons in this section." />
            </p>
            <p className="text-xs text-emerald-700">Prospect yang sudah gather data tapi belum dibuatkan site.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-4">
            <select
              value={activeRegenerateProvider}
              onChange={(event) => {
                const nextProvider = event.target.value;
                const firstModel = aiModelPrices.find((item) => item.provider === nextProvider)?.model || "";
                setRegenerateProvider(nextProvider);
                setRegenerateModel(firstModel);
              }}
              className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 outline-none focus:border-emerald-400"
            >
              {providerOptions.map((provider) => (
                <option key={provider} value={provider}>{provider}</option>
              ))}
            </select>
            <select
              value={activeRegenerateModel}
              onChange={(event) => setRegenerateModel(event.target.value)}
              className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 outline-none focus:border-emerald-400"
            >
              {regenerateModels.map((model) => (
                <option key={model.model} value={model.model}>{model.label}</option>
              ))}
            </select>
            <AdminAiReadinessRefreshButton
              className="border-emerald-200 py-2"
              onRefresh={() => notifyAction(
                "info",
                "AI readiness refreshed",
                "AI readiness cache cleared. Badges are rechecking the selected provider/model.",
              )}
            />
            <AdminProviderCooldownBadge provider={activeRegenerateProvider} className="justify-center rounded-lg py-2" />
          </div>
        </div>

        <div className="grid grid-cols-[1.25fr_0.75fr_0.55fr_0.7fr_1.75fr] gap-4 border-b border-gray-100 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <span>Business</span>
          <span>Place ID</span>
          <span>Rating</span>
          <span>Gathered</span>
          <span className="inline-flex items-center justify-end gap-1.5 text-right">
            Actions
            <HelpTooltip text="Maps opens the original listing, Data inspects gathered Google data, and Generate creates the first site from the selected provider/model." />
          </span>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-3 px-5 py-8 text-sm text-gray-500">
            <RefreshCw size={18} className="animate-spin" />
            Memuat gathered prospects...
          </div>
        ) : filteredGatheredProspects.length === 0 ? (
          <div className="px-5 py-8 text-sm text-gray-500">
            Belum ada prospect gathered yang menunggu generate.
          </div>
        ) : (
          filteredGatheredProspects.map((prospect) => {
            const mapsQueryPlaceholder = isMapsQueryPlaceholder(prospect);
            return (
            <div key={prospect.place_id} className="grid grid-cols-[1.25fr_0.75fr_0.55fr_0.7fr_1.75fr] items-center gap-4 border-b border-gray-100 px-5 py-4 text-sm last:border-b-0">
              <div className="min-w-0">
                <p className="truncate font-semibold text-gray-900">{prospect.name}</p>
                <p className="mt-1 truncate text-xs text-gray-500">
                  {mapsQueryPlaceholder
                    ? "Maps search/query placeholder. Import captured listing JSON before generating."
                    : prospect.formatted_address || prospect.formattedAddress || "No address"}
                </p>
              </div>
              <code className="truncate rounded-lg bg-gray-50 px-2 py-1 text-xs text-gray-600">{prospect.place_id}</code>
              <span className="text-xs text-gray-600">
                {Number(prospect.rating || 0).toFixed(1)} / {Number(prospect.user_ratings_total || prospect.userRatingCount || 0)}
              </span>
              <span className="text-xs text-gray-500">{prospect.detailsLoadedAt ? new Date(prospect.detailsLoadedAt).toLocaleString() : "-"}</span>
              <div className="flex justify-end gap-2">
                {(prospect.url || prospect.googleMapsUri) && (
                  <a
                    href={prospect.url || prospect.googleMapsUri}
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
                  onClick={() => handleSeeProspectData(prospect)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  <Database size={14} />
                  Data
                </button>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <HoverTooltip text={mapsQueryPlaceholder ? "This is not a specific business listing yet." : ""}>
                    <button
                      type="button"
                      onClick={() => handleGenerateProspect(prospect)}
                      disabled={!activeRegenerateModel || mapsQueryPlaceholder || Boolean(generatingProspectId || regeneratingId)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {generatingProspectId === prospect.place_id ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
                      Generate
                    </button>
                  </HoverTooltip>
                  <AdminAiReadinessBadge
                    provider={activeRegenerateProvider}
                    model={activeRegenerateModel}
                    hasApiKey={activeRegenerateKeyReady}
                    requiresAi
                    remoteValidate
                  />
                </div>
              </div>
            </div>
            );
          })
        )}
      </div>

      <div className="overflow-visible rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="grid grid-cols-[1.3fr_0.9fr_0.5fr_0.8fr_1.5fr] gap-4 border-b border-gray-100 bg-gray-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <span>Business</span>
          <span>Slug</span>
          <span>Locale</span>
          <span>Updated</span>
          <span className="inline-flex items-center justify-end gap-1.5 text-right">
            Actions
            <HelpTooltip text="Preview opens the public site, Data shows saved JSON source data, Brief shows copy-only input, and Regen lets you refresh Google data or run an AI copy patch." />
          </span>
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
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  <span className="truncate">{site.niche || "No niche"}{site.rating ? ` · ${site.rating.toFixed(1)} rating` : ""}{site.reviewCount ? ` · ${site.reviewCount} reviews` : ""}</span>
                  <HoverTooltip text={site.storageMode === "r2" ? site.r2JsonUrl || "Full JSON is stored in R2." : "Full JSON is still stored in D1. Run migration from /admin/schema."}>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        site.storageMode === "r2"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {site.storageMode === "r2" ? "R2 JSON" : "Legacy D1 JSON"}
                    </span>
                  </HoverTooltip>
                  {(() => {
                    const badge = generationBadge(site);
                    return (
                      <HoverTooltip text={badge.title}>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </HoverTooltip>
                    );
                  })()}
                </div>
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
                <button
                  type="button"
                  onClick={() => handleSeeCopyBrief(site)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  <FileText size={14} />
                  Brief
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
                        <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-900">
                          Regenerate option
                          <HelpTooltip text="AI regenerate keeps protected site structure and asks AI for copy improvements. Re-gather refreshes Google data and resaves without an AI call." />
                        </p>
                        <p className="mt-1 text-[11px] leading-4 text-gray-500">Re-gather fixes stale Google data like fallback Maps URLs. AI regenerate only requests a copy patch; protected structure stays deterministic.</p>
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
                        <AdminAiReadinessRefreshButton
                          onRefresh={() => notifyAction(
                            "info",
                            "AI readiness refreshed",
                            "AI readiness cache cleared. Badges are rechecking the selected provider/model.",
                          )}
                        />
                        <AdminProviderCooldownBadge provider={activeRegenerateProvider} />
                      </div>

                      <div className="grid grid-cols-1 gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setOpenRegenerateMenu("");
                              handleRegenerate(site, "ai");
                            }}
                            disabled={!activeRegenerateModel || Boolean(regeneratingId)}
                            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                          >
                            <Brain size={14} />
                            AI regenerate with selected model
                          </button>
                          <AdminAiReadinessBadge
                            provider={activeRegenerateProvider}
                            model={activeRegenerateModel}
                            hasApiKey={activeRegenerateKeyReady}
                            requiresAi
                            remoteValidate
                          />
                          <AdminProviderCooldownBadge provider={activeRegenerateProvider} compact />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setOpenRegenerateMenu("");
                              handleRegenerate(site, "resave");
                            }}
                            disabled={Boolean(regeneratingId)}
                            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                          >
                            <RotateCw size={14} />
                            Re-gather Google data + resave
                          </button>
                          <AdminAiReadinessBadge
                            provider={activeRegenerateProvider}
                            model={activeRegenerateModel}
                            hasApiKey={activeRegenerateKeyReady}
                            requiresAi={false}
                          />
                        </div>
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
                <p className="text-sm font-semibold text-gray-900">{activeData.title}</p>
                <p className="text-xs text-gray-500">{activeData.subtitle}</p>
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

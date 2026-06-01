import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { defaultOutputTokens, estimateCostUsd, estimateTokensFromText, formatUsd } from "../../lib/aiPricing";
import { useLocalStorageState } from "../../lib/localStorageState";
import { placeMapsUrl } from "../../lib/generatedSiteScaffold";
import {
  googlePlacePhotoUrlForPhoto,
  mapsQueryPlaceholder,
  photoPriorityLabel,
  sortedPhotosForPlace,
} from "../../lib/adminSiteGeneration";
import HelpTooltip from "../../components/HelpTooltip";
import HoverTooltip from "../../components/HoverTooltip";
import GenerationJobsTable from "../../components/GenerationJobsTable";
import AdminWorkspaceTabs from "../../components/AdminWorkspaceTabs";
import AdminAiReadinessRefreshButton from "../../components/AdminAiReadinessRefreshButton";
import { useAdminToast } from "../../components/AdminToast";
import AdminProviderCooldownBadge from "../../components/AdminProviderCooldownBadge";
import BatchGenerateToolbar from "./leads/BatchGenerateToolbar";
import ManualImportPanel from "./leads/ManualImportPanel";
import ManualDuplicateReviewPanel from "./leads/ManualDuplicateReviewPanel";
import CrmPipelineTable from "./leads/CrmPipelineTable";
import PaymentReconciliationPanel from "./leads/PaymentReconciliationPanel";
import PaymentVerificationModal from "./leads/PaymentVerificationModal";
import ProspectCard from "./leads/ProspectCard";
import ProspectDetailsDrawer from "./leads/ProspectDetailsDrawer";
import ProspectFiltersPanel from "./leads/ProspectFiltersPanel";
import ProspectingRoutePanel from "./leads/ProspectingRoutePanel";
import ProspectSearchPanel from "./leads/ProspectSearchPanel";
import SearchHistoryPanel from "./leads/SearchHistoryPanel";
import useLeadCrm from "./leads/useLeadCrm";
import useManualDuplicateReview from "./leads/useManualDuplicateReview";
import useManualImport from "./leads/useManualImport";
import useProspectDetails from "./leads/useProspectDetails";
import useProspectFiltersAndScoring from "./leads/useProspectFiltersAndScoring";
import useProspectSearch from "./leads/useProspectSearch";
import useProspectingRoute from "./leads/useProspectingRoute";
import useSiteGenerationQueue from "./leads/useSiteGenerationQueue";

export default function AdminLeads() {
  const { showApiError, showToast } = useAdminToast();
  const [prospectDrafts, setProspectDrafts] = useState<any[]>([]);
  const [leadWorkspaceTab, setLeadWorkspaceTab] = useLocalStorageState("webview.adminLeads.workspaceTab", "search");
  const [scorePopoverKey, setScorePopoverKey] = useState("");
  const [generationJobCount, setGenerationJobCount] = useState(0);
  const [jobsOpen, setJobsOpen] = useState(false);
  const [generationMessages, setGenerationMessages] = useState<Record<string, { type: "success" | "error"; text: string; businessId?: string }>>({});
  const [aiProvider, setAiProvider] = useLocalStorageState("webview.adminLeads.aiProvider", "OpenRouter");
  const [aiModel, setAiModel] = useLocalStorageState("webview.adminLeads.aiModel", "~anthropic/claude-sonnet-latest");
  const [settings, setSettings] = useState<any>({});
  const [loadingSettings, setLoadingSettings] = useState(true);
  const {
    leads,
    paymentLedger,
    paymentLedgerLoading,
    phoneBackfillLoading,
    phoneBackfillMessage,
    paymentVerifyLead,
    paymentVerifySaving,
    paymentVerifyMessage,
    paymentVerifyForm,
    contactEdit,
    setContactEdit,
    setPaymentVerifyForm,
    setPaymentVerifyLead,
    fetchLeads,
    fetchPaymentLedger,
    backfillLeadPhones,
    exportCheckoutPendingCsv,
    updateStatus,
    usableLeadEmail,
    usableLeadPhone,
    smsHref,
    saveLeadContact,
    openPaymentVerification,
    submitPaymentVerification,
  } = useLeadCrm({ settings, showToast, showApiError });

  const providers: Record<string, { label: string; models: { value: string; label: string }[] }> = {
    OpenAI: {
      label: "OpenAI API",
      models: [
        { value: "gpt-5.5", label: "GPT-5.5 ($5 in / $30 out)" },
        { value: "gpt-5.4", label: "GPT-5.4 ($2.50 in / $15 out)" },
        { value: "gpt-5.4-mini", label: "GPT-5.4 Mini ($0.75 in / $4.50 out)" },
        { value: "gpt-4.1", label: "GPT-4.1 Legacy ($2 in / $8 out)" }
      ]
    },
    Gemini: {
      label: "Gemini API",
      models: [
        { value: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro Preview ($2 in / $12 out)" },
        { value: "gemini-3-flash-preview", label: "Gemini 3 Flash Preview ($0.50 in / $3 out)" },
        { value: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash-Lite ($0.25 in / $1.50 out)" },
        { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro Legacy" }
      ]
    },
    OpenRouter: {
      label: "OpenRouter API",
      models: [
        { value: "~anthropic/claude-sonnet-latest", label: "Claude Sonnet Latest ($3 in / $15 out)" },
        { value: "~openai/gpt-latest", label: "OpenAI GPT Latest ($5 in / $30 out)" },
        { value: "~google/gemini-pro-latest", label: "Gemini Pro Latest ($2 in / $12 out)" },
        { value: "~google/gemini-flash-latest", label: "Gemini Flash Latest ($0.50 in / $3 out)" },
        { value: "qwen/qwen3.6-max-preview", label: "Qwen3.6 Max Preview ($1.04 in / $6.24 out)" },
        { value: "qwen/qwen3.6-flash", label: "Qwen3.6 Flash ($0.25 in / $1.50 out)" }
      ]
    },
    KIE: {
      label: "KIE.ai API",
      models: [
        { value: "kie/gemini-2.5-flash", label: "KIE Gemini 2.5 Flash (cheap copy rewrite)" },
        { value: "kie/gemini-3-flash", label: "KIE Gemini 3 Flash (est. $0.25 in / $1.50 out)" },
        { value: "kie/gpt-5-4", label: "KIE GPT-5.4 (est. $1.25 in / $7.50 out)" },
        { value: "kie/gemini-3.1-pro", label: "KIE Gemini 3.1 Pro (est. $1 in / $6 out)" },
        { value: "kie/gpt-5-5", label: "KIE GPT-5.5 (est. $2.50 in / $15 out)" },
        { value: "kie/gpt-5-2", label: "KIE GPT-5.2 (cek live credit KIE)" }
      ]
    },
    Opencode: {
      label: "Opencode API (Custom)",
      models: [
        { value: "opencode-default", label: "Default model dari endpoint" },
        { value: "qwen/qwen3.6-flash", label: "Qwen3.6 Flash" },
        { value: "qwen/qwen3.6-max-preview", label: "Qwen3.6 Max Preview" },
        { value: "custom-model", label: "Custom model alias" }
      ]
    }
  };
  const activeProviderKey = providers[aiProvider] ? aiProvider : "OpenRouter";
  const activeProvider = providers[activeProviderKey];
  const activeModel = activeProvider.models.some((model) => model.value === aiModel)
    ? aiModel
    : activeProvider.models[0].value;

  const getPlaceKey = (place: any) => String(place?.place_id || place?.id || place?.name || "");

  const isWeakGoogleMapsSearchUrl = (value: string) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return url.hostname.includes("google.") && url.pathname.includes("/maps/search");
    } catch {
      return value.includes("/maps/search");
    }
  };

  const googleMapsPlaceIdUrl = (placeId: string) =>
    `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(placeId)}`;

  const googleBusinessListingUrl = (place: any) => {
    const direct = placeMapsUrl(place);
    const placeId = place?.place_id || place?.id || "";
    if (direct && !isWeakGoogleMapsSearchUrl(direct)) return direct;
    if (placeId) return googleMapsPlaceIdUrl(placeId);
    return direct || "https://www.google.com/maps";
  };

  const {
    placeDetails,
    setPlaceDetails,
    placeDetailsLoading,
    detailsPanelPlace,
    setDetailsPanelPlace,
    logoSelections,
    paletteOptionsByPlace,
    hasGatheredDetails,
    mergePlaceWithDetails,
    restoreProspectDetailState,
    selectLogoPhoto,
    buildPaletteOptionsForPlace,
    loadPlaceDetails,
  } = useProspectDetails({ getPlaceKey, setGenerationMessages });

  useEffect(() => {
    const provider = providers[aiProvider] ? aiProvider : "OpenRouter";
    if (provider !== aiProvider) {
      setAiProvider(provider);
      return;
    }

    const hasModel = providers[provider].models.some((model) => model.value === aiModel);
    if (!hasModel) {
      setAiModel(providers[provider].models[0].value);
    }
  }, [aiProvider, aiModel]);

  const {
    prospectingState,
    setProspectingState,
    prospectingCity,
    setProspectingCity,
    prospectingNiche,
    setProspectingNiche,
    currentProgress,
    setProgressStep,
  } = useProspectingRoute();

  const activeWorkspaceTab = ["search", "crm", "history"].includes(leadWorkspaceTab) ? leadWorkspaceTab : "search";

  const {
    prospectFilter,
    setProspectFilter,
    websiteFilter,
    setWebsiteFilter,
    minRatingFilter,
    setMinRatingFilter,
    minReviewsFilter,
    setMinReviewsFilter,
    minScoreFilter,
    setMinScoreFilter,
    cityFilter,
    setCityFilter,
    stateFilter,
    setStateFilter,
    nicheFilter,
    setNicheFilter,
    filtersOpen,
    setFiltersOpen,
    autoWebsitePrecheck,
    setAutoWebsitePrecheck,
    websitePrecheckLimit,
    setWebsitePrecheckLimit,
    selectedProspects,
    setSelectedProspects,
    activeScoringPreset,
    activeScoringPresetLabel,
    minScore,
    activeFilterChips,
    getProspectView,
    fetchProspectDrafts,
    resetLeadFilters,
    toggleProspectSelection,
    websiteBadge,
    prospectScore,
  } = useProspectFiltersAndScoring({
    settings,
    loadingSettings,
    prospectDrafts,
    setProspectDrafts,
    getPlaceKey,
    hasGatheredDetails,
    restoreProspectDetailState,
  });

  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    setSearchResults,
    searchMessage,
    isSearching,
    setSearchActive,
    searchHistory,
    loadingSearchHistory,
    selectedSearchHistoryKey,
    setSelectedSearchHistoryKey,
    fetchSearchHistory,
    handleSearch,
    applySearchHistory,
  } = useProspectSearch({
    websiteFilter,
    autoWebsitePrecheck,
    websitePrecheckLimit,
    setLeadWorkspaceTab,
    fetchProspectDrafts,
    getPlaceKey,
    setPlaceDetails,
    setGenerationMessages,
  });
  const { visibleProspects, selectedVisibleProspects } = getProspectView(searchResults, activeWorkspaceTab);

  const fetchGenerationJobs = () => {
    fetch("/api/generation-jobs?limit=100")
      .then(r => r.ok ? r.json() : [])
      .then((data) => setGenerationJobCount(Array.isArray(data) ? data.length : 0))
      .catch(e => console.error(e));
  };

  const {
    manualDuplicateQueue,
    manualDuplicateLoading,
    manualDuplicateMessage,
    fetchManualDuplicateQueue,
    mergePreviewFields,
    reviewDuplicateInList,
    mergeManualDuplicate,
    skipManualDuplicate,
  } = useManualDuplicateReview({
    getPlaceKey,
    setSearchResults,
    setProspectDrafts,
    setSearchActive,
    setLeadWorkspaceTab,
  });
  const {
    manualImportOpen,
    setManualImportOpen,
    manualMapsUrl,
    setManualMapsUrl,
    manualCaptureText,
    setManualCaptureText,
    manualImportLoading,
    manualImportMessage,
    isTrimmingCache,
    cacheTrimMessage,
    handleManualMapsImport,
    trimPlacesCache,
  } = useManualImport({
    searchQuery,
    setSearchQuery,
    setSearchResults,
    setSearchActive,
    setSelectedSearchHistoryKey,
    setWebsiteFilter,
    setLeadWorkspaceTab,
    fetchProspectDrafts,
    fetchSearchHistory,
    fetchManualDuplicateQueue,
  });

  const selectedPrice = estimateCostUsd(activeProviderKey, activeModel);
  const providerApiKeyMap: Record<string, string> = {
    OpenRouter: "OPENROUTER_API_KEY",
    OpenAI: "OPENAI_API_KEY",
    Gemini: "GEMINI_API_KEY",
    KIE: "KIE_API_KEY",
    Opencode: "OPENCODE_API_KEY",
  };
  const settingsKey = providerApiKeyMap[activeProviderKey] || "";
  const providerKeyStatus = Object.keys(providerApiKeyMap).reduce<Record<string, boolean | null>>((acc, provider) => {
    const key = providerApiKeyMap[provider];
    acc[provider] = loadingSettings ? null : Boolean(String(settings?.[key] || "").trim());
    return acc;
  }, {});
  const activeProviderKeyReady = providerKeyStatus[activeProviderKey] ?? null;
  const missingRequiredSettings = [
    !String(settings?.GOOGLE_PLACES_API_KEY || "").trim() ? "Google Places API Key" : "",
    !String(settings?.[settingsKey] || "").trim() ? `${activeProvider.label} Key` : "",
  ].filter(Boolean);
  const estimateGenerateCost = (place?: any) => {
    const source = place ? JSON.stringify(place) : searchQuery;
    const inputTokens = estimateTokensFromText(source, 5000);
    return estimateCostUsd(activeProviderKey, activeModel, inputTokens, defaultOutputTokens);
  };

  const {
    batchQueueRunning,
    batchMessage,
    setBatchMessage,
    isGenerating,
    generatingPlaceKey,
    handleGenerateSite,
    startBatchGenerate,
  } = useSiteGenerationQueue({
    activeProviderKey,
    activeModel,
    searchQuery,
    logoSelections,
    paletteOptionsByPlace,
    showToast,
    showApiError,
    getPlaceKey,
    mapsQueryPlaceholder,
    hasGatheredDetails,
    mergePlaceWithDetails,
    buildPaletteOptionsForPlace,
    setGenerationMessages,
    fetchLeads,
    fetchProspectDrafts,
    fetchGenerationJobs,
  });
  const loadProspectDetails = (place: any) => loadPlaceDetails(place, { setSearchResults, setProspectDrafts });

  useEffect(() => {
    fetchLeads();
    fetchPaymentLedger();
    fetchProspectDrafts();
    fetchGenerationJobs();
    fetchSearchHistory();
    fetchManualDuplicateQueue();
    fetch("/api/settings")
      .then(r => r.ok ? r.json() : {})
      .then(data => {
        setSettings(data);
        setLoadingSettings(false);
      })
      .catch(() => setLoadingSettings(false));
  }, []);

  const updateProspectStatus = async (place: any, status: string) => {
    const placeKey = getPlaceKey(place);
    if (!placeKey) return;
    await fetch(`/api/prospects/${encodeURIComponent(placeKey)}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const applyStatus = (items: any[]) => status === "skipped"
      ? items.filter((item) => getPlaceKey(item) !== placeKey)
      : items.map((item) => getPlaceKey(item) === placeKey ? { ...item, prospectStatus: status } : item);
    setSearchResults(applyStatus);
    setProspectDrafts(applyStatus);
    fetchManualDuplicateQueue();
  };

  return (
    <div className="p-8 max-w-7xl mx-auto font-sans">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Leads Workspace</h1>
          <p className="mt-1 text-sm text-slate-500">Find prospects, review search history, then manage the CRM pipeline in separate views.</p>
        </div>
        <AdminWorkspaceTabs
          activeTab={activeWorkspaceTab}
          tabs={[
            { key: "search", label: "Find Leads" },
            { key: "history", label: "Search History" },
            { key: "crm", label: "CRM Pipeline" },
          ]}
          onChange={(tabKey) => {
            setLeadWorkspaceTab(tabKey);
            if (tabKey === "crm") {
              setSearchActive(false);
              fetchLeads();
              fetchPaymentLedger();
              fetchProspectDrafts();
            }
            if (tabKey === "history") fetchSearchHistory();
          }}
        />
      </div>

      {(!loadingSettings && missingRequiredSettings.length > 0) && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
          <div className="text-amber-500 mt-0.5">⚠️</div>
          <div>
            <h3 className="text-amber-800 font-semibold text-sm">Persiapan Belum Selesai</h3>
            <p className="text-amber-700 text-sm mt-1">
              Field berikut belum terbaca dari settings: <strong>{missingRequiredSettings.join(", ")}</strong>.
              Pencarian Maps atau Generasi AI mungkin tidak akan berfungsi tanpa API Key yang tepat.
            </p>
            <a href="/admin/settings" className="inline-block mt-3 px-4 py-2 bg-amber-100 text-amber-800 rounded-lg text-sm font-medium hover:bg-amber-200 transition">
              Atur API Keys di Settings
            </a>
          </div>
        </div>
      )}

      {/* SEARCH SECTION */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
          <h2 className="inline-flex items-center gap-1.5 text-lg font-medium text-gray-900">
            {activeWorkspaceTab === "history" ? "Search History" : activeWorkspaceTab === "crm" ? "CRM Pipeline" : "Cari Prospek Baru (Google Maps)"}
            <HelpTooltip text="Find Leads is for Google Maps searching/import. Search History is cached query review. CRM Pipeline is for saved prospect drafts and generated leads." />
          </h2>
          {activeWorkspaceTab !== "history" && (
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500">
              AI Web Builder:
              <HelpTooltip text="Provider/model used for new site generation from this page. The choice is saved locally and also used as retry fallback for jobs." />
            </label>
            <select 
              value={activeProviderKey}
              onChange={(e) => {
                setAiProvider(e.target.value);
                setAiModel(providers[e.target.value].models[0].value);
              }}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {Object.keys(providers).map(pKey => (
                <option key={pKey} value={pKey}>{providers[pKey].label}</option>
              ))}
            </select>
            <select
              value={activeModel}
              onChange={(e) => setAiModel(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {activeProvider.models.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <AdminAiReadinessRefreshButton
              className="py-1.5"
              onRefresh={() => setBatchMessage("AI readiness cache cleared. Badges are rechecking the selected provider/model.")}
            />
            <AdminProviderCooldownBadge provider={activeProviderKey} />
          </div>
          )}
        </div>
        {activeWorkspaceTab !== "history" && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div>
            <p className="inline-flex items-center gap-1.5 font-semibold text-slate-900">
              Est. generate cost
              <HelpTooltip text="Rough cost estimate for one JSON generation using the selected AI provider/model. Actual billing can vary by provider token accounting." />
            </p>
            <p>
              {selectedPrice.total !== null
                ? `${formatUsd(estimateGenerateCost().total)} per generate awal (${activeModel})`
                : `Harga ${activeModel} belum fixed. Cek dashboard provider sebelum generate.`}
            </p>
          </div>
          <a href="/admin/settings" className="text-indigo-700 font-medium hover:underline">Lihat pricing & API key</a>
        </div>
        )}
        {activeWorkspaceTab === "search" && (
        <>
        <div className="mb-4 flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="inline-flex items-center gap-1.5 font-semibold text-slate-900">
              Places cache
              <HelpTooltip text="Search reads cached Google Places results first to reduce API calls. Use Refresh to force a new Google request." />
            </p>
            {cacheTrimMessage && <p className="mt-1 text-xs text-indigo-700">{cacheTrimMessage}</p>}
          </div>
          <HoverTooltip text="Trim cached Google Places searches older than 30 days.">
            <button
              type="button"
              onClick={trimPlacesCache}
              disabled={isTrimmingCache}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              aria-label="Trim Places cache older than 30 days"
            >
              {isTrimmingCache ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
            </button>
          </HoverTooltip>
        </div>
        <ManualImportPanel
          open={manualImportOpen}
          manualMapsUrl={manualMapsUrl}
          manualCaptureText={manualCaptureText}
          manualImportLoading={manualImportLoading}
          manualImportMessage={manualImportMessage}
          setOpen={setManualImportOpen}
          setManualMapsUrl={setManualMapsUrl}
          setManualCaptureText={setManualCaptureText}
          onImport={handleManualMapsImport}
        />
        </>
        )}
        {activeWorkspaceTab === "history" && (
        <SearchHistoryPanel
          searchHistory={searchHistory}
          selectedSearchHistoryKey={selectedSearchHistoryKey}
          loadingSearchHistory={loadingSearchHistory}
          fetchSearchHistory={fetchSearchHistory}
          applySearchHistory={applySearchHistory}
        />
        )}
        {activeWorkspaceTab === "crm" && (
        <ManualDuplicateReviewPanel
          manualDuplicateQueue={manualDuplicateQueue}
          manualDuplicateLoading={manualDuplicateLoading}
          manualDuplicateMessage={manualDuplicateMessage}
          fetchManualDuplicateQueue={fetchManualDuplicateQueue}
          getPlaceKey={getPlaceKey}
          mergePreviewFields={mergePreviewFields}
          reviewDuplicateInList={reviewDuplicateInList}
          mergeManualDuplicate={mergeManualDuplicate}
          skipManualDuplicate={skipManualDuplicate}
        />
        )}
        {activeWorkspaceTab !== "history" && (
        <ProspectFiltersPanel
          filtersOpen={filtersOpen}
          activeFilterChips={activeFilterChips}
          prospectFilter={prospectFilter}
          websiteFilter={websiteFilter}
          minRatingFilter={minRatingFilter}
          minReviewsFilter={minReviewsFilter}
          minScoreFilter={minScoreFilter}
          cityFilter={cityFilter}
          stateFilter={stateFilter}
          nicheFilter={nicheFilter}
          autoWebsitePrecheck={autoWebsitePrecheck}
          websitePrecheckLimit={websitePrecheckLimit}
          setFiltersOpen={setFiltersOpen}
          setProspectFilter={setProspectFilter}
          setWebsiteFilter={setWebsiteFilter}
          setMinRatingFilter={setMinRatingFilter}
          setMinReviewsFilter={setMinReviewsFilter}
          setMinScoreFilter={setMinScoreFilter}
          setCityFilter={setCityFilter}
          setStateFilter={setStateFilter}
          setNicheFilter={setNicheFilter}
          setAutoWebsitePrecheck={setAutoWebsitePrecheck}
          setWebsitePrecheckLimit={setWebsitePrecheckLimit}
          resetLeadFilters={resetLeadFilters}
          reloadProspectDrafts={() => {
            setSearchActive(false);
            fetchProspectDrafts();
          }}
        />
        )}
        {activeWorkspaceTab === "search" && (
        <>
        <ProspectingRoutePanel
          prospectingState={prospectingState}
          prospectingCity={prospectingCity}
          prospectingNiche={prospectingNiche}
          currentProgress={currentProgress}
          setProspectingState={setProspectingState}
          setProspectingCity={setProspectingCity}
          setProspectingNiche={setProspectingNiche}
          setSearchQuery={setSearchQuery}
          setCityFilter={setCityFilter}
          setStateFilter={setStateFilter}
          setNicheFilter={setNicheFilter}
          setProgressStep={setProgressStep}
        />
        <ProspectSearchPanel
          searchQuery={searchQuery}
          searchMessage={searchMessage}
          searchResultCount={searchResults.length}
          isSearching={isSearching}
          setSearchQuery={setSearchQuery}
          onSearch={(refresh) => {
            setProgressStep("searched", true);
            handleSearch(refresh);
          }}
        />
        </>
        )}

        {activeWorkspaceTab !== "history" && visibleProspects.length > 0 && (
          <div className="mt-6 space-y-4">
            <BatchGenerateToolbar
              title={activeWorkspaceTab === "search" ? "Current search results" : "Saved prospect drafts"}
              visibleCount={visibleProspects.length}
              selectedCount={selectedVisibleProspects.length}
              visibleProspects={visibleProspects}
              selectedProspects={selectedProspects}
              activeScoringPresetLabel={activeScoringPresetLabel}
              activeScoringPreset={activeScoringPreset}
              minScoreFilter={minScoreFilter}
              minScore={minScore}
              batchMessage={batchMessage}
              batchQueueRunning={batchQueueRunning}
              generationJobCount={generationJobCount}
              activeProviderKey={activeProviderKey}
              activeModel={activeModel}
              activeProviderKeyReady={activeProviderKeyReady}
              getPlaceKey={getPlaceKey}
              prospectScore={prospectScore}
              setSelectedProspects={setSelectedProspects}
              startBatchGenerate={() => startBatchGenerate(selectedVisibleProspects, setSelectedProspects)}
              toggleJobs={() => {
                setJobsOpen((value) => !value);
                fetchGenerationJobs();
              }}
            />
            {jobsOpen && (
              <GenerationJobsTable
                storageKeyPrefix="webview.adminLeads.jobs"
                fallbackProvider={activeProviderKey}
                fallbackModel={activeModel}
                providerKeyStatus={providerKeyStatus}
                settings={settings}
                onSettingsChange={setSettings}
                variant="compact"
                showFullPageLink
                onJobsLoaded={(jobs) => setGenerationJobCount(jobs.length)}
              />
            )}
            {visibleProspects.map((place, idx) => {
              const placeKey = getPlaceKey(place) || String(idx);
              return (
                <ProspectCard
                  key={placeKey}
                  place={place}
                  index={idx}
                  selected={Boolean(selectedProspects[placeKey])}
                  scorePopoverKey={scorePopoverKey}
                  generationMessage={generationMessages[placeKey]}
                  placeDetailsLoading={placeDetailsLoading}
                  logoSelections={logoSelections}
                  paletteOptions={paletteOptionsByPlace[placeKey] || []}
                  isGenerating={isGenerating}
                  generatingPlaceKey={generatingPlaceKey}
                  activeProviderKey={activeProviderKey}
                  activeModel={activeModel}
                  activeProviderKeyReady={activeProviderKeyReady}
                  getPlaceKey={getPlaceKey}
                  mergePlaceWithDetails={mergePlaceWithDetails}
                  sortedPhotosForPlace={sortedPhotosForPlace}
                  hasGatheredDetails={hasGatheredDetails}
                  mapsQueryPlaceholder={mapsQueryPlaceholder}
                  websiteBadge={websiteBadge}
                  googleBusinessListingUrl={googleBusinessListingUrl}
                  prospectScore={prospectScore}
                  estimateGenerateCost={estimateGenerateCost}
                  googlePlacePhotoUrlForPhoto={googlePlacePhotoUrlForPhoto}
                  photoPriorityLabel={photoPriorityLabel}
                  setScorePopoverKey={setScorePopoverKey}
                  toggleProspectSelection={toggleProspectSelection}
                  setDetailsPanelPlace={setDetailsPanelPlace}
                  updateProspectStatus={updateProspectStatus}
                  loadPlaceDetails={loadProspectDetails}
                  handleGenerateSite={handleGenerateSite}
                  selectLogoPhoto={selectLogoPhoto}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* LEADS TABLE */}
      {activeWorkspaceTab === "crm" && (
      <>
      <PaymentReconciliationPanel
        paymentLedger={paymentLedger}
        paymentLedgerLoading={paymentLedgerLoading}
        phoneBackfillLoading={phoneBackfillLoading}
        phoneBackfillMessage={phoneBackfillMessage}
        exportCheckoutPendingCsv={exportCheckoutPendingCsv}
        fetchPaymentLedger={fetchPaymentLedger}
        backfillLeadPhones={backfillLeadPhones}
      />
      <CrmPipelineTable
        leads={leads}
        contactEdit={contactEdit}
        setContactEdit={setContactEdit}
        updateStatus={updateStatus}
        openPaymentVerification={openPaymentVerification}
        saveLeadContact={saveLeadContact}
        usableLeadEmail={usableLeadEmail}
        usableLeadPhone={usableLeadPhone}
        smsHref={smsHref}
      />
      </>
      )}

      {paymentVerifyLead && (
        <PaymentVerificationModal
          lead={paymentVerifyLead}
          form={paymentVerifyForm}
          message={paymentVerifyMessage}
          saving={paymentVerifySaving}
          setForm={setPaymentVerifyForm}
          onClose={() => setPaymentVerifyLead(null)}
          onSubmit={submitPaymentVerification}
        />
      )}

      {detailsPanelPlace && (
        <ProspectDetailsDrawer
          place={detailsPanelPlace}
          placeDetails={placeDetails}
          placeDetailsLoading={placeDetailsLoading}
          logoSelections={logoSelections}
          getPlaceKey={getPlaceKey}
          sortedPhotosForPlace={sortedPhotosForPlace}
          mapsQueryPlaceholder={mapsQueryPlaceholder}
          googleBusinessListingUrl={googleBusinessListingUrl}
          googlePlacePhotoUrlForPhoto={googlePlacePhotoUrlForPhoto}
          photoPriorityLabel={photoPriorityLabel}
          selectLogoPhoto={selectLogoPhoto}
          loadPlaceDetails={loadProspectDetails}
          updateProspectStatus={updateProspectStatus}
          onClose={() => setDetailsPanelPlace(null)}
        />
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { Search, Loader2, Camera, ExternalLink, Mail, MessageSquare, RefreshCw, Images, PanelRightOpen, X, Play, ListChecks, History, SlidersHorizontal } from "lucide-react";
import * as htmlToImage from "html-to-image";
import { defaultOutputTokens, estimateCostUsd, estimateTokensFromText, formatUsd } from "../../lib/aiPricing";
import { useLocalStorageState } from "../../lib/localStorageState";
import { getShaderPreset, getStylePreset, inferShaderPresetFromText, inferStylePresetFromText, inferVisualStyleFromText, siteShaderPresets, siteVisualStyles } from "../../lib/siteStylePresets";
import { fontPairingsForText, getFontPairing, inferFontPairingFromText } from "../../lib/fontPairings";
import { parseProspectScoreWeights, prospectScoringPresets, scoreThresholdOptions } from "../../lib/prospectScoring";
import { checkAiReadiness, logAiReadinessBlockedJob } from "../../lib/aiReadiness";
import { readApiJson } from "../../lib/apiResponse";
import HelpTooltip from "../../components/HelpTooltip";
import HoverTooltip from "../../components/HoverTooltip";
import GenerationJobsTable from "../../components/GenerationJobsTable";
import AdminWorkspaceTabs from "../../components/AdminWorkspaceTabs";
import AdminAiReadinessBadge from "../../components/AdminAiReadinessBadge";
import AdminAiReadinessRefreshButton from "../../components/AdminAiReadinessRefreshButton";
import { useAdminToast } from "../../components/AdminToast";
import AdminProviderCooldownBadge from "../../components/AdminProviderCooldownBadge";
import { formatCooldownRemaining, getSharedProviderCooldown, logProviderCooldownBlockedJob } from "../../lib/providerCooldown";

export default function AdminLeads() {
  const { showApiError, showToast } = useAdminToast();
  const [leads, setLeads] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [prospectDrafts, setProspectDrafts] = useState<any[]>([]);
  const [prospectFilter, setProspectFilter] = useLocalStorageState("webview.adminLeads.prospectFilter", "active");
  const [leadWorkspaceTab, setLeadWorkspaceTab] = useLocalStorageState("webview.adminLeads.workspaceTab", "search");
  const [websiteFilter, setWebsiteFilter] = useLocalStorageState("webview.adminLeads.websiteFilter", "none");
  const [minRatingFilter, setMinRatingFilter] = useLocalStorageState("webview.adminLeads.minRatingFilter", "0");
  const [minReviewsFilter, setMinReviewsFilter] = useLocalStorageState("webview.adminLeads.minReviewsFilter", "0");
  const [minScoreFilter, setMinScoreFilter] = useLocalStorageState("webview.adminLeads.minScoreFilter", "0");
  const [cityFilter, setCityFilter] = useLocalStorageState("webview.adminLeads.cityFilter", "");
  const [stateFilter, setStateFilter] = useLocalStorageState("webview.adminLeads.stateFilter", "");
  const [nicheFilter, setNicheFilter] = useLocalStorageState("webview.adminLeads.nicheFilter", "");
  const [selectedProspects, setSelectedProspects] = useState<Record<string, boolean>>({});
  const [scorePopoverKey, setScorePopoverKey] = useState("");
  const [batchQueueRunning, setBatchQueueRunning] = useState(false);
  const [batchMessage, setBatchMessage] = useState("");
  const [generationJobCount, setGenerationJobCount] = useState(0);
  const [jobsOpen, setJobsOpen] = useState(false);
  const [searchMessage, setSearchMessage] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [manualMapsUrl, setManualMapsUrl] = useLocalStorageState("webview.adminLeads.manualMapsUrl", "");
  const [manualCaptureText, setManualCaptureText] = useLocalStorageState("webview.adminLeads.manualCaptureText", "");
  const [manualImportLoading, setManualImportLoading] = useState(false);
  const [manualImportMessage, setManualImportMessage] = useState("");
  const [manualDuplicateQueue, setManualDuplicateQueue] = useState<any[]>([]);
  const [manualDuplicateLoading, setManualDuplicateLoading] = useState(false);
  const [manualDuplicateMessage, setManualDuplicateMessage] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingPlaceKey, setGeneratingPlaceKey] = useState("");
  const [generationMessages, setGenerationMessages] = useState<Record<string, { type: "success" | "error"; text: string; businessId?: string }>>({});
  const [placeDetails, setPlaceDetails] = useState<Record<string, any>>({});
  const [placeDetailsLoading, setPlaceDetailsLoading] = useState<Record<string, boolean>>({});
  const [isTrimmingCache, setIsTrimmingCache] = useState(false);
  const [cacheTrimMessage, setCacheTrimMessage] = useState("");
  const [detailsPanelPlace, setDetailsPanelPlace] = useState<any>(null);
  const [searchActive, setSearchActive] = useState(false);
  const [searchHistory, setSearchHistory] = useState<any[]>([]);
  const [loadingSearchHistory, setLoadingSearchHistory] = useState(false);
  const [selectedSearchHistoryKey, setSelectedSearchHistoryKey] = useState("");
  const [filtersOpen, setFiltersOpen] = useLocalStorageState("webview.adminLeads.filtersOpen", "0");
  const [autoWebsitePrecheck, setAutoWebsitePrecheck] = useLocalStorageState("webview.adminLeads.autoWebsitePrecheck", "1");
  const [websitePrecheckLimit, setWebsitePrecheckLimit] = useLocalStorageState("webview.adminLeads.websitePrecheckLimit", "10");
  const [aiProvider, setAiProvider] = useLocalStorageState("webview.adminLeads.aiProvider", "OpenRouter");
  const [aiModel, setAiModel] = useLocalStorageState("webview.adminLeads.aiModel", "~anthropic/claude-sonnet-latest");
  const [settings, setSettings] = useState<any>({});
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [logoSelections, setLogoSelections] = useState<Record<string, { url: string; reference: string; palette: string[]; attributions: string[]; priorityLabel: string; source: string }>>({});
  const [paletteOptionsByPlace, setPaletteOptionsByPlace] = useState<Record<string, any[]>>({});

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

  const isMapsQueryPlaceholder = (place: any) => {
    const placeId = String(place?.place_id || place?.id || "");
    return placeId.startsWith("maps:") && !place?.manualImport;
  };

  const isPlaceholderPhone = (value?: string) => {
    const digits = String(value || "").replace(/\D/g, "");
    return !digits || /^0+$/.test(digits);
  };

  const placePhone = (place: any) => {
    const phone = place.formatted_phone_number || place.international_phone_number || place.nationalPhoneNumber || "";
    return isPlaceholderPhone(phone) ? "" : phone;
  };

  const placeMapsUrl = (place: any) => place.url || place.googleMapsUri || place.maps_url || "";

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

  const hasGatheredDetails = (place: any) => {
    const key = getPlaceKey(place);
    const details = placeDetails[key];
    return Boolean(details || place.detailsLoadedAt || place.prospectStatus === "details_loaded" || Array.isArray(place.reviews));
  };

  const mergePlaceWithDetails = (place: any) => {
    const key = getPlaceKey(place);
    const details = placeDetails[key] || {};
    return {
      ...place,
      ...details,
      photos: Array.isArray(details.photos) && details.photos.length > 0 ? details.photos : place.photos,
    };
  };

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

  const fetchLeads = () => {
    fetch("/api/leads")
      .then(r => r.ok ? r.json() : [])
      .then((data) => setLeads(Array.isArray(data) ? data : []))
      .catch(e => console.error(e));
  };

  const fetchProspectDrafts = () => {
    const params = new URLSearchParams();
    if (prospectFilter && prospectFilter !== "active" && prospectFilter !== "all") params.set("status", prospectFilter);
    if (websiteFilter && websiteFilter !== "all") params.set("website", websiteFilter);
    if (minRatingFilter && minRatingFilter !== "0") params.set("minRating", minRatingFilter);
    if (minReviewsFilter && minReviewsFilter !== "0") params.set("minReviews", minReviewsFilter);
    if (cityFilter.trim()) params.set("city", cityFilter.trim());
    if (stateFilter.trim()) params.set("state", stateFilter.trim());
    if (nicheFilter.trim()) params.set("niche", nicheFilter.trim());
    fetch(`/api/prospects?${params.toString()}`)
      .then(r => r.ok ? r.json() : [])
      .then((data) => {
        const rows = Array.isArray(data) ? data : [];
        setProspectDrafts(prospectFilter === "active"
          ? rows.filter((item) => !["skipped", "site_generated"].includes(item.prospectStatus))
          : rows);
        const restoredSelections = rows.reduce((acc: Record<string, any>, item: any) => {
          const key = getPlaceKey(item);
          if (key && item.selectedPhoto?.url && Array.isArray(item.selectedPalette)) {
            acc[key] = {
              url: item.selectedPhoto.url,
              reference: item.selectedPhoto.reference || "",
              palette: item.selectedPalette,
              attributions: Array.isArray(item.selectedPhoto.attributions) ? item.selectedPhoto.attributions : [],
              priorityLabel: item.selectedPhoto.priorityLabel || "",
              source: item.selectedPhoto.source || "google_places",
            };
          }
          return acc;
        }, {});
        if (Object.keys(restoredSelections).length > 0) {
          setLogoSelections(prev => ({ ...restoredSelections, ...prev }));
        }
        const restoredPaletteOptions = rows.reduce((acc: Record<string, any[]>, item: any) => {
          const key = getPlaceKey(item);
          if (key && Array.isArray(item.paletteOptions) && item.paletteOptions.length > 0) {
            acc[key] = item.paletteOptions;
          }
          return acc;
        }, {});
        if (Object.keys(restoredPaletteOptions).length > 0) {
          setPaletteOptionsByPlace(prev => ({ ...restoredPaletteOptions, ...prev }));
        }
      })
      .catch(e => console.error(e));
  };

  const fetchGenerationJobs = () => {
    fetch("/api/generation-jobs?limit=100")
      .then(r => r.ok ? r.json() : [])
      .then((data) => setGenerationJobCount(Array.isArray(data) ? data.length : 0))
      .catch(e => console.error(e));
  };

  const fetchSearchHistory = () => {
    setLoadingSearchHistory(true);
    fetch("/api/places/history?limit=30")
      .then(r => r.ok ? r.json() : [])
      .then((data) => setSearchHistory(Array.isArray(data) ? data : []))
      .catch(e => console.error(e))
      .finally(() => setLoadingSearchHistory(false));
  };

  const fetchManualDuplicateQueue = () => {
    setManualDuplicateLoading(true);
    fetch("/api/places/manual-duplicates?limit=500")
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok || data.error) throw new Error(data.error || `Duplicate queue returned ${r.status}`);
        setManualDuplicateQueue(Array.isArray(data.groups) ? data.groups : []);
        setManualDuplicateMessage("");
      })
      .catch((error) => {
        console.error(error);
        setManualDuplicateMessage(error instanceof Error ? error.message : "Could not load duplicate queue.");
      })
      .finally(() => setManualDuplicateLoading(false));
  };

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
  const scoreWeights = parseProspectScoreWeights(settings?.SCORING_WEIGHTS_JSON);
  const activeScoringPreset = prospectScoringPresets.find((preset) => preset.key === settings?.SCORING_PRESET);
  const activeScoringPresetLabel = activeScoringPreset?.label || (settings?.SCORING_PRESET === "custom" ? "Custom" : "Balanced");

  const getPhotoReference = (photo: any) => photo?.photo_reference || photo?.name || photo?.reference || "";

  const getPhotoUrl = (photo: any, maxWidth = 320) => {
    const reference = getPhotoReference(photo);
    if (!reference) return "";
    return `/api/places/photo?reference=${encodeURIComponent(reference)}&maxwidth=${maxWidth}`;
  };

  const stripHtml = (value: string) => value.replace(/<[^>]*>/g, "").trim();

  const getPhotoAttributions = (photo: any) => {
    const legacy = Array.isArray(photo?.html_attributions)
      ? photo.html_attributions.map((value: string) => stripHtml(String(value)))
      : [];
    const newApi = Array.isArray(photo?.authorAttributions)
      ? photo.authorAttributions
          .map((item: any) => item?.displayName || item?.uri || item?.photoUri || "")
          .filter(Boolean)
      : [];
    return [...legacy, ...newApi].filter(Boolean);
  };

  const photoPriority = (photo: any, businessName: string) => {
    const attributions = getPhotoAttributions(photo).join(" ").toLowerCase();
    const nameTokens = businessName.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2);
    if (attributions && nameTokens.some((token) => attributions.includes(token))) return 0;
    if (!attributions) return 1;
    return 2;
  };

  const photoPriorityLabel = (photo: any, businessName: string) => {
    const priority = photoPriority(photo, businessName);
    if (priority === 0) return "Owner-like";
    if (priority === 1) return "No attribution";
    return "UGC/attributed";
  };

  const sortedPhotosForPlace = (place: any) =>
    [...(Array.isArray(place?.photos) ? place.photos : [])].sort((a, b) =>
      photoPriority(a, place?.name || "") - photoPriority(b, place?.name || ""),
    );

  const estimateGenerateCost = (place?: any) => {
    const source = place ? JSON.stringify(place) : searchQuery;
    const inputTokens = estimateTokensFromText(source, 5000);
    return estimateCostUsd(activeProviderKey, activeModel, inputTokens, defaultOutputTokens);
  };

  const extractPaletteFromImage = (imageUrl: string) => new Promise<string[]>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const size = 72;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        reject(new Error("Canvas tidak tersedia."));
        return;
      }
      ctx.drawImage(img, 0, 0, size, size);
      const pixels = ctx.getImageData(0, 0, size, size).data;
      const buckets = new Map<string, number>();

      for (let i = 0; i < pixels.length; i += 16) {
        const alpha = pixels[i + 3];
        if (alpha < 180) continue;
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        if (max > 245 || min < 10 || max - min < 18) continue;

        const key = [r, g, b].map((value) => Math.round(value / 32) * 32).join(",");
        buckets.set(key, (buckets.get(key) || 0) + 1);
      }

      const palette = Array.from(buckets.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([key]) => {
          const [r, g, b] = key.split(",").map(Number);
          return `#${[r, g, b].map((value) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0")).join("")}`;
        });

      resolve(palette.length ? palette : ["#111827", "#4F46E5", "#F3F4F6"]);
    };
    img.onerror = () => reject(new Error("Gagal membaca gambar logo."));
    img.src = imageUrl;
  });

  const hexToRgb = (hex: string) => {
    const normalized = hex.trim().replace("#", "");
    const expanded = normalized.length === 3 ? normalized.split("").map((char) => char + char).join("") : normalized;
    if (!/^[0-9a-f]{6}$/i.test(expanded)) return null;
    return {
      r: parseInt(expanded.slice(0, 2), 16),
      g: parseInt(expanded.slice(2, 4), 16),
      b: parseInt(expanded.slice(4, 6), 16),
    };
  };

  const rgbToHex = (r: number, g: number, b: number) =>
    `#${[r, g, b].map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0")).join("")}`;

  const relativeLuminance = (hex: string) => {
    const rgb = hexToRgb(hex);
    if (!rgb) return 0;
    const channel = (value: number) => {
      const normalized = value / 255;
      return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
  };

  const darkenForWhiteText = (hex: string) => {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;
    let factor = 0.82;
    let current = hex;
    while (relativeLuminance(current) > 0.32 && factor > 0.32) {
      current = rgbToHex(rgb.r * factor, rgb.g * factor, rgb.b * factor);
      factor -= 0.12;
    }
    return current;
  };

  const normalizePaletteForContrast = (palette: string[]) => {
    const next = [...palette];
    if (next[0]) next[0] = darkenForWhiteText(next[0]);
    if (next[1]) next[1] = darkenForWhiteText(next[1]);
    return next;
  };

  const selectLogoPhoto = async (placeId: string, imageUrl: string, photo: any, businessName: string) => {
    const attributions = getPhotoAttributions(photo);
    const priorityLabel = photoPriorityLabel(photo, businessName);
    const reference = getPhotoReference(photo);
    try {
      const palette = normalizePaletteForContrast(await extractPaletteFromImage(imageUrl));
      setLogoSelections(prev => ({ ...prev, [placeId]: { url: imageUrl, reference, palette, attributions, priorityLabel, source: "google_places" } }));
      await fetch(`/api/prospects/${encodeURIComponent(placeId)}/selection`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photo: { url: imageUrl, reference, attributions, priorityLabel, source: "google_places" },
          palette,
          paletteOptions: paletteOptionsByPlace[placeId] || [],
        }),
      }).catch(() => {});
    } catch (error) {
      console.error(error);
      const palette = ["#111827", "#4F46E5", "#F3F4F6"];
      setLogoSelections(prev => ({ ...prev, [placeId]: { url: imageUrl, reference, palette, attributions, priorityLabel, source: "google_places" } }));
      await fetch(`/api/prospects/${encodeURIComponent(placeId)}/selection`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photo: { url: imageUrl, reference, attributions, priorityLabel, source: "google_places" },
          palette,
          paletteOptions: paletteOptionsByPlace[placeId] || [],
        }),
      }).catch(() => {});
    }
  };

  const buildPaletteOptionsForPlace = async (placeKey: string, place: any) => {
    if (!placeKey || paletteOptionsByPlace[placeKey]?.length > 0) return paletteOptionsByPlace[placeKey] || [];
    const photos = sortedPhotosForPlace(place).slice(0, 5);
    if (photos.length === 0) return [];
    const options: any[] = [];
    for (let index = 0; index < photos.length; index += 1) {
      const photo = photos[index];
      const sourceImageUrl = getPhotoUrl(photo, 480);
      if (!sourceImageUrl) continue;
      let colors = ["#111827", "#4F46E5", "#F3F4F6"];
      try {
        colors = normalizePaletteForContrast(await extractPaletteFromImage(sourceImageUrl));
      } catch (error) {
        console.error(error);
      }
      options.push({
        id: `places-photo-${index + 1}`,
        label: `${photoPriorityLabel(photo, place.name || "Business")} palette ${index + 1}`,
        colors,
        sourceImageUrl,
        photoReference: getPhotoReference(photo),
        attributions: getPhotoAttributions(photo),
        priorityLabel: photoPriorityLabel(photo, place.name || "Business"),
      });
    }
    if (options.length > 0) {
      setPaletteOptionsByPlace(prev => ({ ...prev, [placeKey]: options }));
      await fetch(`/api/prospects/${encodeURIComponent(placeKey)}/selection`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paletteOptions: options }),
      }).catch(() => {});
    }
    return options;
  };

  const inferLocaleFromPlace = (place: any) => {
    const text = [
      place.formatted_address,
      place.formattedAddress,
      place.plus_code?.compound_code,
      place.vicinity,
    ].filter(Boolean).join(" ").toLowerCase();

    if (/\b(united states|usa|tx|texas|ca|california|fl|florida|ny|new york|az|arizona|ga|georgia)\b/.test(text)) {
      return { language: "en", region: "US" };
    }
    if (/\b(indonesia|jakarta|bandung|surabaya|bali|yogyakarta|semarang|medan)\b/.test(text)) {
      return { language: "id", region: "ID" };
    }
    return { language: "en", region: "US" };
  };

  const inferStylePresetFromPlace = (place: any) => {
    const text = [
      place.name,
      place.formatted_address,
      ...(Array.isArray(place.types) ? place.types : []),
    ].filter(Boolean).join(" ").toLowerCase();

    return inferStylePresetFromText(text);
  };

  const faviconSvgForBusiness = (businessName: string, background = "#111827") => {
    const initial = String(businessName || "S").trim().slice(0, 1).toUpperCase() || "S";
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${background}"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="Arial,sans-serif" font-size="34" font-weight="700" fill="white">${initial}</text></svg>`;
  };

  const iconSvgForText = (text: string) => {
    const key = text.toLowerCase();
    if (key.includes("contact") || key.includes("hubung") || key.includes("call")) {
      return "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.34 1.9.63 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.2a2 2 0 0 1 2.11-.45c.91.29 1.85.5 2.81.63A2 2 0 0 1 22 16.92z'/></svg>";
    }
    if (key.includes("local") || key.includes("lokal") || key.includes("maps") || key.includes("location")) {
      return "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M20 10c0 4.99-5.54 10.18-7.4 11.78a1 1 0 0 1-1.2 0C9.54 20.18 4 14.99 4 10a8 8 0 0 1 16 0z'/><circle cx='12' cy='10' r='3'/></svg>";
    }
    if (key.includes("fast") || key.includes("cepat") || key.includes("response")) {
      return "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M4 13a8 8 0 0 1 7-7.94'/><path d='M12 2v4'/><path d='m13 12 4-4'/><path d='M20.49 15A8 8 0 1 1 5 8'/></svg>";
    }
    if (key.includes("product") || key.includes("produk") || key.includes("order")) {
      return "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='m7.5 4.27 9 5.15'/><path d='M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z'/><path d='m3.3 7 8.7 5 8.7-5'/><path d='M12 22V12'/></svg>";
    }
    return "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M20 6 9 17l-5-5'/></svg>";
  };

  const inferProductServiceMode = (place: any) => {
    const text = [place.name, ...(Array.isArray(place.types) ? place.types : [])].join(" ").toLowerCase();
    const productSignals = ["store", "shop", "restaurant", "cafe", "bakery", "meal", "food", "bar", "florist", "clothing", "furniture", "jewelry"];
    const serviceSignals = ["contractor", "repair", "lawyer", "dentist", "doctor", "plumber", "electrician", "cleaning", "salon", "spa", "agency", "service"];
    const hasProducts = productSignals.some((signal) => text.includes(signal));
    const hasServices = serviceSignals.some((signal) => text.includes(signal));
    if (hasProducts && hasServices) return "both";
    if (hasProducts) return "products";
    return hasServices ? "services" : "services";
  };

  const keywordRelevantReviews = (reviews: any[], keywords: string[]) => {
    const normalized = keywords.map((keyword) => keyword.toLowerCase());
    const matching = reviews.filter((review) => {
      const text = String(review.text || "").toLowerCase();
      return normalized.some((keyword) => text.includes(keyword));
    });
    return (matching.length ? matching : reviews).slice(0, 3);
  };

  const meaningfulTypeLabel = (place: any, isEnglish: boolean) => {
    const rawTypes = Array.isArray(place.types) ? place.types.map((item: string) => String(item).replace(/_/g, " ")) : [];
    const generic = new Set(["establishment", "point of interest", "store", "local business"]);
    const fromType = rawTypes.find((type) => type && !generic.has(type.toLowerCase()));
    if (fromType) return fromType;
    const fromQuery = String(place.searchQuery || searchQuery || "").replace(/\b(near me|texas|dallas|usa|united states)\b/gi, "").trim();
    if (fromQuery) return fromQuery;
    return isEnglish ? "local service" : "layanan lokal";
  };

  const titleCaseLabel = (value = "") => {
    const stopWords = new Set(["and", "or", "for", "of", "the", "a", "an", "to", "in", "on", "at", "by", "with", "dan", "atau", "untuk", "di", "ke", "dari", "yang"]);
    return String(value)
      .replace(/[_-]+/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .map((word, index) => {
        const lower = word.toLowerCase();
        if (/^[A-Z0-9]{2,}$/.test(word)) return word;
        if (index > 0 && stopWords.has(lower)) return lower;
        return lower.charAt(0).toUpperCase() + lower.slice(1);
      })
      .join(" ");
  };

  const buildOfferings = (place: any, isEnglish: boolean, mode: string, imageUrl: string, mapsUrl: string) => {
    const typeLabel = titleCaseLabel(meaningfulTypeLabel(place, isEnglish));
    const serviceBase = [
      {
        id: "core-service",
        type: "service",
        title: isEnglish ? titleCaseLabel(`${typeLabel} service`) : "Layanan Utama",
        summary: isEnglish ? `Primary local service from ${place.name}.` : `Layanan utama dari ${place.name} untuk pelanggan lokal.`,
        description: isEnglish ? `Built around the needs customers usually search for when looking for ${typeLabel}.` : `Dibuat berdasarkan kebutuhan pelanggan yang mencari ${typeLabel}.`,
        priceHint: isEnglish ? "Contact for estimate" : "Hubungi untuk estimasi",
        image: imageUrl,
        detailPageId: "service-core-service",
        bestFor: isEnglish ? ["Local customers", "Fast inquiry", "Custom needs"] : ["Pelanggan lokal", "Tanya cepat", "Kebutuhan khusus"],
        included: isEnglish ? ["Initial consultation", "Clear next steps", "Local support"] : ["Konsultasi awal", "Arahan langkah berikutnya", "Dukungan lokal"],
        highlights: [
          { title: isEnglish ? "Easy to contact" : "Mudah dihubungi", description: isEnglish ? "CTA connects directly to the business." : "CTA diarahkan langsung ke kontak bisnis." },
          { title: isEnglish ? "Local relevance" : "Relevan lokal", description: place.formatted_address || place.formattedAddress || "" }
        ],
        relatedReviewKeywords: ["service", "help", "professional", "layanan", "ramah"]
      },
      {
        id: "fast-consultation",
        type: "service",
        title: isEnglish ? "Fast Consultation" : "Konsultasi Cepat",
        summary: isEnglish ? "Ask questions and get clear next steps." : "Tanyakan kebutuhan dan dapatkan arahan yang jelas.",
        description: isEnglish ? "Useful for customers who need to understand availability, pricing, and timing before visiting or booking." : "Cocok untuk pelanggan yang ingin memahami ketersediaan, harga, dan jadwal sebelum datang atau booking.",
        priceHint: isEnglish ? "Fast response" : "Respon cepat",
        image: "",
        detailPageId: "service-fast-consultation",
        bestFor: isEnglish ? ["Price questions", "Availability", "Planning"] : ["Tanya harga", "Cek ketersediaan", "Perencanaan"],
        included: isEnglish ? ["Question intake", "Basic recommendation", "Contact handoff"] : ["Penerimaan pertanyaan", "Rekomendasi awal", "Arahan kontak"],
        highlights: [
          { title: isEnglish ? "Low friction" : "Mudah dimulai", description: isEnglish ? "Customers can call or message directly." : "Pelanggan bisa langsung telepon atau kirim pesan." }
        ],
        relatedReviewKeywords: ["fast", "quick", "response", "cepat", "ramah"]
      }
    ];
    const productBase = [
      {
        id: "featured-product",
        type: "product",
        title: isEnglish ? "Featured Product" : "Produk Unggulan",
        summary: isEnglish ? `A highlighted product or menu item from ${place.name}.` : `Produk atau menu unggulan dari ${place.name}.`,
        description: isEnglish ? "A product-led page for customers who want to understand the item before visiting or ordering." : "Halaman produk untuk pelanggan yang ingin memahami item sebelum datang atau memesan.",
        priceHint: isEnglish ? "Ask for current price" : "Tanya harga terbaru",
        image: imageUrl,
        detailPageId: "product-featured-product",
        bestFor: isEnglish ? ["First-time buyers", "Local pickup", "Popular choice"] : ["Pembeli pertama", "Pickup lokal", "Pilihan populer"],
        included: isEnglish ? ["Product overview", "Current availability", "How to order"] : ["Ringkasan produk", "Ketersediaan terbaru", "Cara pesan"],
        highlights: [
          { title: isEnglish ? "Easy to understand" : "Mudah dipahami", description: isEnglish ? "Clear product benefit and ordering path." : "Benefit produk dan cara pesan dibuat jelas." }
        ],
        relatedReviewKeywords: ["product", "menu", "food", "coffee", "produk", "enak"]
      }
    ];
    if (mode === "products") return productBase;
    if (mode === "both") return [...productBase, ...serviceBase.slice(0, 1)];
    return serviceBase;
  };

  useEffect(() => {
    fetchLeads();
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

  useEffect(() => {
    if (loadingSettings) return;
    const defaultThreshold = String(settings?.SCORING_MIN_SCORE_DEFAULT || "");
    if (scoreThresholdOptions.some((option) => option.value === defaultThreshold)) {
      setMinScoreFilter(defaultThreshold);
    }
  }, [loadingSettings, settings?.SCORING_MIN_SCORE_DEFAULT]);

  useEffect(() => {
    fetchProspectDrafts();
  }, [prospectFilter, websiteFilter, minRatingFilter, minReviewsFilter, cityFilter, stateFilter, nicheFilter]);

  const handleSearch = async (refresh = false) => {
    if (!searchQuery) return;
    setIsSearching(true);
    const shouldPrecheck = autoWebsitePrecheck === "1";
    setSearchMessage(shouldPrecheck
      ? "Searching and pre-checking website status from Place Details..."
      : refresh ? "Refreshing Google Places data..." : "Searching saved cache first...");
    try {
      const params = new URLSearchParams({ query: searchQuery });
      if (refresh) params.set("refresh", "1");
      if (shouldPrecheck) {
        params.set("websitePrecheck", "1");
        params.set("precheckLimit", websitePrecheckLimit || "10");
      }
      const res = await fetch(`/api/places/search?${params.toString()}`);
      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(`Response bukan JSON: ${text.substring(0, 120)}`);
      }

      if (!res.ok) {
        throw new Error(data.error || `Places API returned ${res.status}`);
      }

      const rawResults = Array.isArray(data.results) ? data.results.map((item: any) => ({ ...item, searchQuery })) : [];
      const results = rawResults.filter((item: any) => {
        const hasSite = Boolean(item.website || item.websiteUri);
        if (websiteFilter === "has") return hasSite;
        if (websiteFilter === "none") return !hasSite && item.websiteCheckStatus === "no_website";
        if (websiteFilter === "unknown") return !hasSite && !item.websiteCheckStatus;
        return true;
      });
      setSearchResults(results);
      setSearchActive(true);
      setLeadWorkspaceTab("search");
      setSelectedSearchHistoryKey(data.queryKey || "");
      fetchProspectDrafts();
      fetchSearchHistory();
      setPlaceDetails({});
      setGenerationMessages({});
      if (rawResults.length === 0) {
        setSearchMessage(data.hint || data.error || `Tidak ada hasil untuk "${searchQuery}". Coba query lebih spesifik seperti "concrete contractor Dallas Texas".`);
      } else {
        setSearchMessage(data.mock
          ? "Mode mock aktif karena Google Places API Key belum terbaca."
          : `${results.length} hasil ditampilkan dari ${rawResults.length} hasil${data.cached ? " cache DB" : " Google Places"}${data.websitePrecheck ? " setelah website pre-check" : ""}.`);
      }
    } catch (e) {
      console.error(e);
      setSearchMessage(e instanceof Error ? e.message : "Gagal mencari prospek.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleManualMapsImport = async () => {
    const url = manualMapsUrl.trim();
    const capturedText = manualCaptureText.trim();
    if (!url && !capturedText) {
      setManualImportMessage("Paste a Google Maps URL or captured JSON first.");
      return;
    }

    setManualImportLoading(true);
    setManualImportMessage("Importing manual Google Maps data...");
    try {
      const res = await fetch("/api/places/manual-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, capturedText }),
      });
      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(`Response bukan JSON: ${text.substring(0, 120)}`);
      }
      if (!res.ok || data.error) {
        throw new Error(data.error || `Manual import failed with HTTP ${res.status}`);
      }

      const importedProspects = Array.isArray(data.prospects) ? data.prospects : [];
      if (importedProspects.length > 0) {
        setSearchResults(importedProspects.map((item: any) => ({ ...item, searchQuery: data.query || item.searchQuery || "" })));
        setSearchQuery(data.query || searchQuery);
        setSearchActive(true);
        setSelectedSearchHistoryKey(data.queryKey || "");
        setManualCaptureText("");
      }
      setWebsiteFilter("all");
      fetchProspectDrafts();
      fetchSearchHistory();
      fetchManualDuplicateQueue();
      setManualImportMessage(data.message || `${data.importedCount || 0} manual prospects imported.`);
      if (importedProspects.length > 0) setLeadWorkspaceTab("search");
    } catch (error) {
      console.error(error);
      setManualImportMessage(error instanceof Error ? error.message : "Manual import failed.");
    } finally {
      setManualImportLoading(false);
    }
  };

  const loadPlaceDetails = async (place: any) => {
    const placeKey = getPlaceKey(place);
    const placeId = place?.place_id || place?.id;
    if (!placeId || placeDetailsLoading[placeKey]) return null;
    if (isMapsQueryPlaceholder(place)) {
      setGenerationMessages(prev => ({
        ...prev,
        [placeKey]: {
          type: "error",
          text: "This row is a Maps search/query placeholder, not a specific business listing. Select an actual business result or import captured listing JSON before gathering details.",
        },
      }));
      return null;
    }

    setPlaceDetailsLoading(prev => ({ ...prev, [placeKey]: true }));
    try {
      const res = await fetch(`/api/places/details?placeId=${encodeURIComponent(placeId)}`);
      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(`Response bukan JSON: ${text.substring(0, 120)}`);
      }
      if (!res.ok || data.error) {
        throw new Error(data.error || `Place details returned ${res.status}`);
      }
      if (data.result) {
        const result = data.result;
        const hydratedPlace = {
          ...place,
          ...result,
          place_id: placeId,
          prospectStatus: "details_loaded",
          detailsLoadedAt: new Date().toISOString(),
          photos: Array.isArray(result.photos) && result.photos.length > 0 ? result.photos : place.photos,
        };
        setPlaceDetails(prev => ({ ...prev, [placeKey]: result }));
        setSearchResults(prev => prev.map((item) => getPlaceKey(item) === placeKey ? hydratedPlace : item));
        setProspectDrafts(prev => prev.map((item) => getPlaceKey(item) === placeKey ? hydratedPlace : item));
        const summary = [
          Array.isArray(result.photos) ? `${result.photos.length} photos` : "0 photos",
          Array.isArray(result.reviews) ? `${result.reviews.length} reviews` : "0 reviews",
          placePhone(result) ? "phone" : "no phone",
          placeMapsUrl(result) ? "direct Maps URL" : "no direct Maps URL",
        ].join(", ");
        setGenerationMessages(prev => ({
          ...prev,
          [placeKey]: { type: "success", text: `Google Places details gathered (${summary}). Ready to generate.` },
        }));
        void buildPaletteOptionsForPlace(placeKey, hydratedPlace);
        return result;
      }
    } catch (error) {
      console.error(error);
      setGenerationMessages(prev => ({
        ...prev,
        [placeKey]: { type: "error", text: error instanceof Error ? error.message : "Gagal mengambil detail foto Places." },
      }));
    } finally {
      setPlaceDetailsLoading(prev => ({ ...prev, [placeKey]: false }));
    }
    return null;
  };

  const trimPlacesCache = async () => {
    setIsTrimmingCache(true);
    setCacheTrimMessage("");
    try {
      const res = await fetch("/api/places/cache/trim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ olderThanDays: 30 }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || `Cache trim failed with HTTP ${res.status}`);
      }
      setCacheTrimMessage("Cache pencarian lama/expired sudah dibersihkan.");
      fetchSearchHistory();
    } catch (error) {
      console.error(error);
      setCacheTrimMessage(error instanceof Error ? error.message : "Gagal membersihkan cache.");
    } finally {
      setIsTrimmingCache(false);
    }
  };

  const applySearchHistory = (historyItem: any) => {
    const prospects = Array.isArray(historyItem?.prospects) ? historyItem.prospects : [];
    setSearchQuery(historyItem?.query || "");
    setSearchResults(prospects.map((item: any) => ({ ...item, searchQuery: historyItem?.query || item.searchQuery || "" })));
    setSearchActive(true);
    setLeadWorkspaceTab("search");
    setSelectedSearchHistoryKey(historyItem?.queryKey || "");
    setGenerationMessages({});
    const hydratedDetails = prospects.reduce((acc: Record<string, any>, item: any) => {
      const key = getPlaceKey(item);
      if (key && item.detailsLoadedAt) acc[key] = item;
      return acc;
    }, {});
    if (Object.keys(hydratedDetails).length > 0) {
      setPlaceDetails(prev => ({ ...prev, ...hydratedDetails }));
    }
  };

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

  const skipManualDuplicate = async (place: any) => {
    const placeKey = getPlaceKey(place);
    if (!placeKey) return;
    setManualDuplicateMessage(`Skipping duplicate ${place.name || placeKey}...`);
    try {
      const res = await fetch(`/api/prospects/${encodeURIComponent(placeKey)}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "skipped" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error || `Skip failed with HTTP ${res.status}`);
      setSearchResults((items) => items.filter((item) => getPlaceKey(item) !== placeKey));
      setProspectDrafts((items) => items.filter((item) => getPlaceKey(item) !== placeKey));
      setManualDuplicateMessage("Duplicate skipped.");
      fetchManualDuplicateQueue();
    } catch (error) {
      console.error(error);
      setManualDuplicateMessage(error instanceof Error ? error.message : "Could not skip duplicate.");
    }
  };

  const reviewDuplicateInList = (place: any) => {
    setSearchResults([place]);
    setSearchActive(true);
    setLeadWorkspaceTab("search");
    setManualDuplicateMessage(`Loaded ${place.name || "duplicate prospect"} for review.`);
  };

  const mergeManualDuplicate = async (keepPlace: any, duplicatePlace: any) => {
    const keepPlaceId = getPlaceKey(keepPlace);
    const duplicatePlaceId = getPlaceKey(duplicatePlace);
    if (!keepPlaceId || !duplicatePlaceId || keepPlaceId === duplicatePlaceId) return;
    setManualDuplicateLoading(true);
    setManualDuplicateMessage(`Merging missing fields into ${keepPlace.name || keepPlaceId}...`);
    try {
      const res = await fetch("/api/places/manual-duplicates/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keepPlaceId, duplicatePlaceId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error || `Merge failed with HTTP ${res.status}`);
      const mergedProspect = data.prospect;
      if (mergedProspect) {
        setSearchResults((items) => items
          .filter((item) => getPlaceKey(item) !== duplicatePlaceId)
          .map((item) => getPlaceKey(item) === keepPlaceId ? { ...item, ...mergedProspect } : item));
        setProspectDrafts((items) => items
          .filter((item) => getPlaceKey(item) !== duplicatePlaceId)
          .map((item) => getPlaceKey(item) === keepPlaceId ? { ...item, ...mergedProspect } : item));
      }
      setManualDuplicateMessage(
        data.copiedFields?.length
          ? `Merged ${data.copiedFields.join(", ")} and skipped duplicate.`
          : "No missing fields needed copying; duplicate was skipped.",
      );
      fetchManualDuplicateQueue();
    } catch (error) {
      console.error(error);
      setManualDuplicateMessage(error instanceof Error ? error.message : "Could not merge duplicate.");
    } finally {
      setManualDuplicateLoading(false);
    }
  };

  const mergePreviewFields = (keepPlace: any, duplicatePlace: any) => {
    const fields = [
      { key: "formatted_address", label: "Address", keep: keepPlace?.formatted_address, duplicate: duplicatePlace?.formatted_address },
      { key: "formatted_phone_number", label: "Phone", keep: placePhone(keepPlace), duplicate: placePhone(duplicatePlace) },
      { key: "rating", label: "Rating", keep: keepPlace?.rating, duplicate: duplicatePlace?.rating },
      { key: "user_ratings_total", label: "Reviews", keep: keepPlace?.user_ratings_total || keepPlace?.userRatingCount, duplicate: duplicatePlace?.user_ratings_total || duplicatePlace?.userRatingCount },
      { key: "website", label: "Website", keep: keepPlace?.website || keepPlace?.websiteUri, duplicate: duplicatePlace?.website || duplicatePlace?.websiteUri },
      { key: "url", label: "Maps URL", keep: placeMapsUrl(keepPlace), duplicate: placeMapsUrl(duplicatePlace) },
      { key: "websiteCheckStatus", label: "Website status", keep: keepPlace?.websiteCheckStatus, duplicate: duplicatePlace?.websiteCheckStatus },
    ];
    return fields
      .filter((field) => {
        const keepValue = String(field.keep || "").trim();
        const duplicateValue = String(field.duplicate || "").trim();
        return !keepValue && duplicateValue;
      })
      .map((field) => ({ ...field, value: String(field.duplicate) }));
  };

  const handleGenerateSite = async (place: any) => {
    const placeKey = getPlaceKey(place);
    const cooldown = await getSharedProviderCooldown(activeProviderKey, true);
    if (cooldown) {
      const message = `${activeProviderKey} is cooling down for ${formatCooldownRemaining(cooldown)} after a quota/rate-limit error. Batch generation is paused to avoid repeated 429 failures.`;
      setGenerationMessages(prev => ({
        ...prev,
        [placeKey]: { type: "error", text: message },
      }));
      setBatchMessage(message);
      showToast({
        kind: "warning",
        title: `${activeProviderKey} cooldown active`,
        message,
        actions: ["Wait for the cooldown to end, then retry one prospect.", "Switch provider/model before continuing a batch."],
      });
      await logProviderCooldownBlockedJob({
        provider: activeProviderKey,
        model: activeModel,
        cooldown,
        action: "lead_generate",
        businessName: place?.name || placeKey,
        placeId: String(place?.place_id || place?.id || ""),
        message,
      });
      return false;
    }
    if (isMapsQueryPlaceholder(place)) {
      setGenerationMessages(prev => ({
        ...prev,
        [placeKey]: { type: "error", text: "This row is a Maps search/query placeholder, not a specific business listing. Import captured listing JSON or choose a real Google business result before generating." },
      }));
      return false;
    }
    if (!hasGatheredDetails(place)) {
      setGenerationMessages(prev => ({
        ...prev,
        [placeKey]: { type: "error", text: "Gather Google Places details first so the generated site has phone, direct Maps URL, reviews, and photos." },
      }));
      return false;
    }

    const readiness = await checkAiReadiness(activeProviderKey, activeModel, true, true);
    if (!readiness.ready) {
      const message = readiness.message || "AI provider/model is not ready. Check /admin/settings before generating.";
      await logAiReadinessBlockedJob({
        provider: activeProviderKey,
        model: activeModel,
        readiness,
        action: "lead_generate",
        businessName: place?.name || placeKey,
        placeId: String(place?.place_id || place?.id || ""),
        message,
      });
      setGenerationMessages(prev => ({
        ...prev,
        [placeKey]: { type: "error", text: message },
      }));
      return false;
    }

    const fullPlace = mergePlaceWithDetails(place);
    setIsGenerating(true);
    setGeneratingPlaceKey(placeKey);
    setGenerationMessages(prev => ({ ...prev, [placeKey]: { type: "success", text: "Generating site JSON..." } }));

    // Build a deterministic scaffold locally; /api/sites/generate only asks AI for copy enrichment.
    const businessId = fullPlace.name.toLowerCase().replace(/[^a-z0-9]/g, '-') + "-" + Math.floor(Math.random() * 1000);
    const logoSelection = logoSelections[fullPlace.place_id || fullPlace.name] || logoSelections[placeKey];
    const fallbackPhoto = sortedPhotosForPlace(fullPlace)[0];
    const fallbackImageUrl = fallbackPhoto ? getPhotoUrl(fallbackPhoto, 960) : "";
    const selectedImageUrl = logoSelection?.url || fallbackImageUrl;
    const selectedReference = logoSelection?.reference || (fallbackPhoto ? getPhotoReference(fallbackPhoto) : "");
    const selectedAttributions = logoSelection?.attributions || (fallbackPhoto ? getPhotoAttributions(fallbackPhoto) : []);
    const paletteOptions = paletteOptionsByPlace[placeKey] || fullPlace.paletteOptions || [];
    const brandPalette = logoSelection?.palette || paletteOptions[0]?.colors || [];
    const primaryColor = brandPalette[0] || "#111827";
    const accentColor = brandPalette[1] || "#4F46E5";
    const secondaryColor = brandPalette[2] || "#F3F4F6";
    const phone = placePhone(fullPlace);
    const mapsUrl = placeMapsUrl(fullPlace);
    const rating = Number(fullPlace.rating || 0);
    const reviewCount = Number(fullPlace.user_ratings_total || fullPlace.userRatingCount || 0);
    const locale = inferLocaleFromPlace(fullPlace);
    const stylePreset = inferStylePresetFromPlace(fullPlace);
    const stylePresetMeta = getStylePreset(stylePreset);
    const visualStyle = inferVisualStyleFromText([
      fullPlace.name,
      fullPlace.formatted_address,
      fullPlace.formattedAddress,
      Array.isArray(fullPlace.types) ? fullPlace.types.join(" ") : "",
      fullPlace.searchQuery,
    ].filter(Boolean).join(" "));
    const fontContext = [
      fullPlace.name,
      fullPlace.formatted_address,
      fullPlace.formattedAddress,
      Array.isArray(fullPlace.types) ? fullPlace.types.join(" ") : "",
      fullPlace.searchQuery,
    ].filter(Boolean).join(" ");
    const visualStyleMeta = siteVisualStyles.find((item) => item.id === visualStyle) || siteVisualStyles[0];
    const shaderPreset = inferShaderPresetFromText(fontContext);
    const shaderPresetMeta = getShaderPreset(shaderPreset);
    const fontPairing = inferFontPairingFromText(fontContext);
    const fontPairingMeta = getFontPairing(fontPairing);
    const fontPairingOptions = fontPairingsForText(fontContext, 5);
    const isEnglish = locale.language === "en";
    const googleReviews = Array.isArray(fullPlace.reviews) ? fullPlace.reviews : [];
    const offeringMode = inferProductServiceMode(fullPlace);
    const offerings = buildOfferings(fullPlace, isEnglish, offeringMode, selectedImageUrl, mapsUrl);
    const businessName = fullPlace.name;
    const address = fullPlace.formatted_address || fullPlace.formattedAddress || "";
    const typeLabel = meaningfulTypeLabel(fullPlace, isEnglish);
    const businessStatus = fullPlace.business_status || fullPlace.businessStatus || "";
    const websiteUrl = fullPlace.website || fullPlace.websiteUri || "";
    const products = offerings.filter((item) => item.type === "product");
    const services = offerings.filter((item) => item.type === "service");
    const offeringMenuChildren = offerings.map((item) => ({
      label: item.title,
      href: `#${item.detailPageId}`,
      description: item.type === "product"
        ? (isEnglish ? "Product detail" : "Detail produk")
        : (isEnglish ? "Service detail" : "Detail layanan"),
    }));
    const offeringDetailPages = offerings.map((item) => ({
      pageId: item.detailPageId,
      pageTitle: item.title,
      sections: [
        {
          type: "hero",
          id: `${item.id}-hero`,
          content: {
            headline: isEnglish ? `${item.title} from ${businessName}` : `${item.title} dari ${businessName}`,
            subheadline: item.summary,
            buttons: [
              { text: isEnglish ? "Ask about this" : "Tanya layanan/produk ini", href: "#contact", style: "primary" },
              { text: isEnglish ? "Back to offers" : "Lihat pilihan lain", href: "#services", style: "outline" },
            ],
            image: item.image,
          },
        },
        {
          type: "offeringDetail",
          id: `${item.id}-detail`,
          content: {
            kind: item.type === "product" ? (isEnglish ? "Product" : "Produk") : (isEnglish ? "Service" : "Layanan"),
            title: item.title,
            summary: item.summary,
            description: item.description,
            priceHint: item.priceHint,
            image: item.image,
            bestFor: item.bestFor,
            included: item.included,
            highlights: item.highlights,
          },
        },
        {
          type: "features",
          id: `${item.id}-features`,
          content: {
            title: isEnglish ? `Why choose ${item.title}` : `Kenapa memilih ${item.title}`,
            items: [
              {
                title: item.type === "product" ? (isEnglish ? "Clear product fit" : "Produk mudah dipahami") : (isEnglish ? "Clear service fit" : "Layanan mudah dipahami"),
                description: item.summary,
                iconSvg: iconSvgForText(item.type === "product" ? "product" : "service"),
              },
              {
                title: isEnglish ? "Fast next step" : "Langkah berikutnya cepat",
                description: isEnglish ? "Call, ask questions, or open maps when you are ready for the next step." : "Telepon, bertanya, atau buka maps saat siap mengambil langkah berikutnya.",
                iconSvg: iconSvgForText("fast contact"),
              },
              {
                title: isEnglish ? "Local context" : "Konteks lokal",
                description: address || (isEnglish ? "Built around local customer intent." : "Disusun sesuai kebutuhan pelanggan lokal."),
                iconSvg: iconSvgForText("local maps"),
              },
            ],
          },
        },
        {
          type: "reviews",
          id: `${item.id}-reviews`,
          content: {
            title: isEnglish ? `Relevant customer notes for ${item.title}` : `Catatan pelanggan terkait ${item.title}`,
            reviews: keywordRelevantReviews(googleReviews, item.relatedReviewKeywords),
          },
        },
        {
          type: "faq",
          id: `${item.id}-faq`,
          content: {
            title: isEnglish ? `Questions about ${item.title}` : `Pertanyaan tentang ${item.title}`,
            items: [
              {
                question: isEnglish ? `How do I ask about ${item.title}?` : `Bagaimana cara bertanya tentang ${item.title}?`,
                answer: isEnglish ? "Use the contact button or call the business directly for current availability and pricing." : "Gunakan tombol kontak atau hubungi bisnis langsung untuk ketersediaan dan harga terbaru.",
              },
              {
                question: isEnglish ? "Can details be customized?" : "Apakah detail bisa disesuaikan?",
                answer: isEnglish ? "Yes. Call with your exact need, timing, location, and any requirements so the next step is clear." : "Bisa. Hubungi dengan kebutuhan, waktu, lokasi, dan syarat khusus agar langkah berikutnya jelas.",
              },
            ],
          },
        },
        {
          type: "hoursLocation",
          id: `${item.id}-contact`,
          content: {
            title: isEnglish ? "Contact and location" : "Kontak dan lokasi",
            address,
            phone,
            directionsUrl: mapsUrl,
          },
        },
      ],
    }));
    const mockJson = {
      meta: {
        businessName,
        businessId: businessId,
        niche: typeLabel,
        language: locale.language,
        region: locale.region,
        seoDescription: isEnglish ? `Official website for ${businessName}.` : `Website resmi untuk ${businessName}.`,
        faviconSvg: faviconSvgForBusiness(businessName, primaryColor),
        brandPalette,
      },
      sourceData: {
        provider: "google_places",
        placeId: fullPlace.place_id || fullPlace.id || "",
        resourceName: fullPlace.name?.startsWith?.("places/") ? fullPlace.name : "",
        googleMapsUri: mapsUrl,
        lastSyncedAt: new Date().toISOString(),
        businessStatus,
        pureServiceAreaBusiness: Boolean(fullPlace.pureServiceAreaBusiness),
        hasWebsite: Boolean(websiteUrl),
        websiteUri: websiteUrl || null,
        attributions: logoSelection?.attributions || []
      },
      design: {
        stylePreset,
        stylePresetConfig: {
          label: stylePresetMeta.label,
          mood: stylePresetMeta.mood,
          industries: stylePresetMeta.industries,
          recommendedColors: stylePresetMeta.recommendedColors,
        },
        visualStyle,
        visualStyleConfig: {
          label: visualStyleMeta.label,
          description: visualStyleMeta.description,
          allowedValues: siteVisualStyles.map((item) => item.id),
          selectionRule: "Choose the visual structure that best matches the industry and desired feel.",
        },
        shaderPreset,
        shaderConfig: {
          preset: shaderPreset,
          label: shaderPresetMeta.label,
          description: shaderPresetMeta.description,
          defaultOpacity: shaderPresetMeta.defaultOpacity,
          defaultMotion: shaderPresetMeta.defaultMotion,
          allowedValues: siteShaderPresets.map((item) => item.id),
          selectionRule: "Choose a lightweight CSS procedural shader that matches the industry mood. Use none for maximum restraint.",
        },
        fontPairing,
        fontPairingConfig: {
          label: fontPairingMeta.label,
          headingFont: fontPairingMeta.headingFont,
          bodyFont: fontPairingMeta.bodyFont,
          mood: fontPairingMeta.mood,
          allowedValues: fontPairingOptions.map((item) => item.id),
          selectionRule: "Choose an industry-matched Google Font pairing; owners can switch among these matching options before download.",
        },
        themeVariables: {
          colors: {
            primary: primaryColor,
            secondary: secondaryColor,
            accent: accentColor,
            textMain: "#1F2937",
            textMuted: "#6B7280",
            background: "#FFFFFF"
          },
          typography: {
            headingFont: fontPairingMeta.headingCss,
            bodyFont: fontPairingMeta.bodyCss
          }
        }
      },
      brand: {
        logoImageUrl: selectedImageUrl,
        logoSvg: "",
        faviconSvg: faviconSvgForBusiness(businessName, primaryColor),
        palette: brandPalette,
        paletteOptions,
        preferredHeroImage: selectedImageUrl,
        photoSource: selectedImageUrl ? (logoSelection?.source || "google_places") : "",
        googlePhotoReference: selectedReference,
        photoCaption: selectedImageUrl ? "Photo from Google Business Profile" : "",
        photoAttributions: selectedAttributions,
        selectedPhotoPriority: logoSelection?.priorityLabel || ""
      },
      businessProfile: {
        name: businessName,
        primaryType: typeLabel,
        typeLabel,
        categories: Array.isArray(fullPlace.types) ? fullPlace.types : [],
        shortPitch: isEnglish
          ? `A trusted ${typeLabel} serving customers around ${address || "the local area"}.`
          : `Layanan lokal terpercaya di ${address || "area sekitar"}.`,
        address: {
          formatted: address,
        },
        contact: {
          phoneNational: phone,
          phoneInternational: phone,
          directionsUrl: mapsUrl
        }
      },
      trust: {
        rating,
        reviewCount,
        reviewSummary: reviewCount
          ? isEnglish
            ? `${businessName} has a ${rating.toFixed(1)} rating from ${reviewCount} Google reviews.`
            : `${businessName} memiliki rating ${rating.toFixed(1)} dari ${reviewCount} review Google.`
          : "",
        reviews: googleReviews.slice(0, 3).map((review: any) => ({
          authorName: review.author_name || review.authorName || "Google reviewer",
          rating: Number(review.rating || 5),
          text: review.text || "",
          relativePublishTimeDescription: review.relative_time_description || review.relativePublishTimeDescription || "",
          attribution: "Google",
        })),
        badges: [
          businessStatus === "OPERATIONAL" ? "Operational" : "",
          websiteUrl ? "Has website" : "No website lead",
          phone ? "Has phone" : ""
        ].filter(Boolean)
      },
      productServiceStrategy: {
        mode: offeringMode,
        reasoning: isEnglish
          ? "The generator inferred whether this business should emphasize products, services, or both from Google Places types and the business name."
          : "Generator menentukan apakah bisnis ini lebih cocok menampilkan produk, layanan, atau keduanya dari tipe Google Places dan nama bisnis.",
        navbarGroupLabel: offeringMode === "products"
          ? (isEnglish ? "Products" : "Produk")
          : offeringMode === "both"
            ? (isEnglish ? "Products & Services" : "Produk & Layanan")
            : (isEnglish ? "Services" : "Layanan"),
        detailPageRule: isEnglish
          ? "Each offering has a dedicated page with overview, benefits, included details, reviews, FAQ, and conversion CTA."
          : "Setiap penawaran punya halaman detail berisi overview, manfaat, detail yang termasuk, review, FAQ, dan CTA."
      },
      products,
      services,
      offers: offerings.map((item) => ({
        title: item.title,
        description: item.summary,
        priceHint: item.priceHint,
        image: item.image,
        cta: { text: isEnglish ? "View details" : "Lihat detail", href: `#${item.detailPageId}` },
      })),
      capabilities: [
        { label: isEnglish ? "Local business" : "Bisnis lokal", enabled: true, source: "google_places.types", description: isEnglish ? "Business profile data is gathered from Google Places." : "Profil bisnis diambil dari data Google Places." },
        { label: "Google rating", enabled: rating > 0, source: "google_places.rating", description: reviewCount ? (isEnglish ? `${reviewCount} reviews available.` : `${reviewCount} review tersedia.`) : (isEnglish ? "Rating is not available yet." : "Rating belum tersedia.") },
        { label: isEnglish ? "Direct contact" : "Kontak langsung", enabled: Boolean(phone), source: "google_places.phone", description: isEnglish ? "CTA points to the business contact when available." : "CTA diarahkan ke kontak bisnis." }
      ],
      location: {
        formattedAddress: address,
        directionsUrl: mapsUrl,
        isServiceAreaBusiness: Boolean(fullPlace.pureServiceAreaBusiness)
      },
      hours: {
        timezone: "",
        openNow: Boolean(fullPlace.opening_hours?.open_now),
        regular: Array.isArray(fullPlace.opening_hours?.weekday_text) ? fullPlace.opening_hours.weekday_text : [],
        current: []
      },
      conversion: {
        primaryCta: { text: isEnglish ? "Call Now" : "Hubungi Sekarang", href: phone ? `tel:${phone}` : "#contact" },
        secondaryCta: { text: isEnglish ? "Open Maps" : "Buka Maps", href: mapsUrl || "#contact" },
        stickyMobileCta: true,
        leadForm: { enabled: true, fields: ["name", "phone", "message"], submitLabel: "Kirim Pesan" }
      },
      seo: {
        title: isEnglish ? `${businessName} - Official Website` : `${businessName} - Website Resmi`,
        description: isEnglish ? `Official website for ${businessName} in ${address || "the local area"}.` : `Website resmi untuk ${businessName} di ${address || "area lokal"}.`,
        localBusinessSchema: {},
        keywords: Array.isArray(fullPlace.types) ? fullPlace.types : [],
        cityLandingPhrase: address
      },
      global: {
        header: {
          logoImageUrl: logoSelection?.url || "",
          ctaButton: { text: isEnglish ? "Call Now" : "Hubungi", href: phone ? `tel:${phone}` : "#contact" }
        },
        footer: { text: `© 2026 ${businessName}. All rights reserved.` }
      },
      navigation: {
        headerMenu: [
          { label: isEnglish ? "Home" : "Beranda", href: "#home" },
          {
            label: offeringMode === "products"
              ? (isEnglish ? "Products" : "Produk")
              : offeringMode === "both"
                ? (isEnglish ? "Products & Services" : "Produk & Layanan")
                : (isEnglish ? "Services" : "Layanan"),
            href: "#services",
            children: offeringMenuChildren,
          },
          { label: isEnglish ? "Contact" : "Kontak", href: "#contact" }
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
                headline: isEnglish ? `${businessName} is ready to help locally` : `${businessName} siap membantu kebutuhan lokal Anda`,
                subheadline: address || (isEnglish ? "Business information from Google Places." : "Informasi bisnis dari Google Places."),
                buttons: [
                  { text: isEnglish ? "Contact Us" : "Hubungi Kami", href: "#contact", style: "primary" },
                  { text: isEnglish ? "Open Maps" : "Buka Maps", href: mapsUrl || "#contact", style: "outline" }
                ],
                image: selectedImageUrl
              }
            },
            { type: "trustBar", id: "trust-1", content: {} },
            {
              type: "features",
              id: "features-1",
              content: {
                title: isEnglish ? "Why this business stands out" : "Kenapa bisnis ini relevan",
                items: [
                  { title: isEnglish ? "Local business profile" : "Profil bisnis lokal", description: businessStatus || (isEnglish ? "Find service details, location, and next steps in one place." : "Temukan detail layanan, lokasi, dan langkah berikutnya di satu tempat."), iconSvg: iconSvgForText("local maps") },
                  { title: isEnglish ? "Easy to contact" : "Mudah dihubungi", description: phone || (isEnglish ? "Reach out with your questions and preferred timing." : "Hubungi kami dengan pertanyaan dan waktu yang diinginkan."), iconSvg: iconSvgForText("contact call") },
                  { title: isEnglish ? "Simple next step" : "Langkah berikutnya mudah", description: websiteUrl ? (isEnglish ? "Review the available details, then contact us when you are ready." : "Lihat detail yang tersedia, lalu hubungi kami saat siap.") : (isEnglish ? "Call or send a question to confirm service fit and availability." : "Telepon atau kirim pertanyaan untuk memastikan kecocokan layanan dan ketersediaan."), iconSvg: iconSvgForText("contact next step") }
                ]
              }
            },
            { type: "offers", id: "offers-1", content: { title: isEnglish ? "Services to highlight" : "Layanan yang bisa ditonjolkan" } },
            { type: "reviews", id: "reviews-1", content: { title: isEnglish ? "Google social proof" : "Social proof dari Google" } },
            {
              type: "hoursLocation",
              id: "location-1",
              content: {
                title: isEnglish ? "Location and contact" : "Lokasi dan kontak",
                address,
                phone,
                directionsUrl: mapsUrl
              }
            },
            {
              type: "faq",
              id: "faq-1",
              content: {
                title: isEnglish ? "Common questions" : "Pertanyaan umum",
                items: [
                  { question: isEnglish ? "How do I contact this business?" : "Bagaimana cara menghubungi bisnis ini?", "answer": phone ? (isEnglish ? `Call directly at ${phone}.` : `Hubungi langsung di ${phone}.`) : (isEnglish ? "Phone number is not available yet and can be completed manually." : "Nomor telepon belum tersedia dan bisa dilengkapi manual.") },
                  { question: isEnglish ? "What should I prepare before contacting you?" : "Apa yang perlu disiapkan sebelum menghubungi?", "answer": isEnglish ? "Share what you need, your location, preferred timing, and any important details so we can point you to the right next step." : "Sampaikan kebutuhan, lokasi, waktu yang diinginkan, dan detail penting agar kami bisa mengarahkan langkah berikutnya." }
                ]
              }
            }
          ]
        },
        ...offeringDetailPages
      ]
    };

    try {
      const response = await fetch("/api/sites/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requireAi: true,
          model: activeModel,
          provider: activeProviderKey,
          jsonContent: mockJson,
          businessId,
          businessName,
          phone,
          originData: fullPlace,
          brandPalette,
          paletteOptions,
          selectedLogoImageUrl: selectedImageUrl,
          selectedLogoReference: selectedReference,
          selectedLogoSource: selectedImageUrl ? (logoSelection?.source || "google_places") : "",
          selectedLogoAttributions: selectedAttributions,
          selectedLogoPriority: logoSelection?.priorityLabel || ""
        })
      });
      const data = await readApiJson<any>(response, "Generate site");

      fetchLeads();
      fetchProspectDrafts();
      fetchGenerationJobs();
      setGenerationMessages(prev => ({
        ...prev,
        [placeKey]: {
          type: "success",
          text: data.generatedWithAi === false
            ? "Site saved with fallback copy only. Check Jobs for the AI copy patch error."
            : "Site generated with AI-enriched copy. Preview is ready.",
          businessId: data.businessId || businessId,
        },
      }));
      return true;
    } catch (e) {
      console.error(e);
      showApiError(e, { source: "Generate site", provider: activeProviderKey, model: activeModel });
      setGenerationMessages(prev => ({
        ...prev,
        [placeKey]: { type: "error", text: e instanceof Error ? e.message : "Generate site gagal. Hasil pencarian tetap disimpan di layar." },
      }));
      fetchGenerationJobs();
      return false;
    } finally {
      setIsGenerating(false);
      setGeneratingPlaceKey("");
    }
  };

  const updateStatus = async (id: string, newStatus: string) => {
    await fetch(`/api/leads/${id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus })
    });
    fetchLeads();
  };

  const hasWebsite = (place: any) => Boolean(place.website || place.websiteUri);
  const websiteBadge = (place: any) => {
    if (hasWebsite(place)) {
      return { label: "Has website", className: "bg-amber-100 text-amber-800", title: "Website found from Google Places data." };
    }
    if (place.websiteCheckStatus === "no_website") {
      return { label: "No website verified", className: "bg-emerald-100 text-emerald-800", title: "Place Details pre-check did not return a website." };
    }
    if (place.websiteCheckStatus === "error") {
      return { label: "Website check error", className: "bg-red-100 text-red-800", title: place.websiteCheckError || "Website pre-check failed. Try Gather data." };
    }
    if (!hasGatheredDetails(place)) {
      return { label: "Website unknown", className: "bg-slate-100 text-slate-700", title: "Text Search often does not include website. Click Gather data to call Place Details." };
    }
    return { label: "No website verified", className: "bg-emerald-100 text-emerald-800", title: "No website returned by Google Place Details." };
  };
  const isUsMarket = (place: any) => {
    const text = [
      place.formatted_address,
      place.formattedAddress,
      place.address,
      place.vicinity,
      place.plus_code?.compound_code,
      place.region,
    ].filter(Boolean).join(" ").toLowerCase();
    return /\b(united states|usa|tx|texas|ca|california|fl|florida|ny|new york|az|arizona|ga|georgia|il|illinois|pa|pennsylvania|oh|ohio|nc|north carolina|mi|michigan|nj|new jersey|va|virginia|wa|washington|tn|tennessee|ma|massachusetts|in|indiana|mo|missouri|md|maryland|wi|wisconsin|co|colorado|mn|minnesota|sc|south carolina|al|alabama|la|louisiana|ky|kentucky|or|oregon|ok|oklahoma|ct|connecticut|ut|utah|ia|iowa|nv|nevada|ar|arkansas|ms|mississippi|ks|kansas|nm|new mexico|ne|nebraska|id|idaho|wv|west virginia|hi|hawaii|nh|new hampshire|me|maine|mt|montana|ri|rhode island|de|delaware|sd|south dakota|nd|north dakota|ak|alaska|vt|vermont|wy|wyoming)\b/.test(text);
  };
  const prospectScore = (place: any) => {
    const rating = Number(place.rating || 0);
    const reviews = Number(place.user_ratings_total || place.userRatingCount || place.reviews || 0);
    const phone = placePhone(place);
    let score = 0;
    const reasons: string[] = [];
    const breakdown: { label: string; points: number; detail: string }[] = [];
    const addScore = (label: string, points: number, detail: string) => {
      score += points;
      reasons.push(label);
      breakdown.push({ label, points, detail });
    };

    if (place.websiteCheckStatus === "no_website" && !hasWebsite(place)) {
      addScore("no website verified", scoreWeights.noWebsiteVerified, "Place Details did not return a website.");
    } else if (hasWebsite(place)) {
      addScore("has website", scoreWeights.hasWebsitePenalty, "Existing website lowers outreach priority.");
    } else {
      addScore("website unknown", scoreWeights.websiteUnknownPenalty, "Run website pre-check or gather data to confirm.");
    }

    if (rating >= 4.5) {
      addScore("4.5+ rating", scoreWeights.rating45Plus, `Rating: ${rating.toFixed(1)}.`);
    } else if (rating >= 4) {
      addScore("4.0+ rating", scoreWeights.rating40Plus, `Rating: ${rating.toFixed(1)}.`);
    }

    if (reviews >= 10 && reviews <= 100) {
      addScore("10-100 reviews", scoreWeights.reviews10To100, `${reviews} reviews is enough proof without looking too enterprise.`);
    } else if (reviews > 100 && reviews <= 300) {
      addScore("established reviews", scoreWeights.reviews101To300, `${reviews} reviews.`);
    } else if (reviews > 0 && reviews < 10) {
      addScore("some reviews", scoreWeights.reviews1To9, `${reviews} reviews.`);
    }

    if (phone) {
      addScore("phone exists", scoreWeights.phoneExists, phone);
    }
    if (isUsMarket(place)) {
      addScore("US market", scoreWeights.usMarket, "US leads fit the high-value target market.");
    }
    if (!place.generatedBusinessId) {
      addScore("not generated yet", scoreWeights.notGeneratedYet, "No generated site linked yet.");
    }
    if (hasGatheredDetails(place)) {
      addScore("details gathered", scoreWeights.detailsGathered, "Ready for richer generation.");
    }

    return { score: Math.max(0, Math.round(score)), rawScore: Math.round(score), reasons, breakdown };
  };
  const activeWorkspaceTab = ["search", "crm", "history"].includes(leadWorkspaceTab) ? leadWorkspaceTab : "search";
  const visibleProspectsRaw = activeWorkspaceTab === "search" ? searchResults : prospectDrafts;
  const minScore = Number(minScoreFilter || 0);
  const visibleProspects = [...visibleProspectsRaw]
    .filter((place) => prospectScore(place).score >= minScore)
    .sort((a, b) => prospectScore(b).score - prospectScore(a).score);
  const selectedVisibleProspects = visibleProspects.filter((place) => selectedProspects[getPlaceKey(place)]);
  const statusLabels: Record<string, string> = {
    active: "Active pipeline",
    new: "New",
    details_loaded: "Details loaded",
    site_generated: "Site generated",
    contacted: "Contacted",
    skipped: "Skipped",
    all: "All saved",
  };
  const websiteLabels: Record<string, string> = {
    none: "No website",
    unknown: "Unknown website",
    has: "Has website",
    all: "All websites",
  };
  const activeFilterChips = [
    prospectFilter !== "active" ? `Status: ${statusLabels[prospectFilter] || prospectFilter}` : "",
    websiteFilter !== "all" ? `Website: ${websiteLabels[websiteFilter] || websiteFilter}` : "",
    minRatingFilter !== "0" ? `Rating ${minRatingFilter}+` : "",
    minReviewsFilter !== "0" ? `Reviews ${minReviewsFilter}+` : "",
    minScoreFilter !== "0" ? `Score ${minScoreFilter}+` : "",
    cityFilter.trim() ? `City: ${cityFilter.trim()}` : "",
    stateFilter.trim() ? `State: ${stateFilter.trim()}` : "",
    nicheFilter.trim() ? `Niche: ${nicheFilter.trim()}` : "",
    autoWebsitePrecheck !== "1" ? "No pre-check" : "",
    websitePrecheckLimit !== "10" ? `Check top ${websitePrecheckLimit}` : "",
  ].filter(Boolean);
  const resetLeadFilters = () => {
    setProspectFilter("active");
    setWebsiteFilter("none");
    setMinRatingFilter("0");
    setMinReviewsFilter("0");
    setMinScoreFilter("0");
    setCityFilter("");
    setStateFilter("");
    setNicheFilter("");
    setAutoWebsitePrecheck("1");
    setWebsitePrecheckLimit("10");
  };

  const toggleProspectSelection = (place: any, checked: boolean) => {
    const placeKey = getPlaceKey(place);
    if (!placeKey) return;
    setSelectedProspects(prev => ({ ...prev, [placeKey]: checked }));
  };

  const startBatchGenerate = async () => {
    if (selectedVisibleProspects.length === 0 || batchQueueRunning) return;
    setBatchQueueRunning(true);
    setBatchMessage(`Starting queue for ${selectedVisibleProspects.length} prospects...`);
    let pausedForCooldown = false;
    for (let index = 0; index < selectedVisibleProspects.length; index += 1) {
      const place = selectedVisibleProspects[index];
      const cooldown = await getSharedProviderCooldown(activeProviderKey, true);
      if (cooldown) {
        const message = `${activeProviderKey} is cooling down for ${formatCooldownRemaining(cooldown)} after a quota/rate-limit error. Queue paused before prospect ${index + 1}/${selectedVisibleProspects.length}.`;
        setBatchMessage(message);
        await logProviderCooldownBlockedJob({
          provider: activeProviderKey,
          model: activeModel,
          cooldown,
          action: "lead_batch_generate",
          businessName: place?.name || getPlaceKey(place),
          placeId: String(place?.place_id || place?.id || ""),
          message,
        });
        pausedForCooldown = true;
        break;
      }
      setBatchMessage(`Generating ${index + 1}/${selectedVisibleProspects.length}: ${place.name}`);
      const generated = await handleGenerateSite(place);
      if (!generated && (await getSharedProviderCooldown(activeProviderKey, true))) {
        pausedForCooldown = true;
        break;
      }
    }
    setBatchQueueRunning(false);
    if (!pausedForCooldown) setBatchMessage("Batch queue finished.");
    if (!pausedForCooldown) setSelectedProspects({});
    fetchGenerationJobs();
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
          <button
            type="button"
            onClick={trimPlacesCache}
            disabled={isTrimmingCache}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {isTrimmingCache ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
            Trim cache 30d
          </button>
        </div>
        <div className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
          <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-950">
                Manual Google Maps import
                <HelpTooltip text="Fallback for quota outages: paste a single Google Maps listing URL, or paste captured JSON from the browser helper when you are on a Maps search result page." />
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Listing URLs can create one draft. Search URLs need captured browser JSON because Google Maps renders the business cards inside the page.
              </p>
            </div>
            <HoverTooltip text="Open the extension helper instructions for capturing visible Google Maps cards.">
              <a
                href="/tools/google-maps-capture-extension/README.md"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
              >
                <ExternalLink size={14} />
                Capture helper
              </a>
            </HoverTooltip>
          </div>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <label className="text-sm">
              <span className="mb-1 flex items-center gap-1.5 font-medium text-slate-700">
                Google Maps URL
                <HelpTooltip text="Paste a /maps/place listing URL for one business, or the /maps/search URL you used while capturing visible listings with the extension helper." />
              </span>
              <input
                value={manualMapsUrl}
                onChange={(event) => setManualMapsUrl(event.target.value)}
                placeholder="https://www.google.com/maps/place/..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 flex items-center gap-1.5 font-medium text-slate-700">
                Captured listing JSON
                <HelpTooltip text="Optional for one listing. Required for Maps search pages; paste the JSON copied by the Chrome/Opera helper so each visible business becomes a prospect draft." />
              </span>
              <textarea
                value={manualCaptureText}
                onChange={(event) => setManualCaptureText(event.target.value)}
                rows={3}
                placeholder='[{"name":"Business Name","address":"...","hasWebsite":false}]'
                className="min-h-[42px] w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>
          </div>
          <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <p className={`text-xs ${manualImportMessage.includes("failed") || manualImportMessage.includes("Paste") ? "text-red-700" : "text-slate-600"}`}>
              {manualImportMessage || "Imported drafts appear in the same prospect pipeline below."}
            </p>
            <HoverTooltip text="Import URL-derived or browser-captured Google Maps data into prospect drafts.">
              <button
                type="button"
                onClick={handleManualMapsImport}
                disabled={manualImportLoading}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {manualImportLoading ? <Loader2 className="animate-spin" size={16} /> : <ListChecks size={16} />}
                Import manual prospects
              </button>
            </HoverTooltip>
          </div>
        </div>
        </>
        )}
        {activeWorkspaceTab === "history" && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                <History size={16} />
                Search history
                <HelpTooltip text="Each search term keeps its cached result list, while every business card is hydrated from the current Google place_id prospect record. This lets the same business keep one shared progress history across searches." />
              </p>
            </div>
            <button
              type="button"
              onClick={fetchSearchHistory}
              disabled={loadingSearchHistory}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {loadingSearchHistory ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
              Refresh history
            </button>
          </div>
          {searchHistory.length > 0 ? (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {searchHistory.map((item) => {
                const summary = item.summary || {};
                const active = selectedSearchHistoryKey === item.queryKey;
                return (
                  <HoverTooltip key={item.queryKey || item.query} text="Load this cached search term and show current progress per Google Business listing.">
                    <button
                      type="button"
                      onClick={() => applySearchHistory(item)}
                      className={`min-w-[260px] rounded-xl border p-3 text-left transition ${
                        active ? "border-indigo-300 bg-indigo-50" : "border-slate-200 bg-slate-50 hover:bg-white"
                      }`}
                    >
                      <span className="block truncate text-sm font-semibold text-slate-950">{item.query}</span>
                      <span className="mt-1 block text-xs text-slate-500">
                        {summary.total || item.resultCount || 0} results
                        {item.updatedAt ? ` · ${new Date(item.updatedAt).toLocaleDateString()}` : ""}
                      </span>
                      <span className="mt-2 flex flex-wrap gap-1.5">
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">{summary.noWebsite || 0} no site</span>
                        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-800">{summary.detailsLoaded || 0} gathered</span>
                        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-800">{summary.generated || 0} generated</span>
                        {(summary.errors || 0) > 0 && (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-800">{summary.errors} error</span>
                        )}
                      </span>
                    </button>
                  </HoverTooltip>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-500">
              Search history will appear after Google Places searches are cached.
            </div>
          )}
        </div>
        )}
        {activeWorkspaceTab === "crm" && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-950">
                Manual duplicate review
                <HelpTooltip text="Shows likely duplicate prospects when a manual URL-only import and a Maps DOM capture describe the same business with different IDs. Skipping a duplicate uses the normal prospect status workflow." />
              </p>
              <p className="mt-1 text-xs text-amber-800">
                {manualDuplicateQueue.length > 0
                  ? `${manualDuplicateQueue.length} possible duplicate group${manualDuplicateQueue.length === 1 ? "" : "s"} need review.`
                  : "No likely manual duplicates found."}
              </p>
              {manualDuplicateMessage && <p className="mt-1 text-xs font-medium text-amber-900">{manualDuplicateMessage}</p>}
            </div>
            <button
              type="button"
              onClick={fetchManualDuplicateQueue}
              disabled={manualDuplicateLoading}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
            >
              {manualDuplicateLoading ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
              Refresh duplicates
            </button>
          </div>
          {manualDuplicateQueue.length > 0 && (
            <div className="grid gap-3">
              {manualDuplicateQueue.slice(0, 5).map((group) => (
                <div key={group.id || group.key} className="rounded-xl border border-amber-200 bg-white p-3">
                  <p className="text-xs font-semibold text-amber-900">{group.reason || "Likely duplicate manual import"}</p>
                  <div className="mt-3 grid gap-2 lg:grid-cols-2">
                    {(Array.isArray(group.prospects) ? group.prospects : []).map((place: any, index: number) => {
                      const keepPlace = Array.isArray(group.prospects) ? group.prospects[0] : null;
                      const placeKey = getPlaceKey(place);
                      const suggestedKeep = index === 0;
                      const previewFields = suggestedKeep ? [] : mergePreviewFields(keepPlace, place);
                      return (
                        <div key={placeKey || index} className={`rounded-lg border p-3 ${suggestedKeep ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-950">{place.name || "Untitled business"}</p>
                              <p className="mt-1 text-xs text-slate-600">{place.formatted_address || place.searchQuery || placeKey}</p>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {place.duplicateManualImport && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">manual</span>}
                                {place.detailsLoadedAt && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-800">details</span>}
                                {place.generatedBusinessId && <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-800">generated</span>}
                                {suggestedKeep && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">suggest keep</span>}
                              </div>
                              {!suggestedKeep && (
                                <div className="mt-3 rounded-lg border border-slate-200 bg-white p-2">
                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Merge preview</p>
                                  {previewFields.length > 0 ? (
                                    <div className="mt-1 space-y-1">
                                      {previewFields.map((field) => (
                                        <p key={field.key} className="text-[11px] text-slate-700">
                                          <span className="font-semibold">{field.label}:</span> {field.value}
                                        </p>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="mt-1 text-[11px] text-slate-500">No missing phone/address/rating/website fields would be copied. Merge will only skip this duplicate.</p>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="flex shrink-0 flex-col gap-1.5">
                              <button
                                type="button"
                                onClick={() => reviewDuplicateInList(place)}
                                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                              >
                                Review
                              </button>
                              {!suggestedKeep && (
                                <>
                                <button
                                  type="button"
                                  onClick={() => mergeManualDuplicate(keepPlace, place)}
                                  className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"
                                >
                                  Merge + skip
                                </button>
                                <button
                                  type="button"
                                  onClick={() => skipManualDuplicate(place)}
                                  className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100"
                                >
                                  Skip
                                </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        )}
        {activeWorkspaceTab !== "history" && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setFiltersOpen(filtersOpen === "1" ? "0" : "1")}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${
                  filtersOpen === "1" ? "border-indigo-300 bg-indigo-50 text-indigo-800" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                }`}
              >
                <SlidersHorizontal size={16} />
                Filters
                <span className="rounded-full bg-slate-900 px-1.5 py-0.5 text-[10px] text-white">{activeFilterChips.length}</span>
              </button>
              {activeFilterChips.slice(0, 6).map((chip) => (
                <span key={chip} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700">
                  {chip}
                </span>
              ))}
              {activeFilterChips.length > 6 && (
                <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700">+{activeFilterChips.length - 6}</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={resetLeadFilters}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                <X size={14} />
                Reset
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearchActive(false);
                  fetchProspectDrafts();
                }}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                <RefreshCw size={14} />
                Reload drafts
              </button>
            </div>
          </div>

          {filtersOpen === "1" && (
            <div className="mt-3 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-3 xl:grid-cols-5">
              <label className="text-sm">
                <span className="mb-1 flex items-center gap-1.5 font-medium text-slate-700">
                  Status
                  <HelpTooltip text="Active pipeline hides skipped and already generated prospects. All saved shows every saved prospect draft regardless of workflow status." />
                </span>
                <select value={prospectFilter} onChange={(event) => setProspectFilter(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="active">Active pipeline</option>
                  <option value="new">New</option>
                  <option value="details_loaded">Details loaded</option>
                  <option value="site_generated">Site generated</option>
                  <option value="contacted">Contacted</option>
                  <option value="skipped">Skipped</option>
                  <option value="all">All saved</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 flex items-center gap-1.5 font-medium text-slate-700">
                  Website
                  <HelpTooltip text="No website verified means Place Details was checked and did not return a website. Unknown means the listing has not been checked yet." />
                </span>
                <select value={websiteFilter} onChange={(event) => setWebsiteFilter(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="none">No website verified first</option>
                  <option value="unknown">Website unknown</option>
                  <option value="has">Has website</option>
                  <option value="all">All</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 flex items-center gap-1.5 font-medium text-slate-700">
                  Rating
                  <HelpTooltip text="Minimum Google rating filter. Higher ratings usually improve conversion, but very new businesses may have useful low review counts." />
                </span>
                <select value={minRatingFilter} onChange={(event) => setMinRatingFilter(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="0">Any rating</option>
                  <option value="3.5">3.5+</option>
                  <option value="4">4.0+</option>
                  <option value="4.5">4.5+</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 flex items-center gap-1.5 font-medium text-slate-700">
                  Reviews
                  <HelpTooltip text="Minimum Google review count. The score formula favors enough reviews for trust while avoiding businesses that may already have mature marketing." />
                </span>
                <select value={minReviewsFilter} onChange={(event) => setMinReviewsFilter(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="0">Any reviews</option>
                  <option value="10">10+</option>
                  <option value="25">25+</option>
                  <option value="50">50+</option>
                  <option value="100">100+</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 flex items-center gap-1.5 font-medium text-slate-700">
                  Score
                  <HelpTooltip text="Conversion score prioritizes verified no-website businesses with strong rating, useful review count, phone, US market, and no generated site yet." />
                </span>
                <select value={minScoreFilter} onChange={(event) => setMinScoreFilter(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500">
                  {scoreThresholdOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 flex items-center gap-1.5 font-medium text-slate-700">
                  City
                  <HelpTooltip text="Client-side filter against the saved address/city fields. Useful after broad searches like a whole metro area." />
                </span>
                <input value={cityFilter} onChange={(event) => setCityFilter(event.target.value)} placeholder="Dallas" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
              </label>
              <label className="text-sm">
                <span className="mb-1 flex items-center gap-1.5 font-medium text-slate-700">
                  State
                  <HelpTooltip text="Client-side state/region filter. For US prospects, use two-letter state codes when possible." />
                </span>
                <input value={stateFilter} onChange={(event) => setStateFilter(event.target.value)} placeholder="TX" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
              </label>
              <label className="text-sm">
                <span className="mb-1 flex items-center gap-1.5 font-medium text-slate-700">
                  Niche
                  <HelpTooltip text="Filters by business type/category/search niche. This helps narrow broad cached search results before batch generation." />
                </span>
                <input value={nicheFilter} onChange={(event) => setNicheFilter(event.target.value)} placeholder="concrete" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
              </label>
              <label className="text-sm">
                <span className="mb-1 flex items-center gap-1.5 font-medium text-slate-700">
                  Website check
                  <HelpTooltip text="Auto pre-check calls lightweight Place Details for top search results so existing-website businesses can be deprioritized before gather/generate." />
                </span>
                <select value={autoWebsitePrecheck} onChange={(event) => setAutoWebsitePrecheck(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="1">Auto pre-check</option>
                  <option value="0">Search only</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 flex items-center gap-1.5 font-medium text-slate-700">
                  Check limit
                  <HelpTooltip text="Controls how many top Google Places results get website pre-check calls during search. Higher is more accurate but uses more Places Details requests." />
                </span>
                <select value={websitePrecheckLimit} onChange={(event) => setWebsitePrecheckLimit(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="5">Top 5</option>
                  <option value="10">Top 10</option>
                  <option value="20">Top 20</option>
                </select>
              </label>
            </div>
          )}
        </div>
        )}
        {activeWorkspaceTab === "search" && (
        <>
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch(false)}
              placeholder="Contoh: Kedai Kopi di Senopati" 
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <button 
            onClick={() => handleSearch(false)}
            disabled={isSearching}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition flex items-center justify-center min-w-[120px]"
          >
            {isSearching ? <Loader2 className="animate-spin" size={20} /> : "Cari"}
          </button>
          <HoverTooltip text="Abaikan cache DB dan ambil ulang dari Google Places">
            <button
              type="button"
              onClick={() => handleSearch(true)}
              disabled={isSearching || !searchQuery}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </HoverTooltip>
        </div>

        {searchMessage && (
          <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
            searchResults.length > 0
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}>
            {searchMessage}
          </div>
        )}
        </>
        )}

        {activeWorkspaceTab !== "history" && visibleProspects.length > 0 && (
          <div className="mt-6 space-y-4">
            <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="inline-flex items-center gap-1.5 font-semibold text-slate-900">
                  {activeWorkspaceTab === "search" ? "Current search results" : "Saved prospect drafts"}
                  <HelpTooltip text="Bulk buttons act only on the visible filtered list. Generate selected runs sequentially from the browser so AI requests are not fired all at once." />
                </p>
                <p className="inline-flex items-center gap-1.5">
                  {visibleProspects.length} visible. {selectedVisibleProspects.length} selected.
                  <HelpTooltip text="Visible prospects are filtered by the current filters and sorted by conversion score from highest to lowest." />
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-800">
                    Scoring preset: {activeScoringPresetLabel}
                    <HelpTooltip
                      widthClass="w-72"
                      text={`Applied to the current visible list. Threshold: ${scoreThresholdOptions.find((option) => option.value === minScoreFilter)?.label || `${minScore}+`}. Tune this in /admin/settings.`}
                    />
                  </span>
                  {activeScoringPreset?.description && (
                    <span className="text-xs text-slate-500">{activeScoringPreset.description}</span>
                  )}
                </div>
                {batchMessage && <p className="mt-1 text-xs text-indigo-700">{batchMessage}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const allSelected = selectedVisibleProspects.length === visibleProspects.length;
                    const next = { ...selectedProspects };
                    visibleProspects.forEach((place) => {
                      const key = getPlaceKey(place);
                      if (key) next[key] = !allSelected;
                    });
                    setSelectedProspects(next);
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <ListChecks size={14} />
                  {selectedVisibleProspects.length === visibleProspects.length ? "Clear selected" : "Select visible"}
                </button>
                <HoverTooltip text="Select visible prospects with conversion score 70 or higher.">
                  <button
                    type="button"
                    onClick={() => {
                      const next = { ...selectedProspects };
                      visibleProspects.forEach((place) => {
                        const key = getPlaceKey(place);
                        if (key) next[key] = prospectScore(place).score >= 70;
                      });
                      setSelectedProspects(next);
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                  >
                    <ListChecks size={14} />
                    Select score 70+
                  </button>
                </HoverTooltip>
                <button
                  type="button"
                  onClick={startBatchGenerate}
                  disabled={batchQueueRunning || selectedVisibleProspects.length === 0}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {batchQueueRunning ? <Loader2 className="animate-spin" size={14} /> : <Play size={14} />}
                  Generate selected
                </button>
                <AdminAiReadinessBadge
                  provider={activeProviderKey}
                  model={activeModel}
                  hasApiKey={activeProviderKeyReady}
                  requiresAi
                  remoteValidate
                />
                <AdminProviderCooldownBadge provider={activeProviderKey} compact />
                <button
                  type="button"
                  onClick={() => {
                    setJobsOpen((value) => !value);
                    fetchGenerationJobs();
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Jobs ({generationJobCount})
                </button>
              </div>
            </div>
            {jobsOpen && (
              <GenerationJobsTable
                storageKeyPrefix="webview.adminLeads.jobs"
                fallbackProvider={activeProviderKey}
                fallbackModel={activeModel}
                providerKeyStatus={providerKeyStatus}
                variant="compact"
                showFullPageLink
                onJobsLoaded={(jobs) => setGenerationJobCount(jobs.length)}
              />
            )}
            {visibleProspects.map((place, idx) => {
              const placeKey = getPlaceKey(place) || String(idx);
              const displayPlace = mergePlaceWithDetails(place);
              const generationMessage = generationMessages[placeKey];
              const currentPhotos = sortedPhotosForPlace(displayPlace);
              const detailsReady = hasGatheredDetails(displayPlace);
              const mapsQueryPlaceholder = isMapsQueryPlaceholder(displayPlace);
              const websiteStatus = websiteBadge(displayPlace);
              const listingUrl = googleBusinessListingUrl(displayPlace);
              const score = prospectScore(displayPlace);

              return (
              <div key={placeKey} className="p-4 border border-gray-100 rounded-xl bg-gray-50">
                <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 gap-3">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedProspects[placeKey])}
                    onChange={(event) => toggleProspectSelection(displayPlace, event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    aria-label={`Select ${displayPlace.name}`}
                  />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <a href={listingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-gray-900 hover:text-indigo-700 hover:underline">
                      {displayPlace.name}
                      <ExternalLink size={13} />
                    </a>
                    <HoverTooltip text={websiteStatus.title}>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${websiteStatus.className}`}>
                        {websiteStatus.label}
                      </span>
                    </HoverTooltip>
                    <span className="relative inline-flex">
                      <HoverTooltip text="Click for score breakdown" widthClass="w-44">
                        <button
                          type="button"
                          onClick={() => setScorePopoverKey(scorePopoverKey === placeKey ? "" : placeKey)}
                          className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-800 hover:bg-indigo-200"
                        >
                          Score {score.score}
                        </button>
                      </HoverTooltip>
                      {scorePopoverKey === placeKey && (
                        <span className="absolute left-0 top-full z-[180] mt-2 w-72 rounded-xl border border-slate-200 bg-white p-3 text-left text-xs text-slate-700 shadow-2xl">
                          <span className="mb-2 flex items-center justify-between">
                            <span className="font-semibold text-slate-950">Score breakdown</span>
                            <button type="button" onClick={() => setScorePopoverKey("")} className="text-slate-400 hover:text-slate-700">x</button>
                          </span>
                          <span className="block space-y-1.5">
                            {score.breakdown.map((item) => (
                              <span key={item.label} className="flex items-start justify-between gap-3 border-b border-slate-100 pb-1.5 last:border-0 last:pb-0">
                                <span>
                                  <span className="block font-medium text-slate-900">{item.label}</span>
                                  <span className="block text-slate-500">{item.detail}</span>
                                </span>
                                <span className={item.points >= 0 ? "font-semibold text-emerald-700" : "font-semibold text-red-700"}>
                                  {item.points >= 0 ? "+" : ""}{item.points}
                                </span>
                              </span>
                            ))}
                          </span>
                        </span>
                      )}
                    </span>
                    {displayPlace.prospectStatus && (
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                        {displayPlace.prospectStatus}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">{displayPlace.formatted_address || displayPlace.formattedAddress}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Rating {Number(displayPlace.rating || 0).toFixed(1)} / {Number(displayPlace.user_ratings_total || displayPlace.userRatingCount || 0)} reviews. Estimasi: {formatUsd(estimateGenerateCost(displayPlace).total)}
                  </p>
                  {displayPlace.generatedBusinessId && (
                    <a href={`/${displayPlace.generatedBusinessId}`} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:underline">
                      Open generated preview <ExternalLink size={12} />
                    </a>
                  )}
                  {displayPlace.lastError && (
                    <p className="mt-1 max-w-2xl text-xs font-medium text-red-700">Last generate error: {displayPlace.lastError}</p>
                  )}
                </div>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setDetailsPanelPlace(displayPlace)}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <PanelRightOpen size={16} />
                    Details
                  </button>
                  <button
                    type="button"
                    onClick={() => updateProspectStatus(displayPlace, "skipped")}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50"
                  >
                    Skip
                  </button>
                  {!detailsReady ? (
                    <HoverTooltip text={mapsQueryPlaceholder ? "This is a Maps search/query placeholder, not a business listing. Import captured listing JSON first." : ""}>
                      <button
                        type="button"
                        onClick={() => {
                          updateProspectStatus(displayPlace, "details_loaded");
                          loadPlaceDetails(displayPlace);
                        }}
                        disabled={placeDetailsLoading[placeKey] || !displayPlace.place_id || mapsQueryPlaceholder}
                        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {placeDetailsLoading[placeKey] ? <Loader2 className="animate-spin" size={18} /> : <ListChecks size={18} />}
                        Gather data
                      </button>
                    </HoverTooltip>
                  ) : (
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <HoverTooltip text={mapsQueryPlaceholder ? "This is not a specific business listing yet." : ""}>
                        <button
                          onClick={() => handleGenerateSite(displayPlace)}
                          disabled={isGenerating || mapsQueryPlaceholder}
                          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                        >
                          {generatingPlaceKey === placeKey ? <Loader2 className="animate-spin" size={18} /> : "Generate Site"}
                        </button>
                      </HoverTooltip>
                      <AdminAiReadinessBadge
                        provider={activeProviderKey}
                        model={activeModel}
                        hasApiKey={activeProviderKeyReady}
                        requiresAi
                        remoteValidate
                      />
                    </div>
                  )}
                </div>
                </div>
                {generationMessage && (
                  <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
                    generationMessage.type === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-red-200 bg-red-50 text-red-800"
                  }`}>
                    <span>{generationMessage.text}</span>
                    {generationMessage.businessId && (
                      <a href={`/${generationMessage.businessId}`} target="_blank" rel="noreferrer" className="ml-2 font-semibold underline">
                        Open preview
                      </a>
                    )}
                    {generationMessage.type === "success" && (
                      <a href="/admin/sites" className="ml-3 font-semibold underline">
                        View all sites
                      </a>
                    )}
                  </div>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-200 pt-4">
                  <span className="text-xs text-gray-500">
                    {detailsReady
                      ? currentPhotos.length > 0 ? `${currentPhotos.length} foto tersedia untuk dipilih.` : "Detail sudah diambil, tapi belum ada foto dari response ini."
                      : mapsQueryPlaceholder
                        ? "This row is a search/query placeholder. Import captured listing JSON or choose a specific Google business before gathering details."
                      : "Klik Gather data untuk mengambil website, phone, direct Maps URL, reviews, dan foto dari Place Details."}
                  </span>
                </div>
                {currentPhotos.length > 0 && (
                  <div className="mt-4 border-t border-gray-200 pt-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Pilih gambar logo/brand untuk palet warna</p>
                    <p className="mb-3 inline-flex items-center gap-1.5 text-xs text-gray-500">
                      Google Places photo source
                      <HelpTooltip text="Free previews use Google Places photos via proxy with attribution. They are not uploaded to R2. Photo order is best-effort because Places API does not provide a reliable owner-photo flag." />
                    </p>
                    <div className="flex gap-3 overflow-x-auto pb-1">
                      {currentPhotos.slice(0, 10).map((photo: any, photoIdx: number) => {
                        const imageUrl = getPhotoUrl(photo);
                        const selected = logoSelections[placeKey]?.url === imageUrl;
                        const priorityLabel = photoPriorityLabel(photo, displayPlace.name);
                        return (
                          <HoverTooltip key={photo.photo_reference || photoIdx} text={`Gunakan sebagai sumber warna brand. Prioritas: ${priorityLabel}`}>
                            <button
                              type="button"
                              onClick={() => selectLogoPhoto(placeKey, imageUrl, photo, displayPlace.name)}
                              className={`relative w-24 h-24 rounded-xl overflow-hidden border-2 bg-white shrink-0 ${selected ? "border-indigo-600" : "border-gray-200 hover:border-gray-300"}`}
                            >
                              <img src={imageUrl} alt="" className="w-full h-full object-cover" crossOrigin="anonymous" />
                              <span className="absolute left-1 right-1 bottom-1 rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
                                {priorityLabel}
                              </span>
                            </button>
                          </HoverTooltip>
                        );
                      })}
                    </div>
                    {logoSelections[placeKey]?.palette?.length > 0 && (
                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-xs text-gray-500">Palette:</span>
                        {logoSelections[placeKey].palette.map((color) => (
                          <HoverTooltip key={color} text={color} widthClass="w-32">
                            <span className="w-6 h-6 rounded-full border border-white shadow-sm" style={{ backgroundColor: color }} />
                          </HoverTooltip>
                        ))}
                      </div>
                    )}
                    {paletteOptionsByPlace[placeKey]?.length > 0 && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-gray-500">{paletteOptionsByPlace[placeKey].length} palette options:</span>
                        {paletteOptionsByPlace[placeKey].map((option) => (
                          <HoverTooltip key={option.id} text={option.label}>
                            <span className="inline-flex overflow-hidden rounded-full border border-slate-200">
                              {(option.colors || []).slice(0, 5).map((color: string) => (
                                <span key={color} className="h-4 w-4" style={{ backgroundColor: color }} />
                              ))}
                            </span>
                          </HoverTooltip>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              );
            })}
          </div>
        )}
      </div>

      {/* LEADS TABLE */}
      {activeWorkspaceTab === "crm" && (
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
                      href={`/${lead.business_id}`}
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
                        <option value="checkout_pending">Checkout Pending</option>
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
                    <a href={`mailto:${lead.email || 'hello@example.com'}`} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded group relative">
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
      )}

      {detailsPanelPlace && (
        <div className="fixed inset-0 z-[260] bg-slate-950/40">
          <aside className="ml-auto h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl">
            {(() => {
              const placeKey = getPlaceKey(detailsPanelPlace);
              const mergedPlace = {
                ...detailsPanelPlace,
                ...(placeDetails[placeKey] || {}),
                photos: Array.isArray(placeDetails[placeKey]?.photos) && placeDetails[placeKey].photos.length > 0
                  ? placeDetails[placeKey].photos
                  : detailsPanelPlace.photos,
              };
              const photos = sortedPhotosForPlace(mergedPlace);
              const mapsQueryPlaceholder = isMapsQueryPlaceholder(mergedPlace);
              return (
                <div className="p-6">
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Prospect details</p>
                      <h2 className="mt-1 text-xl font-semibold text-slate-950">{mergedPlace.name}</h2>
                      <p className="mt-1 text-sm text-slate-500">{mergedPlace.formatted_address || mergedPlace.formattedAddress || "No address"}</p>
                    </div>
                    <button type="button" onClick={() => setDetailsPanelPlace(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                      <X size={18} />
                    </button>
                  </div>

                  <div className="grid gap-3 text-sm sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="text-xs font-semibold text-slate-500">Website</p>
                      <p className="mt-1 break-all text-slate-900">{mergedPlace.website || mergedPlace.websiteUri || "No website detected"}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="text-xs font-semibold text-slate-500">Phone</p>
                      <p className="mt-1 text-slate-900">{mergedPlace.formatted_phone_number || mergedPlace.international_phone_number || "No phone"}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="text-xs font-semibold text-slate-500">Rating</p>
                      <p className="mt-1 text-slate-900">{Number(mergedPlace.rating || 0).toFixed(1)} / {Number(mergedPlace.user_ratings_total || mergedPlace.userRatingCount || 0)} reviews</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                        Status
                        <HelpTooltip text="Prospect workflow status controls whether it appears in the active pipeline and helps avoid reworking skipped/generated businesses." />
                      </p>
                      <select
                        value={mergedPlace.prospectStatus || "new"}
                        onChange={(event) => updateProspectStatus(mergedPlace, event.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                      >
                        <option value="new">New</option>
                        <option value="details_loaded">Details loaded</option>
                        <option value="site_generated">Site generated</option>
                        <option value="contacted">Contacted</option>
                        <option value="skipped">Skipped</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <HoverTooltip text={mapsQueryPlaceholder ? "This is a Maps search/query placeholder, not a business listing. Import captured listing JSON first." : ""}>
                      <button
                        type="button"
                        onClick={() => loadPlaceDetails(mergedPlace)}
                        disabled={placeDetailsLoading[placeKey] || !mergedPlace.place_id || mapsQueryPlaceholder}
                        className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        {placeDetailsLoading[placeKey] ? <Loader2 className="animate-spin" size={15} /> : <Images size={15} />}
                        Refresh details/photos
                      </button>
                    </HoverTooltip>
                    {googleBusinessListingUrl(mergedPlace) && (
                      <a href={googleBusinessListingUrl(mergedPlace)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                        Google Maps <ExternalLink size={15} />
                      </a>
                    )}
                  </div>
                  {mapsQueryPlaceholder && (
                    <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
                      This row is a Maps search/query placeholder. Open a specific business listing or import captured listing JSON before refreshing details.
                    </p>
                  )}
                  {mergedPlace.lastError && (
                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                      <p className="font-semibold">Last generate error</p>
                      <p className="mt-1 break-words">{mergedPlace.lastError}</p>
                    </div>
                  )}

                  <div className="mt-6">
                    <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                      Photo and palette source
                      <HelpTooltip text="The selected Places photo and extracted palette become brand provenance in the generated JSON and affect preview colors." />
                    </p>
                    <p className="mt-1 text-xs text-slate-500">Choose the closest brand/logo-like image. Selection is saved into the generated JSON as Google Places provenance.</p>
                    {photos.length > 0 ? (
                      <div className="mt-3 grid grid-cols-3 gap-3">
                        {photos.slice(0, 12).map((photo: any, index: number) => {
                          const imageUrl = getPhotoUrl(photo, 480);
                          const selected = logoSelections[placeKey]?.url === imageUrl;
                          const priorityLabel = photoPriorityLabel(photo, mergedPlace.name);
                          return (
                            <button
                              key={photo.photo_reference || photo.name || index}
                              type="button"
                              onClick={() => selectLogoPhoto(placeKey, imageUrl, photo, mergedPlace.name)}
                              className={`relative aspect-square overflow-hidden rounded-xl border-2 bg-slate-100 ${selected ? "border-indigo-600" : "border-slate-200 hover:border-slate-300"}`}
                            >
                              <img src={imageUrl} alt="" className="h-full w-full object-cover" crossOrigin="anonymous" />
                              <span className="absolute bottom-1 left-1 right-1 rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">{priorityLabel}</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">No photos in current Places response. Try refreshing details.</div>
                    )}
                    {logoSelections[placeKey]?.palette?.length > 0 && (
                      <div className="mt-4 flex items-center gap-2">
                        <span className="text-xs text-slate-500">Selected palette:</span>
                        {logoSelections[placeKey].palette.map((color) => (
                          <HoverTooltip key={color} text={color} widthClass="w-32">
                            <span className="h-7 w-7 rounded-full border border-white shadow-sm" style={{ backgroundColor: color }} />
                          </HoverTooltip>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </aside>
        </div>
      )}
    </div>
  );
}

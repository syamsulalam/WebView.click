import { useEffect, useState } from "react";
import { Search, Loader2, Camera, ExternalLink, Mail, MessageSquare, RefreshCw, Images, PanelRightOpen, X, Play, ListChecks } from "lucide-react";
import * as htmlToImage from "html-to-image";
import { defaultOutputTokens, estimateCostUsd, estimateTokensFromText, formatUsd } from "../../lib/aiPricing";
import { useLocalStorageState } from "../../lib/localStorageState";
import { getStylePreset, inferStylePresetFromText } from "../../lib/siteStylePresets";

export default function AdminLeads() {
  const [leads, setLeads] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [prospectDrafts, setProspectDrafts] = useState<any[]>([]);
  const [prospectFilter, setProspectFilter] = useLocalStorageState("webview.adminLeads.prospectFilter", "active");
  const [websiteFilter, setWebsiteFilter] = useLocalStorageState("webview.adminLeads.websiteFilter", "none");
  const [minRatingFilter, setMinRatingFilter] = useLocalStorageState("webview.adminLeads.minRatingFilter", "0");
  const [minReviewsFilter, setMinReviewsFilter] = useLocalStorageState("webview.adminLeads.minReviewsFilter", "0");
  const [cityFilter, setCityFilter] = useLocalStorageState("webview.adminLeads.cityFilter", "");
  const [stateFilter, setStateFilter] = useLocalStorageState("webview.adminLeads.stateFilter", "");
  const [nicheFilter, setNicheFilter] = useLocalStorageState("webview.adminLeads.nicheFilter", "");
  const [selectedProspects, setSelectedProspects] = useState<Record<string, boolean>>({});
  const [batchQueueRunning, setBatchQueueRunning] = useState(false);
  const [batchMessage, setBatchMessage] = useState("");
  const [generationJobs, setGenerationJobs] = useState<any[]>([]);
  const [jobsOpen, setJobsOpen] = useState(false);
  const [searchMessage, setSearchMessage] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingPlaceKey, setGeneratingPlaceKey] = useState("");
  const [generationMessages, setGenerationMessages] = useState<Record<string, { type: "success" | "error"; text: string; businessId?: string }>>({});
  const [placeDetails, setPlaceDetails] = useState<Record<string, any>>({});
  const [placeDetailsLoading, setPlaceDetailsLoading] = useState<Record<string, boolean>>({});
  const [isTrimmingCache, setIsTrimmingCache] = useState(false);
  const [cacheTrimMessage, setCacheTrimMessage] = useState("");
  const [detailsPanelPlace, setDetailsPanelPlace] = useState<any>(null);
  const [aiProvider, setAiProvider] = useLocalStorageState("webview.adminLeads.aiProvider", "OpenRouter");
  const [aiModel, setAiModel] = useLocalStorageState("webview.adminLeads.aiModel", "~anthropic/claude-sonnet-latest");
  const [settings, setSettings] = useState<any>({});
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [logoSelections, setLogoSelections] = useState<Record<string, { url: string; reference: string; palette: string[]; attributions: string[]; priorityLabel: string; source: string }>>({});

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
        { value: "kie/gpt-5-5", label: "KIE GPT-5.5 (est. $2.50 in / $15 out)" },
        { value: "kie/gpt-5-2", label: "KIE GPT-5.2 (cek live credit KIE)" },
        { value: "kie/gemini-3.1-pro", label: "KIE Gemini 3.1 Pro (est. $1 in / $6 out)" },
        { value: "kie/gemini-3-flash", label: "KIE Gemini 3 Flash (est. $0.25 in / $1.50 out)" }
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

  const isPlaceholderPhone = (value?: string) => {
    const digits = String(value || "").replace(/\D/g, "");
    return !digits || /^0+$/.test(digits);
  };

  const placePhone = (place: any) => {
    const phone = place.formatted_phone_number || place.international_phone_number || place.nationalPhoneNumber || "";
    return isPlaceholderPhone(phone) ? "" : phone;
  };

  const placeMapsUrl = (place: any) => place.url || place.googleMapsUri || place.maps_url || "";

  const hasGatheredDetails = (place: any) => {
    const key = getPlaceKey(place);
    const details = placeDetails[key];
    return Boolean(details || place.detailsLoadedAt || place.reviews || place.formatted_phone_number || place.international_phone_number || place.url || place.googleMapsUri);
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
      })
      .catch(e => console.error(e));
  };

  const fetchGenerationJobs = () => {
    fetch("/api/generation-jobs")
      .then(r => r.ok ? r.json() : [])
      .then((data) => setGenerationJobs(Array.isArray(data) ? data : []))
      .catch(e => console.error(e));
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
  const missingRequiredSettings = [
    !String(settings?.GOOGLE_PLACES_API_KEY || "").trim() ? "Google Places API Key" : "",
    !String(settings?.[settingsKey] || "").trim() ? `${activeProvider.label} Key` : "",
  ].filter(Boolean);

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
        }),
      }).catch(() => {});
    }
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

  const buildOfferings = (place: any, isEnglish: boolean, mode: string, imageUrl: string, mapsUrl: string) => {
    const typeLabel = meaningfulTypeLabel(place, isEnglish);
    const serviceBase = [
      {
        id: "core-service",
        type: "service",
        title: isEnglish ? `${typeLabel} service` : "Layanan utama",
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
        title: isEnglish ? "Fast consultation" : "Konsultasi cepat",
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
        title: isEnglish ? "Featured product" : "Produk unggulan",
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
    fetch("/api/settings")
      .then(r => r.ok ? r.json() : {})
      .then(data => {
        setSettings(data);
        setLoadingSettings(false);
      })
      .catch(() => setLoadingSettings(false));
  }, []);

  useEffect(() => {
    fetchProspectDrafts();
  }, [prospectFilter, websiteFilter, minRatingFilter, minReviewsFilter, cityFilter, stateFilter, nicheFilter]);

  const handleSearch = async (refresh = false) => {
    if (!searchQuery) return;
    setIsSearching(true);
    setSearchMessage(refresh ? "Refreshing Google Places data..." : "Searching saved cache first...");
    try {
      const res = await fetch(`/api/places/search?query=${encodeURIComponent(searchQuery)}${refresh ? "&refresh=1" : ""}`);
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

      const results = Array.isArray(data.results) ? data.results.map((item: any) => ({ ...item, searchQuery })) : [];
      setSearchResults(results);
      fetchProspectDrafts();
      setPlaceDetails({});
      setGenerationMessages({});
      if (results.length === 0) {
        setSearchMessage(data.hint || data.error || `Tidak ada hasil untuk "${searchQuery}". Coba query lebih spesifik seperti "concrete contractor Dallas Texas".`);
      } else {
        setSearchMessage(data.mock
          ? "Mode mock aktif karena Google Places API Key belum terbaca."
          : `${results.length} hasil ditemukan${data.cached ? " dari cache DB" : " dari Google Places"}.`);
      }
    } catch (e) {
      console.error(e);
      setSearchMessage(e instanceof Error ? e.message : "Gagal mencari prospek.");
    } finally {
      setIsSearching(false);
    }
  };

  const loadPlaceDetails = async (place: any) => {
    const placeKey = getPlaceKey(place);
    const placeId = place?.place_id || place?.id;
    if (!placeId || placeDetailsLoading[placeKey]) return null;

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
        setPlaceDetails(prev => ({ ...prev, [placeKey]: data.result }));
        fetchProspectDrafts();
        const result = data.result;
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
    } catch (error) {
      console.error(error);
      setCacheTrimMessage(error instanceof Error ? error.message : "Gagal membersihkan cache.");
    } finally {
      setIsTrimmingCache(false);
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
    setSearchResults(prev => prev.filter((item) => getPlaceKey(item) !== placeKey || status !== "skipped"));
    fetchProspectDrafts();
  };

  const handleGenerateSite = async (place: any) => {
    const placeKey = getPlaceKey(place);
    if (!hasGatheredDetails(place)) {
      setGenerationMessages(prev => ({
        ...prev,
        [placeKey]: { type: "error", text: "Gather Google Places details first so the generated site has phone, direct Maps URL, reviews, and photos." },
      }));
      return;
    }

    const fullPlace = mergePlaceWithDetails(place);
    setIsGenerating(true);
    setGeneratingPlaceKey(placeKey);
    setGenerationMessages(prev => ({ ...prev, [placeKey]: { type: "success", text: "Generating site JSON..." } }));
    
    // Simulate AI generation process with a mock JSON
    // A Real implementation would send 'place' to an OpenAI endpoint on our server
    const businessId = fullPlace.name.toLowerCase().replace(/[^a-z0-9]/g, '-') + "-" + Math.floor(Math.random() * 1000);
    const logoSelection = logoSelections[fullPlace.place_id || fullPlace.name] || logoSelections[placeKey];
    const brandPalette = logoSelection?.palette || [];
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
    const isEnglish = locale.language === "en";
    const googleReviews = Array.isArray(fullPlace.reviews) ? fullPlace.reviews : [];
    const offeringMode = inferProductServiceMode(fullPlace);
    const offerings = buildOfferings(fullPlace, isEnglish, offeringMode, logoSelection?.url || "", mapsUrl);
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
                description: isEnglish ? "Visitors can call, ask questions, or open maps from this page." : "Pengunjung bisa telepon, bertanya, atau membuka maps dari halaman ini.",
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
                answer: isEnglish ? "Yes. The business owner can replace this copy with exact packages, prices, and requirements." : "Bisa. Pemilik bisnis dapat mengganti copy ini dengan paket, harga, dan syarat yang lebih tepat.",
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
            headingFont: "'Inter', sans-serif",
            bodyFont: "'Inter', sans-serif"
          }
        }
      },
      brand: {
        logoImageUrl: logoSelection?.url || "",
        logoSvg: "",
        faviconSvg: faviconSvgForBusiness(businessName, primaryColor),
        palette: brandPalette,
        preferredHeroImage: logoSelection?.url || "",
        photoSource: logoSelection?.source || "",
        googlePhotoReference: logoSelection?.reference || "",
        photoCaption: logoSelection?.source === "google_places" ? "Photo from Google Business Profile" : "",
        photoAttributions: logoSelection?.attributions || [],
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
                image: logoSelection?.url || ""
              }
            },
            { type: "trustBar", id: "trust-1", content: {} },
            {
              type: "features",
              id: "features-1",
              content: {
                title: isEnglish ? "Why this business stands out" : "Kenapa bisnis ini relevan",
                items: [
                  { title: isEnglish ? "Verified Google profile" : "Profil Google aktif", description: businessStatus || (isEnglish ? "Business data is available from Google Places." : "Data bisnis tersedia dari Google Places."), iconSvg: iconSvgForText("local maps") },
                  { title: isEnglish ? "Easy to contact" : "Mudah dihubungi", description: phone || (isEnglish ? "Contact details can be completed by admin." : "Kontak bisa dilengkapi oleh admin."), iconSvg: iconSvgForText("contact call") },
                  { title: isEnglish ? "Website-ready" : "Siap dibuatkan website", description: websiteUrl ? (isEnglish ? "Already has a website, good for redesign." : "Sudah punya website, cocok untuk redesign.") : (isEnglish ? "No website detected yet." : "Belum terdeteksi punya website."), iconSvg: iconSvgForText("website ready") }
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
                  { question: isEnglish ? "Can this data be edited?" : "Apakah data ini bisa diedit?", "answer": isEnglish ? "Yes. The generated JSON can be corrected before the final website is used." : "Bisa. JSON hasil generate dapat dikoreksi sebelum dipakai sebagai website final." }
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
          model: activeModel,
          provider: activeProviderKey,
          jsonContent: mockJson,
          businessId,
          businessName,
          phone,
          originData: fullPlace,
          brandPalette,
          selectedLogoImageUrl: logoSelection?.url || "",
          selectedLogoReference: logoSelection?.reference || "",
          selectedLogoSource: logoSelection?.source || "",
          selectedLogoAttributions: logoSelection?.attributions || [],
          selectedLogoPriority: logoSelection?.priorityLabel || ""
        })
      });
      const text = await response.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(`Generate response bukan JSON: ${text.substring(0, 160)}`);
      }

      if (!response.ok || data.error) {
        throw new Error(data.error || `Generate failed with HTTP ${response.status}`);
      }

      fetchLeads();
      fetchProspectDrafts();
      fetchGenerationJobs();
      setGenerationMessages(prev => ({
        ...prev,
        [placeKey]: { type: "success", text: "Site generated. Preview is ready.", businessId: data.businessId || businessId },
      }));
    } catch (e) {
      console.error(e);
      setGenerationMessages(prev => ({
        ...prev,
        [placeKey]: { type: "error", text: e instanceof Error ? e.message : "Generate site gagal. Hasil pencarian tetap disimpan di layar." },
      }));
      fetchGenerationJobs();
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

  const visibleProspects = searchResults.length > 0 ? searchResults : prospectDrafts;
  const hasWebsite = (place: any) => Boolean(place.website || place.websiteUri);
  const selectedVisibleProspects = visibleProspects.filter((place) => selectedProspects[getPlaceKey(place)]);

  const toggleProspectSelection = (place: any, checked: boolean) => {
    const placeKey = getPlaceKey(place);
    if (!placeKey) return;
    setSelectedProspects(prev => ({ ...prev, [placeKey]: checked }));
  };

  const startBatchGenerate = async () => {
    if (selectedVisibleProspects.length === 0 || batchQueueRunning) return;
    setBatchQueueRunning(true);
    setBatchMessage(`Starting queue for ${selectedVisibleProspects.length} prospects...`);
    for (let index = 0; index < selectedVisibleProspects.length; index += 1) {
      const place = selectedVisibleProspects[index];
      setBatchMessage(`Generating ${index + 1}/${selectedVisibleProspects.length}: ${place.name}`);
      await handleGenerateSite(place);
    }
    setBatchQueueRunning(false);
    setBatchMessage("Batch queue finished.");
    setSelectedProspects({});
    fetchGenerationJobs();
  };

  return (
    <div className="p-8 max-w-7xl mx-auto font-sans">
      <h1 className="text-3xl font-semibold mb-8 text-gray-900">CRM Leads</h1>

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
          <h2 className="text-lg font-medium text-gray-900">Cari Prospek Baru (Google Maps)</h2>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500 font-medium">AI Web Builder:</label>
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
          </div>
        </div>
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div>
            <p className="font-semibold text-slate-900">Perkiraan biaya generate JSON</p>
            <p>
              {selectedPrice.total !== null
                ? `${formatUsd(estimateGenerateCost().total)} per generate awal (${activeModel})`
                : `Harga ${activeModel} belum fixed. Cek dashboard provider sebelum generate.`}
            </p>
          </div>
          <a href="/admin/settings" className="text-indigo-700 font-medium hover:underline">Lihat pricing & API key</a>
        </div>
        <div className="mb-4 flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-semibold text-slate-900">Cache pencarian Google Places</p>
            <p>Search membaca cache DB dulu untuk mengurangi panggilan API. Pakai Refresh jika butuh data terbaru.</p>
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
        <div className="mb-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Prospect status</span>
            <select
              value={prospectFilter}
              onChange={(event) => setProspectFilter(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            >
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
            <span className="mb-1 block font-medium text-slate-700">Website</span>
            <select
              value={websiteFilter}
              onChange={(event) => setWebsiteFilter(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="none">No website first</option>
              <option value="has">Has website</option>
              <option value="all">All</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Min rating</span>
            <select
              value={minRatingFilter}
              onChange={(event) => setMinRatingFilter(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="0">Any rating</option>
              <option value="3.5">3.5+</option>
              <option value="4">4.0+</option>
              <option value="4.5">4.5+</option>
            </select>
          </label>
          <button
            type="button"
            onClick={fetchProspectDrafts}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            <RefreshCw size={15} />
            Reload drafts
          </button>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Min reviews</span>
            <select
              value={minReviewsFilter}
              onChange={(event) => setMinReviewsFilter(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="0">Any reviews</option>
              <option value="10">10+</option>
              <option value="25">25+</option>
              <option value="50">50+</option>
              <option value="100">100+</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">City</span>
            <input
              value={cityFilter}
              onChange={(event) => setCityFilter(event.target.value)}
              placeholder="Dallas"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">State</span>
            <input
              value={stateFilter}
              onChange={(event) => setStateFilter(event.target.value)}
              placeholder="TX"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Niche</span>
            <input
              value={nicheFilter}
              onChange={(event) => setNicheFilter(event.target.value)}
              placeholder="concrete"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </label>
        </div>
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
          <button
            type="button"
            onClick={() => handleSearch(true)}
            disabled={isSearching || !searchQuery}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition flex items-center justify-center gap-2 disabled:opacity-50"
            title="Abaikan cache DB dan ambil ulang dari Google Places"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
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

        {visibleProspects.length > 0 && (
          <div className="mt-6 space-y-4">
            <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-semibold text-slate-900">{searchResults.length > 0 ? "Current search results" : "Saved prospect drafts"}</p>
                <p>{visibleProspects.length} prospects. {selectedVisibleProspects.length} selected for batch.</p>
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
                <button
                  type="button"
                  onClick={startBatchGenerate}
                  disabled={batchQueueRunning || selectedVisibleProspects.length === 0}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {batchQueueRunning ? <Loader2 className="animate-spin" size={14} /> : <Play size={14} />}
                  Generate selected
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setJobsOpen((value) => !value);
                    fetchGenerationJobs();
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Jobs ({generationJobs.length})
                </button>
              </div>
            </div>
            {jobsOpen && (
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="font-semibold text-slate-900">Generation jobs</p>
                  <button type="button" onClick={fetchGenerationJobs} className="text-xs font-semibold text-indigo-700 hover:underline">Refresh jobs</button>
                </div>
                <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
                  {generationJobs.map((job) => (
                    <div key={job.id} className="py-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium text-slate-900">{job.prospectName || job.metadata?.businessName || job.businessId || job.placeId}</p>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          job.status === "success" ? "bg-emerald-100 text-emerald-800" : job.status === "failed" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                        }`}>{job.status}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{job.provider} / {job.model} · {job.createdAt}</p>
                      {job.error && <p className="mt-1 text-xs text-red-700">{job.error}</p>}
                      {job.businessId && <a href={`/${job.businessId}`} target="_blank" rel="noreferrer" className="mt-1 inline-flex text-xs font-semibold text-indigo-700 hover:underline">Open preview</a>}
                    </div>
                  ))}
                  {generationJobs.length === 0 && <p className="py-6 text-center text-sm text-slate-500">No generation jobs yet.</p>}
                </div>
              </div>
            )}
            {visibleProspects.map((place, idx) => {
              const placeKey = getPlaceKey(place) || String(idx);
              const displayPlace = mergePlaceWithDetails(place);
              const generationMessage = generationMessages[placeKey];
              const currentPhotos = sortedPhotosForPlace(displayPlace);
              const detailsReady = hasGatheredDetails(displayPlace);

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
                    <h3 className="font-semibold text-gray-900">{displayPlace.name}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${hasWebsite(displayPlace) ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                      {hasWebsite(displayPlace) ? "Has website" : "No website"}
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
                    <button
                      type="button"
                      onClick={() => {
                        updateProspectStatus(displayPlace, "details_loaded");
                        loadPlaceDetails(displayPlace);
                      }}
                      disabled={placeDetailsLoading[placeKey] || !displayPlace.place_id}
                      className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {placeDetailsLoading[placeKey] ? <Loader2 className="animate-spin" size={18} /> : <ListChecks size={18} />}
                      Gather data
                    </button>
                  ) : (
                    <button
                      onClick={() => handleGenerateSite(displayPlace)}
                      disabled={isGenerating}
                      className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                    >
                      {generatingPlaceKey === placeKey ? <Loader2 className="animate-spin" size={18} /> : "Generate Site"}
                    </button>
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
                  <button
                    type="button"
                    onClick={() => {
                      updateProspectStatus(displayPlace, "details_loaded");
                      loadPlaceDetails(displayPlace);
                    }}
                    disabled={placeDetailsLoading[placeKey] || !displayPlace.place_id}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {placeDetailsLoading[placeKey] ? <Loader2 className="animate-spin" size={14} /> : <Images size={14} />}
                    {detailsReady ? "Refresh gathered data" : "Gather data/details"}
                  </button>
                  <span className="text-xs text-gray-500">
                    {detailsReady
                      ? currentPhotos.length > 0 ? `${currentPhotos.length} foto tersedia untuk dipilih.` : "Detail sudah diambil, tapi belum ada foto dari response ini."
                      : "Ambil Place Details dulu sebelum generate agar data site lengkap."}
                  </span>
                </div>
                {currentPhotos.length > 0 && (
                  <div className="mt-4 border-t border-gray-200 pt-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Pilih gambar logo/brand untuk palet warna</p>
                    <p className="text-xs text-gray-500 mb-3">
                      Foto gratis akan dipakai runtime via proxy Google Places, tidak di-upload ke R2. Caption attribution ikut disimpan di JSON.
                      Urutan tetap best-effort karena Places API tidak memberi flag owner photo.
                    </p>
                    <div className="flex gap-3 overflow-x-auto pb-1">
                      {currentPhotos.slice(0, 10).map((photo: any, photoIdx: number) => {
                        const imageUrl = getPhotoUrl(photo);
                        const selected = logoSelections[placeKey]?.url === imageUrl;
                        const priorityLabel = photoPriorityLabel(photo, displayPlace.name);
                        return (
                          <button
                            key={photo.photo_reference || photoIdx}
                            type="button"
                            onClick={() => selectLogoPhoto(placeKey, imageUrl, photo, displayPlace.name)}
                            className={`relative w-24 h-24 rounded-xl overflow-hidden border-2 bg-white shrink-0 ${selected ? "border-indigo-600" : "border-gray-200 hover:border-gray-300"}`}
                            title={`Gunakan sebagai sumber warna brand. Prioritas: ${priorityLabel}`}
                          >
                            <img src={imageUrl} alt="" className="w-full h-full object-cover" crossOrigin="anonymous" />
                            <span className="absolute left-1 right-1 bottom-1 rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
                              {priorityLabel}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {logoSelections[placeKey]?.palette?.length > 0 && (
                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-xs text-gray-500">Palette:</span>
                        {logoSelections[placeKey].palette.map((color) => (
                          <span key={color} className="w-6 h-6 rounded-full border border-white shadow-sm" style={{ backgroundColor: color }} title={color} />
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
                      <p className="text-xs font-semibold text-slate-500">Status</p>
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
                    <button
                      type="button"
                      onClick={() => loadPlaceDetails(mergedPlace)}
                      disabled={placeDetailsLoading[placeKey] || !mergedPlace.place_id}
                      className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {placeDetailsLoading[placeKey] ? <Loader2 className="animate-spin" size={15} /> : <Images size={15} />}
                      Refresh details/photos
                    </button>
                    {mergedPlace.url && (
                      <a href={mergedPlace.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                        Google Maps <ExternalLink size={15} />
                      </a>
                    )}
                  </div>
                  {mergedPlace.lastError && (
                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                      <p className="font-semibold">Last generate error</p>
                      <p className="mt-1 break-words">{mergedPlace.lastError}</p>
                    </div>
                  )}

                  <div className="mt-6">
                    <p className="text-sm font-semibold text-slate-900">Photo and palette source</p>
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
                          <span key={color} className="h-7 w-7 rounded-full border border-white shadow-sm" style={{ backgroundColor: color }} title={color} />
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

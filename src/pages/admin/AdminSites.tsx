import { useEffect, useMemo, useState } from "react";
import { Brain, ChevronDown, Database, FileText, Globe2, Image as ImageIcon, ListChecks, MapPin, Play, RefreshCw, RotateCw, Search, Shuffle, Sparkles, Wrench, X } from "lucide-react";
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
  postChunkedGenerateSite,
  postGenerateSite,
  resolveLeadGeneratePhotoSelection,
  runChunkedGenerationJob,
} from "../../lib/adminSiteGeneration";
import HelpTooltip from "../../components/HelpTooltip";
import HoverTooltip from "../../components/HoverTooltip";
import AdminDocsReader from "../../components/AdminDocsReader";
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
  serviceCardImageTotal?: number | null;
  missingServiceCardImageCount?: number | null;
  duplicateServiceCardImageCount?: number | null;
  hasMissingServiceCardImages?: boolean;
  hasDuplicateServiceCardImages?: boolean;
  needsServiceCardImageRepair?: boolean;
  hasAboutPage?: boolean;
  serviceNavLabelTotal?: number | null;
  missingServiceNavLabelCount?: number | null;
  needsAboutNavRepair?: boolean;
  aboutNavAuditKnown?: boolean;
  lastImageRepairAt?: string;
  fontPairing?: string;
  fontPairingLabel?: string;
  lastVisualVariationAt?: string;
  latestGenerationJobId?: string;
  latestGenerationJobStatus?: string;
  latestGenerationJobUpdatedAt?: string;
};

type RegenerateMode = "resave" | "ai";

const SERVICE_IMAGE_BATCH_REPAIR_LIMIT = 10;
const VISUAL_VARIATION_BATCH_LIMIT = 10;
const ABOUT_NAV_AI_BATCH_LIMIT = 5;

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

function latestJobActionClass(status?: string) {
  if (status === "success") return "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100";
  if (status === "failed") return "border-red-200 bg-red-50 text-red-700 hover:bg-red-100";
  if (status === "running") return "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100";
  return "border-gray-200 text-gray-700 hover:bg-gray-50";
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

function needsAboutNavRepair(site: SiteRow) {
  return site.needsAboutNavRepair === true || site.aboutNavAuditKnown === false;
}

export default function AdminSites() {
  const { showApiError, showToast } = useAdminToast();
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [gatheredProspects, setGatheredProspects] = useState<ProspectRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [siteIssueFilter, setSiteIssueFilter] = useState<"all" | "images" | "content">("all");
  const [activeData, setActiveData] = useState<{ title: string; subtitle: string; data: any } | null>(null);
  const [regeneratingId, setRegeneratingId] = useState("");
  const [repairingServiceImagesId, setRepairingServiceImagesId] = useState("");
  const [batchRepairingServiceImages, setBatchRepairingServiceImages] = useState(false);
  const [refreshingVisualVariationId, setRefreshingVisualVariationId] = useState("");
  const [batchRefreshingVisualVariation, setBatchRefreshingVisualVariation] = useState(false);
  const [batchAiFillingAboutNav, setBatchAiFillingAboutNav] = useState(false);
  const [generatingProspectId, setGeneratingProspectId] = useState("");
  const [generationProgress, setGenerationProgress] = useState<Record<string, { step: string; text: string; shortText?: string; message?: string; retryInSeconds?: number }>>({});
  const [openRegenerateMenu, setOpenRegenerateMenu] = useState("");
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [regenerateProvider, setRegenerateProvider] = useLocalStorageState("webview.adminSites.regenerateProvider", "OpenRouter");
  const [regenerateModel, setRegenerateModel] = useLocalStorageState("webview.adminSites.regenerateModel", "~anthropic/claude-sonnet-latest");
  const showAboutNavRepairOverride = useMemo(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("repair") === "about-nav";
  }, []);
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
  const updateGenerationProgress = (
    key: string,
    step: string,
    progress?: { status?: string; retryInSeconds?: number; message?: string },
  ) => {
    const labels: Record<string, string> = {
      outline: "Inferring service/product pages",
      copy: "Writing AI copy patch",
      siteCopy: "Writing homepage and site copy",
      offeringCopy: "Writing service detail copy",
      finalize: "Saving generated site",
    };
    const suffix = progress?.status === "retry_wait"
      ? ` - temporary failure, auto retry in ${progress.retryInSeconds}s`
      : progress?.status === "retrying"
        ? " - retrying now"
        : progress?.status === "complete"
          ? " - done"
          : "";
    setGenerationProgress((current) => {
      const previous = current[key];
      const progressMessage = progress?.message || (previous?.step === step ? previous.message : "");
      let shortText = labels[step] || "Generating";
      if (step === "siteCopy") shortText = "About copy";
      if (step === "offeringCopy") {
        const match = progressMessage.match(/(\d+)\s*\/\s*(\d+)/);
        shortText = match ? `Nav ${match[1]}/${match[2]}` : "Nav labels";
      }
      if (step === "finalize") shortText = "Finalize";
      if (progress?.status === "retry_wait") shortText = `Retry ${progress.retryInSeconds}s`;
      if (progress?.status === "retrying") shortText = "Retrying";
      return {
        ...current,
        [key]: {
          step,
          text: `${labels[step] || "Generating"}${progressMessage ? ` - ${progressMessage}` : ""}${suffix}`,
          shortText,
          message: progressMessage,
          retryInSeconds: progress?.retryInSeconds,
        },
      };
    });
  };
  const clearGenerationProgress = (key: string) => {
    setGenerationProgress((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };
  const generationProgressPercent = (step: string) => {
    if (step === "outline") return 33;
    if (step === "copy" || step === "siteCopy") return 55;
    if (step === "offeringCopy") return 76;
    if (step === "finalize") return 92;
    return 12;
  };

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
    const issueFilteredSites = siteIssueFilter === "images"
      ? sites.filter((site) => site.needsServiceCardImageRepair === true || Number(site.missingServiceCardImageCount || 0) > 0 || Number(site.duplicateServiceCardImageCount || 0) > 0)
      : siteIssueFilter === "content"
        ? sites.filter(needsAboutNavRepair)
      : sites;
    if (!needle) return issueFilteredSites;
    return issueFilteredSites.filter((site) => [
      site.businessName,
      site.businessId,
      site.niche,
      site.language,
      site.region,
      site.needsServiceCardImageRepair === true || Number(site.missingServiceCardImageCount || 0) > 0 || Number(site.duplicateServiceCardImageCount || 0) > 0 ? "missing duplicate service images" : "",
      needsAboutNavRepair(site) ? "missing about nav labels ai fill content" : "",
    ].filter(Boolean).join(" ").toLowerCase().includes(needle));
  }, [query, siteIssueFilter, sites]);

  const missingServiceImageSiteCount = useMemo(
    () => sites.filter((site) => site.needsServiceCardImageRepair === true || Number(site.missingServiceCardImageCount || 0) > 0 || Number(site.duplicateServiceCardImageCount || 0) > 0).length,
    [sites],
  );

  const missingAboutNavSiteCount = useMemo(
    () => sites.filter(needsAboutNavRepair).length,
    [sites],
  );

  const filteredMissingServiceImageSites = useMemo(
    () => filteredSites.filter((site) => site.needsServiceCardImageRepair === true || Number(site.missingServiceCardImageCount || 0) > 0 || Number(site.duplicateServiceCardImageCount || 0) > 0),
    [filteredSites],
  );

  const filteredMissingAboutNavSites = useMemo(
    () => filteredSites.filter(needsAboutNavRepair),
    [filteredSites],
  );

  const activeBatchAboutNavProgress = batchAiFillingAboutNav && regeneratingId
    ? generationProgress[regeneratingId]
    : undefined;
  const batchAboutNavButtonText = batchAiFillingAboutNav
    ? activeBatchAboutNavProgress?.shortText || "Starting"
    : "Generate About/nav";

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

  const normalizePaletteForContrast = (palette: string[]) => {
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
    const next = [...palette];
    if (next[0]) next[0] = darkenForWhiteText(next[0]);
    if (next[1]) next[1] = darkenForWhiteText(next[1]);
    return next;
  };

  const fallbackPaletteForImage = (imageUrl: string) => {
    const fallbackPalettes = [
      ["#111827", "#2563EB", "#F8FAFC", "#F59E0B", "#0F766E"],
      ["#1F2937", "#B45309", "#FFF7ED", "#047857", "#7C2D12"],
      ["#0F172A", "#7C3AED", "#F5F3FF", "#E11D48", "#0369A1"],
      ["#172554", "#0891B2", "#ECFEFF", "#CA8A04", "#155E75"],
      ["#3F3F46", "#16A34A", "#F7FEE7", "#EA580C", "#166534"],
    ];
    const hash = imageUrl.split("").reduce((total, char) => total + char.charCodeAt(0), 0);
    return normalizePaletteForContrast(fallbackPalettes[hash % fallbackPalettes.length]);
  };

  const extractPaletteFromImage = async (imageUrl: string): Promise<string[]> => new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const size = 80;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas unavailable for palette extraction."));
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
      resolve(normalizePaletteForContrast(palette.length ? palette : ["#111827", "#4F46E5", "#F3F4F6"]));
    };
    img.onerror = () => reject(new Error("Could not read image for palette extraction."));
    img.src = imageUrl;
  });

  const siteGalleryImages = (siteJson: any) => {
    const images: string[] = [];
    const addImage = (value: unknown) => {
      const image = typeof value === "string" ? value.trim() : "";
      if (!image || images.includes(image)) return;
      images.push(image);
    };
    const pages = Array.isArray(siteJson?.pages) ? siteJson.pages : [];
    pages.forEach((page: any) => {
      const sections = Array.isArray(page?.sections) ? page.sections : [];
      sections.forEach((section: any) => {
        if (section?.type === "imageGallery" && Array.isArray(section?.content?.images)) {
          section.content.images.forEach(addImage);
        }
      });
    });
    addImage(siteJson?.brand?.preferredHeroImage);
    addImage(siteJson?.brand?.logoImageUrl);
    return images.filter((image) => image.startsWith("/") || image.startsWith("http")).slice(0, 5);
  };

  const buildMissingPaletteOptionsForSite = async (site: SiteRow) => {
    const siteJson = await fetchSiteJson(site);
    const images = siteGalleryImages(siteJson);
    const existingOptions = Array.isArray(siteJson?.brand?.paletteOptions) ? siteJson.brand.paletteOptions : [];
    if (images.length <= existingOptions.length) return [];
    const existingSources = new Set(existingOptions.map((option: any) => String(option?.sourceImageUrl || option?.photoReference || "").trim()).filter(Boolean));
    const targets = images.filter((image) => !existingSources.has(image)).slice(0, Math.max(0, images.length - existingOptions.length));
    const options: any[] = [];
    for (let index = 0; index < targets.length; index += 1) {
      const sourceImageUrl = targets[index];
      let colors = fallbackPaletteForImage(sourceImageUrl);
      let priorityLabel = "Generated gallery fallback";
      try {
        colors = await extractPaletteFromImage(sourceImageUrl);
        priorityLabel = "Generated gallery";
      } catch {
        // Browser canvas can be blocked by cross-origin images; keep a seeded fallback so older sites still get distinct palette options.
      }
      options.push({
        id: `site-gallery-${existingOptions.length + index + 1}`,
        label: `Gallery palette ${existingOptions.length + index + 1}`,
        colors,
        sourceImageUrl,
        priorityLabel,
      });
    }
    return options;
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
      await postChunkedGenerateSite(payload, "Generate site", (step, progress) => updateGenerationProgress(placeId, step, progress));
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
      clearGenerationProgress(placeId);
    }
  };

  const buildRegeneratePayload = async (site: SiteRow, mode: RegenerateMode) => {
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
    return {
      requireAi: mode === "ai",
      skipAiOfferingOutline: mode === "ai",
      provider,
      model,
      jsonContent: siteJson,
      businessId: site.businessId,
      businessName: site.businessName,
      phone: contact.phoneInternational || contact.phoneNational || "",
      originData,
      brandPalette: siteJson?.meta?.brandPalette || siteJson?.brand?.palette || [],
      paletteOptions: siteJson?.brand?.paletteOptions || [],
      selectedLogoImageUrl: siteJson?.brand?.logoImageUrl || "",
      selectedLogoReference: siteJson?.brand?.googlePhotoReference || "",
      selectedLogoSource: siteJson?.brand?.photoSource || "",
      selectedLogoAttributions: siteJson?.brand?.photoAttributions || [],
      selectedLogoPriority: siteJson?.brand?.selectedPhotoPriority || "",
    };
  };

  const runRegenerateSite = async (site: SiteRow, mode: RegenerateMode, label: string) => {
    const regeneratePayload = await buildRegeneratePayload(site, mode);
    if (mode === "ai") {
      await postChunkedGenerateSite(regeneratePayload, label, (step, progress) => updateGenerationProgress(site.businessId, step, progress));
    } else {
      await postGenerateSite(regeneratePayload, label);
    }
  };

  const runAboutNavAiFillSite = async (site: SiteRow, label: string) => {
    const response = await fetch(`/api/sites/${encodeURIComponent(site.businessId)}/ai-fill-about-nav-start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: activeRegenerateProvider,
        model: activeRegenerateModel,
      }),
    });
    const start = await readApiJson<Record<string, unknown>>(response, `${label} start`);
    await runChunkedGenerationJob(start, label, (step, progress) => updateGenerationProgress(site.businessId, step, progress));
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

      await runRegenerateSite(site, mode, mode === "ai" ? "AI fill missing/copy" : "Re-gather Google data");
      const successMessage =
        mode === "ai"
          ? `AI filled missing copy for ${site.businessName} with ${activeRegenerateProvider} / ${activeRegenerateModelLabel}.`
          : `Re-gathered Google data and resaved ${site.businessName} without an AI call.`;
      notifyAction(
        "success",
        mode === "ai" ? "AI fill completed" : "Google data resaved",
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
      clearGenerationProgress(site.businessId);
    }
  };

  const handleAboutNavAiFillSite = async (site: SiteRow) => {
    setRegeneratingId(site.businessId);
    try {
      await ensureAiGenerationReady({
        provider: activeRegenerateProvider,
        model: activeRegenerateModel,
        action: "sites_ai_fill_about_nav",
        businessId: site.businessId,
        businessName: site.businessName,
        readinessMessage: "AI provider/model is not ready. Check /admin/settings before filling About/nav.",
        cooldownMessage: (cooldown) => `${activeRegenerateProvider} is cooling down for ${formatCooldownRemaining(cooldown)} after a quota/rate-limit error.`,
      });
      await runAboutNavAiFillSite(site, "AI fill About/nav");
      notifyAction(
        "success",
        "About/nav filled",
        `Generated About page copy and short service menu labels for ${site.businessName} with ${activeRegenerateProvider} / ${activeRegenerateModelLabel}.`,
      );
      fetchSites();
    } catch (err) {
      if (isAdminGenerationBlockedError(err) && err.kind === "cooldown") {
        showToast({ kind: "warning", title: err.title || `${activeRegenerateProvider} cooldown active`, message: err.message, actions: err.actions });
      } else {
        showApiError(err, { source: "AI fill About/nav", provider: activeRegenerateProvider, model: activeRegenerateModel });
      }
    } finally {
      setRegeneratingId("");
      clearGenerationProgress(site.businessId);
    }
  };

  const handleAiFillFilteredAboutNav = async () => {
    const targets = filteredMissingAboutNavSites.slice(0, ABOUT_NAV_AI_BATCH_LIMIT);
    if (targets.length === 0) {
      notifyAction("info", "No About/nav targets", "The current filtered list has no generated sites missing About/nav content.");
      return;
    }

    setBatchAiFillingAboutNav(true);
    let completed = 0;
    const failures: string[] = [];
    try {
      await ensureAiGenerationReady({
        provider: activeRegenerateProvider,
        model: activeRegenerateModel,
        action: "sites_batch_ai_fill_about_nav",
        businessName: `${targets.length} filtered About/nav site${targets.length === 1 ? "" : "s"}`,
        readinessMessage: "AI provider/model is not ready. Check /admin/settings before running the filtered About/nav fill.",
        cooldownMessage: (cooldown) => `${activeRegenerateProvider} is cooling down for ${formatCooldownRemaining(cooldown)} after a quota/rate-limit error.`,
      });

      for (let index = 0; index < targets.length; index += 1) {
        const site = targets[index];
        setRegeneratingId(site.businessId);
        try {
          await runAboutNavAiFillSite(site, "Batch AI fill About/nav");
          completed += 1;
        } catch (error) {
          failures.push(`${site.businessName}: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
          clearGenerationProgress(site.businessId);
          setRegeneratingId("");
        }
        if (index < targets.length - 1) {
          await new Promise<void>((resolve) => window.setTimeout(resolve, 1200));
        }
      }

      const cappedMessage = filteredMissingAboutNavSites.length > targets.length
        ? ` Capped at ${ABOUT_NAV_AI_BATCH_LIMIT}; ${filteredMissingAboutNavSites.length - targets.length} filtered row${filteredMissingAboutNavSites.length - targets.length === 1 ? "" : "s"} remain.`
        : "";
      if (failures.length > 0) {
        notifyAction(
          completed > 0 ? "warning" : "error",
          completed > 0 ? "About/nav batch partially completed" : "About/nav batch failed",
          `AI filled ${completed} site${completed === 1 ? "" : "s"} through chunked siteCopy/offeringCopy/finalize calls. ${failures.length} failed.${cappedMessage}`,
        );
      } else {
        notifyAction(
          "success",
          "About/nav batch completed",
          `AI filled ${completed} filtered site${completed === 1 ? "" : "s"} through separate chunked calls per site.${cappedMessage}`,
        );
      }
      fetchSites();
    } catch (err) {
      if (isAdminGenerationBlockedError(err) && err.kind === "cooldown") {
        showToast({ kind: "warning", title: err.title || `${activeRegenerateProvider} cooldown active`, message: err.message, actions: err.actions });
      } else {
        showApiError(err, { source: "Batch AI fill About/nav", provider: activeRegenerateProvider, model: activeRegenerateModel });
      }
    } finally {
      setRegeneratingId("");
      setBatchAiFillingAboutNav(false);
    }
  };

  const postRepairServiceImages = async (site: SiteRow) => {
    const response = await fetch(`/api/sites/${encodeURIComponent(site.businessId)}/repair-service-images`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    return readApiJson<{ changed?: number; availableImages?: number; lastImageRepairAt?: string }>(response, "Repair service card images");
  };

  const handleRepairServiceImages = async (site: SiteRow) => {
    setRepairingServiceImagesId(site.businessId);
    try {
      const result = await postRepairServiceImages(site);
      const changed = Number(result?.changed || 0);
      const availableImages = Number(result?.availableImages || 0);
      notifyAction(
        "success",
        changed > 0 ? "Service card images repaired" : "Service card images already synced",
        changed > 0
          ? `Updated ${changed} saved image field${changed === 1 ? "" : "s"} for ${site.businessName} from ${availableImages} available image${availableImages === 1 ? "" : "s"}.`
          : `${site.businessName} already has synced service card images from ${availableImages} available image${availableImages === 1 ? "" : "s"}.`,
      );
      fetchSites();
    } catch (err) {
      showApiError(err, { source: "Repair service card images" });
    } finally {
      setRepairingServiceImagesId("");
    }
  };

  const handleRepairFilteredServiceImages = async () => {
    const targets = filteredMissingServiceImageSites.slice(0, SERVICE_IMAGE_BATCH_REPAIR_LIMIT);
    if (targets.length === 0) {
      notifyAction("info", "No missing service images", "The current filtered list has no rows with missing service card image summaries.");
      return;
    }

    setBatchRepairingServiceImages(true);
    let completed = 0;
    let changedFields = 0;
    const failures: string[] = [];
    try {
      for (const site of targets) {
        setRepairingServiceImagesId(site.businessId);
        try {
          const result = await postRepairServiceImages(site);
          completed += 1;
          changedFields += Number(result?.changed || 0);
        } catch (error) {
          failures.push(`${site.businessName}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      const cappedMessage = filteredMissingServiceImageSites.length > targets.length
        ? ` Capped at ${SERVICE_IMAGE_BATCH_REPAIR_LIMIT}; ${filteredMissingServiceImageSites.length - targets.length} filtered row${filteredMissingServiceImageSites.length - targets.length === 1 ? "" : "s"} remain.`
        : "";
      if (failures.length > 0) {
        notifyAction(
          completed > 0 ? "warning" : "error",
          completed > 0 ? "Batch repair partially completed" : "Batch repair failed",
          `Repaired ${completed} site${completed === 1 ? "" : "s"} and updated ${changedFields} image field${changedFields === 1 ? "" : "s"}. ${failures.length} failed.${cappedMessage}`,
        );
      } else {
        notifyAction(
          "success",
          "Batch service image repair completed",
          `Repaired ${completed} filtered site${completed === 1 ? "" : "s"} and updated ${changedFields} image field${changedFields === 1 ? "" : "s"}.${cappedMessage}`,
        );
      }
      fetchSites();
    } finally {
      setRepairingServiceImagesId("");
      setBatchRepairingServiceImages(false);
    }
  };

  const postRefreshVisualVariation = async (site: SiteRow) => {
    const paletteOptions = await buildMissingPaletteOptionsForSite(site);
    const response = await fetch(`/api/sites/${encodeURIComponent(site.businessId)}/refresh-visual-variation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paletteOptions }),
    });
    return readApiJson<{ changed?: boolean; paletteOptionsChanged?: boolean; fontPairing?: string; fontPairingLabel?: string; paletteOptionCount?: number; lastVisualVariationAt?: string }>(response, "Refresh visual variation");
  };

  const handleRefreshVisualVariation = async (site: SiteRow) => {
    setRefreshingVisualVariationId(site.businessId);
    try {
      const result = await postRefreshVisualVariation(site);
      notifyAction(
        "success",
        result?.changed || result?.paletteOptionsChanged ? "Visual variation refreshed" : "Visual variation marked reviewed",
        `${site.businessName} now uses ${result?.fontPairingLabel || result?.fontPairing || "the seeded font pairing"}${result?.paletteOptionsChanged ? ` with ${result.paletteOptionCount || "updated"} palette options` : ""}. No AI call or copy regeneration was used.`,
      );
      fetchSites();
    } catch (err) {
      showApiError(err, { source: "Refresh visual variation" });
    } finally {
      setRefreshingVisualVariationId("");
    }
  };

  const handleRefreshFilteredVisualVariation = async () => {
    const targets = filteredSites.slice(0, VISUAL_VARIATION_BATCH_LIMIT);
    if (targets.length === 0) {
      notifyAction("info", "No filtered sites", "The current filtered list has no generated sites to refresh.");
      return;
    }

    setBatchRefreshingVisualVariation(true);
    let completed = 0;
    let changed = 0;
    let paletteUpdated = 0;
    const failures: string[] = [];
    try {
      for (const site of targets) {
        setRefreshingVisualVariationId(site.businessId);
        try {
          const result = await postRefreshVisualVariation(site);
          completed += 1;
          if (result?.changed) changed += 1;
          if (result?.paletteOptionsChanged) paletteUpdated += 1;
        } catch (error) {
          failures.push(`${site.businessName}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      const cappedMessage = filteredSites.length > targets.length
        ? ` Capped at ${VISUAL_VARIATION_BATCH_LIMIT}; ${filteredSites.length - targets.length} filtered row${filteredSites.length - targets.length === 1 ? "" : "s"} remain.`
        : "";
      if (failures.length > 0) {
        notifyAction(
          completed > 0 ? "warning" : "error",
          completed > 0 ? "Visual batch partially completed" : "Visual batch failed",
          `Refreshed ${completed} site${completed === 1 ? "" : "s"}; ${changed} font pairing${changed === 1 ? "" : "s"} changed and ${paletteUpdated} palette set${paletteUpdated === 1 ? "" : "s"} expanded. ${failures.length} failed.${cappedMessage}`,
        );
      } else {
        notifyAction(
          "success",
          "Visual batch completed",
          `Refreshed ${completed} filtered site${completed === 1 ? "" : "s"}; ${changed} font pairing${changed === 1 ? "" : "s"} changed and ${paletteUpdated} palette set${paletteUpdated === 1 ? "" : "s"} expanded.${cappedMessage}`,
        );
      }
      fetchSites();
    } finally {
      setRefreshingVisualVariationId("");
      setBatchRefreshingVisualVariation(false);
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
        <HoverTooltip text="Reload generated sites and ready-to-generate prospects from the API after a generate, regenerate, or schema repair.">
          <button
            type="button"
            onClick={fetchSites}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-gray-50"
            aria-label="Refresh generated sites"
          >
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
          </button>
        </HoverTooltip>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <Search size={18} className="text-gray-400" />
        <HelpTooltip text="Filters generated sites and ready prospects by business name, slug, niche, language, or summary fields already loaded on this page." />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cari nama bisnis, slug, niche, bahasa..."
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
        <HoverTooltip text="Show only generated sites whose saved summary says homepage/services offer cards are missing images or repeat the same image. Rows generated before this audit exists may appear after repair or resave.">
          <button
            type="button"
            onClick={() => setSiteIssueFilter(siteIssueFilter === "images" ? "all" : "images")}
            className={`inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${
              siteIssueFilter === "images"
                ? "border-sky-300 bg-sky-50 text-sky-800"
                : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            }`}
            aria-pressed={siteIssueFilter === "images"}
          >
            <ImageIcon size={14} />
            Image issues
            <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] text-gray-600">{missingServiceImageSiteCount}</span>
          </button>
        </HoverTooltip>
        <HoverTooltip text="Show generated sites missing a saved About page, missing AI-written short service submenu labels, or missing the new About/nav audit. Use Generate About/nav on each row or the batch button on these rows.">
          <button
            type="button"
            onClick={() => setSiteIssueFilter(siteIssueFilter === "content" ? "all" : "content")}
            className={`inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${
              siteIssueFilter === "content"
                ? "border-indigo-300 bg-indigo-50 text-indigo-800"
                : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            }`}
            aria-pressed={siteIssueFilter === "content"}
          >
            <FileText size={14} />
            About/nav
            <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] text-gray-600">{missingAboutNavSiteCount}</span>
          </button>
        </HoverTooltip>
        <HoverTooltip text={`AI fill About page copy and short service submenu labels for up to ${ABOUT_NAV_AI_BATCH_LIMIT} rows in the current filtered list. Each site starts server-side, then runs an About-only AI request, one nav-label AI request per service, and finalize.`}>
          <button
            type="button"
            onClick={handleAiFillFilteredAboutNav}
            disabled={batchAiFillingAboutNav || batchRepairingServiceImages || batchRefreshingVisualVariation || regeneratingId !== "" || !activeRegenerateModel || filteredMissingAboutNavSites.length === 0}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
            aria-label="AI fill filtered About and navigation label issues"
          >
            {batchAiFillingAboutNav ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <Brain size={14} />
            )}
            {batchAboutNavButtonText}
            <span className="rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] text-indigo-700">
              {Math.min(filteredMissingAboutNavSites.length, ABOUT_NAV_AI_BATCH_LIMIT)}
            </span>
          </button>
        </HoverTooltip>
        <HoverTooltip text={`Repair missing or repeated service card images for up to ${SERVICE_IMAGE_BATCH_REPAIR_LIMIT} sites in the current filtered list. Runs one site at a time, uses no AI, and does not regenerate copy.`}>
          <button
            type="button"
            onClick={handleRepairFilteredServiceImages}
            disabled={batchRepairingServiceImages || batchRefreshingVisualVariation || batchAiFillingAboutNav || regeneratingId !== "" || filteredMissingServiceImageSites.length === 0}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-sky-200 bg-white px-3 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-50 disabled:opacity-50"
            aria-label="Repair filtered service image issues"
          >
            {batchRepairingServiceImages ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <Wrench size={14} />
            )}
            Repair filtered
            <span className="rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] text-sky-700">
              {Math.min(filteredMissingServiceImageSites.length, SERVICE_IMAGE_BATCH_REPAIR_LIMIT)}
            </span>
          </button>
        </HoverTooltip>
        <HoverTooltip text={`Refresh font pairing variation and backfill missing gallery palettes for up to ${VISUAL_VARIATION_BATCH_LIMIT} sites in the current filtered list. Runs one site at a time and uses no AI.`}>
          <button
            type="button"
            onClick={handleRefreshFilteredVisualVariation}
            disabled={batchRefreshingVisualVariation || batchRepairingServiceImages || batchAiFillingAboutNav || regeneratingId !== "" || filteredSites.length === 0}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-50"
            aria-label="Refresh filtered visual variation"
          >
            {batchRefreshingVisualVariation ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <Shuffle size={14} />
            )}
            Visual filtered
            <span className="rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] text-violet-700">
              {Math.min(filteredSites.length, VISUAL_VARIATION_BATCH_LIMIT)}
            </span>
          </button>
        </HoverTooltip>
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
          <div className="flex flex-wrap items-center justify-end gap-2">
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
            <AdminDocsReader
              pathname="/admin/sites"
              defaultDocId="design-guide"
              tooltip="Open generated-site design guidance for generation/regeneration QA."
              buttonClassName="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50"
              iconSize={15}
            />
            <AdminDocsReader
              pathname="/admin/sites"
              defaultDocId="niche-style-presets"
              tooltip="Open niche style preset docs for industry-specific generated site styling."
              buttonClassName="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50"
              iconSize={15}
            />
            <AdminDocsReader
              pathname="/admin/sites"
              defaultDocId="font-pairing-guide"
              tooltip="Open font pairing docs for generated-site typography choices."
              buttonClassName="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50"
              iconSize={15}
            />
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
                {generationProgress[prospect.place_id] && (
                  <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs font-medium text-amber-900">
                    <span className="inline-flex items-center gap-1.5">
                      <RefreshCw size={12} className="animate-spin" />
                      {generationProgress[prospect.place_id].text}
                    </span>
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-amber-100">
                      <span
                        className="block h-full rounded-full bg-amber-500 transition-all"
                        style={{ width: `${generationProgressPercent(generationProgress[prospect.place_id].step)}%` }}
                      />
                    </span>
                  </div>
                )}
              </div>
              <code className="truncate rounded-lg bg-gray-50 px-2 py-1 text-xs text-gray-600">{prospect.place_id}</code>
              <span className="text-xs text-gray-600">
                {Number(prospect.rating || 0).toFixed(1)} / {Number(prospect.user_ratings_total || prospect.userRatingCount || 0)}
              </span>
              <span className="text-xs text-gray-500">{prospect.detailsLoadedAt ? new Date(prospect.detailsLoadedAt).toLocaleString() : "-"}</span>
              <div className="flex flex-wrap justify-end gap-2">
                {(prospect.url || prospect.googleMapsUri) && (
                  <HoverTooltip text="Open the source Google Maps listing.">
                    <a
                      href={prospect.url || prospect.googleMapsUri}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
                      aria-label="Open Google Maps listing"
                    >
                      <MapPin size={14} />
                    </a>
                  </HoverTooltip>
                )}
                <HoverTooltip text="Inspect gathered Google data for this ready prospect.">
                  <button
                    type="button"
                    onClick={() => handleSeeProspectData(prospect)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
                    aria-label="Inspect prospect data"
                  >
                    <Database size={14} />
                  </button>
                </HoverTooltip>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <HoverTooltip text={mapsQueryPlaceholder ? "This is not a specific business listing yet." : "Generate the first site for this gathered prospect."}>
                    <button
                      type="button"
                      onClick={() => handleGenerateProspect(prospect)}
                      disabled={!activeRegenerateModel || mapsQueryPlaceholder || Boolean(generatingProspectId || regeneratingId || batchAiFillingAboutNav)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                      aria-label="Generate site for prospect"
                    >
                      {generatingProspectId === prospect.place_id ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
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
            <HelpTooltip text="Preview opens the public site, Data shows saved JSON source data, Brief shows copy-only input, Image repairs service cards, Shuffle refreshes font variation without AI, Jobs opens the latest generation audit row, and Regen refreshes Google data or runs an AI copy patch." />
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
                  {(Number(site.missingServiceCardImageCount || 0) > 0 || Number(site.duplicateServiceCardImageCount || 0) > 0 || site.needsServiceCardImageRepair === true) && (
                    <HoverTooltip text={`${site.missingServiceCardImageCount || 0} missing and ${site.duplicateServiceCardImageCount || 0} duplicate saved homepage/services offer card image${Number(site.duplicateServiceCardImageCount || 0) === 1 ? "" : "s"} out of ${site.serviceCardImageTotal || "unknown"} cards. Use the image action to repair without AI regeneration.`}>
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-800">
                        <ImageIcon size={11} />
                        Fix {Number(site.missingServiceCardImageCount || 0) + Number(site.duplicateServiceCardImageCount || 0)} img
                      </span>
                    </HoverTooltip>
                  )}
                  {needsAboutNavRepair(site) && (
                    <HoverTooltip text={site.aboutNavAuditKnown === false
                      ? "This saved summary predates the About/nav audit. Use Generate About/nav to save the About page and short service submenu labels, or resave to refresh the audit."
                      : `${site.hasAboutPage ? "About page exists" : "About page is missing"}; ${site.missingServiceNavLabelCount ?? "unknown"} of ${site.serviceNavLabelTotal ?? "unknown"} service nav labels are missing. Use Generate About/nav.`
                    }>
                      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-800">
                        <FileText size={11} />
                        About/nav
                      </span>
                    </HoverTooltip>
                  )}
                  {site.lastImageRepairAt && (
                    <HoverTooltip text={`Service card image repair last ran at ${new Date(site.lastImageRepairAt).toLocaleString()}.`}>
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                        <Wrench size={11} />
                        Repaired {new Date(site.lastImageRepairAt).toLocaleDateString()}
                      </span>
                    </HoverTooltip>
                  )}
                  {site.lastVisualVariationAt && (
                    <HoverTooltip text={`Visual variation last refreshed at ${new Date(site.lastVisualVariationAt).toLocaleString()}. Font pairing: ${site.fontPairingLabel || site.fontPairing || "seeded variant"}.`}>
                      <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-800">
                        <Shuffle size={11} />
                        Visual {new Date(site.lastVisualVariationAt).toLocaleDateString()}
                      </span>
                    </HoverTooltip>
                  )}
                </div>
                {generationProgress[site.businessId] && (
                  <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs font-medium text-amber-900">
                    <span className="inline-flex items-center gap-1.5">
                      <RefreshCw size={12} className="animate-spin" />
                      {generationProgress[site.businessId].text}
                    </span>
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-amber-100">
                      <span
                        className="block h-full rounded-full bg-amber-500 transition-all"
                        style={{ width: `${generationProgressPercent(generationProgress[site.businessId].step)}%` }}
                      />
                    </span>
                  </div>
                )}
              </div>
              <code className="truncate rounded-lg bg-gray-50 px-2 py-1 text-xs text-gray-600">{site.businessId}</code>
              <span className="text-gray-600">{[site.language, site.region].filter(Boolean).join("-") || "-"}</span>
              <span className="text-xs text-gray-500">{site.updatedAt ? new Date(site.updatedAt).toLocaleString() : "-"}</span>
              <div className="flex justify-end gap-2">
                <HoverTooltip text="Open the generated public preview in a new tab.">
                  <a
                    href={site.previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                    aria-label="Open site preview"
                  >
                    <Globe2 size={14} />
                  </a>
                </HoverTooltip>
                {site.googleMapsUrl && (
                  <HoverTooltip text="Open the source Google Maps listing.">
                    <a
                      href={site.googleMapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
                      aria-label="Open Google Maps listing"
                    >
                      <MapPin size={14} />
                    </a>
                  </HoverTooltip>
                )}
                <HoverTooltip text="Inspect saved source data and generated JSON summary for debugging preview or export issues.">
                  <button
                    type="button"
                    onClick={() => handleSeeGatheredData(site)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
                    aria-label="Inspect gathered data"
                  >
                    <Database size={14} />
                  </button>
                </HoverTooltip>
                <HoverTooltip text="Open the compact copy brief used for AI copy patch/regeneration review.">
                  <button
                    type="button"
                    onClick={() => handleSeeCopyBrief(site)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
                    aria-label="Open AI copy brief"
                  >
                    <FileText size={14} />
                  </button>
                </HoverTooltip>
                {(needsAboutNavRepair(site) || showAboutNavRepairOverride) && (
                  <HoverTooltip text={needsAboutNavRepair(site)
                    ? "Generate this site's missing About page copy and short service menu labels only. Runs server-side as small chunked AI calls: About copy, one nav label per service, then finalize."
                    : "Repair override is enabled by ?repair=about-nav. Run the About/nav fill again for this site even though the saved summary is not currently flagged."
                  }>
                    <button
                      type="button"
                      onClick={() => handleAboutNavAiFillSite(site)}
                      disabled={!activeRegenerateModel || Boolean(regeneratingId || repairingServiceImagesId || batchRepairingServiceImages || refreshingVisualVariationId || batchRefreshingVisualVariation || batchAiFillingAboutNav)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-indigo-200 text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                      aria-label={regeneratingId === site.businessId
                        ? `Generating About/nav: ${generationProgress[site.businessId]?.shortText || "running"}`
                        : "Generate missing About page copy and short service menu labels"
                      }
                    >
                      {regeneratingId === site.businessId ? (
                        <RefreshCw size={14} className="animate-spin" />
                      ) : (
                        <Brain size={14} />
                      )}
                    </button>
                  </HoverTooltip>
                )}
                {(site.needsServiceCardImageRepair === true || Number(site.missingServiceCardImageCount || 0) > 0 || Number(site.duplicateServiceCardImageCount || 0) > 0) && (
                  <HoverTooltip text="Repair only homepage/services grid card images when cards are missing images or repeat the same image. No AI call and no full site regeneration.">
                    <button
                      type="button"
                      onClick={() => handleRepairServiceImages(site)}
                      disabled={Boolean(repairingServiceImagesId || batchRepairingServiceImages || refreshingVisualVariationId || batchRefreshingVisualVariation || batchAiFillingAboutNav || regeneratingId)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-sky-200 text-sky-700 hover:bg-sky-50 disabled:opacity-50"
                      aria-label="Repair service card images"
                    >
                      {repairingServiceImagesId === site.businessId ? (
                        <RefreshCw size={14} className="animate-spin" />
                      ) : (
                        <ImageIcon size={14} />
                      )}
                    </button>
                  </HoverTooltip>
                )}
                <HoverTooltip text="Refresh only this site's saved font pairing to the stable seeded visual variation. No AI call, no copy changes, and no image changes.">
                  <button
                    type="button"
                    onClick={() => handleRefreshVisualVariation(site)}
                    disabled={Boolean(refreshingVisualVariationId || batchRefreshingVisualVariation || repairingServiceImagesId || batchRepairingServiceImages || batchAiFillingAboutNav || regeneratingId)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-violet-200 text-violet-700 hover:bg-violet-50 disabled:opacity-50"
                    aria-label="Refresh visual variation"
                  >
                    {refreshingVisualVariationId === site.businessId ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : (
                      <Shuffle size={14} />
                    )}
                  </button>
                </HoverTooltip>
                {site.latestGenerationJobId ? (
                  <HoverTooltip text={`Open latest generation job audit (${site.latestGenerationJobStatus || "unknown"}${site.latestGenerationJobUpdatedAt ? `, ${new Date(site.latestGenerationJobUpdatedAt).toLocaleString()}` : ""}).`}>
                    <a
                      href={`/admin/jobs?job=${encodeURIComponent(site.latestGenerationJobId)}&q=${encodeURIComponent(site.latestGenerationJobId)}`}
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border ${latestJobActionClass(site.latestGenerationJobStatus)}`}
                      aria-label="Open latest generation job audit"
                    >
                      <ListChecks size={14} />
                    </a>
                  </HoverTooltip>
                ) : (
                  <HoverTooltip text="No generation job audit row is linked to this older site record yet. Regenerate once to create one.">
                    <button
                      type="button"
                      disabled
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-400 opacity-60"
                      aria-label="No generation job audit available"
                    >
                      <ListChecks size={14} />
                    </button>
                  </HoverTooltip>
                )}
                <div className="relative">
                  <HoverTooltip text="Choose AI copy regeneration or Google re-gather/resave for this generated site.">
                    <button
                      type="button"
                      onClick={() => setOpenRegenerateMenu(openRegenerateMenu === site.businessId ? "" : site.businessId)}
                      disabled={Boolean(regeneratingId || repairingServiceImagesId || batchRepairingServiceImages || refreshingVisualVariationId || batchRefreshingVisualVariation || batchAiFillingAboutNav)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      aria-label="Open regenerate menu"
                    >
                      <RotateCw size={14} className={regeneratingId === site.businessId ? "animate-spin" : ""} />
                    </button>
                  </HoverTooltip>
                  {openRegenerateMenu === site.businessId && (
                    <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-2xl border border-gray-200 bg-white p-3 text-left shadow-xl">
                      <div className="mb-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-900">
                            Regenerate option
                            <HelpTooltip text="AI regenerate keeps protected site structure and asks AI for copy improvements. Re-gather refreshes Google data and resaves without an AI call." />
                          </p>
                          <div className="flex shrink-0 items-center gap-1">
                            <AdminDocsReader
                              pathname="/admin/sites"
                              defaultDocId="design-guide"
                              tooltip="Open design guide for checking regenerated site output."
                              buttonClassName="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-indigo-700"
                              iconSize={14}
                            />
                            <AdminDocsReader
                              pathname="/admin/sites"
                              defaultDocId="niche-style-presets"
                              tooltip="Open niche style preset docs for this site's industry styling."
                              buttonClassName="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-indigo-700"
                              iconSize={14}
                            />
                            <AdminDocsReader
                              pathname="/admin/sites"
                              defaultDocId="font-pairing-guide"
                              tooltip="Open font pairing docs for typography review."
                              buttonClassName="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-indigo-700"
                              iconSize={14}
                            />
                          </div>
                        </div>
                        <p className="mt-1 text-[11px] leading-4 text-gray-500">Re-gather fixes stale Google data like fallback Maps URLs. AI regenerate asks for copy patches, including missing About copy and short service submenu labels; protected structure stays deterministic.</p>
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
                            disabled={!activeRegenerateModel || Boolean(regeneratingId || batchAiFillingAboutNav)}
                            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                          >
                            <Brain size={14} />
                            AI fill missing/copy with selected model
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
                            disabled={Boolean(regeneratingId || batchAiFillingAboutNav)}
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
              <HoverTooltip text="Close this JSON/data modal.">
                <button type="button" onClick={() => setActiveData(null)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="Close data modal">
                  <X size={18} />
                </button>
              </HoverTooltip>
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

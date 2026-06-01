import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { placePhone } from "../../../lib/generatedSiteScaffold";
import { useLocalStorageState } from "../../../lib/localStorageState";
import { parseProspectScoreWeights, prospectScoringPresets, scoreThresholdOptions } from "../../../lib/prospectScoring";

type UseProspectFiltersAndScoringParams = {
  settings: any;
  loadingSettings: boolean;
  prospectDrafts: any[];
  setProspectDrafts: Dispatch<SetStateAction<any[]>>;
  getPlaceKey: (place: any) => string;
  hasGatheredDetails: (place: any) => boolean;
  restoreProspectDetailState: (rows: any[]) => void;
};

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

export default function useProspectFiltersAndScoring({
  settings,
  loadingSettings,
  prospectDrafts,
  setProspectDrafts,
  getPlaceKey,
  hasGatheredDetails,
  restoreProspectDetailState,
}: UseProspectFiltersAndScoringParams) {
  const [prospectFilter, setProspectFilter] = useLocalStorageState("webview.adminLeads.prospectFilter", "active");
  const [websiteFilter, setWebsiteFilter] = useLocalStorageState("webview.adminLeads.websiteFilter", "none");
  const [minRatingFilter, setMinRatingFilter] = useLocalStorageState("webview.adminLeads.minRatingFilter", "0");
  const [minReviewsFilter, setMinReviewsFilter] = useLocalStorageState("webview.adminLeads.minReviewsFilter", "0");
  const [minScoreFilter, setMinScoreFilter] = useLocalStorageState("webview.adminLeads.minScoreFilter", "0");
  const [cityFilter, setCityFilter] = useLocalStorageState("webview.adminLeads.cityFilter", "");
  const [stateFilter, setStateFilter] = useLocalStorageState("webview.adminLeads.stateFilter", "");
  const [nicheFilter, setNicheFilter] = useLocalStorageState("webview.adminLeads.nicheFilter", "");
  const [filtersOpen, setFiltersOpen] = useLocalStorageState("webview.adminLeads.filtersOpen", "0");
  const [autoWebsitePrecheck, setAutoWebsitePrecheck] = useLocalStorageState("webview.adminLeads.autoWebsitePrecheck", "1");
  const [websitePrecheckLimit, setWebsitePrecheckLimit] = useLocalStorageState("webview.adminLeads.websitePrecheckLimit", "10");
  const [selectedProspects, setSelectedProspects] = useState<Record<string, boolean>>({});

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
        restoreProspectDetailState(rows);
      })
      .catch(e => console.error(e));
  };

  useEffect(() => {
    fetchProspectDrafts();
  }, [prospectFilter, websiteFilter, minRatingFilter, minReviewsFilter, cityFilter, stateFilter, nicheFilter]);

  useEffect(() => {
    if (loadingSettings) return;
    const defaultThreshold = String(settings?.SCORING_MIN_SCORE_DEFAULT || "");
    if (scoreThresholdOptions.some((option) => option.value === defaultThreshold)) {
      setMinScoreFilter(defaultThreshold);
    }
  }, [loadingSettings, settings?.SCORING_MIN_SCORE_DEFAULT, setMinScoreFilter]);

  const scoreWeights = parseProspectScoreWeights(settings?.SCORING_WEIGHTS_JSON);
  const activeScoringPreset = prospectScoringPresets.find((preset) => preset.key === settings?.SCORING_PRESET);
  const activeScoringPresetLabel = activeScoringPreset?.label || (settings?.SCORING_PRESET === "custom" ? "Custom" : "Balanced");

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

  const minScore = Number(minScoreFilter || 0);

  const getProspectView = (searchResults: any[], activeWorkspaceTab: string) => {
    const visibleProspectsRaw = activeWorkspaceTab === "search" ? searchResults : prospectDrafts;
    const visibleProspects = [...visibleProspectsRaw]
      .filter((place) => prospectScore(place).score >= minScore)
      .sort((a, b) => prospectScore(b).score - prospectScore(a).score);
    return {
      visibleProspects,
      selectedVisibleProspects: visibleProspects.filter((place) => selectedProspects[getPlaceKey(place)]),
    };
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

  return {
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
  };
}

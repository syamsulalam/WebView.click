import { useState } from "react";

type UseProspectSearchParams = {
  websiteFilter: string;
  autoWebsitePrecheck: string;
  websitePrecheckLimit: string;
  setLeadWorkspaceTab: (value: string) => void;
  fetchProspectDrafts: () => void;
  getPlaceKey: (place: any) => string;
  setPlaceDetails: (value: any) => void;
  setGenerationMessages: (value: any) => void;
};

export default function useProspectSearch({
  websiteFilter,
  autoWebsitePrecheck,
  websitePrecheckLimit,
  setLeadWorkspaceTab,
  fetchProspectDrafts,
  getPlaceKey,
  setPlaceDetails,
  setGenerationMessages,
}: UseProspectSearchParams) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchMessage, setSearchMessage] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchActive, setSearchActive] = useState(false);
  const [searchHistory, setSearchHistory] = useState<any[]>([]);
  const [loadingSearchHistory, setLoadingSearchHistory] = useState(false);
  const [selectedSearchHistoryKey, setSelectedSearchHistoryKey] = useState("");

  const fetchSearchHistory = () => {
    setLoadingSearchHistory(true);
    fetch("/api/places/history?limit=30")
      .then(r => r.ok ? r.json() : [])
      .then((data) => setSearchHistory(Array.isArray(data) ? data : []))
      .catch(e => console.error(e))
      .finally(() => setLoadingSearchHistory(false));
  };

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
      setPlaceDetails((prev: Record<string, any>) => ({ ...prev, ...hydratedDetails }));
    }
  };

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    setSearchResults,
    searchMessage,
    isSearching,
    searchActive,
    setSearchActive,
    searchHistory,
    loadingSearchHistory,
    selectedSearchHistoryKey,
    setSelectedSearchHistoryKey,
    fetchSearchHistory,
    handleSearch,
    applySearchHistory,
  };
}

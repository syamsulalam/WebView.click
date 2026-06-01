import { useState, type Dispatch, type SetStateAction } from "react";
import { useLocalStorageState } from "../../../lib/localStorageState";

type UseManualImportParams = {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  setSearchResults: Dispatch<SetStateAction<any[]>>;
  setSearchActive: (value: boolean) => void;
  setSelectedSearchHistoryKey: (value: string) => void;
  setWebsiteFilter: (value: string) => void;
  setLeadWorkspaceTab: (value: string) => void;
  fetchProspectDrafts: () => void;
  fetchSearchHistory: () => void;
  fetchManualDuplicateQueue: () => void;
};

export default function useManualImport({
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
}: UseManualImportParams) {
  const [manualImportOpen, setManualImportOpen] = useLocalStorageState("webview.adminLeads.manualImportOpen", "0");
  const [manualMapsUrl, setManualMapsUrl] = useLocalStorageState("webview.adminLeads.manualMapsUrl", "");
  const [manualCaptureText, setManualCaptureText] = useLocalStorageState("webview.adminLeads.manualCaptureText", "");
  const [manualImportLoading, setManualImportLoading] = useState(false);
  const [manualImportMessage, setManualImportMessage] = useState("");
  const [isTrimmingCache, setIsTrimmingCache] = useState(false);
  const [cacheTrimMessage, setCacheTrimMessage] = useState("");

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

  return {
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
  };
}

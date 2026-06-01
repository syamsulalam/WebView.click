import { useState, type Dispatch, type SetStateAction } from "react";
import { placeMapsUrl, placePhone } from "../../../lib/generatedSiteScaffold";

type UseManualDuplicateReviewParams = {
  getPlaceKey: (place: any) => string;
  setSearchResults: Dispatch<SetStateAction<any[]>>;
  setProspectDrafts: Dispatch<SetStateAction<any[]>>;
  setSearchActive: (value: boolean) => void;
  setLeadWorkspaceTab: (value: string) => void;
};

export default function useManualDuplicateReview({
  getPlaceKey,
  setSearchResults,
  setProspectDrafts,
  setSearchActive,
  setLeadWorkspaceTab,
}: UseManualDuplicateReviewParams) {
  const [manualDuplicateQueue, setManualDuplicateQueue] = useState<any[]>([]);
  const [manualDuplicateLoading, setManualDuplicateLoading] = useState(false);
  const [manualDuplicateMessage, setManualDuplicateMessage] = useState("");

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

  return {
    manualDuplicateQueue,
    manualDuplicateLoading,
    manualDuplicateMessage,
    fetchManualDuplicateQueue,
    mergePreviewFields,
    reviewDuplicateInList,
    mergeManualDuplicate,
    skipManualDuplicate,
  };
}

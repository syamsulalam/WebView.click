import { useState } from "react";
import {
  buildPaletteOptionForPhoto,
  buildPhotoSelection,
  buildProspectSelectionPayload,
  googlePlacePhotoUrlForPhoto,
  mapsQueryPlaceholder,
  saveProspectSelection,
  sortedPhotosForPlace,
} from "../../../lib/adminSiteGeneration";
import { normalizePaletteRoles } from "../../../lib/colorPaletteRoles";
import { placeMapsUrl, placePhone } from "../../../lib/generatedSiteScaffold";

type UseProspectDetailsParams = {
  getPlaceKey: (place: any) => string;
  setGenerationMessages: (value: any) => void;
};

type LoadPlaceDetailsOptions = {
  setSearchResults: (value: any) => void;
  setProspectDrafts: (value: any) => void;
};

export default function useProspectDetails({ getPlaceKey, setGenerationMessages }: UseProspectDetailsParams) {
  const [placeDetails, setPlaceDetails] = useState<Record<string, any>>({});
  const [placeDetailsLoading, setPlaceDetailsLoading] = useState<Record<string, boolean>>({});
  const [detailsPanelPlace, setDetailsPanelPlace] = useState<any>(null);
  const [logoSelections, setLogoSelections] = useState<Record<string, { url: string; reference: string; palette: string[]; attributions: string[]; priorityLabel: string; source: string }>>({});
  const [paletteOptionsByPlace, setPaletteOptionsByPlace] = useState<Record<string, any[]>>({});

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

  const restoreProspectDetailState = (rows: any[]) => {
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
    const next = normalizePaletteRoles({ palette }).orderedPalette;
    if (next[0]) next[0] = darkenForWhiteText(next[0]);
    if (next[1]) next[1] = darkenForWhiteText(next[1]);
    return next;
  };

  const selectLogoPhoto = async (placeId: string, imageUrl: string, photo: any, businessName: string) => {
    try {
      const palette = normalizePaletteForContrast(await extractPaletteFromImage(imageUrl));
      const selection = buildPhotoSelection({ photo, imageUrl, businessName, palette });
      setLogoSelections(prev => ({ ...prev, [placeId]: selection }));
      await saveProspectSelection(
        placeId,
        buildProspectSelectionPayload({
          selection,
          palette,
          paletteOptions: paletteOptionsByPlace[placeId] || [],
        }),
      );
    } catch (error) {
      console.error(error);
      const palette = ["#111827", "#4F46E5", "#F3F4F6"];
      const selection = buildPhotoSelection({ photo, imageUrl, businessName, palette });
      setLogoSelections(prev => ({ ...prev, [placeId]: selection }));
      await saveProspectSelection(
        placeId,
        buildProspectSelectionPayload({
          selection,
          palette,
          paletteOptions: paletteOptionsByPlace[placeId] || [],
        }),
      );
    }
  };

  const buildPaletteOptionsForPlace = async (placeKey: string, place: any) => {
    if (!placeKey || paletteOptionsByPlace[placeKey]?.length > 0) return paletteOptionsByPlace[placeKey] || [];
    const photos = sortedPhotosForPlace(place).slice(0, 5);
    if (photos.length === 0) return [];
    const options: any[] = [];
    for (let index = 0; index < photos.length; index += 1) {
      const photo = photos[index];
      const sourceImageUrl = googlePlacePhotoUrlForPhoto(photo, 480);
      if (!sourceImageUrl) continue;
      let colors = ["#111827", "#4F46E5", "#F3F4F6"];
      try {
        colors = normalizePaletteForContrast(await extractPaletteFromImage(sourceImageUrl));
      } catch (error) {
        console.error(error);
      }
      options.push(buildPaletteOptionForPhoto({
        photo,
        index,
        colors,
        sourceImageUrl,
        businessName: place.name || "Business",
      }));
    }
    if (options.length > 0) {
      setPaletteOptionsByPlace(prev => ({ ...prev, [placeKey]: options }));
      await saveProspectSelection(placeKey, buildProspectSelectionPayload({ paletteOptions: options }));
    }
    return options;
  };

  const loadPlaceDetails = async (place: any, { setSearchResults, setProspectDrafts }: LoadPlaceDetailsOptions) => {
    const placeKey = getPlaceKey(place);
    const placeId = place?.place_id || place?.id;
    if (!placeId || placeDetailsLoading[placeKey]) return null;
    if (mapsQueryPlaceholder(place)) {
      setGenerationMessages((prev: Record<string, any>) => ({
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
        setSearchResults((prev: any[]) => prev.map((item) => getPlaceKey(item) === placeKey ? hydratedPlace : item));
        setProspectDrafts((prev: any[]) => prev.map((item) => getPlaceKey(item) === placeKey ? hydratedPlace : item));
        const summary = [
          Array.isArray(result.photos) ? `${result.photos.length} photos` : "0 photos",
          Array.isArray(result.reviews) ? `${result.reviews.length} reviews` : "0 reviews",
          placePhone(result) ? "phone" : "no phone",
          placeMapsUrl(result) ? "direct Maps URL" : "no direct Maps URL",
        ].join(", ");
        setGenerationMessages((prev: Record<string, any>) => ({
          ...prev,
          [placeKey]: { type: "success", text: `Google Places details gathered (${summary}). Ready to generate.` },
        }));
        void buildPaletteOptionsForPlace(placeKey, hydratedPlace);
        return result;
      }
    } catch (error) {
      console.error(error);
      setGenerationMessages((prev: Record<string, any>) => ({
        ...prev,
        [placeKey]: { type: "error", text: error instanceof Error ? error.message : "Gagal mengambil detail foto Places." },
      }));
    } finally {
      setPlaceDetailsLoading(prev => ({ ...prev, [placeKey]: false }));
    }
    return null;
  };

  return {
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
  };
}

import { ExternalLink, FileText, ListChecks, Loader2, PanelRightOpen, Play, X } from "lucide-react";
import AdminAiReadinessBadge from "../../../components/AdminAiReadinessBadge";
import HelpTooltip from "../../../components/HelpTooltip";
import HoverTooltip from "../../../components/HoverTooltip";
import { formatUsd } from "../../../lib/aiPricing";

type ProspectCardProps = {
  place: any;
  index: number;
  selected: boolean;
  scorePopoverKey: string;
  generationMessage?: { type: "success" | "error"; text: string; businessId?: string };
  placeDetailsLoading: Record<string, boolean>;
  logoSelections: Record<string, { url: string; palette: string[] }>;
  paletteOptions: any[];
  isGenerating: boolean;
  generatingPlaceKey: string;
  activeProviderKey: string;
  activeModel: string;
  activeProviderKeyReady: boolean;
  getPlaceKey: (place: any) => string;
  mergePlaceWithDetails: (place: any) => any;
  sortedPhotosForPlace: (place: any) => any[];
  hasGatheredDetails: (place: any) => boolean;
  mapsQueryPlaceholder: (place: any) => boolean;
  websiteBadge: (place: any) => { label: string; className: string; title: string };
  googleBusinessListingUrl: (place: any) => string;
  prospectScore: (place: any) => { score: number; breakdown: any[] };
  estimateGenerateCost: (place: any) => { total: number };
  googlePlacePhotoUrlForPhoto: (photo: any) => string;
  photoPriorityLabel: (photo: any, businessName: string) => string;
  setScorePopoverKey: (key: string) => void;
  toggleProspectSelection: (place: any, selected: boolean) => void;
  setDetailsPanelPlace: (place: any) => void;
  updateProspectStatus: (place: any, status: string) => void;
  loadPlaceDetails: (place: any) => void;
  handleGenerateSite: (place: any) => void;
  selectLogoPhoto: (placeKey: string, imageUrl: string, photo: any, businessName: string) => void;
};

export default function ProspectCard({
  place,
  index,
  selected,
  scorePopoverKey,
  generationMessage,
  placeDetailsLoading,
  logoSelections,
  paletteOptions,
  isGenerating,
  generatingPlaceKey,
  activeProviderKey,
  activeModel,
  activeProviderKeyReady,
  getPlaceKey,
  mergePlaceWithDetails,
  sortedPhotosForPlace,
  hasGatheredDetails,
  mapsQueryPlaceholder,
  websiteBadge,
  googleBusinessListingUrl,
  prospectScore,
  estimateGenerateCost,
  googlePlacePhotoUrlForPhoto,
  photoPriorityLabel,
  setScorePopoverKey,
  toggleProspectSelection,
  setDetailsPanelPlace,
  updateProspectStatus,
  loadPlaceDetails,
  handleGenerateSite,
  selectLogoPhoto,
}: ProspectCardProps) {
  const placeKey = getPlaceKey(place) || String(index);
  const displayPlace = mergePlaceWithDetails(place);
  const currentPhotos = sortedPhotosForPlace(displayPlace);
  const detailsReady = hasGatheredDetails(displayPlace);
  const isMapsPlaceholder = mapsQueryPlaceholder(displayPlace);
  const websiteStatus = websiteBadge(displayPlace);
  const listingUrl = googleBusinessListingUrl(displayPlace);
  const score = prospectScore(displayPlace);

  return (
    <div className="p-4 border border-gray-100 rounded-xl bg-gray-50">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 gap-3">
          <input
            type="checkbox"
            checked={selected}
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
              <div className="mt-1 flex flex-wrap gap-3">
                <a href={`/${displayPlace.generatedBusinessId}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:underline">
                  Open generated preview <ExternalLink size={12} />
                </a>
                <a href={`/audit/${displayPlace.generatedBusinessId}?admin=1`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:underline">
                  Open profile audit <FileText size={12} />
                </a>
              </div>
            )}
            {displayPlace.lastError && (
              <p className="mt-1 max-w-2xl text-xs font-medium text-red-700">Last generate error: {displayPlace.lastError}</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <HoverTooltip text="Open prospect details drawer.">
            <button
              type="button"
              onClick={() => setDetailsPanelPlace(displayPlace)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              aria-label="Open prospect details"
            >
              <PanelRightOpen size={16} />
            </button>
          </HoverTooltip>
          <HoverTooltip text="Skip this prospect in the workflow.">
            <button
              type="button"
              onClick={() => updateProspectStatus(displayPlace, "skipped")}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-500 hover:bg-gray-50"
              aria-label="Skip prospect"
            >
              <X size={16} />
            </button>
          </HoverTooltip>
          {!detailsReady ? (
            <HoverTooltip text={isMapsPlaceholder ? "This is a Maps search/query placeholder, not a business listing. Import captured listing JSON first." : "Gather Places details, reviews, exact Maps URL, and photos for this prospect."}>
              <button
                type="button"
                onClick={() => {
                  updateProspectStatus(displayPlace, "details_loaded");
                  loadPlaceDetails(displayPlace);
                }}
                disabled={placeDetailsLoading[placeKey] || !displayPlace.place_id || isMapsPlaceholder}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                aria-label="Gather prospect data"
              >
                {placeDetailsLoading[placeKey] ? <Loader2 className="animate-spin" size={18} /> : <ListChecks size={18} />}
              </button>
            </HoverTooltip>
          ) : (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {!isMapsPlaceholder && (
                <HoverTooltip text="Open deterministic Google Business Profile audit for this gathered prospect.">
                  <a
                    href={`/audit/${encodeURIComponent(displayPlace.generatedBusinessId || displayPlace.place_id || placeKey)}?admin=1`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 transition hover:bg-gray-50"
                    aria-label="Open profile audit"
                  >
                    <FileText size={16} />
                  </a>
                </HoverTooltip>
              )}
              <HoverTooltip text={isMapsPlaceholder ? "This is not a specific business listing yet." : "Generate a website for this gathered prospect."}>
                <button
                  type="button"
                  onClick={() => handleGenerateSite(displayPlace)}
                  disabled={isGenerating || isMapsPlaceholder}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                  aria-label="Generate prospect website"
                >
                  {generatingPlaceKey === placeKey ? <Loader2 className="animate-spin" size={18} /> : <Play size={18} />}
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
            : isMapsPlaceholder
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
              const imageUrl = googlePlacePhotoUrlForPhoto(photo);
              const photoSelected = logoSelections[placeKey]?.url === imageUrl;
              const priorityLabel = photoPriorityLabel(photo, displayPlace.name);
              return (
                <HoverTooltip key={photo.photo_reference || photoIdx} text={`Gunakan sebagai sumber warna brand. Prioritas: ${priorityLabel}`}>
                  <button
                    type="button"
                    onClick={() => selectLogoPhoto(placeKey, imageUrl, photo, displayPlace.name)}
                    className={`relative w-24 h-24 rounded-xl overflow-hidden border-2 bg-white shrink-0 ${photoSelected ? "border-indigo-600" : "border-gray-200 hover:border-gray-300"}`}
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
          {paletteOptions.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-500">{paletteOptions.length} palette options:</span>
              {paletteOptions.map((option) => (
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
}

import { ExternalLink, Images, Loader2, X } from "lucide-react";
import AdminDocsReader from "../../../components/AdminDocsReader";
import HelpTooltip from "../../../components/HelpTooltip";
import HoverTooltip from "../../../components/HoverTooltip";

type ProspectDetailsDrawerProps = {
  place: any;
  placeDetails: Record<string, any>;
  placeDetailsLoading: Record<string, boolean>;
  logoSelections: Record<string, { url: string; palette: string[] }>;
  getPlaceKey: (place: any) => string;
  sortedPhotosForPlace: (place: any) => any[];
  mapsQueryPlaceholder: (place: any) => boolean;
  googleBusinessListingUrl: (place: any) => string;
  googlePlacePhotoUrlForPhoto: (photo: any, maxWidth?: number) => string;
  photoPriorityLabel: (photo: any, businessName: string) => string;
  selectLogoPhoto: (placeKey: string, imageUrl: string, photo: any, businessName: string) => void;
  loadPlaceDetails: (place: any) => void;
  updateProspectStatus: (place: any, status: string) => void;
  onClose: () => void;
};

export default function ProspectDetailsDrawer({
  place,
  placeDetails,
  placeDetailsLoading,
  logoSelections,
  getPlaceKey,
  sortedPhotosForPlace,
  mapsQueryPlaceholder,
  googleBusinessListingUrl,
  googlePlacePhotoUrlForPhoto,
  photoPriorityLabel,
  selectLogoPhoto,
  loadPlaceDetails,
  updateProspectStatus,
  onClose,
}: ProspectDetailsDrawerProps) {
  const placeKey = getPlaceKey(place);
  const mergedPlace = {
    ...place,
    ...(placeDetails[placeKey] || {}),
    photos: Array.isArray(placeDetails[placeKey]?.photos) && placeDetails[placeKey].photos.length > 0
      ? placeDetails[placeKey].photos
      : place.photos,
  };
  const photos = sortedPhotosForPlace(mergedPlace);
  const isMapsPlaceholder = mapsQueryPlaceholder(mergedPlace);

  return (
    <div className="fixed inset-0 z-[260] bg-slate-950/40">
      <aside className="ml-auto h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl">
        <div className="p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Prospect details</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">{mergedPlace.name}</h2>
              <p className="mt-1 text-sm text-slate-500">{mergedPlace.formatted_address || mergedPlace.formattedAddress || "No address"}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <AdminDocsReader
                pathname="/admin/leads"
                defaultDocId="google-places-data-inventory"
                tooltip="Open Google Places data docs for prospect details."
                buttonClassName="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-indigo-700"
                iconSize={17}
              />
              <HoverTooltip text="Close prospect details drawer.">
                <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close prospect details">
                  <X size={18} />
                </button>
              </HoverTooltip>
            </div>
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
            <HoverTooltip text={isMapsPlaceholder ? "This is a Maps search/query placeholder, not a business listing. Import captured listing JSON first." : "Refresh this prospect's Google details and photos."}>
              <button
                type="button"
                onClick={() => loadPlaceDetails(mergedPlace)}
                disabled={placeDetailsLoading[placeKey] || !mergedPlace.place_id || isMapsPlaceholder}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-950 text-white disabled:opacity-50"
                aria-label="Refresh prospect details and photos"
              >
                {placeDetailsLoading[placeKey] ? <Loader2 className="animate-spin" size={15} /> : <Images size={15} />}
              </button>
            </HoverTooltip>
            {googleBusinessListingUrl(mergedPlace) && (
              <HoverTooltip text="Open the original Google Maps listing in a new tab.">
                <a href={googleBusinessListingUrl(mergedPlace)} target="_blank" rel="noreferrer" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50" aria-label="Open Google Maps listing">
                  <ExternalLink size={15} />
                </a>
              </HoverTooltip>
            )}
          </div>
          {isMapsPlaceholder && (
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
            <div className="flex items-center justify-between gap-3">
              <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                Photo and palette source
                <HelpTooltip text="The selected Places photo and extracted palette become brand provenance in the generated JSON and affect preview colors." />
              </p>
              <AdminDocsReader
                pathname="/admin/leads"
                defaultDocId="google-places-photo-strategy"
                tooltip="Open Google Places photo strategy docs."
                buttonClassName="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-indigo-700"
                iconSize={16}
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">Choose the closest brand/logo-like image. Selection is saved into the generated JSON as Google Places provenance.</p>
            {photos.length > 0 ? (
              <div className="mt-3 grid grid-cols-3 gap-3">
                {photos.slice(0, 12).map((photo: any, index: number) => {
                  const imageUrl = googlePlacePhotoUrlForPhoto(photo, 480);
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
      </aside>
    </div>
  );
}

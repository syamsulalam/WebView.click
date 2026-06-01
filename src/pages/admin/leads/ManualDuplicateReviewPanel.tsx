import { Loader2, RefreshCw } from "lucide-react";
import HelpTooltip from "../../../components/HelpTooltip";
import HoverTooltip from "../../../components/HoverTooltip";

type ManualDuplicateReviewPanelProps = {
  manualDuplicateQueue: any[];
  manualDuplicateLoading: boolean;
  manualDuplicateMessage: string;
  fetchManualDuplicateQueue: () => void;
  getPlaceKey: (place: any) => string;
  mergePreviewFields: (keepPlace: any, duplicatePlace: any) => any[];
  reviewDuplicateInList: (place: any) => void;
  mergeManualDuplicate: (keepPlace: any, duplicatePlace: any) => void;
  skipManualDuplicate: (place: any) => void;
};

export default function ManualDuplicateReviewPanel({
  manualDuplicateQueue,
  manualDuplicateLoading,
  manualDuplicateMessage,
  fetchManualDuplicateQueue,
  getPlaceKey,
  mergePreviewFields,
  reviewDuplicateInList,
  mergeManualDuplicate,
  skipManualDuplicate,
}: ManualDuplicateReviewPanelProps) {
  return (
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
        <HoverTooltip text="Reload likely manual duplicate groups for review.">
          <button
            type="button"
            onClick={fetchManualDuplicateQueue}
            disabled={manualDuplicateLoading}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-amber-300 bg-white text-amber-900 hover:bg-amber-100 disabled:opacity-50"
            aria-label="Refresh duplicate review"
          >
            {manualDuplicateLoading ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
          </button>
        </HoverTooltip>
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
  );
}

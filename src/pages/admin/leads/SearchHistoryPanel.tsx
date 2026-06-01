import { History, Loader2, RefreshCw } from "lucide-react";
import HelpTooltip from "../../../components/HelpTooltip";
import HoverTooltip from "../../../components/HoverTooltip";

type SearchHistoryPanelProps = {
  searchHistory: any[];
  selectedSearchHistoryKey: string;
  loadingSearchHistory: boolean;
  fetchSearchHistory: () => void;
  applySearchHistory: (item: any) => void;
};

export default function SearchHistoryPanel({
  searchHistory,
  selectedSearchHistoryKey,
  loadingSearchHistory,
  fetchSearchHistory,
  applySearchHistory,
}: SearchHistoryPanelProps) {
  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            <History size={16} />
            Search history
            <HelpTooltip text="Each search term keeps its cached result list, while every business card is hydrated from the current Google place_id prospect record. This lets the same business keep one shared progress history across searches." />
          </p>
        </div>
        <HoverTooltip text="Reload cached Google Places search history from D1.">
          <button
            type="button"
            onClick={fetchSearchHistory}
            disabled={loadingSearchHistory}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            aria-label="Refresh search history"
          >
            {loadingSearchHistory ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
          </button>
        </HoverTooltip>
      </div>
      {searchHistory.length > 0 ? (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {searchHistory.map((item) => {
            const summary = item.summary || {};
            const active = selectedSearchHistoryKey === item.queryKey;
            return (
              <HoverTooltip key={item.queryKey || item.query} text="Load this cached search term and show current progress per Google Business listing.">
                <button
                  type="button"
                  onClick={() => applySearchHistory(item)}
                  className={`min-w-[260px] rounded-xl border p-3 text-left transition ${
                    active ? "border-indigo-300 bg-indigo-50" : "border-slate-200 bg-slate-50 hover:bg-white"
                  }`}
                >
                  <span className="block truncate text-sm font-semibold text-slate-950">{item.query}</span>
                  <span className="mt-1 block text-xs text-slate-500">
                    {summary.total || item.resultCount || 0} results
                    {item.updatedAt ? ` · ${new Date(item.updatedAt).toLocaleDateString()}` : ""}
                  </span>
                  <span className="mt-2 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">{summary.noWebsite || 0} no site</span>
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-800">{summary.detailsLoaded || 0} gathered</span>
                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-800">{summary.generated || 0} generated</span>
                    {(summary.errors || 0) > 0 && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-800">{summary.errors} error</span>
                    )}
                  </span>
                </button>
              </HoverTooltip>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-500">
          Search history will appear after Google Places searches are cached.
        </div>
      )}
    </div>
  );
}

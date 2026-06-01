import { Loader2, RefreshCw, Search } from "lucide-react";
import HoverTooltip from "../../../components/HoverTooltip";

type ProspectSearchPanelProps = {
  searchQuery: string;
  searchMessage: string;
  searchResultCount: number;
  isSearching: boolean;
  setSearchQuery: (value: string) => void;
  onSearch: (refresh: boolean) => void;
};

export default function ProspectSearchPanel({
  searchQuery,
  searchMessage,
  searchResultCount,
  isSearching,
  setSearchQuery,
  onSearch,
}: ProspectSearchPanelProps) {
  return (
    <>
      <div className="rounded-2xl border border-indigo-100 bg-white p-3 shadow-sm">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500" size={21} />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") onSearch(false);
              }}
              placeholder="Try: concrete contractor Tulsa OK, pool repair Phoenix AZ, tree service Greenville SC"
              className="w-full rounded-xl border border-indigo-200 bg-indigo-50/40 py-3 pl-12 pr-4 text-base font-medium text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
            />
          </div>
          <button
            type="button"
            onClick={() => onSearch(false)}
            disabled={isSearching}
            className="flex min-w-[150px] items-center justify-center rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {isSearching ? <Loader2 className="animate-spin" size={20} /> : "Search leads"}
          </button>
          <HoverTooltip text="Abaikan cache DB dan ambil ulang dari Google Places">
            <button
              type="button"
              onClick={() => onSearch(true)}
              disabled={isSearching || !searchQuery}
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-indigo-200 bg-white text-indigo-700 transition hover:bg-indigo-50 disabled:opacity-50"
              aria-label="Refresh Google Places search"
            >
              <RefreshCw size={16} />
            </button>
          </HoverTooltip>
        </div>
        <p className="mt-2 text-xs text-slate-500">Focus on US owner-operated local services: specific niche + city + state. Gather details, skip big chains, generate fast.</p>
      </div>

      {searchMessage && (
        <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
          searchResultCount > 0
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-amber-200 bg-amber-50 text-amber-800"
        }`}>
          {searchMessage}
        </div>
      )}
    </>
  );
}

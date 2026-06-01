import { RefreshCw, SlidersHorizontal, X } from "lucide-react";
import HelpTooltip from "../../../components/HelpTooltip";
import HoverTooltip from "../../../components/HoverTooltip";
import { scoreThresholdOptions } from "../../../lib/prospectScoring";

type ProspectFiltersPanelProps = {
  filtersOpen: string;
  activeFilterChips: string[];
  prospectFilter: string;
  websiteFilter: string;
  minRatingFilter: string;
  minReviewsFilter: string;
  minScoreFilter: string;
  cityFilter: string;
  stateFilter: string;
  nicheFilter: string;
  autoWebsitePrecheck: string;
  websitePrecheckLimit: string;
  setFiltersOpen: (value: string) => void;
  setProspectFilter: (value: string) => void;
  setWebsiteFilter: (value: string) => void;
  setMinRatingFilter: (value: string) => void;
  setMinReviewsFilter: (value: string) => void;
  setMinScoreFilter: (value: string) => void;
  setCityFilter: (value: string) => void;
  setStateFilter: (value: string) => void;
  setNicheFilter: (value: string) => void;
  setAutoWebsitePrecheck: (value: string) => void;
  setWebsitePrecheckLimit: (value: string) => void;
  resetLeadFilters: () => void;
  reloadProspectDrafts: () => void;
};

export default function ProspectFiltersPanel({
  filtersOpen,
  activeFilterChips,
  prospectFilter,
  websiteFilter,
  minRatingFilter,
  minReviewsFilter,
  minScoreFilter,
  cityFilter,
  stateFilter,
  nicheFilter,
  autoWebsitePrecheck,
  websitePrecheckLimit,
  setFiltersOpen,
  setProspectFilter,
  setWebsiteFilter,
  setMinRatingFilter,
  setMinReviewsFilter,
  setMinScoreFilter,
  setCityFilter,
  setStateFilter,
  setNicheFilter,
  setAutoWebsitePrecheck,
  setWebsitePrecheckLimit,
  resetLeadFilters,
  reloadProspectDrafts,
}: ProspectFiltersPanelProps) {
  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFiltersOpen(filtersOpen === "1" ? "0" : "1")}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${
              filtersOpen === "1" ? "border-indigo-300 bg-indigo-50 text-indigo-800" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
            }`}
          >
            <SlidersHorizontal size={16} />
            Filters
            <span className="rounded-full bg-slate-900 px-1.5 py-0.5 text-[10px] text-white">{activeFilterChips.length}</span>
          </button>
          {activeFilterChips.slice(0, 6).map((chip) => (
            <span key={chip} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700">
              {chip}
            </span>
          ))}
          {activeFilterChips.length > 6 && (
            <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700">+{activeFilterChips.length - 6}</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <HoverTooltip text="Reset all prospect filters back to defaults.">
            <button
              type="button"
              onClick={resetLeadFilters}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
              aria-label="Reset prospect filters"
            >
              <X size={14} />
            </button>
          </HoverTooltip>
          <HoverTooltip text="Reload saved prospect drafts from D1.">
            <button
              type="button"
              onClick={reloadProspectDrafts}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
              aria-label="Reload prospect drafts"
            >
              <RefreshCw size={14} />
            </button>
          </HoverTooltip>
        </div>
      </div>

      {filtersOpen === "1" && (
        <div className="mt-3 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-3 xl:grid-cols-5">
          <label className="text-sm">
            <span className="mb-1 flex items-center gap-1.5 font-medium text-slate-700">
              Status
              <HelpTooltip text="Active pipeline hides skipped and already generated prospects. All saved shows every saved prospect draft regardless of workflow status." />
            </span>
            <select value={prospectFilter} onChange={(event) => setProspectFilter(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="active">Active pipeline</option>
              <option value="new">New</option>
              <option value="details_loaded">Details loaded</option>
              <option value="site_generated">Site generated</option>
              <option value="contacted">Contacted</option>
              <option value="skipped">Skipped</option>
              <option value="all">All saved</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 flex items-center gap-1.5 font-medium text-slate-700">
              Website
              <HelpTooltip text="No website verified means Place Details was checked and did not return a website. Unknown means the listing has not been checked yet." />
            </span>
            <select value={websiteFilter} onChange={(event) => setWebsiteFilter(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="none">No website verified first</option>
              <option value="unknown">Website unknown</option>
              <option value="has">Has website</option>
              <option value="all">All</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 flex items-center gap-1.5 font-medium text-slate-700">
              Rating
              <HelpTooltip text="Minimum Google rating filter. Higher ratings usually improve conversion, but very new businesses may have useful low review counts." />
            </span>
            <select value={minRatingFilter} onChange={(event) => setMinRatingFilter(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="0">Any rating</option>
              <option value="3.5">3.5+</option>
              <option value="4">4.0+</option>
              <option value="4.5">4.5+</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 flex items-center gap-1.5 font-medium text-slate-700">
              Reviews
              <HelpTooltip text="Minimum Google review count. The score formula favors enough reviews for trust while avoiding businesses that may already have mature marketing." />
            </span>
            <select value={minReviewsFilter} onChange={(event) => setMinReviewsFilter(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="0">Any reviews</option>
              <option value="10">10+</option>
              <option value="25">25+</option>
              <option value="50">50+</option>
              <option value="100">100+</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 flex items-center gap-1.5 font-medium text-slate-700">
              Score
              <HelpTooltip text="Conversion score prioritizes verified no-website businesses with strong rating, useful review count, phone, US market, and no generated site yet." />
            </span>
            <select value={minScoreFilter} onChange={(event) => setMinScoreFilter(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500">
              {scoreThresholdOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 flex items-center gap-1.5 font-medium text-slate-700">
              City
              <HelpTooltip text="Client-side filter against the saved address/city fields. Useful after broad searches like a whole metro area." />
            </span>
            <input value={cityFilter} onChange={(event) => setCityFilter(event.target.value)} placeholder="Dallas" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
          </label>
          <label className="text-sm">
            <span className="mb-1 flex items-center gap-1.5 font-medium text-slate-700">
              State
              <HelpTooltip text="Client-side state/region filter. For US prospects, use two-letter state codes when possible." />
            </span>
            <input value={stateFilter} onChange={(event) => setStateFilter(event.target.value)} placeholder="TX" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
          </label>
          <label className="text-sm">
            <span className="mb-1 flex items-center gap-1.5 font-medium text-slate-700">
              Niche
              <HelpTooltip text="Filters by business type/category/search niche. This helps narrow broad cached search results before batch generation." />
            </span>
            <input value={nicheFilter} onChange={(event) => setNicheFilter(event.target.value)} placeholder="concrete" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
          </label>
          <label className="text-sm">
            <span className="mb-1 flex items-center gap-1.5 font-medium text-slate-700">
              Website check
              <HelpTooltip text="Auto pre-check calls lightweight Place Details for top search results so existing-website businesses can be deprioritized before gather/generate." />
            </span>
            <select value={autoWebsitePrecheck} onChange={(event) => setAutoWebsitePrecheck(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="1">Auto pre-check</option>
              <option value="0">Search only</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 flex items-center gap-1.5 font-medium text-slate-700">
              Check limit
              <HelpTooltip text="Controls how many top Google Places results get website pre-check calls during search. Higher is more accurate but uses more Places Details requests." />
            </span>
            <select value={websitePrecheckLimit} onChange={(event) => setWebsitePrecheckLimit(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="5">Top 5</option>
              <option value="10">Top 10</option>
              <option value="20">Top 20</option>
            </select>
          </label>
        </div>
      )}
    </div>
  );
}

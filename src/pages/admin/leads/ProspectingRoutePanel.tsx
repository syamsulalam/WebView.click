import HelpTooltip from "../../../components/HelpTooltip";
import HoverTooltip from "../../../components/HoverTooltip";
import { composeProspectingQuery, marketOptions, nicheOptions, progressSteps } from "./prospectingData";

type ProspectingRoutePanelProps = {
  prospectingState: string;
  prospectingCity: string;
  prospectingNiche: string;
  currentProgress: Record<string, boolean>;
  setProspectingState: (value: string) => void;
  setProspectingCity: (value: string) => void;
  setProspectingNiche: (value: string) => void;
  setSearchQuery: (value: string) => void;
  setCityFilter: (value: string) => void;
  setStateFilter: (value: string) => void;
  setNicheFilter: (value: string) => void;
  setProgressStep: (key: string, checked: boolean) => void;
};

export default function ProspectingRoutePanel({
  prospectingState,
  prospectingCity,
  prospectingNiche,
  currentProgress,
  setProspectingState,
  setProspectingCity,
  setProspectingNiche,
  setSearchQuery,
  setCityFilter,
  setStateFilter,
  setNicheFilter,
  setProgressStep,
}: ProspectingRoutePanelProps) {
  const selectedMarket = marketOptions.find((item) => item.code === prospectingState) || marketOptions[0];

  return (
    <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-950">
            US local prospecting route
            <HelpTooltip text="Pick one niche, city, and state, then search systematically. Progress is saved locally so you can work through cities without losing your place." />
          </p>
          <p className="mt-1 text-xs text-slate-500">Prioritize owner-operated local services with phone numbers, real reviews, and weak/no website.</p>
        </div>
        <HoverTooltip text="Fill the search box and filters from the selected niche/city/state.">
          <button
            type="button"
            onClick={() => {
              const query = composeProspectingQuery(prospectingNiche, prospectingCity, prospectingState);
              setSearchQuery(query);
              setCityFilter(prospectingCity);
              setStateFilter(prospectingState);
              setNicheFilter(prospectingNiche);
            }}
            className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Fill search
          </button>
        </HoverTooltip>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="text-xs font-semibold text-slate-600">
          State
          <select
            value={prospectingState}
            onChange={(event) => {
              const next = marketOptions.find((item) => item.code === event.target.value) || marketOptions[0];
              setProspectingState(next.code);
              setProspectingCity(next.cities[0] || "");
            }}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {marketOptions.map((item) => <option key={item.code} value={item.code}>{item.code} - {item.state}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600">
          City
          <input
            value={prospectingCity}
            onChange={(event) => setProspectingCity(event.target.value)}
            list="admin-leads-city-options"
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <datalist id="admin-leads-city-options">
            {(selectedMarket?.cities || []).map((city) => <option key={city} value={city} />)}
          </datalist>
        </label>
        <label className="text-xs font-semibold text-slate-600">
          Niche
          <input
            value={prospectingNiche}
            onChange={(event) => setProspectingNiche(event.target.value)}
            list="admin-leads-niche-options"
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <datalist id="admin-leads-niche-options">
            {nicheOptions.map((item) => <option key={item.niche} value={item.niche} />)}
          </datalist>
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {nicheOptions.filter((item) => item.priority === 1).slice(0, 14).map((item) => (
          <button
            key={item.niche}
            type="button"
            onClick={() => {
              setProspectingNiche(item.niche);
              setSearchQuery(composeProspectingQuery(item.niche, prospectingCity, prospectingState));
            }}
            className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
          >
            {item.niche}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
        {progressSteps.map((step) => (
          <label key={step.key} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={currentProgress[step.key] === true}
              onChange={(event) => setProgressStep(step.key, event.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600"
            />
            {step.label}
          </label>
        ))}
      </div>
    </div>
  );
}

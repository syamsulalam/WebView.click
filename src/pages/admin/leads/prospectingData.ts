import usMarkets from "../../../data/usLocalProspectingMarkets.json";
import usNicheGroups from "../../../data/usLocalProspectingNiches.json";

export type ProspectingMarket = { state: string; code: string; priority: number; cities: string[] };
export type ProspectingNicheGroup = { category: string; priority: number; niches: string[] };
export type ProspectingNicheOption = { niche: string; category: string; priority: number };

export const marketOptions = usMarkets as ProspectingMarket[];
export const nicheGroups = usNicheGroups as ProspectingNicheGroup[];

export const nicheOptions: ProspectingNicheOption[] = nicheGroups.flatMap((group) =>
  group.niches.map((niche) => ({ niche, category: group.category, priority: group.priority })),
);

export const progressSteps = [
  { key: "searched", label: "Searched" },
  { key: "gathered", label: "Gathered" },
  { key: "generated", label: "Generated" },
  { key: "contacted", label: "Contacted" },
  { key: "followup", label: "Follow-up" },
];

export function composeProspectingQuery(niche: string, city: string, state: string) {
  return `${niche} ${city} ${state}`.trim();
}

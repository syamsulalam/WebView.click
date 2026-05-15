export type ProspectScoreWeightKey =
  | "noWebsiteVerified"
  | "hasWebsitePenalty"
  | "websiteUnknownPenalty"
  | "rating45Plus"
  | "rating40Plus"
  | "reviews10To100"
  | "reviews101To300"
  | "reviews1To9"
  | "phoneExists"
  | "usMarket"
  | "notGeneratedYet"
  | "detailsGathered";

export type ProspectScoreWeights = Record<ProspectScoreWeightKey, number>;

export const defaultProspectScoreWeights: ProspectScoreWeights = {
  noWebsiteVerified: 45,
  hasWebsitePenalty: -80,
  websiteUnknownPenalty: -8,
  rating45Plus: 18,
  rating40Plus: 10,
  reviews10To100: 18,
  reviews101To300: 8,
  reviews1To9: 5,
  phoneExists: 14,
  usMarket: 18,
  notGeneratedYet: 8,
  detailsGathered: 5,
};

export const prospectScoreWeightFields: Array<{
  key: ProspectScoreWeightKey;
  label: string;
  hint: string;
}> = [
  { key: "noWebsiteVerified", label: "No website verified", hint: "Place Details/pre-check confirms no website." },
  { key: "hasWebsitePenalty", label: "Has website penalty", hint: "Negative score for businesses that already have a website." },
  { key: "websiteUnknownPenalty", label: "Website unknown penalty", hint: "Small penalty until pre-check or gather confirms website status." },
  { key: "rating45Plus", label: "Rating 4.5+", hint: "High social proof from Google rating." },
  { key: "rating40Plus", label: "Rating 4.0+", hint: "Moderate social proof from Google rating." },
  { key: "reviews10To100", label: "Reviews 10-100", hint: "Good range for credible but still reachable local businesses." },
  { key: "reviews101To300", label: "Reviews 101-300", hint: "Established businesses, still useful but lower priority." },
  { key: "reviews1To9", label: "Reviews 1-9", hint: "Some proof, but less validated." },
  { key: "phoneExists", label: "Phone exists", hint: "Can be contacted directly." },
  { key: "usMarket", label: "US market", hint: "Higher-value target market." },
  { key: "notGeneratedYet", label: "Not generated yet", hint: "Prioritize prospects without an existing generated site." },
  { key: "detailsGathered", label: "Details gathered", hint: "Ready for richer generation." },
];

export const scoreThresholdOptions = [
  { value: "0", label: "Any score" },
  { value: "50", label: "50+" },
  { value: "70", label: "70+" },
  { value: "85", label: "85+" },
];

export const prospectScoringPresets = [
  {
    key: "balanced",
    label: "Balanced",
    description: "Default all-around scoring for no-website local businesses.",
    defaultThreshold: "0",
    weights: defaultProspectScoreWeights,
  },
  {
    key: "no_website_hunter",
    label: "No Website Hunter",
    description: "Push verified no-website prospects to the top and penalize existing websites harder.",
    defaultThreshold: "70",
    weights: {
      ...defaultProspectScoreWeights,
      noWebsiteVerified: 60,
      hasWebsitePenalty: -120,
      websiteUnknownPenalty: -18,
      notGeneratedYet: 10,
    },
  },
  {
    key: "us_high_value",
    label: "US High Value",
    description: "Prioritize US-market businesses with strong rating, useful reviews, and phone data.",
    defaultThreshold: "70",
    weights: {
      ...defaultProspectScoreWeights,
      noWebsiteVerified: 52,
      rating45Plus: 22,
      reviews10To100: 22,
      phoneExists: 18,
      usMarket: 30,
    },
  },
  {
    key: "ready_to_generate",
    label: "Ready to Generate",
    description: "Prioritize prospects that already have gathered details and are ready for batch generation.",
    defaultThreshold: "50",
    weights: {
      ...defaultProspectScoreWeights,
      detailsGathered: 28,
      notGeneratedYet: 18,
      websiteUnknownPenalty: -20,
    },
  },
];

export function parseProspectScoreWeights(value: unknown): ProspectScoreWeights {
  if (!value) return { ...defaultProspectScoreWeights };

  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return { ...defaultProspectScoreWeights };
    }
  }

  if (!parsed || typeof parsed !== "object") return { ...defaultProspectScoreWeights };

  const record = parsed as Record<string, unknown>;
  return prospectScoreWeightFields.reduce((acc, field) => {
    const raw = record[field.key];
    const numeric = typeof raw === "number" ? raw : Number(raw);
    acc[field.key] = Number.isFinite(numeric) ? numeric : defaultProspectScoreWeights[field.key];
    return acc;
  }, { ...defaultProspectScoreWeights });
}

export function serializeProspectScoreWeights(weights: ProspectScoreWeights) {
  return JSON.stringify(weights);
}

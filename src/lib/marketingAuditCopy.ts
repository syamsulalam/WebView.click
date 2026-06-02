export type AuditIndustryGroup =
  | "dental_medical"
  | "home_services"
  | "restaurant_cafe"
  | "salon_spa_beauty"
  | "fitness_wellness"
  | "automotive"
  | "professional_services"
  | "retail_local_shop"
  | "local_service";

export type AuditCopyIssue =
  | "missing_website"
  | "partial_website"
  | "review_count_gap"
  | "rating_gap"
  | "photo_gap"
  | "competitor_website_gap"
  | "profile_completeness_gap";

export type AuditCopyEvidence = {
  businessName: string;
  city?: string;
  category?: string;
  websiteKindLabel?: string;
  reviewCount?: number;
  rating?: number;
  competitorMedianReviewCount?: number;
  competitorTopReviewCount?: number;
  competitorAverageRating?: number;
  competitorWebsiteRate?: number;
  photoCount?: number;
  competitorMedianPhotoCount?: number;
  generatedPreviewAvailable?: boolean;
};

export type AuditCopyProfile = {
  industryGroup: AuditIndustryGroup;
  label: string;
  matchTypes: string[];
  matchKeywords: string[];
  ownerPressure: string;
  customerDecisionMoment: string;
  websiteGapProblem: string;
  partialWebsiteProblem: string;
  reviewGapProblem: string;
  ratingGapProblem: string;
  photoGapProblem: string;
  operationalCostPressure: string;
  seasonalityPressure?: string;
  recommendationTone: string;
};

export type OwnerFacingAuditCopy = {
  industryGroup: AuditIndustryGroup;
  industryLabel: string;
  primaryIssue: AuditCopyIssue;
  problemFrame: string;
  customerJourneyRisk: string;
  operationalPressure: string;
  directRecommendation: string;
  evidenceLine: string;
  avoidClaims: string[];
};

const copyProfiles: AuditCopyProfile[] = [
  {
    industryGroup: "dental_medical",
    label: "Dental / medical clinic",
    matchTypes: ["dentist", "dental_clinic", "doctor", "health", "hospital", "physiotherapist", "chiropractor", "medical_clinic"],
    matchKeywords: ["dental", "dentist", "orthodont", "clinic", "medical", "doctor", "urgent care", "chiropr", "therapy", "pediatric"],
    ownerPressure: "Empty appointment slots are expensive when rooms, assistants, front desk time, and equipment still need to be paid for.",
    customerDecisionMoment: "Patients usually compare trust, services, hours, clinic environment, and how easy it is to book before they call.",
    websiteGapProblem: "Without a real website, patients cannot quickly understand services, payment or insurance cues, the clinic environment, and what to expect before booking.",
    partialWebsiteProblem: "A social or directory link can show activity, but it does not organize services, patient questions, clinic proof, and booking expectations like a purpose-built website.",
    reviewGapProblem: "For health-related decisions, review count is a trust shortcut. A clinic with fewer reviews can look less proven even if the rating is good.",
    ratingGapProblem: "A lower rating than nearby clinics can make another office feel safer before the first call.",
    photoGapProblem: "Clinic photos reduce anxiety by showing the front desk, treatment rooms, team, equipment, exterior, and parking context.",
    operationalCostPressure: "When the schedule is not full, staff and fixed costs can turn from revenue support into margin pressure.",
    seasonalityPressure: "Patient demand can soften around holidays, school schedules, and insurance timing, so profile trust needs to work before the phone call.",
    recommendationTone: "Launch a real clinic website, connect it to the Google profile, and add a review request workflow after completed visits.",
  },
  {
    industryGroup: "home_services",
    label: "Home service / contractor",
    matchTypes: ["roofing_contractor", "plumber", "electrician", "general_contractor", "hvac_contractor", "painter", "landscaper", "locksmith"],
    matchKeywords: ["contractor", "roof", "plumb", "electric", "hvac", "repair", "construction", "remodel", "landscap", "lawn", "tree", "locksmith", "concrete", "paving", "cleaning", "pressure washing"],
    ownerPressure: "Crews, vehicles, tools, insurance, and admin time cost money even when the schedule has gaps.",
    customerDecisionMoment: "Homeowners usually want to see services, service area, project proof, license or insurance cues, and quote expectations before they call.",
    websiteGapProblem: "Without a real website, the profile can send people to the phone but cannot show the work, process, service area, and quote path clearly.",
    partialWebsiteProblem: "A Facebook page or directory listing is not the same as a contractor website because customers still have to hunt for services, proof, and quote expectations.",
    reviewGapProblem: "When customers compare contractors, the business with more reviews can feel safer to call first.",
    ratingGapProblem: "A lower rating than nearby contractors can create hesitation before a homeowner reaches out.",
    photoGapProblem: "Before/after work, job sites, vehicles, tools, crews, and finished results help customers believe the business can handle the job.",
    operationalCostPressure: "Uneven lead flow can leave paid crews or equipment underused while overhead keeps moving.",
    seasonalityPressure: "Weather and seasonality can make demand uneven, so the profile and website need to convert comparison shoppers when demand is available.",
    recommendationTone: "Launch a service-area website with project proof, clear services, quote CTA, and a simple review request system.",
  },
  {
    industryGroup: "restaurant_cafe",
    label: "Restaurant / cafe / food",
    matchTypes: ["restaurant", "cafe", "bakery", "bar", "meal_takeaway", "meal_delivery"],
    matchKeywords: ["restaurant", "cafe", "coffee", "bakery", "bar", "bistro", "pizza", "taco", "diner", "brunch", "tea", "food", "catering"],
    ownerPressure: "Rent, staff, food cost, waste, and slow days can shrink margins quickly.",
    customerDecisionMoment: "Guests usually want menu, hours, location, atmosphere, photos, and order or reservation options before deciding.",
    websiteGapProblem: "Without a real website, visitors may have to piece together menu, hours, photos, and ordering details from scattered profile or social content.",
    partialWebsiteProblem: "A social feed can help discovery, but it is not designed to answer visit questions quickly like menu, hours, location, catering, and ordering.",
    reviewGapProblem: "Diners often use review count as a fast filter when choosing where to eat.",
    ratingGapProblem: "A rating gap can push a visitor toward another nearby option before they check the menu.",
    photoGapProblem: "Food, menu, interior, exterior, atmosphere, and crowd context photos help people decide to visit, order, or book.",
    operationalCostPressure: "Slow tables are costly because labor, rent, and food cost do not wait for demand to return.",
    seasonalityPressure: "Demand can change by daypart, weekday, weather, season, and local events, so the profile must answer visit questions fast.",
    recommendationTone: "Launch a website with menu, hours, photos, order/reservation CTA, and local proof that turns profile visitors into guests.",
  },
  {
    industryGroup: "salon_spa_beauty",
    label: "Salon / spa / beauty",
    matchTypes: ["beauty_salon", "hair_care", "spa", "nail_salon"],
    matchKeywords: ["salon", "spa", "beauty", "hair", "nail", "lashes", "brow", "massage", "esthetic", "skin", "waxing"],
    ownerPressure: "Empty appointment slots mean chairs, rooms, staff time, and product inventory are not earning.",
    customerDecisionMoment: "New clients usually compare services, pricing cues, results, staff specialties, booking flow, and policies before booking.",
    websiteGapProblem: "Without a real website, a new client has to hunt for services, results, booking expectations, and policies before trusting the business with personal care.",
    partialWebsiteProblem: "A social profile can show posts, but it does not reliably organize services, packages, booking expectations, and proof of results.",
    reviewGapProblem: "Review volume matters because clients want confidence that results and service are consistent.",
    ratingGapProblem: "A lower rating than nearby salons or spas can create hesitation before a client books.",
    photoGapProblem: "Portfolio photos, before/after results, treatment spaces, staff, and cleanliness reduce hesitation.",
    operationalCostPressure: "When appointment slots stay empty, the fixed cost of space and staff can eat into the owner's take-home.",
    seasonalityPressure: "Beauty demand can move around holidays, events, weekends, and local routines, so trust signals need to be ready when clients compare.",
    recommendationTone: "Launch a service and booking website, add portfolio proof, and use review requests after successful appointments.",
  },
  {
    industryGroup: "fitness_wellness",
    label: "Fitness / wellness",
    matchTypes: ["gym", "health", "physiotherapist", "yoga_studio"],
    matchKeywords: ["gym", "fitness", "trainer", "boxing", "martial", "crossfit", "yoga", "pilates", "wellness", "nutrition"],
    ownerPressure: "Rent, coaches, equipment, and class capacity create fixed costs even when attendance dips.",
    customerDecisionMoment: "Prospects want programs, schedules, trainer credibility, pricing cues, trial options, and what beginners should expect.",
    websiteGapProblem: "Without a real website, prospects may not understand the programs, schedule, beginner experience, and trial path before they move on.",
    partialWebsiteProblem: "A social feed can show energy, but it does not replace a clear program, schedule, pricing cue, and trial CTA.",
    reviewGapProblem: "Reviews help prospects believe they will feel supported instead of judged or confused.",
    ratingGapProblem: "A rating gap can make a competing gym or wellness provider feel safer to try first.",
    photoGapProblem: "Facility, equipment, classes, trainers, and member experience photos help people imagine joining.",
    operationalCostPressure: "Low attendance can make staff and equipment feel expensive instead of productive.",
    seasonalityPressure: "Demand can swing around New Year, summer, school schedules, and local routines.",
    recommendationTone: "Launch a website with programs, schedule, trial CTA, facility proof, and a review request workflow.",
  },
  {
    industryGroup: "automotive",
    label: "Automotive",
    matchTypes: ["car_repair", "car_dealer", "car_wash", "auto_parts_store"],
    matchKeywords: ["auto", "automotive", "mechanic", "repair shop", "tire", "transmission", "oil change", "body shop", "car wash", "detailing"],
    ownerPressure: "Bays, technicians, lifts, parts workflow, and rent cost money whether every slot is full or not.",
    customerDecisionMoment: "Customers often call under stress and compare honesty, services, hours, location, and proof quickly.",
    websiteGapProblem: "Without a real website, customers cannot quickly see services, makes or models, warranty cues, emergency info, and booking path.",
    partialWebsiteProblem: "A directory or social page may show contact info, but it does not clearly explain services, trust cues, and what to do next.",
    reviewGapProblem: "Review count is important because customers worry about price, honesty, and quality.",
    ratingGapProblem: "A rating gap can move a stressed customer to another shop before they call.",
    photoGapProblem: "Shop, bays, technicians, equipment, completed work, and storefront photos reduce doubt.",
    operationalCostPressure: "Idle bays and technicians can turn a slow week into expensive unused capacity.",
    recommendationTone: "Launch a service website with trust proof, clear repair categories, contact path, and review generation.",
  },
  {
    industryGroup: "professional_services",
    label: "Professional service",
    matchTypes: ["lawyer", "accounting", "real_estate_agency", "insurance_agency", "finance", "local_government_office"],
    matchKeywords: ["law", "attorney", "legal", "accountant", "accounting", "tax", "bookkeeping", "financial", "insurance", "consult", "real estate", "realtor", "notary"],
    ownerPressure: "Expertise only converts when prospects understand the service area and feel enough trust to start a conversation.",
    customerDecisionMoment: "Prospects want practice areas or services, process, credentials, location, consultation path, and plain-language answers.",
    websiteGapProblem: "Without a real website, prospects may not understand whether the business handles their exact situation before contacting.",
    partialWebsiteProblem: "A directory or social profile can list the business, but it does not position expertise, process, and consultation expectations clearly.",
    reviewGapProblem: "Reviews and profile completeness help prospects decide who feels credible enough to contact first.",
    ratingGapProblem: "A rating gap can make a competing professional service feel more credible before the first call.",
    photoGapProblem: "Team, office, credentials, and professional environment create legitimacy.",
    operationalCostPressure: "Unclear positioning can create low-quality inquiries that waste time and leave better-fit prospects unconverted.",
    recommendationTone: "Launch a professional service website with service pages, consultation CTA, credentials, FAQs, and review proof.",
  },
  {
    industryGroup: "retail_local_shop",
    label: "Retail / local shop",
    matchTypes: ["store", "clothing_store", "furniture_store", "hardware_store", "electronics_store", "florist", "jewelry_store"],
    matchKeywords: ["store", "shop", "retail", "boutique", "florist", "furniture", "hardware", "jewelry", "clothing", "market", "grocery"],
    ownerPressure: "Inventory, rent, staff, and slow foot traffic can squeeze cash flow.",
    customerDecisionMoment: "Shoppers want product categories, brands, hours, location, photos, policies, and whether the trip is worth it.",
    websiteGapProblem: "Without a real website, customers may not know what the shop carries or why they should visit before choosing another nearby option.",
    partialWebsiteProblem: "A social feed can show posts, but it does not always answer product categories, hours, policies, and visit questions quickly.",
    reviewGapProblem: "Reviews help people decide whether the store is worth visiting compared with other nearby options.",
    ratingGapProblem: "A rating gap can make another shop look safer before a customer makes the trip.",
    photoGapProblem: "Storefront, shelves, products, displays, and staff photos help customers decide the trip is worth it.",
    operationalCostPressure: "Slow traffic can leave inventory and staff cost sitting while revenue lags.",
    recommendationTone: "Launch a local shop website with product categories, visit details, photos, and a profile-aligned review plan.",
  },
  {
    industryGroup: "local_service",
    label: "Local service",
    matchTypes: [],
    matchKeywords: [],
    ownerPressure: "Fixed costs continue even when inquiries slow down.",
    customerDecisionMoment: "Customers want to understand services, proof, location, process, and how to contact the business before calling.",
    websiteGapProblem: "Without a real website, the profile can send customers to the phone but does not give them a clear place to learn before calling.",
    partialWebsiteProblem: "A social, link hub, directory, or booking-only URL can help, but it is not the same as an owned website that explains services and proof clearly.",
    reviewGapProblem: "Competitor reviews can influence who gets called first.",
    ratingGapProblem: "A rating gap can make another local business look safer before the first call.",
    photoGapProblem: "Real photos make the business feel active, credible, and easier to trust.",
    operationalCostPressure: "When inquiries slow down, the owner's remaining profit can get squeezed after overhead is paid.",
    recommendationTone: "Launch a clear local website, align it with the Google profile, and add a simple review request workflow.",
  },
];

function textFromParts(parts: Array<unknown>) {
  return parts
    .flatMap((part) => Array.isArray(part) ? part : [part])
    .map((part) => String(part || "").toLowerCase())
    .join(" ");
}

export function detectAuditIndustryGroup(input: { types?: unknown[]; query?: string; category?: string; niche?: string; businessName?: string; offers?: unknown[] }) {
  const haystack = textFromParts([
    input.types || [],
    input.query,
    input.category,
    input.niche,
    input.businessName,
    input.offers || [],
  ]);
  for (const profile of copyProfiles) {
    if (profile.industryGroup === "local_service") continue;
    const matched = [...profile.matchTypes, ...profile.matchKeywords].some((term) => haystack.includes(term.toLowerCase()));
    if (matched) return profile;
  }
  return copyProfiles[copyProfiles.length - 1];
}

function fmtNumber(value: unknown, fallback = "not available") {
  return typeof value === "number" && Number.isFinite(value) ? value.toLocaleString() : fallback;
}

function fmtRating(value: unknown, fallback = "not available") {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(1) : fallback;
}

function percent(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? `${Math.round(value * 100)}%` : "not available";
}

export function buildOwnerFacingAuditCopy(input: AuditCopyEvidence & { types?: unknown[]; query?: string; niche?: string; issueFlags: AuditCopyIssue[] }): OwnerFacingAuditCopy {
  const profile = detectAuditIndustryGroup({
    types: input.types,
    query: input.query,
    niche: input.niche,
    category: input.category,
    businessName: input.businessName,
  });
  const primaryIssue = input.issueFlags[0] || "profile_completeness_gap";
  const cityPhrase = input.city ? ` in ${input.city}` : "";
  const categoryPhrase = input.category ? ` for ${input.category}` : "";

  let problemFrame = profile.ownerPressure;
  let directRecommendation = profile.recommendationTone;
  let evidenceLine = "This audit uses the available Google profile fields and cached local competitor data.";

  if (primaryIssue === "missing_website") {
    problemFrame = profile.websiteGapProblem;
    evidenceLine = `${input.businessName} does not have a real website URL on the Google profile.`;
  } else if (primaryIssue === "partial_website") {
    problemFrame = profile.partialWebsiteProblem;
    evidenceLine = `${input.businessName} has a ${input.websiteKindLabel || "third-party"} link, but it does not count as a full owned website in this audit.`;
  } else if (primaryIssue === "review_count_gap") {
    problemFrame = profile.reviewGapProblem;
    evidenceLine = `${input.businessName} has ${fmtNumber(input.reviewCount)} reviews; the visible competitor median is ${fmtNumber(input.competitorMedianReviewCount)} and the top visible competitor has ${fmtNumber(input.competitorTopReviewCount)}.`;
  } else if (primaryIssue === "rating_gap") {
    problemFrame = profile.ratingGapProblem;
    evidenceLine = `${input.businessName} is rated ${fmtRating(input.rating)}; the visible competitor average is ${fmtRating(input.competitorAverageRating)}.`;
  } else if (primaryIssue === "photo_gap") {
    problemFrame = profile.photoGapProblem;
    evidenceLine = `${input.businessName} has ${fmtNumber(input.photoCount)} visible photos in the saved profile data; the competitor median is ${fmtNumber(input.competitorMedianPhotoCount)}.`;
  } else if (primaryIssue === "competitor_website_gap") {
    problemFrame = profile.customerDecisionMoment;
    evidenceLine = `${percent(input.competitorWebsiteRate)} of visible competitors${cityPhrase} have website-style URLs while this profile does not have a full owned website.`;
  }

  if (input.generatedPreviewAvailable && (primaryIssue === "missing_website" || primaryIssue === "partial_website" || primaryIssue === "competitor_website_gap")) {
    directRecommendation = `The fastest first fix is to launch the generated WebView.click preview on a real domain, then use it as the profile website URL. ${profile.recommendationTone}`;
  }

  return {
    industryGroup: profile.industryGroup,
    industryLabel: profile.label,
    primaryIssue,
    problemFrame,
    customerJourneyRisk: `${profile.customerDecisionMoment}${cityPhrase}${categoryPhrase}.`,
    operationalPressure: profile.seasonalityPressure ? `${profile.operationalCostPressure} ${profile.seasonalityPressure}` : profile.operationalCostPressure,
    directRecommendation,
    evidenceLine,
    avoidClaims: [
      "Do not claim exact lost customers or revenue.",
      "Do not claim review replies or photo recency unless reliable data exists.",
      "Use may/can/often for customer behavior unless exact measured data exists.",
    ],
  };
}

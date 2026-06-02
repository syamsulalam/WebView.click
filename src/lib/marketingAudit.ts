import { buildOwnerFacingAuditCopy, type AuditCopyIssue, type OwnerFacingAuditCopy } from "./marketingAuditCopy";

export type WebsiteAssessmentKind = "owned_website" | "social_profile" | "link_hub" | "directory_or_marketplace" | "booking_only" | "unknown_or_unreachable" | "missing";
export type AuditStatus = "strong" | "watch" | "urgent" | "unknown";

export type NormalizedAuditProfile = {
  businessId: string;
  businessName: string;
  placeId?: string;
  mapsUrl?: string;
  websiteUrl?: string;
  phone?: string;
  address?: string;
  city?: string;
  category?: string;
  niche?: string;
  query?: string;
  rating?: number;
  reviewCount?: number;
  photoCount?: number;
  hoursAvailable?: boolean;
  businessStatus?: string;
  types?: string[];
  generatedPreviewAvailable?: boolean;
  sourceData?: Record<string, unknown>;
};

export type NormalizedAuditCompetitor = {
  placeId?: string;
  name: string;
  websiteUrl?: string;
  rating?: number;
  reviewCount?: number;
  photoCount?: number;
  mapsUrl?: string;
  address?: string;
  types?: string[];
  websiteAssessment?: WebsiteAssessment;
};

export type WebsiteAssessment = {
  kind: WebsiteAssessmentKind;
  label: string;
  countsAsFullWebsite: boolean;
  reason: string;
  checkedUrl?: string;
};

export type MarketingAuditCategory = {
  key: string;
  label: string;
  score: number;
  max: number;
  status: AuditStatus;
  summary: string;
  evidence: string[];
  recommendations: string[];
};

export type MarketingAuditEvidenceCard = {
  key: string;
  title: string;
  targetLabel: string;
  targetValue: string;
  competitorLabel: string;
  competitorValue: string;
  status: AuditStatus;
};

export type MarketingAudit = {
  businessId: string;
  businessName: string;
  generatedAt: string;
  sourceHash?: string;
  latestSnapshot?: MarketingAuditSnapshotMeta | null;
  snapshot?: MarketingAuditSnapshotMeta | null;
  confidence: "high" | "medium" | "low";
  source: {
    placeId?: string;
    mapsUrl?: string;
    profileDataSource: "generated_site" | "prospect_details" | "lead_fallback";
    competitorDataSource: "cached_query" | "inferred_none";
    query?: string;
    city?: string;
    category?: string;
  };
  score: {
    total: number;
    label: "strong" | "needs-work" | "urgent";
    categories: MarketingAuditCategory[];
  };
  target: NormalizedAuditProfile & {
    hasWebsite: boolean;
    websiteAssessment: WebsiteAssessment;
  };
  competitors: {
    total: number;
    withWebsite: number;
    websiteRate: number;
    averageRating?: number;
    topRating?: number;
    medianReviewCount?: number;
    topReviewCount?: number;
    medianPhotoCount?: number;
    rows: NormalizedAuditCompetitor[];
  };
  ownerFacingCopy: OwnerFacingAuditCopy;
  evidence: {
    comparisonCards: MarketingAuditEvidenceCard[];
    screenshotPlan: {
      availableNow: "rendered_report_sections";
      notes: string[];
    };
  };
  offer: {
    primary: "website_setup" | "website_upgrade" | "gbp_optimization";
    services: Array<{
      key: string;
      title: string;
      description: string;
      recommendedBecause: string[];
    }>;
  };
  missingDataNotes: string[];
};

export type MarketingAuditSnapshotMeta = {
  id: string;
  businessId: string;
  placeId?: string;
  r2JsonKey: string;
  score?: number;
  confidence?: string;
  query?: string;
  sourceHash?: string;
  createdAt?: string;
  createdBy?: string;
  stale?: boolean;
  liveSourceHash?: string;
};

export type BuildMarketingAuditInput = {
  target: NormalizedAuditProfile;
  competitors?: NormalizedAuditCompetitor[];
  siteJson?: Record<string, unknown> | null;
  profileDataSource?: MarketingAudit["source"]["profileDataSource"];
  competitorDataSource?: MarketingAudit["source"]["competitorDataSource"];
};

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export function asAuditNumber(value: unknown): number | undefined {
  const next = typeof value === "number" ? value : Number(value);
  return Number.isFinite(next) ? next : undefined;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function firstString(...values: unknown[]) {
  return values.map((value) => asString(value).trim()).find(Boolean) || "";
}

function hostname(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    try {
      return new URL(`https://${value}`).hostname.replace(/^www\./i, "").toLowerCase();
    } catch {
      return "";
    }
  }
}

const socialHosts = ["facebook.com", "fb.com", "instagram.com", "tiktok.com", "youtube.com", "youtu.be", "x.com", "twitter.com", "linkedin.com", "pinterest.com", "snapchat.com"];
const linkHubHosts = ["linktr.ee", "linktree.com", "beacons.ai", "carrd.co", "bio.site", "taplink.cc", "stan.store"];
const directoryHosts = ["yelp.com", "tripadvisor.com", "thumbtack.com", "angi.com", "angieslist.com", "homeadvisor.com", "doordash.com", "ubereats.com", "grubhub.com", "opentable.com", "resy.com", "square.site", "fresha.com", "vagaro.com", "booking.com"];
const bookingHosts = ["calendly.com", "acuityscheduling.com", "schedulicity.com", "setmore.com", "squareup.com", "toasttab.com"];

function hostMatches(host: string, domains: string[]) {
  return domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

export function assessWebsiteUrl(url: unknown): WebsiteAssessment {
  const raw = asString(url).trim();
  if (!raw) {
    return {
      kind: "missing",
      label: "No website URL",
      countsAsFullWebsite: false,
      reason: "The Google profile does not have a website URL saved.",
    };
  }
  const host = hostname(raw);
  if (!host) {
    return {
      kind: "unknown_or_unreachable",
      label: "URL could not be classified",
      countsAsFullWebsite: false,
      checkedUrl: raw,
      reason: "The URL exists but could not be classified from its domain.",
    };
  }
  if (hostMatches(host, socialHosts)) {
    return {
      kind: "social_profile",
      label: "Social profile link",
      countsAsFullWebsite: false,
      checkedUrl: raw,
      reason: "Social profiles are useful, but they are not designed as clear service, proof, FAQ, and contact pages.",
    };
  }
  if (hostMatches(host, linkHubHosts)) {
    return {
      kind: "link_hub",
      label: "Link hub",
      countsAsFullWebsite: false,
      checkedUrl: raw,
      reason: "A link hub sends visitors elsewhere instead of explaining the business in one owned website experience.",
    };
  }
  if (hostMatches(host, directoryHosts)) {
    return {
      kind: "directory_or_marketplace",
      label: "Directory or marketplace profile",
      countsAsFullWebsite: false,
      checkedUrl: raw,
      reason: "A third-party directory may show basic info, but it does not give the business a full owned customer education path.",
    };
  }
  if (hostMatches(host, bookingHosts)) {
    return {
      kind: "booking_only",
      label: "Booking-only URL",
      countsAsFullWebsite: false,
      checkedUrl: raw,
      reason: "A booking URL helps scheduling, but it usually does not explain services, proof, FAQs, and trust context before booking.",
    };
  }
  return {
    kind: "owned_website",
    label: "Real website URL",
    countsAsFullWebsite: true,
    checkedUrl: raw,
    reason: "The URL appears to be a business-owned website rather than a social, directory, link hub, or booking-only profile.",
  };
}

function median(values: number[]) {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!sorted.length) return undefined;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function average(values: number[]) {
  const safe = values.filter((value) => Number.isFinite(value));
  if (!safe.length) return undefined;
  return safe.reduce((sum, value) => sum + value, 0) / safe.length;
}

function max(values: number[]) {
  const safe = values.filter((value) => Number.isFinite(value));
  return safe.length ? Math.max(...safe) : undefined;
}

function fmtNumber(value: unknown, fallback = "-") {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value).toLocaleString() : fallback;
}

function fmtRating(value: unknown, fallback = "-") {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(1) : fallback;
}

function statusFromScore(score: number, maxScore: number): AuditStatus {
  if (maxScore <= 0) return "unknown";
  const ratio = score / maxScore;
  if (ratio >= 0.78) return "strong";
  if (ratio >= 0.48) return "watch";
  return "urgent";
}

function category(key: string, label: string, score: number, maxScore: number, summary: string, evidence: string[], recommendations: string[]): MarketingAuditCategory {
  return {
    key,
    label,
    score: Math.max(0, Math.min(maxScore, Math.round(score))),
    max: maxScore,
    status: statusFromScore(score, maxScore),
    summary,
    evidence,
    recommendations,
  };
}

function hasAnyPage(site: Record<string, unknown> | undefined, needles: string[]) {
  const pages = arrayValue(site?.pages);
  const text = JSON.stringify(pages).toLowerCase();
  return needles.some((needle) => text.includes(needle));
}

function serviceCount(site: Record<string, unknown> | undefined) {
  return arrayValue(site?.offers).length + arrayValue(site?.services).length + arrayValue(site?.products).length;
}

export function normalizeAuditTargetFromSources(input: {
  businessId: string;
  siteJson?: Record<string, unknown> | null;
  prospect?: Record<string, unknown> | null;
  lead?: Record<string, unknown> | null;
}): NormalizedAuditProfile {
  const site = input.siteJson || {};
  const source = objectValue(site.sourceData);
  const profile = objectValue(site.businessProfile);
  const contact = objectValue(profile.contact);
  const trust = objectValue(site.trust);
  const location = objectValue(site.location);
  const hours = objectValue(site.hours);
  const meta = objectValue(site.meta);
  const prospect = input.prospect || {};
  const lead = input.lead || {};
  const resultJson = objectValue(prospect.result_json_parsed);
  const detailsJson = objectValue(prospect.details_json_parsed);
  const mergedProspect = { ...resultJson, ...detailsJson, ...prospect };
  const types = [
    ...arrayValue(source.types),
    ...arrayValue(profile.categories),
    ...arrayValue(mergedProspect.types),
    firstString(prospect.niche),
  ].map((item) => String(item || "")).filter(Boolean);
  const address = firstString(
    location.formattedAddress,
    source.formattedAddress,
    source.formatted_address,
    mergedProspect.formatted_address,
    mergedProspect.formattedAddress,
    prospect.address,
    lead.address,
  );
  const city = firstString(location.city, source.city, parseCityFromAddress(address));
  const businessName = firstString(
    meta.businessName,
    profile.name,
    source.name,
    mergedProspect.name,
    prospect.business_name,
    lead.business_name,
    input.businessId,
  );
  const rating = asAuditNumber(trust.rating) ?? asAuditNumber(source.rating) ?? asAuditNumber(mergedProspect.rating) ?? asAuditNumber(prospect.rating) ?? asAuditNumber(lead.rating);
  const reviewCount = asAuditNumber(trust.reviewCount) ?? asAuditNumber(source.user_ratings_total) ?? asAuditNumber(source.userRatingCount) ?? asAuditNumber(mergedProspect.user_ratings_total) ?? asAuditNumber(prospect.reviews) ?? asAuditNumber(lead.reviews);
  const photos = [
    ...arrayValue(source.photos),
    ...arrayValue(mergedProspect.photos),
    ...arrayValue(objectValue(site.brand).photoAttributions),
  ];
  return {
    businessId: input.businessId,
    businessName,
    placeId: firstString(source.placeId, source.place_id, mergedProspect.place_id, prospect.place_id),
    mapsUrl: firstString(source.googleMapsUri, source.url, location.directionsUrl, mergedProspect.url, prospect.maps_url),
    websiteUrl: firstString(source.websiteUri, source.website, mergedProspect.website, prospect.website_url, lead.website_url),
    phone: firstString(contact.phoneInternational, contact.phoneNational, source.international_phone_number, source.formatted_phone_number, mergedProspect.formatted_phone_number, prospect.phone, lead.phone),
    address,
    city,
    category: firstString(profile.typeLabel, meta.niche, types[0]),
    niche: firstString(meta.niche, profile.typeLabel, prospect.niche, types[0]),
    query: firstString(source.searchQuery, mergedProspect.searchQuery, prospect.query),
    rating,
    reviewCount,
    photoCount: photos.length || asAuditNumber(source.photoCount) || asAuditNumber(mergedProspect.photoCount),
    hoursAvailable: Boolean(arrayValue(hours.regular).length || arrayValue(source.opening_hours).length || arrayValue(objectValue(source.opening_hours).weekday_text).length || arrayValue(objectValue(mergedProspect.opening_hours).weekday_text).length),
    businessStatus: firstString(source.business_status, mergedProspect.business_status),
    types,
    generatedPreviewAvailable: Boolean(input.siteJson),
    sourceData: source,
  };
}

export function parseCityFromAddress(address: string) {
  const parts = address.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) return parts[parts.length - 2].replace(/\b[A-Z]{2}\s+\d{4,5}.*$/, "").trim() || parts[parts.length - 2];
  return "";
}

export function normalizeAuditCompetitor(value: unknown): NormalizedAuditCompetitor | null {
  const item = objectValue(value);
  const name = firstString(item.name, item.business_name);
  if (!name) return null;
  const websiteUrl = firstString(item.website, item.websiteUri, item.website_url);
  return {
    placeId: firstString(item.place_id, item.id),
    name,
    websiteUrl,
    rating: asAuditNumber(item.rating),
    reviewCount: asAuditNumber(item.user_ratings_total) ?? asAuditNumber(item.userRatingCount) ?? asAuditNumber(item.reviews) ?? asAuditNumber(item.reviewCount),
    photoCount: arrayValue(item.photos).length || asAuditNumber(item.photoCount),
    mapsUrl: firstString(item.url, item.googleMapsUri, item.maps_url),
    address: firstString(item.formatted_address, item.formattedAddress, item.vicinity, item.address),
    types: arrayValue(item.types).map((type) => String(type || "")).filter(Boolean),
    websiteAssessment: assessWebsiteUrl(websiteUrl),
  };
}

function sameBusiness(target: NormalizedAuditProfile, competitor: NormalizedAuditCompetitor) {
  const targetPlaceId = (target.placeId || "").toLowerCase();
  if (targetPlaceId && competitor.placeId?.toLowerCase() === targetPlaceId) return true;
  const targetName = target.businessName.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const competitorName = competitor.name.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const targetAddress = (target.address || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  const competitorAddress = (competitor.address || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  return Boolean(targetName && competitorName && targetName === competitorName && (!targetAddress || !competitorAddress || targetAddress === competitorAddress));
}

function scoreWebsite(target: NormalizedAuditProfile & { websiteAssessment: WebsiteAssessment }, competitorStats: ReturnType<typeof competitorStatsFor>, site?: Record<string, unknown>) {
  let score = 0;
  const evidence: string[] = [];
  const recs: string[] = [];
  if (target.websiteAssessment.countsAsFullWebsite) {
    score += 12;
    evidence.push(`Profile website: ${target.websiteAssessment.label}`);
  } else if (target.websiteAssessment.kind === "missing") {
    evidence.push("No real website URL is saved on the Google profile.");
    recs.push("Launch the generated website on a real domain and use it as the Google profile website URL.");
  } else {
    score += 4;
    evidence.push(`Profile link is classified as ${target.websiteAssessment.label}.`);
    recs.push("Replace the social/directory/booking-only profile link with an owned website URL when possible.");
  }
  if (target.phone) {
    score += 3;
    evidence.push("Phone number is available.");
  } else {
    recs.push("Add or verify a public phone/contact path.");
  }
  if (target.mapsUrl) score += 1;
  if (target.generatedPreviewAvailable) {
    score += 2;
    evidence.push("A generated WebView.click preview is available.");
  }
  if (hasAnyPage(site, ["contact", "feedback", "quote", "request"])) score += 2;
  if (competitorStats.websiteRate >= 0.6 && !target.websiteAssessment.countsAsFullWebsite) {
    evidence.push(`${Math.round(competitorStats.websiteRate * 100)}% of visible competitors have real website-style URLs.`);
  }
  if (!recs.length) recs.push("Use the website as a clearer service, proof, FAQ, and contact path from the Google profile.");
  return category("website", "Website and customer research path", score, 20, target.websiteAssessment.countsAsFullWebsite ? "The profile has a real website path." : "The profile does not yet have a full owned website path.", evidence, recs);
}

function scoreReviews(target: NormalizedAuditProfile, stats: ReturnType<typeof competitorStatsFor>) {
  let score = 0;
  const evidence: string[] = [];
  const recs = ["Add a simple review request workflow after every completed job/order.", "Use the generated feedback page so happy customers go to Google review and lower ratings send private feedback first."];
  if (typeof target.rating === "number") {
    if (target.rating >= 4.7) score += 9;
    else if (target.rating >= 4.4) score += 7;
    else if (target.rating >= 4.0) score += 4;
    else score += 1;
    evidence.push(`Rating: ${fmtRating(target.rating)}`);
    if (typeof stats.averageRating === "number") {
      if (target.rating >= stats.averageRating - 0.05) score += 4;
      else if (target.rating >= stats.averageRating - 0.25) score += 2;
      evidence.push(`Visible competitor average rating: ${fmtRating(stats.averageRating)}`);
    }
  } else {
    evidence.push("Rating is not available in saved profile data.");
  }
  if (typeof target.reviewCount === "number") {
    if (target.reviewCount >= 100) score += 6;
    else if (target.reviewCount >= 40) score += 5;
    else if (target.reviewCount >= 15) score += 3;
    else if (target.reviewCount >= 5) score += 2;
    else score += 1;
    evidence.push(`Review count: ${fmtNumber(target.reviewCount)}`);
    if (typeof stats.medianReviewCount === "number") {
      if (target.reviewCount >= stats.medianReviewCount) score += 6;
      else if (target.reviewCount >= stats.medianReviewCount * 0.55) score += 3;
      else score += 1;
      evidence.push(`Visible competitor median review count: ${fmtNumber(stats.medianReviewCount)}`);
    }
  } else {
    evidence.push("Review count is not available in saved profile data.");
  }
  return category("reviews", "Review strength and social proof", score, 25, score >= 19 ? "Review trust looks competitive." : "Reviews are a visible trust gap to manage.", evidence, recs);
}

function scorePhotos(target: NormalizedAuditProfile, stats: ReturnType<typeof competitorStatsFor>) {
  let score = 0;
  const evidence: string[] = [];
  const recs = ["Add 10-20 strong owner-provided photos.", "Use owned photos on the launched website instead of relying permanently on Google photo references.", "Add before/after, team, facility, product, or atmosphere photos based on the industry."];
  const count = target.photoCount || 0;
  if (count >= 10) score += 10;
  else if (count >= 5) score += 7;
  else if (count >= 2) score += 4;
  else if (count >= 1) score += 2;
  evidence.push(`Visible saved photo count: ${fmtNumber(count)}`);
  if (typeof stats.medianPhotoCount === "number") {
    if (count >= stats.medianPhotoCount) score += 5;
    else if (count >= stats.medianPhotoCount * 0.5) score += 2;
    evidence.push(`Visible competitor median photo count: ${fmtNumber(stats.medianPhotoCount)}`);
  } else if (count > 0) {
    score += 2;
  }
  return category("photos", "Photos and visual proof", score, 15, score >= 11 ? "The profile has usable visual proof." : "The profile needs stronger visual proof.", evidence, recs);
}

function scoreCompleteness(target: NormalizedAuditProfile) {
  let score = 0;
  const evidence: string[] = [];
  const recs: string[] = [];
  const checks: Array<[boolean, number, string, string]> = [
    [Boolean(target.businessStatus === "OPERATIONAL" || !target.businessStatus), 2, "Business status is usable.", "Confirm business status is operational."],
    [Boolean(target.phone), 3, "Phone number is available.", "Add a phone/contact path."],
    [Boolean(target.address), 3, "Address or service-area context is available.", "Confirm address or service area is correct."],
    [Boolean(target.hoursAvailable), 3, "Hours are available.", "Add regular and holiday hours."],
    [Boolean(target.category || target.types?.length), 2, "Category/type is available.", "Make category/service labels match what customers search."],
    [Boolean(target.mapsUrl), 2, "Google Maps URL is available.", "Keep the Maps listing URL accessible."],
    [Boolean(target.businessName && target.businessName.length > 2), 2, "Business name is usable.", "Make sure the business name is clean and recognizable."],
  ];
  for (const [ok, points, yes, no] of checks) {
    if (ok) {
      score += points;
      evidence.push(yes);
    } else {
      recs.push(no);
    }
  }
  return category("completeness", "Business profile completeness", score, 15, score >= 12 ? "Core profile fields are mostly complete." : "Some core profile fields need cleanup.", evidence, recs);
}

function scoreCompetitors(target: NormalizedAuditProfile & { websiteAssessment: WebsiteAssessment }, stats: ReturnType<typeof competitorStatsFor>) {
  let score = 0;
  const evidence: string[] = [];
  const recs = ["Build the missing website path.", "Add a review generation system.", "Add profile photo plan.", "Align service pages with the competitor query."];
  if (stats.total >= 5) score += 3;
  else if (stats.total >= 2) score += 2;
  evidence.push(`${stats.total} visible competitors were available from cached query data.`);
  if (target.websiteAssessment.countsAsFullWebsite || stats.websiteRate < 0.45) score += 4;
  else evidence.push(`${Math.round(stats.websiteRate * 100)}% of visible competitors have real website-style URLs.`);
  if (typeof target.rating === "number" && typeof stats.averageRating === "number" && target.rating >= stats.averageRating - 0.1) score += 3;
  if (typeof target.reviewCount === "number" && typeof stats.medianReviewCount === "number" && target.reviewCount >= stats.medianReviewCount) score += 4;
  else if (typeof stats.medianReviewCount === "number") evidence.push(`Review count is below competitor median (${fmtNumber(stats.medianReviewCount)}).`);
  if ((target.photoCount || 0) >= (stats.medianPhotoCount || 0)) score += 3;
  return category("competitors", "Local competitor position", score, 15, score >= 11 ? "The profile compares reasonably against visible competitors." : "Competitors show stronger profile signals in the visible set.", evidence, recs);
}

function scoreConversion(target: NormalizedAuditProfile & { websiteAssessment: WebsiteAssessment }, site?: Record<string, unknown>) {
  let score = 0;
  const evidence: string[] = [];
  const recs = ["Launch website preview.", "Add quote/contact form.", "Add service pages and final CTA.", "Add sticky mobile call CTA."];
  if (target.phone) {
    score += 2;
    evidence.push("Phone path exists.");
  }
  if (target.websiteAssessment.countsAsFullWebsite || target.generatedPreviewAvailable) {
    score += 2;
    evidence.push("Website or generated preview path exists.");
  }
  if (hasAnyPage(site, ["feedback"])) {
    score += 2;
    evidence.push("Generated feedback/review routing page exists.");
  }
  if (serviceCount(site) > 0) {
    score += 2;
    evidence.push("Generated site has service/offer data.");
  }
  if (hasAnyPage(site, ["contact", "quote", "request", "call"])) {
    score += 2;
    evidence.push("Generated site has contact/request path.");
  }
  return category("conversion", "Conversion readiness", score, 10, score >= 8 ? "The profile/site path is close to conversion-ready." : "The profile needs a clearer path from comparison to contact.", evidence, recs);
}

function competitorStatsFor(rows: NormalizedAuditCompetitor[]) {
  const websiteRows = rows.map((row) => ({ ...row, websiteAssessment: row.websiteAssessment || assessWebsiteUrl(row.websiteUrl) }));
  const withWebsite = websiteRows.filter((row) => row.websiteAssessment?.countsAsFullWebsite).length;
  const ratings = websiteRows.map((row) => row.rating).filter((value): value is number => typeof value === "number");
  const reviews = websiteRows.map((row) => row.reviewCount).filter((value): value is number => typeof value === "number");
  const photos = websiteRows.map((row) => row.photoCount).filter((value): value is number => typeof value === "number");
  return {
    total: websiteRows.length,
    withWebsite,
    websiteRate: websiteRows.length ? withWebsite / websiteRows.length : 0,
    averageRating: average(ratings),
    topRating: max(ratings),
    medianReviewCount: median(reviews),
    topReviewCount: max(reviews),
    medianPhotoCount: median(photos),
    rows: websiteRows,
  };
}

function issueFlags(target: NormalizedAuditProfile & { websiteAssessment: WebsiteAssessment }, stats: ReturnType<typeof competitorStatsFor>, categories: MarketingAuditCategory[]): AuditCopyIssue[] {
  const flags: AuditCopyIssue[] = [];
  if (target.websiteAssessment.kind === "missing") flags.push("missing_website");
  else if (!target.websiteAssessment.countsAsFullWebsite) flags.push("partial_website");
  if (typeof target.reviewCount === "number" && typeof stats.medianReviewCount === "number" && target.reviewCount < stats.medianReviewCount) flags.push("review_count_gap");
  if (typeof target.rating === "number" && typeof stats.averageRating === "number" && target.rating < stats.averageRating - 0.2) flags.push("rating_gap");
  if (typeof target.photoCount === "number" && typeof stats.medianPhotoCount === "number" && target.photoCount < stats.medianPhotoCount) flags.push("photo_gap");
  if (stats.websiteRate >= 0.6 && !target.websiteAssessment.countsAsFullWebsite) flags.push("competitor_website_gap");
  if (categories.some((item) => item.key === "completeness" && item.status !== "strong")) flags.push("profile_completeness_gap");
  return flags;
}

function evidenceCards(target: NormalizedAuditProfile & { websiteAssessment: WebsiteAssessment }, stats: ReturnType<typeof competitorStatsFor>): MarketingAuditEvidenceCard[] {
  return [
    {
      key: "website-quality",
      title: "Website link quality",
      targetLabel: "This profile",
      targetValue: target.websiteAssessment.label,
      competitorLabel: "Competitors with real website URLs",
      competitorValue: `${Math.round(stats.websiteRate * 100)}%`,
      status: target.websiteAssessment.countsAsFullWebsite ? "strong" : stats.websiteRate >= 0.6 ? "urgent" : "watch",
    },
    {
      key: "review-count",
      title: "Review count gap",
      targetLabel: target.businessName,
      targetValue: fmtNumber(target.reviewCount),
      competitorLabel: "Competitor median / top",
      competitorValue: `${fmtNumber(stats.medianReviewCount)} / ${fmtNumber(stats.topReviewCount)}`,
      status: typeof target.reviewCount === "number" && typeof stats.medianReviewCount === "number" && target.reviewCount >= stats.medianReviewCount ? "strong" : "watch",
    },
    {
      key: "rating",
      title: "Rating comparison",
      targetLabel: target.businessName,
      targetValue: fmtRating(target.rating),
      competitorLabel: "Competitor average",
      competitorValue: fmtRating(stats.averageRating),
      status: typeof target.rating === "number" && typeof stats.averageRating === "number" && target.rating < stats.averageRating - 0.2 ? "urgent" : "strong",
    },
    {
      key: "photos",
      title: "Photo proof",
      targetLabel: target.businessName,
      targetValue: fmtNumber(target.photoCount),
      competitorLabel: "Competitor median",
      competitorValue: fmtNumber(stats.medianPhotoCount),
      status: typeof target.photoCount === "number" && typeof stats.medianPhotoCount === "number" && target.photoCount >= stats.medianPhotoCount ? "strong" : "watch",
    },
  ];
}

function auditOffer(target: NormalizedAuditProfile & { websiteAssessment: WebsiteAssessment }, flags: AuditCopyIssue[]) {
  const primary = !target.websiteAssessment.countsAsFullWebsite ? "website_setup" : flags.includes("review_count_gap") || flags.includes("photo_gap") ? "gbp_optimization" : "website_upgrade";
  return {
    primary: primary as "website_setup" | "website_upgrade" | "gbp_optimization",
    services: [
      {
        key: "website-launch",
        title: target.websiteAssessment.countsAsFullWebsite ? "Website upgrade / local landing pages" : "Website launch / setup",
        description: target.websiteAssessment.countsAsFullWebsite
          ? "Improve service pages, proof sections, contact paths, and local landing pages."
          : "Launch the generated preview on a real domain and use it as the Google profile website URL.",
        recommendedBecause: [target.websiteAssessment.reason],
      },
      {
        key: "gbp-optimization",
        title: "Google Business Profile optimization",
        description: "Clean up profile fields, align services/categories, add a photo plan, and keep website/profile messaging consistent.",
        recommendedBecause: ["The audit compares public profile signals that customers can see before they call."],
      },
      {
        key: "review-system",
        title: "Review generation system",
        description: "Use a feedback page, review request templates, and a post-delivery handoff so review growth becomes a routine.",
        recommendedBecause: ["Reviews are one of the clearest competitor comparison signals in the audit."],
      },
    ],
  };
}

export function buildMarketingAudit(input: BuildMarketingAuditInput): MarketingAudit {
  const rawTarget = input.target;
  const websiteAssessment = assessWebsiteUrl(rawTarget.websiteUrl);
  const target = { ...rawTarget, websiteAssessment, hasWebsite: websiteAssessment.countsAsFullWebsite };
  const competitors = (input.competitors || [])
    .map((row) => ({ ...row, websiteAssessment: row.websiteAssessment || assessWebsiteUrl(row.websiteUrl) }))
    .filter((row) => !sameBusiness(target, row))
    .slice(0, 20);
  const stats = competitorStatsFor(competitors);
  const site = input.siteJson || undefined;
  const categories = [
    scoreWebsite(target, stats, site),
    scoreReviews(target, stats),
    scorePhotos(target, stats),
    scoreCompleteness(target),
    scoreCompetitors(target, stats),
    scoreConversion(target, site),
  ];
  const total = categories.reduce((sum, item) => sum + item.score, 0);
  const label = total >= 78 ? "strong" : total >= 52 ? "needs-work" : "urgent";
  const flags = issueFlags(target, stats, categories);
  const ownerFacingCopy = buildOwnerFacingAuditCopy({
    businessName: target.businessName,
    city: target.city,
    category: target.category,
    websiteKindLabel: websiteAssessment.label,
    reviewCount: target.reviewCount,
    rating: target.rating,
    competitorMedianReviewCount: stats.medianReviewCount,
    competitorTopReviewCount: stats.topReviewCount,
    competitorAverageRating: stats.averageRating,
    competitorWebsiteRate: stats.websiteRate,
    photoCount: target.photoCount,
    competitorMedianPhotoCount: stats.medianPhotoCount,
    generatedPreviewAvailable: target.generatedPreviewAvailable,
    types: target.types,
    query: target.query,
    niche: target.niche,
    issueFlags: flags,
  });
  const missingDataNotes = [
    "Owner review replies are not scored because reliable owner reply coverage is not available for arbitrary third-party profiles.",
    "Photo posting recency is not scored because current Google photo references do not provide reliable posting dates.",
    stats.total ? "" : "Competitor comparison is limited because no cached competitor result set was available.",
  ].filter(Boolean);

  return {
    businessId: target.businessId,
    businessName: target.businessName,
    generatedAt: new Date().toISOString(),
    confidence: stats.total >= 5 && target.query ? "high" : stats.total >= 2 ? "medium" : "low",
    source: {
      placeId: target.placeId,
      mapsUrl: target.mapsUrl,
      profileDataSource: input.profileDataSource || (target.generatedPreviewAvailable ? "generated_site" : "prospect_details"),
      competitorDataSource: input.competitorDataSource || (stats.total ? "cached_query" : "inferred_none"),
      query: target.query,
      city: target.city,
      category: target.category,
    },
    score: { total, label, categories },
    target,
    competitors: {
      total: stats.total,
      withWebsite: stats.withWebsite,
      websiteRate: stats.websiteRate,
      averageRating: stats.averageRating,
      topRating: stats.topRating,
      medianReviewCount: stats.medianReviewCount,
      topReviewCount: stats.topReviewCount,
      medianPhotoCount: stats.medianPhotoCount,
      rows: stats.rows,
    },
    ownerFacingCopy,
    evidence: {
      comparisonCards: evidenceCards(target, stats),
      screenshotPlan: {
        availableNow: "rendered_report_sections",
        notes: ["Use generated evidence panels as the proof layer in the audit UI and PDF."],
      },
    },
    offer: auditOffer(target, flags),
    missingDataNotes,
  };
}

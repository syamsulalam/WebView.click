export type AiSiteGenerationDeps = {
  getSetting: (db: unknown, env: unknown, key: string) => Promise<string | undefined>;
  getAiReadiness: (db: unknown, env: unknown, provider: string, model: string, requiresAi?: boolean, remoteValidate?: boolean, refreshRemoteValidation?: boolean) => Promise<{ ready?: boolean; message?: string }>;
  buildAiFailureDiagnostics: (input: {
    provider: string;
    model: string;
    endpoint?: string;
    stage: string;
    httpStatus?: number;
    message: string;
    rawSnippet?: string;
    providerCode?: string;
    providerStatus?: string;
  }) => unknown;
  extractProviderErrorDetails: (text: string) => { message: string; rawSnippet: string; providerCode?: string; providerStatus?: string };
  kieModelConfigs: Record<string, { endpoint: string; model?: string; mode: "chat" | "responses" }>;
};

type D1DatabaseLike = unknown;
type EnvLike = unknown;

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

async function sha256Hex(value: string) {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Json(value: unknown) {
  return sha256Hex(JSON.stringify(value));
}
function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function safeCopyText(value: unknown, maxLength = 420) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  const clean = String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (clean.length <= maxLength) return clean;

  const clipped = clean.slice(0, maxLength).trim();
  const sentenceMinimum = Math.min(Math.max(80, Math.floor(maxLength * 0.55)), Math.max(0, maxLength - 1));
  const sentenceStops = [...clipped.matchAll(/[.!?](?=\s|$)/g)];
  const lastSentenceStop = sentenceStops[sentenceStops.length - 1];
  if (lastSentenceStop && lastSentenceStop.index !== undefined && lastSentenceStop.index + 1 >= sentenceMinimum) {
    return clipped.slice(0, lastSentenceStop.index + 1).trim();
  }

  const wordMinimum = Math.min(Math.max(32, Math.floor(maxLength * 0.72)), Math.max(0, maxLength - 1));
  const lastSpace = clipped.lastIndexOf(" ");
  if (lastSpace >= wordMinimum) {
    return clipped.slice(0, lastSpace).replace(/[,:;/-]+$/g, "").trim();
  }
  return clipped.replace(/[,:;/-]+$/g, "").trim();
}

function safeCopyArray(value: unknown, maxItems = 6, maxLength = 160) {
  return Array.isArray(value)
    ? value.map((item) => safeCopyText(item, maxLength)).filter(Boolean).slice(0, maxItems)
    : [];
}

function safeCopyPairs(value: unknown, maxItems = 6) {
  return Array.isArray(value)
    ? value
        .map((item) => {
          const source = objectValue(item);
          const title = safeCopyText(source.title, 90);
          const description = safeCopyText(source.description, 260);
          return title || description ? { title, description } : null;
        })
        .filter(Boolean)
        .slice(0, maxItems)
    : [];
}

function firstSectionByType(siteJson: Record<string, unknown>, type: string) {
  const pages = Array.isArray(siteJson.pages) ? siteJson.pages as Array<Record<string, unknown>> : [];
  for (const page of pages) {
    const sections = Array.isArray(page.sections) ? page.sections as Array<Record<string, unknown>> : [];
    const found = sections.find((section) => asString(section.type) === type);
    if (found) return found;
  }
  return null;
}

function sectionById(siteJson: Record<string, unknown>, id: string) {
  const pages = Array.isArray(siteJson.pages) ? siteJson.pages as Array<Record<string, unknown>> : [];
  for (const page of pages) {
    const sections = Array.isArray(page.sections) ? page.sections as Array<Record<string, unknown>> : [];
    const found = sections.find((section) => asString(section.id) === id);
    if (found) return found;
  }
  return null;
}

function findOffering(siteJson: Record<string, unknown>, patch: Record<string, unknown>) {
  const id = asString(patch.id);
  const detailPageId = asString(patch.detailPageId);
  const title = safeCopyText(patch.title, 120).toLowerCase();
  const products = Array.isArray(siteJson.products) ? siteJson.products as Array<Record<string, unknown>> : [];
  const services = Array.isArray(siteJson.services) ? siteJson.services as Array<Record<string, unknown>> : [];
  const all = [...products, ...services];
  return all.find((item) =>
    (id && asString(item.id) === id) ||
    (detailPageId && asString(item.detailPageId) === detailPageId) ||
    (title && asString(item.title).toLowerCase() === title)
  ) || null;
}

function applyTextIfPresent(target: Record<string, unknown>, key: string, source: Record<string, unknown>, sourceKey = key, maxLength = 420) {
  if (!(sourceKey in source)) return;
  const value = safeCopyText(source[sourceKey], maxLength);
  if (value) target[key] = value;
}

function shortOfferingMenuLabel(value: unknown) {
  const raw = safeCopyText(value, 90);
  if (!raw) return "";
  const cleaned = raw
    .replace(/\b(services?|products?|solutions?|packages?|programs?)\b/gi, "")
    .replace(/\b(for|and|with|from|by|near me)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const source = cleaned || raw;
  if (source.length <= 28) return source;
  const words = source.split(/\s+/).filter(Boolean);
  const compact = words.slice(0, 3).join(" ");
  return compact.length <= 34 ? compact : compact.slice(0, 31).replace(/\s+\S*$/, "").trim() || source.slice(0, 28).trim();
}

type AiCopyAuditTarget = {
  path: Array<string | number>;
  pathLabel: string;
  label: string;
  before: string;
};

type AiCopyAuditItem = {
  path: string;
  label: string;
  before: string;
  after: string;
  status: "ai_rewritten" | "ai_filled_blank" | "source_kept" | "fallback_source" | "missing_after";
};

function copyAuditText(value: unknown, maxLength = 260) {
  return safeCopyText(value, maxLength);
}

function copyAuditPathLabel(path: Array<string | number>) {
  return path.reduce((result, part) => (
    typeof part === "number" ? `${result}[${part}]` : result ? `${result}.${part}` : part
  ), "" as string);
}

function readCopyAuditPath(root: unknown, path: Array<string | number>) {
  let cursor = root;
  for (const part of path) {
    if (typeof part === "number") {
      if (!Array.isArray(cursor)) return undefined;
      cursor = cursor[part];
    } else {
      const source = objectValue(cursor);
      if (!(part in source)) return undefined;
      cursor = source[part];
    }
  }
  return cursor;
}

function pushCopyAuditTarget(
  targets: AiCopyAuditTarget[],
  path: Array<string | number>,
  label: string,
  value: unknown,
  includeBlank = false,
) {
  const before = copyAuditText(value);
  if (!before && !includeBlank) return;
  targets.push({ path, pathLabel: copyAuditPathLabel(path), label, before });
}

function collectSectionCopyAuditTargets(
  targets: AiCopyAuditTarget[],
  section: Record<string, unknown>,
  path: Array<string | number>,
) {
  const content = objectValue(section.content);
  const sectionName = asString(section.id, asString(section.type, "section"));
  (["title", "headline", "subheadline", "description", "summary"] as const).forEach((field) => {
    pushCopyAuditTarget(targets, [...path, "content", field], `${sectionName} ${field}`, content[field]);
  });

  const items = Array.isArray(content.items)
    ? content.items as Array<Record<string, unknown>>
    : Array.isArray(content.cards)
      ? content.cards as Array<Record<string, unknown>>
      : [];
  items.slice(0, 8).forEach((item, index) => {
    (["title", "label", "value", "description", "question", "answer"] as const).forEach((field) => {
      pushCopyAuditTarget(targets, [...path, "content", "items", index, field], `${sectionName} item ${index + 1} ${field}`, item[field]);
    });
  });
}

export function collectAiCopyAuditTargets(siteJson: Record<string, unknown>, options: { focus?: string; offeringIndex?: number; offeringBatchSize?: number } = {}) {
  const targets: AiCopyAuditTarget[] = [];
  const meta = objectValue(siteJson.meta);
  const businessProfile = objectValue(siteJson.businessProfile);
  const seo = objectValue(siteJson.seo);
  const focus = options.focus || "all";
  const products = Array.isArray(siteJson.products) ? siteJson.products as Array<Record<string, unknown>> : [];
  const services = Array.isArray(siteJson.services) ? siteJson.services as Array<Record<string, unknown>> : [];
  const offeringRows = [
    ...products.map((item, index) => ({ item, rootPath: ["products", index] as Array<string | number>, index })),
    ...services.map((item, index) => ({ item, rootPath: ["services", index] as Array<string | number>, index: products.length + index })),
  ];
  const requestedOfferingIndex = Number.isFinite(options.offeringIndex)
    ? Math.max(0, Math.floor(Number(options.offeringIndex)))
    : -1;
  const requestedOfferingBatchSize = Number.isFinite(options.offeringBatchSize)
    ? Math.max(1, Math.min(4, Math.floor(Number(options.offeringBatchSize))))
    : 1;
  const selectedOfferingRows = (focus === "offerings" || focus === "navLabels") && requestedOfferingIndex >= 0
    ? offeringRows.filter((row) => row.index >= requestedOfferingIndex && row.index < requestedOfferingIndex + requestedOfferingBatchSize)
    : offeringRows.slice(0, 16);
  const offeringDetailPageIds = new Set(offeringRows.map((row) => asString(row.item.detailPageId)).filter(Boolean));
  const selectedOfferingDetailPageIds = new Set(selectedOfferingRows.map((row) => asString(row.item.detailPageId)).filter(Boolean));

  if (focus !== "offerings" && focus !== "navLabels" && focus !== "about") {
    pushCopyAuditTarget(targets, ["meta", "seoTitle"], "meta SEO title", meta.seoTitle, true);
    pushCopyAuditTarget(targets, ["meta", "seoDescription"], "meta SEO description", meta.seoDescription, true);
    pushCopyAuditTarget(targets, ["businessProfile", "shortPitch"], "business short pitch", businessProfile.shortPitch, true);
    pushCopyAuditTarget(targets, ["seo", "cityLandingPhrase"], "SEO city phrase", seo.cityLandingPhrase, true);
  }

  const pages = Array.isArray(siteJson.pages) ? siteJson.pages as Array<Record<string, unknown>> : [];
  const pagesForAudit = focus === "offerings" ? pages : focus === "navLabels" ? [] : pages.slice(0, 12);
  pagesForAudit.forEach((page, pageIndex) => {
    const pageId = asString(page.pageId);
    if (focus === "about" && pageId !== "about") return;
    if (focus === "site" && offeringDetailPageIds.has(pageId)) return;
    if (focus === "offerings" || focus === "navLabels") {
      const targetDetailIds = selectedOfferingDetailPageIds.size ? selectedOfferingDetailPageIds : offeringDetailPageIds;
      if (!targetDetailIds.has(pageId)) return;
    }
    const sections = Array.isArray(page.sections) ? page.sections as Array<Record<string, unknown>> : [];
    sections.slice(0, 16).forEach((section, sectionIndex) => {
      const type = asString(section.type);
      if (!["hero", "features", "offers", "offeringDetail", "reviews", "hoursLocation", "faq", "gridCards", "textImageBlock"].includes(type)) return;
      collectSectionCopyAuditTargets(targets, section, ["pages", pageIndex, "sections", sectionIndex]);
    });
  });

  const offers = Array.isArray(siteJson.offers) ? siteJson.offers as Array<Record<string, unknown>> : [];
  if (focus !== "offerings" && focus !== "navLabels" && focus !== "about") {
    offers.slice(0, 12).forEach((offer, index) => {
      pushCopyAuditTarget(targets, ["offers", index, "title"], `offer ${index + 1} title`, offer.title);
      pushCopyAuditTarget(targets, ["offers", index, "description"], `offer ${index + 1} description`, offer.description);
      pushCopyAuditTarget(targets, ["offers", index, "priceHint"], `offer ${index + 1} price hint`, offer.priceHint);
    });
  }

  if (focus === "site") return targets.slice(0, 180);
  if (focus === "about") return targets.slice(0, 48);

  selectedOfferingRows.forEach((row) => {
    const offering = row.item;
    const rootPath = row.rootPath;
    const name = asString(offering.title, `offering ${row.index + 1}`);
    if (focus === "navLabels") {
      pushCopyAuditTarget(targets, [...rootPath, "navLabel"], `${name} navLabel`, offering.navLabel, true);
      return;
    }
    (["title", "navLabel", "summary", "description", "priceHint"] as const).forEach((field) => {
      pushCopyAuditTarget(targets, [...rootPath, field], `${name} ${field}`, offering[field]);
    });
    (["bestFor", "included", "relatedReviewKeywords"] as const).forEach((field) => {
      const values = Array.isArray(offering[field]) ? offering[field] as unknown[] : [];
      values.slice(0, 8).forEach((value, itemIndex) => {
        pushCopyAuditTarget(targets, [...rootPath, field, itemIndex], `${name} ${field} ${itemIndex + 1}`, value);
      });
    });
    const highlights = Array.isArray(offering.highlights) ? offering.highlights as Array<Record<string, unknown>> : [];
    highlights.slice(0, 6).forEach((highlight, itemIndex) => {
      pushCopyAuditTarget(targets, [...rootPath, "highlights", itemIndex, "title"], `${name} highlight ${itemIndex + 1} title`, highlight.title);
      pushCopyAuditTarget(targets, [...rootPath, "highlights", itemIndex, "description"], `${name} highlight ${itemIndex + 1} description`, highlight.description);
    });
  });

  return targets.slice(0, 180);
}

export function buildAiCopyAudit(targets: AiCopyAuditTarget[], siteJson: Record<string, unknown>, patchApplied: boolean) {
  const items = targets.map((target) => {
    const after = copyAuditText(readCopyAuditPath(siteJson, target.path));
    let status: AiCopyAuditItem["status"] = "source_kept";
    if (!patchApplied) {
      status = "fallback_source";
    } else if (target.before && after && target.before !== after) {
      status = "ai_rewritten";
    } else if (!target.before && after) {
      status = "ai_filled_blank";
    } else if (target.before && !after) {
      status = "missing_after";
    }
    return {
      path: target.pathLabel,
      label: target.label,
      before: target.before,
      after,
      status,
    };
  }).filter((item) => item.before || item.after) as AiCopyAuditItem[];

  const summary = items.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    summary: {
      targetFieldsSentToAi: targets.length,
      sourceSentencesSentToAi: targets.filter((target) => target.before).length,
      aiRewritten: summary.ai_rewritten || 0,
      aiFilledBlank: summary.ai_filled_blank || 0,
      sourceKept: summary.source_kept || 0,
      fallbackSource: summary.fallback_source || 0,
      missingAfter: summary.missing_after || 0,
      storedItems: Math.min(items.length, 120),
    },
    items: items.slice(0, 120),
  };
}

function applyButtonTextPatch(buttons: unknown, patchButtons: unknown) {
  if (!Array.isArray(buttons) || !Array.isArray(patchButtons)) return;
  patchButtons.slice(0, buttons.length).forEach((patchButton, index) => {
    const target = objectValue(buttons[index]);
    const text = safeCopyText(objectValue(patchButton).text, 80);
    if (text) target.text = text;
  });
}

function applySectionCopyPatch(section: Record<string, unknown>, patch: Record<string, unknown>) {
  const content = objectValue(section.content);
  applyTextIfPresent(content, "title", patch, "title", 140);
  applyTextIfPresent(content, "headline", patch, "headline", 160);
  applyTextIfPresent(content, "subheadline", patch, "subheadline", 520);
  applyTextIfPresent(content, "description", patch, "description", 420);
  applyTextIfPresent(content, "summary", patch, "summary", 420);
  applyTextIfPresent(content, "kind", patch, "kind", 60);
  applyTextIfPresent(content, "priceHint", patch, "priceHint", 80);
  applyButtonTextPatch(content.buttons, patch.buttons);

  const itemsPatch = Array.isArray(patch.items) ? patch.items as Array<Record<string, unknown>> : [];
  const contentItems = Array.isArray(content.items) ? content.items as Array<Record<string, unknown>> : [];
  itemsPatch.slice(0, contentItems.length).forEach((itemPatch, index) => {
    const target = objectValue(contentItems[index]);
    applyTextIfPresent(target, "title", itemPatch, "title", 90);
    applyTextIfPresent(target, "label", itemPatch, "label", 80);
    applyTextIfPresent(target, "value", itemPatch, "value", 80);
    applyTextIfPresent(target, "description", itemPatch, "description", 260);
    applyTextIfPresent(target, "question", itemPatch, "question", 140);
    applyTextIfPresent(target, "answer", itemPatch, "answer", 360);
  });
  const contentCards = Array.isArray(content.cards) ? content.cards as Array<Record<string, unknown>> : [];
  itemsPatch.slice(0, contentCards.length).forEach((itemPatch, index) => {
    const target = objectValue(contentCards[index]);
    applyTextIfPresent(target, "title", itemPatch, "title", 90);
    applyTextIfPresent(target, "description", itemPatch, "description", 260);
  });

  if (Array.isArray(patch.highlights)) content.highlights = safeCopyPairs(patch.highlights, 4);
  if (Array.isArray(patch.included)) content.included = safeCopyArray(patch.included, 8, 100);
  if (Array.isArray(patch.bestFor)) content.bestFor = safeCopyArray(patch.bestFor, 6, 80);
  if (Array.isArray(patch.faq)) {
    content.items = (patch.faq as unknown[]).map((item) => {
      const source = objectValue(item);
      const question = safeCopyText(source.question, 140);
      const answer = safeCopyText(source.answer, 420);
      return question && answer ? { question, answer } : null;
    }).filter(Boolean).slice(0, 6);
  }
  section.content = content;
}

function applyOfferingCopyPatch(siteJson: Record<string, unknown>, patch: Record<string, unknown>) {
  const offering = findOffering(siteJson, patch);
  if (!offering) return;
  applyTextIfPresent(offering, "title", patch, "title", 120);
  applyTextIfPresent(offering, "navLabel", patch, "navLabel", 34);
  applyTextIfPresent(offering, "navLabel", patch, "shortLabel", 34);
  if (!safeCopyText(offering.navLabel, 34)) offering.navLabel = shortOfferingMenuLabel(offering.title);
  applyTextIfPresent(offering, "summary", patch, "summary", 360);
  applyTextIfPresent(offering, "description", patch, "description", 700);
  applyTextIfPresent(offering, "priceHint", patch, "priceHint", 80);
  if (Array.isArray(patch.bestFor)) offering.bestFor = safeCopyArray(patch.bestFor, 6, 80);
  if (Array.isArray(patch.included)) offering.included = safeCopyArray(patch.included, 8, 100);
  if (Array.isArray(patch.highlights)) offering.highlights = safeCopyPairs(patch.highlights, 4);
  if (Array.isArray(patch.relatedReviewKeywords)) offering.relatedReviewKeywords = safeCopyArray(patch.relatedReviewKeywords, 8, 40);

  const detailPageId = asString(offering.detailPageId);
  const pages = Array.isArray(siteJson.pages) ? siteJson.pages as Array<Record<string, unknown>> : [];
  const page = pages.find((item) => asString(item.pageId) === detailPageId);
  if (!page) return;
  if (offering.title) page.pageTitle = offering.title;
  const sections = Array.isArray(page.sections) ? page.sections as Array<Record<string, unknown>> : [];
  sections.forEach((section) => {
    const sectionType = asString(section.type);
    if (sectionType === "hero") {
      applySectionCopyPatch(section, objectValue(patch.hero));
    }
    if (sectionType === "offeringDetail") {
      applySectionCopyPatch(section, {
        title: offering.title,
        summary: offering.summary || offering.description,
        priceHint: offering.priceHint,
        bestFor: offering.bestFor,
        included: offering.included,
        highlights: offering.highlights,
      });
    }
    if (sectionType === "features") {
      applySectionCopyPatch(section, objectValue(patch.features));
    }
    if (sectionType === "faq") {
      applySectionCopyPatch(section, { title: safeCopyText(patch.faqTitle, 140), faq: patch.faq });
    }
  });
}

export function applyAiCopyPatch(siteJson: Record<string, unknown>, patch: Record<string, unknown>) {
  const metaCopy = objectValue(patch.metaCopy);
  const meta = objectValue(siteJson.meta);
  applyTextIfPresent(meta, "seoTitle", metaCopy, "seoTitle", 160);
  applyTextIfPresent(meta, "seoDescription", metaCopy, "seoDescription", 260);
  siteJson.meta = meta;

  const businessProfile = objectValue(siteJson.businessProfile);
  applyTextIfPresent(businessProfile, "shortPitch", metaCopy, "shortPitch", 420);
  siteJson.businessProfile = businessProfile;

  const seo = objectValue(siteJson.seo);
  applyTextIfPresent(seo, "title", metaCopy, "seoTitle", 160);
  applyTextIfPresent(seo, "description", metaCopy, "seoDescription", 260);
  applyTextIfPresent(seo, "cityLandingPhrase", metaCopy, "cityLandingPhrase", 120);
  siteJson.seo = seo;

  const heroPatch = objectValue(patch.hero);
  const heroSection = heroPatch.id ? sectionById(siteJson, asString(heroPatch.id)) : firstSectionByType(siteJson, "hero");
  if (heroSection) applySectionCopyPatch(heroSection, heroPatch);

  const sectionsPatch = objectValue(patch.sections);
  Object.entries(sectionsPatch).forEach(([sectionId, sectionPatch]) => {
    const section = sectionById(siteJson, sectionId);
    if (section) applySectionCopyPatch(section, objectValue(sectionPatch));
  });

  const offersPatch = Array.isArray(patch.offers) ? patch.offers as Array<Record<string, unknown>> : [];
  const offers = Array.isArray(siteJson.offers) ? siteJson.offers as Array<Record<string, unknown>> : [];
  offersPatch.slice(0, offers.length).forEach((offerPatch, index) => {
    const target = objectValue(offers[index]);
    applyTextIfPresent(target, "title", offerPatch, "title", 120);
    applyTextIfPresent(target, "description", offerPatch, "description", 420);
    applyTextIfPresent(target, "priceHint", offerPatch, "priceHint", 80);
  });

  const offeringsPatch = Array.isArray(patch.offerings) ? patch.offerings as Array<Record<string, unknown>> : [];
  offeringsPatch.forEach((offeringPatch) => applyOfferingCopyPatch(siteJson, objectValue(offeringPatch)));

  const faqPatch = Array.isArray(patch.faq) ? patch.faq : [];
  if (faqPatch.length) {
    const faqSection = firstSectionByType(siteJson, "faq");
    if (faqSection) applySectionCopyPatch(faqSection, { faq: faqPatch, title: safeCopyText(patch.faqTitle, 140) });
  }

  const conversionPatch = objectValue(patch.conversion);
  const conversion = objectValue(siteJson.conversion);
  const primaryCta = objectValue(conversion.primaryCta);
  const secondaryCta = objectValue(conversion.secondaryCta);
  applyTextIfPresent(primaryCta, "text", conversionPatch, "primaryCtaText", 80);
  applyTextIfPresent(secondaryCta, "text", conversionPatch, "secondaryCtaText", 80);
  conversion.primaryCta = primaryCta;
  conversion.secondaryCta = secondaryCta;
  siteJson.conversion = conversion;

  const globalConfig = objectValue(siteJson.global);
  const header = objectValue(globalConfig.header);
  const headerCta = objectValue(header.ctaButton);
  applyTextIfPresent(headerCta, "text", conversionPatch, "headerCtaText", 80);
  header.ctaButton = headerCta;
  globalConfig.header = header;
  const footerPatch = objectValue(patch.footer);
  const footer = objectValue(globalConfig.footer);
  applyTextIfPresent(footer, "text", footerPatch, "text", 180);
  globalConfig.footer = footer;
  siteJson.global = globalConfig;

  return siteJson;
}

function textItemsFromArray(value: unknown, maxItems = 6) {
  return Array.isArray(value)
    ? value.slice(0, maxItems).map((item) => {
      if (typeof item === "string" || typeof item === "number") return safeCopyText(item, 160);
      const source = objectValue(item);
      return {
        title: safeCopyText(source.title || source.label || source.question, 120),
        description: safeCopyText(source.description || source.answer || source.value, 260),
      };
    }).filter(Boolean)
    : [];
}

function sectionCopyTarget(section: Record<string, unknown>) {
  const content = objectValue(section.content);
  return {
    sectionId: asString(section.id),
    type: asString(section.type),
    title: safeCopyText(content.title, 140),
    headline: safeCopyText(content.headline, 160),
    subheadline: safeCopyText(content.subheadline, 520),
    description: safeCopyText(content.description || content.summary, 360),
    items: textItemsFromArray(content.items || content.cards || content.highlights || content.buttons, 6),
  };
}

function offeringSlug(value: unknown, fallback = "offering") {
  const slug = safeCopyText(value, 90)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || fallback;
}

function currentOfferingRecords(siteJson: Record<string, unknown>) {
  return [
    ...(Array.isArray(siteJson.products) ? siteJson.products as Array<Record<string, unknown>> : []),
    ...(Array.isArray(siteJson.services) ? siteJson.services as Array<Record<string, unknown>> : []),
  ];
}

function normalizeAiOfferingOutline(siteJson: Record<string, unknown>, outline: Record<string, unknown>) {
  const existing = currentOfferingRecords(siteJson);
  const proposed = Array.isArray(outline.offerings) ? outline.offerings as Array<Record<string, unknown>> : [];
  const source = proposed.length ? proposed : existing;
  const seen = new Set<string>();
  const normalized = source
    .map((item, index) => {
      const existingItem = existing[index] || {};
      const typeRaw = asString(item.type, asString(existingItem.type, "service")).toLowerCase();
      const type = typeRaw === "product" ? "product" : "service";
      const title = safeCopyText(item.title || existingItem.title, 90);
      if (!title) return null;
      const idBase = offeringSlug(item.id || title, `${type}-${index + 1}`);
      let id = idBase;
      let suffix = 2;
      while (seen.has(id)) {
        id = `${idBase}-${suffix}`;
        suffix += 1;
      }
      seen.add(id);
      const detailPageId = `${type}-${id}`;
      return {
        id,
        type,
        title,
        navLabel: safeCopyText(item.navLabel || item.shortLabel || existingItem.navLabel || existingItem.shortLabel, 34) || shortOfferingMenuLabel(title),
        summary: safeCopyText(item.summary || item.customerIntent || existingItem.summary || existingItem.description, 260),
        description: safeCopyText(item.description || item.customerIntent || existingItem.description || existingItem.summary, 520),
        priceHint: safeCopyText(item.priceHint || existingItem.priceHint, 80) || "Contact for estimate",
        image: asString(existingItem.image),
        detailPageId,
        bestFor: safeCopyArray(item.bestFor || existingItem.bestFor, 5, 80),
        included: safeCopyArray(item.included || existingItem.included, 6, 100),
        highlights: safeCopyPairs(item.highlights || existingItem.highlights, 4),
        relatedReviewKeywords: safeCopyArray(item.relatedReviewKeywords || item.keywords || existingItem.relatedReviewKeywords, 8, 40),
      };
    })
    .filter(Boolean)
    .slice(0, 12) as Array<Record<string, unknown>>;
  return normalized.length ? normalized : existing;
}

function offeringDetailPageFor(item: Record<string, unknown>, siteJson: Record<string, unknown>) {
  const meta = objectValue(siteJson.meta);
  const profile = objectValue(siteJson.businessProfile);
  const contact = objectValue(profile.contact);
  const location = objectValue(siteJson.location);
  const isIndonesian = asString(meta.language).toLowerCase().startsWith("id");
  const businessName = asString(meta.businessName, asString(profile.name, "Business"));
  const type = asString(item.type) === "product" ? "product" : "service";
  const title = safeCopyText(item.title, 90);
  const summary = safeCopyText(item.summary || item.description, 320);
  const description = safeCopyText(item.description || item.summary, 620);
  const pageId = asString(item.detailPageId, `${type}-${offeringSlug(title)}`);
  const address = safeCopyText(location.formattedAddress || objectValue(profile.address).formatted, 220);
  const phone = safeCopyText(contact.phoneNational || contact.phoneInternational, 80);
  return {
    pageId,
    pageTitle: title,
    sections: [
      {
        type: "hero",
        id: `${asString(item.id, offeringSlug(title))}-hero`,
        content: {
          headline: isIndonesian ? `${title} dari ${businessName}` : `${title} from ${businessName}`,
          subheadline: summary,
          buttons: [
            { text: isIndonesian ? "Tanya penawaran ini" : "Ask about this", href: "#contact", style: "primary" },
            { text: isIndonesian ? "Lihat pilihan lain" : "Back to services", href: "#services", style: "outline" },
          ],
          image: asString(item.image),
        },
      },
      {
        type: "offeringDetail",
        id: `${asString(item.id, offeringSlug(title))}-detail`,
        content: {
          kind: type === "product" ? (isIndonesian ? "Produk" : "Product") : (isIndonesian ? "Layanan" : "Service"),
          title,
          summary,
          description,
          priceHint: safeCopyText(item.priceHint, 80),
          image: asString(item.image),
          bestFor: safeCopyArray(item.bestFor, 5, 80),
          included: safeCopyArray(item.included, 6, 100),
          highlights: safeCopyPairs(item.highlights, 4),
        },
      },
      {
        type: "features",
        id: `${asString(item.id, offeringSlug(title))}-features`,
        content: {
          title: isIndonesian ? `Kenapa memilih ${title}` : `Why choose ${title}`,
          items: [
            { title: isIndonesian ? "Kebutuhan jelas" : "Clear fit", description: summary },
            { title: isIndonesian ? "Langkah berikutnya" : "Practical next step", description: isIndonesian ? "Hubungi bisnis untuk membahas kebutuhan, jadwal, dan ketersediaan." : "Contact the business to discuss scope, timing, and availability." },
            { title: isIndonesian ? "Konteks lokal" : "Local context", description: address || (isIndonesian ? "Disusun untuk kebutuhan pelanggan lokal." : "Built around local customer intent.") },
          ],
        },
      },
      {
        type: "faq",
        id: `${asString(item.id, offeringSlug(title))}-faq`,
        content: {
          title: isIndonesian ? `Pertanyaan tentang ${title}` : `Questions about ${title}`,
          items: [
            {
              question: isIndonesian ? `Bagaimana cara bertanya tentang ${title}?` : `How do I ask about ${title}?`,
              answer: isIndonesian ? "Gunakan tombol kontak atau hubungi bisnis langsung untuk ketersediaan dan langkah berikutnya." : "Use the contact button or call directly for availability, fit, and next steps.",
            },
            {
              question: isIndonesian ? "Apakah detail bisa disesuaikan?" : "Can the details be customized?",
              answer: isIndonesian ? "Bisa. Sampaikan kebutuhan, lokasi, waktu, dan detail penting saat menghubungi." : "Yes. Share your need, location, timing, and important details when you contact the business.",
            },
          ],
        },
      },
      { type: "hoursLocation", id: `${asString(item.id, offeringSlug(title))}-contact`, content: { title: isIndonesian ? "Kontak dan lokasi" : "Contact and location", address, phone, directionsUrl: asString(contact.directionsUrl, asString(location.directionsUrl)) } },
    ],
  };
}

export function applyAiOfferingOutline(siteJson: Record<string, unknown>, outline: Record<string, unknown>) {
  const offerings = normalizeAiOfferingOutline(siteJson, outline);
  if (!offerings.length) return { applied: false, count: 0 };

  const meta = objectValue(siteJson.meta);
  const isIndonesian = asString(meta.language).toLowerCase().startsWith("id");
  const oldDetailIds = new Set(currentOfferingRecords(siteJson).map((item) => asString(item.detailPageId)).filter(Boolean));
  const products = offerings.filter((item) => asString(item.type) === "product");
  const services = offerings.filter((item) => asString(item.type) !== "product");
  siteJson.products = products;
  siteJson.services = services;
  siteJson.offers = offerings.map((item) => ({
    title: item.title,
    navLabel: item.navLabel,
    description: item.summary || item.description,
    priceHint: item.priceHint,
    image: item.image,
    detailPageId: item.detailPageId,
    cta: { text: isIndonesian ? "Lihat detail" : "View details", href: `#${item.detailPageId}` },
  }));

  const strategy = objectValue(siteJson.productServiceStrategy);
  const hasProducts = products.length > 0;
  const hasServices = services.length > 0;
  strategy.mode = hasProducts && hasServices ? "both" : hasProducts ? "products" : "services";
  strategy.navbarGroupLabel = hasProducts && hasServices
    ? (isIndonesian ? "Produk & Layanan" : "Products & Services")
    : hasProducts ? (isIndonesian ? "Produk" : "Products") : (isIndonesian ? "Layanan" : "Services");
  strategy.detailPageRule = isIndonesian
    ? "Setiap penawaran punya halaman detail yang dibuat deterministik dari outline AI yang sudah divalidasi."
    : "Each offering gets a deterministic detail page from the validated AI outline.";
  siteJson.productServiceStrategy = strategy;

  const pages = Array.isArray(siteJson.pages) ? siteJson.pages as Array<Record<string, unknown>> : [];
  const nextPages = pages.filter((page) => {
    const pageId = asString(page.pageId);
    return pageId !== "services" && !oldDetailIds.has(pageId);
  });
  nextPages.push(...offerings.map((item) => offeringDetailPageFor(item, siteJson)));
  nextPages.forEach((page) => {
    const sections = Array.isArray(page.sections) ? page.sections as Array<Record<string, unknown>> : [];
    sections.forEach((section) => {
      if (asString(section.type) !== "offers") return;
      const content = objectValue(section.content);
      content.items = offerings;
      section.content = content;
    });
  });
  siteJson.pages = nextPages;

  const navigation = objectValue(siteJson.navigation);
  const headerMenu = Array.isArray(navigation.headerMenu) ? navigation.headerMenu as Array<Record<string, unknown>> : [];
  const serviceMenu = {
    label: strategy.navbarGroupLabel,
    href: "#services",
    children: offerings.map((item) => ({ label: safeCopyText(item.navLabel, 34) || shortOfferingMenuLabel(item.title), href: `#${item.detailPageId}` })),
  };
  const menuIndex = headerMenu.findIndex((item) => asString(item.href) === "#services" || /service|layanan|product|produk/i.test(asString(item.label)));
  if (menuIndex >= 0) headerMenu[menuIndex] = serviceMenu;
  else headerMenu.splice(Math.min(1, headerMenu.length), 0, serviceMenu);
  navigation.headerMenu = headerMenu;
  siteJson.navigation = navigation;

  return { applied: true, count: offerings.length };
}

function businessFactsForAiCopy(originData: unknown, siteJson: Record<string, unknown>, businessName: string) {
  const origin = objectValue(originData);
  const meta = objectValue(siteJson.meta);
  const profile = objectValue(siteJson.businessProfile);
  const trust = objectValue(siteJson.trust);
  const contact = objectValue(profile.contact);
  const address = objectValue(profile.address);
  const hours = objectValue(siteJson.hours);
  const reviews = Array.isArray(trust.reviews)
    ? (trust.reviews as Array<Record<string, unknown>>).slice(0, 5).map((review) => ({
      rating: typeof review.rating === "number" ? review.rating : undefined,
      text: safeCopyText(review.text, 420),
      authorName: safeCopyText(review.authorName || review.author, 80),
    }))
    : [];

  return {
    businessName,
    language: asString(meta.language),
    niche: asString(meta.niche),
    primaryType: asString(profile.primaryType, Array.isArray(origin.types) ? asString(origin.types[0]) : ""),
    typeLabel: asString(profile.typeLabel),
    categories: Array.isArray(profile.categories) ? profile.categories.map((item) => safeCopyText(item, 60)).filter(Boolean).slice(0, 8) : [],
    address: safeCopyText(address.formatted || origin.formatted_address || origin.formattedAddress, 220),
    city: safeCopyText(address.city, 80),
    state: safeCopyText(address.state, 80),
    country: safeCopyText(address.country, 80),
    phone: safeCopyText(contact.phoneNational || contact.phoneInternational || origin.formatted_phone_number || origin.nationalPhoneNumber || origin.international_phone_number, 80),
    businessStatus: safeCopyText(origin.business_status || origin.businessStatus || objectValue(siteJson.sourceData).businessStatus, 80),
    rating: typeof trust.rating === "number" ? trust.rating : typeof origin.rating === "number" ? origin.rating : null,
    reviewCount: typeof trust.reviewCount === "number" ? trust.reviewCount : typeof origin.user_ratings_total === "number" ? origin.user_ratings_total : typeof origin.userRatingCount === "number" ? origin.userRatingCount : null,
    hours: Array.isArray(hours.regular) ? hours.regular.map((item) => safeCopyText(item, 120)).filter(Boolean).slice(0, 8) : [],
    reviews,
  };
}

export function buildAiCopyTargetBrief(siteJson: Record<string, unknown>, originData: unknown, businessName: string, options: { focus?: string; offeringIndex?: number; offeringBatchSize?: number } = {}) {
  const pages = Array.isArray(siteJson.pages) ? siteJson.pages as Array<Record<string, unknown>> : [];
  const offers = Array.isArray(siteJson.offers) ? siteJson.offers as Array<Record<string, unknown>> : [];
  const products = Array.isArray(siteJson.products) ? siteJson.products as Array<Record<string, unknown>> : [];
  const services = Array.isArray(siteJson.services) ? siteJson.services as Array<Record<string, unknown>> : [];
  const focus = options.focus || "site";
  const offeringRows = [
    ...products.map((item, index) => ({ item, index })),
    ...services.map((item, index) => ({ item, index: products.length + index })),
  ];
  const requestedOfferingIndex = Number.isFinite(options.offeringIndex)
    ? Math.max(0, Math.floor(Number(options.offeringIndex)))
    : -1;
  const requestedOfferingBatchSize = Number.isFinite(options.offeringBatchSize)
    ? Math.max(1, Math.min(4, Math.floor(Number(options.offeringBatchSize))))
    : 1;
  const selectedOfferingRows = (focus === "offerings" || focus === "navLabels") && requestedOfferingIndex >= 0
    ? offeringRows.filter((row) => row.index >= requestedOfferingIndex && row.index < requestedOfferingIndex + requestedOfferingBatchSize)
    : offeringRows.slice(0, focus === "offerings" || focus === "navLabels" ? 16 : 6);
  const offeringDetailPageIds = new Set(offeringRows.map((row) => asString(row.item.detailPageId)).filter(Boolean));
  const selectedOfferingDetailPageIds = new Set(selectedOfferingRows.map((row) => asString(row.item.detailPageId)).filter(Boolean));
  const sectionTargets = pages.flatMap((page) => {
    const pageId = asString(page.pageId);
    const sections = Array.isArray(page.sections) ? page.sections as Array<Record<string, unknown>> : [];
    return sections
      .filter((section) => ["hero", "features", "offers", "offeringDetail", "reviews", "hoursLocation", "faq", "gridCards", "textImageBlock"].includes(asString(section.type)))
      .filter((section) => {
        if (focus === "about") return pageId === "about";
        if (focus === "offerings") {
          if (selectedOfferingDetailPageIds.size) return selectedOfferingDetailPageIds.has(pageId);
          return offeringDetailPageIds.has(pageId) || asString(section.type) === "offeringDetail";
        }
        if (focus === "navLabels") return false;
        return !offeringDetailPageIds.has(pageId);
      })
      .map((section) => ({ pageId, ...sectionCopyTarget(section) }));
  });
  return {
    facts: businessFactsForAiCopy(originData, siteJson, businessName),
    focus,
    metaCopyTargets: {
      seoTitle: safeCopyText(objectValue(siteJson.meta).seoTitle, 160),
      seoDescription: safeCopyText(objectValue(siteJson.meta).seoDescription, 260),
      shortPitch: safeCopyText(objectValue(siteJson.businessProfile).shortPitch, 420),
      cityLandingPhrase: safeCopyText(objectValue(siteJson.seo).cityLandingPhrase, 140),
    },
    offeringIndex: requestedOfferingIndex >= 0 ? requestedOfferingIndex : undefined,
    offeringBatchSize: requestedOfferingIndex >= 0 ? requestedOfferingBatchSize : undefined,
    offeringTotal: offeringRows.length,
    sectionTargets: sectionTargets.slice(0, focus === "offerings" && requestedOfferingIndex >= 0 ? 12 * requestedOfferingBatchSize : focus === "offerings" ? 80 : focus === "about" ? 8 : 24),
    offers: (focus === "offerings" || focus === "navLabels" || focus === "about" ? [] : offers).map((offer, index) => ({
      index,
      title: safeCopyText(offer.title, 120),
      description: safeCopyText(offer.description, 360),
      priceHint: safeCopyText(offer.priceHint, 80),
    })).slice(0, 12),
    offerings: selectedOfferingRows.map(({ item, index }) => ({
      index,
      id: asString(item.id),
      type: asString(item.type),
      detailPageId: asString(item.detailPageId),
      title: safeCopyText(item.title, 120),
      navLabel: safeCopyText(item.navLabel || item.shortLabel, 34),
      summary: focus === "navLabels" ? "" : safeCopyText(item.summary, 360),
      description: focus === "navLabels" ? "" : safeCopyText(item.description, 520),
      priceHint: focus === "navLabels" ? "" : safeCopyText(item.priceHint, 80),
      bestFor: focus === "navLabels" ? [] : safeCopyArray(item.bestFor, 6, 80),
      included: focus === "navLabels" ? [] : safeCopyArray(item.included, 8, 100),
      highlights: focus === "navLabels" ? [] : safeCopyPairs(item.highlights, 4),
      relatedReviewKeywords: focus === "navLabels" ? [] : safeCopyArray(item.relatedReviewKeywords, 8, 40),
    })),
  };
}

async function callAiJsonObjectProvider(deps: AiSiteGenerationDeps, input: {
  db: D1DatabaseLike;
  env: EnvLike;
  provider: string;
  model: string;
  systemMsg: string;
  userMsg: string;
  contextLabel: string;
}): Promise<string> {
  const { db, env, provider, model, systemMsg, userMsg, contextLabel } = input;
  const providerName = provider;
  const modelName = model.trim();
  const fail = (message: string, diagnostics: unknown): never => {
    const error = new Error(message);
    (error as Error & { aiFailure?: unknown }).aiFailure = diagnostics;
    throw error;
  };
  const fetchProvider = async (endpoint: string, init: RequestInit): Promise<Response> => {
    try {
      return await fetch(endpoint, init);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      fail(
        `${providerName} ${contextLabel} network call failed (${modelName} via ${endpoint}): ${message}`,
        deps.buildAiFailureDiagnostics({ provider: providerName, model: modelName, endpoint, stage: "provider_network", message, rawSnippet: message }),
      );
    }
  };
  const readApiError = async (response: Response, endpoint: string): Promise<never> => {
    const text = await response.text().catch(() => "");
    const details = deps.extractProviderErrorDetails(text);
    const message = details.message.slice(0, 600);
    fail(
      `${providerName} ${contextLabel} API returned HTTP ${response.status}${message ? `: ${message}` : ""}`,
      deps.buildAiFailureDiagnostics({ provider: providerName, model: modelName, endpoint, stage: "provider_http", httpStatus: response.status, message, rawSnippet: details.rawSnippet, providerCode: details.providerCode, providerStatus: details.providerStatus }),
    );
  };

  if (provider === "OpenRouter") {
    const key = await deps.getSetting(db, env, "OPENROUTER_API_KEY");
    if (!key) return "";
    const endpoint = "https://openrouter.ai/api/v1/chat/completions";
    const apiRes = await fetchProvider(endpoint, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ model: modelName, response_format: { type: "json_object" }, messages: [{ role: "system", content: systemMsg }, { role: "user", content: userMsg }] }),
    });
    if (!apiRes.ok) await readApiError(apiRes, endpoint);
    const aiJson = await apiRes.json() as { choices?: Array<{ message?: { content?: string } }> };
    return aiJson.choices?.[0]?.message?.content || "";
  }

  if (provider === "OpenAI") {
    const key = await deps.getSetting(db, env, "OPENAI_API_KEY");
    if (!key) return "";
    const endpoint = "https://api.openai.com/v1/chat/completions";
    const apiRes = await fetchProvider(endpoint, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ model: modelName, response_format: { type: "json_object" }, messages: [{ role: "system", content: systemMsg }, { role: "user", content: userMsg }] }),
    });
    if (!apiRes.ok) await readApiError(apiRes, endpoint);
    const aiJson = await apiRes.json() as { choices?: Array<{ message?: { content?: string } }> };
    return aiJson.choices?.[0]?.message?.content || "";
  }

  if (provider === "Gemini") {
    const key = await deps.getSetting(db, env, "GEMINI_API_KEY");
    if (!key) return "";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;
    const apiRes = await fetchProvider(`${endpoint}?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ system_instruction: { parts: [{ text: systemMsg }] }, contents: [{ parts: [{ text: userMsg }] }], generationConfig: { responseMimeType: "application/json" } }),
    });
    if (!apiRes.ok) await readApiError(apiRes, endpoint);
    const aiJson = await apiRes.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    return aiJson.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }

  if (provider === "KIE") {
    const key = await deps.getSetting(db, env, "KIE_API_KEY");
    if (!key) return "";
    const config = deps.kieModelConfigs[modelName];
    if (!config) return "";
    if (config.mode === "responses") {
      const apiRes = await fetchProvider(config.endpoint, {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({ model: config.model, stream: false, input: [{ role: "user", content: [{ type: "input_text", text: `${systemMsg}\n\n${userMsg}` }] }], reasoning: { effort: "low" } }),
      });
      if (!apiRes.ok) await readApiError(apiRes, config.endpoint);
      const aiJson = await apiRes.json() as { output?: Array<{ content?: Array<{ text?: string }> }> };
      return aiJson.output?.flatMap((item) => item.content || []).map((item) => item.text || "").join("\n") || "";
    }
    const apiRes = await fetchProvider(config.endpoint, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "system", content: systemMsg }, { role: "user", content: userMsg }], stream: false, reasoning_effort: "low" }),
    });
    if (!apiRes.ok) await readApiError(apiRes, config.endpoint);
    const aiJson = await apiRes.json() as { choices?: Array<{ message?: { content?: string } }> };
    return aiJson.choices?.[0]?.message?.content || "";
  }

  if (provider === "Opencode") {
    const key = await deps.getSetting(db, env, "OPENCODE_API_KEY");
    const endpoint = await deps.getSetting(db, env, "OPENCODE_BASE_URL") || "https://api.opencode.example.com/v1/chat/completions";
    if (!key) return "";
    const apiRes = await fetchProvider(endpoint, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ model: modelName, response_format: { type: "json_object" }, messages: [{ role: "system", content: systemMsg }, { role: "user", content: userMsg }] }),
    });
    if (!apiRes.ok) await readApiError(apiRes, endpoint);
    const aiJson = await apiRes.json() as { choices?: Array<{ message?: { content?: string } }> };
    return aiJson.choices?.[0]?.message?.content || "";
  }

  return "";
}

async function parseAiJsonObjectWithOneRepair(deps: AiSiteGenerationDeps, input: {
  db: D1DatabaseLike;
  env: EnvLike;
  provider: string;
  model: string;
  systemMsg: string;
  userMsg: string;
  contextLabel: string;
}) {
  const firstRaw = await callAiJsonObjectProvider(deps, input);
  const firstCleaned = firstRaw.replace(/```json/g, "").replace(/```/g, "").trim();
  try {
    return {
      parsed: JSON.parse(firstCleaned) as Record<string, unknown>,
      raw: firstCleaned,
      repairAttempted: false,
      repairError: "",
    };
  } catch (error) {
    const repairError = error instanceof Error ? error.message : String(error);
    const repairUserMsg =
      `${input.userMsg}\n\nThe previous response was invalid JSON and could not be parsed.\n` +
      `Parse error: ${repairError}\n` +
      `Invalid response snippet: ${firstCleaned.slice(0, 1400)}\n\n` +
      "Return the corrected JSON object only. Do not explain. Do not use markdown. Do not add keys outside the schema.";
    const repairedRaw = await callAiJsonObjectProvider(deps, { ...input, userMsg: repairUserMsg, contextLabel: `${input.contextLabel} JSON repair` });
    const repairedCleaned = repairedRaw.replace(/```json/g, "").replace(/```/g, "").trim();
    return {
      parsed: JSON.parse(repairedCleaned) as Record<string, unknown>,
      raw: repairedCleaned,
      repairAttempted: true,
      repairError,
    };
  }
}

export async function generateAiOfferingOutline(
  deps: AiSiteGenerationDeps,
  db: D1DatabaseLike,
  env: EnvLike,
  body: Record<string, unknown>,
  siteJson: Record<string, unknown>,
  originData: unknown,
  businessName: string,
): Promise<{ outline: Record<string, unknown>; outlineHash: string; repairAttempted?: boolean; repairError?: string } | null> {
  const provider = asString(body.provider);
  const model = asString(body.model);
  const requireAi = body.requireAi === true;
  if (!provider || !model) return null;

  const readiness = await deps.getAiReadiness(db, env, provider, model, requireAi, requireAi);
  if (!readiness.ready) {
    if (requireAi) {
      const error = new Error(readiness.message || "AI provider/model is not ready.");
      (error as Error & { aiReadiness?: unknown }).aiReadiness = readiness;
      throw error;
    }
    return null;
  }

  const facts = businessFactsForAiCopy(originData, siteJson, businessName);
  const existingOfferings = currentOfferingRecords(siteJson).map((item) => ({
    id: asString(item.id),
    type: asString(item.type),
    title: safeCopyText(item.title, 90),
    summary: safeCopyText(item.summary || item.description, 220),
  })).slice(0, 8);
  const outlineBrief = {
    facts,
    existingOfferings,
    instruction: "Infer the best high-intent services/products for the website from the business name, niche, categories, search query, address, and review themes. Google Business Profile may be incomplete, so infer plausible buyer-intent offerings, but do not invent certifications, years in business, exact prices, warranties, staff size, equipment, brand partnerships, or completed projects.",
  };
  const schema = {
    strategy: {
      mode: "services | products | both",
      navbarGroupLabel: "Services, Products, or Products & Services",
      reasoning: "One sentence explaining why these offerings fit verified facts and the niche.",
    },
    offerings: [{
      type: "service | product",
      title: "Distinct Title Case high-intent offering customers search for",
      navLabel: "Short 1-3 word submenu label, max 24 chars",
      customerIntent: "The exact customer problem or buying situation this offering addresses.",
      summary: "One complete sentence, specific and non-thin.",
      description: "Two complete sentences explaining problem, solution, and result without unsupported claims.",
      priceHint: "Contact for estimate | Ask for current price | Contact for availability",
      bestFor: ["3-5 specific customer use cases"],
      included: ["3-6 plausible steps/deliverables"],
      highlights: [{ title: "Benefit", description: "Why it matters" }],
      relatedReviewKeywords: ["short keyword"],
    }],
  };
  const systemMsg =
    "You create a compact service/product outline for a local business website. Return only valid JSON matching this schema, with no markdown and no extra keys:\n" +
    `${JSON.stringify(schema)}\n\n` +
    "Rules: create 4-12 offerings unless the niche clearly needs fewer. Use the customer's likely search intent, not generic labels like Consultation unless it is truly the service. " +
    "For every offering, include navLabel as a short submenu label that fits a dropdown; use 1-3 words, not the full page title. " +
    "Use verified facts for identity, location, rating, reviews, and phone. Use conservative industry knowledge only for common problems/outcomes in the niche. " +
    "Every title must be distinct, specific, and plausible for the business category. Do not create pages, hrefs, IDs, images, JSON site sections, CSS, or navigation. " +
    "For US businesses write English. For Indonesian businesses write Indonesian. Plain text only.";
  const userMsg = `Business Name: ${businessName}\nOutline brief:\n${JSON.stringify(outlineBrief)}\n\nReturn only the outline JSON.`;

  const parsedOutline = await parseAiJsonObjectWithOneRepair(deps, {
    db,
    env,
    provider,
    model,
    systemMsg,
    userMsg,
    contextLabel: "offering outline",
  });
  return {
    outline: parsedOutline.parsed,
    outlineHash: await sha256Json(parsedOutline.parsed),
    repairAttempted: parsedOutline.repairAttempted,
    repairError: parsedOutline.repairError,
  };
}

export async function generateAiCopyPatch(
  deps: AiSiteGenerationDeps,
  db: D1DatabaseLike,
  env: EnvLike,
  body: Record<string, unknown>,
  siteJsonOverride?: Record<string, unknown>,
): Promise<{ patch: Record<string, unknown>; copyBriefHash: string; copyPatchHash: string } | null> {
  const provider = asString(body.provider);
  const model = asString(body.model);
  const openRouterModel = model.trim();
  const requireAi = body.requireAi === true;
  const businessName = asString(body.businessName);
  const originData = body.originData || {};
  const copyPatchFocus = asString(body.copyPatchFocus, "site");
  const copyPatchOfferingIndexValue = Number(body.copyPatchOfferingIndex);
  const copyPatchOfferingIndex = Number.isFinite(copyPatchOfferingIndexValue) && copyPatchOfferingIndexValue >= 0
    ? Math.floor(copyPatchOfferingIndexValue)
    : undefined;
  const copyPatchOfferingBatchSizeValue = Number(body.copyPatchOfferingBatchSize);
  const copyPatchOfferingBatchSize = Number.isFinite(copyPatchOfferingBatchSizeValue) && copyPatchOfferingBatchSizeValue > 0
    ? Math.max(1, Math.min(4, Math.floor(copyPatchOfferingBatchSizeValue)))
    : 1;
  const copyPatchOfferingTotal = Number(body.copyPatchOfferingTotal);
  const submittedJson = siteJsonOverride || (body.jsonContent && typeof body.jsonContent === "object" && !Array.isArray(body.jsonContent)
    ? body.jsonContent as Record<string, unknown>
    : null);
  const copyTargetBrief = buildAiCopyTargetBrief(submittedJson || {}, originData, businessName, { focus: copyPatchFocus, offeringIndex: copyPatchOfferingIndex, offeringBatchSize: copyPatchOfferingBatchSize });

  if (!provider || !model) {
    if (requireAi) {
      throw new Error("AI provider and model are required for this generate action.");
    }
    return null;
  }

  const readiness = await deps.getAiReadiness(db, env, provider, model, requireAi, requireAi);
  if (!readiness.ready) {
    if (requireAi) {
      const error = new Error(readiness.message || "AI provider/model is not ready.");
      (error as Error & { aiReadiness?: unknown }).aiReadiness = readiness;
      throw error;
    }
    return null;
  }

  const missingKey = (label: string) => {
    if (requireAi) {
      throw new Error(`${label} API key is not configured. Set it in /admin/settings first.`);
    }
    return null;
  };

  const throwWithAiFailure = (message: string, diagnostics: unknown) => {
    const error = new Error(message);
    (error as Error & { aiFailure?: unknown }).aiFailure = diagnostics;
    throw error;
  };

  const fetchAiProvider = async (providerName: string, endpoint: string, init: RequestInit) => {
    try {
      return await fetch(endpoint, init);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throwWithAiFailure(
        `${providerName} network call failed (${model} via ${endpoint}): ${message}`,
        deps.buildAiFailureDiagnostics({
          provider: providerName,
          model,
          endpoint,
          stage: "provider_network",
          message,
          rawSnippet: message,
        }),
      );
    }
  };

  const apiError = async (providerName: string, response: Response, context = "", endpoint = "") => {
    const text = await response.text().catch(() => "");
    const details = deps.extractProviderErrorDetails(text);
    const message = details.message.slice(0, 600);
    const finalMessage = `${providerName} API returned HTTP ${response.status}${context ? ` (${context})` : ""}${message ? `: ${message}` : ""}`;
    if (requireAi) {
      throwWithAiFailure(
        finalMessage,
        deps.buildAiFailureDiagnostics({
          provider: providerName,
          model,
          endpoint: endpoint || (context.startsWith("http") ? context : ""),
          stage: "provider_http",
          httpStatus: response.status,
          message,
          rawSnippet: details.rawSnippet,
          providerCode: details.providerCode,
          providerStatus: details.providerStatus,
        }),
      );
    }
    console.error(finalMessage);
    return null;
  };

  const siteCopyPatchSchema = {
    metaCopy: {
      seoTitle: "Specific local SEO title, max 70 chars.",
      seoDescription: "Specific description using verified data, max 155 chars.",
      shortPitch: "One beefy but truthful pitch paragraph.",
      cityLandingPhrase: "Local service phrase.",
    },
    hero: {
      headline: "Strong client-facing headline focused on the real service outcome.",
      subheadline: "Specific 2-3 complete-sentence paragraph using business name, category, location, rating/reviews, phone, verified strengths, and the actual customer problems this industry solves. Do not end mid-sentence.",
      buttons: [{ text: "CTA text only. Do not provide href." }],
    },
    sections: {
      "section-id-from-scaffold": {
        title: "Improved title.",
        description: "Improved supporting copy.",
        items: [{ title: "Item title", description: "Item description" }],
      },
    },
    offers: [{ title: "Offer title", description: "Offer description", priceHint: "Contact for estimate" }],
    offerings: [{
      id: "existing product/service id from scaffold",
      title: "Title Case offering name",
      navLabel: "Short 1-3 word submenu label, max 24 chars.",
      summary: "Specific non-thin summary focused on a real customer need.",
      description: "Longer service/product copy explaining problem, solution, and result.",
      priceHint: "Contact for estimate",
      bestFor: ["specific use case"],
      included: ["specific deliverable"],
      highlights: [{ title: "Benefit", description: "Why it matters" }],
      relatedReviewKeywords: ["keyword"],
      hero: { headline: "Detail page headline", subheadline: "Detail page subheadline in complete sentences", buttons: [{ text: "CTA text" }] },
      features: { title: "Feature section title", items: [{ title: "Feature", description: "Feature detail" }] },
      faqTitle: "FAQ title",
      faq: [{ question: "Question", answer: "Answer" }],
    }],
    faqTitle: "Home FAQ title",
    faq: [{ question: "Question", answer: "Answer" }],
    conversion: {
      headerCtaText: "Short CTA",
      primaryCtaText: "Primary CTA",
      secondaryCtaText: "Secondary CTA",
    },
    footer: { text: "Copyright/footer line only." },
  };
  const offeringCopyPatchSchema = {
    sections: {
      "detail-section-id-from-brief": {
        title: "Improved detail page title.",
        description: "Improved detail page supporting copy.",
        items: [{ title: "Item title", description: "Item description" }],
      },
    },
    offerings: [{
      id: "existing product/service id from brief",
      title: "Title Case offering name",
      navLabel: "Short 1-3 word submenu label, max 24 chars.",
      summary: "Specific non-thin summary focused on a real customer need.",
      description: "Longer service/product copy explaining problem, solution, and result.",
      priceHint: "Contact for estimate",
      bestFor: ["specific use case"],
      included: ["specific deliverable"],
      highlights: [{ title: "Benefit", description: "Why it matters" }],
      relatedReviewKeywords: ["keyword"],
      hero: { headline: "Detail page headline", subheadline: "Detail page subheadline in complete sentences", buttons: [{ text: "CTA text" }] },
      features: { title: "Feature section title", items: [{ title: "Feature", description: "Feature detail" }] },
      faqTitle: "FAQ title",
      faq: [{ question: "Question", answer: "Answer" }],
    }],
  };
  const navLabelCopyPatchSchema = {
    offerings: [{
      id: "existing product/service id from brief",
      title: "Existing title, unchanged unless it is clearly malformed.",
      navLabel: "Short 1-3 word submenu label, max 24 chars.",
    }],
  };
  const copyPatchSchema = copyPatchFocus === "offerings"
    ? offeringCopyPatchSchema
    : copyPatchFocus === "navLabels"
      ? navLabelCopyPatchSchema
      : siteCopyPatchSchema;
  const offeringFocusInstruction = copyPatchFocus === "offerings"
    ? copyPatchOfferingIndex !== undefined
      ? copyPatchOfferingBatchSize === 1
        ? `Prioritize exactly one offering: item ${copyPatchOfferingIndex + 1}${Number.isFinite(copyPatchOfferingTotal) && copyPatchOfferingTotal > 0 ? ` of ${copyPatchOfferingTotal}` : ""}. Return one offerings[] item with that existing id, plus only its related detail page section patches. Do not spend output on homepage, meta, footer, or unrelated offerings. `
        : `Prioritize exactly ${copyPatchOfferingBatchSize} offerings starting at item ${copyPatchOfferingIndex + 1}${Number.isFinite(copyPatchOfferingTotal) && copyPatchOfferingTotal > 0 ? ` of ${copyPatchOfferingTotal}` : ""}. Return only those offerings[] items with their existing ids, plus only their related detail page section patches. Do not spend output on homepage, meta, footer, or unrelated offerings. `
      : "Prioritize the offerings array and service/product detail page section targets. Return beefy copy for every offering in the brief, including summary, description, bestFor, included, highlights, hero, features, and FAQ. Do not spend output on homepage-only copy unless it directly supports the offering patch. "
    : copyPatchFocus === "navLabels"
      ? "Prioritize only short submenu labels for the requested offering. Return exactly one offerings[] item with the existing id and navLabel. Do not return homepage, meta, footer, sections, descriptions, FAQ, or unrelated offerings. "
      : copyPatchFocus === "about"
        ? "Prioritize only the About page section targets in the brief. Return section patches for those About sections only. Do not return offerings, offers, homepage, meta, footer, or unrelated pages. "
    : "Prioritize homepage/meta/general site sections and keep offering records minimal unless a short offer card needs cleanup. The separate offering-copy chunk will handle service detail depth. ";
  const systemMsg =
    "You are a practical local-business copywriter. You DO NOT generate full website JSON. " +
    "You only return a small JSON copy patch matching this schema, with no markdown and no extra keys:\n" +
    `${JSON.stringify(copyPatchSchema)}\n\n` +
    `This request focus is "${copyPatchFocus}". ` +
    offeringFocusInstruction +
    "Critical rules: you are not given full website JSON, page IDs, navigation hrefs, image URLs, maps URLs, sourceData, palette, font, visual style, favicon, CSS, or storage fields. Do not mention or create them. " +
    "Use verified facts from the provided copy target brief for business identity, address, phone, rating, reviews, hours, status, and location. You may also use conservative industry knowledge to explain common customer problems and service outcomes for the business category, as long as you do not invent certifications, years in business, warranties, brand partnerships, equipment, staff size, exact prices, or completed projects. If a fact is missing, write honest copy like 'contact for availability' instead of inventing. " +
    "Voice rules: write as the business speaking to its potential customers, not as WebView, an admin, a demo builder, an auditor, Google, or a third-party report about the business. " +
    "Write nearly all public-facing paragraphs in first-person business-owner voice: 'we', 'our team', 'our customers', 'call us', 'we are based in', 'we help', and 'our on-site support'. Do not write detached third-person sentences like '{Business Name} is...', 'customers highlight...', 'reviewers mention...', or 'the team is noted for...' when they can be rewritten as business-owned claims. " +
    "Example rewrite style: instead of 'Customers specifically mention on-site support to direct trucks and manage pour timing', write 'Our customers specifically mention that our on-site support to direct trucks and manage pour timing helps the job stay organized.' " +
    "Use customer-facing phrasing like 'Call us', 'we help', 'our team', 'we are based in', and 'ask about availability' when it fits the facts. Avoid meta phrases such as 'the listed address', 'the business status in the brief', 'this page', 'the owner can replace this copy', 'Google profile expanded', 'website-ready', or 'no website detected'. " +
    "Use review themes as trust-building customer benefits, not as a detached report. Do not repeat rating/review count in every section; use it where it naturally helps trust. " +
    "Do not merely summarize the Google profile. Expand from the niche/business name into buyer-aware copy: identify the real problems customers are trying to solve, explain how the service helps, mention local conditions only when they are plausible from the city/region, and make the benefit clear. For example, concrete copy should discuss cracks, uneven surfaces, driveways, walkways, patios, garage floors, retaining walls, durability, safety, curb appeal, soil/weather stress, and long-lasting repair or installation outcomes when relevant. Apply this same reasoning to every niche. " +
    "For offers and offerings, infer likely service/product lines from the industry, business name, category, and existing scaffold titles. Replace generic scaffold names with distinct, high-intent services customers would search for. Keep every offering plausible for the business category and avoid duplicate services. " +
    "For each offering, also return navLabel: a short, natural submenu label that fits a narrow dropdown. Use 1-3 words, avoid repeating generic words like Services, and do not use the full detail-page headline. " +
    "Homepage feature sections should answer why a visitor should choose the business: experience/skill, local fit, materials/process quality, communication, reliability, safety, durability, convenience, and satisfaction. Use only claims that can be stated generally or supported by reviews/facts. " +
    "About-style or text-image copy should explain what the company helps customers accomplish, why the work matters in the local market, and how the team approaches quality, prevention, communication, and long-term value. " +
    "Make the copy much less templated: mention the actual business name, exact city/area when available, category/type, rating/review count when available, phone if available, operating status, hours if useful, and review themes if reviews exist. " +
    "For US businesses write English. For Indonesian businesses write Indonesian. If meta.language is explicit, follow it. Do not mix languages. " +
    (copyPatchFocus === "navLabels"
      ? "For navLabels requests, write only one compact label that fits a dropdown; prefer the distinctive noun phrase from the service title and keep it natural. "
      : copyPatchFocus === "about"
        ? "For About requests, write only the About page section copy requested in sectionTargets and keep it grounded in the verified business facts. "
        : "Every offering in an offering-focused request needs beefy copy: a specific title, summary, description, 3-5 bestFor items, 3-6 included items, 2-4 highlights, a detailed hero, 3 feature items, and 3-5 FAQ items. Make those details industry-specific instead of generic 'fast consultation' language. ") +
    "Keep titles in Title Case except small connector words like for, and, of, to, in. Return plain text only; no HTML; no markdown; no SVG.";
  const userMsg = `Business Name: ${businessName}
Copy target brief. This is not full website JSON and contains only facts plus editable copy targets:
${JSON.stringify(copyTargetBrief)}

Return only the copy patch JSON.`;

  let responseContent = "";

  if (provider === "OpenRouter") {
    const key = await deps.getSetting(db, env, "OPENROUTER_API_KEY");
    if (!key) return missingKey("OpenRouter");
    const apiRes = await fetchAiProvider("OpenRouter", "https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: openRouterModel,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemMsg },
          { role: "user", content: userMsg },
        ],
      }),
    });
    if (!apiRes.ok) return apiError("OpenRouter", apiRes, model, "https://openrouter.ai/api/v1/chat/completions");
    const aiJson = await apiRes.json() as { choices?: Array<{ message?: { content?: string } }> };
    responseContent = aiJson.choices?.[0]?.message?.content || "";
  } else if (provider === "OpenAI") {
    const key = await deps.getSetting(db, env, "OPENAI_API_KEY");
    if (!key) return missingKey("OpenAI");
    const apiRes = await fetchAiProvider("OpenAI", "https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemMsg },
          { role: "user", content: userMsg },
        ],
      }),
    });
    if (!apiRes.ok) return apiError("OpenAI", apiRes, model, "https://api.openai.com/v1/chat/completions");
    const aiJson = await apiRes.json() as { choices?: Array<{ message?: { content?: string } }> };
    responseContent = aiJson.choices?.[0]?.message?.content || "";
  } else if (provider === "Gemini") {
    const key = await deps.getSetting(db, env, "GEMINI_API_KEY");
    if (!key) return missingKey("Gemini");
    const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const apiRes = await fetchAiProvider("Gemini", `${geminiEndpoint}?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemMsg }] },
        contents: [{ parts: [{ text: userMsg }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    });
    if (!apiRes.ok) return apiError("Gemini", apiRes, geminiEndpoint, geminiEndpoint);
    const aiJson = await apiRes.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    responseContent = aiJson.candidates?.[0]?.content?.parts?.[0]?.text || "";
  } else if (provider === "KIE") {
    const key = await deps.getSetting(db, env, "KIE_API_KEY");
    if (!key) return missingKey("KIE.ai");

    const kieConfig = deps.kieModelConfigs[model];
    if (!kieConfig) {
      if (requireAi) throw new Error(`KIE.ai model is not configured for generation: ${model}.`);
      return null;
    }

    if (kieConfig.mode === "responses") {
      const apiRes = await fetchAiProvider("KIE.ai", kieConfig.endpoint, {
        method: "POST",
        headers: {
          authorization: `Bearer ${key}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: kieConfig.model,
          stream: false,
          input: [
            {
              role: "user",
              content: [
                { type: "input_text", text: `${systemMsg}\n\n${userMsg}` },
              ],
            },
          ],
          reasoning: { effort: "low" },
        }),
      });
      if (!apiRes.ok) return apiError("KIE.ai", apiRes, `${model} via ${kieConfig.endpoint}`, kieConfig.endpoint);
      const aiJson = await apiRes.json() as { output?: Array<{ content?: Array<{ text?: string }> }> };
      responseContent = aiJson.output
        ?.flatMap((item) => item.content || [])
        .map((item) => item.text || "")
        .join("\n") || "";
    } else {
      const apiRes = await fetchAiProvider("KIE.ai", kieConfig.endpoint, {
        method: "POST",
        headers: {
          authorization: `Bearer ${key}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemMsg },
            { role: "user", content: userMsg },
          ],
          stream: false,
          reasoning_effort: "low",
        }),
      });
      if (!apiRes.ok) return apiError("KIE.ai", apiRes, `${model} via ${kieConfig.endpoint}`, kieConfig.endpoint);
      const aiJson = await apiRes.json() as { choices?: Array<{ message?: { content?: string } }> };
      responseContent = aiJson.choices?.[0]?.message?.content || "";
    }
  } else if (provider === "Opencode") {
    const key = await deps.getSetting(db, env, "OPENCODE_API_KEY");
    const endpoint = await deps.getSetting(db, env, "OPENCODE_BASE_URL") || "https://api.opencode.example.com/v1/chat/completions";
    if (!key) return missingKey("Opencode");
    const apiRes = await fetchAiProvider("Opencode", endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemMsg },
          { role: "user", content: userMsg },
        ],
      }),
    });
    if (!apiRes.ok) return apiError("Opencode", apiRes, model, endpoint);
    const aiJson = await apiRes.json() as { choices?: Array<{ message?: { content?: string } }> };
    responseContent = aiJson.choices?.[0]?.message?.content || "";
  } else if (requireAi) {
    throw new Error(`Unsupported AI provider: ${provider}`);
  }

  if (!responseContent) {
    if (requireAi) {
      throwWithAiFailure(
        `${provider} did not return JSON content for model ${model}.`,
        deps.buildAiFailureDiagnostics({
          provider,
          model,
          stage: "provider_empty_response",
          message: `${provider} returned an empty response body or no recognized content field for ${model}.`,
        }),
      );
    }
    return null;
  }

  const cleaned = responseContent.replace(/```json/g, "").replace(/```/g, "").trim();
  try {
    const patch = JSON.parse(cleaned) as Record<string, unknown>;
    return {
      patch,
      copyBriefHash: await sha256Json(copyTargetBrief),
      copyPatchHash: await sha256Json(patch),
    };
  } catch (error) {
    if (requireAi) {
      const message = `${provider} returned invalid JSON for model ${model}: ${error instanceof Error ? error.message : String(error)}`;
      throwWithAiFailure(
        message,
        deps.buildAiFailureDiagnostics({
          provider,
          model,
          stage: "provider_invalid_json",
          message,
          rawSnippet: cleaned.slice(0, 600),
        }),
      );
    }
    throw error;
  }
}


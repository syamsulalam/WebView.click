import assert from "node:assert/strict";
import test from "node:test";
import {
  applyAiCopyPatch,
  applyAiOfferingOutline,
  buildAiCopyAudit,
  buildAiCopyTargetBrief,
  collectAiCopyAuditTargets,
} from "../functions/api/ai/siteGeneration";

function baseSite() {
  return {
    meta: { businessName: "Metro Concrete Repair", language: "en", seoTitle: "" },
    businessProfile: {
      name: "Metro Concrete Repair",
      shortPitch: "Old pitch.",
      contact: { phoneNational: "+1 555-0100" },
      address: { formatted: "100 Main St, Dallas, TX" },
    },
    seo: { cityLandingPhrase: "" },
    location: { formattedAddress: "100 Main St, Dallas, TX" },
    productServiceStrategy: {},
    navigation: {
      headerMenu: [
        { label: "Home", href: "#home" },
        { label: "Services", href: "#services", children: [{ label: "Old Service", href: "#service-old" }] },
        { label: "Contact", href: "#contact" },
      ],
    },
    services: [{ id: "old", type: "service", title: "Old Service", detailPageId: "service-old", summary: "Old summary." }],
    products: [],
    offers: [],
    pages: [
      {
        pageId: "home",
        sections: [
          { type: "hero", id: "home-hero", content: { headline: "Old headline", subheadline: "Old subheadline", buttons: [{ text: "Call Now", href: "#contact" }] } },
          { type: "offers", id: "home-offers", content: { title: "Services", items: [] } },
        ],
      },
      { pageId: "services", sections: [{ type: "offers", id: "services-list", content: { items: [] } }] },
      { pageId: "service-old", sections: [{ type: "hero", id: "old-hero", content: { headline: "Old Service" } }] },
      { pageId: "contact", sections: [] },
    ],
  } as Record<string, unknown>;
}

test("applyAiOfferingOutline normalizes offerings and rebuilds detail pages/navigation deterministically", () => {
  const site = baseSite();
  const outline = {
    offerings: Array.from({ length: 14 }, (_, index) => ({
      id: index < 2 ? "duplicate-id" : `service-${index}`,
      type: index === 2 ? "product" : "service",
      title: index < 2 ? "Driveway Crack Repair" : `Concrete Service ${index + 1}`,
      summary: `Specific summary ${index + 1}.`,
      description: `Specific description ${index + 1} explaining problem, solution, and result.`,
      priceHint: "Contact for estimate",
      bestFor: ["Driveways", "Walkways", "Patios"],
      included: ["Inspect surface", "Prepare area", "Complete repair"],
      highlights: [{ title: "Durable finish", description: "Built for everyday use." }],
      relatedReviewKeywords: ["repair"],
    })),
  };

  const result = applyAiOfferingOutline(site, outline);

  assert.deepEqual(result, { applied: true, count: 12 });
  assert.equal(((site.services as any[]) || []).length, 11);
  assert.equal(((site.products as any[]) || []).length, 1);
  assert.equal((site.offers as any[]).length, 12);

  const pages = site.pages as Array<Record<string, unknown>>;
  const pageIds = pages.map((page) => page.pageId);
  assert.equal(pageIds.includes("services"), false);
  assert.equal(pageIds.includes("service-old"), false);
  assert.equal(pageIds.filter((pageId) => pageId.startsWith("service-") || pageId.startsWith("product-")).length, 12);

  const navServices = (site.navigation as any).headerMenu.find((item: any) => item.href === "#services");
  assert.equal(navServices.label, "Products & Services");
  assert.equal(navServices.children.length, 12);
  assert.equal(new Set(navServices.children.map((item: any) => item.href)).size, 12);

  const homeOffers = ((pages.find((page) => page.pageId === "home") as any).sections as any[]).find((section) => section.type === "offers");
  assert.equal(homeOffers.content.items.length, 12);
  assert.equal((site.services as any[])[0].id, "duplicate-id");
  assert.equal((site.services as any[])[1].id, "duplicate-id-2");
});

test("applyAiCopyPatch updates editable copy and buildAiCopyAudit classifies rewritten and filled fields", () => {
  const site = baseSite();
  applyAiOfferingOutline(site, {
    offerings: [{
      type: "service",
      title: "Driveway Crack Repair",
      summary: "Repair visible cracks before they spread.",
      description: "We repair driveway cracks and surface wear with practical preparation and clear next steps.",
      bestFor: ["Cracked driveways"],
      included: ["Inspect cracks", "Prepare surface", "Repair damage"],
      highlights: [{ title: "Cleaner surface", description: "Helps improve curb appeal." }],
    }],
  });

  const targets = collectAiCopyAuditTargets(site);
  applyAiCopyPatch(site, {
    metaCopy: {
      seoTitle: "Driveway Crack Repair in Dallas",
      shortPitch: "We help Dallas property owners repair concrete cracks with practical scheduling and clear communication.",
      cityLandingPhrase: "Dallas concrete crack repair",
    },
    hero: {
      headline: "Concrete Repair That Keeps Your Driveway Safer",
      subheadline: "We help Dallas homeowners handle cracks, surface wear, and uneven concrete before small problems become harder to manage.",
      buttons: [{ text: "Call for Repair" }],
    },
    offerings: [{
      id: "driveway-crack-repair",
      title: "Driveway Crack Repair",
      summary: "We repair visible driveway cracks with a practical plan for safer daily use.",
      description: "Our driveway crack repair copy explains the customer problem, the repair approach, and the expected next step without inventing unsupported claims.",
      bestFor: ["Driveway cracks", "Surface wear"],
      included: ["Review crack pattern", "Prepare repair area", "Discuss next steps"],
      highlights: [{ title: "Practical repair plan", description: "Customers understand what happens next." }],
      hero: {
        headline: "Driveway Crack Repair for Dallas Properties",
        subheadline: "We help customers address cracks and surface wear with clear repair conversations.",
        buttons: [{ text: "Ask About Repair" }],
      },
      features: {
        title: "How We Help",
        items: [{ title: "Surface review", description: "We look at visible damage and discuss repair fit." }],
      },
      faqTitle: "Driveway Crack Repair Questions",
      faq: [{ question: "Can I ask about a small crack?", answer: "Yes. Call with the location, size, and timing you have in mind." }],
    }],
  });

  const audit = buildAiCopyAudit(targets, site, true);
  const summary = audit.summary;
  const items = audit.items as Array<{ path: string; status: string; before: string; after: string }>;

  assert.ok(summary.aiRewritten > 0);
  assert.ok(summary.aiFilledBlank > 0);
  assert.ok(items.some((item) => item.path === "meta.seoTitle" && item.status === "ai_filled_blank"));
  assert.ok(items.some((item) => item.path.endsWith("content.headline") && item.status === "ai_rewritten"));
  assert.equal((site.meta as any).seoTitle, "Driveway Crack Repair in Dallas");
  assert.equal((site.businessProfile as any).shortPitch, "We help Dallas property owners repair concrete cracks with practical scheduling and clear communication.");
  assert.equal((site.services as any[])[0].summary, "We repair visible driveway cracks with a practical plan for safer daily use.");
});

function richOriginFixture() {
  return {
    editorialSummary: { overview: "Family-run shop pouring driveways across Dallas County." },
    generativeSummary: { overview: "Known for quick scheduling and tidy job sites." },
    reviewSummary: { text: { text: "Reviewers praise punctual arrivals." } },
    neighborhoodSummary: "Oak Lawn",
    priceLevel: "PRICE_LEVEL_MODERATE",
    priceRange: { startPrice: { units: "25", currencyCode: "USD" }, endPrice: { units: "400", currencyCode: "USD" } },
    servesCoffee: true,
    serves_breakfast: true,
    outdoorSeating: true,
    paymentOptions: ["Credit cards", "Cash"],
    parkingOptions: { freeParkingLot: true, paidParkingLot: false },
    timeZone: "America/Chicago",
    currentOpeningHours: { openNow: true, weekdayDescriptions: ["Monday: 8:00 AM - 5:00 PM"] },
    regularSecondaryOpeningHours: [{ type: "Drive-through", weekdayDescriptions: ["Saturday: 9:00 AM - 1:00 PM"] }],
    photos: [
      { photo_reference: "ref-1", html_attributions: ["<a href='x'>Google User</a>"] },
      { name: "ref-2" },
      { reference: "ref-3" },
      { photo_reference: "ref-4" },
    ],
    plus_code: { global_code: "8655V2 Dallas" },
  } as Record<string, unknown>;
}

test("buildAiCopyTargetBrief grounds facts in rich Places data across casings (B1)", () => {
  const brief = buildAiCopyTargetBrief(baseSite(), richOriginFixture(), "Metro Concrete Repair");
  const facts = brief.facts as any;
  const surfaced = [
    facts.summaries.editorial.includes("Family-run"),
    facts.summaries.generative.includes("tidy job sites"),
    facts.summaries.review.includes("punctual"),
    facts.summaries.neighborhood === "Oak Lawn",
    facts.price.level === "Moderate",
    facts.price.range.includes("25") && facts.price.range.includes("400"),
    facts.amenities.includes("Coffee") && facts.amenities.includes("Breakfast") && facts.amenities.includes("Outdoor seating"),
    facts.amenities.some((item: string) => item.includes("Credit cards")),
    facts.amenities.some((item: string) => item.includes("Free parking lot")),
    facts.hoursDetail.timezone === "America/Chicago",
    facts.hoursDetail.openNow === true,
    facts.hoursDetail.secondary.some((item: string) => item.includes("Drive-through")),
    facts.hoursDetail.current.some((item: string) => item.includes("Monday")),
    facts.photos.length === 4 && facts.photos[0].reference === "ref-1" && facts.photos[0].attributions[0] === "Google User",
    facts.plusCode.includes("8655V2"),
    !facts.amenities.includes("Takeout"),
  ];
  const hitCount = surfaced.filter(Boolean).length;
  assert.ok(hitCount >= Math.ceil(surfaced.length * 0.8), `B1 grounding surfaced ${hitCount}/${surfaced.length} rich fields`);
});

test("buildAiCopyTargetBrief exposes a structural-only render context (B2)", () => {
  const site = baseSite();
  ((site.pages as any[])[0].sections[0].content as any).image = "hero.jpg";
  const brief = buildAiCopyTargetBrief(site, {}, "Metro Concrete Repair");
  const renderContext = brief.renderContext as any;
  assert.equal(renderContext.pages[0].pageId, "home");
  assert.deepEqual(
    renderContext.pages[0].sections.map((section: any) => `${section.type}:${section.hasImage ? "img" : "noimg"}`),
    ["hero:img", "offers:noimg"],
  );
  assert.equal(renderContext.presence.offers, true);
  assert.equal(renderContext.presence.gallery, false);
  const keys = new Set<string>();
  const walk = (value: unknown) => {
    if (Array.isArray(value)) return value.forEach(walk);
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      keys.add(key);
      walk(child);
    }
  };
  walk(renderContext);
  for (const forbidden of ["href", "image", "images", "imageUrl", "mapsUrl", "sourceData", "palette", "font", "css", "storage", "url", "reference"]) {
    assert.ok(!keys.has(forbidden), `renderContext must not leak ${forbidden}`);
  }
});

test("applyAiCopyPatch ignores structural echoes from render context (B2 enforcement)", () => {
  const site = baseSite();
  const beforeIds = (site.pages as any[]).map((page) => page.pageId);
  applyAiCopyPatch(site, {
    hero: { headline: "Patched headline" },
    renderContext: { pages: [{ pageId: "evil", sections: [] }] },
    sections: { "non-existent": { title: "Nowhere" } },
  } as Record<string, unknown>);
  assert.deepEqual((site.pages as any[]).map((page) => page.pageId), beforeIds);
  assert.equal((((site.pages as any[])[0].sections as any[])[0].content as any).headline, "Patched headline");
});

test("copy brief carries the saved price positioning cue for grounded pricing copy (B5)", () => {
  const site = baseSite();
  (site.businessProfile as any).pricePositioning = "Moderate · 25–400 USD";
  const brief = buildAiCopyTargetBrief(site, {}, "Metro Concrete Repair");
  assert.equal((brief.facts as any).price.positioning, "Moderate · 25–400 USD");
});

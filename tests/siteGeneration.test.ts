import assert from "node:assert/strict";
import test from "node:test";
import {
  applyAiCopyPatch,
  applyAiOfferingOutline,
  buildAiCopyAudit,
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

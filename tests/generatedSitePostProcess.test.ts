import assert from "node:assert/strict";
import test from "node:test";
import {
  applyGeneratedSitePageInserts,
  collectGalleryImages,
  ensureContactPage,
  ensureConversionMetadata,
  ensureFeedbackPage,
  ensureGalleryPage,
  ensureServicesPage,
  findContactSourceSection,
  repairServiceCardImages,
} from "../src/lib/generatedSitePostProcess";

test("ensureContactPage creates a dedicated contact page from existing contact-like section", () => {
  const site: Record<string, unknown> = {
    meta: { language: "en" },
    businessProfile: { contact: { phoneNational: "+1 555-0100" } },
    location: { formattedAddress: "100 Main St, Dallas, TX" },
    hours: {
      regular: [
        "Monday: 6:00 AM - 11:00 PM",
        "Tuesday: 6:00 AM - 11:00 PM",
        "Wednesday: 6:00 AM - 11:00 PM",
        "Thursday: 6:00 AM - 11:00 PM",
        "Friday: 6:00 AM - 11:00 PM",
        "Saturday: 6:00 AM - 11:00 PM",
        "Sunday: 6:00 AM - 11:00 PM",
      ],
    },
    navigation: { headerMenu: [{ label: "Home", href: "#home" }] },
    pages: [
      {
        pageId: "home",
        sections: [
          {
            type: "hoursLocation",
            id: "location-1",
            content: {
              title: "Location & Contact",
              address: "200 Contact Ave, Dallas, TX",
              phone: "+1 555-0123",
            },
          },
        ],
      },
    ],
  };

  ensureContactPage(site, { url: "https://maps.example/listing" });

  const pages = site.pages as Array<Record<string, unknown>>;
  const contactPage = pages.find((page) => page.pageId === "contact");
  assert.ok(contactPage);
  const section = (contactPage.sections as Array<Record<string, unknown>>)[0];
  const content = section.content as Record<string, unknown>;
  assert.equal(section.type, "contactForm");
  assert.equal(content.address, "200 Contact Ave, Dallas, TX");
  assert.equal(content.phone, "+1 555-0123");
  assert.equal(content.directionsUrl, "https://maps.example/listing");
  assert.deepEqual(content.openingHours, ["Daily: 6:00 AM - 11:00 PM"]);
  assert.deepEqual((site.navigation as any).headerMenu.at(-1), { label: "Contact", href: "#contact" });
});

test("ensureContactPage localizes and compacts existing contact form hours", () => {
  const site: Record<string, unknown> = {
    meta: { language: "id" },
    hours: {
      regular: [
        "Monday: 6:00 AM - 11:00 PM",
        "Tuesday: 6:00 AM - 11:00 PM",
        "Wednesday: 6:00 AM - 11:00 PM",
        "Thursday: 6:00 AM - 11:00 PM",
        "Friday: 6:00 AM - 11:00 PM",
        "Saturday: 6:00 AM - 11:00 PM",
        "Sunday: Closed",
      ],
    },
    pages: [{ pageId: "contact", sections: [{ type: "contactForm", id: "contact", content: {} }] }],
  };

  ensureContactPage(site, {});

  const contactPage = (site.pages as Array<Record<string, unknown>>).find((page) => page.pageId === "contact");
  const section = (contactPage?.sections as Array<Record<string, unknown>>)[0];
  const content = section.content as Record<string, unknown>;
  assert.equal(content.title, "Hubungi Kami");
  assert.deepEqual(content.openingHours, ["Sen-Sab: 6:00 AM - 11:00 PM", "Minggu: Tutup"]);
});

test("ensureContactPage does not duplicate an existing contact page but still adds nav", () => {
  const site: Record<string, unknown> = {
    meta: { language: "id" },
    navigation: { headerMenu: [{ label: "Beranda", href: "#home" }] },
    pages: [{ pageId: "contact", sections: [{ type: "contactForm", id: "contact", content: {} }] }],
  };

  ensureContactPage(site, {});

  const pages = site.pages as Array<Record<string, unknown>>;
  assert.equal(pages.filter((page) => page.pageId === "contact").length, 1);
  assert.deepEqual((site.navigation as any).headerMenu.at(-1), { label: "Kontak", href: "#contact" });
});

test("findContactSourceSection prefers existing contact forms", () => {
  const site = {
    pages: [
      { pageId: "home", sections: [{ type: "hoursLocation", id: "contact", content: { title: "Location & Contact" } }] },
      { pageId: "contact-old", sections: [{ type: "contactForm", id: "contact-form", content: { title: "Write Us" } }] },
    ],
  };

  const found = findContactSourceSection(site);
  assert.equal(found?.type, "contactForm");
  assert.equal((found?.content as any).title, "Write Us");
});

test("ensureGalleryPage creates gallery from deduped brand, offer, and Places images", () => {
  const site: Record<string, unknown> = {
    meta: { language: "en" },
    brand: { preferredHeroImage: "/hero.jpg", logoImageUrl: "/hero.jpg" },
    offers: [{ image: "/offer.jpg" }],
    navigation: { headerMenu: [{ label: "Home", href: "#home" }, { label: "Contact", href: "#contact" }] },
    pages: [{ pageId: "home", sections: [] }],
  };
  const originData = {
    photos: [
      { photo_reference: "abc 123" },
      { reference: "xyz" },
    ],
  };

  assert.deepEqual(collectGalleryImages(site, originData), [
    "/hero.jpg",
    "/offer.jpg",
    "/api/places/photo?reference=abc%20123&maxwidth=960",
    "/api/places/photo?reference=xyz&maxwidth=960",
  ]);

  ensureGalleryPage(site, originData);

  const pages = site.pages as Array<Record<string, unknown>>;
  const galleryPage = pages.find((page) => page.pageId === "gallery");
  assert.ok(galleryPage);
  const headerMenu = (site.navigation as any).headerMenu;
  assert.equal(headerMenu.findIndex((item: any) => item.href === "#gallery"), 1);
  assert.equal(headerMenu.findIndex((item: any) => item.href === "#contact"), 2);
});

test("ensureGalleryPage skips gallery when fewer than two images are available", () => {
  const site: Record<string, unknown> = {
    brand: { preferredHeroImage: "/hero.jpg" },
    pages: [{ pageId: "home", sections: [] }],
  };

  ensureGalleryPage(site, {});

  const pages = site.pages as Array<Record<string, unknown>>;
  assert.equal(pages.some((page) => page.pageId === "gallery"), false);
});

test("ensureServicesPage creates aggregate services page and nav children", () => {
  const site: Record<string, unknown> = {
    meta: { language: "en" },
    services: [
      { title: "Concrete Pour Scheduling", summary: "Schedule a pour.", detailPageId: "concrete-pour-scheduling" },
      { title: "Fast Project Questions", description: "Ask about timing.", href: "#contact" },
    ],
    navigation: { headerMenu: [{ label: "Home", href: "#home" }, { label: "Contact", href: "#contact" }] },
    pages: [{ pageId: "home", sections: [] }],
  };

  ensureServicesPage(site);

  const servicesPage = (site.pages as Array<Record<string, unknown>>).find((page) => page.pageId === "services");
  assert.ok(servicesPage);
  const section = (servicesPage.sections as Array<Record<string, unknown>>)[0];
  const items = ((section.content as Record<string, unknown>).items as Array<Record<string, unknown>>);
  assert.equal(section.type, "offers");
  assert.equal(items.length, 2);
  const servicesNav = (site.navigation as any).headerMenu.find((item: any) => item.href === "#services");
  assert.equal(servicesNav.label, "Services");
  assert.deepEqual(servicesNav.children.map((item: any) => item.href), ["#concrete-pour-scheduling", "#contact"]);
});

test("ensureServicesPage refreshes an existing services page from current offering images", () => {
  const site: Record<string, unknown> = {
    meta: { language: "en" },
    services: [
      { title: "Concrete Delivery", summary: "Ready mix delivery.", image: "/service.jpg", detailPageId: "service-concrete-delivery" },
    ],
    pages: [
      {
        pageId: "services",
        sections: [
          { type: "offers", id: "services", content: { items: [{ title: "Old Item", image: "" }] } },
        ],
      },
    ],
  };

  ensureServicesPage(site);

  const servicesPage = (site.pages as Array<Record<string, unknown>>).find((page) => page.pageId === "services");
  const section = (servicesPage?.sections as Array<Record<string, unknown>>)[0];
  const items = ((section.content as Record<string, unknown>).items as Array<Record<string, unknown>>);
  assert.equal(items[0].title, "Concrete Delivery");
  assert.equal(items[0].image, "/service.jpg");
});

test("repairServiceCardImages fills homepage and service page cards without AI regeneration", () => {
  const site: Record<string, unknown> = {
    meta: { language: "en" },
    services: [
      { title: "Concrete Delivery", summary: "Ready mix delivery.", detailPageId: "service-concrete-delivery" },
      { title: "Pump Scheduling", summary: "Coordinate a concrete pump.", detailPageId: "service-pump-scheduling" },
    ],
    offers: [
      { title: "Concrete Delivery", description: "Ready mix delivery.", cta: { href: "#service-concrete-delivery" } },
    ],
    pages: [
      {
        pageId: "home",
        sections: [
          {
            type: "offers",
            id: "offers-1",
            content: {
              items: [
                { title: "Concrete Delivery", detailPageId: "service-concrete-delivery", image: "" },
                { title: "Pump Scheduling", detailPageId: "service-pump-scheduling", image: "" },
              ],
            },
          },
        ],
      },
      {
        pageId: "service-concrete-delivery",
        sections: [{ type: "hero", id: "service-concrete-delivery-hero", content: { image: "/detail-concrete.jpg" } }],
      },
      {
        pageId: "services",
        sections: [{ type: "offers", id: "services", content: { items: [{ title: "Concrete Delivery", image: "" }] } }],
      },
    ],
  };

  const result = repairServiceCardImages(site, { photos: [{ photo_reference: "pump" }] });
  ensureServicesPage(site);

  assert.equal(result.changed, 6);
  assert.equal((site.services as Array<Record<string, unknown>>)[0].image, "/detail-concrete.jpg");
  assert.equal((site.services as Array<Record<string, unknown>>)[1].image, "/api/places/photo?reference=pump&maxwidth=960");
  const homeSection = (((site.pages as Array<Record<string, unknown>>)[0].sections as Array<Record<string, unknown>>)[0].content as Record<string, unknown>);
  const homeItems = homeSection.items as Array<Record<string, unknown>>;
  assert.equal(homeItems[0].image, "/detail-concrete.jpg");
  assert.equal(homeItems[1].image, "/api/places/photo?reference=pump&maxwidth=960");
  const servicesPage = (site.pages as Array<Record<string, unknown>>).find((page) => page.pageId === "services");
  const servicesItems = ((((servicesPage?.sections as Array<Record<string, unknown>>)[0].content as Record<string, unknown>).items) as Array<Record<string, unknown>>);
  assert.equal(servicesItems[0].image, "/detail-concrete.jpg");
  assert.equal(servicesItems[1].image, "/api/places/photo?reference=pump&maxwidth=960");
});

test("repairServiceCardImages rotates gallery images instead of preserving duplicate card images", () => {
  const site: Record<string, unknown> = {
    meta: { language: "en" },
    brand: { preferredHeroImage: "/same.jpg" },
    services: [
      { title: "Concrete Delivery", summary: "Ready mix delivery.", image: "/same.jpg", detailPageId: "service-concrete-delivery" },
      { title: "Pump Scheduling", summary: "Coordinate a concrete pump.", image: "/same.jpg", detailPageId: "service-pump-scheduling" },
      { title: "Short Load Orders", summary: "Small-batch concrete.", image: "/same.jpg", detailPageId: "service-short-load-orders" },
    ],
    pages: [
      {
        pageId: "home",
        sections: [
          {
            type: "offers",
            id: "offers-1",
            content: {
              items: [
                { title: "Concrete Delivery", detailPageId: "service-concrete-delivery", image: "/same.jpg" },
                { title: "Pump Scheduling", detailPageId: "service-pump-scheduling", image: "/same.jpg" },
                { title: "Short Load Orders", detailPageId: "service-short-load-orders", image: "/same.jpg" },
              ],
            },
          },
          {
            type: "imageGallery",
            id: "gallery",
            content: { images: ["/gallery-1.jpg", "/gallery-2.jpg", "/gallery-3.jpg"] },
          },
        ],
      },
    ],
  };

  repairServiceCardImages(site, {});

  assert.deepEqual((site.services as Array<Record<string, unknown>>).map((item) => item.image), [
    "/gallery-1.jpg",
    "/gallery-2.jpg",
    "/gallery-3.jpg",
  ]);
  const homeSection = (((site.pages as Array<Record<string, unknown>>)[0].sections as Array<Record<string, unknown>>)[0].content as Record<string, unknown>);
  assert.deepEqual((homeSection.items as Array<Record<string, unknown>>).map((item) => item.image), [
    "/gallery-1.jpg",
    "/gallery-2.jpg",
    "/gallery-3.jpg",
  ]);
});

test("ensureFeedbackPage creates feedback page without adding header navigation", () => {
  const site: Record<string, unknown> = {
    meta: { language: "id" },
    navigation: { headerMenu: [{ label: "Beranda", href: "#home" }] },
    pages: [{ pageId: "home", sections: [] }],
  };

  ensureFeedbackPage(site);

  const feedbackPage = (site.pages as Array<Record<string, unknown>>).find((page) => page.pageId === "feedback");
  assert.ok(feedbackPage);
  const feedbackSection = (feedbackPage.sections as Array<Record<string, unknown>>)[0];
  assert.equal(feedbackSection.type, "feedback");
  assert.equal((site.navigation as any).headerMenu.some((item: any) => item.href === "#feedback"), false);
});

test("ensureConversionMetadata adds source-safe conversion strategy, proof, CTA cleanup, FAQ depth, and final CTA", () => {
  const site: Record<string, unknown> = {
    meta: { language: "en", businessName: "Atlas Concrete" },
    businessProfile: {
      name: "Atlas Concrete",
      primaryType: "concrete contractor",
      typeLabel: "Concrete Contractor",
      contact: { phoneNational: "+1 555-0199" },
      serviceAreas: ["Dallas", "Plano"],
    },
    trust: { rating: 4.7, reviewCount: 23, badges: [] },
    location: { formattedAddress: "100 Main St, Dallas, TX", servedAreas: ["Dallas", "Plano"] },
    sourceData: { googleMapsUri: "https://maps.example/atlas", businessStatus: "OPERATIONAL" },
    conversion: { primaryCta: { text: "Contact Us", href: "tel:+15550199" }, secondaryCta: { text: "Learn More", href: "#contact" } },
    global: { header: { ctaButton: { text: "Contact Us", href: "tel:+15550199" } } },
    services: [
      { title: "Driveway Repair", summary: "Fix driveway concrete.", detailPageId: "service-driveway-repair" },
    ],
    pages: [
      {
        pageId: "home",
        sections: [
          { type: "hero", id: "hero-1", content: { headline: "Concrete help", subheadline: "Local concrete support.", buttons: [{ text: "Contact Us", href: "#contact", style: "primary" }] } },
          { type: "faq", id: "faq-1", content: { items: [] } },
        ],
      },
      {
        pageId: "service-driveway-repair",
        pageTitle: "Driveway Repair",
        sections: [
          { type: "offeringDetail", id: "driveway-detail", content: { title: "Driveway Repair", included: [], bestFor: [], highlights: [] } },
        ],
      },
    ],
  };

  const conversion = ensureConversionMetadata(site, { photos: [{ photo_reference: "abc" }] });

  assert.equal(conversion.pagePattern, "gallery-led-craft");
  assert.equal((conversion.primaryCta as any).text, "Request an Estimate");
  assert.equal((site.design as any).stylePreset, "contractor-rugged");
  assert.equal((site.design as any).highTicketStyleDirection.pagePattern, "gallery-led-craft");
  assert.equal((site.design as any).compositionPattern, "gallery-craft");
  assert.equal((site.design as any).heroLayout, "gallery-led");
  assert.equal((site.design as any).mediaStrategy, "icon-card");
  assert.equal((site.design as any).proofTreatment, "gallery-proof");
  assert.equal((site.design as any).ctaTreatment, "estimate-block");
  assert.equal((site.design as any).designIntent.source, "deterministic_pattern_map");
  assert.equal((site.design as any).designAudit.ready, true);
  assert.ok((conversion.proofBadges as string[]).includes("Highly rated"));
  assert.ok((conversion.proofBadges as string[]).includes("Directions ready"));
  assert.equal(((site.global as any).header.ctaButton.text), "Request an Estimate");
  const homeSections = ((site.pages as Array<Record<string, unknown>>)[0].sections as Array<Record<string, unknown>>);
  const heroButtons = ((homeSections[0].content as any).buttons as any[]);
  assert.equal(heroButtons[0].text, "Request an Estimate");
  assert.ok(homeSections.some((section) => section.type === "finalCta"));
  const faq = homeSections.find((section) => section.type === "faq");
  assert.equal(((faq?.content as any).items as any[]).length, 5);
  const detail = (((site.pages as Array<Record<string, unknown>>)[1].sections as Array<Record<string, unknown>>)[0].content as any);
  assert.equal(detail.included.length, 3);
  assert.equal((conversion.conversionAudit as any).finalCtaPresent, true);
  assert.deepEqual((conversion.conversionAudit as any).thinServicePages, []);
});

test("applyGeneratedSitePageInserts applies services, contact, feedback, and gallery in one sequence", () => {
  const site: Record<string, unknown> = {
    meta: { language: "en" },
    brand: { preferredHeroImage: "/hero.jpg" },
    offers: [{ title: "Fast Estimate", description: "Quick next step.", image: "/offer.jpg" }],
    navigation: { headerMenu: [{ label: "Home", href: "#home" }] },
    pages: [{ pageId: "home", sections: [] }],
  };

  applyGeneratedSitePageInserts(site, { formatted_phone_number: "+1 555-0199" });

  const pageIds = (site.pages as Array<Record<string, unknown>>).map((page) => page.pageId);
  assert.deepEqual(pageIds, ["home", "services", "contact", "feedback", "gallery"]);
  const headerHrefs = (site.navigation as any).headerMenu.map((item: any) => item.href);
  assert.deepEqual(headerHrefs, ["#home", "#services", "#gallery", "#contact"]);
  const home = (site.pages as Array<Record<string, unknown>>).find((page) => page.pageId === "home");
  assert.ok((home?.sections as Array<Record<string, unknown>>).some((section) => section.type === "finalCta"));
});

function specificityFixtureSite(anchored: boolean) {
  const anchor = (text: string) => (anchored ? `Metro Concrete Repair ${text} in Dallas` : text);
  const genericFaq = [
    "Share the scope and timing so the next step stays clear for everyone involved.",
    "Prepare the main need, location, preferred timing, and any special requirements.",
    "Use the contact form so the message includes enough detail for a useful reply.",
    "Discuss availability windows and confirm scheduling preferences in advance.",
    "Review the general process overview before reaching out with questions.",
  ];
  return {
    meta: { businessName: "Metro Concrete Repair", language: "en" },
    businessProfile: {
      name: "Metro Concrete Repair",
      contact: {},
      address: { city: "Dallas", state: "TX" },
    },
    trust: { rating: 0, reviewCount: 0, reviews: [] },
    location: {},
    conversion: {
      primaryCta: { text: "Request a Quote", href: "#contact" },
      secondaryCta: { text: "Explore Services", href: "#services" },
    },
    global: { header: { ctaButton: { text: "Request a Quote", href: "#contact" } }, footer: {} },
    services: [],
    products: [],
    offers: [],
    navigation: { headerMenu: [{ label: "Home", href: "#home" }] },
    design: {},
    pages: [
      {
        pageId: "home",
        pageTitle: "Home",
        sections: [
          { type: "hero", id: "hero-1", content: { headline: anchor("Quality work you can trust"), subheadline: anchor("Reliable help for your next project."), buttons: [{ text: "Request a Quote", style: "primary" }] } },
          {
            type: "faq",
            id: "home-faq",
            content: {
              title: "Questions",
              items: genericFaq.map((answer, index) => ({ question: anchor(`General question ${index + 1}?`), answer: anchor(answer) })),
            },
          },
        ],
      },
      {
        pageId: "about",
        pageTitle: "About",
        sections: [
          {
            type: "features",
            id: "about-values",
            content: {
              title: "How we help customers",
              items: [
                { title: "Local focus", description: anchor("Built around customers in the local service area.") },
                { title: "Clear next steps", description: anchor("Review services and reach out when ready.") },
              ],
            },
          },
        ],
      },
    ],
  } as Record<string, unknown>;
}

test("conversion audit flags generic-only About and FAQ copy without business anchors (B4)", () => {
  const site = specificityFixtureSite(false);
  const conversion = ensureConversionMetadata(site, {});
  const audit = conversion.conversionAudit as any;
  assert.ok(audit.copySpecificity.genericPaths.includes("about:about-values"), "generic about section must be listed");
  assert.ok(audit.copySpecificity.genericPaths.includes("home:home-faq"), "generic home FAQ must be listed");
  assert.ok((audit.flags as string[]).includes("generic_detail_copy"));
});

test("conversion audit passes fact-anchored About and FAQ copy (B4)", () => {
  const site = specificityFixtureSite(true);
  const conversion = ensureConversionMetadata(site, {});
  const audit = conversion.conversionAudit as any;
  assert.deepEqual(audit.copySpecificity.genericPaths, []);
  assert.ok(!(audit.flags as string[]).includes("generic_detail_copy"));
});

test("generic scaffold CTA labels are rewritten while navigational vagueness is only reported (B5)", () => {
  const site: Record<string, unknown> = {
    meta: { businessName: "Metro Concrete Repair", language: "en" },
    businessProfile: { name: "Metro Concrete Repair", contact: {}, address: { city: "Dallas" } },
    trust: { rating: 0, reviewCount: 0, reviews: [] },
    location: {},
    conversion: {
      primaryCta: { text: "Request a Quote", href: "#contact" },
      secondaryCta: { text: "View Details", href: "#services" },
    },
    global: { header: { ctaButton: { text: "Hubungi", href: "#contact" } }, footer: {} },
    services: [],
    products: [],
    offers: [{ title: "Driveway Repair", description: "Fixes.", image: "", cta: { text: "Lihat detail", href: "#service-driveway-repair" } }],
    navigation: { headerMenu: [{ label: "Home", href: "#home" }] },
    design: {},
    pages: [
      {
        pageId: "home",
        pageTitle: "Home",
        sections: [
          { type: "hero", id: "hero-1", content: { headline: "Metro Concrete Repair keeps Dallas driveways safer", subheadline: "Call Metro Concrete Repair in Dallas for cracks and surface wear.", buttons: [{ text: "Request a Quote", style: "primary" }] } },
          {
            type: "offers",
            id: "home-offers",
            content: { title: "Services", items: [{ title: "Driveway Repair", description: "Metro Concrete Repair fixes Dallas driveways.", image: "", cta: { text: "Lihat detail", href: "#service-driveway-repair" } }] },
          },
        ],
      },
      {
        pageId: "service-driveway-repair",
        pageTitle: "Driveway Repair",
        sections: [
          { type: "offeringDetail", id: "driveway-detail", content: { title: "Driveway Repair by Metro Concrete Repair", summary: "Dallas homeowners call us for cracks.", description: "We repair Dallas driveways.", included: ["Inspect", "Prepare", "Repair"], bestFor: ["Owners"], highlights: [{ title: "Care", description: "Dallas care." }] } },
          { type: "hero", id: "driveway-hero", content: { headline: "Driveway Repair", buttons: [{ text: "Back to offers", style: "outline", href: "#services" }] } },
        ],
      },
    ],
  };

  const conversion = ensureConversionMetadata(site, {});
  assert.equal((conversion.secondaryCta as any).text, "Explore Services");
  assert.equal(((site.global as any).header.ctaButton as any).text, "Request an Estimate");
  const homeOffers = (((site.pages as any[])[0].sections as any[]).find((section: any) => section.type === "offers").content as any);
  assert.equal(homeOffers.items[0].cta.text, "Request an Estimate");
  const audit = conversion.conversionAudit as any;
  assert.ok(audit.vagueNavigationalCtas.some((entry: string) => entry.includes("Back to offers")), "navigational vagueness must be reported");
  assert.ok(!(audit.flags as string[]).includes("generic_primary_cta"));
});

test("secondary CTA falls back to Open Maps when a maps URL exists (B5)", () => {
  const site: Record<string, unknown> = {
    meta: { businessName: "Metro Concrete Repair", language: "en" },
    businessProfile: { name: "Metro Concrete Repair", contact: {}, address: {} },
    trust: { rating: 0, reviewCount: 0, reviews: [] },
    location: {},
    sourceData: { googleMapsUri: "https://maps.example/atlas" },
    conversion: { primaryCta: { text: "Request a Quote" }, secondaryCta: { text: "Lihat detail" } },
    global: { header: { ctaButton: { text: "Request a Quote" } }, footer: {} },
    services: [],
    products: [],
    offers: [],
    navigation: { headerMenu: [{ label: "Home", href: "#home" }] },
    design: {},
    pages: [{ pageId: "home", pageTitle: "Home", sections: [] }],
  };
  const conversion = ensureConversionMetadata(site, {});
  assert.equal((conversion.secondaryCta as any).text, "Open Maps");
});

test("specificity check reads markup body fields for legacy sections (B4)", () => {
  const site: Record<string, unknown> = {
    meta: { businessName: "Metro Concrete Repair", language: "en" },
    businessProfile: { name: "Metro Concrete Repair", contact: {}, address: { city: "Dallas" } },
    trust: { rating: 0, reviewCount: 0, reviews: [] },
    location: {},
    conversion: { primaryCta: { text: "Request a Quote" }, secondaryCta: { text: "Explore Services" } },
    global: { header: { ctaButton: { text: "Request a Quote" } }, footer: {} },
    services: [],
    products: [],
    offers: [],
    navigation: { headerMenu: [{ label: "Home", href: "#home" }] },
    design: {},
    pages: [
      {
        pageId: "home",
        pageTitle: "Home",
        sections: [
          { type: "hero", id: "hero-1", content: { headline: "Metro Concrete Repair", subheadline: "Dallas concrete help.", buttons: [{ text: "Request a Quote", style: "primary" }] } },
        ],
      },
      {
        pageId: "about",
        pageTitle: "About",
        sections: [
          { type: "textImageBlock", id: "about-story", content: { title: "Our story", bodyHtml: "<p>Metro Concrete Repair serves Dallas homeowners with careful surface work.</p>" } },
        ],
      },
    ],
  };
  const conversion = ensureConversionMetadata(site, {});
  const audit = conversion.conversionAudit as any;
  assert.ok(!audit.copySpecificity.genericPaths.includes("about:about-story"), "markup body prose with anchors must pass");
});

test("zero-photo sites get proof-led fallbacks while photo-rich sites stay untouched (P3)", () => {
  const base = {
    meta: { businessName: "No Photo Co", language: "en" },
    businessProfile: { name: "No Photo Co", contact: {}, address: { city: "Dallas" } },
    trust: { rating: 4.5, reviewCount: 30, reviews: [] },
    location: {},
    conversion: { primaryCta: { text: "Request a Quote" }, secondaryCta: { text: "Explore Services" } },
    global: { header: { ctaButton: { text: "Request a Quote" } }, footer: {} },
    navigation: { headerMenu: [{ label: "Home", href: "#home" }] },
    design: { proofTreatment: "gallery-proof" },
    brand: {},
    sourceData: {},
    services: [],
    products: [],
    offers: [],
  } as Record<string, unknown>;
  const bareHome = {
    pageId: "home",
    pageTitle: "Home",
    sections: [
      { type: "hero", id: "hero-1", content: { headline: "No Photo Co", subheadline: "Dallas help." } },
      { type: "offers", id: "offers-1", content: { title: "Services", items: [] } },
      { type: "trustBar", id: "trust-1", content: { items: [] } },
    ],
  };
  const bare = { ...base, design: { proofTreatment: "gallery-proof" }, pages: [structuredClone(bareHome)] } as Record<string, unknown>;
  applyGeneratedSitePageInserts(bare, {});
  assert.equal((bare.design as any).proofTreatment, "badge-row");
  const bareOrder = ((bare.pages as any[])[0].sections as any[]).map((section) => section.type);
  assert.deepEqual(bareOrder.slice(0, 2), ["hero", "trustBar"]);

  const rich = { ...base, design: { proofTreatment: "gallery-proof" }, brand: { preferredHeroImage: "/hero.jpg" }, pages: [structuredClone(bareHome)] } as Record<string, unknown>;
  applyGeneratedSitePageInserts(rich, {});
  assert.equal((rich.design as any).proofTreatment, "gallery-proof");
  const richOrder = ((rich.pages as any[])[0].sections as any[]).map((section) => section.type);
  assert.deepEqual(richOrder.slice(0, 3), ["hero", "offers", "trustBar"]);
});

test("explicit admin preset survives the pattern default upgrade (A3)", () => {
  const base = {
    meta: { businessName: "Metro Concrete Repair", language: "en" },
    businessProfile: { name: "Metro Concrete Repair", contact: {}, address: { city: "Dallas" } },
    trust: { rating: 4.8, reviewCount: 120, reviews: [] },
    location: {},
    conversion: { primaryCta: { text: "Request an Estimate" }, secondaryCta: { text: "Explore Services" } },
    global: { header: { ctaButton: { text: "Request an Estimate" } }, footer: {} },
    services: [],
    products: [],
    offers: [],
    navigation: { headerMenu: [{ label: "Home", href: "#home" }] },
    pages: [{ pageId: "home", pageTitle: "Home", sections: [] }],
  } as Record<string, unknown>;
  const explicit = { ...base, design: { stylePreset: "legal-authority", stylePresetExplicit: true } } as Record<string, unknown>;
  ensureConversionMetadata(explicit, {});
  assert.equal((explicit.design as any).stylePreset, "legal-authority");
  const inferred = { ...base, design: {} } as Record<string, unknown>;
  ensureConversionMetadata(inferred, {});
  assert.ok((inferred.design as any).stylePreset && (inferred.design as any).stylePreset !== "legal-authority");
});

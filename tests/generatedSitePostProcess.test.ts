import assert from "node:assert/strict";
import test from "node:test";
import {
  applyGeneratedSitePageInserts,
  collectGalleryImages,
  ensureContactPage,
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
});

import assert from "node:assert/strict";
import test from "node:test";
import { buildGeneratedSiteScaffold, businessSlug, photoAttributions, photoReference, placeDisplayName, placePhone } from "../src/lib/generatedSiteScaffold";

test("buildGeneratedSiteScaffold creates normalized generated-site JSON with inserted core pages", () => {
  const site = buildGeneratedSiteScaffold(
    {
      place_id: "place-123",
      name: "Metro Concrete Repair",
      formatted_address: "100 Main St, Dallas, TX 75201, USA",
      formatted_phone_number: "+1 555-0100",
      rating: 4.6,
      user_ratings_total: 27,
      types: ["concrete_contractor", "establishment"],
      url: "https://maps.example/metro",
      photos: [{ photo_reference: "photo-1" }, { reference: "photo-2" }],
      reviews: [{ author_name: "A Customer", rating: 5, text: "Fast and professional service." }],
    },
    {
      businessId: "metro-concrete-repair",
      imageUrl: "/api/places/photo?reference=photo-1&maxwidth=960",
      palette: ["#111827", "#4F46E5", "#F3F4F6"],
      paletteOptions: [{ id: "primary", colors: ["#111827", "#4F46E5", "#F3F4F6"] }],
      selectedPhotoReference: "photo-1",
      selectedPhotoAttributions: ["Google reviewer"],
      selectedPhotoSource: "google_places",
      selectedPhotoPriority: "best exterior",
      searchQuery: "concrete contractor dallas",
    },
  );

  assert.equal((site.meta as any).businessId, "metro-concrete-repair");
  assert.equal((site.businessProfile as any).contact.phoneNational, "+1 555-0100");
  assert.equal((site.brand as any).googlePhotoReference, "photo-1");
  assert.ok(Array.isArray((site as any).services));
  assert.ok((site as any).services.length >= 1);

  const pageIds = ((site as any).pages as any[]).map((page) => page.pageId);
  assert.ok(pageIds.includes("home"));
  assert.ok(pageIds.includes("services"));
  assert.ok(pageIds.includes("contact"));
  assert.ok(pageIds.includes("feedback"));
  assert.ok(pageIds.includes("gallery"));

  const headerHrefs = (site.navigation as any).headerMenu.map((item: any) => item.href);
  assert.ok(headerHrefs.includes("#services"));
  assert.ok(headerHrefs.includes("#contact"));
  assert.ok(headerHrefs.includes("#gallery"));
  assert.equal(headerHrefs.includes("#feedback"), false);
});

test("generatedSiteScaffold utility helpers normalize common Places fields", () => {
  assert.equal(businessSlug("Metro Concrete Repair LLC", "abc123456789"), "metro-concrete-repair-llc-456789");
  assert.equal(placePhone({ formatted_phone_number: "(555) 010-0000" }), "(555) 010-0000");
  assert.equal(placePhone({ formatted_phone_number: "0000" }), "");
  assert.equal(placeDisplayName({ name: "places/abc", displayName: { text: "Metro Concrete Repair" } }), "Metro Concrete Repair");
  assert.equal(photoReference({ photo_reference: "legacy-ref" }), "legacy-ref");
  assert.equal(photoReference({ name: "places/123/photos/abc" }), "places/123/photos/abc");
  assert.deepEqual(photoAttributions({ html_attributions: ["<a href='x'>Google User</a>"] }), ["Google User"]);
});

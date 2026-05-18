import assert from "node:assert/strict";
import test from "node:test";
import { buildSelectedPhotoGeneratePayload, mapsQueryPlaceId, mapsQueryPlaceholder } from "../src/lib/adminSiteGeneration";

test("adminSiteGeneration builds a scaffold generate payload with selected photo metadata", () => {
  const payload = buildSelectedPhotoGeneratePayload({
    place: {
      place_id: "place-123",
      name: "Metro Concrete Repair",
      formatted_phone_number: "+1 555-0100",
      photos: [{ photo_reference: "fallback-photo", html_attributions: ["<b>Fallback User</b>"] }],
    },
    requireAi: true,
    provider: "KIE",
    model: "kie/gemini-3-flash",
    selectedPhoto: {
      reference: "selected-photo",
      url: "/api/places/photo?reference=selected-photo&maxwidth=960",
      source: "google_places",
      attributions: ["Selected User"],
      priorityLabel: "best exterior",
    },
    palette: ["#111827", "#2563EB"],
    paletteOptions: [{ id: "primary", colors: ["#111827", "#2563EB"] }],
  });

  assert.equal(payload.requireAi, true);
  assert.equal(payload.provider, "KIE");
  assert.equal(payload.model, "kie/gemini-3-flash");
  assert.equal(payload.businessId, "metro-concrete-repair-ace123");
  assert.equal(payload.phone, "+1 555-0100");
  assert.equal(payload.selectedLogoReference, "selected-photo");
  assert.deepEqual(payload.selectedLogoAttributions, ["Selected User"]);
  assert.equal((payload.jsonContent as any).meta.businessId, "metro-concrete-repair-ace123");
  assert.ok(((payload.jsonContent as any).pages as any[]).some((page) => page.pageId === "contact"));
});

test("adminSiteGeneration detects maps query placeholders", () => {
  assert.equal(mapsQueryPlaceId("maps:concrete+dallas"), true);
  assert.equal(mapsQueryPlaceholder({ place_id: "maps:concrete+dallas" }), true);
  assert.equal(mapsQueryPlaceholder({ place_id: "maps:concrete+dallas", manualImport: true }), false);
});


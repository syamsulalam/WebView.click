import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPaletteOptionForPhoto,
  buildPhotoSelection,
  buildProspectSelectionPayload,
  buildSelectedPhotoGeneratePayload,
  mapsQueryPlaceId,
  mapsQueryPlaceholder,
  resolveLeadGeneratePhotoSelection,
  sortedPhotosForPlace,
} from "../src/lib/adminSiteGeneration";

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

test("adminSiteGeneration normalizes lead photo selection and palette persistence payloads", () => {
  const ownerLike = { photo_reference: "owner-photo", html_attributions: ["Metro Concrete Repair"] };
  const ugc = { photo_reference: "ugc-photo", html_attributions: ["A Customer"] };
  const place = { place_id: "place-123", name: "Metro Concrete Repair", photos: [ugc, ownerLike] };
  const sorted = sortedPhotosForPlace(place);
  assert.equal(sorted[0], ownerLike);

  const selection = buildPhotoSelection({
    photo: ownerLike,
    imageUrl: "/api/places/photo?reference=owner-photo&maxwidth=320",
    businessName: place.name,
    palette: ["#111827", "#2563EB"],
  });
  assert.equal(selection.priorityLabel, "Owner-like");

  const paletteOption = buildPaletteOptionForPhoto({
    photo: ownerLike,
    index: 0,
    colors: selection.palette,
    sourceImageUrl: selection.url,
    businessName: place.name,
  });
  assert.equal(paletteOption.photoReference, "owner-photo");

  assert.deepEqual(buildProspectSelectionPayload({ selection, palette: selection.palette, paletteOptions: [paletteOption] }), {
    photo: {
      url: selection.url,
      reference: "owner-photo",
      attributions: ["Metro Concrete Repair"],
      priorityLabel: "Owner-like",
      source: "google_places",
    },
    palette: ["#111827", "#2563EB"],
    paletteOptions: [paletteOption],
  });

  const resolved = resolveLeadGeneratePhotoSelection({
    place,
    placeKey: "place-123",
    logoSelections: { "place-123": selection },
    paletteOptionsByPlace: { "place-123": [paletteOption] },
  });
  assert.equal(resolved.selectedReference, "owner-photo");
  assert.deepEqual(resolved.brandPalette, ["#111827", "#2563EB"]);

  const resolvedFromSavedReference = resolveLeadGeneratePhotoSelection({
    place,
    placeKey: "place-123",
    logoSelections: {
      "place-123": {
        ...selection,
        url: "",
        palette: [],
      },
    },
    paletteOptionsByPlace: { "place-123": [paletteOption] },
    selectedPalette: ["#0F172A", "#2563EB"],
    photoMaxWidth: 960,
  });
  assert.equal(resolvedFromSavedReference.selectedImageUrl, "/api/places/photo?reference=owner-photo&maxwidth=960");
  assert.deepEqual(resolvedFromSavedReference.brandPalette, ["#0F172A", "#2563EB"]);
});

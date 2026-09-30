import assert from "node:assert/strict";
import test from "node:test";
import { inferStylePresetFromText, normalizeStylePreset, siteStylePresets } from "../src/lib/siteStylePresets";

test("primaryType exact industry tokens beat a misleading business name", () => {
  assert.equal(inferStylePresetFromText("Acme LLC Dallas", "plumber", ["plumber", "establishment"]), "contractor-rugged");
  assert.equal(inferStylePresetFromText("Acme LLC", "restaurant", ["restaurant", "food"]), "cafe-warm");
  assert.equal(inferStylePresetFromText("Acme LLC", "dentist", ["dentist"]), "dental-clean");
  assert.equal(inferStylePresetFromText("Acme LLC", "beauty_salon", ["beauty_salon"]), "salon-soft-luxe");
  assert.equal(inferStylePresetFromText("Acme LLC", "locksmith", ["locksmith"]), "security-trust");
  assert.equal(inferStylePresetFromText("Acme LLC", "gym", ["gym"]), "fitness-energy");
});

test("review prose folded into the match text resolves otherwise-generic names", () => {
  assert.equal(inferStylePresetFromText("Acme LLC Dallas best coffee in town", "", []), "cafe-warm");
  assert.equal(inferStylePresetFromText("Acme LLC", "", []), "local-clean");
});

test("every non-default preset is reachable and normalizes to itself", () => {
  for (const preset of siteStylePresets) {
    if (preset.id === "local-clean") continue;
    assert.equal(normalizeStylePreset(preset.id), preset.id);
    assert.equal(inferStylePresetFromText(`${preset.industries.join(" ")}`, "", []), preset.id);
  }
});

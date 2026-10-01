import assert from "node:assert/strict";
import test from "node:test";
import { inferStylePresetFromText, normalizeStylePreset, siteStylePresets } from "../src/lib/siteStylePresets";
import { contrastRatioHex } from "../src/lib/colorPaletteRoles";

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

test("every preset carries a uupm reference, effects, checklist, and a text-safe triple (P4 D8/D11)", () => {
  assert.equal(siteStylePresets.length, 16);
  for (const preset of siteStylePresets) {
    assert.ok(preset.uupmStyle && preset.uupmStyle.length > 0, `${preset.id} uupmStyle`);
    assert.ok(preset.effects && preset.effects.length > 0, `${preset.id} effects`);
    assert.ok(preset.cssKeys && preset.cssKeys.length > 0, `${preset.id} cssKeys`);
    const darkest = preset.recommendedColors.reduce((a, b) => (contrastRatioHex(b, "#000000") < contrastRatioHex(a, "#000000") ? b : a));
    const lightest = preset.recommendedColors.reduce((a, b) => (contrastRatioHex(b, "#FFFFFF") < contrastRatioHex(a, "#FFFFFF") ? b : a));
    assert.ok(contrastRatioHex(darkest, lightest) >= 4.5, `${preset.id} triple must include a 4.5+ text pair`);
  }
});

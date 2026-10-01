import assert from "node:assert/strict";
import test from "node:test";
import {
  componentSpacingClass,
  ctaSizeClass,
  detailLayoutGroup,
  MOTION_TIMING,
  motionLevelClass,
  motionTimingFor,
  normalizeDensity,
  sectionContainerClass,
  sectionRhythmPadClass,
  sectionSpacingClass,
  sectionTypeSpacingToken,
  typeScaleClass,
} from "../src/lib/siteIntentMaps";

test("sectionRhythmPadClass maps each known rhythm to the token scale (P4 D1)", () => {
  assert.equal(sectionRhythmPadClass("compressed-urgent"), "py-8 md:py-12 px-4 md:px-6 lg:px-8");
  assert.equal(sectionRhythmPadClass("measured-authority"), "py-12 md:py-16 lg:py-20 px-4 md:px-6 lg:px-8");
  assert.equal(sectionRhythmPadClass("soft-premium"), "py-16 md:py-24 lg:py-32 px-4 md:px-6 lg:px-8");
  assert.equal(sectionRhythmPadClass("spacious-premium"), "py-16 md:py-24 lg:py-32 px-4 md:px-6 lg:px-8");
  assert.equal(sectionRhythmPadClass("balanced-local"), "py-12 md:py-16 lg:py-20 px-4 md:px-6 lg:px-8");
  assert.equal(sectionRhythmPadClass("editorial-warm"), "py-12 md:py-16 lg:py-20 px-4 md:px-6 lg:px-8");
  assert.equal(sectionRhythmPadClass("proof-forward"), "py-12 md:py-16 lg:py-20 px-4 md:px-6 lg:px-8");
  assert.equal(sectionRhythmPadClass("unknown-future-value"), "py-12 md:py-16 lg:py-20 px-4 md:px-6 lg:px-8");
});

test("every rendered content section type resolves to a spacing token (P4 D1)", () => {
  const types = ["trustBar", "features", "offers", "offeringDetail", "reviews", "hoursLocation", "faq", "finalCta", "textImageBlock", "teamGrid", "gridCards", "imageGallery", "feedback", "contactForm"];
  for (const type of types) {
    const token = sectionTypeSpacingToken(type);
    assert.ok(["sm", "md", "lg"].includes(token), type);
    const cls = sectionSpacingClass(type, "balanced-local", "standard");
    assert.match(cls, /py-\d+/, type);
    assert.ok(cls.includes("px-4 md:px-6 lg:px-8"), type);
  }
  assert.equal(sectionTypeSpacingToken("finalCta"), "lg");
  assert.equal(sectionTypeSpacingToken("trustBar"), "sm");
});

test("density dial lifts spacing one tier for spacious, the owner default (P4 D2)", () => {
  assert.equal(normalizeDensity("spacious"), "spacious");
  assert.equal(normalizeDensity("standard"), "standard");
  assert.equal(normalizeDensity(""), "spacious");
  assert.equal(normalizeDensity("compact"), "spacious");
  const standard = sectionSpacingClass("features", "balanced-local", "standard");
  const spacious = sectionSpacingClass("features", "balanced-local", "spacious");
  assert.equal(standard, "py-12 md:py-16 lg:py-20 px-4 md:px-6 lg:px-8");
  assert.equal(spacious, "py-16 md:py-24 lg:py-32 px-4 md:px-6 lg:px-8");
  // compressed-urgent always stays compact; measured-authority caps at md.
  assert.equal(sectionSpacingClass("offers", "compressed-urgent", "spacious"), "py-8 md:py-12 px-4 md:px-6 lg:px-8");
  assert.equal(sectionSpacingClass("finalCta", "measured-authority", "spacious"), "py-12 md:py-16 lg:py-20 px-4 md:px-6 lg:px-8");
  // A premium rhythm lifts one tier even at standard density.
  assert.equal(sectionSpacingClass("offers", "spacious-premium", "standard"), "py-16 md:py-24 lg:py-32 px-4 md:px-6 lg:px-8");
});

test("container rhythm and component spacing tokens (P4 D3-D4)", () => {
  assert.equal(sectionContainerClass("content"), "max-w-6xl mx-auto");
  assert.equal(sectionContainerClass("narrow"), "max-w-2xl mx-auto");
  assert.equal(sectionContainerClass("wide"), "max-w-7xl mx-auto");
  assert.equal(sectionContainerClass("full"), "w-full");
  assert.equal(componentSpacingClass("button", "lg"), "px-6 py-3");
  assert.equal(componentSpacingClass("button", "md"), "px-4 py-2 text-sm");
  assert.equal(componentSpacingClass("card"), "p-6");
  assert.equal(componentSpacingClass("card", "sm"), "p-4");
  assert.equal(componentSpacingClass("badge"), "px-2.5 py-0.5");
  assert.equal(componentSpacingClass("input"), "px-3 py-2");
  assert.equal(componentSpacingClass("section-gap"), "gap-4 md:gap-6");
  assert.equal(componentSpacingClass("list-stack"), "space-y-4");
  assert.equal(ctaSizeClass("lg"), "px-6 py-3");
  assert.equal(ctaSizeClass(""), "px-4 py-2 text-sm");
});

test("modular type scale steps (P4 D9)", () => {
  assert.equal(typeScaleClass("display"), "text-4xl md:text-6xl font-bold leading-tight");
  assert.ok(typeScaleClass("body-lg").includes("leading-relaxed"));
  assert.ok(typeScaleClass("body").includes("leading-relaxed"));
  assert.equal(typeScaleClass("unknown"), typeScaleClass("body"));
});

test("approved motion timings per level (P4 D10)", () => {
  assert.deepEqual(MOTION_TIMING, { hover: "150-200ms", card: "200-300ms", reveal: "300-400ms", stagger: "250-350ms", page: "200-300ms" });
  assert.deepEqual(motionTimingFor("none"), []);
  assert.deepEqual(motionTimingFor("subtle"), ["150-200ms", "300-400ms"]);
  assert.ok(motionTimingFor("standard").includes("250-350ms"));
  assert.equal(motionTimingFor("complex").length, 5);
});

test("detailLayoutGroup buckets the six generated layouts into three rendered rhythms", () => {
  assert.equal(detailLayoutGroup("contact-rail"), "rail");
  assert.equal(detailLayoutGroup("booking-detail"), "rail");
  assert.equal(detailLayoutGroup("authority-detail"), "editorial");
  assert.equal(detailLayoutGroup("consultation-detail"), "editorial");
  assert.equal(detailLayoutGroup("menu-detail"), "editorial");
  assert.equal(detailLayoutGroup("scope-detail"), "standard");
  assert.equal(detailLayoutGroup(""), "standard");
});

test("motionLevelClass gates animation intensity without breaking the default", () => {
  assert.equal(motionLevelClass("none"), "wv-motion-none");
  assert.equal(motionLevelClass("subtle"), "wv-motion-subtle");
  assert.equal(motionLevelClass("standard"), "");
  assert.equal(motionLevelClass(""), "");
});

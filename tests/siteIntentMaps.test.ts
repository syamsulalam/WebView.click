import assert from "node:assert/strict";
import test from "node:test";
import { detailLayoutGroup, motionLevelClass, sectionRhythmPadClass } from "../src/lib/siteIntentMaps";

test("sectionRhythmPadClass maps each known rhythm to a distinct spacing scale", () => {
  assert.equal(sectionRhythmPadClass("compressed-urgent"), "py-10 px-4");
  assert.equal(sectionRhythmPadClass("measured-authority"), "py-16 px-6");
  assert.equal(sectionRhythmPadClass("soft-premium"), "py-24 md:py-32 px-6");
  assert.equal(sectionRhythmPadClass("spacious-premium"), "py-24 md:py-32 px-6");
  assert.equal(sectionRhythmPadClass("balanced-local"), "py-20 px-6");
  assert.equal(sectionRhythmPadClass("editorial-warm"), "py-20 px-6");
  assert.equal(sectionRhythmPadClass("proof-forward"), "py-20 px-6");
  assert.equal(sectionRhythmPadClass("unknown-future-value"), "py-20 px-6");
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

import assert from "node:assert/strict";
import test from "node:test";
import { applySiteCopyOfferingPreserve } from "../functions/api/generationJobs/handler";

function preservedMetadataFixture() {
  return {
    offeringCopyCursor: 2,
    offeringCopyTotal: 6,
    offeringCopyPatch: { offerings: [{ id: "driveway-repair", summary: "Kept service summary." }] },
    offeringCopyBriefHashes: [{ index: 0, id: "driveway-repair", hash: "brief-1" }],
    offeringCopyPatchHashes: [{ index: 0, id: "driveway-repair", hash: "patch-1" }],
    offeringCopyAuditSummary: { aiRewritten: 2 },
    offeringCopyAuditItems: [{ path: "services.0.summary" }],
    offeringCopyCoverage: { changed: 1, total: 6 },
  } as Record<string, unknown>;
}

test("siteCopy retry preserves completed offering work when the patch skips offerings (B3)", () => {
  const metadata = preservedMetadataFixture();
  const preserved = applySiteCopyOfferingPreserve(
    metadata,
    { hero: { headline: "New homepage headline" } },
    { summary: { aiRewritten: 1 }, items: [] },
  );
  assert.equal(preserved, true);
  assert.equal(metadata.offeringCopyCursor, 2);
  assert.deepEqual(
    ((metadata.copyPatch as Record<string, unknown>).offerings as Array<Record<string, unknown>>),
    [{ id: "driveway-repair", summary: "Kept service summary." }],
  );
  assert.equal(((metadata.copyPatch as Record<string, unknown>).hero as Record<string, unknown>).headline, "New homepage headline");
  assert.deepEqual(metadata.offeringCopyPatch, { offerings: [{ id: "driveway-repair", summary: "Kept service summary." }] });
  assert.equal((metadata.copyAuditSummary as Record<string, unknown>).aiRewritten, 3);
});

test("siteCopy retry falls back to full offering reset when the patch touches offerings (B3)", () => {
  const metadata = preservedMetadataFixture();
  const preserved = applySiteCopyOfferingPreserve(
    metadata,
    { offerings: [{ id: "driveway-repair", summary: "Rewritten summary." }] },
    { summary: { aiRewritten: 1 }, items: [] },
  );
  assert.equal(preserved, false);
  assert.deepEqual(metadata.offeringCopyPatch, { offerings: [{ id: "driveway-repair", summary: "Kept service summary." }] });
});

test("first siteCopy without offering progress keeps the reset path (B3)", () => {
  const metadata = { offeringCopyCursor: 0 } as Record<string, unknown>;
  const preserved = applySiteCopyOfferingPreserve(
    metadata,
    { hero: { headline: "First pass headline" } },
    { summary: { aiRewritten: 1 }, items: [] },
  );
  assert.equal(preserved, false);
  assert.equal(metadata.offeringCopyCursor, 0);
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  chunkedGenerationState,
  chunkedStepStatus,
  normalizeChunkedStep,
} from "../src/lib/generationJobState";

test("chunkedGenerationState marks running next step and completed previous steps", () => {
  const job = {
    status: "running",
    metadata: {
      chunked: true,
      step: "outline_complete",
      nextStep: "siteCopy",
      offeringOutlineHash: "outline-hash",
    },
  };

  const state = chunkedGenerationState(job);

  assert.equal(state.chunked, true);
  assert.equal(state.nextStep, "siteCopy");
  assert.equal(state.activeStep, "siteCopy");
  assert.equal(state.retryStep, "");
  assert.deepEqual(state.doneByStep, { outline: true, siteCopy: false, offeringCopy: false, finalize: false });
  assert.equal(chunkedStepStatus(job, "outline"), "complete");
  assert.equal(chunkedStepStatus(job, "siteCopy"), "running");
  assert.equal(chunkedStepStatus(job, "offeringCopy"), "pending");
  assert.equal(chunkedStepStatus(job, "finalize"), "pending");
});

test("chunkedGenerationState exposes failed step for retry without restarting the job", () => {
  const job = {
    status: "failed",
    metadata: {
      chunked: true,
      step: "offeringCopy_complete",
      nextStep: "finalize",
      failureStage: "chunked_finalize",
      offeringOutlineHash: "outline-hash",
      siteCopyPatchHash: "site-copy-hash",
      offeringCopyPatchHash: "offering-copy-hash",
    },
  };

  const state = chunkedGenerationState(job);

  assert.equal(state.failureStep, "finalize");
  assert.equal(state.retryStep, "finalize");
  assert.equal(state.activeStep, "");
  assert.deepEqual(state.doneByStep, { outline: true, siteCopy: true, offeringCopy: true, finalize: false });
  assert.equal(chunkedStepStatus(job, "outline"), "complete");
  assert.equal(chunkedStepStatus(job, "siteCopy"), "complete");
  assert.equal(chunkedStepStatus(job, "offeringCopy"), "complete");
  assert.equal(chunkedStepStatus(job, "finalize"), "failed");
});

test("chunkedGenerationState treats successful chunked jobs as fully complete", () => {
  const job = {
    status: "success",
    metadata: {
      chunked: true,
      step: "finalize_complete",
      nextStep: "",
      offeringOutlineHash: "outline-hash",
      siteCopyPatchHash: "site-copy-hash",
      offeringCopyPatchHash: "offering-copy-hash",
    },
  };

  assert.deepEqual(chunkedGenerationState(job).doneByStep, { outline: true, siteCopy: true, offeringCopy: true, finalize: true });
  assert.equal(chunkedStepStatus(job, "finalize"), "complete");
});

test("normalizeChunkedStep only accepts known chunked steps", () => {
  assert.equal(normalizeChunkedStep("chunked_outline"), "outline");
  assert.equal(normalizeChunkedStep("copy"), "siteCopy");
  assert.equal(normalizeChunkedStep("siteCopy"), "siteCopy");
  assert.equal(normalizeChunkedStep("offeringCopy"), "offeringCopy");
  assert.equal(normalizeChunkedStep("provider_cooldown"), "");
  assert.equal(chunkedStepStatus({ status: "failed", metadata: { chunked: false } }, "outline"), "idle");
});

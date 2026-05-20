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
      nextStep: "copy",
      offeringOutlineHash: "outline-hash",
    },
  };

  const state = chunkedGenerationState(job);

  assert.equal(state.chunked, true);
  assert.equal(state.nextStep, "copy");
  assert.equal(state.activeStep, "copy");
  assert.equal(state.retryStep, "");
  assert.deepEqual(state.doneByStep, { outline: true, copy: false, finalize: false });
  assert.equal(chunkedStepStatus(job, "outline"), "complete");
  assert.equal(chunkedStepStatus(job, "copy"), "running");
  assert.equal(chunkedStepStatus(job, "finalize"), "pending");
});

test("chunkedGenerationState exposes failed step for retry without restarting the job", () => {
  const job = {
    status: "failed",
    metadata: {
      chunked: true,
      step: "copy_complete",
      nextStep: "finalize",
      failureStage: "chunked_finalize",
      offeringOutlineHash: "outline-hash",
      copyPatchHash: "copy-hash",
    },
  };

  const state = chunkedGenerationState(job);

  assert.equal(state.failureStep, "finalize");
  assert.equal(state.retryStep, "finalize");
  assert.equal(state.activeStep, "");
  assert.deepEqual(state.doneByStep, { outline: true, copy: true, finalize: false });
  assert.equal(chunkedStepStatus(job, "outline"), "complete");
  assert.equal(chunkedStepStatus(job, "copy"), "complete");
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
      copyPatchHash: "copy-hash",
    },
  };

  assert.deepEqual(chunkedGenerationState(job).doneByStep, { outline: true, copy: true, finalize: true });
  assert.equal(chunkedStepStatus(job, "finalize"), "complete");
});

test("normalizeChunkedStep only accepts known chunked steps", () => {
  assert.equal(normalizeChunkedStep("chunked_outline"), "outline");
  assert.equal(normalizeChunkedStep("copy"), "copy");
  assert.equal(normalizeChunkedStep("provider_cooldown"), "");
  assert.equal(chunkedStepStatus({ status: "failed", metadata: { chunked: false } }, "outline"), "idle");
});

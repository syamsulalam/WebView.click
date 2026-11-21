import assert from "node:assert/strict";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import test from "node:test";
import { asString, errorJson, json, parseJsonObject, readJsonBody } from "../functions/api/_shared/response";
import { reserveDailyUsage } from "../functions/api/_shared/db";
import { handleGenerationJobs, type GenerationJobsDeps } from "../functions/api/generationJobs/handler";

test("one claim owns a generation step and the next step must match the checkpoint", async (t) => {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  sqlite.exec(`CREATE TABLE generation_jobs (id TEXT PRIMARY KEY, status TEXT, error TEXT, metadata_json TEXT,
    step_claim_token TEXT, step_claim_until INTEGER, updated_at TEXT);
    CREATE TABLE daily_usage_counters (usage_date TEXT, counter_key TEXT, count INTEGER, updated_at TEXT,
    PRIMARY KEY (usage_date, counter_key));`);
  const meta = JSON.stringify({ chunked: true, nextStep: "outline", payload: { businessName: "Fixture" } });
  sqlite.prepare("INSERT INTO generation_jobs (id, status, metadata_json) VALUES ('job', 'running', ?)").run(meta);
  const db = {
    prepare(query: string) {
      let values: SQLInputValue[] = [];
      return {
        bind(...params: SQLInputValue[]) { values = params; return this; },
        async first() { return sqlite.prepare(query).get(...values) ?? null; },
      };
    },
  };
  let entered!: () => void;
  let release!: () => void;
  const enteredProvider = new Promise<void>((resolve) => { entered = resolve; });
  const providerGate = new Promise<void>((resolve) => { release = resolve; });
  let calls = 0;
  const unexpected = () => { throw new Error("Unexpected dependency call in generation lease fixture"); };
  const deps: GenerationJobsDeps = {
    templateSchema: {}, asString, errorJson, json, parseJsonObject, readJsonBody,
    normalizeBusinessId: unexpected,
    placeIdFromPlace: unexpected,
    async ensureRequiredColumns() {},
    generateRequiredColumns: [],
    createGenerationJob: unexpected,
    updateGenerationJob: unexpected,
    updateProspectRecord: unexpected,
    insertProviderCooldownEvent: unexpected,
    getSetting: unexpected,
    async generateAiOfferingOutline() {
      calls += 1;
      entered();
      await providerGate;
      return null;
    },
    applyAiOfferingOutline: unexpected,
    generateAiCopyPatch: unexpected,
    applyAiCopyPatch: unexpected,
    collectAiCopyAuditTargets: unexpected,
    buildAiCopyAudit: unexpected,
    handleSites: unexpected,
  };
  const post = (step: string) => handleGenerationJobs(deps, new Request("https://webview.click/api/generation-jobs/job/run-step", {
    method: "POST", body: JSON.stringify({ step }),
  }), db as never, {}, ["generation-jobs", "job", "run-step"]);
  assert.equal((await post("finalize")).status, 409);
  const current = post("outline");
  try {
    await enteredProvider;
    assert.equal((await post("outline")).status, 409);
  } finally {
    release();
  }
  assert.equal((await current).status, 200);
  assert.equal((await post("outline")).status, 409);
  assert.equal(calls, 1);

  const date = new Date().toISOString().slice(0, 10);
  sqlite.prepare("INSERT INTO daily_usage_counters VALUES (?, 'ai_provider_calls', 249, CURRENT_TIMESTAMP)").run(date);
  assert.equal(await reserveDailyUsage(db as never, "ai_provider_calls"), true);
  assert.equal(await reserveDailyUsage(db as never, "ai_provider_calls"), false);
});

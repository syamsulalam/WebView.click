import assert from "node:assert/strict";
import test from "node:test";
import { backupSiteJsonToHistory, siteHistoryPrefix } from "../functions/api/sites/storage";

function mockR2() {
  const store = new Map<string, string>();
  return {
    store,
    async put(key: string, value: string) {
      store.set(key, value);
    },
    async list({ prefix }: { prefix: string }) {
      return { objects: [...store.keys()].filter((key) => key.startsWith(prefix)).map((key) => ({ key })) };
    },
    async delete(keys: string[]) {
      keys.forEach((key) => store.delete(key));
    },
  };
}

test("upgrade backup keeps the newest five history entries and prunes older ones (P3)", async () => {
  const r2 = mockR2();
  for (const stamp of ["2026-01-01-00-00-00", "2026-02-01-00-00-00", "2026-03-01-00-00-00", "2026-04-01-00-00-00", "2026-05-01-00-00-00"]) {
    await r2.put(`sites/biz/history/${stamp}.json`, "{}");
  }
  const result = await backupSiteJsonToHistory({ meta: { businessName: "Biz" } }, { R2: r2 } as never, "biz");
  assert.ok(result && result.key.startsWith(siteHistoryPrefix("biz")));
  assert.ok(r2.store.has(result.key));
  assert.equal(r2.store.size, 5);
  assert.equal(result.pruned, 1);
  assert.ok(!r2.store.has("sites/biz/history/2026-01-01-00-00-00.json"), "oldest backup pruned first");
});

test("upgrade backup returns null without an R2 binding (P3)", async () => {
  assert.equal(await backupSiteJsonToHistory({ meta: {} }, {}, "biz"), null);
});

import assert from "node:assert/strict";
import { createRequire, syncBuiltinESMExports } from "node:module";
import { mkdtempSync, readFileSync, writeFileSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

test("publisher validates first and restores the old revision after an edge verification failure", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "webview-release-test-"));
  const slug = "fixture-" + crypto.randomUUID();
  const root = `releases/${slug}/`;
  const pointer = root + "current.json";
  const prior = "a".repeat(32);
  const previousAsset = root + prior + "/index.html";
  const objects = new Map([[pointer, Buffer.from(JSON.stringify(prior))], [previousAsset, Buffer.from("previous")]]);
  const index = join(dir, "index.html");
  writeFileSync(index, "new");
  const argv = process.argv;
  const exitCode = process.exitCode;
  const childProcess = createRequire(import.meta.url)("node:child_process");
  t.after(() => {
    t.mock.restoreAll();
    syncBuiltinESMExports();
    process.argv = argv;
    process.exitCode = exitCode;
    unlinkSync(index);
    rmdirSync(dir);
  });
  let validated = false;
  let verifiedNewRevision = false;
  t.mock.method(childProcess, "execFileSync", (command: string, args: string[]) => {
    if (command === "where.exe") return "C:/fixture/cf.cmd\n";
    if (command === "python") {
      if (args[0].endsWith("check-smb-export.py")) {
        validated = true;
        return Buffer.alloc(0);
      }
      assert(args[0].endsWith("check-sites-edge.py"));
      assert.notEqual(JSON.parse(objects.get(pointer)!.toString()), prior);
      verifiedNewRevision = true;
      throw new Error("mock edge verification failure");
    }
    const [operation, key] = args.slice(args.indexOf("objects") + 1);
    if (operation === "list") {
      const prefix = args[args.indexOf("--prefix") + 1];
      return Buffer.from(JSON.stringify([...objects.keys()].filter((item) => item.startsWith(prefix)).sort().map((key) => ({ key }))));
    }
    if (operation === "get") return objects.get(key);
    if (operation === "upload") {
      assert(validated);
      objects.set(key, readFileSync(args[args.indexOf("--file") + 1]));
      return Buffer.alloc(0);
    }
    assert.fail("Unexpected external command");
  });
  syncBuiltinESMExports();
  t.mock.method(console, "error", () => {});
  process.argv = [process.execPath, "deploy-site-to-r2.mjs", "--dir", dir, "--slug", slug];
  // Import the CLI entrypoint. Its catch sets the exit code once the mocked rollback finishes.
  await import("../scripts/deploy-site-to-r2.mjs");
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(process.exitCode, 1);
  assert(verifiedNewRevision);
  assert.equal(JSON.parse(objects.get(pointer)!.toString()), prior);
  assert.equal(objects.get(previousAsset)?.toString(), "previous");
});

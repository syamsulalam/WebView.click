#!/usr/bin/env node
/**
 * deploy-site-to-r2.mjs
 * 
 * Publishes a verified static release at a stable business slug.
 * The edge worker streams the ZIP from the active release's own files.
 */

import fs from "fs";
import path from "path";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".zip": "application/zip",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8"
};

function getFilesRecursively(dir, baseDir = dir) {
  let results = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const file of list) {
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory()) {
      results = results.concat(getFilesRecursively(fullPath, baseDir));
    } else if (file.isFile()) {
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, "/");
      results.push({ fullPath, relPath });
    } else {
      throw new Error("The static artifact contains an unsupported file type.");
    }
  }
  return results;
}

async function main() {
  const args = process.argv.slice(2);
  const dirIndex = args.indexOf("--dir");
  const slugIndex = args.indexOf("--slug");
  const bucketIndex = args.indexOf("--bucket");
  const profileIndex = args.indexOf("--profile");
  const verifyIndex = args.indexOf("--verification-run");

  if (args.length === 0 || args.includes("--help")) {
    console.log(`
Usage:
  node deploy-site-to-r2.mjs --dir <path/to/exported-site> --slug <business-slug> [--bucket <bucket_name>] [--profile <cf_profile>]

Arguments:
  --dir       Directory holding exported flat HTML/CSS/JS (from Simply Static)
  --slug      Clean URL slug (e.g. 'bengkel-jaya-motor-auto-repair-id-malang')
  --bucket    R2 bucket for verification runs (default: 'webview-sites')
  --profile   Cloudflare CLI profile (default: 'webview' for 'webview-sites')
  --verification-run  Store this run under private qa/<slug>/<run>/ and compare bytes

  Public runs publish or replace a site at the same slug.
    `);
    process.exit(0);
  }

  const siteDir = dirIndex !== -1 ? args[dirIndex + 1] : null;
  const slug = slugIndex !== -1 ? args[slugIndex + 1] : null;
  const bucket = bucketIndex !== -1 ? args[bucketIndex + 1] : "webview-sites";
  const profile = profileIndex !== -1 ? args[profileIndex + 1] : (bucket === "webview-sites" ? "webview" : null);
  const verificationRun = verifyIndex !== -1 ? args[verifyIndex + 1] : null;
  if (verifyIndex !== -1 && (verificationRun?.length !== 32 || !/^[a-f0-9]{32}$/.test(verificationRun))) {
    throw new Error("Invalid R2 verification run ID.");
  }

  if ((profileIndex !== -1 && !profile) || (profile && !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(profile))) {
    throw new Error("Invalid Cloudflare CLI profile.");
  }
  if (!verificationRun && (bucket !== "webview-sites" || profile !== "webview")) {
    throw new Error("Public publishing requires the webview-sites bucket and webview profile.");
  }

  if (!siteDir || !fs.existsSync(siteDir)) {
    console.error("❌ Error: Valid --dir is required.");
    process.exit(1);
  }

  if (!slug || slug.length > 63 || slug !== slug.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    console.error("❌ Error: --slug must contain up to 63 lowercase letters, digits and single hyphens.");
    process.exit(1);
  }

  console.log(`🚀 Syncing static site "${slug}" to R2 bucket "${bucket}"...`);

  const files = getFilesRecursively(siteDir);
  if (!files.some(({ relPath }) => relPath === "index.html")) {
    throw new Error("The export is missing index.html.");
  }
  console.log(`📁 Found ${files.length} static assets to sync.`);
  if (files.length > 998 || files.some(({ relPath }) =>
    !/^[a-zA-Z0-9_./-]+$/.test(relPath) || relPath.split("/").some(part => part.startsWith(".")) ||
    ["download", "download.zip"].includes(relPath.split("/")[0]))) {
    throw new Error("The export exceeds the ZIP limit or contains an unsupported object name.");
  }

  const profileArgs = profile ? ["--profile", profile] : [];
  const cliEnv = { ...process.env, CF_TIMEOUT: "25000" };
  if (profile) {
    for (const key of Object.keys(cliEnv)) {
      if (key.toUpperCase() === "CLOUDFLARE_API_TOKEN") delete cliEnv[key];
    }
  }
  if (bucket === "webview-sites" && profile === "webview") {
    cliEnv.CLOUDFLARE_ACCOUNT_ID = "5076c806dec2b4df072e537f1a09500c";
  }
  let command = "cf";
  let commandArgs = [];
  if (process.platform === "win32") {
    const shim = execFileSync("where.exe", ["cf.cmd"], { encoding: "utf8" }).split(/\r?\n/)[0];
    command = process.execPath;
    commandArgs = [path.join(path.dirname(shim), "node_modules", "cf", "bin", "cf")];
  }
  const cf = (args_) => execFileSync(command,
    [...commandArgs, ...profileArgs, "r2", "buckets", ...args_, "--bucket-name", bucket],
    { stdio: "pipe", env: cliEnv, timeout: 30000, maxBuffer: 16 * 1024 * 1024 });
  const list = (prefix, limit = 1) => {
    const objects = JSON.parse(cf(["objects", "list", "--prefix", prefix, "--per-page", String(limit)]));
    if (!Array.isArray(objects) || objects.some(({ key }) => typeof key !== "string" || !key.startsWith(prefix))) {
      throw new Error(`Unexpected R2 listing for ${prefix}.`);
    }
    return objects.map(({ key }) => key);
  };
  const upload = (key, file, mime) => cf(["objects", "upload", key, "--file", file, "--content-type", mime]);
  const get = (key) => cf(["objects", "get", key]);
  const remove = (key) => cf(["objects", "delete", key, "--force"]);
  function stage(prefix, attempted) {
    if (list(prefix).length) throw new Error(`R2 prefix already contains files: ${prefix}`);
    for (const { fullPath, relPath } of files) {
      const key = prefix + relPath;
      attempted.push(key);
      upload(key, fullPath, MIME_TYPES[path.extname(relPath).toLowerCase()] || "application/octet-stream");
      if (!get(key).equals(fs.readFileSync(fullPath))) throw new Error(`R2 read-back differs for ${key}.`);
      if (attempted.length % 20 === 0 || attempted.length === files.length) {
        console.log(`  Verified ${attempted.length}/${files.length} R2 objects.`);
      }
    }
  }
  if (verificationRun) {
    const managed = JSON.parse(cf(["domains", "managed", "list"]));
    const custom = JSON.parse(cf(["domains", "custom", "list"]));
    if (managed.enabled !== false || !Array.isArray(custom.domains) || custom.domains.length) {
      throw new Error("R2 verification requires a bucket without public domain access.");
    }
    const prefix = `qa/${slug}/${verificationRun}/`;
    stage(prefix, []);
    console.log(`Verified ${files.length} objects byte-for-byte at r2://${bucket}/${prefix}`);
    return;
  }

  const releaseRoot = `releases/${slug}/`;
  const currentKey = releaseRoot + "current.json";
  const revision = randomUUID().replaceAll("-", "");
  const prefix = releaseRoot + revision + "/";
  // ponytail: one publishing workstation. Use a conditional R2 write before enabling multi-host publishing.
  const lockPath = path.join(tmpdir(), `webview-publish-${slug}.lock`);
  let lock;
  try {
    lock = fs.openSync(lockPath, "wx");
  } catch (error) {
    if (error.code === "EEXIST") throw new Error(`Publication already locked: ${lockPath}`);
    throw error;
  }
  const recordFile = lockPath + ".json";
  try {
    fs.writeFileSync(lock, String(process.pid));
    const active = () => {
      if (!list(currentKey).includes(currentKey)) return null;
      const rev = JSON.parse(get(currentKey));
      if (typeof rev !== "string" || !/^[a-f0-9]{32}$/.test(rev)) throw new Error("Invalid R2 release record.");
      return rev;
    };
    const previous = active();
    const previousPrefix = previous ? releaseRoot + previous + "/" : `sites/${slug}/`;
    const superseded = list(previousPrefix, 1000);
    if (superseded.length > 999) throw new Error("Previous release exceeds the supported cleanup size.");
    const attempted = [];
    try {
      stage(prefix, attempted);
    } catch (error) {
      for (const key of attempted) {
        try { remove(key); } catch { console.warn(`Could not remove incomplete object ${key}.`); }
      }
      throw error;
    }
    if (active() !== previous) throw new Error("The active release changed during staging.");
    fs.writeFileSync(recordFile, JSON.stringify(revision));
    try {
      upload(currentKey, recordFile, "application/json");
    } catch (error) {
      // A lost acknowledgement can follow a successful write. Keep the possibly active files.
      if (active() !== revision) {
        throw new Error(`Activation uncertain for ${revision}. Staged and previous files were kept.`, { cause: error });
      }
    }
    if (active() !== revision) throw new Error("The candidate release is not active.");
    execFileSync("python", [
      fileURLToPath(new URL("check-sites-edge.py", import.meta.url)),
      "--export", siteDir, "--slug", slug, "--revision", revision,
    ], { stdio: "inherit", timeout: 180000 });
    if (active() !== revision) throw new Error("The active release changed during verification.");
    for (const key of superseded) remove(key);
    console.log(`Published ${revision} at https://sites.webview.click/${slug}/`);
    console.log(`ZIP: https://sites.webview.click/${slug}.zip`);
  } finally {
    fs.closeSync(lock);
    fs.rmSync(recordFile, { force: true });
    fs.unlinkSync(lockPath);
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});

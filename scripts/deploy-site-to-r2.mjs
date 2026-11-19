#!/usr/bin/env node
/**
 * deploy-site-to-r2.mjs
 * 
 * Synchronizes static SMB site assets into Cloudflare R2:
 * - Uploads files to `sites/<slug>/*` with proper MIME-types.
 * - ZERO ZIP UPLOAD NEEDED: The edge worker at `sites.webview.click/<slug>/download`
 *   assembles and streams the ZIP file on the fly directly from the `sites/<slug>/*` assets!
 */

import fs from "fs";
import path from "path";
import { execFileSync } from "node:child_process";

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
  ".txt": "text/plain; charset=utf-8"
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

  if (args.length === 0 || args.includes("--help")) {
    console.log(`
Usage:
  node deploy-site-to-r2.mjs --dir <path/to/exported-site> --slug <business-slug> [--bucket <bucket_name>] [--profile <cf_profile>]

Arguments:
  --dir       Directory holding exported flat HTML/CSS/JS (from Simply Static)
  --slug      Clean URL slug (e.g. 'bengkel-jaya-motor')
  --bucket    Cloudflare R2 bucket name (default: 'webview-sites')
  --profile   Cloudflare CLI profile (optional, e.g. 'sandbox-elin')
    `);
    process.exit(0);
  }

  const siteDir = dirIndex !== -1 ? args[dirIndex + 1] : null;
  const slug = slugIndex !== -1 ? args[slugIndex + 1] : null;
  const bucket = bucketIndex !== -1 ? args[bucketIndex + 1] : "webview-sites";
  const profile = profileIndex !== -1 ? args[profileIndex + 1] : null;

  if (!siteDir || !fs.existsSync(siteDir)) {
    console.error("❌ Error: Valid --dir is required.");
    process.exit(1);
  }

  if (!slug || slug.length > 63 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    console.error("❌ Error: --slug must contain up to 63 lowercase letters, digits and single hyphens.");
    process.exit(1);
  }

  console.log(`🚀 Syncing static site "${slug}" to R2 bucket "${bucket}"...`);

  const files = getFilesRecursively(siteDir);
  if (!files.some(({ relPath }) => relPath === "index.html")) {
    throw new Error("The export is missing index.html.");
  }
  console.log(`📁 Found ${files.length} static assets to sync.`);

  const profileArgs = profile ? ["--profile", profile] : [];
  let command = "cf";
  let commandArgs = [];
  if (process.platform === "win32") {
    const shim = execFileSync("where.exe", ["cf.cmd"], { encoding: "utf8" }).split(/\r?\n/)[0];
    command = process.execPath;
    commandArgs = [path.join(path.dirname(shim), "node_modules", "cf", "bin", "cf")];
  }
  let uploaded = 0;

  for (const f of files) {
    const ext = path.extname(f.relPath).toLowerCase();
    const mime = MIME_TYPES[ext] || "application/octet-stream";
    const r2Key = `sites/${slug}/${f.relPath}`;

    try {
      execFileSync(command, [...commandArgs, ...profileArgs, "r2", "buckets", "objects", "upload",
        r2Key, "--bucket-name", bucket, "--file", f.fullPath, "--content-type", mime],
      { stdio: "pipe", env: { ...process.env, CF_TIMEOUT: "300000" }, timeout: 305000 });
      uploaded++;
      if (uploaded % 20 === 0 || uploaded === files.length) {
        console.log(`  ✓ Synced ${uploaded}/${files.length} assets...`);
      }
    } catch (err) {
      console.warn(`  ⚠️ Upload failed for ${r2Key}: ${err.message}`);
    }
  }

  if (uploaded !== files.length) {
    throw new Error("The R2 site upload is incomplete.");
  }

  console.log(`
🎉 Single-Upload Sync Complete!
🌐 Live Preview URL: https://sites.webview.click/${slug}/
📦 Dynamic ZIP URL:  https://sites.webview.click/${slug}/download (streamed dynamically via edge worker)
  `);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});

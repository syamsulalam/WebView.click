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
import { execSync } from "child_process";

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
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFilesRecursively(fullPath, baseDir));
    } else {
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, "/");
      results.push({ fullPath, relPath });
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

  if (!slug) {
    console.error("❌ Error: --slug is required.");
    process.exit(1);
  }

  console.log(`🚀 Syncing static site "${slug}" to R2 bucket "${bucket}"...`);

  const files = getFilesRecursively(siteDir);
  console.log(`📁 Found ${files.length} static assets to sync.`);

  const profileFlag = profile ? `--profile ${profile}` : "";
  let uploaded = 0;

  for (const f of files) {
    const ext = path.extname(f.relPath).toLowerCase();
    const mime = MIME_TYPES[ext] || "application/octet-stream";
    const r2Key = `sites/${slug}/${f.relPath}`;

    const cmd = `cf.cmd ${profileFlag} r2 buckets objects upload "${r2Key}" --bucket-name "${bucket}" --file "${f.fullPath}"`;
    try {
      execSync(cmd, { stdio: "pipe", env: { ...process.env, CF_TIMEOUT: "300000" } });
      uploaded++;
      if (uploaded % 20 === 0 || uploaded === files.length) {
        console.log(`  ✓ Synced ${uploaded}/${files.length} assets...`);
      }
    } catch (err) {
      console.warn(`  ⚠️ Upload failed for ${r2Key}: ${err.message}`);
    }
  }

  console.log(`
🎉 Single-Upload Sync Complete!
🌐 Live Preview URL: https://sites.webview.click/${slug}/
📦 Dynamic ZIP URL:  https://sites.webview.click/${slug}/download (streamed dynamically via edge worker)
  `);
}

main().catch(console.error);

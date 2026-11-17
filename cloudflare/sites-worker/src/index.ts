/**
 * sites.webview.click - Edge Static Site Router & Dynamic R2 Hosting Engine
 * 
 * Features:
 * - Single-Asset Source: Upload once to `sites/<slug>/*`.
 * - Dynamic On-The-Fly ZIP Generation via client-zip:
 *   /<slug>/download streams a compressed ZIP assembled directly from R2 objects without storing a separate .zip file!
 * - Automatic index.html resolution for root and subdirectories
 * - Extension-less URL resolution (/about -> /about.html or /about/index.html)
 * - Trailing slash normalization (308 redirect)
 * - Automatic MIME-type header detection
 * - Cloudflare Cache API integration (both HTML and dynamic ZIP cached at edge)
 * - Security headers & custom 404 fallback
 */

import { downloadZip, InputWithSizeMeta } from "client-zip";

export interface Env {
  SITES_BUCKET: R2Bucket;
}

const MIME_TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "application/javascript; charset=utf-8",
  mjs: "application/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
  gif: "image/gif",
  ico: "image/x-icon",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  xml: "application/xml; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  zip: "application/zip",
  pdf: "application/pdf"
};

function getMimeType(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  return MIME_TYPES[ext] || "application/octet-stream";
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const url = new URL(request.url);
    const pathname = decodeURIComponent(url.pathname);

    // Root route: redirect to main platform
    if (pathname === "/" || pathname === "") {
      return Response.redirect("https://webview.click", 302);
    }

    // Check Cloudflare Edge Cache first
    const cache = caches.default;
    const cacheKey = new Request(url.toString(), request);
    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
      return cachedResponse;
    }

    const pathSegments = pathname.split("/").filter(Boolean);
    const slug = pathSegments[0]; // e.g. 'bengkel-jaya-motor'
    const subPath = pathSegments.slice(1).join("/"); // e.g. 'about' or 'download'

    // =========================================================================
    // Dynamic On-The-Fly ZIP Streaming: /<slug>/download or /<slug>/download.zip
    // =========================================================================
    if (subPath === "download" || subPath === "download.zip") {
      const sitePrefix = `sites/${slug}/`;
      const listed = await env.SITES_BUCKET.list({ prefix: sitePrefix, limit: 1000 });

      if (!listed.objects || listed.objects.length === 0) {
        return new Response(`Site files for "${slug}" not found in storage.`, { status: 404 });
      }

      // Fetch file objects and map to streaming zip inputs
      const zipInputs: InputWithSizeMeta[] = [];
      for (const obj of listed.objects) {
        // Strip the "sites/<slug>/" prefix so the downloaded zip extracts cleanly into root
        const relativeName = obj.key.replace(sitePrefix, "");
        if (!relativeName) continue;

        const fileObj = await env.SITES_BUCKET.get(obj.key);
        if (fileObj && fileObj.body) {
          zipInputs.push({
            name: relativeName,
            input: fileObj.body,
            size: obj.size,
            lastModified: obj.uploaded
          });
        }
      }

      if (zipInputs.length === 0) {
        return new Response(`No files available to package for "${slug}".`, { status: 404 });
      }

      // Generate streaming ZIP response via client-zip
      const zipResponse = downloadZip(zipInputs);
      const headers = new Headers(zipResponse.headers);
      headers.set("Content-Type", "application/zip");
      headers.set("Content-Disposition", `attachment; filename="${slug}.zip"`);
      // Cache the generated zip at edge for 7 days
      headers.set("Cache-Control", "public, max-age=86400, s-maxage=604800");

      const response = new Response(zipResponse.body, {
        status: 200,
        headers
      });

      ctx.waitUntil(cache.put(cacheKey, response.clone()));
      return response;
    }

    // Trailing slash enforcement for site root: /<slug> -> /<slug>/
    if (pathSegments.length === 1 && !pathname.endsWith("/")) {
      return Response.redirect(`${url.origin}/${slug}/${url.search}`, 308);
    }

    // =========================================================================
    // Static Site Serving: /<slug>/...
    // =========================================================================
    const candidateKeys: string[] = [];

    if (!subPath || subPath === "") {
      candidateKeys.push(`sites/${slug}/index.html`);
    } else {
      const hasExtension = subPath.includes(".") && !subPath.endsWith("/");
      if (hasExtension) {
        candidateKeys.push(`sites/${slug}/${subPath}`);
      } else {
        const cleanSub = subPath.replace(/\/$/, "");
        candidateKeys.push(`sites/${slug}/${cleanSub}/index.html`);
        candidateKeys.push(`sites/${slug}/${cleanSub}.html`);
      }
    }

    let object: R2ObjectBody | null = null;
    let resolvedKey = "";

    for (const key of candidateKeys) {
      const candidate = await env.SITES_BUCKET.get(key);
      if (candidate) {
        object = candidate;
        resolvedKey = key;
        break;
      }
    }

    // Custom 404 handling
    if (!object) {
      const custom404 = await env.SITES_BUCKET.get(`sites/${slug}/404.html`);
      if (custom404) {
        const headers = new Headers();
        headers.set("Content-Type", "text/html; charset=utf-8");
        headers.set("Cache-Control", "public, max-age=300");
        return new Response(custom404.body, { status: 404, headers });
      }

      return new Response(
        `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Situs Tidak Ditemukan - ${slug}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0f172a; color: #f8fafc; text-align: center; }
    .card { max-width: 480px; padding: 2.5rem; background: #1e293b; border-radius: 1rem; border: 1px solid #334155; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
    h1 { font-size: 2.5rem; margin: 0 0 1rem; color: #38bdf8; }
    p { color: #94a3b8; line-height: 1.6; margin-bottom: 1.5rem; }
    a { display: inline-block; padding: 0.75rem 1.5rem; background: #2563eb; color: #fff; text-decoration: none; border-radius: 0.5rem; font-weight: 600; }
    a:hover { background: #1d4ed8; }
  </style>
</head>
<body>
  <div class="card">
    <h1>404</h1>
    <p>Preview situs untuk <strong>${slug}</strong> belum tersedia atau belum selesai di-generate.</p>
    <a href="https://webview.click">Kembali ke Beranda</a>
  </div>
</body>
</html>`,
        { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);

    const mime = getMimeType(resolvedKey);
    headers.set("Content-Type", mime);

    const isHtml = mime.includes("text/html");
    const cacheControl = isHtml
      ? "public, max-age=300, s-maxage=3600, must-revalidate"
      : "public, max-age=604800, s-maxage=2592000, immutable";
    headers.set("Cache-Control", cacheControl);

    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("X-Frame-Options", "ALLOW-FROM https://webview.click");
    headers.set("Access-Control-Allow-Origin", "*");
    if (object.httpEtag) headers.set("ETag", object.httpEtag);

    const response = new Response(object.body, { headers });
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  }
};

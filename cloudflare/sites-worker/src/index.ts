/**
 * sites.webview.click - Edge Static Site Router & Dynamic R2 Hosting Engine
 * 
 * Features:
 * - One active version of the files serves both preview and download.
 * - Dynamic On-The-Fly ZIP Generation via client-zip:
 *   /<slug>.zip streams a ZIP assembled directly from R2 objects.
 * - Automatic index.html resolution for root and subdirectories
 * - Extension-less URL resolution (/about -> /about.html or /about/index.html)
 * - Trailing slash normalization (308 redirect)
 * - Automatic MIME-type header detection
 * - Cloudflare Cache API integration (both HTML and dynamic ZIP cached at edge)
 * - Security headers & custom 404 fallback
 */

import { downloadZip } from "client-zip";

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

function objectBody(object: R2Object | R2ObjectBody) {
  return "body" in object && object.body instanceof ReadableStream ? object.body : null;
}

const downloadStyle = `<style id="webview-download-style">
#webview-download{position:fixed;inset:auto calc(1rem + env(safe-area-inset-right,0px)) calc(4.5rem + env(safe-area-inset-bottom,0px)) auto;z-index:1000;box-sizing:border-box;display:inline-flex;align-items:center;gap:.5rem;min-height:44px;padding:.625rem .875rem;border:1px solid #fff;border-radius:999px;background:#172b3a;color:#fff;font:600 14px/1.25 system-ui,sans-serif;text-decoration:none;box-shadow:0 2px 8px #0003}
#webview-download:hover{text-decoration:underline}#webview-download:focus-visible{outline:3px solid #14619b;outline-offset:2px}
#webview-download svg{flex:none;width:1.125rem;height:1.125rem}
html:has(#webview-download){scroll-padding-bottom:calc(7.5rem + env(safe-area-inset-bottom,0px))}
</style>`;

function withPreviewDownload(response: Response, slug: string, head: boolean) {
  if (response.status !== 200 || !response.headers.get("Content-Type")?.startsWith("text/html")) {
    return head ? new Response(null, response) : response;
  }
  const outgoing = new Response(head ? null : response.body, response);
  // These describe the original R2 object, whose bytes are kept in the ZIP and cache.
  outgoing.headers.delete("ETag");
  outgoing.headers.delete("Content-Length");
  if (head) return outgoing;
  const link = `<a id="webview-download" href="https://webview.click/site-package/${slug}"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m-5-5 5 5 5-5M5 16v4h14v-4"/></svg>Download Your Site</a>`;
  let hasHead = false;
  let hasBody = false;
  return new HTMLRewriter()
    .on("head", { element(element) {
      hasHead = true;
      element.append(downloadStyle, { html: true });
    } })
    .on("body", { element(element) {
      hasBody = true;
      element.append(link, { html: true });
    } })
    .onDocument({ end(end) {
      // Some valid static outputs omit explicit head and body tags.
      if (!hasHead) end.append(downloadStyle, { html: true });
      if (!hasBody) end.append(link, { html: true });
    } })
    .transform(outgoing);
}

async function* zipEntries(bucket: R2Bucket, objects: R2Object[], prefix: string) {
  for (const { key, etag } of objects) {
    const name = key.slice(prefix.length);
    if (!name) continue;

    const object = await bucket.get(key, { onlyIf: { etagMatches: etag } });
    if (!object || !("body" in object)) {
      throw new Error("The site changed while its archive was being built.");
    }
    yield { name, input: object.body, lastModified: object.uploaded, size: object.size };
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const url = new URL(request.url);
    const pathname = url.pathname;

    // Root route: redirect to main platform
    if (pathname === "/" || pathname === "") {
      return Response.redirect("https://webview.click", 302);
    }

    let pathSegments: string[];
    try {
      pathSegments = pathname.split("/").filter(Boolean).map(decodeURIComponent);
    } catch {
      return new Response("Bad request", { status: 400 });
    }
    const [firstSegment = "", ...segments] = pathSegments;
    const directZip = segments.length === 0 && !pathname.endsWith("/") && firstSegment.endsWith(".zip");
    const slug = directZip ? firstSegment.slice(0, -4) : firstSegment;
    if (slug.length > 63 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
        segments.some(part => part === "." || part === ".." || /[/\\\p{Cc}]/u.test(part))) {
      return new Response("Not found", { status: 404 });
    }
    const subPath = segments.join("/");
    const head = request.method === "HEAD";
    if (pathSegments.length === 1 && !pathname.endsWith("/") && !directZip) {
      return Response.redirect(`${url.origin}/${slug}/${url.search}`, 308);
    }

    const current = await env.SITES_BUCKET.get(`releases/${slug}/current.json`);
    let revision = "";
    if (current) {
      const record = await current.json<unknown>().catch(() => null);
      if (typeof record !== "string" || !/^[a-f0-9]{32}$/.test(record)) {
        return new Response("Published revision unavailable", { status: 503 });
      }
      revision = record;
    }
    const sitePrefix = revision ? `releases/${slug}/${revision}/` : `sites/${slug}/`;
    const archive = directZip || subPath === "download" || subPath === "download.zip";
    const cache = caches.default;
    const internalUrl = new URL(url);
    internalUrl.pathname = `/.webview-cache/${revision || "flat"}${archive ? `/archive/${slug}.zip` : `/page${pathname}`}`;
    internalUrl.search = "";
    const cacheKey = new Request(internalUrl);
    const deliver = (response: Response) => {
      const outgoing = new Response(head ? null : response.body, response);
      outgoing.headers.set("Cache-Control", "private, no-store, no-transform");
      outgoing.headers.set("X-WebView-Release", revision || "flat");
      return withPreviewDownload(outgoing, slug, head);
    };
    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse && (head || cachedResponse.body)) {
      return deliver(cachedResponse);
    }

    // =========================================================================
    // Dynamic ZIP streaming with compatibility for existing download links.
    // =========================================================================
    if (archive) {
      // Reserve two R2 requests for the current version and the object listing.
      const listed = await env.SITES_BUCKET.list({ prefix: sitePrefix, limit: 998 });

      if (!listed.objects || listed.objects.length === 0) {
        return new Response(`Site files for "${slug}" not found in storage.`, { status: 404 });
      }

      if (listed.truncated) {
        return new Response("Too many files to package", { status: 413 });
      }
      const headers = new Headers({
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${slug}.zip"`,
        "Cache-Control": "public, max-age=300, s-maxage=3600",
      });
      if (head) return deliver(new Response(null, { headers }));

      const response = new Response(downloadZip(zipEntries(env.SITES_BUCKET, listed.objects, sitePrefix)).body, { headers });
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
      return deliver(response);
    }

    // =========================================================================
    // Static Site Serving: /<slug>/...
    // =========================================================================
    const candidateKeys: string[] = [];

    if (!subPath || subPath === "") {
      candidateKeys.push(sitePrefix + "index.html");
    } else {
      const hasExtension = subPath.includes(".") && !subPath.endsWith("/");
      if (hasExtension) {
        candidateKeys.push(sitePrefix + subPath);
      } else {
        const cleanSub = subPath.replace(/\/$/, "");
        candidateKeys.push(sitePrefix + cleanSub + "/index.html");
        candidateKeys.push(sitePrefix + cleanSub + ".html");
      }
    }

    let object: R2Object | R2ObjectBody | null = null;
    let resolvedKey = "";

    for (const key of candidateKeys) {
      const candidate = await (head ? env.SITES_BUCKET.head(key) : env.SITES_BUCKET.get(key));
      if (candidate) {
        object = candidate;
        resolvedKey = key;
        break;
      }
    }

    // Custom 404 handling
    if (!object) {
      const notFoundKey = sitePrefix + "404.html";
      const custom404 = await (head ? env.SITES_BUCKET.head(notFoundKey) : env.SITES_BUCKET.get(notFoundKey));
      if (custom404) {
        const headers = new Headers();
        headers.set("Content-Type", "text/html; charset=utf-8");
        headers.set("Cache-Control", "private, no-store, no-transform");
        return new Response(objectBody(custom404), { status: 404, headers });
      }

      return new Response(
        head ? null : `<!DOCTYPE html>
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
        { status: 404, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
      );
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);

    const mime = getMimeType(resolvedKey);
    headers.set("Content-Type", mime);

    const isHtml = mime.includes("text/html");
    const cacheControl = isHtml
      ? "public, max-age=300, s-maxage=3600, must-revalidate, no-transform"
      : "public, max-age=604800, s-maxage=2592000, immutable";
    headers.set("Cache-Control", cacheControl);

    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("X-Frame-Options", "ALLOW-FROM https://webview.click");
    headers.set("Access-Control-Allow-Origin", "*");
    if (object.httpEtag) headers.set("ETag", object.httpEtag);

    const response = new Response(objectBody(object), { headers });
    if (!head) ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return deliver(response);
  }
};

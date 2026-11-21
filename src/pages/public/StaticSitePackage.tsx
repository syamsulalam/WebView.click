import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import WebsiteActionPanel from "../../components/WebsiteActionPanel";

const ORIGIN = "https://sites.webview.click";

export default function StaticSitePackage() {
  const { slug = "" } = useParams();
  const valid = slug.length <= 63 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
  const previewUrl = valid ? `${ORIGIN}/${slug}/` : "";
  const [result, setResult] = useState<{ slug: string; siteName: string; urls: string[] } | null>(null);
  const [failedSlug, setFailedSlug] = useState<string | null>(null);

  useEffect(() => {
    if (!previewUrl) return;
    const controller = new AbortController();
    async function read(url: string, optional = false) {
      const response = await fetch(url, { signal: controller.signal });
      if (optional && response.status === 404) return "";
      if (!response.ok) throw new Error("Website package unavailable.");
      return response.text();
    }
    Promise.all([read(previewUrl), read(previewUrl + "sitemap.xml", true)]).then(([html, xml]) => {
      const template = document.createElement("template");
      template.innerHTML = html;
      const home = template.content;
      const siteName = (home.querySelector('meta[property="og:site_name"]')?.getAttribute("content") ||
        home.querySelector("#masthead .site-title, title")?.textContent || "").trim().slice(0, 160) || slug.replace(/-/g, " ");
      const sitemap = new DOMParser().parseFromString(xml, "application/xml");
      const urls = new Set([previewUrl]);
      for (const element of sitemap.getElementsByTagName("loc")) {
        const source = element.textContent?.trim();
        if (!source || !source.startsWith(previewUrl)) continue;
        const target = new URL(source);
        if (target.origin === ORIGIN && target.pathname.startsWith(`/${slug}/`) && !target.search && !target.hash) {
          urls.add(target.href);
        }
      }
      if (!controller.signal.aborted) setResult({ slug, siteName, urls: [...urls] });
    }).catch(() => {
      if (!controller.signal.aborted) setFailedSlug(slug);
    });
    return () => controller.abort();
  }, [slug, previewUrl]);

  const ready = result?.slug === slug ? result : null;
  const failed = !valid || failedSlug === slug;
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950">
      <div className="mx-auto max-w-2xl">
        {previewUrl && <a href={previewUrl} className="text-sm font-semibold text-indigo-700 underline">Back to website preview</a>}
        <h1 className="mb-5 mt-3 text-2xl font-bold">{ready ? `Your website for ${ready.siteName}` : "Your website package"}</h1>
        {failed && <p role="alert">This website package is unavailable.</p>}
        {!failed && !ready && <p role="status">Loading your website package…</p>}
        {ready && (
          <WebsiteActionPanel
            key={slug}
            variant="public"
            businessId={slug}
            siteData={{ meta: { businessId: slug, businessName: ready.siteName } }}
            staticPackage={{ downloadUrl: `${ORIGIN}/${slug}.zip`, urls: ready.urls, previewUrl }}
          />
        )}
      </div>
    </main>
  );
}

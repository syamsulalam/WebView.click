import templateSchema from "../../../JSON/template-schema.json";
import SiteRenderer from "../../components/SiteRenderer";

export default function DemoSite() {
  const siteData = templateSchema as any;
  const sections = siteData.pages.flatMap((page: any) =>
    page.sections.map((section: any) => `${page.pageId}:${section.type}`),
  );

  return (
    <div className="relative">
      <div className="fixed top-4 right-4 z-[200] w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white/95 backdrop-blur shadow-xl p-4 text-sm text-slate-700">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-slate-950">Demo JSON Sample</p>
            <p className="text-xs text-slate-500 mt-1">Source: JSON/template-schema.json</p>
          </div>
          <a href="/admin/schema" className="text-xs font-medium text-indigo-700 hover:underline">Schema</a>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg bg-slate-50 border border-slate-100 p-2">
            <p className="text-slate-500">Business</p>
            <p className="font-medium text-slate-900 truncate">{siteData.meta.businessName}</p>
          </div>
          <div className="rounded-lg bg-slate-50 border border-slate-100 p-2">
            <p className="text-slate-500">Sections</p>
            <p className="font-medium text-slate-900">{sections.length}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {sections.map((section: string) => (
            <span key={section} className="rounded-full bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-700">
              {section}
            </span>
          ))}
        </div>
      </div>
      <SiteRenderer
        siteData={siteData}
        businessId={siteData.meta.businessId}
        showProspectPanel={false}
      />
    </div>
  );
}

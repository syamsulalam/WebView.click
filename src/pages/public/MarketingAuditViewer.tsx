import { AlertCircle, ArrowUpRight, Clock, Download, FileText, Globe2, Save, Star, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { downloadMarketingAuditPdf } from "../../lib/exportMarketingAuditPdf";
import type { MarketingAudit, MarketingAuditCategory } from "../../lib/marketingAudit";

function statusClass(status: string) {
  if (status === "strong") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "urgent") return "border-red-200 bg-red-50 text-red-800";
  if (status === "unknown") return "border-slate-200 bg-slate-50 text-slate-700";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

function scoreColor(score: number) {
  if (score >= 78) return "text-emerald-600";
  if (score >= 52) return "text-amber-600";
  return "text-red-600";
}

function formatPercent(value: number) {
  return `${Math.round((value || 0) * 100)}%`;
}

function CategoryCard({ category }: { category: MarketingAuditCategory }) {
  const width = category.max ? Math.max(4, Math.min(100, (category.score / category.max) * 100)) : 0;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-950">{category.label}</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">{category.summary}</p>
        </div>
        <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${statusClass(category.status)}`}>{category.status}</span>
      </div>
      <div className="mt-4">
        <div className="mb-1 flex justify-between text-xs font-semibold text-slate-500">
          <span>{category.score}/{category.max}</span>
          <span>{Math.round(width)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-slate-900" style={{ width: `${width}%` }} />
        </div>
      </div>
      <ul className="mt-4 space-y-1.5 text-sm text-slate-600">
        {category.evidence.slice(0, 3).map((item) => <li key={item}>- {item}</li>)}
      </ul>
    </div>
  );
}

export default function MarketingAuditViewer() {
  const { businessId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [audit, setAudit] = useState<MarketingAudit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingSnapshot, setSavingSnapshot] = useState(false);
  const [snapshotMessage, setSnapshotMessage] = useState("");
  const [snapshotError, setSnapshotError] = useState("");
  const snapshotId = searchParams.get("snapshot") || "";
  const adminMode = searchParams.get("admin") === "1" || Boolean(snapshotId);

  useEffect(() => {
    if (!businessId) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    setAudit(null);
    setSnapshotMessage("");
    setSnapshotError("");
    const params = new URLSearchParams();
    params.set("ts", String(Date.now()));
    if (snapshotId) params.set("snapshot", snapshotId);
    fetch(`/api/audits/${encodeURIComponent(businessId)}?${params.toString()}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.error || `Audit request returned HTTP ${response.status}`);
        return data as MarketingAudit;
      })
      .then((data) => {
        if (!cancelled) setAudit(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Audit could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [businessId, snapshotId]);

  const handleSaveSnapshot = async () => {
    if (!businessId) return;
    setSavingSnapshot(true);
    setSnapshotMessage("");
    setSnapshotError("");
    try {
      const response = await fetch(`/api/audits/${encodeURIComponent(businessId)}/snapshots`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || `Snapshot save returned HTTP ${response.status}`);
      if (data.audit) setAudit(data.audit);
      const id = data.snapshot?.id || data.audit?.snapshot?.id || "";
      setSnapshotMessage(id ? `Saved snapshot ${id.slice(0, 8)}.` : "Saved audit snapshot.");
      if (id) setSearchParams({ admin: "1", snapshot: id });
    } catch (err) {
      setSnapshotError(err instanceof Error ? err.message : "Could not save audit snapshot.");
    } finally {
      setSavingSnapshot(false);
    }
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">Loading audit...</div>;
  }

  if (error || !audit) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-center">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <AlertCircle className="mx-auto text-red-500" size={28} />
          <h1 className="mt-3 text-2xl font-bold text-slate-950">Audit could not be loaded</h1>
          <p className="mt-2 text-sm text-slate-600">{error || "No audit data was returned."}</p>
          <Link to="/" className="mt-5 inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">Back to WebView.click</Link>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-5 py-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-indigo-700">
                <FileText size={14} />
                Google Business Profile Audit
              </p>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">{audit.businessName}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
                This audit compares the available Google Business Profile data against cached local competitors and turns the gaps into practical next actions.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {adminMode && (
                <button
                  type="button"
                  onClick={handleSaveSnapshot}
                  disabled={savingSnapshot}
                  className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-800 hover:bg-indigo-100 disabled:opacity-60"
                >
                  <Save size={16} />
                  {savingSnapshot ? "Saving..." : "Save audit snapshot"}
                </button>
              )}
              <button
                type="button"
                onClick={() => downloadMarketingAuditPdf(audit)}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
              >
                <Download size={16} />
                Download audit PDF
              </button>
              {audit.target.generatedPreviewAvailable && (
                <a
                  href={`/${audit.businessId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  <Globe2 size={16} />
                  View website preview
                </a>
              )}
            </div>
          </div>
          {adminMode && (
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <div className="flex flex-wrap items-center gap-2">
                <Clock size={16} className="text-slate-500" />
                {audit.snapshot ? (
                  <span>
                    Viewing saved snapshot {audit.snapshot.id.slice(0, 8)}
                    {audit.snapshot.createdAt ? ` from ${new Date(audit.snapshot.createdAt).toLocaleString()}` : ""}.
                  </span>
                ) : audit.latestSnapshot ? (
                  <span>
                    Latest saved snapshot: {audit.latestSnapshot.id.slice(0, 8)}
                    {audit.latestSnapshot.createdAt ? ` from ${new Date(audit.latestSnapshot.createdAt).toLocaleString()}` : ""}.
                  </span>
                ) : (
                  <span>No saved audit snapshot yet. Save one before outreach if you want a stable point-in-time record.</span>
                )}
                {audit.snapshot?.stale && (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                    Snapshot is stale vs live source data
                  </span>
                )}
                {audit.snapshot && (
                  <Link to={`/audit/${audit.businessId}?admin=1`} className="font-semibold text-indigo-700 hover:underline">
                    View live audit
                  </Link>
                )}
              </div>
              {snapshotMessage && <p className="mt-2 text-emerald-700">{snapshotMessage}</p>}
              {snapshotError && <p className="mt-2 text-red-700">{snapshotError}</p>}
            </div>
          )}
          <div className="mt-8 grid gap-4 md:grid-cols-[0.8fr_1.2fr]">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-500">Profile readiness score</p>
              <div className="mt-2 flex items-end gap-2">
                <span className={`text-6xl font-black tracking-tight ${scoreColor(audit.score.total)}`}>{audit.score.total}</span>
                <span className="pb-2 text-lg font-bold text-slate-500">/100</span>
              </div>
              <p className="mt-2 text-sm font-semibold capitalize text-slate-700">{audit.score.label.replace("-", " ")}</p>
              <p className="mt-3 text-xs leading-relaxed text-slate-500">Confidence: {audit.confidence}. Source: {audit.source.profileDataSource.replace(/_/g, " ")}.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">Why this matters</p>
              <p className="mt-3 text-lg font-semibold leading-snug text-slate-950">{audit.ownerFacingCopy.problemFrame}</p>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{audit.ownerFacingCopy.customerJourneyRisk}</p>
              <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">{audit.ownerFacingCopy.evidenceLine}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-8">
        <div className="grid gap-4 md:grid-cols-4">
          {audit.evidence.comparisonCards.map((card) => (
            <div key={card.key} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{card.title}</p>
              <p className="mt-3 text-sm font-medium text-slate-500">{card.targetLabel}</p>
              <p className="text-2xl font-black text-slate-950">{card.targetValue}</p>
              <p className="mt-3 text-sm font-medium text-slate-500">{card.competitorLabel}</p>
              <p className="text-lg font-bold text-slate-800">{card.competitorValue}</p>
              <span className={`mt-4 inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${statusClass(card.status)}`}>{card.status}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-5 px-5 pb-8 lg:grid-cols-2">
        {audit.score.categories.map((category) => <CategoryCard key={category.key} category={category} />)}
      </section>

      <section className="mx-auto grid max-w-6xl gap-5 px-5 pb-8 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">Competitor comparison</p>
              <h2 className="mt-1 text-xl font-bold text-slate-950">Visible local profile set</h2>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{audit.competitors.total} competitors</span>
          </div>
          <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-3"><span className="block text-slate-500">Website rate</span><strong>{formatPercent(audit.competitors.websiteRate)}</strong></div>
            <div className="rounded-xl bg-slate-50 p-3"><span className="block text-slate-500">Avg rating</span><strong>{audit.competitors.averageRating?.toFixed(1) || "-"}</strong></div>
            <div className="rounded-xl bg-slate-50 p-3"><span className="block text-slate-500">Median reviews</span><strong>{Math.round(audit.competitors.medianReviewCount || 0).toLocaleString()}</strong></div>
          </div>
          <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Business</th>
                  <th className="px-3 py-2">Website</th>
                  <th className="px-3 py-2">Rating</th>
                  <th className="px-3 py-2">Reviews</th>
                  <th className="px-3 py-2">Photos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {audit.competitors.rows.slice(0, 10).map((row) => (
                  <tr key={`${row.placeId || row.name}-${row.address || ""}`}>
                    <td className="px-3 py-2 font-medium text-slate-800">{row.name}</td>
                    <td className="px-3 py-2 text-slate-600">{row.websiteAssessment?.label || "-"}</td>
                    <td className="px-3 py-2 text-slate-600">{row.rating?.toFixed(1) || "-"}</td>
                    <td className="px-3 py-2 text-slate-600">{Math.round(row.reviewCount || 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-slate-600">{Math.round(row.photoCount || 0).toLocaleString()}</td>
                  </tr>
                ))}
                {!audit.competitors.rows.length && (
                  <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">No cached competitor rows were available for this audit yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-slate-500"><TrendingUp size={15} /> What to fix first</p>
            <p className="mt-3 text-sm leading-relaxed text-slate-700">{audit.ownerFacingCopy.directRecommendation}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-slate-500"><Star size={15} /> How WebView.click can help</p>
            <div className="mt-4 space-y-4">
              {audit.offer.services.map((service) => (
                <div key={service.key} className="rounded-xl bg-slate-50 p-3">
                  <p className="font-semibold text-slate-950">{service.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">{service.description}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">Source notes</p>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-600">
              {audit.missingDataNotes.map((note) => <li key={note}>- {note}</li>)}
            </ul>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-950">Recommended next step</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
              Use the audit and website preview together: the audit explains the problem, and the preview shows the fastest practical fix.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => downloadMarketingAuditPdf(audit)} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
              <Download size={16} />
              Download PDF
            </button>
            {audit.target.generatedPreviewAvailable && (
              <a href={`/${audit.businessId}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                Open preview <ArrowUpRight size={16} />
              </a>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

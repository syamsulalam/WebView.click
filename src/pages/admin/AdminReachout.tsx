import { useEffect, useMemo, useState } from "react";
import { BookOpen, RefreshCw, Search } from "lucide-react";
import HelpTooltip from "../../components/HelpTooltip";
import reachoutPlanMarkdown from "../../../REACHOUT_PLAN.md?raw";
import ReachoutLeadTable from "./reachout/ReachoutLeadTable";
import ReachoutStatsCards from "./reachout/ReachoutStatsCards";
import {
  reachoutCampaign,
  trackingTokenForLead,
  trackedPreviewUrl,
  validReachoutEmail,
  type OutreachBusinessSummary,
  type ReachoutLead,
} from "./reachout/reachoutUtils";

type OutreachSummaryResponse = {
  totals?: Record<string, unknown>;
  byBusinessId?: OutreachBusinessSummary[];
};

const filters = [
  { id: "ready", label: "Ready" },
  { id: "sent", label: "Sent" },
  { id: "viewed", label: "Viewed" },
  { id: "paid", label: "Paid" },
] as const;

type FilterId = typeof filters[number]["id"];

export default function AdminReachout() {
  const [leads, setLeads] = useState<ReachoutLead[]>([]);
  const [summary, setSummary] = useState<OutreachSummaryResponse>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterId>("ready");
  const [copiedKey, setCopiedKey] = useState("");
  const [markingSentId, setMarkingSentId] = useState("");
  const [planOpen, setPlanOpen] = useState(false);

  const summaries = useMemo(() => {
    const map = new Map<string, OutreachBusinessSummary>();
    (summary.byBusinessId || []).forEach((item) => {
      if (item.business_id) map.set(item.business_id, item);
    });
    return map;
  }, [summary.byBusinessId]);

  const load = async () => {
    setLoading(true);
    setMessage("");
    try {
      const [leadsResponse, summaryResponse] = await Promise.all([
        fetch("/api/leads", { cache: "no-store" }),
        fetch("/api/outreach/summary", { cache: "no-store" }),
      ]);
      if (!leadsResponse.ok) throw new Error(`Leads request failed: HTTP ${leadsResponse.status}`);
      if (!summaryResponse.ok) throw new Error(`Outreach summary failed: HTTP ${summaryResponse.status}`);
      const [leadsData, summaryData] = await Promise.all([leadsResponse.json(), summaryResponse.json()]);
      setLeads(Array.isArray(leadsData) ? leadsData : []);
      setSummary(summaryData || {});
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load reachout data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const emailReadyLeads = useMemo(() => leads.filter((lead) => validReachoutEmail(lead.email)), [leads]);
  const sentCount = Number(summary.totals?.businesses_sent || 0);
  const viewedCount = Number(summary.totals?.businesses_viewed || 0);
  const paidCount = leads.filter((lead) => lead.status === "won_paid" || lead.payment_status === "paid").length;

  const filteredLeads = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return emailReadyLeads
      .filter((lead) => {
        const businessSummary = summaries.get(lead.business_id);
        const sent = Number(businessSummary?.sent_count || 0) > 0 || Boolean(lead.last_contacted);
        const viewed = Number(businessSummary?.owner_view_count || lead.owner_view_count || 0) > 0;
        const paid = lead.status === "won_paid" || lead.payment_status === "paid";
        if (activeFilter === "ready" && (sent || viewed || paid)) return false;
        if (activeFilter === "sent" && (!sent || viewed || paid)) return false;
        if (activeFilter === "viewed" && (!viewed || paid)) return false;
        if (activeFilter === "paid" && !paid) return false;
        if (!normalizedQuery) return true;
        return [
          lead.business_name,
          lead.business_id,
          lead.email,
          lead.niche,
          lead.address,
        ].some((value) => String(value || "").toLowerCase().includes(normalizedQuery));
      })
      .slice(0, 250);
  }, [activeFilter, emailReadyLeads, query, summaries]);

  const copyValue = async (key: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey((current) => (current === key ? "" : current)), 1400);
  };

  const recordEvent = async (lead: ReachoutLead, eventType: "link_created" | "email_sent_manual") => {
    if (eventType === "email_sent_manual") setMarkingSentId(lead.id);
    try {
      const response = await fetch("/api/outreach/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          businessId: lead.business_id,
          channel: "email",
          campaign: reachoutCampaign,
          source: "admin_reachout",
          eventType,
          trackingToken: trackingTokenForLead(lead, "email"),
          url: trackedPreviewUrl(lead, "email"),
          metadata: { email: lead.email, businessName: lead.business_name },
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || `Outreach event failed: HTTP ${response.status}`);
      }
      if (eventType === "email_sent_manual") await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to record outreach event.");
    } finally {
      if (eventType === "email_sent_manual") setMarkingSentId("");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Reachout Command Center</p>
              <HelpTooltip text="Email-first workflow for delivering 10,000 free personalized websites. SMS, LinkedIn, and Instagram remain manual/compliance-gated for now." />
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Free-site email outreach</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Prioritize leads with valid emails, copy a short first-touch message, send from the chosen email provider, then mark sent. Every copied/opened link includes owner and campaign tracking.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPlanOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <BookOpen size={16} />
              Plan
            </button>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 shadow-sm hover:bg-indigo-100 disabled:cursor-wait disabled:opacity-60"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        <ReachoutStatsCards
          emailReadyCount={emailReadyLeads.length}
          sentCount={sentCount}
          viewedCount={viewedCount}
          paidCount={paidCount}
          leads={leads}
        />

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {filters.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setActiveFilter(filter.id)}
                  className={`rounded-xl px-3 py-2 text-sm font-semibold ${activeFilter === filter.id ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <label className="relative min-w-0 lg:w-96">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search business, email, niche, address"
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              />
            </label>
          </div>
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
            Current automation stops at copy/link tracking and manual sent logging. Do not use this page for SMS blast or LinkedIn/Instagram automation until consent/platform rules are solved.
          </div>
        </div>

        {message && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {message}
          </div>
        )}

        <ReachoutLeadTable
          leads={filteredLeads}
          summaries={summaries}
          copiedKey={copiedKey}
          markingSentId={markingSentId}
          onCopy={copyValue}
          onRecordEvent={recordEvent}
        />

        {planOpen && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-slate-950/40 p-4">
            <div className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">Reachout plan</p>
                  <h2 className="text-lg font-bold text-slate-950">REACHOUT_PLAN.md</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setPlanOpen(false)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
              <pre className="overflow-auto whitespace-pre-wrap p-5 text-xs leading-5 text-slate-700">
                {reachoutPlanMarkdown}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { Check, Copy, ExternalLink, Mail, MousePointerClick } from "lucide-react";
import HoverTooltip from "../../../components/HoverTooltip";
import { emailFirstTouch, formatDateTime, trackedPreviewUrl, type OutreachBusinessSummary, type ReachoutLead } from "./reachoutUtils";

type ReachoutLeadTableProps = {
  leads: ReachoutLead[];
  summaries: Map<string, OutreachBusinessSummary>;
  copiedKey: string;
  markingSentId: string;
  onCopy: (key: string, value: string) => void;
  onRecordEvent: (lead: ReachoutLead, eventType: "link_created" | "email_sent_manual") => void;
};

function leadStatus(lead: ReachoutLead, summary?: OutreachBusinessSummary) {
  if (lead.payment_status === "paid" || lead.status === "won_paid") return { label: "Paid", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" };
  if (Number(summary?.owner_view_count || lead.owner_view_count || 0) > 0) return { label: "Viewed", className: "bg-blue-50 text-blue-700 ring-blue-200" };
  if (Number(summary?.sent_count || 0) > 0 || lead.last_contacted) return { label: "Sent", className: "bg-indigo-50 text-indigo-700 ring-indigo-200" };
  return { label: "Ready", className: "bg-slate-50 text-slate-600 ring-slate-200" };
}

export default function ReachoutLeadTable({ leads, summaries, copiedKey, markingSentId, onCopy, onRecordEvent }: ReachoutLeadTableProps) {
  if (!leads.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
        No email-ready leads match this filter.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            <tr>
              <th className="px-4 py-3">Business</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Last touch</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leads.map((lead) => {
              const summary = summaries.get(lead.business_id);
              const status = leadStatus(lead, summary);
              const previewUrl = trackedPreviewUrl(lead, "email");
              const emailCopy = emailFirstTouch(lead);
              const sent = Number(summary?.sent_count || 0) > 0 || Boolean(lead.last_contacted);
              return (
                <tr key={lead.id} className="align-top hover:bg-slate-50/70">
                  <td className="px-4 py-3">
                    <p className="max-w-xs truncate font-semibold text-slate-950">{lead.business_name || lead.business_id}</p>
                    <p className="mt-1 max-w-xs truncate text-xs text-slate-500">{lead.niche || lead.address || lead.business_id}</p>
                  </td>
                  <td className="px-4 py-3">
                    <a href={`mailto:${lead.email}`} className="font-medium text-indigo-700 hover:underline">{lead.email}</a>
                    <p className="mt-1 text-xs text-slate-500">{lead.reviews ? `${lead.reviews} reviews` : "reviews unknown"}{lead.rating ? ` · ${lead.rating} rating` : ""}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${status.className}`}>{status.label}</span>
                    {Number(summary?.owner_view_count || lead.owner_view_count || 0) > 0 && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-blue-700">
                        <MousePointerClick size={12} />
                        {Number(summary?.owner_view_count || lead.owner_view_count || 0)} owner view
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    <p>Sent: {formatDateTime(summary?.last_sent_at || lead.last_contacted)}</p>
                    <p className="mt-1">Viewed: {formatDateTime(summary?.last_owner_viewed_at || lead.owner_last_viewed_at)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <HoverTooltip text="Copy the first-touch email with tracked preview link.">
                        <button
                          type="button"
                          onClick={() => {
                            onCopy(`email:${lead.id}`, emailCopy);
                            onRecordEvent(lead, "link_created");
                          }}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                          aria-label={`Copy email for ${lead.business_name}`}
                        >
                          {copiedKey === `email:${lead.id}` ? <Check size={16} /> : <Mail size={16} />}
                        </button>
                      </HoverTooltip>
                      <HoverTooltip text="Copy only the tracked preview URL.">
                        <button
                          type="button"
                          onClick={() => {
                            onCopy(`link:${lead.id}`, previewUrl);
                            onRecordEvent(lead, "link_created");
                          }}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                          aria-label={`Copy tracked link for ${lead.business_name}`}
                        >
                          {copiedKey === `link:${lead.id}` ? <Check size={16} /> : <Copy size={16} />}
                        </button>
                      </HoverTooltip>
                      <HoverTooltip text="Open the tracked owner preview in a new tab.">
                        <a
                          href={previewUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={() => onRecordEvent(lead, "link_created")}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                          aria-label={`Open tracked preview for ${lead.business_name}`}
                        >
                          <ExternalLink size={16} />
                        </a>
                      </HoverTooltip>
                      <HoverTooltip text={sent ? "Already marked sent; click again to log another manual send." : "Mark this email as sent and update CRM last contacted."}>
                        <button
                          type="button"
                          onClick={() => onRecordEvent(lead, "email_sent_manual")}
                          disabled={markingSentId === lead.id}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:cursor-wait disabled:opacity-60"
                          aria-label={`Mark email sent for ${lead.business_name}`}
                        >
                          <Check size={16} />
                        </button>
                      </HoverTooltip>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

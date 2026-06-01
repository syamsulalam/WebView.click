import { BadgeCheck, Camera, ExternalLink, Mail, MessageSquare, X } from "lucide-react";
import HoverTooltip from "../../../components/HoverTooltip";

type ContactEdit = { leadId: string; kind: "email" | "phone"; value: string; saving?: boolean; error?: string } | null;

type CrmPipelineTableProps = {
  leads: any[];
  contactEdit: ContactEdit;
  setContactEdit: (value: ContactEdit) => void;
  updateStatus: (id: string, newStatus: string) => void;
  openPaymentVerification: (lead: any) => void;
  saveLeadContact: (lead: any) => void | Promise<void>;
  usableLeadEmail: (value: string) => boolean;
  usableLeadPhone: (value: string) => boolean;
  smsHref: (value: string) => string;
};

export default function CrmPipelineTable({
  leads,
  contactEdit,
  setContactEdit,
  updateStatus,
  openPaymentVerification,
  saveLeadContact,
  usableLeadEmail,
  usableLeadPhone,
  smsHref,
}: CrmPipelineTableProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-sm font-medium text-gray-500">
              <th className="p-4">Bisnis</th>
              <th className="p-4">Preview URL</th>
              <th className="p-4">Status & Views</th>
              <th className="p-4">Payment</th>
              <th className="p-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {leads.map((lead) => (
              <tr key={lead.id} className="hover:bg-gray-50 transition">
                <td className="p-4">
                  <p className="font-medium text-gray-900">{lead.business_name}</p>
                  <p className="text-xs text-gray-500">{new Date(lead.created_at).toLocaleDateString()}</p>
                </td>
                <td className="p-4">
                  <a
                    href={`/${lead.business_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-600 hover:text-indigo-800 text-sm flex items-center gap-1"
                  >
                    /{lead.business_id} <ExternalLink size={14} />
                  </a>
                </td>
                <td className="p-4">
                  <div className="flex flex-col gap-1">
                    <HoverTooltip text="Manual CRM status for this lead. Use Verify payment for paid records so payment ledger and revenue are updated too." widthClass="w-64">
                      <select
                        value={lead.status}
                        onChange={(event) => updateStatus(lead.id, event.target.value)}
                        className="text-sm border border-gray-300 rounded p-1 bg-white text-gray-700 w-32"
                      >
                        <option value="scraped">Scraped</option>
                        <option value="contacted">Contacted</option>
                        <option value="viewed">Viewed</option>
                        <option value="checkout_pending">Checkout Pending</option>
                        <option value="negotiating">Negotiating</option>
                        <option value="won_paid">Won (Paid)</option>
                        <option value="lost">Lost</option>
                      </select>
                    </HoverTooltip>
                    {lead.view_count > 0 && (
                      <span className="text-xs text-emerald-600 font-medium">
                        Dilihat {lead.view_count}x
                      </span>
                    )}
                  </div>
                </td>
                <td className="p-4">
                  <div className="space-y-1 text-sm">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${lead.payment_status === "paid" || lead.status === "won_paid" ? "bg-emerald-100 text-emerald-800" : lead.status === "checkout_pending" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"}`}>
                      {lead.payment_status || (lead.status === "checkout_pending" ? "pending" : "not recorded")}
                    </span>
                    {lead.payment_amount_usd ? <p className="text-xs text-slate-500">${Number(lead.payment_amount_usd || 0).toFixed(2)} via {lead.payment_processor || "payment"}</p> : null}
                    {lead.payment_transaction_id ? <p className="max-w-[180px] truncate text-xs text-slate-500">{lead.payment_transaction_id}</p> : null}
                  </div>
                </td>
                <td className="p-4 text-right flex items-center justify-end gap-2">
                  <HoverTooltip text="Record a verified PayPal/manual payment after checking the provider account." widthClass="w-56">
                    <button
                      type="button"
                      onClick={() => openPaymentVerification(lead)}
                      className="p-2 text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 rounded"
                      aria-label={`Verify payment for ${lead.business_name}`}
                    >
                      <BadgeCheck size={18} />
                    </button>
                  </HoverTooltip>
                  <button className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded group relative">
                    <Camera size={18} />
                    <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-[9999] pointer-events-none">
                      Screenshot Preview
                    </span>
                  </button>
                  {contactEdit?.leadId === lead.id && contactEdit.kind === "email" ? (
                    <form className="flex items-center gap-1" onSubmit={(event) => { event.preventDefault(); void saveLeadContact(lead); }}>
                      <input
                        type="email"
                        value={contactEdit.value}
                        onChange={(event) => setContactEdit({ ...contactEdit, value: event.target.value, error: "" })}
                        placeholder={`Email for ${lead.business_name}`}
                        className="w-44 rounded border border-slate-300 px-2 py-1 text-xs"
                      />
                      <button type="submit" disabled={contactEdit.saving} className="rounded bg-indigo-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-60">Save</button>
                      <button type="button" onClick={() => setContactEdit(null)} className="rounded p-1 text-slate-400 hover:bg-slate-100"><X size={14} /></button>
                      {contactEdit.error && <span className="max-w-32 text-left text-[11px] text-red-600">{contactEdit.error}</span>}
                    </form>
                  ) : usableLeadEmail(String(lead.email || "")) ? (
                    <a href={`mailto:${lead.email}`} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded group relative">
                      <Mail size={18} />
                      <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-[9999] pointer-events-none">
                        Send email to {lead.email}
                      </span>
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setContactEdit({ leadId: lead.id, kind: "email", value: "" })}
                      className="relative inline-flex h-9 w-9 items-center justify-center rounded border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                      aria-label={`Email not found, enter the email for ${lead.business_name}`}
                      title={`Email not found, enter the email for ${lead.business_name}`}
                    >
                      <Mail size={17} />
                      <span className="pointer-events-none absolute h-0.5 w-7 -rotate-45 rounded-full bg-amber-700" />
                    </button>
                  )}
                  {contactEdit?.leadId === lead.id && contactEdit.kind === "phone" ? (
                    <form className="flex items-center gap-1" onSubmit={(event) => { event.preventDefault(); void saveLeadContact(lead); }}>
                      <input
                        type="tel"
                        value={contactEdit.value}
                        onChange={(event) => setContactEdit({ ...contactEdit, value: event.target.value, error: "" })}
                        placeholder={`Phone for ${lead.business_name}`}
                        className="w-40 rounded border border-slate-300 px-2 py-1 text-xs"
                      />
                      <button type="submit" disabled={contactEdit.saving} className="rounded bg-indigo-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-60">Save</button>
                      <button type="button" onClick={() => setContactEdit(null)} className="rounded p-1 text-slate-400 hover:bg-slate-100"><X size={14} /></button>
                      {contactEdit.error && <span className="max-w-32 text-left text-[11px] text-red-600">{contactEdit.error}</span>}
                    </form>
                  ) : usableLeadPhone(String(lead.phone || "")) ? (
                    <a href={smsHref(lead.phone)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded group relative">
                      <MessageSquare size={18} />
                      <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-[9999] pointer-events-none">
                        Send SMS to {lead.phone}
                      </span>
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setContactEdit({ leadId: lead.id, kind: "phone", value: "" })}
                      className="relative inline-flex h-9 w-9 items-center justify-center rounded border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                      aria-label={`Number not found, enter the number for ${lead.business_name}`}
                      title={`Number not found, enter the number for ${lead.business_name}`}
                    >
                      <MessageSquare size={17} />
                      <span className="pointer-events-none absolute h-0.5 w-7 -rotate-45 rounded-full bg-amber-700" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-500">Belum ada prospek. Gunakan fitur pencarian di atas.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { BadgeCheck, DollarSign, Loader2, X } from "lucide-react";
import AdminDocsReader from "../../../components/AdminDocsReader";
import HelpTooltip from "../../../components/HelpTooltip";
import HoverTooltip from "../../../components/HoverTooltip";

type PaymentVerificationModalProps = {
  lead: any;
  form: any;
  message: string;
  saving: boolean;
  setForm: (value: any) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export default function PaymentVerificationModal({
  lead,
  form,
  message,
  saving,
  setForm,
  onClose,
  onSubmit,
}: PaymentVerificationModalProps) {
  return (
    <div className="fixed inset-0 z-[280] flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <p className="inline-flex items-center gap-2 font-semibold text-slate-950">
              <DollarSign size={18} className="text-emerald-600" />
              Verify payment
            </p>
            <p className="mt-1 text-sm text-slate-500">{lead.business_name}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <AdminDocsReader
              pathname="/admin/leads"
              defaultDocId="paypal-risk-controls"
              tooltip="Open PayPal/payment reconciliation docs in the admin docs reader."
              buttonClassName="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-indigo-700"
              iconSize={16}
            />
            <HoverTooltip text="Close payment verification without saving changes.">
              <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100" aria-label="Close payment verification">
                <X size={18} />
              </button>
            </HoverTooltip>
          </div>
        </div>
        <div className="space-y-4 p-5">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
            Check PayPal/provider first, then record the exact transaction ID, payer email, amount, and proof notes. This marks the lead `won_paid` and updates revenue.
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Processor</span>
              <select
                value={form.processor}
                onChange={(event) => setForm((prev: any) => ({ ...prev, processor: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="paypal">PayPal</option>
                <option value="wise">Wise</option>
                <option value="payoneer">Payoneer</option>
                <option value="xendit">Xendit</option>
                <option value="midtrans">Midtrans</option>
                <option value="doku">DOKU</option>
                <option value="manual">Manual</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Amount USD</span>
              <input
                type="number"
                min="0"
                value={form.amountUsd}
                onChange={(event) => setForm((prev: any) => ({ ...prev, amountUsd: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block font-medium text-slate-700">Transaction ID</span>
              <input
                value={form.transactionId}
                onChange={(event) => setForm((prev: any) => ({ ...prev, transactionId: event.target.value }))}
                placeholder="PayPal transaction ID / provider reference"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block font-medium text-slate-700">Payer email</span>
              <input
                value={form.payerEmail}
                onChange={(event) => setForm((prev: any) => ({ ...prev, payerEmail: event.target.value }))}
                placeholder="customer@example.com"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block font-medium text-slate-700">Payment reference</span>
              <input
                value={form.paymentReference}
                onChange={(event) => setForm((prev: any) => ({ ...prev, paymentReference: event.target.value }))}
                placeholder="business-id | domain | checkout order"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block font-medium text-slate-700">Proof notes</span>
              <textarea
                value={form.proofNotes}
                onChange={(event) => setForm((prev: any) => ({ ...prev, proofNotes: event.target.value }))}
                placeholder="Checked PayPal receipt, payer email matched, setup scope confirmed..."
                rows={3}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>
          </div>
          {message && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{message}</div>
          )}
          <button
            type="button"
            onClick={onSubmit}
            disabled={saving}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <BadgeCheck size={18} />}
            Save verified payment
          </button>
          <p className="inline-flex items-center gap-1.5 text-xs text-slate-500">
            Verification effect
            <HelpTooltip text="Saving creates or updates a paid ledger row, marks the lead won_paid, updates subscriptions revenue, and writes a CRM activity note." widthClass="w-80" />
          </p>
        </div>
      </div>
    </div>
  );
}

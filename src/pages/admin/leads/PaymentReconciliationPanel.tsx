import { FileDown, MessageSquare, RefreshCw } from "lucide-react";
import HelpTooltip from "../../../components/HelpTooltip";
import HoverTooltip from "../../../components/HoverTooltip";

type PaymentReconciliationPanelProps = {
  paymentLedger: any[];
  paymentLedgerLoading: boolean;
  phoneBackfillLoading: boolean;
  phoneBackfillMessage: string;
  exportCheckoutPendingCsv: () => void;
  fetchPaymentLedger: () => void;
  backfillLeadPhones: () => void;
};

export default function PaymentReconciliationPanel({
  paymentLedger,
  paymentLedgerLoading,
  phoneBackfillLoading,
  phoneBackfillMessage,
  exportCheckoutPendingCsv,
  fetchPaymentLedger,
  backfillLeadPhones,
}: PaymentReconciliationPanelProps) {
  return (
    <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="inline-flex items-center gap-1.5 text-lg font-semibold text-slate-950">
            Payment Reconciliation
            <HelpTooltip text="Manual ledger for PayPal/Wise/Payoneer payments. Verify the payment after checking the provider account, then record transaction ID, payer email, amount, and proof notes." />
          </h2>
          <p className="mt-1 text-sm text-slate-500">Use this before marking a checkout-pending lead as paid.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <HoverTooltip text="Copy or download a CSV of leads currently waiting for payment confirmation. Use it when matching PayPal/Wise/Payoneer records.">
            <button
              type="button"
              onClick={exportCheckoutPendingCsv}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              aria-label="Export checkout pending leads"
            >
              <FileDown size={14} />
            </button>
          </HoverTooltip>
          <HoverTooltip text="Reload the payment ledger from D1 after a checkout, manual verification, or PayPal webhook event.">
            <button
              type="button"
              onClick={fetchPaymentLedger}
              disabled={paymentLedgerLoading}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              aria-label="Refresh payment ledger"
            >
              <RefreshCw size={14} className={paymentLedgerLoading ? "animate-spin" : ""} />
            </button>
          </HoverTooltip>
          <HoverTooltip text="Backfill missing CRM phone numbers from saved generated site/source JSON, including R2-backed generated sites. Runs in a capped batch.">
            <button
              type="button"
              onClick={backfillLeadPhones}
              disabled={phoneBackfillLoading}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              aria-label="Backfill missing CRM phone numbers"
            >
              <MessageSquare size={14} className={phoneBackfillLoading ? "animate-pulse" : ""} />
            </button>
          </HoverTooltip>
        </div>
      </div>
      {phoneBackfillMessage && <p className="mb-3 text-xs text-slate-500">{phoneBackfillMessage}</p>}
      <div className="grid gap-3 md:grid-cols-3">
        {paymentLedger.slice(0, 6).map((payment) => (
          <div key={payment.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="truncate font-semibold text-slate-900">{payment.business_name || payment.business_id}</p>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${payment.payment_status === "paid" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                {payment.payment_status || "pending"}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">{payment.processor || "payment"} · ${Number(payment.amount_usd || 0).toFixed(2)}</p>
            <p className="mt-1 truncate text-xs text-slate-500">{payment.transaction_id || payment.payment_reference || "No transaction recorded"}</p>
          </div>
        ))}
        {!paymentLedger.length && (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 md:col-span-3">
            No payment ledger entries yet.
          </div>
        )}
      </div>
    </div>
  );
}

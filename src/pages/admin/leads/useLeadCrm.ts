import { useState } from "react";
import { isPlaceholderPhone } from "../../../lib/generatedSiteScaffold";

type ContactEdit = { leadId: string; kind: "email" | "phone"; value: string; saving?: boolean; error?: string } | null;

type UseLeadCrmParams = {
  settings: any;
  showToast: (toast: any) => void;
  showApiError: (error: unknown, title?: string) => void;
};

export default function useLeadCrm({ settings, showToast, showApiError }: UseLeadCrmParams) {
  const [leads, setLeads] = useState<any[]>([]);
  const [paymentLedger, setPaymentLedger] = useState<any[]>([]);
  const [paymentLedgerLoading, setPaymentLedgerLoading] = useState(false);
  const [phoneBackfillLoading, setPhoneBackfillLoading] = useState(false);
  const [phoneBackfillMessage, setPhoneBackfillMessage] = useState("");
  const [paymentVerifyLead, setPaymentVerifyLead] = useState<any>(null);
  const [paymentVerifySaving, setPaymentVerifySaving] = useState(false);
  const [paymentVerifyMessage, setPaymentVerifyMessage] = useState("");
  const [paymentVerifyForm, setPaymentVerifyForm] = useState({
    processor: "paypal",
    transactionId: "",
    payerEmail: "",
    amountUsd: "197",
    amountIdr: "",
    paymentReference: "",
    proofNotes: "",
  });
  const [contactEdit, setContactEdit] = useState<ContactEdit>(null);

  const fetchLeads = () => {
    fetch("/api/leads")
      .then(r => r.ok ? r.json() : [])
      .then((data) => setLeads(Array.isArray(data) ? data : []))
      .catch(e => console.error(e));
  };

  const fetchPaymentLedger = () => {
    setPaymentLedgerLoading(true);
    fetch("/api/leads/payments")
      .then(r => r.ok ? r.json() : [])
      .then((data) => setPaymentLedger(Array.isArray(data) ? data : []))
      .catch(e => console.error(e))
      .finally(() => setPaymentLedgerLoading(false));
  };

  const backfillLeadPhones = async () => {
    setPhoneBackfillLoading(true);
    setPhoneBackfillMessage("Backfilling phones...");
    try {
      const response = await fetch("/api/sites/backfill-lead-phones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 50 }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.error) throw new Error(data.error || `Backfill failed with HTTP ${response.status}`);
      setPhoneBackfillMessage(`Checked ${data.checked || 0}, filled ${data.updated || 0}${data.failures?.length ? `, ${data.failures.length} failed` : ""}.`);
      fetchLeads();
      showToast({ kind: "success", title: "Phone backfill complete", message: `Filled ${data.updated || 0} CRM phone number${Number(data.updated || 0) === 1 ? "" : "s"}.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Phone backfill failed.";
      setPhoneBackfillMessage(message);
      showApiError(error, "Phone backfill failed");
    } finally {
      setPhoneBackfillLoading(false);
    }
  };

  const exportCheckoutPendingCsv = async () => {
    const headers = ["business_name", "business_id", "email", "status", "payment_status", "payment_processor", "payment_amount_usd", "payment_transaction_id", "payment_payer_email", "payment_reference", "payment_proof_notes"];
    const rows = leads.filter((lead) => lead.status === "checkout_pending");
    const csvValue = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = [
      headers.join(","),
      ...rows.map((lead) => headers.map((header) => csvValue(lead[header])).join(",")),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(csv);
      showToast({ kind: "success", title: "Checkout pending CSV copied", message: `${rows.length} checkout_pending lead rows copied for reconciliation.` });
    } catch {
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `webview-checkout-pending-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  const updateStatus = async (id: string, newStatus: string) => {
    await fetch(`/api/leads/${id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus })
    });
    fetchLeads();
  };

  const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  const phoneDigits = (value: string) => value.replace(/\D/g, "");
  const validPhone = (value: string) => /^\+?[0-9\s().-]{7,20}$/.test(value.trim()) && phoneDigits(value).length >= 7 && phoneDigits(value).length <= 15 && !/^1?0{7,}$/.test(phoneDigits(value));
  const usableLeadEmail = (value: string) => validEmail(value) && !/^hello@example\.com$/i.test(value.trim());
  const usableLeadPhone = (value: string) => validPhone(value) && !isPlaceholderPhone(value) && !/^1?0{7,}$/.test(phoneDigits(value));
  const smsHref = (value: string) => `sms:${value.trim().startsWith("+") ? value.trim() : phoneDigits(value)}`;

  const saveLeadContact = async (lead: any) => {
    if (!contactEdit || contactEdit.leadId !== lead.id) return;
    const value = contactEdit.value.trim();
    if (contactEdit.kind === "email" && !validEmail(value)) {
      setContactEdit({ ...contactEdit, error: "Enter a valid email address." });
      return;
    }
    if (contactEdit.kind === "phone" && !validPhone(value)) {
      setContactEdit({ ...contactEdit, error: "Enter a valid phone number with 7-15 digits." });
      return;
    }
    setContactEdit({ ...contactEdit, saving: true, error: "" });
    try {
      const response = await fetch(`/api/leads/${encodeURIComponent(lead.id)}/contact`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [contactEdit.kind]: value, staffId: "admin" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.error) throw new Error(data.error || `Contact update failed with HTTP ${response.status}`);
      setLeads((items) => items.map((item) => item.id === lead.id ? { ...item, [contactEdit.kind]: value } : item));
      setContactEdit(null);
      showToast({ kind: "success", title: "Contact saved", message: `${contactEdit.kind === "email" ? "Email" : "Phone"} saved for ${lead.business_name}.` });
    } catch (error) {
      setContactEdit({ ...contactEdit, saving: false, error: error instanceof Error ? error.message : "Contact update failed." });
    }
  };

  const openPaymentVerification = (lead: any) => {
    setPaymentVerifyLead(lead);
    setPaymentVerifyMessage("");
    setPaymentVerifyForm({
      processor: String(lead.payment_processor || "paypal"),
      transactionId: String(lead.payment_transaction_id || ""),
      payerEmail: String(lead.payment_payer_email || lead.email || ""),
      amountUsd: String(lead.payment_amount_usd || settings?.PAYMENT_USD_AMOUNT || "197"),
      amountIdr: "",
      paymentReference: String(lead.payment_reference || `${lead.business_id} | ${lead.business_name}`),
      proofNotes: String(lead.payment_proof_notes || ""),
    });
  };

  const submitPaymentVerification = async () => {
    if (!paymentVerifyLead?.id) return;
    setPaymentVerifySaving(true);
    setPaymentVerifyMessage("Saving payment verification...");
    try {
      const response = await fetch(`/api/leads/${encodeURIComponent(paymentVerifyLead.id)}/payment-verified`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...paymentVerifyForm,
          amountUsd: Number(paymentVerifyForm.amountUsd || 0),
          amountIdr: Number(paymentVerifyForm.amountIdr || 0),
          verifiedBy: "admin",
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.error) throw new Error(data.error || `Payment verification failed with HTTP ${response.status}`);
      setPaymentVerifyMessage("Payment verified and lead marked won_paid.");
      showToast({ kind: "success", title: "Payment verified", message: `${paymentVerifyLead.business_name} marked as paid.` });
      fetchLeads();
      fetchPaymentLedger();
      window.setTimeout(() => {
        setPaymentVerifyLead(null);
        setPaymentVerifyMessage("");
      }, 900);
    } catch (error) {
      console.error(error);
      setPaymentVerifyMessage(error instanceof Error ? error.message : "Payment verification failed.");
    } finally {
      setPaymentVerifySaving(false);
    }
  };

  return {
    leads,
    paymentLedger,
    paymentLedgerLoading,
    phoneBackfillLoading,
    phoneBackfillMessage,
    paymentVerifyLead,
    paymentVerifySaving,
    paymentVerifyMessage,
    paymentVerifyForm,
    contactEdit,
    setContactEdit,
    setPaymentVerifyForm,
    setPaymentVerifyLead,
    fetchLeads,
    fetchPaymentLedger,
    backfillLeadPhones,
    exportCheckoutPendingCsv,
    updateStatus,
    usableLeadEmail,
    usableLeadPhone,
    smsHref,
    saveLeadContact,
    openPaymentVerification,
    submitPaymentVerification,
  };
}

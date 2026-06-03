import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, Copy, Info, X } from "lucide-react";
import { recordAdminApiDiagnostic } from "../lib/adminDiagnostics";
import { interpretApiError, type ApiErrorInsight } from "../lib/apiErrorInsights";
import { setProviderCooldown } from "../lib/providerCooldown";

type ToastKind = "success" | "error" | "warning" | "info";
type ToastAction = string | { label: string; href: string };

type AdminToast = {
  id: string;
  kind: ToastKind;
  title: string;
  message?: string;
  actions?: ToastAction[];
  rawMessage?: string;
};

type ToastInput = Omit<AdminToast, "id">;

type ToastContextValue = {
  showToast: (toast: ToastInput) => string;
  showApiError: (error: unknown, options?: { provider?: string; model?: string; source?: string; status?: number; message?: string }) => string;
  dismissToast: (id: string) => void;
};

const AdminToastContext = createContext<ToastContextValue | null>(null);

function toastKindFromInsight(insight: ApiErrorInsight): ToastKind {
  if (insight.severity === "warning") return "warning";
  if (insight.severity === "info") return "info";
  return "error";
}

function iconForKind(kind: ToastKind) {
  if (kind === "success") return <CheckCircle2 size={18} />;
  if (kind === "info") return <Info size={18} />;
  return <AlertTriangle size={18} />;
}

function styleForKind(kind: ToastKind) {
  if (kind === "success") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (kind === "warning") return "border-amber-200 bg-amber-50 text-amber-950";
  if (kind === "info") return "border-sky-200 bg-sky-50 text-sky-950";
  return "border-red-200 bg-red-50 text-red-950";
}

export function AdminToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<AdminToast[]>([]);
  const [copiedToastId, setCopiedToastId] = useState("");

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((toast: ToastInput) => {
    const id = crypto.randomUUID();
    setToasts((current) => [{ ...toast, id }, ...current].slice(0, 4));
    if (toast.kind === "success" || toast.kind === "info") {
      window.setTimeout(() => dismissToast(id), 6500);
    }
    return id;
  }, [dismissToast]);

  const showApiError = useCallback<ToastContextValue["showApiError"]>((error, options = {}) => {
    const insight = interpretApiError(error, options);
    if (insight.cooldownMs && insight.cooldownProvider) {
      setProviderCooldown(insight.cooldownProvider, insight.cooldownMs, insight.title, insight.rawMessage);
    }
    recordAdminApiDiagnostic({
      source: options.source,
      title: insight.title,
      message: insight.meaning,
      rawMessage: insight.rawMessage,
      status: options.status,
      provider: options.provider,
      model: options.model,
    });
    return showToast({
      kind: toastKindFromInsight(insight),
      title: insight.title,
      message: insight.meaning,
      actions: insight.actions,
      rawMessage: insight.rawMessage,
    });
  }, [showToast]);

  const copyToast = useCallback(async (toast: AdminToast) => {
    const payload = [
      toast.title,
      toast.message || "",
      ...(toast.actions || []).map((action) => typeof action === "string" ? `- ${action}` : `- ${action.label}: ${action.href}`),
      toast.rawMessage ? `Raw error:\n${toast.rawMessage}` : "",
    ].filter(Boolean).join("\n");
    try {
      await navigator.clipboard.writeText(payload);
      setCopiedToastId(toast.id);
      window.setTimeout(() => setCopiedToastId(""), 1400);
    } catch {
      setCopiedToastId("");
    }
  }, []);

  const value = useMemo(() => ({ showToast, showApiError, dismissToast }), [dismissToast, showApiError, showToast]);

  return (
    <AdminToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[100000] flex w-[min(92vw,520px)] flex-col gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-2xl border p-4 shadow-2xl ${styleForKind(toast.kind)}`}
            role="status"
            aria-live={toast.kind === "error" || toast.kind === "warning" ? "assertive" : "polite"}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0">{iconForKind(toast.kind)}</div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{toast.title}</p>
                {toast.message && <p className="mt-1 text-sm leading-relaxed opacity-90">{toast.message}</p>}
                {toast.actions && toast.actions.length > 0 && toast.actions.some((action) => typeof action !== "string") && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {toast.actions.map((action, index) => typeof action === "string" ? (
                      <span key={`${toast.id}-${index}`} className="text-xs leading-relaxed opacity-90">{action}</span>
                    ) : (
                      <a
                        key={`${toast.id}-${index}`}
                        href={action.href}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex rounded-lg bg-white/70 px-2 py-1 text-xs font-semibold text-slate-800 hover:bg-white"
                      >
                        {action.label}
                      </a>
                    ))}
                  </div>
                )}
                {toast.actions && toast.actions.length > 0 && !toast.actions.some((action) => typeof action !== "string") && (
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-xs leading-relaxed opacity-90">
                    {toast.actions.map((action, index) => <li key={`${toast.id}-${index}`}>{action}</li>)}
                  </ul>
                )}
                {toast.rawMessage && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs font-semibold opacity-80">Raw error</summary>
                    <button
                      type="button"
                      onClick={() => copyToast(toast)}
                      className="mt-2 inline-flex items-center gap-1 rounded-lg bg-white/70 px-2 py-1 text-xs font-semibold text-slate-800 hover:bg-white"
                    >
                      {copiedToastId === toast.id ? <Check size={12} /> : <Copy size={12} />}
                      {copiedToastId === toast.id ? "Copied" : "Copy warning"}
                    </button>
                    <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded-lg bg-white/70 p-2 text-[11px] leading-relaxed text-slate-800">
                      {toast.rawMessage}
                    </pre>
                  </details>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="shrink-0 rounded-lg p-1 opacity-70 hover:bg-white/70 hover:opacity-100"
                aria-label="Dismiss notification"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </AdminToastContext.Provider>
  );
}

export function useAdminToast() {
  const context = useContext(AdminToastContext);
  if (!context) {
    return {
      showToast: () => "",
      showApiError: () => "",
      dismissToast: () => undefined,
    } satisfies ToastContextValue;
  }
  return context;
}

export type AdminApiDiagnostic = {
  capturedAt: string;
  source?: string;
  title?: string;
  message?: string;
  rawMessage?: string;
  requestPath?: string;
  status?: number;
  provider?: string;
  model?: string;
};

const latestApiDiagnosticKey = "webview.admin.latestApiDiagnostic";
const maxApiDiagnosticHistory = 5;

function parseRequestContext(rawMessage = "") {
  const match = rawMessage.match(/Request path:\s*(.*?)\.\s*Status:\s*HTTP\s*(\d{3})/i);
  if (!match) return {};
  const status = Number(match[2]);
  return {
    requestPath: match[1],
    status: Number.isFinite(status) ? status : undefined,
  };
}

export function recordAdminApiDiagnostic(input: Omit<AdminApiDiagnostic, "capturedAt">) {
  const parsed = parseRequestContext(input.rawMessage || input.message || "");
  const diagnostic: AdminApiDiagnostic = {
    capturedAt: new Date().toISOString(),
    ...input,
    requestPath: input.requestPath || parsed.requestPath,
    status: input.status || parsed.status,
  };
  if (typeof window !== "undefined") {
    try {
      const current = readAdminApiDiagnosticHistory();
      const next = [diagnostic, ...current].slice(0, maxApiDiagnosticHistory);
      window.localStorage.setItem(latestApiDiagnosticKey, JSON.stringify(next));
    } catch {
      // Ignore storage failures; the visible toast still carries the warning.
    }
  }
  return diagnostic;
}

export function readLatestAdminApiDiagnostic(): AdminApiDiagnostic | null {
  return readAdminApiDiagnosticHistory()[0] || null;
}

export function readAdminApiDiagnosticHistory(): AdminApiDiagnostic[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(latestApiDiagnosticKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item) => item && typeof item === "object")
        .slice(0, maxApiDiagnosticHistory) as AdminApiDiagnostic[];
    }
    return parsed && typeof parsed === "object" ? [parsed as AdminApiDiagnostic] : [];
  } catch {
    return [];
  }
}

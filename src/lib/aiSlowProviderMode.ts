export const AI_SERVICE_COPY_PROVIDER_MODES_KEY = "AI_SERVICE_COPY_PROVIDER_MODES_JSON";

export type AiServiceCopyProviderMode = {
  provider?: string;
  model?: string;
  slowMode?: boolean;
  serviceCopyBatchSize?: number;
  updatedAt?: string;
};

export type AiServiceCopyProviderModes = Record<string, AiServiceCopyProviderMode>;

export function aiServiceCopyModeKey(provider: string, model: string) {
  return `${String(provider || "").trim()}::${String(model || "").trim()}`;
}

export function parseAiServiceCopyProviderModes(value: unknown): AiServiceCopyProviderModes {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value as AiServiceCopyProviderModes;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as AiServiceCopyProviderModes : {};
  } catch {
    return {};
  }
}

export function normalizeServiceCopyBatchSize(value: unknown, fallback = 2) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.min(4, Math.floor(numeric)));
}

export function defaultAiServiceCopyProviderMode(provider: string, model = ""): Required<Pick<AiServiceCopyProviderMode, "slowMode" | "serviceCopyBatchSize">> {
  const slowByDefault = String(provider || "").trim() === "KIE" || /^kie\//i.test(String(model || "").trim());
  return {
    slowMode: slowByDefault,
    serviceCopyBatchSize: slowByDefault ? 1 : 2,
  };
}

export function resolveAiServiceCopyProviderMode(settings: Record<string, unknown> | null | undefined, provider: string, model: string) {
  const defaults = defaultAiServiceCopyProviderMode(provider, model);
  const modes = parseAiServiceCopyProviderModes(settings?.[AI_SERVICE_COPY_PROVIDER_MODES_KEY]);
  const exact = modes[aiServiceCopyModeKey(provider, model)];
  const slowMode = typeof exact?.slowMode === "boolean" ? exact.slowMode : defaults.slowMode;
  const configuredBatchSize = normalizeServiceCopyBatchSize(exact?.serviceCopyBatchSize, defaults.serviceCopyBatchSize);
  const serviceCopyBatchSize = slowMode ? Math.min(configuredBatchSize, 1) : configuredBatchSize;
  return {
    provider,
    model,
    slowMode,
    serviceCopyBatchSize,
  };
}

export function serviceCopyPlanText(input: {
  provider: string;
  model: string;
  settings?: Record<string, unknown> | null;
  total?: number;
  completed?: number;
  reset?: boolean;
}) {
  const mode = resolveAiServiceCopyProviderMode(input.settings, input.provider, input.model);
  const total = Math.max(0, Number(input.total || 0));
  const completed = input.reset ? 0 : Math.max(0, Math.min(total, Number(input.completed || 0)));
  const remaining = Math.max(0, total - completed);
  const requestCount = remaining > 0 ? Math.ceil(remaining / mode.serviceCopyBatchSize) : 0;
  const batchLabel = mode.serviceCopyBatchSize === 1 ? "1 service per request" : `${mode.serviceCopyBatchSize} services per request`;
  const progressLabel = total > 0 ? `${completed}/${total} done, about ${requestCount} request${requestCount === 1 ? "" : "s"} remaining` : "service count unknown until the chunk runs";
  return `${mode.slowMode ? "Slow provider mode on" : "Standard mode"}: ${batchLabel}; ${progressLabel}.`;
}

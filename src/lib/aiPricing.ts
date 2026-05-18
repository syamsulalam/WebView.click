export type AiProvider = "OpenRouter" | "OpenAI" | "Gemini" | "KIE" | "Opencode";

export type AiModelPrice = {
  provider: AiProvider;
  model: string;
  label: string;
  inputPerMillion: number | null;
  outputPerMillion: number | null;
  note?: string;
  source?: string;
};

export const defaultInputTokens = 5000;
export const defaultOutputTokens = 3000;

export const aiModelPrices: AiModelPrice[] = [
  { provider: "OpenAI", model: "gpt-5.5", label: "GPT-5.5", inputPerMillion: 5, outputPerMillion: 30 },
  { provider: "OpenAI", model: "gpt-5.4", label: "GPT-5.4", inputPerMillion: 2.5, outputPerMillion: 15 },
  { provider: "OpenAI", model: "gpt-5.4-mini", label: "GPT-5.4 Mini", inputPerMillion: 0.75, outputPerMillion: 4.5 },
  { provider: "OpenAI", model: "gpt-4.1", label: "GPT-4.1 Legacy", inputPerMillion: 2, outputPerMillion: 8 },
  { provider: "Gemini", model: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro Preview", inputPerMillion: 2, outputPerMillion: 12 },
  { provider: "Gemini", model: "gemini-3-flash-preview", label: "Gemini 3 Flash Preview", inputPerMillion: 0.5, outputPerMillion: 3 },
  { provider: "Gemini", model: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash-Lite", inputPerMillion: 0.25, outputPerMillion: 1.5 },
  { provider: "Gemini", model: "gemini-2.5-pro", label: "Gemini 2.5 Pro Legacy", inputPerMillion: 2.5, outputPerMillion: 15 },
  { provider: "OpenRouter", model: "~anthropic/claude-sonnet-latest", label: "Claude Sonnet Latest", inputPerMillion: 3, outputPerMillion: 15 },
  { provider: "OpenRouter", model: "~openai/gpt-latest", label: "OpenAI GPT Latest", inputPerMillion: 5, outputPerMillion: 30 },
  { provider: "OpenRouter", model: "~google/gemini-pro-latest", label: "Gemini Pro Latest", inputPerMillion: 2, outputPerMillion: 12 },
  { provider: "OpenRouter", model: "~google/gemini-flash-latest", label: "Gemini Flash Latest", inputPerMillion: 0.5, outputPerMillion: 3 },
  { provider: "OpenRouter", model: "qwen/qwen3.6-max-preview", label: "Qwen3.6 Max Preview", inputPerMillion: 1.04, outputPerMillion: 6.24 },
  { provider: "OpenRouter", model: "qwen/qwen3.6-flash", label: "Qwen3.6 Flash", inputPerMillion: 0.25, outputPerMillion: 1.5 },
  {
    provider: "KIE",
    model: "kie/gemini-2.5-flash",
    label: "KIE Gemini 2.5 Flash",
    inputPerMillion: null,
    outputPerMillion: null,
    note: "Cheap KIE copy-rewrite option; check kie.ai/pricing for live credit cost.",
  },
  {
    provider: "KIE",
    model: "kie/gemini-3-flash",
    label: "KIE Gemini 3 Flash",
    inputPerMillion: 0.25,
    outputPerMillion: 1.5,
    note: "Estimate using KIE public claim of typically 30-50% below official pricing.",
  },
  {
    provider: "KIE",
    model: "kie/gpt-5-4",
    label: "KIE GPT-5.4",
    inputPerMillion: 1.25,
    outputPerMillion: 7.5,
    note: "Estimate using KIE public claim of typically 30-50% below official pricing.",
  },
  {
    provider: "KIE",
    model: "kie/gemini-3.1-pro",
    label: "KIE Gemini 3.1 Pro",
    inputPerMillion: 1,
    outputPerMillion: 6,
    note: "Estimate using KIE public claim of typically 30-50% below official pricing.",
  },
  {
    provider: "KIE",
    model: "kie/gpt-5-5",
    label: "KIE GPT-5.5",
    inputPerMillion: 2.5,
    outputPerMillion: 15,
    note: "Estimate using KIE public claim of typically 30-50% below official pricing.",
  },
  {
    provider: "KIE",
    model: "kie/gpt-5-2",
    label: "KIE GPT-5.2",
    inputPerMillion: null,
    outputPerMillion: null,
    note: "KIE publishes model endpoint docs; check kie.ai/pricing for live credit cost.",
  },
  {
    provider: "Opencode",
    model: "opencode-default",
    label: "Opencode Default",
    inputPerMillion: null,
    outputPerMillion: null,
    note: "Custom endpoint pricing depends on your gateway.",
  },
  {
    provider: "Opencode",
    model: "qwen/qwen3.6-flash",
    label: "Qwen3.6 Flash",
    inputPerMillion: 0.25,
    outputPerMillion: 1.5,
  },
  {
    provider: "Opencode",
    model: "qwen/qwen3.6-max-preview",
    label: "Qwen3.6 Max Preview",
    inputPerMillion: 1.04,
    outputPerMillion: 6.24,
  },
];

export function getModelPrice(provider: string, model: string) {
  return aiModelPrices.find((item) => item.provider === provider && item.model === model)
    || aiModelPrices.find((item) => item.model === model);
}

export function estimateTokensFromText(text: string, floor = 0) {
  return Math.max(floor, Math.ceil(text.length / 4));
}

export function estimateCostUsd(provider: string, model: string, inputTokens = defaultInputTokens, outputTokens = defaultOutputTokens) {
  const price = getModelPrice(provider, model);
  if (!price || price.inputPerMillion === null || price.outputPerMillion === null) {
    return { price, total: null, inputCost: null, outputCost: null };
  }

  const inputCost = (inputTokens / 1_000_000) * price.inputPerMillion;
  const outputCost = (outputTokens / 1_000_000) * price.outputPerMillion;
  return {
    price,
    inputCost,
    outputCost,
    total: inputCost + outputCost,
  };
}

export function formatUsd(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "N/A";
  if (value < 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(2)}`;
}

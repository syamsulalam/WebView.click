import { useEffect, useState } from "react";
import { useLocalStorageState } from "../../lib/localStorageState";
import GenerationJobsTable from "../../components/GenerationJobsTable";
import HelpTooltip from "../../components/HelpTooltip";

const providerApiKeyMap: Record<string, string> = {
  OpenRouter: "OPENROUTER_API_KEY",
  OpenAI: "OPENAI_API_KEY",
  Gemini: "GEMINI_API_KEY",
  KIE: "KIE_API_KEY",
  Opencode: "OPENCODE_API_KEY",
};

export default function AdminJobs() {
  const [aiProvider] = useLocalStorageState("webview.adminLeads.aiProvider", "OpenRouter");
  const [aiModel] = useLocalStorageState("webview.adminLeads.aiModel", "~anthropic/claude-sonnet-latest");
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const providerKeyStatus = Object.keys(providerApiKeyMap).reduce<Record<string, boolean | null>>((acc, provider) => {
    const key = providerApiKeyMap[provider];
    acc[provider] = settingsLoaded ? Boolean(String(settings?.[key] || "").trim()) : null;
    return acc;
  }, {});

  useEffect(() => {
    fetch("/api/settings")
      .then((response) => response.ok ? response.json() : {})
      .then((data) => setSettings(data && typeof data === "object" ? data : {}))
      .catch(() => setSettings({}))
      .finally(() => setSettingsLoaded(true));
  }, []);

  return (
    <div className="min-h-screen p-6 lg:p-8">
      <div className="mb-6">
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">
          Generation queue
          <HelpTooltip text="Audit trail for website generation attempts, including failed jobs, fallback-only saves, copy patch jobs, and retries." />
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Generation Jobs</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Audit, sort, and retry site generation jobs without crowding the prospecting screen.
        </p>
      </div>

      <GenerationJobsTable
        storageKeyPrefix="webview.adminJobs"
        fallbackProvider={aiProvider}
        fallbackModel={aiModel}
        providerKeyStatus={providerKeyStatus}
        limit={200}
        variant="full"
        serverBackedFilters
        serverBackedSearch
      />
    </div>
  );
}

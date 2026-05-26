import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useLocalStorageState } from "../../lib/localStorageState";
import GenerationJobsTable from "../../components/GenerationJobsTable";
import AdminDocsReader from "../../components/AdminDocsReader";
import HelpTooltip from "../../components/HelpTooltip";

const providerApiKeyMap: Record<string, string> = {
  OpenRouter: "OPENROUTER_API_KEY",
  OpenAI: "OPENAI_API_KEY",
  Gemini: "GEMINI_API_KEY",
  KIE: "KIE_API_KEY",
  Opencode: "OPENCODE_API_KEY",
};

export default function AdminJobs() {
  const location = useLocation();
  const [aiProvider] = useLocalStorageState("webview.adminLeads.aiProvider", "OpenRouter");
  const [aiModel] = useLocalStorageState("webview.adminLeads.aiModel", "~anthropic/claude-sonnet-latest");
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const providerKeyStatus = Object.keys(providerApiKeyMap).reduce<Record<string, boolean | null>>((acc, provider) => {
    const key = providerApiKeyMap[provider];
    acc[provider] = settingsLoaded ? Boolean(String(settings?.[key] || "").trim()) : null;
    return acc;
  }, {});
  const urlParams = new URLSearchParams(location.search);
  const focusedJobId = urlParams.get("job") || "";
  const focusedSearchQuery = urlParams.get("q") || focusedJobId;

  useEffect(() => {
    fetch("/api/settings")
      .then((response) => response.ok ? response.json() : {})
      .then((data) => setSettings(data && typeof data === "object" ? data : {}))
      .catch(() => setSettings({}))
      .finally(() => setSettingsLoaded(true));
  }, []);

  return (
    <div className="min-h-screen p-6 lg:p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">
            Generation queue
            <HelpTooltip text="Audit trail for website generation attempts, including failed jobs, fallback-only saves, copy patch jobs, and retries." />
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Generation Jobs</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Audit, sort, and retry site generation jobs without crowding the prospecting screen.
          </p>
        </div>
        <AdminDocsReader
          pathname="/admin/jobs"
          defaultDocId="admin-workflow-audit"
          tooltip="Open generation job QA docs."
          buttonClassName="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-white hover:text-indigo-700"
          iconSize={18}
        />
      </div>

      <GenerationJobsTable
        storageKeyPrefix="webview.adminJobs"
        fallbackProvider={aiProvider}
        fallbackModel={aiModel}
        providerKeyStatus={providerKeyStatus}
        settings={settings}
        onSettingsChange={setSettings}
        limit={200}
        variant="full"
        serverBackedFilters
        serverBackedSearch
        initialSearchQuery={focusedSearchQuery}
        openJobId={focusedJobId}
      />
    </div>
  );
}

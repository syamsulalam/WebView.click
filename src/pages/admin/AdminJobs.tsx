import { useLocalStorageState } from "../../lib/localStorageState";
import GenerationJobsTable from "../../components/GenerationJobsTable";

export default function AdminJobs() {
  const [aiProvider] = useLocalStorageState("webview.adminLeads.aiProvider", "OpenRouter");
  const [aiModel] = useLocalStorageState("webview.adminLeads.aiModel", "~anthropic/claude-sonnet-latest");

  return (
    <div className="min-h-screen p-6 lg:p-8">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Generation queue</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Generation Jobs</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Audit, sort, and retry site generation jobs without crowding the prospecting screen.
        </p>
      </div>

      <GenerationJobsTable
        storageKeyPrefix="webview.adminJobs"
        fallbackProvider={aiProvider}
        fallbackModel={aiModel}
        limit={200}
        variant="full"
        serverBackedFilters
        serverBackedSearch
      />
    </div>
  );
}

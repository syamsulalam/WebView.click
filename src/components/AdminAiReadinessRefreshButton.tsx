import { RefreshCw } from "lucide-react";
import { clearAiReadinessCache } from "../lib/aiReadiness";

type AdminAiReadinessRefreshButtonProps = {
  onRefresh?: () => void;
  className?: string;
};

export default function AdminAiReadinessRefreshButton({
  onRefresh,
  className = "",
}: AdminAiReadinessRefreshButtonProps) {
  return (
    <button
      type="button"
      onClick={() => {
        clearAiReadinessCache();
        onRefresh?.();
      }}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 ${className}`}
      title="Clear the 30 second AI readiness cache and recheck provider key/model badges now."
    >
      <RefreshCw size={13} />
      Refresh AI readiness
    </button>
  );
}

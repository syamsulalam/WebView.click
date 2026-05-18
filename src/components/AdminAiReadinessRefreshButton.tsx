import { RefreshCw } from "lucide-react";
import { clearAiReadinessCache } from "../lib/aiReadiness";
import { clearProviderFailureCache } from "../lib/providerFailure";
import { clearProviderHealthCache } from "../lib/providerHealth";
import HelpTooltip from "./HelpTooltip";

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
        clearProviderFailureCache();
        clearProviderHealthCache();
        onRefresh?.();
      }}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 ${className}`}
    >
      <RefreshCw size={13} />
      Refresh AI readiness
      <HelpTooltip
        widthClass="w-64"
        text="Clears the 30 second browser cache, refreshes last provider failure/health summaries, and asks the server to bypass its short provider/model readiness cache for the next recheck."
      />
    </button>
  );
}

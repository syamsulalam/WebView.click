import { RefreshCw } from "lucide-react";
import { clearAiReadinessCache } from "../lib/aiReadiness";
import { clearProviderFailureCache } from "../lib/providerFailure";
import { clearProviderHealthCache } from "../lib/providerHealth";
import HoverTooltip from "./HoverTooltip";

type AdminAiReadinessRefreshButtonProps = {
  onRefresh?: () => void;
  className?: string;
  iconOnly?: boolean;
};

export default function AdminAiReadinessRefreshButton({
  onRefresh,
  className = "",
  iconOnly = true,
}: AdminAiReadinessRefreshButtonProps) {
  const tooltip = "Refresh AI readiness, last provider failure, and provider health caches before rechecking this provider/model.";
  return (
    <HoverTooltip
      widthClass="w-80"
      text={tooltip}
    >
      <button
        type="button"
        onClick={() => {
          clearAiReadinessCache();
          clearProviderFailureCache();
          clearProviderHealthCache();
          onRefresh?.();
        }}
        className={`inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white ${iconOnly ? "h-9 w-9 p-0" : "px-3 py-2"} text-xs font-semibold text-slate-700 hover:bg-slate-50 ${className}`}
        aria-label="Refresh AI readiness"
      >
        <RefreshCw size={13} />
        {!iconOnly && <span>Refresh AI readiness</span>}
      </button>
    </HoverTooltip>
  );
}

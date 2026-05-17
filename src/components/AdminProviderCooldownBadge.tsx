import { useEffect, useMemo, useState } from "react";
import { Clock3 } from "lucide-react";
import HelpTooltip from "./HelpTooltip";
import {
  clearSharedProviderCooldown,
  formatCooldownRemaining,
  getProviderCooldown,
  getSharedProviderCooldown,
  providerCooldownEvent,
  type ProviderCooldown,
} from "../lib/providerCooldown";

type AdminProviderCooldownBadgeProps = {
  provider?: string;
  className?: string;
  compact?: boolean;
};

export default function AdminProviderCooldownBadge({
  provider = "",
  className = "",
  compact = false,
}: AdminProviderCooldownBadgeProps) {
  const [cooldown, setCooldown] = useState<ProviderCooldown | null>(null);
  const [tick, setTick] = useState(0);
  const [confirmingClear, setConfirmingClear] = useState(false);

  useEffect(() => {
    setConfirmingClear(false);
    let cancelled = false;
    const refresh = () => {
      if (!provider) {
        setCooldown(null);
        return;
      }
      const local = getProviderCooldown(provider);
      setCooldown(local);
      getSharedProviderCooldown(provider).then((shared) => {
        if (!cancelled) setCooldown(shared);
      });
    };
    refresh();
    const pollInterval = provider ? window.setInterval(refresh, 15_000) : 0;
    window.addEventListener(providerCooldownEvent, refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      cancelled = true;
      if (pollInterval) window.clearInterval(pollInterval);
      window.removeEventListener(providerCooldownEvent, refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [provider]);

  useEffect(() => {
    if (!cooldown) return;
    let cancelled = false;
    const interval = window.setInterval(() => {
      setTick((value) => value + 1);
      const activeCooldown = provider ? getProviderCooldown(provider) : null;
      setCooldown(activeCooldown);
      if (!activeCooldown && provider) {
        getSharedProviderCooldown(provider, true).then((shared) => {
          if (!cancelled) setCooldown(shared);
        });
      }
    }, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [cooldown?.until, provider]);

  const remaining = useMemo(() => formatCooldownRemaining(cooldown), [cooldown, tick]);
  const active = Boolean(cooldown);
  const label = active ? `Cooldown ${remaining}` : compact ? "Ready" : "Cooldown clear";
  const statusClass = active
    ? "border-amber-300 bg-amber-50 text-amber-900"
    : "border-emerald-200 bg-emerald-50 text-emerald-800";
  const tooltip = active
    ? `${provider || "Provider"} is paused after a quota/rate-limit error. Wait ${remaining}, then retry once or switch provider/model. ${cooldown?.reason || ""}`
    : `${provider || "Selected provider"} has no active shared cooldown. Generation can still fail if the remote quota changes after this check.`;

  return (
    <span
      className={`inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass} ${className}`}
      title={tooltip}
    >
      <Clock3 size={13} className="shrink-0" />
      <span className="truncate">{label}</span>
      <HelpTooltip
        widthClass="w-72"
        text="Shows the local and shared provider cooldown set after 429, quota, or rate-limit errors. Batch generation pauses while this is active so the app does not keep hammering the exhausted provider."
      />
      {active && !confirmingClear && (
        <button
          type="button"
          onClick={() => setConfirmingClear(true)}
          className="rounded-full border border-amber-300 bg-white/80 px-2 py-0.5 text-[10px] font-bold text-amber-900 hover:bg-white"
          title="Clear this provider cooldown only after quota was raised or you intentionally want to retry this provider."
        >
          Clear
        </button>
      )}
      {active && confirmingClear && (
        <span className="inline-flex items-center gap-1">
          <span className="text-[10px] font-semibold">Clear?</span>
          <button
            type="button"
            onClick={async () => {
              await clearSharedProviderCooldown(provider);
              setCooldown(null);
              setConfirmingClear(false);
            }}
            className="rounded-full bg-amber-700 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-amber-800"
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => setConfirmingClear(false)}
            className="rounded-full border border-amber-300 bg-white/80 px-2 py-0.5 text-[10px] font-bold text-amber-900 hover:bg-white"
          >
            No
          </button>
        </span>
      )}
    </span>
  );
}

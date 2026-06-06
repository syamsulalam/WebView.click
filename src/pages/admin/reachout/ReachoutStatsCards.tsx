import { Mail, MousePointerClick, Target, Trophy } from "lucide-react";
import type { ReactNode } from "react";
import { reachoutTarget, type ReachoutLead } from "./reachoutUtils";

type ReachoutStatsCardsProps = {
  emailReadyCount: number;
  sentCount: number;
  viewedCount: number;
  paidCount: number;
  leads: ReachoutLead[];
};

function StatCard({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
          {icon}
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  );
}

export default function ReachoutStatsCards({ emailReadyCount, sentCount, viewedCount, paidCount, leads }: ReachoutStatsCardsProps) {
  const conversionRate = sentCount > 0 ? ((paidCount / sentCount) * 100).toFixed(1) : "0.0";
  const viewRate = sentCount > 0 ? ((viewedCount / sentCount) * 100).toFixed(1) : "0.0";
  const leadCount = leads.length;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StatCard
        icon={<Target size={22} />}
        label="10k Goal"
        value={`${Math.min(sentCount, reachoutTarget).toLocaleString()} / ${reachoutTarget.toLocaleString()}`}
        detail={`${Math.max(0, reachoutTarget - sentCount).toLocaleString()} businesses left before the first free-site outreach goal.`}
      />
      <StatCard
        icon={<Mail size={22} />}
        label="Email Ready"
        value={emailReadyCount.toLocaleString()}
        detail={`${leadCount.toLocaleString()} total CRM leads loaded; this counts valid email leads only.`}
      />
      <StatCard
        icon={<MousePointerClick size={22} />}
        label="Owner Views"
        value={`${viewedCount.toLocaleString()} (${viewRate}%)`}
        detail="Tracked from owner preview links with campaign/source parameters."
      />
      <StatCard
        icon={<Trophy size={22} />}
        label="Paid Conversion"
        value={`${paidCount.toLocaleString()} (${conversionRate}%)`}
        detail="Goal model is 5% paid conversion after free-site delivery."
      />
    </div>
  );
}

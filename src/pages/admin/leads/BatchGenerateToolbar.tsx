import { BadgeCheck, ListChecks, Loader2, PanelRightOpen, Play } from "lucide-react";
import AdminAiReadinessBadge from "../../../components/AdminAiReadinessBadge";
import AdminProviderCooldownBadge from "../../../components/AdminProviderCooldownBadge";
import HelpTooltip from "../../../components/HelpTooltip";
import HoverTooltip from "../../../components/HoverTooltip";
import { scoreThresholdOptions } from "../../../lib/prospectScoring";

type BatchGenerateToolbarProps = {
  title: string;
  visibleCount: number;
  selectedCount: number;
  visibleProspects: any[];
  selectedProspects: Record<string, boolean>;
  activeScoringPresetLabel: string;
  activeScoringPreset: any;
  minScoreFilter: string;
  minScore: number;
  batchMessage: string;
  batchQueueRunning: boolean;
  generationJobCount: number;
  activeProviderKey: string;
  activeModel: string;
  activeProviderKeyReady: boolean;
  getPlaceKey: (place: any) => string;
  prospectScore: (place: any) => { score: number };
  setSelectedProspects: (value: Record<string, boolean>) => void;
  startBatchGenerate: () => void;
  toggleJobs: () => void;
};

export default function BatchGenerateToolbar({
  title,
  visibleCount,
  selectedCount,
  visibleProspects,
  selectedProspects,
  activeScoringPresetLabel,
  activeScoringPreset,
  minScoreFilter,
  minScore,
  batchMessage,
  batchQueueRunning,
  generationJobCount,
  activeProviderKey,
  activeModel,
  activeProviderKeyReady,
  getPlaceKey,
  prospectScore,
  setSelectedProspects,
  startBatchGenerate,
  toggleJobs,
}: BatchGenerateToolbarProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="inline-flex items-center gap-1.5 font-semibold text-slate-900">
          {title}
          <HelpTooltip text="Bulk buttons act only on the visible filtered list. Generate selected runs sequentially from the browser so AI requests are not fired all at once." />
        </p>
        <p className="inline-flex items-center gap-1.5">
          {visibleCount} visible. {selectedCount} selected.
          <HelpTooltip text="Visible prospects are filtered by the current filters and sorted by conversion score from highest to lowest." />
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-800">
            Scoring preset: {activeScoringPresetLabel}
            <HelpTooltip
              widthClass="w-72"
              text={`Applied to the current visible list. Threshold: ${scoreThresholdOptions.find((option) => option.value === minScoreFilter)?.label || `${minScore}+`}. Tune this in /admin/settings.`}
            />
          </span>
          {activeScoringPreset?.description && (
            <span className="text-xs text-slate-500">{activeScoringPreset.description}</span>
          )}
        </div>
        {batchMessage && <p className="mt-1 text-xs text-indigo-700">{batchMessage}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <HoverTooltip text={selectedCount === visibleCount ? "Clear all visible prospect selections." : "Select all currently visible prospects."}>
          <button
            type="button"
            onClick={() => {
              const allSelected = selectedCount === visibleCount;
              const next = { ...selectedProspects };
              visibleProspects.forEach((place) => {
                const key = getPlaceKey(place);
                if (key) next[key] = !allSelected;
              });
              setSelectedProspects(next);
            }}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
            aria-label={selectedCount === visibleCount ? "Clear selected prospects" : "Select visible prospects"}
          >
            <ListChecks size={14} />
          </button>
        </HoverTooltip>
        <HoverTooltip text="Select visible prospects with conversion score 70 or higher.">
          <button
            type="button"
            onClick={() => {
              const next = { ...selectedProspects };
              visibleProspects.forEach((place) => {
                const key = getPlaceKey(place);
                if (key) next[key] = prospectScore(place).score >= 70;
              });
              setSelectedProspects(next);
            }}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
            aria-label="Select prospects score 70 plus"
          >
            <BadgeCheck size={14} />
          </button>
        </HoverTooltip>
        <HoverTooltip text="Generate websites for selected visible prospects sequentially.">
          <button
            type="button"
            onClick={startBatchGenerate}
            disabled={batchQueueRunning || selectedCount === 0}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
            aria-label="Generate selected prospects"
          >
            {batchQueueRunning ? <Loader2 className="animate-spin" size={14} /> : <Play size={14} />}
          </button>
        </HoverTooltip>
        <AdminAiReadinessBadge
          provider={activeProviderKey}
          model={activeModel}
          hasApiKey={activeProviderKeyReady}
          requiresAi
          remoteValidate
        />
        <AdminProviderCooldownBadge provider={activeProviderKey} compact />
        <HoverTooltip text="Open generation jobs for the current prospect workflow.">
          <button
            type="button"
            onClick={toggleJobs}
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
            aria-label="Open generation jobs"
          >
            <PanelRightOpen size={14} />
            {generationJobCount > 0 && (
              <span className="absolute -right-1 -top-1 rounded-full bg-slate-900 px-1 text-[10px] font-semibold text-white">{generationJobCount}</span>
            )}
          </button>
        </HoverTooltip>
      </div>
    </div>
  );
}

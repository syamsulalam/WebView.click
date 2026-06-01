import { ExternalLink, ListChecks, Loader2 } from "lucide-react";
import HelpTooltip from "../../../components/HelpTooltip";
import HoverTooltip from "../../../components/HoverTooltip";

type ManualImportPanelProps = {
  open: string;
  manualMapsUrl: string;
  manualCaptureText: string;
  manualImportLoading: boolean;
  manualImportMessage: string;
  setOpen: (value: string) => void;
  setManualMapsUrl: (value: string) => void;
  setManualCaptureText: (value: string) => void;
  onImport: () => void;
};

export default function ManualImportPanel({
  open,
  manualMapsUrl,
  manualCaptureText,
  manualImportLoading,
  manualImportMessage,
  setOpen,
  setManualMapsUrl,
  setManualCaptureText,
  onImport,
}: ManualImportPanelProps) {
  return (
    <details
      open={open === "1"}
      onToggle={(event) => setOpen(event.currentTarget.open ? "1" : "0")}
      className="mb-4 rounded-xl border border-slate-200 bg-white p-4"
    >
      <summary className="cursor-pointer text-sm font-semibold text-slate-800">
        Manual Google Maps import fallback
      </summary>
      <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
        <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-950">
              Manual Google Maps import
              <HelpTooltip text="Fallback for quota outages: paste a single Google Maps listing URL, or paste captured JSON from the browser helper when you are on a Maps search result page." />
            </p>
            <p className="mt-1 text-xs text-slate-600">
              Listing URLs can create one draft. Search URLs need captured browser JSON because Google Maps renders the business cards inside the page.
            </p>
          </div>
          <HoverTooltip text="Open the extension helper instructions for capturing visible Google Maps cards.">
            <a
              href="/tools/google-maps-capture-extension/README.md"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50"
              aria-label="Open Google Maps capture helper"
            >
              <ExternalLink size={14} />
            </a>
          </HoverTooltip>
        </div>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <label className="text-sm">
            <span className="mb-1 flex items-center gap-1.5 font-medium text-slate-700">
              Google Maps URL
              <HelpTooltip text="Paste a /maps/place listing URL for one business, or the /maps/search URL you used while capturing visible listings with the extension helper." />
            </span>
            <input
              value={manualMapsUrl}
              onChange={(event) => setManualMapsUrl(event.target.value)}
              placeholder="https://www.google.com/maps/place/..."
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 flex items-center gap-1.5 font-medium text-slate-700">
              Captured listing JSON
              <HelpTooltip text="Optional for one listing. Required for Maps search pages; paste the JSON copied by the Chrome/Opera helper so each visible business becomes a prospect draft." />
            </span>
            <textarea
              value={manualCaptureText}
              onChange={(event) => setManualCaptureText(event.target.value)}
              rows={3}
              placeholder='[{"name":"Business Name","address":"...","hasWebsite":false}]'
              className="min-h-[42px] w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </label>
        </div>
        <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <p className={`text-xs ${manualImportMessage.includes("failed") || manualImportMessage.includes("Paste") ? "text-red-700" : "text-slate-600"}`}>
            {manualImportMessage || "Imported drafts appear in the same prospect pipeline below."}
          </p>
          <HoverTooltip text="Import URL-derived or browser-captured Google Maps data into prospect drafts.">
            <button
              type="button"
              onClick={onImport}
              disabled={manualImportLoading}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
              aria-label="Import manual prospects"
            >
              {manualImportLoading ? <Loader2 className="animate-spin" size={16} /> : <ListChecks size={16} />}
            </button>
          </HoverTooltip>
        </div>
      </div>
    </details>
  );
}

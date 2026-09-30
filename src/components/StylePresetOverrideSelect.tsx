import { siteStylePresets } from "../lib/siteStylePresets";

export const STYLE_PRESET_OVERRIDE_KEY = "webview.stylePresetOverride";

type StylePresetOverrideSelectProps = {
  value: string;
  onChange: (next: string) => void;
  className?: string;
  id?: string;
};

// Shared style-preset override for site generation (PRD.md A3). Empty value
// means Auto: the scaffold infers the preset from primaryType/types/reviews.
// A concrete choice is stored on the scaffold (design.stylePresetExplicit) and
// survives the pattern-default upgrade in postprocess.
export default function StylePresetOverrideSelect({ value, onChange, className = "", id = "style-preset-override" }: StylePresetOverrideSelectProps) {
  return (
    <label htmlFor={id} className={`inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 ${className}`}>
      Style:
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Niche style preset override for site generation"
        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <option value="">Auto (from business type)</option>
        {siteStylePresets.map((preset) => (
          <option key={preset.id} value={preset.id}>{preset.label}</option>
        ))}
      </select>
    </label>
  );
}

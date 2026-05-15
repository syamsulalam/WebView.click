import { type ReactNode } from "react";
import { CircleHelp } from "lucide-react";

type HelpTooltipProps = {
  text?: string;
  children?: ReactNode;
  widthClass?: string;
};

export default function HelpTooltip({ text, children, widthClass = "w-72" }: HelpTooltipProps) {
  return (
    <span className="group relative inline-flex align-middle">
      <CircleHelp size={14} className="text-slate-400" />
      <span className={`pointer-events-none absolute bottom-full left-1/2 z-[220] mb-2 -translate-x-1/2 rounded-xl bg-slate-950 px-3 py-2 text-xs leading-relaxed text-white opacity-0 shadow-xl transition group-hover:opacity-100 ${widthClass}`}>
        {children || text}
      </span>
    </span>
  );
}

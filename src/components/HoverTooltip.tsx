import { type ReactNode } from "react";

type HoverTooltipProps = {
  text?: ReactNode;
  children: ReactNode;
  widthClass?: string;
  className?: string;
  tooltipClassName?: string;
};

export default function HoverTooltip({
  text,
  children,
  widthClass = "w-72",
  className = "",
  tooltipClassName = "",
}: HoverTooltipProps) {
  if (!text) {
    return <>{children}</>;
  }

  return (
    <span className={`group/hover-tooltip relative inline-flex max-w-full align-middle ${className}`}>
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute bottom-full left-1/2 z-[260] mb-2 -translate-x-1/2 rounded-xl bg-slate-950 px-3 py-2 text-xs font-medium leading-relaxed text-white opacity-0 shadow-xl transition group-hover/hover-tooltip:opacity-100 group-focus-within/hover-tooltip:opacity-100 ${widthClass} ${tooltipClassName}`}
      >
        {text}
      </span>
    </span>
  );
}

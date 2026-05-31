import type { ReactNode } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import HelpTooltip from "./HelpTooltip";

type AdminCollapsibleSectionHeaderProps = {
  title: string;
  icon: LucideIcon;
  open: boolean;
  onToggle: () => void;
  tooltip?: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  descriptionClassName?: string;
  iconClassName?: string;
  titleClassName?: string;
  actionsClassName?: string;
  chevronClassName?: string;
};

export default function AdminCollapsibleSectionHeader({
  title,
  icon: Icon,
  open,
  onToggle,
  tooltip,
  description,
  actions,
  className = "",
  descriptionClassName = "mt-1 text-sm text-gray-500",
  iconClassName = "text-indigo-600",
  titleClassName = "text-lg font-semibold text-gray-900",
  actionsClassName = "",
  chevronClassName = "",
}: AdminCollapsibleSectionHeaderProps) {
  return (
    <div className={`flex w-full items-start gap-2 ${className}`}>
      <button type="button" onClick={onToggle} className="min-w-0 flex-1 text-left">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <Icon size={19} className={`shrink-0 ${iconClassName}`} />
            <h2 className={`inline-flex min-w-0 items-center gap-1.5 ${titleClassName}`}>
              {title}
              {tooltip && <HelpTooltip text={tooltip} />}
            </h2>
          </div>
          {description && <p className={descriptionClassName}>{description}</p>}
        </div>
      </button>
      {open && actions ? <div className={`shrink-0 ${actionsClassName}`}>{actions}</div> : null}
      <button
        type="button"
        onClick={onToggle}
        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-indigo-700 ${chevronClassName}`}
        aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
        aria-expanded={open}
      >
        <ChevronDown size={18} className={`transition ${open ? "rotate-180" : ""}`} />
      </button>
    </div>
  );
}

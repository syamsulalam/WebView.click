import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CircleHelp } from "lucide-react";

type HelpTooltipProps = {
  text?: string;
  children?: ReactNode;
  widthClass?: string;
};

export default function HelpTooltip({ text, children, widthClass = "w-72" }: HelpTooltipProps) {
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const tooltipRef = useRef<HTMLSpanElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0, placement: "top" as "top" | "bottom" });

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const placement = rect.top > 140 ? "top" : "bottom";
    const tooltipWidth = tooltipRef.current?.offsetWidth || 288;
    const sideMargin = 12;
    const minLeft = tooltipWidth / 2 + sideMargin;
    const maxLeft = window.innerWidth - tooltipWidth / 2 - sideMargin;
    const anchorCenter = rect.left + rect.width / 2;
    setPosition({
      left: Math.min(Math.max(anchorCenter, minLeft), Math.max(minLeft, maxLeft)),
      top: placement === "top" ? rect.top - 8 : rect.bottom + 8,
      placement,
    });
  }, []);

  const show = () => {
    updatePosition();
    setVisible(true);
  };

  useEffect(() => {
    if (!visible) return;
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [visible, updatePosition]);

  return (
    <span
      ref={anchorRef}
      className="inline-flex align-middle"
      onMouseEnter={show}
      onMouseLeave={() => setVisible(false)}
      onFocus={show}
      onBlur={() => setVisible(false)}
    >
      <CircleHelp size={14} className="text-slate-400" />
      {visible && typeof document !== "undefined" && createPortal(
        <span
          ref={tooltipRef}
          role="tooltip"
          className={`pointer-events-none fixed z-[100001] -translate-x-1/2 rounded-xl bg-slate-950 px-3 py-2 text-xs leading-relaxed text-white opacity-100 shadow-2xl ${position.placement === "top" ? "-translate-y-full" : ""} ${widthClass}`}
          style={{ left: position.left, top: position.top }}
        >
          {children || text}
        </span>,
        document.body,
      )}
    </span>
  );
}

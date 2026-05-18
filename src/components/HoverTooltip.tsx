import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

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
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0, placement: "top" as "top" | "bottom" });

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const placement = rect.top > 140 ? "top" : "bottom";
    setPosition({
      left: Math.min(Math.max(rect.left + rect.width / 2, 12), window.innerWidth - 12),
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

  if (!text) {
    return <>{children}</>;
  }

  return (
    <span
      ref={anchorRef}
      className={`inline-flex max-w-full align-middle ${className}`}
      onMouseEnter={show}
      onMouseLeave={() => setVisible(false)}
      onFocus={show}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && typeof document !== "undefined" && createPortal(
        <span
          role="tooltip"
          className={`pointer-events-none fixed z-[100001] -translate-x-1/2 rounded-xl bg-slate-950 px-3 py-2 text-xs font-medium leading-relaxed text-white opacity-100 shadow-2xl ${position.placement === "top" ? "-translate-y-full" : ""} ${widthClass} ${tooltipClassName}`}
          style={{ left: position.left, top: position.top }}
        >
          {text}
        </span>,
        document.body,
      )}
    </span>
  );
}

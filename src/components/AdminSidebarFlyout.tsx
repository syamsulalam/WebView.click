import { type ReactNode } from "react";

type AdminSidebarFlyoutProps = {
  label: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  widthClass?: string;
  className?: string;
};

export default function AdminSidebarFlyout({
  label,
  description,
  children,
  widthClass = "w-64",
  className = "",
}: AdminSidebarFlyoutProps) {
  return (
    <div className={`group relative inline-flex ${className}`}>
      {children}
      <div
        className={`pointer-events-none absolute left-full top-1/2 z-[9999] ml-3 -translate-y-1/2 rounded-lg bg-gray-900 px-3 py-2 text-left text-xs text-white opacity-0 shadow-xl transition group-hover:opacity-100 group-focus-within:opacity-100 ${widthClass}`}
      >
        <span className="block font-semibold">{label}</span>
        {description && <span className="mt-1 block leading-relaxed text-gray-300">{description}</span>}
      </div>
    </div>
  );
}

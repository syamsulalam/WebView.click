type AdminWorkspaceTab = {
  key: string;
  label: string;
};

type AdminWorkspaceTabsProps = {
  tabs: AdminWorkspaceTab[];
  activeTab: string;
  onChange: (key: string) => void;
  className?: string;
};

export default function AdminWorkspaceTabs({ tabs, activeTab, onChange, className = "" }: AdminWorkspaceTabsProps) {
  return (
    <div className={`inline-flex w-full rounded-xl border border-slate-200 bg-white p-1 text-sm font-semibold shadow-sm lg:w-auto ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={`flex-1 rounded-lg px-3 py-2 transition lg:flex-none ${
            activeTab === tab.key ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

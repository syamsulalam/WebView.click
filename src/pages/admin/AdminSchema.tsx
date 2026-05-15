import { useEffect, useState } from "react";

export default function AdminSchema() {
  const [schemaData, setSchemaData] = useState<string>("");
  const [repairing, setRepairing] = useState(false);
  const [repairMessage, setRepairMessage] = useState("");
  const [repairData, setRepairData] = useState<any>(null);

  useEffect(() => {
    fetch('/api/schema')
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          try {
             const errorJson = JSON.parse(text);
             throw new Error(errorJson.error || "Failed to load schema");
          } catch(e: any) {
             if (e.message.includes("Failed to load schema")) throw e;
             throw new Error(`Server returned ${res.status}: ${text.substring(0, 50)}`);
          }
        }
        return res.json();
      })
      .then(data => setSchemaData(JSON.stringify(data, null, 2)))
      .catch(err => setSchemaData(err.message || String(err)));
  }, []);

  const handleRepairDb = async () => {
    setRepairing(true);
    setRepairMessage("");
    setRepairData(null);
    try {
      const response = await fetch("/api/schema/repair", { method: "POST" });
      const text = await response.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(`Repair response bukan JSON: ${text.slice(0, 160)}`);
      }
      if (!response.ok || data.error) {
        throw new Error(data.error || `Repair failed with HTTP ${response.status}`);
      }
      setRepairData(data);
      const tableCount = data.tables ? Object.keys(data.tables).length : 0;
      window.localStorage.setItem("webview.admin.lastDbRepairAt", data.repairedAt || new Date().toISOString());
      setRepairMessage(`DB repair complete. ${tableCount} tables checked at ${data.repairedAt || "now"}.`);
    } catch (error) {
      setRepairMessage(error instanceof Error ? error.message : "DB repair failed.");
    } finally {
      setRepairing(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto font-sans">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold mb-2 text-gray-900">JSON Schema Mapping</h1>
          <p className="text-gray-500 max-w-3xl">
            This is the baseline schema used by the AI to generate content for prospects. The <code className="bg-gray-100 text-gray-800 px-1 rounded">pages</code> array supports dynamically adding sections like <code className="text-indigo-600 bg-indigo-50 px-1 rounded">hero</code>, <code className="text-indigo-600 bg-indigo-50 px-1 rounded">textImageBlock</code>, <code className="text-indigo-600 bg-indigo-50 px-1 rounded">teamGrid</code>, <code className="text-indigo-600 bg-indigo-50 px-1 rounded">gridCards</code>, <code className="text-indigo-600 bg-indigo-50 px-1 rounded">imageGallery</code>, and <code className="text-indigo-600 bg-indigo-50 px-1 rounded">contactForm</code>.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRepairDb}
          disabled={repairing}
          className="inline-flex items-center justify-center rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {repairing ? "Repairing..." : "Repair DB now"}
        </button>
      </div>

      {repairMessage && (
        <div className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
          repairData?.success
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-red-200 bg-red-50 text-red-800"
        }`}>
          <p className="font-semibold">{repairMessage}</p>
          {repairData?.tables && (
            <p className="mt-1 text-xs opacity-80">
              Tables: {Object.entries(repairData.tables).map(([table, columns]: any) => `${table} (${columns.length})`).join(", ")}
            </p>
          )}
        </div>
      )}

      <div className="bg-[#1E1E1E] rounded-xl overflow-hidden shadow-xl border border-gray-800">
        <div className="bg-[#2D2D2D] px-4 py-2 border-b border-[#404040] flex items-center gap-2">
           <div className="w-3 h-3 rounded-full bg-red-500"></div>
           <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
           <div className="w-3 h-3 rounded-full bg-green-500"></div>
           <span className="text-gray-400 text-xs ml-2 font-mono">/JSON/template-schema.json</span>
        </div>
        <pre className="p-6 text-sm text-gray-300 overflow-auto max-h-[70vh] font-mono leading-relaxed">
          {schemaData || "Loading schema..."}
        </pre>
      </div>
    </div>
  );
}

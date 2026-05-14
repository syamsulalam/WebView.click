import { useEffect, useState } from "react";

export default function AdminSchema() {
  const [schemaData, setSchemaData] = useState<string>("");

  useEffect(() => {
    // You could fetch this from an API if you want to be dynamic. 
    // Here we're fetching from a static file for demonstration or loading directly via imports.
    fetch('/api/schema')
      .then(res => res.json())
      .then(data => setSchemaData(JSON.stringify(data, null, 2)))
      .catch(err => setSchemaData("Failed to load schema: " + err.message));
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto font-sans">
      <h1 className="text-3xl font-semibold mb-2 text-gray-900">JSON Schema Mapping</h1>
      <p className="text-gray-500 mb-8 max-w-3xl">
        This is the baseline schema used by the AI to generate content for prospects. The <code className="bg-gray-100 text-gray-800 px-1 rounded">pages</code> array supports dynamically adding sections like <code className="text-indigo-600 bg-indigo-50 px-1 rounded">hero</code>, <code className="text-indigo-600 bg-indigo-50 px-1 rounded">textImageBlock</code>, <code className="text-indigo-600 bg-indigo-50 px-1 rounded">teamGrid</code>, <code className="text-indigo-600 bg-indigo-50 px-1 rounded">gridCards</code>, <code className="text-indigo-600 bg-indigo-50 px-1 rounded">imageGallery</code>, and <code className="text-indigo-600 bg-indigo-50 px-1 rounded">contactForm</code>.
      </p>

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

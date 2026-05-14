import { useEffect, useState } from "react";

export default function AdminDashboard() {
  const [stats, setStats] = useState({ totalLeads: 0, conversionRate: 0, totalRevenue: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats")
      .then(r => r.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(e => console.error(e));
  }, []);

  return (
    <div className="p-8 max-w-6xl mx-auto font-sans">
      <h1 className="text-3xl font-semibold mb-8 text-gray-900">Dashboard</h1>
      
      {loading ? (
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-4 py-1">
            <div className="h-24 bg-gray-200 rounded-xl"></div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-sm font-medium text-gray-500 mb-2">Total Leads Scraped</p>
            <p className="text-4xl font-semibold text-gray-900">{stats.totalLeads}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-sm font-medium text-gray-500 mb-2">Conversion Rate</p>
            <p className="text-4xl font-semibold text-gray-900">{stats.conversionRate.toFixed(1)}%</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-sm font-medium text-gray-500 mb-2">Total Revenue Overview</p>
            <p className="text-4xl font-semibold text-gray-900">${stats.totalRevenue.toFixed(2)}</p>
          </div>
        </div>
      )}
      
      <div className="mt-12 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 overflow-hidden">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Aktivitas Terkini (Simulasi Demo)</h2>
        <div className="text-gray-500 text-sm">
          Untuk menguji alur pembuatan JSON secara end-to-end, masuk ke menu CRM Leads dan cari prospek.
        </div>
      </div>
    </div>
  );
}

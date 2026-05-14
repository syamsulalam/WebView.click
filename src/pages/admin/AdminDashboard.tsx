import { useEffect, useState } from "react";

export default function AdminDashboard() {
  const [stats, setStats] = useState({ totalLeads: 0, conversionRate: 0, totalRevenue: 0 });
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/stats").then(r => r.json()),
      fetch("/api/activities").then(r => r.json())
    ]).then(([statsData, activitiesData]) => {
      setStats(statsData);
      setActivities(activitiesData);
      setLoading(false);
    }).catch(e => console.error(e));
  }, []);

  return (
    <div className="p-8 max-w-6xl mx-auto font-sans bg-gray-50/50 min-h-[calc(100vh-64px)] rounded-3xl mt-4 border border-gray-100">
      <h1 className="text-3xl font-semibold mb-8 text-gray-900 tracking-tight">Overview</h1>
      
      {loading ? (
        <div className="animate-pulse space-y-8">
          <div className="grid grid-cols-3 gap-6">
            <div className="h-32 bg-gray-200 rounded-2xl"></div>
            <div className="h-32 bg-gray-200 rounded-2xl"></div>
            <div className="h-32 bg-gray-200 rounded-2xl"></div>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm transition hover:shadow-md">
              <p className="text-sm font-medium text-gray-500 mb-2 uppercase tracking-wide">Total Leads Scraped</p>
              <p className="text-4xl font-semibold text-gray-900">{stats.totalLeads}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm transition hover:shadow-md">
              <p className="text-sm font-medium text-gray-500 mb-2 uppercase tracking-wide">Conversion Rate</p>
              <p className="text-4xl font-semibold text-gray-900">{stats.conversionRate.toFixed(1)}%</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm transition hover:shadow-md">
              <p className="text-sm font-medium text-gray-500 mb-2 uppercase tracking-wide">Total Revenue</p>
              <p className="text-4xl font-semibold text-green-600">${stats.totalRevenue.toFixed(2)}</p>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Aktivitas CRM Terkini</h2>
            </div>
            {activities.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {activities.map((act) => (
                  <div key={act.id} className="p-6 flex items-start gap-4 hover:bg-gray-50/50 transition">
                    <div className="mt-1 w-2 h-2 rounded-full bg-indigo-500" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{act.business_name || "Unknown Lead"}</p>
                      <p className="text-sm text-gray-600 mt-1">{act.description}</p>
                      <p className="text-xs text-gray-400 mt-2">{new Date(act.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center">
                <p className="text-gray-500 mb-2">Belum ada aktivitas CRM.</p>
                <p className="text-sm text-gray-400">Gunakan menu CRM Leads untuk mencari prospek baru di Google Maps dan men-generate JSON website AI.</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

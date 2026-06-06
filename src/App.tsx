/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { lazy, Suspense } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';

const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminLeads = lazy(() => import('./pages/admin/AdminLeads'));
const AdminJobs = lazy(() => import('./pages/admin/AdminJobs'));
const AdminSites = lazy(() => import('./pages/admin/AdminSites'));
const AdminSchema = lazy(() => import('./pages/admin/AdminSchema'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'));
const AdminOrders = lazy(() => import('./pages/admin/AdminOrders'));
const AdminReachout = lazy(() => import('./pages/admin/AdminReachout'));
const AdminLayout = lazy(() => import('./components/AdminLayout'));
const PublicViewer = lazy(() => import('./pages/public/PublicViewer'));
const HubPage = lazy(() => import('./pages/public/HubPage'));
const DemoSite = lazy(() => import('./pages/public/DemoSite'));
const TermsRefund = lazy(() => import('./pages/public/TermsRefund'));
const MarketingAuditViewer = lazy(() => import('./pages/public/MarketingAuditViewer'));

function RouteLoading() {
  const location = useLocation();
  if (location.pathname.startsWith('/admin')) {
    return (
      <div className="flex h-screen w-full overflow-hidden bg-gray-50">
        <div className="flex w-20 shrink-0 flex-col items-center gap-6 border-r border-gray-200 bg-white py-6">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-12 w-12 animate-pulse rounded-xl bg-gray-100" />
          ))}
          <div className="mt-auto h-12 w-12 animate-pulse rounded-xl bg-gray-100" />
        </div>
        <main className="min-w-0 flex-1 overflow-hidden p-6">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <div className="h-7 w-48 animate-pulse rounded bg-slate-200" />
              <div className="mt-3 h-4 w-72 animate-pulse rounded bg-slate-100" />
            </div>
            <div className="h-10 w-32 animate-pulse rounded-lg bg-slate-200" />
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-xl border border-slate-200 bg-white" />
            ))}
          </div>
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-4 h-9 animate-pulse rounded-lg bg-slate-100" />
            <div className="space-y-3">
              {Array.from({ length: 7 }).map((_, index) => (
                <div key={index} className="grid grid-cols-[1.2fr_0.8fr_0.7fr_0.5fr] gap-4">
                  <div className="h-5 animate-pulse rounded bg-slate-100" />
                  <div className="h-5 animate-pulse rounded bg-slate-100" />
                  <div className="h-5 animate-pulse rounded bg-slate-100" />
                  <div className="h-5 animate-pulse rounded bg-slate-100" />
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="flex h-16 items-center justify-between border-b border-slate-100 px-5 md:px-12">
        <div className="h-6 w-40 animate-pulse rounded bg-slate-200" />
        <div className="hidden items-center gap-4 md:flex">
          <div className="h-4 w-16 animate-pulse rounded bg-slate-100" />
          <div className="h-4 w-20 animate-pulse rounded bg-slate-100" />
          <div className="h-4 w-14 animate-pulse rounded bg-slate-100" />
        </div>
        <div className="h-9 w-28 animate-pulse rounded-lg bg-slate-200" />
      </header>
      <main className="grid min-h-[calc(100vh-4rem)] items-center gap-10 px-6 py-12 md:grid-cols-[1.05fr_0.95fr] md:px-12">
        <section className="max-w-2xl">
          <div className="mb-5 h-4 w-32 animate-pulse rounded bg-slate-100" />
          <div className="space-y-3">
            <div className="h-12 w-full max-w-xl animate-pulse rounded bg-slate-200" />
            <div className="h-12 w-4/5 animate-pulse rounded bg-slate-200" />
          </div>
          <div className="mt-6 space-y-3">
            <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-slate-100" />
          </div>
          <div className="mt-8 flex gap-3">
            <div className="h-11 w-36 animate-pulse rounded-lg bg-slate-200" />
            <div className="h-11 w-28 animate-pulse rounded-lg border border-slate-200 bg-white" />
          </div>
        </section>
        <section className="h-[340px] animate-pulse rounded-2xl border border-slate-200 bg-slate-100 md:h-[500px]" />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Routes>
        <Route path="/" element={<HubPage />} />
        <Route path="/demo" element={<DemoSite />} />
        <Route path="/terms-refund" element={<TermsRefund />} />
        <Route path="/audit/:businessId" element={<MarketingAuditViewer />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="leads" element={<AdminLeads />} />
          <Route path="jobs" element={<AdminJobs />} />
          <Route path="sites" element={<AdminSites />} />
          <Route path="reachout" element={<AdminReachout />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="schema" element={<AdminSchema />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>
        <Route path="/:businessId" element={<PublicViewer />} />
      </Routes>
    </Suspense>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { Routes, Route, Navigate } from 'react-router-dom';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminLeads from './pages/admin/AdminLeads';
import AdminJobs from './pages/admin/AdminJobs';
import AdminSites from './pages/admin/AdminSites';
import AdminSchema from './pages/admin/AdminSchema';
import AdminSettings from './pages/admin/AdminSettings';
import AdminOrders from './pages/admin/AdminOrders';
import AdminReachout from './pages/admin/AdminReachout';
import AdminLayout from './components/AdminLayout';
import PublicViewer from './pages/public/PublicViewer';
import HubPage from './pages/public/HubPage';
import DemoSite from './pages/public/DemoSite';
import TermsRefund from './pages/public/TermsRefund';
import MarketingAuditViewer from './pages/public/MarketingAuditViewer';

export default function App() {
  return (
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
  );
}

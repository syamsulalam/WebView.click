/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { Routes, Route, Navigate } from 'react-router-dom';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminLeads from './pages/admin/AdminLeads';
import AdminLayout from './components/AdminLayout';
import PublicViewer from './pages/public/PublicViewer';
import HubPage from './pages/public/HubPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HubPage />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminDashboard />} />
        <Route path="leads" element={<AdminLeads />} />
      </Route>
      <Route path="/:businessId" element={<PublicViewer />} />
    </Routes>
  );
}

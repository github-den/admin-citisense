import { useState } from 'react';
import AdminLayout        from './components/AdminLayout/AdminLayout.jsx';
import DashboardPage      from './pages/DashboardPage/DashboardPage.jsx';
import FeedbacksPage      from './pages/FeedbacksPage/FeedbacksPage.jsx';
import UsersPage          from './pages/UsersPage/UsersPage.jsx';
import FeedboxesPage      from './pages/FeedboxesPage/FeedboxesPage.jsx';
import AnalyticsPage      from './pages/AnalyticsPage/AnalyticsPage.jsx';
import AdminSettingsPage  from './pages/AdminSettingsPage/AdminSettingsPage.jsx';

export default function AdminApp() {
  const [page, setPage] = useState('dashboard');

  return (
    <AdminLayout page={page} setPage={setPage}>
      {page === 'dashboard' && <DashboardPage />}
      {page === 'feedbacks' && <FeedbacksPage />}
      {page === 'users'     && <UsersPage />}
      {page === 'feedboxes' && <FeedboxesPage />}
      {page === 'analytics' && <AnalyticsPage />}
      {page === 'settings'  && <AdminSettingsPage />}
    </AdminLayout>
  );
}

import { useEffect, useMemo, useState } from 'react';
import AdminLayout from './components/AdminLayout/AdminLayout.jsx';
import DashboardPage from './screens/DashboardPage/DashboardPage.jsx';
import FeedbacksPage from './screens/FeedbacksPage/FeedbacksPage.jsx';
import ActivityLogsPage from './screens/ActivityLogsPage/ActivityLogsPage.jsx';
import AccountManagementPage from './screens/AccountManagementPage/AccountManagementPage.jsx';
import ReportsPage from './screens/ReportsPage/ReportsPage.jsx';
import { useAdminWorkspace } from './core/hooks/useAdminWorkspace.js';
import { useAdminStats } from './core/hooks/useAdminStats.js';
import { deriveVerificationStatus, scopePostsToWorkspace } from './core/lib/adminWorkspace.js';

const SCREEN_COMPONENTS = {
  dashboard: DashboardPage,
  feedbacks: FeedbacksPage,
  activity: ActivityLogsPage,
  accounts: AccountManagementPage,
  reports: ReportsPage,
};

export default function AdminApp() {
  const workspace = useAdminWorkspace();
  const { stats } = useAdminStats();
  const defaultPage = workspace.pages?.[0]?.key ?? 'dashboard';
  const [page, setPage] = useState(defaultPage);

  useEffect(() => {
    if (!workspace.pages?.some((item) => item.key === page)) {
      setPage(defaultPage);
    }
  }, [defaultPage, page, workspace.pages]);

  const navBadges = useMemo(() => {
    const scopedPosts = scopePostsToWorkspace(stats?.posts ?? [], workspace);
    const unreadFeedbackCount = scopedPosts.filter((post) => deriveVerificationStatus(post.status) === 'Under Review').length;

    const reportsCount = stats?.reports?.length ?? 0;

    return {
      feedbacks: unreadFeedbackCount,
      reports: reportsCount,
    };
  }, [stats?.posts, workspace]);

  const ActiveScreen = SCREEN_COMPONENTS[page] ?? DashboardPage;

  return (
    <AdminLayout page={page} setPage={setPage} workspace={workspace} navBadges={navBadges}>
      <ActiveScreen />
    </AdminLayout>
  );
}

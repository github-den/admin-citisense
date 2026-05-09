'use client';

import { useMemo, useEffect, useState } from 'react';
import { ShieldCheck } from '@phosphor-icons/react';
import { useAuth } from '@/core/context/AuthContext.jsx';
import { useAdminWorkspace } from '@/core/hooks/useAdminWorkspace.js';
import { useAdminStats } from '@/core/hooks/useAdminStats.js';
import { isAdminRole } from '@/core/lib/auth/roles.js';
import { deriveVerificationStatus, scopePostsToWorkspace } from '@/core/lib/adminWorkspace.js';
import AdminLayout from '@/components/AdminLayout/AdminLayout.jsx';
import styles from '@/AdminRoot.module.css';

export default function WorkspaceLayout({ children }) {
  const { loading, session } = useAuth();
  const workspace = useAdminWorkspace();
  const { stats } = useAdminStats();
  const [desktopReady, setDesktopReady] = useState(true);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const syncDesktopState = () => setDesktopReady(mediaQuery.matches);
    syncDesktopState();
    mediaQuery.addEventListener('change', syncDesktopState);
    return () => mediaQuery.removeEventListener('change', syncDesktopState);
  }, []);

  const navBadges = useMemo(() => {
    const scopedPosts = scopePostsToWorkspace(stats?.posts ?? [], workspace);
    const unreadFeedbackCount = scopedPosts.filter((post) => deriveVerificationStatus(post.status) === 'Under Review').length;
    const reportsCount = stats?.reports?.length ?? 0;

    return {
      feedbacks: unreadFeedbackCount,
      reports: reportsCount,
    };
  }, [stats?.posts, workspace]);

  if (loading) return null;

  // Gate logic
  if (!session || !isAdminRole(session)) {
    // Usually redirected by middleware, but as a fallback:
    return null; 
  }

  if (!desktopReady) {
    return (
      <div className={styles.shell}>
        <div className={styles.card}>
          <div className={styles.iconWrap}>
            <ShieldCheck size={30} weight="fill" />
          </div>
          <div className={styles.kicker}>CitiSense Admin</div>
          <h1 className={styles.title}>Desktop-only admin workspace</h1>
          <p className={styles.body}>
            Bigger responsibilities require bigger screens.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AdminLayout workspace={workspace} navBadges={navBadges}>
      {children}
    </AdminLayout>
  );
}

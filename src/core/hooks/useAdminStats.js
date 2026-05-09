import { useState, useEffect } from 'react';
import { getAdminStats } from '@core/services/admin.js';

export function useAdminStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    getAdminStats()
      .then((data) => {
        if (!mounted) return;
        setStats(data);
      })
      .catch((error) => {
        console.error('Admin stats load failed:', error);
        if (!mounted) return;
        setStats({
          totalPosts: 0,
          totalUsers: 0,
          totalFeedboxes: 0,
          totalDiscussions: 0,
          totalReports: 0,
          posts: [],
          users: [],
          feedboxes: [],
          discussions: [],
          reports: [],
        });
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return { stats, loading };
}

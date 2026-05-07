import { useState, useEffect } from 'react';
import { getAdminStats } from '@core/services/admin.js';

export function useAdminStats() {
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminStats().then(data => { setStats(data); setLoading(false); });
  }, []);

  return { stats, loading };
}

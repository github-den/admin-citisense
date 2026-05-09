import { useCallback, useEffect, useState } from 'react';
import { getAdminReports } from '@core/services/admin.js';

export function useAdminReports() {
  const [reports, setReports] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAdminReports();
      setReports(result.data);
      setCount(result.count);
    } catch (error) {
      console.error('Admin reports load failed:', error);
      setReports([]);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { reports, count, loading, reload: load };
}

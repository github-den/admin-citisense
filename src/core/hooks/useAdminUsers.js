import { useState, useEffect, useCallback } from 'react';
import { getAdminUsers, updateUserRole } from '@core/services/admin.js';

export function useAdminUsers() {
  const [users,   setUsers]   = useState([]);
  const [count,   setCount]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [page,    setPage]    = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getAdminUsers({ page });
    setUsers(result.data);
    setCount(result.count);
    setLoading(false);
  }, [page]);

  useEffect(() => { load(); }, [load]);

  async function changeRole(userId, role) {
    await updateUserRole(userId, role);
    load();
  }

  return { users, count, loading, page, setPage, changeRole };
}

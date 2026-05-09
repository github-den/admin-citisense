import { useState, useEffect, useCallback } from 'react';
import { getAdminUsers, updateUserRole } from '@core/services/admin.js';

export function useAdminUsers() {
  const [users, setUsers] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAdminUsers();
      setUsers(result.data);
      setCount(result.count);
    } catch (error) {
      console.error('Admin users load failed:', error);
      setUsers([]);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function changeRole(userId, role) {
    await updateUserRole(userId, role);
    await load();
  }

  return { users, count, loading, changeRole, reload: load };
}

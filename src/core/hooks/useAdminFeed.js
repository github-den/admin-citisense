import { useState, useEffect, useCallback } from 'react';
import { getAdminPosts, updatePostStatus, deletePost } from '@core/services/admin.js';

export function useAdminFeed(filters = {}) {
  const [posts, setPosts] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAdminPosts(filters);
      setPosts(result.data);
      setCount(result.count);
    } catch (error) {
      console.error('Admin feedback load failed:', error);
      setPosts([]);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, [filters.status, filters.type, filters.page, filters.limit]);

  useEffect(() => {
    load();
  }, [load]);

  async function changeStatus(postId, status) {
    await updatePostStatus(postId, status);
    await load();
  }

  async function remove(postId) {
    await deletePost(postId);
    await load();
  }

  return { posts, count, loading, changeStatus, remove, reload: load };
}

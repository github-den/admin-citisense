import { useState, useEffect, useCallback } from 'react';
import { getAdminPosts, updatePostStatus, deletePost } from '@core/services/admin.js';

export function useAdminFeed(filters = {}) {
  const [posts,   setPosts]   = useState([]);
  const [count,   setCount]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [page,    setPage]    = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getAdminPosts({ ...filters, page });
    setPosts(result.data);
    setCount(result.count);
    setLoading(false);
  }, [page, filters.status, filters.type]);

  useEffect(() => { load(); }, [load]);

  async function changeStatus(postId, status) {
    await updatePostStatus(postId, status);
    load();
  }

  async function remove(postId) {
    await deletePost(postId);
    load();
  }

  return { posts, count, loading, page, setPage, changeStatus, remove };
}

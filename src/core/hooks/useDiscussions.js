import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@core/lib/supabase.js';
import { getInitials } from '@core/utils/format.js';

function mapDiscussion(row) {
  const profile = row?.profiles ?? {};
  const username = profile.username || 'citizen';

  return {
    id: row.id,
    postId: row.post_id,
    userId: row.user_id,
    parentId: row.parent_id ?? null,
    body: row.body ?? row.content ?? '',
    imageUrl: row.image_url ?? null,
    likes: row.likes_count ?? 0,
    isAdmin: !!(row.is_admin ?? row.is_admin_comment),
    isPinned: !!row.is_pinned,
    createdAt: row.created_at,
    sourceTable: row.source_table ?? row.sourceTable ?? 'discussions',
    author: {
      fullName: username,
      initials: getInitials(username) || 'C',
      bg: profile.avatar || '/avatars/avatar_1.png',
    },
  };
}

function isSchemaMismatch(error) {
  const message = String(error?.message ?? '').toLowerCase();
  return message.includes('relation')
    || message.includes('column')
    || message.includes('does not exist')
    || message.includes('schema cache')
    || message.includes('could not find');
}

async function hydrateRows(rows) {
  const userIds = [...new Set((rows ?? []).map((row) => row.user_id).filter(Boolean))];
  if (!supabase || userIds.length === 0) return rows ?? [];

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, avatar')
    .in('id', userIds);

  if (error) return rows ?? [];

  const profileMap = new Map((data ?? []).map((profile) => [profile.id, profile]));
  return (rows ?? []).map((row) => ({
    ...row,
    profiles: profileMap.get(row.user_id) ?? row.profiles ?? null,
  }));
}

export function useDiscussions(postId, refreshKey = 0) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    if (!supabase || !postId) {
      setRows([]);
      setLoading(false);
      setError(null);
      return () => {
        mounted = false;
      };
    }

    setLoading(true);
    setError(null);

    (async () => {
      const { data: flat, error: flatError } = await supabase
        .from('discussions')
        .select('id, post_id, user_id, parent_id, body, image_url, likes_count, is_admin, is_pinned, created_at')
        .eq('post_id', postId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(120);

      if (!mounted) return;

      if (!flatError) {
        const hydrated = await hydrateRows(flat ?? []);
        if (!mounted) return;
        setRows(hydrated.map((row) => ({ ...row, source_table: 'discussions' })));
        setLoading(false);
        return;
      }

      if (!isSchemaMismatch(flatError)) {
        setError(flatError);
        setLoading(false);
        return;
      }

      const { data: legacy, error: legacyError } = await supabase
        .from('comments')
        .select('id, post_id, user_id, parent_id, content, image_url, likes_count, is_admin_comment, is_pinned, created_at')
        .eq('post_id', postId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(120);

      if (!mounted) return;

      if (legacyError) setError(legacyError);
      else {
        const hydrated = await hydrateRows(legacy ?? []);
        if (!mounted) return;
        setRows(hydrated.map((row) => ({ ...row, source_table: 'comments' })));
      }
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [postId, refreshKey]);

  const discussions = useMemo(() => (rows ?? []).map(mapDiscussion), [rows]);

  return { discussions, loading, error };
}

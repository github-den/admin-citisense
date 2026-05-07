import { supabase } from '@core/lib/supabase.js';

/* ── Posts ── */
export async function getAdminPosts({ status, type, page = 0, limit = 20 } = {}) {
  if (!supabase) return { data: [], count: 0 };
  let q = supabase
    .from('feedbacks')
    .select('*, profiles(username)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * limit, page * limit + limit - 1);
  if (status) q = q.eq('status', status);
  if (type)   q = q.eq('type', type);
  const { data, count } = await q;
  return { data: data ?? [], count: count ?? 0 };
}

export async function updatePostStatus(postId, status) {
  if (!supabase) return;
  const { error } = await supabase.rpc('set_post_status', {
    p_post_id: postId,
    p_status: status,
    p_admin_notes: null,
  });
  if (error) throw error;
}

export async function deletePost(postId) {
  if (!supabase) return;
  const { error } = await supabase.from('feedbacks').delete().eq('id', postId);
  if (error) throw error;
}

/* ── Users ── */
export async function getAdminUsers({ page = 0, limit = 20 } = {}) {
  if (!supabase) return { data: [], count: 0 };
  const { data, count } = await supabase
    .from('profiles')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * limit, page * limit + limit - 1);
  return { data: data ?? [], count: count ?? 0 };
}

export async function updateUserRole(userId, role) {
  if (!supabase) return;
  const { error } = await supabase.rpc('set_user_role', { p_user_id: userId, p_role: role });
  if (error) throw error;
}

/* ── Feedboxes ── */
export async function createFeedbox({ topic, service }) {
  if (!supabase) return;
  const { error } = await supabase.from('feedboxes').insert({ topic, service });
  if (error) throw error;
}

export async function deleteFeedbox(id) {
  if (!supabase) return;
  const { error } = await supabase.from('feedboxes').delete().eq('id', id);
  if (error) throw error;
}

/* ── Stats ── */
export async function getAdminStats() {
  if (!supabase) return {};
  const [posts, users, feedboxes, discussions] = await Promise.all([
    supabase.from('feedbacks').select('id, type, status, created_at', { count: 'exact' }),
    supabase.from('profiles').select('id', { count: 'exact' }),
    supabase.from('feedboxes').select('id', { count: 'exact' }),
    supabase.from('discussions').select('id', { count: 'exact' }),
  ]);
  return {
    totalPosts:       posts.count       ?? 0,
    totalUsers:       users.count       ?? 0,
    totalFeedboxes:   feedboxes.count   ?? 0,
    totalDiscussions: discussions.count ?? 0,
    posts:            posts.data        ?? [],
  };
}

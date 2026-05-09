import { supabase } from '@core/lib/supabase.js';
import { mapPosts } from '@core/utils/postMapper.js';

const STATUS_TO_DB = {
  'Under Review': 'under_review',
  'In Progress': 'in_progress',
  'On Hold': 'on_hold',
  'On hold': 'on_hold',
  Resolved: 'resolved',
  Dismissed: 'dismissed',
};

function isFiniteLimit(limit) {
  return Number.isFinite(limit) && limit > 0;
}

function normalizeReportType(value) {
  return String(value ?? '').trim().toLowerCase();
}

function isSchemaMismatch(error) {
  const message = String(error?.message ?? '').toLowerCase();
  return (
    message.includes('column') ||
    message.includes('relation') ||
    message.includes('schema cache') ||
    message.includes('does not exist') ||
    message.includes('could not find')
  );
}

/* Posts */
export async function getAdminPosts({ status, type, page = 0, limit } = {}) {
  if (!supabase) return { data: [], count: 0 };

  let query = supabase
    .from('feedbacks')
    .select('*, profiles(username, avatar)', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', STATUS_TO_DB[status] ?? status);
  if (type) query = query.eq('type', type);
  if (isFiniteLimit(limit)) {
    query = query.range(page * limit, page * limit + limit - 1);
  }

  const { data, count, error } = await query;
  if (error) throw error;

  return { data: mapPosts(data ?? []), count: count ?? 0 };
}

export async function updatePostStatus(postId, status) {
  if (!supabase) return;

  const mappedStatus = STATUS_TO_DB[status] ?? status;
  const rpcResult = await supabase.rpc('set_post_status', {
    p_post_id: postId,
    p_status: mappedStatus,
    p_admin_notes: null,
  });

  if (!rpcResult.error) return;

  const fallback = await supabase
    .from('feedbacks')
    .update({ status: mappedStatus })
    .eq('id', postId);

  if (fallback.error) throw fallback.error;
}

export async function deletePost(postId) {
  if (!supabase) return;
  const { error } = await supabase.from('feedbacks').delete().eq('id', postId);
  if (error) throw error;
}

/* Users */
export async function getAdminUsers({ page = 0, limit } = {}) {
  if (!supabase) return { data: [], count: 0 };

  let query = supabase
    .from('profiles')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (isFiniteLimit(limit)) {
    query = query.range(page * limit, page * limit + limit - 1);
  }

  const { data, count, error } = await query;
  if (error) throw error;
  return { data: data ?? [], count: count ?? 0 };
}

export async function updateUserRole(userId, role) {
  if (!supabase) return;
  const { error } = await supabase.rpc('set_user_role', { p_user_id: userId, p_role: role });
  if (error) throw error;
}

/* Reports */
export async function getAdminReports() {
  if (!supabase) return { data: [], count: 0 };

  const { data, count, error } = await supabase
    .from('reports')
    .select('id, reporter_id, reported_entity_type, reported_entity_id, reason, description, created_at', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (error) {
    if (isSchemaMismatch(error)) return { data: [], count: 0 };
    throw error;
  }

  return {
    data: (data ?? []).map((row) => ({
      ...row,
      normalizedType: normalizeReportType(row.reported_entity_type),
    })),
    count: count ?? 0,
  };
}

/* Feedboxes */
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

/* Stats */
export async function getAdminStats() {
  if (!supabase) return {};

  const [posts, users, feedboxes, discussions, reports] = await Promise.all([
    supabase
      .from('feedbacks')
      .select('*, profiles(username, avatar)', { count: 'exact' })
      .order('created_at', { ascending: false }),
    supabase
      .from('profiles')
      .select('*', { count: 'exact' }),
    supabase.from('feedboxes').select('*', { count: 'exact' }),
    supabase.from('discussions').select('*', { count: 'exact' }),
    supabase.from('reports').select('*', { count: 'exact' }),
  ]);

  if (posts.error) throw posts.error;
  if (users.error) throw users.error;
  if (feedboxes.error && !isSchemaMismatch(feedboxes.error)) throw feedboxes.error;
  if (discussions.error && !isSchemaMismatch(discussions.error)) throw discussions.error;
  if (reports.error && !isSchemaMismatch(reports.error)) throw reports.error;

  return {
    totalPosts: posts.count ?? 0,
    totalUsers: users.count ?? 0,
    totalFeedboxes: feedboxes.error ? 0 : (feedboxes.count ?? 0),
    totalDiscussions: discussions.error ? 0 : (discussions.count ?? 0),
    totalReports: reports.error ? 0 : (reports.count ?? 0),
    posts: mapPosts(posts.data ?? []),
    users: users.data ?? [],
    feedboxes: feedboxes.error ? [] : (feedboxes.data ?? []),
    discussions: discussions.error ? [] : (discussions.data ?? []),
    reports: reports.error ? [] : (reports.data ?? []),
  };
}

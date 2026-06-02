import { supabase } from '@core/lib/supabase.js';
import { mapPosts } from '@core/utils/postMapper.js';
import { buildReactionSummaryMap, summarizeMoodFromReactionRows, summarizeMoodFromStoredMoodRows, normalizeCityMoodResult } from '@core/utils/mood.js';

const STATUS_TO_DB = {
  'Under Review': null,
  // Standalone 'Verified' is only used for non-complaints (compliments/suggestions)
  // Complaints are never stored as 'verified'; they go directly to in-progress/on-hold/resolved
  Verified: null,
  'In Progress': 'in-progress',
  'On Hold': 'on-hold',
  'On hold': 'on-hold',
  Resolved: 'resolved',
  Dismissed: null,
};

const VERIFIED_STATUSES = ['In Progress', 'On Hold', 'Resolved'];

function isFiniteLimit(limit) {
  return Number.isFinite(limit) && limit > 0;
}

function chunkItems(items, size = 200) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function normalizeReportType(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (['post', 'feedback'].includes(normalized)) return 'feedback';
  if (['comment', 'discussion'].includes(normalized)) return 'discussion';
  if (normalized === 'reply') return 'reply';
  if (['profile', 'user'].includes(normalized)) return 'user';
  return normalized;
}

async function fetchIdToUserIdMap(table, ids) {
  if (!supabase || !ids.length) return new Map();

  const { data, error } = await supabase
    .from(table)
    .select('id, user_id')
    .in('id', ids);

  if (error) {
    if (isSchemaMismatch(error)) return new Map();
    throw error;
  }

  return new Map((data ?? []).map((row) => [String(row.id), row.user_id ?? null]));
}

async function fetchProfilesById(ids) {
  if (!supabase || !ids.length) return new Map();

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username')
    .in('id', ids);

  if (error) {
    if (isSchemaMismatch(error)) return new Map();
    throw error;
  }

  return new Map((data ?? []).map((row) => [String(row.id), row.username ?? null]));
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

async function fetchReactionSummaryMap(postIds) {
  if (!supabase || !postIds.length) return new Map();

  const rows = [];
  await Promise.all(
    chunkItems(postIds).map(async (chunk) => {
      const { data, error } = await supabase
        .from('reactions')
        .select('post_id, emoji, created_at')
        .in('post_id', chunk);

      if (error) {
        if (!isSchemaMismatch(error)) {
          console.error('Admin reaction summary fetch failed:', error);
        }
        return;
      }

      rows.push(...(data ?? []));
    }),
  );

  return buildReactionSummaryMap(rows);
}

export async function getScopedMoodSummary({ postIds = [], startAt = null, endAt = null } = {}) {
  if (!supabase || !postIds.length) {
    return summarizeMoodFromReactionRows([]);
  }

  // Try to compute mood using stored `final_mood` values (matches citizen backend fallback)
  const rows = [];
  await Promise.all(
    chunkItems(postIds).map(async (chunk) => {
      let query = supabase
        .from('feedbacks')
        .select('final_mood, created_at')
        .in('id', chunk);

      if (startAt) query = query.gte('created_at', startAt);
      if (endAt) query = query.lte('created_at', endAt);

      const { data, error } = await query;
      if (error) {
        if (!isSchemaMismatch(error)) console.error('Admin scoped mood (stored) fetch failed:', error);
        return;
      }

      rows.push(...(data ?? []));
    }),
  );

  if (!rows.length) {
    // Fallback to reactions summarizer if there are no stored mood rows
    const reactionRows = [];
    await Promise.all(
      chunkItems(postIds).map(async (chunk) => {
        let query = supabase
          .from('reactions')
          .select('post_id, emoji, created_at')
          .in('post_id', chunk);

        if (startAt) query = query.gte('created_at', startAt);
        if (endAt) query = query.lte('created_at', endAt);

        const { data, error } = await query;
        if (error) {
          if (!isSchemaMismatch(error)) console.error('Admin scoped mood (reactions) fetch failed:', error);
          return;
        }

        reactionRows.push(...(data ?? []));
      }),
    );

    return summarizeMoodFromReactionRows(reactionRows, { minTotal: 1, minShare: 0 });
  }

  const summary = summarizeMoodFromStoredMoodRows(rows ?? [], { minTotal: 1, minShare: 0 });
  return normalizeCityMoodResult({
    mood: summary.mood,
    emoji: summary.emoji,
    total: summary.total,
    breakdown: summary.breakdown,
    confidence: summary.confidence,
  });
}

// Returns KPI summary for a scoped set of posts: avg resolution duration (ms), resolutionRate (0-100), satisfactionScore (1-5 or null), totalPosts
export async function getScopedKpiSummary({ postIds = [], startAt = null, endAt = null } = {}) {
  if (!supabase || !postIds.length) {
    return {
      totalPosts: 0,
      avgResolutionMs: null,
      resolutionRate: null,
      satisfactionScore: null,
    };
  }

  // Fetch posts in scope
  const rows = [];
  await Promise.all(
    chunkItems(postIds).map(async (chunk) => {
      let query = supabase
        .from('feedbacks')
        .select('id, status, type, created_at, updated_at, rating, closed_at')
        .in('id', chunk);

      if (startAt) query = query.gte('created_at', startAt);
      if (endAt) query = query.lte('created_at', endAt);

      const { data, error } = await query;
      if (error) {
        if (!isSchemaMismatch(error)) console.error('Scoped KPI posts fetch failed:', error);
        return;
      }

      rows.push(...(data ?? []));
    }),
  );

  const postsWithReacts = await attachReactionSummaries(rows);

  const totalPosts = postsWithReacts.length;

  // avg resolution ms
  const resolvedDurations = postsWithReacts
    .map((post) => {
      const createdAt = Date.parse(post.created_at ?? '');
      const closedAt = Date.parse(post.closed_at ?? post.updated_at ?? '');
      if (!Number.isFinite(createdAt) || !Number.isFinite(closedAt) || closedAt <= createdAt) return null;
      return closedAt - createdAt;
    })
    .filter(Boolean);

  const avgResolutionMs = resolvedDurations.length
    ? Math.round(resolvedDurations.reduce((sum, v) => sum + v, 0) / resolvedDurations.length)
    : null;

  // resolution rate (verified -> resolved) for complaints
  const complaintPosts = postsWithReacts.filter((p) => String(p.type ?? '').toLowerCase() === 'complaint');
  const verifiedCount = complaintPosts.filter((post) => VERIFIED_STATUSES.includes(post.status)).length;
  const resolvedCount = complaintPosts.filter((post) => String(post.status ?? '').toLowerCase() === 'resolved').length;
  const resolutionRate = verifiedCount ? Math.round((resolvedCount / verifiedCount) * 100) : null;

  // satisfaction: average rating for resolved posts
  const rated = postsWithReacts.filter((p) => String(p.status ?? '').toLowerCase() === 'resolved' && p.rating != null && Number.isFinite(Number(p.rating)));
  const satisfactionScore = rated.length ? Number((rated.reduce((s, p) => s + Number(p.rating), 0) / rated.length).toFixed(1)) : null;

  return {
    totalPosts,
    avgResolutionMs,
    resolutionRate,
    satisfactionScore,
  };
}

async function attachReactionSummaries(rows = []) {
  const postIds = rows.map((row) => row?.id).filter(Boolean);
  if (!postIds.length) return rows;

  const reactionSummaryMap = await fetchReactionSummaryMap(postIds);
  return rows.map((row) => {
    const reactionSummary = reactionSummaryMap.get(row.id) ?? null;
    const hasStrongReaction = reactionSummary?.isStrong === true;
    return {
      ...row,
      reacts_count: reactionSummary?.total ?? row.reacts_count ?? 0,
      reaction_breakdown: reactionSummary?.breakdown ?? row.reaction_breakdown ?? null,
      final_mood: hasStrongReaction ? reactionSummary?.mood : (row.final_mood ?? null),
      mood_confidence: hasStrongReaction ? (reactionSummary?.confidence ?? 0) : (row.mood_confidence ?? 0),
      mood_source: hasStrongReaction ? (reactionSummary?.source ?? 'reactions') : (row.mood_source ?? 'none'),
      reactionSummary,
    };
  });
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

  const rowsWithMood = await attachReactionSummaries(data ?? []);
  return { data: mapPosts(rowsWithMood), count: count ?? 0 };
}

export async function updatePostStatus(postId, status, { adminNotes = null } = {}) {
  if (!supabase) return;

  const patch = {};
  if (status === 'Under Review') {
    patch.status = null;
    patch.is_verified_post = false;
    patch.dismissed = false;
    patch.dismissed_by = null;
    patch.dismissed_at = null;
    patch.dismissed_reason = null;
  } else if (status === 'Verified') {
    patch.status = null;
    patch.is_verified_post = true;
    patch.dismissed = false;
    patch.dismissed_by = null;
    patch.dismissed_at = null;
    patch.dismissed_reason = null;
  } else if (status === 'In Progress') {
    patch.status = 'in-progress';
    patch.is_verified_post = true;
    patch.dismissed = false;
    patch.dismissed_by = null;
    patch.dismissed_at = null;
    patch.dismissed_reason = null;
  } else if (status === 'On Hold' || status === 'On hold') {
    patch.status = 'on-hold';
    patch.is_verified_post = true;
    patch.dismissed = false;
    patch.dismissed_by = null;
    patch.dismissed_at = null;
    patch.dismissed_reason = null;
  } else if (status === 'Resolved') {
    patch.status = 'resolved';
    patch.is_verified_post = true;
    patch.dismissed = false;
    patch.dismissed_by = null;
    patch.dismissed_at = null;
    patch.dismissed_reason = null;
  } else if (status === 'Dismissed') {
    patch.status = null;
    patch.is_verified_post = false;
    patch.dismissed = true;
    patch.dismissed_at = new Date().toISOString();
    patch.dismissed_reason = adminNotes || 'No reason provided';
  }

  const { error } = await supabase
    .from('feedbacks')
    .update(patch)
    .eq('id', postId);

  if (error) throw error;
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

  let queryResult = await supabase
    .from('reports')
    .select('id, reporter_id, reported_entity_type, reported_entity_id, reason, description, selected_flags, created_at', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (queryResult.error && isSchemaMismatch(queryResult.error)) {
    queryResult = await supabase
      .from('reports')
      .select('id, reporter_id, reported_entity_type, reported_entity_id, reason, description, created_at', { count: 'exact' })
      .order('created_at', { ascending: false });
  }

  const { data, count, error } = queryResult;

  if (error) {
    if (isSchemaMismatch(error)) return { data: [], count: 0 };
    throw error;
  }

  const rows = data ?? [];
  const postIds = [];
  const commentIds = [];
  const profileIds = [];
  const reporterIds = [];

  rows.forEach((row) => {
    const normalizedType = normalizeReportType(row.reported_entity_type);
    const reportedEntityId = row.reported_entity_id ? String(row.reported_entity_id) : null;

    if (row.reporter_id) reporterIds.push(String(row.reporter_id));
    if (normalizedType === 'user' && reportedEntityId) profileIds.push(reportedEntityId);
    if (normalizedType === 'feedback' && reportedEntityId) postIds.push(reportedEntityId);
    if (['discussion', 'reply'].includes(normalizedType) && reportedEntityId) commentIds.push(reportedEntityId);
  });

  const [postUserIds, commentUserIds] = await Promise.all([
    fetchIdToUserIdMap('feedbacks', Array.from(new Set(postIds))),
    fetchIdToUserIdMap('comments', Array.from(new Set(commentIds))),
  ]);

  const targetUserIds = rows
    .map((row) => {
      const normalizedType = normalizeReportType(row.reported_entity_type);
      const reportedEntityId = row.reported_entity_id ? String(row.reported_entity_id) : null;

      if (!reportedEntityId) return null;
      if (normalizedType === 'user') return reportedEntityId;
      if (normalizedType === 'feedback') return postUserIds.get(reportedEntityId) ?? null;
      if (['discussion', 'reply'].includes(normalizedType)) return commentUserIds.get(reportedEntityId) ?? null;
      return null;
    })
    .filter(Boolean)
    .map(String);

  const usernamesById = await fetchProfilesById(Array.from(new Set([
    ...profileIds,
    ...reporterIds,
    ...targetUserIds,
  ])));

  return {
    data: rows.map((row) => {
      const normalizedType = normalizeReportType(row.reported_entity_type);
      const reportedEntityId = row.reported_entity_id ? String(row.reported_entity_id) : null;
      const targetUserId = normalizedType === 'user'
        ? reportedEntityId
        : normalizedType === 'feedback'
          ? postUserIds.get(reportedEntityId) ?? null
          : ['discussion', 'reply'].includes(normalizedType)
            ? commentUserIds.get(reportedEntityId) ?? null
            : null;

      const reporterUsername = row.reporter_id ? usernamesById.get(String(row.reporter_id)) ?? null : null;
      const targetUsername = targetUserId ? usernamesById.get(String(targetUserId)) ?? null : null;

      return {
        ...row,
        normalizedType,
        selected_flags: Array.isArray(row.selected_flags) ? row.selected_flags : [],
        reporterUsername,
        targetUserId,
        username: targetUsername ?? reporterUsername,
      };
    }),
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

  const postsWithMood = await attachReactionSummaries(posts.data ?? []);

  return {
    totalPosts: posts.count ?? 0,
    totalUsers: users.count ?? 0,
    totalFeedboxes: feedboxes.error ? 0 : (feedboxes.count ?? 0),
    totalDiscussions: discussions.error ? 0 : (discussions.count ?? 0),
    totalReports: reports.error ? 0 : (reports.count ?? 0),
    posts: mapPosts(postsWithMood),
    users: users.data ?? [],
    feedboxes: feedboxes.error ? [] : (feedboxes.data ?? []),
    discussions: discussions.error ? [] : (discussions.data ?? []),
    reports: reports.error ? [] : (reports.data ?? []),
  };
}

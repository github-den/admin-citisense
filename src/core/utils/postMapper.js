import { formatTime, getInitials } from './format.js';
import { normalizeIncidentLocationLabel } from './location.js';

const DEFAULT_AVATAR = '/avatars/avatar_1.png';

function normalizeType(row) {
  const raw = String(row?.type ?? row?.category ?? 'complaint').toLowerCase();
  if (raw.includes('suggest')) return 'suggestion';
  if (raw.includes('compliment') || raw.includes('praise')) return 'compliment';
  return 'complaint';
}

function normalizeStatus(row) {
  if (row?.dismissed) return 'Dismissed';
  if (row?.is_verified_post) {
    const type = normalizeType(row);
    if (type === 'complaint') {
      const raw = row?.status ?? null;
      if (raw === 'in-progress' || raw === 'in_progress') return 'In Progress';
      if (raw === 'on-hold' || raw === 'on_hold') return 'On Hold';
      if (raw === 'resolved') return 'Resolved';
      return 'In Progress';
    }
    return 'Verified';
  }
  return 'Under Review';
}

function normalizeFeedbackNo(row) {
  if (row?.feedback_no) return row.feedback_no;
  if (row?.feedback_number == null) return null;
  const year = row?.created_at ? new Date(row.created_at).getFullYear() : new Date().getFullYear();
  return `#${year}-${String(row.feedback_number).padStart(3, '0')}`;
}

export function mapPost(row) {
  const profile = row?.profiles ?? {};
  const username = profile.username || 'citizen';
  const reactionSummary = row?.reactionSummary ?? null;
  const reactionBreakdown = reactionSummary?.breakdown ?? row?.reaction_breakdown ?? null;
  const reactsCount = reactionSummary?.total ?? row?.reacts_count ?? 0;

  return {
    id: row.id,
    userId: row.user_id ?? row.author_id,
    initials: getInitials(username) || 'C',
    bg: profile.avatar || DEFAULT_AVATAR,
    user: username,
    handle: username.startsWith('@') ? username : `@${username}`,
    location: normalizeIncidentLocationLabel(row.location ?? row.incident_location),
    time: formatTime(row.created_at),
    content: row.content ?? row.caption ?? '',
    raises: row.raises_count ?? row.likes_count ?? 0,
    raisedByMe: !!row.raisedByMe,
    followedByMe: !!row.followedByMe,
    discuss: row.discuss_count ?? row.comments_count ?? 0,
    reacts: reactsCount,
    saves: row.bookmarks_count ?? row.saves_count ?? row.save_count ?? 0,

    status: normalizeStatus(row),
    type: normalizeType(row),
    feedbackNo: normalizeFeedbackNo(row),
    service: row.service ?? row.subcategory ?? row.category,
    feedbox: row.feedboxes?.topic ?? row.feedbox_topic ?? null,
    imageUrl: row.image_url ?? null,
    images: Array.isArray(row.image_urls) ? row.image_urls : (Array.isArray(row.images) ? row.images : []),
    evidenceNote: row.evidence_note ?? '',
    reviewRejectionCount: row.review_rejection_count ?? 0,
    closedAt: row.closed_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    reactBreakdown: reactionBreakdown,
    reactionSummary,
    finalMood: row.final_mood ?? reactionSummary?.mood ?? null,
    moodConfidence: Number(row.mood_confidence ?? reactionSummary?.confidence ?? 0),
    moodSource: row.mood_source ?? reactionSummary?.source ?? 'none',
    predictedMood: row.predicted_mood ?? null,
    predictedMoodConfidence: Number(row.predicted_mood_confidence ?? 0),
    predictionModelVersion: row.prediction_model_version ?? null,
    // Preservation of hydrated states
    myReaction: row.myReaction ?? null,
    raisedByMe: !!(row.raisedByMe ?? row.raised_by_me),
    followedByMe: !!(row.followedByMe ?? row.followed_by_me),
    raw: row,
  };
}

export function mapPosts(rows = []) {
  return rows.map(mapPost);
}

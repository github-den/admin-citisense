import { formatTime, getInitials } from './format.js';

const DEFAULT_AVATAR = '/avatars/avatar_1.png';

function normalizeType(row) {
  const raw = String(row?.type ?? row?.category ?? 'complaint').toLowerCase();
  if (raw.includes('suggest')) return 'suggestion';
  if (raw.includes('compliment') || raw.includes('praise')) return 'compliment';
  return 'complaint';
}

function normalizeStatus(row) {
  const type = normalizeType(row);
  if (type !== 'complaint') return null;

  const raw = row?.status ?? null;

  // DB post_status enum uses snake_case — map to display labels
  // NULL means the post predates the enum migration — default to Under Review
  const ENUM_MAP = {
    under_review: 'Under Review',
    in_progress:  'In Progress',
    on_hold:      'On Hold',
    resolved:     'Resolved',
    dismissed:    'Dismissed',
  };
  if (raw && ENUM_MAP[raw]) return ENUM_MAP[raw];

  // Fallback: null or unrecognized → Under Review (system default for complaints)
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

  return {
    id: row.id,
    userId: row.user_id ?? row.author_id,
    initials: getInitials(username) || 'C',
    bg: profile.avatar || DEFAULT_AVATAR,
    user: username,
    handle: username.startsWith('@') ? username : `@${username}`,
    location: row.location ?? row.incident_location,
    time: formatTime(row.created_at),
    content: row.content ?? row.caption ?? '',
    raises: row.raises_count ?? row.likes_count ?? 0,
    raisedByMe: !!row.raisedByMe,
    followedByMe: !!row.followedByMe,
    discuss: row.discuss_count ?? row.comments_count ?? 0,
    reacts: row.reacts_count ?? 0,
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

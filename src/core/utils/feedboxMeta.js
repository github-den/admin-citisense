export function getFeedboxDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export function formatFeedboxMonthTag(value = new Date()) {
  const date = getFeedboxDate(value);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();
}

export function isNewFeedbox(value, now = new Date()) {
  if (!value) return false;
  const createdAt = getFeedboxDate(value);
  return now.getTime() - createdAt.getTime() < 24 * 60 * 60 * 1000;
}

export function stripFeedboxMonthPrefix(value) {
  return String(value ?? '').replace(/^\s*(?:\d{2}\/\d{4}|[A-Z]{3,9}\s+\d{4})\s+/i, '').trim();
}

export function formatFeedboxRating(value) {
  const rating = Number(value ?? 0);
  if (!Number.isFinite(rating)) return '0';
  return Number.isInteger(rating) ? String(rating) : rating.toFixed(1);
}

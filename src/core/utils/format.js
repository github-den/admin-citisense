export function formatCount(n) {
  if (n == null) return '0';
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}

export function formatTime(isoString) {
  if (!isoString) return '';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)   return 'just now';
  if (mins  < 60)  return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  if (days  < 7)   return `${days}d ago`;
  return new Date(isoString).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

export function formatFeedbackNo(id, year = new Date().getFullYear()) {
  return `#${year}-${String(id).padStart(3, '0')}`;
}

export function getInitials(fullName = '') {
  return fullName.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

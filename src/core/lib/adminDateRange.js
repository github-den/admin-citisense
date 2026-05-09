export const DEFAULT_ADMIN_DATE_RANGE = Object.freeze({
  kind: 'preset',
  value: 'all',
});

function cloneDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return new Date(date.getTime());
}

export function createPresetAdminDateRange(value = 'all') {
  return { kind: 'preset', value };
}

export function createCustomAdminDateRange(start = null, end = null) {
  return {
    kind: 'custom',
    start: cloneDate(start),
    end: cloneDate(end),
  };
}

export function isDefaultAdminDateRange(selection) {
  return (selection?.kind ?? 'preset') === 'preset' && (selection?.value ?? 'all') === 'all';
}

function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next.getTime();
}

function endOfDay(date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next.getTime();
}

export function matchesAdminDateRange(value, selection) {
  if (!selection || isDefaultAdminDateRange(selection)) return true;

  const timestamp = Date.parse(value ?? '');
  if (!Number.isFinite(timestamp)) return false;

  if (selection.kind === 'preset') {
    const days = Number.parseInt(String(selection.value ?? '').replace(/[^\d]/g, ''), 10);
    if (!Number.isFinite(days)) return true;
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    return timestamp >= cutoff;
  }

  if (selection.kind === 'custom') {
    if (selection.start && timestamp < startOfDay(selection.start)) return false;
    if (selection.end && timestamp > endOfDay(selection.end)) return false;
    return true;
  }

  return true;
}

export function normalizeAdminDateRange(selection) {
  if (!selection || selection.kind === 'preset') {
    return createPresetAdminDateRange(selection?.value ?? 'all');
  }

  return createCustomAdminDateRange(selection.start, selection.end);
}

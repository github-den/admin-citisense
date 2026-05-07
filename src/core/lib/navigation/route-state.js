export function getSearchParam(searchParams, key, fallback = '') {
  const value = searchParams?.get?.(key);
  return value ?? fallback;
}

export function normalizeCityTab(value) {
  if (value === 'lgu-performance') return 'lgu-performance';
  if (value === 'citizen-charter') return 'citizen-charter';
  return 'lgu-performance';
}

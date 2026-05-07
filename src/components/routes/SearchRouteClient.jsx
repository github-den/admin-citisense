'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import CitizenLayoutShell from '../shell/CitizenLayoutShell.jsx';
import SearchPage from '../../views/SearchPage/SearchPage.jsx';

// Parse a YYYY-MM-DD string as local midnight (avoids UTC-shift off-by-one)
function parseLocalDate(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export default function SearchRouteClient() {
  const searchParams = useSearchParams();

  const query    = searchParams.get('q')            ?? '';
  const tab      = searchParams.get('tab')           ?? 'feedback';
  const type     = searchParams.get('type')          ?? 'all';
  const from     = searchParams.get('from')          ?? 'anyone';
  const category = searchParams.get('category')      ?? 'all';
  const verif    = searchParams.get('verification')  ?? 'all';
  const resol    = searchParams.get('resolution')    ?? 'all';
  const ds       = searchParams.get('date_start');
  const de       = searchParams.get('date_end');

  const initialFilters = useMemo(() => ({
    dateRange: { start: parseLocalDate(ds), end: parseLocalDate(de) },
    from,
    type,
    verification: verif,
    resolution:   resol,
    category,
    citizenFrom:  'anyone',
  }), [ds, de, from, type, category, verif, resol]);

  const searchData = SearchPage({ initialQuery: query, initialFilters, initialTab: tab });

  return (
    <CitizenLayoutShell
      routeKey="search"
      backgroundless
      customAside={searchData.aside}
    >
      {searchData.feed}
    </CitizenLayoutShell>
  );
}

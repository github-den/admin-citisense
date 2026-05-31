import { supabase } from '@core/lib/supabase.js';

function isSchemaMismatch(error) {
  const message = String(error?.message ?? '').toLowerCase();
  return message.includes('relation')
    || message.includes('column')
    || message.includes('does not exist')
    || message.includes('schema cache')
    || message.includes('could not find');
}

async function resolveUserId(currentUserId = null) {
  if (currentUserId) return currentUserId;
  if (!supabase) return null;

  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

export function getDiscussionRaiseKey(entryId, sourceTable = 'discussions') {
  const normalizedSourceTable = sourceTable === 'comments' ? 'comments' : 'discussions';
  return `${normalizedSourceTable}:${String(entryId ?? '').trim()}`;
}

export async function fetchUserRaisedDiscussionKeys(entries = [], currentUserId = null) {
  if (!supabase || entries.length === 0) return new Set();

  const resolvedUserId = await resolveUserId(currentUserId);
  if (!resolvedUserId) return new Set();

  const normalizedEntries = [...new Map(
    entries
      .map((entry) => {
        const entryId = String(entry?.id ?? '').trim();
        const sourceTable = entry?.sourceTable === 'comments' ? 'comments' : 'discussions';
        if (!entryId) return null;
        return [getDiscussionRaiseKey(entryId, sourceTable), { entryId, sourceTable }];
      })
      .filter(Boolean),
  ).values()];

  if (normalizedEntries.length === 0) return new Set();

  const { data, error } = await supabase
    .from('discussion_raises')
    .select('entry_id, source_table')
    .eq('user_id', resolvedUserId)
    .in('entry_id', [...new Set(normalizedEntries.map((entry) => entry.entryId))])
    .in('source_table', [...new Set(normalizedEntries.map((entry) => entry.sourceTable))]);

  if (error) {
    if (!isSchemaMismatch(error)) console.error('Error fetching raised discussion entries:', error);
    return new Set();
  }

  return new Set((data ?? []).map((row) => getDiscussionRaiseKey(row.entry_id, row.source_table)));
}

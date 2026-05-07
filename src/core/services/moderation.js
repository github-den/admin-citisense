import { supabase } from '@core/lib/supabase.js';

function noClient() {
  throw new Error('Supabase is not configured.');
}

export async function reportEntity({ entityType, entityId, reason, description }) {
  if (!supabase) noClient();
  const { data: userData } = await supabase.auth.getUser();
  const reporterId = userData?.user?.id;
  if (!reporterId) return { error: new Error('You must be signed in to report.') };

  const { error } = await supabase.from('reports').insert({
    reporter_id: reporterId,
    reported_entity_type: entityType,
    reported_entity_id: entityId,
    reason,
    description: description || null,
  });
  return { error };
}

export async function blockUser(userId) {
  if (!supabase) noClient();
  const { data: userData } = await supabase.auth.getUser();
  const blockerId = userData?.user?.id;
  if (!blockerId) return { error: new Error('You must be signed in to block.') };

  const { error } = await supabase.from('blocked_users').insert({
    blocker_id: blockerId,
    blocked_id: userId,
  });
  return { error };
}

import { supabase } from '@core/lib/supabase.js';

async function rpc(fn, params) {
  if (!supabase) return { data: null, error: new Error('Supabase is not configured.') };
  const { data, error } = await supabase.rpc(fn, params);
  return { data, error };
}

function isMissingRpcFunction(error, fn) {
  const message = String(error?.message ?? '').toLowerCase();
  const target = String(fn ?? '').toLowerCase();
  return message.includes('schema cache')
    || message.includes('could not find the function')
    || message.includes('function')
    || (target && message.includes(target));
}

async function getCurrentUserId() {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function postDiscuss(postId, body, { parentId = null, imageUrl = null, userId = null, isPinned = false } = {}) {
  const result = await rpc('post_discuss', {
    p_post_id: postId,
    p_body: body,
    p_parent_id: parentId,
    p_image_url: imageUrl,
  });

  if (!result.error || !supabase) {
    const insertedId = result.data?.id ?? result.data?.[0]?.id ?? null;
    if (insertedId && isPinned) {
      await supabase
        .from('discussions')
        .update({ is_admin: true, is_pinned: true })
        .eq('id', insertedId);
    }
    return result;
  }
  if (!isMissingRpcFunction(result.error, 'post_discuss')) return result;

  const resolvedUserId = userId ?? await getCurrentUserId();
  if (!resolvedUserId) return { data: null, error: new Error('You must be signed in to discuss.') };

  const discussionInsert = await supabase
    .from('discussions')
    .insert({
      post_id: postId,
      user_id: resolvedUserId,
      parent_id: parentId,
      body,
      image_url: imageUrl,
      is_admin: true,
      is_pinned: isPinned,
    })
    .select('id')
    .single();

  if (!discussionInsert.error) return discussionInsert;

  return supabase
    .from('comments')
    .insert({
      post_id: postId,
      user_id: resolvedUserId,
      parent_id: parentId,
      content: body,
      image_url: imageUrl,
      is_admin_comment: true,
      is_pinned: isPinned,
    })
    .select('id')
    .single();
}

export async function setDiscussionRaise(entryId, shouldRaise, { sourceTable = 'discussions' } = {}) {
  if (!supabase || !entryId) return { data: null, error: new Error('Supabase is not configured.') };

  const userId = await getCurrentUserId();
  if (!userId) return { data: null, error: new Error('You must be signed in to raise.') };

  const normalizedSourceTable = sourceTable === 'comments' ? 'comments' : 'discussions';

  if (shouldRaise) {
    const insertResult = await supabase
      .from('discussion_raises')
      .insert({
        entry_id: entryId,
        source_table: normalizedSourceTable,
        user_id: userId,
      });

    if (insertResult.error && insertResult.error.code !== '23505') return insertResult;
  } else {
    const deleteResult = await supabase
      .from('discussion_raises')
      .delete()
      .eq('entry_id', entryId)
      .eq('source_table', normalizedSourceTable)
      .eq('user_id', userId);

    if (deleteResult.error) return deleteResult;
  }

  const { count, error: countError } = await supabase
    .from('discussion_raises')
    .select('entry_id', { count: 'exact', head: true })
    .eq('entry_id', entryId)
    .eq('source_table', normalizedSourceTable);

  if (countError) return { data: { likes_count: shouldRaise ? 1 : 0 }, error: null };

  await supabase
    .from(normalizedSourceTable)
    .update({ likes_count: count ?? 0 })
    .eq('id', entryId);

  return { data: { likes_count: count ?? 0 }, error: null };
}

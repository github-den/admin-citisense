import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@core/lib/supabase.js';
import { createFeedbox, deleteFeedbox } from '@core/services/admin.js';

export function useAdminFeedboxes() {
  const [feedboxes, setFeedboxes] = useState([]);
  const [loading,   setLoading]   = useState(true);

  const load = useCallback(async () => {
    if (!supabase) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('feedboxes')
      .select('*')
      .order('feedback_count', { ascending: false });
    setFeedboxes(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function add(topic, service) {
    await createFeedbox({ topic, service });
    load();
  }

  async function remove(id) {
    await deleteFeedbox(id);
    load();
  }

  return { feedboxes, loading, add, remove };
}

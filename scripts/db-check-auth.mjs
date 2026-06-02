import { createClient } from '@supabase/supabase-js';

const URL = 'https://spzftadiedujzmsmhyzf.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwemZ0YWRpZWR1anptc21oeXpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1OTYwOTgsImV4cCI6MjA4NDE3MjA5OH0.DObAB-qyoPC6y6nkvM3eO7FiWeCncOyviIyFhI7qO0s';

async function main() {
  const supabase = createClient(URL, ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  });

  console.log('--- AUTHENTICATING AS LGU HEALTH ADMIN ---');
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'lgu.health.admin@citisense.local',
    password: 'ChangeMe!LGUAdmin2026'
  });

  if (authErr) {
    console.error('Authentication failed:', authErr);
    return;
  }

  console.log('Successfully logged in as LGU Health Admin:', authData.user.email);
  console.log('User Role from metadata:', authData.user.user_metadata?.role);

  console.log('\n--- FETCHING FEEDBACKS ---');
  const { data: feedbacks, error: fetchErr } = await supabase
    .from('feedbacks')
    .select('id, feedback_no, type, status, is_verified_post, dismissed')
    .eq('type', 'complaint')
    .limit(3);

  if (fetchErr) {
    console.error('Error fetching feedbacks:', fetchErr);
    return;
  }

  console.log(JSON.stringify(feedbacks, null, 2));

  if (feedbacks.length === 0) {
    console.log('No feedbacks found to test update.');
    return;
  }

  const targetFeedback = feedbacks[0];
  console.log(`\n--- ATTEMPTING UPDATE ON FEEDBACK: ${targetFeedback.feedback_no} (${targetFeedback.id}) ---`);

  const patch = {
    status: 'resolved',
    is_verified_post: true,
    dismissed: false
  };

  const { data: updateData, error: updateErr } = await supabase
    .from('feedbacks')
    .update(patch)
    .eq('id', targetFeedback.id)
    .select();

  if (updateErr) {
    console.error('Update operation returned error:', updateErr);
  } else {
    console.log('Update operation completed. Returned data:', updateData);
  }
}

main().catch(console.error);

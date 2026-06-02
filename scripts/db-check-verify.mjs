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

  console.log('--- AUTHENTICATING AS SUPER ADMIN ---');
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'superadmin@citisense.local',
    password: 'ChangeMe!SuperAdmin2026'
  });

  if (authErr) {
    console.error('Authentication failed:', authErr);
    return;
  }

  const targetFeedbackId = '7032b2ef-723d-4161-bfd8-05937cd5d3c5'; // A complaint post currently Under Review
  console.log(`\n--- ATTEMPTING "VERIFY" UPDATE ON FEEDBACK ID: ${targetFeedbackId} ---`);

  const patch = {
    status: null,
    is_verified_post: true,
    dismissed: false
  };

  const { data: updateData, error: updateErr } = await supabase
    .from('feedbacks')
    .update(patch)
    .eq('id', targetFeedbackId)
    .select();

  if (updateErr) {
    console.error('Update operation returned error:', updateErr);
  } else {
    console.log('Update operation completed. Returned data:', updateData);
  }
}

main().catch(console.error);

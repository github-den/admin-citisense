import { createClient } from '@supabase/supabase-js';

const URL = 'https://spzftadiedujzmsmhyzf.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwemZ0YWRpZWR1anptc21oeXpmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODU5NjA5OCwiZXhwIjoyMDg0MTcyMDk4fQ.xYNWOhdPomwkpe505iRFizVeydtUOFXstXZUSHzpRak';

async function main() {
  const supabaseService = createClient(URL, SERVICE_KEY);

  console.log('--- FETCHING RLS POLICIES FOR TABLE "feedbacks" ---');
  const { data: policies, error } = await supabaseService
    .rpc('get_policies_for_table', { table_name: 'feedbacks' }); // Try RPC first if exists

  if (error) {
    // If no RPC, let's query pg_policies using custom SQL execution, or direct query
    console.log('RPC get_policies_for_table failed, trying direct select on pg_policies via RPC...');
    
    // Sometimes there is an RPC to execute arbitrary SQL or we can query pg_catalog
    const { data: pgPolicies, error: pgErr } = await supabaseService
      .from('pg_policies')
      .select('*')
      .eq('tablename', 'feedbacks');
      
    if (pgErr) {
      console.log('Querying pg_policies direct failed (expected if RLS is on pg_policies). Let\'s try raw sql RPC...');
      const { data: rawSqlData, error: rawSqlErr } = await supabaseService
        .rpc('exec_sql', { sql_query: "SELECT * FROM pg_policies WHERE tablename = 'feedbacks'" });
        
      if (rawSqlErr) {
        console.error('All policy fetch attempts failed:', rawSqlErr);
      } else {
        console.log(JSON.stringify(rawSqlData, null, 2));
      }
    } else {
      console.log(JSON.stringify(pgPolicies, null, 2));
    }
  } else {
    console.log(JSON.stringify(policies, null, 2));
  }
}

main().catch(console.error);

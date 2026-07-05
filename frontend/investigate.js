const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
  const { data } = await supabase
    .from('submissions')
    .select(`
      id,
      submission_versions!submission_id (
        *,
        activity_proposal_details (*, activity_schedules (*))
      )
    `)
    .limit(3)
    .order('created_at', { ascending: false });

  console.log(JSON.stringify(data, null, 2));
}
test();

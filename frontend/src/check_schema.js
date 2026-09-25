import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nnjgtzqyyglmplspmtjd.supabase.co';
const supabaseKey = 'sb_publishable_6Mj1yCKGPgpACtFispbiVg_vlhqNx5Z';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase
    .from('activity_proposal_details')
    .select('*')
    .limit(1);
  if (error) console.error(error);
  else console.log(JSON.stringify(Object.keys(data[0] || {})));
}
check();

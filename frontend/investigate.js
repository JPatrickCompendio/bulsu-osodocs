const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
  const { data } = await supabase
    .from('submission_logs')
    .select('action_type');
  
  if (data) {
    const types = [...new Set(data.map(d => d.action_type))];
    console.log('Action types:', types);
  } else {
    console.log('No data');
  }
}
test();

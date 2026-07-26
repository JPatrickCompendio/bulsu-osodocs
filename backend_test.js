const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://jysqefwobzoxfldwrmpz.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5c3FlZndvYnpveGZsZHdybXB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjA1MDg3NzYsImV4cCI6MjAzNjA4NDc3Nn0.xxx';

// Using actual anon key from .env if possible
const fs = require('fs');
let envFile = '';
try {
  envFile = fs.readFileSync('./frontend/.env', 'utf8');
} catch(e) {}
let realUrl = supabaseUrl;
let realKey = supabaseKey;
if (envFile) {
  const urlMatch = envFile.match(/VITE_SUPABASE_URL=(.*)/);
  if (urlMatch) realUrl = urlMatch[1].trim();
  const keyMatch = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/);
  if (keyMatch) realKey = keyMatch[1].trim();
}

const supabase = createClient(realUrl, realKey);

async function test() {
  const { data, error } = await supabase
    .from('submissions')
    .select('id, tracking_number, status, created_at, school_year_id, documentType:document_type_id(name), submission_versions!submission_id(version_number, activity_proposal_details(activity_title))')
    .limit(1);

  console.log("Result:", data, "Error:", error);
}

test();

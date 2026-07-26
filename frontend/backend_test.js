import fs from 'fs';

let envFile = '';
try {
  envFile = fs.readFileSync('./.env', 'utf8');
} catch(e) {}

let supabaseUrl = 'https://ngvnkvzpaynlwvajlxis.supabase.co';
let supabaseAnonKey = '';

if (envFile) {
  const urlMatch = envFile.match(/VITE_SUPABASE_URL=(.*)/);
  if (urlMatch) supabaseUrl = urlMatch[1].trim();
  const keyMatch = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/);
  if (keyMatch) supabaseAnonKey = keyMatch[1].trim();
}

const API_BASE_URL = `${supabaseUrl}/functions/v1/api`;

async function testRoles() {
  const headers = {
    Authorization: `Bearer ${supabaseAnonKey}`,
    apikey: supabaseAnonKey,
  };

  const res = await fetch(`${API_BASE_URL}/users`, { headers });
  const users = await res.json();
  
  users.forEach(u => {
    if (u.org_name || u.role?.includes('org') || u.role?.includes('President')) {
      console.log(`User: ${u.full_name} | Role: "${u.role}" | Org: "${u.org_name}" | ID: ${u.id}`);
    }
  });
}

testRoles();

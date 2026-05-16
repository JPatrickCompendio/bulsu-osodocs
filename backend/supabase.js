const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ngvnkvzpaynlwvajlxis.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndm5rdnpwYXlubHd2YWpseGlzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQ2Nzg3MCwiZXhwIjoyMDk0MDQzODcwfQ.pfbC0hWUp79Nb3CqCUn5pbQIqfex3aNqz93b3DqCnhM';

// For backend usage, we must disable session persistence to ensure service_role bypasses RLS
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

module.exports = { supabase, supabaseKey };

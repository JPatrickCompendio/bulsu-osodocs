import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ngvnkvzpaynlwvajlxis.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndm5rdnpwYXlubHd2YWpseGlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0Njc4NzAsImV4cCI6MjA5NDA0Mzg3MH0.2wduUJA0m-LHwpd3yFVot5zBkuCFmC35XLRG5KR6bQA';

export const supabase = createClient(supabaseUrl, supabaseKey);

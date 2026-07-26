const fetch = globalThis.fetch;
async function test() {
  const url = 'https://ngvnkvzpaynlwvajlxis.supabase.co/rest/v1/activity_proposal_details?select=*&limit=1';
  const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndm5rdnpwYXlubHd2YWpseGlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0Njc4NzAsImV4cCI6MjA5NDA0Mzg3MH0.2wduUJA0m-LHwpd3yFVot5zBkuCFmC35XLRG5KR6bQA';
  const res = await fetch(url, {
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`
    }
  });
  const data = await res.json();
  if (data && data.length > 0) {
    console.log(Object.keys(data[0]));
  } else {
    console.log("No data");
  }
}
test();

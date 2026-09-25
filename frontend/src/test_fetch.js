const fetch = globalThis.fetch;
async function test() {
  const url = 'https://nnjgtzqyyglmplspmtjd.supabase.co/rest/v1/activity_proposal_details?select=*&limit=1';
  const key = 'sb_publishable_6Mj1yCKGPgpACtFispbiVg_vlhqNx5Z';
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

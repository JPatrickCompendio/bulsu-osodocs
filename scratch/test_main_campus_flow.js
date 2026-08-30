const API_URL = 'https://ngvnkvzpaynlwvajlxis.supabase.co/functions/v1/api';

async function testMainCampusWorkflow() {
  console.log('Now approving at MAIN_CAMPUS_REVIEW stage...');

  const usersRes = await fetch(`${API_URL}/users`);
  const usersData = await usersRes.json();
  const adminUser = (usersData || []).find(u => u.role === 'admin' || u.role === 'sds-coordinator') || usersData[0];

  const dashRes = await fetch(`${API_URL}/admin/dashboard`);
  const dashData = await dashRes.json();
  const activeDocs = dashData.data?.activeDocuments || [];
  const testSubId = activeDocs[0].id;

  const res = await fetch(`${API_URL}/submissions/transition`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      submissionId: testSubId,
      action: 'approve',
      comment: 'Approved by Main Campus Reviewer',
      userId: adminUser.id
    })
  }).then(r => r.json());

  console.log('Result -> Status:', res.submission?.status, '| Current Stage:', res.workflow?.currentStage);

  if (res.workflow?.currentStage === 'DOCUMENT_RETRIEVAL' || res.submission?.status === 'ready for retrieval') {
    console.log('\nSUCCESS! Main Campus stage completed and transitioned to DOCUMENT_RETRIEVAL!');
  } else {
    console.log('Output:', res);
  }
}

testMainCampusWorkflow().catch(console.error);

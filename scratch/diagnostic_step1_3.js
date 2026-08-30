const SUPABASE_URL = 'https://ngvnkvzpaynlwvajlxis.supabase.co';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndm5rdnpwYXlubHd2YWpseGlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0Njc4NzAsImV4cCI6MjA5NDA0Mzg3MH0.2wduUJA0m-LHwpd3yFVot5zBkuCFmC35XLRG5KR6bQA';
const API_URL = `${SUPABASE_URL}/functions/v1/api`;

async function apiCall(path, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    }
  };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(`${API_URL}${path}`, options);
  const data = await res.json();
  return { status: res.status, data };
}

async function runDiagnosticStep1To3() {
  console.log('========================================');
  console.log('STEP 1, 2, 3: DIAGNOSTIC PREPARATION');
  console.log('========================================\n');

  const { data: users } = await apiCall('/users');
  const orgPres = users.find(u => u.role === 'org-president');
  const adminUser = users.find(u => u.role === 'admin' || u.role === 'sds-coordinator');

  // Seed Activity Proposal
  const seed = await apiCall('/test-seed-submission', 'POST', {
    docTypeName: 'Activity Proposal',
    userId: orgPres.id
  });

  const sub = seed.data.submission;
  const subId = sub.id;

  // Advance to DOCUMENT_RETRIEVAL_FINAL (Phase 2):
  // 1. OSO Review approve
  await apiCall('/submissions/transition', 'POST', { submissionId: subId, action: 'approve', userId: adminUser.id });
  // 2. SDS Review approve
  await apiCall('/submissions/transition', 'POST', { submissionId: subId, action: 'approve', userId: adminUser.id });
  // 3. Hardcopy ready_for_retrieval
  await apiCall('/submissions/transition', 'POST', { submissionId: subId, action: 'ready_for_retrieval', userId: adminUser.id });
  // 4. Retrieval 1 document_retrieved
  await apiCall('/submissions/transition', 'POST', { submissionId: subId, action: 'document_retrieved', userId: orgPres.id });
  // 5. Retrieval 1 confirm_retrieval
  await apiCall('/submissions/transition', 'POST', { submissionId: subId, action: 'confirm_retrieval', userId: adminUser.id });
  // 6. Final Local Campus Review approve
  await apiCall('/submissions/transition', 'POST', { submissionId: subId, action: 'approve', userId: adminUser.id });
  // 7. Final Local Campus Review forward
  await apiCall('/submissions/transition', 'POST', { submissionId: subId, action: 'forward', userId: adminUser.id });
  // 8. Main Campus Review approve -> reaches DOCUMENT_RETRIEVAL_FINAL (Phase 2)!
  const step8 = await apiCall('/submissions/transition', 'POST', { submissionId: subId, action: 'approve', userId: adminUser.id });

  console.log('Step 1 Submission Info:');
  console.log({
    submissionId: subId,
    documentType: 'Activity Proposal',
    status: step8.data.submission?.status,
    current_version_id: step8.data.submission?.current_version_id
  });

  console.log('\nStep 2: Calling GET /submissions/workflow-state ...');
  const wfState = await apiCall(`/submissions/workflow-state?submissionId=${subId}&role=org-president`);
  console.log('COMPLETE RESPONSE:');
  console.log(JSON.stringify(wfState.data, null, 2));

  console.log('\nStep 3: WORKFLOW STATE DEBUG:');
  const wf = wfState.data.workflow;
  console.log('WORKFLOW STATE DEBUG', {
    submissionId: subId,
    currentStage: wf?.currentStage,
    retrievalPhase: wf?.retrievalPhase,
    displayLabel: wf?.displayLabel,
    allowedActions: wf?.allowedActions
  });
}

runDiagnosticStep1To3().catch(console.error);

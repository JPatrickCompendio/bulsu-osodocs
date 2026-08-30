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

async function runDisambiguationTest() {
  console.log('=====================================================================');
  console.log('=== VERIFYING DISAMBIGUATED RETRIEVAL WORKFLOW ENGINE ===');
  console.log('=====================================================================\n');

  const usersRes = await apiCall('/users');
  const users = usersRes.data || [];
  const orgPres = users.find(u => u.role === 'org-president') || users[0];
  const adminUser = users.find(u => u.role === 'admin' || u.role === 'sds-coordinator') || users[0];

  console.log('Users:', { orgPres: orgPres.id, admin: adminUser.id });

  // 1. Create a draft submission
  const draftRes = await apiCall('/submissions/draft', 'POST', {
    docTypeName: 'Activity Proposal',
    userId: orgPres.id
  });

  console.log('Draft Result:', draftRes);
  if (!draftRes.data?.success || !draftRes.data?.submission?.id) {
    throw new Error('Failed to create draft submission');
  }

  const subId = draftRes.data.submission.id;
  console.log(`Created Draft Submission ID: ${subId}`);

  // Transition draft -> submit -> OSO_REVIEW
  let res = await apiCall('/submissions/transition', 'POST', {
    submissionId: subId, action: 'submit', userId: orgPres.id, comment: 'Submitted proposal'
  });
  console.log('1. Submit | Stage:', res.data.workflow?.currentStage, '| Status:', res.data.submission?.status);
  if (res.data.workflow?.currentStage !== 'OSO_REVIEW') throw new Error('Expected OSO_REVIEW');

  // Transition OSO -> approve -> SDS_REVIEW
  res = await apiCall('/submissions/transition', 'POST', {
    submissionId: subId, action: 'approve', userId: adminUser.id, comment: 'OSO Approved'
  });
  console.log('2. OSO -> SDS | Stage:', res.data.workflow?.currentStage, '| Status:', res.data.submission?.status);
  if (res.data.workflow?.currentStage !== 'SDS_REVIEW') throw new Error('Expected SDS_REVIEW');

  // Transition SDS -> approve -> HARDCOPY_SUBMISSION
  res = await apiCall('/submissions/transition', 'POST', {
    submissionId: subId, action: 'approve', userId: adminUser.id, comment: 'SDS Approved'
  });
  console.log('3. SDS -> Hardcopy | Stage:', res.data.workflow?.currentStage, '| Status:', res.data.submission?.status);
  if (res.data.workflow?.currentStage !== 'HARDCOPY_SUBMISSION') throw new Error('Expected HARDCOPY_SUBMISSION');

  // Transition HARDCOPY -> ready_for_retrieval -> DOCUMENT_RETRIEVAL_INITIAL (Phase 1)
  res = await apiCall('/submissions/transition', 'POST', {
    submissionId: subId, action: 'ready_for_retrieval', userId: adminUser.id, comment: 'Hardcopy verified & ready'
  });
  console.log('4. Hardcopy -> Ready | Stage:', res.data.workflow?.currentStage, '| Phase:', res.data.workflow?.retrievalPhase, '| Status:', res.data.submission?.status);
  if (res.data.workflow?.currentStage !== 'DOCUMENT_RETRIEVAL_INITIAL' || res.data.workflow?.retrievalPhase !== 1) {
    throw new Error(`Expected DOCUMENT_RETRIEVAL_INITIAL (Phase 1), got ${res.data.workflow?.currentStage}`);
  }

  // GET /submissions/workflow-state for Phase 1
  let wfState = await apiCall(`/submissions/workflow-state?submissionId=${subId}&role=org-president`);
  console.log('4.b GET /workflow-state | Stage:', wfState.data.workflow?.currentStage, '| Phase:', wfState.data.workflow?.retrievalPhase);
  if (wfState.data.workflow?.currentStage !== 'DOCUMENT_RETRIEVAL_INITIAL' || wfState.data.workflow?.retrievalPhase !== 1) {
    throw new Error('GET /workflow-state failed for Phase 1');
  }

  // Retrieval #1 -> document_retrieved
  res = await apiCall('/submissions/transition', 'POST', {
    submissionId: subId, action: 'document_retrieved', userId: orgPres.id, comment: 'Document picked up'
  });
  console.log('5. Retrieval #1 -> retrieved | Stage:', res.data.workflow?.currentStage, '| Status:', res.data.submission?.status);
  if (res.data.workflow?.currentStage !== 'DOCUMENT_RETRIEVAL_INITIAL' || res.data.submission?.status !== 'document retrieved') {
    throw new Error('Expected DOCUMENT_RETRIEVAL_INITIAL stage with "document retrieved" status');
  }

  // Retrieval #1 -> confirm_retrieval (MUST GO TO FINAL_LOCAL_CAMPUS_REVIEW)
  res = await apiCall('/submissions/transition', 'POST', {
    submissionId: subId, action: 'confirm_retrieval', userId: adminUser.id, comment: 'Confirmed Retrieval #1'
  });
  console.log('6. Retrieval #1 -> confirm | Stage:', res.data.workflow?.currentStage, '| Status:', res.data.submission?.status);
  if (res.data.workflow?.currentStage !== 'FINAL_LOCAL_CAMPUS_REVIEW') {
    throw new Error(`CRITICAL BUG: Retrieval #1 confirm transitioned to ${res.data.workflow?.currentStage} instead of FINAL_LOCAL_CAMPUS_REVIEW!`);
  }

  // Final Local -> approve -> dean approved
  res = await apiCall('/submissions/transition', 'POST', {
    submissionId: subId, action: 'approve', userId: adminUser.id, comment: 'Dean Approved'
  });
  console.log('7. Final Local -> approve | Status:', res.data.submission?.status);

  // Final Local -> forward -> MAIN_CAMPUS_REVIEW
  res = await apiCall('/submissions/transition', 'POST', {
    submissionId: subId, action: 'forward', userId: adminUser.id, comment: 'Sent to Main Campus'
  });
  console.log('8. Final Local -> forward | Stage:', res.data.workflow?.currentStage, '| Status:', res.data.submission?.status);
  if (res.data.workflow?.currentStage !== 'MAIN_CAMPUS_REVIEW') throw new Error('Expected MAIN_CAMPUS_REVIEW');

  // Main Campus -> approve -> DOCUMENT_RETRIEVAL_FINAL (Phase 2)
  res = await apiCall('/submissions/transition', 'POST', {
    submissionId: subId, action: 'approve', userId: adminUser.id, comment: 'Main Campus Approved'
  });
  console.log('9. Main Campus -> approve | Stage:', res.data.workflow?.currentStage, '| Phase:', res.data.workflow?.retrievalPhase, '| Status:', res.data.submission?.status);
  if (res.data.workflow?.currentStage !== 'DOCUMENT_RETRIEVAL_FINAL' || res.data.workflow?.retrievalPhase !== 2) {
    throw new Error(`CRITICAL BUG: Main Campus approve transitioned to ${res.data.workflow?.currentStage} (Phase ${res.data.workflow?.retrievalPhase}) instead of DOCUMENT_RETRIEVAL_FINAL (Phase 2)!`);
  }

  // GET /submissions/workflow-state for Phase 2
  wfState = await apiCall(`/submissions/workflow-state?submissionId=${subId}&role=org-president`);
  console.log('9.b GET /workflow-state | Stage:', wfState.data.workflow?.currentStage, '| Phase:', wfState.data.workflow?.retrievalPhase);
  if (wfState.data.workflow?.currentStage !== 'DOCUMENT_RETRIEVAL_FINAL' || wfState.data.workflow?.retrievalPhase !== 2) {
    throw new Error('GET /workflow-state failed for Phase 2');
  }

  // Retrieval #2 -> document_retrieved
  res = await apiCall('/submissions/transition', 'POST', {
    submissionId: subId, action: 'document_retrieved', userId: orgPres.id, comment: 'Document retrieved after Main Campus'
  });
  console.log('10. Retrieval #2 -> retrieved | Stage:', res.data.workflow?.currentStage, '| Status:', res.data.submission?.status);
  if (res.data.workflow?.currentStage !== 'DOCUMENT_RETRIEVAL_FINAL' || res.data.submission?.status !== 'document retrieved') {
    throw new Error('Expected DOCUMENT_RETRIEVAL_FINAL stage with "document retrieved" status');
  }

  // Retrieval #2 -> confirm_retrieval (MUST GO TO ACCOMPLISHMENT_REPORT)
  res = await apiCall('/submissions/transition', 'POST', {
    submissionId: subId, action: 'confirm_retrieval', userId: adminUser.id, comment: 'Confirmed Retrieval #2'
  });
  console.log('11. Retrieval #2 -> confirm | Stage:', res.data.workflow?.currentStage, '| Status:', res.data.submission?.status);
  if (res.data.workflow?.currentStage !== 'ACCOMPLISHMENT_REPORT') {
    throw new Error(`CRITICAL BUG: Retrieval #2 confirm transitioned to ${res.data.workflow?.currentStage} instead of ACCOMPLISHMENT_REPORT!`);
  }

  // Accomplishment Report -> approve -> COMPLETED
  res = await apiCall('/submissions/transition', 'POST', {
    submissionId: subId, action: 'approve', userId: adminUser.id, comment: 'Accomplishment Report Approved'
  });
  console.log('12. Accomplishment Report -> approve | Stage:', res.data.workflow?.currentStage, '| Status:', res.data.submission?.status);
  if (res.data.workflow?.currentStage !== 'COMPLETED' || res.data.submission?.status !== 'completed') {
    throw new Error('Expected COMPLETED stage and completed status');
  }

  console.log('\n=====================================================================');
  console.log('🎉🎉 SUCCESS! ALL 12 DISAMBIGUATED STAGES TESTED & VERIFIED ON LIVE ENGINE! 🎉🎉');
  console.log('=====================================================================\n');
}

runDisambiguationTest().catch(err => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});

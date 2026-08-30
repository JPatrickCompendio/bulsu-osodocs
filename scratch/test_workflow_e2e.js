const SUPABASE_URL = 'https://ngvnkvzpaynlwvajlxis.supabase.co';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndm5rdnpwYXlubHd2YWpseGlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0Njc4NzAsImV4cCI6MjA5NDA0Mzg3MH0.2wduUJA0m-LHwpd3yFVot5zBkuCFmC35XLRG5KR6bQA';

async function apiCall(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    }
  };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(`${SUPABASE_URL}/functions/v1/api${endpoint}`, options);
  const data = await res.json();
  return { status: res.status, data };
}

async function runTests() {
  console.log('=====================================================================');
  console.log('=== STARTING DISAMBIGUATED RETRIEVAL WORKFLOW E2E TESTS ===');
  console.log('=====================================================================\n');

  // 1. Fetch Users from Live API
  const { data: users } = await apiCall('/users');
  if (!Array.isArray(users) || users.length === 0) {
    console.error('Failed to fetch users from API');
    process.exit(1);
  }

  const orgPres = users.find(u => u.role === 'org-president') || users[0];
  const adminUser = users.find(u => u.role === 'admin' || u.role === 'sds-coordinator') || users[0];

  console.log('Resolved Test Users:', {
    orgPres: `${orgPres.full_name} (${orgPres.role}, ID: ${orgPres.id})`,
    admin: `${adminUser.full_name} (${adminUser.role}, ID: ${adminUser.id})`
  });

  // --- TEST 1: ACTIVITY PROPOSAL RETRIEVAL #1 & RETRIEVAL #2 FLOW ---
  console.log('\n---------------------------------------------------------------------');
  console.log('--- TEST 1: Activity Proposal Disambiguated Retrieval Workflow ---');
  console.log('---------------------------------------------------------------------');

  const seedAct = await apiCall('/test-seed-submission', 'POST', {
    docTypeName: 'Activity Proposal',
    userId: orgPres.id,
    status: 'submitted'
  });
  if (!seedAct.data.success) {
    throw new Error(`Failed to seed Activity Proposal: ${JSON.stringify(seedAct.data)}`);
  }
  const actSub = seedAct.data.submission;
  console.log(`Created Activity Proposal ID: ${actSub.id} (Initial status: ${actSub.status})`);

  // 1.1 OSO_REVIEW -> approve -> SDS_REVIEW
  let res = await apiCall('/submissions/transition', 'POST', {
    submissionId: actSub.id, action: 'approve', userId: adminUser.id, comment: 'OSO Staff Approval'
  });
  console.log('1.1 OSO_REVIEW + approve:', res.status, 'Stage:', res.data.workflow?.currentStage);
  if (res.data.workflow?.currentStage !== 'SDS_REVIEW') throw new Error('Expected SDS_REVIEW stage!');

  // 1.2 SDS_REVIEW -> approve -> HARDCOPY_SUBMISSION
  res = await apiCall('/submissions/transition', 'POST', {
    submissionId: actSub.id, action: 'approve', userId: adminUser.id, comment: 'SDS Coordinator Approval'
  });
  console.log('1.2 SDS_REVIEW + approve:', res.status, 'Stage:', res.data.workflow?.currentStage);
  if (res.data.workflow?.currentStage !== 'HARDCOPY_SUBMISSION') throw new Error('Expected HARDCOPY_SUBMISSION stage!');

  // 1.3 HARDCOPY_SUBMISSION -> ready_for_retrieval -> DOCUMENT_RETRIEVAL_INITIAL (Retrieval Phase 1)
  res = await apiCall('/submissions/transition', 'POST', {
    submissionId: actSub.id, action: 'ready_for_retrieval', userId: adminUser.id, comment: 'Hardcopy ready for pickup'
  });
  console.log('1.3 HARDCOPY_SUBMISSION + ready_for_retrieval:', res.status, 'Stage:', res.data.workflow?.currentStage, 'Phase:', res.data.workflow?.retrievalPhase, 'Status:', res.data.submission?.status);
  if (res.data.workflow?.currentStage !== 'DOCUMENT_RETRIEVAL_INITIAL' || res.data.workflow?.retrievalPhase !== 1) {
    throw new Error(`Expected stage DOCUMENT_RETRIEVAL_INITIAL (Phase 1), got ${res.data.workflow?.currentStage}`);
  }

  // 1.4 DOCUMENT_RETRIEVAL_INITIAL -> document_retrieved -> DOCUMENT_RETRIEVAL_INITIAL
  res = await apiCall('/submissions/transition', 'POST', {
    submissionId: actSub.id, action: 'document_retrieved', userId: orgPres.id, comment: 'Document retrieved by Org President'
  });
  console.log('1.4 Retrieval #1 + document_retrieved:', res.status, 'Stage:', res.data.workflow?.currentStage, 'Phase:', res.data.workflow?.retrievalPhase, 'Status:', res.data.submission?.status);
  if (res.data.workflow?.currentStage !== 'DOCUMENT_RETRIEVAL_INITIAL' || res.data.submission?.status !== 'document retrieved') {
    throw new Error('Expected DOCUMENT_RETRIEVAL_INITIAL stage with "document retrieved" status!');
  }

  // 1.5 DOCUMENT_RETRIEVAL_INITIAL -> confirm_retrieval -> FINAL_LOCAL_CAMPUS_REVIEW (Must NOT skip to Accomplishment Report!)
  res = await apiCall('/submissions/transition', 'POST', {
    submissionId: actSub.id, action: 'confirm_retrieval', userId: adminUser.id, comment: 'Retrieval #1 Confirmed'
  });
  console.log('1.5 Retrieval #1 + confirm_retrieval:', res.status, 'Stage:', res.data.workflow?.currentStage, 'Status:', res.data.submission?.status);
  if (res.data.workflow?.currentStage !== 'FINAL_LOCAL_CAMPUS_REVIEW') {
    throw new Error(`Retrieval #1 MUST transition to FINAL_LOCAL_CAMPUS_REVIEW, but got ${res.data.workflow?.currentStage}!`);
  }

  // 1.6 FINAL_LOCAL_CAMPUS_REVIEW -> approve -> FINAL_LOCAL_CAMPUS_REVIEW (db status: 'dean approved')
  res = await apiCall('/submissions/transition', 'POST', {
    submissionId: actSub.id, action: 'approve', userId: adminUser.id, comment: 'Dean approved'
  });
  console.log('1.6 FINAL_LOCAL_CAMPUS_REVIEW + approve:', res.status, 'Status:', res.data.submission?.status);

  // 1.7 FINAL_LOCAL_CAMPUS_REVIEW -> forward -> MAIN_CAMPUS_REVIEW
  res = await apiCall('/submissions/transition', 'POST', {
    submissionId: actSub.id, action: 'forward', userId: adminUser.id, comment: 'Forwarded to Main Campus'
  });
  console.log('1.7 FINAL_LOCAL_CAMPUS_REVIEW + forward:', res.status, 'Stage:', res.data.workflow?.currentStage);
  if (res.data.workflow?.currentStage !== 'MAIN_CAMPUS_REVIEW') throw new Error('Expected MAIN_CAMPUS_REVIEW stage!');

  // 1.8 MAIN_CAMPUS_REVIEW -> approve -> DOCUMENT_RETRIEVAL_FINAL (Retrieval Phase 2)
  res = await apiCall('/submissions/transition', 'POST', {
    submissionId: actSub.id, action: 'approve', userId: adminUser.id, comment: 'Main Campus Approved'
  });
  console.log('1.8 MAIN_CAMPUS_REVIEW + approve:', res.status, 'Stage:', res.data.workflow?.currentStage, 'Phase:', res.data.workflow?.retrievalPhase, 'Status:', res.data.submission?.status);
  if (res.data.workflow?.currentStage !== 'DOCUMENT_RETRIEVAL_FINAL' || res.data.workflow?.retrievalPhase !== 2) {
    throw new Error(`Expected stage DOCUMENT_RETRIEVAL_FINAL (Phase 2), got ${res.data.workflow?.currentStage}`);
  }

  // 1.9 DOCUMENT_RETRIEVAL_FINAL -> document_retrieved -> DOCUMENT_RETRIEVAL_FINAL
  res = await apiCall('/submissions/transition', 'POST', {
    submissionId: actSub.id, action: 'document_retrieved', userId: orgPres.id, comment: 'Retrieved by Org President after Main Campus'
  });
  console.log('1.9 Retrieval #2 + document_retrieved:', res.status, 'Stage:', res.data.workflow?.currentStage, 'Phase:', res.data.workflow?.retrievalPhase, 'Status:', res.data.submission?.status);
  if (res.data.workflow?.currentStage !== 'DOCUMENT_RETRIEVAL_FINAL' || res.data.submission?.status !== 'document retrieved') {
    throw new Error('Expected DOCUMENT_RETRIEVAL_FINAL stage with "document retrieved" status!');
  }

  // 1.10 DOCUMENT_RETRIEVAL_FINAL -> confirm_retrieval -> ACCOMPLISHMENT_REPORT
  res = await apiCall('/submissions/transition', 'POST', {
    submissionId: actSub.id, action: 'confirm_retrieval', userId: adminUser.id, comment: 'Retrieval #2 Confirmed'
  });
  console.log('1.10 Retrieval #2 + confirm_retrieval:', res.status, 'Stage:', res.data.workflow?.currentStage, 'Status:', res.data.submission?.status);
  if (res.data.workflow?.currentStage !== 'ACCOMPLISHMENT_REPORT') {
    throw new Error(`Retrieval #2 MUST transition to ACCOMPLISHMENT_REPORT, but got ${res.data.workflow?.currentStage}!`);
  }

  // 1.11 ACCOMPLISHMENT_REPORT -> approve -> COMPLETED
  res = await apiCall('/submissions/transition', 'POST', {
    submissionId: actSub.id, action: 'approve', userId: adminUser.id, comment: 'Final Report Approved'
  });
  console.log('1.11 ACCOMPLISHMENT_REPORT + approve:', res.status, 'Stage:', res.data.workflow?.currentStage, 'Status:', res.data.submission?.status);
  if (res.data.workflow?.currentStage !== 'COMPLETED' || res.data.submission?.status !== 'completed') {
    throw new Error('Expected stage COMPLETED and status completed!');
  }

  await apiCall('/test-cleanup-submission', 'POST', { submissionId: actSub.id });
  console.log('>>> TEST 1 PASSED & Cleaned Up Successfully! ✅');

  console.log('\n=====================================================================');
  console.log('🎉🎉 DISAMBIGUATED RETRIEVAL WORKFLOW E2E TESTS PASSED PERFECTLY! 🎉🎉');
  console.log('=====================================================================\n');
}

runTests().catch(err => {
  console.error('❌ E2E TEST FAILURE:', err);
  process.exit(1);
});

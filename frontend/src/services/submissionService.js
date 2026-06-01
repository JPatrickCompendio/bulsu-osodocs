import { supabase } from '../supabaseClient';

/**
 * LOGGING SERVICE
 */
export const createLog = async (submissionId, userId, description, versionId = null, workflowPhase = null, actionType = null) => {
  try {
    const { error } = await supabase
      .from('submission_logs')
      .insert([{
        submission_id: submissionId,
        user_id: userId,
        description,
        submission_version_id: versionId,
        workflow_phase: workflowPhase,
        action_type: actionType,
        created_at: new Date().toISOString()
      }]);

    if (error) {
      console.warn('Logging failed due to RLS, but proceeding:', error.message);
    }
  } catch (err) {
    console.error('Error in createLog:', err);
  }
};

/**
 * SUBMISSION MANAGEMENT
 */

// Create initial submission and v1 draft
export const startNewSubmission = async (userId, typeId, typeName = 'Document') => {
  const { data: sub, error: subErr } = await supabase
    .from('submissions')
    .insert([{
      user_id: userId,
      document_type_id: typeId,
      status: 'draft',
      remarks: 'Initial draft created'
    }])
    .select()
    .single();

  if (subErr) throw subErr;

  const { data: version, error: verErr } = await supabase
    .from('submission_versions')
    .insert([{
      submission_id: sub.id,
      version_number: 1,
      status: 'draft',
      submitted_by: userId
    }])
    .select()
    .single();

  if (verErr) throw verErr;

  // Link the version back to the submission
  const { error: updateErr } = await supabase
    .from('submissions')
    .update({ current_version_id: version.id })
    .eq('id', sub.id);

  if (updateErr) throw updateErr;

  await createLog(sub.id, userId, `Started new submission for ${typeName}`, version.id, 'submission', 'created');

  return { submission: sub, version };
};

const getCurrentVersion = (submission) => {
  if (!submission) return null;
  const versions = submission.submission_versions;
  if (Array.isArray(versions)) {
    return versions.find(v => v.id === submission.current_version_id) || versions[0];
  }
  return versions;
};

const normalizeProposalType = (proposalType) => proposalType ? proposalType.toLowerCase().replace(/\s+/g, '-') : null;

export const getDraftSubmission = async (userId, typeId, proposalType = null) => {
  const formattedType = normalizeProposalType(proposalType);
  // First fetch the submission record (latest draft)
  const { data: subs, error: subErr } = await supabase
    .from('submissions')
    .select('*, documentType (*)')
    .eq('user_id', userId)
    .eq('document_type_id', typeId)
    .eq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(1);

  if (subErr) throw subErr;
  const submission = subs?.[0] || null;
  if (!submission) return null;

  // Fetch versions separately to avoid ambiguous embedding
  const { data: versions, error: verErr } = await supabase
    .from('submission_versions')
    .select('*, activity_proposal_details (*), submission_attachments (*)')
    .eq('submission_id', submission.id)
    .order('created_at', { ascending: false });

  if (verErr) throw verErr;

  submission.submission_versions = versions;

  // pick matching version
  let version = getCurrentVersion(submission);
  if (formattedType && Array.isArray(versions)) {
    const matchingVersion = versions.find(v => {
      const details = Array.isArray(v.activity_proposal_details)
        ? v.activity_proposal_details[0]
        : v.activity_proposal_details;
      return details?.proposal_type === formattedType;
    });
    if (matchingVersion) version = matchingVersion;
  }

  return { submission, version };
};

export const getSubmissionById = async (submissionId) => {
  const { data: subs, error: subErr } = await supabase
    .from('submissions')
    .select('*, documentType (*)')
    .eq('id', submissionId)
    .single();

  if (subErr) throw subErr;
  const submission = subs;
  if (!submission) return null;

  const { data: versions, error: verErr } = await supabase
    .from('submission_versions')
    .select('*, activity_proposal_details (*), submission_attachments (*)')
    .eq('submission_id', submission.id)
    .order('created_at', { ascending: false });

  if (verErr) throw verErr;

  submission.submission_versions = versions;
  const version = getCurrentVersion(submission);
  return { submission, version };
};

// Fetch requirements for a specific type and optional proposal_type
export const getRequirementsForType = async (typeId, proposalType = null) => {
  let query = supabase
    .from('requirements')
    .select('*')
    .eq('documentTypeID', typeId);
  
  if (proposalType) {
    // Fetch requirements that match the type OR are general (NULL)
    const formattedType = proposalType.toLowerCase().replace(' ', '-');
    query = query.or(`proposal_type.eq.${formattedType},proposal_type.is.null`);
  } else {
    // Otherwise, ensure it's NULL (standard requirements)
    query = query.is('proposal_type', null);
  }

  const { data, error } = await query.order('created_at', { ascending: true });

  if (error) throw error;
  return data;
};

/**
 * FILE UPLOAD & ATTACHMENTS
 */

export const uploadSubmissionFile = async (file, typeName, submissionId, versionNumber, proposalType = null) => {
  const safeTypeName = typeName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const timestamp = Date.now();
  const safeFileName = file.name.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
  
  // New folder structure: submitted-documents/activity-proposal/in-campus/{id}/file.pdf
  let folderPath = `submitted-documents/${safeTypeName}`;
  if (proposalType) {
    folderPath += `/${proposalType.toLowerCase().replace(' ', '-')}`;
  }
  
  const filePath = `${folderPath}/${submissionId}/v${versionNumber}/${timestamp}-${safeFileName}`;

  const { data, error } = await supabase.storage
    .from('documents')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) throw error;
  return data.path;
};

export const saveAttachmentRecord = async (versionId, requirementId, fileName, filePath) => {
  const { data, error } = await supabase
    .from('submission_attachments')
    .insert([{
      submission_version_id: versionId,
      requirement_id: requirementId,
      file_name: fileName,
      file_url: filePath,
      uploaded_at: new Date().toISOString()
    }])
    .select()
    .single();
  if (error) throw error;
  return data;
};

/**
 * REGISTRATION & FINALIZATION
 */

// Save Activity Proposal Details
export const saveProposalDetails = async (versionId, details, proposalType) => {
  const safeDetails = {
    submission_version_id: versionId,
    ...details,
    proposal_type: proposalType.toLowerCase().replace(' ', '-'), // MANDATORY NEW FIELD
    number_of_students: parseInt(details.number_of_students) || 0,
    created_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('activity_proposal_details')
    .upsert([safeDetails])
    .select()
    .single();

  if (error) {
    console.error('Proposal Details Error:', error);
    throw error;
  }
  return data;
};

// Finalize and Submit for Review
export const submitForReview = async (submissionId, versionId, userId) => {
  const { error: verErr } = await supabase
    .from('submission_versions')
    .update({ status: 'submitted' })
    .eq('id', versionId);

  if (verErr) throw verErr;

  const { error: subErr } = await supabase
    .from('submissions')
    .update({ 
      status: 'submitted', 
      submitted_at: new Date().toISOString(),
      current_version_id: versionId
    })
    .eq('id', submissionId);

  if (subErr) throw subErr;

  await createLog(submissionId, userId, 'Document submitted for review.', versionId, 'submission', 'submitted');
};

/**
 * VERSIONING & RESUBMISSION
 */

export const createNewVersion = async (submissionId, oldVersionId, userId) => {
  // 1. Get the current version to find the version number
  const { data: oldVersion, error: oldVerErr } = await supabase
    .from('submission_versions')
    .select('version_number')
    .eq('id', oldVersionId)
    .single();

  if (oldVerErr) throw oldVerErr;

  const newVersionNumber = oldVersion.version_number + 1;

  // 2. Create the new version record
  const { data: newVersion, error: newVerErr } = await supabase
    .from('submission_versions')
    .insert([{
      submission_id: submissionId,
      version_number: newVersionNumber,
      status: 'submitted',
      submitted_by: userId
    }])
    .select()
    .single();

  if (newVerErr) throw newVerErr;

  // 3. Duplicate Activity Proposal Details if they exist
  const { data: oldDetails, error: detailsErr } = await supabase
    .from('activity_proposal_details')
    .select('*')
    .eq('submission_version_id', oldVersionId);

  if (!detailsErr && oldDetails && oldDetails.length > 0) {
    const detailsToCopy = { ...oldDetails[0] };
    delete detailsToCopy.id;
    delete detailsToCopy.submission_version_id;
    detailsToCopy.submission_version_id = newVersion.id;

    await supabase.from('activity_proposal_details').insert([detailsToCopy]);
  }

  // 4. Update the main submissions table to point to the new version and reset status
  const { error: updateSubErr } = await supabase
    .from('submissions')
    .update({ 
      current_version_id: newVersion.id,
      status: 'submitted',
      remarks: `Resubmitted as Version ${newVersionNumber}`
    })
    .eq('id', submissionId);

  if (updateSubErr) throw updateSubErr;

  // 5. Log the resubmission
  await createLog(
    submissionId,
    userId,
    `Document resubmitted as Version ${newVersionNumber}.`,
    newVersion.id,
    'submission',
    'resubmitted'
  );

  return newVersion;
};

export const copyApprovedAttachments = async (oldVersionId, newVersionId, returnedAttachmentIds, submissionId) => {
  // Fetch all attachments from the old version
  const { data: oldAttachments, error: getErr } = await supabase
    .from('submission_attachments')
    .select('*')
    .eq('submission_version_id', oldVersionId);

  if (getErr || !oldAttachments) return;

  // Filter out the ones that were returned (so the user uploads new ones for those)
  const validOldAttachments = oldAttachments.filter(att => !returnedAttachmentIds.includes(att.id));
  
  if (validOldAttachments.length === 0) return;

  const attachmentsToCopy = validOldAttachments.map(att => {
    const copy = { ...att };
    delete copy.id;
    copy.submission_version_id = newVersionId;
    copy.uploaded_at = new Date().toISOString();
    return copy;
  });

  if (attachmentsToCopy.length > 0) {
    const { data: insertedAttachments, error: insertErr } = await supabase
      .from('submission_attachments')
      .insert(attachmentsToCopy)
      .select();
      
    if (insertErr) {
      console.error('Error copying approved attachments:', insertErr);
      throw insertErr;
    }

  }
};

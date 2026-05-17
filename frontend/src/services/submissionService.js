import { supabase } from '../supabaseClient';

/**
 * LOGGING SERVICE
 */
export const createLog = async (submissionId, userId, action, description) => {
  try {
    const { error } = await supabase
      .from('submission_logs')
      .insert([{
        submission_id: submissionId,
        user_id: userId,
        action,
        description,
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

  await createLog(sub.id, userId, 'CREATED', `Started new submission for ${typeName}`);

  return { submission: sub, version };
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
      submitted_at: new Date().toISOString() 
    })
    .eq('id', submissionId);

  if (subErr) throw subErr;

  await createLog(submissionId, userId, 'SUBMITTED', 'Document submitted for review.');
};

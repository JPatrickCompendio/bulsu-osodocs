import { supabase } from '../supabaseClient';
import { apiFetch } from '../config/api';

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

// Create initial submission and v1 draft via backend API
export const startNewSubmission = async (userId, typeId, typeName = 'Document', schoolYearId = null, subtypeId = null, proposalType = null) => {
  const response = await apiFetch('/submissions/draft', {
    method: 'POST',
    body: JSON.stringify({
      userId,
      documentTypeId: typeId,
      subtypeId,
      proposalType
    }),
  });

  const resData = await response.json();
  if (!response.ok && !resData.action) {
    throw new Error(resData.reason || resData.error || 'Failed to create submission draft');
  }
  return resData;
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

export const getDraftSubmission = async (userId, typeId, subtypeId = null, proposalType = null) => {
  const formattedType = normalizeProposalType(proposalType);
  // First fetch the submission record (latest draft)
  let query = supabase
    .from('submissions')
    .select('*, documentType (*)')
    .eq('user_id', userId)
    .eq('document_type_id', typeId)
    .eq('status', 'draft');

  if (subtypeId) {
    query = query.eq('subtype_id', subtypeId);
  } else {
    // If we want to strictly match null subtype, we could do .is('subtype_id', null)
    // but maybe some older drafts just have it null. Let's just order and limit.
  }

  const { data: subs, error: subErr } = await query
    .order('created_at', { ascending: false })
    .limit(1);

  if (subErr) throw subErr;
  const submission = subs?.[0] || null;
  if (!submission) return null;

  // Fetch versions separately to avoid ambiguous embedding
  const { data: versions, error: verErr } = await supabase
    .from('submission_versions')
    .select('*, activity_proposal_details (*, activity_schedules (*)), submission_attachments (*)')
    .eq('submission_id', submission.id)
    .order('created_at', { ascending: false });

  if (verErr) throw verErr;

  submission.submission_versions = versions;

  // pick matching version
  let version = getCurrentVersion(submission);

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
    .select('*, activity_proposal_details (*, activity_schedules (*)), submission_attachments (*)')
    .eq('submission_id', submission.id)
    .order('created_at', { ascending: false });

  if (verErr) throw verErr;

  submission.submission_versions = versions;
  const version = getCurrentVersion(submission);
  return { submission, version };
};

// Fetch requirements for a specific type and optional subtype_id
export const getRequirementsForType = async (typeId, subtypeId = null, proposalType = null) => {
  let query = supabase
    .from('requirements')
    .select('*')
    .eq('documentTypeID', typeId);
  
  if (subtypeId) {
    query = query.or(`subtype_id.eq.${subtypeId},subtype_id.is.null`);
  } else {
    query = query.is('subtype_id', null);
  }

  const { data, error } = await query.order('created_at', { ascending: true });

  if (error) throw error;
  return data;
};

/**
 * FILE UPLOAD & ATTACHMENTS
 */

export const uploadSubmissionFile = async (file, typeName, submissionId, versionNumber, subtypeSlug = null) => {
  const safeTypeName = typeName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const timestamp = Date.now();
  const safeFileName = file.name.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
  
  let folderPath = `submitted-documents/${safeTypeName}`;
  if (subtypeSlug) {
    folderPath += `/${subtypeSlug.toLowerCase().replace(' ', '-')}`;
  }

  // Ensure consistent folder path by fetching an existing attachment for this submission
  const { data: existingAttachments } = await supabase
    .from('submission_attachments')
    .select('file_path')
    .eq('submission_id', submissionId)
    .not('file_path', 'is', null)
    .limit(1);

  if (existingAttachments && existingAttachments.length > 0) {
    const existingPath = existingAttachments[0].file_path;
    // Extract everything before /submissionId/
    const match = existingPath.match(new RegExp(`^(.*)/${submissionId}/`));
    if (match) {
      folderPath = match[1];
    }
  }
  
  // Organize attachments inside the submission folder by their specific version
  const filePath = `${folderPath}/${submissionId}/version-${versionNumber}/${timestamp}-${safeFileName}`;

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
  // Prevent database duplicates by deleting the existing attachment for this requirement in this version
  await supabase
    .from('submission_attachments')
    .delete()
    .eq('submission_version_id', versionId)
    .eq('requirement_id', requirementId);

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

export const saveProposalDetails = async (versionId, details, subtypeId = null, proposalType = '') => {
  // Extract schedules before modifying details
  const schedulesToSave = details.schedules || [];
  
  // Removed total duration calculation as per requirements

  // Validate schedules against blocked dates
  if (schedulesToSave.length > 0) {
    const { data: activeSy } = await supabase
      .from('school_years')
      .select('id')
      .eq('is_active', true)
      .single();

    if (activeSy) {
      const { data: events } = await supabase
        .from('academic_calendar_events')
        .select('start_date, end_date, event_type, description')
        .eq('school_year_id', activeSy.id);

      const blockingEvents = events?.filter(e => e.event_type === 'blocked_activity' || e.description === 'BLOCKS_ACTIVITY') || [];

      if (blockingEvents.length > 0) {
        for (const sched of schedulesToSave) {
          if (!sched.activity_date) continue;
          
          const startDate = new Date(sched.activity_date);
          const endDate = sched.end_date ? new Date(sched.end_date) : startDate;
          
          let current = new Date(startDate);
          while (current <= endDate) {
            for (const ev of blockingEvents) {
              const evStart = new Date(ev.start_date);
              const evEnd = ev.end_date ? new Date(ev.end_date) : evStart;
              if (current >= evStart && current <= evEnd) {
                const dateStr = current.toISOString().split('T')[0];
                throw new Error(`Activity cannot be scheduled on ${dateStr}. This date is blocked by the Academic Calendar.`);
              }
            }
            current.setDate(current.getDate() + 1);
          }
        }
      }
    }
  }

  const safeDetails = {
    submission_version_id: versionId,
    ...details,
    target_date: Array.isArray(details.activity_dates) && details.activity_dates.length > 0 ? details.activity_dates.join(', ') : details.target_date,
    number_of_students: parseInt(details.number_of_students) || 0,
    duration: null,
    created_at: new Date().toISOString()
  };

  delete safeDetails.schedules;
  delete safeDetails.activity_schedules;
  // Delete UI-only fields that do not exist in the database schema
  delete safeDetails.is_indefinite_end_time;
  delete safeDetails.target_end_time;
  delete safeDetails.activity_dates;
  delete safeDetails.activity_number;

  // Clean up empty strings to null to avoid Postgres type errors for date/time/numeric columns
  Object.keys(safeDetails).forEach(key => {
    if (safeDetails[key] === '') {
      safeDetails[key] = null;
    }
  });

  const { data, error } = await supabase
    .from('activity_proposal_details')
    .upsert([safeDetails])
    .select()
    .single();

  if (error) {
    console.error('Proposal Details Error:', error);
    throw error;
  }

  // Save Schedules
  if (schedulesToSave.length > 0 && data.id) {
    // Delete existing schedules for this proposal detail (in case of update)
    await supabase.from('activity_schedules').delete().eq('proposal_detail_id', data.id);

    const formattedSchedules = schedulesToSave.map(sched => {
      const isDateRange = !!sched.end_date;
      return {
        proposal_detail_id: data.id,
        activity_date: sched.activity_date,
        end_date: isDateRange ? sched.end_date : null,
        start_time: isDateRange ? null : (sched.start_time || null),
        end_time: isDateRange ? null : (sched.end_time || null),
        is_indefinite: isDateRange ? false : (sched.is_indefinite || false),
        duration_minutes: isDateRange ? null : (sched.duration_minutes || null)
      };
    });

    const { error: schedError } = await supabase
      .from('activity_schedules')
      .insert(formattedSchedules);

    if (schedError) {
      console.error('Activity Schedules Error:', schedError);
      throw schedError;
    }
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

  const { data: subData } = await supabase
    .from('submissions')
    .select('tracking_number, documentType (name)')
    .eq('id', submissionId)
    .single();

  let finalTrackingNumber = subData?.tracking_number;

  if (!finalTrackingNumber) {
    const { data: user } = await supabase.from('users').select('abbreviation').eq('id', userId).single();
    const orgAbbr = user?.abbreviation || 'ORG';
    const typeName = (subData?.documentType?.name) || 'Document';
    const prefix = typeName.split(' ').map(w => w[0].toUpperCase()).join('');
    
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    
    const baseString = `${prefix}-${orgAbbr}-${year}-${month}`;
    
    const { data: existing } = await supabase
      .from('submissions')
      .select('tracking_number')
      .ilike('tracking_number', `${baseString}-%`)
      .order('tracking_number', { ascending: false })
      .limit(1);
      
    let increment = 1;
    if (existing && existing.length > 0 && existing[0].tracking_number) {
      const lastNumStr = existing[0].tracking_number.split('-').pop();
      const lastNum = parseInt(lastNumStr, 10);
      if (!isNaN(lastNum)) {
        increment = lastNum + 1;
      }
    }
    
    finalTrackingNumber = `${baseString}-${String(increment)}`;
  }

  const { error: subErr } = await supabase
    .from('submissions')
    .update({ 
      status: 'submitted', 
      submitted_at: new Date().toISOString(),
      current_version_id: versionId,
      tracking_number: finalTrackingNumber
    })
    .eq('id', submissionId);

  if (subErr) throw subErr;

  // Automatically update the user account status to 'Active' upon submission
  const { error: userErr } = await supabase
    .from('users')
    .update({ status: 'Active' })
    .eq('id', userId);

  if (userErr) {
    console.error('Failed to update user status to Active on submission:', userErr);
  }

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
    const oldDetailId = detailsToCopy.id;
    delete detailsToCopy.id;
    delete detailsToCopy.submission_version_id;
    detailsToCopy.submission_version_id = newVersion.id;

    const { data: insertedDetails, error: insertErr } = await supabase
      .from('activity_proposal_details')
      .insert([detailsToCopy])
      .select()
      .single();

    if (!insertErr && insertedDetails && oldDetailId) {
      // Duplicate Activity Schedules linked to this proposal detail
      const { data: oldSchedules, error: schedErr } = await supabase
        .from('activity_schedules')
        .select('*')
        .eq('proposal_detail_id', oldDetailId);

      if (!schedErr && oldSchedules && oldSchedules.length > 0) {
        const schedulesToCopy = oldSchedules.map(sched => {
          const s = { ...sched };
          delete s.id;
          s.proposal_detail_id = insertedDetails.id;
          return s;
        });
        await supabase.from('activity_schedules').insert(schedulesToCopy);
      }
    }
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

  // Automatically update the user account status to 'Active' upon resubmission
  const { error: userErr } = await supabase
    .from('users')
    .update({ status: 'Active' })
    .eq('id', userId);

  if (userErr) {
    console.error('Failed to update user status to Active on resubmission:', userErr);
  }

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

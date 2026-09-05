import { supabase } from '../supabaseClient';
import { apiFetch } from '../config/api';

/**
 * LOGGING SERVICE
 */
export const createLog = async (submissionId, userId, description, versionId = null, workflowPhase = null, actionType = null) => {
  try {
    let finalDesc = description;
    try {
      const activeMemberRaw = sessionStorage.getItem('osodocs_active_member');
      if (activeMemberRaw) {
        const activeMember = JSON.parse(activeMemberRaw);
        if (activeMember?.full_name && !activeMember.is_president) {
          const attribution = `[Performed by ${activeMember.full_name} (${activeMember.position})]`;
          if (!finalDesc.includes('[Performed by')) {
            finalDesc = `${finalDesc} ${attribution}`;
          }
        }
      }
    } catch (_) {}

    const { error } = await supabase
      .from('submission_logs')
      .insert([{
        submission_id: submissionId,
        user_id: userId,
        description: finalDesc,
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

export const getCurrentVersion = (submission) => {
  if (!submission) return null;
  const versions = submission.submission_versions;
  if (Array.isArray(versions) && versions.length > 0) {
    if (submission.current_version_id) {
      const match = versions.find(v => v.id === submission.current_version_id);
      if (match) return match;
    }
    return versions[0];
  }
  if (versions && typeof versions === 'object') {
    return versions;
  }
  return null;
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
    .select('*, activity_proposal_details (*, activity_schedules (*)), submission_attachments (*, requirements(*))')
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
    .maybeSingle();

  if (subErr) throw subErr;
  const submission = subs;
  if (!submission) return null;

  const { data: versions, error: verErr } = await supabase
    .from('submission_versions')
    .select('*, activity_proposal_details (*, activity_schedules (*)), submission_attachments (*, requirements(*))')
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

export const uploadSubmissionFile = async (file, typeName, submissionId, versionNumber, subtypeSlug = null, requirementId = null) => {
  const safeTypeName = typeName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const timestamp = Date.now();
  const uniqueId = requirementId || Math.random().toString(36).substring(2, 8);
  const safeFileName = file.name.replace(/[^a-z0-9.]/gi, '_').toLowerCase();

  let folderPath = `submitted-documents/${safeTypeName}`;
  if (subtypeSlug) {
    folderPath += `/${subtypeSlug.toLowerCase().replace(' ', '-')}`;
  }

  // Ensure consistent folder path by fetching an existing attachment for this submission
  try {
    const { data: versions } = await supabase
      .from('submission_versions')
      .select('submission_attachments (file_url)')
      .eq('submission_id', submissionId);

    if (versions) {
      for (const v of versions) {
        const atts = Array.isArray(v.submission_attachments) ? v.submission_attachments : [v.submission_attachments];
        const firstAtt = atts.find(a => a?.file_url);
        if (firstAtt?.file_url) {
          const match = firstAtt.file_url.match(new RegExp(`^(.*)/${submissionId}/`));
          if (match) {
            folderPath = match[1];
            break;
          }
        }
      }
    }
  } catch (_) {
    // ignore lookup error and fallback to default folderPath
  }

  // Organize attachments inside the submission folder by their specific version
  const filePath = `${folderPath}/${submissionId}/version-${versionNumber}/${timestamp}-${uniqueId}-${safeFileName}`;

  const { data, error } = await supabase.storage
    .from('documents')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true
    });

  if (error) throw error;
  return data.path;
};

export const saveAttachmentRecord = async (versionId, requirementId, fileName, filePath) => {
  // Prevent database duplicates by updating existing attachment or deleting extra duplicates
  const { data: existingRecords } = await supabase
    .from('submission_attachments')
    .select('id')
    .eq('submission_version_id', versionId)
    .eq('requirement_id', requirementId);

  if (existingRecords && existingRecords.length > 0) {
    const keepId = existingRecords[0].id;
    if (existingRecords.length > 1) {
      const duplicateIds = existingRecords.slice(1).map(r => r.id);
      await supabase.from('submission_attachments').delete().in('id', duplicateIds);
    }

    const { data, error } = await supabase
      .from('submission_attachments')
      .update({
        file_name: fileName,
        file_url: filePath,
        uploaded_at: new Date().toISOString()
      })
      .eq('id', keepId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

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

  // Safely parse number_of_students to fit within PostgreSQL int8 (BigInt) / integer limits
  let safeNumStudents = 0;
  if (details.number_of_students !== null && details.number_of_students !== undefined) {
    const digitsOnly = String(details.number_of_students).replace(/[^0-9]/g, '');
    if (digitsOnly) {
      const parsed = parseInt(digitsOnly, 10);
      if (!isNaN(parsed)) {
        safeNumStudents = Math.min(2147483647, Math.max(0, parsed));
      }
    }
  }

  const safeDetails = {
    submission_version_id: versionId,
    ...details,
    target_date: Array.isArray(details.activity_dates) && details.activity_dates.length > 0 ? details.activity_dates.join(', ') : details.target_date,
    number_of_students: safeNumStudents,
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
    if (safeDetails[key] === '' || (typeof safeDetails[key] === 'string' && safeDetails[key].trim() === '')) {
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

    const formattedSchedules = schedulesToSave
      .map(sched => {
        const actDate = sched.activity_date ? String(sched.activity_date).trim() : null;
        const endDate = sched.end_date ? String(sched.end_date).trim() : null;
        const startTime = sched.start_time ? String(sched.start_time).trim() : null;
        const endTime = sched.end_time ? String(sched.end_time).trim() : null;
        const isDateRange = !!endDate;

        return {
          proposal_detail_id: data.id,
          activity_date: actDate || null,
          end_date: isDateRange ? (endDate || null) : null,
          start_time: isDateRange ? null : (startTime || null),
          end_time: isDateRange ? null : (endTime || null),
          is_indefinite: isDateRange ? false : (sched.is_indefinite || false),
          duration_minutes: isDateRange ? null : (sched.duration_minutes || null)
        };
      })
      .filter(sched => sched.activity_date || sched.end_date);

    if (formattedSchedules.length > 0) {
      const { error: schedError } = await supabase
        .from('activity_schedules')
        .insert(formattedSchedules);

      if (schedError) {
        console.error('Activity Schedules Error:', schedError);
        throw schedError;
      }
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
    
    const searchPattern = `${prefix}-${orgAbbr}-%`;
    
    const { data: existing } = await supabase
      .from('submissions')
      .select('tracking_number')
      .ilike('tracking_number', searchPattern);
      
    let maxIncrement = 0;
    if (existing && existing.length > 0) {
      existing.forEach(sub => {
        if (sub.tracking_number) {
          const parts = sub.tracking_number.split('-');
          const lastNum = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(lastNum) && lastNum > maxIncrement) {
            maxIncrement = lastNum;
          }
        }
      });
    }
    
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    
    finalTrackingNumber = `${prefix}-${orgAbbr}-${year}-${month}-${maxIncrement + 1}`;
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

  // 4. Update the main submissions table to point to the new version
  const { error: updateSubErr } = await supabase
    .from('submissions')
    .update({ 
      current_version_id: newVersion.id,
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

  return newVersion;
};

/**
 * CENTRALIZED BACKEND WORKFLOW TRANSITIONS
 */
export const transitionSubmission = async (submissionId, action, comment = '', attachmentReviews = [], userId = null) => {
  let activeMember = null;
  try {
    const raw = sessionStorage.getItem('osodocs_active_member');
    if (raw) activeMember = JSON.parse(raw);
  } catch (_) {}

  const response = await apiFetch('/submissions/transition', {
    method: 'POST',
    body: JSON.stringify({
      submissionId,
      action,
      comment,
      attachmentReviews,
      userId,
      operatorName: activeMember && !activeMember.is_president ? activeMember.full_name : null,
      operatorPosition: activeMember && !activeMember.is_president ? activeMember.position : null,
    }),
  });

  const resData = await response.json();
  if (!response.ok) {
    throw new Error(resData.error || resData.details || 'Failed to transition submission workflow state');
  }
  return resData;
};

export const resubmitSubmission = async (submissionId, userId, oldVersionId = null) => {
  let activeMember = null;
  try {
    const raw = sessionStorage.getItem('osodocs_active_member');
    if (raw) activeMember = JSON.parse(raw);
  } catch (_) {}

  const response = await apiFetch('/submissions/resubmit', {
    method: 'POST',
    body: JSON.stringify({
      submissionId,
      userId,
      oldVersionId,
      operatorName: activeMember && !activeMember.is_president ? activeMember.full_name : null,
      operatorPosition: activeMember && !activeMember.is_president ? activeMember.position : null,
    }),
  });

  const resData = await response.json();
  if (!response.ok) {
    throw new Error(resData.error || resData.details || 'Failed to complete resubmission workflow transition');
  }
  return resData;
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

export const deleteDraftSubmission = async (submissionId) => {
  if (!submissionId) return;

  const { data: versions } = await supabase
    .from('submission_versions')
    .select('id, activity_proposal_details(id)')
    .eq('submission_id', submissionId);

  if (versions && versions.length > 0) {
    const versionIds = versions.map(v => v.id);
    const detailIds = versions.flatMap(v => (v.activity_proposal_details || []).map(d => d.id)).filter(Boolean);

    if (detailIds.length > 0) {
      await supabase.from('activity_schedules').delete().in('proposal_detail_id', detailIds);
    }
    await supabase.from('activity_proposal_details').delete().in('submission_version_id', versionIds);
    await supabase.from('submission_attachments').delete().in('submission_version_id', versionIds);
    await supabase.from('submission_versions').delete().eq('submission_id', submissionId);
  }

  await supabase.from('submission_logs').delete().eq('submission_id', submissionId);

  const { error } = await supabase
    .from('submissions')
    .delete()
    .eq('id', submissionId);

  if (error) throw error;
  return true;
};

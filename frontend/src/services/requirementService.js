import { supabase } from '../supabaseClient';

/**
 * Fetch all document types from the database
 */
export const fetchDocumentTypes = async () => {
  const { data, error } = await supabase
    .from('documentType')
    .select('*')
    .order('name', { ascending: true });
  
  if (error) throw error;
  return data;
};

/**
 * Fetch the currently active school year
 */
export const fetchActiveSchoolYear = async () => {
  const { data, error } = await supabase
    .from('school_years')
    .select('id')
    .eq('is_active', true)
    .single();
  
  if (error) return null;
  return data;
};

/**
 * Create a new document type
 */
export const createDocumentType = async (payload, scheduling = null, userId = null) => {
  const { data, error } = await supabase
    .from('documentType')
    .insert([payload])
    .select();
  
  if (error) throw error;
  
  if (scheduling && userId) {
    await syncScheduling(data[0].id, payload.name, scheduling, userId);
  }
  
  return data[0];
};

/**
 * Update an existing document type
 */
export const updateDocumentType = async (id, payload, scheduling = null, userId = null) => {
  const { data, error } = await supabase
    .from('documentType')
    .update(payload)
    .eq('id', id)
    .select();
  
  if (error) throw error;

  if (scheduling && userId) {
    await syncScheduling(id, payload.name, scheduling, userId);
  }

  return data[0];
};

/**
 * Sync scheduling events for a document type
 */
export const syncScheduling = async (documentTypeId, documentTypeName, scheduling, userId) => {
  const activeSy = await fetchActiveSchoolYear();
  if (!activeSy) return; // Cannot schedule without an active school year

  // 1. Delete existing events for this document type in the active school year
  await supabase
    .from('academic_calendar_events')
    .delete()
    .eq('document_type_id', documentTypeId)
    .eq('school_year_id', activeSy.id);

  const eventsToInsert = [];

  // 2. (Removed) Submission Window is now handled via documentType columns.

  // 3. Add activity blocks if provided
  if (scheduling.activityBlocks && scheduling.activityBlocks.length > 0) {
    scheduling.activityBlocks.forEach((block, index) => {
      if (block.start_date || block.end_date) {
        eventsToInsert.push({
          school_year_id: activeSy.id,
          title: `${documentTypeName} Block ${index + 1}`,
          event_type: 'ACTIVITY_BLOCK',
          document_type_id: documentTypeId,
          start_date: block.start_date || null,
          end_date: block.end_date || null,
          created_by: userId
        });
      }
    });
  }

  if (eventsToInsert.length > 0) {
    const { error } = await supabase
      .from('academic_calendar_events')
      .insert(eventsToInsert);
    if (error) {
      console.error("Error inserting academic calendar events:", error);
      throw error;
    }
  }
};

/**
 * Fetch scheduling events for a document type
 */
export const fetchScheduling = async (documentTypeId) => {
  const activeSy = await fetchActiveSchoolYear();
  if (!activeSy) return { submissionWindow: {}, activityBlocks: [] };

  const { data, error } = await supabase
    .from('academic_calendar_events')
    .select('*')
    .eq('document_type_id', documentTypeId)
    .eq('school_year_id', activeSy.id);
  
  if (error || !data) return { submissionWindow: {}, activityBlocks: [] };

  const activityBlocks = data.filter(e => e.event_type === 'ACTIVITY_BLOCK') || [];

  return {
    activityBlocks: activityBlocks.map(b => ({
      start_date: b.start_date || '',
      end_date: b.end_date || ''
    }))
  };
};

/**
 * Delete a document type
 */
export const deleteDocumentType = async (id) => {
  const { error } = await supabase
    .from('documentType')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
};

/**
 * Fetch all requirements with their document type (for global search)
 */
export const fetchAllRequirements = async () => {
  const { data, error } = await supabase
    .from('requirements')
    .select('*, documentType:documentTypeID(id, name)')
    .order('title', { ascending: true });

  if (error) throw error;
  return data || [];
};

/**
 * Fetch requirements filtered by document type and optional proposal type
 */
export const fetchRequirements = async (typeId, subtypeId = null) => {
  let query = supabase
    .from('requirements')
    .select('*')
    .eq('documentTypeID', typeId);

  if (subtypeId) {
    // Fetch requirements that match the subtype OR are general (NULL)
    query = query.or(`subtype_id.eq.${subtypeId},subtype_id.is.null`);
  } else {
    // If no subtype is provided, just get the general ones
    query = query.is('subtype_id', null);
  }

  const { data, error } = await query.order('created_at', { ascending: true });
  
  if (error) throw error;
  return data;
};

/**
 * Upload a template file to Supabase Storage
 */
export const uploadTemplate = async (file, documentTypeName, subtypeSlug = null) => {
  const folder = documentTypeName.toLowerCase().replace(/ /g, '-');
  const fileName = `${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, '_').toLowerCase()}`;
  
  // New structure: list-of-requirements/activity-proposal/in-campus/file.pdf
  let folderPath = `list-of-requirements/${folder}`;
  if (subtypeSlug) {
    folderPath += `/${subtypeSlug.toLowerCase().replace(' ', '-')}`;
  }
  
  const filePath = `${folderPath}/${fileName}`;

  const { data, error } = await supabase.storage
    .from('documents')
    .upload(filePath, file);

  if (error) throw error;
  return data.path; // Return only the storage path
};

/**
 * Delete a file from Supabase Storage
 */
export const deleteStorageFile = async (filePath) => {
  const { error } = await supabase.storage
    .from('documents')
    .remove([filePath]);
  
  if (error) throw error;
};

/**
 * Create a new requirement record
 */
export const createRequirement = async (payload) => {
  const { data, error } = await supabase
    .from('requirements')
    .insert([payload])
    .select();
  
  if (error) throw error;
  return data[0];
};

/**
 * Update an existing requirement record
 */
export const updateRequirement = async (id, payload) => {
  const { data, error } = await supabase
    .from('requirements')
    .update(payload)
    .eq('id', id)
    .select();
  
  if (error) throw error;
  return data[0];
};

/**
 * Delete a requirement record and its associated storage file
 */
export const deleteRequirement = async (id, filePath) => {
  // 1. Delete file from storage if it exists
  if (filePath) {
    await deleteStorageFile(filePath);
  }

  // 2. Delete record from database
  const { error } = await supabase
    .from('requirements')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
};

/**
 * Generate a signed URL for secure access to a private storage file
 */
export const generateSignedUrl = async (filePath) => {
  const { data, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(filePath, 3600); // URL valid for 1 hour
  
  if (error) throw error;
  return data.signedUrl;
};

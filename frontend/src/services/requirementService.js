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
 * Create a new document type
 */
export const createDocumentType = async (payload) => {
  const { data, error } = await supabase
    .from('documentType')
    .insert([payload])
    .select();
  
  if (error) throw error;
  return data[0];
};

/**
 * Update an existing document type
 */
export const updateDocumentType = async (id, payload) => {
  const { data, error } = await supabase
    .from('documentType')
    .update(payload)
    .eq('id', id)
    .select();
  
  if (error) throw error;
  return data[0];
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
 * Fetch requirements filtered by document type and optional proposal type
 */
export const fetchRequirements = async (typeId, proposalType = null) => {
  let query = supabase
    .from('requirements')
    .select('*')
    .eq('documentTypeID', typeId);

  if (proposalType) {
    // Fetch requirements that match the type OR are general (NULL)
    const formattedType = proposalType.toLowerCase().replace(' ', '-');
    query = query.or(`proposal_type.eq.${formattedType},proposal_type.is.null`);
  } else {
    // If no type is provided, just get the general ones
    query = query.is('proposal_type', null);
  }

  const { data, error } = await query.order('created_at', { ascending: true });
  
  if (error) throw error;
  return data;
};

/**
 * Upload a template file to Supabase Storage
 */
export const uploadTemplate = async (file, documentTypeName, proposalType = null) => {
  const folder = documentTypeName.toLowerCase().replace(/ /g, '-');
  const fileName = `${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, '_').toLowerCase()}`;
  
  // New structure: list-of-requirements/activity-proposal/in-campus/file.pdf
  let folderPath = `list-of-requirements/${folder}`;
  if (proposalType) {
    folderPath += `/${proposalType.toLowerCase().replace(' ', '-')}`;
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

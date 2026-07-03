import { supabase } from '../supabaseClient';

/**
 * Fetch all subtypes for a specific document type
 */
export const fetchSubtypes = async (documentTypeId) => {
  const { data, error } = await supabase
    .from('document_subtypes')
    .select('*')
    .eq('document_type_id', documentTypeId)
    .order('sort_order', { ascending: true });
  
  if (error) throw error;
  return data || [];
};

/**
 * Create a new document subtype
 */
export const createSubtype = async (payload) => {
  const { data, error } = await supabase
    .from('document_subtypes')
    .insert([payload])
    .select();
  
  if (error) throw error;
  return data[0];
};

/**
 * Update an existing document subtype
 */
export const updateSubtype = async (id, payload) => {
  const { data, error } = await supabase
    .from('document_subtypes')
    .update(payload)
    .eq('id', id)
    .select();
  
  if (error) throw error;
  return data[0];
};

/**
 * Bulk update sort orders for subtypes
 */
export const updateSubtypeSortOrders = async (updates) => {
  // updates should be an array of objects: { id, sort_order }
  // Since supabase-js doesn't have a great bulk update, we can do it in parallel for small lists.
  const promises = updates.map(update => 
    supabase
      .from('document_subtypes')
      .update({ sort_order: update.sort_order })
      .eq('id', update.id)
  );

  const results = await Promise.all(promises);
  const errors = results.filter(r => r.error).map(r => r.error);
  if (errors.length > 0) {
    throw errors[0];
  }
};

/**
 * Delete a document subtype
 */
export const deleteSubtype = async (id) => {
  const { data, error } = await supabase
    .from('document_subtypes')
    .delete()
    .eq('id', id)
    .select();
  
  if (error) throw error;
  return data;
};

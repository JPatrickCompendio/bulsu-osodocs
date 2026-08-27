import os

file_path = r'c:\Users\User\OneDrive\Desktop\OSODOCS\bulsu-osodocs\supabase\functions\api\index.ts'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update handleGetSemesters to auto-activate ongoing semester if within dates
old_get_sem = """async function handleGetSemesters(url: URL) {
  const supabase = getAdminClient();
  const schoolYearId = url.searchParams.get('school_year_id');
  const includeArchived = url.searchParams.get('includeArchived') === 'true';

  let query = supabase.from('semesters').select('*');
  if (schoolYearId) {
    query = query.eq('school_year_id', schoolYearId);
  }
  if (!includeArchived) {
    query = query.neq('status', 'archived');
  }

  const { data, error } = await query.order('start_date', { ascending: true });

  if (error) {
    return jsonResponse({ error: 'Failed to fetch semesters', details: error.message }, 500);
  }

  return jsonResponse({ success: true, data });
}"""

new_get_sem = """async function handleGetSemesters(url: URL) {
  const supabase = getAdminClient();
  const schoolYearId = url.searchParams.get('school_year_id');
  const includeArchived = url.searchParams.get('includeArchived') === 'true';

  // Auto-activate ongoing semester if dates match today
  const todayStr = new Date().toISOString().split('T')[0];

  let syIdToUse = schoolYearId;
  if (!syIdToUse) {
    const { data: activeSy } = await supabase.from('school_years').select('id').eq('is_active', true).maybeSingle();
    syIdToUse = activeSy?.id || null;
  }

  if (syIdToUse) {
    const { data: sems } = await supabase.from('semesters').select('*').eq('school_year_id', syIdToUse).neq('status', 'archived');
    if (sems) {
      const ongoingSem = sems.find(s => {
        const start = s.start_date ? String(s.start_date).split('T')[0] : '';
        const end = s.end_date ? String(s.end_date).split('T')[0] : '';
        return start && end && start <= todayStr && end >= todayStr;
      });

      if (ongoingSem && !ongoingSem.is_active) {
        await supabase.from('semesters').update({ is_active: false }).eq('school_year_id', syIdToUse);
        await supabase.from('semesters').update({ is_active: true }).eq('id', ongoingSem.id);
      }
    }
  }

  let query = supabase.from('semesters').select('*');
  if (schoolYearId) {
    query = query.eq('school_year_id', schoolYearId);
  }
  if (!includeArchived) {
    query = query.neq('status', 'archived');
  }

  const { data, error } = await query.order('start_date', { ascending: true });

  if (error) {
    return jsonResponse({ error: 'Failed to fetch semesters', details: error.message }, 500);
  }

  return jsonResponse({ success: true, data });
}"""

if old_get_sem in content:
    content = content.replace(old_get_sem, new_get_sem)

# 2. Update handlePostAcademicEvents insert payload
old_post_event_insert = """  const { data, error } = await supabase
    .from('academic_calendar_events')
    .insert([
      { school_year_id, semester_id, title, description, event_type, document_type_id, start_date, end_date, created_by },
    ])
    .select();"""

new_post_event_insert = """  const insertRow: Record<string, unknown> = {
    school_year_id,
    semester_id,
    title,
    description: description || '',
    event_type,
    document_type_id,
    start_date,
    end_date
  };
  if (created_by) insertRow.created_by = created_by;

  const { data, error } = await supabase
    .from('academic_calendar_events')
    .insert([insertRow])
    .select();"""

if old_post_event_insert in content:
    content = content.replace(old_post_event_insert, new_post_event_insert)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Updated api/index.ts via update_api_v4.py!')

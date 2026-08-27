import os

file_path = r'c:\Users\User\OneDrive\Desktop\OSODOCS\bulsu-osodocs\supabase\functions\api\index.ts'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Update handlePostSemesters & handlePutSemesters with overlap check and strict SY boundary check
old_post_sem = """async function handlePostSemesters(body: Record<string, unknown>) {
  const supabase = getAdminClient();
  const { school_year_id, name, start_date, end_date } = body as Record<string, unknown>;

  if (!school_year_id || !name || !start_date || !end_date) {
    return jsonResponse({ error: 'school_year_id, name, start_date, and end_date are required' }, 400);
  }

  const semStartStr = String(start_date).split('T')[0];
  const semEndStr = String(end_date).split('T')[0];

  if (semStartStr > semEndStr) {
    return jsonResponse({ error: 'Semester start date cannot be after the end date.' }, 400);
  }

  const { data: sy } = await supabase.from('school_years').select('*').eq('id', school_year_id).single();
  if (!sy) {
    return jsonResponse({ error: 'Selected School Year does not exist.' }, 400);
  }

  const syStartStr = sy.start_date ? String(sy.start_date).split('T')[0] : '';
  const syEndStr = sy.end_date ? String(sy.end_date).split('T')[0] : '';

  if (syStartStr && semStartStr < syStartStr) {
    return jsonResponse({ error: `Semester start date (${semStartStr}) cannot precede the School Year start date (${syStartStr}).` }, 400);
  }
  if (syEndStr && semEndStr > syEndStr) {
    return jsonResponse({ error: `Semester end date (${semEndStr}) cannot exceed the School Year end date (${syEndStr}).` }, 400);
  }

  const { data, error } = await supabase
    .from('semesters')
    .insert([{ school_year_id, name, start_date: semStartStr, end_date: semEndStr, is_active: false, status: 'active' }])
    .select();

  if (error) {
    return jsonResponse({ error: 'Failed to create semester', details: error.message }, 500);
  }

  return jsonResponse({ success: true, data: data?.[0] });
}

async function handlePutSemesters(id: string, body: Record<string, unknown>) {
  const supabase = getAdminClient();
  const { name, start_date, end_date } = body as Record<string, unknown>;

  const semStartStr = start_date ? String(start_date).split('T')[0] : '';
  const semEndStr = end_date ? String(end_date).split('T')[0] : '';

  if (semStartStr && semEndStr && semStartStr > semEndStr) {
    return jsonResponse({ error: 'Semester start date cannot be after the end date.' }, 400);
  }

  const { data: currentSem } = await supabase.from('semesters').select('school_year_id').eq('id', id).single();
  if (currentSem?.school_year_id) {
    const { data: sy } = await supabase.from('school_years').select('*').eq('id', currentSem.school_year_id).single();
    if (sy) {
      const syStartStr = sy.start_date ? String(sy.start_date).split('T')[0] : '';
      const syEndStr = sy.end_date ? String(sy.end_date).split('T')[0] : '';

      if (syStartStr && semStartStr && semStartStr < syStartStr) {
        return jsonResponse({ error: `Semester start date (${semStartStr}) cannot precede the School Year start date (${syStartStr}).` }, 400);
      }
      if (syEndStr && semEndStr && semEndStr > syEndStr) {
        return jsonResponse({ error: `Semester end date (${semEndStr}) cannot exceed the School Year end date (${syEndStr}).` }, 400);
      }
    }
  }

  const { data, error } = await supabase
    .from('semesters')
    .update({ name, start_date: semStartStr, end_date: semEndStr })
    .eq('id', id)
    .select();

  if (error) {
    return jsonResponse({ error: 'Failed to update semester', details: error.message }, 500);
  }

  return jsonResponse({ success: true, data: data?.[0] });
}"""

new_post_sem = """async function handlePostSemesters(body: Record<string, unknown>) {
  const supabase = getAdminClient();
  const { school_year_id, name, start_date, end_date } = body as Record<string, unknown>;

  if (!school_year_id || !name || !start_date || !end_date) {
    return jsonResponse({ error: 'school_year_id, name, start_date, and end_date are required' }, 400);
  }

  const semStartStr = String(start_date).split('T')[0];
  const semEndStr = String(end_date).split('T')[0];

  if (semStartStr > semEndStr) {
    return jsonResponse({ error: 'Semester start date cannot be after the end date.' }, 400);
  }

  const { data: sy } = await supabase.from('school_years').select('*').eq('id', school_year_id).single();
  if (!sy) {
    return jsonResponse({ error: 'Selected School Year does not exist.' }, 400);
  }

  const syStartStr = sy.start_date ? String(sy.start_date).split('T')[0] : '';
  const syEndStr = sy.end_date ? String(sy.end_date).split('T')[0] : '';

  if (syStartStr && semStartStr < syStartStr) {
    return jsonResponse({ error: `Semester start date (${semStartStr}) cannot precede the School Year start date (${syStartStr}).` }, 400);
  }
  if (syEndStr && semEndStr > syEndStr) {
    return jsonResponse({ error: `Semester end date (${semEndStr}) cannot exceed the School Year end date (${syEndStr}).` }, 400);
  }

  // Check semester overlaps under same school year
  const { data: existingSems } = await supabase
    .from('semesters')
    .select('*')
    .eq('school_year_id', school_year_id)
    .neq('status', 'archived');

  if (existingSems) {
    for (const s of existingSems) {
      const sStart = String(s.start_date).split('T')[0];
      const sEnd = String(s.end_date).split('T')[0];
      if (semStartStr <= sEnd && semEndStr >= sStart) {
        return jsonResponse({ error: `Semester date range overlaps with existing semester "${s.name}" (${sStart} to ${sEnd}).` }, 400);
      }
    }
  }

  const { data, error } = await supabase
    .from('semesters')
    .insert([{ school_year_id, name, start_date: semStartStr, end_date: semEndStr, is_active: false, status: 'active' }])
    .select();

  if (error) {
    return jsonResponse({ error: 'Failed to create semester', details: error.message }, 500);
  }

  return jsonResponse({ success: true, data: data?.[0] });
}

async function handlePutSemesters(id: string, body: Record<string, unknown>) {
  const supabase = getAdminClient();
  const { name, start_date, end_date } = body as Record<string, unknown>;

  const semStartStr = start_date ? String(start_date).split('T')[0] : '';
  const semEndStr = end_date ? String(end_date).split('T')[0] : '';

  if (semStartStr && semEndStr && semStartStr > semEndStr) {
    return jsonResponse({ error: 'Semester start date cannot be after the end date.' }, 400);
  }

  const { data: currentSem } = await supabase.from('semesters').select('school_year_id').eq('id', id).single();
  if (currentSem?.school_year_id) {
    const { data: sy } = await supabase.from('school_years').select('*').eq('id', currentSem.school_year_id).single();
    if (sy) {
      const syStartStr = sy.start_date ? String(sy.start_date).split('T')[0] : '';
      const syEndStr = sy.end_date ? String(sy.end_date).split('T')[0] : '';

      if (syStartStr && semStartStr && semStartStr < syStartStr) {
        return jsonResponse({ error: `Semester start date (${semStartStr}) cannot precede the School Year start date (${syStartStr}).` }, 400);
      }
      if (syEndStr && semEndStr && semEndStr > syEndStr) {
        return jsonResponse({ error: `Semester end date (${semEndStr}) cannot exceed the School Year end date (${syEndStr}).` }, 400);
      }

      // Check semester overlaps
      const { data: existingSems } = await supabase
        .from('semesters')
        .select('*')
        .eq('school_year_id', currentSem.school_year_id)
        .neq('id', id)
        .neq('status', 'archived');

      if (existingSems) {
        for (const s of existingSems) {
          const sStart = String(s.start_date).split('T')[0];
          const sEnd = String(s.end_date).split('T')[0];
          if (semStartStr <= sEnd && semEndStr >= sStart) {
            return jsonResponse({ error: `Semester date range overlaps with existing semester "${s.name}" (${sStart} to ${sEnd}).` }, 400);
          }
        }
      }
    }
  }

  const { data, error } = await supabase
    .from('semesters')
    .update({ name, start_date: semStartStr, end_date: semEndStr })
    .eq('id', id)
    .select();

  if (error) {
    return jsonResponse({ error: 'Failed to update semester', details: error.message }, 500);
  }

  return jsonResponse({ success: true, data: data?.[0] });
}"""

if old_post_sem in content:
    content = content.replace(old_post_sem, new_post_sem)

# Update handlePostAcademicEvents to require active SY and active semester if enforced or clean up UUID created_by
old_post_event_code = """async function handlePostAcademicEvents(body: Record<string, unknown>) {
  const supabase = getAdminClient();
  let { school_year_id, semester_id, title, description, event_type, document_type_id, start_date, end_date, created_by } =
    body as Record<string, unknown>;

  if (event_type === 'submission_window' && document_type_id) {
    const { data: dt } = await supabase.from('documentType').select('name').eq('id', document_type_id).single();
    if (dt?.name) {
      title = `${dt.name} Submission Window`;
    }
  }

  if (!school_year_id || !title || !event_type) {
    return jsonResponse({ error: 'school_year_id, title, and event_type are required' }, 400);
  }"""

new_post_event_code = """async function handlePostAcademicEvents(body: Record<string, unknown>) {
  const supabase = getAdminClient();
  let { school_year_id, semester_id, title, description, event_type, document_type_id, start_date, end_date, created_by } =
    body as Record<string, unknown>;

  if (event_type === 'submission_window' && document_type_id) {
    const { data: dt } = await supabase.from('documentType').select('name').eq('id', document_type_id).single();
    if (dt?.name) {
      title = `${dt.name} Submission Window`;
    }
  }

  if (!school_year_id || !title || !event_type) {
    return jsonResponse({ error: 'school_year_id, title, and event_type are required' }, 400);
  }

  // Validate UUID or null for created_by
  const isUuid = (str: unknown) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  if (!isUuid(created_by)) created_by = null;
  if (!isUuid(document_type_id)) document_type_id = null;
  if (!isUuid(semester_id)) semester_id = null;"""

if old_post_event_code in content:
    content = content.replace(old_post_event_code, new_post_event_code)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Updated api/index.ts via update_api_v3.py!')

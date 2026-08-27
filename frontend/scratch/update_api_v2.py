import os

file_path = r'c:\Users\User\OneDrive\Desktop\OSODOCS\bulsu-osodocs\supabase\functions\api\index.ts'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace handlePostSchoolYears & handlePutSchoolYears with duplicate check logic
old_post_sy = """async function handlePostSchoolYears(body: Record<string, unknown>) {
  const supabase = getAdminClient();
  const { name, start_date, end_date, is_active } = body as Record<string, unknown>;

  if (!name || !start_date || !end_date) {
    return jsonResponse({ error: 'Name, start_date, and end_date are required' }, 400);
  }

  if (is_active) {
    await supabase
      .from('school_years')
      .update({ is_active: false })
      .neq('id', '00000000-0000-0000-0000-000000000000');
  }

  const { data, error } = await supabase
    .from('school_years')
    .insert([{ name, start_date, end_date, is_active: is_active || false }])
    .select();

  if (error) {
    return jsonResponse({ error: 'Failed to create school year', details: error.message }, 500);
  }

  return jsonResponse({ success: true, data: data?.[0] });
}

async function handlePutSchoolYears(id: string, body: Record<string, unknown>) {
  const supabase = getAdminClient();
  const { name, start_date, end_date } = body as Record<string, unknown>;

  const { data, error } = await supabase
    .from('school_years')
    .update({ name, start_date, end_date })
    .eq('id', id)
    .select();

  if (error) {
    return jsonResponse({ error: 'Failed to update school year', details: error.message }, 500);
  }

  return jsonResponse({ success: true, data: data?.[0] });
}"""

new_post_sy = """async function handlePostSchoolYears(body: Record<string, unknown>) {
  const supabase = getAdminClient();
  const { name, start_date, end_date, is_active } = body as Record<string, unknown>;

  if (!name || !start_date || !end_date) {
    return jsonResponse({ error: 'Name, start_date, and end_date are required' }, 400);
  }

  const formattedName = String(name).trim();

  // Duplicate check by name or identical dates
  const { data: existing } = await supabase.from('school_years').select('*');
  if (existing) {
    const dupName = existing.find(s => s.name?.toLowerCase().trim() === formattedName.toLowerCase());
    if (dupName) {
      return jsonResponse({ error: 'A School Year with this name already exists.' }, 400);
    }
    const dupDates = existing.find(s => s.start_date === start_date && s.end_date === end_date);
    if (dupDates) {
      return jsonResponse({ error: 'A School Year with these exact start and end dates already exists.' }, 400);
    }
  }

  if (is_active) {
    await supabase
      .from('school_years')
      .update({ is_active: false })
      .neq('id', '00000000-0000-0000-0000-000000000000');
  }

  const { data, error } = await supabase
    .from('school_years')
    .insert([{ name: formattedName, start_date, end_date, is_active: is_active || false }])
    .select();

  if (error) {
    return jsonResponse({ error: 'Failed to create school year', details: error.message }, 500);
  }

  return jsonResponse({ success: true, data: data?.[0] });
}

async function handlePutSchoolYears(id: string, body: Record<string, unknown>) {
  const supabase = getAdminClient();
  const { name, start_date, end_date } = body as Record<string, unknown>;

  const formattedName = String(name).trim();

  const { data: existing } = await supabase.from('school_years').select('*').neq('id', id);
  if (existing) {
    const dupName = existing.find(s => s.name?.toLowerCase().trim() === formattedName.toLowerCase());
    if (dupName) {
      return jsonResponse({ error: 'A School Year with this name already exists.' }, 400);
    }
    const dupDates = existing.find(s => s.start_date === start_date && s.end_date === end_date);
    if (dupDates) {
      return jsonResponse({ error: 'A School Year with these exact start and end dates already exists.' }, 400);
    }
  }

  const { data, error } = await supabase
    .from('school_years')
    .update({ name: formattedName, start_date, end_date })
    .eq('id', id)
    .select();

  if (error) {
    return jsonResponse({ error: 'Failed to update school year', details: error.message }, 500);
  }

  return jsonResponse({ success: true, data: data?.[0] });
}"""

if old_post_sy in content:
    content = content.replace(old_post_sy, new_post_sy)

# Replace handlePostSemesters & handlePutSemesters with date normalization
old_post_sem = """async function handlePostSemesters(body: Record<string, unknown>) {
  const supabase = getAdminClient();
  const { school_year_id, name, start_date, end_date } = body as Record<string, unknown>;

  if (!school_year_id || !name || !start_date || !end_date) {
    return jsonResponse({ error: 'school_year_id, name, start_date, and end_date are required' }, 400);
  }

  const { data: sy } = await supabase.from('school_years').select('*').eq('id', school_year_id).single();
  if (!sy) {
    return jsonResponse({ error: 'Selected School Year does not exist.' }, 400);
  }

  if (sy.start_date && new Date(start_date as string) < new Date(sy.start_date)) {
    return jsonResponse({ error: 'Semester start date cannot precede the School Year start date.' }, 400);
  }
  if (sy.end_date && new Date(end_date as string) > new Date(sy.end_date)) {
    return jsonResponse({ error: 'Semester end date cannot exceed the School Year end date.' }, 400);
  }

  const { data, error } = await supabase
    .from('semesters')
    .insert([{ school_year_id, name, start_date, end_date, is_active: false, status: 'active' }])
    .select();

  if (error) {
    return jsonResponse({ error: 'Failed to create semester', details: error.message }, 500);
  }

  return jsonResponse({ success: true, data: data?.[0] });
}

async function handlePutSemesters(id: string, body: Record<string, unknown>) {
  const supabase = getAdminClient();
  const { name, start_date, end_date } = body as Record<string, unknown>;

  const { data: currentSem } = await supabase.from('semesters').select('school_year_id').eq('id', id).single();
  if (currentSem?.school_year_id) {
    const { data: sy } = await supabase.from('school_years').select('*').eq('id', currentSem.school_year_id).single();
    if (sy) {
      if (start_date && sy.start_date && new Date(start_date as string) < new Date(sy.start_date)) {
        return jsonResponse({ error: 'Semester start date cannot precede the School Year start date.' }, 400);
      }
      if (end_date && sy.end_date && new Date(end_date as string) > new Date(sy.end_date)) {
        return jsonResponse({ error: 'Semester end date cannot exceed the School Year end date.' }, 400);
      }
    }
  }

  const { data, error } = await supabase
    .from('semesters')
    .update({ name, start_date, end_date })
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

if old_post_sem in content:
    content = content.replace(old_post_sem, new_post_sem)

# Auto-generate title for submission_window in handlePostAcademicEvents
old_post_events = """  if (!school_year_id || !title || !event_type) {
    return jsonResponse({ error: 'school_year_id, title, and event_type are required' }, 400);
  }"""

new_post_events = """  if (event_type === 'submission_window' && document_type_id) {
    const { data: dt } = await supabase.from('documentType').select('name').eq('id', document_type_id).single();
    if (dt?.name) {
      title = `${dt.name} Submission Window`;
    }
  }

  if (!school_year_id || !title || !event_type) {
    return jsonResponse({ error: 'school_year_id, title, and event_type are required' }, 400);
  }"""

if old_post_events in content:
    content = content.replace(old_post_events, new_post_events)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Updated api/index.ts via update_api_v2.py!')

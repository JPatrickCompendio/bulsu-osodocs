import os

file_path = r'c:\Users\User\OneDrive\Desktop\OSODOCS\bulsu-osodocs\supabase\functions\api\index.ts'

new_functions = """
async function handleGetSemesters(url: URL) {
  const supabase = getAdminClient();
  const includeArchived = url.searchParams.get('includeArchived') === 'true';
  const schoolYearId = url.searchParams.get('school_year_id');

  let query = supabase.from('semesters').select('*, school_years(name, is_active)');

  if (!includeArchived) {
    query = query.neq('status', 'archived');
  }
  if (schoolYearId) {
    query = query.eq('school_year_id', schoolYearId);
  }

  const { data, error } = await query.order('start_date', { ascending: true });

  if (error) {
    return jsonResponse({ error: 'Failed to fetch semesters', details: error.message }, 500);
  }

  return jsonResponse({ success: true, data });
}

async function handlePostSemesters(body: Record<string, unknown>) {
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
}

async function handleActivateSemester(id: string) {
  const supabase = getAdminClient();
  const { data: sem, error: fetchErr } = await supabase.from('semesters').select('*').eq('id', id).single();
  if (fetchErr || !sem) {
    return jsonResponse({ error: 'Semester not found' }, 404);
  }

  if (sem.status === 'archived') {
    return jsonResponse({ error: 'Cannot activate an archived semester.' }, 400);
  }

  await supabase
    .from('semesters')
    .update({ is_active: false })
    .eq('school_year_id', sem.school_year_id);

  const { data, error } = await supabase
    .from('semesters')
    .update({ is_active: true })
    .eq('id', id)
    .select();

  if (error) {
    return jsonResponse({ error: 'Failed to activate semester', details: error.message }, 500);
  }

  const currentDate = new Date();
  const start = sem.start_date ? new Date(sem.start_date) : null;
  const end = sem.end_date ? new Date(sem.end_date) : null;
  let isWithinBounds = true;
  if (start && end) isWithinBounds = currentDate >= start && currentDate <= end;
  else if (start) isWithinBounds = currentDate >= start;
  else if (end) isWithinBounds = currentDate <= end;

  let warning: string | null = null;
  if (!isWithinBounds) {
    warning = "The current date falls outside this semester's designated date range.";
  }

  return jsonResponse({ success: true, data: data?.[0], warning });
}

async function handleArchiveSemester(id: string) {
  const supabase = getAdminClient();
  const { data: sem, error: fetchErr } = await supabase.from('semesters').select('*').eq('id', id).single();
  if (fetchErr || !sem) {
    return jsonResponse({ error: 'Semester not found' }, 404);
  }

  if (sem.is_active) {
    return jsonResponse({ error: 'Cannot archive the currently active semester. Please activate another semester first.' }, 400);
  }

  const terminalStatuses = ['disapproved', 'rejected', 'cancelled', 'archived', 'completed'];
  const { data: ongoingSubs, error: subErr } = await supabase
    .from('submissions')
    .select('id, status')
    .eq('semester_id', id)
    .not('status', 'in', `("${terminalStatuses.join('","')}")`)
    .limit(1);

  if (subErr) {
    return jsonResponse({ error: 'Failed to check ongoing submissions', details: subErr.message }, 500);
  }

  if (ongoingSubs && ongoingSubs.length > 0) {
    return jsonResponse({ error: 'Cannot archive semester because there are active ongoing submissions referencing it.' }, 400);
  }

  const { error } = await supabase.from('semesters').update({ status: 'archived', is_active: false }).eq('id', id);
  if (error) {
    return jsonResponse({ error: 'Failed to archive semester', details: error.message }, 500);
  }

  return jsonResponse({ success: true, message: 'Semester archived successfully.' });
}

async function handleCreateDraftSubmission(body: Record<string, unknown>) {
  const supabase = getAdminClient();
  const userId = body.userId as string;
  const documentTypeId = body.documentTypeId as string;
  const subtypeId = (body.subtypeId as string) || null;
  const proposalType = (body.proposalType as string) || null;

  if (!userId || !documentTypeId) {
    return jsonResponse({ action: 'blocked', reason: 'User ID and Document Type ID are required.' });
  }

  const { data: activeSy } = await supabase.from('school_years').select('*').eq('is_active', true).single();
  if (!activeSy) {
    return jsonResponse({ action: 'blocked', reason: 'No active school year.' });
  }

  const { data: activeSem } = await supabase
    .from('semesters')
    .select('*')
    .eq('school_year_id', activeSy.id)
    .eq('is_active', true)
    .neq('status', 'archived')
    .single();

  if (!activeSem) {
    return jsonResponse({ action: 'blocked', reason: 'No active semester for the current school year.' });
  }

  const { data: events } = await supabase
    .from('academic_calendar_events')
    .select('*')
    .eq('school_year_id', activeSy.id)
    .eq('semester_id', activeSem.id)
    .eq('document_type_id', documentTypeId)
    .eq('event_type', 'submission_window');

  const windowEvent = events?.[0];
  if (!windowEvent) {
    return jsonResponse({ action: 'blocked', reason: 'No submission window is currently available.' });
  }

  const currentDate = new Date();
  const start = windowEvent.start_date ? new Date(windowEvent.start_date) : null;
  const end = windowEvent.end_date ? new Date(windowEvent.end_date) : null;
  let isWithinBounds = true;
  if (start && end) isWithinBounds = currentDate >= start && currentDate <= end;
  else if (start) isWithinBounds = currentDate >= start;
  else if (end) isWithinBounds = currentDate <= end;

  if (!isWithinBounds) {
    return jsonResponse({
      action: 'blocked',
      reason: 'Submission Window Closed',
      submissionWindow: { start: windowEvent.start_date, end: windowEvent.end_date },
    });
  }

  const { data: dt } = await supabase.from('documentType').select('*').eq('id', documentTypeId).single();
  if (!dt || dt.status !== 'active') {
    return jsonResponse({ action: 'blocked', reason: 'Document type is inactive.' });
  }

  if (dt.requires_eligibility && dt.name.toLowerCase().includes('renewal')) {
    const { data: userSubs } = await supabase
      .from('submissions')
      .select('status, documentType:document_type_id(name)')
      .eq('user_id', userId)
      .eq('school_year_id', activeSy.id);

    const completedSubs = (userSubs || []).filter((s) => s.status === 'completed');
    const hasApprovedMidYear = completedSubs.some((s) => (s.documentType as any)?.name?.toString().toLowerCase().includes('mid-year'));
    const hasApprovedYearEnd = completedSubs.some((s) => (s.documentType as any)?.name?.toString().toLowerCase().includes('year-end'));

    if (!hasApprovedMidYear || !hasApprovedYearEnd) {
      const missing = [];
      if (!hasApprovedMidYear) missing.push('Approved Mid-Year Report');
      if (!hasApprovedYearEnd) missing.push('Approved Year-End Report');
      return jsonResponse({ action: 'blocked', reason: 'Missing Requirements: ' + missing.join(', ') });
    }
  }

  if (!dt.allow_multiple_submissions) {
    const { data: userRecord } = await supabase.from('users').select('org_name').eq('id', userId).single();
    if (!userRecord || !userRecord.org_name) {
      return jsonResponse({ action: 'blocked', reason: 'User organization not found.' });
    }

    let subQuery = supabase
      .from('submissions')
      .select('id, tracking_number, status, users!inner(org_name)')
      .eq('users.org_name', userRecord.org_name)
      .eq('document_type_id', documentTypeId)
      .eq('school_year_id', activeSy.id);

    if (subtypeId) subQuery = subQuery.eq('subtype_id', subtypeId);

    const { data: existingSubs } = await subQuery.order('created_at', { ascending: false }).limit(1);

    if (existingSubs && existingSubs.length > 0) {
      const existing = existingSubs[0];
      const s = (existing.status || '').toLowerCase();
      const terminalStatuses = ['disapproved', 'rejected', 'cancelled', 'archived'];

      if (s === 'draft' || s === 'returned') {
        return jsonResponse({ action: 'resume', submissionId: existing.id });
      } else if (!terminalStatuses.includes(s)) {
        return jsonResponse({ action: 'blocked', reason: 'Your organization already has an active submission for this document.' });
      }
    }
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc('create_submission_draft', {
    p_user_id: userId,
    p_document_type_id: documentTypeId,
    p_subtype_id: subtypeId,
    p_school_year_id: activeSy.id,
    p_semester_id: activeSem.id,
  });

  if (!rpcError && rpcData) {
    const res = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    return jsonResponse({
      action: 'create',
      submissionId: res.submission_id || res.id,
      versionId: res.version_id || res.current_version_id,
    });
  }

  const { data: sub, error: subErr } = await supabase
    .from('submissions')
    .insert([
      {
        user_id: userId,
        document_type_id: documentTypeId,
        subtype_id: subtypeId,
        school_year_id: activeSy.id,
        semester_id: activeSem.id,
        status: 'draft',
        remarks: 'Initial draft created',
      },
    ])
    .select()
    .single();

  if (subErr || !sub) {
    return jsonResponse({ action: 'error', reason: 'Failed to create submission record', details: subErr?.message }, 500);
  }

  const { data: ver, error: verErr } = await supabase
    .from('submission_versions')
    .insert([
      {
        submission_id: sub.id,
        version_number: 1,
        status: 'draft',
        submitted_by: userId,
      },
    ])
    .select()
    .single();

  if (verErr || !ver) {
    await supabase.from('submissions').delete().eq('id', sub.id);
    return jsonResponse({ action: 'error', reason: 'Failed to create submission version', details: verErr?.message }, 500);
  }

  const { error: updateErr } = await supabase
    .from('submissions')
    .update({ current_version_id: ver.id })
    .eq('id', sub.id);

  if (updateErr) {
    await supabase.from('submission_versions').delete().eq('id', ver.id);
    await supabase.from('submissions').delete().eq('id', sub.id);
    return jsonResponse({ action: 'error', reason: 'Failed to link version to submission', details: updateErr.message }, 500);
  }

  await supabase.from('submission_logs').insert([
    {
      submission_id: sub.id,
      user_id: userId,
      description: 'Created a draft',
      submission_version_id: ver.id,
      workflow_phase: 'submission',
      action_type: 'draft',
      created_at: new Date().toISOString(),
    },
  ]);

  return jsonResponse({
    action: 'create',
    submissionId: sub.id,
    versionId: ver.id,
  });
}
"""

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

if 'handleGetSemesters' not in content:
    content = content.replace('async function handleGetAcademicEvents()', new_functions + '\n\nasync function handleGetAcademicEvents()')

old_post_events = """async function handlePostAcademicEvents(body: Record<string, unknown>) {
  const supabase = getAdminClient();
  let { school_year_id, title, description, event_type, document_type_id, start_date, end_date, created_by } =
    body as Record<string, unknown>;

  if (!school_year_id || !title || !event_type) {
    return jsonResponse({ error: 'school_year_id, title, and event_type are required' }, 400);
  }

  if (document_type_id === '') document_type_id = null;
  if (start_date === '') start_date = null;
  if (end_date === '') end_date = null;

  const { data, error } = await supabase
    .from('academic_calendar_events')
    .insert([
      { school_year_id, title, description, event_type, document_type_id, start_date, end_date, created_by },
    ])
    .select();

  if (error) {
    return jsonResponse({ error: 'Failed to create academic event', details: error.message }, 500);
  }

  return jsonResponse({ success: true, data: data?.[0] });
}"""

new_post_events = """async function handlePostAcademicEvents(body: Record<string, unknown>) {
  const supabase = getAdminClient();
  let { school_year_id, semester_id, title, description, event_type, document_type_id, start_date, end_date, created_by } =
    body as Record<string, unknown>;

  if (!school_year_id || !title || !event_type) {
    return jsonResponse({ error: 'school_year_id, title, and event_type are required' }, 400);
  }

  if (document_type_id === '') document_type_id = null;
  if (semester_id === '') semester_id = null;
  if (start_date === '') start_date = null;
  if (end_date === '') end_date = null;

  if (semester_id && start_date && end_date) {
    const { data: sem } = await supabase.from('semesters').select('*').eq('id', semester_id).single();
    if (sem) {
      if (sem.start_date && new Date(start_date as string) < new Date(sem.start_date)) {
        return jsonResponse({ error: 'Event start date cannot precede the Semester start date.' }, 400);
      }
      if (sem.end_date && new Date(end_date as string) > new Date(sem.end_date)) {
        return jsonResponse({ error: 'Event end date cannot exceed the Semester end date.' }, 400);
      }
    }
  }

  if (event_type === 'submission_window' && semester_id && document_type_id && start_date && end_date) {
    const { data: existingWindows } = await supabase
      .from('academic_calendar_events')
      .select('*')
      .eq('semester_id', semester_id)
      .eq('document_type_id', document_type_id)
      .eq('event_type', 'submission_window');

    if (existingWindows) {
      const newStart = new Date(start_date as string);
      const newEnd = new Date(end_date as string);

      for (const ev of existingWindows) {
        if (!ev.start_date || !ev.end_date) continue;
        const evStart = new Date(ev.start_date);
        const evEnd = new Date(ev.end_date);

        if (newStart <= evEnd && newEnd >= evStart) {
          return jsonResponse(
            { error: 'A submission window for this document type already overlaps with these dates within the selected semester.' },
            400,
          );
        }
      }
    }
  }

  const { data, error } = await supabase
    .from('academic_calendar_events')
    .insert([
      { school_year_id, semester_id, title, description, event_type, document_type_id, start_date, end_date, created_by },
    ])
    .select();

  if (error) {
    return jsonResponse({ error: 'Failed to create academic event', details: error.message }, 500);
  }

  return jsonResponse({ success: true, data: data?.[0] });
}"""

if old_post_events in content:
    content = content.replace(old_post_events, new_post_events)

route_marker = "if (method === 'GET' && path === '/school-years') return handleGetSchoolYears();"
new_routes = """if (method === 'GET' && path === '/semesters') return handleGetSemesters(url);
  if (method === 'POST' && path === '/semesters') return handlePostSemesters(body);
  if (method === 'PUT' && /^\\/semesters\\/[^/]+$/.test(path)) {
    return handlePutSemesters(path.split('/')[2], body);
  }
  if (method === 'PUT' && /^\\/semesters\\/[^/]+\\/activate$/.test(path)) {
    return handleActivateSemester(path.split('/')[2]);
  }
  if (method === 'DELETE' && /^\\/semesters\\/[^/]+$/.test(path)) {
    return handleArchiveSemester(path.split('/')[2]);
  }

  if (method === 'POST' && path === '/submissions/draft') {
    return handleCreateDraftSubmission(body);
  }

  if (method === 'GET' && path === '/school-years') return handleGetSchoolYears();"""

if route_marker in content:
    content = content.replace(route_marker, new_routes)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Updated api/index.ts via update_api.py!')

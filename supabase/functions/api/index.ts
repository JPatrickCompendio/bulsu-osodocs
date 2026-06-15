import {
  corsHeaders,
  getAdminClient,
  jsonResponse,
  normalizePath,
} from './supabaseAdmin.ts';

type Params = Record<string, string>;

async function readBody(req: Request) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

async function handleGetUsers() {
  const supabase = getAdminClient();
  const { data, error } = await supabase.from('users').select('*');
  if (error) {
    return jsonResponse({ error: 'Failed to fetch users', details: error.message }, 500);
  }
  return jsonResponse(data);
}

async function handlePostUsers(body: Record<string, unknown>) {
  const supabase = getAdminClient();
  const {
    full_name,
    role,
    status,
    profile_image,
    email,
    password,
    org_name,
    no_member,
    adviser_name,
    joined_date,
    contact_no,
    student_no,
  } = body as Record<string, string | null | undefined>;

  if (!full_name || !role || !email || !password) {
    return jsonResponse({ error: 'Full name, role, email, and password are required' }, 400);
  }

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) {
    return jsonResponse({ error: authError.message }, 500);
  }

  const { data: profileData, error: profileError } = await supabase
    .from('users')
    .insert([
      {
        id: authData.user.id,
        full_name,
        role,
        status: status || 'Active',
        profile_image: profile_image || null,
        org_name: org_name || null,
        no_member: no_member || null,
        adviser_name: adviser_name || null,
        joined_date: joined_date || null,
        contact_no: contact_no || null,
        student_no: student_no || null,
      },
    ])
    .select();

  if (profileError) {
    return jsonResponse({ error: 'Failed to create user', details: profileError.message }, 500);
  }

  return jsonResponse({ success: true, user: profileData?.[0] });
}

async function handlePutUsers(id: string, body: Record<string, unknown>) {
  const supabase = getAdminClient();
  const {
    full_name,
    role,
    status,
    profile_image,
    org_name,
    no_member,
    adviser_name,
    joined_date,
    contact_no,
    student_no,
  } = body as Record<string, string | null | undefined>;

  const { data, error } = await supabase
    .from('users')
    .update({
      full_name,
      role,
      status: status || 'Active',
      profile_image: profile_image || null,
      org_name: org_name || null,
      no_member: no_member || null,
      adviser_name: adviser_name || null,
      joined_date: joined_date || null,
      contact_no: contact_no || null,
      student_no: student_no || null,
    })
    .eq('id', id)
    .select();

  if (error) {
    return jsonResponse({ error: 'Failed to update user', details: error.message }, 500);
  }

  return jsonResponse({ success: true, user: data?.[0] });
}

async function handleDeleteUsers(id: string, body: Record<string, unknown>) {
  const supabase = getAdminClient();
  const { adminEmail, adminPassword } = body as { adminEmail?: string; adminPassword?: string };

  if (adminEmail && adminPassword) {
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: adminEmail,
      password: adminPassword,
    });
    if (authError) {
      return jsonResponse({ error: 'Invalid admin credentials' }, 401);
    }
  }

  const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(id);
  if (deleteAuthError) {
    return jsonResponse({ error: 'Failed to delete user', details: deleteAuthError.message }, 500);
  }

  const { error: deleteProfileError } = await supabase.from('users').delete().eq('id', id);
  if (deleteProfileError) {
    return jsonResponse({ error: 'Failed to delete user', details: deleteProfileError.message }, 500);
  }

  return jsonResponse({ success: true, message: 'User deleted successfully' });
}

async function handleGetAnnouncements() {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return jsonResponse({ error: 'Failed to fetch announcements', details: error.message }, 500);
  }

  return jsonResponse({ success: true, data });
}

async function handlePostAnnouncements(body: Record<string, unknown>) {
  const supabase = getAdminClient();
  const { title, content, target_audience, is_active, created_by } = body as Record<string, unknown>;

  if (!title || !content || !target_audience) {
    return jsonResponse({ error: 'Title, content, and target_audience are required' }, 400);
  }

  const { data, error } = await supabase
    .from('announcements')
    .insert([
      {
        title,
        content,
        target_audience,
        is_active: is_active ?? true,
        created_by,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ])
    .select();

  if (error) {
    return jsonResponse({ error: 'Failed to create announcement', details: error.message }, 500);
  }

  return jsonResponse({ success: true, data: data?.[0] });
}

async function handlePutAnnouncements(id: string, body: Record<string, unknown>) {
  const supabase = getAdminClient();
  const { title, content, target_audience, is_active } = body as Record<string, unknown>;

  const { data, error } = await supabase
    .from('announcements')
    .update({ title, content, target_audience, is_active, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select();

  if (error) {
    return jsonResponse({ error: 'Failed to update announcement', details: error.message }, 500);
  }

  return jsonResponse({ success: true, data: data?.[0] });
}

async function handleDeleteAnnouncements(id: string) {
  const supabase = getAdminClient();
  const folderPath = `announcements/${id}`;
  const { data: existingFiles } = await supabase.storage.from('documents').list(folderPath);

  if (existingFiles && existingFiles.length > 0) {
    const filesToRemove = existingFiles.map((x) => `${folderPath}/${x.name}`);
    await supabase.storage.from('documents').remove(filesToRemove);
  }

  const { error } = await supabase.from('announcements').delete().eq('id', id);
  if (error) {
    return jsonResponse({ error: 'Failed to delete announcement', details: error.message }, 500);
  }

  return jsonResponse({ success: true, message: 'Announcement deleted successfully' });
}

async function handleGetNotifications(url: URL) {
  const supabase = getAdminClient();
  const userId = url.searchParams.get('userId');
  const role = url.searchParams.get('role');
  const orgName = url.searchParams.get('orgName') || '';

  if (!userId || !role) {
    return jsonResponse({ error: 'UserId and role are required' }, 400);
  }

  let notifications: Array<Record<string, unknown>> = [];

  let annQuery = supabase.from('announcements').select('*').eq('is_active', true);

  if (role !== 'admin') {
    const audiences: string[] = [];
    if (role === 'org-president') {
      audiences.push('all-orgs');
      if (orgName) audiences.push(`org:${orgName}`);
    } else if (role === 'chairman') {
      audiences.push('oso-staff', 'chairman');
    } else if (role === 'vice-chairman') {
      audiences.push('oso-staff', 'vice-chairman');
    } else if (role === 'oso-staff') {
      audiences.push('oso-staff');
    }
    annQuery = annQuery.in('target_audience', audiences);
  }

  const { data: announcementsData, error: annError } = await annQuery;
  if (!annError && announcementsData) {
    notifications = [
      ...notifications,
      ...announcementsData.map((a) => ({
        id: `ann_${a.id}`,
        type: 'announcement',
        title: a.title,
        message: a.content,
        timestamp: a.created_at,
        source: a,
      })),
    ];
  }

  let logsData: Array<Record<string, unknown>> = [];
  if (role === 'admin') {
    const adminActions = ['oso approved', 'document_retrieved', 'accomplishment_report_submitted'];
    const { data } = await supabase
      .from('submission_logs')
      .select('*, submissions(document_type_id, user_id, id)')
      .in('action_type', adminActions)
      .order('created_at', { ascending: false })
      .limit(50);
    logsData = data || [];
  } else if (role === 'org-president') {
    const { data } = await supabase
      .from('submission_logs')
      .select('*, submissions!inner(id, user_id)')
      .eq('submissions.user_id', userId)
      .neq('action_type', 'created')
      .neq('action_type', 'submitted')
      .neq('action_type', 'attachment_review')
      .neq('action_type', 'viewed')
      .order('created_at', { ascending: false })
      .limit(50);
    logsData = data || [];
  } else {
    let triggerActions: string[] = [];
    if (role === 'oso-staff') triggerActions = ['submitted'];
    else if (role === 'sds-coordinator') triggerActions = ['oso approved'];
    else if (role === 'chairman') triggerActions = ['sds approved'];
    else if (role === 'vice-chairman') triggerActions = ['chairman approved'];
    else if (role === 'external') triggerActions = ['vice chairman approved'];
    else if (role === 'dean') triggerActions = ['external approved'];

    if (triggerActions.length > 0) {
      const { data } = await supabase
        .from('submission_logs')
        .select('*, submissions(id)')
        .in('action_type', triggerActions)
        .order('created_at', { ascending: false })
        .limit(50);
      logsData = data || [];
    }
  }

  if (logsData.length > 0) {
    notifications = [
      ...notifications,
      ...logsData.map((l) => ({
        id: `log_${l.id}`,
        type: 'workflow',
        title: l.action_type
          ? String(l.action_type).replace(/_/g, ' ').toUpperCase()
          : 'Workflow Update',
        message: l.description || 'Status changed',
        timestamp: l.created_at,
        source: l,
      })),
    ];
  }

  notifications.sort(
    (a, b) => new Date(String(b.timestamp)).getTime() - new Date(String(a.timestamp)).getTime(),
  );

  return jsonResponse({ success: true, data: notifications });
}

async function handleGetSchoolYears() {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('school_years')
    .select('*')
    .order('start_date', { ascending: false });

  if (error) {
    return jsonResponse({ error: 'Failed to fetch school years', details: error.message }, 500);
  }

  return jsonResponse({ success: true, data });
}

async function handlePostSchoolYears(body: Record<string, unknown>) {
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
}

async function handleActivateSchoolYear(id: string) {
  const supabase = getAdminClient();
  await supabase
    .from('school_years')
    .update({ is_active: false })
    .neq('id', '00000000-0000-0000-0000-000000000000');

  const { data, error } = await supabase
    .from('school_years')
    .update({ is_active: true })
    .eq('id', id)
    .select();

  if (error) {
    return jsonResponse({ error: 'Failed to activate school year', details: error.message }, 500);
  }

  return jsonResponse({ success: true, data: data?.[0] });
}

async function handleDeleteSchoolYear(id: string) {
  const supabase = getAdminClient();
  const { data: submissions, error: subErr } = await supabase
    .from('submissions')
    .select('id')
    .eq('school_year_id', id)
    .limit(1);

  if (subErr) {
    return jsonResponse({ error: 'Failed to delete school year', details: subErr.message }, 500);
  }

  if (submissions && submissions.length > 0) {
    return jsonResponse(
      { error: 'Cannot delete School Year because there are submissions tied to it.' },
      400,
    );
  }

  await supabase.from('academic_calendar_events').delete().eq('school_year_id', id);

  const { error } = await supabase.from('school_years').delete().eq('id', id);
  if (error) {
    return jsonResponse({ error: 'Failed to delete school year', details: error.message }, 500);
  }

  return jsonResponse({ success: true, message: 'School Year deleted successfully.' });
}

async function handleGetAcademicEvents() {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('academic_calendar_events')
    .select('*')
    .order('start_date', { ascending: true });

  if (error) {
    return jsonResponse({ error: 'Failed to fetch academic events', details: error.message }, 500);
  }

  return jsonResponse({ success: true, data });
}

async function handlePostAcademicEvents(body: Record<string, unknown>) {
  const supabase = getAdminClient();
  const { school_year_id, title, description, event_type, document_type_id, start_date, end_date, created_by } =
    body as Record<string, unknown>;

  if (!school_year_id || !title || !event_type) {
    return jsonResponse({ error: 'school_year_id, title, and event_type are required' }, 400);
  }

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
}

async function handlePutAcademicEvents(id: string, body: Record<string, unknown>) {
  const supabase = getAdminClient();
  const { title, description, event_type, document_type_id, start_date, end_date } = body as Record<string, unknown>;

  const { data, error } = await supabase
    .from('academic_calendar_events')
    .update({ title, description, event_type, document_type_id, start_date, end_date })
    .eq('id', id)
    .select();

  if (error) {
    return jsonResponse({ error: 'Failed to update academic event', details: error.message }, 500);
  }

  return jsonResponse({ success: true, data: data?.[0] });
}

async function handleDeleteAcademicEvent(id: string) {
  const supabase = getAdminClient();
  const { error } = await supabase.from('academic_calendar_events').delete().eq('id', id);

  if (error) {
    return jsonResponse({ error: 'Failed to delete academic event', details: error.message }, 500);
  }

  return jsonResponse({ success: true, message: 'Event deleted successfully' });
}

async function handleDocumentAvailability(url: URL) {
  const supabase = getAdminClient();
  const userId = url.searchParams.get('userId');

  const { data: activeSy } = await supabase
    .from('school_years')
    .select('*')
    .eq('is_active', true)
    .single();

  if (!activeSy) {
    return jsonResponse({
      success: true,
      activeSchoolYear: null,
      availability: {},
      message: 'No active school year.',
    });
  }

  const currentDate = new Date();
  const syStart = activeSy.start_date ? new Date(activeSy.start_date) : null;
  const syEnd = activeSy.end_date ? new Date(activeSy.end_date) : null;

  let isWithinSy = true;
  if (syStart && syEnd) isWithinSy = currentDate >= syStart && currentDate <= syEnd;
  else if (syStart) isWithinSy = currentDate >= syStart;
  else if (syEnd) isWithinSy = currentDate <= syEnd;

  if (!isWithinSy) {
    return jsonResponse({
      success: true,
      activeSchoolYear: activeSy,
      availability: {},
      message: 'The current date is outside the active School Year.',
    });
  }

  const { data: docTypes } = await supabase.from('documentType').select('*');
  const { data: events } = await supabase
    .from('academic_calendar_events')
    .select('*')
    .eq('school_year_id', activeSy.id);

  const blockedEvents = events?.filter((e) => e.event_type === 'ACTIVITY_BLOCK') || [];
  const availability: Record<string, { isAvailable: boolean; lockedReason: string | null; requiresEligibility: boolean }> = {};

  const isWithinBounds = (start_date: string | null, end_date: string | null) => {
    if (!start_date && !end_date) return true;
    const start = start_date ? new Date(start_date) : null;
    const end = end_date ? new Date(end_date) : null;
    if (start && end) return currentDate >= start && currentDate <= end;
    if (start) return currentDate >= start;
    if (end) return currentDate <= end;
    return false;
  };

  let isRenewalEligible = false;
  const missingRenewalRequirements: string[] = [];

  if (userId) {
    const { data: userSubs } = await supabase
      .from('submissions')
      .select('status, documentType:document_type_id(name)')
      .eq('user_id', userId)
      .eq('school_year_id', activeSy.id)
      .eq('status', 'completed');

    const hasApprovedMidYear = userSubs?.some((s) =>
      s.documentType?.name?.toLowerCase().includes('mid-year'),
    );
    const hasApprovedYearEnd = userSubs?.some((s) =>
      s.documentType?.name?.toLowerCase().includes('year-end'),
    );

    if (!hasApprovedMidYear) missingRenewalRequirements.push('Approved Mid-Year Report');
    if (!hasApprovedYearEnd) missingRenewalRequirements.push('Approved Year-End Report');

    isRenewalEligible = Boolean(hasApprovedMidYear && hasApprovedYearEnd);
  }

  for (const dt of docTypes || []) {
    let isAvailable = false;
    let lockedReason: string | null = null;

    if (dt.status !== 'active') {
      lockedReason = 'Document type is inactive';
    } else if (dt.availability_type === 'scheduled') {
      if (!dt.active_from && !dt.active_until) {
        lockedReason = 'No active submission period configured';
      } else if (!isWithinBounds(dt.active_from, dt.active_until)) {
        lockedReason = 'Submission Period Closed';
      } else {
        isAvailable = true;
      }
    } else {
      isAvailable = true;
    }

    if (isAvailable && dt.requires_eligibility && dt.name.toLowerCase().includes('renewal')) {
      if (!isRenewalEligible) {
        isAvailable = false;
        lockedReason = 'Missing Requirements: ' + missingRenewalRequirements.join(', ');
      }
    }

    availability[dt.id] = {
      isAvailable,
      lockedReason,
      requiresEligibility: dt.requires_eligibility,
    };
  }

  return jsonResponse({
    success: true,
    activeSchoolYear: activeSy,
    availability,
    blockedEvents,
  });
}

async function handleAdminDashboard() {
  const supabase = getAdminClient();
  const currentDate = new Date();
  const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString();

  const { data: activeSy } = await supabase
    .from('school_years')
    .select('*')
    .eq('is_active', true)
    .single();

  const activeSyId = activeSy ? activeSy.id : null;
  let eligibleForRenewalCount = 0;

  if (activeSyId) {
    const { data: orgPresidents } = await supabase.from('users').select('id, role').eq('role', 'org-president');
    const { data: approvedReports } = await supabase
      .from('submissions')
      .select('user_id, documentType:document_type_id(name)')
      .eq('school_year_id', activeSyId)
      .eq('status', 'completed');

    if (orgPresidents && approvedReports) {
      let eligibleCount = 0;
      for (const user of orgPresidents) {
        const userReports = approvedReports.filter((r) => r.user_id === user.id);
        const hasMid = userReports.some((r) => r.documentType?.name?.toLowerCase().includes('mid-year'));
        const hasEnd = userReports.some((r) => r.documentType?.name?.toLowerCase().includes('year-end'));
        if (hasMid && hasEnd) eligibleCount++;
      }
      eligibleForRenewalCount = eligibleCount;
    }
  }

  const { data: allSubmissions } = await supabase
    .from('submissions')
    .select(
      'id, status, school_year_id, user_id, current_version_id, documentType:document_type_id(name, id), users:user_id(org_name, full_name), submission_versions!submission_versions_submission_id_fkey(version_number, activity_proposal_details(activity_title))',
    )
    .order('created_at', { ascending: false });

  const allTimeCount = allSubmissions ? allSubmissions.filter((s) => s.status !== 'draft').length : 0;
  const currentSyCount =
    activeSyId && allSubmissions
      ? allSubmissions.filter((s) => s.school_year_id === activeSyId && s.status !== 'draft').length
      : 0;

  const normalizeStatus = (value: unknown) => String(value || '').toLowerCase().trim();
  const activeReviewStatuses = new Set([
    'oso approved',
    'sds approved',
    'chairman approved',
    'vice chairman approved',
    'external approved',
    'dean approved',
    'approved',
  ]);
  const actualActiveReviewCount = allSubmissions
    ? allSubmissions.filter((s) => activeReviewStatuses.has(normalizeStatus(s.status))).length
    : 0;

  const activeDocumentsOverview = allSubmissions
    ? allSubmissions.filter((s) => !['draft', 'completed', 'disapproved'].includes(s.status))
    : [];

  const statusBreakdown: Record<string, number> = {
    'to forward and hardcopy submission for org president': 0,
    'chairman and vice chairman review': 0,
    'sds coordinator review': 0,
    'dean review': 0,
    'external review': 0,
    approved: 0,
    disapproved: 0,
    returned: 0,
    completed: 0,
  };

  if (allSubmissions) {
    allSubmissions.forEach((s) => {
      if (s.status === 'draft') return;

      let displayStatus = s.status;
      if (s.status === 'submitted') displayStatus = 'to forward and hardcopy submission for org president';
      else if (s.status === 'oso approved') displayStatus = 'sds coordinator review';
      else if (s.status === 'sds approved' || s.status === 'chairman approved') {
        displayStatus = 'chairman and vice chairman review';
      } else if (s.status === 'vice chairman approved') displayStatus = 'external review';
      else if (s.status === 'external approved') displayStatus = 'dean review';
      else if (s.status === 'dean approved') displayStatus = 'approved';
      else if (s.status === 'returned') displayStatus = 'returned';
      else if (s.status === 'completed') displayStatus = 'completed';
      else if (s.status === 'disapproved') displayStatus = 'disapproved';

      const key = displayStatus ? displayStatus.toLowerCase() : 'unknown';
      if (statusBreakdown[key] !== undefined) statusBreakdown[key]++;
      else statusBreakdown[key] = (statusBreakdown[key] || 0) + 1;
    });
  }

  const { data: returnLogs } = await supabase
    .from('submission_logs')
    .select('review_action')
    .eq('action_type', 'attachment_review')
    .neq('review_action', 'approved');

  const errorCounts: Record<string, number> = {};
  if (returnLogs) {
    returnLogs.forEach((log) => {
      if (log.review_action && String(log.review_action).trim() !== '') {
        const reason = String(log.review_action).trim().replace(/-/g, ' ');
        const displayReason = reason.charAt(0).toUpperCase() + reason.slice(1);
        errorCounts[displayReason] = (errorCounts[displayReason] || 0) + 1;
      }
    });
  }

  const commonErrors = Object.entries(errorCounts)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const { data: recentVersions } = await supabase
    .from('submission_versions')
    .select('submission_id, version_number')
    .gte('created_at', startOfMonth);

  const revisionsThisMonth = recentVersions
    ? recentVersions.filter((v) => v.version_number > 1).length
    : 0;

  const { data: allVersions } = await supabase
    .from('submission_versions')
    .select('submission_id, version_number');

  const avgRevisionsPerType: Record<string, string | number> = {};
  if (allVersions && allSubmissions) {
    const docTypeStats: Record<string, { totalRevisions: number; docCount: number }> = {};
    allSubmissions.forEach((sub) => {
      if (sub.documentType && sub.documentType.name) {
        if (!docTypeStats[sub.documentType.name]) {
          docTypeStats[sub.documentType.name] = { totalRevisions: 0, docCount: 0 };
        }
        docTypeStats[sub.documentType.name].docCount++;
      }
    });

    allVersions.forEach((v) => {
      if (v.version_number > 1) {
        const sub = allSubmissions.find((s) => s.id === v.submission_id);
        if (sub && sub.documentType && sub.documentType.name) {
          docTypeStats[sub.documentType.name].totalRevisions++;
        }
      }
    });

    for (const [type, stats] of Object.entries(docTypeStats)) {
      avgRevisionsPerType[type] = stats.docCount > 0 ? (stats.totalRevisions / stats.docCount).toFixed(2) : 0;
    }
  }

  return jsonResponse({
    success: true,
    data: {
      statistics: {
        eligibleForRenewalCount,
        activeReviewCount: actualActiveReviewCount,
        currentSyCount,
        allTimeCount,
      },
      activeDocuments: activeDocumentsOverview,
      statusBreakdown,
      commonErrors,
      revisionAnalysis: {
        revisionsThisMonth,
        avgRevisionsPerType,
      },
    },
  });
}

async function handleOrgDashboard(url: URL) {
  const supabase = getAdminClient();
  const userId = url.searchParams.get('userId');

  if (!userId) {
    return jsonResponse({ error: 'User ID is required' }, 400);
  }

  const { data: user } = await supabase.from('users').select('*').eq('id', userId).single();
  const { data: activeSy } = await supabase.from('school_years').select('*').eq('is_active', true).single();
  const { data: announcements } = await supabase
    .from('announcements')
    .select('*')
    .in('target_audience', ['all', 'org-president'])
    .order('created_at', { ascending: false })
    .limit(3);

  const { data: userSubmissions } = await supabase
    .from('submissions')
    .select(
      'id, status, school_year_id, created_at, documentType:document_type_id(name, id), submission_versions!submission_versions_submission_id_fkey(version_number, activity_proposal_details(activity_title))',
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  const underReviewDocs: Array<Record<string, unknown>> = [];
  let completedCount = 0;
  let disapprovedCount = 0;
  let pendingCount = 0;
  let approvedCount = 0;
  let returnedCount = 0;
  let isRenewalEligible = false;
  let hasMidYear = false;
  let hasYearEnd = false;

  if (userSubmissions) {
    userSubmissions.forEach((sub) => {
      const s = sub.status ? sub.status.toLowerCase() : '';

      if (s === 'completed') {
        completedCount++;
        if (activeSy && sub.school_year_id === activeSy.id) {
          const docName = sub.documentType?.name?.toLowerCase() || '';
          if (docName.includes('mid-year') || docName.includes('mid year')) hasMidYear = true;
          if (docName.includes('year-end') || docName.includes('year end')) hasYearEnd = true;
        }
      } else if (s === 'disapproved') {
        disapprovedCount++;
      } else if (s === 'returned') {
        returnedCount++;
      } else if (s === 'dean approved') {
        approvedCount++;
        underReviewDocs.push(sub);
      } else if (s !== 'draft') {
        pendingCount++;
        underReviewDocs.push(sub);
      }
    });
    isRenewalEligible = hasMidYear && hasYearEnd;
  }

  const activeSubIds = underReviewDocs.map((d) => d.id as string);
  const logsBySubId: Record<string, Record<string, unknown>> = {};

  if (activeSubIds.length > 0) {
    const { data: logs } = await supabase
      .from('submission_logs')
      .select('*')
      .in('submission_id', activeSubIds)
      .order('created_at', { ascending: false });

    if (logs) {
      logs.forEach((log) => {
        if (!logsBySubId[log.submission_id]) {
          logsBySubId[log.submission_id] = log;
        }
      });
    }
  }

  const formattedActiveDocs = underReviewDocs.map((doc) => {
    let docTitle = `Submission #${String(doc.id).substring(0, 6).toUpperCase()}`;
    const versions = doc.submission_versions as Array<Record<string, unknown>> | undefined;

    if (versions && versions.length > 0) {
      const latest = versions.reduce((max, v) =>
        (v.version_number as number) > (max.version_number as number) ? v : max,
      versions[0]);
      const details = Array.isArray(latest.activity_proposal_details)
        ? latest.activity_proposal_details[0]
        : latest.activity_proposal_details;
      if (details && (details as Record<string, unknown>).activity_title) {
        docTitle = (details as Record<string, unknown>).activity_title as string;
      } else {
        docTitle = `${(doc.documentType as Record<string, unknown>)?.name || 'Document'} #${String(doc.id).substring(0, 6).toUpperCase()}`;
      }
    } else {
      docTitle = `${(doc.documentType as Record<string, unknown>)?.name || 'Document'} #${String(doc.id).substring(0, 6).toUpperCase()}`;
    }

    return {
      id: doc.id,
      title: docTitle,
      type: (doc.documentType as Record<string, unknown>)?.name || 'Unknown',
      status: doc.status,
      latestLog: logsBySubId[String(doc.id)] || null,
    };
  });

  const totalFinished = completedCount + disapprovedCount;
  const successRate = totalFinished > 0 ? Math.round((completedCount / totalFinished) * 100) : 100;

  return jsonResponse({
    success: true,
    data: {
      hero: {
        user: user || {},
        activeSy: activeSy || null,
      },
      statistics: {
        pendingCount,
        approvedCount,
        returnedCount,
        completedCount,
        successRate,
      },
      activeDocuments: formattedActiveDocs,
      announcements: announcements || [],
      renewal: {
        isEligible: isRenewalEligible,
        hasMidYear,
        hasYearEnd,
      },
    },
  });
}

async function routeRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = normalizePath(url.pathname);
  const method = req.method.toUpperCase();
  const body = method === 'GET' || method === 'DELETE' ? {} : await readBody(req);

  if (method === 'GET' && path === '/users') return handleGetUsers();
  if (method === 'POST' && path === '/users') return handlePostUsers(body);
  if (method === 'PUT' && /^\/users\/[^/]+$/.test(path)) {
    return handlePutUsers(path.split('/')[2], body);
  }
  if (method === 'DELETE' && /^\/users\/[^/]+$/.test(path)) {
    return handleDeleteUsers(path.split('/')[2], body);
  }

  if (method === 'GET' && path === '/announcements') return handleGetAnnouncements();
  if (method === 'POST' && path === '/announcements') return handlePostAnnouncements(body);
  if (method === 'PUT' && /^\/announcements\/[^/]+$/.test(path)) {
    return handlePutAnnouncements(path.split('/')[2], body);
  }
  if (method === 'DELETE' && /^\/announcements\/[^/]+$/.test(path)) {
    return handleDeleteAnnouncements(path.split('/')[2]);
  }

  if (method === 'GET' && path === '/notifications') return handleGetNotifications(url);

  if (method === 'GET' && path === '/school-years') return handleGetSchoolYears();
  if (method === 'POST' && path === '/school-years') return handlePostSchoolYears(body);
  if (method === 'PUT' && /^\/school-years\/[^/]+$/.test(path)) {
    return handlePutSchoolYears(path.split('/')[2], body);
  }
  if (method === 'PUT' && /^\/school-years\/[^/]+\/activate$/.test(path)) {
    return handleActivateSchoolYear(path.split('/')[2]);
  }
  if (method === 'DELETE' && /^\/school-years\/[^/]+$/.test(path)) {
    return handleDeleteSchoolYear(path.split('/')[2]);
  }

  if (method === 'GET' && path === '/academic-events') return handleGetAcademicEvents();
  if (method === 'POST' && path === '/academic-events') return handlePostAcademicEvents(body);
  if (method === 'PUT' && /^\/academic-events\/[^/]+$/.test(path)) {
    return handlePutAcademicEvents(path.split('/')[2], body);
  }
  if (method === 'DELETE' && /^\/academic-events\/[^/]+$/.test(path)) {
    return handleDeleteAcademicEvent(path.split('/')[2]);
  }

  if (method === 'GET' && path === '/system/document-availability') {
    return handleDocumentAvailability(url);
  }
  if (method === 'GET' && path === '/admin/dashboard') return handleAdminDashboard();
  if (method === 'GET' && path === '/org/dashboard') return handleOrgDashboard(url);

  return jsonResponse({ error: 'Not found' }, 404);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    return await routeRequest(req);
  } catch (err) {
    console.error('Edge function error:', err);
    return jsonResponse(
      { error: 'Internal server error', details: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
});

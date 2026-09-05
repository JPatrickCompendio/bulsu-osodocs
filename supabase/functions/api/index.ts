import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.1';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

export function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  });
}

export function isAllowMultiple(val: unknown): boolean {
  if (val === true || val === 1) return true;
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    return s === 'true' || s === '1' || s === 't' || s === 'yes';
  }
  return false;
}

export function getAdminClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function normalizePath(pathname: string) {
  const stripped = pathname
    .replace(/^\/functions\/v1\/api/, '')
    .replace(/^\/api/, '');
  return stripped.startsWith('/') ? stripped : `/${stripped}`;
}

type Params = Record<string, string>;

async function readBody(req: Request) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

async function getAuthEmailsMap() {
  const supabase = getAdminClient();
  const emailMap = new Map<string, string>();
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error || !data?.users?.length) break;
    data.users.forEach((u) => {
      if (u.id && u.email) emailMap.set(u.id, u.email);
    });
    if (data.users.length < perPage) break;
    page += 1;
  }

  return emailMap;
}

function getAnnouncementAudiences(role: string, orgName = '') {
  const normRole = (role || '').toLowerCase();
  const audiences = ['all', 'All'];

  if (normRole === 'org-president') {
    audiences.push('all-orgs', 'org-president');
    const trimmed = orgName.trim();
    if (trimmed) audiences.push(`org:${trimmed}`);
  } else if (normRole === 'oso-staff') {
    audiences.push('oso-staff');
  } else if (normRole === 'sds-coordinator') {
    audiences.push('sds-coordinator');
  } else if (normRole === 'chairman') {
    audiences.push('chairman', 'oso-staff');
  } else if (normRole === 'vice-chairman') {
    audiences.push('vice-chairman', 'oso-staff');
  } else if (normRole === 'admin') {
    audiences.push('admin', 'oso-staff', 'sds-coordinator', 'chairman', 'vice-chairman', 'all-orgs', 'org-president');
  }

  return Array.from(new Set(audiences));
}

async function getDefaultAdminUserId(supabase: ReturnType<typeof getAdminClient>): Promise<string | null> {
  const { data: adminUser } = await supabase
    .from('users')
    .select('id')
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle();

  if (adminUser?.id) return adminUser.id;

  const { data: fallbackUser } = await supabase
    .from('users')
    .select('id')
    .limit(1)
    .maybeSingle();

  return fallbackUser?.id || null;
}

async function syncSubmissionWindowAnnouncements(supabase: ReturnType<typeof getAdminClient>) {
  try {
    const { data: activeSy } = await supabase.from('school_years').select('id').eq('is_active', true).maybeSingle();
    if (!activeSy) return;

    const { data: windows } = await supabase
      .from('academic_calendar_events')
      .select('*')
      .eq('school_year_id', activeSy.id)
      .eq('event_type', 'submission_window');

    if (!windows || windows.length === 0) return;

    const adminUserId = await getDefaultAdminUserId(supabase);

    const now = new Date();
    const oneDayMs = 24 * 60 * 60 * 1000;

    for (const w of windows) {
      const windowTitle = w.title || 'Document Submission';
      const openTitle = `📢 Submission Window Opened: ${windowTitle}`;
      const startDate = w.start_date ? new Date(w.start_date) : null;
      const endDate = w.end_date ? new Date(w.end_date) : null;
      const startFormatted = startDate ? startDate.toLocaleDateString() : '';
      const endFormatted = endDate ? endDate.toLocaleDateString() : '';

      // 1. Persist OPEN announcement if window is open
      const isOpen = (!startDate || now >= startDate) && (!endDate || now <= endDate);
      if (isOpen) {
        const { data: existingOpen } = await supabase
          .from('announcements')
          .select('id')
          .eq('title', openTitle)
          .maybeSingle();

        if (!existingOpen) {
          const openContent = `The submission window for ${windowTitle} is currently OPEN${startFormatted && endFormatted ? ` from ${startFormatted} to ${endFormatted}` : ''}. Organizations can submit required documents via the Submit New Document page.`;
          await supabase.from('announcements').insert([{
            title: openTitle,
            content: openContent,
            target_audience: 'all-orgs',
            is_active: true,
            created_by: adminUserId,
            created_at: w.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }]);
        }
      }

      // 2. Persist CLOSING SOON announcement if window closes within 24-36 hours
      if (endDate) {
        const diffMs = endDate.getTime() - now.getTime();
        if (diffMs > 0 && diffMs <= oneDayMs * 1.5) {
          const closingTitle = `⚠️ Submission Window Closing Soon: ${windowTitle}`;
          const { data: existingClosing } = await supabase
            .from('announcements')
            .select('id')
            .eq('title', closingTitle)
            .maybeSingle();

          if (!existingClosing) {
            const closingContent = `Notice: The submission window for ${windowTitle} will CLOSE on ${endDate.toLocaleDateString()} (within 24 hours). Please complete and submit all required documents immediately via the Submit New Document tab.`;
            await supabase.from('announcements').insert([{
              title: closingTitle,
              content: closingContent,
              target_audience: 'all-orgs',
              is_active: true,
              created_by: adminUserId,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }]);
          }
        }
      }
    }
  } catch (e) {
    console.error('Error syncing submission window announcements:', e);
  }
}

async function fetchActiveAnnouncements(
  supabase: ReturnType<typeof getAdminClient>,
  role: string,
  orgName = '',
  limit = 10,
) {
  await syncSubmissionWindowAnnouncements(supabase);

  const audiences = getAnnouncementAudiences(role, orgName);
  if (audiences.length === 0) return [];

  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .in('target_audience', audiences)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Announcement fetch error:', error.message);
    return [];
  }

  return (data || []).filter((a) => a.is_active !== false);
}

async function checkAndDeactivateLateUsers() {
  const supabase = getAdminClient();

  // 1. Get the active school year
  const { data: activeSy } = await supabase
    .from('school_years')
    .select('*')
    .eq('is_active', true)
    .maybeSingle();

  if (!activeSy) return;

  // 2. Get the Mid-Year Report document type details
  const { data: midYearDoc } = await supabase
    .from('documentType')
    .select('*')
    .eq('id', 'bcd8f528-5638-496a-af4d-51391cb234d5')
    .maybeSingle();

  if (!midYearDoc || midYearDoc.status !== 'active' || midYearDoc.availability_type !== 'scheduled') {
    return;
  }

  const activeUntil = midYearDoc.active_until;
  if (!activeUntil) return;

  const deadlineDate = new Date(activeUntil);
  const now = new Date();

  // If the deadline hasn't passed, do nothing
  if (now <= deadlineDate) return;

  // 3. Find all active org presidents
  const { data: activeOrgs, error: orgsError } = await supabase
    .from('users')
    .select('*')
    .eq('role', 'org-president')
    .eq('status', 'Active');

  if (orgsError || !activeOrgs || activeOrgs.length === 0) return;

  // 4. For each active org, check if they have a non-draft submission for the Mid-Year Report in the active school year
  for (const org of activeOrgs) {
    const { data: submissions, error: subError } = await supabase
      .from('submissions')
      .select('id')
      .eq('user_id', org.id)
      .eq('school_year_id', activeSy.id)
      .eq('document_type_id', midYearDoc.id)
      .neq('status', 'draft');

    if (subError) continue;

    // If no submissions found, they failed to submit on time! Turn status into 'Inactive'
    if (!submissions || submissions.length === 0) {
      console.log(`Deactivating user ${org.full_name} (${org.id}) due to missing Mid-Year Report by ${activeUntil}`);
      await supabase
        .from('users')
        .update({ status: 'Inactive' })
        .eq('id', org.id);
    }
  }
}

async function checkAndSuspendLateUsers() {
  const supabase = getAdminClient();
  const now = new Date();

  // 1. Get the active school year
  const { data: activeSy } = await supabase
    .from('school_years')
    .select('*')
    .eq('is_active', true)
    .maybeSingle();

  if (!activeSy) return;

  // 2. Get all org presidents who are currently Active or Inactive
  const { data: orgPresidents, error: orgsError } = await supabase
    .from('users')
    .select('*')
    .eq('role', 'org-president')
    .in('status', ['Active', 'Inactive']);

  if (orgsError || !orgPresidents || orgPresidents.length === 0) return;

  // Check Criteria 1: School Year End Date
  const syEndDate = activeSy.end_date ? new Date(activeSy.end_date) : null;
  const isSyEnded = syEndDate && now > syEndDate;

  // Check Criteria 2: Renewal Document Deadline
  const { data: renewalDoc } = await supabase
    .from('documentType')
    .select('*')
    .ilike('name', '%renewal%')
    .maybeSingle();

  const renewalDeadline = (renewalDoc && renewalDoc.availability_type === 'scheduled' && renewalDoc.active_until)
    ? new Date(renewalDoc.active_until)
    : null;
  const isRenewalDeadlinePassed = renewalDeadline && now > renewalDeadline;

  for (const org of orgPresidents) {
    let shouldSuspend = false;
    let reason = '';

    // Check 1: Proposals submission requirement (if SY has ended)
    if (isSyEnded) {
      const { data: subs, error: subsError } = await supabase
        .from('submissions')
        .select('id, documentType:document_type_id(name)')
        .eq('user_id', org.id)
        .eq('school_year_id', activeSy.id)
        .neq('status', 'draft');

      if (!subsError) {
        const submissionsList = subs || [];
        const hasProposal = submissionsList.some((sub: any) => {
          const name = sub.documentType?.name || '';
          return name.toLowerCase().includes('proposal');
        });
        if (!hasProposal) {
          shouldSuspend = true;
          reason = 'Suspended: Failed to submit at least 1 Activity Proposal before the end of the school year.';
        }
      }
    }

    // Check 2: Renewal submission requirement (if renewal window has closed)
    if (!shouldSuspend && isRenewalDeadlinePassed && renewalDoc) {
      const { data: renewalSubs, error: renewalError } = await supabase
        .from('submissions')
        .select('id')
        .eq('user_id', org.id)
        .eq('school_year_id', activeSy.id)
        .eq('document_type_id', renewalDoc.id)
        .neq('status', 'draft');

      if (!renewalError && (!renewalSubs || renewalSubs.length === 0)) {
        shouldSuspend = true;
        reason = 'Suspended: Failed to submit the Renewal Document before the deadline.';
      }
    }

    if (shouldSuspend && reason) {
      console.log(`Suspending user ${org.full_name} (${org.id}) due to: ${reason}`);
      await supabase
        .from('users')
        .update({ status: reason })
        .eq('id', org.id);
    }
  }
}

async function handleGetAdminEmail() {
  const supabase = getAdminClient();
  try {
    const { data: profiles, error: profileError } = await supabase
      .from('users')
      .select('id, role, contact_no')
      .eq('role', 'admin');

    if (profileError || !profiles || profiles.length === 0) {
      console.warn('Admin profile not found in users table:', profileError?.message);
      return jsonResponse({ email: null });
    }

    const profile = profiles[0];
    const { data: authUserData, error: authUserError } = await supabase.auth.admin.getUserById(profile.id);
    if (authUserError || !authUserData?.user) {
      console.warn('Admin auth user not found:', authUserError?.message);
      return jsonResponse({ email: profile.contact_no || null });
    }

    const authUser = authUserData.user;
    const email = authUser.email ||
      (authUser as any).Email ||
      authUser.user_metadata?.email ||
      authUser.user_metadata?.Email ||
      (authUser as any).user_metadata?.["Email"] ||
      (authUser as any).raw_user_meta_data?.email ||
      (authUser as any).raw_user_meta_data?.Email;

    if (email) {
      return jsonResponse({ email });
    }

    return jsonResponse({ email: profile.contact_no || null });
  } catch (err) {
    console.error('Error fetching admin email:', err);
    return jsonResponse({ email: null });
  }
}

async function cleanOrphanedOrganizations() {
  const supabase = getAdminClient();
  try {
    const { data: activeUsers } = await supabase
      .from('users')
      .select('id, organization_id, org_name, full_name, abbreviation');

    const { data: allOrgs } = await supabase
      .from('organizations')
      .select('id, name, abbreviation');

    if (!allOrgs || allOrgs.length === 0) return;

    const userOrgIds = new Set<string>();
    const userOrgNames = new Set<string>();
    const userOrgAbbrs = new Set<string>();

    (activeUsers || []).forEach((u: any) => {
      if (u.organization_id) userOrgIds.add(String(u.organization_id));
      if (u.org_name) userOrgNames.add(String(u.org_name).trim().toLowerCase());
      if (u.full_name) userOrgNames.add(String(u.full_name).trim().toLowerCase());
      if (u.abbreviation) userOrgAbbrs.add(String(u.abbreviation).trim().toLowerCase());
    });

    for (const org of allOrgs) {
      const oId = String(org.id);
      const oName = (org.name || '').trim().toLowerCase();
      const oAbbr = (org.abbreviation || '').trim().toLowerCase();

      const isLinkedById = userOrgIds.has(oId);
      const isLinkedByName = oName ? userOrgNames.has(oName) : false;
      const isLinkedByAbbr = oAbbr ? userOrgAbbrs.has(oAbbr) : false;

      if (!isLinkedById && !isLinkedByName && !isLinkedByAbbr) {
        console.log(`Auto-cleaning orphaned organization record: ${org.name} (${org.id})`);
        await supabase.from('organization_academic_years').delete().eq('organization_id', org.id);
        await supabase.from('users').update({ organization_id: null }).eq('organization_id', org.id);
        await supabase.from('organizations').delete().eq('id', org.id);
        if (org.name) await supabase.from('organizations').delete().ilike('name', org.name.trim());
        if (org.abbreviation) await supabase.from('organizations').delete().ilike('abbreviation', org.abbreviation.trim());
      }
    }
  } catch (err) {
    console.error('Error auto-cleaning orphaned organizations:', err);
  }
}

async function handleGetUsers() {
  const supabase = getAdminClient();

  // Automatically check and deactivate/suspend organizations that missed deadlines & clean orphaned orgs
  try {
    await checkAndDeactivateLateUsers();
    await checkAndSuspendLateUsers();
    await cleanOrphanedOrganizations();
  } catch (err) {
    console.error('Error running automated status checks:', err);
  }

  const { data, error } = await supabase.from('users').select('*');
  if (error) {
    return jsonResponse({ error: 'Failed to fetch users', details: error.message }, 500);
  }

  const { data: submissionRecords } = await supabase
    .from('submissions')
    .select('user_id, organization_id')
    .limit(10000);

  const { data: logRecords } = await supabase
    .from('submission_logs')
    .select('user_id')
    .limit(10000);

  const usersWithSubmissions = new Set<string>();
  (submissionRecords || []).forEach((s: any) => {
    if (s.user_id) usersWithSubmissions.add(String(s.user_id));
    if (s.organization_id) usersWithSubmissions.add(String(s.organization_id));
  });
  (logRecords || []).forEach((l: any) => {
    if (l.user_id) usersWithSubmissions.add(String(l.user_id));
  });

  const emailMap = await getAuthEmailsMap();
  const enriched = (data || []).map((u) => ({
    ...u,
    email: emailMap.get(u.id) || null,
    has_submissions: usersWithSubmissions.has(String(u.id)) || (u.organization_id ? usersWithSubmissions.has(String(u.organization_id)) : false),
  }));
  return jsonResponse(enriched);
}

async function handleGetUserDetail(id: string, url?: URL) {
  const supabase = getAdminClient();
  const reqSyId = url ? url.searchParams.get('syId') : null;

  const { data: user, error } = await supabase.from('users').select('*').eq('id', id).single();
  if (error || !user) {
    return jsonResponse({ error: 'User not found' }, 404);
  }

  const orgId = user.organization_id;
  const { data: submissionRecords } = await supabase
    .from('submissions')
    .select('id')
    .or(`user_id.eq.${id}${orgId ? `,organization_id.eq.${orgId}` : ''}`)
    .limit(1);

  const hasSubmissions = (submissionRecords && submissionRecords.length > 0) || false;
  user.has_submissions = hasSubmissions;

  let email = null;
  try {
    const { data: authUser } = await supabase.auth.admin.getUserById(id);
    email = authUser?.user?.email || null;
  } catch (err) {
    console.error('Error fetching auth user by id:', err);
  }

  let targetSy: any = null;
  if (reqSyId) {
    const { data: sy } = await supabase
      .from('school_years')
      .select('*')
      .eq('id', reqSyId)
      .maybeSingle();
    targetSy = sy;
  }
  if (!targetSy) {
    const { data: activeSy } = await supabase
      .from('school_years')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();
    targetSy = activeSy;
  }

  if (user.role === 'org-president' && targetSy?.id && user.organization_id) {
    const { data: snap } = await supabase
      .from('organization_academic_years')
      .select('*')
      .eq('organization_id', user.organization_id)
      .eq('school_year_id', targetSy.id)
      .maybeSingle();

    if (snap) {
      user.full_name = snap.president_name || user.full_name;
      user.student_no = snap.student_no ?? user.student_no;
      user.contact_no = snap.contact_no ?? user.contact_no;
      user.adviser_name = snap.adviser_name ?? user.adviser_name;
      user.co_advisers = snap.co_advisers ?? user.co_advisers;
      user.no_member = snap.no_member ?? user.no_member;
    }
  }

  let submissions: Array<Record<string, unknown>> = [];
  let activityHistory: Array<Record<string, unknown>> = [];
  let reviewedDocuments: Array<Record<string, unknown>> = [];

  const formatDocumentLog = (doc: Record<string, unknown>) => {
    let docTitle = `Submission #${String(doc.id).substring(0, 6).toUpperCase()}`;
    const versions = doc.submission_versions as Array<Record<string, unknown>> | undefined;
    let venue = '-';
    let personInCharge = '-';
    let contactNumber = '-';
    const trackingNumber = (doc.tracking_number as string) || `REF-${String(doc.id).substring(0, 6).toUpperCase()}`;

    if (versions && versions.length > 0) {
      const latest = versions.reduce((max, v) =>
        (v.version_number as number) > (max.version_number as number) ? v : max,
        versions[0]);
      const details = Array.isArray(latest.activity_proposal_details)
        ? latest.activity_proposal_details[0]
        : latest.activity_proposal_details;
      if (details) {
        const detObj = details as Record<string, unknown>;
        if (detObj.activity_title) {
          docTitle = detObj.activity_title as string;
        } else {
          docTitle = `${(doc.documentType as Record<string, unknown>)?.name || 'Document'} #${String(doc.id).substring(0, 6).toUpperCase()}`;
        }
        if (detObj.target_venue) venue = detObj.target_venue as string;
        if (detObj.person_in_charge) personInCharge = detObj.person_in_charge as string;
        if (detObj.contact_number) contactNumber = detObj.contact_number as string;
      }
    }

    const status = String(doc.status || '').toLowerCase();
    let displayStatus = 'Pending';
    if (status === 'completed' || status === 'approved' || status === 'waiting for accomplishment report' || status === 'ready for retrieval' || status === 'dean approved') displayStatus = 'Completed';
    else if (status === 'disapproved') displayStatus = 'Disapproved';
    else if (status === 'returned') displayStatus = 'Returned';
    else if (status === 'submitted' || status === 'pending') displayStatus = 'OSO Staff Review';
    else if (status === 'oso approved' || status === 'sds coordinator review') displayStatus = 'SDS Coordinator Review';
    else if (status === 'sds approved' || status === 'chairman approved') displayStatus = 'Chairman Review';
    else if (status === 'vice chairman approved' || status === 'main campus review') displayStatus = 'Main Campus Review';
    else if (status === 'external approved' || status === 'dean review') displayStatus = 'Dean Review';
    else if (status === 'to forward' || status.includes('hardcopy')) displayStatus = 'Pending Hard Copy';

    return {
      id: doc.id,
      trackingNumber,
      title: docTitle,
      type: (doc.documentType as Record<string, unknown>)?.name || 'Unknown',
      dateSubmitted: doc.created_at,
      status: displayStatus,
      rawStatus: doc.status,
      venue,
      personInCharge,
      contactNumber,
    };
  };

  if (user.role === 'org-president') {
    const { data: subs } = await supabase
      .from('submissions')
      .select(
        'id, tracking_number, status, created_at, school_year_id, documentType:document_type_id(name), submission_versions!submission_versions_submission_id_fkey(version_number, activity_proposal_details(activity_title, target_venue, person_in_charge, contact_number))',
      )
      .eq('user_id', id)
      .neq('status', 'draft')
      .order('created_at', { ascending: false });
    submissions = subs || [];

    const currentSySubmissions = targetSy
      ? submissions.filter((s) => !s.school_year_id || s.school_year_id === targetSy.id)
      : submissions;

    let logsQuery = supabase
      .from('submission_logs')
      .select('*, submissions(tracking_number, school_year_id, documentType:document_type_id(name), submission_versions!submission_versions_submission_id_fkey(version_number, activity_proposal_details(activity_title)))')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(50);

    const { data: logs } = await logsQuery;
    activityHistory = (logs || [])
      .filter((log) => {
        const sub = log.submissions as Record<string, unknown> | null;
        return !targetSy || !sub?.school_year_id || sub.school_year_id === targetSy.id;
      })
      .map((log) => {
        const sub = log.submissions as Record<string, unknown> | null;
        let docTitle = null;
        if (sub) {
          const versions = sub.submission_versions as Array<Record<string, unknown>> | undefined;
          if (versions && versions.length > 0) {
            const latest = versions.reduce(
              (max, v) => ((v.version_number as number) > (max.version_number as number) ? v : max),
              versions[0],
            );
            const details = Array.isArray(latest.activity_proposal_details)
              ? latest.activity_proposal_details[0]
              : latest.activity_proposal_details;
            if (details && (details as Record<string, unknown>).activity_title) {
              docTitle = (details as Record<string, unknown>).activity_title as string;
            }
          }
          if (!docTitle) {
            docTitle = (sub.documentType as Record<string, unknown>)?.name as string || null;
          }
        }
        return {
          ...log,
          docTitle,
          trackingNumber: sub?.tracking_number || null,
        };
      });

    let hasMidYear = false;
    let hasYearEnd = false;
    if (targetSy && submissions) {
      submissions.forEach((sub) => {
        if (sub.status === 'completed' && sub.school_year_id === targetSy.id) {
          const docName = (sub.documentType as Record<string, unknown>)?.name;
          const name = typeof docName === 'string' ? docName.toLowerCase() : '';
          if (name.includes('mid-year') || name.includes('mid year')) hasMidYear = true;
          if (name.includes('year-end') || name.includes('year end')) hasYearEnd = true;
        }
      });
    }

    const pendingReviewCount = (submissions || []).filter((s) => {
      const status = String(s.status || '').toLowerCase().trim();
      return !['completed', 'disapproved', 'rejected', 'approved', 'ready for retrieval', 'document retrieval', 'waiting for accomplishment report', 'ready for org pickup', 'draft'].includes(status);
    }).length;

    const documentLogs = currentSySubmissions.map(formatDocumentLog);

    return jsonResponse({
      success: true,
      data: {
        user: { ...user, email },
        documentLogs,
        activityHistory,
        pendingReviewCount,
        renewal: {
          isEligible: hasMidYear && hasYearEnd,
          hasMidYear,
          hasYearEnd,
        },
        activeSchoolYear: targetSy,
      },
    });
  } else {
    const submissionSelect =
      'id, tracking_number, status, created_at, school_year_id, documentType:document_type_id(name), submission_versions!submission_versions_submission_id_fkey(version_number, activity_proposal_details(activity_title, target_venue, person_in_charge, contact_number))';

    // 1. Fetch submission logs created by this user to identify documents they actually acted on
    const { data: userLogs } = await supabase
      .from('submission_logs')
      .select(`id, action_type, description, created_at, submission_id, submissions(${submissionSelect})`)
      .eq('user_id', id)
      .order('created_at', { ascending: false });

    // Helper to check if document status is still pending initial staff review / unreviewed
    const isUnreviewedStatus = (statusStr: unknown) => {
      const s = String(statusStr || '').toLowerCase().trim();
      return (
        s === 'submitted' ||
        s === 'pending' ||
        s === 'oso staff review' ||
        s === 'draft'
      );
    };

    // Extract unique submissions that THIS user has taken action on AND is not currently pending initial staff review
    const reviewedMap = new Map<string, Record<string, unknown>>();
    (userLogs || []).forEach((log) => {
      const sub = log.submissions as Record<string, unknown> | null;
      if (sub && sub.id) {
        const matchesSy = !targetSy || !sub.school_year_id || sub.school_year_id === targetSy.id;
        const rawStatus = sub.status;
        if (matchesSy && !isUnreviewedStatus(rawStatus) && !reviewedMap.has(String(sub.id))) {
          reviewedMap.set(String(sub.id), sub);
        }
      }
    });

    reviewedDocuments = Array.from(reviewedMap.values()).map(formatDocumentLog);

    // 2. Build Activity History for THIS user's actions
    activityHistory = (userLogs || [])
      .filter((log) => {
        const sub = log.submissions as Record<string, unknown> | null;
        return !targetSy || !sub?.school_year_id || sub.school_year_id === targetSy.id;
      })
      .map((log) => {
        const sub = log.submissions as Record<string, unknown> | null;
        let docTitle = null;
        if (sub) {
          const versions = sub.submission_versions as Array<Record<string, unknown>> | undefined;
          if (versions && versions.length > 0) {
            const latest = versions.reduce(
              (max, v) => ((v.version_number as number) > (max.version_number as number) ? v : max),
              versions[0],
            );
            const details = Array.isArray(latest.activity_proposal_details)
              ? latest.activity_proposal_details[0]
              : latest.activity_proposal_details;
            if (details && (details as Record<string, unknown>).activity_title) {
              docTitle = (details as Record<string, unknown>).activity_title as string;
            }
          }
          if (!docTitle) {
            docTitle = (sub.documentType as Record<string, unknown>)?.name as string || null;
          }
        }
        return {
          ...log,
          docTitle,
          trackingNumber: sub?.tracking_number || null,
        };
      });

    return jsonResponse({
      success: true,
      data: {
        user: { ...user, email },
        documentLogs: reviewedDocuments,
        activityHistory,
        pendingReviewCount: reviewedDocuments.length,
        activeSchoolYear: targetSy,
      },
    });
  }
}

async function sendBrevoEmail({
  toEmail,
  toName,
  subject,
  htmlContent,
}: {
  toEmail: string;
  toName: string;
  subject: string;
  htmlContent: string;
}) {
  const brevoApiKey = Deno.env.get('BREVO_API_KEY') || Deno.env.get('SIB_API_KEY') || '';
  if (!brevoApiKey) {
    console.warn('BREVO_API_KEY / SIB_API_KEY is not set. Email notification skipped.');
    return { success: false, reason: 'Brevo API key not configured' };
  }

  const senderEmail = Deno.env.get('BREVO_SENDER_EMAIL') || 'osodocsbulsu@gmail.com';
  const senderName = Deno.env.get('BREVO_SENDER_NAME') || 'OSOADOCS Admin';

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': brevoApiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email: toEmail, name: toName }],
        subject,
        htmlContent,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Brevo API send error:', errText);
      return { success: false, error: errText };
    }

    return { success: true };
  } catch (err) {
    console.error('Brevo fetch error:', err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function createAndSendInvitationToken(
  supabase: ReturnType<typeof getAdminClient>,
  userId: string,
  email: string,
  fullName: string,
  orgName?: string | null,
  appOrigin?: string,
  role?: string | null
) {
  const token = crypto.randomUUID().replace(/-/g, '') + Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

  // 1. Invalidate previous pending invitations for this user
  await supabase
    .from('account_invitations')
    .update({ is_invalidated: true, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('is_used', false);

  // 2. Insert new invitation token record
  const { error: insErr } = await supabase
    .from('account_invitations')
    .insert([
      {
        user_id: userId,
        email,
        token,
        expires_at: expiresAt,
        is_used: false,
        is_invalidated: false,
      },
    ]);

  if (insErr) {
    console.error('Failed to create account_invitations record:', insErr.message);
    return { success: false, error: insErr.message };
  }

  // 3. Construct setup link
  const origin = appOrigin ? appOrigin.replace(/\/$/, '') : 'http://localhost:5173';
  const setupUrl = `${origin}/setup-account?token=${token}`;
  const isOrg = role === 'org-president';
  const displayName = isOrg ? (orgName || fullName || 'Organization') : (fullName || 'Personnel');
  const accountTypeLabel = isOrg ? 'Organization' : 'OSO Personnel';
  const subject = `Set Up Your OSOADOCS ${accountTypeLabel} Account`;

  // 4. Render Email HTML
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>OSOADOCS - Account Invitation</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f6f8; margin: 0; padding: 0; color: #333; }
        .container { max-width: 600px; margin: 30px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
        .header { background-color: #073c2d; padding: 30px 20px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 0.5px; }
        .header p { margin: 6px 0 0 0; font-size: 14px; opacity: 0.85; }
        .content { padding: 35px 30px; line-height: 1.6; }
        .greeting { font-size: 18px; font-weight: 600; color: #073c2d; margin-bottom: 16px; }
        .button-wrapper { text-align: center; margin: 35px 0; }
        .btn { background-color: #073c2d; color: #ffffff !important; padding: 14px 32px; text-decoration: none; font-weight: 700; font-size: 15px; border-radius: 12px; display: inline-block; box-shadow: 0 4px 12px rgba(7,60,45,0.25); }
        .info-box { background-color: #f8faf9; border-left: 4px solid #073c2d; padding: 16px; border-radius: 8px; margin: 24px 0; font-size: 13px; color: #555; }
        .footer { background-color: #f4f6f8; padding: 20px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #eef0f2; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>OSOADOCS</h1>
          <p>Office of Student Organizations and Activities</p>
        </div>
        <div class="content">
          <div class="greeting">Welcome, ${displayName}!</div>
          <p>An official ${accountTypeLabel} account has been created for you on OSOADOCS by the System Administrator.</p>
          <p>To complete your registration and activate your account, please set up your password using the link below:</p>
          
          <div class="button-wrapper">
            <a href="${setupUrl}" class="btn" target="_blank">Set Up Account</a>
          </div>

          <div class="info-box">
            <strong>Security Notice:</strong>
            <ul style="margin: 6px 0 0 0; padding-left: 18px;">
              <li>This invitation link is valid for <strong>24 hours</strong>.</li>
              <li>This link is single-use and will expire once your password is set.</li>
              <li>If the link expires, you can request a new invitation link on the setup page.</li>
            </ul>
          </div>

          <p style="font-size: 13px; color: #777;">If you did not request this invitation, please disregard this email or contact the OSO Administrator.</p>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} Bulacan State University - Office of Student Organizations and Activities. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;

  const emailRes = await sendBrevoEmail({
    toEmail: email,
    toName: displayName,
    subject,
    htmlContent,
  });

  return { success: true, token, emailSent: emailRes.success };
}

async function handleVerifyInvitation(url: URL) {
  const token = url.searchParams.get('token');
  if (!token) {
    return jsonResponse({ valid: false, reason: 'Invitation token is missing.' }, 400);
  }

  const supabase = getAdminClient();
  const { data: inv, error } = await supabase
    .from('account_invitations')
    .select('*')
    .eq('token', token)
    .maybeSingle();

  if (error) {
    console.error('Error verifying invitation token:', error.message);
    return jsonResponse({ valid: false, reason: `Database error: ${error.message}` });
  }

  if (!inv) {
    return jsonResponse({ valid: false, reason: 'Invalid or non-existent invitation token.' });
  }

  if (inv.is_used) {
    return jsonResponse({ valid: false, reason: 'This invitation link has already been used.' });
  }

  if (inv.is_invalidated) {
    return jsonResponse({ valid: false, reason: 'This invitation link has been invalidated by a newer request.' });
  }

  const expiresAt = new Date(inv.expires_at).getTime();
  if (Date.now() > expiresAt) {
    return jsonResponse({ valid: false, reason: 'This invitation link has expired (valid for 24 hours).' });
  }

  const { data: userRec } = await supabase
    .from('users')
    .select('full_name, org_name, role, status')
    .eq('id', inv.user_id)
    .maybeSingle();

  return jsonResponse({
    valid: true,
    email: inv.email,
    userId: inv.user_id,
    orgName: userRec?.org_name || userRec?.full_name || 'Organization',
  });
}

async function handleSetupPassword(body: Record<string, unknown>) {
  const token = String(body.token || '').trim();
  const password = String(body.password || '').trim();

  if (!token || !password) {
    return jsonResponse({ error: 'Token and new password are required' }, 400);
  }

  if (password.length < 6) {
    return jsonResponse({ error: 'Password must be at least 6 characters long' }, 400);
  }

  const supabase = getAdminClient();
  const { data: inv, error } = await supabase
    .from('account_invitations')
    .select('*')
    .eq('token', token)
    .maybeSingle();

  if (error || !inv) {
    return jsonResponse({ error: 'Invalid or non-existent invitation token' }, 404);
  }

  if (inv.is_used) {
    return jsonResponse({ error: 'This invitation link has already been used.' }, 400);
  }

  if (inv.is_invalidated) {
    return jsonResponse({ error: 'This invitation link has been invalidated.' }, 400);
  }

  if (Date.now() > new Date(inv.expires_at).getTime()) {
    return jsonResponse({ error: 'This invitation link has expired.' }, 400);
  }

  // Update password in Supabase Auth
  const { error: authErr } = await supabase.auth.admin.updateUserById(inv.user_id, {
    password,
  });

  if (authErr) {
    return jsonResponse({ error: 'Failed to set password: ' + authErr.message }, 500);
  }

  // Update user status to 'Active'
  await supabase
    .from('users')
    .update({ status: 'Active' })
    .eq('id', inv.user_id);

  // Mark token as used
  await supabase
    .from('account_invitations')
    .update({
      is_used: true,
      used_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', inv.id);

  return jsonResponse({
    success: true,
    email: inv.email,
    userId: inv.user_id,
    message: 'Password created successfully! You can now access your Organization Dashboard.',
  });
}

async function handleRequestNewInvitation(body: Record<string, unknown>, req: Request) {
  const email = String(body.email || '').trim().toLowerCase();
  const appOrigin = (body.appOrigin as string) || req.headers.get('origin') || req.headers.get('referer') || 'http://localhost:5173';

  if (!email) {
    return jsonResponse({ error: 'Email address is required' }, 400);
  }

  const supabase = getAdminClient();

  const emailMap = await getAuthEmailsMap();
  let targetUserId: string | null = null;
  for (const [uid, uemail] of emailMap.entries()) {
    if (uemail.toLowerCase() === email) {
      targetUserId = uid;
      break;
    }
  }

  if (!targetUserId) {
    const { data: dbUser } = await supabase
      .from('users')
      .select('id, full_name, org_name, role')
      .eq('email', email)
      .maybeSingle();
    if (dbUser) targetUserId = dbUser.id;
  }

  if (!targetUserId) {
    return jsonResponse({
      success: true,
      message: 'If an Organization account exists for this email, a new setup link has been sent.',
    });
  }

  const { data: userRec } = await supabase
    .from('users')
    .select('id, full_name, org_name, role')
    .eq('id', targetUserId)
    .maybeSingle();

  if (userRec) {
    await createAndSendInvitationToken(
      supabase,
      userRec.id,
      email,
      userRec.full_name,
      userRec.org_name,
      appOrigin,
      userRec.role
    );
  }

  return jsonResponse({
    success: true,
    message: 'If an account exists for this email, a new setup link has been sent.',
  });
}

async function handleResendInvitation(body: Record<string, unknown>, req: Request) {
  const userId = String(body.userId || '').trim();
  const appOrigin = (body.appOrigin as string) || req.headers.get('origin') || req.headers.get('referer') || 'http://localhost:5173';

  if (!userId) {
    return jsonResponse({ error: 'userId is required' }, 400);
  }

  const supabase = getAdminClient();
  const { data: userRec, error: userErr } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (userErr || !userRec) {
    return jsonResponse({ error: 'User not found' }, 404);
  }

  const { data: authUser } = await supabase.auth.admin.getUserById(userId);
  const email = authUser?.user?.email || userRec.email;

  if (!email) {
    return jsonResponse({ error: 'User email not found' }, 400);
  }

  const result = await createAndSendInvitationToken(
    supabase,
    userId,
    email,
    userRec.full_name,
    userRec.org_name,
    appOrigin,
    userRec.role
  );

  if (!result.success) {
    return jsonResponse({ error: 'Failed to generate invitation: ' + result.error }, 500);
  }

  return jsonResponse({
    success: true,
    message: `Invitation email sent to ${email} via Brevo!`,
  });
}

async function handlePostUsers(body: Record<string, unknown>, req?: Request) {
  const supabase = getAdminClient();
  const {
    full_name,
    role,
    status,
    profile_image,
    email,
    password,
    org_name,
    abbreviation,
    no_member,
    adviser_name,
    co_advisers,
    joined_date,
    contact_no,
    student_no,
    appOrigin,
  } = body as Record<string, string | null | undefined | string[]>;

  const isOrg = role === 'org-president';

  if (!full_name || !role || !email) {
    return jsonResponse({ error: 'Full name, role, and email are required' }, 400);
  }

  const targetAbbr = (abbreviation || '').trim();

  // Pre-validate duplicate Organization Name and Abbreviation if role is org-president or abbreviation provided
  if (isOrg) {
    const targetOrgName = (org_name || full_name || '').trim();
    if (targetOrgName) {
      const { data: existingUsers } = await supabase.from('users').select('id, org_name, full_name, organization_id');
      const activeUserOrg = (existingUsers || []).find((u: any) => {
        const uOrg = (u.org_name || '').trim().toLowerCase();
        const uFull = (u.full_name || '').trim().toLowerCase();
        return uOrg === targetOrgName.toLowerCase() || uFull === targetOrgName.toLowerCase();
      });

      if (activeUserOrg) {
        return jsonResponse({ error: `An organization account named "${targetOrgName}" already exists. Duplicate organization names are not allowed.` }, 400);
      }

      const { data: existingOrgRecs } = await supabase.from('organizations').select('id, name');
      const matchedOrgRec = (existingOrgRecs || []).find((o: any) => (o.name || '').trim().toLowerCase() === targetOrgName.toLowerCase());

      if (matchedOrgRec) {
        const linkedUser = (existingUsers || []).find((u: any) => u.organization_id === matchedOrgRec.id);
        if (linkedUser) {
          return jsonResponse({ error: `An organization named "${targetOrgName}" already exists. Duplicate organization names are not allowed.` }, 400);
        } else {
          console.log(`Cleaning up orphaned organization record ${matchedOrgRec.id} (${matchedOrgRec.name})`);
          await supabase.from('organization_academic_years').delete().eq('organization_id', matchedOrgRec.id);
          await supabase.from('organizations').delete().eq('id', matchedOrgRec.id);
          await supabase.from('organizations').delete().ilike('name', targetOrgName);
        }
      }
    }
  }

  if (targetAbbr) {
    const { data: existingUsers } = await supabase.from('users').select('id, abbreviation, organization_id');
    const activeUserAbbr = (existingUsers || []).find((u: any) => (u.abbreviation || '').trim().toLowerCase() === targetAbbr.toLowerCase());

    if (activeUserAbbr) {
      return jsonResponse({ error: `An organization with the abbreviation "${targetAbbr}" already exists. Duplicate abbreviations are not allowed.` }, 400);
    }

    const { data: existingOrgAbbrs } = await supabase.from('organizations').select('id, abbreviation');
    const matchedOrgAbbr = (existingOrgAbbrs || []).find((o: any) => (o.abbreviation || '').trim().toLowerCase() === targetAbbr.toLowerCase());

    if (matchedOrgAbbr) {
      const linkedUser = (existingUsers || []).find((u: any) => u.organization_id === matchedOrgAbbr.id);
      if (linkedUser) {
        return jsonResponse({ error: `An organization with the abbreviation "${targetAbbr}" already exists. Duplicate abbreviations are not allowed.` }, 400);
      } else {
        console.log(`Cleaning up orphaned organization record ${matchedOrgAbbr.id} (${matchedOrgAbbr.abbreviation})`);
        await supabase.from('organization_academic_years').delete().eq('organization_id', matchedOrgAbbr.id);
        await supabase.from('organizations').delete().eq('id', matchedOrgAbbr.id);
        await supabase.from('organizations').delete().ilike('abbreviation', targetAbbr);
      }
    }
  }

  // Generate secure temporary password for auth account creation (user will set real password via invitation link)
  const authPassword = password || (crypto.randomUUID() + 'A1!@#');

  let authData: any = null;
  const { data: createdAuth, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: authPassword,
    email_confirm: true,
  });

  if (authError) {
    const errLower = authError.message.toLowerCase();
    if (errLower.includes('already') || errLower.includes('exists') || errLower.includes('registered')) {
      // Check if existing auth user has an active profile in users table
      const emailMap = await getAuthEmailsMap();
      let existingAuthId: string | null = null;
      for (const [uid, uemail] of emailMap.entries()) {
        if (uemail.toLowerCase() === email.toLowerCase()) {
          existingAuthId = uid;
          break;
        }
      }

      if (existingAuthId) {
        const { data: existingProfile } = await supabase
          .from('users')
          .select('id')
          .eq('id', existingAuthId)
          .maybeSingle();

        if (!existingProfile) {
          console.log(`Cleaning up orphaned auth user ${existingAuthId} for email ${email}`);
          await supabase.auth.admin.deleteUser(existingAuthId);

          const { data: retryAuth, error: retryErr } = await supabase.auth.admin.createUser({
            email,
            password: authPassword,
            email_confirm: true,
          });

          if (retryErr) {
            return jsonResponse({ error: 'User registration error: ' + retryErr.message }, 400);
          }
          authData = retryAuth;
        } else {
          return jsonResponse({ error: 'An active user account with this email address already exists in the system.' }, 400);
        }
      } else {
        return jsonResponse({ error: authError.message }, 400);
      }
    } else {
      return jsonResponse({ error: authError.message }, 500);
    }
  } else {
    authData = createdAuth;
  }

  let organizationId: string | null = null;
  const nowIso = new Date().toISOString();

  if (isOrg) {
    const targetOrgName = (org_name || full_name || '').trim();

    const { data: orgData, error: orgErr } = await supabase
      .from('organizations')
      .insert([
        {
          name: targetOrgName,
          abbreviation: targetAbbr || null,
          created_at: nowIso,
          updated_at: nowIso,
        },
      ])
      .select();

    if (orgErr) {
      console.error('Failed to create organization record:', orgErr.message);
      await supabase.auth.admin.deleteUser(authData.user.id);
      return jsonResponse({ error: `An organization named "${targetOrgName}" already exists or could not be created: ${orgErr.message}`, details: orgErr.message }, 400);
    }

    if (orgData?.[0]?.id) {
      organizationId = orgData[0].id;
    }
  }

  const defaultStatus = 'Pending Setup';

  const userPayload: Record<string, unknown> = {
    id: authData.user.id,
    full_name,
    role,
    status: status || defaultStatus,
    profile_image: profile_image || null,
    org_name: org_name || null,
    abbreviation: targetAbbr || null,
    no_member: no_member || null,
    adviser_name: adviser_name || null,
    co_advisers: co_advisers || [],
    joined_date: joined_date || null,
    contact_no: contact_no != null && contact_no !== '' ? String(contact_no) : null,
    student_no: student_no || null,
    created_at: nowIso,
  };

  if (isOrg && organizationId) {
    userPayload.organization_id = organizationId;
  }

  const { data: profileData, error: profileError } = await supabase
    .from('users')
    .insert([userPayload])
    .select();

  if (profileError) {
    console.error('Failed to create user profile:', profileError.message);
    if (organizationId) {
      await supabase.from('organizations').delete().eq('id', organizationId);
    }
    await supabase.auth.admin.deleteUser(authData.user.id);
    return jsonResponse({ error: `Failed to create user profile: ${profileError.message}`, details: profileError.message }, 500);
  }

  if (isOrg) {
    const { data: activeSy } = await supabase
      .from('school_years')
      .select('id')
      .eq('is_active', true)
      .maybeSingle();

    const currentSyId = activeSy?.id;
    if (currentSyId) {
      const targetOrgId = organizationId || authData.user.id;
      const { error: ayInsErr } = await supabase
        .from('organization_academic_years')
        .insert([
          {
            organization_id: targetOrgId,
            school_year_id: currentSyId,
            status: 'active',
            president_name: full_name,
            student_no: student_no || null,
            contact_no: contact_no != null && contact_no !== '' ? String(contact_no) : null,
            adviser_name: adviser_name || null,
            co_advisers: co_advisers || [],
            no_member: no_member ? Number(no_member) : 0,
            created_at: nowIso,
            updated_at: nowIso,
          },
        ]);
      if (ayInsErr) {
        console.warn('Failed to insert initial organization_academic_years record:', ayInsErr.message);
      }
    }
  }

  // Generate & send Brevo Invitation to recipient (Org or Personnel)
  const origin = (appOrigin as string) || (req ? (req.headers.get('origin') || req.headers.get('referer')) : null) || 'http://localhost:5173';
  await createAndSendInvitationToken(
    supabase,
    authData.user.id,
    email,
    full_name,
    org_name,
    origin,
    role
  );

  return jsonResponse({ success: true, user: profileData?.[0], isOrgInvitation: true });
}

async function handlePutUsers(id: string, body: Record<string, unknown>) {
  const supabase = getAdminClient();
  const {
    full_name,
    role,
    status,
    profile_image,
    org_name,
    abbreviation,
    no_member,
    adviser_name,
    co_advisers,
    joined_date,
    contact_no,
    student_no,
    email,
    school_year_id,
  } = body as Record<string, string | null | undefined | string[]>;

  const { data: existingUser, error: existingError } = await supabase
    .from('users')
    .select('profile_image, organization_id, role, abbreviation, org_name')
    .eq('id', id)
    .maybeSingle();

  if (existingError) {
    return jsonResponse({ error: 'Failed to load user profile', details: existingError.message }, 500);
  }

  if (email) {
    const { error: authError } = await supabase.auth.admin.updateUserById(id, { email });
    if (authError) {
      console.warn('Failed to update auth email:', authError.message);
    }
  }

  let targetAbbr: string | null = null;
  if (abbreviation !== undefined) {
    const trimmedAbbr = String(abbreviation || '').trim();
    if (trimmedAbbr) {
      const { data: existingUserAbbr } = await supabase
        .from('users')
        .select('id, abbreviation')
        .ilike('abbreviation', trimmedAbbr)
        .neq('id', id)
        .maybeSingle();

      if (existingUserAbbr) {
        return jsonResponse({ error: `An organization with the abbreviation "${trimmedAbbr}" already exists. Duplicate abbreviations are not allowed.` }, 400);
      }

      const currentOrgId = existingUser?.organization_id;
      if (currentOrgId) {
        const { data: existingOrgAbbr } = await supabase
          .from('organizations')
          .select('id, abbreviation')
          .ilike('abbreviation', trimmedAbbr)
          .neq('id', currentOrgId)
          .maybeSingle();

        if (existingOrgAbbr) {
          return jsonResponse({ error: `An organization with the abbreviation "${trimmedAbbr}" already exists. Duplicate abbreviations are not allowed.` }, 400);
        }
      }

      targetAbbr = trimmedAbbr;
    }
  }

  const updatePayload: Record<string, unknown> = {
    full_name,
    role,
    status: status || 'Active',
    org_name: org_name || null,
    no_member: no_member || null,
    adviser_name: adviser_name || null,
    co_advisers: co_advisers || [],
    joined_date: joined_date || null,
    contact_no: contact_no != null && contact_no !== '' ? String(contact_no) : null,
    student_no: student_no || null,
  };

  if (abbreviation !== undefined) {
    updatePayload.abbreviation = targetAbbr;
  }

  if (profile_image !== undefined && profile_image !== null && profile_image !== '') {
    updatePayload.profile_image = profile_image;
  } else {
    updatePayload.profile_image = existingUser?.profile_image ?? null;
  }

  const { data, error } = await supabase
    .from('users')
    .update(updatePayload)
    .eq('id', id)
    .select();

  if (error) {
    return jsonResponse({ error: 'Failed to update user', details: error.message }, 500);
  }

  const isOrg = (role || existingUser?.role) === 'org-president';
  const orgId = existingUser?.organization_id || id;

  if (existingUser?.organization_id && abbreviation !== undefined) {
    await supabase
      .from('organizations')
      .update({ abbreviation: targetAbbr })
      .eq('id', existingUser.organization_id);
  }

  // Synchronize changes to organization_academic_years table for current/selected AY
  if (isOrg && orgId) {
    let targetSyId = school_year_id;
    if (!targetSyId) {
      const { data: activeSy } = await supabase
        .from('school_years')
        .select('id')
        .eq('is_active', true)
        .maybeSingle();
      targetSyId = activeSy?.id;
    }

    if (targetSyId) {
      await supabase
        .from('organization_academic_years')
        .update({
          president_name: full_name || null,
          adviser_name: adviser_name || null,
          co_advisers: co_advisers || [],
          no_member: no_member ? Number(no_member) : 0,
          student_no: student_no || null,
          contact_no: contact_no != null && contact_no !== '' ? String(contact_no) : null,
        })
        .eq('organization_id', orgId)
        .eq('school_year_id', targetSyId);
    }
  }

  return jsonResponse({ success: true, user: data?.[0] });
}

async function handleVerifyPassword(body: Record<string, unknown>) {
  const supabase = getAdminClient();
  const { adminEmail, adminPassword } = body as { adminEmail?: string; adminPassword?: string };

  if (!adminEmail || !adminPassword) {
    return jsonResponse({ error: 'Admin email and password are required' }, 400);
  }

  const { error: authError } = await supabase.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  });

  if (authError) {
    return jsonResponse({ error: 'Invalid admin credentials' }, 401);
  }

  return jsonResponse({ success: true, message: 'Password verified' });
}

async function handleDeleteUsers(id: string, body: Record<string, unknown>) {
  const supabase = getAdminClient();
  const { adminEmail, adminPassword } = body as { adminEmail?: string; adminPassword?: string };

  if (!adminEmail || !adminPassword) {
    return jsonResponse({ error: 'Admin password is required to delete a user' }, 400);
  }

  const { error: authError } = await supabase.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  });

  if (authError) {
    return jsonResponse({ error: 'Incorrect admin password' }, 401);
  }

  // 1. Fetch user profile first to get organization_id, org_name, full_name, role, abbreviation
  const { data: userRec } = await supabase
    .from('users')
    .select('id, organization_id, org_name, full_name, role, abbreviation')
    .eq('id', id)
    .maybeSingle();

  const orgIdsToDelete = new Set<string>();
  const namesToDelete = new Set<string>();
  const abbrsToDelete = new Set<string>();

  orgIdsToDelete.add(id);

  if (userRec) {
    if (userRec.organization_id) orgIdsToDelete.add(userRec.organization_id);
    if (userRec.org_name && userRec.org_name.trim()) namesToDelete.add(userRec.org_name.trim());
    if (userRec.full_name && userRec.full_name.trim()) namesToDelete.add(userRec.full_name.trim());
    if (userRec.abbreviation && userRec.abbreviation.trim()) abbrsToDelete.add(userRec.abbreviation.trim());
  }

  // Find all matching organizations table rows
  const { data: allOrgs } = await supabase.from('organizations').select('id, name, abbreviation');
  if (allOrgs && allOrgs.length > 0) {
    for (const org of allOrgs) {
      const oName = (org.name || '').trim().toLowerCase();
      const oAbbr = (org.abbreviation || '').trim().toLowerCase();

      let isMatch = orgIdsToDelete.has(org.id);
      if (!isMatch) {
        for (const n of namesToDelete) {
          if (n.toLowerCase() === oName) {
            isMatch = true;
            break;
          }
        }
      }
      if (!isMatch) {
        for (const a of abbrsToDelete) {
          if (a.toLowerCase() === oAbbr) {
            isMatch = true;
            break;
          }
        }
      }

      if (isMatch) {
        orgIdsToDelete.add(org.id);
        if (org.name) namesToDelete.add(org.name.trim());
        if (org.abbreviation) abbrsToDelete.add(org.abbreviation.trim());
      }
    }
  }

  const foundOrgIds = Array.from(orgIdsToDelete);

  // 2. Check if account has any active historical submissions
  let orFilter = `user_id.eq.${id}`;
  foundOrgIds.forEach((oid) => {
    orFilter += `,organization_id.eq.${oid}`;
  });

  const { count: submissionCount } = await supabase
    .from('submissions')
    .select('id', { count: 'exact', head: true })
    .or(orFilter);

  if (submissionCount && submissionCount > 0) {
    return jsonResponse(
      { error: 'Cannot delete account: This user/organization has active historical submissions in the system.' },
      400
    );
  }

  // 3. Delete invitation tokens & invitations for this user
  await supabase.from('invitation_tokens').delete().eq('user_id', id);
  await supabase.from('account_invitations').delete().eq('user_id', id);

  // 4. Delete organization academic years for all found org IDs first
  for (const oid of foundOrgIds) {
    const { error: ayErr } = await supabase.from('organization_academic_years').delete().eq('organization_id', oid);
    if (ayErr) console.warn(`AY cleanup note for ${oid}:`, ayErr.message);
  }

  // Clear organization_id reference on users table prior to deleting organizations table rows
  await supabase.from('users').update({ organization_id: null }).eq('id', id);
  for (const oid of foundOrgIds) {
    await supabase.from('users').update({ organization_id: null }).eq('organization_id', oid);
  }

  // 5. Delete organizations for all found org IDs
  for (const oid of foundOrgIds) {
    const { error: orgErr } = await supabase.from('organizations').delete().eq('id', oid);
    if (orgErr) console.warn(`Organization cleanup note for ${oid}:`, orgErr.message);
  }

  // 6. Name and Abbreviation cleanup on organizations table
  for (const name of namesToDelete) {
    const { error: orgNameErr } = await supabase.from('organizations').delete().ilike('name', name);
    if (orgNameErr) console.warn(`Organization name cleanup note for ${name}:`, orgNameErr.message);
  }
  for (const abbr of abbrsToDelete) {
    const { error: orgAbbrErr } = await supabase.from('organizations').delete().ilike('abbreviation', abbr);
    if (orgAbbrErr) console.warn(`Organization abbr cleanup note for ${abbr}:`, orgAbbrErr.message);
  }

  // 7. Delete profile from users table
  const { error: deleteProfileError } = await supabase.from('users').delete().eq('id', id);
  if (deleteProfileError) {
    console.warn(`User profile deletion note for ${id}:`, deleteProfileError.message);
  }

  // 8. Delete Auth User
  const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(id);
  if (deleteAuthError) {
    console.warn(`Auth user deletion note for ${id}:`, deleteAuthError.message);
  }

  // 9. Run final automated orphan cleanup
  await cleanOrphanedOrganizations();

  return jsonResponse({ success: true, message: 'User and organization deleted successfully' });
}

async function handleRenewOrganization(body: Record<string, unknown>) {
  const supabase = getAdminClient();
  const {
    organization_id,
    school_year_id,
    president_name,
    student_no,
    contact_no,
    adviser_name,
    co_advisers,
    no_member,
  } = body as {
    organization_id?: string;
    school_year_id?: string;
    president_name?: string;
    student_no?: string;
    contact_no?: string;
    adviser_name?: string;
    co_advisers?: string[];
    no_member?: number;
  };

  if (!organization_id || !school_year_id) {
    return jsonResponse({ error: 'organization_id and school_year_id are required' }, 400);
  }

  // 1. Check if organization_academic_years record already exists for this school year
  const { data: existingAyRec } = await supabase
    .from('organization_academic_years')
    .select('*')
    .eq('organization_id', organization_id)
    .eq('school_year_id', school_year_id)
    .maybeSingle();

  if (existingAyRec) {
    return jsonResponse({ error: 'Organization is already renewed for this Academic Year' }, 400);
  }

  // 2. Fetch the user profile associated with this organization
  const { data: userRec } = await supabase
    .from('users')
    .select('*')
    .eq('organization_id', organization_id)
    .maybeSingle();

  const presName = president_name || userRec?.full_name || 'Organization President';
  const stdNo = student_no !== undefined ? student_no : (userRec?.student_no || null);
  const cntNo = contact_no !== undefined ? contact_no : (userRec?.contact_no || null);
  const advName = adviser_name !== undefined ? adviser_name : (userRec?.adviser_name || null);
  const coAdvs = co_advisers !== undefined ? co_advisers : (userRec?.co_advisers || []);
  const mbrs = no_member !== undefined ? no_member : (userRec?.no_member || 0);

  // Update active user profile in users table
  if (userRec?.id) {
    await supabase
      .from('users')
      .update({
        full_name: presName,
        student_no: stdNo,
        contact_no: cntNo,
        adviser_name: advName,
        co_advisers: coAdvs,
        no_member: mbrs,
        status: 'Active',
      })
      .eq('id', userRec.id);
  }

  // 3. Create new AY snapshot
  const { data: newAyData, error: ayErr } = await supabase
    .from('organization_academic_years')
    .insert([
      {
        organization_id,
        school_year_id,
        status: 'active',
        president_name: presName,
        student_no: stdNo,
        contact_no: cntNo,
        adviser_name: advName,
        co_advisers: coAdvs,
        no_member: mbrs,
      },
    ])
    .select();

  if (ayErr) {
    return jsonResponse({ error: 'Failed to create organization academic year record', details: ayErr.message }, 500);
  }

  return jsonResponse({
    success: true,
    message: 'Organization successfully renewed for the selected Academic Year!',
    data: newAyData?.[0],
  });
}

async function handleGetOrganizationsByAy(url: URL) {
  const supabase = getAdminClient();
  const syId = url.searchParams.get('syId');

  const { data: allSchoolYears } = await supabase
    .from('school_years')
    .select('id, name, is_active, created_at, start_date')
    .order('created_at', { ascending: true });

  const syList = allSchoolYears || [];
  const syIndexMap = new Map<string, number>();
  syList.forEach((sy: any, idx: number) => syIndexMap.set(sy.id, idx));

  const activeSyObj = syList.find((s: any) => s.is_active);
  const targetSyId = syId || activeSyObj?.id || syList[0]?.id;
  const targetSyIdx = syIndexMap.get(targetSyId) ?? 0;

  const { data: usersData, error: usersErr } = await supabase
    .from('users')
    .select('*')
    .eq('role', 'org-president');

  if (usersErr) {
    return jsonResponse({ error: 'Failed to fetch organization users', details: usersErr.message }, 500);
  }

  const { data: allSnapshots } = await supabase
    .from('organization_academic_years')
    .select('*');

  const orgSnapshotsMap = new Map<string, any[]>();
  (allSnapshots || []).forEach((snap: any) => {
    if (snap.organization_id) {
      if (!orgSnapshotsMap.has(snap.organization_id)) {
        orgSnapshotsMap.set(snap.organization_id, []);
      }
      orgSnapshotsMap.get(snap.organization_id)!.push(snap);
    }
  });

  const { data: submissionRecords } = await supabase
    .from('submissions')
    .select('user_id, organization_id')
    .limit(10000);

  const { data: logRecords } = await supabase
    .from('submission_logs')
    .select('user_id')
    .limit(10000);

  const usersWithSubmissions = new Set<string>();
  (submissionRecords || []).forEach((s: any) => {
    if (s.user_id) usersWithSubmissions.add(String(s.user_id));
    if (s.organization_id) usersWithSubmissions.add(String(s.organization_id));
  });
  (logRecords || []).forEach((l: any) => {
    if (l.user_id) usersWithSubmissions.add(String(l.user_id));
  });

  const emailMap = await getAuthEmailsMap();

  const enriched: any[] = [];

  (usersData || []).forEach((u: any) => {
    const orgId = u.organization_id || u.id;
    const orgSnaps = orgSnapshotsMap.get(orgId) || (u.organization_id ? orgSnapshotsMap.get(u.id) : []) || [];
    
    const currentSnap = orgSnaps.find((s: any) => s.school_year_id === targetSyId);
    const isRenewed = Boolean(currentSnap);

    let earliestSyIdx = Infinity;
    orgSnaps.forEach((s: any) => {
      const idx = syIndexMap.get(s.school_year_id);
      if (idx !== undefined && idx < earliestSyIdx) {
        earliestSyIdx = idx;
      }
    });

    if (earliestSyIdx === Infinity) {
      const createdDate = u.joined_date || u.created_at;
      if (createdDate) {
        const createdTime = new Date(createdDate).getTime();
        let matchedIdx = syList.findIndex((sy: any) => {
          const syTime = new Date(sy.created_at || sy.start_date).getTime();
          return createdTime <= syTime + (365 * 24 * 60 * 60 * 1000);
        });
        earliestSyIdx = matchedIdx !== -1 ? matchedIdx : targetSyIdx;
      } else {
        earliestSyIdx = targetSyIdx;
      }
    }

    // Exclude organizations that did not exist yet in targetSyId
    if (targetSyIdx < earliestSyIdx && !currentSnap) {
      return;
    }

    let tabCategory = 'new';
    let statusLabel = 'New';
    if (targetSyIdx === earliestSyIdx) {
      tabCategory = 'new';
      statusLabel = 'New';
    } else {
      if (isRenewed) {
        tabCategory = 'renewed';
        statusLabel = 'Renewed';
      } else {
        tabCategory = 'not_renewed';
        statusLabel = 'Pending Renewal';
      }
    }

    const hasSubmissions = usersWithSubmissions.has(String(u.id)) || usersWithSubmissions.has(String(orgId)) || (u.organization_id ? usersWithSubmissions.has(String(u.organization_id)) : false);

    enriched.push({
      ...u,
      email: emailMap.get(u.id) || null,
      ay_snapshot: currentSnap || null,
      renewal_status: statusLabel === 'Renewed' ? 'RENEWED' : (statusLabel === 'New' ? 'NEW' : 'NOT_RENEWED'),
      status_label: statusLabel,
      tab_category: tabCategory,
      has_submissions: hasSubmissions,
      president_name: currentSnap ? currentSnap.president_name : u.full_name,
      student_no: currentSnap ? currentSnap.student_no : u.student_no,
      contact_no: currentSnap ? currentSnap.contact_no : u.contact_no,
      adviser_name: currentSnap ? currentSnap.adviser_name : u.adviser_name,
      no_member: currentSnap ? currentSnap.no_member : u.no_member,
    });
  });

  return jsonResponse({ success: true, data: enriched });
}

async function handleGetAnnouncements() {
  const supabase = getAdminClient();
  await syncSubmissionWindowAnnouncements(supabase);

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
  let { title, content, target_audience, is_active, created_by } = body as Record<string, unknown>;

  if (!title || !content || !target_audience) {
    return jsonResponse({ error: 'Title, content, and target_audience are required' }, 400);
  }

  const isUuid = (str: unknown) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  if (!isUuid(created_by)) {
    created_by = await getDefaultAdminUserId(supabase);
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

function normalizeWorkflowText(value: unknown) {
  return String(value || '').toLowerCase().trim().replace(/[_-]/g, ' ');
}

function getSubmissionDisplayTitle(sub: Record<string, unknown> | null | undefined): string {
  if (!sub) return 'Document';

  const versions = sub.submission_versions as Array<Record<string, unknown>> | undefined;
  if (versions && versions.length > 0) {
    const latest = versions.reduce((max, version) =>
      (version.version_number as number) > (max.version_number as number) ? version : max,
      versions[0]);
    const details = Array.isArray(latest.activity_proposal_details)
      ? latest.activity_proposal_details[0]
      : latest.activity_proposal_details;
    const activityTitle = (details as Record<string, unknown> | undefined)?.activity_title;
    if (typeof activityTitle === 'string' && activityTitle.trim()) {
      return activityTitle.trim();
    }
  }

  const docType = (sub.documentType as Record<string, unknown> | undefined)?.name;
  return typeof docType === 'string' && docType.trim() ? docType : 'Document';
}

function isWorkflowLogRelevantForRole(
  role: string,
  log: Record<string, unknown>,
  submission: Record<string, unknown> | null,
): boolean {
  if (!submission) return false;

  const status = String(submission.status || '').toLowerCase();
  const actionType = String(log.action_type || '').toLowerCase();
  const phase = String(log.workflow_phase || '').toLowerCase();
  const desc = (String(log.description || '') + ' ' + String(log.message || '') + ' ' + String(log.comment || '')).toLowerCase();
  const normRole = String(role || '').toLowerCase();

  if (status === 'draft') return false;
  if (['created', 'viewed', 'attachment_review', 'draft'].includes(actionType)) return false;

  // (ADMIN)
  if (normRole === 'admin' || normRole === 'oso-staff' || normRole === 'sds-coordinator') {
    // Explicitly EXCLUDE Chairman or Vice Chairman approvals, returns, or forwarding logs from Admin
    if (phase.includes('chairman') || desc.includes('by chairman') || desc.includes('by vice chairman')) {
      return false;
    }

    // 1) Retain notification when Org President sets document as retrieved
    if (actionType.includes('retriev') || desc.includes('retriev')) return true;

    // 2) Retain notification when Org President submits accomplishment report
    if (phase === 'accomplishment' || actionType.includes('accomplishment') || desc.includes('accomplishment')) return true;

    return false;
  }

  // (CHAIRMAN & VICE-CHAIRMAN)
  if (normRole === 'chairman' || normRole === 'vice-chairman') {
    // Chairman receives 'Pending Review' via queue. Hide duplicate 'submitted' / 'created' / 'draft' workflow log entries!
    if (actionType === 'submitted') return false;

    // Show accomplishment report submission
    if (phase === 'accomplishment' || actionType.includes('accomplishment') || desc.includes('accomplishment')) return true;

    return false;
  }

  // (ORG PRESIDENT)
  if (normRole === 'org-president') {
    if (actionType.includes('retriev') || desc.includes('retriev')) return true;
    if (actionType === 'approved' || desc.includes('approved')) return true;
    if (desc.includes('proof of delivery') || desc.includes('proof attachment')) return true;
    if (actionType === 'forwarded' || desc.includes('forwarded')) return true;
    if (actionType === 'returned' || desc.includes('returned')) return true;
    if (actionType === 'disapproved' || actionType === 'rejected' || desc.includes('disapproved') || desc.includes('rejected')) return true;

    return false;
  }

  return false;
}

function formatWorkflowNotificationTitle(
  submission: Record<string, unknown> | null,
  actionLabel: string,
  log: Record<string, unknown> | null = null,
  maxTitleLength = 32,
) {
  if (!submission) return `Document — ${actionLabel || 'UPDATE'}`;

  const docType = (submission.documentType as Record<string, unknown> | undefined)?.name
    || (submission.document_type as Record<string, unknown> | undefined)?.name
    || 'Document';

  let activityTitle = '';
  const versions = Array.isArray(submission.submission_versions)
    ? submission.submission_versions
    : (submission.submission_versions ? [submission.submission_versions] : []);

  const latestVer = (versions[0] as Record<string, unknown> | undefined) || {};
  const details = Array.isArray(latestVer.activity_proposal_details)
    ? (latestVer.activity_proposal_details[0] as Record<string, unknown> | undefined)
    : (latestVer.activity_proposal_details as Record<string, unknown> | undefined);

  if (details?.activity_title) {
    activityTitle = String(details.activity_title).trim();
  }

  let finalAction = actionLabel.replace(/_/g, ' ').toUpperCase().trim();
  if (log && log.workflow_phase === 'accomplishment' && finalAction === 'SUBMITTED') {
    finalAction = 'REPORT SUBMITTED';
  }

  let formattedTitle = String(docType);
  if (activityTitle && activityTitle.toLowerCase() !== String(docType).toLowerCase()) {
    const truncatedActivity = activityTitle.length > maxTitleLength
      ? `${activityTitle.slice(0, maxTitleLength).trim()}...`
      : activityTitle;
    formattedTitle = `${docType}: "${truncatedActivity}"`;
  }

  return `${formattedTitle}${finalAction ? ` — ${finalAction}` : ''}`;
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

  const announcementsData = await fetchActiveAnnouncements(supabase, role, orgName, 50);
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

  let logsData: Array<Record<string, unknown>> = [];

  const getReviewStatusesForRole = (viewerRole: string) => {
    if (viewerRole === 'admin') return ['sds coordinator review', 'oso staff review', 'oso approved'];
    if (viewerRole === 'chairman' || viewerRole === 'vice-chairman') return ['submitted'];
    return [];
  };

  if (role === 'org-president') {
    const { data: userSubs } = await supabase
      .from('submissions')
      .select('id')
      .eq('user_id', userId);

    const subIds = (userSubs || []).map((s) => s.id);

    if (subIds.length > 0) {
      const { data, error: logErr } = await supabase
        .from('submission_logs')
        .select('*, submissions(id, tracking_number, status, school_year_id, document_type_id, user_id, documentType:document_type_id(name))')
        .in('submission_id', subIds)
        .neq('user_id', userId)
        .not('action_type', 'in', '("created","viewed","attachment_review")')
        .order('created_at', { ascending: false })
        .limit(50);

      if (logErr) {
        console.error('Error fetching org-president logs:', logErr);
      }

      logsData = (data || []).filter(log => {
        const sub = log.submissions as Record<string, unknown> | null;
        return isWorkflowLogRelevantForRole(role, log as Record<string, unknown>, sub);
      });
    }
  } else if (role === 'admin' || role === 'chairman' || role === 'vice-chairman') {
    const reviewStatuses = getReviewStatusesForRole(role);
    const { data: activeSy } = await supabase
      .from('school_years')
      .select('id')
      .eq('is_active', true)
      .maybeSingle();

    const { data: queueSubs } = await supabase
      .from('submissions')
      .select('id, tracking_number, status, created_at, updated_at, school_year_id, documentType:document_type_id(name), users:user_id(full_name, org_name), submission_versions!submission_versions_submission_id_fkey(version_number, activity_proposal_details(activity_title))')
      .neq('status', 'draft')
      .in('status', reviewStatuses)
      .order('created_at', { ascending: false })
      .limit(25);

    const filteredQueue = (queueSubs || []).filter(
      (sub) => !activeSy?.id || sub.school_year_id === activeSy.id || !sub.school_year_id,
    );

    const queueNotifications = filteredQueue.map((sub) => {
      const docTitle = getSubmissionDisplayTitle(sub as Record<string, unknown>);
      const orgName = (sub.users as Record<string, unknown>)?.org_name || 'An organization';
      const docType = (sub.documentType as Record<string, unknown>)?.name || 'a document';
      return {
        id: `queue_${sub.id}`,
        type: 'workflow',
        title: `${docTitle} — Pending Review`,
        message: `${orgName} submitted ${docType} for review.`,
        timestamp: sub.updated_at || sub.created_at,
        source: {
          submission_id: sub.id,
          status: sub.status,
          submissions: sub,
        },
      };
    });

    let logNotifications: Array<Record<string, unknown>> = [];

    const { data: allLogs, error: allLogsErr } = await supabase
      .from('submission_logs')
      .select('*, submissions(tracking_number, status, school_year_id, document_type_id, user_id, users:user_id(org_name, full_name), documentType:document_type_id(name))')
      .in('action_type', ['submitted', 'returned', 'forwarded', 'approved', 'disapproved', 'completed'])
      .neq('user_id', userId)
      .not('action_type', 'in', '("viewed","attachment_review","created")')
      .order('created_at', { ascending: false })
      .limit(75);

    if (allLogsErr) {
      console.error('Error fetching allLogs:', allLogsErr);
    }

    logNotifications = (allLogs || [])
      .filter((log) => {
        const sub = log.submissions as Record<string, unknown> | null;
        if (!sub) return false;
        if (activeSy?.id && sub.school_year_id && sub.school_year_id !== activeSy.id) return false;
        return isWorkflowLogRelevantForRole(role, log as Record<string, unknown>, sub);
      })
      .map((l) => {
        const sub = l.submissions as Record<string, unknown> | null;
        const actionLabel = l.action_type
          ? String(l.action_type).replace(/_/g, ' ').toUpperCase()
          : 'Workflow Update';
        return {
          id: `log_${l.id}`,
          type: 'workflow',
          title: formatWorkflowNotificationTitle(sub, actionLabel, l as Record<string, unknown>),
          message: l.description || 'Status changed',
          timestamp: l.created_at,
          source: {
            ...l,
            submission_id: l.submission_id,
            status: sub?.status,
            submissions: sub,
          },
        };
      });

    const seen = new Set<string>();
    logsData = [...queueNotifications, ...logNotifications].filter((item) => {
      const source = item.source as Record<string, unknown>;
      const submissionId = String(source?.submission_id || (source?.submissions as Record<string, unknown>)?.id || '');
      const key = `${submissionId}:${item.title}:${String(item.timestamp).slice(0, 16)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } else {
    let triggerActions: string[] = [];
    if (role === 'sds-coordinator') triggerActions = ['oso approved'];
    else if (role === 'external') triggerActions = ['vice chairman approved'];
    else if (role === 'dean') triggerActions = ['external approved'];

    if (triggerActions.length > 0) {
      const { data } = await supabase
        .from('submission_logs')
        .select('*, submissions(id)')
        .in('action_type', triggerActions)
        .neq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      logsData = data || [];
    }
  }

  if (logsData.length > 0) {
    const workflowItems = logsData.map((l) => {
      if (l.source) return l;
      const sub = (l.submissions as Record<string, unknown> | undefined) || null;
      const actionLabel = l.action_type
        ? String(l.action_type).replace(/_/g, ' ').toUpperCase()
        : 'Workflow Update';
      return {
        id: `log_${l.id}`,
        type: 'workflow',
        title: formatWorkflowNotificationTitle(sub, actionLabel, l as Record<string, unknown>),
        message: l.description || l.message || 'Status changed',
        timestamp: l.timestamp || l.created_at,
        source: {
          ...l,
          submission_id: l.submission_id,
          status: sub?.status,
          submissions: sub,
        },
      };
    });

    notifications = [...notifications, ...workflowItems];
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

  const currentDateStr = new Date().toISOString().split('T')[0];
  const sStartStr = String(start_date).split('T')[0];
  const sEndStr = String(end_date).split('T')[0];
  const isCurrentDateWithin = currentDateStr >= sStartStr && currentDateStr <= sEndStr;
  const shouldBeActive = Boolean(is_active) || isCurrentDateWithin;

  if (shouldBeActive) {
    await supabase
      .from('school_years')
      .update({ is_active: false })
      .neq('id', '00000000-0000-0000-0000-000000000000');
  }

  const { data, error } = await supabase
    .from('school_years')
    .insert([{ name: formattedName, start_date, end_date, is_active: shouldBeActive }])
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

  const currentDateStr = new Date().toISOString().split('T')[0];
  const sStartStr = String(start_date).split('T')[0];
  const sEndStr = String(end_date).split('T')[0];
  const isCurrentDateWithin = currentDateStr >= sStartStr && currentDateStr <= sEndStr;
  const shouldBeActive = Boolean(body.is_active) || isCurrentDateWithin;

  if (shouldBeActive) {
    await supabase
      .from('school_years')
      .update({ is_active: false })
      .neq('id', id);
  }

  const { data, error } = await supabase
    .from('school_years')
    .update({ name: formattedName, start_date, end_date, ...(shouldBeActive ? { is_active: true } : {}) })
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

  const currentDateStr = new Date().toISOString().split('T')[0];
  const isCurrentDateWithin = currentDateStr >= semStartStr && currentDateStr <= semEndStr;
  const shouldBeActive = Boolean(body.is_active) || isCurrentDateWithin;

  if (shouldBeActive) {
    await supabase
      .from('semesters')
      .update({ is_active: false })
      .eq('school_year_id', school_year_id);
  }

  const { data, error } = await supabase
    .from('semesters')
    .insert([{ school_year_id, name, start_date: semStartStr, end_date: semEndStr, is_active: shouldBeActive, status: 'active' }])
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

  const currentDateStr = new Date().toISOString().split('T')[0];
  const isCurrentDateWithin = semStartStr && semEndStr && currentDateStr >= semStartStr && currentDateStr <= semEndStr;
  const shouldBeActive = Boolean(body.is_active) || isCurrentDateWithin;

  if (currentSem?.school_year_id && shouldBeActive) {
    await supabase
      .from('semesters')
      .update({ is_active: false })
      .eq('school_year_id', currentSem.school_year_id);
  }

  const { data, error } = await supabase
    .from('semesters')
    .update({ name, start_date: semStartStr, end_date: semEndStr, ...(shouldBeActive ? { is_active: true } : {}) })
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
    .eq('document_type_id', documentTypeId)
    .eq('event_type', 'submission_window');

  const currentDate = new Date();
  const isWithinBounds = (start_date: string | null, end_date: string | null) => {
    if (!start_date && !end_date) return true;
    const start = start_date ? new Date(start_date) : null;
    const end = end_date ? new Date(end_date) : null;
    if (start && end) return currentDate >= start && currentDate <= end;
    if (start) return currentDate >= start;
    if (end) return currentDate <= end;
    return false;
  };

  const windowEvent = events?.find((e) => {
    const semMatches = !e.semester_id || !activeSem || e.semester_id === activeSem.id;
    return semMatches && isWithinBounds(e.start_date, e.end_date);
  }) || events?.find((e) => isWithinBounds(e.start_date, e.end_date)) || events?.[0];

  if (!windowEvent) {
    return jsonResponse({ action: 'blocked', reason: 'No submission window is currently available.' });
  }

  if (!isWithinBounds(windowEvent.start_date, windowEvent.end_date)) {
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

  if (!isAllowMultiple(dt.allow_multiple_submissions)) {
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
  if (!isUuid(semester_id)) semester_id = null;

  // Fallback for created_by if null to satisfy NOT NULL constraint
  if (!created_by) {
    const { data: adminUser } = await supabase.from('users').select('id').eq('role', 'admin').limit(1).maybeSingle();
    if (adminUser) created_by = adminUser.id;
  }

  // Map 'school_event' to valid database event_type constraint ('blocked_activity' if blocking, else 'announcement')
  if (event_type === 'school_event') {
    if (description === 'BLOCKS_ACTIVITY' || body.blocks_activity) {
      event_type = 'blocked_activity';
    } else {
      event_type = 'announcement';
    }
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

  const insertRow: Record<string, unknown> = {
    school_year_id,
    semester_id,
    title,
    description: description || '',
    event_type,
    document_type_id,
    start_date,
    end_date,
    created_by
  };

  const { data, error } = await supabase
    .from('academic_calendar_events')
    .insert([insertRow])
    .select();

  if (error) {
    return jsonResponse({ error: 'Failed to create academic event', details: error.message }, 500);
  }

  const createdEv = data?.[0];
  if (event_type === 'submission_window' && createdEv) {
    try {
      const windowTitle = createdEv.title || title || 'Document Submission Window';
      const startFormatted = start_date ? new Date(start_date as string).toLocaleDateString() : '';
      const endFormatted = end_date ? new Date(end_date as string).toLocaleDateString() : '';
      const announceTitle = `📢 Submission Window Opened: ${windowTitle}`;
      const announceContent = `The submission window for ${windowTitle} is now OPEN${startFormatted && endFormatted ? ` from ${startFormatted} to ${endFormatted}` : ''}. Organizations can submit required documents via the Submit New Document page.`;

      const annObj: Record<string, unknown> = {
        title: announceTitle,
        content: announceContent,
        target_audience: 'all-orgs',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      annObj.created_by = created_by || await getDefaultAdminUserId(supabase);

      const { error: annErr } = await supabase.from('announcements').insert([annObj]);
      if (annErr) console.error('Failed to create opening window announcement:', annErr);
    } catch (e) {
      console.error('Failed to create opening window announcement:', e);
    }
  }

  return jsonResponse({ success: true, data: createdEv });
}

async function handlePutAcademicEvents(id: string, body: Record<string, unknown>) {
  const supabase = getAdminClient();
  let { title, description, event_type, document_type_id, start_date, end_date } = body as Record<string, unknown>;

  if (event_type === 'school_event') {
    if (description === 'BLOCKS_ACTIVITY' || body.blocks_activity) {
      event_type = 'blocked_activity';
    } else {
      event_type = 'announcement';
    }
  }

  if (document_type_id === '') document_type_id = null;
  if (start_date === '') start_date = null;
  if (end_date === '') end_date = null;

  const { data, error } = await supabase
    .from('academic_calendar_events')
    .update({ title, description, event_type, document_type_id, start_date, end_date })
    .eq('id', id)
    .select();

  if (error) {
    return jsonResponse({ error: 'Failed to update academic event', details: error.message }, 500);
  }

  const updatedEv = data?.[0];
  if (event_type === 'submission_window' && updatedEv) {
    try {
      const windowTitle = updatedEv.title || title || 'Document Submission Window';
      const startFormatted = start_date ? new Date(start_date as string).toLocaleDateString() : '';
      const endFormatted = end_date ? new Date(end_date as string).toLocaleDateString() : '';
      const announceTitle = `📢 Submission Window Opened: ${windowTitle}`;
      const announceContent = `The submission window for ${windowTitle} is now OPEN${startFormatted && endFormatted ? ` from ${startFormatted} to ${endFormatted}` : ''}. Organizations can submit required documents via the Submit New Document page.`;

      const { data: existingAnn } = await supabase
        .from('announcements')
        .select('id')
        .eq('title', announceTitle)
        .eq('is_active', true)
        .maybeSingle();

      if (!existingAnn) {
        const annCreatedBy = (body.created_by as string) || await getDefaultAdminUserId(supabase);
        const annObj: Record<string, unknown> = {
          title: announceTitle,
          content: announceContent,
          target_audience: 'all-orgs',
          is_active: true,
          created_by: annCreatedBy,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { error: annErr } = await supabase.from('announcements').insert([annObj]);
        if (annErr) console.error('Failed to update opening window announcement:', annErr);
      }
    } catch (e) {
      console.error('Failed to update opening window announcement:', e);
    }
  }

  return jsonResponse({ success: true, data: updatedEv });
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
  try {
    const supabase = getAdminClient();
    const userId = url.searchParams.get('userId');

    const { data: activeSy } = await supabase.from('school_years').select('*').eq('is_active', true).maybeSingle();
    if (!activeSy) {
      return jsonResponse({
        success: true,
        activeSchoolYear: null,
        message: 'No active school year configured.',
        availability: {},
      });
    }

    const currentDate = new Date();
    const syStart = activeSy.start_date ? new Date(activeSy.start_date) : null;
    const syEnd = activeSy.end_date ? new Date(activeSy.end_date) : null;

    if ((syStart && currentDate < syStart) || (syEnd && currentDate > syEnd)) {
      return jsonResponse({
        success: true,
        activeSchoolYear: activeSy,
        message: 'The current date is outside the active School Year.',
        availability: {},
      });
    }

    const { data: docTypes } = await supabase.from('documentType').select('*');
    const { data: events } = await supabase
      .from('academic_calendar_events')
      .select('*')
      .eq('school_year_id', activeSy.id);

    const blockedEvents = events?.filter((e) => e.event_type === 'blocked_activity' || e.description === 'BLOCKS_ACTIVITY') || [];
    const submissionWindows = events?.filter((e) => e.event_type === 'submission_window') || [];
    const availability: Record<string, { isAvailable: boolean; lockedReason: string | null; requiresEligibility: boolean; submissionWindow?: any }> = {};

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
    const existingActiveDocTypesThisYear = new Set<string>();

    if (userId) {
      const { data: userRecord } = await supabase.from('users').select('org_name').eq('id', userId).maybeSingle();
      if (userRecord?.org_name) {
        const { data: sameOrgUsers } = await supabase.from('users').select('id').eq('org_name', userRecord.org_name);
        const sameOrgUserIds = (sameOrgUsers || []).map((u) => u.id);

        if (sameOrgUserIds.length > 0) {
          const { data: orgSubs } = await supabase
            .from('submissions')
            .select('status, document_type_id, documentType:document_type_id(name)')
            .in('user_id', sameOrgUserIds)
            .eq('school_year_id', activeSy.id);

          if (orgSubs) {
            const completedSubs = orgSubs.filter((s) => String(s.status || '').toLowerCase().trim() === 'completed');
            const hasApprovedMidYear = completedSubs.some((s) =>
              (s.documentType as Record<string, unknown>)?.name?.toString().toLowerCase().includes('mid-year')
            );
            const hasApprovedYearEnd = completedSubs.some((s) =>
              (s.documentType as Record<string, unknown>)?.name?.toString().toLowerCase().includes('year-end')
            );

            if (!hasApprovedMidYear) missingRenewalRequirements.push('Approved Mid-Year Report');
            if (!hasApprovedYearEnd) missingRenewalRequirements.push('Approved Year-End Report');

            isRenewalEligible = Boolean(hasApprovedMidYear && hasApprovedYearEnd);

            orgSubs.forEach((s) => {
              const normStatus = String(s.status || '').toLowerCase().trim();
              if (normStatus !== 'disapproved' && normStatus !== 'draft' && normStatus !== 'returned' && s.document_type_id) {
                existingActiveDocTypesThisYear.add(String(s.document_type_id));
              }
            });
          }
        }
      }
    }

    for (const dt of docTypes || []) {
      let isAvailable = true;
      let lockedReason: string | null = null;
      let subWindow = null;

      // 1. Is there a submission window on this document type?
      if (dt.status !== 'active') {
        isAvailable = false;
        lockedReason = 'Document type is inactive';
      } else {
        const windowEvent = submissionWindows.find(w => w.document_type_id === dt.id);
        if (!windowEvent) {
          isAvailable = false;
          lockedReason = 'No submission window is currently available.';
        } else if (!isWithinBounds(windowEvent.start_date, windowEvent.end_date)) {
          isAvailable = false;
          lockedReason = 'Submission Window Closed';
          subWindow = { start: windowEvent.start_date, end: windowEvent.end_date };
        }
      }

      // 2. Is eligibility needed for this document type?
      if (isAvailable && dt.requires_eligibility && dt.name.toLowerCase().includes('renewal')) {
        if (!isRenewalEligible) {
          isAvailable = false;
          lockedReason = 'Missing Requirements: ' + missingRenewalRequirements.join(', ');
        }
      }

      // 3. Is multiple submission allowed in this document type?
      if (isAvailable) {
        const allowMultiple = isAllowMultiple(dt.allow_multiple_submissions);
        if (!allowMultiple) {
          if (existingActiveDocTypesThisYear.has(String(dt.id))) {
            isAvailable = false;
            lockedReason = 'You already have an active submission for this category. Check your My Documents page.';
          }
        }
      }

      availability[dt.id] = {
        isAvailable,
        lockedReason,
        requiresEligibility: dt.requires_eligibility,
        submissionWindow: subWindow
      };
    }

    return jsonResponse({
      success: true,
      activeSchoolYear: activeSy,
      availability,
      blockedEvents,
    });
  } catch (err) {
    console.error('Error in handleDocumentAvailability:', err);
    return jsonResponse({
      success: false,
      error: err instanceof Error ? err.message : String(err),
      availability: {}
    }, 500);
  }
}

async function handleSubmissionDecision(url: URL) {
  try {
    const supabase = getAdminClient();
    const userId = url.searchParams.get('userId');
    const documentTypeId = url.searchParams.get('documentTypeId');
    const subtypeId = url.searchParams.get('subtypeId');

    if (!userId || !documentTypeId) {
      return jsonResponse({ action: 'error', reason: 'Missing required parameters' });
    }

    const { data: dt } = await supabase.from('documentType').select('*').eq('id', documentTypeId).maybeSingle();
    if (!dt || dt.status !== 'active') {
      return jsonResponse({ action: 'blocked', reason: 'Document type is inactive.' });
    }

    const { data: activeSy } = await supabase.from('school_years').select('*').eq('is_active', true).maybeSingle();
    if (!activeSy) {
      return jsonResponse({ action: 'blocked', reason: 'No active school year.' });
    }

    // 1. Is there a submission window on this document type?
    const { data: events } = await supabase
      .from('academic_calendar_events')
      .select('*')
      .eq('school_year_id', activeSy.id)
      .eq('document_type_id', documentTypeId)
      .eq('event_type', 'submission_window');

    const currentDate = new Date();
    const isWithinBounds = (start_date: string | null, end_date: string | null) => {
      if (!start_date && !end_date) return true;
      const start = start_date ? new Date(start_date) : null;
      const end = end_date ? new Date(end_date) : null;
      if (start && end) return currentDate >= start && currentDate <= end;
      if (start) return currentDate >= start;
      if (end) return currentDate <= end;
      return false;
    };

    const windowEvent = events?.find((e) => isWithinBounds(e.start_date, e.end_date)) || events?.[0];
    if (!windowEvent) {
      return jsonResponse({ action: 'blocked', reason: 'No submission window is currently available.' });
    }

    if (!isWithinBounds(windowEvent.start_date, windowEvent.end_date)) {
      return jsonResponse({
        action: 'blocked',
        reason: 'Submission Window Closed',
        submissionWindow: { start: windowEvent.start_date, end: windowEvent.end_date }
      });
    }

    // 2. Is eligibility needed for this document type?
    if (dt.requires_eligibility && dt.name.toLowerCase().includes('renewal')) {
      const { data: userRecord } = await supabase.from('users').select('org_name').eq('id', userId).maybeSingle();
      if (userRecord?.org_name) {
        const { data: sameOrgUsers } = await supabase.from('users').select('id').eq('org_name', userRecord.org_name);
        const sameOrgUserIds = (sameOrgUsers || []).map((u) => u.id);

        if (sameOrgUserIds.length > 0) {
          const { data: orgSubs } = await supabase
            .from('submissions')
            .select('status, documentType:document_type_id(name)')
            .in('user_id', sameOrgUserIds)
            .eq('school_year_id', activeSy.id);

          const completedSubs = (orgSubs || []).filter((s) => String(s.status || '').toLowerCase().trim() === 'completed');
          const hasApprovedMidYear = completedSubs.some((s) => (s.documentType as any)?.name?.toString().toLowerCase().includes('mid-year'));
          const hasApprovedYearEnd = completedSubs.some((s) => (s.documentType as any)?.name?.toString().toLowerCase().includes('year-end'));

          if (!hasApprovedMidYear || !hasApprovedYearEnd) {
            const missing = [];
            if (!hasApprovedMidYear) missing.push('Approved Mid-Year Report');
            if (!hasApprovedYearEnd) missing.push('Approved Year-End Report');
            return jsonResponse({ action: 'blocked', reason: 'Missing Requirements: ' + missing.join(', ') });
          }
        }
      }
    }

    // 3. Is multiple submission allowed for this document type?
    if (!isAllowMultiple(dt.allow_multiple_submissions)) {
      const { data: userRecord } = await supabase.from('users').select('org_name').eq('id', userId).maybeSingle();
      if (!userRecord || !userRecord.org_name) {
        return jsonResponse({ action: 'error', reason: 'User organization not found.' });
      }

      const { data: sameOrgUsers } = await supabase.from('users').select('id').eq('org_name', userRecord.org_name);
      const sameOrgUserIds = (sameOrgUsers || []).map((u) => u.id);

      if (sameOrgUserIds.length > 0) {
        let subQuery = supabase
          .from('submissions')
          .select('id, tracking_number, status')
          .in('user_id', sameOrgUserIds)
          .eq('document_type_id', documentTypeId)
          .eq('school_year_id', activeSy.id);

        if (subtypeId) subQuery = subQuery.eq('subtype_id', subtypeId);

        const { data: existingSubs } = await subQuery.order('created_at', { ascending: false }).limit(1);

        if (existingSubs && existingSubs.length > 0) {
          const existing = existingSubs[0];
          const normStatus = String(existing.status || '').toLowerCase().trim();
          if (normStatus === 'draft' || normStatus === 'returned') {
            return jsonResponse({ action: 'resume', submissionId: existing.id, activeSchoolYear: activeSy });
          } else if (normStatus !== 'disapproved') {
            return jsonResponse({ action: 'blocked', reason: 'Your organization already has an active submission for this category in the current school year.' });
          }
        }
      }
    }

    return jsonResponse({ action: 'create', activeSchoolYear: activeSy });
  } catch (err) {
    console.error('Error in handleSubmissionDecision:', err);
    return jsonResponse({ action: 'error', reason: err instanceof Error ? err.message : String(err) }, 500);
  }
}

async function handleGetCommonErrors() {
  try {
    const supabase = getAdminClient();
    const { data: returnLogs } = await supabase
      .from('submission_logs')
      .select('review_action, comment, description, action_type')
      .in('action_type', ['return', 'returned', 'attachment_review']);

    const { data: returnedSubs } = await supabase
      .from('submissions')
      .select('remarks')
      .eq('status', 'returned');

    const errorCounts: Record<string, number> = {};
    const addReason = (rawReason: any) => {
      if (!rawReason) return;
      let s = String(rawReason).trim();
      if (!s) return;
      const lower = s.toLowerCase();
      if (
        lower.includes('approved') ||
        lower.includes('completed') ||
        lower.includes('retrieved') ||
        lower.includes('retrieval') ||
        lower.includes('marked') ||
        lower.includes('verified') ||
        lower.includes('forwarded') ||
        lower.includes('sent') ||
        lower.includes('attachment reviewed') ||
        lower === 'none' ||
        lower === 'none / approved' ||
        lower === 'none/approved' ||
        lower === 'returned' ||
        lower === 'attachment_review' ||
        lower === 'resubmitted' ||
        lower === 'blocks_activity' ||
        lower.startsWith('returned by')
      ) return;

      s = s.replace(/^(attachment|document)?\s*(review|returned|return):?\s*/i, '').trim();
      if (!s) return;
      s = s.replace(/[-_]/g, ' ');
      const formatted = s.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      errorCounts[formatted] = (errorCounts[formatted] || 0) + 1;
    };

    if (returnLogs) {
      returnLogs.forEach((log: any) => {
        const ra = log.review_action ? String(log.review_action).trim() : '';
        const raLower = ra.toLowerCase();
        if (
          ra &&
          !raLower.includes('approved') &&
          !raLower.includes('completed') &&
          !raLower.includes('retrieved') &&
          !raLower.includes('retrieval') &&
          !raLower.includes('marked') &&
          !raLower.includes('verified') &&
          !raLower.includes('forwarded') &&
          !raLower.includes('sent') &&
          !raLower.includes('attachment reviewed') &&
          !['none', 'none / approved', 'none/approved', ''].includes(raLower) &&
          !raLower.startsWith('returned by')
        ) {
          addReason(ra);
        } else if (log.comment && String(log.comment).trim()) {
          addReason(log.comment);
        }
      });
    }

    if (returnedSubs) {
      returnedSubs.forEach((sub: any) => {
        addReason(sub.remarks);
      });
    }

    const commonErrors = Object.entries(errorCounts)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);

    return jsonResponse({ success: true, data: commonErrors });
  } catch (err) {
    return jsonResponse({ success: false, error: String(err) }, 500);
  }
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
      'id, tracking_number, status, school_year_id, user_id, current_version_id, documentType:document_type_id(name, id), users:user_id(org_name, full_name), submission_versions!submission_versions_submission_id_fkey(version_number, activity_proposal_details(activity_title))',
    )
    .order('created_at', { ascending: false });

  const allTimeCount = allSubmissions ? allSubmissions.filter((s) => s.status !== 'draft').length : 0;
  const currentSyCount =
    activeSyId && allSubmissions
      ? allSubmissions.filter((s) => s.school_year_id === activeSyId && s.status !== 'draft').length
      : 0;

  const normalizeStatus = (value: unknown) => String(value || '').toLowerCase().trim();
  const inactiveOrFinalStatuses = ['draft', 'completed', 'disapproved', 'rejected', 'approved', 'ready for retrieval', 'document retrieval', 'waiting for accomplishment report', 'ready for org pickup'];
  const actualActiveReviewCount = allSubmissions
    ? allSubmissions.filter((s) => !inactiveOrFinalStatuses.includes(normalizeStatus(s.status))).length
    : 0;

  const activeDocumentsOverview = allSubmissions
    ? allSubmissions.filter((s) => !inactiveOrFinalStatuses.includes(normalizeStatus(s.status)))
    : [];

  const statusBreakdown: Record<string, number> = {
    'oso staff review': 0,
    'chairman and vice chairman review': 0,
    'sds coordinator review': 0,
    'final in-campus review': 0,
    'main campus review': 0,
    approved: 0,
    disapproved: 0,
    returned: 0,
    completed: 0,
  };

  if (allSubmissions) {
    allSubmissions.forEach((s) => {
      if (s.status === 'draft') return;

      let displayStatus = s.status;
      if (s.status === 'submitted') displayStatus = 'oso staff review';
      else if (s.status === 'oso approved') displayStatus = 'sds coordinator review';
      else if (s.status === 'sds approved' || s.status === 'chairman approved') {
        displayStatus = 'chairman and vice chairman review';
      } else if (s.status === 'vice chairman approved') displayStatus = 'main campus review';
      else if (s.status === 'external approved') displayStatus = 'final in-campus review';
      else if (s.status === 'dean approved') displayStatus = 'approved';
      else if (s.status === 'returned') displayStatus = 'returned';
      else if (s.status === 'completed') displayStatus = 'completed';
      else if (s.status === 'disapproved') displayStatus = 'disapproved';

      const key = displayStatus ? displayStatus.toLowerCase() : 'unknown';
      if (statusBreakdown[key] !== undefined) statusBreakdown[key]++;
      else statusBreakdown[key] = (statusBreakdown[key] || 0) + 1;
    });
  }

  // Helper calculation for Common Submission Errors and Revision Analysis
  const { data: returnLogs } = await supabase
    .from('submission_logs')
    .select('review_action, comment, description, action_type')
    .in('action_type', ['return', 'returned', 'attachment_review']);

  const { data: returnedSubs } = await supabase
    .from('submissions')
    .select('remarks')
    .eq('status', 'returned');

  const errorCounts: Record<string, number> = {};

  const addReason = (rawReason: string | null | undefined) => {
    if (!rawReason) return;
    let s = String(rawReason).trim();
    if (!s) return;
    const lower = s.toLowerCase();
    if (
      lower.includes('approved') ||
      lower.includes('completed') ||
      lower.includes('retrieved') ||
      lower.includes('retrieval') ||
      lower.includes('marked') ||
      lower.includes('verified') ||
      lower.includes('forwarded') ||
      lower.includes('sent') ||
      lower.includes('attachment reviewed') ||
      lower === 'none' ||
      lower === 'none / approved' ||
      lower === 'none/approved' ||
      lower === 'returned' ||
      lower === 'attachment_review' ||
      lower === 'resubmitted' ||
      lower === 'blocks_activity' ||
      lower.startsWith('returned by')
    ) return;

    s = s.replace(/^(attachment|document)?\s*(review|returned|return):?\s*/i, '').trim();
    if (!s) return;
    s = s.replace(/-/g, ' ');
    const formatted = s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    errorCounts[formatted] = (errorCounts[formatted] || 0) + 1;
  };

  if (returnLogs) {
    returnLogs.forEach((log) => {
      const ra = log.review_action ? String(log.review_action).trim() : '';
      const raLower = ra.toLowerCase();
      if (
        ra &&
        !raLower.includes('approved') &&
        !raLower.includes('completed') &&
        !raLower.includes('retrieved') &&
        !raLower.includes('retrieval') &&
        !raLower.includes('marked') &&
        !raLower.includes('verified') &&
        !raLower.includes('forwarded') &&
        !raLower.includes('sent') &&
        !raLower.includes('attachment reviewed') &&
        !['none', 'none / approved', 'none/approved', ''].includes(raLower) &&
        !raLower.startsWith('returned by')
      ) {
        addReason(ra);
      } else if (log.comment && String(log.comment).trim()) {
        const commentLower = String(log.comment).trim().toLowerCase();
        if (
          !commentLower.includes('approved') &&
          !commentLower.includes('completed') &&
          !commentLower.includes('retrieved') &&
          !commentLower.includes('retrieval') &&
          !commentLower.includes('marked') &&
          !commentLower.includes('verified') &&
          !commentLower.includes('forwarded') &&
          !commentLower.includes('sent') &&
          !commentLower.includes('attachment reviewed') &&
          !['none', 'none / approved', 'none/approved', ''].includes(commentLower) &&
          !commentLower.startsWith('returned by')
        ) {
          addReason(log.comment);
        }
      }
    });
  }

  if (returnedSubs) {
    returnedSubs.forEach((sub) => {
      addReason(sub.remarks);
    });
  }

  const commonErrors = Object.entries(errorCounts)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const { data: recentVersions } = await supabase
    .from('submission_versions')
    .select('submission_id, version_number, created_at')
    .gt('version_number', 1);

  const { data: returnLogsForRev } = await supabase
    .from('submission_logs')
    .select('submission_id, created_at, action_type, review_action, comment, description')
    .in('action_type', ['return', 'returned', 'resubmitted', 'attachment_review']);

  const validReturnLogs = (returnLogsForRev || []).filter((log: any) => {
    const act = String(log.action_type || '').toLowerCase();
    if (act === 'return' || act === 'returned' || act === 'resubmitted') return true;
    if (act === 'attachment_review') {
      const ra = String(log.review_action || log.comment || log.description || '').toLowerCase().trim();
      if (!ra) return false;
      return (
        !ra.includes('approved') &&
        !ra.includes('completed') &&
        !ra.includes('retrieved') &&
        !ra.includes('marked') &&
        !ra.includes('verified') &&
        !['none', 'none / approved', 'none/approved', ''].includes(ra) &&
        !ra.startsWith('returned by')
      );
    }
    return false;
  });

  const { data: allSubmissionsForStats } = await supabase
    .from('submissions')
    .select('id, document_type_id, status, document_types:document_type_id(name)');

  const startOfMonthDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let revisionsThisMonth = 0;
  if (recentVersions) {
    revisionsThisMonth += recentVersions.filter((v) => new Date(v.created_at) >= startOfMonthDate).length;
  }
  if (validReturnLogs) {
    revisionsThisMonth += validReturnLogs.filter((l) => new Date(l.created_at) >= startOfMonthDate).length;
  }
  if (revisionsThisMonth === 0) {
    const versionsCount = recentVersions ? recentVersions.length : 0;
    const returnsCount = validReturnLogs ? validReturnLogs.length : 0;
    revisionsThisMonth = Math.max(versionsCount, returnsCount);
  }
  if (revisionsThisMonth === 0 && allSubmissionsForStats) {
    const returnedCount = allSubmissionsForStats.filter((s: any) => s.status === 'returned').length;
    if (returnedCount > 0) revisionsThisMonth = returnedCount;
  }

  const avgRevisionsPerType: Record<string, string | number> = {
    'Activity Proposal': 0,
    'Mid-Year Report': 0,
    'Year-End Report': 0,
    'Renewal': 0,
  };

  if (allSubmissionsForStats && allSubmissionsForStats.length > 0) {
    const docTypeStats: Record<string, { totalRevisions: number; docCount: number }> = {};
    allSubmissionsForStats.forEach((sub: any) => {
      const typeName = sub.document_types?.name || 'Activity Proposal';
      if (!docTypeStats[typeName]) {
        docTypeStats[typeName] = { totalRevisions: 0, docCount: 0 };
      }
      docTypeStats[typeName].docCount++;
    });

    if (recentVersions) {
      recentVersions.forEach((v: any) => {
        const sub: any = allSubmissionsForStats.find((s: any) => s.id === v.submission_id);
        const typeName = sub?.document_types?.name || 'Activity Proposal';
        if (!docTypeStats[typeName]) {
          docTypeStats[typeName] = { totalRevisions: 0, docCount: 0 };
        }
        docTypeStats[typeName].totalRevisions++;
      });
    }

    if (validReturnLogs) {
      validReturnLogs.forEach((l: any) => {
        const sub: any = allSubmissionsForStats.find((s: any) => s.id === l.submission_id);
        if (sub) {
          const typeName = sub.document_types?.name || 'Activity Proposal';
          if (!docTypeStats[typeName]) {
            docTypeStats[typeName] = { totalRevisions: 0, docCount: 0 };
          }
          docTypeStats[typeName].totalRevisions++;
        }
      });
    }

    allSubmissionsForStats.forEach((sub: any) => {
      if (sub.status === 'returned') {
        const typeName = sub.document_types?.name || 'Activity Proposal';
        if (docTypeStats[typeName] && docTypeStats[typeName].totalRevisions === 0) {
          docTypeStats[typeName].totalRevisions = 1;
        }
      }
    });

    for (const [type, stats] of Object.entries(docTypeStats)) {
      avgRevisionsPerType[type] = stats.docCount > 0 ? parseFloat((stats.totalRevisions / stats.docCount).toFixed(2)) : 0;
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

  // Automatically check and deactivate/suspend organizations that missed deadlines
  try {
    await checkAndDeactivateLateUsers();
    await checkAndSuspendLateUsers();
  } catch (err) {
    console.error('Error running automated checks in dashboard:', err);
  }

  const { data: user } = await supabase.from('users').select('*').eq('id', userId).single();
  const { data: activeSy } = await supabase.from('school_years').select('*').eq('is_active', true).single();

  const orgName = user?.org_name || '';
  const announcements = await fetchActiveAnnouncements(supabase, 'org-president', orgName, 3);

  const { data: userSubmissions } = await supabase
    .from('submissions')
    .select(
      'id, tracking_number, status, school_year_id, created_at, documentType:document_type_id(name, id), submission_versions!submission_versions_submission_id_fkey(version_number, activity_proposal_details(activity_title))',
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
        underReviewDocs.push(sub);
      } else if (['dean approved', 'approved', 'waiting for accomplishment report'].includes(s)) {
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
    const docTypeName = (doc.documentType as Record<string, unknown>)?.name as string || 'Document';
    const isActivityProposal = docTypeName.toLowerCase() === 'activity proposal' || docTypeName.toLowerCase().includes('proposal');

    let docTitle = `Submission #${String(doc.id).substring(0, 6).toUpperCase()}`;
    const versions = doc.submission_versions as Array<Record<string, unknown>> | undefined;

    if (versions && versions.length > 0) {
      const latest = versions.reduce((max, v) =>
        (v.version_number as number) > (max.version_number as number) ? v : max,
        versions[0]);
      const details = Array.isArray(latest.activity_proposal_details)
        ? latest.activity_proposal_details[0]
        : latest.activity_proposal_details;

      if (isActivityProposal) {
        if (details && (details as Record<string, unknown>).activity_title) {
          docTitle = (details as Record<string, unknown>).activity_title as string;
        } else {
          docTitle = `${docTypeName} #${String(doc.id).substring(0, 6).toUpperCase()}`;
        }
      } else {
        const orgNameStr = (details as Record<string, unknown>)?.organization_name || user?.org_name || '-';
        docTitle = `${orgNameStr} ${docTypeName} ${activeSy ? activeSy.name : ''}`.toUpperCase().trim();
      }
    } else {
      if (isActivityProposal) {
        docTitle = `${docTypeName} #${String(doc.id).substring(0, 6).toUpperCase()}`;
      } else {
        const orgNameStr = user?.org_name || '-';
        docTitle = `${orgNameStr} ${docTypeName} ${activeSy ? activeSy.name : ''}`.toUpperCase().trim();
      }
    }

    const latestLog = logsBySubId[doc.id] || null;

    return {
      id: doc.id,
      title: docTitle,
      type: (doc.documentType as Record<string, unknown>)?.name || 'Unknown',
      status: doc.status,
      remarks: doc.remarks,
      latestLog: latestLog,
      lastUpdate: latestLog?.created_at || doc.created_at,
    };
  });

  const totalFinished = completedCount + disapprovedCount;
  const successRate = totalFinished > 0 ? Math.round((completedCount / totalFinished) * 100) : 100;

  // Calculate commonErrors & revisionAnalysis for Chairman/Vice Chairman dashboard
  const { data: returnLogs } = await supabase
    .from('submission_logs')
    .select('review_action, comment, description, action_type')
    .in('action_type', ['return', 'returned', 'attachment_review']);

  const { data: returnedSubs } = await supabase
    .from('submissions')
    .select('remarks')
    .eq('status', 'returned');

  const errorCounts: Record<string, number> = {};
  const addReason = (rawReason: string | null | undefined) => {
    if (!rawReason) return;
    let s = String(rawReason).trim();
    if (!s) return;
    const lower = s.toLowerCase();
    if (
      lower.includes('approved') ||
      lower.includes('completed') ||
      lower.includes('retrieved') ||
      lower.includes('retrieval') ||
      lower.includes('marked') ||
      lower.includes('verified') ||
      lower.includes('forwarded') ||
      lower.includes('sent') ||
      lower.includes('attachment reviewed') ||
      lower === 'none' ||
      lower === 'none / approved' ||
      lower === 'none/approved' ||
      lower === 'returned' ||
      lower === 'attachment_review' ||
      lower === 'resubmitted' ||
      lower === 'blocks_activity' ||
      lower.startsWith('returned by')
    ) return;

    s = s.replace(/^(attachment|document)?\s*(review|returned|return):?\s*/i, '').trim();
    if (!s) return;
    s = s.replace(/-/g, ' ');
    const formatted = s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    errorCounts[formatted] = (errorCounts[formatted] || 0) + 1;
  };

  if (returnLogs) {
    returnLogs.forEach((log) => {
      const ra = log.review_action ? String(log.review_action).trim() : '';
      const raLower = ra.toLowerCase();
      if (
        ra &&
        !raLower.includes('approved') &&
        !raLower.includes('completed') &&
        !raLower.includes('retrieved') &&
        !raLower.includes('retrieval') &&
        !raLower.includes('marked') &&
        !raLower.includes('verified') &&
        !raLower.includes('forwarded') &&
        !raLower.includes('sent') &&
        !raLower.includes('attachment reviewed') &&
        !['none', 'none / approved', 'none/approved', ''].includes(raLower) &&
        !raLower.startsWith('returned by')
      ) {
        addReason(ra);
      } else if (log.comment && String(log.comment).trim()) {
        const commentLower = String(log.comment).trim().toLowerCase();
        if (
          !commentLower.includes('approved') &&
          !commentLower.includes('completed') &&
          !commentLower.includes('retrieved') &&
          !commentLower.includes('retrieval') &&
          !commentLower.includes('marked') &&
          !commentLower.includes('verified') &&
          !commentLower.includes('forwarded') &&
          !commentLower.includes('sent') &&
          !commentLower.includes('attachment reviewed') &&
          !['none', 'none / approved', 'none/approved', ''].includes(commentLower) &&
          !commentLower.startsWith('returned by')
        ) {
          addReason(log.comment);
        }
      }
    });
  }

  if (returnedSubs) {
    returnedSubs.forEach((sub) => {
      addReason(sub.remarks);
    });
  }

  const commonErrors = Object.entries(errorCounts)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const { data: recentVersions } = await supabase
    .from('submission_versions')
    .select('submission_id, version_number, created_at')
    .gt('version_number', 1);

  const { data: returnLogsForRev } = await supabase
    .from('submission_logs')
    .select('submission_id, created_at, action_type, review_action, comment, description')
    .in('action_type', ['return', 'returned', 'resubmitted', 'attachment_review']);

  const validReturnLogs = (returnLogsForRev || []).filter((log: any) => {
    const act = String(log.action_type || '').toLowerCase();
    if (act === 'return' || act === 'returned' || act === 'resubmitted') return true;
    if (act === 'attachment_review') {
      const ra = String(log.review_action || log.comment || log.description || '').toLowerCase().trim();
      if (!ra) return false;
      return (
        !ra.includes('approved') &&
        !ra.includes('completed') &&
        !ra.includes('retrieved') &&
        !ra.includes('marked') &&
        !ra.includes('verified') &&
        !['none', 'none / approved', 'none/approved', ''].includes(ra) &&
        !ra.startsWith('returned by')
      );
    }
    return false;
  });

  const { data: allSubmissions } = await supabase
    .from('submissions')
    .select('id, document_type_id, status, document_types:document_type_id(name)');

  const startOfMonthDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let revisionsThisMonth = 0;
  if (recentVersions) {
    revisionsThisMonth += recentVersions.filter((v) => new Date(v.created_at) >= startOfMonthDate).length;
  }
  if (validReturnLogs) {
    revisionsThisMonth += validReturnLogs.filter((l) => new Date(l.created_at) >= startOfMonthDate).length;
  }
  if (revisionsThisMonth === 0) {
    const versionsCount = recentVersions ? recentVersions.length : 0;
    const returnsCount = validReturnLogs ? validReturnLogs.length : 0;
    revisionsThisMonth = Math.max(versionsCount, returnsCount);
  }
  if (revisionsThisMonth === 0 && allSubmissions) {
    const returnedCount = allSubmissions.filter((s: any) => s.status === 'returned').length;
    if (returnedCount > 0) revisionsThisMonth = returnedCount;
  }

  const avgRevisionsPerType: Record<string, string | number> = {
    'Activity Proposal': 0,
    'Mid-Year Report': 0,
    'Year-End Report': 0,
    'Renewal': 0,
  };

  if (allSubmissions && allSubmissions.length > 0) {
    const docTypeStats: Record<string, { totalRevisions: number; docCount: number }> = {};
    allSubmissions.forEach((sub: any) => {
      const typeName = sub.document_types?.name || 'Activity Proposal';
      if (!docTypeStats[typeName]) {
        docTypeStats[typeName] = { totalRevisions: 0, docCount: 0 };
      }
      docTypeStats[typeName].docCount++;
    });

    if (recentVersions) {
      recentVersions.forEach((v: any) => {
        const sub: any = allSubmissions.find((s: any) => s.id === v.submission_id);
        const typeName = sub?.document_types?.name || 'Activity Proposal';
        if (!docTypeStats[typeName]) {
          docTypeStats[typeName] = { totalRevisions: 0, docCount: 0 };
        }
        docTypeStats[typeName].totalRevisions++;
      });
    }

    if (validReturnLogs) {
      validReturnLogs.forEach((l: any) => {
        const sub: any = allSubmissions.find((s: any) => s.id === l.submission_id);
        if (sub) {
          const typeName = sub.document_types?.name || 'Activity Proposal';
          if (!docTypeStats[typeName]) {
            docTypeStats[typeName] = { totalRevisions: 0, docCount: 0 };
          }
          docTypeStats[typeName].totalRevisions++;
        }
      });
    }

    allSubmissions.forEach((sub: any) => {
      if (sub.status === 'returned') {
        const typeName = sub.document_types?.name || 'Activity Proposal';
        if (docTypeStats[typeName] && docTypeStats[typeName].totalRevisions === 0) {
          docTypeStats[typeName].totalRevisions = 1;
        }
      }
    });

    for (const [type, stats] of Object.entries(docTypeStats)) {
      avgRevisionsPerType[type] = stats.docCount > 0 ? parseFloat((stats.totalRevisions / stats.docCount).toFixed(2)) : 0;
    }
  }

  const statusBreakdown: Record<string, number> = {
    'oso staff review': 0,
    'chairman and vice chairman review': 0,
    'sds coordinator review': 0,
    'final in-campus review': 0,
    'main campus review': 0,
    approved: 0,
    disapproved: 0,
    returned: 0,
    completed: 0,
  };

  if (allSubmissions) {
    allSubmissions.forEach((s: any) => {
      if (s.status === 'draft') return;
      let displayStatus = s.status;
      if (s.status === 'submitted') displayStatus = 'oso staff review';
      else if (s.status === 'oso approved') displayStatus = 'sds coordinator review';
      else if (s.status === 'sds approved' || s.status === 'chairman approved') displayStatus = 'chairman and vice chairman review';
      else if (s.status === 'vice chairman approved') displayStatus = 'main campus review';
      else if (s.status === 'external approved') displayStatus = 'final in-campus review';
      else if (s.status === 'dean approved') displayStatus = 'approved';
      else if (s.status === 'returned') displayStatus = 'returned';
      else if (s.status === 'completed') displayStatus = 'completed';
      else if (s.status === 'disapproved') displayStatus = 'disapproved';

      const key = displayStatus ? displayStatus.toLowerCase() : 'unknown';
      if (statusBreakdown[key] !== undefined) statusBreakdown[key]++;
      else statusBreakdown[key] = (statusBreakdown[key] || 0) + 1;
    });
  }

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
      statusBreakdown,
      commonErrors,
      revisionAnalysis: {
        revisionsThisMonth,
        avgRevisionsPerType,
      },
    },
  });
}

async function handleChairmanDashboard(url: URL) {
  return handleAdminDashboard();
}

async function handleCheckEmail(url: URL) {
  const email = url.searchParams.get('email');
  if (!email) {
    return jsonResponse({ error: 'Email is required' }, 400);
  }

  const supabase = getAdminClient();
  try {
    const { data, error } = await supabase.auth.admin.listUsers({
      perPage: 1000,
    });

    if (error) {
      return jsonResponse({ error: 'Failed to list users', details: error.message }, 500);
    }

    const exists = data.users.some(
      (u) => u.email && u.email.toLowerCase() === email.toLowerCase()
    );
    return jsonResponse({ exists });
  } catch (err) {
    return jsonResponse(
      { error: 'Internal server error', details: err instanceof Error ? err.message : String(err) },
      500
    );
  }
}

// ==========================================
// WORKFLOW ENGINE FOR BULSU OSODOCS
// ==========================================

export type WorkflowStageKey =
  | 'DRAFT'
  | 'SUBMISSION'
  | 'OSO_REVIEW'
  | 'SDS_REVIEW'
  | 'HARDCOPY_SUBMISSION'
  | 'SIGNATORIES'
  | 'FINAL_LOCAL_CAMPUS_REVIEW'
  | 'MAIN_CAMPUS_REVIEW'
  | 'DOCUMENT_RETRIEVAL'
  | 'ACCOMPLISHMENT_REPORT'
  | 'COMPLETED'
  | 'RETURNED'
  | 'DISAPPROVED';

export const STAGE_DISPLAY_LABELS: Record<WorkflowStageKey, string> = {
  DRAFT: 'Draft',
  SUBMISSION: 'Submission',
  OSO_REVIEW: 'OSO Staff Review',
  SDS_REVIEW: 'SDS Coordinator Review',
  HARDCOPY_SUBMISSION: 'Hardcopy Submission',
  SIGNATORIES: 'Signatories',
  FINAL_LOCAL_CAMPUS_REVIEW: 'Final Local Campus Review',
  MAIN_CAMPUS_REVIEW: 'Main Campus Review',
  DOCUMENT_RETRIEVAL: 'Document Retrieval',
  ACCOMPLISHMENT_REPORT: 'Accomplishment Report',
  COMPLETED: 'Completed',
  RETURNED: 'Returned for Edits',
  DISAPPROVED: 'Disapproved',
};

export function normalizeStatusToStage(statusStr: string | null | undefined): WorkflowStageKey {
  if (!statusStr) return 'DRAFT';
  const s = statusStr.trim().toLowerCase();

  if (s === 'draft') return 'DRAFT';
  if (s === 'submitted' || s === 'pending') return 'OSO_REVIEW';
  if (s.includes('oso staff') || s.includes('oso review') || s.includes('oso approved')) return 'OSO_REVIEW';
  if (s.includes('sds coordinator review') || s.includes('sds review') || s.includes('sds coordinator')) return 'SDS_REVIEW';
  if (s === 'to forward' || s.includes('hardcopy')) return 'HARDCOPY_SUBMISSION';
  if (s.includes('signatories')) return 'SIGNATORIES';
  if (s.includes('dean review') || s.includes('dean approved') || s.includes('final local campus review')) return 'FINAL_LOCAL_CAMPUS_REVIEW';
  if (s.includes('main campus review') || s.includes('main campus') || s.includes('sent to main campus')) return 'MAIN_CAMPUS_REVIEW';
  if (s === 'approved' || s.includes('ready for retrieval') || s.includes('document retrieval') || s.includes('retrieved')) return 'DOCUMENT_RETRIEVAL';
  if (s.includes('waiting for accomplishment report') || s.includes('accomplishment report')) return 'ACCOMPLISHMENT_REPORT';
  if (s === 'completed') return 'COMPLETED';
  if (s === 'returned') return 'RETURNED';
  if (s === 'disapproved') return 'DISAPPROVED';

  return 'OSO_REVIEW';
}

export function stageToDbStatus(stage: WorkflowStageKey): string {
  switch (stage) {
    case 'DRAFT': return 'draft';
    case 'SUBMISSION': return 'submitted';
    case 'OSO_REVIEW': return 'submitted';
    case 'SDS_REVIEW': return 'sds coordinator review';
    case 'HARDCOPY_SUBMISSION': return 'to forward';
    case 'SIGNATORIES': return 'to forward';
    case 'FINAL_LOCAL_CAMPUS_REVIEW': return 'dean review';
    case 'MAIN_CAMPUS_REVIEW': return 'main campus review';
    case 'DOCUMENT_RETRIEVAL': return 'ready for retrieval';
    case 'ACCOMPLISHMENT_REPORT': return 'waiting for accomplishment report';
    case 'COMPLETED': return 'completed';
    case 'RETURNED': return 'returned';
    case 'DISAPPROVED': return 'disapproved';
    default: return 'submitted';
  }
}

export function getDocumentTypeKey(typeNameStr: string | null | undefined): string {
  if (!typeNameStr) return 'ACTIVITY_PROPOSAL';
  const name = typeNameStr.trim().toLowerCase();

  if (name.includes('mid-year') || name.includes('mid year')) return 'MID_YEAR_REPORT';
  if (name.includes('year-end') || name.includes('year end')) return 'YEAR_END_REPORT';
  if (name.includes('renewal') || name.includes('reaccreditation') || name.includes('re-accreditation')) return 'RENEWAL';
  return 'ACTIVITY_PROPOSAL';
}

export const WORKFLOW_CONFIGS: Record<string, {
  stages: WorkflowStageKey[];
  allowedRoles: Partial<Record<WorkflowStageKey, string[]>>;
  transitions: Partial<Record<WorkflowStageKey, Record<string, WorkflowStageKey>>>;
}> = {
  ACTIVITY_PROPOSAL: {
    stages: [
      'SUBMISSION',
      'OSO_REVIEW',
      'SDS_REVIEW',
      'HARDCOPY_SUBMISSION',
      'FINAL_LOCAL_CAMPUS_REVIEW',
      'MAIN_CAMPUS_REVIEW',
      'DOCUMENT_RETRIEVAL',
      'ACCOMPLISHMENT_REPORT',
      'COMPLETED'
    ],
    allowedRoles: {
      DRAFT: ['org-president'],
      SUBMISSION: ['org-president'],
      OSO_REVIEW: ['admin', 'chairman', 'vice-chairman', 'oso-staff'],
      SDS_REVIEW: ['admin', 'chairman', 'vice-chairman', 'oso-staff'],
      HARDCOPY_SUBMISSION: ['admin', 'chairman', 'vice-chairman', 'oso-staff', 'org-president'],
      SIGNATORIES: ['admin', 'chairman', 'vice-chairman', 'oso-staff'],
      FINAL_LOCAL_CAMPUS_REVIEW: ['admin', 'chairman', 'vice-chairman', 'oso-staff'],
      MAIN_CAMPUS_REVIEW: ['admin', 'chairman', 'vice-chairman', 'oso-staff'],
      DOCUMENT_RETRIEVAL: ['admin', 'chairman', 'vice-chairman', 'oso-staff', 'org-president'],
      ACCOMPLISHMENT_REPORT: ['admin', 'chairman', 'vice-chairman', 'oso-staff', 'org-president'],
      RETURNED: ['org-president'],
    },
    transitions: {
      DRAFT: { submit: 'OSO_REVIEW' },
      OSO_REVIEW: { approve: 'SDS_REVIEW', return: 'RETURNED', disapprove: 'DISAPPROVED' },
      SDS_REVIEW: { approve: 'HARDCOPY_SUBMISSION', return: 'RETURNED', disapprove: 'DISAPPROVED' },
      HARDCOPY_SUBMISSION: { approve: 'DOCUMENT_RETRIEVAL', ready_for_retrieval: 'DOCUMENT_RETRIEVAL', document_retrieved: 'DOCUMENT_RETRIEVAL', confirm_retrieval: 'FINAL_LOCAL_CAMPUS_REVIEW', forward: 'FINAL_LOCAL_CAMPUS_REVIEW', return: 'RETURNED', disapprove: 'DISAPPROVED' },
      FINAL_LOCAL_CAMPUS_REVIEW: { approve: 'FINAL_LOCAL_CAMPUS_REVIEW', forward: 'MAIN_CAMPUS_REVIEW', return: 'RETURNED', disapprove: 'DISAPPROVED' },
      MAIN_CAMPUS_REVIEW: { approve: 'DOCUMENT_RETRIEVAL', ready_for_retrieval: 'DOCUMENT_RETRIEVAL', forward: 'DOCUMENT_RETRIEVAL', return: 'RETURNED', disapprove: 'DISAPPROVED' },
      DOCUMENT_RETRIEVAL: { ready_for_retrieval: 'DOCUMENT_RETRIEVAL', document_retrieved: 'DOCUMENT_RETRIEVAL', confirm_retrieval: 'ACCOMPLISHMENT_REPORT', approve: 'ACCOMPLISHMENT_REPORT', return: 'RETURNED' },
      ACCOMPLISHMENT_REPORT: { approve: 'COMPLETED', submit_report: 'COMPLETED', return: 'RETURNED' },
      RETURNED: { resubmit: 'OSO_REVIEW' }
    }
  },
  MID_YEAR_REPORT: {
    stages: [
      'SUBMISSION',
      'OSO_REVIEW',
      'SDS_REVIEW',
      'COMPLETED'
    ],
    allowedRoles: {
      DRAFT: ['org-president'],
      SUBMISSION: ['org-president'],
      OSO_REVIEW: ['admin', 'chairman', 'vice-chairman', 'oso-staff'],
      SDS_REVIEW: ['admin', 'chairman', 'vice-chairman', 'oso-staff'],
      RETURNED: ['org-president'],
    },
    transitions: {
      DRAFT: { submit: 'OSO_REVIEW' },
      OSO_REVIEW: { approve: 'SDS_REVIEW', return: 'RETURNED', disapprove: 'DISAPPROVED' },
      // Mid-Year COMPLETES immediately after SDS Coordinator approval
      SDS_REVIEW: { approve: 'COMPLETED', return: 'RETURNED', disapprove: 'DISAPPROVED' },
      RETURNED: { resubmit: 'OSO_REVIEW' }
    }
  },
  YEAR_END_REPORT: {
    stages: [
      'SUBMISSION',
      'OSO_REVIEW',
      'SDS_REVIEW',
      'HARDCOPY_SUBMISSION',
      'FINAL_LOCAL_CAMPUS_REVIEW',
      'MAIN_CAMPUS_REVIEW',
      'DOCUMENT_RETRIEVAL',
      'COMPLETED'
    ],
    allowedRoles: {
      DRAFT: ['org-president'],
      SUBMISSION: ['org-president'],
      OSO_REVIEW: ['admin', 'chairman', 'vice-chairman', 'oso-staff'],
      SDS_REVIEW: ['admin', 'chairman', 'vice-chairman', 'oso-staff'],
      HARDCOPY_SUBMISSION: ['admin', 'chairman', 'vice-chairman', 'oso-staff', 'org-president'],
      FINAL_LOCAL_CAMPUS_REVIEW: ['admin', 'chairman', 'vice-chairman', 'oso-staff'],
      MAIN_CAMPUS_REVIEW: ['admin', 'chairman', 'vice-chairman', 'oso-staff'],
      DOCUMENT_RETRIEVAL: ['admin', 'chairman', 'vice-chairman', 'oso-staff', 'org-president'],
      RETURNED: ['org-president'],
    },
    transitions: {
      DRAFT: { submit: 'OSO_REVIEW' },
      OSO_REVIEW: { approve: 'SDS_REVIEW', return: 'RETURNED', disapprove: 'DISAPPROVED' },
      SDS_REVIEW: { approve: 'HARDCOPY_SUBMISSION', return: 'RETURNED', disapprove: 'DISAPPROVED' },
      HARDCOPY_SUBMISSION: { approve: 'DOCUMENT_RETRIEVAL', ready_for_retrieval: 'DOCUMENT_RETRIEVAL', document_retrieved: 'DOCUMENT_RETRIEVAL', confirm_retrieval: 'FINAL_LOCAL_CAMPUS_REVIEW', forward: 'FINAL_LOCAL_CAMPUS_REVIEW', return: 'RETURNED', disapprove: 'DISAPPROVED' },
      FINAL_LOCAL_CAMPUS_REVIEW: { approve: 'FINAL_LOCAL_CAMPUS_REVIEW', forward: 'MAIN_CAMPUS_REVIEW', return: 'RETURNED', disapprove: 'DISAPPROVED' },
      MAIN_CAMPUS_REVIEW: { approve: 'COMPLETED', return: 'RETURNED', disapprove: 'DISAPPROVED' },
      DOCUMENT_RETRIEVAL: { ready_for_retrieval: 'DOCUMENT_RETRIEVAL', document_retrieved: 'DOCUMENT_RETRIEVAL', confirm_retrieval: 'FINAL_LOCAL_CAMPUS_REVIEW', approve: 'FINAL_LOCAL_CAMPUS_REVIEW', return: 'RETURNED' },
      RETURNED: { resubmit: 'OSO_REVIEW' }
    }
  },
  RENEWAL: {
    stages: [
      'SUBMISSION',
      'OSO_REVIEW',
      'SDS_REVIEW',
      'HARDCOPY_SUBMISSION',
      'FINAL_LOCAL_CAMPUS_REVIEW',
      'MAIN_CAMPUS_REVIEW',
      'DOCUMENT_RETRIEVAL',
      'COMPLETED'
    ],
    allowedRoles: {
      DRAFT: ['org-president'],
      SUBMISSION: ['org-president'],
      OSO_REVIEW: ['admin', 'chairman', 'vice-chairman', 'oso-staff'],
      SDS_REVIEW: ['admin', 'chairman', 'vice-chairman', 'oso-staff'],
      HARDCOPY_SUBMISSION: ['admin', 'chairman', 'vice-chairman', 'oso-staff', 'org-president'],
      FINAL_LOCAL_CAMPUS_REVIEW: ['admin', 'chairman', 'vice-chairman', 'oso-staff'],
      MAIN_CAMPUS_REVIEW: ['admin', 'chairman', 'vice-chairman', 'oso-staff'],
      DOCUMENT_RETRIEVAL: ['admin', 'chairman', 'vice-chairman', 'oso-staff', 'org-president'],
      RETURNED: ['org-president'],
    },
    transitions: {
      DRAFT: { submit: 'OSO_REVIEW' },
      OSO_REVIEW: { approve: 'SDS_REVIEW', return: 'RETURNED', disapprove: 'DISAPPROVED' },
      SDS_REVIEW: { approve: 'HARDCOPY_SUBMISSION', return: 'RETURNED', disapprove: 'DISAPPROVED' },
      HARDCOPY_SUBMISSION: { approve: 'DOCUMENT_RETRIEVAL', ready_for_retrieval: 'DOCUMENT_RETRIEVAL', document_retrieved: 'DOCUMENT_RETRIEVAL', confirm_retrieval: 'FINAL_LOCAL_CAMPUS_REVIEW', forward: 'FINAL_LOCAL_CAMPUS_REVIEW', return: 'RETURNED', disapprove: 'DISAPPROVED' },
      FINAL_LOCAL_CAMPUS_REVIEW: { approve: 'FINAL_LOCAL_CAMPUS_REVIEW', forward: 'MAIN_CAMPUS_REVIEW', return: 'RETURNED', disapprove: 'DISAPPROVED' },
      MAIN_CAMPUS_REVIEW: { approve: 'COMPLETED', return: 'RETURNED', disapprove: 'DISAPPROVED' },
      DOCUMENT_RETRIEVAL: { ready_for_retrieval: 'DOCUMENT_RETRIEVAL', document_retrieved: 'DOCUMENT_RETRIEVAL', confirm_retrieval: 'FINAL_LOCAL_CAMPUS_REVIEW', approve: 'FINAL_LOCAL_CAMPUS_REVIEW', return: 'RETURNED' },
      RETURNED: { resubmit: 'OSO_REVIEW' }
    }
  }
};

export function getAllowedActionsForStage(cfgKey: string, stage: WorkflowStageKey, role: string): string[] {
  const cfg = WORKFLOW_CONFIGS[cfgKey] || WORKFLOW_CONFIGS.ACTIVITY_PROPOSAL;
  const allowedForStage = cfg.allowedRoles[stage] || [];
  const normRole = (role || '').toLowerCase();

  const isRoleAllowed = allowedForStage.some(r => r.toLowerCase() === normRole);
  if (!isRoleAllowed) return [];

  const stageTransitions = cfg.transitions[stage] || {};
  return Object.keys(stageTransitions);
}

export async function resolveActivityProposalRetrievalPhase(
  supabase: any,
  submissionId: string
): Promise<number> {
  const { data: logs, error } = await supabase
    .from('submission_logs')
    .select('workflow_phase, action_type, description, created_at')
    .eq('submission_id', submissionId)
    .order('created_at', { ascending: true });

  if (error || !logs || logs.length === 0) {
    return 1;
  }

  // Find latest resubmission index in chronological order
  const resubmitIndices = logs
    .map((l: any, idx: number) => {
      const at = String(l.action_type || '').toLowerCase();
      const desc = String(l.description || '').toLowerCase();
      return (at === 'resubmitted' || at === 'resubmit' || desc.includes('resubmitted')) ? idx : -1;
    })
    .filter((idx: number) => idx !== -1);

  const latestResubmitIdx = resubmitIndices.length > 0 ? resubmitIndices[resubmitIndices.length - 1] : -1;
  const currentCycleLogs = latestResubmitIdx >= 0 ? logs.slice(latestResubmitIdx) : logs;

  const hasPassedFinalOrMainCampus = currentCycleLogs.some((l: any) => {
    const phase = String(l.workflow_phase || '').toLowerCase();
    const actionType = String(l.action_type || '').toLowerCase();
    const desc = String(l.description || '').toLowerCase();

    return (
      phase.includes('main-campus') ||
      phase.includes('main campus') ||
      desc.includes('main campus') ||
      desc.includes('sent to main campus') ||
      (actionType === 'forwarded' && desc.includes('main')) ||
      phase.includes('final') ||
      desc.includes('final in-campus') ||
      desc.includes('final local campus') ||
      desc.includes('approved by dean')
    );
  });

  return hasPassedFinalOrMainCampus ? 2 : 1;
}

export async function resolveActivityProposalFinalCampusDecision(
  supabase: any,
  sub: Record<string, unknown>
): Promise<{ shouldBypassMainCampus: boolean; subtypeId: string | null; requirements: Array<Record<string, unknown>> }> {
  // 1. Check the submissions table: get document_type_id and check if it belongs to Activity Proposal
  const docTypeId = sub.document_type_id ? String(sub.document_type_id) : null;
  const docTypeObj = sub.documentType as Record<string, unknown> | undefined;
  const docTypeName = String(docTypeObj?.name || '').trim().toLowerCase();

  let isActivityProposal = docTypeName.includes('activity proposal');

  if (!isActivityProposal && docTypeId) {
    const { data: dt } = await supabase
      .from('document_types')
      .select('id, name')
      .eq('id', docTypeId)
      .maybeSingle();
    if (dt && String(dt.name || '').toLowerCase().includes('activity proposal')) {
      isActivityProposal = true;
    }
  }

  // If it is not an Activity Proposal, use the existing workflow normally
  if (!isActivityProposal) {
    return { shouldBypassMainCampus: false, subtypeId: null, requirements: [] };
  }

  // 2. Get the Activity Proposal subtype
  let subtypeId: string | null = sub.subtype_id ? String(sub.subtype_id) : null;

  if (!subtypeId && sub.proposal_type) {
    const proposalTypeName = String(sub.proposal_type).trim();
    let stQuery = supabase.from('document_subtypes').select('id, name');
    if (docTypeId) {
      stQuery = stQuery.eq('document_type_id', docTypeId);
    }
    const { data: stData } = await stQuery;
    const matched = stData?.find((s: any) =>
      String(s.name || '').toLowerCase() === proposalTypeName.toLowerCase() ||
      String(s.id || '') === proposalTypeName
    );
    if (matched) {
      subtypeId = String(matched.id);
    }
  }

  if (!subtypeId && sub.current_version_id) {
    const { data: atts } = await supabase
      .from('submission_attachments')
      .select('requirement:requirement_id(subtype_id)')
      .eq('submission_version_id', sub.current_version_id);
    const found = atts?.find((a: any) => a.requirement?.subtype_id)?.requirement?.subtype_id;
    if (found) {
      subtypeId = String(found);
    }
  }

  // 3. Fetch all requirements assigned to that specific Activity Proposal subtype
  let reqs: Array<Record<string, unknown>> = [];

  if (subtypeId) {
    let reqQuery = supabase
      .from('requirements')
      .select('id, title, requirement_scope, subtype_id');

    if (docTypeId) {
      reqQuery = reqQuery.eq('documentTypeID', docTypeId);
    }

    const { data: reqData, error: reqErr } = await reqQuery.or(`subtype_id.eq.${subtypeId},subtype_id.is.null`);
    if (!reqErr && reqData && reqData.length > 0) {
      reqs = reqData;
    } else {
      // Direct subtype query fallback
      const { data: fallbackReqs } = await supabase
        .from('requirements')
        .select('id, title, requirement_scope, subtype_id')
        .eq('subtype_id', subtypeId);
      if (fallbackReqs && fallbackReqs.length > 0) {
        reqs = fallbackReqs;
      }
    }
  }

  // Attachment fallback if subtype query yielded 0
  if (reqs.length === 0 && sub.current_version_id) {
    const { data: attsWithReq } = await supabase
      .from('submission_attachments')
      .select('requirement:requirement_id(id, title, requirement_scope, subtype_id)')
      .eq('submission_version_id', sub.current_version_id);
    if (attsWithReq && attsWithReq.length > 0) {
      reqs = attsWithReq.map((a: any) => a.requirement).filter(Boolean);
    }
  }

  // 5. If no requirements are found for the subtype, do not bypass Main Campus (keep existing Main Campus path)
  if (!reqs || reqs.length === 0) {
    console.log('Final Campus Review Decision: No requirements found for subtype. Continuing to Main Campus.', {
      submissionId: sub.id,
      subtypeId,
    });
    return { shouldBypassMainCampus: false, subtypeId, requirements: [] };
  }

  // 4. Decide where the Activity Proposal goes:
  // Check requirement_scope: OSOA (Local Campus Requirement) vs OSAS (Main Campus Requirement)
  const allOsoa = reqs.every((r) => {
    const scope = String(r.requirement_scope || '').trim().toUpperCase();
    return scope === 'OSOA';
  });

  const anyOsas = reqs.some((r) => {
    const scope = String(r.requirement_scope || '').trim().toUpperCase();
    return scope === 'OSAS';
  });

  const shouldBypassMainCampus = allOsoa && !anyOsas;

  console.log('Final Campus Review Decision for Activity Proposal:', {
    submissionId: sub.id,
    subtypeId,
    requirementsCount: reqs.length,
    scopes: reqs.map((r) => ({ title: r.title, scope: r.requirement_scope })),
    allOsoa,
    anyOsas,
    shouldBypassMainCampus,
  });

  return { shouldBypassMainCampus, subtypeId, requirements: reqs };
}

export function generateDescriptiveLogMessage(
  currentStage: WorkflowStageKey,
  nextStage: WorkflowStageKey,
  action: string,
  userRole: string,
  userComment?: string | null
): string {
  if (userComment && userComment.trim().length > 0) {
    return userComment.trim();
  }

  const roleTitle = userRole === 'org-president' ? 'Organization President'
    : userRole === 'admin' ? 'SDS Coordinator'
      : userRole === 'chairman' ? 'Chairman'
        : userRole === 'vice-chairman' ? 'Vice Chairman'
          : userRole === 'oso-staff' ? 'OSO Staff'
            : userRole;

  if (action === 'submit') {
    return `Submitted document by ${roleTitle}`;
  }

  if (action === 'resubmit') {
    return `Resubmitted document by ${roleTitle}`;
  }

  if (action === 'forward' || action === 'send_to_external') {
    if (nextStage === 'MAIN_CAMPUS_REVIEW') {
      return `Sent to Main Campus for Review`;
    }
    if (nextStage === 'FINAL_LOCAL_CAMPUS_REVIEW') {
      return `Forwarded for Final In-Campus Review`;
    }
    return `Forwarded document by ${roleTitle}`;
  }

  if (action === 'ready_for_retrieval') {
    return `Marked Ready for Retrieval`;
  }

  if (action === 'document_retrieved') {
    return `Document retrieved by Organization President`;
  }

  if (action === 'confirm_retrieval') {
    return `Retrieval confirmed by ${roleTitle}`;
  }

  if (action === 'approve') {
    switch (currentStage) {
      case 'OSO_REVIEW':
        return `Approved by OSO Staff`;
      case 'SDS_REVIEW':
        return userComment && userComment.trim()
          ? `Approved by SDS Coordinator\n\nRemarks: "${userComment.trim()}"`
          : `Approved by SDS Coordinator`;
      case 'HARDCOPY_SUBMISSION':
        return `Hard copy verified and approved by ${roleTitle}`;
      case 'FINAL_LOCAL_CAMPUS_REVIEW':
        return `Approved by Dean on Final In-Campus Review`;
      case 'MAIN_CAMPUS_REVIEW':
        return `Approved by Main Campus`;
      case 'ACCOMPLISHMENT_REPORT':
        return `Accomplishment Report approved by ${roleTitle}`;
      default:
        return `Approved by ${roleTitle}`;
    }
  }

  if (action === 'return') {
    switch (currentStage) {
      case 'OSO_REVIEW':
        return `Returned by OSO Staff`;
      case 'SDS_REVIEW':
        return `Returned by SDS Coordinator`;
      case 'FINAL_LOCAL_CAMPUS_REVIEW':
        return `Returned on Final In-Campus Review`;
      case 'MAIN_CAMPUS_REVIEW':
        return `Returned by Main Campus`;
      default:
        return `Returned by ${roleTitle}`;
    }
  }

  if (action === 'disapprove') {
    switch (currentStage) {
      case 'OSO_REVIEW':
        return `Disapproved by OSO Staff`;
      case 'SDS_REVIEW':
        return `Disapproved by SDS Coordinator`;
      case 'FINAL_LOCAL_CAMPUS_REVIEW':
        return `Disapproved on Final In-Campus Review`;
      case 'MAIN_CAMPUS_REVIEW':
        return `Disapproved by Main Campus`;
      default:
        return `Disapproved by ${roleTitle}`;
    }
  }

  return `${action.toUpperCase()} by ${roleTitle}`;
}

async function handleSubmissionTransition(body: Record<string, unknown>) {
  const submissionId = String(body.submissionId || '');
  const action = String(body.action || '').trim().toLowerCase();
  const comment = body.comment ? String(body.comment) : '';
  const userId = body.userId ? String(body.userId) : null;
  const attachmentReviews = Array.isArray(body.attachmentReviews) ? body.attachmentReviews : [];

  if (!submissionId || !action) {
    return jsonResponse({ error: 'submissionId and action are required' }, 400);
  }

  const supabase = getAdminClient();

  const { data: sub, error: subErr } = await supabase
    .from('submissions')
    .select('*, documentType:document_type_id(name), users:user_id(role, full_name, org_name)')
    .eq('id', submissionId)
    .maybeSingle();

  if (subErr || !sub) {
    return jsonResponse({ error: 'Submission not found', details: subErr?.message }, 404);
  }

  let actingUserRole = 'admin';
  let actingUserId = userId;
  if (userId) {
    const { data: userRec } = await supabase.from('users').select('id, role, full_name').eq('id', userId).maybeSingle();
    if (userRec) {
      actingUserRole = userRec.role;
      actingUserId = userRec.id;
    }
  } else {
    actingUserId = sub.user_id;
    actingUserRole = (sub.users as Record<string, unknown>)?.role as string || 'admin';
  }

  const docTypeName = (sub.documentType as Record<string, unknown>)?.name as string || 'Activity Proposal';
  const docTypeKey = getDocumentTypeKey(docTypeName);
  const currentStage = normalizeStatusToStage(sub.status);
  const cfg = WORKFLOW_CONFIGS[docTypeKey] || WORKFLOW_CONFIGS.ACTIVITY_PROPOSAL;

  const allowedActions = getAllowedActionsForStage(docTypeKey, currentStage, actingUserRole);
  if (!allowedActions.includes(action)) {
    return jsonResponse({
      error: `Invalid action '${action}' for current stage '${STAGE_DISPLAY_LABELS[currentStage]}' on document type '${docTypeKey}' for role '${actingUserRole}'`,
      allowedActions
    }, 400);
  }

  let nextStage = cfg.transitions[currentStage]?.[action];
  if (!nextStage) {
    return jsonResponse({ error: `No transition defined for action '${action}' from stage '${currentStage}'` }, 400);
  }

  if (
    currentStage === 'DOCUMENT_RETRIEVAL' &&
    action === 'confirm_retrieval'
  ) {
    const retrievalPhase = await resolveActivityProposalRetrievalPhase(supabase, submissionId);
    const hasMainCampusTransition = retrievalPhase === 2;

    if (retrievalPhase === 1) {
      nextStage = 'FINAL_LOCAL_CAMPUS_REVIEW';
    } else {
      if (docTypeKey === 'ACTIVITY_PROPOSAL') {
        nextStage = 'ACCOMPLISHMENT_REPORT';
      } else {
        nextStage = 'COMPLETED';
      }
    }

    console.log('RETRIEVAL PHASE RESOLUTION', {
      submissionId,
      docTypeKey,
      currentStage,
      action,
      retrievalPhase,
      hasMainCampusTransition,
      nextStage,
      nextStatus: stageToDbStatus(nextStage),
    });
  }

  let newDbStatus = stageToDbStatus(nextStage);
  if (currentStage === 'FINAL_LOCAL_CAMPUS_REVIEW' && action === 'approve') {
    const decision = await resolveActivityProposalFinalCampusDecision(supabase, sub);

    if (decision.shouldBypassMainCampus) {
      // ALL requirements are OSOA: Activity Proposal does NOT go to Main Campus.
      // Final In-Campus Review -> Approve -> Approved / Retrieval -> Accomplishment -> Completed
      nextStage = 'DOCUMENT_RETRIEVAL';
      newDbStatus = stageToDbStatus(nextStage); // 'ready for retrieval'
    } else {
      // ANY requirement is OSAS, or no requirements found:
      // Continue to Main Campus (dean approved -> Send to Main Campus -> Main Campus Review)
      newDbStatus = 'dean approved';
    }
  }

  const defaultDescriptiveMsg = generateDescriptiveLogMessage(currentStage, nextStage, action, actingUserRole, null);
  const userOrDescriptiveMsg = generateDescriptiveLogMessage(currentStage, nextStage, action, actingUserRole, comment);
  const formattedRemarks = userOrDescriptiveMsg;

  const { error: updateErr } = await supabase
    .from('submissions')
    .update({
      status: newDbStatus,
      remarks: formattedRemarks
    })
    .eq('id', submissionId);

  if (updateErr) {
    return jsonResponse({ error: 'Failed to update submission status', details: updateErr.message }, 500);
  }

  const activeVersionId = sub.current_version_id;
  if (activeVersionId && attachmentReviews.length > 0) {
    for (const attRev of attachmentReviews) {
      if (attRev.attachment_id && attRev.review_action) {
        await supabase.from('submission_logs').insert([{
          submission_id: submissionId,
          submission_version_id: activeVersionId,
          user_id: actingUserId,
          attachment_id: attRev.attachment_id,
          workflow_phase: STAGE_DISPLAY_LABELS[currentStage],
          action_type: 'attachment_review',
          review_action: attRev.review_action,
          description: attRev.comment || `Attachment ${attRev.review_action}`,
          comment: attRev.comment || null,
          created_at: new Date().toISOString()
        }]);
      }
    }
  }

  const isForwardToMain = nextStage === 'MAIN_CAMPUS_REVIEW' && (action === 'forward' || action === 'send_to_external');
  const logActionType = isForwardToMain ? 'forwarded' : action === 'approve' ? 'approved' : action;
  const logReviewAction = null;
  const logWorkflowPhase = isForwardToMain ? 'main-campus-review' : STAGE_DISPLAY_LABELS[currentStage];

  const operatorName = body.operatorName ? String(body.operatorName) : null;
  const operatorPosition = body.operatorPosition ? String(body.operatorPosition) : null;

  let transitionLogDesc = userOrDescriptiveMsg;
  if (operatorName && !transitionLogDesc.includes('[Performed by')) {
    const posTag = operatorPosition ? ` (${operatorPosition})` : '';
    transitionLogDesc += ` [Performed by ${operatorName}${posTag}]`;
  }

  await supabase.from('submission_logs').insert([{
    submission_id: submissionId,
    submission_version_id: activeVersionId || null,
    user_id: actingUserId,
    workflow_phase: logWorkflowPhase,
    action_type: logActionType,
    review_action: logReviewAction,
    description: transitionLogDesc,
    comment: comment || null,
    created_at: new Date().toISOString()
  }]);

  return jsonResponse({
    success: true,
    submission: {
      ...sub,
      status: newDbStatus,
      remarks: formattedRemarks
    },
    workflow: {
      documentType: docTypeKey,
      documentTypeName: docTypeName,
      currentStage: nextStage,
      displayLabel: STAGE_DISPLAY_LABELS[nextStage],
      stages: cfg.stages,
      allowedActions: getAllowedActionsForStage(docTypeKey, nextStage, actingUserRole)
    }
  });
}

async function handleSubmissionResubmit(body: Record<string, unknown>) {
  const submissionId = String(body.submissionId || '');
  const userId = body.userId ? String(body.userId) : null;
  const oldVersionId = body.oldVersionId ? String(body.oldVersionId) : null;
  const operatorName = body.operatorName ? String(body.operatorName) : null;
  const operatorPosition = body.operatorPosition ? String(body.operatorPosition) : null;

  if (!submissionId || !userId) {
    return jsonResponse({ error: 'submissionId and userId are required for resubmission' }, 400);
  }

  const supabase = getAdminClient();

  const { data: sub, error: subErr } = await supabase
    .from('submissions')
    .select('*, documentType:document_type_id(name)')
    .eq('id', submissionId)
    .maybeSingle();

  if (subErr || !sub) {
    return jsonResponse({ error: 'Submission not found', details: subErr?.message }, 404);
  }

  const docTypeName = (sub.documentType as Record<string, unknown>)?.name as string || 'Activity Proposal';
  const docTypeKey = getDocumentTypeKey(docTypeName);
  const cfg = WORKFLOW_CONFIGS[docTypeKey] || WORKFLOW_CONFIGS.ACTIVITY_PROPOSAL;

  const resubmitStage: WorkflowStageKey = 'OSO_REVIEW';
  const newDbStatus = stageToDbStatus(resubmitStage);

  const { error: updateErr } = await supabase
    .from('submissions')
    .update({
      status: newDbStatus,
      remarks: 'Resubmitted for edits'
    })
    .eq('id', submissionId);

  if (updateErr) {
    return jsonResponse({ error: 'Failed to update resubmission status', details: updateErr.message }, 500);
  }

  await supabase.from('users').update({ status: 'Active' }).eq('id', userId);

  let resubmitDesc = 'Document resubmitted for edits.';
  if (operatorName) {
    const posTag = operatorPosition ? ` (${operatorPosition})` : '';
    resubmitDesc += ` [Performed by ${operatorName}${posTag}]`;
  }

  await supabase.from('submission_logs').insert([{
    submission_id: submissionId,
    submission_version_id: sub.current_version_id || oldVersionId || null,
    user_id: userId,
    workflow_phase: 'Resubmission',
    action_type: 'resubmitted',
    review_action: 'resubmitted',
    description: resubmitDesc,
    created_at: new Date().toISOString()
  }]);

  return jsonResponse({
    success: true,
    submission: {
      ...sub,
      status: newDbStatus,
      remarks: 'Resubmitted for edits'
    },
    workflow: {
      documentType: docTypeKey,
      documentTypeName: docTypeName,
      currentStage: resubmitStage,
      displayLabel: STAGE_DISPLAY_LABELS[resubmitStage],
      stages: cfg.stages,
      allowedActions: getAllowedActionsForStage(docTypeKey, resubmitStage, 'org-president')
    }
  });
}

async function routeRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = normalizePath(url.pathname);
  const method = req.method.toUpperCase();
  const body = method === 'GET' ? {} : await readBody(req);

  if (method === 'GET' && path === '/users') return handleGetUsers();
  if (method === 'GET' && path === '/users/check-email') return handleCheckEmail(url);
  if (method === 'GET' && /^\/users\/[^/]+\/detail$/.test(path)) {
    return handleGetUserDetail(path.split('/')[2], url);
  }

  if (method === 'POST' && path === '/organizations/renew') return handleRenewOrganization(body);
  if (method === 'GET' && path === '/organizations/by-ay') return handleGetOrganizationsByAy(url);

  if (method === 'GET' && path === '/invitations/verify') return handleVerifyInvitation(url);
  if (method === 'POST' && path === '/invitations/setup-password') return handleSetupPassword(body);
  if (method === 'POST' && path === '/invitations/request-new') return handleRequestNewInvitation(body, req);
  if (method === 'POST' && path === '/invitations/resend') return handleResendInvitation(body, req);

  if (method === 'POST' && path === '/users') return handlePostUsers(body, req);
  if (method === 'POST' && path === '/auth/verify-password') return handleVerifyPassword(body);
  if (method === 'PUT' && /^\/users\/[^/]+$/.test(path)) {
    return handlePutUsers(path.split('/')[2], body);
  }
  if (method === 'DELETE' && /^\/users\/[^/]+$/.test(path)) {
    return handleDeleteUsers(path.split('/')[2], body);
  }

  if (method === 'GET' && path === '/announcements') return handleGetAnnouncements();
  if (method === 'GET' && path === '/schema-debug') {
    const supabase = getAdminClient();
    const res = await supabase.rpc('get_schema_debug', {}); // wait, RPC won't exist. Let's do raw query? Supabase js doesn't support raw query.
    // What if I just select from information_schema using select?
    const { data } = await supabase.from('information_schema.columns').select('*').eq('table_name', 'academic_calendar_events');
    const { data: con } = await supabase.from('information_schema.check_constraints').select('*');
    return jsonResponse({ columns: data, constraints: con });
  }
  if (method === 'POST' && path === '/announcements') return handlePostAnnouncements(body);
  if (method === 'PUT' && /^\/announcements\/[^/]+$/.test(path)) {
    return handlePutAnnouncements(path.split('/')[2], body);
  }
  if (method === 'DELETE' && /^\/announcements\/[^/]+$/.test(path)) {
    return handleDeleteAnnouncements(path.split('/')[2]);
  }

  if (method === 'GET' && path === '/notifications') return handleGetNotifications(url);

  if (method === 'GET' && path === '/semesters') return handleGetSemesters(url);
  if (method === 'POST' && path === '/semesters') return handlePostSemesters(body);
  if (method === 'PUT' && /^\/semesters\/[^/]+$/.test(path)) {
    return handlePutSemesters(path.split('/')[2], body);
  }
  if (method === 'PUT' && /^\/semesters\/[^/]+\/activate$/.test(path)) {
    return handleActivateSemester(path.split('/')[2]);
  }
  if (method === 'DELETE' && /^\/semesters\/[^/]+$/.test(path)) {
    return handleArchiveSemester(path.split('/')[2]);
  }

  if (method === 'POST' && path === '/submissions/draft') {
    return handleCreateDraftSubmission(body);
  }
  if (method === 'POST' && path === '/submissions/transition') {
    return handleSubmissionTransition(body);
  }
  if (method === 'POST' && path === '/submissions/resubmit') {
    return handleSubmissionResubmit(body);
  }

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
  if (method === 'GET' && path === '/system/submission-decision') {
    return handleSubmissionDecision(url);
  }
  if (method === 'GET' && path === '/system/admin-email') {
    return handleGetAdminEmail();
  }
  if (method === 'GET' && path === '/common-errors') return handleGetCommonErrors();
  if (method === 'GET' && path === '/admin/dashboard') return handleAdminDashboard();
  if (method === 'GET' && path === '/org/dashboard') return handleOrgDashboard(url);
  if (method === 'GET' && path === '/chairman/dashboard') return handleChairmanDashboard(url);

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

import { supabase } from '../supabaseClient';

export const formatScheduleTime = (timeStr) => {
  if (!timeStr) return '';
  try {
    const [hoursStr, minutesStr] = timeStr.split(':');
    let hours = parseInt(hoursStr, 10);
    const minutes = minutesStr || '00';
    if (isNaN(hours)) return timeStr;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours}:${minutes} ${ampm}`;
  } catch (e) {
    return timeStr;
  }
};

export const getScheduleStatus = (startDate, endDate) => {
  if (!startDate) {
    return {
      key: 'UPCOMING',
      label: 'Upcoming',
      bg: 'bg-amber-50 text-amber-800 border-amber-200',
      badgeBg: 'bg-amber-500 text-white',
      dot: 'bg-amber-500'
    };
  }

  const now = new Date();
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  const end = endDate ? new Date(endDate) : new Date(startDate);
  end.setHours(23, 59, 59, 999);

  if (now < start) {
    return {
      key: 'UPCOMING',
      label: 'Upcoming',
      bg: 'bg-amber-50 text-amber-800 border-amber-200',
      badgeBg: 'bg-amber-500 text-white',
      dot: 'bg-amber-500'
    };
  } else if (now >= start && now <= end) {
    return {
      key: 'ONGOING',
      label: 'Ongoing',
      bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      badgeBg: 'bg-emerald-600 text-white',
      dot: 'bg-emerald-500 animate-pulse'
    };
  } else {
    return {
      key: 'COMPLETED',
      label: 'Completed',
      bg: 'bg-gray-100 text-gray-700 border-gray-200',
      badgeBg: 'bg-gray-500 text-white',
      dot: 'bg-gray-400'
    };
  }
};

export const fetchApprovedActivitySchedules = async (schoolYearId) => {
  if (!schoolYearId) return [];

  try {
    // 1. Fetch document_types to get Activity Proposal type ID(s)
    const { data: docTypes, error: dtErr } = await supabase
      .from('documentType')
      .select('id, name');

    if (dtErr) {
      console.error('Error fetching documentType:', dtErr);
    }

    const actTypeIds = (docTypes || [])
      .filter(dt => dt.name && dt.name.toLowerCase().includes('activity proposal'))
      .map(dt => dt.id);

    // 2. Fetch submissions for the selected school_year_id
    let subQuery = supabase
      .from('submissions')
      .select(`
        id,
        tracking_number,
        current_version_id,
        school_year_id,
        document_type_id,
        documentType:document_type_id(id, name),
        users:user_id(
          id,
          full_name,
          org_name,
          abbreviation,
          organization_id,
          organizations:organization_id(name, abbreviation)
        )
      `)
      .eq('school_year_id', schoolYearId);

    if (actTypeIds.length > 0) {
      subQuery = subQuery.in('document_type_id', actTypeIds);
    }

    const { data: rawSubs, error: subErr } = await subQuery;

    if (subErr || !rawSubs || rawSubs.length === 0) {
      return [];
    }

    // Filter to ensure only Activity Proposals are selected
    const activitySubmissions = rawSubs.filter(sub => {
      const typeName = sub.documentType?.name || '';
      if (actTypeIds.length > 0) {
        return actTypeIds.includes(sub.document_type_id);
      }
      return typeName.toLowerCase().includes('activity proposal');
    });

    if (activitySubmissions.length === 0) return [];

    const subIds = activitySubmissions.map(s => s.id);

    // 3. Check submission_logs for Main Campus Review approval
    const { data: logs, error: logsErr } = await supabase
      .from('submission_logs')
      .select('submission_id, workflow_phase, action_type')
      .in('submission_id', subIds);

    if (logsErr) {
      console.error('Error fetching submission logs:', logsErr);
    }

    const approvedSubIds = new Set();
    (logs || []).forEach(log => {
      const phaseNorm = String(log.workflow_phase || '').toLowerCase().replace(/[-_]/g, ' ').trim();
      const actionNorm = String(log.action_type || '').toLowerCase().trim();

      if ((phaseNorm === 'main campus review' || phaseNorm === 'main campus' || phaseNorm === 'main-campus-review') && actionNorm === 'approved') {
        approvedSubIds.add(log.submission_id);
      }
    });

    const approvedSubmissions = activitySubmissions.filter(sub => approvedSubIds.has(sub.id));

    if (approvedSubmissions.length === 0) return [];

    // 4. Collect current_version_ids for approved submissions
    const versionIds = approvedSubmissions
      .map(sub => sub.current_version_id)
      .filter(Boolean);

    if (versionIds.length === 0) return [];

    // 5. Query activity_proposal_details using current_version_id
    const { data: details, error: detailsErr } = await supabase
      .from('activity_proposal_details')
      .select('id, submission_version_id, activity_title, target_venue')
      .in('submission_version_id', versionIds);

    if (detailsErr || !details || details.length === 0) {
      return [];
    }

    const detailIds = details.map(d => d.id);

    // 6. Query activity_schedules using proposal_detail_id
    const { data: schedules, error: schedErr } = await supabase
      .from('activity_schedules')
      .select('id, proposal_detail_id, activity_date, end_date, start_time, end_time, is_indefinite, duration_minutes')
      .in('proposal_detail_id', detailIds);

    if (schedErr || !schedules || schedules.length === 0) {
      return [];
    }

    // 7. Map details and schedules back to submission & build calendar event objects
    const versionToSubMap = new Map();
    approvedSubmissions.forEach(sub => {
      if (sub.current_version_id) {
        versionToSubMap.set(sub.current_version_id, sub);
      }
    });

    const detailToVersionMap = new Map();
    details.forEach(det => {
      detailToVersionMap.set(det.id, det);
    });

    const proposalEvents = [];

    schedules.forEach(sched => {
      if (!sched.activity_date) return;

      const detail = detailToVersionMap.get(sched.proposal_detail_id);
      if (!detail) return;

      const sub = versionToSubMap.get(detail.submission_version_id);
      if (!sub) return;

      const orgName = sub.users?.organizations?.name ||
        sub.users?.org_name ||
        sub.users?.organizations?.abbreviation ||
        sub.users?.abbreviation ||
        sub.users?.full_name ||
        'Organization';

      const orgAbbr = sub.users?.organizations?.abbreviation ||
        sub.users?.abbreviation ||
        (sub.users?.organizations?.name ? sub.users.organizations.name.split(/\s+/).filter(w => !['of', 'in', 'and', 'the', 'for'].includes(w.toLowerCase())).map(w => w[0]?.toUpperCase()).join('') : null) ||
        sub.users?.org_name ||
        'ORG';

      const startDate = new Date(sched.activity_date);
      const endDate = sched.end_date ? new Date(sched.end_date) : null;

      proposalEvents.push({
        id: `act-${sub.id}-${detail.id}-${sched.id}`,
        title: detail.activity_title || 'Activity Proposal',
        org: orgName,
        orgAbbr: orgAbbr,
        venue: detail.target_venue || 'N/A',
        date: startDate,
        endDate: endDate,
        startTime: sched.start_time || null,
        endTime: sched.end_time || null,
        formattedStartTime: formatScheduleTime(sched.start_time),
        formattedEndTime: formatScheduleTime(sched.end_time),
        isBlocked: false,
        isActivityProposal: true,
        eventType: 'activity_proposal',
        trackingNumber: sub.tracking_number,
        duration: sched.duration_minutes || 0,
        isIndefinite: Boolean(sched.is_indefinite)
      });
    });

    return proposalEvents;
  } catch (err) {
    console.error('Error in fetchApprovedActivitySchedules:', err);
    return [];
  }
};

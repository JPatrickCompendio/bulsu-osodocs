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
        subtype_id,
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
    const candidateVersionIds = activitySubmissions.map(s => s.current_version_id).filter(Boolean);

    // 3. Fetch auxiliary data needed for subtype and requirement scope analysis:
    const { data: subtypes } = await supabase
      .from('document_subtypes')
      .select('id, name, document_type_id');

    const { data: allReqs } = await supabase
      .from('requirements')
      .select('id, title, requirement_scope, subtype_id');

    const attachmentsByVersion = new Map();
    if (candidateVersionIds.length > 0) {
      const { data: atts } = await supabase
        .from('submission_attachments')
        .select('submission_version_id, requirement_id, requirements(id, title, requirement_scope, subtype_id)')
        .in('submission_version_id', candidateVersionIds);

      (atts || []).forEach(att => {
        if (!attachmentsByVersion.has(att.submission_version_id)) {
          attachmentsByVersion.set(att.submission_version_id, []);
        }
        attachmentsByVersion.get(att.submission_version_id).push(att);
      });
    }

    // 4. Fetch submission logs for all candidate submissions
    const { data: logs, error: logsErr } = await supabase
      .from('submission_logs')
      .select('submission_id, workflow_phase, action_type, description')
      .in('submission_id', subIds);

    if (logsErr) {
      console.error('Error fetching submission logs:', logsErr);
    }

    const logsBySubId = new Map();
    (logs || []).forEach(l => {
      if (!logsBySubId.has(l.submission_id)) {
        logsBySubId.set(l.submission_id, []);
      }
      logsBySubId.get(l.submission_id).push(l);
    });

    // 5. Evaluate approval eligibility for each Activity Proposal based on its workflow path
    const approvedSubIds = new Set();

    for (const sub of activitySubmissions) {
      // Step A: Determine Activity Proposal subtype
      let subtypeId = sub.subtype_id ? String(sub.subtype_id) : null;

      if (!subtypeId && sub.current_version_id) {
        const verAtts = attachmentsByVersion.get(sub.current_version_id) || [];
        const attWithSubtype = verAtts.find(a => a.requirements?.subtype_id);
        if (attWithSubtype) {
          subtypeId = String(attWithSubtype.requirements.subtype_id);
        }
      }

      // Step B: Get requirements assigned to that subtype
      let subReqs = [];
      if (subtypeId) {
        subReqs = (allReqs || []).filter(r => String(r.subtype_id) === String(subtypeId));
      }

      // Attachment fallback if subtype has no direct requirements defined in DB
      if (subReqs.length === 0 && sub.current_version_id) {
        const verAtts = attachmentsByVersion.get(sub.current_version_id) || [];
        subReqs = verAtts.map(a => a.requirements).filter(Boolean);
      }

      // Step C: Determine whether the subtype is composed entirely of local-campus requirements
      // Local-campus condition:
      // ALL requirements assigned to the Activity Proposal subtype have local scope (OSOA) or OSAS without mixed scopes.
      // If the subtype has a mixture of scopes, it must use the Main Campus approval path.
      let isLocalCampusSubtype = false;
      if (subReqs.length > 0) {
        const scopes = subReqs.map(r => String(r.requirement_scope || '').trim().toUpperCase());
        const hasOsoa = scopes.some(s => s === 'OSOA');
        const hasOsas = scopes.some(s => s === 'OSAS');
        const isMixed = hasOsoa && hasOsas;

        if (!isMixed) {
          if (scopes.every(s => s === 'OSOA') || scopes.every(s => s === 'OSAS')) {
            isLocalCampusSubtype = true;
          }
        }
      }

      // Step D: Check submission_logs for the exact submission_id
      const subLogs = logsBySubId.get(sub.id) || [];

      const hasFinalInCampusApproval = subLogs.some(log => {
        const action = String(log.action_type || '').toLowerCase().trim();
        const phase = String(log.workflow_phase || '').toLowerCase().replace(/[-_]/g, ' ').trim();
        if (action !== 'approved') return false;
        return (
          phase === 'final in-campus review' ||
          phase === 'final in campus review' ||
          phase === 'final local campus review' ||
          phase === 'final local campus' ||
          phase === 'dean-review' ||
          phase === 'dean review' ||
          (phase.includes('final') && (phase.includes('campus') || phase.includes('local') || phase.includes('in-campus')))
        );
      });

      const hasMainCampusApproval = subLogs.some(log => {
        const action = String(log.action_type || '').toLowerCase().trim();
        const phase = String(log.workflow_phase || '').toLowerCase().replace(/[-_]/g, ' ').trim();
        if (action !== 'approved') return false;
        return (
          phase === 'main campus review' ||
          phase === 'main campus' ||
          phase === 'main-campus-review' ||
          phase.includes('main campus')
        );
      });

      let isEligible = false;
      if (isLocalCampusSubtype) {
        // Local-campus workflow path:
        // workflow_phase = "Final In-Campus Review" AND action_type = "approved"
        isEligible = hasFinalInCampusApproval || hasMainCampusApproval;
      } else {
        // Main Campus workflow path:
        // workflow_phase = "Main Campus Review" AND action_type = "approved"
        isEligible = hasMainCampusApproval;
      }

      if (isEligible) {
        approvedSubIds.add(sub.id);
      }
    }

    const approvedSubmissions = activitySubmissions.filter(sub => approvedSubIds.has(sub.id));

    if (approvedSubmissions.length === 0) return [];

    // 6. Collect current_version_ids for approved submissions
    const approvedVersionIds = approvedSubmissions
      .map(sub => sub.current_version_id)
      .filter(Boolean);

    if (approvedVersionIds.length === 0) return [];

    // 7. Query activity_proposal_details using approvedVersionIds
    const { data: details, error: detailsErr } = await supabase
      .from('activity_proposal_details')
      .select('id, submission_version_id, activity_title, target_venue')
      .in('submission_version_id', approvedVersionIds);

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

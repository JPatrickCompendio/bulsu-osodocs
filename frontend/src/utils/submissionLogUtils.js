/**
 * Timeline helpers for submission_logs (uses action_type, review_action, description — not action).
 */

const norm = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[_-]/g, ' ')
    .trim();

export const normalizeSubmissionStatus = norm;

export const formatLogActionLabel = (log) => {
  if (log?.isPending) return 'pending';

  const review = String(log?.review_action || '').trim().toLowerCase();
  const type = String(log?.action_type || '').toLowerCase().trim();
  const desc = String(log?.description || '').toLowerCase().trim();

  // 1. Approved actions ALWAYS render 'approved' badge
  if (type === 'approved' || type === 'approve') {
    return 'approved';
  }

  // 2. Returned actions ALWAYS render 'returned' badge
  if (type === 'returned' || type === 'return') {
    return 'returned';
  }

  // 3. Disapproved / Rejected actions
  if (type === 'disapproved' || type === 'disapprove' || type === 'rejected') {
    return 'disapproved';
  }

  // 4. Ready for retrieval
  if (type === 'ready_for_retrieval' || type === 'ready for retrieval') {
    return 'ready for retrieval';
  }

  // 5. Document retrieved
  if (type === 'document_retrieved' || type === 'document retrieved') {
    return 'document retrieved';
  }

  // 6. Confirm retrieval
  if (type === 'confirm_retrieval' || type === 'confirm retrieval') {
    return 'retrieval confirmed';
  }

  // 7. Submitted / Resubmitted
  if (type === 'submitted' || type === 'submit') {
    return 'submitted';
  }
  if (type === 'resubmitted' || type === 'resubmit') {
    return 'resubmitted';
  }

  // 8. Forwarded / Submitted to Main Campus
  if (type === 'forwarded' || type === 'forward' || type === 'send_to_external') {
    if (review.includes('main campus') || desc.includes('main campus')) {
      return 'Submitted to Main Campus';
    }
    return 'forwarded';
  }

  if (review && review !== 'approved' && review !== 'returned' && review !== 'forwarded') {
    return review.replace(/-/g, ' ');
  }

  if (type) return type.replace(/-/g, ' ');
  return 'updated';
};

export const isLogPending = (log) => Boolean(log?.isPending);

/** Main timeline: submission-wide history (not attachment-level or view pings). */
export const filterTimelineLogs = (logs) =>
  (logs || []).filter((log) => {
    if (log.attachment_id) return false;

    const type = String(log.action_type || '').toLowerCase().trim();

    if (type === 'attachment_review' || type === 'viewed') return false;
    if (!type) return true;
    if (type === 'created') return false;

    return true;
  });

const sortVersionsAsc = (versions) =>
  [...(versions || [])].filter(Boolean).sort((a, b) => (a?.version_number || 0) - (b?.version_number || 0));

export const filterTimelineLogsForVersion = (logs, { allVersions = [], viewingVersionId = null, currentVersionId = null } = {}) => {
  const base = filterTimelineLogs(logs);

  if (!viewingVersionId || !currentVersionId || viewingVersionId === currentVersionId) {
    return base;
  }

  const versions = sortVersionsAsc(allVersions);
  const viewingVersion = versions.find((v) => v.id === viewingVersionId);
  if (!viewingVersion) return base;

  const viewingNum = viewingVersion.version_number || 1;
  const nextVersion = versions.find((v) => (v.version_number || 0) === viewingNum + 1);

  let cutoffMs = Infinity;
  if (nextVersion) {
    const resubmitLog = (logs || []).find((log) => {
      const type = String(log.action_type || '').toLowerCase();
      return type === 'resubmitted' && log.submission_version_id === nextVersion.id;
    });
    if (resubmitLog?.created_at) {
      cutoffMs = new Date(resubmitLog.created_at).getTime();
    } else if (nextVersion.created_at) {
      cutoffMs = new Date(nextVersion.created_at).getTime();
    }
  }

  return base.filter((log) => {
    const type = String(log.action_type || '').toLowerCase();
    const logVersionId = log.submission_version_id || null;
    const logMs = log.created_at ? new Date(log.created_at).getTime() : 0;

    if (type === 'resubmitted' && nextVersion && logVersionId === nextVersion.id) {
      return true;
    }

    if (logVersionId === viewingVersionId) {
      return logMs <= cutoffMs;
    }

    if (!logVersionId) {
      return logMs <= cutoffMs;
    }

    return false;
  });
};

export const isLogApproved = (log) => {
  if (log?.isPending) return false;
  const type = String(log?.action_type || '').toLowerCase();
  const review = String(log?.review_action || '').toLowerCase();
  return type === 'approved' || type === 'approve' || review === 'approved';
};

export const isLogReturned = (log) => {
  if (log?.isPending) return false;
  const type = String(log?.action_type || '').toLowerCase();
  const review = String(log?.review_action || '').toLowerCase();
  return type === 'returned' || review === 'returned';
};

const logText = (log) =>
  [log?.action_type, log?.review_action, log?.description, log?.comment, log?.workflow_phase]
    .map(norm)
    .join(' ');

const phaseMatchers = {
  chairman_review: (log) => {
    const type = norm(log?.action_type);
    const wp = norm(log?.workflow_phase);
    if (type === 'approved' && (wp.includes('chairman') || wp.includes('oso'))) return true;
    return false;
  },
  resubmitted: (log) => norm(log?.action_type) === 'resubmitted',
  forwarded_sds: (log) =>
    norm(log?.action_type) === 'forwarded' && logText(log).includes('sds coordinator'),
  approved_sds: (log) => {
    const type = norm(log?.action_type);
    const wp = norm(log?.workflow_phase);
    const role = norm(log?.users?.role);
    if (role === 'chairman' || role === 'vice-chairman' || wp.includes('chairman')) {
      return false;
    }
    return (
      type === 'approved' &&
      (role === 'admin' || wp.includes('sds') || logText(log).includes('approved by sds'))
    );
  },
  hardcopy_verification: (log) => {
    const type = norm(log?.action_type);
    const text = logText(log);
    return type === 'ready for hardcopy' || type === 'ready_for_hardcopy' || text.includes('ready for hardcopy');
  },
  approved_dean: (log) =>
    norm(log?.action_type) === 'approved' &&
    (logText(log).includes('dean') || norm(log?.workflow_phase).includes('dean')),
  forwarded_external: (log) =>
    norm(log?.action_type) === 'forwarded' &&
    (logText(log).includes('external') || logText(log).includes('main campus') || logText(log).includes('proof attachment')),
  approved_external: (log) =>
    norm(log?.action_type) === 'approved' && (logText(log).includes('external') || logText(log).includes('main campus')),
  ready_for_retrieval: (log) => {
    const type = norm(log?.action_type);
    const review = norm(log?.review_action);
    return (
      type === 'ready for retrieval' ||
      review === 'ready for retrieval' ||
      review === 'ready-for-retrieval' ||
      type === 'document retrieved' ||
      review === 'document retrieved' ||
      review === 'document-retrieved' ||
      logText(log).includes('ready for retrieval') ||
      logText(log).includes('document retrieved')
    );
  },
  document_retrieved: (log) => {
    const type = norm(log?.action_type);
    const review = norm(log?.review_action);
    return (
      type === 'document retrieved' ||
      review === 'document retrieved' ||
      review === 'document-retrieved' ||
      logText(log).includes('document retrieved')
    );
  },
  accomplishment_report: (log) => {
    const type = norm(log?.action_type);
    const review = norm(log?.review_action);
    return (
      type === 'accomplishment report' ||
      review.includes('accomplishment') ||
      logText(log).includes('accomplishment report')
    );
  }
};

const STATUS_TO_NEXT_PHASE = {
  submitted: 'chairman_review',
  pending: 'chairman_review',
  'oso staff review': 'chairman_review',
  returned: 'resubmitted',
  'sds coordinator review': 'approved_sds',
  'to forward': 'hardcopy_verification',
  'dean review': 'approved_dean',
  'dean approved': 'forwarded_external',
  'main campus review': 'approved_external',
  approved: 'ready_for_retrieval',
  'ready for retrieval': 'document_retrieved',
  'waiting for accomplishment report': 'accomplishment_report'
};

const PENDING_PHASE_TEMPLATES = {
  chairman_review: {
    action_type: 'approved',
    review_action: 'approved',
    workflow_phase: 'Chairman Review',
    description: 'Awaiting review and approval by Chairman or Vice Chairman.',
    users: { full_name: 'Pending', role: 'chairman' },
    displayName: 'Chairman / Vice Chairman',
    displayRole: 'CHAIRMAN'
  },
  resubmitted: {
    action_type: 'resubmitted',
    workflow_phase: 'submission',
    description: 'Awaiting resubmission by Organization President.',
    users: { full_name: 'Pending', role: 'org-president' },
    displayName: 'Organization President',
    displayRole: 'ORG-PRESIDENT'
  },
  forwarded_sds: {
    action_type: 'forwarded',
    workflow_phase: 'sds-review',
    description: 'Forwarded to SDS Coordinator (Admin) by Chairman',
    users: { full_name: 'Pending', role: 'chairman' },
    displayName: 'Chairman / Vice Chairman',
    displayRole: 'CHAIRMAN'
  },
  approved_sds: {
    action_type: 'approved',
    workflow_phase: 'sds-review',
    description: 'Approved by SDS Coordinator',
    users: { full_name: 'Teresita delacruz', role: 'admin' },
    displayName: 'Teresita delacruz',
    displayRole: 'admin'
  },
  hardcopy_verification: {
    action_type: 'ready_for_hardcopy',
    workflow_phase: 'sds-review',
    description: 'Awaiting physical hardcopy verification and approval by SDS Coordinator / Admin.',
    users: { full_name: 'Pending Hardcopy Verification', role: 'admin' },
    displayName: 'SDS Coordinator (Admin)',
    displayRole: 'ADMIN'
  },
  approved_dean: {
    action_type: 'approved',
    workflow_phase: 'dean-review',
    description: 'Approved by Dean',
    users: { full_name: 'Final In-Campus review', role: 'dean' },
    displayName: 'Final In-Campus review',
    displayRole: 'DEAN'
  },
  forwarded_external: {
    action_type: 'forwarded',
    workflow_phase: 'main-campus-review',
    description: 'Proof attachment and forward to Main Campus for approval',
    users: { full_name: 'Pending', role: 'admin' },
    displayName: 'SDS Coordinator',
    displayRole: 'ADMIN'
  },
  approved_external: {
    action_type: 'approved',
    workflow_phase: 'main-campus-review',
    description: 'Approved by Main Campus',
    users: { full_name: 'Pending', role: 'admin' },
    displayName: 'SDS Coordinator',
    displayRole: 'ADMIN'
  },
  ready_for_retrieval: {
    action_type: 'ready_for_retrieval',
    review_action: 'ready-for-retrieval',
    workflow_phase: 'main-campus-review',
    description: 'Document is ready for retrieval',
    users: { full_name: 'Pending', role: 'admin' },
    displayName: 'SDS Coordinator',
    displayRole: 'ADMIN'
  },
  document_retrieved: {
    action_type: 'document_retrieved',
    review_action: 'document-retrieved',
    workflow_phase: 'approved',
    description: 'Document retrieved by Organization President',
    users: { full_name: 'Pending', role: 'org-president' },
    displayName: 'Organization President',
    displayRole: 'ORG-PRESIDENT'
  },
  accomplishment_report: {
    action_type: 'accomplishment_report',
    review_action: 'accomplishment-report-submitted',
    workflow_phase: 'approved',
    description: 'Accomplishment report submission',
    users: { full_name: 'Pending', role: 'org-president' },
    displayName: 'Organization President',
    displayRole: 'ORG-PRESIDENT'
  }
};

const isTerminalStatus = (status) => {
  const s = norm(status);
  return s === 'completed' || s.includes('disapproved') || s === 'rejected';
};

export const appendPendingTimelinePhase = (realLogs, { submissionStatus, isViewingLatestVersion = true } = {}) => {
  if (!isViewingLatestVersion || !realLogs) return realLogs || [];

  const status = norm(submissionStatus);
  if (isTerminalStatus(status)) return realLogs;

  const phaseId = STATUS_TO_NEXT_PHASE[status];
  if (!phaseId) return realLogs;

  const matcher = phaseMatchers[phaseId];
  if (matcher && realLogs.some(matcher)) return realLogs;

  const template = PENDING_PHASE_TEMPLATES[phaseId];
  if (!template) return realLogs;

  const pendingLog = {
    id: `pending-${phaseId}`,
    isPending: true,
    pendingPhaseId: phaseId,
    action_type: template.action_type,
    review_action: template.review_action || null,
    workflow_phase: template.workflow_phase || null,
    description: template.description,
    comment: template.description,
    users: template.users,
    displayName: template.displayName,
    displayRole: template.displayRole,
    created_at: null
  };

  return [pendingLog, ...realLogs];
};

export const buildTimelineDisplayLogs = (
  logs,
  { submissionStatus, allVersions, viewingVersionId, currentVersionId } = {}
) => {
  const isViewingLatestVersion =
    !viewingVersionId || !currentVersionId || viewingVersionId === currentVersionId;

  const realLogs =
    allVersions?.length && viewingVersionId && currentVersionId
      ? filterTimelineLogsForVersion(logs, { allVersions, viewingVersionId, currentVersionId })
      : filterTimelineLogs(logs);

  const displayLogs = appendPendingTimelinePhase(realLogs, {
    submissionStatus,
    isViewingLatestVersion
  });

  const historyCount = displayLogs.filter((log) => !isLogPending(log)).length;

  return { displayLogs, historyCount, realLogs };
};

export const getTimelineActorDisplay = (log) => {
  if (log?.isPending) {
    if (log.pendingPhaseId === 'approved_sds') {
      return {
        name: 'Teresita delacruz',
        role: 'Admin'
      };
    }
    return {
      name: log.displayName || log.users?.full_name || 'Pending',
      role: log.displayRole || log.users?.role || 'Pending'
    };
  }

  const rawRole = (log?.users?.role || '').toLowerCase().trim();
  let roleLabel = log?.users?.role || 'User';

  if (rawRole === 'oso-staff') roleLabel = 'OSO Staff';
  else if (rawRole === 'admin') roleLabel = 'Admin';
  else if (rawRole === 'chairman') roleLabel = 'Chairman';
  else if (rawRole === 'vice-chairman') roleLabel = 'Vice Chairman';
  else if (rawRole === 'org-president') roleLabel = 'Org President';
  else if (rawRole === 'dean') roleLabel = 'Dean';

  return {
    name: log?.users?.full_name || log?.displayName || 'System',
    role: roleLabel
  };
};

export const parseObjectivesList = (objectives) => {
  if (!objectives) return [];

  let items = objectives;
  if (typeof items === 'string') {
    const trimmed = items.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        items = JSON.parse(trimmed);
      } catch (e) {
        items = trimmed;
      }
    }
  }

  if (typeof items === 'string') {
    if (items.includes('\n')) {
      items = items.split('\n').map((s) => s.trim()).filter(Boolean);
    } else if (items.includes(',')) {
      items = items.split(',').map((s) => s.trim()).filter(Boolean);
    } else {
      items = [items.trim()];
    }
  }

  if (Array.isArray(items)) {
    return items
      .map((item) => String(item || '').replace(/^[•\-\*\s]+/, '').trim())
      .filter(Boolean);
  }

  return [];
};

export const calculateProposalDuration = (proposalDetails) => {
  if (!proposalDetails) return '—';

  const schedules = proposalDetails.schedules || proposalDetails.activity_schedules || [];

  if (Array.isArray(schedules) && schedules.length > 0) {
    const durations = schedules.map(sched => {
      // Check if it's a date range
      if (sched.end_date && sched.activity_date) {
        const start = new Date(sched.activity_date);
        const end = new Date(sched.end_date);
        const diffMs = end - start;
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays > 0) {
          return `${diffDays} day${diffDays > 1 ? 's' : ''}`;
        } else if (diffDays === 0) {
          return `1 day`;
        }
      }

      // Check if indefinite
      if (sched.is_indefinite) {
        return 'INDEFINITE';
      }

      // Check single date duration_minutes or start_time/end_time
      let mins = sched.duration_minutes;
      if (!mins && sched.start_time && sched.end_time) {
        try {
          const start = new Date(`1970-01-01T${sched.start_time}`);
          const end = new Date(`1970-01-01T${sched.end_time}`);
          let diff = (end - start) / (1000 * 60);
          if (diff < 0) diff += 24 * 60;
          mins = Math.round(diff);
        } catch (e) {}
      }

      if (mins && mins > 0) {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        let res = [];
        if (h > 0) res.push(`${h} hour${h > 1 ? 's' : ''}`);
        if (m > 0) res.push(`${m} minute${m > 1 ? 's' : ''}`);
        return res.join(' and ') || `${mins} mins`;
      }

      return null;
    }).filter(Boolean);

    if (durations.length > 0) {
      return durations.join(' | ');
    }
  }

  // Fallback checks on legacy proposalDetails properties if any
  if (proposalDetails.is_indefinite_end_time) return 'INDEFINITE';
  if (proposalDetails.duration) {
    const num = parseFloat(proposalDetails.duration);
    if (!isNaN(num) && num > 0) {
      const mins = Math.round(num * 60);
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      let res = [];
      if (h > 0) res.push(`${h} hour${h > 1 ? 's' : ''}`);
      if (m > 0) res.push(`${m} minute${m > 1 ? 's' : ''}`);
      return res.join(' and ') || '';
    }
  }

  return '—';
};


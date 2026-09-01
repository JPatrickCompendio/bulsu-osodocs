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
    if (type === 'ready for hardcopy' || type === 'ready_for_hardcopy' || text.includes('ready for hardcopy')) return true;
    if (text.includes('hard copy verified') || text.includes('hardcopy verified')) return true;
    return false;
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
  'oso review': 'chairman_review',
  'oso approved': 'approved_sds',

  'sds coordinator review': 'approved_sds',
  'sds review': 'approved_sds',
  'sds approved': 'chairman_review',

  'chairman review': 'approved_sds',
  'chairman approved': 'approved_sds',
  'chairman and vice chairman review': 'approved_sds',
  'vice chairman approved': 'hardcopy_verification',

  'to forward': 'hardcopy_verification',
  'pending hard copy': 'hardcopy_verification',
  'pending hardcopy': 'hardcopy_verification',
  'hardcopy submission': 'hardcopy_verification',

  'dean review': 'approved_dean',
  'dean approved': 'forwarded_external',
  'final local campus review': 'approved_dean',
  'final in-campus review': 'approved_dean',

  'main campus review': 'approved_external',
  'sent to main campus': 'approved_external',
  'external approved': 'ready_for_retrieval',

  approved: 'ready_for_retrieval',
  'ready for retrieval': 'document_retrieved',
  'ready-for-retrieval': 'document_retrieved',

  'waiting for accomplishment report': 'accomplishment_report',
  'accomplishment report': 'accomplishment_report',

  returned: 'resubmitted'
};

const PHASE_SEQUENCE = [
  'chairman_review',
  'approved_sds',
  'hardcopy_verification',
  'approved_dean',
  'forwarded_external',
  'approved_external',
  'ready_for_retrieval',
  'document_retrieved',
  'accomplishment_report'
];

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
    description: 'Awaiting review and approval by SDS Coordinator.',
    users: { full_name: 'Pending SDS Review', role: 'admin' },
    displayName: 'SDS Coordinator (Admin)',
    displayRole: 'ADMIN'
  },
  hardcopy_verification: {
    action_type: 'ready_for_hardcopy',
    workflow_phase: 'sds-review',
    description: 'Awaiting physical hardcopy verification and approval by SDS Coordinator / Admin.\n\nTake note: Please print all required document attachments and secure the necessary physical wet signatures from OSO Staff before submitting the hard copy for physical verification.',
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

  const latestResubmitIdx = (realLogs || []).findIndex(l => {
    const at = norm(l.action_type);
    const desc = norm(l.description);
    return at === 'resubmitted' || at === 'resubmit' || desc.includes('resubmitted');
  });
  const cycleLogs = latestResubmitIdx >= 0 ? (realLogs || []).slice(0, latestResubmitIdx + 1) : (realLogs || []);

  const hasHardcopyVerifiedLog = cycleLogs.some(log => {
    const text = logText(log);
    return text.includes('hard copy verified') || text.includes('hardcopy verified');
  });

  let status = norm(submissionStatus);
  if ((status === 'to forward' || status === 'pending hard copy' || status === 'pending hardcopy' || status === 'hardcopy submission') && hasHardcopyVerifiedLog) {
    status = 'ready for retrieval';
  }

  if (isTerminalStatus(status)) return realLogs;

  // Special check for Document Retrieval confirmation pending step
  const hasDocumentRetrievedLog = cycleLogs.some(log => {
    const text = logText(log);
    const at = norm(log.action_type);
    const ra = norm(log.review_action);
    return text.includes('document retrieved') || at === 'document_retrieved' || ra === 'document_retrieved';
  });

  const hasConfirmRetrievalLog = cycleLogs.some(log => {
    const text = logText(log);
    const at = norm(log.action_type);
    const ra = norm(log.review_action);
    return text.includes('retrieval confirmed') || text.includes('confirmed retrieval') || at === 'confirm_retrieval' || ra === 'confirm_retrieval';
  });

  if (hasDocumentRetrievedLog && !hasConfirmRetrievalLog) {
    const firstRetrievalLog = (realLogs || []).find(log => {
      const text = logText(log);
      const at = norm(log.action_type);
      const ra = norm(log.review_action);
      return text.includes('document retrieved') || at === 'document_retrieved' || ra === 'document_retrieved';
    });

    const firstUserRole = norm(firstRetrievalLog?.users?.role);
    const isFirstRetrieverAdmin = firstUserRole.includes('admin') || firstUserRole.includes('sds') || firstUserRole.includes('oso');

    const adminLog = (realLogs || []).find(log => {
      const r = norm(log.users?.role);
      return r === 'admin' || r === 'sds-coordinator' || r === 'sds coordinator';
    });

    const adminName = adminLog?.users?.full_name || adminLog?.displayName || 'Teresita Dela Cruz';

    const orgLog = (realLogs || []).find(log => {
      const r = norm(log.users?.role);
      return r === 'org-president' || r === 'org president';
    });

    const orgName = firstRetrievalLog?.submissions?.users?.abbreviation ||
      firstRetrievalLog?.submissions?.users?.org_name ||
      orgLog?.users?.full_name ||
      'Organization President';

    const pendingConfirmLog = {
      id: 'pending-confirm_retrieval',
      isPending: true,
      pendingPhaseId: 'confirm_retrieval',
      action_type: 'confirm_retrieval',
      workflow_phase: 'Document Retrieval',
      description: isFirstRetrieverAdmin
        ? `Awaiting retrieval confirmation by ${orgName}.`
        : `Awaiting retrieval confirmation by ${adminName}.`,
      comment: isFirstRetrieverAdmin
        ? `Awaiting retrieval confirmation by ${orgName}.`
        : `Awaiting retrieval confirmation by ${adminName}.`,
      users: isFirstRetrieverAdmin
        ? { full_name: orgName, role: 'org-president' }
        : { full_name: adminName, role: 'admin' },
      displayName: isFirstRetrieverAdmin ? orgName : adminName,
      displayRole: isFirstRetrieverAdmin ? 'ORG-PRESIDENT' : 'ADMIN',
      created_at: null
    };

    return [pendingConfirmLog, ...realLogs];
  }

  let phaseId = STATUS_TO_NEXT_PHASE[status];

  if (!phaseId) {
    phaseId = PHASE_SEQUENCE.find(p => {
      const matcher = phaseMatchers[p];
      return matcher ? !realLogs.some(matcher) : false;
    });
  } else if (phaseId !== 'resubmitted') {
    let matcher = phaseMatchers[phaseId];
    if (matcher && realLogs.some(matcher)) {
      const idx = PHASE_SEQUENCE.indexOf(phaseId);
      if (idx >= 0) {
        const nextUncompleted = PHASE_SEQUENCE.slice(idx + 1).find(p => {
          const m = phaseMatchers[p];
          return m ? !realLogs.some(m) : false;
        });
        if (nextUncompleted) {
          phaseId = nextUncompleted;
        }
      }
    }
  }

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
    } else if (items.trim()) {
      items = [items.trim()];
    } else {
      items = [];
    }
  }

  if (Array.isArray(items)) {
    // Detect and auto-repair arrays that were corrupted into single characters e.g. ['[', '"', 'O', 'r', ...]
    const isShredded = items.length > 1 && items.every((x) => typeof x === 'string' && x.length <= 1);
    if (isShredded) {
      const joined = items.join('');
      if (joined.startsWith('[') && joined.endsWith(']')) {
        try {
          const parsed = JSON.parse(joined);
          if (Array.isArray(parsed)) {
            return parsed.map((s) => String(s || '').replace(/^[•\-\*\s]+/, '').trim()).filter(Boolean);
          }
        } catch (e) {
          // ignore
        }
      }
      return [joined.replace(/^[\["'\s]+|[\]"'\s]+$/g, '').trim()].filter(Boolean);
    }

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
    const validScheds = schedules.filter(s => s && (s.activity_date || s.start_time || s.duration_minutes));

    // Check range schedule (start_date to end_date)
    const rangeSched = validScheds.find(s => s.activity_date && s.end_date && s.end_date !== s.activity_date);
    if (rangeSched) {
      try {
        const start = new Date(rangeSched.activity_date.split('T')[0]);
        const end = new Date(rangeSched.end_date.split('T')[0]);
        const diffMs = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
        if (diffDays > 0) {
          return `${diffDays} Day${diffDays > 1 ? 's' : ''}`;
        }
      } catch (e) {}
    }

    // Check multiple or single schedule dates
    const uniqueDates = Array.from(new Set(validScheds.map(s => s.activity_date ? s.activity_date.split('T')[0] : null).filter(Boolean)));
    
    if (uniqueDates.length > 1) {
      return `${uniqueDates.length} Days`;
    }

    // If 1 schedule date / single date
    if (validScheds.length === 1) {
      const sched = validScheds[0];
      if (sched.is_indefinite) return 'INDEFINITE';

      let totalMinutes = sched.duration_minutes || 0;
      if (!totalMinutes && sched.start_time && sched.end_time) {
        const start = new Date(`1970-01-01T${sched.start_time}`);
        const end = new Date(`1970-01-01T${sched.end_time}`);
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
          let diff = (end - start) / (1000 * 60);
          if (diff < 0) diff += 24 * 60;
          totalMinutes = Math.round(diff);
        }
      }

      if (totalMinutes > 0) {
        const hrs = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        const parts = [];
        if (hrs > 0) parts.push(`${hrs} Hour${hrs === 1 ? '' : 's'}`);
        if (mins > 0) parts.push(`${mins} Minute${mins === 1 ? '' : 's'}`);
        return parts.join(' ');
      }

      return '1 Day';
    } else if (validScheds.length > 1) {
      return `${validScheds.length} Days`;
    }
  }

  // Fallback checks on legacy proposalDetails properties
  if (proposalDetails.is_indefinite_end_time) return 'INDEFINITE';
  if (proposalDetails.duration) {
    const num = parseFloat(proposalDetails.duration);
    if (!isNaN(num) && num > 0) {
      const hrs = Math.floor(num);
      const mins = Math.round((num - hrs) * 60);
      if (num < 24) {
        const parts = [];
        if (hrs > 0) parts.push(`${hrs} Hour${hrs === 1 ? '' : 's'}`);
        if (mins > 0) parts.push(`${mins} Minute${mins === 1 ? '' : 's'}`);
        if (parts.length > 0) return parts.join(' ');
      }
      const days = Math.ceil(num / 24) || 1;
      return `${days} Day${days > 1 ? 's' : ''}`;
    }
    return String(proposalDetails.duration);
  }

  return '—';
};


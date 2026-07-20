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

  const review = String(log?.review_action || '').trim();
  const type = String(log?.action_type || '').trim();
  const desc = String(log?.description || '').trim();

  if (review) return review.replace(/-/g, ' ');
  if (type) return type.replace(/-/g, ' ');
  if (desc) return desc.length > 80 ? `${desc.slice(0, 80)}…` : desc;
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
  return type === 'approved' || review === 'approved';
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
    if (type === 'ready for hardcopy') return true;
    if (type === 'approved' && (wp.includes('chairman') || wp.includes('oso'))) return true;
    return false;
  },
  resubmitted: (log) => norm(log?.action_type) === 'resubmitted',
  forwarded_sds: (log) =>
    norm(log?.action_type) === 'forwarded' && logText(log).includes('sds coordinator'),
  approved_sds: (log) =>
    norm(log?.action_type) === 'approved' && logText(log).includes('sds coordinator'),
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
      logText(log).includes('ready for retrieval')
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
  'to forward': 'forwarded_sds',
  'sds coordinator review': 'approved_sds',
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
    users: { full_name: 'Pending', role: 'admin' },
    displayName: 'SDS Coordinator',
    displayRole: 'ADMIN'
  },
  approved_dean: {
    action_type: 'approved',
    workflow_phase: 'dean-review',
    description: 'Approved by Dean',
    users: { full_name: 'Dean Approval', role: 'dean' },
    displayName: 'Dean Approval',
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
    return {
      name: log.displayName || log.users?.full_name || 'Pending',
      role: log.displayRole || log.users?.role || 'Pending'
    };
  }

  if (norm(log?.workflow_phase).includes('dean')) {
    return { name: 'Dean Approval', role: 'Dean' };
  }

  return {
    name: log.users?.full_name || 'System',
    role: log.users?.role || 'System'
  };
};

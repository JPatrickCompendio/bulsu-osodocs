const COMPLETED_STATUSES = new Set(['completed', 'disapproved', 'rejected']);

const STAFF_INBOX_STATUSES = [
  'submitted',
  'pending',
  'oso staff review',
  'oso staff (pending report)',
  'pending report',
  'report review',
  'oso staff report review',
];

const INBOX_STATUSES_BY_ROLE = {
  admin: ['sds coordinator review', 'sds review', 'oso approved', 'pending hard copy', 'to forward'],
  chairman: STAFF_INBOX_STATUSES,
  'vice-chairman': STAFF_INBOX_STATUSES,
  'vice chairman': STAFF_INBOX_STATUSES,
  'oso-staff': STAFF_INBOX_STATUSES,
  'oso staff': STAFF_INBOX_STATUSES,
};

export const normalizeWorkflowStatus = (value) =>
  String(value || '').toLowerCase().trim();

export const getNotificationDestination = (role, submissionId, status) => {
  const normalizedRole = String(role || '').toLowerCase();
  const normalizedStatus = normalizeWorkflowStatus(status);

  if (COMPLETED_STATUSES.has(normalizedStatus)) {
    return {
      path: '/completed',
      state: { openDocId: submissionId },
    };
  }

  const inboxStatuses = INBOX_STATUSES_BY_ROLE[normalizedRole] || [];
  if (inboxStatuses.includes(normalizedStatus)) {
    return {
      path: '/inbox',
      state: { submissionId, highlightedId: submissionId },
    };
  }

  return {
    path: '/my-documents',
    state: { submissionId, highlightedId: submissionId, openSubmission: true },
  };
};

export const extractSubmissionIdFromNotification = (source = {}) =>
  source.submission_id ||
  source.submissions?.id ||
  (typeof source.submissions === 'object' && source.submissions !== null ? source.submissions.id : null);

export const extractSubmissionStatusFromNotification = (source = {}) =>
  source.submissions?.status || source.status || null;

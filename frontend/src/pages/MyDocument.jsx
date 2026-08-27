import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import * as subService from '../services/submissionService';
import { filterTimelineLogsForVersion, parseObjectivesList, calculateProposalDuration } from '../utils/submissionLogUtils';
import SubmissionTimeline from '../components/SubmissionTimeline';
import { apiFetch } from '../config/api';
import {
  Search,
  Filter,
  CheckCircle,
  Clock,
  AlertCircle,
  FileText,
  User,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Paperclip,
  X,
  RotateCcw,
  Calendar,
  Eye,
  ArrowUpRight,
  Lock,
  LogOut,
  FolderOpen,
  Pencil,
  Trash2
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { useToast } from '../hooks/useToast';

const getStatusColor = (status) => {
  const s = (status || '').toLowerCase().trim();
  if (s.includes('pending hard copy') || s.includes('pending hardcopy') || s.includes('to forward') || s.includes('hardcopy submission') || s.includes('hard copy submission') || s.includes('hardcopy')) {
    return '#db2777';
  }
  if (s.includes('chairman') || s.includes('vice chairman') || s.includes('oso staff review') || s.includes('oso staff') || s.includes('pending')) {
    return '#c2bc13';
  }
  if (s.includes('sds coordinator review') || s.includes('sds review') || s.includes('sds')) {
    return '#6366f1';
  }
  if (s.includes('dean review') || s.includes('final in-campus review') || s.includes('final in-campus')) {
    return '#1e3a8a';
  }
  if (s.includes('dean approved')) {
    return '#1d4ed8';
  }
  if (s.includes('main campus review')) {
    return '#d76b0d';
  }
  if (s.includes('waiting for accomplishment report')) {
    return '#0ea5e9';
  }
  if (s === 'approved') {
    return '#105220';
  }
  if (s.includes('ready for retrieval') || s.includes('for retrieval') || s.includes('ready_for_retrieval')) {
    return '#9333ea';
  }
  if (s.includes('disapproved') || s.includes('rejected')) {
    return '#ef4444';
  }
  if (s === 'returned') {
    return '#f59e0b';
  }
  if (s === 'completed') {
    return '#22b814';
  }
  return '#6b7280';
};

const fetchPreviewTrackingNumber = async (userId, docTypeName = 'Activity Proposal') => {
  try {
    const { data: userData } = await supabase.from('users').select('abbreviation').eq('id', userId).single();
    const orgAbbr = userData?.abbreviation || 'ORG';
    const prefix = (docTypeName || 'Activity Proposal')
      .split(' ')
      .map(w => w[0].toUpperCase())
      .join('');

    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const baseString = `${prefix}-${orgAbbr}-${year}-${month}`;

    const { data: existing } = await supabase
      .from('submissions')
      .select('tracking_number')
      .ilike('tracking_number', `${baseString}-%`);

    let maxIncrement = 0;
    if (existing && existing.length > 0) {
      existing.forEach(sub => {
        if (sub.tracking_number) {
          const parts = sub.tracking_number.split('-');
          const lastNum = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(lastNum) && lastNum > maxIncrement) {
            maxIncrement = lastNum;
          }
        }
      });
    }
    const nextIncrement = maxIncrement + 1;
    return `${baseString}-${nextIncrement}`;
  } catch (e) {
    console.error('Failed to fetch preview tracking number for draft:', e);
    return null;
  }
};

const MY_DOCS_SUBMISSION_SELECT = `
  *,
  users (org_name, abbreviation, student_no, full_name, role),
  documentType (name),
  document_subtypes (name),
  submission_versions!submission_id (
    *,
    activity_proposal_details (*, activity_schedules (*)),
    submission_attachments (*, requirements(*))
  )
`;

const buildMyDocumentRow = (submission, latestLog, user, activeSy, subtypesMap = {}) => {
  const docTypeName = submission.documentType?.name || 'Document';
  const isActivityProposal = docTypeName.toLowerCase() === 'activity proposal' || docTypeName.toLowerCase().includes('proposal');

  const version = Array.isArray(submission.submission_versions)
    ? (submission.submission_versions.find((v) => v.id === submission.current_version_id) || submission.submission_versions[0])
    : submission.submission_versions;
  const details = isActivityProposal
    ? (Array.isArray(version?.activity_proposal_details)
      ? version.activity_proposal_details[version.activity_proposal_details.length - 1]
      : version?.activity_proposal_details)
    : null;

  const orgName = (submission.users?.abbreviation && submission.users.abbreviation.trim())
    ? submission.users.abbreviation.trim()
    : (details?.organization_name || submission.users?.org_name || user?.abbreviation || user?.org_name || '-');
  const rawTargetDate = details?.target_date || '-';
  let targetDate = rawTargetDate;
  if (rawTargetDate && rawTargetDate !== '-') {
    try {
      targetDate = new Date(rawTargetDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch (_) { /* ignore */ }
  }

  let proposalTypeStr = '-';
  if (submission?.subtype_id && subtypesMap[submission.subtype_id]) {
    proposalTypeStr = subtypesMap[submission.subtype_id].name;
  } else if (submission?.proposal_type) {
    const rawType = submission.proposal_type;
    if (rawType.toLowerCase() === 'in-campus') proposalTypeStr = 'In-Campus';
    else if (rawType.toLowerCase() === 'off-campus') proposalTypeStr = 'Off-Campus';
    else proposalTypeStr = rawType.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  const proposalTitle = details?.activity_title || '-';
  const wp = latestLog?.workflow_phase || '';
  const ra = latestLog?.review_action || '';
  const normalizeText = (value) =>
    String(value || '').toLowerCase().replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim();
  const subStatus = normalizeText(submission.status);
  const wpNorm = normalizeText(wp);

  let category = 'All';
  if (subStatus === 'returned') category = 'Returned';
  else if (subStatus === 'to forward') category = user?.role === 'org-president' ? 'Hard Copy Submission' : 'Pending Hard Copy';
  else if (subStatus === 'submitted' || subStatus === 'pending') category = 'OSO Staff review';
  else if (subStatus.includes('sds')) category = 'SDS Review';
  else if (subStatus.includes('dean approved') || subStatus.includes('dean review') || subStatus.includes('external approved')) category = 'Final In-Campus review';
  else if (subStatus.includes('main campus review') || subStatus.includes('external review') || subStatus.includes('vice chairman approved')) category = 'Main Campus Review';
  else if (subStatus.includes('ready for retrieval') || subStatus.includes('document retrieval') || subStatus.includes('document retrieved') || subStatus.includes('retriev')) category = 'For Retrieval';
  else if (subStatus.includes('waiting for accomplishment report')) category = 'Approved';
  else if (subStatus === 'approved') category = 'Approved';
  else if (subStatus === 'completed') category = 'Completed';
  else if (subStatus.includes('disapproved') || subStatus.includes('rejected')) category = 'Disapproved';
  else {
    if (wpNorm === 'sds review') category = 'SDS Review';
    else if (wpNorm === 'dean review' || wpNorm === 'external approved') category = 'Final In-Campus review';
    else if (wpNorm === 'main campus review' || wpNorm === 'external review') category = 'Main Campus Review';
    else if (wpNorm === 'chairman review') category = 'Chairman Review';
    else if (ra === 'ready-for-hardcopy') category = user?.role === 'org-president' ? 'Hard Copy Submission' : 'Pending Hard Copy';
    else if (ra === 'ready-for-retrieval' || ra === 'document-retrieved' || ra === 'retrieval-confirmed') category = 'For Retrieval';
    else if (ra === 'approved') category = 'Approved';
    else if (ra === 'returned') category = 'Returned';
  }

  const submittedDate = new Date(submission.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const lastActionDate = new Date(latestLog?.created_at || submission.updated_at || submission.created_at).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return {
    id: submission.id,
    isActivityProposal,
    title: (isActivityProposal && proposalTitle && proposalTitle !== '-') ? proposalTitle : `${submission.users?.abbreviation || orgName} ${docTypeName}`.trim().toUpperCase(),
    ref: submission.tracking_number || (docTypeName.toLowerCase().includes('proposal') ? 'PENDING NO.' : 'DRAFT'),
    sender: orgName,
    type: docTypeName,
    submittedDate,
    status: submission.status === 'submitted'
      ? 'OSO STAFF REVIEW'
      : (submission.status === 'to forward'
        ? (user?.role === 'org-president' ? 'HARDCOPY SUBMISSION' : 'PENDING HARD COPY')
        : (submission.status === 'dean review'
          ? 'FINAL IN-CAMPUS REVIEW'
          : (submission.status ? submission.status.toUpperCase() : 'PENDING'))),
    lastAction: lastActionDate,
    category,
    proposal_title: proposalTitle,
    proposal_type: proposalTypeStr !== '-' ? proposalTypeStr : null,
    pic: details?.person_in_charge || '-',
    studentId: submission.users?.student_no || details?.student_id_number || '-',
    contact: details?.contact_number || '-',
    targetDate,
    targetTime: details?.target_time || '-',
    duration: calculateProposalDuration(details),
    schedules: details?.activity_schedules || [],
    students: details?.number_of_students || '-',
    nature: details?.nature_of_activity || '-',
    objectives: details?.objectives || null,
    satisfy_goals: [details?.satisfaction_goal_1, details?.satisfaction_goal_2, details?.satisfaction_goal_3].filter(Boolean),
    sponsors_partners: details?.sponsors_partners || [],
    satisfy_needs: details?.satisfy_needs || null,
    raw: submission,
  };
};

export const MyDocuments = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, refreshUser } = useAuth();

  const [showSuspendedModal, setShowSuspendedModal] = React.useState(false);
  const [adminEmail, setAdminEmail] = React.useState('');

  const isSuspended = user?.status?.startsWith('Suspended') && user?.role === 'org-president';

  React.useEffect(() => {
    if (isSuspended && showSuspendedModal) {
      apiFetch('/api/system/admin-email')
        .then(res => res.json())
        .then(data => {
          if (data?.email) {
            setAdminEmail(data.email);
          }
        })
        .catch(err => console.error('Error fetching admin email:', err));
    }
  }, [isSuspended, showSuspendedModal]);

  React.useEffect(() => {
    const handleSidebarClick = () => setSelectedDoc(null);
    window.addEventListener('sidebar-nav-click', handleSidebarClick);
    return () => window.removeEventListener('sidebar-nav-click', handleSidebarClick);
  }, []);

  const handleResubmitClick = () => {
    if (isSuspended) {
      setShowSuspendedModal(true);
    } else {
      setIsResubmitModalOpen(true);
    }
  };

  const handleContinueClick = () => {
    if (isSuspended) {
      setShowSuspendedModal(true);
    } else {
      navigate(`/submit?submissionId=${selectedDoc.id}`);
    }
  };

  const [isDeleteDraftModalOpen, setIsDeleteDraftModalOpen] = React.useState(false);
  const [isDeletingDraft, setIsDeletingDraft] = React.useState(false);

  const handleDeleteDraft = async () => {
    if (!selectedDoc?.id) return;
    try {
      setIsDeletingDraft(true);
      await subService.deleteDraftSubmission(selectedDoc.id);
      showToast('Draft document deleted successfully', 'success');
      setIsDeleteDraftModalOpen(false);
      setSelectedDoc(null);
      await fetchHandledLogs();
      window.dispatchEvent(new CustomEvent('my-docs-updated'));
      window.dispatchEvent(new CustomEvent('inbox-updated'));
      window.dispatchEvent(new CustomEvent('document-status-changed'));
    } catch (err) {
      console.error('Error deleting draft:', err);
      showToast(err.message || 'Failed to delete draft document', 'error');
    } finally {
      setIsDeletingDraft(false);
    }
  };

  const [activeTab, setActiveTab] = React.useState('All');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [mainCampusModalTab, setMainCampusModalTab] = React.useState('osas');
  const [docDetailTabFilter, setDocDetailTabFilter] = React.useState('all');
  const [loading, setLoading] = React.useState(true);
  const [logsData, setLogsData] = React.useState([]);
  const [highlightedDocId, setHighlightedDocId] = React.useState(null);
  const [subtypesMap, setSubtypesMap] = React.useState({});
  const [draftPreviewMap, setDraftPreviewMap] = React.useState({});

  React.useEffect(() => {
    const fetchSubtypes = async () => {
      const { data } = await supabase.from('document_subtypes').select('id, name');
      if (data) {
        const map = {};
        data.forEach(st => { map[st.id] = st; });
        setSubtypesMap(map);
      }
    };
    fetchSubtypes();
  }, []);

  React.useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const queryTargetId = searchParams.get('submissionId') || searchParams.get('id');
    const targetId = location.state?.submissionId || queryTargetId;

    if (targetId) {
      refreshSelectedDoc(targetId);
    }

    if (location.state?.highlightedId) {
      setHighlightedDocId(location.state.highlightedId);
      window.history.replaceState({}, document.title);
      const timer = setTimeout(() => {
        setHighlightedDocId(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [location.state, location.search]);

  // Detail View State
  const [selectedDoc, setSelectedDoc] = React.useState(null);
  const [documentTypes, setDocumentTypes] = React.useState([]);
  const [activeSy, setActiveSy] = React.useState(null);
  const [viewedDocs, setViewedDocs] = React.useState({});
  const { showToast, ToastComponent } = useToast();

  React.useEffect(() => {
    if (user?.id) {
      setViewedDocs(JSON.parse(localStorage.getItem(`my_docs_viewed_${user.id}`) || '{}'));
    }
  }, [user]);

  // Load document types
  React.useEffect(() => {
    const fetchSy = async () => {
      const { data } = await supabase
        .from('school_years')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();
      setActiveSy(data);
    };
    fetchSy();
  }, []);
  const [selectedVersionId, setSelectedVersionId] = React.useState(null);
  const [isFilesOpen, setIsFilesOpen] = React.useState(true);
  const [previewFile, setPreviewFile] = React.useState(null);
  const [filePreviewUrl, setFilePreviewUrl] = React.useState('');
  const [timelineLogs, setTimelineLogs] = React.useState([]);
  const [locallyApproved, setLocallyApproved] = React.useState([]);
  const [locallyReturned, setLocallyReturned] = React.useState({});
  const [attachmentReturnLogs, setAttachmentReturnLogs] = React.useState([]);
  const RETURN_REASONS = ['missing-requirements', 'incorrect-format', 'incomplete-information'];

  // Resubmit State
  const [isResubmitModalOpen, setIsResubmitModalOpen] = React.useState(false);
  const [resubmitFiles, setResubmitFiles] = React.useState({});
  const [isResubmitting, setIsResubmitting] = React.useState(false);

  // Action Modals State
  const [isReturnModalOpen, setIsReturnModalOpen] = React.useState(false);
  const [returnComments, setReturnComments] = React.useState('');
  const [decisionType, setDecisionType] = React.useState('return'); // 'return' or 'disapprove' or 'approve'
  const [reviewAction, setReviewAction] = React.useState('');
  const [reviewComments, setReviewComments] = React.useState('');
  const [attachmentSaving, setAttachmentSaving] = React.useState(false);
  const [attachmentSuccessModal, setAttachmentSuccessModal] = React.useState(null);
  const [isForwardModalOpen, setIsForwardModalOpen] = React.useState(false);
  const [externalProofFile, setExternalProofFile] = React.useState(null);
  const [externalProofUploading, setExternalProofUploading] = React.useState(false);
  const [isDeliveryProofModalOpen, setIsDeliveryProofModalOpen] = React.useState(false);
  const [deliveryProofUrl, setDeliveryProofUrl] = React.useState('');
  const [isAccomReportModalOpen, setIsAccomReportModalOpen] = React.useState(false);
  const [accomReportFiles, setAccomReportFiles] = React.useState([]);
  const [accomReportComments, setAccomReportComments] = React.useState('');
  const [accomplishmentReport, setAccomplishmentReport] = React.useState(null);
  const [accomplishmentImages, setAccomplishmentImages] = React.useState([]);
  const [accomParticipants, setAccomParticipants] = React.useState('');
  const [accomBenefitingGroup, setAccomBenefitingGroup] = React.useState('');
  const [accomResources, setAccomResources] = React.useState('');
  const [externalProofs, setExternalProofs] = React.useState([]);
  const [isDeanApproveSuccessModalOpen, setIsDeanApproveSuccessModalOpen] = React.useState(false);
  const normalizeRole = (role) => String(role || '').toLowerCase().replace('-', ' ').trim();
  const sameRole = (a, b) => normalizeRole(a) === normalizeRole(b);
  const formatReviewerRoleLabel = (role) => {
    const r = normalizeRole(role);
    if (r === 'admin') return 'SDS Coordinator';
    if (r === 'chairman') return 'Chairman';
    if (r.includes('vice chairman')) return 'Vice Chairman';
    return String(role || 'Reviewer').replace('-', ' ');
  };
  const isChairmanLikeReviewer = (role) =>
    sameRole(role, 'chairman') || sameRole(role, 'vice chairman');
  const normalizeCategory = (value) =>
    String(value || '')
      .toLowerCase()
      .replace(/[_-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const getDocStatusLower = (doc) =>
    normalizeCategory(doc?.raw?.status || doc?.status || '');

  const isReadyForOrgRetrieval = (doc) => {
    const status = getDocStatusLower(doc);
    const remarks = String(doc?.raw?.remarks || '').toLowerCase();
    return (
      status === 'ready for retrieval' ||
      (status === 'approved' && remarks.includes('ready for retrieval'))
    );
  };

  const isWaitingForAccomplishmentReport = (doc) =>
    getDocStatusLower(doc).includes('waiting for accomplishment report');

  const isImageUrl = (value) => /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(String(value || ''));

  const resolveExternalProofUrl = async (storagePath) => {
    const cleanPath = String(storagePath || '').replace(/^proof_path:/i, '').trim();
    if (!cleanPath) return '';
    try {
      const { data, error } = await supabase.storage.from('documents').createSignedUrl(cleanPath, 3600);
      if (!error && data?.signedUrl) return data.signedUrl;
    } catch (err) {
      console.error('Failed to resolve external proof URL:', err);
    }
    return '';
  };

  const getActiveVersionId = (doc, versionOverride = null) => {
    if (!doc?.raw) return null;
    return (
      versionOverride ||
      selectedVersionId ||
      doc.raw.current_version_id ||
      (Array.isArray(doc.raw.submission_versions)
        ? doc.raw.submission_versions[0]?.id
        : doc.raw.submission_versions?.id) ||
      null
    );
  };

  const getLatestAttachmentLog = (logs, attachmentId) =>
    (logs || []).find((log) => log.attachment_id === attachmentId);

  const getFileHistoryAttachmentIds = (file, allVersions) => {
    const ids = [];
    (allVersions || []).forEach((version) => {
      const attachments = Array.isArray(version?.submission_attachments) ? version.submission_attachments : [];
      attachments.forEach((att) => {
        if (file?.requirement_id && att?.requirement_id) {
          if (att.requirement_id === file.requirement_id) ids.push(att.id);
          return;
        }
        if (file?.file_name && att?.file_name && att.file_name === file.file_name) {
          ids.push(att.id);
        }
      });
    });
    return ids;
  };

  const getFileReturnHistory = (file, allVersions, logs) => {
    const ids = new Set(getFileHistoryAttachmentIds(file, allVersions));
    if (ids.size === 0) return [];
    return (logs || [])
      .filter((log) => ids.has(log.attachment_id))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  };

  const getStoragePath = (filePath) => {
    let path = String(filePath || '').trim();
    if (path.startsWith('http')) {
      const bucketMarker = '/documents/';
      const index = path.indexOf(bucketMarker);
      if (index !== -1) {
        path = path.substring(index + bucketMarker.length);
      }
    }
    const queryIndex = path.indexOf('?');
    if (queryIndex !== -1) {
      path = path.substring(0, queryIndex);
    }
    if (path.startsWith('documents/')) {
      path = path.substring('documents/'.length);
    }
    return path;
  };

  const getStoragePublicUrl = (filePath) => {
    const cleanPath = getStoragePath(filePath);
    const { data } = supabase.storage.from('documents').getPublicUrl(cleanPath);
    return data?.publicUrl || '';
  };

  const handleDownload = async (filePath, fileName) => {
    try {
      const cleanPath = getStoragePath(filePath);
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(cleanPath, 3600);
      if (error) throw error;
      if (!data?.signedUrl) throw new Error('No signed URL generated');

      const link = document.createElement('a');
      link.href = data.signedUrl;
      link.download = fileName;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Download failed:', error);
      showToast('Download failed. Please try again.');
    }
  };

  const loadAccomplishmentReport = async (submissionId) => {
    if (!submissionId) {
      setAccomplishmentReport(null);
      setAccomplishmentImages([]);
      return;
    }

    try {
      const { data: report, error: reportErr } = await supabase
        .from('activity_accomplishments')
        .select('id, submission_id, submitted_by, problems_encountered, submitted_at, created_at, updated_at')
        .eq('submission_id', submissionId)
        .maybeSingle();

      if (reportErr) throw reportErr;
      setAccomplishmentReport(report || null);

      if (!report) {
        setAccomplishmentImages([]);
        return;
      }

      const { data: files, error: listErr } = await supabase.storage
        .from('documents')
        .list(`accom-report/${submissionId}`);

      if (listErr) throw listErr;

      const imageFiles = (files || []).filter((file) => /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(file.name));
      const imageUrls = await Promise.all(
        imageFiles.map(async (file) => {
          const path = `accom-report/${submissionId}/${file.name}`;
          try {
            const { data } = await supabase.storage.from('documents').createSignedUrl(path, 3600);
            if (data?.signedUrl) return { ...file, url: data.signedUrl, path };
          } catch (signedErr) {
            console.warn('Signed URL unavailable for accomplishment image:', signedErr);
          }
          return { ...file, url: getStoragePublicUrl(path), path };
        })
      );

      setAccomplishmentImages(imageUrls.filter((item) => item.url));
    } catch (err) {
      console.error('Error loading accomplishment report details:', err);
      setAccomplishmentReport(null);
      setAccomplishmentImages([]);
      setAccomParticipants('');
      setAccomBenefitingGroup('');
      setAccomResources('');
    }
  };

  const loadExternalProofs = async (submissionId) => {
    if (!submissionId) {
      setExternalProofs([]);
      return;
    }

    try {
      const { data: files, error: listErr } = await supabase.storage
        .from('documents')
        .list(`external-proof/${submissionId}`);

      if (listErr) throw listErr;

      // Filter valid image and document files
      const proofFiles = (files || []).filter((file) => /\.(jpg|jpeg|png|gif|webp|bmp|pdf)$/i.test(file.name));

      const fileUrls = await Promise.all(
        proofFiles.map(async (file) => {
          const path = `external-proof/${submissionId}/${file.name}`;
          try {
            const { data } = await supabase.storage.from('documents').createSignedUrl(path, 3600);
            if (data?.signedUrl) return { ...file, url: data.signedUrl, path };
          } catch (signedErr) {
            console.warn('Signed URL unavailable for external proof:', signedErr);
          }
          return { ...file, url: getStoragePublicUrl(path), path };
        })
      );

      setExternalProofs(fileUrls.filter((item) => item.url));
    } catch (err) {
      console.error('Error loading external proofs:', err);
      setExternalProofs([]);
    }
  };

  const getAttachmentWorkflowPhase = (doc) => {
    const currentStatus = (doc?.raw?.status || doc?.status || '').toLowerCase();
    if (currentStatus.includes('main campus review')) return 'main-campus-review';
    if (currentStatus.includes('dean review') || currentStatus === 'dean approved') return 'dean-review';
    if (currentStatus.includes('sds')) return 'sds-review';
    return 'Chairman Review';
  };

  const getAttachmentReviewDisplay = (file, doc, activeVersion, allVersions, logs, approvedIds, returnedMap, currentUser) => {
    if (returnedMap[file.id]) {
      return {
        isApproved: false,
        returnedForDisplay: true,
        fileLog: null,
        localReturn: returnedMap[file.id]
      };
    }

    if (approvedIds.includes(file.id)) {
      return {
        isApproved: true,
        returnedForDisplay: false,
        fileLog: getLatestAttachmentLog(logs, file.id)
      };
    }

    const fileLog = getLatestAttachmentLog(logs, file.id);
    const reviewActionValue = String(fileLog?.review_action || '').toLowerCase();
    const isReturnedAttachment = RETURN_REASONS.includes(reviewActionValue);

    const currentVersionNumber = Number(activeVersion?.version_number || 1);
    const isResubmittedVersion = currentVersionNumber > 1;
    const previousVersion = (allVersions || []).find(
      (v) => Number(v?.version_number || 0) === (currentVersionNumber - 1)
    );
    const previousVersionAttachments = Array.isArray(previousVersion?.submission_attachments)
      ? previousVersion.submission_attachments
      : [];
    const prevAttachmentByRequirement = previousVersionAttachments.find((att) => {
      if (att?.requirement_id && file?.requirement_id) {
        return String(att.requirement_id) === String(file.requirement_id);
      }
      return !!att?.file_name && !!file?.file_name && att.file_name === file.file_name;
    });
    const existedInPreviousVersion = !!prevAttachmentByRequirement;
    const isModifiedInResubmission =
      existedInPreviousVersion && prevAttachmentByRequirement.file_url !== file.file_url;
    const unchangedFromPrevious = existedInPreviousVersion && !isModifiedInResubmission;

    const viewingLatestVersion = activeVersion?.id === doc.raw?.current_version_id;
    const docStatus = (viewingLatestVersion
      ? (doc.raw?.status || doc.status || '')
      : (activeVersion?.status || doc.raw?.status || doc.status || '')
    ).toLowerCase();

    const isActiveChairmanReview =
      docStatus === 'submitted' ||
      docStatus === 'oso staff review' ||
      docStatus === 'pending' ||
      docStatus === 'returned';

    const isToForwardStage = docStatus === 'to forward';

    const isChairmanStage = isActiveChairmanReview || isToForwardStage;

    const isReviewerStage =
      isChairmanStage ||
      docStatus.includes('sds') ||
      docStatus.includes('dean review') ||
      docStatus.includes('dean approved') ||
      docStatus.includes('main campus review');

    const isApprovedStage =
      docStatus === 'dean approved' ||
      docStatus === 'approved' ||
      docStatus.includes('ready for retrieval') ||
      docStatus.includes('waiting for accomplishment') ||
      docStatus === 'completed';

    const isReturnByCurrentReviewer =
      isReturnedAttachment &&
      ((fileLog?.user_id && fileLog.user_id === currentUser?.id) ||
        sameRole(fileLog?.users?.role, currentUser?.role));

    const returnedForDisplay = isChairmanStage
      ? isReturnedAttachment
      : (isReviewerStage ? isReturnByCurrentReviewer : false);

    const hasRevision = returnedForDisplay || (isActiveChairmanReview && isModifiedInResubmission);
    const historicalChairmanVersion = !viewingLatestVersion && isChairmanStage;

    let isApproved = approvedIds.includes(file.id);

    if (!isApproved) {
      if (historicalChairmanVersion) {
        // Browsing older versions: green unless explicitly returned
        isApproved = !returnedForDisplay;
      } else if (isToForwardStage || isApprovedStage) {
        // Passed review — carry forward as approved unless returned at this stage
        isApproved = !returnedForDisplay;
      } else if (isActiveChairmanReview) {
        isApproved =
          (fileLog && fileLog.review_action === 'approved') ||
          (isResubmittedVersion && unchangedFromPrevious && !hasRevision);
      } else if (isReviewerStage) {
        isApproved =
          (fileLog && fileLog.review_action === 'approved') ||
          !returnedForDisplay;
      }
    }

    return { isApproved, returnedForDisplay, hasRevision, fileLog };
  };

  const attachmentRequiresReview = (file, doc, activeVersion, allVersions, logs, approvedIds, returnedMap) => {
    const { isApproved } = getAttachmentReviewDisplay(
      file,
      doc,
      activeVersion,
      allVersions,
      logs,
      approvedIds,
      returnedMap,
      user
    );
    return !isApproved;
  };

  const persistLocalAttachmentReviews = async (activeVersionId) => {
    const now = new Date().toISOString();
    const workflowPhase = getAttachmentWorkflowPhase(selectedDoc);
    const logsToInsert = [];

    locallyApproved.forEach((attachmentId) => {
      logsToInsert.push({
        submission_id: selectedDoc.id,
        submission_version_id: activeVersionId,
        attachment_id: attachmentId,
        user_id: user.id,
        workflow_phase: workflowPhase,
        action_type: 'attachment_review',
        review_action: 'approved',
        description: 'Attachment approved',
        comment: null,
        created_at: now
      });
    });

    Object.entries(locallyReturned).forEach(([attachmentId, payload]) => {
      logsToInsert.push({
        submission_id: selectedDoc.id,
        submission_version_id: activeVersionId,
        attachment_id: attachmentId,
        user_id: user.id,
        workflow_phase: workflowPhase,
        action_type: 'attachment_review',
        review_action: payload.reviewAction,
        description: payload.comment || 'Attachment reviewed',
        comment: payload.comment || null,
        created_at: now
      });
    });

    if (logsToInsert.length === 0) return;
    const { error } = await supabase.from('submission_logs').insert(logsToInsert);
    if (error) throw error;
  };

  const handleSaveAttachmentFeedback = async () => {
    if (!previewFile || !selectedDoc || !reviewAction) return;
    setLocallyReturned((prev) => ({
      ...prev,
      [previewFile.id]: {
        reviewAction,
        comment: reviewComments
      }
    }));
    setLocallyApproved((prev) => prev.filter((id) => id !== previewFile.id));
    setReviewAction('');
    setReviewComments('');
    setPreviewFile(null);
    showToast('Attachment marked for return. Confirm via the footer Return button.');
  };

  const handleApproveAttachment = async () => {
    if (!previewFile || !selectedDoc) return;
    setLocallyApproved((prev) => [...new Set([...prev, previewFile.id])]);
    setLocallyReturned((prev) => {
      const next = { ...prev };
      delete next[previewFile.id];
      return next;
    });
    setReviewAction('');
    setReviewComments('');
    setPreviewFile(null);
    showToast('Attachment approved locally. Confirm via the footer action button.');
  };

  // Fetch timeline logs for detailed view
  const fetchTimelineLogs = async (submissionId) => {
    try {
      const { data, error } = await supabase
        .from('submission_logs')
        .select(`
          id,
          submission_id,
          submission_version_id,
          attachment_id,
          user_id,
          workflow_phase,
          action_type,
          review_action,
          description,
          comment,
          created_at,
          users (
            full_name,
            role
          )
        `)
        .eq('submission_id', submissionId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTimelineLogs(data || []);
    } catch (err) {
      console.error('Error fetching timeline logs:', err);
      setTimelineLogs([]);
    }
  };

  const fetchAttachmentReturnLogs = async (submissionId) => {
    if (!submissionId) {
      setAttachmentReturnLogs([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('submission_logs')
        .select(`
          id,
          submission_id,
          submission_version_id,
          attachment_id,
          review_action,
          comment,
          description,
          created_at,
          users (
            full_name,
            role
          )
        `)
        .eq('submission_id', submissionId)
        .eq('action_type', 'attachment_review')
        .in('review_action', RETURN_REASONS)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAttachmentReturnLogs(data || []);
    } catch (err) {
      console.error('Error fetching attachment return history:', err);
      setAttachmentReturnLogs([]);
    }
  };

  React.useEffect(() => {
    if (selectedDoc) {
      loadAccomplishmentReport(selectedDoc.id);
      loadExternalProofs(selectedDoc.id);
      const allVersions = Array.isArray(selectedDoc.raw?.submission_versions)
        ? [...selectedDoc.raw.submission_versions]
        : [selectedDoc.raw?.submission_versions].filter(Boolean);
      const currentVersionIdToUse = selectedVersionId || selectedDoc.raw?.current_version_id;
      const activeVersion = allVersions.find(v => v.id === currentVersionIdToUse) || allVersions[0];
      fetchTimelineLogs(selectedDoc.id);
      fetchAttachmentReturnLogs(selectedDoc.id);
      setLocallyApproved([]);
      setLocallyReturned({});
    } else {
      setTimelineLogs([]);
      setAttachmentReturnLogs([]);
      setLocallyApproved([]);
      setLocallyReturned({});
      setAccomplishmentReport(null);
      setAccomplishmentImages([]);
      setAccomParticipants('');
      setAccomBenefitingGroup('');
      setAccomResources('');
      setExternalProofs([]);
    }
  }, [selectedDoc, selectedVersionId]);

  // Fetch signed URL for preview
  React.useEffect(() => {
    const fetchUrl = async () => {
      if (!previewFile) {
        setFilePreviewUrl('');
        return;
      }
      const finalPath = getStoragePath(previewFile.file_url);

      try {
        const { data } = await supabase.storage
          .from('documents')
          .createSignedUrl(finalPath, 3600);

        if (data?.signedUrl) {
          setFilePreviewUrl(data.signedUrl);
          return;
        }
      } catch (e) {
        console.error('Failed to get signed URL:', e);
      }

      // Fallback
      const { data } = supabase.storage
        .from('documents')
        .getPublicUrl(finalPath);

      setFilePreviewUrl(data?.publicUrl || '');
    };
    fetchUrl();
  }, [previewFile]);

  // Fetch handled logs for current chairman


  const fetchHandledLogs = async () => {
    if (!user) return;
    try {
      setLoading(true);
      let data = [];

      // Org President view: show their own submissions (not only their logs)
      if (String(user?.role || '').toLowerCase() === 'org-president') {
        const { data: subs, error: subsErr } = await supabase
          .from('submissions')
          .select(`
            *,
            users (org_name, abbreviation, student_no, full_name, role),
            documentType (name),
            document_subtypes (name),
            submission_logs (created_at, action_type),
            submission_versions!submission_id (
              *,
              activity_proposal_details (*, activity_schedules (*)),
              submission_attachments (*, requirements(*))
            )
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (subsErr) throw subsErr;

        const activeSubs = (subs || []).filter((sub) => String(sub.status || '').toLowerCase() !== 'completed');

        const draftSubs = activeSubs.filter(sub => String(sub.status || '').toLowerCase() === 'draft' && !sub.tracking_number);
        if (draftSubs.length > 0) {
          const previewNum = await fetchPreviewTrackingNumber(user.id, 'Activity Proposal');
          if (previewNum) {
            const newMap = {};
            draftSubs.forEach(s => { newMap[s.id] = previewNum; });
            setDraftPreviewMap(newMap);
          }
        }

        // Normalize into the same shape expected by the existing mapper (logsData items with `.submissions`)
        data = activeSubs.map((sub) => {
          const logs = (sub.submission_logs || []).filter(l => l.action_type !== 'viewed');
          const maxLogDate = logs.length > 0 ? new Date(Math.max(...logs.map(l => new Date(l.created_at)))).toISOString() : null;
          return {
            id: `sub-${sub.id}`,
            submission_id: sub.id,
            created_at: maxLogDate || sub.updated_at || sub.created_at,
            workflow_phase: null,
            review_action: null,
            action_type: null,
            submissions: sub
          };
        });

        setLogsData(data);
        return;
      }

      const { data: primaryData, error } = await supabase
        .from('submission_logs')
        .select(`
          *,
          submissions (
            *,
            users (org_name, abbreviation, student_no),
            documentType (name),
            document_subtypes (name),
            submission_versions!submission_id (
              *,
              activity_proposal_details (*, activity_schedules (*)),
              submission_attachments (*, requirements(*))
            )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn("Attempting fallback query due to join error:", error.message);
        const fallbackRes = await supabase
          .from('submission_logs')
          .select(`
            *,
            submissions (
              *,
              users (org_name, abbreviation, student_no),
              documentType (name),
              document_subtypes (name),
              submission_versions!submission_id (
                *,
                activity_proposal_details (*, activity_schedules (*)),
                submission_attachments (*, requirements(*))
              )
            )
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (fallbackRes.error) throw fallbackRes.error;
        data = fallbackRes.data;
      } else {
        data = primaryData;
      }

      const filteredData = (data || []).filter(item => {
        const subStatus = String(item.submissions?.status || '').toLowerCase();
        return subStatus !== 'completed';
      });

      setLogsData(filteredData);
    } catch (err) {
      console.error('Error fetching My Documents logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshSelectedDoc = async (submissionId) => {
    if (!submissionId) return;
    try {
      await fetchTimelineLogs(submissionId);
      await fetchHandledLogs();
      const { data: sub, error } = await supabase
        .from('submissions')
        .select(`
          *,
          users (org_name, abbreviation, student_no, full_name, role),
          documentType (name),
          document_subtypes (name),
          submission_logs (created_at, action_type, description, workflow_phase, review_action, users (full_name, role)),
          submission_versions!submission_id (
            *,
            activity_proposal_details (*, activity_schedules (*)),
            submission_attachments (*, requirements(*))
          )
        `)
        .eq('id', submissionId)
        .single();

      if (!error && sub) {
        const logs = (sub.submission_logs || []).filter(l => l.action_type !== 'viewed');
        const latestLog = logs.length > 0
          ? logs.reduce((latest, current) => new Date(current.created_at) > new Date(latest.created_at) ? current : latest)
          : null;
        const updatedRow = buildMyDocumentRow(sub, latestLog, user, activeSy, subtypesMap);
        setSelectedDoc(updatedRow);
      }
    } catch (err) {
      console.error('Error refreshing selected document:', err);
    }
  };

  React.useEffect(() => {
    if (!selectedDoc?.id) return;

    const channel = supabase
      .channel(`doc-updates-${selectedDoc.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'submission_logs',
          filter: `submission_id=eq.${selectedDoc.id}`
        },
        () => {
          refreshSelectedDoc(selectedDoc.id);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'submissions',
          filter: `id=eq.${selectedDoc.id}`
        },
        () => {
          refreshSelectedDoc(selectedDoc.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedDoc?.id]);

  const handleReturnSubmission = async (comments = '') => {
    if (!selectedDoc) return;
    try {
      setLoading(true);
      const activeVersionId = selectedDoc.raw?.current_version_id ||
        (Array.isArray(selectedDoc.raw?.submission_versions)
          ? selectedDoc.raw?.submission_versions[0]?.id
          : selectedDoc.raw?.submission_versions?.id);

      await persistLocalAttachmentReviews(activeVersionId);
      await subService.transitionSubmission(selectedDoc.id, 'return', comments, [], user?.id);

      setIsReturnModalOpen(false);
      setReturnComments('');
      setLocallyApproved([]);
      setLocallyReturned({});
      setSelectedDoc(null);
      await fetchHandledLogs();
      showToast('Submission returned for edits successfully!');
    } catch (err) {
      console.error('Error returning submission:', err);
      showToast(err.message || 'Failed to return submission.');
    } finally {
      setLoading(false);
    }
  };

  const handleResubmit = async () => {
    if (!selectedDoc) return;
    try {
      setIsResubmitting(true);

      const currentVersion = Array.isArray(selectedDoc.raw?.submission_versions)
        ? (selectedDoc.raw?.submission_versions.find(v => v.id === selectedDoc.raw?.current_version_id) || selectedDoc.raw?.submission_versions[0])
        : selectedDoc.raw?.submission_versions;

      const oldVersionId = currentVersion.id;
      const submissionId = selectedDoc.id;

      // Find returned attachments
      const returnedAttachments = currentVersion.submission_attachments?.filter(file => {
        const fileLog = timelineLogs.find(log => log.attachment_id === file.id);
        return fileLog && fileLog.review_action !== 'approved';
      }) || [];

      const returnedAttachmentIds = returnedAttachments.map(a => a.id);

      // Validate all returned files have replacements
      if (Object.keys(resubmitFiles).length < returnedAttachments.length) {
        showToast('Please upload all required replacements.');
        return;
      }

      // 1. Create new version
      const newVersion = await subService.createNewVersion(submissionId, oldVersionId, user.id);

      // 2. Copy over approved attachments
      await subService.copyApprovedAttachments(oldVersionId, newVersion.id, returnedAttachmentIds, submissionId);

      // 3. Upload new attachments
      for (const reqId of Object.keys(resubmitFiles)) {
        const file = resubmitFiles[reqId];
        const proposalType = selectedDoc.proposal_type || null;
        const path = await subService.uploadSubmissionFile(file, selectedDoc.type, submissionId, newVersion.version_number, proposalType);
        await subService.saveAttachmentRecord(newVersion.id, reqId, file.name, path);
      }

      // 4. Invoke authoritative resubmission backend API transition
      await subService.resubmitSubmission(submissionId, user.id, oldVersionId);

      setIsResubmitModalOpen(false);
      setResubmitFiles({});
      setSelectedDoc(null);
      await fetchHandledLogs();
      if (refreshUser) {
        await refreshUser();
      }
      showToast('Document resubmitted successfully!');
    } catch (err) {
      console.error('Error resubmitting:', err);
      showToast(err.message || 'Failed to resubmit document.');
    } finally {
      setIsResubmitting(false);
    }
  };

  const handleDisapproveSubmission = async (comments = '') => {
    if (!selectedDoc) return;
    try {
      setLoading(true);

      await subService.transitionSubmission(selectedDoc.id, 'disapprove', comments, [], user?.id);

      setIsReturnModalOpen(false);
      setReturnComments('');
      setLocallyApproved([]);
      setLocallyReturned({});
      const disapprovedId = selectedDoc.id;
      setSelectedDoc(null);
      await fetchHandledLogs();
      showToast('Submission disapproved successfully!');
      if (isChairmanLikeReviewer(user?.role) || user?.role === 'admin') {
        navigate('/completed', { state: { openDocId: disapprovedId } });
      }
    } catch (err) {
      console.error('Error disapproving submission:', err);
      showToast(err.message || 'Failed to disapprove submission.');
    } finally {
      setLoading(false);
    }
  };

  const handleForwardSubmission = async () => {
    if (!selectedDoc) return;
    try {
      setLoading(true);
      const activeVersionId = selectedDoc.raw?.current_version_id ||
        (Array.isArray(selectedDoc.raw?.submission_versions)
          ? selectedDoc.raw?.submission_versions[0]?.id
          : selectedDoc.raw?.submission_versions?.id);

      await persistLocalAttachmentReviews(activeVersionId);
      await subService.transitionSubmission(selectedDoc.id, 'forward', "Verified the chairman's signature and approved the document.", [], user?.id);

      setIsForwardModalOpen(false);
      setLocallyApproved([]);
      setLocallyReturned({});
      setSelectedDoc(null);
      await fetchHandledLogs();
      showToast('Submission forwarded successfully!');
    } catch (err) {
      console.error('Error forwarding submission:', err);
      showToast(err.message || 'Failed to forward submission.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendToExternal = async (comments = '') => {
    if (!selectedDoc) return;
    try {
      setLoading(true);
      setExternalProofUploading(true);

      const activeVersionId = selectedDoc.raw?.current_version_id ||
        (Array.isArray(selectedDoc.raw?.submission_versions)
          ? selectedDoc.raw?.submission_versions[0]?.id
          : selectedDoc.raw?.submission_versions?.id);

      if (externalProofFile) {
        const safeFileName = externalProofFile.name.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
        const filePath = `external-proof/${selectedDoc.id}/${Date.now()}-${safeFileName}`;

        const { error: uploadErr } = await supabase.storage
          .from('documents')
          .upload(filePath, externalProofFile, { cacheControl: '3600', upsert: false });

        if (uploadErr) throw uploadErr;
      }

      // Automatically update forwarded_to_main_campus in submission_attachments based on scope & gather forwarded list
      const allVer = Array.isArray(selectedDoc?.raw?.submission_versions)
        ? selectedDoc.raw.submission_versions
        : [selectedDoc?.raw?.submission_versions].filter(Boolean);
      const activeVer = allVer.find(v => v.id === activeVersionId) || allVer[0];
      const verAttachments = activeVer?.submission_attachments || [];

      const forwardedFileNames = [];
      for (const att of verAttachments) {
        const req = att.requirements || att.requirement;
        const scope = req?.requirement_scope || 'OSAS';
        const shouldForward = scope === 'OSAS';
        if (shouldForward) {
          forwardedFileNames.push(att.file_name || att.title || 'Attachment');
        }
        try {
          await supabase
            .from('submission_attachments')
            .update({ forwarded_to_main_campus: shouldForward })
            .eq('id', att.id);
        } catch (_) {
          /* non-blocking fallback if column is not yet present */
        }
      }

      const adminComment = comments?.trim() || '';
      const forwardedListText = forwardedFileNames.length > 0
        ? `Forwarded Documents:\n${forwardedFileNames.map(f => `• ${f}`).join('\n')}`
        : '';

      const logDescription = adminComment
        ? (forwardedListText ? `${adminComment}\n\n${forwardedListText}` : adminComment)
        : (forwardedListText ? `Sent to Main Campus for Review.\n\n${forwardedListText}` : 'Sent to Main Campus for Review.');

      await subService.transitionSubmission(selectedDoc.id, 'forward', logDescription, [], user?.id);

      setIsReturnModalOpen(false);
      setReturnComments('');
      setExternalProofFile(null);
      setSelectedDoc(null);
      await fetchHandledLogs();
      showToast('Sent to Main Campus successfully!');
    } catch (err) {
      console.error('Error sending to main campus:', err);
      showToast(err.message || 'Failed to send to main campus review.');
    } finally {
      setLoading(false);
      setExternalProofUploading(false);
    }
  };

  const handleReadyForRetrieval = async (comments = '') => {
    if (!selectedDoc) return;
    try {
      setLoading(true);

      await subService.transitionSubmission(selectedDoc.id, 'ready_for_retrieval', comments, [], user?.id);

      setIsReturnModalOpen(false);
      setReturnComments('');
      await refreshSelectedDoc(selectedDoc.id);
      await fetchTimelineLogs(selectedDoc.id);
      showToast('Document marked ready for retrieval successfully!');
    } catch (err) {
      console.error('Error marking ready for retrieval:', err);
      showToast(err.message || 'Failed to mark document ready for retrieval.');
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentRetrieved = async (descText = '') => {
    if (!selectedDoc) return;
    try {
      setLoading(true);

      await subService.transitionSubmission(selectedDoc.id, 'document_retrieved', descText, [], user?.id);

      showToast('Document marked as retrieved!');
      await refreshSelectedDoc(selectedDoc.id);
      await fetchTimelineLogs(selectedDoc.id);
    } catch (err) {
      console.error('Error marking document retrieved:', err);
      showToast(err.message || 'Failed to mark as retrieved.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmRetrieval = async (descText = '') => {
    if (!selectedDoc) return;
    try {
      setLoading(true);

      await subService.transitionSubmission(selectedDoc.id, 'confirm_retrieval', descText, [], user?.id);

      showToast('Retrieval confirmed!');
      await fetchTimelineLogs(selectedDoc.id);
      setSelectedDoc(null);
      await fetchHandledLogs();
    } catch (err) {
      console.error('Error confirming retrieval:', err);
      showToast(err.message || 'Failed to confirm retrieval.');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveSubmission = async (comments = '') => {
    if (!selectedDoc) return;
    try {
      setLoading(true);
      const activeVersionId = selectedDoc.raw?.current_version_id ||
        (Array.isArray(selectedDoc.raw?.submission_versions)
          ? selectedDoc.raw?.submission_versions[0]?.id
          : selectedDoc.raw?.submission_versions?.id);

      await persistLocalAttachmentReviews(activeVersionId);
      const result = await subService.transitionSubmission(selectedDoc.id, 'approve', comments, [], user?.id);

      setIsReturnModalOpen(false);
      setReturnComments('');
      setLocallyApproved([]);
      setLocallyReturned({});

      const isDeanApprovedStage = result?.workflow?.next_stage === 'FINAL_LOCAL_CAMPUS_REVIEW';
      if (isDeanApprovedStage) {
        setSelectedDoc((prev) => prev ? {
          ...prev,
          category: 'Final Local Campus Review',
          status: 'DEAN APPROVED',
          raw: {
            ...prev.raw,
            status: 'dean approved',
            remarks: comments || 'Approved'
          }
        } : prev);
        await fetchTimelineLogs(selectedDoc.id);
        await fetchHandledLogs();
        setIsDeanApproveSuccessModalOpen(true);
        return;
      }

      setSelectedDoc(null);
      await fetchHandledLogs();
      showToast('Submission approved successfully!');
    } catch (err) {
      console.error('Error approving submission:', err);
      showToast(err.message || 'Failed to approve submission.');
    } finally {
      setLoading(false);
    }
  };

  const selectedDocIdRef = React.useRef(selectedDoc?.id);
  React.useEffect(() => {
    selectedDocIdRef.current = selectedDoc?.id;
  }, [selectedDoc?.id]);

  React.useEffect(() => {
    if (!user?.id) return;

    fetchHandledLogs();

    const handleRefresh = () => {
      fetchHandledLogs();
      if (selectedDocIdRef.current) {
        refreshSelectedDoc(selectedDocIdRef.current);
      }
    };

    window.addEventListener('my-docs-updated', handleRefresh);
    window.addEventListener('document-status-changed', handleRefresh);
    window.addEventListener('inbox-updated', handleRefresh);
    window.addEventListener('submission-submitted', handleRefresh);

    const channelId = `mydocs_realtime_${user.id}_${Math.random().toString(36).substring(2, 9)}`;
    const channel = supabase.channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions' }, () => {
        handleRefresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'submission_logs' }, () => {
        handleRefresh();
      })
      .on('broadcast', { event: 'inbox-update' }, () => {
        handleRefresh();
      })
      .subscribe();

    return () => {
      window.removeEventListener('my-docs-updated', handleRefresh);
      window.removeEventListener('document-status-changed', handleRefresh);
      window.removeEventListener('inbox-updated', handleRefresh);
      window.removeEventListener('submission-submitted', handleRefresh);
      supabase.removeChannel(channel);
    };
  }, [user]);

  React.useEffect(() => {
    const targetId = location.state?.submissionId || location.state?.highlightedId;
    if (!targetId || !location.state?.openSubmission) return;

    let cancelled = false;

    const openFromNotification = async () => {
      const inLogs = logsData.find(
        (log) =>
          String(log.submission_id) === String(targetId) ||
          String(log.submissions?.id) === String(targetId),
      );

      if (inLogs?.submissions) {
        if (!cancelled) {
          setSelectedDoc(buildMyDocumentRow(inLogs.submissions, inLogs, user, activeSy, subtypesMap));
          navigate(location.pathname, { replace: true, state: {} });
        }
        return;
      }

      if (loading) return;

      const { data: submission, error } = await supabase
        .from('submissions')
        .select(MY_DOCS_SUBMISSION_SELECT)
        .eq('id', targetId)
        .maybeSingle();

      if (error || !submission || cancelled) return;

      const { data: latestLogs } = await supabase
        .from('submission_logs')
        .select('*')
        .eq('submission_id', targetId)
        .order('created_at', { ascending: false })
        .limit(1);

      const latestLog = latestLogs?.[0] || {
        created_at: submission.updated_at || submission.created_at,
        workflow_phase: null,
        review_action: null,
      };

      if (!cancelled) {
        setSelectedDoc(buildMyDocumentRow(submission, latestLog, user, activeSy, subtypesMap));
        navigate(location.pathname, { replace: true, state: {} });
      }
    };

    openFromNotification();
    return () => {
      cancelled = true;
    };
  }, [location.state, logsData, loading, user, activeSy, navigate, location.pathname, subtypesMap]);

  // Group by submission_id to keep only the latest log entry per submission
  const uniqueSubmissionsMap = {};
  logsData.forEach(log => {
    if (!log.submissions) return;
    const subId = log.submission_id;
    // Since records are fetched ordered by created_at DESC, the first log we see is already the latest!
    if (!uniqueSubmissionsMap[subId]) {
      uniqueSubmissionsMap[subId] = {
        latestLog: log,
        submission: log.submissions
      };
    }
  });

  const uniqueSubmissionsList = Object.values(uniqueSubmissionsMap);
  // Map submissions to visual format
  const mappedDocs = uniqueSubmissionsList.map(({ latestLog, submission }) => {
    const docTypeName = submission.documentType?.name || 'Document';
    const isActivityProposal = docTypeName.toLowerCase() === 'activity proposal' || docTypeName.toLowerCase() === 'activity-proposal';

    const version = Array.isArray(submission.submission_versions)
      ? (submission.submission_versions.find(v => v.id === submission.current_version_id) || submission.submission_versions[0])
      : submission.submission_versions;
    const details = isActivityProposal
      ? (Array.isArray(version?.activity_proposal_details)
        ? version.activity_proposal_details[version.activity_proposal_details.length - 1]
        : version?.activity_proposal_details)
      : null;

    const senderAbbr = (submission.users?.abbreviation && submission.users.abbreviation.trim())
      ? submission.users.abbreviation.trim()
      : (details?.organization_name || submission.users?.org_name || user?.abbreviation || user?.org_name || '-');

    // Format target dates
    const rawTargetDate = details?.target_date || '-';
    let targetDate = rawTargetDate;
    if (rawTargetDate && rawTargetDate !== '-') {
      try {
        targetDate = new Date(rawTargetDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
      } catch (_) { }
    }

    const targetTime = details?.target_time || '-';
    const proposalTitle = details?.activity_title || '-';

    let proposalTypeStr = '-';
    if (submission?.subtype_id && subtypesMap[submission.subtype_id]) {
      proposalTypeStr = subtypesMap[submission.subtype_id].name;
    } else if (submission?.proposal_type) {
      const rawType = submission.proposal_type;
      if (rawType.toLowerCase() === 'in-campus') proposalTypeStr = 'In-Campus';
      else if (rawType.toLowerCase() === 'off-campus') proposalTypeStr = 'Off-Campus';
      else proposalTypeStr = rawType.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }

    // Map Category Filter based on latest log or overall status
    let category = 'All';
    const wp = latestLog.workflow_phase || '';
    const ra = latestLog.review_action || '';
    const normalizeText = (value) =>
      String(value || '')
        .toLowerCase()
        .replace(/[_-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const subStatus = normalizeText(submission.status);
    const wpNorm = normalizeText(wp);

    // STATUS-FIRST mapping (authoritative): prevents stale workflow_phase values
    // from forcing wrong tabs on admin side.
    if (subStatus === 'returned') {
      category = 'Returned';
    } else if (subStatus === 'to forward') {
      category = user?.role === 'org-president' ? 'Hard Copy Submission' : 'Pending Hard Copy';
    } else if (subStatus === 'submitted' || subStatus === 'pending') {
      category = 'OSO Staff review';
    } else if (subStatus.includes('sds')) {
      category = 'SDS Review';
    } else if (subStatus.includes('dean approved')) {
      category = 'Final In-Campus review';
    } else if (subStatus.includes('dean review')) {
      category = 'Final In-Campus review';
    } else if (subStatus.includes('main campus review') || subStatus.includes('external review') || subStatus.includes('vice chairman approved')) {
      category = 'Main Campus Review';
    } else if (subStatus.includes('ready for retrieval') || subStatus.includes('document retrieval') || subStatus.includes('document retrieved') || subStatus.includes('retriev')) {
      category = 'For Retrieval';
    } else if (subStatus.includes('waiting for accomplishment report')) {
      category = 'Approved';
    } else if (subStatus === 'approved') {
      category = 'Approved';
    } else if (subStatus === 'completed') {
      category = 'Completed';
    } else if (subStatus.includes('disapproved') || subStatus.includes('rejected')) {
      category = 'Disapproved';
    } else {
      // Fallback to logs only when status is missing/unknown
      if (wpNorm === 'sds review') category = 'SDS Review';
      else if (wpNorm === 'dean review' || wpNorm === 'external approved') category = 'Final In-Campus review';
      else if (wpNorm === 'main campus review' || wpNorm === 'external review') category = 'Main Campus Review';
      else if (wpNorm === 'chairman review') category = 'Chairman Review';
      else if (ra === 'ready-for-hardcopy') category = user?.role === 'org-president' ? 'Hard Copy Submission' : 'Pending Hard Copy';
      else if (ra === 'ready-for-retrieval' || ra === 'document-retrieved' || ra === 'retrieval-confirmed') category = 'For Retrieval';
      else if (ra === 'approved') category = 'Approved';
      else if (ra === 'returned') category = 'Returned';
    }


    const submittedDate = new Date(submission.created_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    const lastActionDate = new Date(latestLog?.created_at || submission.updated_at || submission.created_at).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    return {
      id: submission.id,
      isActivityProposal,

      title: (isActivityProposal && proposalTitle && proposalTitle !== '-') ? proposalTitle : `${senderAbbr} ${docTypeName}`.trim().toUpperCase(),
      ref: submission.tracking_number || (isActivityProposal ? 'PENDING NO.' : 'DRAFT'),
      sender: senderAbbr,
      type: docTypeName,
      submittedDate,
      status: submission.status === 'submitted'
        ? 'OSO STAFF REVIEW'
        : (submission.status === 'to forward'
          ? (user?.role === 'org-president' ? 'HARDCOPY SUBMISSION' : 'PENDING HARD COPY')
          : (submission.status === 'dean review'
            ? 'FINAL IN-CAMPUS REVIEW'
            : (submission.status === 'ready for retrieval'
              ? 'READY FOR RETRIEVAL'
              : (submission.status === 'document retrieved'
                ? 'DOCUMENT RETRIEVED'
                : (submission.status ? submission.status.toUpperCase() : 'PENDING'))))),
      lastAction: lastActionDate,
      category,

      fullOrgName: submission.users?.org_name || details?.organization_name || user?.org_name || '-',
      proposal_title: proposalTitle,
      proposal_type: proposalTypeStr !== '-' ? proposalTypeStr : null,
      pic: details?.person_in_charge || '-',
      studentId: submission.users?.student_no || details?.student_id_number || '-',
      contact: details?.contact_number || '-',
      targetDate,
      targetTime,
      duration: calculateProposalDuration(details),
      students: details?.number_of_students || '-',
      nature: details?.nature_of_activity || '-',
      objectives: details?.objectives || null,
      satisfy_goals: [details?.satisfaction_goal_1, details?.satisfaction_goal_2, details?.satisfaction_goal_3].filter(Boolean),
      sponsors_partners: details?.sponsors_partners || [],
      satisfy_needs: details?.satisfy_needs || null,
      isActivityProposal,
      schedules: details?.activity_schedules || [],
      latestLogDate: latestLog?.created_at,
      raw: submission
    };
  });

  // Filter items matching activeTab & searchQuery
  const query = searchQuery.toLowerCase().trim();
  const visibleDocs = mappedDocs.filter(doc => {
    // Chairman should handle newly resubmitted ("OSO Staff review") items in Inbox, not My Documents.
    if (user?.role === 'chairman' && doc.category === 'OSO Staff review') {
      return false;
    }
    // Completed and disapproved documents live on the Completed page.
    if (doc.category === 'Completed' || doc.category === 'Disapproved') {
      return false;
    }
    return true;
  });

  const filteredDocs = visibleDocs.filter(doc => {
    const matchesTab =
      activeTab === 'All' ||
      normalizeCategory(doc.category) === normalizeCategory(activeTab);
    const matchesSearch = !query ||
      doc.title.toLowerCase().includes(query) ||
      doc.sender.toLowerCase().includes(query) ||
      doc.type.toLowerCase().includes(query) ||
      doc.ref.toLowerCase().includes(query);
    return matchesTab && matchesSearch;
  });

  // Tabs layout
  const countByTab = (tabName) =>
    visibleDocs.filter(d => normalizeCategory(d.category) === normalizeCategory(tabName)).length;

  const tabs = [
    { name: 'All', count: visibleDocs.length },
    ...(user?.role === 'org-president' ? [{ name: 'OSO Staff review', count: countByTab('OSO Staff review') }] : []),
    ...(user?.role === 'org-president' ? [{ name: 'Hard Copy Submission', count: countByTab('Hard Copy Submission') }] : []),
    ...(user?.role !== 'admin' ? [{ name: 'SDS Review', count: countByTab('SDS Review') }] : []),
    { name: 'Final In-Campus review', count: countByTab('Final In-Campus review') },
    { name: 'Main Campus Review', count: countByTab('Main Campus Review') },
    ...(user?.role === 'org-president' || user?.role === 'admin' ? [{ name: 'For Retrieval', count: countByTab('For Retrieval') }] : []),
    { name: 'Approved', count: countByTab('Approved') },
    ...(user?.role !== 'org-president' && user?.role !== 'admin' && user?.role !== 'chairman' ? [{ name: 'Completed', count: countByTab('Completed') }] : []),
    ...(user?.role === 'admin' ? [{ name: 'Pending Hard Copy', count: countByTab('Pending Hard Copy') }] : []),
    { name: 'Returned', count: countByTab('Returned') }
  ];

  const renderDeliveryProofModal = () => {
    if (!isDeliveryProofModalOpen) return null;
    return (
      <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/80 p-4 backdrop-blur-sm">
        <div className="w-full max-w-5xl rounded-3xl bg-white shadow-2xl border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <div>
              <h3 className="text-lg font-bold text-gray-800">Proof of Delivery</h3>
              <div className="flex items-center gap-2 mb-4 bg-gray-50 p-3 rounded-xl border border-gray-100">
                <FolderOpen size={16} className="text-gray-400" />
                <p className="text-xs font-medium text-gray-500 mt-1">Main Campus Submission Proof</p>
              </div>
            </div>
            <button
              onClick={() => setIsDeliveryProofModalOpen(false)}
              className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          <div className="p-6 bg-gray-50/50 flex flex-col items-center justify-center min-h-[500px]">
            {externalProofs && externalProofs.length > 0 ? (
              externalProofs.map((proof, idx) => (
                <div key={idx} className="mb-4 w-full flex justify-center">
                  {isImageUrl(proof.name) ? (
                    <img
                      src={proof.url}
                      alt={`Delivery Proof ${idx + 1}`}
                      className="max-h-[70vh] rounded-xl shadow-md border border-gray-200 object-contain"
                    />
                  ) : (
                    <iframe
                      src={`${proof.url}#toolbar=0`}
                      className="h-[70vh] w-full rounded-xl shadow-md border border-gray-200 bg-white"
                      title={`Delivery Proof PDF ${idx + 1}`}
                    />
                  )}
                </div>
              ))
            ) : (
              <div className="mb-4 w-full flex justify-center">
                {isImageUrl(deliveryProofUrl) ? (
                  <img
                    src={deliveryProofUrl}
                    alt="Delivery Proof"
                    className="max-h-[70vh] rounded-xl shadow-md border border-gray-200 object-contain"
                  />
                ) : (
                  <iframe
                    src={deliveryProofUrl ? `${deliveryProofUrl}#toolbar=0` : ''}
                    className="h-[70vh] w-full rounded-xl shadow-md border border-gray-200 bg-white"
                    title="Delivery Proof PDF"
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderDeleteDraftModal = () => {
    if (!isDeleteDraftModalOpen) return null;
    return (
      <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-md z-[999999] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl relative animate-in zoom-in-95 duration-200 text-gray-800">
          <button
            onClick={() => setIsDeleteDraftModalOpen(false)}
            disabled={isDeletingDraft}
            className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 transition-all"
          >
            <X size={20} />
          </button>
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-5 border border-red-100">
            <Trash2 size={28} />
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">Delete Draft Document</h3>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            Are you sure you want to delete this draft? This action cannot be undone and will permanently remove the document from your account and database.
          </p>
          
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setIsDeleteDraftModalOpen(false)}
              disabled={isDeletingDraft}
              className="flex-1 px-4 py-3 border border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition-all text-sm disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteDraft}
              disabled={isDeletingDraft}
              className="flex-1 px-4 py-3 bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-600/20 hover:bg-red-700 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isDeletingDraft ? (
                <span>Deleting...</span>
              ) : (
                <>
                  <Trash2 size={16} />
                  <span>Delete Draft</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (selectedDoc) {
    const isActivityProposal = selectedDoc.isActivityProposal;
    const docStatusLower = String(selectedDoc?.status || selectedDoc?.raw?.status || '').toLowerCase().trim();


    const allVersions = Array.isArray(selectedDoc.raw?.submission_versions)
      ? [...selectedDoc.raw.submission_versions].sort((a, b) => b.version_number - a.version_number)
      : [selectedDoc.raw?.submission_versions].filter(Boolean);

    const currentVersionIdToUse = selectedVersionId || selectedDoc.raw?.current_version_id;
    const currentVersion = allVersions.find(v => v.id === currentVersionIdToUse) || allVersions[0];
    const versionScopedTimelineLogs = (logs) =>
      filterTimelineLogsForVersion(logs, {
        allVersions,
        viewingVersionId: currentVersion?.id,
        currentVersionId: selectedDoc.raw?.current_version_id
      });
    const rawAttachments = currentVersion?.submission_attachments || [];
    // Deduplicate attachments by requirement_id, taking the latest one
    const attachments = Array.from(
      rawAttachments.reduce((map, file) => {
        if (!file.requirement_id) {
          map.set(file.id, file);
        } else {
          const existing = map.get(file.requirement_id);
          if (!existing || new Date(file.created_at) > new Date(existing.created_at)) {
            map.set(file.requirement_id, file);
          }
        }
        return map;
      }, new Map()).values()
    );

    const isDeanApprovedDoc = docStatusLower === 'dean approved' || docStatusLower === 'external approved' || docStatusLower.includes('dean approved') || docStatusLower.includes('external approved');
    const isMainCampusReviewDoc = docStatusLower === 'main campus review' || docStatusLower.includes('main campus') || selectedDoc?.category === 'Main Campus Review';
    const isApprovedDoc =
      docStatusLower === 'approved' ||
      docStatusLower === 'ready for retrieval' ||
      docStatusLower === 'document retrieval' ||
      docStatusLower === 'document_retrieval' ||
      docStatusLower === 'ready for org pickup';
    const isReadyForOrgPickup = isReadyForOrgRetrieval(selectedDoc);
    const isWaitingForAccomplishment = isWaitingForAccomplishmentReport(selectedDoc);

    const isSdsStage = docStatusLower === 'sds coordinator review' || docStatusLower.includes('sds') || docStatusLower === 'to forward' || docStatusLower.includes('hardcopy') || selectedDoc?.category === 'SDS Review' || selectedDoc?.category === 'Pending Hard Copy';

    const sdsPhaseLogs = (timelineLogs || []).filter(l => {
      const wp = String(l.workflow_phase || '').toLowerCase().replace(/[_-]/g, ' ').trim();
      return wp === 'sds review' || wp === 'hardcopy submission';
    });

    const isSdsApprovedLog = sdsPhaseLogs.some(l => {
      const at = String(l.action_type || '').toLowerCase();
      const ra = String(l.review_action || '').toLowerCase();
      return at === 'approved' || ra === 'approved';
    });

    const isSdsReadyForRetrievalLog =
      docStatusLower === 'ready for retrieval' ||
      (timelineLogs || []).some(l => {
        const at = String(l.action_type || '').toLowerCase();
        const ra = String(l.review_action || '').toLowerCase();
        const desc = String(l.description || '').toLowerCase().trim();
        return (
          at === 'ready_for_retrieval' ||
          ra === 'ready_for_retrieval' ||
          ra === 'ready-for-retrieval' ||
          desc.includes('ready for retrieval') ||
          desc.includes('marked ready for retrieval')
        );
      });

    const sameRole = (r1, r2) => {
      const a = String(r1 || '').toLowerCase().replace(/[^a-z]/g, '');
      const b = String(r2 || '').toLowerCase().replace(/[^a-z]/g, '');
      if (!a || !b) return false;
      if (a === b) return true;
      if ((a.includes('admin') || a.includes('sds')) && (b.includes('admin') || b.includes('sds'))) return true;
      if (a.includes('org') && b.includes('org')) return true;
      return false;
    };

    // Separate logs for SDS Hardcopy Stage vs Main Campus Stage
    const mainCampusReviewLogIndex = (timelineLogs || []).findIndex(l => {
      const wp = String(l.workflow_phase || '').toLowerCase().replace(/[_-]/g, ' ').trim();
      const desc = String(l.description || '').toLowerCase();
      const at = String(l.action_type || '').toLowerCase();
      return (
        wp === 'main campus review' ||
        desc.includes('approved by main campus') ||
        desc.includes('sent to main campus') ||
        at === 'forward' ||
        at === 'send_to_external'
      );
    });

    const mainCampusLogs = mainCampusReviewLogIndex >= 0 ? (timelineLogs || []).slice(0, mainCampusReviewLogIndex + 1) : [];
    const sdsLogs = mainCampusReviewLogIndex >= 0 ? (timelineLogs || []).slice(mainCampusReviewLogIndex + 1) : (timelineLogs || []);

    const sdsRetrievalLog = sdsLogs.find(l => {
      const at = String(l.action_type || '').toLowerCase();
      const ra = String(l.review_action || '').toLowerCase();
      const desc = String(l.description || '').toLowerCase();
      return (
        at === 'document_retrieved' ||
        ra === 'document_retrieved' ||
        ra === 'document-retrieved' ||
        desc.includes('document retrieved') ||
        (desc.includes('retrieved by') && !desc.includes('ready for retrieval'))
      ) && !at.includes('confirm') && !ra.includes('confirm') && !desc.includes('confirm');
    });

    const isFirstSdsRetriever = Boolean(
      sdsRetrievalLog && (
        (sdsRetrievalLog.user_id && String(sdsRetrievalLog.user_id) === String(user?.id)) ||
        (sdsRetrievalLog.users?.role && sameRole(sdsRetrievalLog.users.role, user?.role))
      )
    );

    const isSdsConfirmedRetrievalLog = sdsLogs.some(l => {
      const at = String(l.action_type || '').toLowerCase();
      const ra = String(l.review_action || '').toLowerCase();
      const desc = String(l.description || '').toLowerCase();
      return at === 'confirm_retrieval' || ra === 'confirm_retrieval' || ra === 'confirm-retrieval' || desc.includes('retrieval confirmed') || desc.includes('confirmed retrieval');
    });

    const isMainReadyForRetrievalLog =
      docStatusLower === 'ready for retrieval' ||
      mainCampusLogs.some(l => {
        const at = String(l.action_type || '').toLowerCase();
        const ra = String(l.review_action || '').toLowerCase();
        const desc = String(l.description || '').toLowerCase().trim();
        return (
          at === 'ready_for_retrieval' ||
          ra === 'ready_for_retrieval' ||
          ra === 'ready-for-retrieval' ||
          desc.includes('ready for retrieval') ||
          desc.includes('marked ready for retrieval')
        );
      });

    const mainRetrievalLog = mainCampusLogs.find(l => {
      const at = String(l.action_type || '').toLowerCase();
      const ra = String(l.review_action || '').toLowerCase();
      const desc = String(l.description || '').toLowerCase();
      return (
        at === 'document_retrieved' ||
        ra === 'document_retrieved' ||
        ra === 'document-retrieved' ||
        desc.includes('document retrieved') ||
        (desc.includes('retrieved by') && !desc.includes('ready for retrieval'))
      ) && !at.includes('confirm') && !ra.includes('confirm') && !desc.includes('confirm');
    });

    const isFirstRetriever = Boolean(
      mainRetrievalLog && (
        (mainRetrievalLog.user_id && String(mainRetrievalLog.user_id) === String(user?.id)) ||
        (mainRetrievalLog.users?.role && sameRole(mainRetrievalLog.users.role, user?.role))
      )
    );

    const isMainConfirmedRetrievalLog = mainCampusLogs.some(l => {
      const at = String(l.action_type || '').toLowerCase();
      const ra = String(l.review_action || '').toLowerCase();
      const desc = String(l.description || '').toLowerCase();
      return at === 'confirm_retrieval' || ra === 'confirm_retrieval' || ra === 'confirm-retrieval' || desc.includes('retrieval confirmed') || desc.includes('confirmed retrieval');
    });

    const formatDuration = (val) => {
      if (!val || val === '-') return '-';
      const num = Number(val);
      if (isNaN(num)) return val;
      if (num >= 60) {
        const hours = Math.floor(num / 60);
        const mins = num % 60;
        let str = `${hours} hour${hours > 1 ? 's' : ''}`;
        if (mins > 0) str += ` and ${mins} minute${mins !== 1 ? 's' : ''}`;
        return str;
      }
      return `${num} minute${num !== 1 ? 's' : ''}`;
    };
    const hasBlockingReturnedAttachments = attachments.some((file) => {
      const { returnedForDisplay } = getAttachmentReviewDisplay(
        file,
        selectedDoc,
        currentVersion,
        allVersions,
        timelineLogs,
        locallyApproved,
        locallyReturned,
        user
      );
      return returnedForDisplay;
    });
    const hasLocallyReturnedAttachments = Object.keys(locallyReturned).length > 0;
    const isLatestVersion = currentVersion?.id === selectedDoc.raw?.current_version_id;
    const disableVersionActions = !isLatestVersion;

    const extractProofPath = (value) => {
      const match = String(value || '').match(/proof_path:\s*([^\s\n]+)/i);
      return match?.[1] || null;
    };

    const findDeliveryProofPath = () => {
      const candidates = [
        selectedDoc?.raw?.remarks,
        selectedDoc?.raw?.description,
        ...(timelineLogs || []).map((log) => `${log?.comment || ''}\n${log?.description || ''}`)
      ];

      for (const candidate of candidates) {
        const proofPath = extractProofPath(candidate);
        if (proofPath) return proofPath;
      }
      return null;
    };

    const proofStoragePath = findDeliveryProofPath();

    const handleViewDeliveryProof = async (proofPath) => {
      if (externalProofs && externalProofs.length > 0) {
        setDeliveryProofUrl(externalProofs[0].url);
        setIsDeliveryProofModalOpen(true);
      } else if (proofPath) {
        const signedUrl = await resolveExternalProofUrl(proofPath);
        if (signedUrl) {
          setDeliveryProofUrl(signedUrl);
          setIsDeliveryProofModalOpen(true);
        }
      }
    };

    // ORG PRESIDENT DETAIL VIEW – activity proposal style layout
    if (user?.role === 'org-president') {
      const details = isActivityProposal
        ? (Array.isArray(currentVersion?.activity_proposal_details)
          ? currentVersion.activity_proposal_details[currentVersion.activity_proposal_details.length - 1]
          : currentVersion?.activity_proposal_details)
        : null;

      const formattedSubmittedAt = new Date(selectedDoc.raw?.created_at || selectedDoc.submittedDate).toLocaleDateString(
        'en-US',
        { month: 'short', day: 'numeric', year: 'numeric' }
      );

      const submittedByName = user?.full_name || selectedDoc.pic || '—';
      const submittedByRole = user?.role ? String(user.role).replace('-', ' ') : null;

      const timelineLogsForTimeline = versionScopedTimelineLogs(timelineLogs);

      const lastTimelineLog = timelineLogsForTimeline[0] || null;
      const sanitizeSystemRemarks = (value) =>
        String(value || '')
          .replace(/\bproof_path:[^\s\n]+/gi, '')
          .replace(/\s{2,}/g, ' ')
          .replace(/\s+([,.!?])/g, '$1')
          .trim();
      const isExternalReviewStatus = docStatusLower.includes('main campus review');
      let systemRemarksText = '';
      if (isExternalReviewStatus) {
        systemRemarksText = 'Sent to Main Campus\nWaiting for Main Campus Approval';
      } else if (docStatusLower === 'waiting for accomplishment report') {
        systemRemarksText = 'Document retrieved by Organization President\nAwaiting Accomplishment Report Submission';
      } else {
        systemRemarksText = sanitizeSystemRemarks(
          lastTimelineLog?.comment ||
          lastTimelineLog?.description ||
          selectedDoc.raw?.remarks ||
          'No remarks yet.'
        ) || 'No remarks yet.';
      }

      const allowedViewerRoles = new Set(['admin', 'chairman', 'vice chairman', 'vice-chairman']);
      const lastViewerLog =
        timelineLogs.find(
          l =>
            l.action_type === 'viewed' &&
            l.users?.role &&
            allowedViewerRoles.has(String(l.users.role).toLowerCase())
        ) || null;

      const lastViewerName = lastViewerLog?.users?.full_name || null;
      const lastViewerRole = lastViewerLog?.users?.role || null;
      const lastViewerTime = lastViewerLog?.created_at
        ? new Date(lastViewerLog.created_at).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        })
        : null;

      const docTitle = selectedDoc.proposal_title && selectedDoc.proposal_title !== '-' ? selectedDoc.proposal_title : selectedDoc.title;
      const proofAttachments = (attachments || []).filter((file) => {
        const name = String(file?.file_name || '').toLowerCase();
        const url = String(file?.file_url || '').toLowerCase();
        return (
          name.endsWith('.jpg') ||
          name.endsWith('.jpeg') ||
          name.endsWith('.png') ||
          name.endsWith('.webp') ||
          url.endsWith('.jpg') ||
          url.endsWith('.jpeg') ||
          url.endsWith('.png') ||
          url.endsWith('.webp')
        );
      });

      const isReturnedStatus =
        String(selectedDoc?.status || '').toLowerCase() === 'returned' ||
        String(selectedDoc?.raw?.status || '').toLowerCase() === 'returned' ||
        selectedDoc?.category === 'Returned';

      return (
        <div className={`animate-in fade-in duration-500 max-w-6xl mx-auto px-6 py-10 ${isWaitingForAccomplishment ? 'pb-40' : 'pb-28'}`}>
          <button
            onClick={() => { setSelectedDoc(null); setSelectedVersionId(null); }}
            className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white border border-gray-200 text-xs font-extrabold uppercase tracking-widest text-gray-700 hover:border-primary-green hover:text-primary-green hover:bg-green-50/40 transition-all shadow-sm"
          >
            <ChevronLeft size={16} />
            <span>Back to Documents</span>
          </button>

          <div className="mb-8 rounded-[2rem] border border-gray-100 bg-gradient-to-br from-white to-gray-50/60 px-8 py-7 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5">
              <div>
                <p className="text-[11px] font-mono uppercase tracking-widest text-gray-400">
                  {selectedDoc.ref}
                </p>
                <h1 className="mt-1 text-2xl md:text-3xl font-extrabold tracking-tight text-gray-900">
                  {isActivityProposal ? docTitle : `${selectedDoc.sender} ${selectedDoc.type} ${activeSy ? activeSy.name : ''}`.toUpperCase()}
                </h1>
                {isActivityProposal && (
                  <p className="mt-2 text-sm font-semibold text-gray-500">Activity Proposal Form</p>
                )}
              </div>

              {/* Removed redundant status/date pill row (already in Document Details). */}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2.3fr)_minmax(0,1fr)] gap-8 items-start">
            <div className={isActivityProposal ? "bg-white rounded-[2.5rem] shadow-sm border border-gray-100 p-10 space-y-7" : "space-y-7"}>

              {isActivityProposal && (
                <>
                  <div className="space-y-4 text-gray-700 max-w-4xl">
                <div className="flex gap-2">
                  <span className="font-bold min-w-[200px]">Person In-Charge:</span>
                  <span>{selectedDoc.pic || '—'}</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-bold min-w-[200px]">Student ID No.:</span>
                  <span>{selectedDoc.studentId || '—'}</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-bold min-w-[200px]">Contact Number of Person-in-Charge:</span>
                  <span>{selectedDoc.contact || '—'}</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-bold min-w-[200px]">Target Date and Time:</span>
                  <span>
                    {selectedDoc.schedules && selectedDoc.schedules.length > 0 ? (
                      selectedDoc.schedules.map((s, idx) => {
                        let dateStr = 'TBD';
                        if (s.activity_date) {
                          try {
                            dateStr = new Date(s.activity_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase();
                          } catch (e) {
                            dateStr = String(s.activity_date).toUpperCase();
                          }
                        }
                        if (s.end_date) {
                          const endStr = new Date(s.end_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase();
                          return <span key={idx} className="block">{`${dateStr} – ${endStr}`}</span>;
                        }
                        const formatTime = (t) => {
                          if (!t) return 'TBD';
                          try {
                            const [h, m] = t.split(':');
                            const d = new Date(); d.setHours(parseInt(h, 10)); d.setMinutes(parseInt(m, 10));
                            return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase();
                          } catch (e) { return t; }
                        };
                        return <span key={idx} className="block">{`${dateStr} — ${formatTime(s.start_time)} – ${s.is_indefinite ? 'INDEFINITE' : formatTime(s.end_time)}`}</span>;
                      })
                    ) : (
                      selectedDoc.targetDate && selectedDoc.targetTime && selectedDoc.targetDate !== '-' && selectedDoc.targetTime !== '-' ? `${selectedDoc.targetDate} | ${selectedDoc.targetTime}` : selectedDoc.targetDate
                    )}
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="font-bold min-w-[200px]">Duration:</span>
                  <span>{calculateProposalDuration(selectedDoc.proposalDetails || selectedDoc.raw?.activity_proposal_details || { schedules: selectedDoc.schedules, duration: selectedDoc.duration, is_indefinite_end_time: selectedDoc.is_indefinite_end_time })}</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-bold min-w-[200px]">Number of Students Involved:</span>
                  <span>{selectedDoc.students || '—'}</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-bold min-w-[200px]">Nature of Activity:</span>
                  <span>{selectedDoc.nature || '—'}</span>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {isActivityProposal && (
                  <div>
                    <p className="font-bold text-sm mb-2">Objectives of the Activity:</p>
                    <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                      {(() => {
                        const objList = parseObjectivesList(selectedDoc.objectives);
                        if (objList.length > 0) {
                          return (
                            <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700 font-medium">
                              {objList.map((obj, i) => <li key={i}>{obj}</li>)}
                            </ul>
                          );
                        }
                        return <p className="text-gray-700 text-sm leading-relaxed">{selectedDoc.objectives || '-'}</p>;
                      })()}
                    </div>
                  </div>
                )}

                <div>
                  <p className="font-bold text-sm mb-1">
                    Target Audience / Participants: <span className="font-normal">BulSUans Only</span>
                  </p>
                </div>

                <div>
                  <p className="font-bold text-sm mb-2">
                    Describe how this activity will satisfy the needs of the organization and how it will help the organization achieve its goals:
                  </p>
                  <div className="bg-gray-50 p-6 rounded-2xl text-sm leading-relaxed text-gray-700 border border-gray-100">
                    {isActivityProposal && selectedDoc.satisfy_goals && selectedDoc.satisfy_goals.length > 0 ? (
                      <ol className="list-decimal pl-5 space-y-2">
                        {selectedDoc.satisfy_goals.map((goal, idx) => (
                          <li key={idx}>{goal}</li>
                        ))}
                      </ol>
                    ) : (
                      <div className="text-gray-400 italic">
                        No goals provided.
                      </div>
                    )}
                  </div>
                </div>
              </div>
              </>
              )}

              {/* Attached Files Section - Collapsible with Live Data (same design as old) */}
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 mb-10 transition-all duration-500">
                <button
                  onClick={() => setIsFilesOpen(!isFilesOpen)}
                  className="w-full bg-[#525252] text-white px-8 py-4 flex items-center justify-between hover:brightness-110 transition-all outline-none"
                >
                  <div className="flex items-center gap-3">
                    <Paperclip size={20} className="text-white opacity-80" />
                    <span className="text-xs font-bold uppercase tracking-widest">Attached File</span>
                  </div>
                  <ChevronDown size={20} className={`transition-transform duration-500 ${isFilesOpen ? 'rotate-180' : ''}`} />
                </button>

                {isFilesOpen && (
                  <div className="p-6 space-y-3 animate-in slide-in-from-top-4 duration-500">
                    {attachments && attachments.length > 0 && (
                      <div className="flex bg-gray-100 p-1 rounded-xl text-xs font-bold gap-1 mb-3">
                        <button
                          type="button"
                          onClick={() => setDocDetailTabFilter('all')}
                          className={`px-3 py-1.5 rounded-lg transition-all ${
                            docDetailTabFilter === 'all'
                              ? 'bg-emerald-600 text-white shadow-xs font-black'
                              : 'text-gray-600 hover:text-gray-800'
                          }`}
                        >
                          All ({attachments.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setDocDetailTabFilter('osas')}
                          className={`px-3 py-1.5 rounded-lg transition-all ${
                            docDetailTabFilter === 'osas'
                              ? 'bg-emerald-600 text-white shadow-xs font-black'
                              : 'text-gray-600 hover:text-gray-800'
                          }`}
                        >
                          OSAS Requirements ({attachments.filter(f => (f.requirements?.requirement_scope || f.requirement?.requirement_scope || 'OSAS') === 'OSAS').length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setDocDetailTabFilter('local')}
                          className={`px-3 py-1.5 rounded-lg transition-all ${
                            docDetailTabFilter === 'local'
                              ? 'bg-emerald-600 text-white shadow-xs font-black'
                              : 'text-gray-600 hover:text-gray-800'
                          }`}
                        >
                          LOCAL Requirements ({attachments.filter(f => (f.requirements?.requirement_scope || f.requirement?.requirement_scope || 'OSAS') !== 'OSAS').length})
                        </button>
                      </div>
                    )}

                    {attachments && attachments.length > 0 ? (
                      attachments
                        .filter(file => {
                          const reqObj = file.requirements || file.requirement;
                          const scope = reqObj?.requirement_scope || 'OSAS';
                          if (docDetailTabFilter === 'osas') return scope === 'OSAS';
                          if (docDetailTabFilter === 'local') return scope !== 'OSAS';
                          return true;
                        })
                        .map((file, idx) => {
                        const fileName = file.file_name || 'Attached File';
                        let finalPath = file.file_url || '';
                        if (finalPath.startsWith('documents/')) {
                          finalPath = finalPath.replace('documents/', '');
                        }
                        const { data } = supabase.storage.from('documents').getPublicUrl(finalPath);
                        const fileUrl = data?.publicUrl || '#';

                        const currentVersionNum = Number(currentVersion?.version_number || 1);
                        const isResubmittedVersion = currentVersionNum > 1;
                        const prevVersion = (allVersions || []).find(v => Number(v?.version_number || 0) === (currentVersionNum - 1));
                        const prevAttachment = prevVersion?.submission_attachments?.find(att => {
                          if (att?.requirement_id && file?.requirement_id) return String(att.requirement_id) === String(file.requirement_id);
                          return !!att?.file_name && !!file?.file_name && att.file_name === file.file_name;
                        });
                        const existedInPreviousVersion = !!prevAttachment;
                        const isModifiedInResubmission = existedInPreviousVersion && prevAttachment.file_url !== file.file_url;
                        const isUnchangedApproved = isResubmittedVersion && existedInPreviousVersion && !isModifiedInResubmission;

                        const viewingLatestVersion = currentVersion?.id === selectedDoc.raw?.current_version_id;
                        const docStatus = (viewingLatestVersion
                          ? (selectedDoc.raw?.status || selectedDoc.status || '')
                          : (currentVersion?.status || selectedDoc.raw?.status || selectedDoc.status || '')
                        ).toLowerCase();
                        const isChairmanStage = docStatus === 'submitted' || docStatus === 'oso staff review' || docStatus === 'pending' || docStatus === 'returned';
                        const historicalChairmanVersion = !viewingLatestVersion && isChairmanStage;

                        const fileLog = (timelineLogs || []).find(log => log.attachment_id === file.id);
                        const reviewActionValue = String(fileLog?.review_action || '').toLowerCase();
                        const isReturnedAttachment = ['missing-requirements', 'incorrect-format', 'incomplete-information'].includes(reviewActionValue);

                        const isReturnByCurrentReviewer =
                          isReturnedAttachment &&
                          ((fileLog?.user_id && fileLog.user_id === user?.id) ||
                            sameRole(fileLog?.users?.role, user?.role));
                        const returnedForDisplay = isChairmanStage ? isReturnedAttachment : isReturnByCurrentReviewer;
                        const hasRevision = returnedForDisplay;

                        const isExplicitlyApproved = (fileLog && fileLog.review_action === 'approved') || (locallyApproved && locallyApproved.includes(file.id));

                        const isChairmanApproved = historicalChairmanVersion
                          ? !returnedForDisplay
                          : (isChairmanStage
                              ? (isExplicitlyApproved || isUnchangedApproved)
                              : !returnedForDisplay);

                        const reqObj = file.requirements || file.requirement;
                        const scope = reqObj?.requirement_scope || 'OSAS';
                        const isOsas = scope === 'OSAS';
                        const isForwardedPhase = docStatus.includes('main campus review') || docStatus === 'completed' || docStatus === 'waiting for accomplishment report' || docStatus === 'approved' || docStatus === 'ready for retrieval';
                        const isForwardedItem = isForwardedPhase && isOsas;

                        let containerBg = 'bg-[#525252]';
                        let textColor = 'text-white';
                        let subtitleColor = 'text-gray-300';
                        let iconStyle = 'bg-white/10 text-white/80';
                        let badgeStyle = 'bg-white/10 text-white/90 border border-white/20';

                        if (hasRevision) {
                          containerBg = 'bg-[#f59e0b]';
                          textColor = 'text-[#451a03]';
                          subtitleColor = 'text-[#78350f]';
                          iconStyle = 'bg-[#78350f]/10 text-[#78350f]';
                          badgeStyle = 'bg-amber-100 text-amber-800 border border-amber-200';
                        } else if (isForwardedPhase || isChairmanApproved) {
                          // Approved or forwarded attachment: Solid Green
                          containerBg = 'bg-green-600 shadow-md';
                          textColor = 'text-white';
                          subtitleColor = 'text-green-100';
                          iconStyle = 'bg-white/20 text-white';
                          badgeStyle = 'bg-white/20 text-white border border-white/30 font-black';
                        } else {
                          // Resubmitted or pending review attachment: Neutral Dark Gray
                          containerBg = 'bg-[#525252]';
                          textColor = 'text-white';
                          subtitleColor = 'text-gray-300';
                          iconStyle = 'bg-white/10 text-white/80';
                          badgeStyle = 'bg-white/10 text-white/90 border border-white/20';
                        }

                        return (
                          <div
                            key={file.id || idx}
                            onClick={() => {
                              setPreviewFile(file);
                              setReviewAction('');
                              setReviewComments('');
                            }}
                            className={`${containerBg} rounded-xl p-4 flex items-center justify-between group hover:brightness-110 transition-all cursor-pointer`}
                          >
                            <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 ${iconStyle} rounded-lg flex items-center justify-center shrink-0`}>
                                <Paperclip size={20} />
                              </div>
                              <div>
                                <div className="mb-1 flex flex-wrap items-center gap-2">
                                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${badgeStyle}`}>
                                    {isOsas ? 'OSAS Requirement' : 'LOCAL Requirement'}
                                  </span>
                                </div>
                                <p className={`${textColor} font-semibold text-sm`}>{fileName}</p>
                                <p className={`${subtitleColor} text-[10px] uppercase font-bold mt-0.5`}>
                                  {isForwardedPhase ? (isOsas ? '✓ Forwarded to Main Campus' : '✓ Retained Locally') : 'Attached Document'}
                                </p>
                                {returnedForDisplay && fileLog?.comment && (
                                  <p className="mt-1 text-xs italic font-medium opacity-90 max-w-lg">
                                    {(fileLog?.users?.full_name || fileLog?.users?.role || 'Reviewer')}'s Comment: "{fileLog.comment}"
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 pointer-events-auto md:pointer-events-none md:group-hover:pointer-events-auto transition-all">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewFile(file);
                                  setReviewAction('');
                                  setReviewComments('');
                                }}
                                className="bg-secondary-gold text-white px-6 py-2 rounded-lg text-xs font-bold hover:brightness-110 transition-all shadow-lg inline-block text-center"
                              >
                                view
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownload(file.file_url, fileName);
                                }}
                                className="bg-secondary-gold text-white px-6 py-2 rounded-lg text-xs font-bold hover:brightness-110 transition-all shadow-lg inline-block text-center"
                              >
                                Download
                              </button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-6 text-gray-500 text-sm italic">
                        No dynamic attachments uploaded for this submission.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Proof of activity implementation */}
              {isActivityProposal && proofAttachments.length > 0 && (
                <div className="mb-10">
                  <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-4">
                    Proof of Activity Implementation
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {proofAttachments.map((file, idx) => {
                      let finalPath = file.file_url || '';
                      if (finalPath.startsWith('documents/')) {
                        finalPath = finalPath.replace('documents/', '');
                      }
                      const { data } = supabase.storage.from('documents').getPublicUrl(finalPath);
                      const fileUrl = data?.publicUrl || '';
                      return (
                        <a
                          key={file.id || idx}
                          href={fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-all bg-white"
                        >
                          <img
                            src={fileUrl}
                            alt={file.file_name || `Proof ${idx + 1}`}
                            className="w-full h-36 object-cover"
                          />
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}

              <SubmissionTimeline
                timelineLogs={timelineLogs}
                submissionStatus={selectedDoc.raw?.status || selectedDoc.status}
                allVersions={allVersions}
                viewingVersionId={currentVersion?.id}
                currentVersionId={selectedDoc.raw?.current_version_id}
                hasDeliveryProof={(externalProofs && externalProofs.length > 0) || !!proofStoragePath}
                onViewDeliveryProof={() => handleViewDeliveryProof(proofStoragePath)}
              />
            </div>

            <div className="space-y-4 self-start sticky top-0 z-20">
              {/* Viewed By + Controls (match screenshot format) */}
              <div className="bg-gradient-to-r from-[#e9ad00] to-[#d89b00] rounded-2xl p-4 text-white shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                      <Eye size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest opacity-90">Viewed by</p>
                      <p className="text-sm font-semibold leading-tight">
                        {lastViewerName || '—'}
                      </p>
                      {lastViewerRole && (
                        <span className="mt-1 inline-flex px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-medium uppercase tracking-wider">
                          {lastViewerRole}
                        </span>
                      )}
                    </div>
                  </div>
                  {lastViewerTime && (
                    <span className="shrink-0 mt-1 px-3 py-1 rounded-full bg-white/20 text-[10px] font-medium uppercase tracking-wider">
                      {lastViewerTime}
                    </span>
                  )}
                </div>
              </div>

              <div className="relative">
                <select
                  value={currentVersion?.id || ''}
                  onChange={(e) => setSelectedVersionId(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl pl-4 pr-10 py-3 text-sm font-medium text-gray-700 outline-none cursor-pointer focus:ring-2 focus:ring-primary-green/20 appearance-none"
                >
                  {allVersions.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.id === selectedDoc.raw?.current_version_id ? 'Current Version' : `Version ${v.version_number}`}
                    </option>
                  ))}
                </select>
                <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>

              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 space-y-4">
                <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-widest">
                  Document Details
                </h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="block text-gray-500 mb-1">Document Title</span>
                    <p className="text-sm font-medium text-gray-800 leading-snug">
                      {selectedDoc.proposal_title && selectedDoc.proposal_title !== '-' ? selectedDoc.proposal_title : selectedDoc.title}
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 inline-flex items-center gap-1.5"><AlertCircle size={14} /> Status</span>
                    <span
                      className="px-3 py-1 rounded-full text-[11px] font-semibold uppercase text-white"
                      style={{ backgroundColor: getStatusColor(docStatusLower === 'waiting for accomplishment report' ? 'approved' : selectedDoc.status) }}
                    >
                      {docStatusLower === 'waiting for accomplishment report' ? 'approved' : selectedDoc.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 inline-flex items-center gap-1.5"><Calendar size={14} /> Date</span>
                    <span className="text-gray-800 font-medium">{formattedSubmittedAt}</span>
                  </div>
                  <div>
                    <span className="block text-gray-500 mb-1 inline-flex items-center gap-1.5"><User size={14} /> Submitted By</span>
                    <p className="text-sm font-medium text-gray-800">{submittedByName}</p>
                    {submittedByRole && (
                      <p className="text-[11px] text-gray-500">{submittedByRole}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 rounded-2xl border border-amber-100 p-4 flex items-start gap-3">
                <div className="mt-1">
                  <Clock size={18} className="text-amber-500" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-amber-800 uppercase tracking-widest">
                    System Remarks
                  </p>
                  <p className="mt-1 text-sm font-medium text-amber-900 whitespace-pre-wrap">
                    {systemRemarksText}
                  </p>
                  {isExternalReviewStatus && ((externalProofs && externalProofs.length > 0) || proofStoragePath) ? (
                    <button
                      type="button"
                      onClick={() => handleViewDeliveryProof(proofStoragePath)}
                      className="mt-3 w-full px-5 py-3.5 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 transition-all shadow-sm"
                    >
                      View Proof Of Delivery
                    </button>
                  ) : null}
                </div>
              </div>

              {(user?.role === 'org-president' && String(selectedDoc.status || '').toUpperCase() === 'DRAFT') && (
                <div className="flex flex-col gap-2.5 w-full mt-3">
                  <button
                    onClick={handleContinueClick}
                    className="w-full px-5 py-3.5 bg-primary-green text-white rounded-xl text-sm font-semibold hover:bg-green-600 transition-all shadow-sm flex items-center justify-center gap-2"
                  >
                    <FileText size={16} />
                    <span>Continue Submission</span>
                  </button>
                  <button
                    onClick={() => setIsDeleteDraftModalOpen(true)}
                    className="w-full px-5 py-3 bg-red-50 text-red-600 border border-red-200 rounded-xl text-sm font-semibold hover:bg-red-100 hover:text-red-700 transition-all shadow-sm flex items-center justify-center gap-2"
                  >
                    <Trash2 size={16} />
                    <span>Delete Draft</span>
                  </button>
                </div>
              )}

              {isReturnedStatus && (
                <button
                  onClick={handleContinueClick}
                  className="w-full px-5 py-3.5 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  <Pencil size={16} />
                  <span>Edit & Resubmit</span>
                </button>
              )}

              {/* SDS Stage Retrieval Buttons */}
              {isSdsStage && (
                !isSdsApprovedLog ? (
                  (user?.role === 'admin' || user?.role === 'oso-staff' || user?.role === 'sds-coordinator') ? (
                    <div className="flex flex-col gap-2 mt-2 w-full">
                      <button
                        onClick={() => {
                          setDecisionType('approve');
                          setReturnComments('');
                          setIsReturnModalOpen(true);
                        }}
                        disabled={loading}
                        className="w-full px-5 py-3.5 bg-green-700 text-white rounded-xl text-sm font-semibold hover:bg-green-800 transition-all shadow-sm flex items-center justify-center gap-2"
                      >
                        <CheckCircle size={16} />
                        <span>Verify & Approve Hard Copy</span>
                      </button>
                      <button
                        onClick={() => {
                          setDecisionType('return');
                          setReturnComments('');
                          setIsReturnModalOpen(true);
                        }}
                        disabled={loading}
                        className="w-full px-5 py-3.5 bg-amber-600 text-white rounded-xl text-sm font-semibold hover:bg-amber-700 transition-all shadow-sm flex items-center justify-center gap-2"
                      >
                        <RotateCcw size={16} />
                        <span>Return</span>
                      </button>
                      <button
                        onClick={() => {
                          setDecisionType('disapprove');
                          setReturnComments('');
                          setIsReturnModalOpen(true);
                        }}
                        disabled={loading}
                        className="w-full px-5 py-3.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-all shadow-sm flex items-center justify-center gap-2"
                      >
                        <X size={16} />
                        <span>Disapprove</span>
                      </button>
                    </div>
                  ) : null
                ) : !isSdsConfirmedRetrievalLog ? (
                  !isSdsReadyForRetrievalLog ? (
                    (user?.role === 'admin' || user?.role === 'oso-staff' || user?.role === 'sds-coordinator') ? (
                      <button
                        onClick={() => {
                          setDecisionType('ready_for_retrieval');
                          setReturnComments('');
                          setExternalProofFile(null);
                          setIsReturnModalOpen(true);
                        }}
                        disabled={loading}
                        className="w-full px-5 py-3.5 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 transition-all shadow-sm mt-2 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <CheckCircle size={16} />
                        <span>Ready for retrieval</span>
                      </button>
                    ) : null
                  ) : !sdsRetrievalLog ? (
                    <button
                      onClick={() => handleDocumentRetrieved('Document retrieved')}
                      disabled={loading}
                      className="w-full px-5 py-3.5 bg-green-700 text-white rounded-xl text-sm font-semibold hover:bg-green-800 transition-all shadow-sm mt-2 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <CheckCircle size={16} />
                      <span>Document Retrieved</span>
                    </button>
                  ) : isFirstSdsRetriever ? (
                    <button
                      disabled
                      className="w-full px-5 py-3.5 bg-purple-600/50 text-white rounded-xl text-sm font-semibold cursor-not-allowed shadow-sm mt-2 flex items-center justify-center gap-2 opacity-80"
                    >
                      <CheckCircle size={16} />
                      <span>Awaiting retrieval confirmation</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleConfirmRetrieval(user?.role === 'org-president' ? 'Retrieval confirmed by Organization President' : 'Retrieval confirmed by SDS Coordinator')}
                      disabled={loading}
                      className="w-full px-5 py-3.5 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 transition-all shadow-sm mt-2 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <CheckCircle size={16} />
                      <span>Confirm Document Retrieval</span>
                    </button>
                  )
                ) : null
              )}

              {/* Final Approval Retrieval (Approved / Main Campus Approved) */}
              {(isReadyForOrgPickup || isApprovedDoc || docStatusLower === 'document retrieval' || docStatusLower === 'document_retrieval') && !isSdsStage && (
                !isMainConfirmedRetrievalLog ? (
                  !isMainReadyForRetrievalLog ? (
                    (user?.role === 'admin' || user?.role === 'oso-staff') ? (
                      <button
                        onClick={() => {
                          setDecisionType('ready_for_retrieval');
                          setReturnComments('');
                          setExternalProofFile(null);
                          setIsReturnModalOpen(true);
                        }}
                        disabled={loading}
                        className="w-full px-5 py-3.5 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 transition-all shadow-sm mt-2 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <CheckCircle size={16} />
                        <span>Ready for retrieval</span>
                      </button>
                    ) : null
                  ) : !mainRetrievalLog ? (
                    <button
                      onClick={() => handleDocumentRetrieved('Document retrieved')}
                      disabled={loading}
                      className="w-full px-5 py-3.5 bg-green-700 text-white rounded-xl text-sm font-semibold hover:bg-green-800 transition-all shadow-sm mt-2 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <CheckCircle size={16} />
                      <span>Document Retrieved</span>
                    </button>
                  ) : isFirstRetriever ? (
                    <button
                      disabled
                      className="w-full px-5 py-3.5 bg-purple-600/50 text-white rounded-xl text-sm font-semibold cursor-not-allowed shadow-sm mt-2 flex items-center justify-center gap-2 opacity-80"
                    >
                      <CheckCircle size={16} />
                      <span>Awaiting retrieval confirmation</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleConfirmRetrieval(user?.role === 'org-president' ? 'Retrieval confirmed by Organization President' : 'Retrieval confirmed by Admin')}
                      disabled={loading}
                      className="w-full px-5 py-3.5 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 transition-all shadow-sm mt-2 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <CheckCircle size={16} />
                      <span>Confirm Document Retrieval</span>
                    </button>
                  )
                ) : null
              )}

              {isWaitingForAccomplishment && (
                <button
                  onClick={() => setIsAccomReportModalOpen(true)}
                  className="hidden md:block w-full px-5 py-3.5 bg-blue-700 text-white rounded-xl text-sm font-semibold hover:bg-blue-800 transition-all shadow-sm mt-2"
                >
                  {accomplishmentReport ? 'View Accomplishment Report' : 'Submit Accomplishment Report'}
                </button>
              )}

              {accomplishmentReport && (
                <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/80 p-4 text-sm text-blue-900 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-blue-700">Accomplishment Report</p>
                  <p className="mt-2 font-semibold">Submitted on {new Date(accomplishmentReport.submitted_at || accomplishmentReport.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                  
                  <p className="text-[10px] font-bold uppercase tracking-widest text-blue-700 mt-4">Participants (College/Unit & Year Level)</p>
                  <p className="mt-1 font-medium">{accomplishmentReport.participants || 'N/A'}</p>

                  <p className="text-[10px] font-bold uppercase tracking-widest text-blue-700 mt-3">Benefiting Group</p>
                  <p className="mt-1 font-medium">{accomplishmentReport.benefiting_group || 'N/A'}</p>

                  <p className="text-[10px] font-bold uppercase tracking-widest text-blue-700 mt-3">Resources Used</p>
                  <p className="mt-1 font-medium">{accomplishmentReport.resources_used || 'N/A'}</p>

                  <p className="text-[10px] font-bold uppercase tracking-widest text-blue-700 mt-3">Problem Encountered</p>
                  <p className="mt-1 whitespace-pre-wrap text-blue-800">{accomplishmentReport.problems_encountered || 'No problems encountered were provided.'}</p>
                  
                  {accomplishmentImages.length > 0 && (
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      {accomplishmentImages.map((image, idx) => (
                        <a key={image.path || idx} href={image.url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border border-blue-100 bg-white shadow-sm">
                          <img src={image.url} alt={image.name || `Accomplishment proof ${idx + 1}`} className="h-24 w-full object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {isWaitingForAccomplishment && (
            <div className="fixed bottom-4 left-4 right-4 z-40 md:hidden">
              <button
                onClick={() => setIsAccomReportModalOpen(true)}
                className="w-full px-5 py-3.5 bg-blue-700 text-white rounded-xl text-sm font-semibold hover:bg-blue-800 transition-all shadow-lg"
              >
                {accomplishmentReport ? 'View Accomplishment Report' : 'Submit Accomplishment Report'}
              </button>
            </div>
          )}

          {isAccomReportModalOpen && (
            <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
              <div className="bg-white rounded-3xl w-full max-w-2xl p-8 flex flex-col shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-300 max-h-[80vh]">
                <div className="flex items-center justify-between mb-6 border-b border-gray-100 pb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center">
                      <CheckCircle size={24} />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800 text-lg">Accomplishment Report Template</h3>
                      <p className="text-gray-500 text-sm">Fill out the form below to generate your report</p>
                    </div>
                  </div>
                  <button onClick={() => setIsAccomReportModalOpen(false)} className="text-gray-400 hover:text-gray-800 p-2">
                    <X size={20} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto pr-2 space-y-4 mb-6">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Participants (College/Unit & Year Level) <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={accomParticipants}
                      onChange={(e) => setAccomParticipants(e.target.value)}
                      placeholder="e.g., CICS 3rd Year Students"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Benefiting Group <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={accomBenefitingGroup}
                      onChange={(e) => setAccomBenefitingGroup(e.target.value)}
                      placeholder="e.g., Local Community, Student Body"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Resources Used <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={accomResources}
                      onChange={(e) => setAccomResources(e.target.value)}
                      placeholder="e.g., Organization Funds, Donated Materials"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Problem Encountered</label>
                    <textarea
                      value={accomReportComments}
                      onChange={(e) => setAccomReportComments(e.target.value)}
                      placeholder="Provide recommendations for future similar activities..."
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all min-h-[80px]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Attach proof images</label>
                    <div className="w-full border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center hover:border-blue-400 transition-all">
                      <label className="cursor-pointer flex flex-col items-center">
                        <div className="bg-blue-50 text-blue-600 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-100 transition-all mb-2">
                          Select Images
                        </div>
                        <input
                          type="file"
                          accept=".jpg,.jpeg,.png,.gif,.webp"
                          multiple
                          onChange={(e) => {
                            const newFiles = Array.from(e.target.files || []);
                            setAccomReportFiles((prev) => [...prev, ...newFiles]);
                            e.target.value = '';
                            setTimeout(() => {
                              document.getElementById('proof-images-gallery')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                            }, 100);
                          }}
                          className="hidden"
                        />
                        <span className="text-xs text-gray-400 text-center">Upload one or more proof images to the accomplishment report folder.</span>
                      </label>
                    </div>
                    {accomReportFiles.length > 0 && (
                      <div id="proof-images-gallery" className="mt-4 grid grid-cols-3 gap-3">
                        {accomReportFiles.map((file, idx) => (
                          <div key={idx} className="relative group rounded-xl overflow-hidden border border-gray-200 aspect-video bg-gray-50">
                            <img 
                              src={URL.createObjectURL(file)} 
                              alt="preview" 
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => setAccomReportFiles(prev => prev.filter((_, i) => i !== idx))}
                              className="absolute top-1 right-1 bg-red-500/90 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => setIsAccomReportModalOpen(false)}
                    className="px-6 py-3 border border-gray-200 text-gray-500 hover:bg-gray-50 rounded-xl font-bold transition-all text-xs uppercase"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (!selectedDoc) {
                        showToast('No activity proposal selected.');
                        return;
                      }
                      if (accomplishmentReport) {
                        setIsAccomReportModalOpen(false);
                        return;
                      }
                      if (!accomParticipants.trim()) {
                        showToast('Please provide the Participants details.');
                        return;
                      }
                      if (!accomBenefitingGroup.trim()) {
                        showToast('Please provide the Benefiting Group.');
                        return;
                      }
                      if (!accomResources.trim()) {
                        showToast('Please provide the Resources Used.');
                        return;
                      }
                      if (accomReportFiles.length === 0) {
                        showToast('Please attach at least one proof image.');
                        return;
                      }

                      setLoading(true);
                      try {
                        const submissionId = selectedDoc.id;
                        const { data: existingSubmission, error: submissionCheckErr } = await supabase
                          .from('submissions')
                          .select('id, status')
                          .eq('id', submissionId)
                          .maybeSingle();

                        if (submissionCheckErr) throw submissionCheckErr;
                        if (!existingSubmission) throw new Error('Activity proposal not found.');

                        const currentStatus = String(existingSubmission.status || '').toLowerCase();
                        if (!currentStatus.includes('waiting for accomplishment report')) {
                          throw new Error('This activity proposal is not ready for an accomplishment report submission.');
                        }

                        const { data: existingReport, error: accomCheckErr } = await supabase
                          .from('activity_accomplishments')
                          .select('id')
                          .eq('submission_id', submissionId)
                          .maybeSingle();

                        if (accomCheckErr) throw accomCheckErr;
                        if (existingReport) {
                          showToast('An accomplishment report already exists for this activity proposal.');
                          return;
                        }

                        await Promise.all(
                          accomReportFiles.map((file, index) => {
                            const safeFileName = file.name.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
                            const filePath = `accom-report/${submissionId}/${Date.now()}-${index}-${safeFileName}`;
                            return supabase.storage
                              .from('documents')
                              .upload(filePath, file, { cacheControl: '3600', upsert: false });
                          })
                        );

                        const { error: accomErr } = await supabase
                          .from('activity_accomplishments')
                          .insert([{
                            submission_id: submissionId,
                            submitted_by: user.id,
                            participants: accomParticipants.trim() || null,
                            benefiting_group: accomBenefitingGroup.trim() || null,
                            resources_used: accomResources.trim() || null,
                            problems_encountered: accomReportComments.trim() || null
                          }]);

                        if (accomErr) throw accomErr;

                        const { error: subErr } = await supabase
                          .from('submissions')
                          .update({
                            status: 'completed',
                            remarks: 'Accomplishment report submitted'
                          })
                          .eq('id', submissionId);

                        if (subErr) throw subErr;

                        const activeVersionId = selectedDoc.raw?.current_version_id ||
                          (Array.isArray(selectedDoc.raw?.submission_versions)
                            ? selectedDoc.raw?.submission_versions[0]?.id
                            : selectedDoc.raw?.submission_versions?.id);

                        const { error: logErr } = await supabase.from('submission_logs').insert([{
                          submission_id: submissionId,
                          submission_version_id: activeVersionId,
                          user_id: user.id,
                          workflow_phase: 'accomplishment',
                          action_type: 'submitted',
                          review_action: 'completed',
                          description: 'Activity accomplishment report submitted',
                          comment: 'Activity accomplishment report submitted',
                          created_at: new Date().toISOString()
                        }]);

                        if (logErr) throw logErr;

                        await loadAccomplishmentReport(submissionId);

                        setSelectedDoc(null);
                        setSelectedVersionId(null);
                        setSearchQuery('');
                        setIsAccomReportModalOpen(false);
                        setAccomReportFiles([]);
                        setAccomReportComments('');
                        setAccomParticipants('');
                        setAccomBenefitingGroup('');
                        setAccomResources('');
                        await fetchHandledLogs();
                        showToast('Accomplishment report submitted!');
                        navigate('/completed', { state: { openDocId: submissionId } });
                      } catch (err) {
                        console.error('Error submitting accomplishment report:', err);
                        showToast(err?.message || 'Failed to submit accomplishment report.');
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all text-xs uppercase shadow-md disabled:opacity-50"
                  >
                    Submit Report
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Resubmit Modal Overlay (Org President) */}
          {isResubmitModalOpen && (() => {
            const returnedAttachments = attachments.filter(file => {
              const fileLog = timelineLogs.find(log => log.attachment_id === file.id);
              return fileLog && fileLog.review_action !== 'approved';
            });

            return (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
                <div className="bg-white rounded-3xl w-full max-w-2xl p-8 flex flex-col shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-300 max-h-[80vh]">
                  <div className="flex items-center justify-between mb-6 border-b border-gray-100 pb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                        <RotateCcw size={24} />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-800 text-lg">Resubmit Document</h3>
                        <p className="text-gray-500 text-sm">Upload new files for the returned attachments.</p>
                      </div>
                    </div>
                    <button onClick={() => setIsResubmitModalOpen(false)} className="text-gray-400 hover:text-gray-800 p-2">
                      <X size={20} />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto pr-2 space-y-4 mb-6">
                    {returnedAttachments.length > 0 ? returnedAttachments.map(file => {
                      const reqId = file.requirement_id;
                      const fileLog = timelineLogs.find(log => log.attachment_id === file.id);
                      return (
                        <div key={file.id} className="p-4 bg-gray-50 border border-amber-200 rounded-xl space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-bold text-gray-800 text-sm">{file.file_name}</p>
                              {fileLog?.comment && (
                                <p className="text-xs text-amber-700 italic mt-1">Comment: "{fileLog.comment}"</p>
                              )}
                            </div>
                            {resubmitFiles[reqId] ? (
                              <span className="px-3 py-1 bg-green-100 text-green-700 rounded text-xs font-bold uppercase">Ready</span>
                            ) : (
                              <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded text-xs font-bold uppercase">Action Required</span>
                            )}
                          </div>
                          <div className="mt-2">
                            <input
                              type="file"
                              accept=".pdf,.docx"
                              className="block w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                              onChange={(e) => {
                                if (e.target.files[0]) {
                                  setResubmitFiles(prev => ({ ...prev, [reqId]: e.target.files[0] }));
                                }
                              }}
                            />
                          </div>
                        </div>
                      );
                    }) : (
                      <div className="text-center py-8 text-gray-500 italic">No returned attachments found to replace.</div>
                    )}
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                    <button
                      onClick={() => setIsResubmitModalOpen(false)}
                      className="px-6 py-3 border border-gray-200 text-gray-500 hover:bg-gray-50 rounded-xl font-bold transition-all text-xs uppercase"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleResubmit}
                      disabled={isResubmitting || Object.keys(resubmitFiles).length < returnedAttachments.length}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all text-xs uppercase shadow-md disabled:opacity-50"
                    >
                      {isResubmitting ? 'Submitting...' : 'Confirm Resubmit'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* PDF Preview Modal Overlay */}
          {previewFile && (() => {
            const requiresReview = attachmentRequiresReview(
              previewFile,
              selectedDoc,
              currentVersion,
              allVersions,
              timelineLogs,
              locallyApproved,
              locallyReturned
            );
            const fileLog = getLatestAttachmentLog(timelineLogs, previewFile.id);
            const previewReturnHistory = getFileReturnHistory(previewFile, allVersions, attachmentReturnLogs);
            const latestPreviewReturn = previewReturnHistory[0] || null;
            const previewDisplayLog =
              latestPreviewReturn ||
              (RETURN_REASONS.includes(String(fileLog?.review_action || '').toLowerCase()) ? fileLog : null);

            return (
              <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-300">
                <div className="bg-white rounded-3xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-300">
                  {/* Header */}
                  <div className="bg-gray-50 border-b border-gray-100 px-8 py-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                        <Paperclip size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-800 text-lg">{previewFile.file_name || 'Attached File'}</h3>
                        <p className="text-gray-400 text-xs font-medium">Verify Document Attachment</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setPreviewFile(null)}
                      className="p-2.5 hover:bg-gray-200 rounded-full transition-colors text-gray-400 hover:text-gray-800"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  {/* Body */}
                  <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                    {/* Left Side: Preview iframe */}
                    <div className="flex-1 bg-gray-100 p-6 flex flex-col h-full overflow-hidden border-r border-gray-100">
                      <div className="flex-1 bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-200/50 relative">
                        {previewFile.file_name?.toLowerCase().includes('.pdf') || previewFile.file_url?.toLowerCase().includes('.pdf') ? (
                          <iframe
                            src={filePreviewUrl ? `${filePreviewUrl}#toolbar=1&navpanes=0&view=Fit` : null}
                            className="w-full h-full border-0 rounded-2xl"
                            title="PDF Preview"
                          />
                        ) : previewFile.file_name?.toLowerCase().includes('.docx') || previewFile.file_url?.toLowerCase().includes('.docx') ? (
                          <iframe
                            src={filePreviewUrl ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(filePreviewUrl)}` : null}
                            className="w-full h-full border-0 rounded-2xl"
                            title="Word Preview"
                          />
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                            <FileText size={48} className="text-gray-300 mb-4 animate-bounce" />
                            <h4 className="font-bold text-gray-700 mb-1">Preview is not supported for this file type</h4>
                            <p className="text-gray-400 text-xs max-w-xs mb-4">You can download it to view locally on your device.</p>
                            <button
                              onClick={() => handleDownload(previewFile.file_url, previewFile.file_name || 'Attached File')}
                              className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-md inline-flex items-center gap-2"
                            >
                              Download Attachment
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="w-full md:w-96 bg-white p-8 flex flex-col justify-between overflow-y-auto border-t md:border-t-0 border-gray-100">
                      <div className="space-y-6">
                        <div>
                          <h4 className="font-bold text-gray-800 text-base mb-1">Attachment Information</h4>
                          <p className="text-gray-400 text-xs leading-relaxed">View the status and return comments for this attachment.</p>
                        </div>

                        {previewDisplayLog && (
                          <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                            <p className="text-[11px] uppercase tracking-widest text-gray-400 mb-2">Latest return context</p>
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-bold uppercase">
                                {(previewDisplayLog.review_action || 'returned').replace('-', ' ')}
                              </span>
                              <span className="text-[10px] text-gray-500 uppercase">
                                by {previewDisplayLog.users?.full_name || previewDisplayLog.users?.role || 'reviewer'}
                              </span>
                            </div>
                            {(previewDisplayLog.comment || previewDisplayLog.description) && (
                              <p className="text-xs text-gray-600 italic">
                                "{previewDisplayLog.comment || previewDisplayLog.description}"
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
          {renderDeliveryProofModal()}
          {renderDeleteDraftModal()}
        </div>
      );
    }


    // Default detail view for chairman/admin and others
    return (
      <div className="animate-in fade-in duration-500 max-w-7xl mx-auto px-4 py-8 pb-32">
        {/* Detail Header */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-8">
          <div className="flex items-start gap-4">
            <button
              onClick={() => { setSelectedDoc(null); setSelectedVersionId(null); }}
              className="mt-1 p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-800"
            >
              <ChevronLeft size={24} />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-800 tracking-tight flex items-center gap-3">
                {selectedDoc.proposal_title && selectedDoc.proposal_title !== '-' ? selectedDoc.proposal_title : selectedDoc.title}
                {allVersions.length > 0 && (
                  <span className="px-3 py-1 bg-gray-100 text-gray-500 text-sm font-bold rounded-lg uppercase tracking-widest">
                    V{currentVersion?.version_number}
                  </span>
                )}
              </h1>
              <p className="text-gray-400 font-mono text-sm mt-1">{selectedDoc.ref}</p>
            </div>
          </div>

          {/* Action Area */}
          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
            {/* Version Selector */}
            {allVersions.length > 1 && (
              <div className="flex items-center gap-3 bg-white border border-gray-100 px-4 py-2 rounded-xl shadow-sm">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Version:</span>
                <select
                  value={currentVersion?.id || ''}
                  onChange={(e) => setSelectedVersionId(e.target.value)}
                  className="bg-gray-50 border-none rounded-lg px-3 py-1.5 text-sm font-bold text-gray-700 outline-none cursor-pointer focus:ring-2 focus:ring-primary-green/20"
                >
                  {allVersions.map(v => (
                    <option key={v.id} value={v.id}>
                      Version {v.version_number} {v.id === selectedDoc.raw.current_version_id ? '(Latest)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {(user?.role === 'org-president' && selectedDoc.status === 'RETURNED') && (
              <button
                onClick={handleContinueClick}
                className="self-start mt-1 px-5 py-3 bg-primary-green text-white rounded-2xl text-xs font-bold uppercase tracking-widest shadow-lg shadow-primary-green/20 hover:bg-green-700 transition-all"
              >
                Continue Editing
              </button>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10 text-gray-800">
          {[
            { label: 'ORGANIZATION', value: selectedDoc.fullOrgName || selectedDoc.raw?.users?.org_name || selectedDoc.sender || '-', icon: <User size={18} /> },
            { label: 'TYPE', value: `${selectedDoc.type}`, icon: <FileText size={18} />, color: 'text-blue-500' },
            { label: 'STATUS', value: (['ready for retrieval', 'waiting for accomplishment report', 'approved'].includes(selectedDoc.status?.toLowerCase())) ? 'APPROVED' : selectedDoc.status, icon: <Clock size={18} />, badge: true },
            { label: 'LAST ACTION', value: selectedDoc.lastAction || selectedDoc.submittedDate, icon: <Calendar size={18} /> }
          ].map((card, idx) => (
            <div key={idx} className="bg-gray-100 p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                {card.icon}
                <span>{card.label}</span>
              </div>
              {card.badge ? (
                <span
                  style={{
                    backgroundColor: `${getStatusColor(card.value)}1a`,
                    color: getStatusColor(card.value)
                  }}
                  className="px-4 py-1.5 rounded-lg text-[10px] font-bold shadow-sm uppercase inline-block"
                >
                  {card.value}
                </span>
              ) : (
                <p className={`font-bold text-gray-800 ${card.color || ''}`}>{card.value}</p>
              )}
            </div>
          ))}
        </div>

        {/* Form Details Content card */}
        {isActivityProposal && (
          <div className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-gray-100 mb-8 text-gray-800">
            <h2 className="text-xl font-bold text-gray-800 mb-8">{selectedDoc.type} Form Details</h2>
            <div className="text-center mb-10">
              <h3 className="text-lg font-bold text-gray-800">
                Document Title: {isActivityProposal ? (selectedDoc.proposal_title && selectedDoc.proposal_title !== '-' ? selectedDoc.proposal_title : selectedDoc.title) : `${selectedDoc.sender} ${selectedDoc.type} ${activeSy ? activeSy.name : ''}`.toUpperCase()}
              </h3>
            </div>

            <div className="space-y-4 text-gray-700 max-w-4xl">
              <div className="flex gap-2">
                <span className="font-bold min-w-[200px]">Person In-Charge:</span>
                <span>{selectedDoc.pic}</span>
              </div>
              <div className="flex gap-2">
                <span className="font-bold min-w-[200px]">Student ID No.:</span>
                <span>{selectedDoc.studentId}</span>
              </div>
              <div className="flex gap-2">
                <span className="font-bold min-w-[200px]">Contact Number:</span>
                <span>{selectedDoc.contact}</span>
              </div>
              <div className="flex gap-2">
                <span className="font-bold min-w-[200px]">Target Date and Time:</span>
                <span>
                  {Array.isArray(selectedDoc.schedules) && selectedDoc.schedules.length > 0 ? (
                    selectedDoc.schedules.map((s, idx) => {
                      let dateStr = 'TBD';
                      if (s.activity_date) {
                        try {
                          dateStr = new Date(s.activity_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase();
                        } catch (e) {
                          dateStr = String(s.activity_date).toUpperCase();
                        }
                      }
                      if (s.end_date) {
                        const endStr = new Date(s.end_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase();
                        return <span key={idx} className="block">{`${dateStr} – ${endStr}`}</span>;
                      }
                      const formatTime = (t) => {
                        if (!t) return 'TBD';
                        try {
                          const [h, m] = t.split(':');
                          const d = new Date(); d.setHours(parseInt(h, 10)); d.setMinutes(parseInt(m, 10));
                          return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase();
                        } catch (e) { return t; }
                      };
                      return <span key={idx} className="block">{`${dateStr} — ${formatTime(s.start_time)} – ${s.is_indefinite ? 'INDEFINITE' : formatTime(s.end_time)}`}</span>;
                    })
                  ) : (
                    selectedDoc.targetDate && selectedDoc.targetTime && selectedDoc.targetDate !== '-' && selectedDoc.targetTime !== '-' ? `${selectedDoc.targetDate} | ${selectedDoc.targetTime}` : selectedDoc.targetDate
                  )}
                </span>
              </div>
              <div className="flex gap-2">
                <span className="font-bold min-w-[200px]">Duration:</span>
                <span>{calculateProposalDuration(selectedDoc.proposalDetails || selectedDoc.raw?.activity_proposal_details || { schedules: selectedDoc.schedules, duration: selectedDoc.duration, is_indefinite_end_time: selectedDoc.is_indefinite_end_time })}</span>
              </div>
              <div className="flex gap-2">
                <span className="font-bold min-w-[200px]">Number of Students:</span>
                <span>{selectedDoc.students}</span>
              </div>
              <div className="flex gap-2">
                <span className="font-bold min-w-[200px]">Nature of Activity:</span>
                <span>{selectedDoc.nature}</span>
              </div>

              <div className="mt-8">
                <p className="font-bold mb-3">Objectives of the Activity:</p>
                <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                  {(() => {
                    const objList = parseObjectivesList(selectedDoc.objectives);
                    if (objList.length > 0) {
                      return (
                        <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700 font-medium">
                          {objList.map((obj, i) => <li key={i}>{obj}</li>)}
                        </ul>
                      );
                    }
                    return (
                      <ul className="list-disc pl-5 space-y-1 text-sm text-gray-500 font-medium">
                        <li>Leadership Development and Formation</li>
                        <li>Membership Development and Formation</li>
                        <li>Organizational Program Management</li>
                        <li>Values Enrichment</li>
                        <li>Technical Skills Development and Industry Exposure</li>
                      </ul>
                    );
                  })()}
                </div>
              </div>

              <div className="mt-6">
                <p className="font-bold mb-2">Target Audience / Participants: <span className="font-normal text-sm">BulSUans Only</span></p>
              </div>

              {isActivityProposal && (selectedDoc.satisfy_goals && selectedDoc.satisfy_goals.length > 0) ? (
                <div className="mt-8">
                  <p className="font-bold mb-4 text-sm leading-relaxed">
                    Describe how this activity will satisfy the needs of the organization and how it will help the organization achieve its goals:
                  </p>
                  <div className="bg-gray-50 p-6 rounded-2xl text-sm leading-relaxed text-gray-600 border border-gray-100 italic">
                    <ol className="list-decimal pl-5 space-y-2">
                      {selectedDoc.satisfy_goals.map((goal, idx) => (
                        <li key={idx} className="font-medium">{goal}</li>
                      ))}
                    </ol>
                  </div>
                </div>
              ) : (
                <span className="text-gray-400 italic">No goals provided.</span>
              )}

              {isActivityProposal && (selectedDoc.sponsors_partners && selectedDoc.sponsors_partners.length > 0) && (
                <div className="mt-8">
                  <p className="font-bold mb-3">List of Sponsors / Partners:</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedDoc.sponsors_partners.map((partner, idx) => (
                      <div key={idx} className="bg-gray-50 rounded-2xl p-4 border border-gray-100 hover:border-primary-green/20 transition-all flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary-green/10 flex items-center justify-center text-primary-green font-bold text-xs">
                          {idx + 1}
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Partner Agency</p>
                          <p className="text-sm font-bold text-gray-800">{partner}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}


        {/* Attached Files Section - Collapsible with Live Data */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 mb-10 transition-all duration-500">
          <button
            onClick={() => setIsFilesOpen(!isFilesOpen)}
            className="w-full bg-[#525252] text-white px-8 py-4 flex items-center justify-between hover:brightness-110 transition-all outline-none"
          >
            <div className="flex items-center gap-3">
              <Paperclip size={20} className="text-white opacity-80" />
              <span className="text-xs font-bold uppercase tracking-widest">Attached File</span>
            </div>
            <ChevronDown size={20} className={`transition-transform duration-500 ${isFilesOpen ? 'rotate-180' : ''}`} />
          </button>

          {isFilesOpen && (
            <div className="p-6 space-y-3 animate-in slide-in-from-top-4 duration-500">
              {attachments && attachments.length > 0 && (
                <div className="flex bg-gray-100 p-1 rounded-xl text-xs font-bold gap-1 mb-3">
                  <button
                    type="button"
                    onClick={() => setDocDetailTabFilter('all')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      docDetailTabFilter === 'all'
                        ? 'bg-emerald-600 text-white shadow-xs font-black'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    All ({attachments.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocDetailTabFilter('osas')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      docDetailTabFilter === 'osas'
                        ? 'bg-emerald-600 text-white shadow-xs font-black'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    OSAS Requirements ({attachments.filter(f => (f.requirements?.requirement_scope || f.requirement?.requirement_scope || 'OSAS') === 'OSAS').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocDetailTabFilter('local')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      docDetailTabFilter === 'local'
                        ? 'bg-emerald-600 text-white shadow-xs font-black'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    LOCAL Requirements ({attachments.filter(f => (f.requirements?.requirement_scope || f.requirement?.requirement_scope || 'OSAS') !== 'OSAS').length})
                  </button>
                </div>
              )}

              {attachments && attachments.length > 0 ? (
                attachments
                  .filter(file => {
                    const reqObj = file.requirements || file.requirement;
                    const scope = reqObj?.requirement_scope || 'OSAS';
                    if (docDetailTabFilter === 'osas') return scope === 'OSAS';
                    if (docDetailTabFilter === 'local') return scope !== 'OSAS';
                    return true;
                  })
                  .map((file, idx) => {
                  const fileName = file.file_name || 'Attached File';
                  let finalPath = file.file_url || '';
                  if (finalPath.startsWith('documents/')) {
                    finalPath = finalPath.replace('documents/', '');
                  }
                  const { data } = supabase.storage.from('documents').getPublicUrl(finalPath);
                  const fileUrl = data?.publicUrl || '#';

                  const { isApproved, returnedForDisplay, fileLog } = getAttachmentReviewDisplay(
                    file,
                    selectedDoc,
                    currentVersion,
                    allVersions,
                    timelineLogs,
                    locallyApproved,
                    locallyReturned,
                    user
                  );

                  const reqObj = file.requirements || file.requirement;
                  const scope = reqObj?.requirement_scope || 'OSAS';
                  const isOsas = scope === 'OSAS';
                  const docStatus = String(selectedDoc?.status || currentVersion?.status || '').toLowerCase();
                  const isForwardedPhase = docStatus.includes('main campus review') || docStatus === 'completed' || docStatus === 'waiting for accomplishment report' || docStatus === 'approved' || docStatus === 'ready for retrieval';
                  const isForwardedItem = isForwardedPhase && isOsas;

                  const isChairmanStage = docStatus === 'submitted' || docStatus === 'oso staff review' || docStatus === 'pending' || docStatus === 'returned';
                  const isChairmanApproved = (locallyApproved && locallyApproved.includes(file.id)) || isApproved || (!isChairmanStage && !returnedForDisplay);

                  // Dynamic styles based on review status
                  let containerBg = 'bg-[#525252]';
                  let textColor = 'text-white';
                  let subtitleColor = 'text-gray-300';
                  let iconStyle = 'bg-white/10 text-white/80';
                  let badgeStyle = 'bg-white/10 text-white/90 border border-white/20';

                  if (returnedForDisplay) {
                    containerBg = 'bg-[#f59e0b]';
                    textColor = 'text-[#451a03]';
                    subtitleColor = 'text-[#78350f]';
                    iconStyle = 'bg-[#78350f]/10 text-[#78350f]';
                    badgeStyle = 'bg-amber-100 text-amber-800 border border-amber-200';
                  } else if (isForwardedPhase || isChairmanApproved) {
                    // Approved or forwarded attachment: Solid Green
                    containerBg = 'bg-green-600 shadow-md';
                    textColor = 'text-white';
                    subtitleColor = 'text-green-100';
                    iconStyle = 'bg-white/20 text-white';
                    badgeStyle = 'bg-white/20 text-white border border-white/30 font-black';
                  } else {
                    // Initial submission (before Chairman approval): Neutral Dark Gray
                    containerBg = 'bg-[#525252]';
                    textColor = 'text-white';
                    subtitleColor = 'text-gray-300';
                    iconStyle = 'bg-white/10 text-white/80';
                    badgeStyle = 'bg-white/10 text-white/90 border border-white/20';
                  }

                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        setPreviewFile(file);
                        setReviewAction('');
                        setReviewComments('');
                      }}
                      className={`${containerBg} rounded-xl p-4 flex items-center justify-between group hover:brightness-110 transition-all cursor-pointer`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 ${iconStyle} rounded-lg flex items-center justify-center shrink-0`}>
                          <Paperclip size={20} />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className={`${textColor} font-semibold text-sm`}>{fileName}</p>
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${badgeStyle}`}>
                              {isOsas ? 'OSAS Requirement' : 'LOCAL Requirement'}
                            </span>
                          </div>
                          <p className={`${subtitleColor} text-[10px] uppercase font-bold mt-0.5`}>
                            {isForwardedItem ? '✓ Forwarded to Main Campus' : 'Attached Document'}
                          </p>
                          {returnedForDisplay && (locallyReturned[file.id]?.comment || fileLog?.comment) && (
                            <p className="mt-1 text-xs italic font-medium opacity-90 max-w-lg">
                              {(fileLog?.users?.full_name || fileLog?.users?.role || user?.role || 'Reviewer')}'s Comment: "{locallyReturned[file.id]?.comment || fileLog?.comment}"
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 pointer-events-auto md:pointer-events-none md:group-hover:pointer-events-auto transition-all">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewFile(file);
                            setReviewAction('');
                            setReviewComments('');
                          }}
                          className="bg-secondary-gold text-white px-6 py-2 rounded-lg text-xs font-bold hover:brightness-110 transition-all shadow-lg inline-block text-center"
                        >
                          view
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(file.file_url, fileName);
                          }}
                          className="bg-secondary-gold text-white px-6 py-2 rounded-lg text-xs font-bold hover:brightness-110 transition-all shadow-lg inline-block text-center"
                        >
                          Download
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-6 text-gray-500 text-sm italic">
                  No dynamic attachments uploaded for this submission.
                </div>
              )}
            </div>
          )}
        </div>

        <SubmissionTimeline
          timelineLogs={timelineLogs}
          submissionStatus={selectedDoc.raw?.status || selectedDoc.status}
          allVersions={allVersions}
          viewingVersionId={currentVersion?.id}
          currentVersionId={selectedDoc.raw?.current_version_id}
          hasDeliveryProof={(externalProofs && externalProofs.length > 0) || !!proofStoragePath}
          onViewDeliveryProof={() => handleViewDeliveryProof(proofStoragePath)}
        />

        {/* Action buttons (Org President only - Bottom of the page) */}
        {user?.role === 'org-president' && selectedDoc.category === 'Returned' && (
          <div className="flex items-center justify-center gap-4 mt-10 p-6 bg-gray-50 border border-gray-100 rounded-3xl shadow-sm max-w-xl mx-auto">
            <button
              onClick={handleResubmitClick}
              className="flex items-center justify-center gap-3 px-8 py-3.5 bg-blue-600 text-white text-xs font-bold rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-blue-600/20 uppercase tracking-widest animate-in"
            >
              <RotateCcw size={16} />
              <span>Resubmit Document</span>
            </button>
          </div>
        )}

        {/* Action buttons (Chairman / Vice Chairman - Bottom of the page) */}
        {isChairmanLikeReviewer(user?.role) && !disableVersionActions && selectedDoc?.category === 'Returned' && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100]">
            <div className="bg-white/80 backdrop-blur-2xl px-10 py-5 rounded-[2rem] border border-white/50 shadow-[0_20px_50px_rgba(0,0,0,0.15)] flex items-center gap-6 animate-in slide-in-from-bottom-12 duration-1000">
              <button
                onClick={() => {
                  setDecisionType('disapprove');
                  setReturnComments('');
                  setIsReturnModalOpen(true);
                }}
                disabled={disableVersionActions}
                className="flex items-center justify-center gap-3 px-8 py-3.5 bg-red-600 text-white text-xs font-bold rounded-2xl hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed transition-all shadow-lg shadow-red-600/20 uppercase tracking-widest animate-in"
              >
                <X size={16} />
                <span>Disapprove</span>
              </button>
            </div>
          </div>
        )}

        {/* Workflow actions in My Documents */}
        {(() => {
          const userRoleNorm = (user?.role || '').toLowerCase();
          const canViewActions =
            userRoleNorm === 'admin' ||
            (userRoleNorm === 'org-president' && (isApprovedDoc || isSdsStage));

          if (!canViewActions) return null;

          const buttons = [];

          if (isSdsStage) {
            if (!isSdsApprovedLog) {
              if (userRoleNorm === 'admin') {
                buttons.push(
                  <button
                    key="verify-approve"
                    onClick={() => {
                      setDecisionType('approve');
                      setReturnComments('');
                      setIsReturnModalOpen(true);
                    }}
                    className="flex items-center justify-center gap-3 px-8 py-3.5 bg-green-700 text-white text-xs font-bold rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-green-700/20 uppercase tracking-widest"
                  >
                    <CheckCircle size={16} />
                    <span>Verify & Approve Hard Copy</span>
                  </button>,
                  <button
                    key="sds-return"
                    onClick={() => {
                      setDecisionType('return');
                      setReturnComments('');
                      setIsReturnModalOpen(true);
                    }}
                    className="flex items-center justify-center gap-3 px-8 py-3.5 bg-amber-600 text-white text-xs font-bold rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-amber-600/20 uppercase tracking-widest"
                  >
                    <RotateCcw size={16} />
                    <span>Return</span>
                  </button>,
                  <button
                    key="sds-disapprove"
                    onClick={() => {
                      setDecisionType('disapprove');
                      setReturnComments('');
                      setIsReturnModalOpen(true);
                    }}
                    className="flex items-center justify-center gap-3 px-8 py-3.5 bg-red-600 text-white text-xs font-bold rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-red-600/20 uppercase tracking-widest"
                  >
                    <X size={16} />
                    <span>Disapprove</span>
                  </button>
                );
              }
            } else if (!isSdsConfirmedRetrievalLog) {
              if (!isSdsReadyForRetrievalLog) {
                if (userRoleNorm === 'admin') {
                  buttons.push(
                    <button
                      key="sds-ready"
                      onClick={() => {
                        setDecisionType('ready_for_retrieval');
                        setReturnComments('');
                        setExternalProofFile(null);
                        setIsReturnModalOpen(true);
                      }}
                      className="flex items-center justify-center gap-3 px-8 py-3.5 bg-purple-600 text-white text-xs font-bold rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-purple-600/20 uppercase tracking-widest"
                    >
                      <CheckCircle size={16} />
                      <span>Ready for retrieval</span>
                    </button>
                  );
                }
              } else if (!sdsRetrievalLog) {
                buttons.push(
                  <button
                    key="sds-retrieved"
                    onClick={() => handleDocumentRetrieved('Document retrieved')}
                    disabled={loading}
                    className="flex items-center justify-center gap-3 px-8 py-3.5 bg-green-700 text-white text-xs font-bold rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-green-700/20 uppercase tracking-widest disabled:opacity-50"
                  >
                    <CheckCircle size={16} />
                    <span>Document Retrieved</span>
                  </button>
                );
              } else if (sdsRetrievalLog && isFirstSdsRetriever) {
                buttons.push(
                  <button
                    key="sds-awaiting"
                    disabled
                    className="flex items-center justify-center gap-3 px-8 py-3.5 bg-purple-600/50 text-white text-xs font-bold rounded-2xl cursor-not-allowed shadow-lg shadow-purple-600/10 uppercase tracking-widest"
                  >
                    <CheckCircle size={16} />
                    <span>Awaiting retrieval confirmation</span>
                  </button>
                );
              } else if (sdsRetrievalLog && !isFirstSdsRetriever) {
                buttons.push(
                  <button
                    key="sds-confirm"
                    onClick={() => handleConfirmRetrieval(userRoleNorm === 'org-president' ? 'Retrieval confirmed by Organization President' : 'Retrieval confirmed by SDS Coordinator')}
                    disabled={loading}
                    className="flex items-center justify-center gap-3 px-8 py-3.5 bg-purple-600 text-white text-xs font-bold rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-purple-600/20 uppercase tracking-widest disabled:opacity-50"
                  >
                    <CheckCircle size={16} />
                    <span>Confirm Document Retrieval</span>
                  </button>
                );
              }
            }
          } else if (isDeanApprovedDoc) {
            buttons.push(
              <button
                key="send-external"
                onClick={() => {
                  setDecisionType('send_to_external');
                  setReturnComments('');
                  setExternalProofFile(null);
                  setIsReturnModalOpen(true);
                }}
                className="flex items-center justify-center gap-3 px-8 py-3.5 bg-blue-600 text-white text-xs font-bold rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-blue-600/20 uppercase tracking-widest"
              >
                <ArrowUpRight size={16} />
                <span>Sent to main campus</span>
              </button>
            );
          } else if (isApprovedDoc || docStatusLower === 'document retrieval' || docStatusLower === 'ready for retrieval' || docStatusLower === 'document_retrieval') {
            if (!isMainConfirmedRetrievalLog) {
              if (!isMainReadyForRetrievalLog) {
                if (userRoleNorm === 'admin') {
                  buttons.push(
                    <button
                      key="main-ready"
                      onClick={() => {
                        setDecisionType('ready_for_retrieval');
                        setReturnComments('');
                        setExternalProofFile(null);
                        setIsReturnModalOpen(true);
                      }}
                      className="flex items-center justify-center gap-3 px-8 py-3.5 bg-purple-600 text-white text-xs font-bold rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-purple-600/20 uppercase tracking-widest"
                    >
                      <CheckCircle size={16} />
                      <span>Ready for retrieval</span>
                    </button>
                  );
                }
              } else if (!mainRetrievalLog) {
                buttons.push(
                  <button
                    key="main-retrieved"
                    onClick={() => handleDocumentRetrieved('Document retrieved')}
                    disabled={loading}
                    className="flex items-center justify-center gap-3 px-8 py-3.5 bg-green-700 text-white text-xs font-bold rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-green-700/20 uppercase tracking-widest disabled:opacity-50"
                  >
                    <CheckCircle size={16} />
                    <span>Document Retrieved</span>
                  </button>
                );
              } else if (mainRetrievalLog && isFirstRetriever) {
                buttons.push(
                  <button
                    key="main-awaiting"
                    disabled
                    className="flex items-center justify-center gap-3 px-8 py-3.5 bg-purple-600/50 text-white text-xs font-bold rounded-2xl cursor-not-allowed shadow-lg shadow-purple-600/10 uppercase tracking-widest"
                  >
                    <CheckCircle size={16} />
                    <span>Awaiting retrieval confirmation</span>
                  </button>
                );
              } else if (mainRetrievalLog && !isFirstRetriever) {
                buttons.push(
                  <button
                    key="main-confirm"
                    onClick={() => handleConfirmRetrieval(userRoleNorm === 'org-president' ? 'Retrieval confirmed by Organization President' : 'Retrieval confirmed by Admin')}
                    disabled={loading}
                    className="flex items-center justify-center gap-3 px-8 py-3.5 bg-purple-600 text-white text-xs font-bold rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-purple-600/20 uppercase tracking-widest disabled:opacity-50"
                  >
                    <CheckCircle size={16} />
                    <span>Confirm Document Retrieval</span>
                  </button>
                );
              }
            }
          }

          const currentAttachments = attachments || selectedDoc?.attachments || currentVersion?.submission_attachments || [];
          const allFilesApproved = currentAttachments.length > 0 && currentAttachments.every((file) => {
            if (locallyReturned[file.id]) return false;
            const fileLog = (timelineLogs || []).find((l) => l.attachment_id === file.id || (l.comment && l.comment.includes(file.file_name)));
            const reviewActionValue = String(fileLog?.review_action || '').toLowerCase();
            if (RETURN_REASONS.includes(reviewActionValue)) return false;

            return (
              locallyApproved.includes(file.id) ||
              reviewActionValue === 'approved'
            );
          });

          if (!isDeanApprovedDoc && buttons.length === 0 && (selectedDoc?.category === 'Pending Hard Copy' || selectedDoc?.category === 'To Forward' || (selectedDoc?.raw?.status || selectedDoc?.status || '').toLowerCase().includes('forward'))) {
            buttons.push(
              <button
                key="forward-verify-approve"
                onClick={() => {
                  setDecisionType('approve');
                  setReturnComments('');
                  setIsReturnModalOpen(true);
                }}
                disabled={hasBlockingReturnedAttachments || hasLocallyReturnedAttachments}
                className="flex items-center justify-center gap-3 px-8 py-3.5 bg-green-600 text-white text-xs font-bold rounded-2xl hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed transition-all shadow-lg shadow-green-600/20 uppercase tracking-widest"
              >
                <CheckCircle size={16} />
                <span>Verify & Approve</span>
              </button>,
              <button
                key="forward-return"
                onClick={() => {
                  setDecisionType('return');
                  setReturnComments('');
                  setIsReturnModalOpen(true);
                }}
                disabled={allFilesApproved}
                title={allFilesApproved ? "All attachments are approved. Click Approve to proceed." : ""}
                className={`flex items-center justify-center gap-3 px-8 py-3.5 bg-amber-500 text-white text-xs font-bold rounded-2xl transition-all shadow-lg shadow-amber-500/20 uppercase tracking-widest ${
                  allFilesApproved ? 'opacity-40 cursor-not-allowed' : 'hover:scale-105 active:scale-95'
                }`}
              >
                <RotateCcw size={16} />
                <span>Return</span>
              </button>,
              <button
                key="forward-disapprove"
                onClick={() => {
                  setDecisionType('disapprove');
                  setReturnComments('');
                  setIsReturnModalOpen(true);
                }}
                className="flex items-center justify-center gap-3 px-8 py-3.5 bg-red-600 text-white text-xs font-bold rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-red-600/20 uppercase tracking-widest"
              >
                <X size={16} />
                <span>Disapprove</span>
              </button>
            );
          } else if (!isDeanApprovedDoc && buttons.length === 0 && (selectedDoc?.category === 'Final In-Campus review' || selectedDoc?.category === 'Dean Review' || selectedDoc?.category === 'SDS Review' || selectedDoc?.category === 'Main Campus Review')) {
            buttons.push(
              <button
                key="review-approve"
                onClick={() => {
                  setDecisionType('approve');
                  setReturnComments('');
                  setIsReturnModalOpen(true);
                }}
                disabled={hasBlockingReturnedAttachments || hasLocallyReturnedAttachments}
                className="flex items-center justify-center gap-3 px-8 py-3.5 bg-green-600 text-white text-xs font-bold rounded-2xl hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed transition-all shadow-lg shadow-green-600/20 uppercase tracking-widest"
              >
                <CheckCircle size={16} />
                <span>Approve</span>
              </button>,
              <button
                key="review-return"
                onClick={() => {
                  setDecisionType('return');
                  setReturnComments('');
                  setIsReturnModalOpen(true);
                }}
                disabled={allFilesApproved}
                title={allFilesApproved ? "All attachments are approved. Click Approve to proceed." : ""}
                className={`flex items-center justify-center gap-3 px-8 py-3.5 bg-amber-500 text-white text-xs font-bold rounded-2xl transition-all shadow-lg shadow-amber-500/20 uppercase tracking-widest ${
                  allFilesApproved ? 'opacity-40 cursor-not-allowed' : 'hover:scale-105 active:scale-95'
                }`}
              >
                <RotateCcw size={16} />
                <span>Return</span>
              </button>,
              <button
                key="review-disapprove"
                onClick={() => {
                  setDecisionType('disapprove');
                  setReturnComments('');
                  setIsReturnModalOpen(true);
                }}
                className="flex items-center justify-center gap-3 px-8 py-3.5 bg-red-600 text-white text-xs font-bold rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-red-600/20 uppercase tracking-widest"
              >
                <X size={16} />
                <span>Disapprove</span>
              </button>
            );
          }

          if (buttons.length === 0) return null;

          return (
            <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50">
              <div className="bg-white/80 backdrop-blur-2xl px-8 py-4 rounded-[2rem] border border-white/50 shadow-[0_20px_50px_rgba(0,0,0,0.15)] flex items-center gap-4 animate-in slide-in-from-bottom-12 duration-1000">
                {buttons}
              </div>
            </div>
          );
        })()}

        {/* PDF Preview Modal Overlay */}
        {previewFile && (() => {
          const requiresReview = attachmentRequiresReview(
            previewFile,
            selectedDoc,
            currentVersion,
            allVersions,
            timelineLogs,
            locallyApproved,
            locallyReturned
          );
          const fileLog = getLatestAttachmentLog(timelineLogs, previewFile.id);
          const previewReturnHistory = getFileReturnHistory(previewFile, allVersions, attachmentReturnLogs);
          const latestPreviewReturn = previewReturnHistory[0] || null;
          const previewDisplayLog =
            latestPreviewReturn ||
            (RETURN_REASONS.includes(String(fileLog?.review_action || '').toLowerCase()) ? fileLog : null);

          return (
            <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-300">
              <div className="bg-white rounded-3xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="bg-gray-50 border-b border-gray-100 px-8 py-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                      <Paperclip size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800 text-lg">{previewFile.file_name || 'Attached File'}</h3>
                      <p className="text-gray-400 text-xs font-medium">Verify Document Attachment</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setPreviewFile(null)}
                    className="p-2.5 hover:bg-gray-200 rounded-full transition-colors text-gray-400 hover:text-gray-800"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Body */}
                <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                  {/* Left Side: Preview iframe */}
                  <div className="flex-1 bg-gray-100 p-6 flex flex-col h-full overflow-hidden border-r border-gray-100">
                    <div className="flex-1 bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-200/50 relative">
                      {previewFile.file_name?.toLowerCase().includes('.pdf') || previewFile.file_url?.toLowerCase().includes('.pdf') ? (
                        <iframe
                          src={filePreviewUrl ? `${filePreviewUrl}#toolbar=1&navpanes=0&view=Fit` : null}
                          className="w-full h-full border-0 rounded-2xl"
                          title="PDF Preview"
                        />
                      ) : previewFile.file_name?.toLowerCase().includes('.docx') || previewFile.file_url?.toLowerCase().includes('.docx') ? (
                        <iframe
                          src={filePreviewUrl ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(filePreviewUrl)}` : null}
                          className="w-full h-full border-0 rounded-2xl"
                          title="Word Preview"
                        />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                          <FileText size={48} className="text-gray-300 mb-4 animate-bounce" />
                          <h4 className="font-bold text-gray-700 mb-1">Preview is not supported for this file type</h4>
                          <p className="text-gray-400 text-xs max-w-xs mb-4">You can download it to view locally on your device.</p>
                          <button
                            onClick={() => handleDownload(previewFile.file_url, previewFile.file_name || 'Attached File')}
                            className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-md inline-flex items-center gap-2"
                          >
                            Download Attachment
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="w-full md:w-96 bg-white p-8 flex flex-col justify-between overflow-y-auto border-t md:border-t-0 border-gray-100">
                    <div className="space-y-6">
                      <div>
                        <h4 className="font-bold text-gray-800 text-base mb-1">Attachment Review Panel</h4>
                        <p className="text-gray-400 text-xs leading-relaxed">Review or return this attachment as part of the current approval step.</p>
                      </div>

                      {previewDisplayLog && (
                        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                          <p className="text-[11px] uppercase tracking-widest text-gray-400 mb-2">Latest return context</p>
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-bold uppercase">
                              {(previewDisplayLog.review_action || 'returned').replace('-', ' ')}
                            </span>
                            <span className="text-[10px] text-gray-500 uppercase">
                              by {previewDisplayLog.users?.full_name || previewDisplayLog.users?.role || 'reviewer'}
                            </span>
                          </div>
                          {(previewDisplayLog.comment || previewDisplayLog.description) && (
                            <p className="text-xs text-gray-600 italic">
                              "{previewDisplayLog.comment || previewDisplayLog.description}"
                            </p>
                          )}
                        </div>
                      )}

                      {user?.role !== 'org-president' && (
                        <>
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block">Review Action</label>
                            <select
                              value={reviewAction}
                              onChange={(e) => setReviewAction(e.target.value)}
                              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                            >
                              <option value="">None / Approved</option>
                              <option value="missing-requirements">Missing Requirements</option>
                              <option value="incorrect-format">Incorrect Format</option>
                              <option value="incomplete-information">Incomplete Information</option>
                            </select>
                          </div>

                          <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block">Review Comments</label>
                            <textarea
                              value={reviewComments}
                              onChange={(e) => setReviewComments(e.target.value)}
                              placeholder="Enter review comments..."
                              rows={4}
                              className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                            />
                          </div>
                        </>
                      )}
                    </div>

                    {user?.role !== 'org-president' && (
                      <div className="space-y-3 pt-6 border-t border-gray-100 mt-6">
                        {!requiresReview && (
                          <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-center">
                            <CheckCircle size={20} className="text-green-600 mx-auto mb-2" />
                            <p className="text-xs font-bold text-green-700 uppercase tracking-wider">Already Approved</p>
                            <p className="text-xs text-green-600 mt-1">No re-approval needed. You can still return this file if you find an issue.</p>
                          </div>
                        )}

                        {requiresReview && (
                          <button
                            onClick={handleApproveAttachment}
                            disabled={attachmentSaving}
                            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all shadow-lg shadow-green-600/10 uppercase text-xs tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <CheckCircle size={16} />
                            <span>{attachmentSaving ? 'Saving...' : 'Approve Attachment'}</span>
                          </button>
                        )}

                        <button
                          onClick={handleSaveAttachmentFeedback}
                          disabled={!reviewAction || attachmentSaving}
                          className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition-all shadow-lg shadow-amber-500/10 uppercase text-xs tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <RotateCcw size={16} />
                          <span>{attachmentSaving ? 'Saving...' : 'Return Attachment'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Dean review approved success modal (Admin) */}
        {isDeanApproveSuccessModalOpen && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl w-full max-w-md p-8 flex flex-col shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-300">
              <div className="w-14 h-14 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                <CheckCircle size={28} />
              </div>
              <h3 className="font-bold text-gray-800 text-lg mb-2 text-center">Dean Review Approved</h3>
              <p className="text-gray-500 text-sm mt-1 text-center">
                The document has been approved successfully. You can now send it to the main campus for review.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    setIsDeanApproveSuccessModalOpen(false);
                    setDecisionType('send_to_external');
                    setReturnComments('');
                    setExternalProofFile(null);
                    setIsReturnModalOpen(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 uppercase text-xs tracking-wider"
                >
                  <ArrowUpRight size={16} />
                  <span>Sent to Main Campus</span>
                </button>
                <button
                  onClick={() => setIsDeanApproveSuccessModalOpen(false)}
                  className="w-full px-6 py-3 border border-gray-200 text-gray-500 hover:bg-gray-50 rounded-xl font-bold transition-all text-xs uppercase"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Return/Disapprove Modal (Chairman Actions) */}
        {isReturnModalOpen && (() => {
          let modalIcon = <RotateCcw size={24} />;
          let modalIconBg = 'bg-amber-50 text-amber-600';
          let modalTitle = 'Return Submission';
          let modalDescription = (
            <>
              Are you sure you want to return this submission to the sender?
              This will update the status to <strong className="text-amber-600">Returned</strong>.
            </>
          );
          let placeholderText = 'Enter comments for return...';
          let ringClass = 'focus:ring-amber-500/20 focus:border-amber-500';
          let confirmBtnText = 'Confirm Return';
          let confirmBtnBg = 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/10';
          let onConfirm = () => handleReturnSubmission(returnComments);
          let disableConfirm = false;

          if (decisionType === 'approve') {
            modalIcon = <CheckCircle size={24} />;
            modalIconBg = 'bg-green-50 text-green-600';
            modalTitle = 'Approve Submission';
            modalDescription = (
              <>
                Are you sure you want to approve this submission?
                This will advance the document to the next workflow stage.
              </>
            );
            placeholderText = 'Enter optional approval comments...';
            ringClass = 'focus:ring-green-500/20 focus:border-green-500';
            confirmBtnText = 'Confirm Approve';
            confirmBtnBg = 'bg-green-600 hover:bg-green-700 shadow-green-600/10';
            onConfirm = () => handleApproveSubmission(returnComments);
          } else if (decisionType === 'disapprove') {
            modalIcon = <X size={24} />;
            modalIconBg = 'bg-red-50 text-red-600';
            modalTitle = 'Disapprove Submission';
            modalDescription = (
              <>
                Are you sure you want to disapprove this submission?
                This will mark the status as <strong className="text-red-600">Disapproved</strong>.
              </>
            );
            placeholderText = 'Enter disapproval comments...';
            ringClass = 'focus:ring-red-500/20 focus:border-red-500';
            confirmBtnText = 'Confirm Disapprove';
            confirmBtnBg = 'bg-red-600 hover:bg-red-700 shadow-red-600/10';
            onConfirm = () => handleDisapproveSubmission(returnComments);
          } else if (decisionType === 'send_to_external') {
            modalIcon = <ArrowUpRight size={24} />;
            modalIconBg = 'bg-blue-50 text-blue-600';
            modalTitle = 'Send to Main Campus Review';
            modalDescription = (
              <>
                Confirm this document has been sent to the main campus.
                Upload image proof and optional comments. Status will move to <strong className="text-blue-600">Main Campus Review</strong>.
              </>
            );
            placeholderText = 'Enter optional comments...';
            ringClass = 'focus:ring-blue-500/20 focus:border-blue-500';
            confirmBtnText = 'Confirm Send';
            confirmBtnBg = 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/10';
            disableConfirm = !externalProofFile;
            onConfirm = async () => {
              if (!externalProofFile) {
                showToast('Please upload image proof that the document was sent to the main campus.');
                return;
              }
              handleSendToExternal(returnComments);
            };
          } else if (decisionType === 'ready_for_retrieval') {
            modalIcon = <CheckCircle size={24} />;
            modalIconBg = 'bg-purple-50 text-purple-600';
            modalTitle = 'Ready for Retrieval';
            modalDescription = (
              <>
                Mark this document as ready for retrieval by the organization president.
              </>
            );
            placeholderText = 'Enter optional comments...';
            ringClass = 'focus:ring-purple-500/20 focus:border-purple-500';
            confirmBtnText = 'Confirm Ready';
            confirmBtnBg = 'bg-purple-600 hover:bg-purple-700 shadow-purple-600/10';
            onConfirm = () => handleReadyForRetrieval(returnComments);
          }

          return (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300 overflow-y-auto">
              <div className={`bg-white rounded-3xl w-full ${
                decisionType === 'send_to_external' ? 'max-w-4xl' : 'max-w-md'
              } max-h-[90vh] flex flex-col shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-300 overflow-hidden my-auto`}>
                
                {/* Header (Sticky / Fixed) */}
                <div className="p-6 border-b border-gray-100 flex items-start justify-between gap-4 shrink-0 bg-white">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 ${modalIconBg} rounded-2xl flex items-center justify-center shrink-0`}>
                      {modalIcon}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800 text-lg leading-tight">{modalTitle}</h3>
                      <p className="text-gray-500 text-xs mt-1 leading-normal">
                        {modalDescription}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setIsReturnModalOpen(false);
                      setExternalProofFile(null);
                    }}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all shrink-0"
                    title="Close"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Modal Body (Scrollable) */}
                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                  {decisionType === 'send_to_external' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                      {/* LEFT COLUMN: Attachment List of Documents to be Forwarded */}
                      <div className="flex flex-col space-y-3 bg-gray-50/60 p-4 rounded-2xl border border-gray-100 h-full">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-gray-700 uppercase tracking-widest block">
                            Documents to be Forwarded
                          </label>
                          <span className="text-[10px] font-black px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
                            OSAS Only
                          </span>
                        </div>

                        {/* General Description Notice applying to all forwarded attachments */}
                        <div className="p-3 bg-emerald-50/90 border border-emerald-200 rounded-xl text-emerald-900 text-xs leading-relaxed font-medium">
                          The attachments listed below are classified as <strong>OSAS Requirements</strong> and will be automatically forwarded to Main Campus Review.
                        </div>

                        <div className="space-y-2.5 overflow-y-auto max-h-[300px] pr-1">
                          {(() => {
                            const allVer = Array.isArray(selectedDoc?.raw?.submission_versions)
                              ? selectedDoc.raw.submission_versions
                              : [selectedDoc?.raw?.submission_versions].filter(Boolean);
                            const activeVer = allVer.find(v => v.id === (selectedVersionId || selectedDoc?.raw?.current_version_id)) || allVer[0];
                            const rawAtts = activeVer?.submission_attachments || selectedDoc?.attachments || [];
                            
                            const forwardedAtts = rawAtts.filter(att => {
                              const req = att.requirements || att.requirement;
                              const scope = (req?.requirement_scope || 'OSAS').toString().trim().toUpperCase();
                              return scope === 'OSAS';
                            });

                            if (forwardedAtts.length === 0) {
                              return (
                                <p className="text-xs text-gray-400 italic py-6 text-center">
                                  No OSAS documents found for Main Campus forwarding.
                                </p>
                              );
                            }

                            return forwardedAtts.map((att, idx) => {
                              const req = att.requirements || att.requirement;

                              return (
                                <div key={att.id || idx} className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/70 flex items-center gap-3.5 shadow-xs">
                                  <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center shrink-0">
                                    <FileText size={18} className="text-emerald-700" />
                                  </div>
                                  <div className="truncate flex-1">
                                    <p className="text-xs font-bold text-gray-800 truncate">{att.file_name || att.title || 'Attachment'}</p>
                                    <p className="text-[11px] text-emerald-800 font-semibold truncate mt-0.5">{req?.title || req?.name || 'Requirement'}</p>
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>

                      {/* RIGHT COLUMN: Upload Proof, Live Preview & Comments */}
                      <div className="flex flex-col space-y-5">
                        {/* Upload Proof */}
                        <div className="space-y-2">
                          <label className="block text-xs font-bold text-gray-700 uppercase tracking-widest">
                            Upload Proof (Image Only) <span className="text-red-500">*</span>
                          </label>
                          <p className="text-[11px] text-gray-400">Attach a screenshot or image proof (JPEG, PNG, WEBP) that this submission was sent to main campus.</p>
                          <div className="border-2 border-dashed border-gray-300 rounded-2xl p-3.5 text-center bg-gray-50 hover:border-indigo-400 transition-all">
                            <input
                              id="externalProof"
                              type="file"
                              accept="image/*,.jpg,.jpeg,.png,.webp"
                              onChange={(e) => {
                                const file = e.target.files?.[0] || null;
                                if (file && !file.type.startsWith('image/')) {
                                  showToast('Only image files (PNG, JPG, WEBP, etc.) are allowed as proof.');
                                  e.target.value = '';
                                  setExternalProofFile(null);
                                  return;
                                }
                                setExternalProofFile(file);
                              }}
                              className="w-full text-xs text-gray-700 file:mr-3 file:rounded-xl file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-blue-700 cursor-pointer"
                            />
                          </div>

                          {/* Live Image Preview */}
                          {externalProofFile && (
                            <div className="mt-2 p-3 bg-gray-50 rounded-2xl border border-gray-200 space-y-2">
                              <p className="text-xs font-bold text-gray-600 flex items-center gap-2">
                                <Eye size={14} className="text-blue-600" /> Proof Image Preview:
                              </p>
                              <div className="relative rounded-xl overflow-hidden border border-gray-200 max-h-36 flex justify-center bg-black/5 p-1">
                                <img
                                  src={URL.createObjectURL(externalProofFile)}
                                  alt="Main Campus Proof Preview"
                                  className="object-contain max-h-32 w-full rounded-lg"
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Comments / Remarks */}
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-700 uppercase tracking-widest block">
                            Add comments / remarks
                          </label>
                          <textarea
                            value={returnComments}
                            onChange={(e) => setReturnComments(e.target.value)}
                            placeholder={placeholderText}
                            rows={3}
                            className={`w-full bg-gray-50 border border-gray-200 rounded-2xl p-3.5 text-sm text-gray-700 focus:outline-none focus:ring-2 ${ringClass} transition-all resize-none font-medium`}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block">Add comments</label>
                      <textarea
                        value={returnComments}
                        onChange={(e) => setReturnComments(e.target.value)}
                        placeholder={placeholderText}
                        rows={4}
                        className={`w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 text-sm text-gray-700 focus:outline-none focus:ring-2 ${ringClass} transition-all resize-none text-gray-800 font-medium`}
                      />
                    </div>
                  )}
                </div>

                {/* Footer (Sticky / Fixed) */}
                <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end gap-3 shrink-0">
                  <button
                    onClick={() => {
                      setIsReturnModalOpen(false);
                      setExternalProofFile(null);
                    }}
                    className="px-6 py-3 border border-gray-200 text-gray-600 hover:bg-gray-100 rounded-xl font-bold transition-all text-xs uppercase tracking-wider"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={onConfirm}
                    disabled={loading || externalProofUploading || disableConfirm}
                    className={`px-6 py-3 ${confirmBtnBg} text-white rounded-xl font-bold transition-all text-xs uppercase tracking-wider shadow-md disabled:opacity-50`}
                  >
                    {externalProofUploading ? 'Uploading...' : confirmBtnText}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Forward Confirmation Modal */}
        {isForwardModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl w-full max-w-md p-8 flex flex-col shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-300">
              <div className="w-12 h-12 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mb-6">
                <CheckCircle size={24} />
              </div>
              <h3 className="font-bold text-gray-800 text-lg mb-2">Forward Submission</h3>
              <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                Are you sure you want to forward this document to the recipient?
              </p>

              {/* Confirmation Details Card */}
              <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 space-y-4 mb-6">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1 font-bold text-gray-500">Document Title</label>
                  <p className="text-sm font-semibold text-gray-800 leading-snug">
                    {selectedDoc.proposal_title && selectedDoc.proposal_title !== '-' ? selectedDoc.proposal_title : selectedDoc.title}
                  </p>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5 font-bold text-gray-500">Attached Files</label>
                  <div className="space-y-1">
                    {attachments.map((file, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 text-xs text-gray-600">
                        <Paperclip size={12} className="text-gray-400" />
                        <span className="font-medium truncate max-w-[280px]">{file.file_name || 'Attached File'}</span>
                      </div>
                    ))}
                    {attachments.length === 0 && (
                      <p className="text-xs text-gray-400 italic font-medium">No attachments found</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1 font-bold text-gray-500">Recipient</label>
                  <p className="text-sm font-bold text-indigo-600">
                    SDS Coordinator (Admin)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsForwardModalOpen(false)}
                  className="flex-1 px-5 py-3 border border-gray-200 text-gray-500 hover:bg-gray-50 rounded-xl font-bold transition-all text-xs uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  onClick={handleForwardSubmission}
                  disabled={loading}
                  className="flex-1 px-5 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold transition-all text-xs uppercase tracking-wider shadow-md shadow-green-600/10 disabled:opacity-50"
                >
                  Confirm Forward
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Resubmit Modal Overlay */}
        {isResubmitModalOpen && (() => {
          const returnedAttachments = attachments.filter(file => {
            const fileLog = timelineLogs.find(log => log.attachment_id === file.id);
            return fileLog && fileLog.review_action !== 'approved';
          });

          return (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
              <div className="bg-white rounded-3xl w-full max-w-2xl p-8 flex flex-col shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-300 max-h-[80vh]">
                <div className="flex items-center justify-between mb-6 border-b border-gray-100 pb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                      <RotateCcw size={24} />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800 text-lg">Resubmit Document</h3>
                      <p className="text-gray-500 text-sm">Upload new files for the returned attachments.</p>
                    </div>
                  </div>
                  <button onClick={() => setIsResubmitModalOpen(false)} className="text-gray-400 hover:text-gray-800 p-2">
                    <X size={20} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 space-y-4 mb-6">
                  {returnedAttachments.length > 0 ? returnedAttachments.map(file => {
                    const reqId = file.requirement_id;
                    const fileLog = timelineLogs.find(log => log.attachment_id === file.id);
                    return (
                      <div key={file.id} className="p-4 bg-gray-50 border border-amber-200 rounded-xl space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-bold text-gray-800 text-sm">{file.file_name}</p>
                            {fileLog?.comment && (
                              <p className="text-xs text-amber-700 italic mt-1">Comment: "{fileLog.comment}"</p>
                            )}
                          </div>
                          {resubmitFiles[reqId] ? (
                            <span className="px-3 py-1 bg-green-100 text-green-700 rounded text-xs font-bold uppercase">Ready</span>
                          ) : (
                            <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded text-xs font-bold uppercase">Action Required</span>
                          )}
                        </div>
                        <div className="mt-2">
                          <input
                            type="file"
                            accept=".pdf,.docx"
                            className="block w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                            onChange={(e) => {
                              if (e.target.files[0]) {
                                setResubmitFiles(prev => ({ ...prev, [reqId]: e.target.files[0] }));
                              }
                            }}
                          />
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="text-center py-8 text-gray-500 italic">No returned attachments found to replace.</div>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => setIsResubmitModalOpen(false)}
                    className="px-6 py-3 border border-gray-200 text-gray-500 hover:bg-gray-50 rounded-xl font-bold transition-all text-xs uppercase"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleResubmit}
                    disabled={isResubmitting || Object.keys(resubmitFiles).length < returnedAttachments.length}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all text-xs uppercase shadow-md disabled:opacity-50"
                  >
                    {isResubmitting ? 'Submitting...' : 'Confirm Resubmit'}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
        {renderDeliveryProofModal()}
        {renderDeleteDraftModal()}
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-6 duration-1000">
      {/* Page Header - Matching Inbox */}
      <div className="flex items-end justify-between mb-8 border-b border-gray-100 pb-6">
        <PageHeader 
          title="My Documents" 
          subtitle="Track your handled and reviewed document status" 
          icon={FileText} 
          iconColor="blue" 
        />

        <div className="flex items-center gap-3">
          <div className="flex p-1 bg-gray-100/50 rounded-xl border border-gray-100">
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent pl-8 pr-4 py-2 text-sm outline-none w-64 text-gray-600 font-medium"
              />
              <Search className="absolute left-2 text-gray-400" size={16} />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex p-1 bg-gray-50 rounded-2xl border border-gray-100 shadow-inner overflow-x-auto no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.name}
              onClick={() => setActiveTab(tab.name)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === tab.name
                ? 'bg-white text-primary-green shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              {tab.name}
              <span className={`px-2 py-0.5 rounded-md text-[10px] ${activeTab === tab.name ? 'bg-primary-green text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm mb-10">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Clock size={36} className="animate-spin mb-4 text-primary-green" />
              <p className="text-sm font-semibold">Loading documents data...</p>
            </div>
          ) : filteredDocs.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#073c2d] text-white">
                  <th className="px-6 py-4 font-semibold text-[11px] uppercase tracking-wider">Document Details</th>
                  <th className="px-6 py-4 font-semibold text-[11px] uppercase tracking-wider">Sender</th>
                  <th className="px-6 py-4 font-semibold text-[11px] uppercase tracking-wider text-center">Category</th>
                  <th className="px-6 py-4 font-semibold text-[11px] uppercase tracking-wider">Submitted</th>
                  <th className="px-6 py-4 font-semibold text-[11px] uppercase tracking-wider text-center">Status</th>
                  <th className="px-6 py-4 font-semibold text-[11px] uppercase tracking-wider text-right">Last Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredDocs.map((doc) => {
                  const isUnread = user?.role === 'org-president' && (!viewedDocs[doc.id] || new Date(doc.latestLogDate || doc.raw.updated_at) > new Date(viewedDocs[doc.id]));
                  return (
                  <tr
                    key={doc.id}
                    className={`group transition-all duration-300 hover:bg-gray-50/50 ${doc.id === highlightedDocId ? 'newly-added-glow' : ''} ${isUnread ? 'unread-glow' : ''}`}
                  >
                    <td
                      className="px-6 py-5 cursor-pointer"
                      onClick={() => {
                        setSelectedDoc(doc);
                        if (user?.role === 'org-president') {
                          const updatedViewed = { ...viewedDocs, [doc.id]: new Date().toISOString() };
                          setViewedDocs(updatedViewed);
                          localStorage.setItem(`my_docs_viewed_${user.id}`, JSON.stringify(updatedViewed));
                          window.dispatchEvent(new CustomEvent('my-docs-updated'));
                        }
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="text-secondary-gold opacity-50" size={20} />
                        <div>
                          <p className="font-semibold text-gray-800 group-hover:text-primary-green transition-colors uppercase text-sm leading-tight">
                            {doc.isActivityProposal ? doc.title : `${doc.sender} ${doc.type} ${activeSy ? activeSy.name : ''}`.toUpperCase()}
                          </p>
                          <p className="text-[10px] text-gray-400 font-mono mt-0.5 tracking-tighter uppercase">{doc.ref}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-sm font-medium text-gray-600 uppercase tracking-tight">{doc.sender}</span>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className="inline-block px-4 py-1 border border-gray-100 text-gray-500 text-[10px] font-semibold rounded-lg bg-white shadow-sm group-hover:border-primary-green/20 group-hover:text-primary-green transition-all uppercase">
                        {doc.type}
                      </span>
                      {doc.proposal_type && doc.proposal_type !== '-' && (
                        <span className="block text-[9px] font-bold text-primary-green mt-1 uppercase tracking-tight">
                          {doc.proposal_type}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-5 text-sm text-gray-500 font-medium">
                      {doc.submittedDate}
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span
                        style={{
                          backgroundColor: getStatusColor((['ready for retrieval', 'waiting for accomplishment report'].includes(doc.status?.toLowerCase())) ? 'approved' : doc.status)
                        }}
                        className="px-4 py-1.5 rounded-full text-[10px] font-bold shadow-sm inline-block min-w-[120px] transition-all uppercase text-white"
                      >
                        {(['ready for retrieval', 'waiting for accomplishment report'].includes(doc.status?.toLowerCase())) ? 'APPROVED' : doc.status}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right text-sm text-gray-500 font-medium">{doc.lastAction}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <FileText size={48} className="mb-4 text-gray-200" />
              <p className="text-sm font-bold uppercase tracking-wider">No Handled Documents Found</p>
              <p className="text-xs text-gray-400 mt-1">Documents you review and log will automatically appear here.</p>
            </div>
          )}
        </div>
      </div>

      {renderDeliveryProofModal()}
      {renderDeleteDraftModal()}

      <ToastComponent />
    </div>
  );
};

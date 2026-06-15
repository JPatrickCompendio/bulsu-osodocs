import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import * as subService from '../services/submissionService';
import { filterTimelineLogsForVersion } from '../utils/submissionLogUtils';
import SubmissionTimeline from '../components/SubmissionTimeline';
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
  ArrowUpRight
} from 'lucide-react';

const getStatusColor = (status) => {
  const s = (status || '').toLowerCase().trim();
  if (s.includes('to forward') || s.includes('hardcopy submission')) {
    return '#db2777';
  }
  if (s.includes('chairman') || s.includes('vice chairman') || s.includes('oso staff review') || s.includes('oso staff') || s.includes('pending')) {
    return '#c2bc13';
  }
  if (s.includes('sds coordinator review') || s.includes('sds review') || s.includes('sds')) {
    return '#6366f1';
  }
  if (s.includes('dean review')) {
    return '#1e3a8a';
  }
  if (s.includes('dean approved')) {
    return '#1d4ed8';
  }
  if (s.includes('external review')) {
    return '#d76b0d';
  }
  if (s.includes('waiting for accomplishment report')) {
    return '#0ea5e9';
  }
  if (s === 'approved') {
    return '#105220';
  }
  if (s.includes('ready for retrieval')) {
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
  return '#6366f1'; // Default
};

export const MyDocuments = () => {
  const navigate = useNavigate();
  const { user } = useAuth();


  const [activeTab, setActiveTab] = React.useState('All');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [logsData, setLogsData] = React.useState([]);

  // Detail View State
  const [selectedDoc, setSelectedDoc] = React.useState(null);
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

  const getStoragePath = (filePath) => String(filePath || '').replace(/^documents\//, '');

  const getStoragePublicUrl = (filePath) => {
    const cleanPath = getStoragePath(filePath);
    const { data } = supabase.storage.from('documents').getPublicUrl(cleanPath);
    return data?.publicUrl || '';
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
    if (currentStatus.includes('external review')) return 'external-review';
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

    const currentVersionNumber = activeVersion?.version_number || 1;
    const isResubmittedVersion = currentVersionNumber > 1;
    const previousVersion = allVersions.find(
      (v) => (v?.version_number || 0) === (currentVersionNumber - 1)
    );
    const previousVersionAttachments = Array.isArray(previousVersion?.submission_attachments)
      ? previousVersion.submission_attachments
      : [];
    const prevAttachmentByRequirement = previousVersionAttachments.find((att) => {
      if (att?.requirement_id && file?.requirement_id) {
        return att.requirement_id === file.requirement_id;
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
      docStatus.includes('external review');

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

  const persistLocalAttachmentReviews = async (activeVersionId, mode) => {
    const now = new Date().toISOString();
    const workflowPhase = getAttachmentWorkflowPhase(selectedDoc);
    const logsToInsert = [];

    if (mode === 'approve') {
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
    } else if (mode === 'return') {
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
    }

    if (logsToInsert.length === 0) return;
    const { error } = await supabase.from('submission_logs').insert(logsToInsert);
    if (error) throw error;
  };

  const handleSaveAttachmentFeedback = () => {
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
    alert('Attachment marked for return. Confirm via the footer Return button.');
  };

  const handleApproveAttachment = () => {
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
    alert('Attachment approved locally. Confirm via the footer action button.');
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
      let finalPath = previewFile.file_url || '';
      if (finalPath.startsWith('documents/')) {
        finalPath = finalPath.replace('documents/', '');
      }

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
            users (org_name, student_no, full_name, role),
            documentType (name),
            submission_versions!submission_id (
              *,
              activity_proposal_details (*),
              submission_attachments (*)
            )
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (subsErr) throw subsErr;

        // Normalize into the same shape expected by the existing mapper (logsData items with `.submissions`)
        data = (subs || []).map((sub) => ({
          id: `sub-${sub.id}`,
          submission_id: sub.id,
          created_at: sub.updated_at || sub.created_at,
          workflow_phase: null,
          review_action: null,
          action_type: null,
          submissions: sub
        }));

        setLogsData(data);
        return;
      }

      const { data: primaryData, error } = await supabase
        .from('submission_logs')
        .select(`
          *,
          submissions (
            *,
            users (org_name, student_no),
            documentType (name),
            submission_versions!submission_id (
              *,
              activity_proposal_details (*),
              submission_attachments (*)
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
              users (org_name, student_no),
              documentType (name),
              submission_versions!submission_id (
                *,
                activity_proposal_details (*),
                submission_attachments (*)
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

      setLogsData(data || []);
    } catch (err) {
      console.error('Error fetching My Documents logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReturnSubmission = async (comments = '') => {
    if (!selectedDoc) return;
    try {
      setLoading(true);
      const activeVersionId = selectedDoc.raw?.current_version_id ||
        (Array.isArray(selectedDoc.raw?.submission_versions)
          ? selectedDoc.raw?.submission_versions[0]?.id
          : selectedDoc.raw?.submission_versions?.id);

      const currentStatus = (selectedDoc.raw?.status || selectedDoc.status || '').toLowerCase();
      const workflowPhase = currentStatus.includes('dean review')
        ? 'dean-review'
        : currentStatus.includes('sds coordinator review')
          ? 'sds-review'
          : 'Chairman Review';

      const formattedRemarks = comments || `Returned for edits by ${formatReviewerRoleLabel(user?.role)}`;
      const { error: subErr } = await supabase
        .from('submissions')
        .update({
          status: 'returned',
          remarks: formattedRemarks
        })
        .eq('id', selectedDoc.id);

      if (subErr) throw subErr;

      await persistLocalAttachmentReviews(activeVersionId, 'return');

      const { error: logErr } = await supabase
        .from('submission_logs')
        .insert([{
          submission_id: selectedDoc.id,
          submission_version_id: activeVersionId,
          user_id: user.id,
          workflow_phase: workflowPhase,
          action_type: 'returned',
          review_action: null,
          description: comments || `Returned for edits by ${formatReviewerRoleLabel(user?.role)}`,
          comment: comments || null,
          created_at: new Date().toISOString()
        }]);

      if (logErr) throw logErr;

      setIsReturnModalOpen(false);
      setReturnComments('');
      setLocallyApproved([]);
      setLocallyReturned({});
      setSelectedDoc(null);
      await fetchHandledLogs();
      alert('Submission returned for edits successfully!');
    } catch (err) {
      console.error('Error returning submission:', err);
      alert('Failed to return submission.');
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
        alert('Please upload all required replacements.');
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

      setIsResubmitModalOpen(false);
      setResubmitFiles({});
      setSelectedDoc(null);
      await fetchHandledLogs();
      alert('Document resubmitted successfully!');
    } catch (err) {
      console.error('Error resubmitting:', err);
      alert('Failed to resubmit document.');
    } finally {
      setIsResubmitting(false);
    }
  };

  const handleDisapproveSubmission = async (comments = '') => {
    if (!selectedDoc) return;
    try {
      setLoading(true);
      const activeVersionId = selectedDoc.raw?.current_version_id ||
        (Array.isArray(selectedDoc.raw?.submission_versions)
          ? selectedDoc.raw?.submission_versions[0]?.id
          : selectedDoc.raw?.submission_versions?.id);

      const currentStatus = (selectedDoc.raw?.status || selectedDoc.status || '').toLowerCase();
      const workflowPhase = currentStatus.includes('dean review')
        ? 'dean-review'
        : currentStatus.includes('sds coordinator review')
          ? 'sds-review'
          : 'Chairman Review';

      const formattedRemarks = comments || `Disapproved by ${formatReviewerRoleLabel(user?.role)}`;
      const { error: subErr } = await supabase
        .from('submissions')
        .update({
          status: 'disapproved',
          remarks: formattedRemarks
        })
        .eq('id', selectedDoc.id);

      if (subErr) throw subErr;

      const { error: logErr } = await supabase
        .from('submission_logs')
        .insert([{
          submission_id: selectedDoc.id,
          submission_version_id: activeVersionId,
          user_id: user.id,
          workflow_phase: workflowPhase,
          action_type: 'disapproved',
          review_action: null,
          description: comments || `Disapproved by ${formatReviewerRoleLabel(user?.role)}`,
          comment: comments || null,
          created_at: new Date().toISOString()
        }]);

      if (logErr) throw logErr;

      setIsReturnModalOpen(false);
      setReturnComments('');
      setLocallyApproved([]);
      setLocallyReturned({});
      const disapprovedId = selectedDoc.id;
      setSelectedDoc(null);
      await fetchHandledLogs();
      alert('Submission disapproved successfully!');
      if (isChairmanLikeReviewer(user?.role) || user?.role === 'admin') {
        navigate('/completed', { state: { openDocId: disapprovedId } });
      }
    } catch (err) {
      console.error('Error disapproving submission:', err);
      alert('Failed to disapprove submission.');
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

      const { error: subErr } = await supabase
        .from('submissions')
        .update({
          status: 'SDS coordinator review',
          remarks: 'Forwarded to SDS Coordinator (Admin) by Chairman'
        })
        .eq('id', selectedDoc.id);

      if (subErr) throw subErr;

      await persistLocalAttachmentReviews(activeVersionId, 'approve');

      const { error: logErr } = await supabase
        .from('submission_logs')
        .insert([{
          submission_id: selectedDoc.id,
          submission_version_id: activeVersionId,
          user_id: user.id,
          workflow_phase: 'sds-review',
          action_type: 'forwarded',
          review_action: null,
          description: 'Forwarded to SDS Coordinator (Admin) by Chairman',
          comment: 'Forwarded to SDS Coordinator (Admin) by Chairman',
          created_at: new Date().toISOString()
        }]);

      if (logErr) throw logErr;

      setIsForwardModalOpen(false);
      setLocallyApproved([]);
      setLocallyReturned({});
      setSelectedDoc(null);
      await fetchHandledLogs();
      alert('Submission forwarded successfully!');
    } catch (err) {
      console.error('Error forwarding submission:', err);
      alert('Failed to forward submission.');
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

      const adminComment = comments?.trim() || '';
      const finalRemarks = adminComment || null;

      const { error: subErr } = await supabase
        .from('submissions')
        .update({
          status: 'external review',
          remarks: finalRemarks || null
        })
        .eq('id', selectedDoc.id);

      if (subErr) throw subErr;

      const { error: logErr } = await supabase
        .from('submission_logs')
        .insert([{
          submission_id: selectedDoc.id,
          submission_version_id: activeVersionId,
          user_id: user.id,
          workflow_phase: 'external-review',
          action_type: 'forwarded',
          review_action: 'forwarded',
          description: adminComment || 'Documents Sent to Main Campus for Review',
          comment: adminComment || null,
          created_at: new Date().toISOString()
        }]);

      if (logErr) throw logErr;

      setIsReturnModalOpen(false);
      setReturnComments('');
      setExternalProofFile(null);
      setSelectedDoc(null);
      await fetchHandledLogs();
      alert('Sent to External Campus successfully!');
    } catch (err) {
      console.error('Error sending to external:', err);
      alert('Failed to send to external campus.');
    } finally {
      setLoading(false);
      setExternalProofUploading(false);
    }
  };

  const handleReadyForRetrieval = async (comments = '') => {
    if (!selectedDoc) return;
    try {
      setLoading(true);
      const activeVersionId = selectedDoc.raw?.current_version_id ||
        (Array.isArray(selectedDoc.raw?.submission_versions)
          ? selectedDoc.raw?.submission_versions[0]?.id
          : selectedDoc.raw?.submission_versions?.id);

      const { error: subErr } = await supabase
        .from('submissions')
        .update({
          status: 'ready for retrieval',
          remarks: comments || 'Ready for Retrieval'
        })
        .eq('id', selectedDoc.id);

      if (subErr) throw subErr;

      const { error: logErr } = await supabase
        .from('submission_logs')
        .insert([{
          submission_id: selectedDoc.id,
          submission_version_id: activeVersionId,
          user_id: user.id,
          workflow_phase: 'external-review',
          action_type: 'ready_for_retrieval',
          review_action: 'ready-for-retrieval',
          description: comments || 'Document is ready for retrieval',
          comment: comments || null,
          created_at: new Date().toISOString()
        }]);

      if (logErr) throw logErr;

      setIsReturnModalOpen(false);
      setReturnComments('');
      setSelectedDoc(prev => prev ? {
        ...prev,
        category: 'Approved',
        status: 'READY FOR RETRIEVAL',
        raw: {
          ...prev.raw,
          status: 'ready for retrieval',
          remarks: comments || 'Ready for Retrieval'
        }
      } : prev);
      await fetchHandledLogs();
      alert('Document marked ready for retrieval successfully!');
    } catch (err) {
      console.error('Error marking ready for retrieval:', err);
      alert('Failed to mark document ready for retrieval.');
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

      const formattedRemarks = comments || 'Approved';
      const currentStatus = (selectedDoc.raw?.status || selectedDoc.status || '').toLowerCase();
      const reviewerLabel = formatReviewerRoleLabel(user?.role);

      let newStatus = 'to forward';
      let workflowPhaseStr = 'Chairman Review';
      let descriptionStr = comments || `Approved by ${reviewerLabel}`;
      let insertHardcopyLog = false;
      let stayOnDocument = false;

      if (currentStatus.includes('sds')) {
        newStatus = user?.role === 'admin' ? 'dean review' : 'to forward';
        workflowPhaseStr = 'sds-review';
        descriptionStr = comments || 'Approved by SDS Coordinator';
      } else if (currentStatus.includes('dean review')) {
        newStatus = 'dean approved';
        workflowPhaseStr = 'dean-review';
        descriptionStr = comments || 'Approved by Dean';
        stayOnDocument = true;
      } else if (currentStatus.includes('external review')) {
        newStatus = 'approved';
        workflowPhaseStr = 'external-review';
        descriptionStr = comments || 'Approved by External Campus';
      } else {
        newStatus = 'to forward';
        insertHardcopyLog = true;
        descriptionStr = comments || `Approved by ${reviewerLabel}`;
      }

      const { error: subErr } = await supabase
        .from('submissions')
        .update({ status: newStatus, remarks: formattedRemarks })
        .eq('id', selectedDoc.id);

      if (subErr) throw subErr;

      await persistLocalAttachmentReviews(activeVersionId, 'approve');

      const { error: logErr1 } = await supabase
        .from('submission_logs')
        .insert([{
          submission_id: selectedDoc.id,
          submission_version_id: activeVersionId,
          user_id: user.id,
          workflow_phase: workflowPhaseStr,
          action_type: 'approved',
          review_action: 'approved',
          description: descriptionStr,
          comment: comments || null,
          created_at: new Date().toISOString()
        }]);

      if (logErr1) throw logErr1;

      if (insertHardcopyLog) {
        const { error: logErr2 } = await supabase
          .from('submission_logs')
          .insert([{
            submission_id: selectedDoc.id,
            submission_version_id: activeVersionId,
            user_id: user.id,
            workflow_phase: 'Chairman Review',
            action_type: 'ready_for_hardcopy',
            review_action: 'ready-for-hardcopy',
            description: 'Ready for hardcopy submission',
            comment: null,
            created_at: new Date(Date.now() + 1000).toISOString()
          }]);

        if (logErr2) throw logErr2;
      }

      setIsReturnModalOpen(false);
      setReturnComments('');
      setLocallyApproved([]);
      setLocallyReturned({});

      if (stayOnDocument) {
        setSelectedDoc((prev) => prev ? {
          ...prev,
          category: 'Dean Review',
          status: 'DEAN APPROVED',
          raw: {
            ...prev.raw,
            status: 'dean approved',
            remarks: formattedRemarks
          }
        } : prev);
        await fetchTimelineLogs(selectedDoc.id);
        await fetchHandledLogs();
        setIsDeanApproveSuccessModalOpen(true);
        return;
      }

      setSelectedDoc(null);
      await fetchHandledLogs();
      alert('Submission approved successfully!');
    } catch (err) {
      console.error('Error approving submission:', err);
      alert('Failed to approve submission.');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchHandledLogs();
  }, [user]);

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
    const isActivityProposal = docTypeName.toLowerCase() === 'activity proposal';

    const version = Array.isArray(submission.submission_versions)
      ? (submission.submission_versions.find(v => v.id === submission.current_version_id) || submission.submission_versions[0])
      : submission.submission_versions;
    const details = isActivityProposal
      ? (Array.isArray(version?.activity_proposal_details)
        ? version.activity_proposal_details[0]
        : version?.activity_proposal_details)
      : null;

    const orgName = details?.organization_name || submission.users?.org_name || '-';

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
      category = user?.role === 'org-president' ? 'OSO Staff review' : 'To Forward';
    } else if (subStatus === 'submitted' || subStatus === 'pending') {
      category = 'OSO Staff review';
    } else if (subStatus.includes('sds')) {
      category = 'SDS Review';
    } else if (subStatus.includes('dean approved')) {
      category = 'Dean Review';
    } else if (subStatus.includes('dean review')) {
      category = 'Dean Review';
    } else if (subStatus.includes('external review')) {
      category = 'External Review';
    } else if (subStatus.includes('ready for retrieval')) {
      category = 'Approved';
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
      else if (wpNorm === 'dean review') category = 'Dean Review';
      else if (wpNorm === 'external review') category = 'External Review';
      else if (wpNorm === 'chairman review') category = 'Chairman Review';
      else if (ra === 'ready-for-hardcopy') category = user?.role === 'org-president' ? 'OSO Staff review' : 'To Forward';
      else if (ra === 'approved') category = 'Approved';
      else if (ra === 'returned') category = 'Returned';
    }


    const submittedDate = new Date(submission.created_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    const lastActionDate = new Date(latestLog.created_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    return {
      id: submission.id,

      title: proposalTitle && proposalTitle !== '-' ? proposalTitle : docTypeName,
      ref: `SUB-2026-03-${String(submission.id).padStart(3, '0')}`,
      sender: orgName,
      type: docTypeName,
      submittedDate,
      status: submission.status === 'submitted'
        ? 'OSO STAFF REVIEW'
        : (submission.status === 'to forward'
          ? (user?.role === 'org-president' ? 'HARDCOPY SUBMISSION' : 'TO FORWARD')
          : (submission.status ? submission.status.toUpperCase() : 'PENDING')),
      lastAction: lastActionDate,
      category,

      // Extended fields copied from Inbox details mappings
      proposal_title: proposalTitle,
      pic: details?.person_in_charge || '-',
      studentId: submission.users?.student_no || details?.student_id_number || '-',
      contact: details?.contact_number || '-',
      targetDate,
      targetTime,
      duration: details?.duration || '-',
      students: details?.number_of_students || '-',
      nature: details?.nature_of_activity || '-',
      objectives: details?.objectives || null,
      satisfy_goals: details?.satisfy_goals || [],
      sponsors_partners: details?.sponsors_partners || [],
      satisfy_needs: details?.satisfy_needs || null,
      isActivityProposal,
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
    // Completed and disapproved documents live on the Completed page for org president.
    if (
      user?.role === 'org-president' &&
      (doc.category === 'Completed' || doc.category === 'Disapproved')
    ) {
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
    ...(user?.role === 'chairman' ? [{ name: 'Chairman Review', count: countByTab('Chairman Review') }] : []),
    ...(user?.role !== 'admin' ? [{ name: 'SDS Review', count: countByTab('SDS Review') }] : []),
    { name: 'Dean Review', count: countByTab('Dean Review') },
    { name: 'External Review', count: countByTab('External Review') },
    { name: 'Approved', count: countByTab('Approved') },
    ...(user?.role !== 'org-president' ? [{ name: 'Completed', count: countByTab('Completed') }] : []),
    ...(user?.role === 'chairman' ? [{ name: 'To Forward', count: countByTab('To Forward') }] : []),
    { name: 'Returned', count: countByTab('Returned') }
  ];

  if (selectedDoc) {
    const isActivityProposal = selectedDoc.isActivityProposal;

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
    const attachments = currentVersion?.submission_attachments || [];
    const docStatusLower = getDocStatusLower(selectedDoc);
    const isDeanApprovedDoc = docStatusLower === 'dean approved';
    const isApprovedDoc = docStatusLower === 'approved';
    const isReadyForOrgPickup = isReadyForOrgRetrieval(selectedDoc);
    const isWaitingForAccomplishment = isWaitingForAccomplishmentReport(selectedDoc);
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
          ? currentVersion.activity_proposal_details[0]
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
      const isExternalReviewStatus = docStatusLower.includes('external review');
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
                  {docTitle}
                </h1>
                {isActivityProposal && (
                  <p className="mt-2 text-sm font-semibold text-gray-500">Activity Proposal Form</p>
                )}
              </div>

              {/* Removed redundant status/date pill row (already in Document Details). */}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2.3fr)_minmax(0,1fr)] gap-8 items-start">
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 p-10 space-y-7">

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                {[
                  { label: 'Person In-Charge', value: selectedDoc.pic },
                  { label: 'Student ID No.', value: selectedDoc.studentId },
                  { label: 'Contact Number', value: selectedDoc.contact },
                  {
                    label: 'Target Date and Time',
                    value:
                      selectedDoc.targetDate && selectedDoc.targetTime && selectedDoc.targetDate !== '-' && selectedDoc.targetTime !== '-'
                        ? `${selectedDoc.targetDate} | ${selectedDoc.targetTime}`
                        : selectedDoc.targetDate
                  },
                  { label: 'Duration', value: selectedDoc.duration },
                  { label: 'Number of Students', value: selectedDoc.students },
                  { label: 'Nature of Activity', value: selectedDoc.nature }
                ].map((item) => (
                  <div key={item.label} className="bg-gray-50/80 border border-gray-100 rounded-2xl px-5 py-3.5">
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-1">
                      {item.label}
                    </p>
                    <p className="font-bold text-gray-800 leading-snug break-words">
                      {item.value || '—'}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-6 space-y-4">
                <div>
                  <p className="font-bold text-sm mb-2">Objectives of the Activity:</p>
                  {selectedDoc.objectives ? (
                    <div className="bg-gray-50 p-6 rounded-2xl text-sm leading-relaxed text-gray-700 border border-gray-100">
                      {selectedDoc.objectives}
                    </div>
                  ) : (
                    <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
                      <li>Leadership Development and Formation</li>
                      <li>Membership Development and Formation</li>
                      <li>Organizational Program Management</li>
                      <li>Values Enrichment</li>
                      <li>Technical Skills Development and Industry Exposure</li>
                    </ul>
                  )}
                </div>

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
                      <span>
                        {selectedDoc.satisfy_needs ||
                          '"The activity aims to connect students with experienced professionals and industry experts who will share their knowledge, career experiences and current trends in the field of information technology."'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

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
                    {attachments && attachments.length > 0 ? (
                      attachments.map((file, idx) => {
                        const fileName = file.file_name || 'Attached File';
                        let finalPath = file.file_url || '';
                        if (finalPath.startsWith('documents/')) {
                          finalPath = finalPath.replace('documents/', '');
                        }
                        const { data } = supabase.storage.from('documents').getPublicUrl(finalPath);
                        const fileUrl = data?.publicUrl || '#';

                        const fileLog = timelineLogs.find(log => log.attachment_id === file.id);

                        // Only show "returned" (orange) during chairman-stage review.
                        // For later phases (e.g., dean review), old chairman return reasons should not force orange.
                        const reviewActionValue = String(fileLog?.review_action || '').toLowerCase();
                        const isReturnedAttachment = ['missing-requirements', 'incorrect-format', 'incomplete-information'].includes(reviewActionValue);
                        const viewingLatestVersion = currentVersion?.id === selectedDoc.raw?.current_version_id;
                        const docStatus = (viewingLatestVersion
                          ? (selectedDoc.raw?.status || selectedDoc.status || '')
                          : (currentVersion?.status || selectedDoc.raw?.status || selectedDoc.status || '')
                        ).toLowerCase();
                        const isChairmanStage = docStatus === 'submitted' || docStatus === 'oso staff review' || docStatus === 'pending' || docStatus === 'returned';
                        const historicalChairmanVersion = !viewingLatestVersion && isChairmanStage;

                        const isReturnByCurrentReviewer =
                          isReturnedAttachment &&
                          ((fileLog?.user_id && fileLog.user_id === user?.id) ||
                            sameRole(fileLog?.users?.role, user?.role));
                        const returnedForDisplay = isChairmanStage ? isReturnedAttachment : isReturnByCurrentReviewer;
                        const hasRevision = isChairmanStage && returnedForDisplay && !locallyApproved.includes(file.id);
                        const isApproved = locallyApproved.includes(file.id) || (historicalChairmanVersion ? !returnedForDisplay : !hasRevision);

                        let containerBg = 'bg-[#525252]';
                        let textColor = 'text-white';
                        let subtitleColor = 'text-gray-400';
                        let iconStyle = 'bg-white/10 text-white/80';

                        if (isApproved) {
                          containerBg = 'bg-green-600';
                          textColor = 'text-white';
                          subtitleColor = 'text-green-100';
                          iconStyle = 'bg-white/20 text-white';
                        } else if (hasRevision) {
                          containerBg = 'bg-[#f59e0b]';
                          textColor = 'text-[#451a03]';
                          subtitleColor = 'text-[#78350f]';
                          iconStyle = 'bg-[#78350f]/10 text-[#78350f]';
                        }

                        return (
                          <div key={file.id || idx} className={`${containerBg} rounded-xl p-4 flex items-center justify-between group hover:brightness-110 transition-all`}>
                            <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 ${iconStyle} rounded-lg flex items-center justify-center shrink-0`}>
                                <Paperclip size={20} />
                              </div>
                              <div>
                                <p className={`${textColor} font-semibold text-sm`}>{fileName}</p>
                                <p className={`${subtitleColor} text-[10px] uppercase`}>Attached Document</p>
                                {returnedForDisplay && fileLog?.comment && (
                                  <p className="mt-1 text-xs italic font-medium opacity-90 max-w-lg">
                                    {(fileLog?.users?.full_name || fileLog?.users?.role || 'Reviewer')}'s Comment: "{fileLog.comment}"
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                              <button
                                onClick={() => {
                                  setPreviewFile(file);
                                  setReviewAction('');
                                  setReviewComments('');
                                }}
                                className="bg-secondary-gold text-white px-6 py-2 rounded-lg text-xs font-bold hover:brightness-110 transition-all shadow-lg inline-block text-center"
                              >
                                view
                              </button>
                              <a
                                href={fileUrl}
                                download
                                className="bg-secondary-gold text-white px-6 py-2 rounded-lg text-xs font-bold hover:brightness-110 transition-all shadow-lg inline-block text-center"
                              >
                                Download
                              </a>
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
              {proofAttachments.length > 0 && (
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

            <div className="space-y-4 self-start">
              {/* Viewed By + Controls (match screenshot format) */}
              <div className="bg-gradient-to-r from-[#e9ad00] to-[#d89b00] rounded-2xl p-4 text-white shadow-sm">
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

              <div className="flex items-center gap-3">
                <div className="flex-1">
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
                </div>
                <button
                  onClick={() => window.print()}
                  className="px-5 py-3 rounded-xl text-xs font-semibold uppercase tracking-wider text-white bg-primary-green hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-primary-green/20"
                >
                  Generate Report
                </button>
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

              {isReturnedStatus && (
                <button
                  onClick={() => setIsResubmitModalOpen(true)}
                  className="w-full px-5 py-3.5 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 transition-all shadow-sm"
                >
                  Resubmit
                </button>
              )}

              {isReadyForOrgPickup && (
                <button
                  onClick={async () => {
                    setLoading(true);
                    try {
                      const activeVersionId = selectedDoc.raw?.current_version_id ||
                        (Array.isArray(selectedDoc.raw?.submission_versions)
                          ? selectedDoc.raw?.submission_versions[0]?.id
                          : selectedDoc.raw?.submission_versions?.id);

                      const { error: subErr } = await supabase
                        .from('submissions')
                        .update({
                          status: 'waiting for accomplishment report',
                          remarks: 'Document retrieved by Org President'
                        })
                        .eq('id', selectedDoc.id);

                      if (subErr) throw subErr;

                      await supabase.from('submission_logs').insert([{
                        submission_id: selectedDoc.id,
                        submission_version_id: activeVersionId,
                        user_id: user.id,
                        workflow_phase: 'approved',
                        action_type: 'document_retrieved',
                        review_action: 'document-retrieved',
                        description: 'Document retrieved by Organization President',
                        comment: null,
                        created_at: new Date().toISOString()
                      }]);

                      setSelectedDoc(prev => prev ? {
                        ...prev,
                        status: 'WAITING FOR ACCOMPLISHMENT REPORT',
                        category: 'Approved',
                        raw: {
                          ...prev.raw,
                          status: 'waiting for accomplishment report',
                          remarks: 'Document retrieved by Org President'
                        }
                      } : prev);
                      await fetchHandledLogs();
                      alert('Document marked as retrieved!');
                    } catch (err) {
                      console.error('Error marking document retrieved:', err);
                      alert('Failed to mark as retrieved.');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                  className="w-full px-5 py-3.5 bg-green-700 text-white rounded-xl text-sm font-semibold hover:bg-green-800 transition-all shadow-sm mt-2 disabled:opacity-50"
                >
                  Document Retrieved
                </button>
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
                  <p className="mt-2 whitespace-pre-wrap text-blue-800">{accomplishmentReport.problems_encountered || 'No problems encountered were provided.'}</p>
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
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.gif,.webp"
                        multiple
                        onChange={(e) => setAccomReportFiles(Array.from(e.target.files || []))}
                        className="w-full text-xs text-gray-500"
                      />
                      <span className="mt-2 text-xs text-gray-400">Upload one or more proof images to the accomplishment report folder.</span>
                    </div>
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
                        alert('No activity proposal selected.');
                        return;
                      }
                      if (accomplishmentReport) {
                        setIsAccomReportModalOpen(false);
                        return;
                      }
                      if (accomReportFiles.length === 0) {
                        alert('Please attach at least one proof image.');
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
                          alert('An accomplishment report already exists for this activity proposal.');
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
                            problems_encountered: accomReportComments || null
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
                          comment: accomReportComments || null,
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
                        await fetchHandledLogs();
                        alert('Accomplishment report submitted!');
                        navigate('/completed', { state: { openDocId: submissionId } });
                      } catch (err) {
                        console.error('Error submitting accomplishment report:', err);
                        alert(err?.message || 'Failed to submit accomplishment report.');
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

            {(user?.role === 'org-president' && (selectedDoc.status === 'DRAFT' || selectedDoc.status === 'RETURNED')) && (
              <button
                onClick={() => navigate(`/submit?submissionId=${selectedDoc.id}`)}
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
            { label: 'ORGANIZATION', value: selectedDoc.sender || '-', icon: <User size={18} /> },
            { label: 'TYPE', value: `${selectedDoc.type}`, icon: <FileText size={18} />, color: 'text-blue-500' },
            { label: 'STATUS', value: selectedDoc.status?.toLowerCase() === 'waiting for accomplishment report' ? 'APPROVED' : selectedDoc.status, icon: <Clock size={18} />, badge: true },
            { label: 'SUBMITTED', value: selectedDoc.submittedDate, icon: <Calendar size={18} /> }
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
        <div className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-gray-100 mb-8 text-gray-800">
          <h2 className="text-xl font-bold text-gray-800 mb-8">{selectedDoc.type} Form Details</h2>
          <div className="text-center mb-10">
            <h3 className="text-lg font-bold text-gray-800">
              Document Title: {selectedDoc.proposal_title && selectedDoc.proposal_title !== '-' ? selectedDoc.proposal_title : selectedDoc.title}
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
                {selectedDoc.targetDate && selectedDoc.targetTime && selectedDoc.targetDate !== '-' && selectedDoc.targetTime !== '-'
                  ? `${selectedDoc.targetDate} | ${selectedDoc.targetTime}`
                  : selectedDoc.targetDate}
              </span>
            </div>
            <div className="flex gap-2">
              <span className="font-bold min-w-[200px]">Duration:</span>
              <span>{selectedDoc.duration}</span>
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
              {selectedDoc.objectives ? (
                <div className="bg-gray-50 p-6 rounded-2xl text-sm leading-relaxed text-gray-600 border border-gray-100 italic">
                  {selectedDoc.objectives}
                </div>
              ) : (
                <ul className="list-disc pl-5 space-y-1 text-sm text-gray-500">
                  <li>Leadership Development and Formation</li>
                  <li>Membership Development and Formation</li>
                  <li>Organizational Program Management</li>
                  <li>Values Enrichment</li>
                  <li>Technical Skills Development and Industry Exposure</li>
                </ul>
              )}
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
              <div className="mt-8">
                <p className="font-bold mb-4 text-sm leading-relaxed">
                  Describe how this activity will satisfy the needs of the organization and how it will help the organization achieve its goals:
                </p>
                <div className="bg-gray-50 p-6 rounded-2xl text-sm leading-relaxed text-gray-600 border border-gray-100 italic">
                  {selectedDoc.satisfy_needs || '"The ASICS Summit aims to connect students with experienced IT professionals and industry experts who will share their knowledge, career experiences and current trends in the field of information technology..."'}
                </div>
              </div>
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
              {attachments && attachments.length > 0 ? (
                attachments.map((file, idx) => {
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

                  // Dynamic styles based on review status
                  let containerBg = 'bg-[#525252]';
                  let textColor = 'text-white';
                  let subtitleColor = 'text-gray-400';
                  let iconStyle = 'bg-white/10 text-white/80';

                  if (isApproved) {
                    containerBg = 'bg-green-600';
                    textColor = 'text-white';
                    subtitleColor = 'text-green-100';
                    iconStyle = 'bg-white/20 text-white';
                  } else if (returnedForDisplay) {
                    containerBg = 'bg-[#f59e0b]';
                    textColor = 'text-[#451a03]';
                    subtitleColor = 'text-[#78350f]';
                    iconStyle = 'bg-[#78350f]/10 text-[#78350f]';
                  }

                  return (
                    <div key={idx} className={`${containerBg} rounded-xl p-4 flex items-center justify-between group hover:brightness-110 transition-all`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 ${iconStyle} rounded-lg flex items-center justify-center shrink-0`}>
                          <Paperclip size={20} />
                        </div>
                        <div>
                          <p className={`${textColor} font-semibold text-sm`}>{fileName}</p>
                          <p className={`${subtitleColor} text-[10px] uppercase`}>Attached Document</p>
                          {returnedForDisplay && (locallyReturned[file.id]?.comment || fileLog?.comment) && (
                            <p className="mt-1 text-xs italic font-medium opacity-90 max-w-lg">
                              {(fileLog?.users?.full_name || fileLog?.users?.role || user?.role || 'Reviewer')}'s Comment: "{locallyReturned[file.id]?.comment || fileLog?.comment}"
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                        <button
                          onClick={() => {
                            setPreviewFile(file);
                            setReviewAction('');
                            setReviewComments('');
                          }}
                          className="bg-secondary-gold text-white px-6 py-2 rounded-lg text-xs font-bold hover:brightness-110 transition-all shadow-lg inline-block text-center"
                        >
                          view
                        </button>
                        <a
                          href={fileUrl}
                          download
                          className="bg-secondary-gold text-white px-6 py-2 rounded-lg text-xs font-bold hover:brightness-110 transition-all shadow-lg inline-block text-center"
                        >
                          Download
                        </a>
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
              onClick={() => setIsResubmitModalOpen(true)}
              className="flex items-center justify-center gap-3 px-8 py-3.5 bg-blue-600 text-white text-xs font-bold rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-blue-600/20 uppercase tracking-widest animate-in"
            >
              <RotateCcw size={16} />
              <span>Resubmit Document</span>
            </button>
          </div>
        )}

        {/* Action buttons (Chairman / Vice Chairman - Bottom of the page) */}
        {isChairmanLikeReviewer(user?.role) && !disableVersionActions && (
          <div className="flex items-center justify-center gap-4 mt-10 p-6 bg-gray-50 border border-gray-100 rounded-3xl shadow-sm max-w-xl mx-auto">
            <button
              onClick={() => {
                setDecisionType('return');
                setReturnComments('');
                setIsReturnModalOpen(true);
              }}
              disabled={disableVersionActions || selectedDoc.category !== 'To Forward'}
              className="flex items-center justify-center gap-3 px-8 py-3.5 bg-amber-500 text-white text-xs font-bold rounded-2xl hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed transition-all shadow-lg shadow-amber-500/20 uppercase tracking-widest animate-in"
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
              disabled={disableVersionActions || (selectedDoc.category !== 'To Forward' && selectedDoc.category !== 'Returned')}
              className="flex items-center justify-center gap-3 px-8 py-3.5 bg-red-600 text-white text-xs font-bold rounded-2xl hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed transition-all shadow-lg shadow-red-600/20 uppercase tracking-widest animate-in"
            >
              <X size={16} />
              <span>Disapprove</span>
            </button>

            <button
              onClick={() => {
                setIsForwardModalOpen(true);
              }}
              disabled={disableVersionActions || selectedDoc.category !== 'To Forward' || hasBlockingReturnedAttachments}
              className="flex items-center justify-center gap-3 px-8 py-3.5 bg-green-600 text-white text-xs font-bold rounded-2xl hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed transition-all shadow-lg shadow-green-600/20 uppercase tracking-widest animate-in"
            >
              <CheckCircle size={16} />
              <span>To Forward</span>
            </button>
          </div>
        )}

        {/* Admin workflow actions in My Documents */}
        {user?.role === 'admin' && !disableVersionActions && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50">
            <div className="bg-white/80 backdrop-blur-2xl px-8 py-4 rounded-[2rem] border border-white/50 shadow-[0_20px_50px_rgba(0,0,0,0.15)] flex items-center gap-4 animate-in slide-in-from-bottom-12 duration-1000">
              {isDeanApprovedDoc ? (
                <button
                  onClick={() => {
                    setDecisionType('send_to_external');
                    setReturnComments('');
                    setExternalProofFile(null);
                    setIsReturnModalOpen(true);
                  }}
                  className="flex items-center justify-center gap-3 px-8 py-3.5 bg-blue-600 text-white text-xs font-bold rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-blue-600/20 uppercase tracking-widest"
                >
                  <ArrowUpRight size={16} />
                  <span>Sent to external</span>
                </button>
              ) : isReadyForOrgPickup ? (
                <button
                  disabled
                  className="flex items-center justify-center gap-3 px-8 py-3.5 bg-purple-600 text-white text-xs font-bold rounded-2xl opacity-40 cursor-not-allowed transition-all shadow-lg shadow-purple-600/20 uppercase tracking-widest"
                >
                  <CheckCircle size={16} />
                  <span>Waiting for Org Pres to retrieve file</span>
                </button>
              ) : isApprovedDoc ? (
                <button
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
              ) : (selectedDoc?.category === 'Dean Review' || selectedDoc?.category === 'SDS Review' || selectedDoc?.category === 'External Review') && (
                <>
                  <button
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
                  </button>
                  <button
                    onClick={() => {
                      setDecisionType('return');
                      setReturnComments('');
                      setIsReturnModalOpen(true);
                    }}
                    className="flex items-center justify-center gap-3 px-8 py-3.5 bg-amber-500 text-white text-xs font-bold rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-amber-500/20 uppercase tracking-widest"
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
                    className="flex items-center justify-center gap-3 px-8 py-3.5 bg-red-600 text-white text-xs font-bold rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-red-600/20 uppercase tracking-widest"
                  >
                    <X size={16} />
                    <span>Disapprove</span>
                  </button>
                </>
              )}
            </div>
          </div>
        )}

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
            <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
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
                    <div className="flex-1 bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-200/50 relative h-full">
                      {previewFile.file_name?.toLowerCase().endsWith('.pdf') || previewFile.file_url?.toLowerCase().includes('.pdf') ? (
                        <iframe
                          src={filePreviewUrl ? `${filePreviewUrl}#toolbar=1&navpanes=0&view=Fit` : ''}
                          className="w-full h-full border-0 rounded-2xl"
                          title="PDF Preview"
                        />
                      ) : previewFile.file_name?.toLowerCase().endsWith('.docx') || previewFile.file_url?.toLowerCase().includes('.docx') ? (
                        <iframe
                          src={filePreviewUrl ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(filePreviewUrl)}` : ''}
                          className="w-full h-full border-0 rounded-2xl"
                          title="DOCX Preview"
                        />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                          <FileText size={48} className="text-gray-300 mb-4 animate-bounce" />
                          <h4 className="font-bold text-gray-700 mb-1">Preview is not supported for this file type</h4>
                          <p className="text-gray-400 text-xs max-w-xs mb-4">You can download it to view locally on your device.</p>
                          <a
                            href={filePreviewUrl}
                            download
                            className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-md inline-flex items-center gap-2"
                          >
                            Download Attachment
                          </a>
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
              <p className="text-gray-500 text-sm mb-8 leading-relaxed text-center">
                The document has been approved successfully. You can now send it to the external campus for review.
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
                  <span>Sent to External</span>
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
            modalTitle = 'Send to External Campus';
            modalDescription = (
              <>
                Confirm this document has been sent to the external campus.
                Upload proof (PDF or image) and optional comments. Status will move to <strong className="text-blue-600">External Review</strong>.
              </>
            );
            placeholderText = 'Enter optional comments...';
            ringClass = 'focus:ring-blue-500/20 focus:border-blue-500';
            confirmBtnText = 'Confirm Send';
            confirmBtnBg = 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/10';
            disableConfirm = !externalProofFile;
            onConfirm = () => {
              if (!externalProofFile) {
                alert('Please upload proof that the document was sent to the external campus.');
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
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
              <div className="bg-white rounded-3xl w-full max-w-md p-8 flex flex-col shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-300">
                <div className={`w-12 h-12 ${modalIconBg} rounded-2xl flex items-center justify-center mb-6`}>
                  {modalIcon}
                </div>
                <h3 className="font-bold text-gray-800 text-lg mb-2">{modalTitle}</h3>
                <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                  {modalDescription}
                </p>

                <div className="space-y-2 mb-6">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block font-bold text-gray-500">Add comments</label>
                  <textarea
                    value={returnComments}
                    onChange={(e) => setReturnComments(e.target.value)}
                    placeholder={placeholderText}
                    rows={4}
                    className={`w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-700 focus:outline-none focus:ring-2 ${ringClass} transition-all resize-none text-gray-800 font-medium`}
                  />
                </div>

                {decisionType === 'send_to_external' && (
                  <div className="space-y-2 mb-6">
                    <label htmlFor="externalProof" className="text-xs font-bold text-gray-500 uppercase tracking-widest block">Proof of sent document (required)</label>
                    <input
                      id="externalProof"
                      type="file"
                      accept="image/*,.pdf,.doc,.docx"
                      onChange={(e) => setExternalProofFile(e.target.files?.[0] || null)}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 file:mr-4 file:rounded-full file:border-0 file:bg-blue-50 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-blue-700 hover:bg-gray-100"
                    />
                    {externalProofFile && <p className="text-xs text-gray-500">Selected proof file: {externalProofFile.name}</p>}
                    <p className="text-xs text-gray-400">Attach a screenshot, PDF, or document proof that this submission was sent to the external campus.</p>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setIsReturnModalOpen(false);
                      setExternalProofFile(null);
                    }}
                    className="flex-1 px-5 py-3 border border-gray-200 text-gray-500 hover:bg-gray-50 rounded-xl font-bold transition-all text-xs uppercase tracking-wider"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={onConfirm}
                    disabled={loading || externalProofUploading || disableConfirm}
                    className={`flex-1 px-5 py-3 ${confirmBtnBg} text-white rounded-xl font-bold transition-all text-xs uppercase tracking-wider shadow-md disabled:opacity-50`}
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
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-6 duration-1000">
      {/* Page Header - Matching Inbox */}
      <div className="flex items-end justify-between mb-8 border-b border-gray-100 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary-green rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary-green/10">
            <FileText size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 tracking-tight flex items-center gap-3">
              My Documents
            </h1>
            <p className="text-gray-400 text-sm">Track your handled and reviewed document status</p>
          </div>
        </div>

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
                <tr className="bg-primary-green text-white">
                  <th className="px-6 py-4 font-semibold text-[11px] uppercase tracking-wider">Document Details</th>
                  <th className="px-6 py-4 font-semibold text-[11px] uppercase tracking-wider">Sender</th>
                  <th className="px-6 py-4 font-semibold text-[11px] uppercase tracking-wider text-center">Category</th>
                  <th className="px-6 py-4 font-semibold text-[11px] uppercase tracking-wider">Submitted</th>
                  <th className="px-6 py-4 font-semibold text-[11px] uppercase tracking-wider text-center">Status</th>
                  <th className="px-6 py-4 font-semibold text-[11px] uppercase tracking-wider text-right">Last Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredDocs.map((doc) => (
                  <tr
                    key={doc.id}
                    className="group transition-all duration-300 hover:bg-gray-50/50"
                  >
                    <td
                      className="px-6 py-5 cursor-pointer"
                      onClick={() => setSelectedDoc(doc)}
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="text-secondary-gold opacity-50" size={20} />
                        <div>
                          <p className="font-semibold text-gray-800 group-hover:text-primary-green transition-colors uppercase text-sm leading-tight">
                            {doc.title}
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
                    </td>
                    <td className="px-6 py-5 text-sm text-gray-500 font-medium">
                      {doc.submittedDate}
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span
                        style={{
                          backgroundColor: getStatusColor(doc.status?.toLowerCase() === 'waiting for accomplishment report' ? 'approved' : doc.status)
                        }}
                        className="px-4 py-1.5 rounded-full text-[10px] font-bold shadow-sm inline-block min-w-[120px] transition-all uppercase text-white"
                      >
                        {doc.status?.toLowerCase() === 'waiting for accomplishment report' ? 'APPROVED' : doc.status}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right text-sm text-gray-500 font-medium">{doc.lastAction}</td>
                  </tr>
                ))}
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

      {isDeliveryProofModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-5xl rounded-3xl bg-white shadow-2xl border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-gray-800">Proof of Delivery</h3>
                <p className="text-xs font-medium text-gray-500 mt-1">External Campus Submission Proof</p>
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
      )}
    </div>
  );
};

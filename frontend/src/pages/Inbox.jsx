import React from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Filter, 
  MoreVertical, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  FileText, 
  User, 
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  ArrowUpRight,
  RefreshCcw,
  Eye,
  Check,
  RotateCcw,
  Archive,
  Trash2,
  Mail,
  MoreHorizontal,
  ChevronDown,
  List,
  Calendar,
  Paperclip,
  X
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
  if (s.includes('external review')) {
    return '#d76b0d';
  }
  if (s === 'approved') {
    return '#105220';
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

export const Inbox = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isFilterOpen, setIsFilterOpen] = React.useState(false);
  const [filterType, setFilterType] = React.useState('All'); // 'All', 'Pending', 'Approved', 'Rejected'
  const [selectedDocs, setSelectedDocs] = React.useState([]);
  const [viewMode, setViewMode] = React.useState('inbox'); // 'inbox' or 'archive'
  const [selectedDoc, setSelectedDoc] = React.useState(null);
  const [selectedVersionId, setSelectedVersionId] = React.useState(null);
  const [isFilesOpen, setIsFilesOpen] = React.useState(true);
  const [previewFile, setPreviewFile] = React.useState(null);
  const [filePreviewUrl, setFilePreviewUrl] = React.useState('');
  const [reviewAction, setReviewAction] = React.useState('missing-requirements');
  const [reviewComments, setReviewComments] = React.useState('');
  const [timelineLogs, setTimelineLogs] = React.useState([]);
  const [isReturnModalOpen, setIsReturnModalOpen] = React.useState(false);
  const [returnComments, setReturnComments] = React.useState('');
  const [decisionType, setDecisionType] = React.useState('return'); // 'approve', 'return', 'disapprove'
  const [attachmentSaving, setAttachmentSaving] = React.useState(false);
  const [attachmentSuccessModal, setAttachmentSuccessModal] = React.useState(null);
  const [locallyApproved, setLocallyApproved] = React.useState([]);

  const fetchTimelineLogs = async (submissionId) => {
    try {
      const { data, error } = await supabase
        .from('submission_logs')
        .select(`
          *,
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
    }
  };

  React.useEffect(() => {
    if (selectedDoc) {
      fetchTimelineLogs(selectedDoc.id);
      setLocallyApproved([]);
    } else {
      setTimelineLogs([]);
      setLocallyApproved([]);
    }
  }, [selectedDoc]);

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
      
      // Try to create a signed URL first (private bucket compatible)
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

      // Fallback to getPublicUrl
      const { data } = supabase.storage
        .from('documents')
        .getPublicUrl(finalPath);
      
      setFilePreviewUrl(data?.publicUrl || '');
    };
    fetchUrl();
  }, [previewFile]);
  
  const [inboxData, setInboxData] = React.useState([]);
  const [archiveData, setArchiveData] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');

  const currentData = viewMode === 'inbox' ? inboxData : archiveData;

  // Supabase Fetch Submissions Function
  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      
      const statusFilter = user?.role === 'admin' ? 'SDS coordinator review' : 'submitted';

      // Try with precise relation name first
      let { data, error } = await supabase
        .from('submissions')
        .select(`
          id,
          user_id,
          document_type_id,
          status,
          remarks,
          created_at,
          current_version_id,
          users (
            id,
            full_name,
            role,
            org_name
          ),
          documentType (
            id,
            name
          ),
          submission_versions!submission_id (
            id,
            version_number,
            status,
            activity_proposal_details (
              *
            ),
            submission_attachments (
              *
            )
          )
        `)
        .eq('status', statusFilter)
        .order('created_at', { ascending: false });

      // Fallback in case of foreign key name mismatch or PostgREST join resolution ambiguity
      if (error) {
        console.warn("Attempting fallback query due to join error:", error.message);
        const fallbackRes = await supabase
          .from('submissions')
          .select(`
            id,
            user_id,
            document_type_id,
            status,
            remarks,
            created_at,
            current_version_id,
            users (
              id,
              full_name,
              role,
              org_name
            ),
            documentType (
              id,
              name
            ),
            submission_versions!submission_id (
              id,
              version_number,
              status,
              activity_proposal_details (
                *
              ),
              submission_attachments (
                *
              )
            )
          `)
          .eq('status', statusFilter)
          .order('created_at', { ascending: false });

        if (fallbackRes.error) throw fallbackRes.error;
        data = fallbackRes.data;
      }

      const mapped = (data || []).map(sub => {
        const docTypeName = sub.documentType?.name || 'Document';
        const isActivityProposal = docTypeName.toLowerCase() === 'activity proposal' || docTypeName.toLowerCase().includes('proposal');
        
        let proposalType = '-';
        let customDetails = {};

        // Resolve submission version
        let activeVersion = null;
        if (sub.submission_versions) {
          activeVersion = Array.isArray(sub.submission_versions)
            ? (sub.submission_versions.find(v => v.id === sub.current_version_id) || sub.submission_versions[0])
            : sub.submission_versions;
        }

        // Fetch proposal_type if it is an Activity Proposal
        if (isActivityProposal && activeVersion && activeVersion.activity_proposal_details) {
          const details = Array.isArray(activeVersion.activity_proposal_details)
            ? activeVersion.activity_proposal_details[0]
            : activeVersion.activity_proposal_details;

          if (details) {
            customDetails = details;
            if (details.proposal_type) {
              const rawType = details.proposal_type;
              if (rawType.toLowerCase() === 'in-campus') {
                proposalType = 'In-Campus';
              } else if (rawType.toLowerCase() === 'off-campus') {
                proposalType = 'Off-Campus';
              } else {
                proposalType = rawType.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
              }
            }
          }
        }

        // Map status value to correct friendly label for UI filtering
        let statusLabel = 'OSO Staff Review';
        if (sub.status === 'approved') {
          statusLabel = 'Approved';
        } else if (sub.status === 'disapproved' || sub.status === 'rejected') {
          statusLabel = 'Rejected';
        } else if (sub.status === 'submitted') {
          statusLabel = 'OSO Staff Review';
        } else if (sub.status === 'to forward') {
          statusLabel = user?.role === 'org-president' ? 'Hardcopy Submission' : 'To Forward';
        } else if (sub.status === 'SDS coordinator review') {
          statusLabel = 'SDS coordinator review';
        } else if (sub.status === 'draft') {
          statusLabel = 'Draft';
        }

        // Resolve attachments from nested join
        let attachmentsList = [];
        if (activeVersion && activeVersion.submission_attachments) {
          attachmentsList = Array.isArray(activeVersion.submission_attachments)
            ? activeVersion.submission_attachments
            : [activeVersion.submission_attachments];
        }

        // Resolve satisfy goals array
        let satisfyGoals = [];
        if (customDetails.satisfaction_goal_1) satisfyGoals.push(customDetails.satisfaction_goal_1);
        if (customDetails.satisfaction_goal_2) satisfyGoals.push(customDetails.satisfaction_goal_2);
        if (customDetails.satisfaction_goal_3) satisfyGoals.push(customDetails.satisfaction_goal_3);

        return {
          id: sub.id,
          org: isActivityProposal ? (customDetails.organization_name || '-') : '-',
          submitter_name: sub.users?.full_name || 'Unknown',
          title: (isActivityProposal && customDetails.activity_title) ? customDetails.activity_title.toUpperCase() : docTypeName.toUpperCase(),
          ref: `SUB-2026-03-${String(sub.id).padStart(3, '0')}`,
          type: docTypeName,
          proposal_type: proposalType,
          status: statusLabel,
          time: new Date(sub.created_at).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          }),
          timestamp: new Date(sub.created_at).getTime(),
          isNew: sub.status === 'submitted' || sub.status === 'pending',
          pic: customDetails.person_in_charge || sub.users?.full_name || 'N/A',
          studentId: customDetails.student_id_no || 'N/A',
          contact: customDetails.contact_number || 'N/A',
          proposal_title: isActivityProposal ? (customDetails.activity_title || '-') : '-',
          targetDate: isActivityProposal ? (customDetails.target_date || '-') : '-',
          targetTime: isActivityProposal ? (customDetails.target_time || '-') : '-',
          duration: customDetails.duration || 'N/A',
          students: customDetails.number_of_students ? `${customDetails.number_of_students} Students` : 'N/A',
          nature: customDetails.nature_of_activity || 'N/A',
          objectives: customDetails.objectives || '',
          satisfy_needs: customDetails.satisfy_needs || '',
          satisfy_goals: satisfyGoals,
          partners: isActivityProposal ? (customDetails.partners || null) : null,
          sponsors: isActivityProposal ? (customDetails.sponsors || null) : null,
          attachments: attachmentsList,
          raw: sub
        };
      });

      setInboxData(mapped);
    } catch (err) {
      console.error('Error fetching submissions:', err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchSubmissions();
  }, []);

  const handleApproveSubmission = async (comments = '') => {
    if (!selectedDoc) return;
    try {
      setLoading(true);
      const activeVersionId = selectedDoc.raw.current_version_id || 
        (Array.isArray(selectedDoc.raw.submission_versions) 
          ? selectedDoc.raw.submission_versions[0]?.id 
          : selectedDoc.raw.submission_versions?.id);

      // 1. Update submissions table status and remarks
      const formattedRemarks = comments || 'Approved by Chairman';
      const isSdsCoordinatorStage = (selectedDoc.raw?.status || '').toLowerCase() === 'sds coordinator review' || (selectedDoc.status || '').toLowerCase().includes('sds');

      // If admin is approving an SDS coordinator-stage item, don't force status to 'to forward' so
      // the log's workflow_phase ('dean-review') can determine the My Documents category.
      const updatePayload = isSdsCoordinatorStage && user?.role === 'admin'
        ? { status: 'dean review', remarks: formattedRemarks }
        : { status: 'to forward', remarks: formattedRemarks };

      const { error: subErr } = await supabase
        .from('submissions')
        .update(updatePayload)
        .eq('id', selectedDoc.id);

      if (subErr) throw subErr;

      // 2. Insert workflow action log(s)
      // Special case: admin approving right after SDS Coordinator review
      if (user?.role === 'admin' && isSdsCoordinatorStage) {
        const now = new Date();
        const { error: sdsLogErr } = await supabase
          .from('submission_logs')
          .insert([
            {
              submission_id: selectedDoc.id,
              submission_version_id: activeVersionId,
              user_id: user.id,
              workflow_phase: 'sds-review',
              action_type: 'approved',
              review_action: 'approved',
              action: 'approved',
              description: comments || 'Approved by SDS Coordinator',
              comment: comments || null,
              created_at: now.toISOString()
            },
            {
              submission_id: selectedDoc.id,
              submission_version_id: activeVersionId,
              user_id: user.id,
              workflow_phase: 'dean-review',
              action_type: 'pending',
              review_action: 'pending',
              action: 'Dean Approval',
              description: 'Awaiting Dean’s Wet Signature',
              comment: null,
              created_at: new Date(now.getTime() + 1000).toISOString()
            }
          ]);

        if (sdsLogErr) throw sdsLogErr;
      } else {
        const { error: logErr1 } = await supabase
          .from('submission_logs')
          .insert([{
            submission_id: selectedDoc.id,
            submission_version_id: activeVersionId,
            user_id: user.id,
            workflow_phase: 'Chairman Review',
            action_type: 'approved',
            review_action: 'approved',
            action: 'approved',
            description: comments || 'Approved by Chairman',
            comment: comments || null,
            created_at: new Date().toISOString()
          }]);

        if (logErr1) throw logErr1;

        // 3. Insert workflow action log 2 (Ready for hardcopy) into submission_logs
        const { error: logErr2 } = await supabase
          .from('submission_logs')
          .insert([{
            submission_id: selectedDoc.id,
            submission_version_id: activeVersionId,
            user_id: user.id,
            workflow_phase: 'Chairman Review',
            action_type: 'ready_for_hardcopy',
            review_action: 'ready-for-hardcopy',
            action: 'ready-for-hardcopy',
            description: 'Ready for hardcopy submission',
            comment: null,
            created_at: new Date(Date.now() + 1000).toISOString()
          }]);

        if (logErr2) throw logErr2;
      }

      // Close modal inputs, triggers and refresh list
      setPreviewFile(null);
      await fetchSubmissions();
      setSelectedDoc(null);
      alert('Submission approved successfully!');
      navigate('/my-documents');
    } catch (err) {
      console.error('Error approving submission:', err);
      alert('Failed to approve submission.');
    } finally {
      setLoading(false);
    }
  };

  const handleReturnSubmission = async (comments = '') => {
    if (!selectedDoc) return;
    try {
      setLoading(true);
      const activeVersionId = selectedDoc.raw.current_version_id || 
        (Array.isArray(selectedDoc.raw.submission_versions) 
          ? selectedDoc.raw.submission_versions[0]?.id 
          : selectedDoc.raw.submission_versions?.id);

      // 1. Update submissions table status and remarks
      const formattedRemarks = comments || 'Returned for edits by Chairman';
      const { error: subErr } = await supabase
        .from('submissions')
        .update({ 
          status: 'returned',
          remarks: formattedRemarks
        })
        .eq('id', selectedDoc.id);

      if (subErr) throw subErr;

      // 2. Insert workflow action log into submission_logs
      const { error: logErr } = await supabase
        .from('submission_logs')
        .insert([{
          submission_id: selectedDoc.id,
          submission_version_id: activeVersionId,
          user_id: user.id,
          workflow_phase: 'Chairman Review',
          action_type: 'returned',
          review_action: 'returned',
          action: 'returned',
          description: comments || 'Returned for edits by Chairman',
          comment: comments || null,
          created_at: new Date().toISOString()
        }]);

      if (logErr) throw logErr;

      // Close modal inputs, triggers and refresh list
      setPreviewFile(null);
      setIsReturnModalOpen(false);
      setReturnComments('');
      await fetchSubmissions();
      setSelectedDoc(null);
      alert('Submission returned for edits successfully!');
      navigate('/my-documents');
    } catch (err) {
      console.error('Error returning submission:', err);
      alert('Failed to return submission.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisapproveSubmission = async (comments = '') => {
    if (!selectedDoc) return;
    try {
      setLoading(true);
      const activeVersionId = selectedDoc.raw.current_version_id || 
        (Array.isArray(selectedDoc.raw.submission_versions) 
          ? selectedDoc.raw.submission_versions[0]?.id 
          : selectedDoc.raw.submission_versions?.id);

      // 1. Update submissions table status and remarks
      const formattedRemarks = comments || 'Disapproved by Chairman';
      const { error: subErr } = await supabase
        .from('submissions')
        .update({ 
          status: 'disapproved',
          remarks: formattedRemarks
        })
        .eq('id', selectedDoc.id);

      if (subErr) throw subErr;

      // 2. Insert workflow action log into submission_logs
      const { error: logErr } = await supabase
        .from('submission_logs')
        .insert([{
          submission_id: selectedDoc.id,
          submission_version_id: activeVersionId,
          user_id: user.id,
          workflow_phase: 'Chairman Review',
          action_type: 'disapproved',
          review_action: 'disapproved',
          action: 'disapproved',
          description: comments || 'Disapproved by Chairman',
          comment: comments || null,
          created_at: new Date().toISOString()
        }]);

      if (logErr) throw logErr;

      // Close modal inputs, triggers and refresh list
      setPreviewFile(null);
      setIsReturnModalOpen(false);
      setReturnComments('');
      await fetchSubmissions();
      setSelectedDoc(null);
      alert('Submission disapproved successfully!');
      navigate('/completed');
    } catch (err) {
      console.error('Error disapproving submission:', err);
      alert('Failed to disapprove submission.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAttachmentFeedback = async () => {
    if (!previewFile || !selectedDoc) return;
    try {
      setAttachmentSaving(true);
      const activeVersionId = selectedDoc.raw.current_version_id || 
        (Array.isArray(selectedDoc.raw.submission_versions) 
          ? selectedDoc.raw.submission_versions[0]?.id 
          : selectedDoc.raw.submission_versions?.id);

      const { error } = await supabase
        .from('submission_logs')
        .insert([{
          submission_id: selectedDoc.id,
          submission_version_id: activeVersionId,
          attachment_id: previewFile.id,
          user_id: user.id,
          workflow_phase: 'Chairman Review',
          action_type: 'attachment_review',
          review_action: reviewAction,
          action: reviewAction || 'attachment_review',
          description: reviewComments || 'Attachment reviewed',
          comment: reviewComments || null,
          created_at: new Date().toISOString()
        }]);

      if (error) throw error;

      setAttachmentSuccessModal({
        type: 'returned',
        fileName: previewFile.file_name || 'Attachment'
      });
      setPreviewFile(null); // Close preview modal
      await fetchTimelineLogs(selectedDoc.id); // Refresh timeline
    } catch (err) {
      console.error('Error saving attachment feedback:', err);
      alert('Failed to save attachment feedback.');
    } finally {
      setAttachmentSaving(false);
    }
  };

  const handleApproveAttachment = async () => {
    if (!previewFile || !selectedDoc) return;
    try {
      setAttachmentSaving(true);
      setLocallyApproved(prev => [...prev, previewFile.id]);
 
      setAttachmentSuccessModal({
        type: 'approved',
        fileName: previewFile.file_name || 'Attachment'
      });
      setPreviewFile(null); // Close preview modal
      await fetchTimelineLogs(selectedDoc.id); // Refresh timeline
    } catch (err) {
      console.error('Error approving attachment:', err);
      alert('Failed to approve attachment.');
    } finally {
      setAttachmentSaving(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedDocs.length === filteredData.length) {
      setSelectedDocs([]);
    } else {
      setSelectedDocs(filteredData.map(doc => doc.id));
    }
  };

  const toggleSelectDoc = (id) => {
    if (selectedDocs.includes(id)) {
      setSelectedDocs(selectedDocs.filter(docId => docId !== id));
    } else {
      setSelectedDocs([...selectedDocs, id]);
    }
  };

  const handleArchive = () => {
    if (viewMode === 'archive') return;
    const docsToArchive = inboxData.filter(doc => selectedDocs.includes(doc.id));
    setArchiveData([...archiveData, ...docsToArchive]);
    setInboxData(inboxData.filter(doc => !selectedDocs.includes(doc.id)));
    setSelectedDocs([]);
  };

  const handleDelete = () => {
    if (viewMode === 'inbox') {
      setInboxData(inboxData.filter(doc => !selectedDocs.includes(doc.id)));
    } else {
      setArchiveData(archiveData.filter(doc => !selectedDocs.includes(doc.id)));
    }
    setSelectedDocs([]);
  };

  // State-Based Filter and Search Logic
  let filteredData = currentData.filter(item => {
    // 1. Status Filter
    if (filterType !== 'All') {
      const isPendingMatch = filterType.toLowerCase() === 'pending' && 
        (item.status.toLowerCase() === 'pending' || item.status.toLowerCase() === 'oso staff review' || item.status.toLowerCase() === 'sds coordinator review');
      if (!isPendingMatch && item.status.toLowerCase() !== filterType.toLowerCase()) {
        return false;
      }
    }
    // 2. Search Query Filter
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const orgMatch = item.org.toLowerCase().includes(q);
      const typeMatch = item.type.toLowerCase().includes(q);
      const nameMatch = item.submitter_name.toLowerCase().includes(q);
      return orgMatch || typeMatch || nameMatch;
    }
    return true;
  });

  const isActionsDisabled = selectedDocs.length === 0;

  if (selectedDoc) {
    // Temporary debugging logs
    console.log("FULL DETAILS DATA:", selectedDoc.raw);

    const allVersions = Array.isArray(selectedDoc.raw?.submission_versions) 
      ? [...selectedDoc.raw.submission_versions].sort((a, b) => b.version_number - a.version_number)
      : [selectedDoc.raw?.submission_versions].filter(Boolean);

    const currentVersionIdToUse = selectedVersionId || selectedDoc.raw?.current_version_id;
    const activeVersion = allVersions.find(v => v.id === currentVersionIdToUse) || allVersions[0];

    const details = Array.isArray(activeVersion?.activity_proposal_details)
      ? activeVersion?.activity_proposal_details[0]
      : activeVersion?.activity_proposal_details;

    const documentTypeName = selectedDoc?.raw?.documentType?.name || selectedDoc?.type || "";
    const isActivityProposal = documentTypeName.toLowerCase() === "activity proposal" || documentTypeName.toLowerCase().includes("proposal") || !!details;

    // We MUST pass activeVersion's attachments to the map later
    selectedDoc.attachments = activeVersion?.submission_attachments || [];

    return (
      <div className="animate-in fade-in slide-in-from-right-8 duration-500 pb-24 text-gray-800">
        {/* Detail Header */}
        <div className="flex items-start justify-between mb-8">
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
                    V{activeVersion?.version_number}
                  </span>
                )}
              </h1>
              <p className="text-gray-400 font-mono text-sm mt-1">{selectedDoc.ref}</p>
            </div>
          </div>
          
          {/* Version Selector */}
          {allVersions.length > 1 && (
            <div className="flex items-center gap-3 bg-white border border-gray-100 px-4 py-2 rounded-xl shadow-sm">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Version:</span>
              <select 
                value={activeVersion?.id || ''}
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
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10 text-gray-800">
          {[
            { label: 'ORGANIZATION', value: details?.organization_name || selectedDoc.org || '-', icon: <User size={18} /> },
            { label: 'TYPE', value: `${selectedDoc.type} ${selectedDoc.proposal_type !== '-' ? `(${selectedDoc.proposal_type})` : ''}`, icon: <FileText size={18} />, color: 'text-blue-500' },
            { label: 'STATUS', value: selectedDoc.status, icon: <Clock size={18} />, badge: true },
            { label: 'SUBMITTED', value: selectedDoc.time, icon: <Calendar size={18} /> }
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

        {/* Content Section */}
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
                <ul className="list-disc pl-5 space-y-1 text-sm">
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

            {/* Satisfaction Goals section - Numbered list if dynamic goals exist */}
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

            {/* Partners and Sponsors Cards */}
            {isActivityProposal && (selectedDoc.partners || selectedDoc.sponsors) && (
              <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                {selectedDoc.partners && (
                  <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <p className="font-bold text-gray-800 mb-2 uppercase tracking-wider text-xs">Partners</p>
                    <p className="text-gray-600 text-sm leading-relaxed">{selectedDoc.partners}</p>
                  </div>
                )}
                {selectedDoc.sponsors && (
                  <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <p className="font-bold text-gray-800 mb-2 uppercase tracking-wider text-xs">Sponsors</p>
                    <p className="text-gray-600 text-sm leading-relaxed">{selectedDoc.sponsors}</p>
                  </div>
                )}
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
              {selectedDoc.attachments && selectedDoc.attachments.length > 0 ? (
                selectedDoc.attachments.map((file, idx) => {
                  const fileName = file.file_name || 'Attached File';
                  let finalPath = file.file_url || '';
                  if (finalPath.startsWith('documents/')) {
                    finalPath = finalPath.replace('documents/', '');
                  }
                  const { data } = supabase.storage.from('documents').getPublicUrl(finalPath);
                  const fileUrl = data?.publicUrl || '#';

                  const fileLog = timelineLogs.find(log => log.attachment_id === file.id);
                  const hasRevision = fileLog && fileLog.review_action !== 'approved';
                  
                  const docStatus = (selectedDoc.raw?.status || selectedDoc.status || '').toLowerCase();
                  const isChairmanStage = docStatus === 'submitted' || docStatus === 'oso staff review' || docStatus === 'pending';
                  
                  const isApproved = isChairmanStage 
                    ? (locallyApproved.includes(file.id) || (fileLog && (fileLog.review_action === 'approved' || fileLog.action === 'approved')))
                    : !hasRevision;

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
                  } else if (hasRevision) {
                    containerBg = 'bg-[#f59e0b]';
                    textColor = 'text-[#451a03]';
                    subtitleColor = 'text-[#78350f]';
                    iconStyle = 'bg-[#78350f]/10 text-[#78350f]';
                  }

                  return (
                    <div key={idx} className={`${containerBg} rounded-xl p-4 flex items-center justify-between group hover:brightness-110 transition-all`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 ${iconStyle} rounded-lg flex items-center justify-center`}>
                          <Paperclip size={20} />
                        </div>
                        <div>
                          <p className={`${textColor} font-semibold text-sm`}>{fileName}</p>
                          <p className={`${subtitleColor} text-[10px] uppercase`}>Attached Document</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                        <button 
                          onClick={() => {
                            setPreviewFile(file);
                            if (fileLog) {
                              setReviewAction(fileLog.review_action || '');
                              setReviewComments(fileLog.comment || '');
                            } else {
                              setReviewAction('');
                              setReviewComments('');
                            }
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

        {/* Timeline Log Section */}
        <div className="mb-12 text-gray-800 bg-gray-50/50 rounded-3xl p-8 border border-gray-100">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Submission Lifecycle & Timeline</h4>
              <p className="text-xs text-gray-400 mt-1">Full chronological audit history of reviews, actions and comments</p>
            </div>
            <span className="px-3 py-1 bg-white border border-gray-200 text-gray-400 text-[10px] font-bold rounded-lg uppercase tracking-wider shadow-sm">
              {timelineLogs.filter(log => !log.attachment_id && log.action_type !== 'attachment_review' && log.action_type !== 'created').length} History Logs
            </span>
          </div>

          <div className="relative border-l-2 border-dashed border-gray-205 pl-8 ml-3 space-y-8">
            {(() => {
              const filteredLogs = timelineLogs.filter(log => !log.attachment_id && log.action_type !== 'attachment_review' && log.action_type !== 'created');
              return filteredLogs.length > 0 ? (
                filteredLogs.map((log, idx) => {
                  const isApprove = log.action_type === 'approved' || log.review_action === 'approved';
                  const isReturn = log.action_type === 'returned' || log.review_action === 'returned';
                  const isAttachReview = log.action_type === 'attachment_review';

                  const formattedTime = new Date(log.created_at).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  });

                  return (
                    <div key={log.id || idx} className="relative group animate-in fade-in duration-300">
                      {/* Circle Indicator on vertical track */}
                      <div className={`absolute -left-[41px] top-1 w-6 h-6 rounded-full border-4 border-white flex items-center justify-center shadow-sm z-10 ${
                        isApprove ? 'bg-green-500' : isReturn ? 'bg-amber-500' : isAttachReview ? 'bg-indigo-500' : 'bg-blue-500'
                      }`}>
                        <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                      </div>

                      <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-gray-800">{log.users?.full_name || 'System'}</span>
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-400 text-[10px] font-bold rounded uppercase tracking-wider">
                              {log.users?.role || 'System'}
                            </span>
                          </div>
                          <span className="text-[10px] text-gray-400 font-semibold">{formattedTime}</span>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-3">
                          <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                            isApprove ? 'bg-green-50 text-green-700' : 
                            isReturn ? 'bg-amber-50 text-amber-700' : 
                            isAttachReview ? 'bg-indigo-50 text-indigo-700' : 
                            'bg-blue-50 text-blue-700'
                          }`}>
                            {log.review_action?.replace('-', ' ')}
                          </span>
                          


                          {log.attachment_id && (
                            <span className="px-2 py-0.5 bg-slate-50 border border-slate-100 text-slate-500 text-[10px] font-bold rounded uppercase flex items-center gap-1">
                              <Paperclip size={10} /> Attachment
                            </span>
                          )}
                        </div>

                        {log.comment ? (
                          <div className="bg-gray-50 rounded-xl p-4 text-xs font-medium text-gray-600 border border-gray-100 italic leading-relaxed">
                            "{log.comment}"
                          </div>
                        ) : log.description ? (
                          <div className="bg-gray-50 rounded-xl p-4 text-xs font-medium text-gray-600 border border-gray-100 italic leading-relaxed">
                            "{log.description}"
                          </div>
                        ) : (
                          <p className="text-gray-400 text-xs italic font-medium">No comments provided.</p>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="relative pl-2 py-4">
                  <p className="text-gray-400 text-xs font-semibold italic">No actions have been logged yet for this submission.</p>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Enhanced Fixed Footer Actions connected to Supabase */}
        {(() => {
          const attachments = selectedDoc?.attachments || [];
          const allVersions = Array.isArray(selectedDoc.raw?.submission_versions) 
            ? [...selectedDoc.raw.submission_versions].sort((a, b) => b.version_number - a.version_number)
            : [selectedDoc.raw?.submission_versions].filter(Boolean);
          const currentVersionIdToUse = selectedVersionId || selectedDoc.raw?.current_version_id;
          const activeVersion = allVersions.find(v => v.id === currentVersionIdToUse) || allVersions[0];
          const isLatestVersion = activeVersion?.id === selectedDoc.raw?.current_version_id;

          const allFilesReviewed = attachments.length > 0 
            ? attachments.every(file => {
                const fileLog = timelineLogs.find(log => log.attachment_id === file.id);
                const hasRevision = fileLog && fileLog.review_action !== 'approved';
                return locallyApproved.includes(file.id) || hasRevision;
              })
            : true;

          return (
            <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50">
              <div className="bg-white/80 backdrop-blur-2xl px-10 py-5 rounded-[2rem] border border-white/50 shadow-[0_20px_50px_rgba(0,0,0,0.15)] flex items-center gap-6 animate-in slide-in-from-bottom-12 duration-1000">
                <button 
                  onClick={() => {
                    setDecisionType('approve');
                    setReturnComments('');
                    setIsReturnModalOpen(true);
                  }}
                  disabled={(user?.role !== 'admin' && !allFilesReviewed) || !isLatestVersion}
                  className="flex items-center gap-3 px-8 py-3.5 bg-primary-green text-white rounded-2xl font-bold hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary-green/20 group disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  <CheckCircle size={20} className="group-hover:rotate-12 transition-transform" />
                  <span className="uppercase text-xs tracking-widest">Approve</span>
                </button>
                
                <div className="h-10 w-[1px] bg-gray-200/50"></div>
 
                <button 
                  onClick={() => {
                    setDecisionType('return');
                    setReturnComments('');
                    setIsReturnModalOpen(true);
                  }}
                  disabled={(user?.role !== 'admin' && !allFilesReviewed) || !isLatestVersion}
                  className="flex items-center gap-3 px-8 py-3.5 bg-amber-500 text-white rounded-2xl font-bold hover:scale-105 active:scale-95 transition-all shadow-lg shadow-amber-500/20 group disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  <RotateCcw size={20} className="group-hover:-rotate-45 transition-transform" />
                  <span className="uppercase text-xs tracking-widest">Return</span>
                </button>
 
                <button 
                  onClick={() => {
                    setDecisionType('disapprove');
                    setReturnComments('');
                    setIsReturnModalOpen(true);
                  }}
                  disabled={(user?.role !== 'admin' && !allFilesReviewed) || !isLatestVersion}
                  className="flex items-center gap-3 px-8 py-3.5 bg-red-600 text-white rounded-2xl font-bold hover:scale-105 active:scale-95 transition-all shadow-lg shadow-red-600/20 group disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  <X size={20} className="group-hover:scale-110 transition-transform" />
                  <span className="uppercase text-xs tracking-widest">Disapprove</span>
                </button>
              </div>
            </div>
          );
        })()}

        {/* Attached File Preview Overlay Modal */}
        {previewFile && (() => {
          // Debugging logs
          console.log("ATTACHMENT:", previewFile);
          console.log("FILE URL:", previewFile.file_url);
          console.log("PUBLIC URL:", filePreviewUrl);

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
                      <p className="text-gray-400 text-xs font-medium">Review & Verify Document</p>
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

                  {/* Right Side: Review Controls */}
                  <div className="w-full md:w-96 bg-white p-8 flex flex-col justify-between overflow-y-auto border-t md:border-t-0 border-gray-100">
                    <div className="space-y-6">
                      <div>
                        <h4 className="font-bold text-gray-800 text-base mb-1">Document Review Panel</h4>
                        <p className="text-gray-400 text-xs leading-relaxed">Provide your decision and choose structural remarks for feedback.</p>
                      </div>

                      <div className="h-[1px] bg-gray-100"></div>

                      {/* Review Action Dropdown */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block">Review Action</label>
                        <select 
                          value={reviewAction}
                          onChange={(e) => setReviewAction(e.target.value)}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer text-gray-800"
                        >
                          <option value="">None / Approved</option>
                          <option value="missing-requirements">Missing Requirements</option>
                          <option value="incorrect-format">Incorrect Format</option>
                          <option value="incomplete-information">Incomplete Information</option>
                        </select>
                      </div>

                      {/* Comments Textarea */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block">Review Comments</label>
                        <textarea 
                          value={reviewComments}
                          onChange={(e) => setReviewComments(e.target.value)}
                          placeholder="Enter review comments..."
                          rows={4}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none text-gray-800"
                        />
                      </div>

                    </div>

                    {/* Actions Buttons */}
                    <div className="space-y-3 pt-6 border-t border-gray-100 mt-6">
                      {user?.role !== 'admin' && (
                        <button 
                          onClick={handleApproveAttachment}
                          disabled={!!reviewAction || attachmentSaving}
                          className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all shadow-lg shadow-green-600/10 uppercase text-xs tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <CheckCircle size={16} />
                          <span>{attachmentSaving ? 'Saving...' : 'Approve Submission'}</span>
                        </button>
                      )}
                      
                      <button 
                        onClick={handleSaveAttachmentFeedback}
                        disabled={!reviewAction || attachmentSaving}
                        className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition-all shadow-lg shadow-amber-500/10 uppercase text-xs tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <RotateCcw size={16} />
                        <span>{attachmentSaving ? 'Saving...' : 'Return for Edits'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      {/* Workflow Decision Confirmation Modal inside Selected Doc view */}
      {isReturnModalOpen && (() => {
        let modalIcon = <RotateCcw size={24} />;
        let modalIconBg = 'bg-amber-50 text-amber-500';
        let modalTitle = 'Return Submission';
        let modalDescription = (
          <>
            Are you sure you want to return this document to the Org President for edits? 
            This will revert the status to <strong className="text-amber-600">Returned</strong>.
          </>
        );
        let placeholderText = 'Enter comments for returned changes...';
        let ringClass = 'focus:ring-amber-500/20 focus:border-amber-500';
        let confirmBtnText = 'Confirm Return';
        let confirmBtnBg = 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/10';
        let onConfirm = () => handleReturnSubmission(returnComments);

        if (decisionType === 'approve') {
          modalIcon = <CheckCircle size={24} />;
          modalIconBg = 'bg-green-50 text-green-600';
          modalTitle = 'Approve Submission';
          modalDescription = (
            <>
              Are you sure you want to approve this submission? 
              This will update the status to <strong className="text-green-600">Approved</strong>.
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
          placeholderText = 'Enter optional disapproval comments...';
          ringClass = 'focus:ring-red-500/20 focus:border-red-500';
          confirmBtnText = 'Confirm Disapprove';
          confirmBtnBg = 'bg-red-600 hover:bg-red-700 shadow-red-600/10';
          onConfirm = () => handleDisapproveSubmission(returnComments);
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
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block">Add comments (optional)</label>
                <textarea 
                  value={returnComments}
                  onChange={(e) => setReturnComments(e.target.value)}
                  placeholder={placeholderText}
                  rows={4}
                  className={`w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-700 focus:outline-none focus:ring-2 ${ringClass} transition-all resize-none text-gray-800 font-medium`}
                />
              </div>

              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setIsReturnModalOpen(false)}
                  className="flex-1 px-5 py-3 border border-gray-200 text-gray-500 hover:bg-gray-50 rounded-xl font-bold transition-all text-xs uppercase tracking-wider animate-in"
                >
                  Cancel
                </button>
                <button 
                  onClick={onConfirm}
                  disabled={loading}
                  className={`flex-1 px-5 py-3 ${confirmBtnBg} text-white rounded-xl font-bold transition-all text-xs uppercase tracking-wider shadow-md disabled:opacity-50`}
                >
                  {confirmBtnText}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Attachment Success Popup Modal */}
      {attachmentSuccessModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl w-full max-w-sm p-8 text-center shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-300">
            <div className={`w-16 h-16 mx-auto ${
              attachmentSuccessModal.type === 'approved' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'
            } rounded-2xl flex items-center justify-center mb-6`}>
              {attachmentSuccessModal.type === 'approved' ? <CheckCircle size={32} /> : <RotateCcw size={32} />}
            </div>
            
            <h3 className="font-bold text-gray-800 text-xl mb-2">
              {attachmentSuccessModal.type === 'approved' ? 'Attachment Approved' : 'Returned for Edits'}
            </h3>
            
            <p className="text-gray-500 text-sm mb-6 leading-relaxed">
              The file <strong className="text-gray-700">{attachmentSuccessModal.fileName}</strong> has been successfully {attachmentSuccessModal.type === 'approved' ? 'approved' : 'marked for correction'}.
            </p>

            <button 
              onClick={() => setAttachmentSuccessModal(null)}
              className="w-full px-5 py-3.5 bg-indigo-600 text-white rounded-xl font-bold transition-all text-xs uppercase tracking-widest shadow-lg shadow-indigo-600/10 hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98]"
            >
              Okay, Got it
            </button>
          </div>
        </div>
      )}
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-6 duration-1000 text-gray-800">
      {/* Page Header */}
      <div className="flex items-end justify-between mb-8 border-b border-gray-100 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary-green rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary-green/10">
            <Mail size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 tracking-tight flex items-center gap-3">
              Inbox
            </h1>
            <p className="text-gray-400 text-sm">Review and manage your institutional documents</p>
          </div>
        </div>

        <div className="flex p-1 bg-gray-100/50 rounded-xl border border-gray-100">
          <button 
            onClick={() => { setViewMode('inbox'); setSelectedDocs([]); }}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${viewMode === 'inbox' ? 'bg-white text-primary-green shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            All Messages
          </button>
          <button 
            onClick={() => { setViewMode('archive'); setSelectedDocs([]); }}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${viewMode === 'archive' ? 'bg-white text-primary-green shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Archive
          </button>
        </div>
      </div>

      {/* Top Header Bar */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-4 flex-1">
          <button 
            onClick={fetchSubmissions}
            className="flex items-center gap-2 text-gray-400 hover:text-primary-green transition-all font-medium group text-sm"
          >
            <RefreshCcw size={16} className="group-hover:rotate-180 transition-transform duration-700" />
            <span>Sync List</span>
          </button>
          
          {/* Search Box */}
          <div className="relative w-80">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 pointer-events-none">
              <Search size={16} />
            </span>
            <input 
              type="text" 
              placeholder="Search org, type, or submitter..." 
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-green outline-none transition-all text-gray-700"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        
        <div className="relative">
          <button 
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl transition-all font-semibold text-sm ${
              isFilterOpen ? 'bg-primary-green text-white shadow-md' : 'bg-white border border-gray-200 text-gray-700 hover:border-primary-green'
            }`}
          >
            <Filter size={16} />
            <span>Filter {filterType !== 'All' && `: ${filterType}`}</span>
            <ChevronDown size={16} className={`transition-transform duration-500 ${isFilterOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Filter Dropdown */}
          {isFilterOpen && (
            <div className="absolute right-0 mt-3 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 p-2 animate-in zoom-in-95 duration-200 text-gray-800">
              <div className="px-4 py-2 border-b border-gray-50 mb-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Filter Options</p>
              </div>
              {[
                { label: 'All Documents', value: 'All' },
                { label: 'Pending', value: 'Pending' },
                { label: 'Approved', value: 'Approved' },
                { label: 'Rejected', value: 'Rejected' }
              ].map((item, idx) => (
                <button
                  key={item.value}
                  onClick={() => { setFilterType(item.value); setIsFilterOpen(false); }}
                  className={`w-full text-left px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                    filterType === item.value ? 'bg-green-50 text-primary-green' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bulk Action Bar */}
      <div className="bg-white border border-gray-100 rounded-2xl px-6 py-3.5 flex items-center justify-between shadow-sm mb-4 text-gray-800">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <input 
              type="checkbox" 
              checked={filteredData.length > 0 && selectedDocs.length === filteredData.length}
              onChange={toggleSelectAll}
              className="w-5 h-5 rounded border-gray-300 text-primary-green focus:ring-primary-green cursor-pointer transition-all shadow-sm" 
            />
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Select All</span>
          </div>
          
          <div className="h-6 w-[1px] bg-gray-100"></div>

          <div className="flex items-center gap-1">
            <button 
              onClick={handleArchive}
              disabled={isActionsDisabled || viewMode === 'archive'}
              className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-primary-green hover:bg-green-50 rounded-xl transition-all disabled:opacity-20 disabled:hover:bg-transparent group"
            >
              <Archive size={18} />
              <span className="text-sm font-semibold">Archive</span>
            </button>
            <button 
              onClick={handleDelete}
              disabled={isActionsDisabled}
              className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all disabled:opacity-20 disabled:hover:bg-transparent group"
            >
              <Trash2 size={18} />
              <span className="text-sm font-semibold">Delete</span>
            </button>
            <button 
              disabled={isActionsDisabled}
              className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all disabled:opacity-20 disabled:hover:bg-transparent group"
            >
              <Mail size={18} />
              <span className="text-sm font-semibold">Mark as read</span>
            </button>
          </div>
        </div>
        
        <div className="text-xs font-semibold uppercase tracking-wider py-1.5 px-4 bg-gray-50 text-gray-400 rounded-lg border border-gray-100">
          {selectedDocs.length > 0 ? (
            <span className="text-primary-green">{selectedDocs.length} Selected</span>
          ) : (
            <>
              <span className="text-secondary-gold font-bold">{filteredData.filter(d => d.status === 'Pending' || d.status === 'OSO Staff Review' || d.status === 'SDS coordinator review').length} Pending</span>
              <span className="text-gray-300 mx-2">•</span>
              <span>{filteredData.length} Total</span>
            </>
          )}
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm mb-10 text-gray-800">
        <div className="overflow-x-auto">
          {loading && currentData.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[300px] gap-4">
              <div className="w-12 h-12 border-4 border-primary-green border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-400 font-semibold uppercase text-xs tracking-widest animate-pulse">Loading submissions...</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-primary-green text-white">
                  <th className="px-6 py-4 font-semibold text-[11px] uppercase tracking-wider text-center w-20">Select</th>
                  <th className="px-6 py-4 font-semibold text-[11px] uppercase tracking-wider">Document Details</th>
                  <th className="px-6 py-4 font-semibold text-[11px] uppercase tracking-wider">Sender</th>
                  <th className="px-6 py-4 font-semibold text-[11px] uppercase tracking-wider text-center">Type</th>
                  <th className="px-6 py-4 font-semibold text-[11px] uppercase tracking-wider">Submitted</th>
                  <th className="px-6 py-4 font-semibold text-[11px] uppercase tracking-wider text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredData.length > 0 ? filteredData.map((item) => (
                  <tr 
                    key={item.id} 
                    className={`group transition-all duration-300 cursor-pointer ${
                      selectedDocs.includes(item.id) ? 'bg-green-50/50' : item.isNew ? 'bg-red-50/20' : 'bg-transparent'
                    } hover:bg-gray-50/50`}
                    onClick={() => setSelectedDoc(item)}
                  >
                    <td className="px-6 py-5 text-center" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        checked={selectedDocs.includes(item.id)}
                        onChange={() => toggleSelectDoc(item.id)}
                        className="w-4 h-4 rounded border-gray-200 text-primary-green focus:ring-primary-green cursor-pointer transition-transform" 
                      />
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        {item.isNew && (
                          <div className="relative flex-shrink-0">
                            <div className="w-2.5 h-2.5 bg-amber-500 rounded-full shadow-sm"></div>
                            <div className="absolute inset-0 w-2.5 h-2.5 bg-amber-500 rounded-full animate-ping opacity-75"></div>
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-gray-800 group-hover:text-primary-green transition-colors uppercase text-sm">{item.title}</p>
                          <p className="text-[10px] text-gray-400 font-mono mt-0.5 tracking-tighter uppercase">{item.ref}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div>
                        <p className="text-sm font-semibold text-gray-800 uppercase tracking-tight">{item.org}</p>
                        <p className="text-[10px] text-gray-400 font-medium tracking-tight">By: {item.submitter_name}</p>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className="inline-block px-4 py-1 border border-gray-100 text-gray-500 text-[10px] font-semibold rounded-lg bg-white shadow-sm group-hover:border-primary-green/20 group-hover:text-primary-green transition-all uppercase">
                        {item.type}
                      </span>
                      {item.proposal_type !== '-' && (
                        <span className="block text-[9px] font-bold text-primary-green mt-1 uppercase tracking-tight">
                          {item.proposal_type}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-5 text-sm text-gray-500 font-medium">
                      {item.time}
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span 
                        style={{
                          backgroundColor: getStatusColor(item.status)
                        }}
                        className="px-4 py-1.5 rounded-full text-[10px] font-bold shadow-sm inline-block min-w-[120px] transition-all uppercase text-white"
                      >
                        {item.status}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="6" className="px-8 py-24 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-200">
                          <Mail size={32} />
                        </div>
                        <p className="text-gray-400 font-semibold uppercase tracking-wider text-xs">No documents in this view</p>
                        <button 
                          onClick={() => setViewMode('inbox')}
                          className="text-primary-green font-bold text-sm hover:underline"
                        >
                          Go back to Inbox
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Pagination */}
      <div className="mt-6 flex items-center justify-end gap-2">
        <button className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronRight size={20} className="rotate-180" />
        </button>
        <span className="text-sm font-bold text-primary-green px-3 py-1 bg-green-50 rounded-lg">1</span>
        <button className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronRight size={20} />
        </button>
      </div>
      {/* Workflow Decision Confirmation Modal */}
      {isReturnModalOpen && (() => {
        let modalIcon = <RotateCcw size={24} />;
        let modalIconBg = 'bg-amber-50 text-amber-500';
        let modalTitle = 'Return Submission';
        let modalDescription = (
          <>
            Are you sure you want to return this document to the Org President for edits? 
            This will revert the status to <strong className="text-amber-600">Returned</strong>.
          </>
        );
        let placeholderText = 'Enter comments for returned changes...';
        let ringClass = 'focus:ring-amber-500/20 focus:border-amber-500';
        let confirmBtnText = 'Confirm Return';
        let confirmBtnBg = 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/10';
        let onConfirm = () => handleReturnSubmission(returnComments);

        if (decisionType === 'approve') {
          modalIcon = <CheckCircle size={24} />;
          modalIconBg = 'bg-green-50 text-green-600';
          modalTitle = 'Approve Submission';
          modalDescription = (
            <>
              Are you sure you want to approve this submission? 
              This will update the status to <strong className="text-green-600">Approved</strong>.
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
          placeholderText = 'Enter optional disapproval comments...';
          ringClass = 'focus:ring-red-500/20 focus:border-red-500';
          confirmBtnText = 'Confirm Disapprove';
          confirmBtnBg = 'bg-red-600 hover:bg-red-700 shadow-red-600/10';
          onConfirm = () => handleDisapproveSubmission(returnComments);
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
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block">Add comments (optional)</label>
                <textarea 
                  value={returnComments}
                  onChange={(e) => setReturnComments(e.target.value)}
                  placeholder={placeholderText}
                  rows={4}
                  className={`w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-700 focus:outline-none focus:ring-2 ${ringClass} transition-all resize-none text-gray-800 font-medium`}
                />
              </div>

              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setIsReturnModalOpen(false)}
                  className="flex-1 px-5 py-3 border border-gray-200 text-gray-500 hover:bg-gray-50 rounded-xl font-bold transition-all text-xs uppercase tracking-wider animate-in"
                >
                  Cancel
                </button>
                <button 
                  onClick={onConfirm}
                  className={`flex-1 px-5 py-3 ${confirmBtnBg} text-white rounded-xl font-bold transition-all text-xs uppercase tracking-wider shadow-md`}
                >
                  {confirmBtnText}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

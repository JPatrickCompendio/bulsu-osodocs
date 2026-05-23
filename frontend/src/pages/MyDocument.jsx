import React from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
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
  Calendar
} from 'lucide-react';

export const MyDocuments = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = React.useState('All');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [logsData, setLogsData] = React.useState([]);

  // Detail View State
  const [selectedDoc, setSelectedDoc] = React.useState(null);
  const [isFilesOpen, setIsFilesOpen] = React.useState(true);
  const [previewFile, setPreviewFile] = React.useState(null);
  const [filePreviewUrl, setFilePreviewUrl] = React.useState('');
  const [timelineLogs, setTimelineLogs] = React.useState([]);

  // Action Modals State
  const [isReturnModalOpen, setIsReturnModalOpen] = React.useState(false);
  const [returnComments, setReturnComments] = React.useState('');
  const [decisionType, setDecisionType] = React.useState('return'); // 'return' or 'disapprove'
  const [isForwardModalOpen, setIsForwardModalOpen] = React.useState(false);

  // Fetch timeline logs for detailed view
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
    } else {
      setTimelineLogs([]);
    }
  }, [selectedDoc]);

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
      
        const { data: primaryData, error } = await supabase
        .from('submission_logs')
        .select(`
          *,
          submissions (
            *,
            users (org_name, student_no),
            documentType (name),
            submission_versions!current_version_id (
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
              submission_versions (
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

      const formattedRemarks = comments || 'Returned for edits by Chairman';
      const { error: subErr } = await supabase
        .from('submissions')
        .update({ 
          status: 'returned',
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
          workflow_phase: 'Chairman Review',
          action_type: 'returned',
          review_action: 'returned',
          action: 'returned',
          description: comments || 'Returned for edits by Chairman',
          comment: comments || null,
          created_at: new Date().toISOString()
        }]);

      if (logErr) throw logErr;

      setIsReturnModalOpen(false);
      setReturnComments('');
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

  const handleDisapproveSubmission = async (comments = '') => {
    if (!selectedDoc) return;
    try {
      setLoading(true);
      const activeVersionId = selectedDoc.raw?.current_version_id || 
        (Array.isArray(selectedDoc.raw?.submission_versions) 
          ? selectedDoc.raw?.submission_versions[0]?.id 
          : selectedDoc.raw?.submission_versions?.id);

      const formattedRemarks = comments || 'Disapproved by Chairman';
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
          workflow_phase: 'Chairman Review',
          action_type: 'disapproved',
          review_action: 'disapproved',
          action: 'disapproved',
          description: comments || 'Disapproved by Chairman',
          comment: comments || null,
          created_at: new Date().toISOString()
        }]);

      if (logErr) throw logErr;

      setIsReturnModalOpen(false);
      setReturnComments('');
      setSelectedDoc(null);
      await fetchHandledLogs();
      alert('Submission disapproved successfully!');
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

      const { error: logErr } = await supabase
        .from('submission_logs')
        .insert([{
          submission_id: selectedDoc.id,
          submission_version_id: activeVersionId,
          user_id: user.id,
          workflow_phase: 'sds-review',
          action_type: 'forwarded',
          review_action: 'forwarded',
          action: 'forwarded',
          description: 'Forwarded to SDS Coordinator (Admin) by Chairman',
          comment: 'Forwarded to SDS Coordinator (Admin) by Chairman',
          created_at: new Date().toISOString()
        }]);

      if (logErr) throw logErr;

      setIsForwardModalOpen(false);
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
      } catch (_) {}
    }

    const targetTime = details?.target_time || '-';
    const proposalTitle = details?.activity_title || '-';

    // Map Category Filter based on latest log or overall status
    let category = 'All';
    const wp = latestLog.workflow_phase || '';
    const ra = latestLog.review_action || '';
    const subStatus = (submission.status || '').toLowerCase();
    
    if (subStatus === 'to forward') {
      category = 'To Forward';
    } else if (subStatus === 'sds coordinator review' || wp === 'sds-review') {
      category = 'SDS Review';
    } else if (wp === 'dean-review') category = 'Dean Review';
    else if (wp === 'external-review') category = 'External Review';
    else if (ra === 'ready-for-hardcopy') category = 'To Forward';
    else if (ra === 'approved') category = 'Approved';
    else if (ra === 'returned') category = 'Returned';

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
      status: submission.status ? submission.status.toUpperCase() : 'PENDING',
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
  const filteredDocs = mappedDocs.filter(doc => {
    const matchesTab = activeTab === 'All' || doc.category === activeTab;
    const matchesSearch = !query || 
      doc.title.toLowerCase().includes(query) ||
      doc.sender.toLowerCase().includes(query) ||
      doc.type.toLowerCase().includes(query) ||
      doc.ref.toLowerCase().includes(query);
    return matchesTab && matchesSearch;
  });

  // Tabs layout
  const tabs = [
    { name: 'All', count: mappedDocs.length },
    { name: 'SDS Review', count: mappedDocs.filter(d => d.category === 'SDS Review').length },
    { name: 'Dean Review', count: mappedDocs.filter(d => d.category === 'Dean Review').length },
    { name: 'External Review', count: mappedDocs.filter(d => d.category === 'External Review').length },
    { name: 'Approved', count: mappedDocs.filter(d => d.category === 'Approved').length },
    ...(user?.role === 'chairman' ? [{ name: 'To Forward', count: mappedDocs.filter(d => d.category === 'To Forward').length }] : []),
    { name: 'Returned', count: mappedDocs.filter(d => d.category === 'Returned').length }
  ];

  if (selectedDoc) {
    const isActivityProposal = selectedDoc.isActivityProposal;

    const currentVersion = Array.isArray(selectedDoc.raw?.submission_versions)
      ? (selectedDoc.raw?.submission_versions.find(v => v.id === selectedDoc.raw?.current_version_id) || selectedDoc.raw?.submission_versions[0])
      : selectedDoc.raw?.submission_versions;
    const attachments = currentVersion?.submission_attachments || [];

    return (
      <div className="animate-in fade-in duration-500 max-w-7xl mx-auto px-4 py-8 pb-32">
        {/* Detail Header */}
        <div className="flex items-start gap-4 mb-8">
          <button 
            onClick={() => setSelectedDoc(null)}
            className="mt-1 p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-800"
          >
            <ChevronLeft size={24} />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-800 tracking-tight">
              {selectedDoc.proposal_title && selectedDoc.proposal_title !== '-' ? selectedDoc.proposal_title : selectedDoc.title}
            </h1>
            <p className="text-gray-400 font-mono text-sm mt-1">{selectedDoc.ref}</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10 text-gray-800">
          {[
            { label: 'ORGANIZATION', value: selectedDoc.sender || '-', icon: <User size={18} /> },
            { label: 'TYPE', value: `${selectedDoc.type}`, icon: <FileText size={18} />, color: 'text-blue-500' },
            { label: 'STATUS', value: selectedDoc.status, icon: <Clock size={18} />, badge: true },
            { label: 'SUBMITTED', value: selectedDoc.submittedDate, icon: <Calendar size={18} /> }
          ].map((card, idx) => (
            <div key={idx} className="bg-gray-100 p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                {card.icon}
                <span>{card.label}</span>
              </div>
              {card.badge ? (
                <span className={`px-4 py-1.5 rounded-lg text-[10px] font-bold shadow-sm uppercase inline-block ${
                  card.value === 'APPROVED' || card.value === 'TO FORWARD' ? 'bg-green-100 text-green-700' :
                  card.value === 'RETURNED' ? 'bg-amber-100 text-amber-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
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

                  const fileLog = timelineLogs.find(log => log.attachment_id === file.id);
                  const isApproved = fileLog && (fileLog.review_action === 'approved' || fileLog.action === 'approved');
                  const hasRevision = fileLog && !isApproved;

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

        {/* Timeline */}
        <div className="mb-12 text-gray-800 bg-gray-50/50 rounded-3xl p-8 border border-gray-100">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Submission Lifecycle & Timeline</h4>
              <p className="text-xs text-gray-400 mt-1">Full chronological audit history of reviews, actions and comments</p>
            </div>
            <span className="px-3 py-1 bg-white border border-gray-200 text-gray-400 text-[10px] font-bold rounded-lg uppercase tracking-wider shadow-sm">
              {(() => {
                const filteredLogs = timelineLogs.filter(log => !log.attachment_id && log.action_type !== 'attachment_review' && log.action_type !== 'created');
                return filteredLogs.length;
              })()} History Logs
            </span>
          </div>

          <div className="relative border-l-2 border-dashed border-gray-200 pl-8 ml-3 space-y-8">
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

        {/* Action buttons (Chairman only - Bottom of the page) */}
        {user?.role === 'chairman' && (
          <div className="flex items-center justify-center gap-4 mt-10 p-6 bg-gray-50 border border-gray-100 rounded-3xl shadow-sm max-w-xl mx-auto">
            <button
              onClick={() => {
                setDecisionType('return');
                setReturnComments('');
                setIsReturnModalOpen(true);
              }}
              disabled={selectedDoc.category !== 'To Forward'}
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
              disabled={selectedDoc.category !== 'To Forward' && selectedDoc.category !== 'Returned'}
              className="flex items-center justify-center gap-3 px-8 py-3.5 bg-red-600 text-white text-xs font-bold rounded-2xl hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed transition-all shadow-lg shadow-red-600/20 uppercase tracking-widest animate-in"
            >
              <X size={16} />
              <span>Disapprove</span>
            </button>

            <button
              onClick={() => {
                setIsForwardModalOpen(true);
              }}
              disabled={selectedDoc.category !== 'To Forward'}
              className="flex items-center justify-center gap-3 px-8 py-3.5 bg-green-600 text-white text-xs font-bold rounded-2xl hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed transition-all shadow-lg shadow-green-600/20 uppercase tracking-widest animate-in"
            >
              <CheckCircle size={16} />
              <span>To Forward</span>
            </button>
          </div>
        )}

        {/* PDF Preview Modal Overlay */}
        {previewFile && (() => {
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

                  {/* Right Side: Review Details (Read Only) */}
                  {(() => {
                    const fileLog = timelineLogs.find(log => log.attachment_id === previewFile.id);
                    if (!fileLog) return null;

                    return (
                      <div className="w-full md:w-96 bg-white p-8 flex flex-col overflow-y-auto border-t md:border-t-0 border-gray-100">
                        <div className="space-y-6">
                          <div>
                            <h4 className="font-bold text-gray-800 text-base mb-1">Attachment Review Details</h4>
                            <p className="text-gray-400 text-xs leading-relaxed">This attachment has been reviewed by the evaluator.</p>
                          </div>

                          <div className="h-[1px] bg-gray-100"></div>

                          {/* Review Action Display */}
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block font-bold text-gray-500">Review Status / Action</label>
                            <div className={`px-4 py-3 rounded-xl border text-sm font-semibold uppercase ${
                              fileLog.review_action === 'approved' || fileLog.action === 'approved'
                                ? 'bg-green-50 border-green-200 text-green-700'
                                : 'bg-amber-50 border-amber-200 text-amber-700'
                            }`}>
                              {fileLog.review_action?.replace('-', ' ') || fileLog.action || 'Approved'}
                            </div>
                          </div>

                          {/* Comments Display */}
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block font-bold text-gray-500">Review Comments</label>
                            <div className="bg-gray-50 rounded-xl p-4 text-xs font-medium text-gray-600 border border-gray-100 italic leading-relaxed">
                              "{fileLog.comment || fileLog.description || 'No comments provided.'}"
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          );
        })()}

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

          if (decisionType === 'disapprove') {
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

                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setIsReturnModalOpen(false)}
                    className="flex-1 px-5 py-3 border border-gray-200 text-gray-500 hover:bg-gray-50 rounded-xl font-bold transition-all text-xs uppercase tracking-wider"
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
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
                activeTab === tab.name 
                  ? 'bg-white text-primary-green shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.name}
              <span className={`px-2 py-0.5 rounded-md text-[10px] ${
                activeTab === tab.name ? 'bg-primary-green text-white' : 'bg-gray-200 text-gray-500'
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
                    onClick={() => setSelectedDoc(doc)}
                    className="group transition-all duration-300 hover:bg-gray-50/50 cursor-pointer"
                  >
                    <td className="px-6 py-5">
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
                      <span className={`px-4 py-1.5 rounded-full text-[10px] font-bold shadow-sm inline-block min-w-[120px] transition-all uppercase text-white ${
                        (doc.status === 'APPROVED' || doc.status === 'TO FORWARD') ? 'bg-green-600' : 
                        doc.status === 'RETURNED' ? 'bg-amber-500' : 
                        'bg-blue-500'
                      }`}>
                        {doc.status}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right text-sm text-gray-500 font-medium">
                      {doc.lastAction}
                    </td>
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
    </div>
  );
};

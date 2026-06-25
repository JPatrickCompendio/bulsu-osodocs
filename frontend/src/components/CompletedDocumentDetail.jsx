import React from 'react';
import {
  ChevronLeft,
  ChevronDown,
  Building2,
  FileText,
  Clock,
  Calendar,
  Paperclip,
  CheckCircle,
  Eye,
  Download,
  X
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import SubmissionTimeline from './SubmissionTimeline';
import ReportPreviewModal from './ReportPreviewModal';

const getStoragePublicUrl = (fileUrl) => {
  let finalPath = fileUrl || '';
  if (finalPath.startsWith('documents/')) {
    finalPath = finalPath.replace('documents/', '');
  }
  const { data } = supabase.storage.from('documents').getPublicUrl(finalPath);
  return data?.publicUrl || '#';
};

const parseProofUrls = (remarks) => {
  const text = String(remarks || '');
  const urls = [];
  const proofLine = text.match(/Proof:\s*(https?:\/\/\S+)/gi);
  if (proofLine) {
    proofLine.forEach((line) => {
      const url = line.replace(/^Proof:\s*/i, '').trim();
      if (url) urls.push(url);
    });
  }
  return urls;
};

const normalizeStatus = (status) =>
  String(status || '')
    .toLowerCase()
    .replace(/[_-]/g, ' ')
    .trim();

const getStatusDisplayMeta = (status) => {
  const s = normalizeStatus(status);
  if (s.includes('disapproved') || s === 'rejected') {
    return { label: 'Disapproved', badgeClass: 'bg-red-600' };
  }
  return { label: 'Completed', badgeClass: 'bg-emerald-500' };
};

const formatSubmittedLabel = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  const timePart = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  if (isToday) return `Today, ${timePart}`;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

const isImageProof = (file) => {
  const name = String(file?.file_name || '').toLowerCase();
  const url = String(file?.file_url || '').toLowerCase();
  return (
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.png') ||
    name.endsWith('.webp') ||
    url.includes('accom-report') ||
    url.endsWith('.jpg') ||
    url.endsWith('.jpeg') ||
    url.endsWith('.png') ||
    url.endsWith('.webp')
  );
};

const CompletedDocumentDetail = ({ submissionId, onBack }) => {
  const [loading, setLoading] = React.useState(true);
  const [submission, setSubmission] = React.useState(null);
  const [timelineLogs, setTimelineLogs] = React.useState([]);
  const [accomplishmentReport, setAccomplishmentReport] = React.useState(null);
  const [accomplishmentImages, setAccomplishmentImages] = React.useState([]);
  const [externalProofs, setExternalProofs] = React.useState([]);
  const [isFilesOpen, setIsFilesOpen] = React.useState(true);
  const [previewUrl, setPreviewUrl] = React.useState(null);

  const [isReportOpen, setIsReportOpen] = React.useState(false);
  const [reportData, setReportData] = React.useState({ title: '', stats: [], headers: [], rows: [], secondHeaders: null, secondRows: null, secondTitle: '', filename: '' });

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

  const extractProofPath = (value) => {
    const match = String(value || '').match(/proof_path:\s*([^\s\n]+)/i);
    return match?.[1] || null;
  };

  const findDeliveryProofPath = () => {
    const candidates = [
      submission?.remarks,
      submission?.description,
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
      setPreviewUrl(externalProofs[0].url);
    } else if (proofPath) {
      const signedUrl = await resolveExternalProofUrl(proofPath);
      if (signedUrl) {
        setPreviewUrl(signedUrl);
      }
    }
  };

  React.useEffect(() => {
    const load = async () => {
      if (!submissionId) return;
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('submissions')
          .select(`
            *,
            users ( org_name, student_no, full_name ),
            documentType ( name ),
            school_years ( name ),
            submission_versions!submission_id (
              *,
              activity_proposal_details (*),
              submission_attachments (*)
            )
          `)
          .eq('id', submissionId)
          .single();

        if (error) throw error;
        setSubmission(data);

        const { data: accomReport, error: accomErr } = await supabase
          .from('activity_accomplishments')
          .select('id, submission_id, submitted_by, problems_encountered, submitted_at, created_at, updated_at')
          .eq('submission_id', submissionId)
          .maybeSingle();

        if (!accomErr) {
          setAccomplishmentReport(accomReport || null);
          if (accomReport) {
            const { data: files, error: listErr } = await supabase.storage
              .from('documents')
              .list(`accom-report/${submissionId}`);

            if (!listErr) {
              const imageFiles = (files || []).filter((file) => /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(file.name));
              const imageUrls = await Promise.all(
                imageFiles.map(async (file) => {
                  const path = `accom-report/${submissionId}/${file.name}`;
                  try {
                    const { data } = await supabase.storage.from('documents').createSignedUrl(path, 3600);
                    if (data?.signedUrl) return { ...file, url: data.signedUrl, path };
                  } catch (error) {
                    console.warn('Signed URL unavailable for accomplishment image:', error);
                  }
                  return { ...file, url: getStoragePublicUrl(path), path };
                })
              );
              setAccomplishmentImages(imageUrls.filter(Boolean));
            }
          } else {
            setAccomplishmentImages([]);
          }
        } else {
          console.error('Error fetching accomplishment report:', accomErr);
        }

        // Fetch External Proofs
        try {
          const { data: extFiles, error: extListErr } = await supabase.storage
            .from('documents')
            .list(`external-proof/${submissionId}`);

          if (!extListErr) {
            const proofFiles = (extFiles || []).filter((file) => /\.(jpg|jpeg|png|gif|webp|bmp|pdf)$/i.test(file.name));
            const proofUrls = await Promise.all(
              proofFiles.map(async (file) => {
                const path = `external-proof/${submissionId}/${file.name}`;
                try {
                  const { data } = await supabase.storage.from('documents').createSignedUrl(path, 3600);
                  if (data?.signedUrl) return { ...file, url: data.signedUrl, path };
                } catch (error) {
                  console.warn('Signed URL unavailable for external proof:', error);
                }
                return { ...file, url: getStoragePublicUrl(path), path };
              })
            );
            setExternalProofs(proofUrls.filter(Boolean));
          } else {
            setExternalProofs([]);
          }
        } catch (extErr) {
          console.error('Error fetching external proofs:', extErr);
          setExternalProofs([]);
        }

        const { data: logs, error: logsErr } = await supabase
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
            users ( full_name, role )
          `)
          .eq('submission_id', submissionId)
          .order('created_at', { ascending: false });

        if (!logsErr) setTimelineLogs(logs || []);
        else console.error('Error fetching timeline logs:', logsErr);
      } catch (err) {
        console.error('Error loading completed document:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [submissionId]);

  if (loading) {
    return (
      <div className="py-20 text-center text-gray-500 text-sm">Loading document details...</div>
    );
  }

  if (!submission) {
    return (
      <div className="py-20 text-center">
        <p className="text-gray-500 mb-4">Could not load this document.</p>
        <button type="button" onClick={onBack} className="text-primary-green font-semibold text-sm">
          Back to Completed
        </button>
      </div>
    );
  }

  const versions = Array.isArray(submission.submission_versions)
    ? submission.submission_versions
    : [submission.submission_versions].filter(Boolean);
  const currentVersion =
    versions.find((v) => v.id === submission.current_version_id) ||
    versions.sort((a, b) => (b?.version_number || 0) - (a?.version_number || 0))[0];
  const details = Array.isArray(currentVersion?.activity_proposal_details)
    ? currentVersion.activity_proposal_details[0]
    : currentVersion?.activity_proposal_details;
  const allAttachments = currentVersion?.submission_attachments || [];
  const docTypeName = submission.documentType?.name || 'Document';
  const isActivityProposal = docTypeName.toLowerCase().includes('activity proposal');
  const docTitle = details?.activity_title || docTypeName;
  const ref = `AP-2026-03-${String(submission.id).padStart(3, '0')}`;
  const orgName = details?.organization_name || submission.users?.org_name || '—';

  const proofFromRemarks = parseProofUrls(submission.remarks);
  const proofFromAttachments = allAttachments.filter(isImageProof);
  const proofImages = [
    ...accomplishmentImages.map((file, idx) => ({ id: `accom-${file.path || idx}`, file_url: file.url, file_name: file.name || `Accomplishment proof ${idx + 1}` })),
    ...proofFromRemarks.map((url, i) => ({ id: `remark-${i}`, file_url: url, file_name: `Proof ${i + 1}` })),
    ...proofFromAttachments
  ];
  const fileAttachments = allAttachments.filter((f) => !isImageProof(f));

  const targetDate = details?.target_date
    ? new Date(details.target_date).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      })
    : null;
  const targetTime = details?.target_time || '';
  const targetDateTime =
    targetDate && targetTime ? `${targetDate} | ${targetTime}` : targetDate || targetTime || '—';

  const statusMeta = getStatusDisplayMeta(submission.status);

  const handleGenerateReport = () => {
    const formatListValue = (val) => {
      if (!val) return '—';
      if (typeof val === 'string') {
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed)) {
            return parsed.map((item) => `• ${item}`).join('\n');
          }
        } catch (e) {}
        return val;
      }
      if (Array.isArray(val)) {
        return val.map((item) => `• ${item}`).join('\n');
      }
      return String(val);
    };

    const reportStats = [
      { label: 'Document Type', value: docTypeName },
      { label: 'School Year', value: submission.school_years?.name || 'N/A' },
      { label: 'Date Conducted', value: targetDate || 'N/A' },
      { label: 'Status', value: statusMeta.label }
    ];

    const tableHeaders = ['Field', 'Details'];
    const tableData = [
      ['Reference ID', ref],
      ['Document Title', docTitle],
      ['Organization', orgName],
      ['Document Type', docTypeName],
      ['Person In-Charge', details?.person_in_charge || '—'],
      ['Student ID No.', submission.users?.student_no || details?.student_id_number || '—'],
      ['Contact Number', details?.contact_number || '—'],
      ['Target Date & Time', targetDateTime],
      ['Duration', details?.duration || '—'],
      ['Students Involved', details?.number_of_students ? `${details.number_of_students} Students` : '—'],
      ['Nature of Activity', details?.nature_of_activity || '—'],
      ['Target Audience', 'BulSUans Only']
    ];

    if (isActivityProposal) {
      tableData.push(['Objectives', formatListValue(details?.objectives)]);
      
      let goalSatisfaction = '—';
      if (Array.isArray(details?.satisfy_goals) && details.satisfy_goals.length > 0) {
        goalSatisfaction = details.satisfy_goals.map((g) => `• ${g}`).join('\n');
      } else if (details?.satisfy_needs) {
        goalSatisfaction = formatListValue(details.satisfy_needs);
      }
      tableData.push(['Goal Satisfaction', goalSatisfaction]);
    }

    const attachmentsList = fileAttachments.length > 0
      ? fileAttachments.map(f => f.file_name).join('\n')
      : 'None';
    tableData.push(['Attached Files', attachmentsList]);

    if (accomplishmentReport) {
      tableData.push([
        'Accomplishment Problems',
        accomplishmentReport.problems_encountered || 'No problems encountered'
      ]);
    }

    const secondHeaders = ['Date & Time', 'Action By', 'Action & Comment'];
    const secondRows = (timelineLogs || []).map(log => {
      const date = new Date(log.created_at).toLocaleString();
      const actor = log.users ? `${log.users.full_name} (${log.users.role})` : 'System';
      const actionText = log.comment 
        ? `${log.description || log.action_type || ''}\nComment: ${log.comment}`
        : (log.description || log.action_type || 'Updated');
      return [date, actor, actionText];
    });

    setReportData({
      title: `${docTitle} - Detailed Document Report`,
      stats: reportStats,
      headers: tableHeaders,
      rows: tableData,
      secondHeaders: secondHeaders,
      secondRows: secondRows,
      secondTitle: 'Submission Lifecycle & Timeline Logs',
      filename: `Detailed_Document_Report_${submissionId}.pdf`
    });
    setIsReportOpen(true);
  };

  return (
    <div className="animate-in fade-in duration-500 max-w-5xl mx-auto pb-16">
      <div className="flex justify-between items-center mb-4">
        <button
          type="button"
          onClick={onBack}
          className="p-2 rounded-xl hover:bg-gray-100 text-gray-600 transition-colors"
          aria-label="Back to completed list"
        >
          <ChevronLeft size={22} />
        </button>
        <button
          type="button"
          onClick={handleGenerateReport}
          className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-gray-700 hover:border-primary-green rounded-xl transition-all font-semibold text-sm hover:text-primary-green hover:shadow-sm"
        >
          <FileText size={16} />
          <span>Generate Report</span>
        </button>
      </div>

      <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">{docTitle}</h1>
      <p className="text-[11px] font-mono uppercase tracking-widest text-gray-400 mt-1 mb-6">{ref}</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {[
          {
            label: 'Organization',
            value: orgName,
            icon: <Building2 size={18} className="text-gray-400" />,
            valueClass: 'text-gray-800'
          },
          {
            label: 'Type',
            value: docTypeName,
            icon: <FileText size={18} className="text-blue-500" />,
            valueClass: 'text-blue-600 font-semibold'
          },
          {
            label: 'Status',
            value: (
              <span
                className={`inline-block px-4 py-1 rounded-full text-[10px] font-bold uppercase text-white ${statusMeta.badgeClass}`}
              >
                {statusMeta.label}
              </span>
            ),
            icon: <Clock size={18} className="text-gray-400" />,
            valueClass: ''
          },
          {
            label: 'Submitted',
            value: formatSubmittedLabel(submission.created_at),
            icon: <Calendar size={18} className="text-gray-400" />,
            valueClass: 'text-gray-800'
          }
        ].map((card) => (
          <div
            key={card.label}
            className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-4 flex flex-col gap-2"
          >
            <div className="flex items-center gap-2">
              {card.icon}
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{card.label}</span>
            </div>
            <div className={`text-sm font-medium ${card.valueClass}`}>{card.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 md:p-10 space-y-8">
        {isActivityProposal && (
          <div>
            <h2 className="text-lg font-bold text-gray-800 mb-2">Activity Proposal Form</h2>
            <p className="text-center font-bold text-gray-800 text-base mb-6">
              Document Title: {docTitle}
            </p>

            <div className="space-y-2 text-sm text-gray-700">
              <p>
                <span className="font-bold">Person In-Charge:</span> {details?.person_in_charge || '—'}
              </p>
              <p>
                <span className="font-bold">Student ID No.:</span>{' '}
                {submission.users?.student_no || details?.student_id_number || '—'}
              </p>
              <p>
                <span className="font-bold">Contact Number:</span> {details?.contact_number || '—'}
              </p>
              <p>
                <span className="font-bold">Target Date and Time:</span> {targetDateTime}
              </p>
              <p>
                <span className="font-bold">Duration:</span> {details?.duration || '—'}
              </p>
              <p>
                <span className="font-bold">Number of Students Involved:</span>{' '}
                {details?.number_of_students ? `${details.number_of_students} Students` : '—'}
              </p>
              <p>
                <span className="font-bold">Nature of Activity:</span> {details?.nature_of_activity || '—'}
              </p>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <p className="font-bold text-sm mb-2">Objectives of the Activity:</p>
                {details?.objectives ? (
                  <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{details.objectives}</div>
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
              <p className="text-sm">
                <span className="font-bold">Target Audience / Participants:</span>{' '}
                <span className="font-normal">BulSUans Only</span>
              </p>
              <div>
                <p className="font-bold text-sm mb-2">
                  Describe how this activity will satisfy the needs of the organization and how it will help the
                  organization achieve its goals:
                </p>
                {Array.isArray(details?.satisfy_goals) && details.satisfy_goals.length > 0 ? (
                  <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-700">
                    {details.satisfy_goals.map((goal, idx) => (
                      <li key={idx}>{goal}</li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {details?.satisfy_needs ||
                      'The activity aims to connect students with experienced professionals and industry experts.'}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
          <button
            type="button"
            onClick={() => setIsFilesOpen(!isFilesOpen)}
            className="w-full bg-[#3d5c45] text-white px-6 py-4 flex items-center justify-between hover:brightness-110 transition-all"
          >
            <div className="flex items-center gap-3">
              <Paperclip size={18} />
              <span className="text-xs font-bold uppercase tracking-widest">Attached File</span>
            </div>
            <ChevronDown size={18} className={`transition-transform ${isFilesOpen ? 'rotate-180' : ''}`} />
          </button>
          {isFilesOpen && (
            <div className="p-4 space-y-2 bg-white">
              {fileAttachments.length > 0 ? (
                fileAttachments.map((file, idx) => {
                  const fileUrl = getStoragePublicUrl(file.file_url);
                  const fileName = file.file_name || 'Attached File';
                  const sizeLabel = file.file_size
                    ? `${(Number(file.file_size) / 1024).toFixed(2)} KB`
                    : '';
                  const timeLabel = file.created_at
                    ? new Date(file.created_at).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                      })
                    : '';
                  const meta = [sizeLabel, timeLabel].filter(Boolean).join(' | ');

                  return (
                    <div
                      key={file.id || idx}
                      className="bg-green-600 rounded-xl px-4 py-3 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <CheckCircle size={18} className="text-white shrink-0" />
                        <div className="min-w-0">
                          <p className="text-white font-semibold text-sm truncate">{fileName}</p>
                          {meta && <p className="text-green-100 text-[10px] uppercase">{meta}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setPreviewUrl(fileUrl)}
                          className="inline-flex items-center gap-1 bg-secondary-gold text-white px-4 py-2 rounded-lg text-xs font-bold hover:brightness-110"
                        >
                          <Eye size={12} />
                          View
                        </button>
                        <a
                          href={fileUrl}
                          download
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 bg-secondary-gold text-white px-4 py-2 rounded-lg text-xs font-bold hover:brightness-110"
                        >
                          <Download size={12} />
                          Download
                        </a>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-center py-6 text-sm text-gray-500 italic">No attached files.</p>
              )}
            </div>
          )}
        </div>

        {accomplishmentReport && (
          <div className="rounded-2xl border border-blue-100 bg-blue-50/80 p-5">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-2">Accomplishment Report</h3>
            <p className="text-xs uppercase tracking-widest text-blue-700">Submitted {formatSubmittedLabel(accomplishmentReport.submitted_at || accomplishmentReport.created_at)}</p>
            <p className="mt-3 text-sm text-blue-900 whitespace-pre-wrap">{accomplishmentReport.problems_encountered || 'No problems encountered were provided.'}</p>
          </div>
        )}



        <div>
          <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-4">
            Proof of Activity Implementation
          </h3>
          {proofImages.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {proofImages.map((file, idx) => {
                const fileUrl = file.file_url?.startsWith('http')
                  ? file.file_url
                  : getStoragePublicUrl(file.file_url);
                return (
                  <a
                    key={file.id || idx}
                    href={fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-all"
                  >
                    <img
                      src={fileUrl}
                      alt={file.file_name || `Proof ${idx + 1}`}
                      className="w-full h-36 object-cover bg-gray-100"
                    />
                  </a>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic py-4">No proof of activity images uploaded.</p>
          )}
        </div>

        <SubmissionTimeline
          timelineLogs={timelineLogs}
          submissionStatus={submission?.status}
          hasDeliveryProof={(externalProofs && externalProofs.length > 0) || !!proofStoragePath}
          onViewDeliveryProof={() => handleViewDeliveryProof(proofStoragePath)}
          className="bg-gray-50/80 rounded-3xl p-6 md:p-8 border border-gray-100"
          title="Submission Lifecycle & Timeline Logs"
          emptyMessage="No timeline logs recorded yet."
        />
      </div>

      {previewUrl && (
        <div
          className="fixed inset-0 bg-slate-900/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setPreviewUrl(null)}
        >
          <div className="bg-white rounded-3xl max-w-5xl w-full shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 bg-white shrink-0">
              <div>
                <h3 className="text-lg font-bold text-gray-800">Document Preview</h3>
                <p className="text-xs font-medium text-gray-500 mt-1">File Attachment Viewer</p>
              </div>
              <button
                onClick={() => setPreviewUrl(null)}
                className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 bg-gray-50/50 flex flex-col items-center justify-center overflow-auto h-full min-h-[500px]">
              <div className="w-full flex justify-center">
                {/\.(png|jpe?g|webp|gif|bmp|svg)(?:\?.*)?$/i.test(previewUrl) ? (
                  <img
                    src={previewUrl}
                    alt="Document Preview"
                    className="max-h-[70vh] rounded-xl shadow-md border border-gray-200 object-contain"
                  />
                ) : previewUrl?.toLowerCase().includes('.docx') ? (
                  <iframe src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(previewUrl)}`} title="Word Preview" className="w-full h-[70vh] rounded-xl shadow-sm border border-gray-200 bg-white" />
                ) : (
                  <iframe src={previewUrl} title="Preview" className="w-full h-[70vh] rounded-xl shadow-sm border border-gray-200 bg-white" />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <ReportPreviewModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        title={reportData.title}
        generatedBy={submission.users?.full_name || 'System User'}
        stats={reportData.stats}
        tableHeaders={reportData.headers}
        tableData={reportData.rows}
        secondTableHeaders={reportData.secondHeaders}
        secondTableData={reportData.secondRows}
        secondTableTitle={reportData.secondTitle}
        pdfFilename={reportData.filename}
        schoolYear={submission.school_years?.name || ''}
        proofImages={proofImages}
      />
    </div>
  );
};

export default CompletedDocumentDetail;

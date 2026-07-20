import React, { useState, useEffect } from 'react';
import { apiClient, apiUrl } from '../config/apiClient';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import ReportPreviewModal from '../components/ReportPreviewModal';
import {
  FileText, CheckCircle, Clock, AlertCircle, RefreshCcw,
  ChevronRight, BarChart2, Activity, UserCheck, Calendar, Bell, XCircle, Inbox,
} from 'lucide-react';


// ─── Shared helpers ───────────────────────────────────────────────────────────

const STAFF_ROLES = new Set(['admin', 'chairman', 'vice-chairman']);

const fetchAnnouncementsForUser = async (user) => {
  if (!user?.id || !user?.role) return [];
  try {
    const res = await apiClient.get(apiUrl('/api/notifications'), {
      params: {
        userId: user.id,
        role: user.role,
        orgName: user.org_name || '',
      },
    });
    if (res.data?.success) {
      return res.data.data
        .filter((n) => n.type === 'announcement' && n.source)
        .slice(0, 3)
        .map((n) => n.source);
    }
  } catch (err) {
    console.error('Failed to fetch announcements:', err);
  }
  return [];
};

const formatSubmissionTitle = (doc, activeSy) => {
  let docTitle = `Submission #${String(doc.id).substring(0, 6).toUpperCase()}`;
  const versions = doc.submission_versions;
  const docTypeName = doc.documentType?.name || 'Document';
  const isActivityProposal = docTypeName.toLowerCase() === 'activity proposal' || docTypeName.toLowerCase().includes('proposal');

  if (versions?.length > 0) {
    const latest = versions.reduce((max, v) => (v.version_number > max.version_number ? v : max), versions[0]);
    const details = Array.isArray(latest.activity_proposal_details)
      ? latest.activity_proposal_details[0]
      : latest.activity_proposal_details;

    if (isActivityProposal) {
      if (details?.activity_title) {
        docTitle = details.activity_title;
      } else {
        docTitle = `${docTypeName} #${String(doc.id).substring(0, 6).toUpperCase()}`;
      }
    } else {
      const orgName = details?.organization_name || doc.users?.org_name || '-';
      docTitle = `${orgName} ${docTypeName} ${activeSy ? activeSy.name : ''}`.toUpperCase().trim();
    }
  } else {
    if (isActivityProposal) {
      docTitle = `${docTypeName} #${String(doc.id).substring(0, 6).toUpperCase()}`;
    } else {
      const orgName = doc.users?.org_name || '-';
      docTitle = `${orgName} ${docTypeName} ${activeSy ? activeSy.name : ''}`.toUpperCase().trim();
    }
  }
  return docTitle;
};

const fetchChairmanDashboardFallback = async (user, role) => {
  const announcements = await fetchAnnouncementsForUser(user);

  const { data: activeSy } = await supabase
    .from('school_years')
    .select('*')
    .eq('is_active', true)
    .maybeSingle();

  const { data: pendingSubmissions } = await supabase
    .from('submissions')
    .select(`
      id, status, created_at,
      users (full_name, org_name),
      documentType (name),
      submission_versions!submission_id (version_number, activity_proposal_details (*, activity_schedules (*), activity_title))
    `)
    .eq('status', 'submitted')
    .order('created_at', { ascending: false })
    .limit(10);

  const { data: allSubmissions } = await supabase
    .from('submissions')
    .select('id, status')
    .neq('status', 'draft');

  const pendingCount = allSubmissions?.filter((s) => s.status === 'submitted').length || 0;
  const approvedCount = allSubmissions?.filter((s) =>
    ['dean approved', 'completed', 'waiting for accomplishment report'].includes(String(s.status || '').toLowerCase()),
  ).length || 0;
  const returnedCount = allSubmissions?.filter((s) => s.status === 'returned').length || 0;
  const completedCount = allSubmissions?.filter((s) => s.status === 'completed').length || 0;

  const formattedPending = (pendingSubmissions || []).map((doc) => ({
    id: doc.id,
    title: formatSubmissionTitle(doc),
    type: doc.documentType?.name || 'Unknown',
    orgName: doc.users?.org_name || 'N/A',
    submitter: doc.users?.full_name || 'Unknown',
    createdAt: doc.created_at,
  }));

  return {
    hero: { user: user || {}, activeSy: activeSy || null, role },
    statistics: { pendingCount, approvedCount, returnedCount, completedCount },
    pendingDocuments: formattedPending,
    announcements,
  };
};

const getStatusColor = (status) => {
  const s = (status || '').toLowerCase().trim();
  if (s.includes('to forward') || s.includes('hardcopy submission')) {
    return '#db2777';
  }
  if (s.includes('chairman') || s.includes('vice chairman') || s.includes('oso staff review') || s.includes('oso staff') || s.includes('pending')) {
    return '#c2bc13';
  }
  if (s.includes('sds coordinator review') || s.includes('sds review') || s.includes('sds') || s === 'oso approved') {
    return '#6366f1';
  }
  if (s.includes('dean review')) {
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
  return '#6b7280';
};

const getDocTypeColor = (type) => {
  const t = type ? type.toLowerCase() : '';
  if (t.includes('activity proposal')) return '#0369A1';
  if (t.includes('mid')) return '#15803D';
  if (t.includes('year-end') || t.includes('year end')) return '#9747FF';
  if (t.includes('renewal')) return '#BE185D';
  return '#6b7280';
};

const formatStatus = (s, viewerRole = 'org-president') => {
  if (!s) return 'Unknown';
  if (s === 'submitted') return 'OSO Staff Review';
  if (s === 'oso approved') return 'SDS coordinator review';
  if (s === 'sds approved' || s === 'chairman approved') return 'Chairman and vice chairman review';
  if (s === 'vice chairman approved' || s === 'external review' || s === 'main campus review') return 'Main Campus review';
  if (s === 'external approved') return 'Dean review';
  if (s === 'dean approved' || s === 'waiting for accomplishment report') return 'Approved';
  if (s === 'to forward') return 'To Forward';
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const formatBreakdownLabel = (status) => {
  if (status === 'to forward') return 'To Forward';
  if (status === 'submitted' || status === 'oso staff review') return 'OSO Staff Review';
  if (status === 'main campus review' || status === 'external review') return 'Main Campus Review';
  return status;
};

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
};

const LoadingSpinner = () => (
  <div className="flex h-[80vh] items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <div className="w-10 h-10 border-4 border-primary-green border-t-transparent rounded-full animate-spin"></div>
      <span className="text-primary-green font-bold tracking-[0.2em] text-xs uppercase animate-pulse">Loading Data...</span>
    </div>
  </div>
);

// ─── Admin Dashboard ──────────────────────────────────────────────────────────

const AdminDashboardView = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [activeSy, setActiveSy] = useState(null);

  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportData, setReportData] = useState({ title: '', stats: [], headers: [], rows: [], secondHeaders: null, secondRows: null, secondTitle: '', filename: '' });

  const handleGenerateProcessingReport = () => {
    const reportStats = [
      { label: 'Active Under Review', value: stats.statistics.activeReviewCount },
      { label: 'Eligible for Renewal', value: stats.statistics.eligibleForRenewalCount },
      { label: 'Current SY Docs', value: stats.statistics.currentSyCount },
      { label: 'All-Time Docs', value: stats.statistics.allTimeCount }
    ];

    const tableHeaders = ['Tracking No.', 'Document Title', 'Organization', 'Document Type', 'Status'];
    const tableData = (stats.activeDocuments || []).map(doc => {
      const docTitle = formatSubmissionTitle(doc, stats?.hero?.activeSy);
      return [
        doc.tracking_number || (doc.documentType?.name?.toLowerCase().includes('proposal') ? 'PENDING NO.' : 'DRAFT'),
        docTitle,
        doc.users?.org_name || 'N/A',
        doc.documentType?.name || 'Unknown',
        formatStatus(doc.status, 'admin').toUpperCase()
      ];
    });

    setReportData({
      title: 'In-Progress Documents Report',
      stats: reportStats,
      headers: tableHeaders,
      rows: tableData,
      secondHeaders: null,
      secondRows: null,
      secondTitle: '',
      filename: `In_Progress_Documents_Report_${new Date().toISOString().split('T')[0]}.pdf`
    });
    setIsReportOpen(true);
  };

  const handleGenerateErrorsRevisionsReport = () => {
    const reportStats = [
      { label: 'Revisions This Month', value: stats.revisionAnalysis.revisionsThisMonth }
    ];

    const tableHeaders = ['Error Rank', 'Reason / Description', 'Count / Frequency'];
    const tableData = (stats.commonErrors || []).map((err, i) => [
      `#${i + 1}`,
      err.reason,
      String(err.count)
    ]);

    const secondTableHeaders = ['Document Type', 'Average Revisions'];
    const secondTableData = Object.entries(stats.revisionAnalysis?.avgRevisionsPerType || {}).map(([type, avg]) => [
      type,
      `${avg} avg`
    ]);

    setReportData({
      title: 'Common Submission Errors and Revision Analysis Report',
      stats: reportStats,
      headers: tableHeaders,
      rows: tableData,
      secondHeaders: secondTableHeaders,
      secondRows: secondTableData,
      secondTitle: 'Average Revisions Per Document Type',
      filename: `Submission_Errors_And_Revisions_Report_${new Date().toISOString().split('T')[0]}.pdf`
    });
    setIsReportOpen(true);
  };


  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const res = await apiClient.get(apiUrl('/api/admin/dashboard'));
        if (res.data?.success) setStats(res.data.data);

        // Fetch active school year
        const { data: sy } = await supabase
          .from('school_years')
          .select('*')
          .eq('is_active', true)
          .maybeSingle();
        setActiveSy(sy);
      } catch (err) {
        console.error('Failed to load admin dashboard stats:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) return <LoadingSpinner />;
  if (!stats) return <div className="p-8">Failed to load dashboard.</div>;

  return (
    <div className="pb-32">
      <div className="w-full space-y-8">
        <section className="relative rounded-2xl overflow-hidden mb-8 shadow-lg bg-black p-8 md:p-10 border border-gray-800">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover mix-blend-screen opacity-50"
          >
            <source src="/loginbgvid.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>

          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10">
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-2 drop-shadow-md uppercase">Admin Dashboard</h1>
              <p className="text-gray-200 font-bold text-lg drop-shadow-sm">System Overview and Analytics</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleGenerateProcessingReport}
                className="flex items-center gap-2 px-5 py-3 bg-white text-gray-800 hover:bg-gray-100 rounded-xl transition-all font-bold text-sm shadow-md"
                title="Generate report of all documents that are currently processing"
              >
                <FileText size={16} />
                <span>Processing Docs Report</span>
              </button>
              <button
                onClick={handleGenerateErrorsRevisionsReport}
                className="flex items-center gap-2 px-5 py-3 bg-white text-gray-800 hover:bg-gray-100 rounded-xl transition-all font-bold text-sm shadow-md"
                title="Generate report for common submission errors and revision analysis"
              >
                <FileText size={16} />
                <span>Errors & Revisions Report</span>
              </button>
            </div>
          </div>


          <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-2xl p-6 shadow-md flex items-center gap-4 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-pink-50 text-pink-500 flex items-center justify-center shrink-0">
                <UserCheck size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Eligible for Renewal</p>
                <p className="text-2xl font-black text-gray-800">{stats.statistics.eligibleForRenewalCount}</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-md flex items-center gap-4 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
                <Activity size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Active Under Review</p>
                <p className="text-2xl font-black text-gray-800">{stats.statistics.activeReviewCount}</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-md flex items-center gap-4 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-green-50 text-green-500 flex items-center justify-center shrink-0">
                <FileText size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Current SY Docs</p>
                <p className="text-2xl font-black text-gray-800">{stats.statistics.currentSyCount}</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-md flex items-center gap-4 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-500 flex items-center justify-center shrink-0">
                <BarChart2 size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">All-Time Docs</p>
                <p className="text-2xl font-black text-gray-800">{stats.statistics.allTimeCount}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-50">
            <h2 className="text-lg font-black text-gray-800 uppercase">Active Documents Overview</h2>
            <p className="text-xs font-bold text-gray-400">All documents currently under review</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-wider">Document Title</th>
                  <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-wider">Organization</th>
                  <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {stats.activeDocuments.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-gray-400 font-bold text-sm">No active documents found.</td>
                  </tr>
                ) : (
                  stats.activeDocuments.map((doc) => {
                    const statusName = formatStatus(doc.status, 'admin');
                    const docTitle = formatSubmissionTitle(doc, stats?.hero?.activeSy);
                    const typeColor = getDocTypeColor(doc.documentType?.name);
                    return (
                      <tr key={doc.id} className="hover:bg-gray-50/50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="font-bold text-sm text-gray-800 line-clamp-2 max-w-xs" title={docTitle}>{docTitle}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-sm text-gray-600 line-clamp-2 max-w-[150px]" title={doc.users?.org_name}>{doc.users?.org_name || 'N/A'}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 text-[10px] font-black uppercase rounded-full border" style={{ color: typeColor, borderColor: typeColor, backgroundColor: `${typeColor}10` }}>
                            {doc.documentType?.name || 'Unknown'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-block text-center w-[220px] truncate px-3 py-1 text-[10px] font-black uppercase rounded-full" style={{ backgroundColor: getStatusColor(statusName), color: '#fff' }} title={statusName}>
                            {statusName}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => navigate(`/my-documents?submissionId=${doc.id}`)} className="p-2 text-gray-400 hover:text-primary-green transition-colors rounded-lg hover:bg-green-50">
                            <ChevronRight size={20} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col">
            <div className="p-6 border-b border-gray-50">
              <h2 className="text-lg font-black text-gray-800 uppercase">Document Status Breakdown</h2>
              <p className="text-xs font-bold text-gray-400">Distribution across review stages</p>
            </div>
            <div className="p-6 flex-1 space-y-4">
              {Object.entries(
                  Object.entries(stats.statusBreakdown || {}).reduce((acc, [status, count]) => {
                    const label = formatBreakdownLabel(status).toLowerCase();
                    acc[label] = (acc[label] || 0) + count;
                    return acc;
                  }, {})
                )
                .filter(([status]) => !status.toLowerCase().includes('chairman') && !status.toLowerCase().includes('vice chairman'))
                .map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getStatusColor(status) }} />
                      <span className="text-sm font-bold text-gray-600 capitalize">{status}</span>
                    </div>
                    <span className="font-black text-gray-800 bg-gray-50 px-3 py-1 rounded-lg border border-gray-100">{count}</span>
                  </div>
                ))}
            </div>
          </section>

          <div className="space-y-8">
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100">
              <div className="p-6 border-b border-gray-50">
                <h2 className="text-lg font-black text-gray-800 uppercase">Common Submission Errors</h2>
                <p className="text-xs font-bold text-gray-400">Most frequent reasons for document return</p>
              </div>
              <div className="p-6">
                {stats.commonErrors.length === 0 ? (
                  <p className="text-sm text-gray-400 font-bold text-center py-4">No errors recorded yet.</p>
                ) : (
                  <div className="space-y-4">
                    {stats.commonErrors.map((err, i) => (
                      <div key={i} className="flex items-start gap-4">
                        <div className="w-8 h-8 rounded bg-red-50 text-red-500 font-black flex items-center justify-center shrink-0">{i + 1}</div>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-gray-700">{err.reason}</p>
                          <div className="w-full bg-gray-100 h-1.5 rounded-full mt-2 overflow-hidden">
                            <div className="bg-red-400 h-full rounded-full" style={{ width: `${Math.min((err.count / (stats.commonErrors[0]?.count || 1)) * 100, 100)}%` }} />
                          </div>
                        </div>
                        <div className="font-black text-red-500 text-sm w-8 text-right">{err.count}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="bg-white rounded-2xl shadow-sm border border-gray-100">
              <div className="p-6 border-b border-gray-50">
                <h2 className="text-lg font-black text-gray-800 uppercase">Revision Analysis</h2>
                <p className="text-xs font-bold text-gray-400">Document revision metrics</p>
              </div>
              <div className="p-6">
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 mb-6 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-blue-400 uppercase">Revisions This Month</p>
                    <p className="text-2xl font-black text-blue-600">{stats.revisionAnalysis.revisionsThisMonth}</p>
                  </div>
                  <RefreshCcw size={32} className="text-blue-200" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase mb-4">Average Revisions Per Document Type</p>
                  <div className="space-y-3">
                    {Object.entries(stats.revisionAnalysis.avgRevisionsPerType).length === 0 ? (
                      <p className="text-sm text-gray-400 font-bold">No revision data available.</p>
                    ) : (
                      Object.entries(stats.revisionAnalysis.avgRevisionsPerType).map(([type, avg]) => (
                        <div key={type} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                          <span className="text-sm font-bold text-gray-600">{type}</span>
                          <span className="font-black text-primary-green">{avg} avg</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      <ReportPreviewModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        title={reportData.title}
        generatedBy={user?.full_name || 'System User'}
        stats={reportData.stats}
        tableHeaders={reportData.headers}
        tableData={reportData.rows}
        secondTableHeaders={reportData.secondHeaders}
        secondTableData={reportData.secondRows}
        secondTableTitle={reportData.secondTitle}
        pdfFilename={reportData.filename}
        schoolYear={activeSy?.name || ''}
      />
    </div>
  );
};


// ─── Chairman / Vice Chairman Dashboard ───────────────────────────────────────

const ChairmanDashboardView = ({ role }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [activeSy, setActiveSy] = useState(null);

  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportData, setReportData] = useState({ title: '', stats: [], headers: [], rows: [], secondHeaders: null, secondRows: null, secondTitle: '', filename: '' });

  const handleGenerateProcessingReport = () => {
    const reportStats = [
      { label: 'Active Under Review', value: stats.statistics?.activeReviewCount || 0 },
      { label: 'Eligible for Renewal', value: stats.statistics?.eligibleForRenewalCount || 0 },
      { label: 'Current SY Docs', value: stats.statistics?.currentSyCount || 0 },
      { label: 'All-Time Docs', value: stats.statistics?.allTimeCount || 0 }
    ];

    const tableHeaders = ['Tracking No.', 'Document Title', 'Organization', 'Document Type', 'Status'];
    const tableData = (stats.activeDocuments || []).map(doc => {
      const docTitle = formatSubmissionTitle(doc, stats?.hero?.activeSy);
      return [
        doc.tracking_number || (doc.documentType?.name?.toLowerCase().includes('proposal') ? 'PENDING NO.' : 'DRAFT'),
        docTitle,
        doc.users?.org_name || 'N/A',
        doc.documentType?.name || 'Unknown',
        formatStatus(doc.status, 'admin').toUpperCase()
      ];
    });

    const roleLabel = role === 'vice-chairman' ? 'Vice Chairman' : 'Chairman';
    setReportData({
      title: 'In-Progress Documents Report',
      stats: reportStats,
      headers: tableHeaders,
      rows: tableData,
      secondHeaders: null,
      secondRows: null,
      secondTitle: '',
      filename: `In_Progress_Documents_Report_${new Date().toISOString().split('T')[0]}.pdf`
    });
    setIsReportOpen(true);
  };

  const handleGenerateErrorsRevisionsReport = () => {
    const reportStats = [
      { label: 'Revisions This Month', value: stats.revisionAnalysis?.revisionsThisMonth || 0 }
    ];

    const tableHeaders = ['Error Rank', 'Reason / Description', 'Count / Frequency'];
    const tableData = (stats.commonErrors || []).map((err, i) => [
      `#${i + 1}`,
      err.reason,
      String(err.count)
    ]);

    const secondTableHeaders = ['Document Type', 'Average Revisions'];
    const secondTableData = Object.entries(stats.revisionAnalysis?.avgRevisionsPerType || {}).map(([type, avg]) => [
      type,
      `${avg} avg`
    ]);

    const roleLabel = role === 'vice-chairman' ? 'Vice Chairman' : 'Chairman';
    setReportData({
      title: `${roleLabel} Dashboard - Common Errors & Revision Analysis Report`,
      stats: reportStats,
      headers: tableHeaders,
      rows: tableData,
      secondHeaders: secondTableHeaders,
      secondRows: secondTableData,
      secondTitle: 'Average Revisions Per Document Type',
      filename: `${roleLabel}_Errors_And_Revisions_Report_${new Date().toISOString().split('T')[0]}.pdf`
    });
    setIsReportOpen(true);
  };


  useEffect(() => {
    if (!user?.id) return;

    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        let dashboardStats = null;
        try {
          const res = await apiClient.get(apiUrl('/api/admin/dashboard'));
          if (res.data?.success) dashboardStats = res.data.data;
        } catch (apiErr) {
          console.error('Failed to load admin stats for chairman dashboard:', apiErr);
        }

        const announcements = await fetchAnnouncementsForUser(user);

        // Fetch active school year
        const { data: sy } = await supabase
          .from('school_years')
          .select('*')
          .eq('is_active', true)
          .maybeSingle();
        setActiveSy(sy);

        if (dashboardStats) {
          setData({ stats: dashboardStats, announcements });
        }
      } catch (err) {
        console.error('Failed to load chairman dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, [user?.id, role]);

  if (loading) return <LoadingSpinner />;
  if (!data || !data.stats) return <div className="p-8">Failed to load dashboard.</div>;

  const { stats, announcements } = data;
  const roleLabel = role === 'vice-chairman' ? 'Vice Chairman' : 'Chairman';

  return (
    <div className="pb-32">
      <div className="w-full space-y-8">
        <section className="relative rounded-2xl overflow-hidden mb-8 shadow-lg bg-black p-8 md:p-10 border border-gray-800">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover mix-blend-screen opacity-50"
          >
            <source src="/loginbgvid.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>

          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10">
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-2 drop-shadow-md uppercase">{roleLabel} Dashboard</h1>
              <p className="text-gray-200 font-bold text-lg drop-shadow-sm">System Overview and Analytics</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleGenerateProcessingReport}
                className="flex items-center gap-2 px-5 py-3 bg-white text-gray-800 hover:bg-gray-100 rounded-xl transition-all font-bold text-sm shadow-md"
                title="Generate report of all documents that are currently processing"
              >
                <FileText size={16} />
                <span>Processing Docs Report</span>
              </button>
              <button
                onClick={handleGenerateErrorsRevisionsReport}
                className="flex items-center gap-2 px-5 py-3 bg-white text-gray-800 hover:bg-gray-100 rounded-xl transition-all font-bold text-sm shadow-md"
                title="Generate report for common submission errors and revision analysis"
              >
                <FileText size={16} />
                <span>Errors & Revisions Report</span>
              </button>
            </div>
          </div>


          <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100 flex items-center gap-4 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/user-management')}>
              <div className="w-12 h-12 rounded-xl bg-pink-50 text-pink-500 flex items-center justify-center shrink-0">
                <UserCheck size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Eligible for Renewal</p>
                <p className="text-2xl font-black text-gray-800">{stats.statistics?.eligibleForRenewalCount || 0}</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100 flex items-center gap-4 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/inbox')}>
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
                <Activity size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Active Under Review</p>
                <p className="text-2xl font-black text-gray-800">{stats.statistics?.activeReviewCount || 0}</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100 flex items-center gap-4 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-green-50 text-green-500 flex items-center justify-center shrink-0">
                <FileText size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Current SY Docs</p>
                <p className="text-2xl font-black text-gray-800">{stats.statistics?.currentSyCount || 0}</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100 flex items-center gap-4 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-500 flex items-center justify-center shrink-0">
                <BarChart2 size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">All-Time Docs</p>
                <p className="text-2xl font-black text-gray-800">{stats.statistics?.allTimeCount || 0}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-50 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-black text-gray-800 uppercase">Active Documents Overview</h2>
              <p className="text-xs font-bold text-gray-400">All documents currently under review</p>
            </div>
            <button onClick={() => navigate('/inbox')} className="px-4 py-2 bg-primary-green text-white text-xs font-bold rounded-xl hover:shadow-md transition-all">
              Go to Inbox
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-wider">Document Title</th>
                  <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-wider">Organization</th>
                  <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(stats.activeDocuments || []).length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-gray-400 font-bold text-sm">No active documents found.</td>
                  </tr>
                ) : (
                  stats.activeDocuments.map((doc) => {
                    const statusName = formatStatus(doc.status, 'admin');
                    const docTitle = formatSubmissionTitle(doc, stats?.hero?.activeSy);
                    const typeColor = getDocTypeColor(doc.documentType?.name);
                    return (
                      <tr key={doc.id} className="hover:bg-gray-50/50 transition-colors group cursor-pointer" onClick={() => navigate(`/inbox`)}>
                        <td className="px-6 py-4">
                          <div className="font-bold text-sm text-gray-800 line-clamp-2 max-w-xs" title={docTitle}>{docTitle}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-sm text-gray-600 line-clamp-2 max-w-[150px]" title={doc.users?.org_name}>{doc.users?.org_name || 'N/A'}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 text-[10px] font-black uppercase rounded-full border" style={{ color: typeColor, borderColor: typeColor, backgroundColor: `${typeColor}10` }}>
                            {doc.documentType?.name || 'Unknown'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-block text-center w-[220px] truncate px-3 py-1 text-[10px] font-black uppercase rounded-full" style={{ backgroundColor: getStatusColor(statusName), color: '#fff' }} title={statusName}>
                            {statusName}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button className="p-2 text-gray-400 hover:text-primary-green transition-colors rounded-lg hover:bg-green-50">
                            <ChevronRight size={20} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="space-y-8 lg:col-span-2">
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col">
              <div className="p-6 border-b border-gray-50">
                <h2 className="text-lg font-black text-gray-800 uppercase">Document Status Breakdown</h2>
                <p className="text-xs font-bold text-gray-400">Distribution across review stages</p>
              </div>
              <div className="p-6 flex-1 space-y-4">
                {Object.entries(
                    Object.entries(stats.statusBreakdown || {}).reduce((acc, [status, count]) => {
                      const label = formatBreakdownLabel(status).toLowerCase();
                      acc[label] = (acc[label] || 0) + count;
                      return acc;
                    }, {})
                  )
                  .filter(([status]) => {
                    const s = status.toLowerCase();
                    return !s.includes('chairman review');
                  })
                  .map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getStatusColor(status) }} />
                        <span className="text-sm font-bold text-gray-600 capitalize">{status}</span>
                      </div>
                      <span className="font-black text-gray-800 bg-gray-50 px-3 py-1 rounded-lg border border-gray-100">{count}</span>
                    </div>
                  ))}
              </div>
            </section>

            <section className="bg-white rounded-2xl shadow-sm border border-gray-100">
              <div className="p-6 border-b border-gray-50">
                <h2 className="text-lg font-black text-gray-800 uppercase">Common Submission Errors</h2>
                <p className="text-xs font-bold text-gray-400">Most frequent reasons for document return</p>
              </div>
              <div className="p-6">
                {(stats.commonErrors || []).length === 0 ? (
                  <p className="text-sm text-gray-400 font-bold text-center py-4">No errors recorded yet.</p>
                ) : (
                  <div className="space-y-4">
                    {stats.commonErrors.map((err, i) => (
                      <div key={i} className="flex items-start gap-4">
                        <div className="w-8 h-8 rounded bg-red-50 text-red-500 font-black flex items-center justify-center shrink-0">{i + 1}</div>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-gray-700">{err.reason}</p>
                          <div className="w-full bg-gray-100 h-1.5 rounded-full mt-2 overflow-hidden">
                            <div className="bg-red-400 h-full rounded-full" style={{ width: `${Math.min((err.count / (stats.commonErrors[0]?.count || 1)) * 100, 100)}%` }} />
                          </div>
                        </div>
                        <div className="font-black text-red-500 text-sm w-8 text-right">{err.count}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>

          <div className="space-y-8">
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col">
              <div className="p-6 border-b border-gray-50 flex items-center gap-2">
                <Bell size={20} className="text-gray-400" />
                <h2 className="text-lg font-black text-gray-800 uppercase tracking-tight">Announcements</h2>
              </div>
              <div className="p-0 max-h-[400px] overflow-y-auto">
                {(announcements || []).length === 0 ? (
                  <div className="p-6 text-center text-gray-400 font-bold text-sm">No announcements at this time.</div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {(announcements || []).map((ann) => (
                      <div key={ann.id} className="p-6 hover:bg-gray-50 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-bold text-gray-800 text-sm">{ann.title}</h3>
                          <span className="text-[10px] font-bold text-gray-400 whitespace-nowrap bg-gray-100 px-2 py-1 rounded ml-2 shrink-0">{formatDate(ann.created_at)}</span>
                        </div>
                        <p className="text-xs font-medium text-gray-500 line-clamp-3">{ann.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="bg-white rounded-2xl shadow-sm border border-gray-100">
              <div className="p-6 border-b border-gray-50">
                <h2 className="text-lg font-black text-gray-800 uppercase">Revision Analysis</h2>
                <p className="text-xs font-bold text-gray-400">Document revision metrics</p>
              </div>
              <div className="p-6">
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 mb-6 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-blue-400 uppercase">Revisions This Month</p>
                    <p className="text-2xl font-black text-blue-600">{stats.revisionAnalysis?.revisionsThisMonth || 0}</p>
                  </div>
                  <RefreshCcw size={32} className="text-blue-200" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase mb-4">Average Revisions Per Document Type</p>
                  <div className="space-y-3">
                    {!stats.revisionAnalysis?.avgRevisionsPerType || Object.entries(stats.revisionAnalysis.avgRevisionsPerType).length === 0 ? (
                      <p className="text-sm text-gray-400 font-bold">No revision data available.</p>
                    ) : (
                      Object.entries(stats.revisionAnalysis.avgRevisionsPerType).map(([type, avg]) => (
                        <div key={type} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                          <span className="text-sm font-bold text-gray-600">{type}</span>
                          <span className="font-black text-primary-green">{avg} avg</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      <ReportPreviewModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        title={reportData.title}
        generatedBy={user?.full_name || 'System User'}
        stats={reportData.stats}
        tableHeaders={reportData.headers}
        tableData={reportData.rows}
        secondTableHeaders={reportData.secondHeaders}
        secondTableData={reportData.secondRows}
        secondTableTitle={reportData.secondTitle}
        pdfFilename={reportData.filename}
        schoolYear={activeSy?.name || ''}
      />
    </div>
  );
};


// ─── Org President Dashboard ──────────────────────────────────────────────────

const OrgDashboardView = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [showDates, setShowDates] = useState(false);

  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportData, setReportData] = useState({ title: '', stats: [], headers: [], rows: [], secondHeaders: null, secondRows: null, secondTitle: '', filename: '' });

  const handleGenerateProcessingReport = () => {
    const reportStats = [
      { label: 'Pending Review', value: data.statistics.pendingCount },
      { label: 'Approved Documents', value: data.statistics.approvedCount },
      { label: 'Returned Documents', value: data.statistics.returnedCount },
      { label: 'Completed Documents', value: data.statistics.completedCount }
    ];

    const tableHeaders = ['Document Title', 'Document Type', 'Latest Activity Log', 'Status'];
    const tableData = data.activeDocuments.map(doc => [
      doc.title || 'Untitled Document',
      doc.type || '—',
      doc.latestLog
        ? `${doc.latestLog.description || doc.latestLog.comment || 'Status updated'} (${new Date(doc.latestLog.created_at).toLocaleDateString()})`
        : 'No logs yet',
      formatStatus(doc.status, 'org-president').toUpperCase()
    ]);

    setReportData({
      title: 'In-Progress Documents Report',
      stats: reportStats,
      headers: tableHeaders,
      rows: tableData,
      secondHeaders: null,
      secondRows: null,
      secondTitle: '',
      filename: `In_Progress_Documents_Report_${new Date().toISOString().split('T')[0]}.pdf`
    });
    setIsReportOpen(true);
  };

  const handleGenerateErrorsRevisionsReport = () => {
    const reportStats = [
      { label: 'Revisions This Month', value: data.revisionAnalysis?.revisionsThisMonth || 0 }
    ];

    const tableHeaders = ['Error Rank', 'Reason / Description', 'Count / Frequency'];
    const tableData = (data.commonErrors || []).map((err, i) => [
      `#${i + 1}`,
      err.reason,
      String(err.count)
    ]);

    const secondTableHeaders = ['Document Type', 'Average Revisions'];
    const secondTableData = Object.entries(data.revisionAnalysis?.avgRevisionsPerType || {}).map(([type, avg]) => [
      type,
      `${avg} avg`
    ]);

    setReportData({
      title: 'Common Submission Errors and Revision Analysis Report',
      stats: reportStats,
      headers: tableHeaders,
      rows: tableData,
      secondHeaders: secondTableHeaders,
      secondRows: secondTableData,
      secondTitle: 'Average Revisions Per Document Type',
      filename: `Org_Errors_And_Revisions_Report_${new Date().toISOString().split('T')[0]}.pdf`
    });
    setIsReportOpen(true);
  };


  useEffect(() => {
    if (!user?.id) return;

    const fetchStats = async () => {
      try {
        setLoading(true);
        const res = await apiClient.get(apiUrl('/api/org/dashboard'), { params: { userId: user.id } });
        if (res.data?.success) {
          let dashboardData = res.data.data;
          const announcements = await fetchAnnouncementsForUser(user);
          dashboardData = { ...dashboardData, announcements };
          setData(dashboardData);
        }
      } catch (err) {
        console.error('Failed to load org dashboard stats:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [user?.id]);

  if (loading) return <LoadingSpinner />;
  if (!data) return <div className="p-8">Failed to load dashboard.</div>;

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="pb-32">
      <div className="w-full space-y-8">
        <section className="relative rounded-2xl overflow-hidden mb-8 shadow-lg bg-black p-8 md:p-10 border border-gray-800">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover mix-blend-screen opacity-50"
          >
            <source src="/loginbgvid.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>

          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10">
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-2 drop-shadow-md uppercase">ORG PRES DASHBOARD</h1>
              <p className="text-gray-200 font-bold text-lg drop-shadow-sm">System Overview and Analytics</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleGenerateProcessingReport}
                className="flex items-center gap-2 px-5 py-3 bg-white text-gray-800 hover:bg-gray-100 rounded-xl transition-all font-bold text-sm shadow-md"
                title="Generate report of all documents that are currently processing"
              >
                <FileText size={16} />
                <span>Processing Docs Report</span>
              </button>
            </div>
          </div>

          <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: 'Pending Review', value: data.statistics.pendingCount, icon: Clock, bg: 'bg-yellow-50', color: 'text-yellow-500' },
              { label: 'Approved', value: data.statistics.approvedCount, icon: CheckCircle, bg: 'bg-green-50', color: 'text-green-500' },
              { label: 'Returned', value: data.statistics.returnedCount, icon: RefreshCcw, bg: 'bg-blue-50', color: 'text-blue-500' },
              { label: 'Completed', value: data.statistics.completedCount, icon: CheckCircle, bg: 'bg-purple-50', color: 'text-purple-500' },
            ].map(({ label, value, icon: Icon, bg, color }) => (
              <div key={label} className="bg-white rounded-2xl p-6 shadow-md flex items-center gap-4 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/my-documents')}>
                <div className={`w-12 h-12 rounded-xl ${bg} ${color} flex items-center justify-center shrink-0`}>
                  <Icon size={24} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
                  <p className="text-2xl font-black text-gray-800">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <section className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-50">
              <h2 className="text-lg font-black text-gray-800 uppercase tracking-tight">Documents Under Review</h2>
              <p className="text-xs font-bold text-gray-400 mt-1">Track your active submissions</p>
            </div>
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50">
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-wider">Document Info</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-wider">Latest Activity Log</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-wider text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.activeDocuments.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center justify-center text-gray-300">
                          <CheckCircle size={40} className="mb-3 text-gray-200" />
                          <p className="font-bold text-gray-400">All caught up!</p>
                          <p className="text-xs font-semibold">No documents currently under review.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    data.activeDocuments.map((doc) => {
                      const statusName = formatStatus(doc.status, 'org-president');
                      const typeColor = getDocTypeColor(doc.type);
                      const isActivityProposal = doc.type.toLowerCase() === 'activity proposal' || doc.type.toLowerCase().includes('proposal');
                      const orgNameStr = data.hero?.user?.org_name || '-';
                      const docTitle = isActivityProposal ? doc.title : `${orgNameStr} ${doc.type} ${data.hero?.activeSy?.name || ''}`.toUpperCase().trim();

                      return (
                        <tr key={doc.id} className="hover:bg-gray-50/50 transition-colors cursor-pointer" onClick={() => navigate(`/my-documents?submissionId=${doc.id}`)}>
                          <td className="px-6 py-4">
                            <p className="font-bold text-sm text-gray-800 line-clamp-1" title={docTitle}>{docTitle}</p>
                            <span className="inline-block mt-1 px-2 py-0.5 text-[9px] font-black uppercase rounded border" style={{ color: typeColor, borderColor: typeColor, backgroundColor: `${typeColor}10` }}>
                              {doc.type}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {doc.latestLog ? (
                              <div>
                                <p className="text-xs font-semibold text-gray-600 line-clamp-2">{doc.latestLog.description || doc.latestLog.comment || 'Status updated'}</p>
                                <p className="text-[10px] text-gray-400 font-bold mt-1">{new Date(doc.latestLog.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                              </div>
                            ) : (
                              <p className="text-xs italic text-gray-400">No logs yet</p>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="inline-block text-center w-[220px] truncate px-3 py-1 text-[10px] font-black uppercase rounded-full" style={{ backgroundColor: getStatusColor(statusName), color: '#fff' }} title={statusName}>
                              {statusName}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <div className="space-y-8">
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100">
              <div className="p-6 border-b border-gray-50">
                <h2 className="text-lg font-black text-gray-800 uppercase tracking-tight">Organization Renewal</h2>
                <p className="text-xs font-bold text-gray-400 mt-1">Eligibility status for next semester</p>
              </div>
              <div className="p-6">
                {data.renewal.isEligible ? (
                  <div className="bg-green-50 border border-green-100 rounded-xl p-5 flex flex-col items-center justify-center text-center">
                    <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white mb-3 shadow-sm shadow-green-200">
                      <CheckCircle size={24} />
                    </div>
                    <h3 className="font-black text-green-800 text-lg">Eligible for Renewal</h3>
                    <p className="text-xs font-bold text-green-600 mt-1">All required reports completed!</p>
                  </div>
                ) : (
                  <div className="bg-orange-50 border border-orange-100 rounded-xl p-5 flex flex-col items-center justify-center text-center">
                    <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center text-white mb-3 shadow-sm shadow-orange-200">
                      <AlertCircle size={24} />
                    </div>
                    <h3 className="font-black text-orange-800 text-lg">Action Required</h3>
                    <p className="text-xs font-bold text-orange-600 mt-1">Complete mandatory reports to qualify</p>
                    <div className="w-full mt-5 space-y-2 text-left">
                      <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-orange-100">
                        <span className="text-xs font-bold text-gray-600 uppercase">Mid-Year Report</span>
                        {data.renewal.hasMidYear ? <CheckCircle size={16} className="text-green-500" /> : <XCircle size={16} className="text-red-400" />}
                      </div>
                      <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-orange-100">
                        <span className="text-xs font-bold text-gray-600 uppercase">Year-End Report</span>
                        {data.renewal.hasYearEnd ? <CheckCircle size={16} className="text-green-500" /> : <XCircle size={16} className="text-red-400" />}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col">
              <div className="p-6 border-b border-gray-50 flex items-center gap-2">
                <Bell size={20} className="text-gray-400" />
                <h2 className="text-lg font-black text-gray-800 uppercase tracking-tight">Announcements</h2>
              </div>
              <div className="p-0">
                {(data.announcements || []).length === 0 ? (
                  <div className="p-6 text-center text-gray-400 font-bold text-sm">No announcements at this time.</div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {(data.announcements || []).map((ann) => (
                      <div key={ann.id} className="p-6 hover:bg-gray-50 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-bold text-gray-800 text-sm">{ann.title}</h3>
                          <span className="text-[10px] font-bold text-gray-400 whitespace-nowrap bg-gray-100 px-2 py-1 rounded">{formatDate(ann.created_at)}</span>
                        </div>
                        <p className="text-xs font-medium text-gray-500 line-clamp-3">{ann.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>

      <ReportPreviewModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        title={reportData.title}
        generatedBy={user?.full_name || 'System User'}
        stats={reportData.stats}
        tableHeaders={reportData.headers}
        tableData={reportData.rows}
        secondTableHeaders={reportData.secondHeaders}
        secondTableData={reportData.secondRows}
        secondTableTitle={reportData.secondTitle}
        pdfFilename={reportData.filename}
        schoolYear={data.hero.activeSy?.name || ''}
      />
    </div>
  );
};


// ─── Main Dashboard Router ────────────────────────────────────────────────────

const Dashboard = () => {
  const { user } = useAuth();

  if (user?.role === 'admin') return <AdminDashboardView />;
  if (user?.role === 'chairman') return <ChairmanDashboardView role="chairman" />;
  if (user?.role === 'vice-chairman') return <ChairmanDashboardView role="vice-chairman" />;
  if (user?.role === 'org-president') return <OrgDashboardView />;

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
      <p className="text-gray-500 mt-2">No dashboard available for your role.</p>
    </div>
  );
};

export default Dashboard;
export { AdminDashboardView as AdminDashboard, OrgDashboardView as OrgDashboard, ChairmanDashboardView as ChairmanDashboard };

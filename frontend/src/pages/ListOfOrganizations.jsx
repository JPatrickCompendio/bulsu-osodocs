import React, { useState, useEffect } from 'react';
import {
  Users as UsersIcon,
  Search,
  Calendar,
  FileText,
  Loader2,
  ArrowLeft,
  Eye,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../config/api';
import Avatar from '../components/Avatar';
import ReportPreviewModal from '../components/ReportPreviewModal';
import CompletedDocumentDetail from '../components/CompletedDocumentDetail';

const MONTH_OPTIONS = [
  { value: 'all', label: 'All Months' },
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

const parseCoAdvisersList = (val) => {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string' && val.trim()) {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
      return [val];
    } catch {
      return val.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
};

const ListOfOrganizations = () => {
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [schoolYears, setSchoolYears] = useState([]);
  const [selectedSyId, setSelectedSyId] = useState('');
  const [orgUsers, setOrgUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [orgSubTab, setOrgSubTab] = useState('all'); // 'all' | 'new' | 'renewed' | 'not_renewed'

  // Detail View State
  const [selectedUser, setSelectedUser] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [docLogFilter, setDocLogFilter] = useState('all');
  const [docLogMonthFilter, setDocLogMonthFilter] = useState('all');
  const [selectedSubmissionId, setSelectedSubmissionId] = useState(null);

  // Report Modal State
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportData, setReportData] = useState({ title: '', stats: [], headers: [], rows: [], filename: '' });

  const fetchSchoolYears = async () => {
    try {
      const res = await apiFetch('/api/school-years');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        const sys = data.data;
        setSchoolYears(sys);
        const activeSy = sys.find((s) => s.is_active) || sys[0];
        if (activeSy && !selectedSyId) {
          setSelectedSyId(activeSy.id);
        }
      }
    } catch (err) {
      console.error('Error fetching school years:', err);
    }
  };

  const fetchOrganizations = async () => {
    setLoading(true);
    try {
      const syParam = selectedSyId ? `&syId=${selectedSyId}` : '';
      const orgsRes = await apiFetch(`/api/organizations/by-ay?t=${Date.now()}${syParam}`, { cache: 'no-store' });
      const orgsData = await orgsRes.json();
      if (orgsData.success && Array.isArray(orgsData.data)) {
        setOrgUsers(orgsData.data);
      }
    } catch (error) {
      console.error('Error fetching organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserDetail = async (userId, syId) => {
    setDetailLoading(true);
    try {
      const targetSy = syId || selectedSyId;
      const syParam = targetSy ? `&syId=${targetSy}` : '';
      const response = await apiFetch(`/api/users/${userId}/detail?t=${Date.now()}${syParam}`, { cache: 'no-store' });
      const result = await response.json();
      if (result.success) {
        setDetailData(result.data);
      }
    } catch (error) {
      console.error('Error fetching organization detail:', error);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    fetchSchoolYears();
  }, []);

  useEffect(() => {
    fetchOrganizations();
  }, [selectedSyId]);

  useEffect(() => {
    if (selectedUser) {
      fetchUserDetail(selectedUser.id, selectedSyId);
    }
  }, [selectedSyId, selectedUser?.id]);

  const handleProfileClick = (user) => {
    setSelectedUser(user);
    setDetailData(null);
    setDocLogFilter('all');
    setSelectedSubmissionId(null);
    fetchUserDetail(user.id, selectedSyId);
  };

  const handleBackToList = () => {
    setSelectedUser(null);
    setDetailData(null);
    setSelectedSubmissionId(null);
  };

  const formatDetailDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getActivityIcon = (actionType) => {
    const action = String(actionType || '').toLowerCase();
    if (action.includes('reject') || action.includes('disapprove')) {
      return { bg: 'bg-red-100', color: 'text-red-500', icon: XCircle };
    }
    if (action.includes('approv')) {
      return { bg: 'bg-green-100', color: 'text-green-500', icon: CheckCircle };
    }
    if (action.includes('submit')) {
      return { bg: 'bg-blue-100', color: 'text-blue-500', icon: FileText };
    }
    return { bg: 'bg-gray-100', color: 'text-gray-500', icon: Clock };
  };

  const selectedSyObj = schoolYears.find((s) => s.id === selectedSyId);
  const isCurrentActiveSy = selectedSyObj ? selectedSyObj.is_active : true;
  const currentSyName = selectedSyObj?.name || 'Selected A.Y.';

  const filteredOrgs = orgUsers.filter((org) => {
    const name = org.full_name || '';
    const orgName = org.org_name || '';
    const presName = org.president_name || name;
    const matchesSearch =
      presName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      orgName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (org.abbreviation || '').toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (orgSubTab === 'renewed') return org.tab_category === 'renewed' || org.renewal_status === 'RENEWED';
    if (orgSubTab === 'not_renewed') return org.tab_category === 'not_renewed';
    if (orgSubTab === 'new') return org.tab_category === 'new';
    return true;
  });

  const handleGenerateReport = () => {
    const totalOrgs = filteredOrgs.length;
    const renewedOrgs = filteredOrgs.filter((o) => o.renewal_status === 'RENEWED' || o.tab_category === 'renewed').length;
    const pendingOrgs = filteredOrgs.filter((o) => o.renewal_status !== 'RENEWED').length;
    const activeOrgs = filteredOrgs.filter((o) => o.status === 'Active' || o.status === 'Active (Extended)').length;
    const suspendedOrgs = filteredOrgs.filter((o) => o.status?.startsWith('Suspended')).length;

    const stats = [
      { label: 'Total Organizations', value: totalOrgs },
      { label: 'Renewed Orgs', value: renewedOrgs },
      { label: 'Pending Renewal / New', value: pendingOrgs },
      { label: 'Active / Suspended', value: `${activeOrgs} / ${suspendedOrgs}` },
    ];

    const tableHeaders = ['Organization', 'President Name', 'Student No.', 'Adviser Name', 'Members', 'Status', 'Renewal Status'];
    const tableData = filteredOrgs.map((org) => [
      org.org_name || org.full_name || '—',
      org.president_name || org.full_name || '—',
      org.student_no || '—',
      org.adviser_name || '—',
      String(org.no_member || 0),
      org.status?.startsWith('Suspended') ? 'SUSPENDED' : String(org.status || 'Active').toUpperCase(),
      org.status_label || (org.renewal_status === 'RENEWED' ? 'Renewed' : 'New'),
    ]);

    const dateStr = new Date().toISOString().split('T')[0];
    setReportData({
      title: `Student Organizations Directory (${currentSyName})`,
      stats,
      headers: tableHeaders,
      rows: tableData,
      filename: `Student_Organizations_Directory_${dateStr}.pdf`,
      personInCharge: currentUser?.full_name || 'University Official',
    });
    setIsReportOpen(true);
  };

  const profile = selectedUser ? (detailData?.user || selectedUser) : null;
  const activeSinceYear = selectedUser
    ? (profile?.joined_date ? new Date(profile.joined_date).getFullYear() : (profile?.created_at ? new Date(profile.created_at).getFullYear() : new Date().getFullYear()))
    : 0;
  const pendingCount = selectedUser ? (detailData?.pendingReviewCount || 0) : 0;

  const renderProfileDetail = () => {
    if (!profile) return null;

    const headerTitle = profile.org_name || 'Organization';
    const headerSubtitle = `${profile.full_name || 'President'} • Organization President`;

    const coAdvisersList = parseCoAdvisersList(profile.co_advisers);
    const coAdvisersText = coAdvisersList.length > 0
      ? `Co-Adviser(s): ${coAdvisersList.join(', ')}`
      : 'Main Adviser Only';

    const infoCards = [
      { label: 'President', value: profile.full_name, sub: profile.student_no ? `SN: ${profile.student_no}` : '' },
      {
        label: 'Advisers & Co-Advisers',
        value: profile.adviser_name || '—',
        sub: coAdvisersText,
      },
      { label: 'Official Email', value: profile.email || '—', sub: '' },
      { label: 'Contact Number', value: profile.contact_no || '—', sub: '' },
      { label: 'Total Members', value: `${profile.no_member || 0} Active Members`, sub: '' },
      {
        label: 'Renewal Status',
        value: detailData?.renewal?.isEligible ? 'Eligible for Renewal' : 'Not Eligible',
        sub: detailData?.renewal?.isEligible ? 'Good' : 'Action Required',
      },
    ];

    const rawDocLogs = detailData?.documentLogs || [];

    const isDocCompleted = (statusStr) => {
      const s = String(statusStr || '').toLowerCase().trim();
      return (
        s === 'completed' ||
        s === 'approved' ||
        s === 'ready for retrieval' ||
        s === 'waiting for accomplishment report' ||
        s === 'dean approved'
      );
    };

    const isDocDisapproved = (statusStr) => {
      const s = String(statusStr || '').toLowerCase().trim();
      return s.includes('disapproved') || s.includes('rejected');
    };

    const filteredDocLogs = rawDocLogs.filter((doc) => {
      const statusStr = doc.rawStatus || doc.status || '';
      const isCompleted = isDocCompleted(statusStr);
      const isDisapproved = isDocDisapproved(statusStr);
      const isUnderProcess = !isCompleted && !isDisapproved;

      if (docLogFilter === 'completed' && !isCompleted) return false;
      if (docLogFilter === 'disapproved' && !isDisapproved) return false;
      if (docLogFilter === 'under-process' && !isUnderProcess) return false;

      if (docLogMonthFilter !== 'all') {
        const rawDate = doc.dateSubmitted || doc.created_at;
        if (rawDate) {
          const m = new Date(rawDate).getMonth() + 1;
          if (String(m) !== String(docLogMonthFilter)) return false;
        }
      }

      return true;
    });

    const totalCount = rawDocLogs.length;
    const underProcessCount = rawDocLogs.filter((doc) => {
      const s = doc.rawStatus || doc.status || '';
      return !isDocCompleted(s) && !isDocDisapproved(s);
    }).length;
    const completedCount = rawDocLogs.filter((doc) => isDocCompleted(doc.rawStatus || doc.status)).length;
    const disapprovedCount = rawDocLogs.filter((doc) => isDocDisapproved(doc.rawStatus || doc.status)).length;

    const handleGenerateDocLogsReport = () => {
      const stats = [
        { label: 'Total Documents', value: totalCount },
        { label: 'Under Process', value: underProcessCount },
        { label: 'Completed / Approved', value: completedCount },
        { label: 'Disapproved', value: disapprovedCount },
      ];

      const tableHeaders = ['Document Name', 'Type', 'Date Submitted', 'Status'];
      const tableData = filteredDocLogs.map((doc) => [
        doc.title || '—',
        doc.type || '—',
        formatDetailDate(doc.dateSubmitted || doc.created_at),
        String(doc.status || 'Under Process').toUpperCase(),
      ]);

      const cleanOrgName = (profile.org_name || 'Organization').replace(/[^a-zA-Z0-9_-]/g, '_');
      setReportData({
        title: `${profile.org_name || 'Organization'} Document Logs (${currentSyName})`,
        stats,
        headers: tableHeaders,
        rows: tableData,
        filename: `${cleanOrgName}_Document_Logs_${new Date().toISOString().split('T')[0]}.pdf`,
        personInCharge: profile.full_name || '—',
      });
      setIsReportOpen(true);
    };

    return (
      <div className="space-y-6">
        <div className="relative rounded-2xl p-8 text-white shadow-lg overflow-hidden bg-black">
          {/* Background Video */}
          <video
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover pointer-events-none opacity-60 z-0"
          >
            <source src="/loginbgvid.mp4" type="video/mp4" />
          </video>

          {/* Dark Overlay Gradient */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/50 to-black/70 pointer-events-none z-0" />

          {/* Content */}
          <div className="relative z-10">
            <div className="flex flex-col md:flex-row md:items-start gap-6">
              <Avatar
                profileImage={profile.profile_image}
                name={profile.org_name || profile.full_name}
                className="w-20 h-20 rounded-2xl shadow-lg shrink-0"
                fallbackClassName="bg-secondary-gold text-primary-green font-black text-2xl"
              />
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <h1 className="text-2xl md:text-3xl font-black">{headerTitle}</h1>
                </div>
                <p className="text-green-100 text-sm font-medium mb-4">{headerSubtitle}</p>
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="px-4 py-1.5 bg-white/20 rounded-full text-xs font-bold">
                    Active Since - {activeSinceYear}
                  </span>
                  <span
                    className={`px-4 py-1.5 rounded-full text-xs font-bold ${
                      profile.status?.startsWith('Suspended')
                        ? 'bg-red-500/25 text-red-100'
                        : profile.status === 'Inactive'
                        ? 'bg-gray-500/25 text-gray-200'
                        : 'bg-white/20 text-white'
                    }`}
                  >
                    {profile.status?.startsWith('Suspended') ? 'Suspended' : profile.status || 'Active'}
                  </span>
                  <span className="px-3 py-1 bg-white/10 text-white/80 rounded-full text-xs font-medium border border-white/20">
                    Read-Only Mode
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
              {infoCards.map(({ label, value, sub }) => (
                <div key={label} className="bg-white/10 backdrop-blur-md border border-white/15 rounded-xl p-4 text-white shadow-sm">
                  <p className="text-[10px] font-bold text-green-300 uppercase tracking-wider mb-1">{label}</p>
                  <p className="font-bold text-sm text-white line-clamp-2">{value}</p>
                  {sub && <p className="text-[11px] text-green-100/90 font-medium mt-1 leading-snug">{sub}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {pendingCount > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="text-yellow-600 shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-bold text-yellow-800 text-sm">Attention Needed</p>
              <p className="text-xs text-yellow-700 mt-0.5">
                This organization has {pendingCount} document{pendingCount !== 1 ? 's' : ''} pending review in the current school year.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[520px]">
            <div className="p-6 border-b border-gray-50 flex flex-col xl:flex-row xl:items-center justify-between gap-4 shrink-0">
              <div>
                <h2 className="text-lg font-black text-gray-800 uppercase">Document Logs</h2>
                <p className="text-xs font-bold text-gray-400 mt-1">Current school year submissions</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 bg-gray-100 px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 border border-gray-200/60">
                  <Calendar size={14} className="text-gray-500" />
                  <select
                    value={docLogMonthFilter}
                    onChange={(e) => setDocLogMonthFilter(e.target.value)}
                    className="bg-transparent text-gray-700 font-bold focus:outline-none cursor-pointer pr-1"
                  >
                    {MONTH_OPTIONS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex bg-gray-100 p-1 rounded-xl text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setDocLogFilter('all')}
                    className={`px-2.5 py-1.5 rounded-lg transition-all ${
                      docLogFilter === 'all'
                        ? 'bg-white text-gray-800 shadow-sm font-black'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    All ({totalCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocLogFilter('under-process')}
                    className={`px-2.5 py-1.5 rounded-lg transition-all ${
                      docLogFilter === 'under-process'
                        ? 'bg-white text-yellow-700 shadow-sm font-black'
                        : 'text-gray-500 hover:text-yellow-600'
                    }`}
                  >
                    Under Process ({underProcessCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocLogFilter('completed')}
                    className={`px-2.5 py-1.5 rounded-lg transition-all ${
                      docLogFilter === 'completed'
                        ? 'bg-white text-green-700 shadow-sm font-black'
                        : 'text-gray-500 hover:text-green-600'
                    }`}
                  >
                    Completed ({completedCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocLogFilter('disapproved')}
                    className={`px-2.5 py-1.5 rounded-lg transition-all ${
                      docLogFilter === 'disapproved'
                        ? 'bg-white text-red-700 shadow-sm font-black'
                        : 'text-gray-500 hover:text-red-600'
                    }`}
                  >
                    Disapproved ({disapprovedCount})
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleGenerateDocLogsReport}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-green text-white text-xs font-bold rounded-xl hover:bg-primary-green/90 transition-all shadow-sm shrink-0"
                  title="Generate Document Logs Report"
                >
                  <FileText size={14} />
                  <span>Generate Report</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-[#073c2d] text-white">
                    <th className="px-6 py-3 text-xs font-black uppercase text-white">Document Name</th>
                    <th className="px-6 py-3 text-xs font-black uppercase text-white">Type</th>
                    <th className="px-6 py-3 text-xs font-black uppercase text-white">Date Submitted</th>
                    <th className="px-6 py-3 text-xs font-black uppercase text-white">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredDocLogs.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="px-6 py-12 text-center text-gray-400 font-bold text-sm">
                        No {docLogFilter !== 'all' ? docLogFilter.replace('-', ' ') : ''} documents found for the current school year.
                      </td>
                    </tr>
                  ) : (
                    filteredDocLogs.map((doc) => {
                      const statusStr = doc.rawStatus || doc.status || '';
                      const isCompleted = isDocCompleted(statusStr);
                      const isDisapproved = isDocDisapproved(statusStr);
                      const isReturned = String(statusStr).toLowerCase().includes('returned');

                      let badgeStyle = 'bg-yellow-100 text-yellow-700';
                      if (isCompleted) badgeStyle = 'bg-green-100 text-green-700';
                      else if (isDisapproved) badgeStyle = 'bg-red-100 text-red-700';
                      else if (isReturned) badgeStyle = 'bg-orange-100 text-orange-700';

                      const statusLower = String(doc.status || '').toLowerCase().trim();
                      const isPendingHardCopy = statusLower === 'to forward' || statusLower.includes('hardcopy');
                      const displayStatusText = isPendingHardCopy
                        ? 'PENDING HARD COPY'
                        : isCompleted
                        ? 'COMPLETED'
                        : doc.status;

                      return (
                        <tr
                          key={doc.id}
                          onClick={() => setSelectedSubmissionId(doc.id)}
                          className="hover:bg-green-50/50 hover:border-l-4 hover:border-primary-green transition-all cursor-pointer group"
                        >
                          <td className="px-6 py-4 font-semibold text-sm text-gray-800 group-hover:text-primary-green transition-colors">
                            {doc.title}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">{doc.type}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{formatDetailDate(doc.dateSubmitted)}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase ${badgeStyle}`}>
                              {isCompleted && <CheckCircle size={12} />}
                              {isDisapproved && <XCircle size={12} />}
                              {!isCompleted && !isDisapproved && <Clock size={12} />}
                              {displayStatusText}
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

          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[520px]">
            <div className="p-6 border-b border-gray-50 shrink-0">
              <h2 className="text-lg font-black text-gray-800 uppercase">Activity History</h2>
              <p className="text-xs font-bold text-gray-400 mt-1">Current school year actions by this organization</p>
            </div>
            <div className="p-6 space-y-3 overflow-y-auto flex-1 min-h-0">
              {(detailData?.activityHistory || []).length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8 font-medium">No activity recorded for the current school year.</p>
              ) : (
                detailData.activityHistory.map((log) => {
                  const { bg, color, icon: Icon } = getActivityIcon(log.action_type);
                  const docTitle = log.docTitle || log.submissions?.docTitle || null;
                  const trackingNo = log.trackingNumber || log.submissions?.tracking_number || null;
                  const isClickable = Boolean(log.submission_id);

                  return (
                    <div
                      key={log.id}
                      onClick={() => log.submission_id && setSelectedSubmissionId(log.submission_id)}
                      className={`p-3.5 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-green-50/60 hover:border-primary-green/30 transition-all ${
                        isClickable ? 'cursor-pointer group' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-full ${bg} ${color} flex items-center justify-center shrink-0 mt-0.5 shadow-sm`}>
                          <Icon size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          {docTitle ? (
                            <div className="flex flex-wrap items-center gap-1.5 mb-1">
                              <span className="font-bold text-xs text-gray-900 group-hover:text-primary-green transition-colors break-words line-clamp-2">
                                {docTitle}
                              </span>
                              {trackingNo && (
                                <span className="px-1.5 py-0.5 bg-gray-200/80 text-gray-700 text-[10px] font-mono font-bold rounded shrink-0">
                                  {trackingNo}
                                </span>
                              )}
                            </div>
                          ) : trackingNo ? (
                            <span className="px-1.5 py-0.5 bg-gray-200/80 text-gray-700 text-[10px] font-mono font-bold rounded mb-1 inline-block">
                              {trackingNo}
                            </span>
                          ) : null}

                          <p className="text-xs text-gray-600 font-medium leading-snug break-words">
                            {log.description || String(log.action_type || '').replace(/_/g, ' ')}
                          </p>

                          <p className="text-[10px] text-gray-400 font-bold mt-1.5 flex items-center gap-1">
                            <Clock size={10} />
                            {formatDetailDate(log.created_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </div>
    );
  };

  return (
    <div className="animate-in fade-in duration-500">
      {selectedSubmissionId ? (
        <CompletedDocumentDetail
          submissionId={selectedSubmissionId}
          onBack={() => setSelectedSubmissionId(null)}
        />
      ) : selectedUser ? (
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <button
              onClick={handleBackToList}
              className="flex items-center gap-2 text-gray-500 hover:text-primary-green font-semibold text-sm transition-colors"
            >
              <ArrowLeft size={18} />
              Back to List of Organizations
            </button>

            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-gray-100 shadow-2xs">
              <Calendar size={15} className="text-gray-400" />
              <span className="text-xs font-bold text-gray-500">Academic Year Snapshot:</span>
              <select
                className="bg-transparent text-xs font-bold text-gray-800 outline-none cursor-pointer"
                value={selectedSyId}
                onChange={(e) => setSelectedSyId(e.target.value)}
              >
                {schoolYears.map((sy) => (
                  <option key={sy.id} value={sy.id}>
                    {sy.name} {sy.is_active ? '(Active)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {detailLoading ? (
            <div className="p-20 flex flex-col items-center justify-center text-gray-400">
              <Loader2 className="animate-spin mb-4" size={40} />
              <p>Loading organization details...</p>
            </div>
          ) : (
            renderProfileDetail()
          )}
        </div>
      ) : (
        <>
          {/* Main Top Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
            <PageHeader
              title="List of Organizations"
              subtitle="View registered student organizations, leadership directories, and academic-year renewal snapshots."
              icon={UsersIcon}
              iconColor="purple"
            />

            <div className="flex gap-3">
              <button
                onClick={handleGenerateReport}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all shadow-sm font-semibold text-sm"
              >
                <FileText size={18} />
                Generate Report
              </button>
            </div>
          </div>

          {!isCurrentActiveSy && (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-2xl flex items-center gap-3 mb-6 font-medium text-sm shadow-sm animate-in fade-in">
              <Clock size={20} className="text-amber-600 shrink-0" />
              <div>
                <strong>Archived Academic Year (Read-Only Mode):</strong> Viewing historical records for {selectedSyObj?.name}.
              </div>
            </div>
          )}

          {/* Controls Bar & Filter */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-6 flex flex-col md:flex-row gap-4 justify-between items-center text-gray-800">
            <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
              <div className="relative w-full md:w-80">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                  <Search size={18} />
                </span>
                <input
                  type="text"
                  placeholder="Search organization or president..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-green outline-none transition-all text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <span className="text-xs font-bold text-gray-500 shrink-0">Academic Year:</span>
                <select
                  className="px-3.5 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-green outline-none bg-white text-xs font-bold text-gray-800 shadow-2xs"
                  value={selectedSyId}
                  onChange={(e) => setSelectedSyId(e.target.value)}
                >
                  {schoolYears.map((sy) => (
                    <option key={sy.id} value={sy.id}>
                      {sy.name} {sy.is_active ? '(Active)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-full md:w-auto">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'new', label: 'New' },
                  { id: 'renewed', label: 'Renewed' },
                  { id: 'not_renewed', label: 'Not Renewed' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setOrgSubTab(tab.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      orgSubTab === tab.id
                        ? 'bg-white text-primary-green shadow-xs'
                        : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-xs font-semibold text-gray-500 bg-gray-50 px-3.5 py-2 rounded-xl border border-gray-100 shrink-0">
              Organizations: <span className="font-bold text-gray-900">{filteredOrgs.length}</span>
            </div>
          </div>

          {/* Organizations Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {loading ? (
              <div className="p-20 flex flex-col items-center justify-center text-gray-400">
                <Loader2 className="animate-spin mb-4" size={40} />
                <p>Loading organizations...</p>
              </div>
            ) : (
              <div>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#073c2d] text-white border-b border-[#073c2d]">
                      <th className="px-3 sm:px-6 py-4 font-semibold text-white text-xs sm:text-sm">Organization</th>
                      <th className="hidden sm:table-cell px-6 py-4 font-semibold text-white text-sm">
                        President ({currentSyName})
                      </th>
                      <th className="hidden md:table-cell px-6 py-4 font-semibold text-white text-sm">Adviser</th>
                      <th className="px-3 sm:px-6 py-4 font-semibold text-white text-xs sm:text-sm text-center">Status</th>
                      <th className="px-3 sm:px-6 py-4 font-semibold text-white text-xs sm:text-sm text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredOrgs.length > 0 ? (
                      filteredOrgs.map((org) => {
                        const isRenewed = org.renewal_status === 'RENEWED';
                        return (
                          <tr
                            key={org.id}
                            className="hover:bg-gray-50/80 transition-colors group cursor-pointer"
                            onClick={() => handleProfileClick(org)}
                          >
                            <td className="px-3 sm:px-6 py-4">
                              <div className="flex items-center gap-2 sm:gap-3">
                                <Avatar
                                  profileImage={org.profile_image}
                                  name={org.org_name || org.full_name}
                                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-full shadow-sm shrink-0"
                                  fallbackClassName="text-white bg-secondary-gold text-primary-green font-bold"
                                />
                                <div className="min-w-0">
                                  <div
                                    className="font-semibold text-gray-800 truncate max-w-[140px] sm:max-w-[200px] text-xs sm:text-sm"
                                    title={org.org_name || org.full_name}
                                  >
                                    {org.org_name || org.full_name}
                                  </div>
                                  <div className="text-[10px] text-gray-400 font-mono truncate">
                                    {org.abbreviation ? `${org.abbreviation} • ` : ''}ID: {org.id.substring(0, 8)}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="hidden sm:table-cell px-6 py-4">
                              <div className="font-semibold text-xs sm:text-sm text-gray-800">
                                {org.president_name || org.full_name}
                              </div>
                              {org.student_no && (
                                <div className="text-[10px] text-gray-400 font-mono">SN: {org.student_no}</div>
                              )}
                            </td>
                            <td
                              className="hidden md:table-cell px-6 py-4 text-xs text-gray-600 max-w-[150px] truncate"
                              title={org.adviser_name || ''}
                            >
                              {org.adviser_name || <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-3 sm:px-6 py-4 text-center">
                              {org.status_label === 'New' || org.tab_category === 'new' ? (
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200">
                                  <Sparkles size={12} /> New
                                </span>
                              ) : isRenewed ? (
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  <CheckCircle size={12} /> Renewed
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                                  <Clock size={12} /> Pending Renewal
                                </span>
                              )}
                            </td>
                            <td className="px-3 sm:px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => handleProfileClick(org)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-primary-green bg-green-50 hover:bg-primary-green hover:text-white rounded-xl transition-all shadow-2xs border border-primary-green/20"
                                title="View Organization Details"
                              >
                                <Eye size={14} />
                                <span className="hidden sm:inline">View Details</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="5" className="px-6 py-20 text-center text-gray-400">
                          No student organizations found for this Academic Year.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* PDF Export Report Modal */}
      {isReportOpen && (
        <ReportPreviewModal
          isOpen={isReportOpen}
          onClose={() => setIsReportOpen(false)}
          reportData={reportData}
        />
      )}
    </div>
  );
};

export default ListOfOrganizations;

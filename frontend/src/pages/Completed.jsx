import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import CompletedDocumentDetail from '../components/CompletedDocumentDetail';
import { Filter, ChevronDown, Eye, FileText, CheckCircle } from 'lucide-react';
import ReportPreviewModal from '../components/ReportPreviewModal';
import PageHeader from '../components/PageHeader';

const normalizeStatus = (status) =>
  String(status || '')
    .toLowerCase()
    .replace(/[_-]/g, ' ')
    .trim();

const isCompletedStatus = (status) => normalizeStatus(status) === 'completed';

const isDisapprovedStatus = (status) => {
  const s = normalizeStatus(status);
  return s.includes('disapproved') || s === 'rejected';
};

const isTerminalCompletedPageStatus = (status) =>
  isCompletedStatus(status) || isDisapprovedStatus(status);

const getCompletedPageStatusMeta = (status) => {
  if (isDisapprovedStatus(status)) {
    return { label: 'Disapproved', badgeClass: 'bg-red-600' };
  }
  return { label: 'Completed', badgeClass: 'bg-emerald-500' };
};

const getSemesterFromDate = (dateStr) => {
  if (!dateStr) return 'Unknown';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return 'Unknown';
  const month = d.getMonth() + 1;
  if (month >= 8 && month <= 12) return '1st Semester';
  if (month >= 1 && month <= 5) return '2nd Semester';
  return 'Summer';
};

const DATE_RANGE_OPTIONS = [
  { value: 'all', label: 'All time' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 3 months' },
  { value: 'year', label: 'This year' }
];

const SORT_OPTIONS = [
  { value: 'recent', label: 'Recently Completed' },
  { value: 'oldest', label: 'Oldest Completed' },
  { value: 'title-asc', label: 'Document A–Z' },
  { value: 'title-desc', label: 'Document Z–A' }
];

const FilterDropdown = ({ label, value, options, onChange, isOpen, onToggle, activeWhen }) => (
  <div className="relative">
    <button
      type="button"
      onClick={(e) => onToggle(e)}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors cursor-pointer ${
        isOpen || activeWhen
          ? 'border-primary-green bg-green-50 text-primary-green'
          : 'border-gray-200 bg-white text-gray-700 hover:border-primary-green hover:text-primary-green'
      }`}
    >
      {label}
      {activeWhen && (
        <span className="text-[10px] opacity-80 max-w-[120px] truncate">
          : {options.find((o) => o.value === value)?.label || value}
        </span>
      )}
      <ChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
    </button>
    {isOpen && (
      <div className="absolute left-0 top-full mt-1 z-50 min-w-[180px] bg-white border border-gray-100 rounded-xl shadow-lg py-1 max-h-56 overflow-y-auto">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`w-full text-left px-4 py-2 text-xs hover:bg-gray-50 ${
              value === opt.value ? 'bg-green-50 text-primary-green font-semibold' : 'text-gray-700'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    )}
  </div>
);

const Completed = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [loading, setLoading] = React.useState(true);
  const [selectedSubmissionId, setSelectedSubmissionId] = React.useState(null);
  const [completedDocs, setCompletedDocs] = React.useState([]);
  const [unreadDocIds, setUnreadDocIds] = React.useState([]);
  const [fetchError, setFetchError] = React.useState(null);
  const [filterDocType, setFilterDocType] = React.useState('all');
  const [filterSemester, setFilterSemester] = React.useState('all');
  const [filterDateRange, setFilterDateRange] = React.useState('all');
  const [sortBy, setSortBy] = React.useState('recent');
  const [openFilter, setOpenFilter] = React.useState(null);

  const role = String(user?.role || '').toLowerCase();
  const isOrgPresident = role === 'org-president';

  const [isReportOpen, setIsReportOpen] = React.useState(false);
  const [reportData, setReportData] = React.useState({ title: '', stats: [], headers: [], rows: [], secondHeaders: null, secondRows: null, secondTitle: '', filename: '' });

  const handleGenerateReport = () => {
    const totalDocs = filteredDocs.length;
    const approved = filteredDocs.filter(d => {
      const s = String(d.raw?.status || d.statusLabel || '').toLowerCase();
      return s === 'completed' || s === 'approved' || s === 'dean approved';
    }).length;
    const disapproved = filteredDocs.filter(d => {
      const s = String(d.raw?.status || d.statusLabel || '').toLowerCase();
      return s === 'disapproved' || s === 'rejected';
    }).length;

    const successRate = totalDocs > 0 
      ? `${Math.round((approved / totalDocs) * 100)}%` 
      : '0%';

    const stats = [
      { label: 'Total Documents', value: totalDocs },
      { label: 'Approved', value: approved },
      { label: 'Disapproved', value: disapproved },
      { label: 'Approval Rate', value: successRate }
    ];

    const tableHeaders = ['Ref ID', 'Document Title', 'Sender Organization', 'Document Type', 'Date Completed', 'Status'];
    const tableData = filteredDocs.map(doc => [
      doc.ref || `SUB-${doc.id.substring(0, 8).toUpperCase()}`,
      doc.title || 'Untitled Document',
      doc.sender || '—',
      doc.type || '—',
      doc.completedDate || '—',
      String(doc.statusLabel || doc.raw?.status || 'Completed').toUpperCase()
    ]);

    setReportData({
      title: `Completed & Terminal Documents Report`,
      stats,
      headers: tableHeaders,
      rows: tableData,
      secondHeaders: null,
      secondRows: null,
      secondTitle: '',
      filename: `Completed_Documents_Report_${new Date().toISOString().split('T')[0]}.pdf`
    });
    setIsReportOpen(true);
  };

  const markAsRead = (docId) => {
    try {
      const readIds = JSON.parse(localStorage.getItem('completed_read_ids') || '[]');
      if (!readIds.includes(docId)) {
        readIds.push(docId);
        localStorage.setItem('completed_read_ids', JSON.stringify(readIds));
        window.dispatchEvent(new CustomEvent('completed-updated'));
      }
    } catch (e) {
      console.error(e);
    }
  };

  React.useEffect(() => {
    if (location.state?.openDocId) {
      markAsRead(location.state.openDocId);
      setSelectedSubmissionId(location.state.openDocId);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  React.useEffect(() => {
    if (unreadDocIds.length > 0) {
      const timer = setTimeout(() => {
        setUnreadDocIds([]);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [unreadDocIds]);

  React.useEffect(() => {
    const handleClickOutside = () => setOpenFilter(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  React.useEffect(() => {
    const handleSidebarClick = () => setSelectedSubmissionId(null);
    window.addEventListener('sidebar-nav-click', handleSidebarClick);
    return () => window.removeEventListener('sidebar-nav-click', handleSidebarClick);
  }, []);

  React.useEffect(() => {
    const fetchCompleted = async () => {
      if (!user?.id) {
        setCompletedDocs([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setFetchError(null);

        let query = supabase
          .from('submissions')
          .select(`
            id,
            updated_at,
            status,
            subtype_id,
            current_version_id,
            document_subtypes ( name ),
            users ( org_name ),
            documentType ( name ),
            submission_versions!submission_id (
              id,
              version_number,
              activity_proposal_details (*, activity_schedules (*), 
                activity_title,
                target_date
              )
            )
          `)
          .order('updated_at', { ascending: false });

        if (isOrgPresident) {
          query = query.eq('user_id', user.id);
        }

        const { data, error } = await query;
        if (error) throw error;

        const rows = (data || [])
          .filter((sub) => isTerminalCompletedPageStatus(sub.status))
          .map((sub) => {
            const statusMeta = getCompletedPageStatusMeta(sub.status);
            const versions = Array.isArray(sub.submission_versions)
              ? sub.submission_versions
              : [sub.submission_versions].filter(Boolean);
            const latestVersion =
              versions.find((v) => v.id === sub.current_version_id) ||
              versions.sort((a, b) => (b?.version_number || 0) - (a?.version_number || 0))[0];
            const details = Array.isArray(latestVersion?.activity_proposal_details)
              ? latestVersion.activity_proposal_details[0]
              : latestVersion?.activity_proposal_details;
            const title = details?.activity_title || sub.documentType?.name || 'Document';
            const completedAt = sub.updated_at || sub.created_at;
            const completedDate = new Date(completedAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            });
            const semester = getSemesterFromDate(details?.target_date || completedAt);

            let proposalType = '-';
            const docTypeName = sub.documentType?.name || 'Document';
            const isActivityProposal = docTypeName.toLowerCase() === 'activity proposal' || docTypeName.toLowerCase().includes('proposal');

            if (isActivityProposal) {
              if (sub.document_subtypes?.name) {
                proposalType = sub.document_subtypes.name;
              } else if (details?.proposal_type) {
                const rawType = details.proposal_type;
                if (rawType.toLowerCase() === 'in-campus') proposalType = 'In-Campus';
                else if (rawType.toLowerCase() === 'off-campus') proposalType = 'Off-Campus';
                else proposalType = rawType.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
              }
            }

            return {
              id: sub.id,
              title,
              ref: `SUB-2026-03-${String(sub.id).padStart(3, '0')}`,
              sender: sub.users?.org_name || '-',
              type: sub.documentType?.name || 'Document',
              proposal_type: proposalType,
              completedDate,
              completedAt,
              semester,
              statusLabel: statusMeta.label,
              statusBadgeClass: statusMeta.badgeClass,
              raw: sub
            };
          });
        setCompletedDocs(rows);
        const readIds = JSON.parse(localStorage.getItem('completed_read_ids') || '[]');
        const unread = rows.filter((d) => !readIds.includes(d.id)).map((d) => d.id);
        setUnreadDocIds(unread);
      } catch (err) {
        console.error('Error fetching completed documents:', err);
        setFetchError(err.message || 'Failed to load completed documents.');
        setCompletedDocs([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCompleted();
  }, [user?.id, isOrgPresident]);

  const docTypeOptions = React.useMemo(() => {
    const types = [...new Set(completedDocs.map((d) => d.type).filter(Boolean))].sort();
    return [{ value: 'all', label: 'All types' }, ...types.map((t) => ({ value: t, label: t }))];
  }, [completedDocs]);

  const semesterOptions = React.useMemo(() => {
    const semesters = [...new Set(completedDocs.map((d) => d.semester).filter(Boolean))].sort();
    return [{ value: 'all', label: 'All semesters' }, ...semesters.map((s) => ({ value: s, label: s }))];
  }, [completedDocs]);

  const matchesDateRange = (completedAt, range) => {
    if (range === 'all' || !completedAt) return true;
    const date = new Date(completedAt);
    if (Number.isNaN(date.getTime())) return true;
    const now = new Date();
    const diffMs = now - date;
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (range === '7d') return diffDays <= 7;
    if (range === '30d') return diffDays <= 30;
    if (range === '90d') return diffDays <= 90;
    if (range === 'year') return date.getFullYear() === now.getFullYear();
    return true;
  };

  const filteredDocs = React.useMemo(() => {
    let list = [...completedDocs];

    if (filterDocType !== 'all') {
      list = list.filter((d) => d.type === filterDocType);
    }
    if (filterSemester !== 'all') {
      list = list.filter((d) => d.semester === filterSemester);
    }
    if (filterDateRange !== 'all') {
      list = list.filter((d) => matchesDateRange(d.completedAt, filterDateRange));
    }

    list.sort((a, b) => {
      if (sortBy === 'oldest') {
        return new Date(a.completedAt) - new Date(b.completedAt);
      }
      if (sortBy === 'title-asc') {
        return a.title.localeCompare(b.title);
      }
      if (sortBy === 'title-desc') {
        return b.title.localeCompare(a.title);
      }
      return new Date(b.completedAt) - new Date(a.completedAt);
    });

    return list;
  }, [completedDocs, filterDocType, filterSemester, filterDateRange, sortBy]);

  const toggleFilter = (e, name) => {
    e.stopPropagation();
    setOpenFilter((prev) => (prev === name ? null : name));
  };

  if (selectedSubmissionId) {
    return (
      <CompletedDocumentDetail
        submissionId={selectedSubmissionId}
        onBack={() => setSelectedSubmissionId(null)}
      />
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-6 duration-1000 text-gray-800">
      <div className="flex items-end justify-between mb-8 border-b border-gray-100 pb-6">
        <PageHeader 
          title="Completed" 
          subtitle="Manage your completed documents and activities here." 
          icon={CheckCircle} 
          iconColor="green" 
        />
      </div>

      <div className="mb-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <Filter size={14} className="shrink-0" />
          <span className="font-semibold shrink-0">Filters :</span>
          <FilterDropdown
            label="Document Type"
            value={filterDocType}
            activeWhen={filterDocType !== 'all'}
            options={docTypeOptions}
            onChange={(v) => {
              setFilterDocType(v);
              setOpenFilter(null);
            }}
            isOpen={openFilter === 'type'}
            onToggle={(e) => toggleFilter(e, 'type')}
          />
          <FilterDropdown
            label="Semester"
            value={filterSemester}
            activeWhen={filterSemester !== 'all'}
            options={semesterOptions}
            onChange={(v) => {
              setFilterSemester(v);
              setOpenFilter(null);
            }}
            isOpen={openFilter === 'semester'}
            onToggle={(e) => toggleFilter(e, 'semester')}
          />
          <FilterDropdown
            label="Date Range"
            value={filterDateRange}
            activeWhen={filterDateRange !== 'all'}
            options={DATE_RANGE_OPTIONS}
            onChange={(v) => {
              setFilterDateRange(v);
              setOpenFilter(null);
            }}
            isOpen={openFilter === 'date'}
            onToggle={(e) => toggleFilter(e, 'date')}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Generate Report Button */}
          <button
            onClick={handleGenerateReport}
            className="flex items-center gap-2 px-4 py-1.5 bg-white border border-gray-200 text-gray-700 hover:border-primary-green rounded-xl transition-all font-semibold text-xs hover:text-primary-green hover:shadow-sm"
          >
            <FileText size={14} />
            <span>Generate Report</span>
          </button>
          
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="shrink-0">Sort by:</span>
            <FilterDropdown
              label={SORT_OPTIONS.find((o) => o.value === sortBy)?.label || 'Recently Completed'}
              value={sortBy}
              activeWhen={sortBy !== 'recent'}
              options={SORT_OPTIONS}
              onChange={(v) => {
                setSortBy(v);
                setOpenFilter(null);
              }}
              isOpen={openFilter === 'sort'}
              onToggle={(e) => toggleFilter(e, 'sort')}
            />
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-10 text-center text-gray-500">Loading completed documents...</div>
        ) : fetchError ? (
          <div className="p-10 text-center text-red-500 text-sm">{fetchError}</div>
        ) : filteredDocs.length === 0 ? (
          <div className="p-10 text-center text-gray-500">
            {completedDocs.length === 0
              ? 'No completed documents yet.'
              : 'No documents match the selected filters.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-primary-green text-white">
                  <th className="px-6 py-4 font-semibold text-[11px] uppercase tracking-wider">Document</th>
                  <th className="px-6 py-4 font-semibold text-[11px] uppercase tracking-wider">Sender</th>
                  <th className="px-6 py-4 font-semibold text-[11px] uppercase tracking-wider text-center">Type</th>
                  <th className="px-6 py-4 font-semibold text-[11px] uppercase tracking-wider">Date Completed</th>
                  <th className="px-6 py-4 font-semibold text-[11px] uppercase tracking-wider text-center">Status</th>
                  <th className="px-6 py-4 font-semibold text-[11px] uppercase tracking-wider text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredDocs.map((doc) => (
                  <tr key={doc.id} className={`group transition-all duration-300 hover:bg-gray-50/50 ${unreadDocIds.includes(doc.id) ? 'newly-added-glow' : ''}`}>
                    <td
                      className="px-6 py-5 cursor-pointer"
                      onClick={() => {
                        markAsRead(doc.id);
                        setSelectedSubmissionId(doc.id);
                      }}
                    >
                      <p className="font-semibold text-gray-800 uppercase text-sm leading-tight group-hover:text-primary-green transition-colors">
                        {doc.title}
                      </p>
                      <p className="text-[10px] text-gray-400 font-mono mt-0.5 tracking-tighter uppercase">{doc.ref}</p>
                    </td>
                    <td className="px-6 py-5 text-sm font-medium text-gray-600 uppercase tracking-tight">{doc.sender}</td>
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
                    <td className="px-6 py-5 text-sm text-gray-500 font-medium">{doc.completedDate}</td>
                    <td className="px-6 py-5 text-center">
                      <span
                        className={`px-4 py-1.5 rounded-full text-[10px] font-bold shadow-sm inline-block min-w-[110px] uppercase text-white ${doc.statusBadgeClass}`}
                      >
                        {doc.statusLabel}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          markAsRead(doc.id);
                          setSelectedSubmissionId(doc.id);
                        }}
                        className="text-xs font-semibold text-gray-600 hover:text-primary-green transition-colors inline-flex items-center gap-1"
                      >
                        view
                        <Eye size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && filteredDocs.length > 0 && (
          <p className="mt-3 text-xs text-gray-400 text-right">
            Showing {filteredDocs.length} of {completedDocs.length} completed document{completedDocs.length !== 1 ? 's' : ''}
          </p>
        )}

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
      />
    </div>
  );
};


export default Completed;

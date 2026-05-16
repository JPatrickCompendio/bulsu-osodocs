import React from 'react';
import { useAuth } from '../context/AuthContext';
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

const PageHeader = ({ title }) => (
  <div className="mb-8">
    <h1 className="text-3xl font-bold text-gray-800">{title}</h1>
    <p className="text-gray-500 mt-1">Manage your {title.toLowerCase()} and activities here.</p>
  </div>
);

const Card = ({ title, children }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
    {title && <h2 className="text-xl font-semibold mb-4 text-gray-700">{title}</h2>}
    {children}
  </div>
);

export const Dashboard = () => {
  const { user } = useAuth();
  return (
    <div>
      <PageHeader title="Dashboard" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card title="Total Documents">
          <p className="text-4xl font-bold text-primary-green">12</p>
        </Card>
        <Card title="Pending Actions">
          <p className="text-4xl font-bold text-secondary-gold">5</p>
        </Card>
        <Card title="Completed">
          <p className="text-4xl font-bold text-blue-500">28</p>
        </Card>
      </div>
      <Card title="Recent Activity">
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-4 py-2 border-b border-gray-50 last:border-0">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-primary-green font-bold">
                {i}
              </div>
              <div>
                <p className="font-medium text-gray-800">Document #{i * 123} was updated</p>
                <p className="text-xs text-gray-400">2 hours ago</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export const Inbox = () => {
  const { user } = useAuth();
  const [isFilterOpen, setIsFilterOpen] = React.useState(false);
  const [filterType, setFilterType] = React.useState('All');
  const [selectedDocs, setSelectedDocs] = React.useState([]);
  const [viewMode, setViewMode] = React.useState('inbox'); // 'inbox' or 'archive'
  const [selectedDoc, setSelectedDoc] = React.useState(null);
  const [isFilesOpen, setIsFilesOpen] = React.useState(true);

  const [inboxData, setInboxData] = React.useState([
    { 
      id: 1, 
      org: 'ASICS', 
      title: 'ASICS SUMMIT', 
      ref: 'AP-2026-03-001', 
      type: 'Activity Proposal', 
      status: 'Chairman Review', 
      time: 'Today, 2:30 PM', 
      timestamp: new Date().setHours(14, 30), 
      isNew: true,
      pic: 'Lance Amiel Samaniego',
      studentId: '2023200011',
      contact: '0912-345-6789',
      targetDate: 'April 15, 2026 | 1:00 PM - 4:00 PM',
      duration: '3 Hours',
      students: '60 Students',
      nature: 'Co-Curricular'
    },
    { id: 2, org: 'JITS', title: 'QUARTERLY FINANCIAL', ref: 'FR-2026-03-002', type: 'Midyear & Year End Report', status: 'Under Review', time: 'Today, 11:15 AM', timestamp: new Date().setHours(11, 15), isNew: true },
    { id: 3, org: 'CSC', title: 'FOUNDATION PROPOSAL', ref: 'AP-2026-03-003', type: 'Activity Proposal', status: 'Pending', time: 'Yesterday, 4:45 PM', timestamp: new Date().setDate(new Date().getDate() - 1), isNew: false },
    { id: 4, org: 'LITS', title: 'MEMBERSHIP LIST', ref: 'AD-2026-03-004', type: 'Renewal', status: 'Approved', time: 'Oct 24, 2023', timestamp: new Date('2023-10-24').getTime(), isNew: false },
  ]);

  const [archiveData, setArchiveData] = React.useState([]);

  const currentData = viewMode === 'inbox' ? inboxData : archiveData;

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

  let filteredData = currentData.filter(item => {
    if (filterType === 'All' || filterType === 'Newest' || filterType === 'Oldest') return true;
    return item.type === filterType;
  });

  if (filterType === 'Newest') {
    filteredData = [...filteredData].sort((a, b) => b.timestamp - a.timestamp);
  } else if (filterType === 'Oldest') {
    filteredData = [...filteredData].sort((a, b) => a.timestamp - b.timestamp);
  }

  const isActionsDisabled = selectedDocs.length === 0;

  if (selectedDoc) {
    return (
      <div className="animate-in fade-in slide-in-from-right-8 duration-500 pb-24">
        {/* Detail Header */}
        <div className="flex items-start gap-4 mb-8">
          <button 
            onClick={() => setSelectedDoc(null)}
            className="mt-1 p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-800"
          >
            <ChevronLeft size={24} />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-800 tracking-tight">{selectedDoc.title}</h1>
            <p className="text-gray-400 font-mono text-sm mt-1">{selectedDoc.ref}</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">
          {[
            { label: 'ORGANIZATION', value: selectedDoc.org, icon: <User size={18} /> },
            { label: 'TYPE', value: selectedDoc.type, icon: <FileText size={18} />, color: 'text-blue-500' },
            { label: 'STATUS', value: selectedDoc.status, icon: <Clock size={18} />, badge: true },
            { label: 'SUBMITTED', value: selectedDoc.time, icon: <Calendar size={18} /> }
          ].map((card, idx) => (
            <div key={idx} className="bg-gray-100 p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                {card.icon}
                <span>{card.label}</span>
              </div>
              {card.badge ? (
                <span className="px-4 py-1.5 bg-[#D9E666] text-[#6A7B2C] text-[10px] font-bold rounded-lg shadow-sm uppercase inline-block">
                  {card.value}
                </span>
              ) : (
                <p className={`font-bold text-gray-800 ${card.color || ''}`}>{card.value}</p>
              )}
            </div>
          ))}
        </div>

        {/* Content Section */}
        <div className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-gray-100 mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-8">Activity Proposal Form</h2>
          <div className="text-center mb-10">
            <h3 className="text-lg font-bold text-gray-800">Document Title: {selectedDoc.title}</h3>
          </div>

          <div className="space-y-4 text-gray-700 max-w-4xl">
            <div className="flex gap-2">
              <span className="font-bold min-w-[200px]">Person In-Charge:</span>
              <span>{selectedDoc.pic || 'Lance Amiel Samaniego'}</span>
            </div>
            <div className="flex gap-2">
              <span className="font-bold min-w-[200px]">Student ID No.:</span>
              <span>{selectedDoc.studentId || '2023200011'}</span>
            </div>
            <div className="flex gap-2">
              <span className="font-bold min-w-[200px]">Contact Number:</span>
              <span>{selectedDoc.contact || '0912-345-6789'}</span>
            </div>
            <div className="flex gap-2">
              <span className="font-bold min-w-[200px]">Target Date and Time:</span>
              <span>{selectedDoc.targetDate || 'April 15, 2026 | 1:00 PM - 4:00 PM'}</span>
            </div>
            <div className="flex gap-2">
              <span className="font-bold min-w-[200px]">Duration:</span>
              <span>{selectedDoc.duration || '3 Hours'}</span>
            </div>
            <div className="flex gap-2">
              <span className="font-bold min-w-[200px]">Number of Students:</span>
              <span>{selectedDoc.students || '60 Students'}</span>
            </div>
            <div className="flex gap-2">
              <span className="font-bold min-w-[200px]">Nature of Activity:</span>
              <span>{selectedDoc.nature || 'Co-Curricular'}</span>
            </div>

            <div className="mt-8">
              <p className="font-bold mb-3">Objectives of the Activity:</p>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>Leadership Development and Formation</li>
                <li>Membership Development and Formation</li>
                <li>Organizational Program Management</li>
                <li>Values Enrichment</li>
                <li>Technical Skills Development and Industry Exposure</li>
              </ul>
            </div>

            <div className="mt-6">
              <p className="font-bold mb-2">Target Audience / Participants: <span className="font-normal text-sm">BulSUans Only</span></p>
            </div>

            <div className="mt-8">
              <p className="font-bold mb-4 text-sm leading-relaxed">
                Describe how this activity will satisfy the needs of the organization and how it will help the organization achieve its goals:
              </p>
              <div className="bg-gray-50 p-6 rounded-2xl text-sm leading-relaxed text-gray-600 border border-gray-100 italic">
                "The ASICS Summit aims to connect students with experienced IT professionals and industry experts who will share their knowledge, career experiences and current trends in the field of information technology..."
              </div>
            </div>
          </div>
        </div>

        {/* Attached Files Section - Now Collapsible */}
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
              {[
                'Approval Letter.pdf',
                'Accomplished Activity Proposal Form.pdf',
                'Accomplished Adviser/Faculty Companion Form.pdf',
                'Parental Consent Form.pdf',
                'Declaration of Authenticity and Truthfulness.pdf',
                'Compliance Checklist For Main Campus.pdf',
                'Compliance Checklist.pdf',
                'List of Participants.pdf'
              ].map((file, idx) => (
                <div key={idx} className="bg-[#525252] rounded-xl p-4 flex items-center justify-between group hover:brightness-110 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center text-white/80">
                      <Paperclip size={20} />
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">{file}</p>
                      <p className="text-gray-400 text-[10px] uppercase">PDF Document - 2.5MB</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                    <button className="bg-secondary-gold text-white px-6 py-2 rounded-lg text-xs font-bold hover:brightness-110 transition-all shadow-lg">
                      view
                    </button>
                    <button className="bg-secondary-gold text-white px-6 py-2 rounded-lg text-xs font-bold hover:brightness-110 transition-all shadow-lg">
                      Download
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Remarks Section - Updated Layout */}
        <div className="mb-10">
          <h4 className="text-sm font-bold text-gray-800 uppercase tracking-tight mb-6">Remarks & History</h4>
          <div className="space-y-6">
            <div className="relative pl-8">
              <div className="absolute left-0 top-1.5 w-3 h-3 bg-amber-500 rounded-full border-2 border-white shadow-sm z-10"></div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-sm font-bold text-gray-800">Lance Amiel Samaniego</span>
                <span className="px-2 py-0.5 bg-gray-100 text-gray-400 text-[10px] font-bold rounded uppercase tracking-tighter">Organization</span>
              </div>
              <div className="bg-gray-100 rounded-xl p-4 flex items-center justify-between group hover:bg-gray-200 transition-all">
                <span className="text-xs font-semibold text-gray-600">Document Submitted</span>
                <span className="text-[10px] text-gray-400 font-medium">Jan 27, 2025 10:00 AM</span>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Fixed Footer Actions */}
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-white/80 backdrop-blur-2xl px-10 py-5 rounded-[2rem] border border-white/50 shadow-[0_20px_50px_rgba(0,0,0,0.15)] flex items-center gap-6 animate-in slide-in-from-bottom-12 duration-1000">
            <button className="flex items-center gap-3 px-8 py-3.5 bg-primary-green text-white rounded-2xl font-bold hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary-green/20 group">
              <CheckCircle size={20} className="group-hover:rotate-12 transition-transform" />
              <span className="uppercase text-xs tracking-widest">Approve</span>
            </button>
            
            <div className="h-10 w-[1px] bg-gray-200/50"></div>

            <button className="flex items-center gap-3 px-8 py-3.5 bg-amber-500 text-white rounded-2xl font-bold hover:scale-105 active:scale-95 transition-all shadow-lg shadow-amber-500/20 group">
              <RotateCcw size={20} className="group-hover:-rotate-45 transition-transform" />
              <span className="uppercase text-xs tracking-widest">Return</span>
            </button>

            <button className="flex items-center gap-3 px-8 py-3.5 bg-red-600 text-white rounded-2xl font-bold hover:scale-105 active:scale-95 transition-all shadow-lg shadow-red-600/20 group">
              <X size={20} className="group-hover:scale-110 transition-transform" />
              <span className="uppercase text-xs tracking-widest">Disapprove</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-6 duration-1000">
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
      <div className="flex items-center justify-between mb-6">
        <button className="flex items-center gap-2 text-gray-400 hover:text-primary-green transition-all font-medium group text-sm">
          <RefreshCcw size={16} className="group-hover:rotate-180 transition-transform duration-700" />
          <span>Sync List</span>
        </button>
        
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
            <div className="absolute right-0 mt-3 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 p-2 animate-in zoom-in-95 duration-200">
              <div className="px-4 py-2 border-b border-gray-50 mb-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Filter Options</p>
              </div>
              {[
                { label: 'All Documents', value: 'All' },
                { label: 'Activity Proposals', value: 'Activity Proposal' },
                { label: 'Accreditation Renewal', value: 'Renewal' },
                { label: 'Midyear & Year End', value: 'Midyear & Year End Report' },
                { divider: true },
                { label: 'Newest First', value: 'Newest' },
                { label: 'Oldest First', value: 'Oldest' }
              ].map((item, idx) => item.divider ? (
                <div key={idx} className="h-[1px] bg-gray-50 my-1 mx-2"></div>
              ) : (
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
      <div className="bg-white border border-gray-100 rounded-2xl px-6 py-3.5 flex items-center justify-between shadow-sm mb-4">
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
              <span className="text-secondary-gold font-bold">3 Urgent</span>
              <span className="text-gray-300 mx-2">•</span>
              <span>{filteredData.length} Total</span>
            </>
          )}
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm mb-10">
        <div className="overflow-x-auto">
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
                    <span className="text-sm font-medium text-gray-600 uppercase tracking-tight">{item.org}</span>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <span className="inline-block px-4 py-1 border border-gray-100 text-gray-500 text-[10px] font-semibold rounded-lg bg-white shadow-sm group-hover:border-primary-green/20 group-hover:text-primary-green transition-all uppercase">
                      {item.type}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-sm text-gray-500 font-medium">
                    {item.time}
                  </td>
                  <td className="px-6 py-5 text-center">
                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-bold shadow-sm inline-block min-w-[120px] transition-all uppercase ${
                      item.status === 'Approved' ? 'bg-green-100 text-green-700' : 'bg-[#D9E666] text-[#6A7B2C]'
                    }`}>
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
    </div>
  );
};

export const MyDocuments = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = React.useState('All');
  const [searchQuery, setSearchQuery] = React.useState('');

  const documents = [
    { 
      id: 1, 
      title: 'ASICS Summit', 
      ref: 'AP-2026-03-001', 
      sender: 'ASICS', 
      type: 'Activity Proposal', 
      submittedDate: 'Jan 28, 2025', 
      status: 'To Forward', 
      lastAction: 'March 18, 2025',
      category: 'To Forward'
    },
    { 
      id: 2, 
      title: 'ASICS Mid-Year Report', 
      ref: 'MYP-2026-03-001', 
      sender: 'ASICS', 
      type: 'Mid Year Report', 
      submittedDate: 'Jan 28, 2025', 
      status: 'SDS Coordinator Review', 
      lastAction: 'March 18, 2025',
      category: 'SDS Review'
    }
  ];

  const tabs = [
    { name: 'All', count: 2 },
    { name: 'To Forward', count: 1 },
    { name: 'SDS Review', count: 1 },
    { name: 'Dean Review', count: 0 },
    { name: 'External Review', count: 0 },
    { name: 'Approved', count: 0 }
  ];

  const filteredDocs = activeTab === 'All' 
    ? documents 
    : documents.filter(doc => doc.category === activeTab);

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
            <p className="text-gray-400 text-sm">Track your submitted and reviewed document status</p>
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

      {/* Tabs - Matching Inbox Tab Style */}
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

        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm hover:border-primary-green transition-all shadow-sm">
            <Filter size={16} />
            <span>Filter</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-semibold text-sm shadow-md hover:bg-blue-700 transition-all">
            <FileText size={16} />
            <span>Generate Report</span>
          </button>
        </div>
      </div>

      {/* Table Container - Matching Inbox Style */}
      <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm mb-10">
        <div className="overflow-x-auto">
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
                <tr key={doc.id} className="group transition-all duration-300 hover:bg-gray-50/50 cursor-pointer">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <FileText className="text-secondary-gold opacity-50" size={20} />
                      <div>
                        <p className="font-semibold text-gray-800 group-hover:text-primary-green transition-colors uppercase text-sm leading-tight">{doc.title}</p>
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
                      doc.status === 'To Forward' ? 'bg-pink-600' : 'bg-blue-500'
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
        </div>
      </div>
    </div>
  );
};

// Moved to separate file: UserManagement.jsx

export const ListOfRequirements = () => (
  <div>
    <PageHeader title="List of Requirements" />
    <Card>
      <div className="space-y-4">
        {['Accreditation Form', 'List of Officers', 'Activity Proposal', 'Financial Plan'].map(req => (
          <div key={req} className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:border-secondary-gold transition-colors">
            <span className="font-medium text-gray-700">{req}</span>
            <span className="text-xs text-gray-400 font-mono uppercase">Required</span>
          </div>
        ))}
      </div>
    </Card>
  </div>
);

export const Completed = () => (
  <div>
    <PageHeader title="Completed" />
    <Card>
      <p className="text-gray-600">List of all completed document processes.</p>
    </Card>
  </div>
);

export const SubmitNewDocuments = () => (
  <div>
    <PageHeader title="Submit New Documents" />
    <Card>
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Document Title</label>
          <input className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-green outline-none" placeholder="e.g. Activity Report" />
        </div>
        <div className="border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center hover:border-primary-green transition-colors">
          <p className="text-gray-400">Drag and drop files here or click to browse</p>
        </div>
        <button className="bg-primary-green text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:shadow-primary-green/20 transition-all">
          Upload Document
        </button>
      </div>
    </Card>
  </div>
);

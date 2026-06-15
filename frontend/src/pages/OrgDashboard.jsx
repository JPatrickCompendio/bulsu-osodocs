import React, { useState, useEffect } from 'react';
import { apiClient, apiUrl } from '../config/apiClient';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, CheckCircle, Clock, AlertCircle, RefreshCcw, 
  ChevronRight, Calendar, User, Activity, Bell, FileCheck, XCircle
} from 'lucide-react';

const OrgDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [showDates, setShowDates] = useState(false);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(apiUrl('/api/org/dashboard'), {
        params: { userId: user?.id },
      });
      if (res.data?.success) {
        setData(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load org dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const s = status ? status.toLowerCase() : '';
    if (s.includes('to forward') || s === 'submitted') return '#db2777';
    if (s.includes('chairman')) return '#c2bc13';
    if (s.includes('sds') || s === 'oso approved') return '#6366f1';
    if (s.includes('dean')) return '#1e3a8a';
    if (s.includes('external')) return '#d76b0d';
    if (s.includes('approved') || s.includes('waiting for accomplishment report')) return '#105220';
    if (s.includes('returned')) return '#f59e0b';
    if (s.includes('disapproved')) return '#ef4444';
    if (s.includes('completed')) return '#22b814';
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

  const formatStatus = (s) => {
    if (!s) return 'Unknown';
    if (s === 'submitted') return 'To forward and hardcopy submission for org president';
    if (s === 'oso approved') return 'SDS coordinator review';
    if (s === 'sds approved' || s === 'chairman approved') return 'Chairman and vice chairman review';
    if (s === 'vice chairman approved') return 'External review';
    if (s === 'external approved') return 'Dean review';
    if (s === 'dean approved' || s === 'waiting for accomplishment report') return 'Approved';
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <RefreshCcw className="animate-spin text-primary-green" size={40} />
      </div>
    );
  }

  if (!data) return <div className="p-8">Failed to load dashboard.</div>;

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="min-h-screen bg-[#F8F9FA] p-8 pb-32">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* HERO AND STATISTICS SECTION */}
        <div className="bg-[#0b5c2a] rounded-xl p-8 text-white shadow-lg relative overflow-hidden">
          {/* Top Row: Date and Semester */}
          <div className="flex justify-between items-start mb-8 relative z-10">
            <p className="text-green-100 font-medium text-sm">{today}</p>
            
            <div className="relative group cursor-pointer bg-white/10 hover:bg-white/20 transition-all rounded-full px-4 py-2 flex items-center gap-2"
                 onClick={() => setShowDates(!showDates)}>
              <Calendar size={14} className="text-green-100" />
              <span className="text-xs font-semibold text-green-50 tracking-wider">
                {data.hero.activeSy?.name || 'No Active SY'}
              </span>
              
              {showDates && data.hero.activeSy && (
                <div className="absolute top-full right-0 mt-2 bg-white text-gray-800 rounded-lg p-4 shadow-xl border border-gray-100 z-20 animate-in fade-in slide-in-from-top-2 min-w-[250px]">
                  <p className="text-xs font-bold text-gray-400 uppercase mb-2">{data.hero.activeSy.semester_type || 'Semester'} Dates</p>
                  <div className="flex justify-between items-center text-sm font-semibold">
                    <span className="text-[#0b5c2a]">{formatDate(data.hero.activeSy.start_date)}</span>
                    <span className="text-gray-300">-</span>
                    <span className="text-red-500">{formatDate(data.hero.activeSy.end_date)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Welcome Text */}
          <div className="mb-10 relative z-10 flex items-center gap-4">
            <div className="grid grid-cols-2 gap-1 w-12 h-12 opacity-80">
              <div className="bg-green-400 rounded-tl-lg"></div>
              <div className="bg-green-400 rounded-tr-lg"></div>
              <div className="bg-green-400 rounded-bl-lg"></div>
              <div className="bg-green-400 rounded-br-lg"></div>
            </div>
            <div>
              <h1 className="text-4xl font-black mb-1 uppercase tracking-tight">
                WELCOME BACK, {data.hero.user?.full_name ? data.hero.user.full_name.split(' ')[0] : 'President'}!
              </h1>
              <p className="text-green-100 text-sm font-medium">
                {data.hero.user?.org_name || 'Organization'} • Organization President
              </p>
            </div>
          </div>

          {/* 4 Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
            {/* Pending Review */}
            <div className="bg-white rounded-lg p-5 text-gray-800 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Pending Review</p>
                  <p className="text-3xl font-black mt-1">{data.statistics.pendingCount}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-yellow-50 text-yellow-500 flex items-center justify-center">
                  <Clock size={20} />
                </div>
              </div>
              <div className="pt-3 border-t border-gray-100">
                <button onClick={() => navigate('/my-documents')} className="text-[10px] font-bold text-green-600 hover:text-green-700 uppercase flex items-center gap-1">
                  View Details <ChevronRight size={12} />
                </button>
              </div>
            </div>

            {/* Approved */}
            <div className="bg-white rounded-lg p-5 text-gray-800 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Approved</p>
                  <p className="text-3xl font-black mt-1">{data.statistics.approvedCount}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-green-100 text-green-600 flex items-center justify-center">
                  <CheckCircle size={20} />
                </div>
              </div>
              <div className="pt-3 border-t border-gray-100">
                <button onClick={() => navigate('/my-documents')} className="text-[10px] font-bold text-green-600 hover:text-green-700 uppercase flex items-center gap-1">
                  View Details <ChevronRight size={12} />
                </button>
              </div>
            </div>

            {/* Returned */}
            <div className="bg-white rounded-lg p-5 text-gray-800 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Returned</p>
                  <p className="text-3xl font-black mt-1">{data.statistics.returnedCount}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center">
                  <RefreshCcw size={20} />
                </div>
              </div>
              <div className="pt-3 border-t border-gray-100">
                <button onClick={() => navigate('/my-documents')} className="text-[10px] font-bold text-green-600 hover:text-green-700 uppercase flex items-center gap-1">
                  View Details <ChevronRight size={12} />
                </button>
              </div>
            </div>

            {/* Completed */}
            <div className="bg-white rounded-lg p-5 text-gray-800 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Completed</p>
                  <p className="text-3xl font-black mt-1">{data.statistics.completedCount}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-red-50 text-red-500 flex items-center justify-center">
                  <CheckCircle size={20} />
                </div>
              </div>
              <div className="pt-3 border-t border-gray-100">
                <button onClick={() => navigate('/my-documents')} className="text-[10px] font-bold text-green-600 hover:text-green-700 uppercase flex items-center gap-1">
                  View Details <ChevronRight size={12} />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* SECTION 1: DOCUMENTS UNDER REVIEW */}
          <section className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-50 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-gray-800 uppercase tracking-tight">Documents Under Review</h2>
                <p className="text-xs font-bold text-gray-400 mt-1">Track your active submissions</p>
              </div>
            </div>
            <div className="flex-1 p-0 overflow-x-auto">
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
                    data.activeDocuments.map(doc => {
                      const statusName = formatStatus(doc.status);
                      const typeColor = getDocTypeColor(doc.type);
                      return (
                        <tr key={doc.id} className="hover:bg-gray-50/50 transition-colors cursor-pointer" onClick={() => navigate(`/my-documents?submissionId=${doc.id}`)}>
                          <td className="px-6 py-4">
                            <p className="font-bold text-sm text-gray-800 line-clamp-1" title={doc.title}>{doc.title}</p>
                            <span 
                              className="inline-block mt-1 px-2 py-0.5 text-[9px] font-black uppercase rounded border"
                              style={{ color: typeColor, borderColor: typeColor, backgroundColor: `${typeColor}10` }}
                            >
                              {doc.type}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {doc.latestLog ? (
                              <div>
                                <p className="text-xs font-semibold text-gray-600 line-clamp-2">
                                  {doc.latestLog.description || doc.latestLog.comment || 'Status updated'}
                                </p>
                                <p className="text-[10px] text-gray-400 font-bold mt-1">
                                  {new Date(doc.latestLog.created_at).toLocaleString('en-US', { 
                                    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' 
                                  })}
                                </p>
                              </div>
                            ) : (
                              <p className="text-xs italic text-gray-400">No logs yet</p>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span 
                              className="inline-block px-3 py-1 text-[10px] font-black uppercase rounded-full"
                              style={{ backgroundColor: getStatusColor(statusName), color: '#fff' }}
                            >
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
            {/* SECTION 3: ORGANIZATION RENEWAL */}
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

            {/* SECTION 2: CURRENT ANNOUNCEMENTS */}
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col">
              <div className="p-6 border-b border-gray-50 flex items-center gap-2">
                <Bell size={20} className="text-gray-400" />
                <h2 className="text-lg font-black text-gray-800 uppercase tracking-tight">Announcements</h2>
              </div>
              <div className="p-0">
                {data.announcements.length === 0 ? (
                  <div className="p-6 text-center text-gray-400 font-bold text-sm">No announcements at this time.</div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {data.announcements.map(ann => (
                      <div key={ann.id} className="p-6 hover:bg-gray-50 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-bold text-gray-800 text-sm">{ann.title}</h3>
                          <span className="text-[10px] font-bold text-gray-400 whitespace-nowrap bg-gray-100 px-2 py-1 rounded">
                            {formatDate(ann.created_at)}
                          </span>
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
    </div>
  );
};

export default OrgDashboard;

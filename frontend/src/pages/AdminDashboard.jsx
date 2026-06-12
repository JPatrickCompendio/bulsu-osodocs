import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, CheckCircle, Clock, AlertCircle, RefreshCcw, 
  ChevronRight, BarChart2, PieChart, Activity, UserCheck, Search, Filter 
} from 'lucide-react';

const AdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const res = await axios.get('http://localhost:5000/api/admin/dashboard');
      if (res.data?.success) {
        setStats(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load admin dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return 'ORG';
    const words = name.split(' ');
    if (words.length === 1) return name.substring(0, 2).toUpperCase();
    return words.map(w => w[0]).join('').substring(0, 3).toUpperCase();
  };

  const getStatusColor = (status) => {
    const s = status ? status.toLowerCase() : '';
    if (s.includes('to forward') || s === 'submitted') return '#db2777';
    if (s.includes('chairman')) return '#c2bc13';
    if (s.includes('sds') || s === 'oso approved') return '#6366f1';
    if (s.includes('dean')) return '#1e3a8a';
    if (s.includes('external')) return '#d76b0d';
    if (s.includes('disapproved')) return '#ef4444';
    if (s.includes('approved') || s.includes('waiting for accomplishment report')) return '#105220';
    if (s.includes('returned')) return '#f59e0b';
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

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <RefreshCcw className="animate-spin text-primary-green" size={40} />
      </div>
    );
  }

  if (!stats) return <div className="p-8">Failed to load dashboard.</div>;

  return (
    <div className="min-h-screen bg-[#F8F9FA] p-8 pb-32">
      <div className="max-w-7xl mx-auto space-y-8">
        
        <div className="mb-8">
          <h1 className="text-3xl font-black text-gray-800 tracking-tight">Admin Dashboard</h1>
          <p className="text-gray-400 font-bold text-sm mt-1">System Overview and Analytics</p>
        </div>

        {/* SECTION 1: Statistics */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-pink-50 text-pink-500 flex items-center justify-center shrink-0">
              <UserCheck size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase">Eligible for Renewal</p>
              <p className="text-2xl font-black text-gray-800">{stats.statistics.eligibleForRenewalCount}</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
              <Activity size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase">Active Under Review</p>
              <p className="text-2xl font-black text-gray-800">{stats.statistics.activeReviewCount}</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-50 text-green-500 flex items-center justify-center shrink-0">
              <FileText size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase">Current SY Docs</p>
              <p className="text-2xl font-black text-gray-800">{stats.statistics.currentSyCount}</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-500 flex items-center justify-center shrink-0">
              <BarChart2 size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase">All-Time Docs</p>
              <p className="text-2xl font-black text-gray-800">{stats.statistics.allTimeCount}</p>
            </div>
          </div>
        </section>

        {/* SECTION 2: Active Documents Overview */}
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
                  stats.activeDocuments.map(doc => {
                    const statusName = formatStatus(doc.status);
                    
                    let docTitle = `Submission #${doc.id.substring(0,6).toUpperCase()}`;
                    if (doc.submission_versions && doc.submission_versions.length > 0) {
                      const latest = doc.submission_versions.reduce((max, v) => (v.version_number > max.version_number ? v : max), doc.submission_versions[0]);
                      const details = Array.isArray(latest.activity_proposal_details) ? latest.activity_proposal_details[0] : latest.activity_proposal_details;
                      if (details?.activity_title) {
                        docTitle = details.activity_title;
                      } else {
                        docTitle = `${doc.documentType?.name || 'Document'} #${doc.id.substring(0,6).toUpperCase()}`;
                      }
                    } else {
                      docTitle = `${doc.documentType?.name || 'Document'} #${doc.id.substring(0,6).toUpperCase()}`;
                    }

                    return (
                      <tr key={doc.id} className="hover:bg-gray-50/50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="font-bold text-sm text-gray-800 line-clamp-2 max-w-xs" title={docTitle}>{docTitle}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-sm text-gray-600 line-clamp-2 max-w-[150px]" title={doc.users?.org_name}>{doc.users?.org_name || 'N/A'}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span 
                            className="px-3 py-1 text-[10px] font-black uppercase rounded-full border"
                            style={{ 
                              color: getDocTypeColor(doc.documentType?.name), 
                              borderColor: getDocTypeColor(doc.documentType?.name),
                              backgroundColor: `${getDocTypeColor(doc.documentType?.name)}10` 
                            }}
                          >
                            {doc.documentType?.name || 'Unknown'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span 
                            className="px-3 py-1 text-[10px] font-black uppercase rounded-full"
                            style={{ 
                              backgroundColor: getStatusColor(statusName), 
                              color: '#fff' 
                            }}
                          >
                            {statusName}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => navigate(`/my-documents?submissionId=${doc.id}`)}
                            className="p-2 text-gray-400 hover:text-primary-green transition-colors rounded-lg hover:bg-green-50"
                          >
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
          {/* SECTION 3: Document Status Breakdown */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col">
            <div className="p-6 border-b border-gray-50">
              <h2 className="text-lg font-black text-gray-800 uppercase">Document Status Breakdown</h2>
              <p className="text-xs font-bold text-gray-400">Distribution across review stages</p>
            </div>
            <div className="p-6 flex-1 space-y-4">
              {Object.entries(stats.statusBreakdown).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: getStatusColor(status) }}
                    />
                    <span className="text-sm font-bold text-gray-600 capitalize">{status}</span>
                  </div>
                  <span className="font-black text-gray-800 bg-gray-50 px-3 py-1 rounded-lg border border-gray-100">{count}</span>
                </div>
              ))}
            </div>
          </section>

          <div className="space-y-8">
            {/* SECTION 4: Common Submission Errors */}
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
                        <div className="w-8 h-8 rounded bg-red-50 text-red-500 font-black flex items-center justify-center shrink-0">
                          {i + 1}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-gray-700">{err.reason}</p>
                          <div className="w-full bg-gray-100 h-1.5 rounded-full mt-2 overflow-hidden">
                            <div 
                              className="bg-red-400 h-full rounded-full" 
                              style={{ width: `${Math.min((err.count / (stats.commonErrors[0]?.count || 1)) * 100, 100)}%` }}
                            />
                          </div>
                        </div>
                        <div className="font-black text-red-500 text-sm w-8 text-right">{err.count}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* SECTION 5: Revision Analysis */}
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100">
              <div className="p-6 border-b border-gray-50">
                <h2 className="text-lg font-black text-gray-800 uppercase">Revision Analysis</h2>
                <p className="text-xs font-bold text-gray-400">Document revision metrics and highly revised items</p>
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
    </div>
  );
};

export default AdminDashboard;

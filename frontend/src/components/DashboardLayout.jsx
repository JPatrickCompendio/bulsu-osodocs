import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Bell, Search, X, Check, CheckCircle2, Megaphone, FileText, ChevronRight, Paperclip, ExternalLink, Image as ImageIcon, ShieldAlert, AlertTriangle, Lock, Clock, LogOut, User as UserIcon, Calendar } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiClient, apiUrl } from '../config/apiClient';
import { supabase } from '../supabaseClient';
import PageTransition from './PageTransition';
import {
  getNotificationDestination,
  extractSubmissionIdFromNotification,
  extractSubmissionStatusFromNotification,
  normalizeWorkflowStatus,
} from '../utils/workflowNotificationUtils';
import SchoolYearCalendarModal from './SchoolYearCalendarModal';

const Header = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [filter, setFilter] = useState('all');
  const [activeSy, setActiveSy] = useState(null);
  const [readNotifIds, setReadNotifIds] = useState(() => {
    const saved = localStorage.getItem('readNotifIds');
    return saved ? JSON.parse(saved) : [];
  });

  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [announcementAttachments, setAnnouncementAttachments] = useState([]);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);

  const fetchNotifications = async () => {
    if (!user?.id || !user?.role) return;
    try {
      const res = await apiClient.get(apiUrl('/api/notifications'), {
        params: {
          userId: user.id,
          role: user.role,
          orgName: user.org_name || '',
        },
      });
      if (res.data.success) {
        setNotifications(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    const fetchSy = async () => {
      const { data } = await supabase
        .from('school_years')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();
      setActiveSy(data);
    };
    fetchSy();
  }, []);

  useEffect(() => {
    localStorage.setItem('readNotifIds', JSON.stringify(readNotifIds));
  }, [readNotifIds]);

  const loadAttachment = async (announcementId) => {
    try {
      setAnnouncementAttachments([]);
      const folderPath = `announcements/${announcementId}`;
      const { data, error } = await supabase.storage.from('documents').list(folderPath);

      if (data && data.length > 0) {
        const files = data.filter(f => f.name !== '.emptyFolderPlaceholder');

        if (files.length > 0) {
          const filePromises = files.map(async (file) => {
            const { data: signedUrlData } = await supabase.storage
              .from('documents')
              .createSignedUrl(`${folderPath}/${file.name}`, 3600);

            if (signedUrlData) {
              return {
                name: file.name,
                url: signedUrlData.signedUrl,
                isImage: file.name.match(/\.(jpeg|jpg|gif|png)$/i) != null
              };
            }
            return null;
          });

          const attachments = (await Promise.all(filePromises)).filter(Boolean);
          setAnnouncementAttachments(attachments);
        }
      }
    } catch (err) {
      console.error('Error loading attachments:', err);
    }
  };

  const handleNotificationClick = async (notif) => {
    if (!readNotifIds.includes(notif.id)) {
      setReadNotifIds(prev => [...prev, notif.id]);
    }

    if (notif.type === 'announcement') {
      setSelectedAnnouncement(notif.source);
      loadAttachment(notif.source.id);
      return;
    }

    const source = notif.source || {};
    const submissionId = extractSubmissionIdFromNotification(source);

    setIsModalOpen(false);

    if (submissionId) {
      const role = String(user?.role || '').toLowerCase();
      let status = extractSubmissionStatusFromNotification(source);

      if (!status) {
        const { data } = await supabase
          .from('submissions')
          .select('status')
          .eq('id', submissionId)
          .maybeSingle();
        status = data?.status || null;
      }

      if (role === 'org-president') {
        const normalized = normalizeWorkflowStatus(status);
        if (['completed', 'disapproved', 'rejected'].includes(normalized)) {
          navigate('/completed', { state: { openDocId: submissionId } });
        } else {
          navigate('/my-documents', { state: { submissionId, highlightedId: submissionId, openSubmission: true } });
        }
        return;
      }

      if (role === 'admin' || role === 'chairman' || role === 'vice-chairman') {
        const destination = getNotificationDestination(role, submissionId, status);
        navigate(destination.path, { state: destination.state });
        return;
      }

      navigate('/my-documents', { state: { submissionId, highlightedId: submissionId, openSubmission: true } });
      return;
    }

    if (user?.role === 'admin' || user?.role === 'chairman' || user?.role === 'vice-chairman') {
      navigate('/inbox');
    } else {
      navigate('/my-documents');
    }
  };

  const markAllAsRead = () => {
    const allIds = notifications.map(n => n.id);
    setReadNotifIds(allIds);
  };

  const unreadCount = notifications.filter(n => !readNotifIds.includes(n.id)).length;
  const filteredNotifications = notifications.filter(n => {
    if (filter === 'all') return true;
    return n.type === filter;
  });

  return (
    <>
      <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-8 sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-2 text-gray-700 relative group cursor-pointer" onClick={() => setIsCalendarModalOpen(true)}>
          <Calendar size={20} />
          <span className="text-sm font-bold hover:text-primary-green transition-colors">{activeSy ? ` ${activeSy.name}` : 'Loading S.Y...'}</span>
          
          {activeSy && (
            <div className="absolute top-full left-0 mt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 bg-white text-gray-800 rounded-lg p-4 shadow-xl border border-gray-100 z-50 min-w-[250px]">
              <p className="text-xs font-bold text-gray-400 uppercase mb-2">{activeSy.semester_type || 'Semester'} Dates</p>
              <div className="flex justify-between items-center text-sm font-semibold mb-2">
                <span className="text-green-600">{new Date(activeSy.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                <span className="text-gray-300">-</span>
                <span className="text-red-500">{new Date(activeSy.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </div>
              <div className="text-xs text-primary-green font-bold text-center mt-3 pt-3 border-t border-gray-50 flex items-center justify-center gap-1">
                <Calendar size={12} />
                Click to view Calendar Events
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-6">
          <button
            onClick={() => setIsModalOpen(!isModalOpen)}
            className="relative p-2 text-gray-500 hover:bg-gray-50 rounded-full transition-colors group"
          >
            <Bell size={22} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center border-2 border-white shadow-sm group-hover:scale-110 transition-transform">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          <div className="h-8 w-[1px] bg-gray-100"></div>

          <div className="flex items-center gap-3 relative">
            <button
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              className="flex items-center gap-3 hover:bg-gray-50 p-2 rounded-xl transition-colors text-left"
            >
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-gray-800">{user?.full_name || user?.username}</p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">{user?.role}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-primary-green flex items-center justify-center text-white font-bold border-2 border-white shadow-sm overflow-hidden">
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  (user?.full_name || user?.username)?.charAt(0).toUpperCase() || '?'
                )}
              </div>
            </button>

            {showUserDropdown && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowUserDropdown(false)}
                />
                <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                  <div className="p-4 border-b border-gray-100">
                    <p className="text-sm font-bold text-gray-800 truncate">{user?.full_name || user?.username}</p>
                    <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                  </div>
                  <div className="p-2">
                    <button
                      onClick={() => {
                        setShowUserDropdown(false);
                        navigate('/profile');
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-primary-green rounded-lg transition-colors font-medium"
                    >
                      <UserIcon size={16} />
                      My Profile
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {isModalOpen && !selectedAnnouncement && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-2">
                <Bell size={18} className="text-primary-green" />
                <h2 className="text-lg font-bold text-gray-800">Notifications</h2>
                {unreadCount > 0 && (
                  <span className="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-full ml-1">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                  >
                    <Check size={14} />
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex border-b border-gray-100 px-4 pt-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${filter === 'all' ? 'border-primary-green text-primary-green' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('announcement')}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${filter === 'announcement' ? 'border-primary-green text-primary-green' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                Announcements
              </button>
              <button
                onClick={() => setFilter('workflow')}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${filter === 'workflow' ? 'border-primary-green text-primary-green' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                Workflow Updates
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 bg-gray-50/30">
              {filteredNotifications.length === 0 ? (
                <div className="p-8 text-center flex flex-col items-center justify-center h-full">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                    <CheckCircle2 size={32} className="text-gray-300" />
                  </div>
                  <h3 className="text-gray-800 font-medium">All caught up!</h3>
                  <p className="text-sm text-gray-500 mt-1">No new notifications here.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredNotifications.map((notif) => {
                    const isRead = readNotifIds.includes(notif.id);
                    const isAnnouncement = notif.type === 'announcement';

                    return (
                      <div
                        key={notif.id}
                        onClick={() => handleNotificationClick(notif)}
                        className={`p-4 rounded-xl cursor-pointer transition-all border ${isRead
                            ? 'bg-white border-transparent hover:border-gray-200'
                            : 'bg-blue-50/50 border-blue-100/50 relative overflow-hidden'
                          }`}
                      >
                        {!isRead && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"></div>
                        )}
                        <div className="flex gap-3">
                          <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isAnnouncement ? 'bg-amber-100 text-amber-600' : 'bg-primary-green/10 text-primary-green'
                            }`}>
                            {isAnnouncement ? <Megaphone size={14} /> : <FileText size={14} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start gap-2 mb-1">
                              <h4 className={`text-sm font-bold truncate ${isRead ? 'text-gray-700' : 'text-gray-900'}`}>
                                {notif.title}
                              </h4>
                              <span className="text-[10px] text-gray-400 whitespace-nowrap font-medium shrink-0">
                                {new Date(notif.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                              {notif.message}
                            </p>

                            {!isAnnouncement && notif.source?.submissions && (
                              <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-primary-green uppercase tracking-wider">
                                View document <ChevronRight size={12} />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedAnnouncement && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedAnnouncement(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="relative h-20 bg-gradient-to-r from-amber-500 to-orange-400 px-6 py-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white">
                  <Megaphone size={20} />
                </div>
                <div>
                  <div className="text-white/80 text-[10px] font-bold uppercase tracking-widest mb-0.5">System Announcement</div>
                  <h2 className="text-white font-bold text-lg leading-tight">Notice</h2>
                </div>
              </div>
              <button
                onClick={() => setSelectedAnnouncement(null)}
                className="w-8 h-8 flex items-center justify-center bg-black/10 hover:bg-black/20 text-white rounded-full transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-8 overflow-y-auto">
              <h3 className="font-bold text-2xl text-gray-800 mb-2 leading-tight">{selectedAnnouncement.title}</h3>
              <div className="flex items-center gap-2 text-xs text-gray-500 font-medium mb-6">
                <span>Posted {new Date(selectedAnnouncement.created_at).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                <span>•</span>
                <span className="px-2 py-0.5 bg-gray-100 rounded text-[10px] uppercase tracking-wider">{selectedAnnouncement.target_audience}</span>
              </div>

              <div className="prose prose-sm max-w-none text-gray-600 leading-relaxed whitespace-pre-wrap">
                {selectedAnnouncement.content}
              </div>

              {announcementAttachments.length > 0 && (
                <div className="mt-8 pt-6 border-t border-gray-100">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Attachments</h4>

                  {/* Images Gallery */}
                  {announcementAttachments.filter(a => a.isImage).length > 0 && (
                    <div className="mb-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {announcementAttachments.filter(a => a.isImage).map((img, idx) => (
                          <div key={idx} className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center">
                            <img
                              src={img.url}
                              alt={`Attachment ${idx + 1}`}
                              className="w-full h-auto max-h-[300px] object-cover hover:scale-105 transition-transform duration-300"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Documents List */}
                  {announcementAttachments.filter(a => !a.isImage).length > 0 && (
                    <div className="space-y-3">
                      {announcementAttachments.filter(a => !a.isImage).map((doc, idx) => (
                        <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-blue-50/50 border border-blue-100 rounded-xl hover:bg-blue-50 transition-colors group">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                              <FileText size={20} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-bold text-gray-800 truncate" title={doc.name}>{doc.name}</div>
                              <div className="text-xs text-gray-500 mt-0.5">Document File</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 pl-12 sm:pl-0 shrink-0">
                            <a
                              href={doc.url}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3 py-1.5 bg-white border border-gray-200 text-gray-600 hover:text-blue-600 text-xs font-bold rounded-lg hover:bg-gray-50 transition-colors shadow-sm flex items-center gap-1.5"
                            >
                              <ExternalLink size={14} /> Preview
                            </a>
                            <a
                              href={`${doc.url}&download=`}
                              download
                              className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-1.5"
                            >
                              <Paperclip size={14} /> Download
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end shrink-0">
              <button
                onClick={() => setSelectedAnnouncement(null)}
                className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-bold rounded-xl hover:bg-gray-50 hover:text-gray-900 transition-colors shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {isCalendarModalOpen && (
        <SchoolYearCalendarModal
          activeSy={activeSy}
          onClose={() => setIsCalendarModalOpen(false)}
        />
      )}
    </>
  );
};

const DashboardLayout = () => {
  return (
    <div className="flex h-screen bg-[#f8fafc]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-8 relative">
          <PageTransition>
            <div className="max-w-7xl mx-auto">
              <Outlet />
            </div>
          </PageTransition>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;

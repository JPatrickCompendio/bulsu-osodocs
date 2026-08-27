import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Bell, Search, X, Check, CheckCircle2, Megaphone, FileText, ChevronRight, Paperclip, ExternalLink, Image as ImageIcon, ShieldAlert, AlertTriangle, Lock, Clock, LogOut, User as UserIcon, Calendar, Menu } from 'lucide-react';
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
import OnboardingOverlay from './OnboardingOverlay';
import Avatar from './Avatar';

function formatHeadlineTitle(sub, activityTitle = '', maxTitleLength = 40) {
  if (activityTitle && activityTitle.trim()) {
    const cleanTitle = activityTitle.trim();
    return cleanTitle.length > maxTitleLength
      ? `${cleanTitle.slice(0, maxTitleLength).trim()}...`
      : cleanTitle;
  }

  const docType = sub?.documentType?.name || sub?.document_type?.name || 'Submission';
  return docType;
}

function getDocumentTypeName(sub) {
  if (!sub) return 'Document';
  return sub.documentType?.name || sub.document_type?.name || 'Document';
}

function formatNotificationTitle(sub, actionLabel, activityTitle = '') {
  return formatHeadlineTitle(sub, activityTitle, 40);
}

const isAnnouncementTargetedToUser = (ann, user) => {
  if (!ann || ann.is_active === false) return false;

  const role = String(user?.role || '').toLowerCase().trim();
  if (role === 'admin') return false;

  const target = String(ann.target_audience || 'all').trim();
  const targetLower = target.toLowerCase();

  if (targetLower === 'all') return true;

  if (targetLower.startsWith('org:')) {
    const targetOrg = target.substring(4).trim().toLowerCase();
    const userOrg = String(user?.org_name || '').trim().toLowerCase();
    return role === 'org-president' && !!userOrg && userOrg === targetOrg;
  }

  if (targetLower === 'all-orgs' || targetLower === 'org-president' || targetLower === 'organization') {
    return role === 'org-president';
  }

  if (targetLower === 'oso-staff' || targetLower === 'oso_staff') {
    return role === 'oso-staff' || role === 'chairman' || role === 'vice-chairman';
  }

  if (targetLower === 'sds-coordinator' || targetLower === 'sds_coordinator') {
    return role === 'sds-coordinator';
  }

  if (targetLower === 'chairman') {
    return role === 'chairman';
  }

  if (targetLower === 'vice-chairman' || targetLower === 'vice_chairman') {
    return role === 'vice-chairman';
  }

  return role === targetLower;
};

const fetchActivityTitlesMap = async (subIds) => {
  if (!subIds || subIds.length === 0) return {};
  try {
    const { data: verData } = await supabase
      .from('submission_versions')
      .select('submission_id, activity_proposal_details(activity_title)')
      .in('submission_id', subIds);

    const map = {};
    if (verData) {
      verData.forEach((v) => {
        if (!v.submission_id) return;
        const details = Array.isArray(v.activity_proposal_details) 
          ? v.activity_proposal_details[0] 
          : v.activity_proposal_details;
        if (details?.activity_title && !map[v.submission_id]) {
          map[v.submission_id] = details.activity_title;
        }
      });
    }
    return map;
  } catch (err) {
    console.warn('Failed to fetch activity titles map:', err);
    return {};
  }
};

function isWorkflowLogRelevantForRole(role, log, submission) {
  if (!submission) return false;

  const status = String(submission.status || '').toLowerCase();
  const actionType = String(log?.action_type || '').toLowerCase();
  const phase = String(log?.workflow_phase || '').toLowerCase();
  const desc = (String(log?.description || '') + ' ' + String(log?.message || '') + ' ' + String(log?.comment || '')).toLowerCase();
  const normRole = String(role || '').toLowerCase();

  if (status === 'draft') return false;
  if (['created', 'viewed', 'attachment_review', 'draft'].includes(actionType)) return false;

  // (ADMIN / SDS / OSO STAFF)
  if (normRole === 'admin' || normRole === 'oso-staff' || normRole === 'sds-coordinator') {
    // Explicitly EXCLUDE Chairman or Vice Chairman approvals, returns, or forwarding logs from Admin
    if (phase.includes('chairman') || desc.includes('by chairman') || desc.includes('by vice chairman')) {
      return false;
    }

    // 1) Retain notification when Org President sets document as retrieved
    if (actionType.includes('retriev') || desc.includes('retriev')) return true;

    // 2) Retain notification when Org President submits accomplishment report
    if (phase === 'accomplishment' || actionType.includes('accomplishment') || desc.includes('accomplishment')) return true;

    return false;
  }

  // (CHAIRMAN & VICE-CHAIRMAN)
  if (normRole === 'chairman' || normRole === 'vice-chairman') {
    // Retain 'submitted' notification permanently for Chairman (even after Chairman approves or returns)
    if (actionType === 'submitted' || desc.includes('submitted')) return true;

    // Retain accomplishment report submission
    if (phase === 'accomplishment' || actionType.includes('accomplishment') || desc.includes('accomplishment')) return true;

    return false;
  }

  // (ORG PRESIDENT)
  if (normRole === 'org-president') {
    return true;
  }

  return false;
}

const Header = ({ onToggleMobileMenu }) => {
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
      let notifs = [];

      // 1. Fetch Announcements (Filtered by target audience)
      const { data: announcements } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (announcements && announcements.length > 0) {
        const targetedAnnouncements = announcements.filter(a => isAnnouncementTargetedToUser(a, user));
        const annPromises = targetedAnnouncements.map(async (a) => {
          let hasAttachment = false;
          try {
            const { data: files } = await supabase.storage.from('documents').list(`announcements/${a.id}`);
            if (files && files.filter(f => f.name !== '.emptyFolderPlaceholder').length > 0) {
              hasAttachment = true;
            }
          } catch (e) {
            console.warn('Error checking announcement files:', e);
          }
          return {
            id: `ann_${a.id}`,
            type: 'announcement',
            title: a.title,
            message: a.content,
            timestamp: a.created_at,
            source: a,
            hasAttachment: hasAttachment,
          };
        });

        const annNotifs = await Promise.all(annPromises);
        notifs.push(...annNotifs);
      }

      // 2. Fetch Workflow Logs & Inbox Queue items based on Role
      if (user.role === 'org-president') {
        const { data: userSubs } = await supabase
          .from('submissions')
          .select('id')
          .eq('user_id', user.id);

        const subIds = (userSubs || []).map(s => s.id);

        if (subIds.length > 0) {
          const { data: logs, error: logsErr } = await supabase
            .from('submission_logs')
            .select('*, submissions(id, tracking_number, status, documentType:document_type_id(name))')
            .in('submission_id', subIds)
            .neq('user_id', user.id)
            .not('action_type', 'in', '("created","viewed","attachment_review")')
            .order('created_at', { ascending: false })
            .limit(50);

          if (logsErr) {
            console.error('Error fetching logs for org-president:', logsErr);
          }

          if (logs && logs.length > 0) {
            const logSubIds = logs.map(l => l.submission_id || l.submissions?.id).filter(Boolean);
            const titleMap = await fetchActivityTitlesMap(logSubIds);
            const relevantLogs = logs.filter(l => isWorkflowLogRelevantForRole(user.role, l, l.submissions));

            const workflowItems = relevantLogs.map(l => {
              const sub = l.submissions || {};
              const subId = l.submission_id || sub.id;
              const activityTitle = titleMap[subId] || '';
              const docType = getDocumentTypeName(sub);
              const mainTitle = formatHeadlineTitle(sub, activityTitle, 40);
              const statusAction = (l.action_type || 'UPDATE').replace(/_/g, ' ').toUpperCase();

              return {
                id: `log_${l.id}`,
                type: 'workflow',
                docType,
                activityTitle,
                mainTitle,
                statusAction,
                title: mainTitle,
                message: l.description || l.comment || l.message || 'Status changed',
                timestamp: l.created_at,
                source: {
                  ...l,
                  submission_id: l.submission_id,
                  status: sub.status,
                  submissions: sub,
                },
              };
            });
            notifs.push(...workflowItems);
          }
        }
      } else if (user.role === 'admin' || user.role === 'chairman' || user.role === 'vice-chairman') {
        // A) Workflow Logs (Accomplishment reports, org submissions, document retrievals)
        const { data: logs, error: logsErr } = await supabase
          .from('submission_logs')
          .select('*, submissions(id, tracking_number, status, users:user_id(org_name, abbreviation, full_name), documentType:document_type_id(name))')
          .neq('user_id', user.id)
          .not('action_type', 'in', '("created","viewed","attachment_review")')
          .order('created_at', { ascending: false })
          .limit(50);

        if (logsErr) {
          console.error('Error fetching reviewer logs:', logsErr);
        }

        const logSubIdsSet = new Set();

        if (logs && logs.length > 0) {
          const logSubIds = logs.map(l => l.submission_id || l.submissions?.id).filter(Boolean);
          const logTitleMap = await fetchActivityTitlesMap(logSubIds);
          const relevantLogs = logs.filter(l => isWorkflowLogRelevantForRole(user.role, l, l.submissions));

          relevantLogs.forEach(l => {
            if (l.submission_id || l.submissions?.id) {
              logSubIdsSet.add(l.submission_id || l.submissions?.id);
            }
          });

          const workflowItems = relevantLogs.map(l => {
            const sub = l.submissions || {};
            const subId = l.submission_id || sub.id;
            const activityTitle = logTitleMap[subId] || '';
            const docType = getDocumentTypeName(sub);
            const mainTitle = formatHeadlineTitle(sub, activityTitle, 40);
            const rawActionType = String(l.action_type || 'UPDATE').toLowerCase();
            const orgAbbr = sub.users?.abbreviation || sub.users?.org_name || '';
            const ownerName = sub.users?.full_name || '';

            let statusAction = rawActionType.replace(/_/g, ' ').toUpperCase();
            if (rawActionType === 'submitted' || rawActionType === 'forwarded') {
              statusAction = 'PENDING REVIEW';
            }

            return {
              id: `log_${l.id}`,
              type: 'workflow',
              docType,
              activityTitle,
              mainTitle,
              statusAction,
              orgAbbr,
              ownerName,
              title: mainTitle,
              message: l.description || l.comment || l.message || 'Status changed',
              timestamp: l.created_at,
              source: {
                ...l,
                submission_id: l.submission_id,
                status: sub.status,
                submissions: sub,
              },
            };
          });
          notifs.push(...workflowItems);
        }

        // B) Inbox Queue Notifications for submissions without workflow log entries
        let queueQuery = supabase
          .from('submissions')
          .select('id, tracking_number, status, created_at, updated_at, documentType:document_type_id(name), users:user_id(full_name, org_name, abbreviation)')
          .neq('status', 'draft');

        // Admin ONLY sees submissions that have reached Admin review stage (excluding 'submitted', 'disapproved', 'returned' which belong to Chairman/Org President)
        if (user.role === 'admin') {
          queueQuery = queueQuery
            .neq('status', 'submitted')
            .neq('status', 'disapproved')
            .neq('status', 'returned');
        }

        const { data: queueSubs } = await queueQuery
          .order('created_at', { ascending: false })
          .limit(25);

        if (queueSubs && queueSubs.length > 0) {
          const unhandledQueueSubs = queueSubs.filter(s => !logSubIdsSet.has(s.id));

          if (unhandledQueueSubs.length > 0) {
            const queueSubIds = unhandledQueueSubs.map(s => s.id);
            const queueTitleMap = await fetchActivityTitlesMap(queueSubIds);

            const queueItems = unhandledQueueSubs.map(sub => {
              const orgName = sub.users?.org_name || 'An organization';
              const orgAbbr = sub.users?.abbreviation || sub.users?.org_name || '';
              const ownerName = sub.users?.full_name || '';
              const docType = getDocumentTypeName(sub);
              const activityTitle = queueTitleMap[sub.id] || '';
              const mainTitle = formatHeadlineTitle(sub, activityTitle, 40);
              const statusAction = 'PENDING REVIEW';

              return {
                id: `queue_${sub.id}`,
                type: 'workflow',
                docType,
                activityTitle,
                mainTitle,
                statusAction,
                orgAbbr,
                ownerName,
                title: mainTitle,
                message: `${orgName} submitted ${docType} for review.`,
                timestamp: sub.updated_at || sub.created_at,
                source: {
                  submission_id: sub.id,
                  status: sub.status,
                  submissions: sub,
                },
              };
            });
            notifs.push(...queueItems);
          }
        }
      }

      // Deduplicate notifications by unique key
      const seen = new Set();
      const uniqueNotifs = notifs.filter(item => {
        const key = item.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      uniqueNotifs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setNotifications(uniqueNotifs);
    } catch (err) {
      console.error('Notification fetch error:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    window.addEventListener('inbox-updated', fetchNotifications);
    window.addEventListener('document-status-changed', fetchNotifications);
    return () => {
      clearInterval(interval);
      window.removeEventListener('inbox-updated', fetchNotifications);
      window.removeEventListener('document-status-changed', fetchNotifications);
    };
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
  const effectiveFilter = (user?.role === 'admin' && filter === 'all') ? 'workflow' : filter;
  const filteredNotifications = notifications.filter(n => {
    if (effectiveFilter === 'all') return true;
    return n.type === effectiveFilter;
  });

  return (
    <>
      <header className={`h-16 bg-white border-b border-gray-100 flex items-center justify-between px-4 sm:px-8 sticky top-0 shadow-sm transition-all ${showUserDropdown ? 'z-[999999]' : 'z-30'}`}>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className="md:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors shrink-0"
            aria-label="Open mobile menu"
          >
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2 text-gray-700 relative group cursor-pointer" onClick={() => setIsCalendarModalOpen(true)}>
            <Calendar size={20} className="shrink-0" />
            <span className="text-xs sm:text-sm font-bold hover:text-primary-green transition-colors truncate max-w-[140px] sm:max-w-none">{activeSy ? ` ${activeSy.name}` : 'Loading S.Y...'}</span>
            
            {activeSy && (
              <div className="absolute top-full left-0 mt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 bg-white text-gray-800 rounded-lg p-4 shadow-xl border border-gray-100 z-50 min-w-[250px]">
                <p className="text-xs font-bold text-gray-400 uppercase mb-2">Academic Dates</p>
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

          <div className="flex items-center gap-3 relative z-[99999]">
            {(() => {
              const isOrgPres = user?.role === 'org-president';
              const navTitle = isOrgPres && user?.org_name ? user.org_name : (user?.full_name || user?.username || 'User');
              const navSubtitle = isOrgPres ? (user?.full_name || 'Organization President') : (user?.role ? String(user.role).replace('-', ' ').toUpperCase() : '');
              const avatarInitial = (navTitle || '?').charAt(0).toUpperCase();

              return (
                <>
                  <button
                    onClick={() => setShowUserDropdown(!showUserDropdown)}
                    className="flex items-center gap-3 hover:bg-gray-50 p-2 rounded-xl transition-colors text-left"
                  >
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-bold text-gray-800 truncate max-w-[200px]">{navTitle}</p>
                      <p className="text-[10px] text-gray-400 font-semibold truncate max-w-[200px]">{navSubtitle}</p>
                    </div>
                    <Avatar
                      profileImage={user?.avatarUrl || user?.profile_image}
                      name={navTitle}
                      className="w-10 h-10 rounded-full border-2 border-white shadow-sm shrink-0"
                      fallbackClassName="bg-primary-green text-white font-bold"
                    />
                  </button>

                  {showUserDropdown && (
                    <>
                      <div
                        className="fixed inset-0 z-[999998]"
                        onClick={() => setShowUserDropdown(false)}
                      />
                      <div className="absolute top-full right-0 mt-2 w-60 bg-white rounded-xl shadow-2xl border border-gray-100 z-[999999] overflow-hidden animate-in fade-in slide-in-from-top-2">
                        <div className="p-4 border-b border-gray-100">
                          <p className="text-sm font-bold text-gray-800 truncate">{navTitle}</p>
                          <p className="text-xs text-gray-500 font-medium truncate">{navSubtitle}</p>
                          {user?.email && <p className="text-[11px] text-gray-400 truncate mt-0.5">{user.email}</p>}
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
                </>
              );
            })()}
          </div>
        </div>
      </header>

      {isModalOpen && !selectedAnnouncement && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col h-[580px] max-h-[85vh]" onClick={e => e.stopPropagation()}>
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
              {user?.role !== 'admin' && (
                <button
                  onClick={() => setFilter('all')}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${effectiveFilter === 'all' ? 'border-primary-green text-primary-green' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  All
                </button>
              )}
              {user?.role !== 'admin' && (
                <button
                  onClick={() => setFilter('announcement')}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${effectiveFilter === 'announcement' ? 'border-primary-green text-primary-green' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  Announcements
                </button>
              )}
              <button
                onClick={() => setFilter('workflow')}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${effectiveFilter === 'workflow' ? 'border-primary-green text-primary-green' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
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

                    const rawActionType = String(notif.source?.action_type || '').toLowerCase();
                    const rawAction = String(notif.statusAction || notif.title || '').toUpperCase();
                    const msgText = String(notif.message || '').toLowerCase();

                    const isAccomplishment = rawActionType.includes('accomplishment') || rawAction.includes('ACCOMPLISHMENT') || msgText.includes('accomplishment');
                    const isRetrieval = !isAccomplishment && (rawActionType.includes('retriev') || rawAction.includes('RETRIEV') || msgText.includes('ready for retrieval') || msgText.includes('retriev'));
                    const isDisapproved = !isAccomplishment && !isRetrieval && (rawActionType === 'disapproved' || rawActionType === 'rejected' || rawAction.includes('DISAPPROV') || rawAction.includes('REJECT') || msgText.includes('disapproved') || msgText.includes('rejected'));
                    const isReturned = !isAccomplishment && !isRetrieval && !isDisapproved && (rawActionType === 'returned' || (rawAction.includes('RETURN') && !rawAction.includes('RETRIEV')) || msgText.includes('returned'));
                    const isApproved = !isAccomplishment && !isRetrieval && !isDisapproved && !isReturned && (rawActionType === 'approved' || (rawAction.includes('APPROV') && !rawAction.includes('DISAPPROV')) || rawAction.includes('COMPLET'));
                    const isForwarded = !isAccomplishment && !isRetrieval && !isDisapproved && !isReturned && !isApproved && (rawActionType === 'forwarded' || (rawAction.includes('FORWARD') && !rawAction.includes('MAIN CAMPUS REVIEW')) || (rawActionType === 'forwarded' && String(notif.source?.workflow_phase || '').toLowerCase().includes('main-campus')));
                    const isPending = !isAccomplishment && !isRetrieval && !isDisapproved && !isReturned && !isApproved && !isForwarded && (rawAction.includes('PENDING') || rawAction.includes('SUBMIT'));

                    let cardTheme = isRead ? 'bg-white border-gray-100 hover:border-gray-200' : 'bg-blue-50/40 border-blue-100/80 relative';
                    let iconBg = 'bg-primary-green text-white shadow-sm';
                    let badgeTheme = 'bg-gray-100 text-gray-700 font-semibold';
                    let actionBtnColor = 'text-primary-green hover:text-emerald-700 font-semibold';
                    let statusLabel = notif.statusAction || (isAnnouncement ? 'ANNOUNCEMENT' : 'UPDATE');
                    let accentBarColor = 'bg-blue-500';

                    if (isAnnouncement) {
                      iconBg = 'bg-amber-500 text-white shadow-sm';
                      badgeTheme = 'bg-amber-100 text-amber-800 font-bold';
                      accentBarColor = 'bg-amber-500';
                    } else if (isAccomplishment) {
                      cardTheme = isRead ? 'bg-emerald-50/20 border-emerald-100/60 hover:border-emerald-200' : 'bg-emerald-50/60 border-emerald-100 relative';
                      iconBg = 'bg-emerald-600 text-white shadow-sm';
                      badgeTheme = 'bg-emerald-100 text-emerald-800 font-bold border border-emerald-200/60';
                      actionBtnColor = 'text-emerald-700 hover:text-emerald-800 font-bold';
                      statusLabel = 'COMPLETED';
                      accentBarColor = 'bg-emerald-500';
                    } else if (isRetrieval) {
                      cardTheme = isRead ? 'bg-purple-50/20 border-purple-100/60 hover:border-purple-200' : 'bg-purple-50/60 border-purple-100 relative';
                      iconBg = 'bg-purple-600 text-white shadow-sm';
                      badgeTheme = 'bg-purple-100 text-purple-800 font-bold border border-purple-200/60';
                      actionBtnColor = 'text-purple-700 hover:text-purple-800 font-bold';
                      accentBarColor = 'bg-purple-500';

                      if (msgText.includes('confirm') || rawAction.includes('CONFIRM')) {
                        statusLabel = 'RETRIEVAL CONFIRMED';
                      } else if (rawActionType === 'document_retrieved' || rawActionType === 'document retrieved' || msgText.includes('retrieved') || rawAction.includes('DOCUMENT RETRIEVED')) {
                        statusLabel = 'DOCUMENT RETRIEVED';
                      } else {
                        statusLabel = 'READY FOR RETRIEVAL';
                      }
                    } else if (isDisapproved) {
                      cardTheme = isRead ? 'bg-red-50/20 border-red-100/60 hover:border-red-200' : 'bg-red-50/60 border-red-200 relative';
                      iconBg = 'bg-red-600 text-white shadow-sm';
                      badgeTheme = 'bg-red-100 text-red-800 font-bold border border-red-200/60';
                      actionBtnColor = 'text-red-700 hover:text-red-800 font-bold';
                      statusLabel = 'DISAPPROVED';
                      accentBarColor = 'bg-red-500';
                    } else if (isReturned) {
                      cardTheme = isRead ? 'bg-amber-50/30 border-amber-100 hover:border-amber-200' : 'bg-amber-50/80 border-amber-200 relative';
                      iconBg = 'bg-orange-500 text-white shadow-sm';
                      badgeTheme = 'bg-orange-100 text-orange-800 font-bold border border-orange-200/60';
                      actionBtnColor = 'text-orange-600 hover:text-orange-700 font-bold';
                      statusLabel = 'RETURNED';
                      accentBarColor = 'bg-orange-500';
                    } else if (isApproved) {
                      cardTheme = isRead ? 'bg-emerald-50/20 border-emerald-100/60 hover:border-emerald-200' : 'bg-emerald-50/60 border-emerald-100 relative';
                      iconBg = 'bg-emerald-600 text-white shadow-sm';
                      badgeTheme = 'bg-emerald-100 text-emerald-800 font-bold border border-emerald-200/60';
                      actionBtnColor = 'text-emerald-700 hover:text-emerald-800 font-bold';
                      statusLabel = 'APPROVED';
                      accentBarColor = 'bg-emerald-500';
                    } else if (isForwarded) {
                      cardTheme = isRead ? 'bg-cyan-50/30 border-cyan-100 hover:border-cyan-200' : 'bg-cyan-50/70 border-cyan-200 relative';
                      iconBg = 'bg-cyan-600 text-white shadow-sm';
                      badgeTheme = 'bg-cyan-100 text-cyan-800 font-bold border border-cyan-200/60';
                      actionBtnColor = 'text-cyan-700 hover:text-cyan-800 font-bold';
                      statusLabel = 'SUBMITTED TO MAIN CAMPUS';
                      accentBarColor = 'bg-cyan-500';
                    } else if (isPending) {
                      iconBg = 'bg-blue-600 text-white shadow-sm';
                      badgeTheme = 'bg-blue-100 text-blue-800 font-bold border border-blue-200/60';
                      statusLabel = 'PENDING REVIEW';
                      accentBarColor = 'bg-blue-500';
                    }

                    const headlineText = notif.mainTitle || notif.activityTitle || notif.title || 'Submission';
                    const docTypeLabel = notif.docType || (isAnnouncement ? 'Announcement' : '');
                    const showSubheadline = !isAnnouncement && docTypeLabel && docTypeLabel.toLowerCase() !== headlineText.toLowerCase();

                    const displayMessage = String(notif.message || '')
                      .replace(/\[?Forwarded Documents:\s*[^\]\n]+\]?/gi, '')
                      .replace(/Forwarded Documents:[\s\S]*/gi, '')
                      .replace(/•\s*[^\n]+/g, '')
                      .trim() || 'Sent to Main Campus for Review.';

                    return (
                      <div
                        key={notif.id}
                        onClick={() => handleNotificationClick(notif)}
                        className={`p-4 rounded-xl cursor-pointer transition-all border shadow-sm hover:shadow-md relative overflow-hidden ${cardTheme}`}
                      >
                        {/* Signature left accent border bar */}
                        <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl ${accentBarColor}`}></div>
                        <div className="flex gap-3">
                          <div className={`mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
                            {isAnnouncement ? <Megaphone size={16} /> : <FileText size={16} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            {/* Line 1: Main Title + Attachment Badge + Status Badge */}
                            <div className="flex items-center justify-between gap-2 mb-0.5">
                              <div className="flex items-center gap-1.5 truncate flex-1 min-w-0">
                                <h4 className={`text-sm font-bold leading-snug truncate ${isRead ? 'text-gray-800' : 'text-gray-900'}`}>
                                  {headlineText}
                                </h4>
                                {isAnnouncement && notif.hasAttachment && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100/90 px-2 py-0.5 rounded-md border border-amber-200/80 shrink-0" title="Has attachments">
                                    <Paperclip size={11} className="text-amber-600" />
                                    Attachment
                                  </span>
                                )}
                              </div>
                              <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md shrink-0 ml-1 ${badgeTheme}`}>
                                {statusLabel}
                              </span>
                            </div>

                            {/* Line 2: Document Type Subheadline on the left + Timestamp on the right */}
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <div className="flex items-center gap-1 truncate min-w-0 flex-1">
                                {showSubheadline && (
                                  <span className="text-xs font-semibold text-gray-500 truncate leading-snug">
                                    {docTypeLabel}
                                  </span>
                                )}
                                {(user?.role === 'admin' || user?.role === 'chairman' || user?.role === 'vice-chairman') && (notif.orgAbbr || notif.ownerName) && (
                                  <span className="text-[11px] font-normal text-gray-400 truncate leading-snug">
                                    {showSubheadline ? '• ' : ''}{notif.orgAbbr}{notif.ownerName ? ` (${notif.ownerName})` : ''}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap shrink-0 ml-auto">
                                {new Date(notif.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>

                            {/* Line 3: Message content */}
                            <div className="text-xs text-gray-600 leading-relaxed space-y-1">
                              <p className="line-clamp-2">{displayMessage}</p>
                              {(user?.role === 'org-president' && (displayMessage.toLowerCase().includes('approved by sds') || (displayMessage.toLowerCase().includes('sds') && displayMessage.toLowerCase().includes('approved')))) && (
                                <p className="text-[11px] text-amber-700 font-medium leading-normal mt-1">
                                  Take note: Print attachments &amp; secure OSO Staff wet signatures before hard copy submission.
                                </p>
                              )}
                            </div>

                            {/* Line 4: Action Button */}
                            {!isAnnouncement && (notif.source?.submissions || notif.source?.submission_id) && (
                              <div className={`mt-2 flex items-center gap-1 text-[10px] uppercase tracking-wider ${actionBtnColor}`}>
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
  const { user } = useAuth();
  const [showSuspendedModal, setShowSuspendedModal] = useState(false);
  const [showReactivatedModal, setShowReactivatedModal] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const isSuspended = user?.status?.startsWith('Suspended') && user?.role === 'org-president';
  const prevStatusRef = useRef(user?.status);

  useEffect(() => {
    const prevStatus = prevStatusRef.current;
    const currentStatus = user?.status;

    const wasSuspended = prevStatus && String(prevStatus).startsWith('Suspended');
    const isNowActive = currentStatus && !String(currentStatus).startsWith('Suspended');

    if (isSuspended) {
      setShowSuspendedModal(true);
      setShowReactivatedModal(false);
      apiClient.get(apiUrl('/api/system/admin-email'))
        .then(res => {
          if (res.data?.email) setAdminEmail(res.data.email);
        })
        .catch(err => console.error('Error fetching admin email:', err));
    } else {
      setShowSuspendedModal(false);
      if (wasSuspended && isNowActive && user?.role === 'org-president') {
        setShowReactivatedModal(true);
      }
    }

    prevStatusRef.current = currentStatus;
  }, [isSuspended, user?.status, user?.role]);

  if (user?.role === 'org-president' && !user?.abbreviation) {
    return <OnboardingOverlay />;
  }

  let suspensionMessage = 'Your account has been suspended due to system requirements or missing submissions.';
  if (user?.status && user.status.includes(':')) {
    suspensionMessage = user.status.split(':').slice(1).join(':').trim();
  }

  return (
    <div className="flex h-screen bg-[#f8fafc]">
      <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header onToggleMobileMenu={() => setIsMobileMenuOpen(true)} />
        <main className="flex-1 overflow-y-auto p-3.5 sm:p-6 md:p-8 relative z-0">
          <PageTransition>
            <div className="max-w-7xl mx-auto">
              <Outlet />
            </div>
          </PageTransition>
        </main>
      </div>

      {showSuspendedModal && isSuspended && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 flex flex-col animate-in zoom-in-95 duration-300">
            <div className="p-6 text-white flex items-center gap-4 bg-gradient-to-r from-red-600 to-red-500">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-white shrink-0">
                <Lock size={28} />
              </div>
              <div className="text-left">
                <h2 className="text-xl font-black tracking-wide">ACCOUNT SUSPENDED</h2>
                <p className="text-white/80 text-xs mt-0.5 font-medium">Access to document submission is restricted</p>
              </div>
            </div>

            <div className="p-8 text-gray-800 text-left">
              <p className="text-gray-600 text-sm leading-relaxed mb-6 font-medium">
                An administrator has suspended your organization's account. While suspended, you can access your dashboard and view documents, but you cannot submit new documents or new versions.
              </p>

              <div className="mb-6 p-4 bg-red-50 rounded-xl border border-red-100">
                <span className="block text-[10px] font-black text-red-500 uppercase tracking-widest mb-1.5">Suspension Reason</span>
                <p className="text-red-700 text-xs leading-relaxed italic whitespace-pre-wrap">
                  "{suspensionMessage}"
                </p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex items-center gap-3">
                <AlertTriangle className="text-red-500 shrink-0" size={20} />
                <span className="text-xs text-gray-500 font-medium text-left">
                  Please contact the SDS Coordinator at {adminEmail && adminEmail.includes('@') ? (
                    <a href={`mailto:${adminEmail}`} className="text-blue-600 hover:underline font-bold">{adminEmail}</a>
                  ) : adminEmail ? (
                    <span className="font-bold text-gray-800">{adminEmail}</span>
                  ) : (
                    <span className="font-bold text-gray-800">the administrator</span>
                  )} to reactivate your account.
                </span>
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowSuspendedModal(false)}
                className="px-6 py-2.5 bg-primary-green hover:bg-green-700 text-white text-xs font-black rounded-xl transition-all duration-200 shadow-md shadow-green-600/10"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showReactivatedModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 flex flex-col animate-in zoom-in-95 duration-300 text-left">
            <div className="p-6 text-white flex items-center gap-4 bg-gradient-to-r from-emerald-600 to-green-500">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-white shrink-0">
                <CheckCircle2 size={28} />
              </div>
              <div>
                <h2 className="text-xl font-black tracking-wide">ACCOUNT REACTIVATED</h2>
                <p className="text-white/80 text-xs mt-0.5 font-medium">Full submission access has been restored</p>
              </div>
            </div>

            <div className="p-8 text-gray-800">
              <p className="text-gray-600 text-sm leading-relaxed mb-6 font-medium">
                Great news! An administrator has reactivated your organization's account. You can now create new proposals, upload documents, and submit revisions normally.
              </p>

              <div className="bg-green-50 rounded-xl p-4 border border-green-100 flex items-center gap-3">
                <CheckCircle2 className="text-emerald-600 shrink-0" size={20} />
                <span className="text-xs text-emerald-800 font-medium">
                  Your account status is now <strong>Active</strong>. Thank you for your patience!
                </span>
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowReactivatedModal(false)}
                className="px-6 py-2.5 bg-primary-green hover:bg-green-700 text-white text-xs font-black rounded-xl transition-all duration-200 shadow-md shadow-green-600/10"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardLayout;

import React from 'react';
import { createPortal } from 'react-dom';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Inbox, 
  Files, 
  Users, 
  ListChecks, 
  FilePlus, 
  CheckCircle,
  LogOut,
  Megaphone,
  Settings,
  User,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';

const Sidebar = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);
  const [inboxCount, setInboxCount] = React.useState(0);
  const [completedCount, setCompletedCount] = React.useState(0);
  const [myDocsCount, setMyDocsCount] = React.useState(0);

  React.useEffect(() => {
    if (!user) return;
    
    let isMounted = true;
    
    const fetchInboxCount = async () => {
      try {
        const normRole = String(user.role || '').toLowerCase().trim();
        const isAdmin = normRole === 'admin' || normRole.includes('sds');
        const isStaff = normRole === 'chairman' || normRole === 'vice-chairman' || normRole === 'oso-staff' || normRole === 'oso staff';

        let statusFilters = [];
        if (isAdmin) {
          statusFilters = [
            'sds coordinator review', 'SDS coordinator review', 'SDS Coordinator Review', 'sds_coordinator_review',
            'sds review', 'SDS review', 'SDS Review', 'sds_review',
            'oso approved', 'OSO Approved', 'OSO approved', 'oso_approved',
            'pending hard copy', 'Pending Hard Copy', 'pending_hard_copy', 'hard copy', 'Hard Copy',
            'to forward', 'To Forward', 'to_forward'
          ];
        } else if (isStaff) {
          statusFilters = [
            'submitted', 'Submitted',
            'pending', 'Pending',
            'oso staff review', 'OSO Staff Review', 'oso_staff_review'
          ];
        }
        
        if (statusFilters.length === 0) {
          if (isMounted) setInboxCount(0);
          return;
        }

        if (isAdmin) {
          // Join submission_logs to exclude submissions already approved by admin/SDS
          const { data, error } = await supabase
            .from('submissions')
            .select('id, status, submission_logs(workflow_phase, action_type, review_action)')
            .in('status', statusFilters);

          if (!error && isMounted) {
            const count = (data || []).filter(sub => {
              const logs = sub.submission_logs || [];
              const hasApproved = logs.some(l => 
                String(l.workflow_phase || '').toLowerCase().includes('sds') && 
                (String(l.action_type || '').toLowerCase() === 'approved' || String(l.review_action || '').toLowerCase() === 'approved')
              );
              return !hasApproved;
            }).length;
            setInboxCount(count);
          }
        } else {
          const { count, error } = await supabase
            .from('submissions')
            .select('id', { count: 'exact', head: true })
            .in('status', statusFilters);
            
          if (!error && isMounted) {
            setInboxCount(count || 0);
          }
        }
      } catch (err) {
        console.error('Error fetching inbox count:', err);
      }
    };

    const fetchCompletedCount = async () => {
      try {
        const normRole = String(user.role || '').toLowerCase().trim();
        if (!['admin', 'chairman', 'vice-chairman', 'sds-coordinator', 'oso-staff'].some(r => normRole.includes(r))) {
          if (isMounted) setCompletedCount(0);
          return;
        }

        const { data, error } = await supabase
          .from('submissions')
          .select('id, status');

        if (!error && isMounted) {
          const completedList = (data || []).filter(sub => {
            const s = String(sub.status || '').toLowerCase();
            return s === 'completed' || s.includes('disapproved') || s === 'rejected';
          });
          const readIds = JSON.parse(localStorage.getItem('completed_read_ids') || '[]');
          const unreadCount = completedList.filter(sub => !readIds.includes(sub.id)).length;
          setCompletedCount(unreadCount);
        }
      } catch (err) {
        console.error('Error fetching completed count:', err);
      }
    };

    const fetchMyDocsCount = async () => {
      try {
        const normRole = String(user.role || '').toLowerCase().trim();
        if (normRole !== 'org-president') {
          if (isMounted) setMyDocsCount(0);
          return;
        }

        const { data, error } = await supabase
          .from('submissions')
          .select('id, status')
          .eq('user_id', user.id);

        if (!error && isMounted) {
          const returnedList = (data || []).filter(sub => {
            const s = String(sub.status || '').toLowerCase();
            return s === 'returned';
          });
          const readIds = JSON.parse(localStorage.getItem('mydocs_returned_read_ids') || '[]');
          const unreadCount = returnedList.filter(sub => !readIds.includes(sub.id)).length;
          setMyDocsCount(unreadCount);
        }
      } catch (err) {
        console.error('Error fetching my docs count:', err);
      }
    };
    
    fetchInboxCount();
    fetchCompletedCount();
    fetchMyDocsCount();
    
    const handleGlobalStatusChange = () => {
      if (!isMounted) return;
      fetchInboxCount();
      fetchCompletedCount();
      fetchMyDocsCount();
    };

    window.addEventListener('inbox-updated', handleGlobalStatusChange);
    window.addEventListener('completed-updated', handleGlobalStatusChange);
    window.addEventListener('my-docs-updated', handleGlobalStatusChange);
    window.addEventListener('document-status-changed', handleGlobalStatusChange);
    window.addEventListener('submission-submitted', handleGlobalStatusChange);
    window.addEventListener('focus', handleGlobalStatusChange);

    const pollInterval = setInterval(() => {
      handleGlobalStatusChange();
    }, 6000);

    const channelId = `sidebar_realtime_${user.id}_${Math.random().toString(36).substring(2, 9)}`;
    const channel = supabase.channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions' }, () => {
        handleGlobalStatusChange();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'submission_logs' }, () => {
        handleGlobalStatusChange();
      })
      .on('broadcast', { event: 'inbox-update' }, () => {
        handleGlobalStatusChange();
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          handleGlobalStatusChange();
        }
      });

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      window.removeEventListener('inbox-updated', handleGlobalStatusChange);
      window.removeEventListener('completed-updated', handleGlobalStatusChange);
      window.removeEventListener('my-docs-updated', handleGlobalStatusChange);
      window.removeEventListener('document-status-changed', handleGlobalStatusChange);
      window.removeEventListener('submission-submitted', handleGlobalStatusChange);
      window.removeEventListener('focus', handleGlobalStatusChange);
      supabase.removeChannel(channel);
    };
  }, [user]);

  const menuItems = {
    admin: [
      { name: 'Dashboard', path: '/', icon: <LayoutDashboard size={20} /> },
      { name: 'Inbox', path: '/inbox', icon: <Inbox size={20} /> },
      { name: 'My Documents', path: '/my-documents', icon: <Files size={20} /> },
      { name: 'Completed', path: '/completed', icon: <CheckCircle size={20} /> },
      { name: 'User Management', path: '/users', icon: <Users size={20} /> },
      { name: 'List of Requirements', path: '/requirements', icon: <ListChecks size={20} /> },
      { name: 'Announcements', path: '/admin/announcements', icon: <Megaphone size={20} /> },
      { name: 'Academic Settings', path: '/admin/academic-settings', icon: <Settings size={20} /> },
    ],
    chairman: [
      { name: 'Dashboard', path: '/', icon: <LayoutDashboard size={20} /> },
      { name: 'Inbox', path: '/inbox', icon: <Inbox size={20} /> },
      { name: 'My Documents', path: '/my-documents', icon: <Files size={20} /> },
      { name: 'Completed', path: '/completed', icon: <CheckCircle size={20} /> },
      { name: 'List of Requirements', path: '/requirements', icon: <ListChecks size={20} /> },
    ],
    'vice-chairman': [
      { name: 'Dashboard', path: '/', icon: <LayoutDashboard size={20} /> },
      { name: 'Inbox', path: '/inbox', icon: <Inbox size={20} /> },
      { name: 'My Documents', path: '/my-documents', icon: <Files size={20} /> },
      { name: 'Completed', path: '/completed', icon: <CheckCircle size={20} /> },
      { name: 'List of Requirements', path: '/requirements', icon: <ListChecks size={20} /> },
    ],
    'org-president': [
      { name: 'Dashboard', path: '/', icon: <LayoutDashboard size={20} /> },
      { name: 'Submit New Document', path: '/submit', icon: <FilePlus size={20} /> },
      { name: 'My Documents', path: '/my-documents', icon: <Files size={20} /> },
      { name: 'Completed', path: '/completed', icon: <CheckCircle size={20} /> },
      { name: 'List of Requirements', path: '/requirements', icon: <ListChecks size={20} /> },
    ],
  };

  const roleKey = user?.role;
  const currentMenu = menuItems[roleKey] || [];

  const sidebarContent = (
    <div className="w-64 h-full bg-[#073c2d] text-white flex flex-col shadow-xl border-r border-emerald-900/40">
      <div className="p-6 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center p-1 shadow-sm">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
          </div>
          <span className="text-xl font-bold tracking-wider text-secondary-gold">OSODOCS</span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="md:hidden p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        )}
      </div>

      <nav className="flex-1 mt-6 px-4 space-y-2 overflow-y-auto">
        {currentMenu.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={(e) => {
              if (onClose) onClose();
              window.dispatchEvent(new CustomEvent('sidebar-nav-click', { detail: { path: item.path } }));
              if (window.__hasUnsavedChanges) {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
            className={({ isActive }) =>
              `flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-200 ${
                isActive 
                  ? 'bg-secondary-gold text-primary-green shadow-lg scale-105 animate-shine' 
                  : 'hover:bg-white/10 text-white/80'
              }`
            }
          >
            <div className="flex items-center gap-3">
              {item.icon}
              <span className="font-medium text-sm">{item.name}</span>
            </div>
            {item.name === 'Inbox' && inboxCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm">
                {inboxCount > 99 ? '99+' : inboxCount}
              </span>
            )}
            {item.name === 'Completed' && completedCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm animate-pulse">
                {completedCount > 99 ? '99+' : completedCount}
              </span>
            )}
            {item.name === 'My Documents' && myDocsCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm animate-pulse">
                {myDocsCount > 99 ? '99+' : myDocsCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-white/10 shrink-0">
        <button
          onClick={() => setShowLogoutConfirm(true)}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-white/80 hover:bg-red-500/20 hover:text-red-400 transition-colors"
        >
          <LogOut size={20} />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden md:flex md:w-64 md:shrink-0 h-screen sticky top-0">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            onClick={onClose}
          />
          <div className="relative z-10 w-64 h-full flex-1 max-w-xs shadow-2xl animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Global Top-Level Logout Modal (Portaled to document.body) */}
      {showLogoutConfirm && createPortal(
        <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-md z-[999999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl relative animate-in zoom-in-95 duration-200 text-gray-800 border border-gray-100">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-5 border border-red-100">
              <LogOut size={28} />
            </div>
            <h3 className="text-xl font-black text-gray-800 mb-2">Confirm Logout</h3>
            <p className="text-sm font-bold text-gray-500 mb-6">Are you sure you want to log out of your account?</p>
            
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition-all text-sm uppercase tracking-wider"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLogoutConfirm(false);
                  logout();
                }}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white font-bold rounded-xl shadow-lg hover:bg-red-700 hover:shadow-red-600/30 transition-all text-sm uppercase tracking-wider"
              >
                Logout
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default Sidebar;

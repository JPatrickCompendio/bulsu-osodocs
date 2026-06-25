import React from 'react';
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
  User
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';

const Sidebar = () => {
  const { user, logout } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);
  const [inboxCount, setInboxCount] = React.useState(0);
  const [completedCount, setCompletedCount] = React.useState(0);

  React.useEffect(() => {
    if (!user) return;
    
    let isMounted = true;
    
    const fetchInboxCount = async () => {
      try {
        let statusFilter = '';
        if (user.role === 'admin') statusFilter = 'SDS coordinator review';
        else if (user.role === 'chairman' || user.role === 'vice-chairman') statusFilter = 'submitted';
        
        if (!statusFilter) return;

        const { count, error } = await supabase
          .from('submissions')
          .select('id', { count: 'exact', head: true })
          .eq('status', statusFilter);
          
        if (!error && isMounted) {
          setInboxCount(count || 0);
        }
      } catch (err) {
        console.error('Error fetching inbox count:', err);
      }
    };

    const fetchCompletedCount = async () => {
      try {
        if (!['admin', 'chairman', 'vice-chairman'].includes(user.role)) {
          setCompletedCount(0);
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
    
    fetchInboxCount();
    fetchCompletedCount();
    
    const handleInboxUpdate = () => {
      fetchInboxCount();
    };
    const handleCompletedUpdate = () => {
      fetchCompletedCount();
    };

    window.addEventListener('inbox-updated', handleInboxUpdate);
    window.addEventListener('completed-updated', handleCompletedUpdate);
    
    const channel = supabase.channel('submissions_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions' }, () => {
        fetchInboxCount();
        fetchCompletedCount();
      })
      .subscribe();

    return () => {
      isMounted = false;
      window.removeEventListener('inbox-updated', handleInboxUpdate);
      window.removeEventListener('completed-updated', handleCompletedUpdate);
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

  return (
    <div className="w-64 h-screen bg-primary-green text-white flex flex-col shadow-xl">
      <div className="p-6 flex items-center gap-3 border-b border-white/10">
        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center p-1">
           <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
        </div>
        <span className="text-xl font-bold tracking-wider text-secondary-gold">OSODOCS</span>
      </div>

      <nav className="flex-1 mt-6 px-4 space-y-2">
        {currentMenu.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={() => window.dispatchEvent(new CustomEvent('sidebar-nav-click'))}
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
              <span className="font-medium">{item.name}</span>
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
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-white/10">
        <button
          onClick={() => setShowLogoutConfirm(true)}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-white/80 hover:bg-red-500/20 hover:text-red-400 transition-colors"
        >
          <LogOut size={20} />
          <span className="font-medium">Logout</span>
        </button>
      </div>

      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl relative animate-in zoom-in-95 duration-200 text-gray-800">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-5">
              <LogOut size={28} />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Confirm Logout</h3>
            <p className="text-sm text-gray-500 mb-6">Are you sure you want to log out of your account?</p>
            
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition-all text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLogoutConfirm(false);
                  logout();
                }}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white font-bold rounded-xl shadow-lg hover:shadow-red-600/20 transition-all text-sm"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;

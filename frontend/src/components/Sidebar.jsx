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
  Settings
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Sidebar = () => {
  const { user, logout } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);

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
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                isActive 
                  ? 'bg-secondary-gold text-primary-green shadow-lg scale-105 animate-shine' 
                  : 'hover:bg-white/10 text-white/80'
              }`
            }
          >
            {item.icon}
            <span className="font-medium">{item.name}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-4 py-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-secondary-gold flex items-center justify-center text-primary-green font-bold text-sm">
            {user?.full_name?.charAt(0).toUpperCase() || '?'}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold truncate w-32">{user?.full_name || 'User'}</span>
            <span className="text-xs text-white/60 capitalize">{user?.role}</span>
          </div>
        </div>
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

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
  LogOut 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Sidebar = () => {
  const { user, logout } = useAuth();

  const menuItems = {
    admin: [
      { name: 'Dashboard', path: '/', icon: <LayoutDashboard size={20} /> },
      { name: 'Inbox', path: '/inbox', icon: <Inbox size={20} /> },
      { name: 'My Documents', path: '/my-documents', icon: <Files size={20} /> },
      { name: 'User Management', path: '/users', icon: <Users size={20} /> },
      { name: 'List of Requirements', path: '/requirements', icon: <ListChecks size={20} /> },
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
      { name: 'Submit New Documents', path: '/submit', icon: <FilePlus size={20} /> },
      { name: 'Completed', path: '/completed', icon: <CheckCircle size={20} /> },
      { name: 'List of Requirements', path: '/requirements', icon: <ListChecks size={20} /> },
    ],
  };

  const roleKey = user?.role?.toLowerCase().replace(/\s+/g, '-');
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
            <span className="text-xs text-white/60 capitalize">{user?.role?.replace('-', ' ')}</span>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-white/80 hover:bg-red-500/20 hover:text-red-400 transition-colors"
        >
          <LogOut size={20} />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;

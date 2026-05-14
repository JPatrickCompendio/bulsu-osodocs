import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Bell, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Header = () => {
  const { user } = useAuth();
  return (
    <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-8 sticky top-0 z-30 shadow-sm">
      <div className="flex items-center gap-4 text-gray-400">
        <Search size={20} />
        <span className="text-sm">Search for documents, users...</span>
      </div>
      
      <div className="flex items-center gap-6">
        <button className="relative p-2 text-gray-500 hover:bg-gray-50 rounded-full transition-colors group">
          <Bell size={22} />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white group-hover:scale-110 transition-transform"></span>
        </button>
        
        <div className="h-8 w-[1px] bg-gray-100"></div>
        
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-gray-800">{user?.username}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">{user?.role}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-primary-green flex items-center justify-center text-white font-bold border-2 border-white shadow-sm">
            {user?.username?.charAt(0).toUpperCase()}
          </div>
        </div>
      </div>
    </header>
  );
};

const DashboardLayout = () => {
  return (
    <div className="flex h-screen bg-[#f8fafc]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;

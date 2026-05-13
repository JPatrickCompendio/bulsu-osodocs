import React, { useState, useEffect } from 'react';
import { 
  UserPlus, 
  FileText, 
  Filter, 
  Search, 
  X, 
  Check, 
  MoreVertical, 
  Mail, 
  Users as UsersIcon,
  Calendar,
  Shield,
  Briefcase,
  Loader2
} from 'lucide-react';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newUserType, setNewUserType] = useState('org'); // 'org' or 'admin-staff'
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [tempPassword, setTempPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    full_name: '',
    role: '',
    email: '',
    org_name: '',
    acronym: '',
    members: '',
    formation_date: '',
    advisers: ''
  });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/users');
      const data = await response.json();
      if (Array.isArray(data)) {
        setUsers(data);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const generatePassword = (type) => {
    const prefix = type === 'org' ? 'OSO' : 'STAFF';
    const random = Math.random().toString(36).substring(7).toUpperCase();
    setTempPassword(`${prefix}-${random}`);
  };

  const handleOpenModal = () => {
    setFormData({
      full_name: '',
      role: newUserType === 'org' ? 'Org President' : 'chairman',
      email: '',
      org_name: '',
      acronym: '',
      members: '',
      formation_date: '',
      advisers: ''
    });
    generatePassword(newUserType);
    setIsModalOpen(true);
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    const payload = {
      full_name: newUserType === 'org' ? formData.org_name : formData.full_name,
      role: newUserType === 'org' ? 'Org President' : formData.role,
      email: formData.email,
      password: tempPassword,
      status: 'Active',
    };

    try {
      const response = await fetch('http://localhost:5000/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      
      if (result.success) {
        setIsModalOpen(false);
        fetchUsers(); // Refresh table
      } else {
        alert('Error: ' + result.error);
      }
    } catch (error) {
      console.error('Error saving user:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const name = user.full_name || '';
    const role = user.role || '';
    const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          role.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filterType === 'all') return matchesSearch;
    if (filterType === 'org') return matchesSearch && role === 'Org President';
    if (filterType === 'staff') return matchesSearch && (role === 'chairman' || role === 'vice-chairman');
    return matchesSearch;
  });

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">User Management</h1>
          <p className="text-gray-500 mt-1">Manage institutional users and student organizations.</p>
        </div>
        
        <div className="flex gap-3">
          <button 
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all shadow-sm"
          >
            <FileText size={18} />
            Generate Report
          </button>
          <button 
            onClick={handleOpenModal}
            className="flex items-center gap-2 px-4 py-2 bg-primary-green text-white rounded-xl hover:shadow-lg hover:shadow-primary-green/20 transition-all shadow-md"
          >
            <UserPlus size={18} />
            Create User
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-6 flex flex-col md:flex-row gap-4 justify-between items-center text-gray-800">
        <div className="relative w-full md:w-96">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
            <Search size={18} />
          </span>
          <input 
            type="text" 
            placeholder="Search by name or role..." 
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-green outline-none transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter size={18} className="text-gray-400" />
          <select 
            className="flex-1 md:flex-none px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-green outline-none bg-white"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">All Roles</option>
            <option value="staff">Chairman / Vice Chairman</option>
            <option value="org">Organization President</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-20 flex flex-col items-center justify-center text-gray-400">
            <Loader2 className="animate-spin mb-4" size={40} />
            <p>Loading users from Supabase...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-6 py-4 font-semibold text-gray-600 text-sm">User Details</th>
                  <th className="px-6 py-4 font-semibold text-gray-600 text-sm">Role</th>
                  <th className="px-6 py-4 font-semibold text-gray-600 text-sm">Status</th>
                  <th className="px-6 py-4 font-semibold text-gray-600 text-sm">Joined</th>
                  <th className="px-6 py-4 font-semibold text-gray-600 text-sm text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredUsers.length > 0 ? filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50/80 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-sm ${user.role === 'Org President' ? 'bg-secondary-gold text-primary-green' : 'bg-primary-green'}`}>
                          {user.full_name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-800">{user.full_name}</div>
                          <div className="text-[10px] text-gray-400 font-mono">{user.id.substring(0, 8)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        user.role === 'chairman' ? 'bg-blue-100 text-blue-700' : 
                        user.role === 'vice-chairman' ? 'bg-purple-100 text-purple-700' : 
                        'bg-orange-100 text-orange-700'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                        <span className="text-sm text-gray-600">{user.status}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-xs">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-2 text-gray-300 hover:text-primary-green transition-colors">
                        <MoreVertical size={18} />
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="5" className="px-6 py-20 text-center text-gray-400">
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal - Create User */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setIsModalOpen(false)}></div>
          
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-primary-green p-6 text-white flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold">Create New User</h2>
                <p className="text-white/70 text-xs">Fill in the details to add a new account to Supabase.</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>

            {/* User Type Toggle */}
            <div className="p-6 border-b border-gray-100">
              <div className="flex p-1 bg-gray-100 rounded-xl w-fit mx-auto text-gray-800">
                <button 
                  onClick={() => { setNewUserType('org'); generatePassword('org'); }}
                  className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${newUserType === 'org' ? 'bg-white text-primary-green shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Student Organization
                </button>
                <button 
                  onClick={() => { setNewUserType('admin-staff'); generatePassword('admin-staff'); }}
                  className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${newUserType === 'admin-staff' ? 'bg-white text-primary-green shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Chairman / Vice Chairman
                </button>
              </div>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSaveUser} id="create-user-form" className="p-8 max-h-[60vh] overflow-y-auto text-gray-800">
              {newUserType === 'org' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name</label>
                    <div className="relative">
                      <UsersIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input 
                        type="text" 
                        required
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-green" 
                        placeholder="e.g. Supreme Student Council"
                        value={formData.org_name}
                        onChange={(e) => setFormData({...formData, org_name: e.target.value})}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Acronym</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-green" 
                      placeholder="e.g. SSC"
                      value={formData.acronym}
                      onChange={(e) => setFormData({...formData, acronym: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">No. of Members</label>
                    <input 
                      type="number" 
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-green" 
                      placeholder="0"
                      value={formData.members}
                      onChange={(e) => setFormData({...formData, members: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date of Formation</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input 
                        type="date" 
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-green text-gray-800"
                        value={formData.formation_date}
                        onChange={(e) => setFormData({...formData, formation_date: e.target.value})}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input 
                        type="email" 
                        required
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-green" 
                        placeholder="org@bulsu.edu.ph" 
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="md:col-span-2 bg-gray-50 p-4 rounded-2xl border border-gray-100 animate-shine">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Temporary Password</label>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-primary-green font-bold text-lg">{tempPassword}</span>
                      <span className="text-[10px] text-gray-400 italic">Auto-generated</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                    <div className="relative">
                      <Shield className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input 
                        type="text" 
                        required
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-green" 
                        placeholder="e.g. John Doe"
                        value={formData.full_name}
                        onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                    <div className="relative">
                      <select 
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-green bg-white appearance-none"
                        value={formData.role}
                        onChange={(e) => setFormData({...formData, role: e.target.value})}
                      >
                        <option value="chairman">Chairman</option>
                        <option value="vice-chairman">Vice Chairman</option>
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                        <MoreVertical size={16} />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input 
                        type="email" 
                        required
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-green" 
                        placeholder="name@bulsu.edu.ph"
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 animate-shine">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Temporary Password</label>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-primary-green font-bold text-lg">{tempPassword}</span>
                      <span className="text-[10px] text-gray-400 italic">Auto-generated</span>
                    </div>
                  </div>
                </div>
              )}
            </form>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-100 flex gap-3 justify-end bg-gray-50/50">
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-2.5 text-gray-500 font-semibold hover:text-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button 
                form="create-user-form"
                type="submit"
                disabled={isSaving}
                className="px-8 py-2.5 bg-primary-green text-white font-bold rounded-xl shadow-lg hover:shadow-primary-green/20 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                {isSaving ? 'Saving...' : 'Save User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;

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
  Loader2,
  Copy,
  Pencil,
  Trash2,
  Lock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newUserType, setNewUserType] = useState('org'); // 'org' or 'admin-staff'
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [tempPassword, setTempPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  const { user: currentUser } = useAuth();

  // Form State
  const [formData, setFormData] = useState({
    full_name: '',
    role: '',
    email: '',
    org_name: '',
    no_member: '',
    adviser_name: '',
    joined_date: ''
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
  
  const handleCopyPassword = () => {
    navigator.clipboard.writeText(tempPassword);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const generatePassword = (type) => {
    const prefix = type === 'org' ? 'OSO' : 'STAFF';
    const random = Math.random().toString(36).substring(7).toUpperCase();
    setTempPassword(`${prefix}-${random}`);
  };

  const handleOpenModal = () => {
    setIsEditMode(false);
    setEditingUserId(null);
    setFormData({
      full_name: '',
      role: newUserType === 'org' ? 'org-president' : 'chairman',
      email: '',
      org_name: '',
      no_member: '',
      adviser_name: '',
      joined_date: ''
    });
    generatePassword(newUserType);
    setIsModalOpen(true);
  };

  const handleEditClick = (user) => {
    setIsEditMode(true);
    setEditingUserId(user.id);
    setNewUserType(user.role === 'org-president' ? 'org' : 'admin-staff');
    setFormData({
      full_name: user.full_name || '',
      role: user.role || '',
      email: user.email || '',
      org_name: user.org_name || '',
      no_member: user.no_member || '',
      adviser_name: user.adviser_name || '',
      joined_date: user.joined_date || ''
    });
    setIsModalOpen(true);
  };

  const handleDeleteClick = (user) => {
    setUserToDelete(user);
    setAdminPassword('');
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async (e) => {
    e.preventDefault();
    if (!adminPassword) return;
    
    setIsDeleting(true);
    try {
      const response = await fetch(`http://localhost:5000/api/users/${userToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminEmail: currentUser.email,
          adminPassword: adminPassword
        })
      });
      const result = await response.json();
      
      if (result.success) {
        setIsDeleteModalOpen(false);
        setSuccessMessage('User account has been successfully deleted!');
        setIsSuccessModalOpen(true);
        fetchUsers();
      } else {
        alert('Error: ' + result.error);
      }
    } catch (error) {
      console.error('Error deleting user:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleGenerateReport = () => {
    const doc = new jsPDF();
    const timestamp = new Date().toLocaleString();
    const filterLabel = filterType === 'all' ? 'All Roles' : 
                       filterType === 'org' ? 'Organization Presidents' : 
                       'Chairman / Vice Chairman';

    // 1. Header Design
    doc.setFillColor(34, 139, 34); // Primary Green
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('BULSU BUSTOS', 105, 18, { align: 'center' });
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text('OSODOCS: USER MANAGEMENT REPORT', 105, 28, { align: 'center' });

    // 2. Report Info
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(10);
    doc.text(`Generated on: ${timestamp}`, 15, 50);
    doc.text(`Filter Applied: ${filterLabel}`, 15, 55);
    doc.text(`Total Records: ${filteredUsers.length}`, 15, 60);

    // 3. Table Data
    const tableHeaders = [['User Details', 'Role', 'Organization', 'Adviser', 'Members', 'Status', 'Joined']];
    const tableData = filteredUsers.map(user => [
      `${user.full_name}\n(ID: ${user.id.substring(0, 8)})`,
      user.role,
      user.org_name || '—',
      user.adviser_name || '—',
      user.no_member || '0',
      user.status,
      new Date(user.created_at).toLocaleDateString()
    ]);

    autoTable(doc, {
      startY: 70,
      head: tableHeaders,
      body: tableData,
      theme: 'grid',
      headStyles: { 
        fillColor: [34, 139, 34], 
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: 'bold',
        halign: 'center'
      },
      bodyStyles: { 
        fontSize: 8,
        valign: 'middle'
      },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 25 },
        2: { cellWidth: 35 },
        3: { cellWidth: 30 },
        4: { cellWidth: 15, halign: 'center' },
        5: { cellWidth: 20, halign: 'center' },
        6: { cellWidth: 25, halign: 'center' }
      },
      didDrawPage: (data) => {
        // Footer
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `Page ${data.pageNumber} - OSODOCS System Generated`,
          data.settings.margin.left,
          doc.internal.pageSize.height - 10
        );
      }
    });

    doc.save(`OSODOCS_Report_${filterType}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    const payload = {
      full_name: formData.full_name,
      role: formData.role,
      email: formData.email,
      status: 'Active',
      org_name: formData.org_name || null,
      no_member: formData.no_member || null,
      adviser_name: formData.adviser_name || null,
      joined_date: formData.joined_date || null
    };
    
    if (!isEditMode) {
      payload.password = tempPassword;
    }

    try {
      const url = isEditMode 
        ? `http://localhost:5000/api/users/${editingUserId}` 
        : 'http://localhost:5000/api/users';
      
      const response = await fetch(url, {
        method: isEditMode ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      
      if (result.success) {
        setIsModalOpen(false);
        setSuccessMessage(isEditMode ? 'User account has been successfully updated!' : 'New user account has been successfully created!');
        setIsSuccessModalOpen(true);
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
                          role.includes(searchQuery);
    
    if (filterType === 'all') return matchesSearch;
    if (filterType === 'org') return matchesSearch && role === 'org-president';
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
            onClick={handleGenerateReport}
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
                  <th className="px-6 py-4 font-semibold text-gray-600 text-sm">Organization</th>
                  <th className="px-6 py-4 font-semibold text-gray-600 text-sm">Adviser</th>
                  <th className="px-6 py-4 font-semibold text-gray-600 text-sm text-center">Members</th>
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
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-sm ${user.role === 'org-president' ? 'bg-secondary-gold text-primary-green' : 'bg-primary-green'}`}>
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
                    <td className="px-6 py-4 text-sm text-gray-600 font-medium">
                      {user.org_name || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {user.adviser_name || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 text-center font-mono">
                      {user.no_member || <span className="text-gray-300">—</span>}
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
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => handleEditClick(user)}
                          className="p-2 text-gray-400 hover:text-blue-600 transition-colors bg-gray-50 rounded-lg hover:bg-blue-50"
                        >
                          <Pencil size={16} />
                        </button>
                        {user.role !== 'admin' && (
                          <button 
                            onClick={() => handleDeleteClick(user)}
                            className="p-2 text-gray-400 hover:text-red-600 transition-colors bg-gray-50 rounded-lg hover:bg-red-50"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="8" className="px-6 py-20 text-center text-gray-400">
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
                <h2 className="text-xl font-bold">{isEditMode ? 'Edit User' : 'Create New User'}</h2>
                <p className="text-white/70 text-xs">{isEditMode ? 'Update existing user profile details.' : 'Fill in the details to add a new account to Supabase.'}</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>

            {/* User Type Toggle */}
            <div className="p-6 border-b border-gray-100">
              <div className="flex p-1 bg-gray-100 rounded-xl w-fit mx-auto text-gray-800">
                <button 
                  onClick={() => { 
                    setNewUserType('org'); 
                    generatePassword('org');
                    setFormData(prev => ({ ...prev, role: 'org-president' }));
                  }}
                  className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${newUserType === 'org' ? 'bg-white text-primary-green shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Student Organization
                </button>
                <button 
                  onClick={() => { 
                    setNewUserType('admin-staff'); 
                    generatePassword('admin-staff');
                    setFormData(prev => ({ ...prev, role: 'chairman' }));
                  }}
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">President Full Name</label>
                    <div className="relative">
                      <Shield className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input 
                        type="text" 
                        required
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-green" 
                        placeholder="e.g. Juan Dela Cruz"
                        value={formData.full_name}
                        onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                      />
                    </div>
                  </div>
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">No. of Members</label>
                    <input 
                      type="number" 
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-green text-gray-800" 
                      placeholder="0"
                      value={formData.no_member}
                      onChange={(e) => setFormData({...formData, no_member: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Adviser Name</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-green text-gray-800" 
                      placeholder="e.g. Prof. Juan Dela Cruz"
                      value={formData.adviser_name}
                      onChange={(e) => setFormData({...formData, adviser_name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date of Formation</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input 
                        type="date" 
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-green text-gray-800"
                        value={formData.joined_date}
                        onChange={(e) => setFormData({...formData, joined_date: e.target.value})}
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
                  {!isEditMode && (
                    <div className="md:col-span-2 bg-gray-50 p-4 rounded-2xl border border-gray-100 animate-shine">
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Temporary Password</label>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-primary-green font-bold text-lg">{tempPassword}</span>
                        <button 
                          type="button"
                          onClick={handleCopyPassword}
                          className={`p-1.5 rounded-lg transition-all ${isCopied ? 'bg-green-100 text-green-600' : 'hover:bg-primary-green/10 text-primary-green'}`}
                        >
                          {isCopied ? <Check size={16} /> : <Copy size={16} />}
                        </button>
                      </div>
                      <span className="text-[10px] text-gray-400 italic">Auto-generated</span>
                    </div>
                  )}
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
                  {!isEditMode && (
                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 animate-shine">
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Temporary Password</label>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-primary-green font-bold text-lg">{tempPassword}</span>
                        <button 
                          type="button"
                          onClick={handleCopyPassword}
                          className={`p-1.5 rounded-lg transition-all ${isCopied ? 'bg-green-100 text-green-600' : 'hover:bg-primary-green/10 text-primary-green'}`}
                        >
                          {isCopied ? <Check size={16} /> : <Copy size={16} />}
                        </button>
                      </div>
                      <span className="text-[10px] text-gray-400 italic">Auto-generated</span>
                    </div>
                  )}
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

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity" onClick={() => setIsDeleteModalOpen(false)}></div>
          
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={40} />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Confirm Deletion</h2>
              <p className="text-gray-500 mb-8">
                You are about to delete <span className="font-bold text-gray-800">{userToDelete?.full_name}</span>. This action cannot be undone.
              </p>
              
              <form onSubmit={confirmDelete} className="space-y-4">
                <div className="text-left">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Verify Admin Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                      type="password" 
                      required
                      placeholder="Enter your password"
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500 transition-all text-gray-800"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="flex gap-3 pt-2">
                  <button 
                    type="button"
                    onClick={() => setIsDeleteModalOpen(false)}
                    className="flex-1 px-6 py-3 border border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={isDeleting}
                    className="flex-1 px-6 py-3 bg-red-600 text-white font-bold rounded-xl shadow-lg hover:shadow-red-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isDeleting ? <Loader2 className="animate-spin" size={18} /> : <Trash2 size={18} />}
                    {isDeleting ? 'Deleting...' : 'Delete User'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {isSuccessModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsSuccessModalOpen(false)}></div>
          
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Check size={40} />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Success!</h2>
              <p className="text-gray-500 mb-8 text-gray-500">{successMessage}</p>
              
              <button 
                onClick={() => setIsSuccessModalOpen(false)}
                className="w-full px-6 py-3 bg-primary-green text-white font-bold rounded-xl shadow-lg hover:shadow-primary-green/20 transition-all"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;

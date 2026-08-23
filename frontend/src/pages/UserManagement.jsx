import React, { useState, useEffect } from 'react';
import {
  UserPlus,
  FileText,
  Filter,
  Search,
  X,
  Check,
  Plus,
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
  Lock,
  ArrowLeft,
  Eye,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Ban
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../config/api';
import Avatar from '../components/Avatar';
import ReportPreviewModal from '../components/ReportPreviewModal';
import CompletedDocumentDetail from '../components/CompletedDocumentDetail';
import { useToast } from '../hooks/useToast';
import { supabase } from '../supabaseClient';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const { showToast, ToastComponent } = useToast();
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
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
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [docLogFilter, setDocLogFilter] = useState('all');
  const [selectedSubmissionId, setSelectedSubmissionId] = useState(null);

  // Quick suspend state
  const [isSuspendModalOpen, setIsSuspendModalOpen] = useState(false);
  const [suspendUser, setSuspendUser] = useState(null);
  const [suspendMessage, setSuspendMessage] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportData, setReportData] = useState({ title: '', stats: [], headers: [], rows: [], filename: '' });

  const { user: currentUser } = useAuth();

  // Form State
  const [formData, setFormData] = useState({
    full_name: '',
    role: '',
    email: '',
    org_name: '',
    no_member: '',
    adviser_name: '',
    co_advisers: [],
    joined_date: '',
    contact_no: '',
    student_no: '',
    status: 'Active',
    suspension_message: ''
  });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/api/users');
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

  const fetchUserDetail = async (userId) => {
    setDetailLoading(true);
    try {
      const response = await apiFetch(`/api/users/${userId}/detail?t=${Date.now()}`, { cache: 'no-store' });
      const result = await response.json();
      if (result.success) {
        setDetailData(result.data);
      }
    } catch (error) {
      console.error('Error fetching user detail:', error);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleProfileClick = (user) => {
    setSelectedUser(user);
    setDetailData(null);
    setDocLogFilter('all');
    setSelectedSubmissionId(null);
    fetchUserDetail(user.id);
  };

  const handleBackToList = () => {
    setSelectedUser(null);
    setDetailData(null);
    setSelectedSubmissionId(null);
  };

  const formatDetailDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  };

  const getActivityIcon = (actionType) => {
    const action = String(actionType || '').toLowerCase();
    if (action.includes('reject') || action.includes('disapprove')) return { bg: 'bg-red-100', color: 'text-red-500', icon: XCircle };
    if (action.includes('approv')) return { bg: 'bg-green-100', color: 'text-green-500', icon: CheckCircle };
    if (action.includes('submit')) return { bg: 'bg-blue-100', color: 'text-blue-500', icon: FileText };
    return { bg: 'bg-gray-100', color: 'text-gray-500', icon: Clock };
  };

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
      co_advisers: [],
      joined_date: '',
      contact_no: '',
      student_no: '',
      status: newUserType === 'org' ? 'Inactive' : 'Active',
      suspension_message: ''
    });
    generatePassword(newUserType);
    setIsModalOpen(true);
  };

  const handleEditClick = (user) => {
    setIsEditMode(true);
    setEditingUserId(user.id);

    if (user.role === 'admin') {
      setFormData({
        full_name: user.full_name || '',
        role: user.role || 'admin',
        email: user.email || '',
        org_name: '',
        no_member: '',
        adviser_name: '',
        co_advisers: [],
        joined_date: '',
        contact_no: user.contact_no || '',
        student_no: '',
        status: user.status || 'Active',
        suspension_message: ''
      });
      setIsAdminModalOpen(true);
    } else {
      setNewUserType(user.role === 'org-president' ? 'org' : 'admin-staff');

      const isSuspended = user.status && user.status.startsWith('Suspended');
      const suspensionMsg = isSuspended && user.status.includes(':')
        ? user.status.split(':').slice(1).join(':').trim()
        : '';

      setFormData({
        full_name: user.full_name || '',
        role: user.role || '',
        email: user.email || '',
        org_name: user.org_name || '',
        no_member: user.no_member || '',
        adviser_name: user.adviser_name || '',
        co_advisers: user.co_advisers || [],
        joined_date: user.joined_date || '',
        contact_no: user.contact_no || '',
        student_no: user.student_no || '',
        status: isSuspended ? 'Suspended' : (user.status || 'Active'),
        suspension_message: suspensionMsg
      });
      setIsModalOpen(true);
    }
  };

  const handleToggleSuspendClick = (user) => {
    setSuspendUser(user);
    const isSuspended = user.status && user.status.startsWith('Suspended');
    const existingMsg = isSuspended && user.status.includes(':')
      ? user.status.split(':').slice(1).join(':').trim()
      : '';
    setSuspendMessage(existingMsg);
    setIsSuspendModalOpen(true);
  };

  const handleConfirmStatusChange = async (e) => {
    e.preventDefault();
    if (!suspendUser) return;

    setIsUpdatingStatus(true);
    const isCurrentlySuspended = suspendUser.status && suspendUser.status.startsWith('Suspended');
    const newStatus = isCurrentlySuspended
      ? 'Active (Extended)'
      : (suspendMessage ? `Suspended: ${suspendMessage}` : 'Suspended');

    const payload = {
      full_name: suspendUser.full_name,
      role: suspendUser.role,
      email: suspendUser.email,
      status: newStatus,
      org_name: suspendUser.org_name || null,
      no_member: suspendUser.no_member || null,
      adviser_name: suspendUser.adviser_name || null,
      co_advisers: suspendUser.co_advisers || [],
      joined_date: suspendUser.joined_date || null,
      contact_no: suspendUser.contact_no || null,
      student_no: suspendUser.student_no || null
    };

    try {
      const response = await apiFetch(`/api/users/${suspendUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();

      if (result.success) {
        try {
          const broadcastCh = supabase.channel(`user-status-broadcast-${suspendUser.id}`);
          broadcastCh.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              broadcastCh.send({
                type: 'broadcast',
                event: 'status-changed',
                payload: { status: newStatus },
              });
            }
          });

          const bc = new BroadcastChannel(`user-status-${suspendUser.id}`);
          bc.postMessage({ status: newStatus });
          bc.close();
        } catch (e) {
          console.error('Broadcast error:', e);
        }

        setIsSuspendModalOpen(false);
        setSuccessMessage(isCurrentlySuspended ? 'Account has been successfully reactivated!' : 'Account has been successfully suspended!');
        setIsSuccessModalOpen(true);
        fetchUsers();
        fetchUserDetail(suspendUser.id);
      } else {
        showToast('Error: ' + result.error);
      }
    } catch (error) {
      console.error('Error updating status:', error);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleDeleteClick = (user) => {
    setUserToDelete(user);
    setAdminPassword('');
    setDeleteError('');
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async (e) => {
    e.preventDefault();
    if (!adminPassword) return;

    setIsDeleting(true);
    setDeleteError('');

    try {
      // 1. Verify admin password directly via Supabase Auth client first
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: currentUser?.email || '',
        password: adminPassword,
      });

      if (authError) {
        console.warn('Admin password verification failed:', authError.message);
        setDeleteError('Incorrect admin password. User was not deleted.');
        showToast('Error: Incorrect admin password', 'error');
        setIsDeleting(false);
        return; // STOP EXECUTION! DO NOT DELETE USER IF PASSWORD IS WRONG!
      }

      // 2. Admin password verified! Proceed with API deletion call
      const response = await apiFetch(`/api/users/${userToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminEmail: currentUser?.email || '',
          adminPassword: adminPassword
        })
      });
      const result = await response.json();

      if (response.ok && result.success) {
        setIsDeleteModalOpen(false);
        setAdminPassword('');
        setDeleteError('');
        setSuccessMessage('User account has been successfully deleted!');
        setIsSuccessModalOpen(true);
        fetchUsers();
      } else {
        const errorMsg = result.error || 'Incorrect admin password';
        setDeleteError(errorMsg);
        showToast('Error: ' + errorMsg, 'error');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      setDeleteError('An unexpected error occurred while deleting user');
      showToast('Error deleting user', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleGenerateReport = () => {
    const totalUsers = filteredUsers.length;
    const orgPresidents = filteredUsers.filter(u => u.role === 'org-president').length;
    const osoStaff = filteredUsers.filter(u => u.role === 'chairman' || u.role === 'vice-chairman').length;
    const activeUsers = filteredUsers.filter(u => u.status === 'Active' || u.status === 'Active (Extended)').length;
    const suspendedUsers = filteredUsers.filter(u => u.status?.startsWith('Suspended')).length;

    const stats = [
      { label: 'Total Users', value: totalUsers },
      { label: 'Org Presidents', value: orgPresidents },
      { label: 'OSO Staff', value: osoStaff },
      { label: 'Active / Suspended', value: `${activeUsers} / ${suspendedUsers}` }
    ];

    const tableHeaders = ['User Name & ID', 'Role', 'Organization Name', 'Adviser Name', 'Members', 'Status', 'Date Joined'];
    const tableData = filteredUsers.map(user => [
      `${user.full_name}\n(ID: ${user.id.substring(0, 8).toUpperCase()})`,
      String(user.role).replace('-', ' ').toUpperCase(),
      user.org_name || '—',
      user.adviser_name || '—',
      user.no_member || '0',
      user.status?.startsWith('Suspended') ? 'SUSPENDED' : String(user.status || 'Active').toUpperCase(),
      formatDetailDate(user.joined_date || user.created_at)
    ]);

    const filterLabel = filterType === 'all' ? 'All Roles' :
      filterType === 'org' ? 'Organization Presidents' :
        'Chairman / Vice Chairman';

    setReportData({
      title: `User Management Report (${filterLabel})`,
      stats,
      headers: tableHeaders,
      rows: tableData,
      filename: `User_Management_Report_${new Date().toISOString().split('T')[0]}.pdf`
    });
    setIsReportOpen(true);
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    const payload = {
      full_name: formData.full_name,
      role: formData.role,
      email: formData.email,
      status: formData.status === 'Suspended' && formData.suspension_message
        ? `Suspended: ${formData.suspension_message}`
        : formData.status,
      org_name: formData.org_name || null,
      no_member: formData.no_member ? parseInt(formData.no_member) : null,
      adviser_name: formData.adviser_name || null,
      co_advisers: formData.co_advisers || [],
      joined_date: formData.joined_date || null,
      contact_no: formData.contact_no != null && formData.contact_no !== '' ? String(formData.contact_no) : null,
      student_no: formData.student_no || null
    };

    if (!isEditMode) {
      payload.password = tempPassword;
    }

    try {
      const path = isEditMode
        ? `/api/users/${editingUserId}`
        : '/api/users';

      const response = await apiFetch(path, {
        method: isEditMode ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();

      if (result.success) {
        if (isEditMode && editingUserId) {
          try {
            const broadcastCh = supabase.channel(`user-status-broadcast-${editingUserId}`);
            broadcastCh.subscribe((status) => {
              if (status === 'SUBSCRIBED') {
                broadcastCh.send({
                  type: 'broadcast',
                  event: 'status-changed',
                  payload: { status: payload.status },
                });
              }
            });

            const bc = new BroadcastChannel(`user-status-${editingUserId}`);
            bc.postMessage({ status: payload.status });
            bc.close();
          } catch (e) {
            console.error('Broadcast error:', e);
          }
        }

        setIsModalOpen(false);
        setIsAdminModalOpen(false);
        setSuccessMessage(isEditMode ? 'User account has been successfully updated!' : 'New user account has been successfully created!');
        setIsSuccessModalOpen(true);
        fetchUsers();
        if (selectedUser?.id === editingUserId) {
          fetchUserDetail(editingUserId);
        }
      } else {
        showToast('Error: ' + result.error);
      }
    } catch (error) {
      console.error('Error saving user:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const getRoleLabel = (role) => {
    if (role === 'org-president') return 'Organization President';
    if (role === 'vice-chairman') return 'Vice Chairman';
    if (role === 'admin') return 'System Administrator';
    if (role === 'chairman') return 'Chairman';
    return role || 'User';
  };

  const renderProfileDetail = () => {
    if (!profile) return null;

    const isOrg = profile.role === 'org-president';
    const headerTitle = isOrg ? (profile.org_name || 'Organization') : profile.full_name;
    const headerSubtitle = isOrg
      ? `${profile.full_name || 'President'} • Organization President`
      : getRoleLabel(profile.role);

    let coAdvisersList = [];
    if (Array.isArray(profile.co_advisers)) {
      coAdvisersList = profile.co_advisers;
    } else if (typeof profile.co_advisers === 'string' && profile.co_advisers.trim()) {
      try {
        coAdvisersList = JSON.parse(profile.co_advisers);
      } catch (e) {
        coAdvisersList = profile.co_advisers.split(',').map((s) => s.trim()).filter(Boolean);
      }
    }

    const coAdvisersText = coAdvisersList.length > 0
      ? `Co-Adviser(s): ${coAdvisersList.join(', ')}`
      : 'Main Adviser Only';

    const infoCards = isOrg
      ? [
          { label: 'President', value: profile.full_name, sub: profile.student_no ? `SN: ${profile.student_no}` : '' },
          {
            label: 'Advisers & Co-Advisers',
            value: profile.adviser_name || '—',
            sub: coAdvisersText,
          },
          { label: 'Official Email', value: profile.email || '—', sub: '' },
          { label: 'Contact Number', value: profile.contact_no || '—', sub: '' },
          { label: 'Total Members', value: `${profile.no_member || 0} Active Members`, sub: '' },
          {
            label: 'Renewal Status',
            value: detailData?.renewal?.isEligible ? 'Eligible for Renewal' : 'Not Eligible',
            sub: detailData?.renewal?.isEligible ? 'Good' : 'Action Required',
          },
        ]
      : [
          { label: 'Full Name', value: profile.full_name || '—', sub: profile.student_no ? `SN: ${profile.student_no}` : '' },
          { label: 'Official Email', value: profile.email || '—', sub: 'From Supabase Auth' },
          { label: 'Contact Number', value: profile.contact_no || '—', sub: '' },
          { label: 'Role', value: getRoleLabel(profile.role), sub: '' },
          { label: 'Joined', value: formatDetailDate(profile.joined_date || profile.created_at), sub: '' },
          {
            label: 'Account Status',
            value: profile.status?.startsWith('Suspended') ? 'Suspended' : (profile.status || 'Active'),
            sub: profile.status?.startsWith('Suspended') ? 'Access restricted' : 'Full access',
          },
        ];

    const rawDocLogs = detailData?.documentLogs || [];

    const isDocCompleted = (statusStr) => {
      const s = String(statusStr || '').toLowerCase().trim();
      return (
        s === 'completed' ||
        s === 'approved' ||
        s === 'ready for retrieval' ||
        s === 'waiting for accomplishment report' ||
        s === 'dean approved'
      );
    };

    const isDocDisapproved = (statusStr) => {
      const s = String(statusStr || '').toLowerCase().trim();
      return s.includes('disapproved') || s.includes('rejected');
    };

    const matchDocStatusFilter = (doc, filter) => {
      if (!filter || filter === 'all') return true;
      const statusStr = doc?.rawStatus || doc?.status || '';
      const isCompleted = isDocCompleted(statusStr);
      const isDisapproved = isDocDisapproved(statusStr);

      if (filter === 'completed') {
        return isCompleted;
      }
      if (filter === 'disapproved') {
        return isDisapproved;
      }
      if (filter === 'under-process') {
        return !isCompleted && !isDisapproved;
      }
      return true;
    };

    const filteredDocLogs = rawDocLogs.filter((doc) => matchDocStatusFilter(doc, docLogFilter));

    const totalCount = rawDocLogs.length;
    const underProcessCount = rawDocLogs.filter((d) => matchDocStatusFilter(d, 'under-process')).length;
    const completedCount = rawDocLogs.filter((d) => matchDocStatusFilter(d, 'completed')).length;
    const disapprovedCount = rawDocLogs.filter((d) => matchDocStatusFilter(d, 'disapproved')).length;

    const handleGenerateDocLogsReport = () => {
      const orgName = profile.org_name || profile.full_name || 'Organization';
      const filterLabels = {
        all: 'All Statuses',
        'under-process': 'Under Process Only',
        completed: 'Completed Only',
        disapproved: 'Disapproved Only',
      };
      const currentFilterLabel = filterLabels[docLogFilter] || 'All Statuses';

      const stats = [
        { label: 'Total Submissions', value: totalCount },
        { label: 'Under Process', value: underProcessCount },
        { label: 'Completed', value: completedCount },
        { label: 'Disapproved', value: disapprovedCount },
      ];

      const tableHeaders = ['Ref / Tracking No.', 'Document Name', 'Type', 'Date Submitted', 'Status', 'Venue'];
      const tableData = filteredDocLogs.map((doc) => [
        doc.trackingNumber || String(doc.id).substring(0, 8).toUpperCase(),
        doc.title || 'Untitled',
        doc.type || 'Unknown',
        formatDetailDate(doc.dateSubmitted),
        doc.status || 'Pending',
        doc.venue || '—',
      ]);

      const cleanOrgName = orgName.replace(/[^a-zA-Z0-9]/g, '_');

      setReportData({
        title: `${orgName} — Document Logs Report (${currentFilterLabel})`,
        stats,
        headers: tableHeaders,
        rows: tableData,
        filename: `${cleanOrgName}_Document_Logs_${docLogFilter}_${new Date().toISOString().split('T')[0]}.pdf`,
        personInCharge: profile.full_name || '—',
      });
      setIsReportOpen(true);
    };

    return (
      <div className="space-y-6">
        <div className="relative rounded-2xl p-8 text-white shadow-lg overflow-hidden bg-black">
          {/* Background Video */}
          <video
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover pointer-events-none opacity-60 z-0"
          >
            <source src="/loginbgvid.mp4" type="video/mp4" />
          </video>

          {/* Dark Overlay Gradient */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/50 to-black/70 pointer-events-none z-0" />

          {/* Content */}
          <div className="relative z-10">
            <div className="flex flex-col md:flex-row md:items-start gap-6">
              <Avatar
                profileImage={profile.profile_image}
                name={isOrg ? (profile.org_name || profile.full_name) : profile.full_name}
                className={`${isOrg ? 'w-20 h-20 rounded-2xl' : 'w-20 h-20 rounded-full'} shadow-lg shrink-0`}
                fallbackClassName={isOrg ? 'bg-secondary-gold text-primary-green font-black text-2xl' : 'bg-white/20 text-white font-black text-3xl'}
              />
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <h1 className="text-2xl md:text-3xl font-black">{headerTitle}</h1>
                  <button onClick={() => handleEditClick(profile)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                    <Pencil size={16} />
                  </button>
                </div>
                <p className="text-green-100 text-sm font-medium mb-4">{headerSubtitle}</p>
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="px-4 py-1.5 bg-white/20 rounded-full text-xs font-bold">Active Since - {activeSinceYear}</span>
                  <span className={`px-4 py-1.5 rounded-full text-xs font-bold ${profile.status?.startsWith('Suspended') ? 'bg-red-500/25 text-red-100' :
                    profile.status === 'Inactive' ? 'bg-gray-500/25 text-gray-200' :
                      'bg-white/20 text-white'
                    }`}>
                    {profile.status?.startsWith('Suspended') ? 'Suspended' : (profile.status || 'Active')}
                  </span>
                  {profile.role !== 'admin' && (
                    profile.status?.startsWith('Suspended') ? (
                      <button onClick={() => handleToggleSuspendClick(profile)} className="px-4 py-1.5 bg-white text-green-600 hover:bg-green-50 rounded-full text-xs font-bold flex items-center gap-1 transition-all shadow-sm">
                        <Check size={12} /> Reactivate Account
                      </button>
                    ) : (
                      <button onClick={() => handleToggleSuspendClick(profile)} className="px-4 py-1.5 bg-white text-red-600 hover:bg-red-50 rounded-full text-xs font-bold flex items-center gap-1 transition-all shadow-sm">
                        <Ban size={12} /> Suspend Account
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>

            <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8`}>
              {infoCards.map(({ label, value, sub }) => (
                <div key={label} className="bg-white/10 backdrop-blur-md border border-white/15 rounded-xl p-4 text-white shadow-sm">
                  <p className="text-[10px] font-bold text-green-300 uppercase tracking-wider mb-1">{label}</p>
                  <p className="font-bold text-sm text-white line-clamp-2">{value}</p>
                  {sub && <p className="text-[11px] text-green-100/90 font-medium mt-1 leading-snug">{sub}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {isOrg && pendingCount > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="text-yellow-600 shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-bold text-yellow-800 text-sm">Attention Needed</p>
              <p className="text-xs text-yellow-700 mt-0.5">
                This organization has {pendingCount} document{pendingCount !== 1 ? 's' : ''} pending review in the current school year.
              </p>
            </div>
          </div>
        )}

        {!isOrg && (detailData?.documentLogs || []).length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
            <Clock className="text-blue-600 shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-bold text-blue-800 text-sm">Active Review Queue</p>
              <p className="text-xs text-blue-700 mt-0.5">
                {detailData.documentLogs.length} document{detailData.documentLogs.length !== 1 ? 's are' : ' is'} currently assigned for review.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-50 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-gray-800 uppercase">
                  {isOrg ? 'Document Logs' : 'Reviewed Documents'}
                </h2>
                <p className="text-xs font-bold text-gray-400 mt-1">
                  {isOrg ? 'Current school year submissions' : 'Documents actively under review'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex bg-gray-100 p-1 rounded-xl text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setDocLogFilter('all')}
                    className={`px-2.5 py-1.5 rounded-lg transition-all ${
                      docLogFilter === 'all'
                        ? 'bg-white text-gray-800 shadow-sm font-black'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    All ({totalCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocLogFilter('under-process')}
                    className={`px-2.5 py-1.5 rounded-lg transition-all ${
                      docLogFilter === 'under-process'
                        ? 'bg-white text-yellow-700 shadow-sm font-black'
                        : 'text-gray-500 hover:text-yellow-600'
                    }`}
                  >
                    Under Process ({underProcessCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocLogFilter('completed')}
                    className={`px-2.5 py-1.5 rounded-lg transition-all ${
                      docLogFilter === 'completed'
                        ? 'bg-white text-green-700 shadow-sm font-black'
                        : 'text-gray-500 hover:text-green-600'
                    }`}
                  >
                    Completed ({completedCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocLogFilter('disapproved')}
                    className={`px-2.5 py-1.5 rounded-lg transition-all ${
                      docLogFilter === 'disapproved'
                        ? 'bg-white text-red-700 shadow-sm font-black'
                        : 'text-gray-500 hover:text-red-600'
                    }`}
                  >
                    Disapproved ({disapprovedCount})
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleGenerateDocLogsReport}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-green text-white text-xs font-bold rounded-xl hover:bg-primary-green/90 transition-all shadow-sm shrink-0"
                  title="Generate Document Logs Report"
                >
                  <FileText size={14} />
                  <span>Generate Report</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#073c2d] text-white">
                    <th className="px-6 py-3 text-xs font-black uppercase text-white">Document Name</th>
                    <th className="px-6 py-3 text-xs font-black uppercase text-white">Type</th>
                    <th className="px-6 py-3 text-xs font-black uppercase text-white">{isOrg ? 'Date Submitted' : 'Date Logged'}</th>
                    <th className="px-6 py-3 text-xs font-black uppercase text-white">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredDocLogs.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="px-6 py-12 text-center text-gray-400 font-bold text-sm">
                        {isOrg
                          ? `No ${docLogFilter !== 'all' ? docLogFilter.replace('-', ' ') : ''} documents found for the current school year.`
                          : 'No documents currently assigned for review.'}
                      </td>
                    </tr>
                  ) : (
                    filteredDocLogs.map((doc) => {
                      const statusStr = doc.rawStatus || doc.status || '';
                      const isCompleted = isDocCompleted(statusStr);
                      const isDisapproved = isDocDisapproved(statusStr);
                      const isReturned = String(statusStr).toLowerCase().includes('returned');

                      let badgeStyle = 'bg-yellow-100 text-yellow-700';
                      if (isCompleted) badgeStyle = 'bg-green-100 text-green-700';
                      else if (isDisapproved) badgeStyle = 'bg-red-100 text-red-700';
                      else if (isReturned) badgeStyle = 'bg-orange-100 text-orange-700';

                      const statusLower = String(doc.status || '').toLowerCase().trim();
                      const isPendingHardCopy = statusLower === 'to forward' || statusLower.includes('hardcopy');
                      const displayStatusText = isPendingHardCopy
                        ? 'PENDING HARD COPY'
                        : (isCompleted ? 'COMPLETED' : doc.status);

                      return (
                        <tr
                          key={doc.id}
                          onClick={() => setSelectedSubmissionId(doc.id)}
                          className="hover:bg-green-50/50 hover:border-l-4 hover:border-primary-green transition-all cursor-pointer group"
                        >
                          <td className="px-6 py-4 font-semibold text-sm text-gray-800 group-hover:text-primary-green transition-colors">
                            {doc.title}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">{doc.type}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{formatDetailDate(doc.dateSubmitted)}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase ${badgeStyle}`}>
                              {isCompleted && <CheckCircle size={12} />}
                              {isDisapproved && <XCircle size={12} />}
                              {!isCompleted && !isDisapproved && <Clock size={12} />}
                              {displayStatusText}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="p-6 border-b border-gray-50">
              <h2 className="text-lg font-black text-gray-800 uppercase">Activity History</h2>
              <p className="text-xs font-bold text-gray-400 mt-1">Current school year actions by this user</p>
            </div>
              <div className="p-6 space-y-3 max-h-[520px] overflow-y-auto">
                {(detailData?.activityHistory || []).length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8 font-medium">No activity recorded for the current school year.</p>
                ) : (
                  detailData.activityHistory.map((log) => {
                    const { bg, color, icon: Icon } = getActivityIcon(log.action_type);
                    const docTitle = log.docTitle || log.submissions?.docTitle || null;
                    const trackingNo = log.trackingNumber || log.submissions?.tracking_number || null;
                    const isClickable = Boolean(log.submission_id);

                    return (
                      <div
                        key={log.id}
                        onClick={() => log.submission_id && setSelectedSubmissionId(log.submission_id)}
                        className={`p-3.5 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-green-50/60 hover:border-primary-green/30 transition-all ${
                          isClickable ? 'cursor-pointer group' : ''
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-full ${bg} ${color} flex items-center justify-center shrink-0 mt-0.5 shadow-sm`}>
                            <Icon size={14} />
                          </div>
                          <div className="flex-1 min-w-0">
                            {docTitle ? (
                              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                <span className="font-bold text-xs text-gray-900 group-hover:text-primary-green transition-colors break-words line-clamp-2">
                                  {docTitle}
                                </span>
                                {trackingNo && (
                                  <span className="px-1.5 py-0.5 bg-gray-200/80 text-gray-700 text-[10px] font-mono font-bold rounded shrink-0">
                                    {trackingNo}
                                  </span>
                                )}
                              </div>
                            ) : trackingNo ? (
                              <span className="px-1.5 py-0.5 bg-gray-200/80 text-gray-700 text-[10px] font-mono font-bold rounded mb-1 inline-block">
                                {trackingNo}
                              </span>
                            ) : null}

                            <p className="text-xs text-gray-600 font-medium leading-snug break-words">
                              {log.description || String(log.action_type || '').replace(/_/g, ' ')}
                            </p>

                            <p className="text-[10px] text-gray-400 font-bold mt-1.5 flex items-center gap-1">
                              <Clock size={10} />
                              {formatDetailDate(log.created_at)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
          </section>
        </div>
      </div>
    );
  };

  const filteredUsers = users.filter(user => {
    const name = user.full_name || '';
    const role = user.role || '';
    const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      role.includes(searchQuery.toLowerCase()) ||
      (user.org_name || '').toLowerCase().includes(searchQuery.toLowerCase());

    if (filterType === 'all') return matchesSearch;
    if (filterType === 'org') return matchesSearch && role === 'org-president';
    if (filterType === 'staff') return matchesSearch && (role === 'chairman' || role === 'vice-chairman');
    return matchesSearch;
  });

  const profile = selectedUser ? (detailData?.user || selectedUser) : null;
  const isOrgPresident = selectedUser ? selectedUser.role === 'org-president' : false;
  const activeSinceYear = selectedUser
    ? (profile?.joined_date ? new Date(profile.joined_date).getFullYear() : (profile?.created_at ? new Date(profile.created_at).getFullYear() : new Date().getFullYear()))
    : 0;
  const pendingCount = selectedUser ? (detailData?.pendingReviewCount || 0) : 0;

  return (
    <div className="animate-in fade-in duration-500">
      {selectedSubmissionId ? (
        <CompletedDocumentDetail
          submissionId={selectedSubmissionId}
          onBack={() => setSelectedSubmissionId(null)}
        />
      ) : selectedUser ? (
        <div>
          <button
            onClick={handleBackToList}
            className="flex items-center gap-2 text-gray-500 hover:text-primary-green font-semibold text-sm mb-6 transition-colors"
          >
            <ArrowLeft size={18} />
            Back to User Management
          </button>

          {detailLoading ? (
            <div className="p-20 flex flex-col items-center justify-center text-gray-400">
              <Loader2 className="animate-spin mb-4" size={40} />
              <p>Loading profile details...</p>
            </div>
          ) : (
            renderProfileDetail()
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <PageHeader 
              title="User Management" 
              subtitle="Manage institutional users and student organizations." 
              icon={UsersIcon} 
              iconColor="purple" 
            />

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

            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="hidden md:flex text-sm font-medium text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100 items-center gap-1.5 shrink-0">
                <UsersIcon size={16} className="text-gray-400" />
                Total Users: <span className="font-bold text-gray-800">{filteredUsers.length}</span>
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <Filter size={18} className="text-gray-400 shrink-0" />
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
                    <tr className="bg-[#073c2d] text-white border-b border-[#073c2d]">
                      <th className="px-6 py-4 font-semibold text-white text-sm">User Details</th>
                      <th className="px-6 py-4 font-semibold text-white text-sm">Role</th>
                      <th className="px-6 py-4 font-semibold text-white text-sm">Adviser</th>
                      <th className="px-6 py-4 font-semibold text-white text-sm text-center">Members</th>
                      <th className="px-6 py-4 font-semibold text-white text-sm">Status</th>
                      <th className="px-6 py-4 font-semibold text-white text-sm">Joined</th>
                      <th className="px-6 py-4 font-semibold text-white text-sm text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredUsers.length > 0 ? filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50/80 transition-colors group cursor-pointer" onClick={() => handleProfileClick(user)}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <Avatar
                              profileImage={user.profile_image}
                              name={user.role === 'org-president' ? (user.org_name || user.full_name) : user.full_name}
                              className="w-10 h-10 rounded-full shadow-sm"
                              fallbackClassName={`text-white ${user.role === 'org-president' ? 'bg-secondary-gold text-primary-green' : 'bg-primary-green'}`}
                            />
                            <div className="min-w-0">
                              <div 
                                className="font-semibold text-gray-800 truncate max-w-[180px]" 
                                title={user.role === 'org-president' ? (user.org_name || user.full_name) : user.full_name}
                              >
                                {user.role === 'org-president' ? (user.org_name || user.full_name) : user.full_name}
                              </div>
                              <div 
                                className="text-[10px] text-gray-400 font-mono truncate max-w-[180px]"
                                title={user.role === 'org-president' ? user.full_name : ''}
                              >
                                {user.role === 'org-president' ? (
                                  user.full_name
                                ) : (
                                  <>{user.student_no ? `SN: ${user.student_no} | ` : ''}ID: {user.id.substring(0, 8)}</>
                                )}
                              </div>
                              {user.contact_no && (
                                <div className="text-[11px] text-gray-500 font-medium mt-0.5 flex items-center gap-1 truncate max-w-[180px]">
                                  <span>📞 {user.contact_no}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-orange-100 text-orange-700">
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 max-w-[150px] truncate" title={user.adviser_name || ''}>
                          {user.adviser_name || <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 text-center font-mono">
                          {user.no_member || <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5">
                            <div className={`w-1.5 h-1.5 rounded-full ${user.status?.startsWith('Suspended') ? 'bg-red-500' :
                              user.status === 'Inactive' ? 'bg-gray-400' : 'bg-green-500'
                              }`}></div>
                            <span className="text-sm text-gray-600">
                              {user.status?.startsWith('Suspended') ? 'Suspended' : (user.status || 'Active')}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-400 text-xs">
                          {formatDetailDate(user.joined_date || user.created_at)}
                        </td>
                        <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
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
        </>
      )}

      {/* Modal - Create User */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
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
            {!isEditMode && (
              <div className="p-6 border-b border-gray-100">
                <div className="flex p-1 bg-gray-100 rounded-xl w-fit mx-auto text-gray-800">
                  <button
                    type="button"
                    onClick={() => {
                      setNewUserType('org');
                      generatePassword('org');
                      setFormData(prev => ({ ...prev, role: 'org-president', status: 'Inactive' }));
                    }}
                    className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${newUserType === 'org' ? 'bg-white text-primary-green shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Student Organization
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewUserType('admin-staff');
                      generatePassword('admin-staff');
                      setFormData(prev => ({ ...prev, role: 'chairman', status: 'Active' }));
                    }}
                    className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${newUserType === 'admin-staff' ? 'bg-white text-primary-green shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    OSO Staff
                  </button>
                </div>
              </div>
            )}

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
                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Student Number</label>
                    <input
                      type="text"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-green text-gray-800"
                      placeholder="e.g. 2021-123456"
                      value={formData.student_no}
                      onChange={(e) => {
                        const cleaned = e.target.value.replace(/[^\d-]/g, '');
                        setFormData({ ...formData, student_no: cleaned });
                      }}
                      title="Student number can contain numbers and an optional hyphen"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number</label>
                    <input
                      type="text"
                      required
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-green text-gray-800"
                      placeholder="e.g. 09123456789"
                      value={formData.contact_no}
                      onChange={(e) => {
                        const cleaned = e.target.value.replace(/[^\d]/g, '');
                        setFormData({ ...formData, contact_no: cleaned });
                      }}
                      pattern="^09[0-9]{9}$"
                      maxLength="11"
                      title="Contact number must be an 11-digit mobile number starting with 09"
                    />
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
                        onChange={(e) => setFormData({ ...formData, org_name: e.target.value })}
                        minLength="2"
                        title="Organization name must contain at least 2 characters"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">No. of Members</label>
                    <input
                      type="text"
                      required
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-green text-gray-800"
                      placeholder="0"
                      value={formData.no_member}
                      onChange={(e) => {
                        const cleaned = e.target.value.replace(/[^\d]/g, '');
                        setFormData({ ...formData, no_member: cleaned });
                      }}
                      title="Number of members must be a positive integer"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Adviser Name</label>
                    <input
                      type="text"
                      required
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-green text-gray-800"
                      placeholder="e.g. Prof. Juan Dela Cruz"
                      value={formData.adviser_name}
                      onChange={(e) => setFormData({ ...formData, adviser_name: e.target.value })}
                      minLength="2"
                      title="Adviser name must be a valid alphabetical name of at least 2 characters"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-2 mt-4">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-gray-700">Co-Advisers (Optional)</label>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, co_advisers: [...(formData.co_advisers || []), ''] })}
                        className="text-xs font-bold text-primary-green hover:text-[#0b5c2a] flex items-center gap-1"
                      >
                        <Plus size={14} /> Add Co-Adviser
                      </button>
                    </div>
                    {formData.co_advisers?.map((coAdviser, idx) => (
                      <div key={idx} className="flex gap-2 items-center animate-in fade-in zoom-in duration-200">
                        <input
                          type="text"
                          className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-green text-gray-800"
                          placeholder={`Co-Adviser ${idx + 1} Name`}
                          value={coAdviser}
                          onChange={(e) => {
                            const newCoAdvisers = [...formData.co_advisers];
                            newCoAdvisers[idx] = e.target.value;
                            setFormData({ ...formData, co_advisers: newCoAdvisers });
                          }}
                          title="Co-Adviser name must be a valid name"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const newCoAdvisers = formData.co_advisers.filter((_, i) => i !== idx);
                            setFormData({ ...formData, co_advisers: newCoAdvisers });
                          }}
                          className="p-2.5 text-red-500 hover:bg-red-50 rounded-xl transition-colors shrink-0"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    ))}
                    {(!formData.co_advisers || formData.co_advisers.length === 0) && (
                      <div className="text-xs text-gray-400 italic">No co-advisers added yet. Click "Add Co-Adviser" to add one.</div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date of Formation</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input
                        type="date"
                        required
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-green text-gray-800"
                        value={formData.joined_date}
                        onChange={(e) => setFormData({ ...formData, joined_date: e.target.value })}
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
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                  </div>
                  {isEditMode && (
                    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-gray-100 pt-6">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Account Status</label>
                        <select
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-green bg-white text-gray-800"
                          value={formData.status}
                          onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        >
                          <option value="Active">Active</option>
                          <option value="Active (Extended)">Active (Extended)</option>
                          <option value="Suspended">Suspended</option>
                          <option value="Inactive">Inactive</option>
                        </select>
                      </div>
                      {formData.status === 'Suspended' && (
                        <div className="md:col-span-2">
                          <label className="block text-sm font-semibold text-gray-700 mb-1">Suspension Message (Optional)</label>
                          <textarea
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-green text-gray-800"
                            placeholder="Provide reason or instructions for reactivation..."
                            value={formData.suspension_message || ''}
                            onChange={(e) => setFormData({ ...formData, suspension_message: e.target.value })}
                            rows={3}
                          />
                        </div>
                      )}
                    </div>
                  )}
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
                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                    <div className="relative">
                      <select
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-green bg-white appearance-none"
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
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
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number</label>
                    <input
                      type="text"
                      required
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-green text-gray-800"
                      placeholder="e.g. 09123456789"
                      value={formData.contact_no}
                      onChange={(e) => {
                        const cleaned = e.target.value.replace(/[^\d]/g, '');
                        setFormData({ ...formData, contact_no: cleaned });
                      }}
                      pattern="09[0-9]{9}"
                      maxLength="11"
                      title="Contact number must be an 11-digit mobile number starting with 09"
                    />
                  </div>
                  {isEditMode && (
                    <div className="border-t border-gray-100 pt-6">
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Account Status</label>
                      <select
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-green bg-white text-gray-800"
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      >
                        <option value="Active">Active</option>
                        <option value="Active (Extended)">Active (Extended)</option>
                        <option value="Suspended">Suspended</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                      {formData.status === 'Suspended' && (
                        <div className="mt-4">
                          <label className="block text-sm font-semibold text-gray-700 mb-1">Suspension Message (Optional)</label>
                          <textarea
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-green text-gray-800"
                            placeholder="Provide reason or instructions for reactivation..."
                            value={formData.suspension_message || ''}
                            onChange={(e) => setFormData({ ...formData, suspension_message: e.target.value })}
                            rows={3}
                          />
                        </div>
                      )}
                    </div>
                  )}
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

      {/* Modal - Edit Admin Details */}
      {isAdminModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setIsAdminModalOpen(false)}></div>

          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-[#0b5c2a] p-6 text-white flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Shield size={22} className="text-secondary-gold shrink-0 animate-pulse" />
                  Edit Admin Account
                </h2>
                <p className="text-white/70 text-xs">Update SDS Coordinator admin profile details and email.</p>
              </div>
              <button onClick={() => setIsAdminModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSaveUser} id="edit-admin-form" className="p-8 max-h-[60vh] overflow-y-auto text-gray-800 space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">SDS Coordinator Name</label>
                <div className="relative">
                  <Shield className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    required
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-green"
                    placeholder="e.g. SDS Coordinator"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Contact Number</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-green text-gray-800"
                    placeholder="e.g. 09123456789"
                    value={formData.contact_no}
                    onChange={(e) => {
                      const cleaned = e.target.value.replace(/[^\d]/g, '');
                      setFormData({ ...formData, contact_no: cleaned });
                    }}
                    pattern="^09[0-9]{9}$"
                    maxLength="11"
                    title="Contact number must be an 11-digit mobile number starting with 09"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="email"
                      required
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-green"
                      placeholder="admin@bulsu.edu.ph"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Status and Role - Read Only Visual Panels */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-100 font-sans">
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex items-center justify-between">
                  <div>
                    <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Account Role</span>
                    <span className="font-bold text-sm text-gray-700">SDS Coordinator (Admin)</span>
                  </div>
                  <Shield size={20} className="text-primary-green opacity-40" />
                </div>

                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex items-center justify-between">
                  <div>
                    <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Account Status</span>
                    <span className="font-bold text-sm text-green-600">Active</span>
                  </div>
                  <CheckCircle size={20} className="text-green-500 opacity-40" />
                </div>
              </div>
            </form>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-100 flex gap-3 justify-end bg-gray-50/50">
              <button
                type="button"
                onClick={() => setIsAdminModalOpen(false)}
                className="px-6 py-2.5 text-gray-500 font-semibold hover:text-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                form="edit-admin-form"
                type="submit"
                disabled={isSaving}
                className="px-8 py-2.5 bg-[#0b5c2a] text-white font-bold rounded-xl shadow-lg hover:shadow-green-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                {isSaving ? 'Saving Changes...' : 'Save Profile'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
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
                {deleteError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl text-left flex items-center gap-2 animate-in fade-in duration-200">
                    <AlertTriangle size={16} className="shrink-0 text-red-500" />
                    <span>{deleteError}</span>
                  </div>
                )}
                <div className="text-left">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Verify Admin Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="password"
                      required
                      placeholder="Enter your password"
                      className={`w-full pl-10 pr-4 py-3 border rounded-xl outline-none focus:ring-2 transition-all text-gray-800 ${
                        deleteError
                          ? 'border-red-500 focus:ring-red-500/25 focus:border-red-500'
                          : 'border-gray-200 focus:ring-red-500'
                      }`}
                      value={adminPassword}
                      onChange={(e) => {
                        setAdminPassword(e.target.value);
                        setDeleteError('');
                      }}
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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
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

      {/* Suspend / Reactivate Confirmation Modal */}
      {isSuspendModalOpen && suspendUser && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setIsSuspendModalOpen(false)}></div>

          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-200 text-gray-800">
            {/* Header */}
            <div className={`p-6 text-white flex justify-between items-center ${suspendUser.status && suspendUser.status.startsWith('Suspended') ? 'bg-green-600' : 'bg-red-600'}`}>
              <div>
                <h2 className="text-xl font-bold">
                  {suspendUser.status && suspendUser.status.startsWith('Suspended') ? 'Reactivate Account' : 'Suspend Account'}
                </h2>
                <p className="text-white/70 text-xs">
                  {suspendUser.status && suspendUser.status.startsWith('Suspended')
                    ? 'Restore normal access for this user.'
                    : 'Restricting access to the system.'}
                </p>
              </div>
              <button onClick={() => setIsSuspendModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Form / Body */}
            <form onSubmit={handleConfirmStatusChange} className="p-6 space-y-4">
              <p className="text-sm text-gray-500 leading-relaxed">
                You are about to change the status of <span className="font-bold text-gray-800">{suspendUser.org_name || suspendUser.full_name}</span>.
              </p>

              {suspendUser.status && suspendUser.status.startsWith('Suspended') ? (
                <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-sm text-green-800">
                  <p>Reactivating this account will restore their access. They will be able to submit documents and perform normal dashboard actions immediately.</p>
                </div>
              ) : (
                <>
                  <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-sm text-red-800">
                    <p>Suspending this account will block the organization from submitting documents and lock their dashboard.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Suspension Reason (Optional)</label>
                    <textarea
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500 text-gray-800"
                      placeholder="e.g. Failure to submit compliance requirements on time."
                      value={suspendMessage}
                      onChange={(e) => setSuspendMessage(e.target.value)}
                      rows={3}
                    />
                  </div>
                </>
              )}

              {/* Footer Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSuspendModalOpen(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition-all text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingStatus}
                  className={`flex-1 px-4 py-2.5 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 ${suspendUser.status && suspendUser.status.startsWith('Suspended')
                    ? 'bg-green-600 hover:shadow-green-600/20'
                    : 'bg-red-600 hover:shadow-red-600/20'
                    }`}
                >
                  {isUpdatingStatus ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                  {isUpdatingStatus ? 'Updating...' : (suspendUser.status && suspendUser.status.startsWith('Suspended') ? 'Reactivate' : 'Suspend')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Report Preview Modal */}
      <ReportPreviewModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        title={reportData.title}
        stats={reportData.stats}
        tableHeaders={reportData.headers}
        tableData={reportData.rows}
        pdfFilename={reportData.filename}
        personInCharge={reportData.personInCharge}
        generatedBy={currentUser?.full_name || 'System Administrator'}
      />

      <ToastComponent />
    </div>
  );
};

export default UserManagement;

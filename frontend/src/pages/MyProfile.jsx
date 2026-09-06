import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { 
  AlertCircle,
  CheckCircle2,
  X,
  Plus,
  Loader2,
  User as UserIcon,
  Shield,
  ShieldCheck,
  Mail,
  Hash,
  Phone,
  Calendar,
  Camera,
  Clock
} from 'lucide-react';

import { apiFetch } from '../config/api';

import OrgProfileHeader from '../components/profile/OrgProfileHeader';
import IdentityPanel from '../components/profile/IdentityPanel';
import OrganizationRecord from '../components/profile/OrganizationRecord';
import BoardRoster from '../components/profile/BoardRoster';
import TermHistory from '../components/profile/TermHistory';
import AccountSettings from '../components/profile/AccountSettings';
import SecurityPanel from '../components/profile/SecurityPanel';
import PageHeader from '../components/PageHeader';
import Avatar from '../components/Avatar';

const MyProfile = () => {
  const { user, refreshUser, activeMember } = useAuth();

  // Saving states
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef(null);

  // School Years state (identically matching UserManagement.jsx)
  const [activeSy, setActiveSy] = useState(null);
  const [allSchoolYears, setAllSchoolYears] = useState([]);
  const [selectedSyId, setSelectedSyId] = useState('');

  // User detail state (matching UserManagement.jsx: detailData, detailLoading, academicYearSnapshots)
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [academicYearSnapshots, setAcademicYearSnapshots] = useState([]);

  // Executive Members state
  const [members, setMembers] = useState([]);
  const [allOrgMembers, setAllOrgMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [isSavingMember, setIsSavingMember] = useState(false);
  const [positionSelection, setPositionSelection] = useState('Vice President');
  const [customPosition, setCustomPosition] = useState('');
  const [memberForm, setMemberForm] = useState({
    full_name: '',
    position: 'Vice President',
    student_number: '',
    contact_number: '',
  });

  // Toast State
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // 1. Fetch School Years using apiFetch('/api/school-years') (matching UserManagement.jsx lines 134-149)
  const fetchSchoolYears = async () => {
    try {
      const res = await apiFetch('/api/school-years');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        const sys = data.data;
        setAllSchoolYears(sys);
        const active = sys.find((s) => s.is_active) || sys[0];
        if (active) {
          setActiveSy(active);
          if (!selectedSyId) {
            setSelectedSyId(active.id);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching school years:', err);
    }
  };

  // 2. Fetch User Detail using apiFetch(`/api/users/${userId}/detail?syId=${targetSy}`) (matching UserManagement.jsx lines 181-196)
  const fetchUserDetail = async (userId, syId) => {
    if (!userId) return;
    setDetailLoading(true);
    try {
      const targetSy = syId || selectedSyId;
      const syParam = targetSy ? `&syId=${targetSy}` : '';
      const response = await apiFetch(`/api/users/${userId}/detail?t=${Date.now()}${syParam}`, { cache: 'no-store' });
      const result = await response.json();
      if (result.success && result.data) {
        setDetailData(result.data);
        if (result.data.academicYearSnapshots) {
          setAcademicYearSnapshots(result.data.academicYearSnapshots);
        }
      }
    } catch (error) {
      console.error('Error fetching user detail:', error);
    } finally {
      setDetailLoading(false);
    }
  };

  // Initialize school years
  useEffect(() => {
    fetchSchoolYears();
  }, []);

  // Fetch detail whenever selected school year or user ID changes (matching UserManagement.jsx lines 198-202)
  useEffect(() => {
    if (user?.id) {
      fetchUserDetail(user.id, selectedSyId);
    }
  }, [selectedSyId, user?.id]);

  // Load executive board members for the selected term
  useEffect(() => {
    if (user && user.role === 'org-president') {
      loadMembers(selectedSyId);
      loadAllHistoricalMembers();
    }
  }, [selectedSyId, user?.id, user?.role, user?.organization_id]);

  const loadMembers = async (targetSyId = null) => {
    if (!user?.id) return;
    const syIdToUse = targetSyId || selectedSyId || activeSy?.id;
    setLoadingMembers(true);
    try {
      let query = supabase
        .from('organization_members')
        .select('*')
        .or(`user_id.eq.${user.id},organization_id.eq.${user.organization_id || '00000000-0000-0000-0000-000000000000'}`);

      if (syIdToUse) {
        query = query.eq('school_year_id', syIdToUse);
      }

      const { data, error } = await query.order('created_at', { ascending: true });

      if (!error && data) {
        if (data.length === 0 && syIdToUse === activeSy?.id) {
          const { data: legacyData, error: legErr } = await supabase
            .from('organization_members')
            .select('*')
            .or(`user_id.eq.${user.id},organization_id.eq.${user.organization_id || '00000000-0000-0000-0000-000000000000'}`)
            .is('school_year_id', null)
            .order('created_at', { ascending: true });
          if (!legErr && legacyData && legacyData.length > 0) {
            setMembers(legacyData);
            setLoadingMembers(false);
            return;
          }
        }
        setMembers(data);
      } else if (error) {
        const { data: fallbackData } = await supabase
          .from('organization_members')
          .select('*')
          .or(`user_id.eq.${user.id},organization_id.eq.${user.organization_id || '00000000-0000-0000-0000-000000000000'}`)
          .order('created_at', { ascending: true });
        if (fallbackData) setMembers(fallbackData);
      }
    } catch (err) {
      console.warn('Error loading executive members:', err);
    } finally {
      setLoadingMembers(false);
    }
  };

  const loadAllHistoricalMembers = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('organization_members')
        .select('*')
        .or(`user_id.eq.${user.id},organization_id.eq.${user.organization_id || '00000000-0000-0000-0000-000000000000'}`)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setAllOrgMembers(data);
      }
    } catch (err) {
      console.warn('Error loading historical members:', err);
    }
  };

  const createAuditLog = async (description) => {
    try {
      const { error } = await supabase.from('submission_logs').insert([{
        user_id: user.id,
        action_type: 'Profile Update',
        description: description,
      }]);
      if (error) {
        console.warn('Could not create audit log:', error);
      }
    } catch (err) {
      console.warn('Audit log error:', err);
    }
  };

  // 3. Profile Image Upload
  const handleProfileImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      showToast('Please upload a valid image (JPG, PNG, WEBP)', 'error');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast('Image size must be less than 5MB', 'error');
      return;
    }

    setIsUploadingImage(true);
    try {
      const filePath = `${user.id}/avatar.jpg`;
      
      const { error: uploadError } = await supabase.storage
        .from('profile_img')
        .upload(filePath, file, {
          cacheControl: '0',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from('users')
        .update({ profile_image: filePath })
        .eq('id', user.id);

      if (updateError) throw updateError;

      await createAuditLog('Updated profile picture');
      await refreshUser();
      showToast('Profile picture updated successfully!');
    } catch (err) {
      console.error('Image upload error:', err);
      showToast(err.message || 'Failed to update profile picture', 'error');
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 4. Update Profile Details
  const handleUpdateProfile = async ({ fullName, abbreviation, contactNumber }) => {
    if (!isPresident) {
      showToast('Only the Organization President can modify organization details.', 'error');
      return false;
    }
    if (!fullName?.trim()) {
      showToast('Full Name is required', 'error');
      return false;
    }

    setIsSavingProfile(true);
    try {
      const payload = { 
        full_name: fullName.trim(),
        contact_no: contactNumber?.trim() || null,
      };

      if (user.role === 'org-president') {
        const trimmedAbbr = abbreviation?.trim() || '';
        if (trimmedAbbr.length > 15) {
          showToast('Organization Abbreviation cannot exceed 15 characters', 'error');
          setIsSavingProfile(false);
          return false;
        }

        if (trimmedAbbr) {
          const { data: existingUserAbbr } = await supabase
            .from('users')
            .select('id, abbreviation')
            .ilike('abbreviation', trimmedAbbr)
            .neq('id', user.id)
            .maybeSingle();

          if (existingUserAbbr) {
            showToast(`An organization with the abbreviation "${trimmedAbbr}" already exists.`, 'error');
            setIsSavingProfile(false);
            return false;
          }
        }

        payload.abbreviation = trimmedAbbr;
      }

      const { error } = await supabase
        .from('users')
        .update(payload)
        .eq('id', user.id);

      if (error) throw error;

      // Keep organization_academic_years in sync for active school year if record exists (matching admin logic)
      if (user.role === 'org-president' && activeSy?.id) {
        const targetOrgId = user.organization_id || user.id;
        try {
          await supabase
            .from('organization_academic_years')
            .update({
              president_name: fullName.trim(),
              contact_no: contactNumber?.trim() || null,
              updated_at: new Date().toISOString()
            })
            .eq('school_year_id', activeSy.id)
            .or(`organization_id.eq.${targetOrgId},organization_id.eq.${user.id}`);
          await loadHistoricalAcademicYears();
        } catch (_) {}
      }

      await createAuditLog(`Updated profile details: ${fullName.trim()}`);
      await fetchUserDetail(user.id, selectedSyId);
      await refreshUser();
      showToast('Profile details updated successfully!');
      return true;
    } catch (err) {
      console.error('Profile update error:', err);
      showToast(err.message || 'Failed to update profile', 'error');
      return false;
    } finally {
      setIsSavingProfile(false);
    }
  };

  // 5. Change Password
  const handleChangePassword = async ({ currentPassword, newPassword, confirmPassword }) => {
    if (!isPresident) {
      return { success: false, error: 'Only the Organization President can change the account password.' };
    }
    if (newPassword.length < 6) {
      return { success: false, error: 'New password must be at least 6 characters' };
    }
    if (newPassword !== confirmPassword) {
      return { success: false, error: 'New passwords do not match' };
    }
    if (!currentPassword) {
      return { success: false, error: 'Current password is required' };
    }

    setIsSavingPassword(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword
      });

      if (signInError) {
        return { success: false, error: 'Incorrect current password' };
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) throw updateError;

      await createAuditLog('Changed account password');
      showToast('Password changed successfully!');
      return { success: true };
    } catch (err) {
      console.error('Password change error:', err);
      return { success: false, error: err.message || 'Failed to change password' };
    } finally {
      setIsSavingPassword(false);
    }
  };

  // 6. Member Modal Save
  const handleSaveMember = async (e) => {
    e.preventDefault();
    if (!isPresident) {
      showToast('Only the Organization President can add or edit executive members.', 'error');
      return;
    }
    if (!isViewingActiveSy) {
      showToast('Executive members can only be added or edited for the active school year.', 'error');
      return;
    }
    const resolvedPosition = (positionSelection === 'Other' ? customPosition : positionSelection).trim();
    if (!memberForm.full_name.trim() || !resolvedPosition) {
      showToast('Please provide both full name and position / role.', 'error');
      return;
    }

    setIsSavingMember(true);
    try {
      const targetSy = selectedSyId || activeSy?.id || null;
      if (editingMember) {
        const updatePayload = {
          full_name: memberForm.full_name.trim(),
          position: resolvedPosition,
          student_number: memberForm.student_number.trim() || null,
          contact_number: memberForm.contact_number.trim() || null,
          updated_at: new Date().toISOString()
        };
        if (targetSy) {
          updatePayload.school_year_id = editingMember.school_year_id || targetSy;
        }

        let { error } = await supabase
          .from('organization_members')
          .update(updatePayload)
          .eq('id', editingMember.id);

        if (error && error.message?.includes('school_year_id')) {
          delete updatePayload.school_year_id;
          const retry = await supabase.from('organization_members').update(updatePayload).eq('id', editingMember.id);
          error = retry.error;
        }

        if (error) throw error;
        showToast('Executive member updated successfully!');
      } else {
        const insertPayload = {
          organization_id: user.organization_id || null,
          user_id: user.id,
          full_name: memberForm.full_name.trim(),
          position: resolvedPosition,
          student_number: memberForm.student_number.trim() || null,
          contact_number: memberForm.contact_number.trim() || null,
          school_year_id: targetSy,
        };

        let { error } = await supabase
          .from('organization_members')
          .insert([insertPayload]);

        if (error && error.message?.includes('school_year_id')) {
          delete insertPayload.school_year_id;
          const retry = await supabase.from('organization_members').insert([insertPayload]);
          error = retry.error;
        }

        if (error) throw error;
        showToast('Executive member added successfully!');
      }

      setIsMemberModalOpen(false);
      setEditingMember(null);
      setPositionSelection('Vice President');
      setCustomPosition('');
      setMemberForm({ full_name: '', position: 'Vice President', student_number: '', contact_number: '' });
      await loadMembers(selectedSyId);
      await loadAllHistoricalMembers();
    } catch (err) {
      console.error('Error saving member:', err);
      showToast(err.message || 'Failed to save executive member', 'error');
    } finally {
      setIsSavingMember(false);
    }
  };

  // 7. Delete Member
  const handleDeleteMember = async (id) => {
    if (!isPresident) {
      showToast('Only the Organization President can remove executive members.', 'error');
      return;
    }
    if (!isViewingActiveSy) {
      showToast('Executive members can only be removed from the active school year.', 'error');
      return;
    }
    if (!window.confirm('Are you sure you want to remove this executive member?')) return;
    try {
      const { error } = await supabase
        .from('organization_members')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showToast('Executive member removed.');
      await loadMembers(selectedSyId);
      await loadAllHistoricalMembers();
    } catch (err) {
      console.error('Error deleting member:', err);
      showToast('Failed to remove executive member', 'error');
    }
  };

  // Advisers parsing helper (identical to parseCoAdvisersList in UserManagement.jsx)
  const parseCoAdvisers = (raw) => {
    if (Array.isArray(raw)) return raw.filter(Boolean);
    if (typeof raw === 'string' && raw.trim()) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.filter(Boolean);
        return [raw.trim()];
      } catch {
        return raw.split(',').map((s) => s.trim()).filter(Boolean);
      }
    }
    return [];
  };

  const getAdvisersForTerm = (adviserName, rawCoAdvisers) => {
    const list = [];
    if (adviserName && adviserName.trim()) {
      list.push({ name: adviserName.trim(), role: 'Primary Adviser' });
    }
    const coList = parseCoAdvisers(rawCoAdvisers);
    coList.forEach((ca) => {
      list.push({ name: ca, role: 'Co-Adviser' });
    });
    return list;
  };

  const profile = user ? (detailData?.user || user) : null;
  const selectedSyObj = allSchoolYears.find((s) => s.id === selectedSyId) || activeSy;
  const isViewingActiveSy = selectedSyObj ? selectedSyObj.is_active : true;
  const shortYear = (selectedSyObj?.name || '2026 – 2027').replace(/^A\.?Y\.?\s*/i, '');

  // Compute terms history data - same logic as admin UserManagement fetching from organization_academic_years
  const termsHistory = useMemo(() => {
    const currentAdvisers = getAdvisersForTerm(user?.adviser_name, user?.co_advisers);

    if (allSchoolYears.length === 0) {
      return [{
        id: 'current-term',
        academicYear: activeSy?.name || 'A.Y. 2026 – 2027',
        shortYear: (activeSy?.name || '2026 – 2027').replace(/^A\.?Y\.?\s*/i, ''),
        status: 'current',
        president: {
          name: profile?.full_name || user?.full_name || 'Organization President',
          studentNumber: profile?.student_no || user?.student_no || '',
          contactNumber: profile?.contact_no || user?.contact_no || '',
        },
        advisers: currentAdvisers,
        memberCount: profile?.no_member ?? user?.no_member ?? 0,
        board: members.map((m) => ({
          id: m.id,
          name: m.full_name,
          position: m.position,
          email: m.student_number ? `SN: ${m.student_number}` : (m.contact_number || ''),
        })),
      }];
    }

    // Only include school years that have an actual record in organization_academic_years or is the active school year
    const recordedSchoolYears = allSchoolYears.filter((sy) => {
      const isCur = Boolean(sy.is_active || (activeSy && sy.id === activeSy.id));
      const hasSnap = academicYearSnapshots.some((s) => s.school_year_id === sy.id);
      return isCur || hasSnap;
    });

    return recordedSchoolYears.map((sy) => {
      const isCur = Boolean(sy.is_active || (activeSy && sy.id === activeSy.id));
      const snap = academicYearSnapshots.find((s) => s.school_year_id === sy.id);

      const syMembers = isCur
        ? members
        : allOrgMembers.filter((m) => m.school_year_id === sy.id);

      const presMember = syMembers.find(
        (m) => m.is_president || m.position?.toLowerCase().includes('president')
      );

      const presName = snap?.president_name || (isCur ? (user?.full_name || profile?.full_name) : null) || presMember?.full_name || 'President';
      const presStudentNo = snap?.student_no ?? (isCur ? (user?.student_no || profile?.student_no) : null) ?? presMember?.student_number ?? '';
      const presContactNo = snap?.contact_no ?? (isCur ? (user?.contact_no || profile?.contact_no) : null) ?? presMember?.contact_number ?? '';
      const adviserName = snap ? snap.adviser_name : (isCur ? (user?.adviser_name || profile?.adviser_name) : null);
      const coAdvs = snap ? snap.co_advisers : (isCur ? (user?.co_advisers || profile?.co_advisers) : null);
      const memberCount = snap ? (snap.no_member ?? 0) : (isCur ? (user?.no_member || profile?.no_member || 0) : 0);

      const termAdvisers = getAdvisersForTerm(adviserName, coAdvs);

      return {
        id: sy.id,
        academicYear: sy.name,
        shortYear: sy.name.replace(/^A\.?Y\.?\s*/i, ''),
        status: isCur ? 'current' : 'archived',
        president: {
          name: presName,
          studentNumber: presStudentNo,
          contactNumber: presContactNo,
        },
        advisers: termAdvisers,
        memberCount: memberCount,
        board: syMembers.map((m) => ({
          id: m.id,
          name: m.full_name,
          position: m.position,
          email: m.student_number ? `SN: ${m.student_number}` : (m.contact_number || ''),
        })),
        note: sy.theme ? `Theme: ${sy.theme}` : undefined,
      };
    });
  }, [allSchoolYears, activeSy, user, profile, members, allOrgMembers, academicYearSnapshots]);

  if (!user) return null;

  const effectiveFullName = profile?.full_name || user.full_name || user.username || '';
  const effectiveStudentNo = profile?.student_no ?? user.student_no ?? 'N/A';
  const effectiveContactNo = profile?.contact_no ?? user.contact_no ?? '';
  const effectiveMemberCount = profile?.no_member ?? user.no_member ?? 0;
  const effectiveAdviserName = profile?.adviser_name || user.adviser_name;
  const effectiveCoAdvisers = profile?.co_advisers || user.co_advisers;

  const organizationData = {
    name: profile?.org_name || user.org_name || profile?.full_name || user.full_name || 'Organization Name',
    abbreviation: profile?.abbreviation || user.abbreviation || '',
    college: profile?.college || user.college || 'College of Information and Communications Technology',
    officialEmail: profile?.email || user.email || '',
    crestUrl: profile?.profile_image || user.profile_image || user.avatarUrl,
  };

  const isPresident = !activeMember || activeMember.is_president === true;

  // Resolve the active operator's member record if an officer is operating
  const activeOperatorRecord = useMemo(() => {
    if (isPresident) return null;
    const found =
      members.find((m) => m.id === activeMember?.id) ||
      allOrgMembers.find((m) => m.id === activeMember?.id) ||
      members.find((m) => m.full_name && activeMember?.full_name && m.full_name.trim().toLowerCase() === activeMember.full_name.trim().toLowerCase()) ||
      allOrgMembers.find((m) => m.full_name && activeMember?.full_name && m.full_name.trim().toLowerCase() === activeMember.full_name.trim().toLowerCase());
    return found ? { ...activeMember, ...found } : activeMember;
  }, [isPresident, activeMember, members, allOrgMembers]);

  const presidentAccountData = {
    fullName: effectiveFullName,
    email: profile?.email || user.email || '',
    studentNumber: effectiveStudentNo,
    contactNumber: effectiveContactNo,
    profileImage: profile?.profile_image || user.profile_image || user.avatarUrl,
    position: (profile?.role || user.role) === 'org-president' ? 'Organization President' : ((profile?.role || user.role) || 'Officer'),
    activeSince: new Date(profile?.joined_date || user.joined_date || profile?.created_at || user.created_at || Date.now()).toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }),
    isActive: profile?.status !== 'Inactive' && !profile?.status?.startsWith('Suspended'),
    isOperator: false,
    isPresident: true,
  };

  const operatorAccountData = (!isPresident && activeOperatorRecord) ? {
    fullName: activeOperatorRecord.full_name || activeMember?.full_name || 'Active Officer',
    email: activeOperatorRecord.email || profile?.email || user.email || '',
    studentNumber: activeOperatorRecord.student_number || activeOperatorRecord.student_no || activeMember?.student_number || 'N/A',
    contactNumber: activeOperatorRecord.contact_number || activeOperatorRecord.contact_no || activeMember?.contact_number || 'N/A',
    profileImage: activeOperatorRecord.avatar_url || activeOperatorRecord.profile_image || profile?.profile_image || user.profile_image || user.avatarUrl,
    position: activeOperatorRecord.position || activeMember?.position || 'Officer',
    activeSince: activeOperatorRecord.created_at
      ? new Date(activeOperatorRecord.created_at).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      : new Date(profile?.joined_date || user.joined_date || profile?.created_at || user.created_at || Date.now()).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
    isActive: true,
    isOperator: true,
    isPresident: false,
  } : presidentAccountData;

  const identityAccountData = isPresident ? presidentAccountData : operatorAccountData;

  const nonOrgAccountData = useMemo(() => {
    const roleTitleMap = {
      'admin': 'Administrator',
      'chairman': 'Department Chairman',
      'vice-chairman': 'Department Vice-Chairman',
      'dean': 'College Dean',
    };
    const roleKey = (profile?.role || user.role || '').toLowerCase();
    const roleName = roleTitleMap[roleKey] || (roleKey ? roleKey.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Staff');

    const badgeMap = {
      'admin': 'Active Admin',
      'chairman': 'Active Chairman',
      'vice-chairman': 'Active Vice-Chairman',
      'dean': 'Active Dean',
    };
    const badgeText = badgeMap[roleKey] || 'Active';

    return {
      fullName: effectiveFullName,
      email: profile?.email || user.email || '',
      studentNumber: '',
      contactNumber: effectiveContactNo || 'N/A',
      profileImage: profile?.profile_image || user.profile_image || user.avatarUrl,
      position: roleName,
      badgeText: badgeText,
      activeSince: new Date(profile?.joined_date || user.joined_date || profile?.created_at || user.created_at || Date.now()).toLocaleDateString(undefined, { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      isActive: profile?.status !== 'Inactive' && !profile?.status?.startsWith('Suspended') && user.status !== 'Inactive' && !user.status?.startsWith('Suspended'),
      isPresident: true,
    };
  }, [user, profile, effectiveFullName, effectiveContactNo]);

  const currentTermData = {
    id: selectedSyObj?.id || 'current-term',
    academicYear: selectedSyObj?.name || 'A.Y. 2026 – 2027',
    shortYear: shortYear,
    status: isViewingActiveSy ? 'current' : 'archived',
    memberCount: effectiveMemberCount,
    advisers: getAdvisersForTerm(effectiveAdviserName, effectiveCoAdvisers),
  };

  // Render for Non-Organization Accounts (Admin, Dean, Chairperson, etc.)
  if (user.role !== 'org-president') {
    return (
      <div className="animate-in fade-in duration-300 pb-16">
        {toast && (
          <div className={`fixed top-10 right-10 z-[200] flex items-center gap-4 px-6 py-4 rounded-xl shadow-xl animate-in slide-in-from-right-full ${
            toast.type === 'error' ? 'bg-danger-500 text-white' : 'bg-forest-700 text-white'
          }`}>
            {toast.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
            <span className="font-bold text-sm">{toast.message}</span>
          </div>
        )}

        <div className="mb-8">
          <PageHeader 
            title="My Profile" 
            subtitle="Manage your personal information and account security" 
            icon={UserIcon} 
            iconColor="emerald" 
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Left Column: Sticky Identity Panel */}
          <div className="space-y-6 lg:col-span-1 lg:sticky lg:top-6">
            <IdentityPanel
              account={nonOrgAccountData}
              organization={{}}
              onImageUpload={handleProfileImageUpload}
              isUploadingImage={isUploadingImage}
              canEditImage={true}
              showStudentNumber={false}
              isOrg={false}
            />
          </div>

          <div className="space-y-6 lg:col-span-2">
            <AccountSettings
              account={nonOrgAccountData}
              isOrg={false}
              isPresident={true}
              onSave={handleUpdateProfile}
              isSaving={isSavingProfile}
            />
            <SecurityPanel
              onChangePassword={handleChangePassword}
              isSaving={isSavingPassword}
              isPresident={true}
            />
          </div>
        </div>
      </div>
    );
  }

  // Render for Student Organizations (Matching Provided Design Specification & Admin User Management)
  return (
    <div className="min-h-full w-full font-sans pb-16 animate-in fade-in duration-300">
      {toast && (
        <div className={`fixed top-10 right-10 z-[350] flex items-center gap-4 px-6 py-4 rounded-xl shadow-xl animate-in slide-in-from-right-full ${
          toast.type === 'error' ? 'bg-danger-500 text-white' : 'bg-forest-700 text-white'
        }`}>
          {toast.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
          <span className="font-bold text-sm">{toast.message}</span>
        </div>
      )}

      {/* Profile Page Header - matching design of other pages */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 sm:mb-8 border-b border-gray-100 pb-4 sm:pb-6 gap-4">
        <PageHeader 
          title="My Profile" 
          subtitle="Manage your personal information, organization details, and account security" 
          icon={UserIcon} 
          iconColor="emerald" 
        />

        {(organizationData.abbreviation || shortYear) && (
          <div className="flex items-center gap-2 rounded-full border border-forest-100 bg-forest-50 px-3.5 py-1.5 text-xs font-semibold text-forest-700 shadow-2xs">
            <ShieldCheck className="h-4 w-4 text-forest-600" aria-hidden="true" />
            <span>
              {organizationData.abbreviation}
              {organizationData.abbreviation && shortYear ? ' · ' : ''}
              {shortYear}
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Column: Sticky Identity Panel */}
        <div className="space-y-6 lg:col-span-1 lg:sticky lg:top-6">
          <IdentityPanel
            account={identityAccountData}
            organization={organizationData}
            onImageUpload={handleProfileImageUpload}
            isUploadingImage={isUploadingImage}
            canEditImage={isPresident}
          />
        </div>

        {/* Right Column: Record, Roster, History, Settings & Security */}
        <div className="space-y-6 lg:col-span-2">
          {/* 1. Official Organization Record (Read-only) */}
          <OrganizationRecord
            organization={organizationData}
            term={currentTermData}
          />

          {/* 2. Executive Board Roster for Current Term */}
          <BoardRoster
            academicYear={selectedSyObj?.name || 'A.Y. 2026 – 2027'}
            members={members}
            editable={isViewingActiveSy}
            isPresident={isPresident}
            onAddOfficer={() => {
              if (!isPresident) {
                showToast('Only the Organization President can add executive members.', 'error');
                return;
              }
              setEditingMember(null);
              setPositionSelection('Vice President');
              setCustomPosition('');
              setMemberForm({ full_name: '', position: 'Vice President', student_number: '', contact_number: '' });
              setIsMemberModalOpen(true);
            }}
            onEditOfficer={(member) => {
              if (!isPresident) {
                showToast('Only the Organization President can edit executive members.', 'error');
                return;
              }
              setEditingMember(member);
              const pos = (member.position || '').trim();
              const standardRoles = ['Vice President', 'Member'];
              const matched = standardRoles.find(r => r.toLowerCase() === pos.toLowerCase());
              if (matched) {
                setPositionSelection(matched);
                setCustomPosition('');
              } else if (pos) {
                setPositionSelection('Other');
                setCustomPosition(pos);
              } else {
                setPositionSelection('Member');
                setCustomPosition('');
              }
              setMemberForm({
                full_name: member.full_name || member.name || '',
                position: pos || 'Member',
                student_number: member.student_number || '',
                contact_number: member.contact_number || ''
              });
              setIsMemberModalOpen(true);
            }}
            onDeleteOfficer={handleDeleteMember}
          />

          {/* 3. Term History Timeline Accordion */}
          <TermHistory terms={termsHistory} />

          {/* 4. Account Details Settings */}
          <AccountSettings
            account={presidentAccountData}
            abbreviation={organizationData.abbreviation}
            isOrg={true}
            isPresident={isPresident}
            onSave={handleUpdateProfile}
            isSaving={isSavingProfile}
          />

          {/* 5. Password & Security Panel */}
          <SecurityPanel
            isPresident={isPresident}
            onChangePassword={handleChangePassword}
            isSaving={isSavingPassword}
          />
        </div>
      </div>

      {/* Add / Edit Executive Board Member Modal */}
      {isMemberModalOpen && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-card p-6 border border-line relative animate-in zoom-in-95 duration-150">
            <button
              onClick={() => setIsMemberModalOpen(false)}
              className="absolute top-5 right-5 text-ink-faint hover:text-ink p-1 rounded-lg hover:bg-canvas transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X size={18} />
            </button>

            <h3 className="text-lg font-bold text-forest-800 mb-1">
              {editingMember ? 'Edit Executive Officer' : 'Add Executive Officer'}
            </h3>
            <p className="text-xs text-ink-muted mb-5">
              Register officers who operate this account for the current school year.
            </p>

            <form onSubmit={handleSaveMember} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-ink-faint uppercase tracking-wider mb-1 block">
                  Full Name <span className="text-danger-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={memberForm.full_name}
                  onChange={(e) => setMemberForm({ ...memberForm, full_name: e.target.value })}
                  placeholder="e.g. Maria Santos"
                  className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-forest-400 focus:ring-2 focus:ring-forest-100"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-ink-faint uppercase tracking-wider mb-1 block">
                  Role / Position <span className="text-danger-500">*</span>
                </label>
                <select
                  required
                  value={positionSelection}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPositionSelection(val);
                    if (val !== 'Other') {
                      setMemberForm((prev) => ({ ...prev, position: val }));
                    } else {
                      setMemberForm((prev) => ({ ...prev, position: customPosition }));
                    }
                  }}
                  className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-forest-400 focus:ring-2 focus:ring-forest-100 cursor-pointer"
                >
                  <option value="Vice President">Vice President</option>
                  <option value="Member">Member</option>
                  <option value="Other">Other (Specify custom title...)</option>
                </select>

                {positionSelection === 'Other' && (
                  <div className="mt-2.5 animate-in fade-in duration-150">
                    <input
                      type="text"
                      required
                      value={customPosition}
                      onChange={(e) => {
                        setCustomPosition(e.target.value);
                        setMemberForm((prev) => ({ ...prev, position: e.target.value }));
                      }}
                      placeholder="e.g. Secretary, Treasurer, Auditor"
                      className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-forest-400 focus:ring-2 focus:ring-forest-100"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-ink-faint uppercase tracking-wider mb-1 block">Student No.</label>
                  <input
                    type="text"
                    value={memberForm.student_number}
                    onChange={(e) => setMemberForm({ ...memberForm, student_number: e.target.value })}
                    placeholder="e.g. 2023200438"
                    className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-forest-400 focus:ring-2 focus:ring-forest-100"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink-faint uppercase tracking-wider mb-1 block">Contact No.</label>
                  <input
                    type="text"
                    value={memberForm.contact_number}
                    onChange={(e) => setMemberForm({ ...memberForm, contact_number: e.target.value })}
                    placeholder="e.g. 09123456789"
                    className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-forest-400 focus:ring-2 focus:ring-forest-100"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-line">
                <button
                  type="button"
                  onClick={() => setIsMemberModalOpen(false)}
                  className="px-4 py-2 bg-canvas text-ink-muted font-semibold rounded-lg text-xs hover:bg-gray-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingMember}
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-forest-600 text-white font-semibold rounded-lg text-xs hover:bg-forest-700 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  {isSavingMember && <Loader2 className="animate-spin h-3.5 w-3.5" />}
                  {editingMember ? 'Save Changes' : 'Add Officer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyProfile;

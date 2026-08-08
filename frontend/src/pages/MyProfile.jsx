import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { 
  User as UserIcon, 
  Mail, 
  Shield, 
  Clock, 
  Calendar, 
  Camera, 
  Save, 
  Lock, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Building2,
  Users,
  UserCheck,
  Award,
  Hash,
  Phone
} from 'lucide-react';
import PageHeader from '../components/PageHeader';

const MyProfile = () => {
  const { user, refreshUser } = useAuth();
  
  // Profile Info State
  const [fullName, setFullName] = useState('');
  const [abbreviation, setAbbreviation] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  
  // Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  
  // Image State
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef(null);
  
  // Toast State
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || user.username || '');
      setAbbreviation(user.abbreviation || '');
    }
  }, [user]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const createAuditLog = async (description) => {
    try {
      const { error } = await supabase.from('submission_logs').insert([{
        user_id: user.id,
        action_type: 'Profile Update',
        description: description,
      }]);
      if (error) {
        console.warn('Could not create audit log (may require submission_id):', error);
      }
    } catch (err) {
      console.warn('Audit log error:', err);
    }
  };

  const handleProfileImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      showToast('Please upload a valid image (JPG, PNG, WEBP)', 'error');
      return;
    }

    // Validate file size (5MB max)
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
          cacheControl: '3600',
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

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!fullName.trim()) {
      showToast('Full Name is required', 'error');
      return;
    }

    setIsSavingProfile(true);
    try {
      const payload = { full_name: fullName.trim() };
      if (user.role === 'org-president') {
        const trimmedAbbr = abbreviation.trim();
        if (trimmedAbbr.length > 15) {
          showToast('Organization Abbreviation cannot exceed 15 characters', 'error');
          setIsSavingProfile(false);
          return;
        }
        payload.abbreviation = trimmedAbbr;
      }

      const { error } = await supabase
        .from('users')
        .update(payload)
        .eq('id', user.id);

      if (error) throw error;

      await createAuditLog(`Updated profile full name to: ${fullName.trim()}`);
      await refreshUser();
      showToast('Profile updated successfully!');
    } catch (err) {
      console.error('Profile update error:', err);
      showToast(err.message || 'Failed to update profile', 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      showToast('New password must be at least 6 characters', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match', 'error');
      return;
    }
    if (!currentPassword) {
      showToast('Current password is required', 'error');
      return;
    }

    setIsSavingPassword(true);
    try {
      // Re-authenticate to verify current password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword
      });

      if (signInError) {
        throw new Error('Incorrect current password');
      }

      // Update to new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) throw updateError;

      await createAuditLog('Changed account password');
      showToast('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      console.error('Password change error:', err);
      showToast(err.message || 'Failed to change password', 'error');
    } finally {
      setIsSavingPassword(false);
    }
  };

  const getCoAdvisersList = () => {
    if (!user?.co_advisers) return [];
    if (Array.isArray(user.co_advisers)) return user.co_advisers.filter(Boolean);
    if (typeof user.co_advisers === 'string') {
      try {
        const parsed = JSON.parse(user.co_advisers);
        if (Array.isArray(parsed)) return parsed.filter(Boolean);
      } catch {
        return user.co_advisers.split(',').map(s => s.trim()).filter(Boolean);
      }
    }
    return [];
  };

  if (!user) return null;

  const coAdvisersList = getCoAdvisersList();

  return (
    <div className="animate-in fade-in duration-500 pb-16">
      {toast && (
        <div className={`fixed top-10 right-10 z-[200] flex items-center gap-4 px-6 py-4 rounded-xl shadow-xl animate-in slide-in-from-right-full ${
          toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-primary-green text-white'
        }`}>
          {toast.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
          <span className="font-bold text-sm">{toast.message}</span>
        </div>
      )}

      <div className="mb-10">
        <PageHeader 
          title="My Profile" 
          subtitle="Manage your personal information, organization details, and account security" 
          icon={UserIcon} 
          iconColor="slate" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Avatar & Account Summary */}
        <div className="space-y-8 lg:col-span-1">
          {/* Avatar Card */}
          <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm text-center relative overflow-hidden group">
            <div className="w-32 h-32 mx-auto rounded-full bg-primary-green border-4 border-white shadow-xl flex items-center justify-center text-white text-4xl font-black relative overflow-hidden mb-6">
              {user.avatarUrl ? (
                <img 
                  src={user.avatarUrl} 
                  alt="Profile" 
                  className="w-full h-full object-cover" 
                />
              ) : (
                user.full_name?.charAt(0).toUpperCase() || user.username?.charAt(0).toUpperCase() || '?'
              )}
              
              {/* Overlay for upload */}
              <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer backdrop-blur-sm">
                <input 
                  type="file" 
                  className="hidden" 
                  accept="image/png, image/jpeg, image/jpg, image/webp" 
                  onChange={handleProfileImageUpload}
                  ref={fileInputRef}
                  disabled={isUploadingImage}
                />
                {isUploadingImage ? (
                  <Loader2 className="animate-spin text-white" size={24} />
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Camera className="text-white" size={24} />
                    <span className="text-white text-[10px] font-bold uppercase tracking-wider">Update Photo</span>
                  </div>
                )}
              </label>
            </div>
            
            <h2 className="text-xl font-black text-gray-800">{user.full_name || user.username}</h2>
            <p className="text-primary-green font-bold text-xs uppercase tracking-wider mt-1 mb-4">
              {user.role === 'org-president' ? 'Organization President' : user.role}
            </p>
            
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-50 text-green-600 text-xs font-bold uppercase tracking-wider border border-green-100">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              {user.status || 'Active'}
            </div>
          </div>

          {/* Account Details Card (Read-Only) */}
          <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
            <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Shield size={16} /> Account Details
            </h3>
            
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Email Address</label>
                <div className="flex items-center gap-3 text-gray-700 font-medium bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <Mail size={16} className="text-gray-400 shrink-0" />
                  <span className="truncate text-sm">{user.email}</span>
                </div>
              </div>
              
              {user.role === 'org-president' ? (
                <>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Student Number</label>
                    <div className="flex items-center gap-3 text-gray-700 font-medium bg-gray-50 p-3 rounded-xl border border-gray-100 text-sm">
                      <Hash size={16} className="text-gray-400 shrink-0" />
                      <span className="truncate">{user.student_no || 'N/A'}</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Contact Number</label>
                    <div className="flex items-center gap-3 text-gray-700 font-medium bg-gray-50 p-3 rounded-xl border border-gray-100 text-sm">
                      <Phone size={16} className="text-gray-400 shrink-0" />
                      <span className="truncate">{user.contact_no || 'N/A'}</span>
                    </div>
                  </div>
                </>
              ) : (
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Contact Number</label>
                  <div className="flex items-center gap-3 text-gray-700 font-medium bg-gray-50 p-3 rounded-xl border border-gray-100 text-sm">
                    <Phone size={16} className="text-gray-400 shrink-0" />
                    <span className="truncate">{user.contact_no || 'N/A'}</span>
                  </div>
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Active Since</label>
                <div className="flex items-center gap-3 text-gray-700 font-medium bg-gray-50 p-3 rounded-xl border border-gray-100 text-sm">
                  <Calendar size={16} className="text-gray-400 shrink-0" />
                  <span>{new Date(user.joined_date || user.created_at || Date.now()).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Information & Settings */}
        <div className="space-y-8 lg:col-span-2">
          
          {/* Organization & Adviser Details Card (for Org President) */}
          {user.role === 'org-president' && (
            <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-primary-green"></div>
              
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
                <h3 className="text-xl font-black text-gray-800 flex items-center gap-3">
                  <Building2 className="text-primary-green" size={24} />
                  Organization & Adviser Details
                </h3>
                <span className="text-[11px] font-bold px-3 py-1 bg-primary-green/10 text-primary-green rounded-full uppercase tracking-wider">
                  Official Information
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Organization Name */}
                <div className="bg-gray-50/90 p-4 rounded-2xl border border-gray-100">
                  <label className="text-xs font-medium text-gray-500 mb-1 block flex items-center gap-1.5">
                    <Building2 size={13} className="text-primary-green" /> Organization Name
                  </label>
                  <p className="font-medium text-gray-800 text-sm">{user.org_name || 'N/A'}</p>
                </div>

                {/* Abbreviation & Member Count */}
                <div className="bg-gray-50/90 p-4 rounded-2xl border border-gray-100">
                  <label className="text-xs font-medium text-gray-500 mb-1 block flex items-center gap-1.5">
                    <Users size={13} className="text-primary-green" /> Active Members & Abbreviation
                  </label>
                  <p className="font-medium text-gray-800 text-sm flex items-center gap-2">
                    <span>{user.no_member ? `${user.no_member} Members` : 'N/A'}</span>
                    {user.abbreviation && (
                      <span className="text-xs font-medium px-2 py-0.5 bg-gray-200 text-gray-700 rounded-md">
                        {user.abbreviation}
                      </span>
                    )}
                  </p>
                </div>

                {/* Primary Adviser */}
                <div className="bg-gray-50/90 p-4.5 rounded-2xl border border-gray-100 md:col-span-2">
                  <label className="text-xs font-medium text-gray-500 mb-1.5 block flex items-center gap-1.5">
                    <UserCheck size={14} className="text-primary-green" /> Primary Adviser
                  </label>
                  <p className="font-medium text-gray-800 text-sm">
                    {user.adviser_name || 'None listed'}
                  </p>
                </div>

                {/* Co-Advisers */}
                <div className="bg-gray-50/90 p-4.5 rounded-2xl border border-gray-100 md:col-span-2">
                  <label className="text-xs font-medium text-gray-500 mb-2 block flex items-center gap-1.5">
                    <Users size={14} className="text-primary-green" /> Co-Advisers
                  </label>
                  {coAdvisersList.length > 0 ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {coAdvisersList.map((adviser, idx) => (
                        <span 
                          key={idx} 
                          className="px-3.5 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-700 shadow-sm flex items-center gap-2"
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-primary-green"></div>
                          {adviser}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 font-medium italic">No co-advisers registered</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Edit Profile Information */}
          <form onSubmit={handleUpdateProfile} className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-primary-green"></div>
            <h3 className="text-xl font-black text-gray-800 mb-6 flex items-center gap-3">
              Personal Information
            </h3>
            
            <div className="space-y-6">
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2 block">Full Name</label>
                <input 
                  type="text" 
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-primary-green focus:bg-white focus:ring-4 focus:ring-primary-green/10 font-medium text-gray-800 outline-none transition-all"
                  placeholder="Enter your full name"
                />
                <p className="text-[10px] text-gray-400 font-medium mt-2 flex items-center gap-1">
                  <AlertCircle size={12} /> This is how your name will appear on official documents and approval logs.
                </p>
              </div>
              
              {user.role === 'org-president' && (
                <div>
                  <label className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2 block">Organization Abbreviation</label>
                  <input 
                    type="text" 
                    value={abbreviation}
                    onChange={(e) => setAbbreviation(e.target.value)}
                    maxLength={15}
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-primary-green focus:bg-white focus:ring-4 focus:ring-primary-green/10 font-medium text-gray-800 outline-none transition-all"
                    placeholder="e.g. ASICS"
                  />
                  <p className="text-[10px] text-gray-400 font-medium mt-2 flex items-center gap-1">
                    <AlertCircle size={12} /> Used to generate your document tracking numbers.
                  </p>
                </div>
              )}
              
              <div className="flex justify-end pt-4 border-t border-gray-50">
                <button 
                  type="submit" 
                  disabled={isSavingProfile || (fullName === (user.full_name || user.username) && abbreviation === (user.abbreviation || ''))}
                  className="flex items-center gap-2 px-6 py-3 bg-primary-green text-white font-bold rounded-xl hover:bg-green-700 hover:shadow-lg hover:shadow-green-700/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {isSavingProfile ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  Save Changes
                </button>
              </div>
            </div>
          </form>

          {/* Change Password */}
          <form onSubmit={handleChangePassword} className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-secondary-gold"></div>
            <h3 className="text-xl font-black text-gray-800 mb-6 flex items-center gap-3">
              Change Password
            </h3>
            
            <div className="space-y-5 max-w-md">
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2 block">Current Password</label>
                <input 
                  type="password" 
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-secondary-gold focus:bg-white outline-none transition-all font-medium text-sm"
                  placeholder="Enter current password"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2 block">New Password</label>
                <input 
                  type="password" 
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-secondary-gold focus:bg-white outline-none transition-all font-medium text-sm"
                  placeholder="Enter new password (min. 6 characters)"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2 block">Confirm New Password</label>
                <input 
                  type="password" 
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-secondary-gold focus:bg-white outline-none transition-all font-medium text-sm"
                  placeholder="Confirm new password"
                />
              </div>
              
              <div className="flex justify-end pt-4 border-t border-gray-50">
                <button 
                  type="submit" 
                  disabled={isSavingPassword || !currentPassword || !newPassword || !confirmPassword}
                  className="flex items-center gap-2 px-6 py-3 bg-gray-800 text-white font-bold rounded-xl hover:bg-gray-900 hover:shadow-lg hover:shadow-gray-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {isSavingPassword ? <Loader2 className="animate-spin" size={18} /> : <Lock size={18} />}
                  Update Password
                </button>
              </div>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
};

export default MyProfile;

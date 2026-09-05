import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { Camera, Loader2, ArrowRight, CheckCircle, AlertCircle, Building2, Lock, Key } from 'lucide-react';
import Avatar from './Avatar';

export default function OnboardingOverlay() {
  const { user, refreshUser } = useAuth();
  const [step, setStep] = useState(1);
  const [isMorphing, setIsMorphing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form State
  const [orgName, setOrgName] = useState(user?.org_name || '');
  const [abbreviation, setAbbreviation] = useState('');
  const [isAbbrevManual, setIsAbbrevManual] = useState(false);
  
  // Image State
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(user?.profile_image ? `https://yqsqxoywdbdmsqejysxj.supabase.co/storage/v1/object/public/profile_img/${user.profile_image}` : null);
  const fileInputRef = useRef(null);
  
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isAbbrevManual && orgName) {
      const suggested = orgName
        .split(' ')
        .filter(word => word.trim().length > 0)
        .map(word => word[0].toUpperCase())
        .join('')
        .slice(0, 15);
      setAbbreviation(suggested);
    } else if (!isAbbrevManual && !orgName) {
      setAbbreviation('');
    }
  }, [orgName, isAbbrevManual]);

  const handleProfileImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be less than 2MB');
      return;
    }

    setIsUploadingImage(true);
    setError(null);

    try {
      // Instantly show local preview
      const objectUrl = URL.createObjectURL(file);
      setAvatarUrl(objectUrl);

      const filePath = `${user.id}/avatar.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('profile_img')
        .upload(filePath, file, {
          cacheControl: '86400',
          upsert: true
        });

      if (uploadError) throw uploadError;
      
    } catch (err) {
      console.error('Error uploading image:', err);
      setError('Failed to upload image. Please try again.');
      setAvatarUrl(null); // revert preview on failure
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    const trimmedAbbr = abbreviation.trim();
    if (!trimmedAbbr) {
      setError('Organization Abbreviation is required.');
      return;
    }
    if (trimmedAbbr.length > 15) {
      setError('Organization Abbreviation cannot exceed 15 characters.');
      return;
    }
    
    setIsSaving(true);
    try {
      // Pre-validate abbreviation uniqueness
      const { data: existingUserAbbr } = await supabase
        .from('users')
        .select('id, abbreviation')
        .ilike('abbreviation', trimmedAbbr)
        .neq('id', user.id)
        .maybeSingle();

      if (existingUserAbbr) {
        setError(`An organization with the abbreviation "${trimmedAbbr}" already exists. Duplicate abbreviations are not allowed.`);
        setIsSaving(false);
        return;
      }

      // Update Database Record
      const payload = {
        abbreviation: trimmedAbbr,
        org_name: orgName.trim(),
      };
      
      if (avatarUrl && !avatarUrl.includes(user?.profile_image)) {
        payload.profile_image = `${user.id}/avatar.jpg`;
      }

      const { error: dbError } = await supabase
        .from('users')
        .update(payload)
        .eq('id', user.id);
        
      if (dbError) throw dbError;

      setStep(3); // Success Screen
      
      // After a short delay, refresh the user to unmount the overlay naturally
      setTimeout(() => {
        refreshUser();
      }, 3000);
      
    } catch (err) {
      console.error('Setup error:', err);
      setError(err.message || 'Failed to save setup. Please try again.');
      setIsSaving(false);
    }
  };

  const handleContinue = () => {
    setStep(2);
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden font-inter bg-black">
      {/* Background Video (Always on) */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover pointer-events-none opacity-40"
      >
        <source src="/loginbgvid.mp4" type="video/mp4" />
      </video>

      {/* Optimized Morphing Logo Background */}
      <div 
        className={`fixed z-0 transition-all duration-1000 ease-[cubic-bezier(0.85,0,0.15,1)] flex justify-center items-center pointer-events-none will-change-transform ${
          step === 1 
            ? 'top-[35%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 scale-100' 
            : 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vh] h-[80vh] scale-150'
        }`}
      >
        {/* Sharp Logo */}
        <img 
          src="/logo.png" 
          alt="" 
          className={`absolute inset-0 w-full h-full object-contain drop-shadow-2xl transition-opacity duration-1000 ${step === 1 ? 'opacity-100 animate-ps-logo' : 'opacity-0'}`} 
        />
        {/* Pre-blurred Logo for GPU Optimization */}
        <img 
          src="/logo.png" 
          alt="" 
          className={`absolute inset-0 w-full h-full object-contain blur-2xl transition-opacity duration-1000 ${step === 1 ? 'opacity-0 animate-ps-logo' : 'opacity-40'}`} 
        />
      </div>

      {/* White Vignette for Step 3 */}
      <div className={`fixed inset-0 z-[5] transition-opacity duration-1000 ease-out pointer-events-none ${step === 3 ? 'opacity-100' : 'opacity-0'}`}
           style={{ background: 'radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,255,255,0.85) 60%, rgba(255,255,255,0.4) 100%)' }}>
      </div>

      {/* Sliding Track */}
      <div 
        className="relative z-10 w-[300vw] h-full flex transition-transform duration-1000 ease-[cubic-bezier(0.76,0,0.24,1)]"
        style={{ transform: `translateX(-${(step - 1) * 33.333333}%)` }}
      >
        
        {/* Step 1: Welcome */}
        <div className="w-[100vw] h-full relative flex flex-col items-center">
            
            {/* Welcome to */}
            <div className="absolute top-[18%] flex gap-2 w-full justify-center">
              {['Welcome', 'to'].map((word, i) => (
                <span 
                  key={i} 
                  className="text-lg md:text-xl font-semibold tracking-widest uppercase text-white/80 animate-ps-word opacity-0"
                  style={{ animationDelay: `${0.2 + i * 0.15}s` }}
                >
                  {word}
                </span>
              ))}
            </div>

            {/* OSOADOCS Title */}
            <span 
              className="absolute top-[52%] login-brand-title text-6xl md:text-7xl text-white uppercase drop-shadow-[0_0_20px_rgba(255,255,255,0.4)] animate-ps-word opacity-0 text-center w-full"
              style={{ animationDelay: '0.6s', transform: 'translateY(-50%)' }}
            >
              OSOADOCS
            </span>
            
            {/* Subtitle */}
            <p className="absolute top-[65%] text-lg md:text-xl text-white/90 font-medium animate-ps-fade-in opacity-0 drop-shadow-md max-w-lg text-center px-4" style={{ animationDelay: '0.9s' }}>
              Let's get your organization profile set up so you can start submitting documents.
            </p>
            
            {/* Button */}
            <div className="absolute top-[80%] animate-ps-fade-in opacity-0 flex justify-center w-full" style={{ animationDelay: '1.2s' }}>
              <button
                onClick={handleContinue}
                className="px-10 py-4 backdrop-blur-md border border-white/30 text-white rounded-full font-bold text-lg hover:bg-white hover:text-black hover:scale-[1.05] transition-all duration-300 flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(255,255,255,0.1)] hover:shadow-[0_0_40px_rgba(255,255,255,0.4)]"
              >
                <span className="flex items-center gap-3 whitespace-nowrap">
                  Continue to Setup
                  <ArrowRight size={20} />
                </span>
              </button>
            </div>
        </div>

        {/* Step 2: Setup Form */}
        <div className="w-[100vw] h-full flex items-center justify-center p-4">
          <div className={`w-full max-w-lg bg-white rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] overflow-hidden transition-all duration-1000 delay-300 ${step >= 2 ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
            <div className="bg-white p-6 pb-2 text-center relative overflow-hidden border-b border-gray-100">
              <h2 className="text-2xl font-black text-gray-900 relative z-10">Account Setup</h2>
              <p className="text-gray-500 text-sm font-medium mt-1 relative z-10">Please provide your organization details.</p>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              
              {error && (
                <div className="p-4 bg-red-50 text-red-600 rounded-xl flex items-start gap-3 border border-red-100 animate-shake">
                  <AlertCircle size={20} className="shrink-0 mt-0.5" />
                  <p className="text-sm font-medium">{error}</p>
                </div>
              )}

              {/* Avatar Upload */}
              <div className="flex flex-col items-center">
                <div className="relative group">
                  <div className="w-28 h-28 rounded-full bg-gray-100 border-4 border-white shadow-lg flex items-center justify-center text-gray-400 text-3xl font-black relative overflow-hidden">
                    <Avatar 
                      profileImage={avatarUrl || user?.profile_image} 
                      name={user?.full_name || user?.org_name || orgName || 'O'} 
                      className="w-full h-full object-cover" 
                      fallbackClassName="bg-gray-100 text-gray-400 text-3xl font-black"
                    />
                    <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center cursor-pointer backdrop-blur-[2px]">
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
                        <Camera className="text-white transform group-hover:scale-110 transition-transform duration-300" size={28} />
                      )}
                    </label>
                  </div>
                </div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-4">Profile Photo</p>
              </div>

              {/* Fields */}
              <div className="space-y-5">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block ml-1">Organization Name</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                      <Building2 size={18} />
                    </div>
                    <input 
                      type="text" 
                      disabled
                      readOnly
                      value={orgName || user?.org_name || user?.full_name || ''}
                      className="w-full pl-11 pr-4 py-3.5 bg-gray-100/80 border border-gray-200 rounded-xl font-semibold text-gray-500 cursor-not-allowed select-none outline-none shadow-sm"
                      placeholder="Organization Name"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block ml-1">Organization Abbreviation <span className="text-red-500">*</span></label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-gray-900 transition-colors">
                      <CheckCircle size={18} />
                    </div>
                    <input 
                      type="text" 
                      required
                      maxLength={15}
                      value={abbreviation}
                      onChange={(e) => {
                        setAbbreviation(e.target.value.toUpperCase());
                        setIsAbbrevManual(true);
                      }}
                      className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:border-gray-900 focus:bg-white focus:ring-4 focus:ring-gray-900/5 font-medium text-gray-800 outline-none transition-all shadow-sm"
                      placeholder="e.g. ASICS"
                    />
                  </div>
                  <p className="text-[10px] text-gray-400 font-medium mt-1.5 ml-2">Used to generate your document tracking numbers.</p>
                </div>
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className="w-full py-3.5 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSaving ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle size={20} />}
                  Complete Setup
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Step 3: Success */}
        <div className="w-[100vw] h-full flex items-center justify-center p-4 relative z-50">
          <div className={`bg-white/80 backdrop-blur-md border border-gray-200 rounded-3xl p-10 text-center shadow-2xl w-full max-w-lg transition-all duration-1000 delay-300 ${step === 3 ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
            <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_40px_rgba(34,197,94,0.4)]">
              <CheckCircle size={50} className="text-white" />
            </div>
            <h1 className="text-4xl font-black mb-3 tracking-tight text-gray-900">Congratulations!</h1>
            <p className="text-lg text-gray-600 font-medium">
              Your profile is fully set up. Redirecting you to your dashboard...
            </p>
            <div className="mt-8">
              <Loader2 className="animate-spin mx-auto text-primary-green" size={32} />
            </div>
          </div>
        </div>

      </div>

      <style jsx="true">{`
        .animate-fade-in-up {
          animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-fade-in {
          animation: fadeIn 0.4s ease-out forwards;
        }
        .animate-shake {
          animation: shake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
        }
        .animate-ps-word {
          animation: psWord 1.5s cubic-bezier(0.19, 1, 0.22, 1) forwards;
        }
        .animate-ps-fade-in {
          animation: psFade 1.5s ease-out forwards;
        }
        .animate-ps-logo {
          animation: psLogo 2s cubic-bezier(0.19, 1, 0.22, 1) forwards;
        }
        .animate-smooth-entrance {
          animation: smoothEntrance 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        
        @keyframes smoothEntrance {
          0% { opacity: 0; filter: blur(10px); transform: translateY(40px) scale(0.95); }
          100% { opacity: 1; filter: blur(0px); transform: translateY(0) scale(1); }
        }
        @keyframes psWord {
          0% { opacity: 0; filter: blur(20px); transform: scale(1.5) translateZ(0); }
          50% { opacity: 1; filter: blur(0px); transform: scale(1.05) translateZ(0); }
          100% { opacity: 1; filter: blur(0px); transform: scale(1) translateZ(0); }
        }
        @keyframes psFade {
          from { opacity: 0; filter: blur(10px); transform: translateY(10px); }
          to { opacity: 1; filter: blur(0px); transform: translateY(0); }
        }
        @keyframes psLogo {
          0% { opacity: 0; filter: blur(20px); transform: scale(0.5); }
          100% { opacity: 1; filter: blur(0px); transform: scale(1); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes shake {
          10%, 90% { transform: translate3d(-1px, 0, 0); }
          20%, 80% { transform: translate3d(2px, 0, 0); }
          30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
          40%, 60% { transform: translate3d(4px, 0, 0); }
        }
      `}</style>
    </div>
  );
}

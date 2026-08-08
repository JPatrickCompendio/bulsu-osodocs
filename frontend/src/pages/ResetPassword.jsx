import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';

const ResetPassword = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    // Check for an active session or a recovery state in Supabase
    const checkRecoverySession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        // Check hash parameters in case of initial redirect
        const hash = window.location.hash;
        const isRecoveryHash = hash.includes('type=recovery') || hash.includes('access_token=');
        
        if (session || isRecoveryHash) {
          if (mounted) setHasRecoverySession(true);
        } else {
          if (mounted) setHasRecoverySession(false);
        }
      } catch (err) {
        console.error('Error checking recovery session:', err);
        if (mounted) setHasRecoverySession(false);
      } finally {
        if (mounted) setCheckingSession(false);
      }
    };

    checkRecoverySession();

    // Listen for auth state changes (e.g. PASSWORD_RECOVERY event)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        if (mounted) {
          setHasRecoverySession(true);
          setCheckingSession(false);
        }
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!newPassword) {
      setError('Please enter a new password.');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please verify your confirm password.');
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        if (
          updateError.message.toLowerCase().includes('jwt') ||
          updateError.message.toLowerCase().includes('session') ||
          updateError.message.toLowerCase().includes('expired') ||
          updateError.message.toLowerCase().includes('invalid')
        ) {
          setHasRecoverySession(false);
        } else {
          setError(updateError.message);
        }
      } else {
        // Sign out user after password reset to ensure clean authentication with new credentials
        await supabase.auth.signOut();
        setIsSuccess(true);
      }
    } catch (err) {
      console.error('Password reset update error:', err);
      setError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative h-screen w-full flex items-center justify-center p-4 sm:p-6 overflow-hidden">
      <style>{`
        @keyframes letter-shine {
          0%, 100% {
            color: rgba(255, 255, 255, 0.8);
            text-shadow: none;
          }
          50% {
            color: #ffffff;
            text-shadow: 0 0 10px rgba(255, 255, 255, 0.8), 0 0 18px rgba(255, 255, 255, 0.4);
          }
        }
        .animate-letter-shine {
          animation: letter-shine 4.5s ease-in-out infinite;
          will-change: color, text-shadow;
        }
      `}</style>
      
      {/* Full-screen background image */}
      <img
        src="/loginbg.png"
        alt=""
        className="absolute inset-0 h-full w-full object-fill"
        aria-hidden="true"
      />

      {/* Centered card */}
      <div className="relative z-10 w-full max-w-xl bg-white rounded-2xl shadow-[0_20px_60px_-12px_rgba(0,0,0,0.35)] overflow-hidden animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="px-7 sm:px-9 pt-8 pb-6 border-b border-gray-200/90 bg-white text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-primary-green tracking-[0.12em] uppercase">
            RESET PASSWORD
          </h1>
          <p className="text-gray-500 text-sm mt-2 max-w-sm mx-auto leading-relaxed">
            Create a new secure password for your account
          </p>
          <div className="mt-5 mx-auto h-0.5 w-12 rounded-full bg-primary-green/30" />
        </div>

        {/* Content */}
        <div className="px-7 sm:px-9 py-8 bg-gradient-to-b from-white to-gray-50/80">
          
          {checkingSession ? (
            <div className="flex flex-col items-center justify-center py-10 space-y-4 text-gray-500">
              <Loader2 className="w-10 h-10 animate-spin text-primary-green" />
              <p className="text-sm font-medium">Verifying password reset link...</p>
            </div>
          ) : isSuccess ? (
            <div className="text-center py-4 space-y-5">
              <div className="w-14 h-14 rounded-full bg-green-100 text-primary-green flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 size={32} />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-gray-800">Password Updated!</h2>
                <p className="text-sm text-gray-600 leading-relaxed max-w-md mx-auto">
                  Your password has been successfully updated. You can now sign in using your new password.
                </p>
              </div>
              <div className="pt-3">
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="w-full py-3.5 px-4 bg-[#063c2d] hover:bg-[#0a3a16] text-white font-bold rounded-xl shadow-md shadow-primary-green/20 hover:shadow-lg transition-all duration-200 uppercase tracking-wider text-sm flex items-center justify-center gap-2"
                >
                  <ArrowLeft size={18} />
                  Back to Login
                </button>
              </div>
            </div>
          ) : !hasRecoverySession ? (
            <div className="text-center py-4 space-y-5">
              <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto shadow-sm">
                <AlertCircle size={32} />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-gray-800">Link Invalid or Expired</h2>
                <p className="text-sm text-gray-600 leading-relaxed max-w-md mx-auto">
                  Your password reset link is invalid or has expired. Please request a new password reset link.
                </p>
              </div>
              <div className="pt-3">
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="w-full py-3.5 px-4 bg-[#063c2d] hover:bg-[#0a3a16] text-white font-bold rounded-xl shadow-md shadow-primary-green/20 hover:shadow-lg transition-all duration-200 uppercase tracking-wider text-sm flex items-center justify-center gap-2"
                >
                  <ArrowLeft size={18} />
                  Back to Login
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5 max-w-md mx-auto">
              {error && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2.5 animate-in fade-in duration-200">
                  <AlertCircle size={18} className="shrink-0 text-red-500" />
                  <span>{error}</span>
                </div>
              )}

              {/* New Password Input */}
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1.5">
                  New Password
                </label>
                <div className="relative group">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400 group-focus-within:text-primary-green transition-colors">
                    <Lock size={18} />
                  </span>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      setError('');
                    }}
                    className="block w-full pl-10 pr-11 py-3 bg-white border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-primary-green/25 focus:border-primary-green transition-all outline-none text-gray-800 placeholder:text-gray-400"
                    placeholder="Enter new password (min. 6 characters)"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password Input */}
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative group">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400 group-focus-within:text-primary-green transition-colors">
                    <Lock size={18} />
                  </span>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setError('');
                    }}
                    className="block w-full pl-10 pr-11 py-3 bg-white border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-primary-green/25 focus:border-primary-green transition-all outline-none text-gray-800 placeholder:text-gray-400"
                    placeholder="Re-enter new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-4 bg-[#063c2d] hover:bg-[#0a3a16] text-white font-bold rounded-xl shadow-md shadow-primary-green/20 hover:shadow-lg transition-all duration-200 uppercase tracking-wider text-sm disabled:opacity-70 flex items-center justify-center gap-2 active:scale-[0.99]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    'Update Password'
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer info */}
        <div className="px-7 sm:px-9 py-4 border-t border-gray-200/90 bg-white/90">
          <p className="text-[11px] text-gray-400 text-center leading-relaxed">
            BSU Bustos Campus - Internal System | Authorized Users Only
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;

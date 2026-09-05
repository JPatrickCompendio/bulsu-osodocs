import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Shield,
  Lock,
  Mail,
  CheckCircle,
  AlertTriangle,
  Loader2,
  ArrowRight,
  Eye,
  EyeOff,
  RefreshCw,
  Sparkles,
  Check
} from 'lucide-react';
import { apiFetch } from '../config/api';
import { supabase } from '../supabaseClient';
import { useToast } from '../hooks/useToast';

const SetupAccount = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { showToast, ToastComponent } = useToast();

  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [invalidReason, setInvalidReason] = useState('');
  const [invData, setInvData] = useState(null);

  // Password Setup Form State
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Resend Request Form State
  const [resendEmail, setResendEmail] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setVerifying(false);
        setTokenValid(false);
        setInvalidReason('No invitation token was provided in the URL.');
        return;
      }

      setVerifying(true);
      try {
        const res = await apiFetch(`/api/invitations/verify?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (data.valid) {
          setTokenValid(true);
          setInvData(data);
          setResendEmail(data.email || '');
        } else {
          setTokenValid(false);
          setInvalidReason(data.reason || 'This invitation link is invalid or has expired.');
        }
      } catch (err) {
        console.error('Error verifying invitation token:', err);
        setTokenValid(false);
        setInvalidReason('Unable to verify invitation link. Please check your network connection.');
      } finally {
        setVerifying(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleSetupPassword = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      showToast('Passwords do not match. Please re-enter.', 'error');
      return;
    }

    if (password.length < 6) {
      showToast('Password must be at least 6 characters long.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiFetch('/api/invitations/setup-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        showToast('Password created successfully! Signing you in...', 'success');

        // Automatically sign in via Supabase Auth
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: invData?.email || data.email,
          password: password,
        });

        if (signInErr) {
          console.warn('Auto sign-in error:', signInErr.message);
          showToast('Account set up! Please sign in with your new credentials.', 'info');
          setTimeout(() => navigate('/login'), 2000);
        } else {
          showToast('Welcome to BulSU OSODOCS!', 'success');
          setTimeout(() => navigate('/'), 1000);
        }
      } else {
        showToast('Error: ' + (data.error || 'Failed to set password'), 'error');
      }
    } catch (err) {
      console.error('Error setting password:', err);
      showToast('An unexpected error occurred. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestNewInvitation = async (e) => {
    e.preventDefault();
    if (!resendEmail.trim()) {
      showToast('Please enter your registered email address.', 'error');
      return;
    }

    setIsResending(true);
    try {
      const appOrigin = window.location.origin;
      const res = await apiFetch('/api/invitations/request-new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resendEmail.trim(), appOrigin }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setResendSuccess(true);
        showToast('Request processed! Check your email inbox for the new invitation link.', 'success');
      } else {
        showToast('Error: ' + (data.error || 'Failed to request new invitation.'), 'error');
      }
    } catch (err) {
      console.error('Error requesting new invitation:', err);
      showToast('Failed to send request. Please try again later.', 'error');
    } finally {
      setIsResending(false);
    }
  };

  const passwordRequirements = [
    { label: 'At least 6 characters', valid: password.length >= 6 },
    { label: 'Passwords match', valid: password.length > 0 && password === confirmPassword },
  ];

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {ToastComponent}
      {/* Background Decorative Gradients */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-600/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-teal-500/20 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden relative z-10 animate-in zoom-in-95 duration-300 border border-gray-100">
        {/* Header */}
        <div className="bg-[#073c2d] p-8 text-white text-center relative">
          <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/20 shadow-inner">
            <Shield className="text-emerald-400" size={32} />
          </div>
          <h1 className="text-2xl font-black tracking-tight">BulSU OSODOCS</h1>
          <p className="text-xs font-medium text-emerald-100/80 mt-1">Office of Student Organizations Portal</p>
        </div>

        <div className="p-8">
          {verifying ? (
            <div className="py-12 text-center text-gray-500">
              <Loader2 className="animate-spin text-primary-green mx-auto mb-4" size={42} />
              <p className="text-sm font-semibold text-gray-700">Verifying invitation link...</p>
              <p className="text-xs text-gray-400 mt-1">Please hold on for a moment.</p>
            </div>
          ) : tokenValid ? (
            <div>
              <div className="mb-6">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-primary-green border border-emerald-200 mb-3">
                  <Sparkles size={14} /> Account Setup Invitation
                </span>
                <h2 className="text-xl font-bold text-gray-900">Set Your Password</h2>
                <p className="text-xs text-gray-500 mt-1">
                  Creating credentials for <span className="font-semibold text-gray-800">{invData?.orgName}</span> (<span className="text-gray-600 font-mono">{invData?.email}</span>)
                </p>
              </div>

              <form onSubmit={handleSetupPassword} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-green text-sm text-gray-800"
                      placeholder="Create a strong password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-green text-sm text-gray-800"
                      placeholder="Re-enter your new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Password Checklist */}
                <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100 text-xs space-y-1.5">
                  {passwordRequirements.map((req, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div
                        className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                          req.valid ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-400'
                        }`}
                      >
                        <Check size={10} />
                      </div>
                      <span className={req.valid ? 'text-emerald-700 font-semibold' : 'text-gray-500'}>
                        {req.label}
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || password.length < 6 || password !== confirmPassword}
                  className="w-full py-3 bg-primary-green text-white rounded-xl font-bold text-sm shadow-md hover:bg-[#073c2d] hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      Setting Password...
                    </>
                  ) : (
                    <>
                      Complete Setup & Access Dashboard
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </form>
            </div>
          ) : (
            /* Expired / Invalid State */
            <div>
              <div className="text-center mb-6">
                <div className="w-14 h-14 bg-amber-50 border border-amber-200 rounded-full flex items-center justify-center mx-auto mb-3 text-amber-600">
                  <AlertTriangle size={28} />
                </div>
                <h2 className="text-lg font-bold text-gray-900">Invitation Link Expired or Invalid</h2>
                <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{invalidReason}</p>
              </div>

              {resendSuccess ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center text-emerald-900 animate-in fade-in">
                  <CheckCircle className="text-emerald-600 mx-auto mb-2" size={32} />
                  <h3 className="font-bold text-sm">New Invitation Email Sent!</h3>
                  <p className="text-xs text-emerald-800 mt-1">
                    We've sent a fresh invitation link to <span className="font-bold">{resendEmail}</span> via Brevo.
                    Please check your inbox (and spam folder).
                  </p>
                  <button
                    type="button"
                    onClick={() => setResendSuccess(false)}
                    className="mt-4 text-xs font-bold text-primary-green hover:underline"
                  >
                    Didn't receive it? Try again
                  </button>
                </div>
              ) : (
                <form onSubmit={handleRequestNewInvitation} className="space-y-4 border-t border-gray-100 pt-5">
                  <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Request New Invitation
                  </h3>
                  <p className="text-xs text-gray-500">
                    Enter your Organization's registered email address below to receive a new secure 24-hour setup link.
                  </p>

                  <div>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input
                        type="email"
                        required
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-green text-sm text-gray-800"
                        placeholder="org@bulsu.edu.ph"
                        value={resendEmail}
                        onChange={(e) => setResendEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isResending || !resendEmail.trim()}
                    className="w-full py-2.5 bg-primary-green text-white rounded-xl font-bold text-xs shadow-md hover:bg-[#073c2d] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isResending ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />
                        Sending Request...
                      </>
                    ) : (
                      <>
                        <RefreshCw size={14} />
                        Send New Setup Link
                      </>
                    )}
                  </button>
                </form>
              )}

              <div className="mt-6 text-center border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="text-xs font-semibold text-gray-500 hover:text-primary-green transition-colors"
                >
                  Return to Login
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SetupAccount;

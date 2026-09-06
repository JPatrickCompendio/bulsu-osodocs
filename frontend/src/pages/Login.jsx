import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, Eye, EyeOff, User, Mail, X, Loader2, ShieldAlert, AlertTriangle, Clock, ShieldCheck, ArrowLeft } from 'lucide-react';
import { apiFetch } from '../config/api';
import { supabase } from '../supabaseClient';
import { useToast } from '../hooks/useToast';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes lockout

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState(false);
  const [emailValidationError, setEmailValidationError] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [loading, setLoading] = useState(false);

  // 2-Step OTP Verification State
  const [step, setStep] = useState('login'); // 'login' | 'otp'
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [trustDevice, setTrustDevice] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpResendTimer, setOtpResendTimer] = useState(0);
  const otpInputsRef = useRef([]);

  // Brute Force Rate Limiting State
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [lockRemainingSeconds, setLockRemainingSeconds] = useState(0);
  
  // Forgot Password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const { showToast, ToastComponent } = useToast();

  useEffect(() => {
    const checkLockoutState = () => {
      const lockUntil = Number(localStorage.getItem('osodocs_login_lock_until') || 0);
      const storedAttempts = Number(localStorage.getItem('osodocs_login_attempts') || 0);

      if (lockUntil && Date.now() < lockUntil) {
        const remaining = Math.ceil((lockUntil - Date.now()) / 1000);
        setIsLockedOut(true);
        setLockRemainingSeconds(remaining);
        setFailedAttempts(MAX_FAILED_ATTEMPTS);
      } else {
        if (lockUntil && Date.now() >= lockUntil) {
          localStorage.removeItem('osodocs_login_lock_until');
          localStorage.removeItem('osodocs_login_attempts');
          setIsLockedOut(false);
          setFailedAttempts(0);
          setLockRemainingSeconds(0);
        } else {
          setFailedAttempts(storedAttempts);
        }
      }
    };

    checkLockoutState();
  }, []);

  useEffect(() => {
    let timer;
    if (isLockedOut && lockRemainingSeconds > 0) {
      timer = setInterval(() => {
        setLockRemainingSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            localStorage.removeItem('osodocs_login_lock_until');
            localStorage.removeItem('osodocs_login_attempts');
            setIsLockedOut(false);
            setFailedAttempts(0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isLockedOut, lockRemainingSeconds]);

  useEffect(() => {
    let timer;
    if (step === 'otp' && otpResendTimer > 0) {
      timer = setInterval(() => {
        setOtpResendTimer((prev) => (prev <= 1 ? 0 : prev - 1));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [step, otpResendTimer]);

  const formatLockTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLockedOut) {
      showToast(`Account locked due to multiple failed login attempts. Please wait ${formatLockTime(lockRemainingSeconds)} before trying again.`, 'error');
      return;
    }

    setError('');
    setEmailError(false);
    setEmailValidationError('');
    setPasswordError(false);
    setLoading(true);

    const normalizedEmail = email.trim().toLowerCase();
    const result = await login(normalizedEmail, password);

    if (result.success) {
      // Check if current browser/device is already trusted
      const storedToken = localStorage.getItem('osodocs_trusted_device_token');
      let isTrustedDevice = false;

      if (storedToken) {
        try {
          const checkRes = await apiFetch('/api/auth/check-trusted-device', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: normalizedEmail, deviceToken: storedToken }),
          });
          const checkData = await checkRes.json();
          if (checkData?.isTrusted) {
            isTrustedDevice = true;
          }
        } catch (err) {
          console.warn('Trusted device check failed:', err);
        }
      }

      if (isTrustedDevice) {
        // Device is trusted for 30 days -> skip OTP!
        localStorage.removeItem('osodocs_login_attempts');
        localStorage.removeItem('osodocs_login_lock_until');
        setFailedAttempts(0);
        setIsLockedOut(false);
        setLoading(false);
        navigate('/');
      } else {
        // Device is NOT trusted -> send OTP via Brevo and show OTP screen
        try {
          const otpRes = await apiFetch('/api/auth/send-login-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: normalizedEmail }),
          });
          const otpData = await otpRes.json();
          if (otpData?.success) {
            showToast(`A 6-digit verification code has been sent to ${normalizedEmail}`, 'success');
          } else {
            showToast('Verification code generated. Please check your email inbox.', 'info');
          }
        } catch (err) {
          console.error('Error sending OTP:', err);
          showToast('Failed to send verification code email. Please check your connection.', 'error');
        }

        setStep('otp');
        setOtpDigits(['', '', '', '', '', '']);
        setTrustDevice(false);
        setOtpResendTimer(60);
        setLoading(false);
        setTimeout(() => {
          otpInputsRef.current[0]?.focus();
        }, 100);
      }
    } else {
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      localStorage.setItem('osodocs_login_attempts', String(newAttempts));

      if (newAttempts >= MAX_FAILED_ATTEMPTS) {
        const lockUntil = Date.now() + LOCKOUT_DURATION_MS;
        localStorage.setItem('osodocs_login_lock_until', String(lockUntil));
        setIsLockedOut(true);
        setLockRemainingSeconds(Math.ceil(LOCKOUT_DURATION_MS / 1000));
        showToast('Too many failed login attempts! Account temporarily locked for 15 minutes to protect against brute-force attacks.', 'error');
      } else {
        const remaining = MAX_FAILED_ATTEMPTS - newAttempts;
        showToast(`Invalid login credentials. ${remaining} attempt(s) remaining before temporary lockout.`, 'error');
      }

      // Check if email exists to determine which input field is wrong
      try {
        const response = await apiFetch(`/api/users/check-email?email=${encodeURIComponent(normalizedEmail)}`);
        const data = await response.json();
        if (data && data.exists === false) {
          setEmailError(true);
        } else {
          setPasswordError(true);
        }
      } catch (err) {
        setEmailError(true);
        setPasswordError(true);
      }
      setLoading(false);
    }
  };

  const handleDigitChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newDigits = [...otpDigits];
    newDigits[index] = value.slice(-1);
    setOtpDigits(newDigits);

    if (value && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();
    if (/^\d{6}$/.test(pastedData)) {
      const newDigits = pastedData.split('');
      setOtpDigits(newDigits);
      otpInputsRef.current[5]?.focus();
    }
  };

  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();
    const code = otpDigits.join('').trim();
    if (code.length < 6) {
      showToast('Please enter the complete 6-digit verification code.', 'error');
      return;
    }

    setOtpLoading(true);
    const normalizedEmail = email.trim().toLowerCase();

    try {
      const res = await apiFetch('/api/auth/verify-login-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: normalizedEmail,
          otpCode: code,
          trustDevice,
          userAgent: navigator.userAgent,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || 'Invalid verification code. Please try again.', 'error');
        setOtpLoading(false);
        return;
      }

      if (data.trustedDeviceToken) {
        localStorage.setItem('osodocs_trusted_device_token', data.trustedDeviceToken);
      } else {
        localStorage.removeItem('osodocs_trusted_device_token');
      }

      localStorage.removeItem('osodocs_login_attempts');
      localStorage.removeItem('osodocs_login_lock_until');
      setFailedAttempts(0);
      setIsLockedOut(false);
      setOtpLoading(false);
      showToast('Security verification successful!', 'success');
      navigate('/');
    } catch (err) {
      console.error('OTP verification error:', err);
      showToast('Verification failed. Please try again.', 'error');
      setOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (otpResendTimer > 0) return;
    setOtpLoading(true);
    const normalizedEmail = email.trim().toLowerCase();
    try {
      await apiFetch('/api/auth/send-login-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      showToast(`A new 6-digit verification code was sent to ${normalizedEmail}`, 'success');
      setOtpResendTimer(60);
      setOtpDigits(['', '', '', '', '', '']);
      setTimeout(() => {
        otpInputsRef.current[0]?.focus();
      }, 100);
    } catch (err) {
      console.error('Error resending OTP:', err);
      showToast('Failed to resend verification code.', 'error');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleBackToLogin = async () => {
    setStep('login');
    setOtpDigits(['', '', '', '', '', '']);
    try {
      await supabase.auth.signOut();
    } catch (_) {}
  };

  const handleForgotClick = () => {
    setError('');
    setEmailError(false);
    setEmailValidationError('');

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setEmailValidationError('Please enter your email address first.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setEmailValidationError('Please enter a valid email address.');
      return;
    }

    setForgotEmail(trimmedEmail);
    setShowForgotModal(true);
  };

  const handleSendResetLink = async () => {
    setResetLoading(true);
    let isSuccess = false;
    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      
      if (resetErr) {
        console.warn('Supabase resetPasswordForEmail warning/error:', resetErr.message);
        if (resetErr.message.toLowerCase().includes('network') || resetErr.message.toLowerCase().includes('fetch')) {
          isSuccess = false;
        } else {
          isSuccess = true;
        }
      } else {
        isSuccess = true;
      }
    } catch (err) {
      console.error('Error sending reset link:', err);
      isSuccess = false;
    } finally {
      setResetLoading(false);
      setShowForgotModal(false);
      if (isSuccess) {
        showToast('Password reset email sent. Please check your inbox and spam folder.', 'success');
      } else {
        showToast('Failed to send password reset email. Please try again.', 'error');
      }
    }
  };

  return (
    <div className="relative h-screen w-full flex items-center justify-center p-4 sm:p-6 overflow-hidden">
      <ToastComponent />

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

      {/* Centered two-pane login card */}
      <div className="relative z-10 w-full max-w-4xl bg-white rounded-2xl shadow-[0_20px_60px_-12px_rgba(0,0,0,0.35)] overflow-hidden flex flex-col md:flex-row animate-in zoom-in-95 duration-300">
        {/* Left — credential form OR OTP verification screen */}
        {step === 'login' ? (
          <div className="w-full md:w-[calc(50%+2px)] flex flex-col min-h-[440px] md:min-h-[500px] bg-gradient-to-b from-white to-gray-50/80">
            <div className="px-7 sm:px-9 pt-8 pb-6 border-b border-gray-200/90 bg-white text-center">
              <h1 className="text-2xl sm:text-3xl font-bold text-primary-green tracking-[0.12em] uppercase">
                LOGIN
              </h1>
              <p className="text-gray-500 text-sm mt-2 max-w-xs mx-auto leading-relaxed">
                Sign in to manage your account securely
              </p>
              <div className="mt-5 mx-auto h-0.5 w-12 rounded-full bg-primary-green/30" />
            </div>

            <div className="flex-1 flex flex-col justify-center px-7 sm:px-9 py-7">
              <form onSubmit={handleSubmit} className="space-y-5 max-w-sm mx-auto w-full">
                {failedAttempts > 0 && !isLockedOut && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-900 text-xs flex items-center justify-between animate-in fade-in duration-200">
                    <div className="flex items-center gap-2 font-semibold">
                      <AlertTriangle size={16} className="shrink-0 text-amber-600" />
                      <span>Failed Login Attempts: {failedAttempts}/{MAX_FAILED_ATTEMPTS}</span>
                    </div>
                    <span className="font-bold text-amber-700">{MAX_FAILED_ATTEMPTS - failedAttempts} left</span>
                  </div>
                )}

                <h2 className="text-base font-semibold text-gray-800 text-center pb-1">Welcome back!</h2>

                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-1.5 min-h-[20px]">
                      <label className="text-sm font-semibold text-gray-700 block">Email</label>
                      {emailValidationError ? (
                        <span className="text-[11px] font-semibold text-red-500 animate-in fade-in duration-200">
                          {emailValidationError}
                        </span>
                      ) : emailError ? (
                        <span className="text-[11px] font-semibold text-red-500 animate-in fade-in duration-200">
                          Email is not registered
                        </span>
                      ) : null}
                    </div>
                    <div className="relative group">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400 group-focus-within:text-primary-green transition-colors">
                        <User size={18} />
                      </span>
                      <input
                        type="email"
                        required
                        disabled={isLockedOut}
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          setEmailError(false);
                          setEmailValidationError('');
                        }}
                        className={`block w-full pl-10 pr-4 py-3 bg-white border rounded-xl shadow-sm focus:ring-2 transition-all outline-none text-gray-800 placeholder:text-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed ${
                          emailError || emailValidationError
                            ? 'border-red-500 focus:ring-red-500/25 focus:border-red-500'
                            : 'border-gray-200 focus:ring-primary-green/25 focus:border-primary-green'
                        }`}
                        placeholder="Enter your email"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1.5 h-[20px]">
                      <label className="text-sm font-semibold text-gray-700 block">Password</label>
                      {passwordError && (
                        <span className="text-[11px] font-semibold text-red-500 animate-in fade-in duration-200">
                          Password is incorrect
                        </span>
                      )}
                    </div>
                    <div className="relative group">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400 group-focus-within:text-primary-green transition-colors">
                        <Lock size={18} />
                      </span>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        disabled={isLockedOut}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setPasswordError(false);
                        }}
                        className={`block w-full pl-10 pr-11 py-3 bg-white border rounded-xl shadow-sm focus:ring-2 transition-all outline-none text-gray-800 placeholder:text-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed ${
                          passwordError
                            ? 'border-red-500 focus:ring-red-500/25 focus:border-red-500'
                            : 'border-gray-200 focus:ring-primary-green/25 focus:border-primary-green'
                        }`}
                        placeholder="Enter your password"
                      />
                      <button
                        type="button"
                        disabled={isLockedOut}
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-0.5">
                  <button
                    type="button"
                    onClick={handleForgotClick}
                    className="text-sm font-semibold text-primary-green hover:text-[#0a3a16] transition-colors"
                  >
                    Forgot Password?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading || isLockedOut}
                  className={`w-full py-3.5 px-4 font-bold rounded-xl shadow-md transition-all duration-200 uppercase tracking-wider text-sm flex items-center justify-center gap-2 active:scale-[0.99] ${
                    isLockedOut
                      ? 'bg-red-600/90 text-white cursor-not-allowed shadow-red-600/20'
                      : 'bg-[#063c2d] hover:bg-[#0a3a16] text-white shadow-primary-green/20 hover:shadow-lg disabled:opacity-50'
                  }`}
                >
                  {isLockedOut ? (
                    <>
                      <Clock size={16} className="animate-spin text-white shrink-0" />
                      <span>Try again in: {formatLockTime(lockRemainingSeconds)}</span>
                    </>
                  ) : loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    'Login'
                  )}
                </button>
              </form>
            </div>

            <div className="px-7 sm:px-9 py-4 border-t border-gray-200/90 bg-white/90">
              <p className="text-[11px] text-gray-400 text-center leading-relaxed">
                BSU Bustos Campus - Internal System | Authorized Users Only
              </p>
            </div>
          </div>
        ) : (
          /* Step 2 — OTP Verification Screen */
          <div className="w-full md:w-[calc(50%+2px)] flex flex-col min-h-[440px] md:min-h-[500px] bg-gradient-to-b from-white to-gray-50/80 animate-in fade-in duration-300">
            <div className="px-7 sm:px-9 pt-6 pb-5 border-b border-gray-200/90 bg-white flex items-center justify-between">
              <button
                type="button"
                onClick={handleBackToLogin}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-primary-green transition-colors"
              >
                <ArrowLeft size={16} />
                <span>Back</span>
              </button>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-primary-green bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/60">
                Security Verification
              </span>
            </div>

            <div className="flex-1 flex flex-col justify-center px-7 sm:px-9 py-6 max-w-sm mx-auto w-full">
              <div className="text-center mb-5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100/80 text-primary-green flex items-center justify-center mx-auto mb-3 shadow-inner">
                  <ShieldCheck size={26} />
                </div>
                <h2 className="text-xl font-bold text-gray-900 tracking-tight">Email Verification</h2>
                <p className="text-xs font-medium text-gray-500 mt-1.5 leading-relaxed">
                  We sent a 6-digit verification code to<br />
                  <span className="font-bold text-gray-800 break-all">{email}</span>
                </p>
              </div>

              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block text-center mb-2">
                    Enter 6-Digit Code
                  </label>
                  <div className="flex justify-between items-center gap-1.5 sm:gap-2" onPaste={handlePaste}>
                    {otpDigits.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => (otpInputsRef.current[idx] = el)}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleDigitChange(idx, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(idx, e)}
                        className="w-10 h-12 sm:w-11 sm:h-12 text-center text-lg font-bold font-mono text-gray-900 bg-white border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-primary-green/30 focus:border-primary-green outline-none transition-all"
                      />
                    ))}
                  </div>
                </div>

                <label className="flex items-start gap-3 p-3 rounded-xl border border-emerald-200/80 bg-emerald-50/50 hover:bg-emerald-50 transition-colors cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={trustDevice}
                    onChange={(e) => setTrustDevice(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-primary-green focus:ring-primary-green/30 border-gray-300 cursor-pointer shrink-0"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-gray-800 block">Trust this device for 30 days</span>
                    <span className="text-gray-500 font-medium leading-tight block mt-0.5">
                      Skip verification code on this browser for the next 30 days.
                    </span>
                  </div>
                </label>

                <button
                  type="submit"
                  disabled={otpLoading || otpDigits.join('').length < 6}
                  className="w-full py-3.5 px-4 font-bold rounded-xl shadow-md transition-all duration-200 uppercase tracking-wider text-sm flex items-center justify-center gap-2 bg-[#063c2d] hover:bg-[#0a3a16] text-white shadow-primary-green/20 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]"
                >
                  {otpLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    'Verify & Sign In'
                  )}
                </button>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-gray-400 font-medium">Didn't get code?</span>
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={otpResendTimer > 0 || otpLoading}
                    className="font-bold text-primary-green hover:text-[#0a3a16] disabled:text-gray-400 transition-colors"
                  >
                    {otpResendTimer > 0 ? `Resend code in ${otpResendTimer}s` : 'Resend Code'}
                  </button>
                </div>
              </form>
            </div>

            <div className="px-7 sm:px-9 py-4 border-t border-gray-200/90 bg-white/90">
              <p className="text-[11px] text-gray-400 text-center leading-relaxed">
                BSU Bustos Campus - Internal System | Authorized Users Only
              </p>
            </div>
          </div>
        )}

        {/* Right — branding with rotated portrait video background (desktop only) */}
        <div className="hidden md:flex relative md:w-[calc(50%-2px)] flex-col items-center justify-center text-center px-6 sm:px-8 py-8 min-h-[280px] md:min-h-[500px] overflow-hidden bg-primary-green">
          <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
            <video
              src="/loginbgvid.mp4"
              autoPlay
              loop
              muted
              playsInline
              className="absolute top-1/2 left-1/2 h-full w-auto max-w-none -translate-x-1/2 -translate-y-1/2 rotate-90 scale-110 object-cover pointer-events-none brightness-[0.75]"
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/35 to-black/50 pointer-events-none" aria-hidden="true" />

          <div className="relative z-10 flex flex-col items-center max-w-[220px] sm:max-w-xs">
            <div className="w-32 h-32 sm:w-36 sm:h-36 mb-5 flex items-center justify-center">
              <img
                src="/logo.png"
                alt="OSO Logo"
                className="w-full h-full object-contain drop-shadow-2xl"
              />
            </div>

            <h2 className="login-brand-title text-2xl sm:text-3xl text-white uppercase flex justify-center gap-0.5">
              {"OSOADOCS".split("").map((letter, idx) => (
                <span
                  key={idx}
                  className="inline-block animate-letter-shine"
                  style={{ animationDelay: `${idx * 0.25}s` }}
                >
                  {letter}
                </span>
              ))}
            </h2>

            <p className="text-white/85 text-xs sm:text-sm leading-relaxed mt-5">
              Monitor submissions, track approval progress, and maintain organized records for student
              organization activities within the campus.
            </p>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Forgot Password */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-gray-100 space-y-5 animate-in zoom-in-95 duration-200 relative">
            <button
              type="button"
              onClick={() => !resetLoading && setShowForgotModal(false)}
              disabled={resetLoading}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1 rounded-lg transition-colors disabled:opacity-50"
            >
              <X size={20} />
            </button>

            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-primary-green/10 text-primary-green flex items-center justify-center mx-auto mb-3">
                <Mail size={24} />
              </div>
              <h3 className="text-xl font-bold text-gray-800">Reset Password</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Send a password reset link to{' '}
                <span className="font-semibold text-gray-900 break-all">{forgotEmail}</span>?
              </p>
              <p className="text-xs text-gray-400 leading-relaxed pt-1">
                If an account with this email exists, you will receive instructions to reset your password. Please check your inbox and spam folder.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                disabled={resetLoading}
                className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all text-sm disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendResetLink}
                disabled={resetLoading}
                className="flex-1 py-3 px-4 bg-[#063c2d] hover:bg-[#0a3a16] text-white font-semibold rounded-xl shadow-md transition-all text-sm disabled:opacity-70 flex items-center justify-center gap-2 active:scale-[0.99]"
              >
                {resetLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  'Send Reset Link'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;

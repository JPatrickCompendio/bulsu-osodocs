import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, Eye, EyeOff, User } from 'lucide-react';
import { apiFetch } from '../config/api';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setEmailError(false);
    setPasswordError(false);
    setLoading(true);

    const result = await login(email, password);

    if (result.success) {
      if (rememberMe) {
        localStorage.setItem('rememberedEmail', email);
      } else {
        localStorage.removeItem('rememberedEmail');
      }
      setLoading(false);
      navigate('/');
    } else {
      // Check if email exists to determine which input field is wrong
      try {
        const response = await apiFetch(`/api/users/check-email?email=${encodeURIComponent(email)}`);
        const data = await response.json();
        if (data && data.exists === false) {
          setEmailError(true);
        } else {
          setPasswordError(true);
        }
      } catch (err) {
        // Fallback: highlight both if check fails
        setEmailError(true);
        setPasswordError(true);
      }
    }
    setLoading(false);
  };

  React.useEffect(() => {
    const saved = localStorage.getItem('rememberedEmail');
    if (saved) {
      setEmail(saved);
      setRememberMe(true);
    }
  }, []);

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

      {/* Centered two-pane login card */}
      <div className="relative z-10 w-full max-w-4xl bg-white rounded-2xl shadow-[0_20px_60px_-12px_rgba(0,0,0,0.35)] overflow-hidden flex flex-col md:flex-row animate-in zoom-in-95 duration-300">
        {/* Left — login form (slightly wider) */}
        <div className="md:w-[calc(50%+2px)] flex flex-col min-h-[440px] md:min-h-[500px] bg-gradient-to-b from-white to-gray-50/80">
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
              <h2 className="text-base font-semibold text-gray-800 text-center pb-1">Welcome back!</h2>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-1.5 h-[20px]">
                    <label className="text-sm font-semibold text-gray-700 block">Email</label>
                    {emailError && (
                      <span className="text-[11px] font-semibold text-red-500 animate-in fade-in duration-200">
                        Email is not registered
                      </span>
                    )}
                  </div>
                  <div className="relative group">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400 group-focus-within:text-primary-green transition-colors">
                      <User size={18} />
                    </span>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setEmailError(false);
                      }}
                      className={`block w-full pl-10 pr-4 py-3 bg-white border rounded-xl shadow-sm focus:ring-2 transition-all outline-none text-gray-800 placeholder:text-gray-400 ${
                        emailError
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
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setPasswordError(false);
                      }}
                      className={`block w-full pl-10 pr-11 py-3 bg-white border rounded-xl shadow-sm focus:ring-2 transition-all outline-none text-gray-800 placeholder:text-gray-400 ${
                        passwordError
                          ? 'border-red-500 focus:ring-red-500/25 focus:border-red-500'
                          : 'border-gray-200 focus:ring-primary-green/25 focus:border-primary-green'
                      }`}
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-primary-green focus:ring-primary-green"
                  />
                  <span className="text-sm font-medium text-gray-600">Remember Me</span>
                </label>
                <button
                  type="button"
                  className="text-sm font-semibold text-primary-green hover:text-[#0a3a16] transition-colors"
                >
                  Forgot Password?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 bg-[#063c2d] hover:bg-[#0a3a16] text-white font-bold rounded-xl shadow-md shadow-primary-green/20 hover:shadow-lg transition-all duration-200 uppercase tracking-wider text-sm disabled:opacity-70 active:scale-[0.99]"
              >
                {loading ? 'Authenticating...' : 'Login'}
              </button>
            </form>
          </div>

          <div className="px-7 sm:px-9 py-4 border-t border-gray-200/90 bg-white/90">
            <p className="text-[11px] text-gray-400 text-center leading-relaxed">
              BSU Bustos Campus - Internal System | Authorized Users Only
            </p>
          </div>
        </div>

        {/* Right — branding with rotated portrait video background */}
        <div className="relative md:w-[calc(50%-2px)] flex flex-col items-center justify-center text-center px-6 sm:px-8 py-8 min-h-[280px] md:min-h-[500px] overflow-hidden bg-primary-green">
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
              {"OSODOCS".split("").map((letter, idx) => (
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
    </div>
  );
};

export default Login;

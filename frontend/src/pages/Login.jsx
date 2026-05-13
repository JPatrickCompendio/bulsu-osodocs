import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, ShieldAlert } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    const result = await login(email, password);
    
    if (result.success) {
      setLoading(false);
      navigate('/');
    } else {
      setError(result.error || 'Invalid email or password');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f2f5] p-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-green/5 rounded-full blur-3xl"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary-gold/10 rounded-full blur-3xl"></div>

      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden relative z-10 animate-in zoom-in-95 duration-300">
        <div className="bg-primary-green p-8 text-center relative overflow-hidden">
          {/* Subtle shine on header */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shine_3s_infinite] skew-x-[-20deg]"></div>
          
          <div className="w-24 h-24 bg-white rounded-full mx-auto mb-4 flex items-center justify-center p-2 shadow-lg relative z-10">
             <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-white relative z-10 tracking-tight">OSODOCS</h1>
          <p className="text-white/70 text-sm mt-1 relative z-10">Office of the Student Organizations</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-xl flex items-center gap-2 text-sm border border-red-100 animate-in slide-in-from-top-1">
              <ShieldAlert size={18} />
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div className="relative">
              <label className="text-sm font-medium text-gray-700 block mb-1">Email Address</label>
              <div className="relative group">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 group-focus-within:text-primary-green transition-colors">
                  <Mail size={18} />
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-green focus:border-transparent transition-all outline-none text-gray-800"
                  placeholder="name@bulsu.edu.ph"
                />
              </div>
            </div>

            <div className="relative">
              <label className="text-sm font-medium text-gray-700 block mb-1">Password</label>
              <div className="relative group">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 group-focus-within:text-primary-green transition-colors">
                  <Lock size={18} />
                </span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-green focus:border-transparent transition-all outline-none text-gray-800"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 bg-primary-green hover:bg-[#0a3a16] text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2 group disabled:opacity-70 active:scale-[0.98]"
          >
            {loading ? 'Authenticating...' : (
              <>
                Sign In
                <Lock size={18} className="group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>

          <div className="text-center text-[10px] text-gray-400 uppercase tracking-widest font-bold">
            &copy; 2026 Bulacan State University - OSODOCS
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;

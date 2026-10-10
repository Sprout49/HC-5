import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, KeyRound, User, ArrowRight, Ambulance as AmbulanceIcon, AlertCircle, Sparkles } from 'lucide-react';
import { TranetraLogo } from '../components/TranetraLogo';

interface AdminLoginPageProps {
  onLoginSuccess: () => void;
  onNavigateToAmbulanceLogin: () => void;
}

export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({
  onLoginSuccess,
  onNavigateToAmbulanceLogin,
}) => {
  const { loginAdmin } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await loginAdmin(username, password);
    setLoading(false);

    if (result.success) {
      onLoginSuccess();
    } else {
      setError(result.error || 'Authentication failed. Please verify credentials.');
    }
  };

  const handleFillDemo = () => {
    setUsername('admin');
    setPassword('admin123');
    setError(null);
  };

  return (
    <div className="relative w-screen h-screen flex items-center justify-center bg-gradient-to-br from-sky-100 via-white to-blue-100 p-4 sm:p-6 font-sans select-none overflow-hidden">
      {/* Light Blue Ambient Background Orbs */}
      <div className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-sky-300/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] bg-blue-300/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-sky-200/20 rounded-full blur-3xl pointer-events-none" />

      {/* Grid Pattern overlay */}
      <div 
        className="absolute inset-0 opacity-[0.12] pointer-events-none" 
        style={{ 
          backgroundImage: `radial-gradient(#0284c7 1px, transparent 1px)`, 
          backgroundSize: '28px 28px' 
        }} 
      />

      {/* Enlarged Card Container */}
      <div className="w-full max-w-xl bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl shadow-sky-900/15 border border-sky-100 p-8 sm:p-11 flex flex-col gap-7 relative z-10 my-auto max-h-[95vh] overflow-y-auto">
        
        {/* Portal Switcher Header Tabs */}
        <div className="flex bg-sky-100/70 p-1.5 rounded-2xl border border-sky-200/60 shrink-0">
          <button
            type="button"
            className="flex-1 py-2.5 text-xs sm:text-sm font-black rounded-xl bg-white text-sky-700 shadow-sm flex items-center justify-center gap-2 transition-all"
          >
            <Shield className="w-4 h-4 text-sky-600" />
            <span>Admin Command</span>
          </button>
          <button
            type="button"
            onClick={onNavigateToAmbulanceLogin}
            className="flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-xl text-slate-500 hover:text-sky-700 hover:bg-white/50 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <AmbulanceIcon className="w-4 h-4 text-slate-400" />
            <span>Ambulance Driver</span>
          </button>
        </div>

        {/* Brand Logo Header */}
        <div className="flex flex-col items-center text-center shrink-0 my-1">
          <TranetraLogo size="lg" showText={true} className="scale-105" />
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-2.5 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs sm:text-sm font-semibold animate-shake shrink-0">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Controls */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5 shrink-0">
          <div>
            <label className="block text-xs font-black text-sky-900 uppercase tracking-wider mb-2">
              Admin Username
            </label>
            <div className="relative">
              <User className="w-5 h-5 text-sky-400 absolute left-4 top-3.5" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="w-full pl-12 pr-4 py-3.5 bg-sky-50/50 border border-sky-200 rounded-2xl text-base font-bold text-slate-900 placeholder-sky-300 focus:outline-none focus:bg-white focus:ring-4 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-sky-900 uppercase tracking-wider mb-2">
              Password
            </label>
            <div className="relative">
              <KeyRound className="w-5 h-5 text-sky-400 absolute left-4 top-3.5" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-12 pr-4 py-3.5 bg-sky-50/50 border border-sky-200 rounded-2xl text-base font-bold text-slate-900 placeholder-sky-300 focus:outline-none focus:bg-white focus:ring-4 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                required
              />
            </div>
          </div>

          {/* Quick Demo Fill Helper */}
          <button
            type="button"
            onClick={handleFillDemo}
            className="flex items-center justify-center gap-2 py-1 text-xs sm:text-sm font-bold text-sky-600 hover:text-sky-800 hover:underline cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-sky-500" />
            <span>Auto-fill Demo Credentials (admin / admin123)</span>
          </button>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-600 hover:via-blue-700 hover:to-indigo-700 active:scale-[0.99] text-white font-black text-base rounded-2xl shadow-xl shadow-sky-500/30 transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 mt-1"
          >
            {loading ? (
              <span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <>
                <span>Enter Command Center</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        {/* Switch Portal Footer */}
        <div className="pt-4 border-t border-sky-100/80 flex flex-col items-center shrink-0">
          <p className="text-xs text-slate-400 mb-2 font-medium">Are you an emergency ambulance crew member?</p>
          <button
            type="button"
            onClick={onNavigateToAmbulanceLogin}
            className="flex items-center gap-2 px-5 py-2.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200/80 font-bold text-xs sm:text-sm rounded-xl transition-all cursor-pointer shadow-xs"
          >
            <AmbulanceIcon className="w-4 h-4 text-sky-600" />
            <span>Switch to Ambulance Driver Login →</span>
          </button>
        </div>

      </div>
    </div>
  );
};

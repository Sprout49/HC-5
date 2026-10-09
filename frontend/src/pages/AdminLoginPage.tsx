import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, KeyRound, User, ArrowRight, Ambulance as AmbulanceIcon, AlertCircle, Sparkles } from 'lucide-react';

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
    <div className="w-screen h-screen flex items-center justify-center bg-radial from-slate-100 to-slate-200 p-4 font-sans select-none overflow-hidden">
      <div className="w-full max-w-md bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-200/80 p-8 flex flex-col gap-6 relative">
        {/* Header Badge */}
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30 mb-4 ring-4 ring-blue-50">
            <Shield className="w-8 h-8" />
          </div>
          <span className="px-3 py-1 bg-blue-50 border border-blue-200/80 text-blue-700 text-xs font-black tracking-wider uppercase rounded-full mb-1">
            HC-05 Central Command
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Admin Dispatch Portal</h1>
          <p className="text-xs text-slate-500 mt-1 max-w-xs">
            Climate-Aware Emergency Response Network. Authorised access for Incident Commanders and Dispatchers.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold animate-shake">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Admin Username
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="????????"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                required
              />
            </div>
          </div>

          {/* Quick Demo Fill Helper */}
          <button
            type="button"
            onClick={handleFillDemo}
            className="flex items-center justify-center gap-1.5 py-1 text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Auto-fill Demo Credentials (admin / admin123)</span>
          </button>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-extrabold text-sm rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <>
                <span>Enter Command Center</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Switch Portal Link */}
        <div className="pt-4 border-t border-slate-100 flex flex-col items-center">
          <p className="text-xs text-slate-400 mb-2 font-medium">Are you an emergency ambulance crew member?</p>
          <button
            type="button"
            onClick={onNavigateToAmbulanceLogin}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
          >
            <AmbulanceIcon className="w-4 h-4 text-emerald-600" />
            <span>Switch to Ambulance Driver Login ?</span>
          </button>
        </div>
      </div>
    </div>
  );
};

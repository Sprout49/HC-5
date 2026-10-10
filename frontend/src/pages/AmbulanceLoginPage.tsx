import React, { useState, useEffect } from 'react';
import { API_BASE } from '../context/SimulationContext';
import { useAuth } from '../context/AuthContext';
import { Ambulance as AmbulanceIcon, KeyRound, ArrowRight, Shield, AlertCircle, Radio, Car, Check } from 'lucide-react';
import { TranetraLogo } from '../components/TranetraLogo';

interface AmbulanceLoginPageProps {
  onLoginSuccess: (ambulanceId: string) => void;
  onNavigateToAdminLogin: () => void;
}

interface AvailableAmbulance {
  ambulance_id: string;
  callsign: string;
  type: string;
  status: string;
  assigned_zone: string;
  password?: string;
}

export const AmbulanceLoginPage: React.FC<AmbulanceLoginPageProps> = ({
  onLoginSuccess,
  onNavigateToAdminLogin,
}) => {
  const { loginAmbulance } = useAuth();
  const [ambulanceId, setAmbulanceId] = useState('AMB-01');
  const [password, setPassword] = useState('demo123');
  const [availableUnits, setAvailableUnits] = useState<AvailableAmbulance[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/auth/ambulances`)
      .then((res) => res.json())
      .then((data: AvailableAmbulance[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setAvailableUnits(data);
          setAmbulanceId(data[0].ambulance_id);
          if (data[0].password) {
            setPassword(data[0].password);
          }
        }
      })
      .catch((err) => console.warn('Could not fetch active units for login:', err));
  }, []);

  const handleSelectUnit = (unit: AvailableAmbulance) => {
    setAmbulanceId(unit.ambulance_id);
    if (unit.password) {
      setPassword(unit.password);
    }
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await loginAmbulance(ambulanceId, password);
    setLoading(false);

    if (result.success) {
      onLoginSuccess(ambulanceId.toUpperCase());
    } else {
      setError(result.error || 'Authentication failed. Please verify vehicle ID and PIN.');
    }
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
            onClick={onNavigateToAdminLogin}
            className="flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-xl text-slate-500 hover:text-sky-700 hover:bg-white/50 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Shield className="w-4 h-4 text-slate-400" />
            <span>Admin Command</span>
          </button>
          <button
            type="button"
            className="flex-1 py-2.5 text-xs sm:text-sm font-black rounded-xl bg-white text-sky-700 shadow-sm flex items-center justify-center gap-2 transition-all"
          >
            <AmbulanceIcon className="w-4 h-4 text-sky-600" />
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

        {/* Quick Fleet Unit Selector */}
        {availableUnits.length > 0 && (
          <div className="flex flex-col gap-2.5 shrink-0">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-sky-900 uppercase tracking-wider">
                Select Active Fleet Unit
              </label>
              <span className="text-xs text-sky-600 font-bold bg-sky-50 px-2.5 py-0.5 rounded-lg border border-sky-200/80">
                {availableUnits.length} Units Online
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2.5 max-h-40 overflow-y-auto pr-1">
              {availableUnits.map((u) => {
                const isSelected = ambulanceId.toUpperCase() === u.ambulance_id.toUpperCase();
                return (
                  <button
                    key={u.ambulance_id}
                    type="button"
                    onClick={() => handleSelectUnit(u)}
                    className={`flex items-center justify-between p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-sky-50 border-sky-500 text-sky-950 shadow-xs ring-1 ring-sky-500 font-bold'
                        : 'bg-sky-50/40 border-sky-200 hover:bg-sky-100/60 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Radio className={`w-4 h-4 shrink-0 ${isSelected ? 'text-sky-600 animate-pulse' : 'text-slate-400'}`} />
                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-black truncate text-sky-950">{u.ambulance_id}</div>
                        <div className="text-[11px] text-slate-500 truncate">{u.type} • Zone {u.assigned_zone}</div>
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-sky-600 shrink-0 ml-1" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Form Controls */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5 shrink-0">
          <div>
            <label className="block text-xs font-black text-sky-900 uppercase tracking-wider mb-2">
              Ambulance Unit ID
            </label>
            <div className="relative">
              <Car className="w-5 h-5 text-sky-400 absolute left-4 top-3.5" />
              <input
                type="text"
                value={ambulanceId}
                onChange={(e) => setAmbulanceId(e.target.value.toUpperCase())}
                placeholder="AMB-01"
                className="w-full pl-12 pr-4 py-3.5 bg-sky-50/50 border border-sky-200 rounded-2xl text-base font-bold text-slate-900 focus:outline-none focus:bg-white focus:ring-4 focus:ring-sky-500/20 focus:border-sky-500 uppercase tracking-wider transition-all"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-sky-900 uppercase tracking-wider mb-2">
              Crew Access Password / PIN
            </label>
            <div className="relative">
              <KeyRound className="w-5 h-5 text-sky-400 absolute left-4 top-3.5" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-12 pr-4 py-3.5 bg-sky-50/50 border border-sky-200 rounded-2xl text-base font-bold text-slate-900 focus:outline-none focus:bg-white focus:ring-4 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                required
              />
            </div>
            <p className="text-xs text-slate-400 mt-1.5 font-medium">
              Default password for pre-seeded units is <code className="bg-sky-50 text-sky-800 border border-sky-200 px-1.5 py-0.5 rounded-md font-mono font-bold">demo123</code>.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-sky-500 via-blue-600 to-cyan-600 hover:from-sky-600 hover:via-blue-700 hover:to-cyan-700 active:scale-[0.99] text-white font-black text-base rounded-2xl shadow-xl shadow-sky-500/30 transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 mt-1"
          >
            {loading ? (
              <span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <>
                <span>Connect Vehicle CAD Terminal</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        {/* Switch Portal Footer */}
        <div className="pt-4 border-t border-sky-100/80 flex flex-col items-center shrink-0">
          <p className="text-xs text-slate-400 mb-2 font-medium">Looking for Central Incident Command?</p>
          <button
            type="button"
            onClick={onNavigateToAdminLogin}
            className="flex-1 px-5 py-2.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200/80 font-bold text-xs sm:text-sm rounded-xl transition-all cursor-pointer shadow-xs"
          >
            <Shield className="w-4 h-4 text-sky-600 inline mr-2" />
            <span>Switch to Admin Command Login →</span>
          </button>
        </div>

      </div>
    </div>
  );
};

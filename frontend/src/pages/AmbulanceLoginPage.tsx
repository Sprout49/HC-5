import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Ambulance as AmbulanceIcon, KeyRound, ArrowRight, Shield, AlertCircle, Radio, Car, Check } from 'lucide-react';

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
    fetch('http://127.0.0.1:8000/api/auth/ambulances')
      .then((res) => res.json())
      .then((data: AvailableAmbulance[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setAvailableUnits(data);
          // Default to first unit
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
    <div className="w-screen h-screen flex items-center justify-center bg-radial from-slate-100 to-slate-200 p-4 font-sans select-none overflow-hidden">
      <div className="w-full max-w-lg bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-200/80 p-8 flex flex-col gap-6 relative max-h-[95vh] overflow-y-auto">
        {/* Header Badge */}
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30 mb-4 ring-4 ring-emerald-50">
            <AmbulanceIcon className="w-8 h-8" />
          </div>
          <span className="px-3 py-1 bg-emerald-50 border border-emerald-200/80 text-emerald-700 text-xs font-black tracking-wider uppercase rounded-full mb-1">
            HC-05 Mobile CAD Terminal
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">First Responder Vehicle Login</h1>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">
            In-Cab Computer Aided Dispatch (CAD). Authenticate your emergency vehicle crew to receive real-time dispatches.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold animate-shake">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Quick Fleet Unit Selector */}
        {availableUnits.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                Select Active Fleet Unit
              </label>
              <span className="text-[10px] text-slate-400 font-semibold">{availableUnits.length} Units Online</span>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
              {availableUnits.map((u) => {
                const isSelected = ambulanceId.toUpperCase() === u.ambulance_id.toUpperCase();
                return (
                  <button
                    key={u.ambulance_id}
                    type="button"
                    onClick={() => handleSelectUnit(u)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-950 shadow-xs ring-1 ring-emerald-500'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Radio className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-emerald-600 animate-pulse' : 'text-slate-400'}`} />
                      <div className="min-w-0">
                        <div className="text-xs font-black truncate">{u.ambulance_id}</div>
                        <div className="text-[10px] text-slate-500 truncate">{u.type} ? Zone {u.assigned_zone}</div>
                      </div>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 ml-1" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Ambulance Unit ID
            </label>
            <div className="relative">
              <Car className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={ambulanceId}
                onChange={(e) => setAmbulanceId(e.target.value.toUpperCase())}
                placeholder="AMB-01"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 uppercase tracking-wider transition-all"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Crew Access Password / PIN
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="????????"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                required
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1 font-medium">
              Default password for pre-seeded units is <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">demo123</code>.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-extrabold text-sm rounded-xl shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-1"
          >
            {loading ? (
              <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <>
                <span>Connect Vehicle CAD Terminal</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Switch Portal Link */}
        <div className="pt-4 border-t border-slate-100 flex flex-col items-center">
          <p className="text-xs text-slate-400 mb-2 font-medium">Looking for Central Incident Command?</p>
          <button
            type="button"
            onClick={onNavigateToAdminLogin}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
          >
            <Shield className="w-4 h-4 text-blue-600" />
            <span>Switch to Admin Command Login ?</span>
          </button>
        </div>
      </div>
    </div>
  );
};

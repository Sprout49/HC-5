import { useState, useEffect } from 'react';
import { useSimulation } from '../context/SimulationContext';
import { CityMap3D } from '../components/map/CityMap3D';
import {
  Navigation2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Radio,
  Check,
  Shield,
  Ambulance as AmbulanceIcon,
} from 'lucide-react';

interface AmbulanceDashboardProps {
  activeTab?: 'admin' | 'ambulance';
  onSwitchTab?: (tab: 'admin' | 'ambulance') => void;
}

export const AmbulanceDashboard: React.FC<AmbulanceDashboardProps> = ({ activeTab = 'ambulance', onSwitchTab }) => {
  const { state, acceptCall, pickupPatient, startHospitalRoute } = useSimulation();

  const [activeAmbulanceId, setActiveAmbulanceId] = useState<string>('AMB-01');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(true);
  const [loginPassword, setLoginPassword] = useState<string>('demo123');

  const currentAmbulance = state?.ambulances.find((a) => a.ambulance_id === activeAmbulanceId);
  const currentIncident = state?.incidents.find(
    (i) => i.incident_id === currentAmbulance?.current_incident_id
  );

  // Auto-select unit with active call or route if current unit is idle
  useEffect(() => {
    if (!state?.ambulances) return;
    const activeUnit = state.ambulances.find(
      (a) => a.status === 'CALL_RECEIVED' || a.status.includes('EN_ROUTE') || a.status === 'AT_PATIENT'
    );
    if (activeUnit && (!currentAmbulance || currentAmbulance.status === 'AVAILABLE')) {
      setActiveAmbulanceId(activeUnit.ambulance_id);
    }
  }, [state?.ambulances]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginPassword === 'demo123') {
      setIsLoggedIn(true);
    } else {
      alert('Demo password is demo123');
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-slate-100 p-4 select-none">
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 p-8 w-full max-w-md">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-2xl shadow-md">
              🚑
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">HC-05 Response</h2>
              <p className="text-xs text-slate-500 font-medium">Ambulance In-Vehicle Navigation Portal</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Select Ambulance Unit
              </label>
              <select
                value={activeAmbulanceId}
                onChange={(e) => setActiveAmbulanceId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800"
              >
                {state?.ambulances.map((amb) => (
                  <option key={amb.ambulance_id} value={amb.ambulance_id}>
                    {amb.ambulance_id} ({amb.type} — Zone {amb.assigned_zone}) {amb.status !== 'AVAILABLE' ? `[${amb.status}]` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Operator Password (Demo: demo123)
              </label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm shadow-md transition-all mt-2"
            >
              LOGIN TO VEHICLE TERMINAL
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden flex flex-col bg-slate-100 select-none">
      {/* 1. TOP STATUS BAR */}
      <header className="h-16 px-6 bg-white/95 backdrop-blur-md border-b border-slate-200/90 flex items-center justify-between z-30 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-xl shadow-md">
            🚑
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-extrabold text-slate-900 text-sm tracking-tight">
                {currentAmbulance?.ambulance_id} ({currentAmbulance?.type})
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping" />
                {currentAmbulance?.status.replace(/_/g, ' ') || 'ONLINE'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              Staging: Zone {currentAmbulance?.assigned_zone} • Speed: {currentAmbulance?.speed_kmh || 45} km/h • Load: <strong className="text-slate-800">👥 {currentAmbulance?.patients_onboard || 0} / 2 Patients</strong>
            </p>
          </div>
        </div>

        {/* Right Section: Vehicle Switcher & Portal Switcher */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200">
            <span className="text-[11px] font-bold text-slate-400 px-1">Unit:</span>
            {state?.ambulances.map((amb) => {
              const hasCall = amb.status === 'CALL_RECEIVED';
              const isMoving = amb.status.includes('EN_ROUTE');
              return (
                <button
                  key={amb.ambulance_id}
                  onClick={() => setActiveAmbulanceId(amb.ambulance_id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                    activeAmbulanceId === amb.ambulance_id
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>{amb.ambulance_id}</span>
                  {hasCall && <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />}
                  {isMoving && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
                </button>
              );
            })}
          </div>

          {onSwitchTab && (
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
              <button
                onClick={() => onSwitchTab('admin')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'admin'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Shield className="w-3 h-3" />
                <span>Admin</span>
              </button>
              <button
                onClick={() => onSwitchTab('ambulance')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'ambulance'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <AmbulanceIcon className="w-3 h-3" />
                <span>Ambulance</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* 2. 3D NAVIGATION MAP CENTERED ON AMBULANCE */}
      <main className="flex-1 relative w-full h-full">
        <CityMap3D focusAmbulanceId={activeAmbulanceId} />

        {/* FLOATING NAVIGATION CARD AT BOTTOM */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-xl px-4 z-20 pointer-events-none">
          <div className="glass-panel p-5 rounded-3xl shadow-2xl border border-slate-200 pointer-events-auto">
            {/* STATE 1: AVAILABLE / STANDBY */}
            {(!currentAmbulance || currentAmbulance.status === 'AVAILABLE' || currentAmbulance.status === 'COMPLETED') && (
              <div className="text-center py-3">
                <div className="w-10 h-10 mx-auto mb-2 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-lg">
                  <Radio className="w-5 h-5 animate-pulse" />
                </div>
                <h3 className="font-extrabold text-slate-800 text-sm">
                  STANDBY — MONITORING EMERGENCY DISPATCH
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Ambulance is staged and ready in Zone {currentAmbulance?.assigned_zone}. The central AI dispatch engine will assign calls in real time.
                </p>
              </div>
            )}

            {/* STATE 2: CALL RECEIVED — ACCEPT BUTTON */}
            {currentAmbulance?.status === 'CALL_RECEIVED' && (
              <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="p-2 bg-red-100 text-red-600 rounded-xl">
                      <AlertTriangle className="w-5 h-5" />
                    </span>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-red-600 tracking-wider">
                        NEW INCOMING CALL
                      </span>
                      <h3 className="font-black text-slate-900 text-base">
                        {currentIncident?.severity} EMERGENCY REPORTED
                      </h3>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 bg-red-600 text-white text-xs font-bold rounded-full">
                    {currentIncident?.patient_count} Patient(s)
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Estimated ETA</span>
                    <span className="font-extrabold text-slate-800 text-sm">
                      {currentAmbulance.eta_minutes.toFixed(1)} min
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Route Safety</span>
                    <span className="font-extrabold text-emerald-700 text-sm">SAFE + FAST (Elevated)</span>
                  </div>
                </div>

                <button
                  onClick={() => acceptCall(activeAmbulanceId)}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl text-sm shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
                >
                  <Check className="w-5 h-5" />
                  <span>ACCEPT EMERGENCY CALL & NAVIGATE</span>
                </button>
              </div>
            )}

            {/* STATE 3: EN ROUTE TO PATIENT */}
            {currentAmbulance?.status === 'EN_ROUTE_TO_PATIENT' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Navigation2 className="w-5 h-5 text-blue-600 rotate-45" />
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400">Navigating To</span>
                      <h4 className="font-black text-slate-900 text-sm">Patient Emergency Scene</h4>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-black text-blue-600">
                      {currentAmbulance.eta_minutes.toFixed(1)}m
                    </span>
                    <span className="text-[10px] block text-slate-400 font-bold">
                      {currentAmbulance.active_route?.distance_km} km
                    </span>
                  </div>
                </div>

                {/* Route Information HUD */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-slate-500 font-medium text-[11px]">
                    <span>Speed: <strong className="text-slate-800">{currentAmbulance.speed_kmh || 48} km/h</strong></span>
                    <span>Load: <strong className="text-slate-800">👥 {currentAmbulance.patients_onboard || 0}/2 Patients</strong></span>
                    <span>Route Risk: <strong className="text-emerald-700">{currentAmbulance.active_route?.risk_rating || 'LOW'}</strong></span>
                  </div>
                  <div className="text-[11px] text-blue-900 font-semibold bg-blue-50/80 p-2 rounded-lg border border-blue-100 flex items-start gap-1.5 leading-snug">
                    <span className="shrink-0">🛡️</span>
                    <span>{currentAmbulance.active_route?.explanation || 'Optimal route avoiding floodwaters'}</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase">
                    <span>Progress to Scene</span>
                    <span>{((currentAmbulance.route_progress || 0) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all duration-300"
                      style={{ width: `${((currentAmbulance.route_progress || 0) * 100).toFixed(0)}%` }}
                    />
                  </div>
                </div>

                {/* Manual Pick Up Button if Operator arrives early */}
                <button
                  onClick={() => pickupPatient(activeAmbulanceId)}
                  className="w-full py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl text-xs border border-blue-200 transition-colors flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  <span>Arrived at Scene? Confirm Patient Pickup</span>
                </button>

                {/* Reroute Alert if active */}
                {currentAmbulance.previous_route && (
                  <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 font-medium flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>⚡ Safe Reroute: Detour calculated around flooded roads.</span>
                  </div>
                )}
              </div>
            )}

            {/* STATE 4: ARRIVED AT PATIENT — PICKUP BUTTON */}
            {currentAmbulance?.status === 'AT_PATIENT' && (
              <div className="space-y-3 text-center py-1">
                <div className="w-10 h-10 mx-auto bg-amber-100 text-amber-800 rounded-full flex items-center justify-center font-bold text-lg">
                  📍
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">ARRIVED AT PATIENT SCENE</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Operator arrived at incident location. Stabilize patient and confirm transport.
                  </p>
                </div>
                <button
                  onClick={() => pickupPatient(activeAmbulanceId)}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-2xl text-sm shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 mt-2"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>PATIENT PICKED UP (CALCULATE HOSPITAL)</span>
                </button>
              </div>
            )}

            {/* STATE 5: PATIENT PICKED UP — HOSPITAL RECOMMENDATION */}
            {currentAmbulance?.status === 'PATIENT_PICKED_UP' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>PATIENT SECURED IN VEHICLE</span>
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    HOSPITAL ELIGIBILITY
                  </span>
                </div>

                <div className="p-3.5 bg-blue-50/70 rounded-2xl border border-blue-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-blue-700 block">
                        Optimal Facility Match
                      </span>
                      <h4 className="font-black text-slate-900 text-base">
                        {currentAmbulance.target_hospital_name || 'Sassoon General Hospital'}
                      </h4>
                    </div>
                    <span className="px-2.5 py-1 bg-blue-600 text-white text-xs font-bold rounded-xl shadow-xs">
                      Trauma L1
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 text-center pt-1 text-xs">
                    <div className="p-1.5 bg-white rounded-xl border border-blue-100">
                      <span className="block text-[9px] uppercase font-bold text-slate-400">ETA</span>
                      <span className="font-extrabold text-blue-900">
                        {currentAmbulance.hospital_route?.duration_min ?? 8.2}m
                      </span>
                    </div>
                    <div className="p-1.5 bg-white rounded-xl border border-blue-100">
                      <span className="block text-[9px] uppercase font-bold text-slate-400">ICU</span>
                      <span className="font-extrabold text-emerald-700">AVAILABLE</span>
                    </div>
                    <div className="p-1.5 bg-white rounded-xl border border-blue-100">
                      <span className="block text-[9px] uppercase font-bold text-slate-400">Route</span>
                      <span className="font-extrabold text-blue-900">LOW RISK</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => startHospitalRoute(activeAmbulanceId)}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-2xl text-sm shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
                >
                  <ArrowRight className="w-5 h-5" />
                  <span>START ROUTE TO HOSPITAL</span>
                </button>
              </div>
            )}

            {/* STATE 6: EN ROUTE TO HOSPITAL */}
            {currentAmbulance?.status === 'EN_ROUTE_TO_HOSPITAL' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Navigation2 className="w-5 h-5 text-emerald-600 rotate-45" />
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400">Transporting To</span>
                      <h4 className="font-black text-slate-900 text-sm">
                        {currentAmbulance.target_hospital_name || 'Hospital Emergency Wing'}
                      </h4>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-black text-emerald-600">
                      {currentAmbulance.eta_minutes.toFixed(1)}m
                    </span>
                    <span className="text-[10px] block text-slate-400 font-bold">
                      {currentAmbulance.active_route?.distance_km} km
                    </span>
                  </div>
                </div>

                {/* Route Information HUD */}
                <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200/80 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-slate-600 font-medium text-[11px]">
                    <span>Speed: <strong className="text-slate-900">{currentAmbulance.speed_kmh || 52} km/h</strong></span>
                    <span>Load: <strong className="text-emerald-800 font-bold">👥 {currentAmbulance.patients_onboard || 1}/2 Onboard</strong></span>
                    <span>Type: <strong className="text-slate-800">Trauma L1</strong></span>
                  </div>
                  {currentAmbulance.active_route?.explanation && (
                    <div className="text-[11px] text-emerald-950 font-medium bg-white/90 p-2 rounded-lg border border-emerald-200 flex items-start gap-1.5 leading-snug">
                      <span className="shrink-0">🛡️</span>
                      <span>{currentAmbulance.active_route.explanation}</span>
                    </div>
                  )}
                  <div className="text-[11px] text-emerald-950 font-semibold bg-white/80 px-2 py-1 rounded-lg border border-emerald-200 flex items-center justify-between">
                    <span>✓ Beds & ICU Reserved</span>
                    <span className="text-slate-500 font-normal">Direct Emergency Admission</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase">
                    <span>Progress to Hospital</span>
                    <span>{((currentAmbulance.route_progress || 0) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
                    <div
                      className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                      style={{ width: `${((currentAmbulance.route_progress || 0) * 100).toFixed(0)}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

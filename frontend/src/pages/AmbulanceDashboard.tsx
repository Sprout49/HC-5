import { useState, useEffect } from 'react';
import { useSimulation } from '../context/SimulationContext';
import { useAuth } from '../context/AuthContext';
import { CityMap3D } from '../components/map/CityMap3D';
import {
  Navigation2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Radio,
  Check,
  LogOut,
  Shield,
  MessageSquare,
} from 'lucide-react';
import { GoogleMapsNavHUD } from '../components/ambulance/GoogleMapsNavHUD';
import { motion, AnimatePresence } from 'framer-motion';
import { MeshRelayHUD } from '../components/emergency/MeshRelayHUD';
import { TacticalRadioHUD } from '../components/emergency/TacticalRadioHUD';
import { EvacuationAlertBanner } from '../components/emergency/EvacuationAlertBanner';
import { CitizenSOSModal } from '../components/emergency/CitizenSOSModal';
import { meshNetwork } from '../utils/meshNetwork';

interface AmbulanceDashboardProps {
  activeTab?: 'admin' | 'ambulance';
  onSwitchTab?: (tab: 'admin' | 'ambulance') => void;
}

export const AmbulanceDashboard: React.FC<AmbulanceDashboardProps> = () => {
  const { state, acceptCall, pickupPatient, startHospitalRoute } = useSimulation();
  const { ambulanceUser, logoutAmbulance } = useAuth();
  
  // Flexible vehicle selector supporting URL query e.g. /ambulance?id=AMB-02 or user session
  const queryParamAmb = typeof window !== 'undefined' 
    ? new URLSearchParams(window.location.search).get('id') || new URLSearchParams(window.location.search).get('amb')
    : null;
    
  const [selectedAmbulanceId, setSelectedAmbulanceId] = useState<string>(() => {
    return queryParamAmb ? queryParamAmb.toUpperCase() : (ambulanceUser?.ambulance_id || 'AMB-01');
  });
  
  const activeAmbulanceId = selectedAmbulanceId;

  // Live Hardware GPS Telemetry State (for Judge Demonstration)
  const [useRealGps, setUseRealGps] = useState(false);
  const [deviceGpsCoords, setDeviceGpsCoords] = useState<[number, number] | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [showCitizenSOS, setShowCitizenSOS] = useState(false);

  // Register this ambulance terminal tab in the mesh network
  useEffect(() => {
    meshNetwork.registerLocalTab('AMBULANCE', `Ambulance ${activeAmbulanceId}`, 'HC-05 BT SPP');
  }, [activeAmbulanceId]);

  useEffect(() => {
    if (!useRealGps) {
      setDeviceGpsCoords(null);
      setGpsAccuracy(null);
      setGpsError(null);
      return;
    }

    if (!('geolocation' in navigator)) {
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setDeviceGpsCoords([pos.coords.longitude, pos.coords.latitude]);
        setGpsAccuracy(pos.coords.accuracy);
        setGpsError(null);
      },
      (err) => {
        setGpsError(err.message || 'Unable to retrieve hardware GPS fix.');
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000,
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [useRealGps]);

  const currentAmbulance = state?.ambulances.find((a) => a.ambulance_id === activeAmbulanceId);
  const currentIncident = state?.incidents.find(
    (i) => i.incident_id === currentAmbulance?.current_incident_id
  );

  return (
    <div className="relative w-screen h-screen overflow-hidden flex flex-col bg-slate-100 select-none">
      {/* 1. TOP STATUS BAR */}
      <motion.header 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="min-h-[66px] sm:min-h-[74px] px-3 sm:px-6 py-2 bg-white/90 backdrop-blur-2xl border-b border-slate-200/80 flex items-center justify-between z-30 shadow-xs gap-3 overflow-x-auto no-scrollbar"
      >
        <div className="flex items-center gap-3">
          <motion.div whileHover={{ scale: 1.05 }} className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-xl shadow-md">
            🚑
          </motion.div>
          <div>
            <div className="flex items-center gap-2">
              <select
                value={activeAmbulanceId}
                onChange={(e) => {
                  setSelectedAmbulanceId(e.target.value);
                  const newUrl = `${window.location.pathname}?id=${e.target.value}`;
                  window.history.replaceState({}, '', newUrl);
                }}
                className="bg-slate-900 hover:bg-slate-800 text-white font-black text-xs px-2.5 py-1 rounded-xl shadow-xs border border-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                title="Switch Vehicle Unit for this Tab"
              >
                {state?.ambulances && state.ambulances.length > 0 ? (
                  state.ambulances.map((amb) => (
                    <option key={amb.ambulance_id} value={amb.ambulance_id}>
                      {amb.ambulance_id} ({amb.type})
                    </option>
                  ))
                ) : (
                  <option value={activeAmbulanceId}>{activeAmbulanceId}</option>
                )}
              </select>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping" />
                {currentAmbulance?.status.replace(/_/g, ' ') || 'ONLINE'}
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium whitespace-nowrap hidden sm:block">
              Staging: Zone {currentAmbulance?.assigned_zone} • Speed: {currentAmbulance?.speed_kmh || 45} km/h • Load: <strong className="text-slate-800">👥 {currentAmbulance?.patients_onboard || 0} / 2 Patients</strong>
            </p>
          </div>
        </div>

        {/* Right Section: Driver Session & Controls */}
        <div className="flex items-center gap-3">
          {/* Live Hardware GPS Toggle for Judges */}
          <button
            onClick={() => setUseRealGps(!useRealGps)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              useRealGps
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-500/30 ring-2 ring-cyan-400 animate-pulse'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
            }`}
            title={useRealGps ? 'Click to return to Simulated Pune Flood Grid' : 'Click to stream real device GPS hardware coordinates (Judge Demo)'}
          >
            <Radio className={`w-3.5 h-3.5 ${useRealGps ? 'text-white animate-ping' : 'text-slate-500'}`} />
            <span>{useRealGps ? '📡 LIVE DEVICE GPS FEED' : '📍 GPS: Pune Sim Grid'}</span>
          </button>

          <MeshRelayHUD />

          <button
            onClick={() => setShowCitizenSOS(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer"
            title="View WhatsApp & Telegram Citizen SOS Feed"
          >
            <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
            <span>SOS Feed</span>
            {(state?.recent_sos_messages?.length ?? 0) > 0 && (
              <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[9px] font-black flex items-center justify-center">
                {state?.recent_sos_messages?.length}
              </span>
            )}
          </button>

          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200/80 rounded-xl">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-black text-emerald-950">
              Unit {ambulanceUser?.ambulance_id || activeAmbulanceId} Operator
            </span>
          </div>

          <button
            onClick={() => {
              logoutAmbulance();
              window.location.href = '/ambulance/login';
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
            title="Sign out of vehicle CAD terminal"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>End Shift / Sign Out</span>
          </button>
        </div>
      </motion.header>

      {/* Emergency Evacuation Broadcast Alert Banner */}
      <EvacuationAlertBanner evacuations={state?.active_evacuations} isAdmin={false} />

      {/* 2. 3D NAVIGATION MAP CENTERED ON AMBULANCE */}
      <main className="flex-1 relative w-full h-full">
        {/* Live GPS Telemetry Stream Banner (For Judges) */}
        <AnimatePresence>
        {useRealGps && (
          <motion.div 
            initial={{ y: -50, opacity: 0, x: "-50%" }}
            animate={{ y: 0, opacity: 1, x: "-50%" }}
            exit={{ y: -50, opacity: 0, x: "-50%" }}
            className="absolute top-20 left-1/2 z-30 bg-slate-900/80 backdrop-blur-2xl border border-cyan-500/60 text-white px-5 py-3 rounded-2xl shadow-2xl flex flex-wrap items-center gap-4"
          >
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
              <span className="text-xs font-black text-cyan-400 tracking-wider uppercase">
                IoT Telemetry Stream Active
              </span>
            </div>
            {deviceGpsCoords ? (
              <div className="flex items-center gap-3 text-xs font-mono text-slate-200">
                <span>Lat: {deviceGpsCoords[1].toFixed(5)}?</span>
                <span>?</span>
                <span>Lon: {deviceGpsCoords[0].toFixed(5)}?</span>
                {gpsAccuracy !== null && (
                  <span className="text-[10px] text-cyan-300 font-sans font-bold bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/30">
                    ?{gpsAccuracy.toFixed(1)}m precision
                  </span>
                )}
              </div>
            ) : gpsError ? (
              <span className="text-xs text-rose-400 font-semibold">{gpsError}</span>
            ) : (
              <span className="text-xs text-slate-400 italic">Acquiring live hardware satellite lock...</span>
            )}
            <button
              onClick={() => setUseRealGps(false)}
              className="px-2.5 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 hover:text-white rounded-lg text-xs font-bold border border-cyan-500/40 transition-colors cursor-pointer"
            >
              Return to Pune Flood Sim
            </button>
          </motion.div>
        )}
        </AnimatePresence>

        <CityMap3D
          focusAmbulanceId={activeAmbulanceId}
          realGpsCoords={useRealGps ? deviceGpsCoords : null}
        />

        {/* TURN-BY-TURN GOOGLE MAPS STYLE HUD (En Route / Relocating) */}
        <AnimatePresence>
        {currentAmbulance?.active_route?.route_coordinates &&
          currentAmbulance.active_route.route_coordinates.length > 1 &&
          (currentAmbulance.status === 'EN_ROUTE_TO_PATIENT' ||
            currentAmbulance.status === 'EN_ROUTE_TO_HOSPITAL' ||
            currentAmbulance.status === 'RELOCATING_TO_SAFETY' ||
            (currentAmbulance.route_progress || 0) > 0) && (
            <motion.div 
              initial={{ y: -20, opacity: 0, x: "-50%" }}
              animate={{ y: 0, opacity: 1, x: "-50%" }}
              exit={{ y: -20, opacity: 0, x: "-50%" }}
              className={`absolute left-1/2 w-full max-w-xl px-4 z-20 pointer-events-auto transition-all ${
                useRealGps ? 'top-32' : 'top-4'
              }`}
            >
              <GoogleMapsNavHUD
                activeRoute={currentAmbulance.active_route.route_coordinates}
                routeProgress={currentAmbulance.route_progress || 0}
                destinationName={
                  currentAmbulance.status === 'EN_ROUTE_TO_PATIENT'
                    ? (currentIncident ? `Patient Scene (${currentIncident.severity})` : 'Patient Location')
                    : currentAmbulance.status === 'EN_ROUTE_TO_HOSPITAL'
                    ? (currentAmbulance.target_hospital_name || 'Hospital Trauma Unit')
                    : currentAmbulance.status === 'RELOCATING_TO_SAFETY'
                    ? (currentAmbulance.safe_staging_name || 'Elevated Safe Staging Hub')
                    : 'Designated Target'
                }
                speedKmh={currentAmbulance.speed_kmh}
                status={currentAmbulance.status}
                isTrapped={currentAmbulance.is_trapped || currentAmbulance.status === 'TRAPPED_IN_FLOOD'}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* FLOATING NAVIGATION CARD AT BOTTOM */}
        <motion.div 
          initial={{ y: 100, opacity: 0, x: "-50%" }}
          animate={{ y: 0, opacity: 1, x: "-50%" }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
          className="absolute bottom-6 left-1/2 w-full max-w-xl px-4 z-20 pointer-events-none"
        >
          <motion.div whileHover={{ y: -2 }} className="glass-panel p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] shadow-2xl border border-white/60 pointer-events-auto bg-white/85 backdrop-blur-2xl max-h-[55vh] overflow-y-auto">
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

            {/* STATE: TRAPPED IN FLOODWATERS (Scenario 2B) */}
            {currentAmbulance?.status === 'TRAPPED_IN_FLOOD' && (
              <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="p-4 bg-red-100 rounded-2xl border-2 border-red-500 text-center space-y-2">
                  <div className="w-12 h-12 mx-auto bg-red-600 text-white rounded-2xl flex items-center justify-center text-2xl animate-bounce shadow-lg">
                    🆘
                  </div>
                  <div>
                    <h3 className="text-base font-black text-red-900 tracking-tight">
                      VEHICLE TRAPPED IN FLOODWATERS
                    </h3>
                    <p className="text-xs text-red-700 font-semibold mt-1">
                      CRITICAL MAYDAY: Water depth exceeded clearance limit. Engine stalled / road submerged.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-xs space-y-2">
                  <div className="flex justify-between items-center text-red-900 font-bold">
                    <span>Engine & Navigation:</span>
                    <span className="text-red-700 uppercase">IMMOBILISED (STALLED)</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Patients Onboard:</span>
                    <span className="font-bold text-slate-900">👥 {currentAmbulance.patients_onboard || 0} / 2</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>GPS Coordinates:</span>
                    <span className="font-mono text-[11px] text-slate-800">
                      [{currentAmbulance.current_location[1].toFixed(4)}, {currentAmbulance.current_location[0].toFixed(4)}]
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-white rounded-xl border border-red-300 text-xs text-red-800 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                  <span className="leading-snug">
                    Mayday transmitted to Central Dispatch. Ground navigation halted. Standby for SDRF / NDRF watercraft rescue.
                  </span>
                </div>
              </div>
            )}

            {/* STATE: RELOCATING TO SAFETY (Scenario 4) */}
            {currentAmbulance?.status === 'RELOCATING_TO_SAFETY' && (
              <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-amber-600" />
                    <div>
                      <span className="text-[10px] uppercase font-bold text-amber-600">Proactive Fleet Safety</span>
                      <h4 className="font-black text-slate-900 text-sm">Autonomous Flood Relocation</h4>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-black text-amber-600">
                      {currentAmbulance.eta_minutes.toFixed(1)}m
                    </span>
                    <span className="text-[10px] block text-slate-400 font-bold">
                      {currentAmbulance.active_route?.distance_km} km
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 space-y-1.5 text-xs">
                  <div className="text-[11px] text-amber-950 font-semibold flex items-center gap-1.5">
                    <span>🛡️</span>
                    <span>Encroaching floodwaters detected near staging post. Autonomously relocating to safe high-ground base before cutoff.</span>
                  </div>
                  <div className="text-slate-600 text-[11px] flex justify-between pt-1 border-t border-amber-200/60">
                    <span>Target Safe Staging:</span>
                    <strong className="text-amber-900">{currentAmbulance.safe_staging_name || 'High Ground Safe Core'}</strong>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase">
                    <span>Relocation Progress</span>
                    <span>{((currentAmbulance.route_progress || 0) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all duration-300"
                      style={{ width: `${((currentAmbulance.route_progress || 0) * 100).toFixed(0)}%` }}
                    />
                  </div>
                </div>
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

                {/* Scenario 5: Hospital Divert Alert Banner */}
                {currentAmbulance.diverted_hospital && (
                  <div className="p-3 bg-amber-50 rounded-2xl border border-amber-300 text-xs text-amber-950 flex items-start gap-2 shadow-xs animate-pulse">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-amber-900 font-black">🚨 HOSPITAL DIVERT ACTIVE</strong>
                      <span className="text-[11px] text-amber-800 leading-snug">
                        Original facility was surrounded by rising floodwaters. Central Dispatch dynamically rerouted your vehicle to {currentAmbulance.target_hospital_name}.
                      </span>
                    </div>
                  </div>
                )}

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
          </motion.div>
        </motion.div>
      </main>

      {/* TACTICAL PUSH-TO-TALK WEBRTC RADIO */}
      <TacticalRadioHUD
        userRole="AMBULANCE"
        callsign={currentAmbulance?.ambulance_id || 'AMB-01'}
      />

      {/* CITIZEN SOS BOT & INCOMING DISTRESS FEED MODAL */}
      <CitizenSOSModal
        isOpen={showCitizenSOS}
        onClose={() => setShowCitizenSOS(false)}
        recentMessages={state?.recent_sos_messages}
      />
    </div>
  );
};
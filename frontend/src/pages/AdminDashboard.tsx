import { useEffect, useRef, useState } from 'react';
import { useSimulation } from '../context/SimulationContext';
import { CityMap3D } from '../components/map/CityMap3D';
import { DetailDrawer } from '../components/admin/DetailDrawer';
import { FleetManagementModal } from '../components/admin/FleetManagementModal';
import { useAuth } from '../context/AuthContext';
import { CreateEmergencyModal } from '../components/admin/CreateEmergencyModal';
import { AssumptionsModal } from '../components/admin/AssumptionsModal';
import type { SeverityLevel, SimEvent } from '../types/simulation';
import { motion } from 'framer-motion';
import {
  Play,
  Pause,
  FastForward,
  RotateCcw,
  Sparkles,
  HelpCircle,
  PlusCircle,
  Activity,
  TrendingUp,
  Tent,
  Shield,
  Ambulance as AmbulanceIcon,
  LogOut,
  AlertTriangle,
  X,
  MessageSquare,
  ShieldAlert,
  LifeBuoy,
} from 'lucide-react';
import { MeshRelayHUD } from '../components/emergency/MeshRelayHUD';
import { TacticalRadioHUD } from '../components/emergency/TacticalRadioHUD';
import { CitizenSOSModal } from '../components/emergency/CitizenSOSModal';
import { CitizenPortalModal } from '../components/emergency/CitizenPortalModal';
import { EvacuationBroadcastModal } from '../components/emergency/EvacuationBroadcastModal';
import { EvacuationAlertBanner } from '../components/emergency/EvacuationAlertBanner';
import { meshNetwork } from '../utils/meshNetwork';

interface AdminDashboardProps {
  activeTab?: 'admin' | 'ambulance';
  onSwitchTab?: (tab: 'admin' | 'ambulance') => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ activeTab = 'admin', onSwitchTab }) => {
  const {
    state,
    startSimulation,
    pauseSimulation,
    stepSimulation,
    resetSimulation,
    setSpeed,
    setScenario,
    loadDemoScenario,
    createIncident,
    deployMedicalCamp,
  } = useSimulation();

  const [isCreateMode, setIsCreateMode] = useState(false);
  const [clickCoords, setClickCoords] = useState<[number, number] | null>(null);
  const [selectedObject, setSelectedObject] = useState<{ type: any; data: any } | null>(null);
  const [showAssumptions, setShowAssumptions] = useState(false);
  const [showFleetModal, setShowFleetModal] = useState(false);
  const [showCitizenSOS, setShowCitizenSOS] = useState(false);
  const [showCitizenPortal, setShowCitizenPortal] = useState(false);
  const [showEvacModal, setShowEvacModal] = useState(false);
  const [floodRescueAlert, setFloodRescueAlert] = useState<SimEvent | null>(null);
  const lastFloodAlertKey = useRef<string | null>(null);
  const { adminUser, logoutAdmin } = useAuth();

  useEffect(() => {
    meshNetwork.registerLocalTab('HQ_RELAY', 'Admin Command HQ', 'WebRTC P2P');
  }, []);

  useEffect(() => {
    const submergedEvent = state?.events.find(
      (event) => event.type === 'critical' && /(?:is )?submerged (?:in floodwaters|under)/i.test(event.message),
    );
    if (!submergedEvent) return;

    const alertKey = `${submergedEvent.id}:${submergedEvent.message}`;
    if (lastFloodAlertKey.current === alertKey) return;

    lastFloodAlertKey.current = alertKey;
    setFloodRescueAlert(submergedEvent);
  }, [state?.events]);

  const handleMapClickForEmergency = (coords: [number, number]) => {
    setClickCoords(coords);
  };

  const handleCreateSubmit = async (severity: SeverityLevel, patientCount: number) => {
    if (clickCoords) {
      await createIncident(clickCoords[0], clickCoords[1], severity, patientCount);
      setClickCoords(null);
      setIsCreateMode(false);
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden flex flex-col bg-slate-50 select-none font-sans">
      {/* 1. TOP HEADER & SIMULATION CONTROLS */}
      <motion.header 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="h-16 px-4 bg-white/90 backdrop-blur-2xl border-b border-white flex items-center justify-between z-30 shadow-xs gap-2 shrink-0 overflow-x-auto no-scrollbar"
      >
        {/* Left: Brand & Challenge */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-sm shadow-md">
            HC
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-slate-900 text-sm tracking-tight">HC-05</h1>
              <span className="text-[11px] font-bold px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200/60 rounded-full">
                IFRC Flood Response
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              Climate-Aware Emergency Response Network â€¢ Pune Grid
            </p>
          </div>
        </div>

        {/* Center: Scenario & Timeline Status */}
        <div className="flex items-center gap-4">
          {/* Scenario Selector */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/60">
            {['NORMAL', 'MODERATE FLOOD', 'SEVERE FLOOD'].map((sc) => (
              <button
                key={sc}
                onClick={() => setScenario(sc)}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                  state?.scenario_name === sc
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {sc}
              </button>
            ))}
          </div>

          {/* Time & Simulation Status */}
          <div className="flex items-center gap-3 px-3.5 py-1.5 bg-slate-100/80 rounded-xl border border-slate-200/60">
            <div className="text-right">
              <span className="block text-[10px] uppercase font-bold text-slate-400">Time</span>
              <span className="text-xs font-bold text-slate-800">
                {state?.simulation_time_str || 'Day 1 â€¢ 14:00'}
              </span>
            </div>
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                state?.is_running ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <span className="text-xs font-bold text-slate-700">
              {state?.is_running ? 'SIMULATING' : 'PAUSED'}
            </span>
          </div>

          {/* Playback Controls */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-xs">
            {state?.is_running ? (
              <button
                onClick={pauseSimulation}
                className="p-1.5 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                title="Pause Simulation"
              >
                <Pause className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={startSimulation}
                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                title="Start Simulation"
              >
                <Play className="w-4 h-4 fill-emerald-600" />
              </button>
            )}

            <button
              onClick={stepSimulation}
              className="p-1.5 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              title="Step +10 Minutes Forward"
            >
              <FastForward className="w-4 h-4" />
            </button>

            <button
              onClick={resetSimulation}
              className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
              title="Reset Simulation"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Speeds */}
            <div className="flex items-center pl-1 border-l border-slate-200 gap-0.5">
              {[1, 2, 4].map((spd) => (
                <button
                  key={spd}
                  onClick={() => setSpeed(spd)}
                  className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                    state?.sim_speed === spd
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Actions, Demo Button, Assumptions, and Dashboard Switcher */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setIsCreateMode(!isCreateMode)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl font-bold text-xs transition-all ${
              isCreateMode
                ? 'bg-amber-500 text-white shadow-md ring-2 ring-amber-300'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>{isCreateMode ? 'Click Map' : 'Report'}</span>
          </button>

          <button
            onClick={loadDemoScenario}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-xs transition-all"
            title="Load Pre-Seeded Hackathon Demo Scenario"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Demo</span>
          </button>

          <button
            onClick={() => setShowFleetModal(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer"
            title="Manage Fleet, Commission/Decommission Vehicles and View Driver Logins"
          >
            <AmbulanceIcon className="w-3.5 h-3.5 text-indigo-600" />
            <span>Fleet ({state?.ambulances?.length || 0})</span>
          </button>

          <div className="h-5 w-px bg-slate-200 mx-0.5" />

          <MeshRelayHUD />

          <button
            onClick={() => setShowCitizenSOS(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer"
            title="Incoming WhatsApp & Telegram Citizen SOS Stream"
          >
            <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
            <span>SOS Bot</span>
            {(state?.recent_sos_messages?.length ?? 0) > 0 && (
              <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[9px] font-black flex items-center justify-center">
                {state?.recent_sos_messages?.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setShowEvacModal(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer"
            title="Dispatch Geo-Fenced Reverse-911 Evacuation Warning"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
            <span>Evacuation</span>
          </button>

          <button
            onClick={() => window.open('/sos', '_blank')}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200/80 rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer"
            title="Open Pre-Cached Citizen Offline SOS Portal (/sos) in New Window"
          >
            <LifeBuoy className="w-3.5 h-3.5 text-sky-600" />
            <span>Citizen SOS (/sos)</span>
          </button>

          <button
            onClick={() => setShowAssumptions(true)}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
            title="View Simulation Assumptions"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>

          {/* Admin Profile & Logout */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-lg text-xs font-bold text-slate-700">
              <Shield className="w-3.5 h-3.5 text-blue-600" />
              <span>{adminUser?.name || 'Lead Dispatcher'}</span>
            </div>
            <button
              onClick={() => {
                logoutAdmin();
                window.location.href = '/admin/login';
              }}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              title="Sign Out of Admin Console"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* Integrated Portal Switcher Pill */}
          {onSwitchTab && (
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 ml-1">
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
      </motion.header>

      {/* Emergency Evacuation Broadcast Alert Banner */}
      <EvacuationAlertBanner evacuations={state?.active_evacuations} isAdmin={true} />

      {/* 2. MAIN 3D MAP CANVAS */}
      <main className="flex-1 relative w-full h-full">
        <CityMap3D
          isCreateMode={isCreateMode}
          onMapClickForEmergency={handleMapClickForEmergency}
          onSelectObject={(type, data) => setSelectedObject({ type, data })}
        />

        {/* Floating Incident Creation Prompt Banner */}
        {isCreateMode && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-4 py-2 bg-amber-500 text-white rounded-full shadow-2xl animate-pulse border-2 border-white">
            <span className="text-sm">ðŸŽ¯</span>
            <span className="text-xs font-bold tracking-wide">CLICK ANYWHERE ON THE MAP TO REPORT EMERGENCY</span>
            <button
              onClick={() => setIsCreateMode(false)}
              className="text-xs font-bold bg-black/20 hover:bg-black/30 px-2.5 py-0.5 rounded-full transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {/* FLOATING LEFT METRICS PANEL */}
        <motion.div 
          initial={{ x: -100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
          className="absolute top-20 left-4 flex flex-col gap-4 z-20 pointer-events-none max-h-[calc(100vh-140px)] overflow-y-auto no-scrollbar pb-8 hidden md:flex"
        >
          {/* Flood Status Card */}
          <motion.div whileHover={{ scale: 1.02 }} className="w-80 glass-panel p-5 pointer-events-auto">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Flood Hazard Status
              </span>
              <span className="text-xs font-bold text-blue-600 flex items-center gap-1">
                <span>ðŸŒŠ</span>
                <span>+{state?.water_rise_m.toFixed(2) || '0.00'}m</span>
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-blue-50/60 rounded-xl border border-blue-100">
                <span className="text-slate-500 block text-[10px] font-medium">Mula-Mutha Basin</span>
                <span className="font-bold text-blue-900 text-sm">
                  {state?.water_rise_m && state.water_rise_m > 1.5 ? 'Severe Surge' : 'Active Swell'}
                </span>
              </div>
              <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-500 block text-[10px] font-medium">Disaster Phase</span>
                <span className="font-bold text-slate-800 text-sm">
                  T+{state?.simulation_time_minutes.toFixed(0) || 0}m
                </span>
              </div>
            </div>
          </motion.div>

          {/* Road Network State Card */}
          <motion.div whileHover={{ scale: 1.02 }} className="w-80 glass-panel p-5 pointer-events-auto">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
              Road Accessibility Network
            </span>
            <div className="grid grid-cols-4 gap-1.5 text-center">
              <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-100">
                <span className="block text-[10px] font-bold text-emerald-800">OPEN</span>
                <span className="font-extrabold text-emerald-900 text-sm">
                  {state?.network_stats.open_roads ?? 0}
                </span>
              </div>
              <div className="p-2 bg-amber-50 rounded-xl border border-amber-100">
                <span className="block text-[10px] font-bold text-amber-800">RESTRICT</span>
                <span className="font-extrabold text-amber-900 text-sm">
                  {state?.network_stats.restricted_roads ?? 0}
                </span>
              </div>
              <div className="p-2 bg-orange-50 rounded-xl border border-orange-100">
                <span className="block text-[10px] font-bold text-orange-800">RISK</span>
                <span className="font-extrabold text-orange-900 text-sm">
                  {state?.network_stats.high_risk_roads ?? 0}
                </span>
              </div>
              <div className="p-2 bg-red-50 rounded-xl border border-red-100">
                <span className="block text-[10px] font-bold text-red-800">BLOCKED</span>
                <span className="font-extrabold text-red-900 text-sm">
                  {state?.network_stats.blocked_roads ?? 0}
                </span>
              </div>
            </div>
          </motion.div>

          {/* ML Emergency Demand Forecast Card */}
          <motion.div whileHover={{ scale: 1.02 }} className="w-80 glass-panel p-5 pointer-events-auto">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Predicted Demand (ML)
              </span>
              <TrendingUp className="w-4 h-4 text-purple-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">
                {state?.network_stats.total_demand ?? 32}
              </span>
              <span className="text-xs font-semibold text-purple-600">cases / interval</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              RandomForest inference updating continuously across 8 urban zones
            </p>
          </motion.div>
        </motion.div>

        {/* FLOATING RIGHT STATUS PANEL */}
        <motion.div 
          initial={{ x: 100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
          className="absolute top-20 right-4 lg:right-6 flex flex-col gap-4 z-20 pointer-events-none max-h-[calc(100vh-140px)] overflow-y-auto no-scrollbar pb-8 hidden lg:flex"
        >
          {/* Hospital Fleet Capacity */}
          <motion.div whileHover={{ scale: 1.02 }} className="w-80 lg:w-96 glass-panel p-5 pointer-events-auto">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Hospital Network Load
              </span>
              <span className="text-xs font-bold text-emerald-600">
                {state?.hospitals.reduce((acc, h) => acc + h.available_beds, 0)} Beds Free
              </span>
            </div>
            <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
              {state?.hospitals.slice(0, 4).map((h) => (
                <div
                  key={h.hospital_id}
                  onClick={() => setSelectedObject({ type: 'hospital', data: h })}
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-50 hover:bg-slate-100 cursor-pointer border border-slate-100 text-xs transition-colors"
                >
                  <div className="truncate max-w-[140px]">
                    <span className="font-bold text-slate-800 block truncate">{h.name}</span>
                    <span className="text-[10px] text-slate-400">ICU: {h.available_icu} available</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-bold text-slate-700">
                      {h.capacity_utilization}%
                    </span>
                    <div className="w-14 h-1.5 bg-slate-200 rounded-full mt-0.5 overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full"
                        style={{ width: `${h.capacity_utilization}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Active Emergencies Tracker */}
          <motion.div whileHover={{ scale: 1.02 }} className="w-80 lg:w-96 glass-panel p-5 pointer-events-auto">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Active Emergencies
              </span>
              <span className="text-xs font-bold text-red-600">
                {state?.incidents.filter((i) => i.status !== 'RESOLVED').length ?? 0} Active
              </span>
            </div>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {state?.incidents.filter((i) => i.status !== 'RESOLVED').length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-2">
                  No active incidents. Click 'Report Incident' or load demo.
                </p>
              ) : (
                state?.incidents
                  .filter((i) => i.status !== 'RESOLVED')
                  .map((inc) => {
                    const isSubmerged = inc.status === 'UNREACHABLE_FLOODED';
                    const isPredicted = inc.status === 'PREDICTED_FLOOD_SUBMERGENCE';
                    const isTrapped = inc.status === 'AMBULANCE_TRAPPED';
                    const badgeClass = isSubmerged ? 'bg-purple-100 text-purple-800 border-purple-200' :
                                       isPredicted ? 'bg-rose-100 text-rose-800 border-rose-200' :
                                       isTrapped ? 'bg-red-100 text-red-800 border-red-300 animate-pulse' :
                                       'bg-white text-slate-700 border-slate-200';
                    const badgeText = isSubmerged ? 'ðŸš¤ SUBMERGED (BOAT EVAC)' :
                                      isPredicted ? 'âš ï¸ FLOOD CUTOFF' :
                                      isTrapped ? 'ðŸ†˜ AMB TRAPPED' :
                                      (inc.assigned_ambulance_id || 'DISPATCHING');
                    return (
                      <div
                        key={inc.incident_id}
                        onClick={() => setSelectedObject({ type: 'incident', data: inc })}
                        className={`p-2 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition-colors ${
                          isSubmerged ? 'bg-purple-50/80 border-purple-200 hover:bg-purple-100/80' :
                          isPredicted ? 'bg-rose-50/80 border-rose-200 hover:bg-rose-100/80' :
                          'bg-red-50/70 border-red-100 hover:bg-red-100/70'
                        }`}
                      >
                        <div>
                          <span className={`font-bold ${isSubmerged ? 'text-purple-950' : 'text-red-900'}`}>{inc.incident_id}</span>
                          <span className={`text-[10px] ml-1.5 font-semibold ${isSubmerged ? 'text-purple-700' : 'text-red-600'}`}>
                            ({inc.severity}, {inc.patient_count}P)
                          </span>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeClass}`}>
                          {badgeText}
                        </span>
                      </div>
                    );
                  })
              )}
            </div>
          </motion.div>
        </motion.div>

        {/* BOTTOM FLOATING SYSTEM ACTIONS & EVENT STREAM */}
        <motion.div 
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
          className="absolute bottom-4 left-4 right-4 z-20 flex flex-col lg:flex-row gap-4 pointer-events-none"
        >
          {/* Action Recommendations Card */}
          <motion.div whileHover={{ y: -2 }} className="flex-1 glass-panel p-5 pointer-events-auto shadow-2xl">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>System Decision Recommendations</span>
              </span>
              <span className="text-[10px] text-slate-400">Pareto Multi-Criteria Optimization</span>
            </div>

            {state?.recommendations && state.recommendations.length > 0 ? (
              <div className="space-y-2">
                {state.recommendations.map((rec) => (
                  <div
                    key={rec.recommendation_id}
                    className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-between text-xs animate-pulse"
                  >
                    <div className="flex items-center gap-2 max-w-lg">
                      <span className="p-1.5 bg-amber-500 text-white rounded-lg">
                        <Tent className="w-4 h-4" />
                      </span>
                      <div>
                        <span className="font-bold text-amber-950 block">
                          CRITICAL MEDICAL GAP: {rec.zone_name}
                        </span>
                        <span className="text-[11px] text-amber-800 leading-snug">
                          {rec.reason}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => deployMedicalCamp(rec.zone_id)}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow hover:shadow-md transition-all whitespace-nowrap"
                    >
                      ðŸ•ï¸ {rec.action_label}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-between text-xs text-slate-500 py-1">
                <span>All zone healthcare corridors and emergency dispatches currently optimal.</span>
                <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                  <span>âœ“</span> No active gaps
                </span>
              </div>
            )}
          </motion.div>

          {/* Event Stream Card */}
          <motion.div whileHover={{ y: -2 }} className="w-full lg:w-[450px] glass-panel p-5 pointer-events-auto shadow-2xl">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-slate-700" />
                <span>Live Event Stream</span>
              </span>
              <span className="text-[10px] text-slate-400">Audit Log</span>
            </div>
            <div className="space-y-1.5 max-h-24 overflow-y-auto text-xs pr-1">
              {state?.events.slice(0, 5).map((evt) => (
                <div key={evt.id} className="flex items-start gap-2 text-[11px]">
                  <span className="font-mono text-[10px] text-slate-400 font-bold whitespace-nowrap">
                    {evt.time}
                  </span>
                  <span
                    className={`leading-tight ${
                      evt.type === 'critical'
                        ? 'text-red-600 font-bold'
                        : evt.type === 'alert'
                        ? 'text-amber-700 font-semibold'
                        : evt.type === 'warning'
                        ? 'text-orange-600'
                        : 'text-slate-700'
                    }`}
                  >
                    {evt.message}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </main>

      {/* 3. MODALS & DRAWERS */}
      {clickCoords && (
        <CreateEmergencyModal
          coords={clickCoords}
          onClose={() => setClickCoords(null)}
          onSubmit={handleCreateSubmit}
        />
      )}

      {selectedObject && (
        <DetailDrawer
          selectedObject={selectedObject}
          onClose={() => setSelectedObject(null)}
          onSwitchTab={onSwitchTab}
        />
      )}

      <FleetManagementModal isOpen={showFleetModal} onClose={() => setShowFleetModal(false)} />

      {showAssumptions && (
        <AssumptionsModal onClose={() => setShowAssumptions(false)} />
      )}

      {floodRescueAlert && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="flood-rescue-alert-title"
          aria-describedby="flood-rescue-alert-description"
        >
          <section className="w-full max-w-lg overflow-hidden rounded-2xl border border-red-200 bg-white shadow-2xl shadow-red-950/30">
            <div className="flex items-start gap-4 bg-red-700 px-6 py-5 text-white">
              <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
                <AlertTriangle className="h-6 w-6" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-red-100">
                  Critical flood rescue alert
                </p>
                <h2 id="flood-rescue-alert-title" className="mt-1 text-xl font-extrabold leading-tight">
                  Patient submerged in floodwater
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setFloodRescueAlert(null)}
                className="rounded-lg p-2 text-white/80 transition hover:bg-white/15 hover:text-white focus:outline-none focus:ring-2 focus:ring-white"
                aria-label="Dismiss flood rescue alert"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <p id="flood-rescue-alert-description" className="text-sm leading-relaxed text-slate-700">
                The incident scene is under actual floodwater before the ambulance could arrive. The patient is out of reach of the ground ambulance.
              </p>
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-sm font-extrabold uppercase tracking-wide text-red-800">
                  Call emergency and rescue services now
                </p>
                <p className="mt-1 text-sm leading-relaxed text-red-700">
                  Request an immediate water rescue, such as SDRF or boat extraction. Do not send the ambulance into floodwater.
                </p>
              </div>
              <p className="rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs leading-relaxed text-slate-600">
                {floodRescueAlert.message}
              </p>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setFloodRescueAlert(null)}
                  className="rounded-lg bg-red-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                >
                  Acknowledge alert
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* TACTICAL PUSH-TO-TALK WEBRTC RADIO */}
      <TacticalRadioHUD userRole="ADMIN" callsign="DISPATCH HQ" />

      {/* CITIZEN SOS BOT & INCOMING DISTRESS FEED MODAL */}
      <CitizenSOSModal
        isOpen={showCitizenSOS}
        onClose={() => setShowCitizenSOS(false)}
        recentMessages={state?.recent_sos_messages}
      />

      {/* PUBLIC CITIZEN FLOOD RESCUE PORTAL MODAL */}
      <CitizenPortalModal
        isOpen={showCitizenPortal}
        onClose={() => setShowCitizenPortal(false)}
      />

      {/* GEO-FENCED REVERSE-911 EVACUATION BROADCAST MODAL */}
      <EvacuationBroadcastModal
        isOpen={showEvacModal}
        onClose={() => setShowEvacModal(false)}
      />
    </div>
  );
};

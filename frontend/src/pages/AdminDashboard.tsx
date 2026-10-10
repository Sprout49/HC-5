import { useEffect, useRef, useState } from 'react';
import { useSimulation } from '../context/SimulationContext';
import { CityMap3D } from '../components/map/CityMap3D';
import { DetailDrawer } from '../components/admin/DetailDrawer';
import { FleetManagementModal } from '../components/admin/FleetManagementModal';
import { useAuth } from '../context/AuthContext';
import { CreateEmergencyModal } from '../components/admin/CreateEmergencyModal';
import { AssumptionsModal } from '../components/admin/AssumptionsModal';
import { TranetraLogo } from '../components/TranetraLogo';
import type { SeverityLevel, SimEvent } from '../types/simulation';
import { motion, AnimatePresence } from 'framer-motion';
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
  Layers,
  ChevronDown,
  Compass,
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

  const [isLogoMenuOpen, setIsLogoMenuOpen] = useState(false);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [clickCoords, setClickCoords] = useState<[number, number] | null>(null);
  const [selectedObject, setSelectedObject] = useState<{ type: any; data: any } | null>(null);
  const [showLeftMetrics, setShowLeftMetrics] = useState(true);
  const [showRightStatus, setShowRightStatus] = useState(true);
  const [showBottomStream, setShowBottomStream] = useState(true);
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
        className="min-h-[66px] sm:min-h-[74px] py-2 px-3 sm:px-5 bg-white/95 backdrop-blur-2xl border-b border-slate-200/80 flex items-center justify-between z-40 shadow-xs gap-2 sm:gap-4 shrink-0 overflow-visible"
      >
        {/* Left: Brand Logo & Interactive Dropdown Menu */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setIsLogoMenuOpen(!isLogoMenuOpen)}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-2xl hover:bg-sky-50/80 transition-all cursor-pointer border border-transparent hover:border-sky-200/80 group"
            title="Click to open TRÃNETRA Command Menu"
          >
            <TranetraLogo size="sm" showText={false} className="shrink-0 group-hover:scale-105 transition-transform" />
            <div className="flex flex-col text-left">
              <div className="flex items-center gap-1.5">
                <h1 className="font-black text-slate-900 text-sm sm:text-base tracking-tight leading-none">TRÃNETRA</h1>
                <span className="text-[9px] sm:text-[10px] font-bold px-2 py-0.5 bg-sky-50 text-sky-700 border border-sky-200/80 rounded-full leading-normal">
                  HC-05
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-sky-600 transition-transform duration-200 ${isLogoMenuOpen ? 'rotate-180' : ''}`} />
              </div>
              <p className="text-[10px] text-slate-500 font-medium whitespace-nowrap mt-0.5 leading-none hidden sm:block">
                Emergency Command
              </p>
            </div>
          </button>

          {/* Interactive Logo Flyout Menu */}
          <AnimatePresence>
            {isLogoMenuOpen && (
              <>
                {/* Backdrop overlay */}
                <div className="fixed inset-0 z-40" onClick={() => setIsLogoMenuOpen(false)} />

                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="fixed top-[72px] left-4 z-50 w-80 sm:w-96 bg-white/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-sky-100/90 p-4 flex flex-col gap-3 max-h-[85vh] overflow-y-auto"
                >
                  {/* Brand Header */}
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <TranetraLogo size="sm" showText={false} />
                      <div>
                        <div className="font-black text-sm text-slate-900">TRÃNETRA Command Menu</div>
                        <div className="text-[10px] text-slate-500 font-medium">Climate-Aware Emergency Network</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsLogoMenuOpen(false)}
                      className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Reference Image Menu Items Section */}
                  <div className="flex flex-col gap-2 pt-1">
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-1">
                      Emergency Actions & Mesh
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <MeshRelayHUD />

                      <button
                        onClick={() => {
                          setShowCitizenSOS(true);
                          setIsLogoMenuOpen(false);
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer"
                        title="Incoming WhatsApp & Telegram Citizen SOS Stream"
                      >
                        <MessageSquare className="w-4 h-4 text-emerald-600" />
                        <span>SOS Bot</span>
                        {(state?.recent_sos_messages?.length ?? 0) > 0 && (
                          <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[9px] font-black flex items-center justify-center">
                            {state?.recent_sos_messages?.length}
                          </span>
                        )}
                      </button>

                      <button
                        onClick={() => {
                          setShowEvacModal(true);
                          setIsLogoMenuOpen(false);
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer"
                        title="Dispatch Geo-Fenced Reverse-911 Evacuation Warning"
                      >
                        <ShieldAlert className="w-4 h-4 text-rose-600" />
                        <span>Evacuation</span>
                      </button>

                      <button
                        onClick={() => {
                          window.open('/sos', '_blank');
                          setIsLogoMenuOpen(false);
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200/80 rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer"
                        title="Open Pre-Cached Citizen Offline SOS Portal (/sos) in New Window"
                      >
                        <LifeBuoy className="w-4 h-4 text-sky-600" />
                        <span>Citizen SOS (/sos)</span>
                      </button>

                      <button
                        onClick={() => {
                          setShowAssumptions(true);
                          setIsLogoMenuOpen(false);
                        }}
                        className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer border border-slate-200/60"
                        title="View Simulation Assumptions"
                      >
                        <HelpCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Dispatcher Session & Portal Switcher */}
                  <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-1">
                      Session & Portal Switcher
                    </div>

                    <div className="flex items-center justify-between gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg text-xs font-bold text-slate-700 border border-slate-200/80 shadow-2xs">
                          <Shield className="w-3.5 h-3.5 text-blue-600" />
                          <span>{adminUser?.name || 'Central Command Lead'}</span>
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

                      {onSwitchTab && (
                        <div className="flex items-center bg-white p-0.5 rounded-lg border border-slate-200">
                          <button
                            onClick={() => {
                              onSwitchTab('admin');
                              setIsLogoMenuOpen(false);
                            }}
                            className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                              activeTab === 'admin'
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            Admin
                          </button>
                          <button
                            onClick={() => {
                              onSwitchTab('ambulance');
                              setIsLogoMenuOpen(false);
                            }}
                            className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                              activeTab === 'ambulance'
                                ? 'bg-slate-900 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            Ambulance
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Center: Scenario & Timeline Status */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Scenario Selector */}
          <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-2xl border border-slate-200/70">
            {['NORMAL', 'MODERATE FLOOD', 'SEVERE FLOOD'].map((sc) => (
              <button
                key={sc}
                onClick={() => setScenario(sc)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                  state?.scenario_name === sc
                    ? 'bg-white text-blue-700 shadow-xs border border-slate-200/50'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {sc}
              </button>
            ))}
          </div>

          {/* Time & Simulation Status */}
          <div className="flex items-center gap-3 px-3.5 py-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/70">
            <div className="flex flex-col">
              <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider leading-none">Sim Clock</span>
              <span className="text-xs font-bold font-mono text-slate-800 leading-tight mt-0.5 whitespace-nowrap">
                {state?.simulation_time_str || 'Day 1 • 14:00'}
              </span>
            </div>
            <div className="h-6 w-px bg-slate-200" />
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  state?.is_running ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
              />
              <span className="text-xs font-bold text-slate-700 whitespace-nowrap">
                {state?.is_running ? 'SIMULATING' : 'PAUSED'}
              </span>
            </div>
          </div>

          {/* Playback Controls */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-slate-200/90 shadow-xs">
            {state?.is_running ? (
              <button
                onClick={pauseSimulation}
                className="p-2 text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                title="Pause Simulation"
              >
                <Pause className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={startSimulation}
                className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors cursor-pointer"
                title="Start Simulation"
              >
                <Play className="w-4 h-4 fill-emerald-600" />
              </button>
            )}

            <button
              onClick={stepSimulation}
              className="p-2 text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              title="Step +10 Minutes Forward"
            >
              <FastForward className="w-4 h-4" />
            </button>

            <button
              onClick={resetSimulation}
              className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              title="Reset Simulation"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Speeds */}
            <div className="flex items-center pl-1.5 border-l border-slate-200 gap-1">
              {[1, 2, 4].map((spd) => (
                <button
                  key={spd}
                  onClick={() => setSpeed(spd)}
                  className={`px-2 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                    state?.sim_speed === spd
                      ? 'bg-blue-600 text-white shadow-xs'
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
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsCreateMode(!isCreateMode)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs transition-all whitespace-nowrap cursor-pointer ${
              isCreateMode
                ? 'bg-amber-500 text-white shadow-md ring-2 ring-amber-300'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/60'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>{isCreateMode ? 'Click Map' : 'Report'}</span>
          </button>

          <button
            onClick={loadDemoScenario}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-xs transition-all whitespace-nowrap cursor-pointer"
            title="Load Pre-Seeded Hackathon Demo Scenario"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Demo</span>
          </button>

          <button
            onClick={() => setShowFleetModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 rounded-xl font-bold text-xs shadow-xs transition-all whitespace-nowrap cursor-pointer"
            title="Manage Fleet, Commission/Decommission Vehicles and View Driver Logins"
          >
            <AmbulanceIcon className="w-4 h-4 text-indigo-600" />
            <span>Fleet ({state?.ambulances?.length || 0})</span>
          </button>

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
          renderTopRightControls={({ is3D, toggle2D3D, resetCamera }) => (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowLeftMetrics(!showLeftMetrics)}
                className={`flex items-center gap-1.5 px-3 py-1.5 backdrop-blur-md rounded-lg border text-xs font-semibold shadow transition-all cursor-pointer ${
                  showLeftMetrics
                    ? 'bg-blue-600 text-white border-blue-600 shadow-blue-500/20'
                    : 'bg-white/90 hover:bg-white text-slate-700 border-slate-200'
                }`}
                title="Toggle Flood Hazard & Road Accessibility Metrics"
              >
                <Layers className="w-4 h-4 text-blue-600" />
                <span>Metrics</span>
              </button>

              <button
                onClick={() => setShowRightStatus(!showRightStatus)}
                className={`flex items-center gap-1.5 px-3 py-1.5 backdrop-blur-md rounded-lg border text-xs font-semibold shadow transition-all cursor-pointer ${
                  showRightStatus
                    ? 'bg-blue-600 text-white border-blue-600 shadow-blue-500/20'
                    : 'bg-white/90 hover:bg-white text-slate-700 border-slate-200'
                }`}
                title="Toggle Hospitals & Active Incident Triage"
              >
                <Activity className="w-4 h-4 text-emerald-600" />
                <span>Triage</span>
              </button>

              <button
                onClick={() => setShowBottomStream(!showBottomStream)}
                className={`flex items-center gap-1.5 px-3 py-1.5 backdrop-blur-md rounded-lg border text-xs font-semibold shadow transition-all cursor-pointer ${
                  showBottomStream
                    ? 'bg-blue-600 text-white border-blue-600 shadow-blue-500/20'
                    : 'bg-white/90 hover:bg-white text-slate-700 border-slate-200'
                }`}
                title="Toggle System Recommendations & Live Audit Stream"
              >
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Ops Stream</span>
              </button>

              <button
                onClick={toggle2D3D}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/90 backdrop-blur-md rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 shadow hover:bg-white transition-colors cursor-pointer"
                title="Toggle 2D / 3D Isometric View"
              >
                <Layers className="w-4 h-4 text-blue-600" />
                <span>{is3D ? '3D Isometric' : '2D Top-Down'}</span>
              </button>

              <button
                onClick={resetCamera}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/90 backdrop-blur-md rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 shadow hover:bg-white transition-colors cursor-pointer"
                title="Reset Camera View to Pune Center"
              >
                <Compass className="w-4 h-4 text-slate-600" />
                <span>Reset Camera</span>
              </button>
            </div>
          )}
        />

        {/* Floating Incident Creation Prompt Banner */}
        {isCreateMode && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-4 py-2 bg-amber-500 text-white rounded-full shadow-2xl animate-pulse border-2 border-white">
            <span className="text-sm">🎯</span>
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
        <AnimatePresence>
        {showLeftMetrics && (
          <motion.div 
            initial={{ x: -100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -100, opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="absolute top-16 sm:top-20 left-4 flex flex-col gap-3 sm:gap-4 z-20 pointer-events-none max-h-[calc(100vh-150px)] overflow-y-auto no-scrollbar pb-8 max-w-[90vw] sm:max-w-xs"
          >
          {/* Flood Status Card */}
          <motion.div whileHover={{ scale: 1.02 }} className="w-80 glass-panel p-5 pointer-events-auto">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Flood Hazard Status
              </span>
              <span className="text-xs font-bold text-blue-600 flex items-center gap-1">
                <span>🌊</span>
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
        )}
        </AnimatePresence>

        {/* FLOATING RIGHT STATUS PANEL */}
        <AnimatePresence>
        {showRightStatus && (
          <motion.div 
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 100, opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="absolute top-16 sm:top-20 right-4 lg:right-6 flex flex-col gap-3 sm:gap-4 z-20 pointer-events-none max-h-[calc(100vh-150px)] overflow-y-auto no-scrollbar pb-8 max-w-[90vw] sm:max-w-sm"
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
                    const badgeText = isSubmerged ? '🚤 SUBMERGED (BOAT EVAC)' :
                                      isPredicted ? '⚠️ FLOOD CUTOFF' :
                                      isTrapped ? '🆘 AMB TRAPPED' :
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
        )}
        </AnimatePresence>

        {/* BOTTOM FLOATING SYSTEM ACTIONS & EVENT STREAM */}
        <AnimatePresence>
        {showBottomStream && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="absolute bottom-4 left-4 right-4 z-20 flex flex-col lg:flex-row gap-3 pointer-events-none max-h-[45vh] lg:max-h-[30vh] overflow-y-auto no-scrollbar"
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
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow hover:shadow-md transition-all whitespace-nowrap flex items-center gap-1.5"
                    >
                      <Tent className="w-4 h-4" />
                      <span>{rec.action_label}</span>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-between text-xs text-slate-500 py-1">
                <span>All zone healthcare corridors and emergency dispatches currently optimal.</span>
                <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                  <span>✓</span> No active gaps
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
        )}
        </AnimatePresence>
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

import { useState } from 'react';
import { useSimulation } from '../context/SimulationContext';
import { CityMap3D } from '../components/map/CityMap3D';
import { DetailDrawer } from '../components/admin/DetailDrawer';
import { FleetManagementModal } from '../components/admin/FleetManagementModal';
import { useAuth } from '../context/AuthContext';
import { CreateEmergencyModal } from '../components/admin/CreateEmergencyModal';
import { AssumptionsModal } from '../components/admin/AssumptionsModal';
import type { SeverityLevel } from '../types/simulation';
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
} from 'lucide-react';

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
  const { adminUser, logoutAdmin } = useAuth();

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
    <div className="relative w-screen h-screen overflow-hidden flex flex-col bg-slate-50 select-none">
      {/* 1. TOP HEADER & SIMULATION CONTROLS */}
      <header className="h-16 px-6 bg-white/95 backdrop-blur-md border-b border-slate-200/90 flex items-center justify-between z-30 shadow-xs">
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
              Climate-Aware Emergency Response Network • Pune Grid
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
                {state?.simulation_time_str || 'Day 1 • 14:00'}
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCreateMode(!isCreateMode)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
              isCreateMode
                ? 'bg-amber-500 text-white shadow-md ring-2 ring-amber-300'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>{isCreateMode ? 'Click Map...' : 'Report Incident'}</span>
          </button>

          <button
            onClick={loadDemoScenario}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md hover:shadow-lg transition-all"
            title="Load Pre-Seeded Hackathon Demo Scenario"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>LOAD DEMO SCENARIO</span>
          </button>

          <button
            onClick={() => setShowFleetModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer"
            title="Manage Fleet, Commission/Decommission Vehicles and View Driver Logins"
          >
            <AmbulanceIcon className="w-4 h-4 text-indigo-600" />
            <span>Fleet ({state?.ambulances?.length || 0})</span>
          </button>

          <button
            onClick={() => setShowAssumptions(true)}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
            title="View Simulation Assumptions"
          >
            <HelpCircle className="w-4 h-4" />
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
      </header>

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
        <div className="absolute top-4 left-4 flex flex-col gap-3 z-20 pointer-events-none">
          {/* Flood Status Card */}
          <div className="w-72 glass-panel p-4 rounded-2xl pointer-events-auto">
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
          </div>

          {/* Road Network State Card */}
          <div className="w-72 glass-panel p-4 rounded-2xl pointer-events-auto">
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
          </div>

          {/* ML Emergency Demand Forecast Card */}
          <div className="w-72 glass-panel p-4 rounded-2xl pointer-events-auto">
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
          </div>
        </div>

        {/* FLOATING RIGHT STATUS PANEL */}
        <div className="absolute top-4 right-16 flex flex-col gap-3 z-20 pointer-events-none">
          {/* Hospital Fleet Capacity */}
          <div className="w-80 glass-panel p-4 rounded-2xl pointer-events-auto">
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
          </div>

          {/* Active Emergencies Tracker */}
          <div className="w-80 glass-panel p-4 rounded-2xl pointer-events-auto">
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
          </div>
        </div>

        {/* BOTTOM FLOATING SYSTEM ACTIONS & EVENT STREAM */}
        <div className="absolute bottom-4 left-4 right-4 z-20 flex gap-4 pointer-events-none">
          {/* Action Recommendations Card */}
          <div className="flex-1 glass-panel p-3.5 rounded-2xl pointer-events-auto shadow-xl">
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
                      🏕️ {rec.action_label}
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
          </div>

          {/* Event Stream Card */}
          <div className="w-96 glass-panel p-3.5 rounded-2xl pointer-events-auto shadow-xl">
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
          </div>
        </div>
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
    </div>
  );
};
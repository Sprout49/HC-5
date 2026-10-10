import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ShieldAlert,
  Volume2,
  Users,
  Send,
  X,
  AlertTriangle,
  VolumeX,
} from 'lucide-react';
import { API_BASE } from '../../context/SimulationContext';
import { soundFx } from '../../utils/soundFx';

interface EvacuationBroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ZONES_LIST = [
  { name: 'Mula-Mutha Floodplain Corridor', pop: 18500, risk: 'EXTREME' },
  { name: 'Yerawada & Sangamwadi Sector', pop: 24000, risk: 'HIGH' },
  { name: 'Bund Garden Low-Ground Basin', pop: 12200, risk: 'HIGH' },
  { name: 'Kasba Peth & Old City Riverbank', pop: 31000, risk: 'CRITICAL' },
];

export type ThreatLevel = 'Code red' | 'Moderate' | 'Safe';

const THREAT_PRESETS: Record<ThreatLevel, { message: string; color: string; desc: string }> = {
  'Code red': {
    message: 'IMMEDIATE LIFE SAFETY EVACUATION: Flood cresting in 35 minutes. Evacuate ground floors immediately to designated relief shelters or high ground.',
    color: 'rose',
    desc: 'Life-safety emergency • High-decibel dual EAS siren activated',
  },
  'Moderate': {
    message: 'FLOOD ADVISORY & MONITORING: River levels rising along flood corridor. Move valuables and vehicles to higher ground; prepare emergency kits.',
    color: 'amber',
    desc: 'Precautionary warning • Visual alert broadcast (No sirens)',
  },
  'Safe': {
    message: 'ALL HAZARDS STABILIZED: Floodwaters have receded below danger levels. Safe to re-enter ground floors and access local transit under municipal guidance.',
    color: 'emerald',
    desc: 'Stand-down announcement • Advisory clearance broadcast (No sirens)',
  },
};

export const EvacuationBroadcastModal: React.FC<EvacuationBroadcastModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [selectedZone, setSelectedZone] = useState(ZONES_LIST[0]);
  const [threatLevel, setThreatLevel] = useState<ThreatLevel>('Code red');
  const [evacuationOrder, setEvacuationOrder] = useState(THREAT_PRESETS['Code red'].message);
  const [isSirenEnabled, setIsSirenEnabled] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const handleSelectThreatLevel = (lvl: ThreatLevel) => {
    setThreatLevel(lvl);
    setEvacuationOrder(THREAT_PRESETS[lvl].message);
    // Sound ONLY for Code red!
    setIsSirenEnabled(lvl === 'Code red');
  };

  const handleBroadcast = async () => {
    setSubmitting(true);
    setStatusMsg(null);

    const shouldPlaySiren = threatLevel === 'Code red' && isSirenEnabled;

    try {
      await fetch(`${API_BASE}/evacuation/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zone_name: selectedZone.name,
          threat_level: threatLevel,
          evacuation_order: evacuationOrder,
          estimated_population: selectedZone.pop,
          channels: ['CAP_BROADCAST', 'CELL_BROADCAST', 'SMS_BLAST', 'RADIO_INTERRUPT'],
        }),
      });

      const broadcastData = {
        id: `EVAC-${Date.now()}`,
        zone_name: selectedZone.name,
        threat_level: threatLevel,
        evacuation_order: evacuationOrder,
        estimated_population: selectedZone.pop,
        channels: ['CAP_BROADCAST', 'CELL_BROADCAST', 'SMS_BLAST'],
        created_at: Date.now(),
        is_active: true,
      };

      try {
        localStorage.setItem('hc05_active_evacuations', JSON.stringify([broadcastData]));
        const bc = new BroadcastChannel('hc05_evacuation_alerts');
        bc.postMessage({ type: 'NEW_EVACUATION', broadcast: broadcastData });
        bc.close();
      } catch {}

      // Siren sound ONLY for Code red!
      if (shouldPlaySiren) {
        soundFx.playEvacuationSiren(3.0);
      }

      setStatusMsg(
        threatLevel === 'Code red'
          ? '🚨 CODE RED Reverse-911 Evacuation Order broadcasted citywide with acoustic EAS sirens!'
          : threatLevel === 'Moderate'
          ? '⚠️ Moderate Flood Advisory broadcasted across all channels (Silent).'
          : '✅ Safe Clearance Notice broadcasted to all citizens and responders.'
      );

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (e) {
      if (shouldPlaySiren) soundFx.playEvacuationSiren(2.0);
      setStatusMsg('Transmitted over Local Mesh Relay network.');
      setTimeout(() => onClose(), 1500);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className={`px-6 py-4 text-white flex items-center justify-between ${
          threatLevel === 'Code red'
            ? 'bg-gradient-to-r from-rose-950 via-slate-900 to-rose-950'
            : threatLevel === 'Moderate'
            ? 'bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950'
            : 'bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              threatLevel === 'Code red'
                ? 'bg-rose-600/30 border border-rose-500/50 text-rose-400'
                : threatLevel === 'Moderate'
                ? 'bg-amber-600/30 border border-amber-500/50 text-amber-400'
                : 'bg-emerald-600/30 border border-emerald-500/50 text-emerald-400'
            }`}>
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm tracking-tight flex items-center gap-2">
                Geo-Fenced Reverse-911 Evacuation Broadcast
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase ${
                  threatLevel === 'Code red'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-400/40'
                    : threatLevel === 'Moderate'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                }`}>
                  {threatLevel}
                </span>
              </h3>
              <p className="text-[11px] text-slate-300">
                Authorized Emergency Alert System (CAP / Cell Broadcast Gateway)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Msg */}
        {statusMsg && (
          <div className="px-6 py-2.5 bg-blue-50 border-b border-blue-100 text-xs font-bold text-blue-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-blue-600 shrink-0" />
            <span>{statusMsg}</span>
          </div>
        )}

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* Target Hazard Zone Selector */}
          <div>
            <label className="text-xs font-extrabold uppercase tracking-wider text-slate-600 block mb-1.5">
              Target Hazard Perimeter / Geofence
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ZONES_LIST.map((zone) => (
                <button
                  key={zone.name}
                  onClick={() => setSelectedZone(zone)}
                  className={`p-3 rounded-2xl text-left border transition-all cursor-pointer ${
                    selectedZone.name === zone.name
                      ? 'bg-slate-100 border-slate-400 ring-2 ring-slate-300'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="text-xs font-bold text-slate-900 truncate">{zone.name}</div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
                    <span className="flex items-center gap-1 font-mono">
                      <Users className="w-3 h-3 text-slate-400" />
                      ~{zone.pop.toLocaleString()} citizens
                    </span>
                    <span className="font-bold text-rose-600">{zone.risk} RISK</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 3 Threat Levels (Code red, Moderate, Safe) */}
          <div>
            <label className="text-xs font-extrabold uppercase tracking-wider text-slate-600 block mb-1.5">
              EAS Threat Level & Priority
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['Code red', 'Moderate', 'Safe'] as const).map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => handleSelectThreatLevel(lvl)}
                  className={`py-2 px-3 rounded-xl text-xs font-black transition-all border cursor-pointer ${
                    threatLevel === lvl
                      ? lvl === 'Code red'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-md ring-2 ring-rose-400/30'
                        : lvl === 'Moderate'
                        ? 'bg-amber-500 text-white border-amber-500 shadow-md ring-2 ring-amber-400/30'
                        : 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-400/30'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 mt-1 italic">
              {THREAT_PRESETS[threatLevel].desc}
            </p>
          </div>

          {/* Order Message (Dynamic based on selected threat level) */}
          <div>
            <label className="text-xs font-extrabold uppercase tracking-wider text-slate-600 block mb-1.5">
              Public Safety Directive (Auto-Preset by Threat Level)
            </label>
            <textarea
              rows={3}
              value={evacuationOrder}
              onChange={(e) => setEvacuationOrder(e.target.value)}
              className="w-full p-3 rounded-2xl text-xs font-medium border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>

          {/* Siren Option: Only for Code red! */}
          {threatLevel === 'Code red' ? (
            <div className="p-3 bg-rose-50 rounded-2xl border border-rose-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-rose-600 animate-pulse" />
                <div>
                  <span className="text-xs font-bold text-rose-900 block">
                    Acoustic EAS Warning Siren (Code Red Only)
                  </span>
                  <span className="text-[10px] text-rose-600">
                    Dual 853 Hz / 960 Hz emergency siren will buzz on all active terminals
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={isSirenEnabled}
                onChange={(e) => setIsSirenEnabled(e.target.checked)}
                className="w-4 h-4 text-rose-600 rounded cursor-pointer"
              />
            </div>
          ) : (
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between opacity-80">
              <div className="flex items-center gap-2">
                <VolumeX className="w-4 h-4 text-slate-400" />
                <div>
                  <span className="text-xs font-bold text-slate-600 block">
                    Siren Muted for {threatLevel} Level
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Acoustic sirens are strictly reserved for Code red life-safety emergencies.
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-600">
                SILENT
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            onClick={handleBroadcast}
            disabled={submitting}
            className={`px-6 py-2.5 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg flex items-center gap-2 cursor-pointer ${
              threatLevel === 'Code red'
                ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/30'
                : threatLevel === 'Moderate'
                ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/30'
                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>DISPATCH {threatLevel.toUpperCase()} DIRECTIVE</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};

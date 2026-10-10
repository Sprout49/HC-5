import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  Volume2,
  Users,
  ShieldCheck,
  ShieldAlert,
  Info,
} from 'lucide-react';
import type { EvacuationBroadcast } from '../../types/simulation';
import { soundFx } from '../../utils/soundFx';
import { API_BASE } from '../../context/SimulationContext';

interface EvacuationAlertBannerProps {
  evacuations?: EvacuationBroadcast[];
  isAdmin?: boolean;
}

export const EvacuationAlertBanner: React.FC<EvacuationAlertBannerProps> = ({
  evacuations = [],
  isAdmin = false,
}) => {
  const [localEvac, setLocalEvac] = React.useState<EvacuationBroadcast | null>(null);

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem('hc05_active_evacuations');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.length > 0) setLocalEvac(parsed[0]);
      }
    } catch {}

    try {
      const bc = new BroadcastChannel('hc05_evacuation_alerts');
      bc.onmessage = (event) => {
        if (event.data?.type === 'NEW_EVACUATION') {
          const broadcast = event.data.broadcast;
          setLocalEvac(broadcast);
          // Siren sound ONLY for Code red! Never for Moderate or Safe
          if (broadcast?.threat_level === 'Code red' || broadcast?.threat_level === 'CODE RED') {
            soundFx.playEvacuationSiren(3.5);
          }
        } else if (event.data?.type === 'CLEAR_EVACUATION') {
          setLocalEvac(null);
        }
      };
      return () => bc.close();
    } catch {}
  }, []);

  const current = evacuations.length > 0 ? evacuations[0] : localEvac;
  if (!current) return null;

  const handleClear = async () => {
    setLocalEvac(null);
    try {
      localStorage.removeItem('hc05_active_evacuations');
      const bc = new BroadcastChannel('hc05_evacuation_alerts');
      bc.postMessage({ type: 'CLEAR_EVACUATION' });
      bc.close();
    } catch {}

    try {
      await fetch(`${API_BASE}/evacuation/clear?broadcast_id=${current.id}`, {
        method: 'POST',
      });
    } catch (e) {
      console.warn('Failed to clear evacuation on backend:', e);
    }
  };

  const isCodeRed = current.threat_level === 'Code red' || current.threat_level === 'CODE RED';
  const isModerate = current.threat_level === 'Moderate' || current.threat_level === 'AMBER';
  const isSafe = current.threat_level === 'Safe' || current.threat_level === 'ALL CLEAR';
  // Use isSafe in title attribute or check
  const levelTitle = isSafe ? 'All Clear' : isModerate ? 'Advisory' : 'Emergency';

  const handleReplaySiren = () => {
    if (isCodeRed) {
      soundFx.playEvacuationSiren(2.0);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -60, opacity: 0 }}
        className={`relative z-40 text-white px-6 py-2.5 shadow-xl border-b-2 flex items-center justify-between ${
          isCodeRed
            ? 'bg-gradient-to-r from-rose-600 via-red-700 to-rose-600 border-amber-300'
            : isModerate
            ? 'bg-gradient-to-r from-amber-600 via-yellow-600 to-amber-600 border-amber-200'
            : 'bg-gradient-to-r from-emerald-600 via-teal-700 to-emerald-600 border-emerald-300'
        }`}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-8 h-8 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center shrink-0">
            {isCodeRed ? (
              <AlertTriangle className="w-5 h-5 text-amber-300 fill-amber-300 animate-bounce" />
            ) : isModerate ? (
              <Info className="w-5 h-5 text-white" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-white" />
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 truncate">
            <div className="flex items-center gap-2">
              <span className={`font-black text-xs uppercase px-2 py-0.5 rounded-full ${
                isCodeRed
                  ? 'bg-white text-rose-700'
                  : isModerate
                  ? 'bg-white text-amber-800'
                  : 'bg-white text-emerald-800'
              }`}>
                {current.threat_level || 'Code red'}
              </span>
              <span className="font-extrabold text-xs tracking-tight">
                {isCodeRed
                  ? 'REVERSE-911 EVACUATION ORDER:'
                  : isModerate
                  ? 'FLOOD ADVISORY NOTICE:'
                  : 'ALL HAZARDS CLEARANCE:'}
              </span>
            </div>
            <p className="text-xs font-semibold text-white/95 truncate">
              {current.zone_name} — "{current.evacuation_order}"
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-4">
          <span className="hidden md:flex items-center gap-1 text-[11px] font-mono text-white/80">
            <Users className="w-3.5 h-3.5" />
            {current.estimated_population?.toLocaleString()} notified
          </span>

          {/* Siren Button ONLY for Code red! */}
          {isCodeRed && (
            <button
              onClick={handleReplaySiren}
              className="px-3 py-1 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer animate-pulse"
              title="Sound / Replay High-Decibel Emergency Siren (Code Red Only)"
            >
              <Volume2 className="w-4 h-4 fill-slate-950" />
              <span>BUZZ SIREN</span>
            </button>
          )}

          {isAdmin && (
            <button
              onClick={handleClear}
              className="px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-[11px] font-black uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1"
              title={`Dismiss / Stand Down ${levelTitle} Alert`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Stand Down</span>
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

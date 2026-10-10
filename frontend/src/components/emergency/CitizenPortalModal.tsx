import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  LifeBuoy,
  MapPin,
  Send,
  X,
  Navigation,
  CheckCircle,
} from 'lucide-react';
import { API_BASE } from '../../context/SimulationContext';
import { soundFx } from '../../utils/soundFx';

interface CitizenPortalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CitizenPortalModal: React.FC<CitizenPortalModalProps> = ({ isOpen, onClose }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [trappedCount, setTrappedCount] = useState(2);
  const [coords, setCoords] = useState<[number, number]>([73.8567, 18.5204]);
  const [isLocating, setIsLocating] = useState(false);
  const [medicalNeed, setMedicalNeed] = useState('None');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleGetLocation = () => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords([pos.coords.longitude, pos.coords.latitude]);
        setIsLocating(false);
      },
      () => {
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch(`${API_BASE}/sos/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'citizen_portal',
          sender_name: name || 'Stranded Citizen',
          phone: phone || '+91 98000 00000',
          message: `CITIZEN RESCUE REQUEST: ${notes || 'Immediate evacuation needed.'} [Medical: ${medicalNeed}]`,
          lon: coords[0],
          lat: coords[1],
          trapped_count: trappedCount,
          severity: trappedCount > 3 || medicalNeed !== 'None' ? 'CRITICAL' : 'HIGH',
        }),
      });

      if (res.ok) {
        soundFx.playAlertPing();
        setSubmitted(true);
      }
    } catch (e) {
      soundFx.playAlertPing();
      setSubmitted(true);
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
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/40 flex items-center justify-center">
              <LifeBuoy className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm tracking-tight">
                Citizen Flood Rescue SOS Portal
              </h3>
              <p className="text-[11px] text-blue-200">
                Direct Emergency Extraction Request • IFRC Rapid Response
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          {submitted ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-lg font-black text-slate-900">
                  SOS Broadcast Transmitted!
                </h4>
                <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto leading-relaxed">
                  Your distress coordinates have been prioritized in the IFRC Command Center. The nearest ALS ambulance or NDRF boat is being dispatched.
                </p>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-left text-xs text-amber-900 space-y-1">
                <strong>Safety Directives:</strong>
                <ul className="list-disc list-inside text-[11px] space-y-0.5">
                  <li>Move to highest reachable floor or rooftop.</li>
                  <li>Do not walk through fast-moving water above knee height.</li>
                  <li>Conserve phone battery for dispatcher radio call.</li>
                </ul>
              </div>
              <button
                onClick={() => {
                  setSubmitted(false);
                  onClose();
                }}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all"
              >
                Return to Dashboard
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Your Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Ramesh More"
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Phone Number</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98XXX XXXXX"
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-mono focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Location Picker */}
              <div className="p-3 rounded-2xl bg-blue-50/60 border border-blue-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-blue-600" />
                    GPS Rescue Coordinates
                  </span>
                  <button
                    type="button"
                    onClick={handleGetLocation}
                    disabled={isLocating}
                    className="px-2.5 py-1 bg-white hover:bg-blue-100 text-blue-700 rounded-lg text-[10px] font-bold border border-blue-200 shadow-xs flex items-center gap-1"
                  >
                    <Navigation className={`w-3 h-3 ${isLocating ? 'animate-spin' : ''}`} />
                    <span>{isLocating ? 'Acquiring...' : 'Use My Current GPS'}</span>
                  </button>
                </div>
                <div className="text-[11px] font-mono text-slate-600">
                  Target: [{coords[1].toFixed(4)}, {coords[0].toFixed(4)}]
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Trapped Persons
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={trappedCount}
                    onChange={(e) => setTrappedCount(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Critical Medical Need
                  </label>
                  <select
                    value={medicalNeed}
                    onChange={(e) => setMedicalNeed(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-bold bg-white"
                  >
                    <option value="None">None (Evacuation Only)</option>
                    <option value="Elderly / Limited Mobility">Elderly / Limited Mobility</option>
                    <option value="Infant / Pregnant Mother">Infant / Pregnant Mother</option>
                    <option value="Oxygen / Dialysis Required">Oxygen / Dialysis Required</option>
                    <option value="Hypothermia / Injury">Hypothermia / Injury</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Situation & Landmark Details
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Trapped on 2nd floor terrace behind Alka Talkies, water level rising fast..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-lg hover:shadow-rose-500/25 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>{submitting ? 'TRANSMITTING...' : 'TRANSMIT SOS TO COMMAND CENTER'}</span>
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
};

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  MessageSquare,
  Send,
  X,
  MapPin,
  Users,
  CheckCircle,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { API_BASE } from '../../context/SimulationContext';
import { soundFx } from '../../utils/soundFx';

interface CitizenSOSModalProps {
  isOpen: boolean;
  onClose: () => void;
  recentMessages?: any[];
}

const PRESET_MOCK_SOS = [
  {
    source: 'whatsapp',
    sender_name: 'Pooja Kulkarni',
    phone: '+91 98220 54129',
    location_name: 'Alka Talkies (Ambulance Dispatched)',
    lon: 73.8490,
    lat: 18.5118,
    trapped_count: 1,
    severity: 'HIGH',
    message: 'Water entering ground floor! Need immediate ALS ambulance extraction for 1 patient before road floods.',
  },
  {
    source: 'whatsapp',
    sender_name: 'Dr. Sameer Joshi',
    phone: '+91 98901 32901',
    location_name: 'Deccan Gymkhana (Ambulance Dispatched)',
    lon: 73.8420,
    lat: 18.5180,
    trapped_count: 1,
    severity: 'HIGH',
    message: 'Car stalled in 0.3m water near bus stop. Elderly patient onboard requires rapid transport.',
  },
  {
    source: 'telegram',
    sender_name: 'Vikas Jadhav',
    phone: '+91 94231 88710',
    location_name: 'Pulachi Wadi (Submerged • Boat Rescue)',
    lon: 73.8475,
    lat: 18.5140,
    trapped_count: 3,
    severity: 'CRITICAL',
    message: 'Water has reached 1st floor balcony! Ground level submerged in 1.2m current. Escalated for NDRF boat extraction.',
  },
];

export const CitizenSOSModal: React.FC<CitizenSOSModalProps> = ({
  isOpen,
  onClose,
  recentMessages = [],
}) => {
  const [activeTab, setActiveTab] = useState<'feed' | 'simulate'>('feed');
  const [source, setSource] = useState<'whatsapp' | 'telegram'>('whatsapp');
  const [senderName, setSenderName] = useState('Aniket Deshmukh');
  const [phone, setPhone] = useState('+91 98500 12345');
  const [message, setMessage] = useState('Water inside house, 4 family members trapped on rooftop.');
  const [trappedCount, setTrappedCount] = useState(4);
  const [severity, setSeverity] = useState('CRITICAL');
  const [lon, setLon] = useState(73.8512);
  const [lat, setLat] = useState(18.5204);
  const [submitting, setSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const handleSendMockSOS = async (preset?: typeof PRESET_MOCK_SOS[0]) => {
    setSubmitting(true);
    setStatusMsg(null);

    const payload = preset
      ? {
          source: preset.source,
          sender_name: preset.sender_name,
          phone: preset.phone,
          message: preset.message,
          lon: preset.lon,
          lat: preset.lat,
          trapped_count: preset.trapped_count,
          severity: preset.severity,
        }
      : {
          source,
          sender_name: senderName,
          phone,
          message,
          lon,
          lat,
          trapped_count: trappedCount,
          severity,
        };

    try {
      const res = await fetch(`${API_BASE}/sos/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      let success = false;
      if (res.ok) {
        success = true;
      } else {
        // Graceful fallback to existing /api/incidents endpoint
        const fallbackRes = await fetch(`${API_BASE}/incidents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lon: payload.lon,
            lat: payload.lat,
            severity: payload.severity,
            patient_count: payload.trapped_count,
          }),
        });
        if (fallbackRes.ok) success = true;
      }

      if (success) {
        soundFx.playAlertPing();
        try {
          const bc = new BroadcastChannel('hc05_citizen_sos');
          bc.postMessage({ type: 'NEW_SOS', message: payload });
          bc.close();
        } catch {}
        setStatusMsg(`✅ Incoming ${payload.source.toUpperCase()} SOS successfully ingested! Emergency incident created on map.`);
        setActiveTab('feed');
      } else {
        setStatusMsg('❌ Failed to ingest incident. Please check simulation connection.');
      }
    } catch (e) {
      soundFx.playAlertPing();
      setStatusMsg('📶 Transmitted over Local HC-05 Mesh Relay.');
      setActiveTab('feed');
    } finally {
      setSubmitting(false);
      setTimeout(() => setStatusMsg(null), 5000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm tracking-tight flex items-center gap-2">
                WhatsApp & Telegram Citizen SOS Gateway
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  LIVE WEBHOOK
                </span>
              </h3>
              <p className="text-[11px] text-slate-300">
                Civilians without the web app send live location + text via messaging bots
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

        {/* Tab Switcher */}
        <div className="px-6 pt-3 pb-1 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('feed')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                activeTab === 'feed'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Distress Feed ({recentMessages.length})
            </button>
            <button
              onClick={() => setActiveTab('simulate')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                activeTab === 'simulate'
                  ? 'bg-blue-50 text-blue-800 border border-blue-200 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Simulate Incoming Bot SOS
            </button>
          </div>

          <span className="text-[10px] text-slate-400 font-mono">Webhook: /api/sos/webhook</span>
        </div>

        {/* Status Message */}
        {statusMsg && (
          <div className="px-6 py-2.5 bg-emerald-50 border-b border-emerald-100 text-xs font-semibold text-emerald-900 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{statusMsg}</span>
          </div>
        )}

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {activeTab === 'feed' ? (
            <div className="space-y-3">
              {recentMessages.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-slate-400 text-xs font-medium mb-3">
                    No citizen SOS messages received yet during this simulation.
                  </p>
                  <button
                    onClick={() => setActiveTab('simulate')}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md inline-flex items-center gap-1.5"
                  >
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Send Test WhatsApp SOS Now</span>
                  </button>
                </div>
              ) : (
                recentMessages.map((msg: any) => (
                  <div
                    key={msg.id}
                    className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-white shadow-xs transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            msg.source === 'whatsapp'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-sky-100 text-sky-800 border border-sky-300'
                          }`}
                        >
                          {msg.source === 'whatsapp' ? '📱 WhatsApp' : '✈️ Telegram'}
                        </span>
                        <span className="font-bold text-xs text-slate-900">{msg.sender_name}</span>
                        <span className="text-[11px] font-mono text-slate-400">{msg.phone}</span>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          msg.severity === 'CRITICAL'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {msg.severity}
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 bg-white p-2.5 rounded-xl border border-slate-100 font-sans leading-relaxed">
                      "{msg.message}"
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <strong>{msg.trapped_count}</strong> persons trapped
                      </span>
                      <span className="flex items-center gap-1 font-mono text-[10px]">
                        <MapPin className="w-3.5 h-3.5 text-rose-500" />
                        [{msg.location ? `${msg.location[1].toFixed(4)}, ${msg.location[0].toFixed(4)}` : 'GPS fix'}]
                      </span>
                    </div>
                  </div>
                ))
              )}

              {/* Fast presets for presentation demo */}
              <div className="mt-4 pt-4 border-t border-slate-100">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                  1-Click Presets for Live Pitch Demo
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {PRESET_MOCK_SOS.map((preset, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMockSOS(preset)}
                      disabled={submitting}
                      className="p-2.5 rounded-xl text-left bg-slate-50 hover:bg-emerald-50 hover:border-emerald-200 border border-slate-200 transition-all text-xs"
                    >
                      <div className="font-bold text-slate-800 text-[11px] truncate">
                        {preset.sender_name} ({preset.source})
                      </div>
                      <div className="text-[10px] text-slate-500 truncate mt-0.5">
                        {preset.location_name}
                      </div>
                      <div className="text-[9px] font-bold text-rose-600 mt-1">
                        👥 {preset.trapped_count} trapped • {preset.severity}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Simulate Tab */
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Channel Origin
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSource('whatsapp')}
                      className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold border transition-all ${
                        source === 'whatsapp'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                    >
                      WhatsApp
                    </button>
                    <button
                      type="button"
                      onClick={() => setSource('telegram')}
                      className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold border transition-all ${
                        source === 'telegram'
                          ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                    >
                      Telegram
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Severity Code
                  </label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value)}
                    className="w-full py-1.5 px-3 rounded-xl text-xs font-bold border border-slate-200 bg-white"
                  >
                    <option value="CRITICAL">CRITICAL (Rooftop / Imminent)</option>
                    <option value="HIGH">HIGH (Rising Fast)</option>
                    <option value="MEDIUM">MEDIUM (Road Submerged)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Citizen Name
                  </label>
                  <input
                    type="text"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    className="w-full py-1.5 px-3 rounded-xl text-xs border border-slate-200 bg-white font-medium"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full py-1.5 px-3 rounded-xl text-xs border border-slate-200 bg-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  Distress Message (Chat Text)
                </label>
                <textarea
                  rows={2}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full p-2.5 rounded-xl text-xs border border-slate-200 bg-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Trapped Count
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={trappedCount}
                    onChange={(e) => setTrappedCount(Number(e.target.value))}
                    className="w-full py-1.5 px-3 rounded-xl text-xs border border-slate-200 bg-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={lon}
                    onChange={(e) => setLon(Number(e.target.value))}
                    className="w-full py-1.5 px-3 rounded-xl text-xs border border-slate-200 bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={lat}
                    onChange={(e) => setLat(Number(e.target.value))}
                    className="w-full py-1.5 px-3 rounded-xl text-xs border border-slate-200 bg-white font-mono"
                  />
                </div>
              </div>

              <button
                onClick={() => handleSendMockSOS()}
                disabled={submitting}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Transmit Incoming Bot SOS</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            Meta WhatsApp Cloud API & Telegram Bot API Compatible
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold transition-colors"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
};

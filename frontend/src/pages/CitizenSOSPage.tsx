import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  MapPin,
  Send,
  Navigation,
  CheckCircle,
  Radio,
  Battery,
  Shield,
  Clock,
  RotateCcw,
} from 'lucide-react';
import { API_BASE } from '../context/SimulationContext';
import { meshNetwork } from '../utils/meshNetwork';
import { soundFx } from '../utils/soundFx';

export const CitizenSOSPage: React.FC = () => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [trappedCount, setTrappedCount] = useState(3);
  const [waterLevel, setWaterLevel] = useState<'0.2m' | '0.6m' | '1.2m' | '2.5m+'>('1.2m');
  const [coords, setCoords] = useState<[number, number]>([73.8567, 18.5204]); // [lng, lat]
  const [locationName, setLocationName] = useState('Yerawada Riverbank (North Bund Garden)');
  const [isLocating, setIsLocating] = useState(false);
  const [medicalNeeds, setMedicalNeeds] = useState<string[]>(['Elderly']);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [transmissionSeconds, setTransmissionSeconds] = useState(0);
  const [batteryLevel, setBatteryLevel] = useState<number>(84);

  // Read hardware battery level if supported
  useEffect(() => {
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((batt: any) => {
        setBatteryLevel(Math.round(batt.level * 100));
      }).catch(() => {});
    }
  }, []);

  // Fetch true GPS location from satellite hardware
  const handleAutoGPS = () => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lng = pos.coords.longitude;
        const lat = pos.coords.latitude;
        setCoords([lng, lat]);
        setLocationName(`Satellite Fix: ${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`);
        setIsLocating(false);
      },
      () => {
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Timer while beacon is transmitting
  useEffect(() => {
    let timer: any = null;
    if (isSubmitted) {
      timer = setInterval(() => {
        setTransmissionSeconds((s) => s + 1);
      }, 1000);
    } else {
      setTransmissionSeconds(0);
    }
    return () => clearInterval(timer);
  }, [isSubmitted]);

  const toggleMedical = (need: string) => {
    if (medicalNeeds.includes(need)) {
      setMedicalNeeds(medicalNeeds.filter((n) => n !== need));
    } else {
      setMedicalNeeds([...medicalNeeds, need]);
    }
  };

  const handleTransmitSOS = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Pack the Way 2 BLE packet
    const payload = {
      source: 'citizen_pwa_way2',
      caller_name: name || 'Stranded Resident',
      phone: phone || '+91 98230 00000',
      message: `CITIZEN RESCUE REQUEST: ${trappedCount} people trapped in ${waterLevel} floodwater at ${locationName}. [Medical: ${medicalNeeds.join(', ') || 'None'}] ${notes ? `(${notes})` : ''}`,
      lon: coords[0],
      lat: coords[1],
      trapped_count: trappedCount,
      water_level: waterLevel,
      medical_needs: medicalNeeds,
      battery: batteryLevel,
      severity: trappedCount >= 3 || waterLevel === '2.5m+' || medicalNeeds.length > 0 ? 'CRITICAL' : 'HIGH',
    };

    // 2. Play Audio Feedback
    soundFx.playAlertPing();

    // 3. Broadcast across Way 2 Offline BLE Mesh
    meshNetwork.broadcastPacket('INCIDENT', payload);

    // 4. Ingest to backend directly ONLY if cellular network is active.
    // If Cell Blackout is simulated, packet remains queued in local BLE mesh buffer until synced!
    if (!meshNetwork.isBlackoutActive()) {
      try {
        await fetch(`${API_BASE}/sos/webhook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch {}
    }

    setIsSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between selection:bg-rose-500 selection:text-white">
      {/* 1. TOP DISASTER EMERGENCY HEADER */}
      <header className="px-4 py-3 bg-gradient-to-r from-red-950 via-slate-900 to-red-950 border-b border-red-900/40 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center font-black text-white text-xs shadow-lg animate-pulse">
            SOS
          </div>
          <div>
            <h1 className="text-xs font-black tracking-tight flex items-center gap-2 text-white">
              PUNE FLOOD CITIZEN RESCUE PORTAL
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-red-500/20 text-red-300 border border-red-500/30 font-bold">
                WAY 2 PWA
              </span>
            </h1>
            <p className="text-[10px] text-slate-400 font-mono">
              Offline-First Emergency Extraction • 100% Software-Only BLE
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[10px] font-bold">
          <span className="flex items-center gap-1 text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800/40">
            <Radio className="w-3 h-3 animate-spin" />
            GPS Locked
          </span>
          <span className="flex items-center gap-1 text-slate-300 bg-slate-900 px-2 py-0.5 rounded-full border border-slate-800">
            <Battery className="w-3 h-3 text-emerald-400" />
            {batteryLevel}%
          </span>
        </div>
      </header>

      {/* 2. BODY CONTAINER */}
      <main className="flex-1 max-w-lg w-full mx-auto p-4 flex flex-col justify-center">
        {!isSubmitted ? (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4"
          >
            {/* Banner: Way 2 Offline Assurance */}
            <div className="p-3 rounded-2xl bg-indigo-950/40 border border-indigo-800/40 text-xs flex items-start gap-2.5">
              <Shield className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-indigo-200">
                  Pre-Cached Offline PWA Active
                </p>
                <p className="text-[11px] text-indigo-300/80 leading-relaxed mt-0.5">
                  No cell service required. Your phone's Bluetooth will whisper this distress signal to nearby neighbors and passing ambulances.
                </p>
              </div>
            </div>

            <form onSubmit={handleTransmitSOS} className="space-y-4">
              {/* Name & Phone */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Your Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Ramesh K."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Contact Phone
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98230 11223"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>

              {/* Satellite GPS Location */}
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-red-400" />
                    Satellite GPS Coordinates
                  </span>
                  <button
                    type="button"
                    onClick={handleAutoGPS}
                    disabled={isLocating}
                    className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-900/40 text-blue-300 border border-blue-700/50 hover:bg-blue-800/60 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Navigation className={`w-3 h-3 ${isLocating ? 'animate-spin' : ''}`} />
                    {isLocating ? 'Fixing...' : 'Re-Check GPS'}
                  </button>
                </div>
                <div className="text-xs font-mono text-emerald-400 font-bold">
                  {coords[1].toFixed(5)}° N, {coords[0].toFixed(5)}° E
                </div>
                <input
                  type="text"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300"
                  placeholder="Address or landmark note"
                />
              </div>

              {/* Number of People Trapped */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  How Many People Are Trapped?
                </label>
                <div className="flex items-center justify-between p-2 bg-slate-950 border border-slate-800 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setTrappedCount((c) => Math.max(1, c - 1))}
                    className="w-10 h-10 rounded-xl bg-slate-900 text-slate-300 hover:bg-slate-800 font-black text-lg flex items-center justify-center transition-colors cursor-pointer"
                  >
                    -
                  </button>
                  <div className="text-center">
                    <span className="text-xl font-black text-white">{trappedCount}</span>
                    <span className="block text-[10px] text-slate-400 uppercase font-bold">Individuals</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTrappedCount((c) => Math.min(10, c + 1))}
                    className="w-10 h-10 rounded-xl bg-slate-900 text-slate-300 hover:bg-slate-800 font-black text-lg flex items-center justify-center transition-colors cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Water Depth Selector */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Current Water Level At Your Location
                </label>
                <div className="grid grid-cols-4 gap-1.5 text-center">
                  {[
                    { id: '0.2m', label: 'Ankle', sub: '0.2m' },
                    { id: '0.6m', label: 'Knee', sub: '0.6m' },
                    { id: '1.2m', label: 'Waist', sub: '1.2m' },
                    { id: '2.5m+', label: 'Rooftop', sub: '2.5m+' },
                  ].map((lvl) => (
                    <button
                      key={lvl.id}
                      type="button"
                      onClick={() => setWaterLevel(lvl.id as any)}
                      className={`p-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                        waterLevel === lvl.id
                          ? 'bg-red-600 text-white border-red-500 shadow-md ring-2 ring-red-400/30'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-900'
                      }`}
                    >
                      <span>{lvl.label}</span>
                      <span className="block text-[9px] font-mono opacity-80">{lvl.sub}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Urgent Vulnerabilities */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Vulnerable Individuals Present
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {['Elderly', 'Oxygen Needed', 'Infant / Child', 'Immobile'].map((need) => (
                    <button
                      key={need}
                      type="button"
                      onClick={() => toggleMedical(need)}
                      className={`py-1.5 px-2.5 rounded-xl text-xs font-bold transition-all border text-left flex items-center justify-between cursor-pointer ${
                        medicalNeeds.includes(need)
                          ? 'bg-indigo-600 text-white border-indigo-500'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-900'
                      }`}
                    >
                      <span>{need}</span>
                      {medicalNeeds.includes(need) && <CheckCircle className="w-3 h-3 text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Specific Emergency Notes */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Situation / Landmark Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Trapped on 2nd floor balcony, power is out."
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              {/* Big Red Transmit Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                className="w-full py-4 bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:to-red-500 text-white rounded-2xl font-black text-sm tracking-wide shadow-xl shadow-red-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all border border-red-400/30"
              >
                <Send className="w-4 h-4" />
                TRANSMIT EMERGENCY SOS BEACON
              </motion.button>
            </form>
          </motion.div>
        ) : (
          /* ACTIVE BEACON TRANSMISSION SCREEN */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 shadow-2xl text-center space-y-5"
          >
            {/* Animated Radar Pulse */}
            <div className="relative w-28 h-28 mx-auto flex items-center justify-center">
              <span className="absolute w-full h-full rounded-full bg-red-600/20 animate-ping" />
              <span className="absolute w-20 h-20 rounded-full bg-red-600/40 animate-pulse" />
              <div className="relative w-14 h-14 rounded-full bg-red-600 flex items-center justify-center text-white shadow-xl shadow-red-600/50">
                <Radio className="w-7 h-7 animate-spin" />
              </div>
            </div>

            <div>
              <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/40">
                ACTIVE BLUETOOTH BEACON
              </span>
              <h2 className="text-lg font-black text-white mt-1.5">
                EMERGENCY DISTRESS ACTIVE
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Your 180-byte packet is whispering to nearby phones and passing rescue units.
              </p>
            </div>

            {/* Live Steps Card */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-left space-y-2.5 text-xs">
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>Step 1: Satellite GPS locked ({coords[1].toFixed(4)}°, {coords[0].toFixed(4)}°)</span>
              </div>
              <div className="flex items-center gap-2 text-indigo-400 font-bold">
                <Radio className="w-4 h-4 shrink-0 animate-spin" />
                <span>Step 2: Whispering BLE beacon to nearby devices (Phone B)...</span>
              </div>
              <div className="flex items-center gap-2 text-slate-400 font-medium">
                <Clock className="w-4 h-4 shrink-0" />
                <span>Step 3: Awaiting passing ambulance or boat ingestion...</span>
              </div>
            </div>

            {/* Timer Card */}
            <div className="flex items-center justify-between px-4 py-2 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono text-slate-300">
              <span>Time Transmitting:</span>
              <span className="font-bold text-red-400">
                {String(Math.floor(transmissionSeconds / 60)).padStart(2, '0')}:
                {String(transmissionSeconds % 60).padStart(2, '0')}
              </span>
            </div>

            <button
              onClick={() => setIsSubmitted(false)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Edit or Retransmit SOS
            </button>
          </motion.div>
        )}
      </main>

      {/* 3. FOOTER */}
      <footer className="px-4 py-2.5 bg-slate-950/80 border-t border-slate-800 text-center text-[10px] text-slate-500 shrink-0">
        Pune Municipal Corporation • HC-05 Disaster Resilience • IEEE 802.15.1 BLE Mesh Standard
      </footer>
    </div>
  );
};

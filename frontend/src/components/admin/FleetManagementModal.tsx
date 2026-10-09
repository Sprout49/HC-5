import React, { useState } from 'react';
import { useSimulation } from '../../context/SimulationContext';
import {
  Ambulance as AmbulanceIcon,
  Plus,
  Trash2,
  X,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Gauge,
  Copy,
  Check
} from 'lucide-react';

interface FleetManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ZONE_OPTIONS = [
  { id: 'Z1', name: 'Zone 1 - Sancheti / Shivajinagar (North Hub)' },
  { id: 'Z2', name: 'Zone 2 - Shaniwar Wada / Kasba Peth' },
  { id: 'Z3', name: 'Zone 3 - Sassoon General Hospital' },
  { id: 'Z4', name: 'Zone 4 - Deccan Gymkhana / Karve Road' },
  { id: 'Z5', name: 'Zone 5 - Swargate Transit Hub (South Hub)' },
  { id: 'Z6', name: 'Zone 6 - Camp MG Road / East Hub' },
  { id: 'Z7', name: 'Zone 7 - Yerawada Riverbank Hub' },
  { id: 'Z8', name: 'Zone 8 - Kothrud Stand / West Hub' },
];

export const FleetManagementModal: React.FC<FleetManagementModalProps> = ({ isOpen, onClose }) => {
  const { state, addAmbulance, deleteAmbulance } = useSimulation();

  const [ambulanceId, setAmbulanceId] = useState('');
  const [callsign, setCallsign] = useState('');
  const [vehicleType, setVehicleType] = useState<'ALS' | 'BLS'>('ALS');
  const [password, setPassword] = useState('demo123');
  const [assignedZone, setAssignedZone] = useState('Z1');
  const [speedKmh, setSpeedKmh] = useState(45);

  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const ambulances = state?.ambulances || [];

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatusMessage(null);

    const result = await addAmbulance({
      ambulance_id: ambulanceId.trim().toUpperCase() || undefined,
      callsign: callsign.trim() || undefined,
      type: vehicleType,
      password: password.trim() || 'demo123',
      assigned_zone: assignedZone,
      speed_kmh: Number(speedKmh) || 45,
    });

    setLoading(false);

    if (result.success) {
      const createdId = ambulanceId.trim().toUpperCase() || `AMB-0${ambulances.length + 1}`;
      setStatusMessage({
        type: 'success',
        text: `Unit ${createdId} commissioned! Driver can now sign in at the Ambulance Portal using ID: ${createdId} and PIN: ${password || 'demo123'}.`,
      });
      // Reset form fields
      setAmbulanceId('');
      setCallsign('');
      setPassword('demo123');
    } else {
      setStatusMessage({
        type: 'error',
        text: result.error || 'Failed to commission ambulance. Please check fields.',
      });
    }
  };

  const handleDelete = async (aid: string) => {
    if (!window.confirm(`Are you sure you want to decommission and remove unit ${aid} from the emergency fleet?`)) {
      return;
    }
    setDeletingId(aid);
    setStatusMessage(null);

    const res = await deleteAmbulance(aid);
    setDeletingId(null);

    if (res.success) {
      setStatusMessage({
        type: 'success',
        text: `Unit ${aid} decommissioned and removed from service.`,
      });
    } else {
      setStatusMessage({
        type: 'error',
        text: res.error || `Failed to decommission ${aid}`,
      });
    }
  };

  const handleCopyCredentials = (aid: string, pwd: string = 'demo123') => {
    navigator.clipboard.writeText(`ID: ${aid} | PIN: ${pwd}`);
    setCopiedId(aid);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <AmbulanceIcon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900">Fleet Management Command</h2>
                <span className="text-[11px] font-bold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                  {ambulances.length} Active Units
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Commission new emergency vehicles, configure driver credentials, and decommission units.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Notification */}
        {statusMessage && (
          <div
            className={`px-6 py-3 flex items-center gap-3 text-xs font-semibold ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-100'
                : 'bg-rose-50 text-rose-800 border-b border-rose-100'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Commission New Ambulance Form (5 cols) */}
          <div className="lg:col-span-5 bg-slate-50 rounded-2xl p-5 border border-slate-200 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-600 font-bold" />
              <h3 className="font-extrabold text-sm text-slate-900">Commission New Ambulance</h3>
            </div>
            <p className="text-[11px] text-slate-500 font-medium -mt-2">
              New vehicle will be instantly deployed on the 3D map and its credentials can be used in Ambulance Login.
            </p>

            <form onSubmit={handleAddSubmit} className="flex flex-col gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Ambulance ID
                </label>
                <input
                  type="text"
                  value={ambulanceId}
                  onChange={(e) => setAmbulanceId(e.target.value.toUpperCase())}
                  placeholder={`AMB-${(ambulances.length + 1).toString().padStart(2, '0')}`}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
                <span className="text-[10px] text-slate-400">Leave blank to auto-generate next ID</span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Callsign / Unit Name
                </label>
                <input
                  type="text"
                  value={callsign}
                  onChange={(e) => setCallsign(e.target.value)}
                  placeholder="e.g. Kothrud Rapid 05"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Vehicle Type
                  </label>
                  <select
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/40 cursor-pointer"
                  >
                    <option value="ALS">ALS (Advanced)</option>
                    <option value="BLS">BLS (Basic)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Max Speed (km/h)
                  </label>
                  <input
                    type="number"
                    value={speedKmh}
                    onChange={(e) => setSpeedKmh(Number(e.target.value))}
                    min={20}
                    max={90}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Driver Access Password / PIN
                </label>
                <div className="relative">
                  <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="demo123"
                    className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    required
                  />
                </div>
                <span className="text-[10px] text-slate-400">Driver uses this password to log into vehicle CAD</span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Base Staging Zone
                </label>
                <select
                  value={assignedZone}
                  onChange={(e) => setAssignedZone(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/40 cursor-pointer"
                >
                  {ZONE_OPTIONS.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-extrabold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Commission Vehicle</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Right Column: Active Fleet Table / Cards (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-sm text-slate-900">Active Fleet Units ({ambulances.length})</h3>
              <span className="text-[11px] text-slate-400 font-medium">Click copy to share credentials</span>
            </div>

            <div className="flex flex-col gap-2.5 max-h-[480px] overflow-y-auto pr-1">
              {ambulances.map((amb) => {
                const isDeleting = deletingId === amb.ambulance_id;
                const isCopied = copiedId === amb.ambulance_id;
                const pwd = amb.password || 'demo123';

                return (
                  <div
                    key={amb.ambulance_id}
                    className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-black shadow-xs ${
                            amb.type === 'ALS' ? 'bg-indigo-600' : 'bg-emerald-600'
                          }`}
                        >
                          {amb.type}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-sm text-slate-900">{amb.ambulance_id}</span>
                            <span className="text-xs text-slate-500 font-semibold">? {amb.callsign}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              Zone {amb.assigned_zone}
                            </span>
                            <span>?</span>
                            <span className="flex items-center gap-1">
                              <Gauge className="w-3 h-3 text-slate-400" />
                              {amb.speed_kmh} km/h
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Decommission Button */}
                      <button
                        onClick={() => handleDelete(amb.ambulance_id)}
                        disabled={isDeleting}
                        title="Decommission & delete ambulance"
                        className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-all cursor-pointer disabled:opacity-40"
                      >
                        {isDeleting ? (
                          <span className="animate-spin w-4 h-4 border-2 border-rose-500 border-t-transparent rounded-full block" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    {/* Status & Driver Credential Bar */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            amb.status === 'AVAILABLE'
                              ? 'bg-emerald-500'
                              : amb.status.includes('EN_ROUTE')
                              ? 'bg-amber-500 animate-pulse'
                              : amb.status === 'TRAPPED_IN_FLOOD'
                              ? 'bg-rose-600 animate-bounce'
                              : 'bg-blue-500'
                          }`}
                        />
                        <span className="font-bold text-[11px] text-slate-700">{amb.status}</span>
                      </div>

                      <div className="flex items-center gap-2 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/80">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">PIN:</span>
                        <code className="text-xs font-black text-slate-800">{pwd}</code>
                        <button
                          onClick={() => handleCopyCredentials(amb.ambulance_id, pwd)}
                          title="Copy login credentials"
                          className="text-slate-400 hover:text-slate-700 transition-colors ml-1 cursor-pointer"
                        >
                          {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

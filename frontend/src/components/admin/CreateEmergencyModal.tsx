import { useState } from 'react';
import type { SeverityLevel } from '../../types/simulation';
import { AlertTriangle, X } from 'lucide-react';

interface CreateEmergencyModalProps {
  coords: [number, number];
  onClose: () => void;
  onSubmit: (severity: SeverityLevel, patientCount: number) => void;
}

export const CreateEmergencyModal: React.FC<CreateEmergencyModalProps> = ({
  coords,
  onClose,
  onSubmit,
}) => {
  const [severity, setSeverity] = useState<SeverityLevel>('CRITICAL');
  const [patientCount, setPatientCount] = useState<number>(1);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(severity, patientCount);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 w-96 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-red-100 text-red-600 rounded-xl">
              <AlertTriangle className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Report Emergency</h3>
              <p className="text-xs text-slate-500">
                Location: {coords[0].toFixed(4)}, {coords[1].toFixed(4)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Triage Severity
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as SeverityLevel[]).map((lvl) => {
                const isSelected = severity === lvl;
                const colors = {
                  LOW: 'border-emerald-300 bg-emerald-50 text-emerald-800',
                  MEDIUM: 'border-amber-300 bg-amber-50 text-amber-800',
                  HIGH: 'border-orange-300 bg-orange-50 text-orange-800',
                  CRITICAL: 'border-red-300 bg-red-50 text-red-800',
                };
                return (
                  <button
                    type="button"
                    key={lvl}
                    onClick={() => setSeverity(lvl)}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border text-center transition-all ${
                      isSelected ? `${colors[lvl]} ring-2 ring-blue-500 shadow-xs` : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {lvl}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Number of Patients: <span className="text-blue-600">{patientCount}</span>
            </label>
            <input
              type="range"
              min="1"
              max="5"
              value={patientCount}
              onChange={(e) => setPatientCount(parseInt(e.target.value))}
              className="w-full accent-blue-600 cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-slate-400 mt-1">
              <span>1 Patient</span>
              <span>3 Patients</span>
              <span>5 Patients</span>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
              <span>🚨</span>
              <span>CREATE EMERGENCY & DISPATCH</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

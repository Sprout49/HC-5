import React from 'react';
import { X, Info, ShieldAlert, Cpu, BarChart2 } from 'lucide-react';

interface AssumptionsModalProps {
  onClose: () => void;
}

export const AssumptionsModal: React.FC<AssumptionsModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 max-w-xl w-full max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-100 text-blue-600 rounded-xl">
              <Info className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Prototype Simulation Assumptions</h3>
              <p className="text-xs text-slate-500">HC-05 Scientific & Engineering Transparency</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-5 space-y-4 text-xs text-slate-600">
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
            <div className="flex items-center gap-2 font-bold text-slate-800 text-sm mb-1">
              <ShieldAlert className="w-4 h-4 text-blue-600" />
              <span>1. Flood Inundation & Elevation Approximation</span>
            </div>
            <p className="leading-relaxed">
              Ground elevation (551m - 569m MSL) is modeled across Pune's Mula-Mutha river basin. Flood depth is derived deterministically as <code className="bg-slate-200 px-1 rounded">max(0, water_level - road_elevation)</code>. This is a simulation approximation suitable for prototype demonstration, not a full 2D hydrodynamic Saint-Venant solver.
            </p>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
            <div className="flex items-center gap-2 font-bold text-slate-800 text-sm mb-1">
              <BarChart2 className="w-4 h-4 text-amber-600" />
              <span>2. Emergency Vehicle Clearance Thresholds</span>
            </div>
            <p className="leading-relaxed">
              Standard ambulances safely clear water depths ≤ 0.30m (classified as <span className="font-semibold text-amber-600">RESTRICTED</span> with speed reduction). Depths between 0.30m and 0.50m are <span className="font-semibold text-orange-600">HIGH_RISK</span>. Depths &gt; 0.50m trigger an immediate safety halt (<span className="font-semibold text-red-600">BLOCKED</span>) and trigger dynamic rerouting.
            </p>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
            <div className="flex items-center gap-2 font-bold text-slate-800 text-sm mb-1">
              <Cpu className="w-4 h-4 text-purple-600" />
              <span>3. Machine Learning Models & Training Data</span>
            </div>
            <p className="leading-relaxed">
              Models are trained on <strong className="text-slate-800">simulation-derived datasets</strong> combining real Pune geographic attributes (population, elevation, river distance, hospital capacity) with simulated flood scenarios. We explicitly document this rather than claiming historical patient call records.
            </p>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
            <div className="flex items-center gap-2 font-bold text-slate-800 text-sm mb-1">
              <span>🎯</span>
              <span>4. Hospital Eligibility & Medical Camps</span>
            </div>
            <p className="leading-relaxed">
              Critical patients require ICU bed availability. If regional hospitals are overwhelmed or severed by floodwaters, the system detects medical isolation gaps and advises deploying temporary Rapid-Triage Medical Camps (20 beds).
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors"
          >
            Acknowledge & Close
          </button>
        </div>
      </div>
    </div>
  );
};

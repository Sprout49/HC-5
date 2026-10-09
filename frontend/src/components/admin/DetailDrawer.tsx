import { X, Navigation2, Check, Ambulance as AmbulanceIcon } from 'lucide-react';
import { useSimulation } from '../../context/SimulationContext';
import { GoogleMapsNavHUD } from '../ambulance/GoogleMapsNavHUD';

interface DetailDrawerProps {
  selectedObject: {
    type: 'road' | 'hospital' | 'ambulance' | 'zone' | 'incident' | 'camp';
    data: any;
  } | null;
  onClose: () => void;
  onSwitchTab?: (tab: 'admin' | 'ambulance') => void;
}

export const DetailDrawer: React.FC<DetailDrawerProps> = ({ selectedObject, onClose, onSwitchTab }) => {
  const { state, acceptCall } = useSimulation();

  if (!selectedObject) return null;

  const { type, data } = selectedObject;

  return (
    <div className="fixed top-20 right-6 w-96 max-h-[80vh] overflow-y-auto z-40 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/90 p-5 animate-in slide-in-from-right duration-200">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="text-xl">
            {type === 'road' && '🛣️'}
            {type === 'hospital' && '🏥'}
            {type === 'ambulance' && '🚑'}
            {type === 'zone' && '🏙️'}
            {type === 'incident' && '⚠️'}
            {type === 'camp' && '🏕️'}
          </span>
          <div>
            <h3 className="font-bold text-slate-900 text-sm capitalize">
              {data.name || data.callsign || data.incident_id || data.camp_id || `${type} Details`}
            </h3>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {type}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="mt-4 space-y-4 text-xs">
        {/* ROAD DETAILS */}
        {type === 'road' && (
          <>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-600 font-medium">Status</span>
              <span
                className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
                  data.status === 'OPEN'
                    ? 'bg-emerald-100 text-emerald-800'
                    : data.status === 'RESTRICTED'
                    ? 'bg-amber-100 text-amber-800'
                    : data.status === 'HIGH_RISK'
                    ? 'bg-orange-100 text-orange-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {data.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Flood Depth</span>
                <span className="text-slate-800 font-bold text-sm">{data.flood_depth?.toFixed(2) || '0.00'} m</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Flooded Portion</span>
                <span className="text-slate-800 font-bold text-sm">{data.flooded_portion_pct || 0}%</span>
              </div>
            </div>

            <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100">
              <span className="text-blue-900 font-bold block mb-1">Accessibility Assessment:</span>
              <p className="text-slate-600 leading-relaxed text-[11px]">
                {data.reason || 'Normal road operating condition.'}
              </p>
            </div>
          </>
        )}

        {/* HOSPITAL DETAILS */}
        {type === 'hospital' && (
          <>
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Facility Type</span>
              <span className="text-slate-800 font-bold">{data.type}</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100">
                <span className="text-emerald-700 block text-[10px] uppercase font-bold">Available Beds</span>
                <span className="text-emerald-900 font-bold text-base">{data.available_beds} / {data.total_beds}</span>
              </div>
              <div className="p-2.5 bg-blue-50 rounded-xl border border-blue-100">
                <span className="text-blue-700 block text-[10px] uppercase font-bold">Available ICU</span>
                <span className="text-blue-900 font-bold text-base">{data.available_icu} / {data.total_icu}</span>
              </div>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
              <span className="text-slate-600">Capacity Load</span>
              <span className="font-bold text-slate-800">{data.capacity_utilization}%</span>
            </div>

            {data.specialties && (
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Specialties</span>
                <div className="flex flex-wrap gap-1">
                  {data.specialties.map((s: string) => (
                    <span key={s} className="px-1.5 py-0.5 bg-white border border-slate-200 text-slate-600 rounded text-[10px]">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* AMBULANCE DETAILS */}
        {type === 'ambulance' && (
          <>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-600 font-medium">Mission Status</span>
              <span className="px-2 py-0.5 rounded-full font-bold text-[11px] bg-blue-100 text-blue-800">
                {data.status}
              </span>
            </div>

            {data.status === 'TRAPPED_IN_FLOOD' && (
              <div className="p-3 bg-red-100 rounded-2xl border-2 border-red-500 text-xs text-red-950 space-y-1 animate-pulse">
                <span className="font-extrabold text-red-900 flex items-center gap-1.5 text-xs">
                  <span>🆘</span>
                  <span>VEHICLE TRAPPED IN FLOODWATERS</span>
                </span>
                <p className="text-[11px] text-red-800 leading-snug">
                  Ambulance stalled due to deep floodwaters. Vehicle immobilised. Central Command notified for NDRF boat extraction.
                </p>
              </div>
            )}

            {data.status === 'RELOCATING_TO_SAFETY' && (
              <div className="p-3 bg-amber-50 rounded-2xl border-2 border-amber-400 text-xs text-amber-950 space-y-1">
                <span className="font-extrabold text-amber-900 flex items-center gap-1.5 text-xs">
                  <span>🛡️</span>
                  <span>AUTONOMOUS FLOOD EVACUATION</span>
                </span>
                <p className="text-[11px] text-amber-800 leading-snug">
                  Proactively relocating to safe high-ground base ({data.safe_staging_name || 'Safe Core'}) before rising water cuts off staging post.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Vehicle Unit</span>
                <span className="text-slate-800 font-bold">{data.ambulance_id} ({data.type})</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Assigned Staging</span>
                <span className="text-slate-800 font-bold">Zone {data.assigned_zone}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Patients Carrying</span>
                <span className={`font-bold text-sm ${data.patients_onboard > 0 ? 'text-amber-600' : 'text-slate-700'}`}>
                  👥 {data.patients_onboard || 0} / 2 {data.patients_onboard > 0 ? 'Onboard' : 'Available'}
                </span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Operating Speed</span>
                <span className="text-slate-800 font-bold text-sm">{data.speed_kmh || 45} km/h</span>
              </div>
            </div>

            {data.active_route && (
              <div className="space-y-2">
                <GoogleMapsNavHUD
                  activeRoute={data.active_route.route_coordinates}
                  routeProgress={data.route_progress || 0}
                  destinationName={data.target_hospital_name || data.safe_staging_name || 'Designated Target'}
                  speedKmh={data.speed_kmh}
                  status={data.status}
                  isTrapped={data.is_trapped || data.status === 'TRAPPED_IN_FLOOD'}
                />

                <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-100 space-y-2">
                  <div className="flex items-center justify-between font-bold text-blue-900">
                    <span>Active Destination</span>
                    <span>ETA: {data.eta_minutes.toFixed(1)} min</span>
                  </div>
                  <div className="text-[11px] text-slate-600 flex justify-between">
                    <span>Distance: {data.active_route.distance_km} km</span>
                    <span>Risk: <strong className={data.active_route.risk_rating === 'LOW' ? 'text-emerald-700' : 'text-amber-700'}>{data.active_route.risk_rating}</strong></span>
                  </div>
                  {data.active_route.explanation && (
                    <div className="p-2 bg-white/90 rounded-lg border border-blue-200/60 text-[11px] text-blue-950 font-medium leading-relaxed">
                      <span className="text-blue-700 font-bold block mb-0.5">🛡️ Route Selection Decision:</span>
                      <span>{data.active_route.explanation}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* ZONE DETAILS */}
        {type === 'zone' && (
          <>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-600 font-medium">Disaster Risk Level</span>
              <span
                className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
                  data.risk_level === 'LOW'
                    ? 'bg-emerald-100 text-emerald-800'
                    : data.risk_level === 'MEDIUM'
                    ? 'bg-amber-100 text-amber-800'
                    : data.risk_level === 'HIGH'
                    ? 'bg-orange-100 text-orange-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {data.risk_level} (Score: {data.risk_score})
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Population</span>
                <span className="text-slate-800 font-bold text-sm">{(data.population / 1000).toFixed(0)}k</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">ML Predicted Demand</span>
                <span className="text-blue-700 font-bold text-sm">{data.predicted_demand} calls</span>
              </div>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
              <span className="text-slate-600">Medical Coverage Index</span>
              <span className="font-bold text-slate-800">{(data.medical_coverage_score * 100).toFixed(0)}%</span>
            </div>
          </>
        )}

        {/* INCIDENT DETAILS */}
        {type === 'incident' && (() => {
          const assignedAmb = state?.ambulances.find((a) => a.ambulance_id === data.assigned_ambulance_id);
          const isCallReceived = assignedAmb?.status === 'CALL_RECEIVED';
          const isEnRouteScene = assignedAmb?.status === 'EN_ROUTE_TO_PATIENT';
          const isEnRouteHosp = assignedAmb?.status === 'EN_ROUTE_TO_HOSPITAL';
          const isAtPatient = assignedAmb?.status === 'AT_PATIENT';

          return (
            <>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-600 font-medium">Incident Severity</span>
                <span className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
                  data.severity === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                  data.severity === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                  'bg-amber-100 text-amber-800'
                }`}>
                  {data.severity}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-600 font-medium">Status</span>
                <span className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
                  data.status === 'UNREACHABLE_FLOODED' ? 'bg-purple-100 text-purple-900 border border-purple-300' :
                  data.status === 'PREDICTED_FLOOD_SUBMERGENCE' ? 'bg-rose-100 text-rose-900 border border-rose-300' :
                  data.status === 'AMBULANCE_TRAPPED' ? 'bg-red-100 text-red-900 border border-red-300' :
                  data.status === 'DISPATCHED' ? 'bg-blue-100 text-blue-800' :
                  data.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-800' :
                  'bg-amber-100 text-amber-800'
                }`}>
                  {data.status ? data.status.replace(/_/g, ' ') : 'PENDING DISPATCH'}
                </span>
              </div>

              {data.status === 'UNREACHABLE_FLOODED' && (
                <div className="p-3 bg-purple-50 rounded-2xl border-2 border-purple-400 text-xs text-purple-950 space-y-1">
                  <span className="font-extrabold text-purple-900 flex items-center gap-1.5 text-xs">
                    <span>🚤</span>
                    <span>NDRF / SDRF BOAT RESCUE REQUIRED</span>
                  </span>
                  <p className="text-[11px] text-purple-800 leading-snug">
                    {data.unreachable_reason || 'Incident location is submerged in floodwaters. Ground road ambulances cannot reach. Ground dispatch stopped.'}
                  </p>
                </div>
              )}

              {data.status === 'PREDICTED_FLOOD_SUBMERGENCE' && (
                <div className="p-3 bg-rose-50 rounded-2xl border-2 border-rose-400 text-xs text-rose-950 space-y-1">
                  <span className="font-extrabold text-rose-900 flex items-center gap-1.5 text-xs">
                    <span>⚠️</span>
                    <span>PREDICTED FLOOD INUNDATION CUTOFF</span>
                  </span>
                  <p className="text-[11px] text-rose-800 leading-snug">
                    {data.unreachable_reason || 'Incident location predicted to be submerged by floodwaters before vehicle arrival. Ground response aborted.'}
                  </p>
                </div>
              )}

              {data.status === 'AMBULANCE_TRAPPED' && (
                <div className="p-3 bg-red-100 rounded-2xl border-2 border-red-500 text-xs text-red-950 space-y-1">
                  <span className="font-extrabold text-red-900 flex items-center gap-1.5 text-xs">
                    <span>🆘</span>
                    <span>ASSIGNED AMBULANCE TRAPPED IN FLOOD</span>
                  </span>
                  <p className="text-[11px] text-red-800 leading-snug">
                    {data.unreachable_reason || 'The responding unit became trapped in rising floodwaters and is immobilised. Urgent assistance requested.'}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Patients</span>
                  <span className="text-slate-800 font-bold text-sm">{data.patient_count}</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Assigned Unit</span>
                  <span className="text-blue-600 font-bold text-sm">{data.assigned_ambulance_id || 'Evaluating...'}</span>
                </div>
              </div>

              {assignedAmb && (
                <div className="p-3 bg-blue-50/80 rounded-2xl border border-blue-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                      <AmbulanceIcon className="w-4 h-4 text-blue-600" />
                      <span>{assignedAmb.ambulance_id} ({assignedAmb.type})</span>
                    </span>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-600 text-white">
                      {assignedAmb.status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-600 flex items-center justify-between">
                    <span>ETA: <strong className="text-slate-900">{assignedAmb.eta_minutes.toFixed(1)}m</strong></span>
                    <span>Distance: <strong className="text-slate-900">{assignedAmb.active_route?.distance_km ?? 0} km</strong></span>
                  </div>

                  <div className="text-[11px] text-slate-600 flex items-center justify-between">
                    <span>Load: <strong className="text-slate-900">{assignedAmb.patients_onboard || 0} / 2 Patients</strong></span>
                    <span>Speed: <strong className="text-slate-900">{assignedAmb.speed_kmh || 45} km/h</strong></span>
                  </div>

                  {assignedAmb.active_route?.explanation && (
                    <div className="p-2 bg-white/90 rounded-lg border border-blue-200 text-[10px] text-blue-950 font-medium leading-relaxed">
                      <span className="text-blue-700 font-bold block mb-0.5">🛡️ Why this route:</span>
                      <span>{assignedAmb.active_route.explanation}</span>
                    </div>
                  )}

                  {isCallReceived && (
                    <button
                      onClick={() => acceptCall(assignedAmb.ambulance_id)}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2 mt-1"
                    >
                      <Check className="w-4 h-4" />
                      <span>ACCEPT CALL & SIMULATE DISPATCH</span>
                    </button>
                  )}

                  {isEnRouteScene && (
                    <div className="p-2 bg-emerald-100 text-emerald-900 rounded-xl text-[11px] font-semibold flex items-center gap-2 animate-pulse">
                      <Navigation2 className="w-3.5 h-3.5 text-emerald-700 rotate-45" />
                      <span>Vehicle actively driving to patient scene...</span>
                    </div>
                  )}

                  {isAtPatient && (
                    <div className="p-2 bg-amber-100 text-amber-900 rounded-xl text-[11px] font-semibold flex items-center gap-2">
                      <span>📍 At patient scene — Triage in progress.</span>
                    </div>
                  )}

                  {isEnRouteHosp && (
                    <div className="p-2 bg-blue-100 text-blue-900 rounded-xl text-[11px] font-semibold flex items-center gap-2 animate-pulse">
                      <Navigation2 className="w-3.5 h-3.5 text-blue-700 rotate-45" />
                      <span>Transporting to {assignedAmb.target_hospital_name || 'Hospital'}...</span>
                    </div>
                  )}
                </div>
              )}

              {data.assigned_ambulance_id && onSwitchTab && (
                <button
                  onClick={() => onSwitchTab('ambulance')}
                  className="w-full py-2.5 bg-slate-900 hover:bg-black text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <AmbulanceIcon className="w-4 h-4" />
                  <span>OPEN IN-VEHICLE TERMINAL ({data.assigned_ambulance_id})</span>
                </button>
              )}

              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Location</span>
                <span className="text-slate-700 font-medium text-[11px]">
                  Zone {data.zone_id || 'Pune Basin'} [{data.coordinates?.[0]?.toFixed(4)}, {data.coordinates?.[1]?.toFixed(4)}]
                </span>
              </div>
            </>
          );
        })()}

        {/* CAMP DETAILS */}
        {type === 'camp' && (
          <>
            <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100">
              <span className="text-emerald-700 block text-[10px] uppercase font-bold">Operational Triage Unit</span>
              <span className="text-emerald-900 font-bold">{data.camp_id} ({data.zone_name})</span>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
              <span className="text-slate-600">Field Capacity</span>
              <span className="font-bold text-slate-800">{data.capacity} Patients</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

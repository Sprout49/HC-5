import React, { useMemo, useState } from 'react';
import { 
  Navigation, 
  CornerUpLeft, 
  CornerUpRight, 
  ArrowUp, 
  ArrowUpLeft, 
  ArrowUpRight, 
  RotateCcw, 
  Flag, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp, 
  Clock, 
  Gauge, 
  AlertTriangle 
} from 'lucide-react';

interface GoogleMapsNavHUDProps {
  activeRoute?: number[][]; // [[lng, lat], ...]
  routeProgress?: number;   // 0.0 to 1.0
  destinationName?: string;
  speedKmh?: number;
  status?: string;
  isTrapped?: boolean;
}

interface StepInstruction {
  index: number;
  type: 'straight' | 'left' | 'right' | 'slight-left' | 'slight-right' | 'u-turn' | 'arrive';
  instruction: string;
  distanceMeters: number;
  cumulativeDistanceMeters: number;
}

// Haversine distance in meters
function haversineMeters(coord1: number[], coord2: number[]): number {
  const [lng1, lat1] = coord1;
  const [lng2, lat2] = coord2;
  const R = 6371000; // meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Bearing in degrees from coord1 to coord2
function calculateBearing(coord1: number[], coord2: number[]): number {
  const [lng1, lat1] = coord1;
  const [lng2, lat2] = coord2;
  const y = Math.sin((lng2 - lng1) * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180);
  const x =
    Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
    Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos((lng2 - lng1) * Math.PI / 180);
  const brng = Math.atan2(y, x) * 180 / Math.PI;
  return (brng + 360) % 360;
}

export const GoogleMapsNavHUD: React.FC<GoogleMapsNavHUDProps> = ({
  activeRoute,
  routeProgress = 0,
  destinationName = 'Destination',
  speedKmh = 35,
  status = 'EN_ROUTE',
  isTrapped = false,
}) => {
  const [showFullItinerary, setShowFullItinerary] = useState(false);

  // Synthesize realistic turn-by-turn steps from coordinate polyline
  const { steps, totalDistanceMeters } = useMemo(() => {
    if (!activeRoute || activeRoute.length < 2) {
      return { steps: [], totalDistanceMeters: 0 };
    }

    const generatedSteps: StepInstruction[] = [];
    let cumDist = 0;

    // Segment lengths
    const segmentDistances: number[] = [];
    for (let i = 0; i < activeRoute.length - 1; i++) {
      const d = haversineMeters(activeRoute[i], activeRoute[i + 1]);
      segmentDistances.push(d);
      cumDist += d;
    }

    if (activeRoute.length === 2) {
      generatedSteps.push({
        index: 0,
        type: 'straight',
        instruction: `Proceed directly along corridor towards ${destinationName}`,
        distanceMeters: Math.round(segmentDistances[0] || 350),
        cumulativeDistanceMeters: segmentDistances[0] || 350,
      });
      generatedSteps.push({
        index: 1,
        type: 'arrive',
        instruction: `Arrive at ${destinationName}`,
        distanceMeters: 0,
        cumulativeDistanceMeters: cumDist,
      });
      return { steps: generatedSteps, totalDistanceMeters: cumDist };
    }

    // Traverse route and group bearings into recognizable maneuvers
    let currentStepDist = segmentDistances[0];
    let prevBearing = calculateBearing(activeRoute[0], activeRoute[1]);

    for (let i = 1; i < activeRoute.length - 1; i++) {
      const segDist = segmentDistances[i];
      const nextBearing = calculateBearing(activeRoute[i], activeRoute[i + 1]);
      
      let angleDiff = nextBearing - prevBearing;
      while (angleDiff > 180) angleDiff -= 360;
      while (angleDiff < -180) angleDiff += 360;

      // Noticeable turns (> 25 degrees) or long straightaways (> 750m)
      if (Math.abs(angleDiff) >= 28 || currentStepDist > 750) {
        let type: StepInstruction['type'] = 'straight';
        let turnDesc = 'Continue straight';

        if (angleDiff > 135 || angleDiff < -135) {
          type = 'u-turn';
          turnDesc = 'Make a U-Turn';
        } else if (angleDiff >= 65) {
          type = 'right';
          turnDesc = 'Turn Right';
        } else if (angleDiff >= 28) {
          type = 'slight-right';
          turnDesc = 'Slight Right onto connecting road';
        } else if (angleDiff <= -65) {
          type = 'left';
          turnDesc = 'Turn Left';
        } else if (angleDiff <= -28) {
          type = 'slight-left';
          turnDesc = 'Slight Left onto connecting road';
        }

        generatedSteps.push({
          index: generatedSteps.length,
          type,
          instruction: turnDesc,
          distanceMeters: Math.round(currentStepDist),
          cumulativeDistanceMeters: Math.round(cumDist),
        });

        currentStepDist = segDist;
        prevBearing = nextBearing;
      } else {
        currentStepDist += segDist;
      }
    }

    // Add remaining distance to final target
    generatedSteps.push({
      index: generatedSteps.length,
      type: 'straight',
      instruction: `Continue towards ${destinationName}`,
      distanceMeters: Math.round(currentStepDist),
      cumulativeDistanceMeters: Math.round(cumDist),
    });

    // Arrival step
    generatedSteps.push({
      index: generatedSteps.length,
      type: 'arrive',
      instruction: `Arrive at ${destinationName}`,
      distanceMeters: 0,
      cumulativeDistanceMeters: Math.round(cumDist),
    });

    return { steps: generatedSteps, totalDistanceMeters: cumDist };
  }, [activeRoute, destinationName]);

  // Current position and remaining values
  const currentTraveledDist = (totalDistanceMeters || 1000) * Math.min(1.0, Math.max(0.0, routeProgress));
  const remainingTotalDist = Math.max(0, (totalDistanceMeters || 1000) - currentTraveledDist);
  
  // Find which step we are currently executing
  let accumulated = 0;
  let activeStepIndex = 0;
  for (let i = 0; i < steps.length; i++) {
    accumulated += steps[i].distanceMeters;
    if (accumulated >= currentTraveledDist) {
      activeStepIndex = i;
      break;
    }
  }

  const isArrived = routeProgress >= 0.97 || status === 'COMPLETED' || status === 'AT_HOSPITAL';
  const currentStep = isArrived ? steps[steps.length - 1] : (steps[activeStepIndex] || steps[0]);
  const nextStep = steps[activeStepIndex + 1];

  // Distance until the next turn maneuver
  const distToNextManeuver = Math.max(15, Math.round(accumulated - currentTraveledDist));

  // Estimated time remaining (in minutes) based on ambulance speed (fallback 30 km/h)
  const effectiveSpeedKmh = Math.max(15, speedKmh || 30);
  const etaMinutes = Math.max(1, Math.round((remainingTotalDist / (effectiveSpeedKmh * 1000 / 60))));

  const renderManeuverIcon = (type?: string, className: string = "w-9 h-9 text-emerald-400") => {
    switch (type) {
      case 'left':
        return <CornerUpLeft className={className} />;
      case 'right':
        return <CornerUpRight className={className} />;
      case 'slight-left':
        return <ArrowUpLeft className={className} />;
      case 'slight-right':
        return <ArrowUpRight className={className} />;
      case 'u-turn':
        return <RotateCcw className={className} />;
      case 'arrive':
        return <Flag className={className} />;
      default:
        return <ArrowUp className={className} />;
    }
  };

  if (!activeRoute || activeRoute.length < 2) {
    return null;
  }

  return (
    <div className="w-full flex flex-col gap-2 my-2 transition-all">
      {/* GOOGLE MAPS STYLE TOP NAVIGATION BANNER */}
      <div className="bg-gradient-to-r from-emerald-950/95 via-slate-900/95 to-emerald-900/90 border-2 border-emerald-500/40 rounded-2xl p-4 shadow-2xl backdrop-blur-md relative overflow-hidden text-white">
        {/* Glow accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500 animate-pulse" />

        <div className="flex items-center justify-between gap-4">
          {/* Large Turn Maneuver Icon Box */}
          <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-emerald-500/20 border-2 border-emerald-400/50 flex flex-col items-center justify-center shadow-lg shadow-emerald-950/60">
            {isArrived ? (
              <CheckCircle2 className="w-10 h-10 text-emerald-300 animate-bounce" />
            ) : (
              renderManeuverIcon(currentStep?.type, "w-10 h-10 text-emerald-300 drop-shadow-md")
            )}
          </div>

          {/* Turn-by-Turn Instruction Text */}
          <div className="flex-1 min-w-0">
            {isArrived ? (
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500 text-slate-950 uppercase tracking-wider">
                  Arrived
                </span>
                <h3 className="text-xl font-black text-emerald-200 mt-1 truncate">
                  You Have Reached {destinationName}
                </h3>
                <p className="text-xs text-emerald-300/80">Navigation Completed • Standby for Patient Handover</p>
              </div>
            ) : (
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-emerald-400 tracking-tight font-mono">
                    {distToNextManeuver >= 1000 
                      ? `In ${(distToNextManeuver / 1000).toFixed(1)} km` 
                      : `In ${distToNextManeuver} m`}
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300/70 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/30">
                    Live GPS Routing
                  </span>
                </div>
                
                <h3 className="text-lg font-bold text-white mt-0.5 leading-snug truncate">
                  {currentStep?.instruction || `Proceed towards ${destinationName}`}
                </h3>

                {nextStep && nextStep.type !== 'arrive' && (
                  <p className="text-xs text-slate-300/90 flex items-center gap-1.5 mt-1 font-medium">
                    <span className="text-emerald-400">Then:</span>
                    <span>{nextStep.instruction}</span>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Trapped Alert or Route Mode Pill */}
          {isTrapped ? (
            <div className="flex-shrink-0 bg-red-600/90 border border-red-400 px-3 py-2 rounded-xl flex items-center gap-2 animate-pulse text-xs font-bold text-white shadow-lg">
              <AlertTriangle className="w-4 h-4 text-amber-200" />
              <span>FLOOD HAZARD</span>
            </div>
          ) : (
            <button
              onClick={() => setShowFullItinerary(!showFullItinerary)}
              className="flex-shrink-0 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-600/60 px-3 py-2 rounded-xl flex items-center gap-1.5 text-xs font-semibold text-slate-200 transition-colors shadow-sm"
              title="Toggle Step-by-Step Directions"
            >
              <span>{steps.length} Steps</span>
              {showFullItinerary ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>

        {/* Dynamic Route Progress Bar */}
        <div className="mt-3 w-full bg-slate-800/80 rounded-full h-2 overflow-hidden border border-slate-700/50">
          <div 
            className="bg-gradient-to-r from-teal-400 via-emerald-400 to-green-300 h-full rounded-full transition-all duration-300 ease-out shadow-sm shadow-emerald-400"
            style={{ width: `${Math.min(100, Math.round(routeProgress * 100))}%` }}
          />
        </div>

        {/* Bottom Metrics Bar (ETA, Distance Remaining, Speed) */}
        <div className="mt-3 pt-2.5 border-t border-emerald-500/20 flex items-center justify-between text-xs text-slate-300 font-medium">
          <div className="flex items-center gap-1.5 text-emerald-300">
            <Clock className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-white text-sm">{isArrived ? '0 min' : `${etaMinutes} min`}</span>
            <span className="text-slate-400 text-[11px]">remaining</span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-200 font-mono">
            <Navigation className="w-3.5 h-3.5 text-teal-400" />
            <span className="font-bold text-white">
              {remainingTotalDist >= 1000 
                ? `${(remainingTotalDist / 1000).toFixed(1)} km` 
                : `${Math.round(remainingTotalDist)} m`}
            </span>
            <span className="text-slate-400 text-[11px]">to go</span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-200 font-mono">
            <Gauge className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-bold text-cyan-300">{Math.round(speedKmh || 32)} km/h</span>
          </div>
        </div>
      </div>

      {/* EXPANDABLE FULL STEP-BY-STEP ITINERARY */}
      {showFullItinerary && (
        <div className="bg-slate-900/95 border border-slate-700/80 rounded-2xl p-4 shadow-xl backdrop-blur-md max-h-60 overflow-y-auto space-y-2 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
            <span>Maneuver Itinerary</span>
            <span>Est. Distance</span>
          </div>

          {steps.map((st, idx) => {
            const isCurrent = idx === activeStepIndex && !isArrived;
            const isPast = idx < activeStepIndex || isArrived;

            return (
              <div 
                key={idx}
                className={`flex items-center justify-between p-2 rounded-xl transition-colors ${
                  isCurrent 
                    ? 'bg-emerald-950/70 border border-emerald-500/40 text-emerald-200' 
                    : isPast 
                    ? 'text-slate-500 line-through opacity-60' 
                    : 'text-slate-300 hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded-lg ${isCurrent ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
                    {renderManeuverIcon(st.type, "w-4 h-4")}
                  </div>
                  <div>
                    <div className={`font-semibold ${isCurrent ? 'text-white font-bold' : ''}`}>
                      {st.instruction}
                    </div>
                    {isCurrent && (
                      <span className="text-[10px] text-emerald-400 font-medium">Next Maneuver</span>
                    )}
                  </div>
                </div>

                <div className="font-mono text-slate-400 text-right">
                  {st.distanceMeters > 0 ? (
                    st.distanceMeters >= 1000 ? `${(st.distanceMeters / 1000).toFixed(1)} km` : `${st.distanceMeters} m`
                  ) : (
                    'Destination'
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

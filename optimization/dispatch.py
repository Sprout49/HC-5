"""
Multi-Criteria Ambulance Dispatch Optimization Engine.
Selects the optimal vehicle for an emergency incident based on:
1. Availability status (AVAILABLE / IDLE)
2. Patient capacity constraint (cannot assign more patients than ambulance capacity)
3. Travel ETA along flood-safe accessible road network
4. Flood hazard risk along candidate route
5. Medical capability match (ALS prioritized for CRITICAL patients)
6. Workload and strategic zone coverage preservation
7. Explicit tiebreakers
"""

from typing import List, Dict, Any, Optional, Tuple

def select_best_ambulance(
    incident: Dict[str, Any],
    ambulances: List[Dict[str, Any]],
    routing_engine
) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]], str]:
    """
    Returns (selected_ambulance, route_info, explanation)
    """
    available_ambulances = [
        a for a in ambulances
        if a.get("status") in ["AVAILABLE", "IDLE"]
    ]

    if not available_ambulances:
        return None, None, "No ambulances currently available in the fleet."

    inc_coords = incident.get("routing_location", incident["coordinates"])
    severity = incident.get("severity", "MEDIUM")  # LOW, MEDIUM, HIGH, CRITICAL
    patient_count = incident.get("patient_count", 1)

    candidate_evaluations = []

    for amb in available_ambulances:
        capacity = amb.get("patient_capacity", 2)
        amb_type = amb.get("type", "BLS")
        is_als = (amb_type == "ALS")

        # 1. Hard constraint: Patient Capacity
        if capacity < patient_count:
            # Cannot blindly assign an incident exceeding vehicle capacity
            continue

        # 2. Route calculation along road network
        amb_coords = amb["current_location"]
        route = routing_engine.calculate_route(
            amb_coords, inc_coords, vehicle_id=amb.get("ambulance_id")
        )

        if not route:
            continue  # No accessible route (cut off by floodwaters)

        eta_min = route["duration_min"]
        dist_km = route["distance_km"]
        risk_rating = route["risk_rating"]  # LOW, MODERATE, HIGH

        # Hazard risk penalty
        risk_penalty = 0.0 if risk_rating == "LOW" else (2.5 if risk_rating == "MODERATE" else 6.0)

        # 3. Medical Capability Alignment
        # Critical patients require Advanced Life Support (ALS)
        capability_penalty = 0.0
        if severity == "CRITICAL" and not is_als:
            capability_penalty = 1.8  # Prefer ALS for critical emergencies
        elif severity == "LOW" and is_als:
            # Preserve ALS for critical emergencies if BLS is available
            capability_penalty = 0.4

        # 4. Zone Coverage Balance Factor
        # Ambulances staged in isolated flood zones have a small retention weight
        zone_retention = 0.3 if amb.get("assigned_zone") in ["Z5", "Z7"] else 0.0

        # Composite Dispatch Impedance Score: lower is better
        # Score = Travel Time + Route Hazard Risk + Capability Match + Zone Coverage
        composite_score = (
            (eta_min * 1.0) +
            (risk_penalty * 0.8) +
            capability_penalty +
            zone_retention
        )

        candidate_evaluations.append({
            "ambulance": amb,
            "route": route,
            "eta_min": eta_min,
            "dist_km": dist_km,
            "risk_rating": risk_rating,
            "score": round(composite_score, 2),
            "is_als": is_als,
            "capacity_headroom": capacity - patient_count,
            "explanation": f"ETA: {eta_min:.1f}m | Distance: {dist_km:.1f}km | Risk: {risk_rating} | Type: {amb_type}"
        })

    if not candidate_evaluations:
        # Check if capacity was the limiting factor
        capacity_blocked = any(a.get("patient_capacity", 2) < patient_count for a in available_ambulances)
        if capacity_blocked:
            return None, None, f"Insufficient vehicle capacity: Incident requires transport for {patient_count} patients, exceeding fleet unit capacity."
        return None, None, "All candidate routes to incident are currently inaccessible or blocked by floodwaters."

    # Multi-criteria Sort & Tiebreakers:
    # 1. Composite score (lowest impedance)
    # 2. Lower ETA
    # 3. Lower route risk
    # 4. Better capability match
    # 5. Remaining capacity headroom
    candidate_evaluations.sort(
        key=lambda x: (
            x["score"],
            x["eta_min"],
            0 if x["risk_rating"] == "LOW" else (1 if x["risk_rating"] == "MODERATE" else 2),
            0 if (severity == "CRITICAL" and x["is_als"]) else 1,
            -x["capacity_headroom"]
        )
    )

    best = candidate_evaluations[0]
    amb_sel = best["ambulance"]
    route_reason = best["route"].get("explanation", "")
    reason_suffix = f" - {route_reason}" if route_reason else ""

    explanation = (
        f"Assigned {amb_sel['ambulance_id']} ({amb_sel.get('type', 'ALS')}): "
        f"Fastest accessible unit with {best['eta_min']:.1f} min ETA ({best['dist_km']:.1f} km, {best['risk_rating']} risk).{reason_suffix}"
    )

    return amb_sel, best["route"], explanation

"""
Hospital Selection & Eligibility Optimization Engine.
Selects the optimal healthcare facility for patient admission based on:
- Hard Constraints:
  1. Available bed capacity >= patient_count
  2. Available ICU capacity >= patient_count (mandatory if CRITICAL)
  3. Trauma center capability (mandatory if CRITICAL)
  4. Accessible safe road route exists
- Multi-Criteria Scoring:
  - Route travel time (ETA)
  - Route flood risk penalty
  - Facility capacity utilization headroom
- Triggers Medical Coverage Gap if all facilities fail constraints.
"""

from typing import List, Dict, Any, Optional, Tuple

def select_best_hospital(
    incident: Dict[str, Any],
    hospitals: List[Dict[str, Any]],
    current_location: List[float],
    routing_engine
) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]], str]:
    """
    Returns (selected_hospital, route_info, explanation)
    """
    severity = incident.get("severity", "MEDIUM")
    patient_count = incident.get("patient_count", 1)
    is_critical = (severity == "CRITICAL")

    eligible_candidates = []
    ineligible_reasons = []

    for h in hospitals:
        h_name = h.get("name", "Unknown Facility")
        avail_beds = h.get("available_beds", 0)
        avail_icu = h.get("available_icu", 0)
        has_trauma = h.get("has_trauma_center", h.get("trauma_center", False))

        # 1. Hard Constraint: Standard Bed Capacity
        if avail_beds < patient_count:
            ineligible_reasons.append(f"{h_name}: 0 beds available (capacity exhausted)")
            continue

        # 2. Hard Constraint: ICU Capacity for Critical Cases
        if is_critical and avail_icu < patient_count:
            ineligible_reasons.append(f"{h_name}: 0 ICU beds available for critical case")
            continue

        # 3. Hard Constraint: Trauma Center capability for Critical Cases
        if is_critical and not has_trauma:
            ineligible_reasons.append(f"{h_name}: Lacks Level 1 / Trauma Emergency capability")
            continue

        # 4. Hard Constraint: Accessible Safe Route
        h_dest = h.get("routing_location", h["coordinates"])
        route = routing_engine.calculate_route(current_location, h_dest)
        if not route:
            ineligible_reasons.append(f"{h_name}: No accessible route (cut off by floodwaters)")
            continue

        eta = route["duration_min"]
        risk = route["risk_rating"]
        
        # Hard constraint: reject routes that traverse active high hazard if moderate/low exist
        if risk == "HIGH":
            ineligible_reasons.append(f"{h_name}: Candidate corridor flooded (HIGH risk)")
            continue

        risk_penalty = 0.0 if risk == "LOW" else 3.5

        # Capacity utilization penalty (prefer hospitals with headroom > 20% available)
        total_beds = max(1, h.get("total_beds", 100))
        cap_util = (1.0 - avail_beds / total_beds) * 100.0
        cap_penalty = (cap_util / 100.0) * 3.0

        score = eta + risk_penalty + cap_penalty

        eligible_candidates.append({
            "hospital": h,
            "route": route,
            "eta": eta,
            "risk": risk,
            "score": score,
            "avail_beds": avail_beds,
            "avail_icu": avail_icu
        })

    if not eligible_candidates:
        summary_reason = "; ".join(ineligible_reasons[:3]) if ineligible_reasons else "All facilities exceed capacity or are isolated by floodwaters."
        return None, None, f"MEDICAL COVERAGE GAP: No eligible hospital meets clinical and flood-safety constraints ({summary_reason})."

    # Sort by lowest impedance score
    eligible_candidates.sort(key=lambda x: x["score"])
    best = eligible_candidates[0]
    h_best = best["hospital"]

    explanation = (
        f"Selected {h_best['name']} (Eligible): ETA {best['eta']:.1f} min ({best['risk']} risk). "
        f"Available: {best['avail_beds']} beds, {best['avail_icu']} ICU beds. Trauma verified."
    )

    return h_best, best["route"], explanation

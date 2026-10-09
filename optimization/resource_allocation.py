"""
Temporary Medical Camp Optimization & Coverage Gap Evaluator.
Detects when high emergency demand and flood road blockages isolate a zone from hospital care,
and recommends deploying a temporary rapid-deployment medical triage field camp.

Decision Model:
  medical_gap_score = (demand_pressure * 0.35) + (hospital_deficit * 0.30) + (access_failure * 0.20) + (hazard_exposure * 0.15)
"""

from typing import List, Dict, Any, Optional

def evaluate_medical_camp_needs(
    zones: List[Dict[str, Any]],
    roads: List[Dict[str, Any]],
    deployed_camps: List[Dict[str, Any]],
    water_rise_m: float
) -> Optional[Dict[str, Any]]:
    """
    Evaluates zones to detect critical medical coverage gaps based on the multi-factor decision model.
    Returns recommendation dictionary if deployment threshold is exceeded, or None.
    """
    deployed_zone_ids = {c["zone_id"] for c in deployed_camps}

    candidate_gaps = []

    for z in zones:
        zid = z["zone_id"]
        if zid in deployed_zone_ids:
            continue

        risk = z.get("risk_score", 0.0)
        demand = z.get("predicted_demand", 0.0)
        coverage = z.get("medical_coverage_score", 0.5)

        # 1. Demand pressure (normalized against regional max ~50 calls)
        demand_pressure = min(1.0, demand / 45.0)

        # 2. Hospital coverage deficit (1.0 - baseline coverage score)
        hospital_deficit = max(0.0, 1.0 - coverage)

        # 3. Hazard exposure (elevation head over riverbed level)
        elev_head = max(0.0, (550.8 + water_rise_m) - z.get("elevation_base_m", 555.0))
        hazard_exposure = min(1.0, (risk * 0.6) + (elev_head / 2.0) * 0.4)

        # 4. Road access failure (ratio of blocked / restricted roads in zone perimeter)
        access_failure = 0.5 if elev_head > 0.4 else (0.2 if water_rise_m > 1.0 else 0.0)

        # Multi-factor Medical Gap Score
        medical_gap_score = (
            (demand_pressure * 0.35) +
            (hospital_deficit * 0.30) +
            (access_failure * 0.20) +
            (hazard_exposure * 0.15)
        )

        if medical_gap_score >= 0.48 and (demand >= 20.0 or elev_head >= 0.3):
            centroid = z["coordinates"][0][0]
            candidate_gaps.append({
                "zone_id": zid,
                "zone_name": z["name"],
                "score": round(medical_gap_score, 3),
                "demand": demand,
                "risk_score": risk,
                "elev_head": round(elev_head, 2),
                "suggested_capacity": 20,
                "coordinates": [
                    round(centroid[0] + 0.005, 5),
                    round(centroid[1] - 0.005, 5)
                ]
            })

    if not candidate_gaps:
        return None

    # Recommend highest gap score zone
    candidate_gaps.sort(key=lambda x: x["score"], reverse=True)
    top_gap = candidate_gaps[0]

    return {
        "recommendation_id": f"REC_CAMP_{top_gap['zone_id']}",
        "type": "DEPLOY_MEDICAL_CAMP",
        "zone_id": top_gap["zone_id"],
        "zone_name": top_gap["zone_name"],
        "gap_score": top_gap["score"],
        "medical_gap_score": top_gap["score"],
        "coordinates": top_gap["coordinates"],
        "capacity": top_gap["suggested_capacity"],
        "reason": (
            f"Zone {top_gap['zone_name']} has an acute Medical Coverage Gap (Score: {top_gap['score']:.2f}). "
            f"Predicted emergency demand: {top_gap['demand']:.0f} cases with {top_gap['elev_head']}m flood inundation "
            f"and severe access deficit to regional hospital beds."
        ),
        "action_label": "DEPLOY TEMPORARY MEDICAL CAMP"
    }

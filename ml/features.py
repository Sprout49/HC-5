"""
Feature definitions and engineering for ML models in HC-05.
Combines real GIS attributes (elevation, population, river proximity)
with simulated flood condition signals (water level rise, duration, rainfall).
"""

from typing import Dict, Any, List
import numpy as np

def extract_zone_demand_features(zone: Dict[str, Any], flood_water_rise_m: float, sim_minute: float) -> List[float]:
    """
    Features for Model 1 (Emergency Demand Prediction):
    - Population (thousands)
    - Area (km2)
    - Population Density (pop / area)
    - Elevation base (m MSL)
    - River proximity (m)
    - Vulnerability score [0, 1]
    - Simulated flood water rise (m)
    - Effective flood exposure: max(0.0, flood_water_rise_m - (zone['elevation_base_m'] - 550.0))
    - Disaster elapsed time (hours)
    """
    pop_k = zone["population"] / 1000.0
    area = zone["area_km2"]
    density = pop_k / max(area, 0.1)
    elev = zone["elevation_base_m"]
    river_prox = zone["river_proximity_m"]
    vuln = zone["vulnerability_score"]
    
    # Hydraulic approximation of inundation head
    water_head = max(0.0, (550.0 + flood_water_rise_m) - elev)
    hours = sim_minute / 60.0

    return [
        pop_k,
        area,
        density,
        elev,
        river_prox,
        vuln,
        flood_water_rise_m,
        water_head,
        hours
    ]

def extract_zone_risk_features(zone: Dict[str, Any], flood_water_rise_m: float, active_demand: float, accessible_roads_pct: float) -> List[float]:
    """
    Features for Model 2 (Zone Risk Classification & Score):
    - Inundation water head (m)
    - Population exposed
    - Vulnerability index
    - Active emergency demand
    - Accessible road network fraction [0, 1]
    - Medical coverage baseline
    """
    elev = zone["elevation_base_m"]
    water_head = max(0.0, (550.0 + flood_water_rise_m) - elev)
    pop_exposed = (zone["population"] / 1000.0) * min(1.0, water_head / 1.5)
    
    return [
        water_head,
        pop_exposed,
        zone["vulnerability_score"],
        active_demand,
        accessible_roads_pct,
        zone["medical_coverage_score"]
    ]

RIVER_WAYPOINTS = [
    (73.820, 18.495),
    (73.839, 18.518),
    (73.858, 18.532),
    (73.872, 18.538),
    (73.888, 18.541),
    (73.918, 18.537)
]

def _calc_river_proximity_m(road: Dict[str, Any]) -> float:
    # If explicit river_proximity_m exists in props, use it
    if "river_proximity_m" in road:
        return float(road["river_proximity_m"])
    coords = road.get("coordinates")
    if not coords or len(coords) == 0:
        return 500.0
    mid_idx = len(coords) // 2
    rx, ry = coords[mid_idx][0], coords[mid_idx][1]
    
    # Approximate planar distance in meters for Pune lat/lng
    min_dist = float("inf")
    for wx, wy in RIVER_WAYPOINTS:
        dx = (rx - wx) * 111320.0 * np.cos(np.radians(18.52))
        dy = (ry - wy) * 110540.0
        dist = np.sqrt(dx * dx + dy * dy)
        if dist < min_dist:
            min_dist = dist
    return float(min_dist)

def extract_road_access_features(road: Dict[str, Any], flood_water_rise_m: float) -> List[float]:
    """
    Leakage-free features for Model 3 (Predictive Road Inundation / Accessibility):
    - Road elevation (m MSL)
    - Proximity to nearest river channel (m)
    - Upstream river surge height (m)
    - Road segment length (m)
    - Speed limit (km/h)
    - Is bridge (1.0 if bridge else 0.0)
    - Road class code (0=arterial, 1=primary, 2=secondary, 3=bridge)
    
    NOTE: Does NOT use direct thresholded flood depth as an input feature,
    preventing circular data leakage.
    """
    road_class_map = {"arterial": 0, "primary": 1, "secondary": 2, "bridge": 3}
    class_code = road_class_map.get(road.get("road_class", "primary"), 1)
    is_bridge = 1.0 if road.get("road_class") == "bridge" else 0.0
    elev = float(road.get("elevation_m", 555.0))
    river_prox = _calc_river_proximity_m(road)

    return [
        elev,
        river_prox,
        float(flood_water_rise_m),
        float(road.get("length_m", 500.0)),
        float(road.get("speed_limit_kmh", 45)),
        is_bridge,
        float(class_code)
    ]


"""
Simulation-derived dataset generator for HC-05.
Combines real Pune geography (zones, elevations, population, roads)
with controlled flood scenarios across 0m to 4.5m river water rise.
Explicitly labeled as: SIMULATION-DERIVED TRAINING DATA.
"""

import json
import os
import numpy as np
import pandas as pd
from typing import Tuple

from ml.features import (
    extract_zone_demand_features,
    extract_zone_risk_features,
    extract_road_access_features
)

def build_datasets() -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    with open("data/processed/zones.geojson", "r") as f:
        zones_data = json.load(f)["features"]
    with open("data/processed/roads.geojson", "r") as f:
        roads_data = json.load(f)["features"]

    np.random.seed(42)

    # 1. ZONE DEMAND DATASET
    demand_records = []
    # Simulate 60 distinct flood timeline snapshots across 8 zones
    for sim_step in range(120):
        # flood water rise ranges from 0.0m to 4.5m
        water_rise = np.clip(np.random.normal(loc=1.8, scale=1.2), 0.0, 4.5)
        sim_minute = np.random.uniform(0, 360)  # up to 6 hours into disaster

        for z_feat in zones_data:
            props = z_feat["properties"]
            feats = extract_zone_demand_features(props, water_rise, sim_minute)
            
            # Ground-truth demand generation rule (based on exposed pop, water head, vulnerability)
            water_head = feats[7]
            pop_k = feats[0]
            vuln = feats[5]
            
            # Base emergency demand per 10k population: ~2 cases/hr
            base_demand = (pop_k / 10.0) * 1.5
            flood_induced = (water_head ** 1.6) * vuln * (pop_k / 5.0) * 4.2
            noise = np.random.normal(0, 1.2)
            demand = max(1.0, base_demand + flood_induced + noise)

            rec = {
                "pop_k": feats[0],
                "area_km2": feats[1],
                "density": feats[2],
                "elevation_base_m": feats[3],
                "river_proximity_m": feats[4],
                "vulnerability_score": feats[5],
                "flood_water_rise_m": feats[6],
                "water_head": feats[7],
                "disaster_hours": feats[8],
                "target_demand": round(demand, 1)
            }
            demand_records.append(rec)

    df_demand = pd.DataFrame(demand_records)
    os.makedirs("data/training", exist_ok=True)
    df_demand.to_csv("data/training/simulated_zone_demand.csv", index=False)

    # 2. ZONE RISK DATASET
    risk_records = []
    for sim_step in range(120):
        water_rise = np.clip(np.random.normal(loc=1.8, scale=1.2), 0.0, 4.5)
        for z_feat in zones_data:
            props = z_feat["properties"]
            water_head = max(0.0, (550.0 + water_rise) - props["elevation_base_m"])
            active_demand = np.random.uniform(2, 45)
            accessible_roads = np.clip(1.0 - (water_head / 1.8), 0.1, 1.0)
            
            feats = extract_zone_risk_features(props, water_rise, active_demand, accessible_roads)
            
            # Risk calculation: weighted combination
            # Risk components: hazard (0.35) + vulnerability (0.20) + demand (0.25) + isolation (0.20)
            hazard_score = min(1.0, water_head / 2.0)
            vuln_score = props["vulnerability_score"]
            demand_norm = min(1.0, active_demand / 40.0)
            isolation_score = 1.0 - accessible_roads
            
            risk_score = (
                0.35 * hazard_score +
                0.20 * vuln_score +
                0.25 * demand_norm +
                0.20 * isolation_score
            )
            risk_score = float(np.clip(risk_score + np.random.normal(0, 0.03), 0.0, 1.0))
            
            if risk_score < 0.25:
                risk_cat = "LOW"
            elif risk_score < 0.50:
                risk_cat = "MEDIUM"
            elif risk_score < 0.75:
                risk_cat = "HIGH"
            else:
                risk_cat = "CRITICAL"

            rec = {
                "water_head": feats[0],
                "pop_exposed": feats[1],
                "vulnerability_score": feats[2],
                "active_demand": feats[3],
                "accessible_roads_pct": feats[4],
                "medical_coverage": feats[5],
                "target_risk_score": round(risk_score, 3),
                "target_risk_level": risk_cat
            }
            risk_records.append(rec)

    df_risk = pd.DataFrame(risk_records)
    df_risk.to_csv("data/training/simulated_zone_risk.csv", index=False)

    # 3. ROAD ACCESSIBILITY DATASET
    road_records = []
    for sim_step in range(120):
        water_rise = float(np.clip(np.random.normal(loc=1.8, scale=1.3), 0.0, 4.5))
        for r_feat in roads_data:
            props = r_feat["properties"]
            feats = extract_road_access_features(props, water_rise)
            
            elev = feats[0]
            river_prox = feats[1]
            surge_m = feats[2]
            
            # Ground-truth hydraulic inundation with flood-plain attenuation
            # Near river (within 200m), water level is 550.8 + surge. Further away, drops by 0.2m per 500m.
            local_water_surface = (550.8 + surge_m) - (river_prox / 1000.0) * 0.3
            flood_depth = max(0.0, local_water_surface - elev)
            
            # Operational classification for emergency responders:
            # 0: OPEN (safe passage)
            # 1: RESTRICTED (shallow water <= 30cm)
            # 2: HIGH_RISK (flowing water <= 50cm)
            # 3: BLOCKED (impassable > 50cm)
            effective_depth = flood_depth + np.random.normal(0, 0.02)
            if effective_depth <= 0.02:
                status = 0  # OPEN
            elif effective_depth <= 0.30:
                status = 1  # RESTRICTED
            elif effective_depth <= 0.50:
                status = 2  # HIGH_RISK
            else:
                status = 3  # BLOCKED

            rec = {
                "elevation_m": feats[0],
                "river_proximity_m": feats[1],
                "upstream_surge_m": feats[2],
                "length_m": feats[3],
                "speed_limit_kmh": feats[4],
                "is_bridge": feats[5],
                "road_class_code": feats[6],
                "target_status": status
            }
            road_records.append(rec)

    df_roads = pd.DataFrame(road_records)
    df_roads.to_csv("data/training/simulated_road_accessibility.csv", index=False)

    print(f"Generated Simulation-Derived Datasets:")
    print(f"- Zone Demand samples: {len(df_demand)}")
    print(f"- Zone Risk samples: {len(df_risk)}")
    print(f"- Road Accessibility samples: {len(df_roads)}")

    return df_demand, df_risk, df_roads


if __name__ == "__main__":
    build_datasets()

"""
Inference engine and model registry for HC-05.
Loads trained models from models/ directory and provides real-time inference
for zones and roads during simulation steps.
"""

import os
import joblib
from typing import Dict, Any, Tuple, Optional
import numpy as np

from ml.features import (
    extract_zone_demand_features,
    extract_zone_risk_features,
    extract_road_access_features
)

class ModelRegistry:
    _instance = None

    def __init__(self):
        self.demand_model_data = None
        self.risk_model_data = None
        self.road_model_data = None
        self.load_models()

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = ModelRegistry()
        return cls._instance

    def load_models(self):
        try:
            if os.path.exists("models/demand_model.pkl"):
                self.demand_model_data = joblib.load("models/demand_model.pkl")
        except Exception as e:
            print(f"Notice: Using deterministic demand formulation ({e})")
            self.demand_model_data = None

        try:
            if os.path.exists("models/risk_model.pkl"):
                self.risk_model_data = joblib.load("models/risk_model.pkl")
        except Exception as e:
            print(f"Notice: Using deterministic risk formulation ({e})")
            self.risk_model_data = None

        try:
            if os.path.exists("models/road_access_model.pkl"):
                self.road_model_data = joblib.load("models/road_access_model.pkl")
        except Exception as e:
            print(f"Notice: Using hydraulic road evaluation ({e})")
            self.road_model_data = None

    def predict_zone_demand(self, zone_props: Dict[str, Any], flood_water_rise_m: float, sim_minute: float) -> float:
        feats = extract_zone_demand_features(zone_props, flood_water_rise_m, sim_minute)
        if self.demand_model_data and "model" in self.demand_model_data:
            model = self.demand_model_data["model"]
            cols = self.demand_model_data.get("feature_names")
            import pandas as pd
            df_in = pd.DataFrame([feats], columns=cols) if cols else [feats]
            pred = model.predict(df_in)[0]
            return float(max(1.0, round(pred, 1)))
        # Fallback deterministic formulation if model not trained yet
        pop_k = zone_props["population"] / 1000.0
        elev = zone_props["elevation_base_m"]
        head = max(0.0, (550.0 + flood_water_rise_m) - elev)
        return float(round((pop_k / 10.0) * 1.5 + (head ** 1.5) * zone_props["vulnerability_score"] * 12.0, 1))

    def predict_zone_risk(self, zone_props: Dict[str, Any], flood_water_rise_m: float, active_demand: float, accessible_roads_pct: float) -> Tuple[float, str]:
        feats = extract_zone_risk_features(zone_props, flood_water_rise_m, active_demand, accessible_roads_pct)
        if self.risk_model_data and "regressor" in self.risk_model_data and "classifier" in self.risk_model_data:
            import pandas as pd
            cols = self.risk_model_data.get("feature_names")
            df_in = pd.DataFrame([feats], columns=cols) if cols else [feats]
            score = float(np.clip(self.risk_model_data["regressor"].predict(df_in)[0], 0.0, 1.0))
            category = str(self.risk_model_data["classifier"].predict(df_in)[0])
            return round(score, 3), category
        
        # Fallback
        elev = zone_props["elevation_base_m"]
        head = max(0.0, (550.0 + flood_water_rise_m) - elev)
        hazard = min(1.0, head / 2.0)
        score = float(0.35 * hazard + 0.20 * zone_props["vulnerability_score"] + 0.25 * min(1.0, active_demand / 40.0) + 0.20 * (1.0 - accessible_roads_pct))
        cat = "LOW" if score < 0.25 else "MEDIUM" if score < 0.50 else "HIGH" if score < 0.75 else "CRITICAL"
        return round(score, 3), cat

    def predict_road_status(self, road_props: Dict[str, Any], flood_water_rise_m: float) -> Tuple[str, float, str]:
        """
        Returns (status, flood_depth, explanation)
        status: OPEN | RESTRICTED | HIGH_RISK | BLOCKED
        Combines ML predictive classification with deterministic hydraulic safety overrides.
        """
        feats = extract_road_access_features(road_props, flood_water_rise_m)
        elev = float(road_props.get("elevation_m", 555.0))
        water_level = 550.8 + float(flood_water_rise_m)
        flood_depth = max(0.0, round(water_level - elev, 2))

        # 1. Model 3 ML Prediction
        ml_status = "OPEN"
        if self.road_model_data and "model" in self.road_model_data:
            import pandas as pd
            model = self.road_model_data["model"]
            cols = self.road_model_data.get("feature_names")
            df_in = pd.DataFrame([feats], columns=cols) if cols else [feats]
            pred_idx = int(model.predict(df_in)[0])
            ml_status = self.road_model_data.get("label_mapping", {}).get(pred_idx, "OPEN")

        # 2. Hard physical accessibility constraints (Part 55: deterministic physical rules)
        if flood_depth > 0.50:
            return "BLOCKED", flood_depth, f"Predicted inundation ({flood_depth:.2f}m) exceeded configured emergency-vehicle accessibility constraint (0.50m)"
        elif flood_depth > 0.30:
            status = "BLOCKED" if ml_status == "BLOCKED" else "HIGH_RISK"
            return status, flood_depth, f"Hazardous water flow: water depth {flood_depth:.2f}m approaching safe vehicle clearance"
        elif flood_depth > 0.05:
            status = "HIGH_RISK" if ml_status in ["HIGH_RISK", "BLOCKED"] else "RESTRICTED"
            return status, flood_depth, f"Speed restricted to 20 km/h: shallow inundation of {flood_depth:.2f}m detected"
        else:
            return "OPEN", flood_depth, f"Normal conditions: water level ({water_level:.1f}m) below road deck ({elev:.1f}m)"


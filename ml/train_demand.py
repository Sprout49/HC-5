"""
Training script for Model 1: Zone Emergency Demand Predictor.
Algorithm: RandomForestRegressor.
Saves model artifact to models/demand_model.pkl.
"""

import json
import os
import joblib
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

def train_demand_model():
    data_path = "data/training/simulated_zone_demand.csv"
    if not os.path.exists(data_path):
        from ml.dataset_builder import build_datasets
        build_datasets()

    df = pd.read_csv(data_path)
    feature_cols = [
        "pop_k", "area_km2", "density", "elevation_base_m",
        "river_proximity_m", "vulnerability_score",
        "flood_water_rise_m", "water_head", "disaster_hours"
    ]
    X = df[feature_cols]
    y = df["target_demand"]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model = RandomForestRegressor(n_estimators=100, max_depth=8, random_state=42)
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    rmse = float(mean_squared_error(y_test, y_pred) ** 0.5)
    r2 = r2_score(y_test, y_pred)

    os.makedirs("models", exist_ok=True)
    joblib.dump({
        "model": model,
        "feature_names": feature_cols,
        "metrics": {
            "MAE": round(float(mae), 3),
            "RMSE": round(float(rmse), 3),
            "R2": round(float(r2), 3)
        },
        "type": "RandomForestRegressor"
    }, "models/demand_model.pkl")

    metrics_summary = {
        "model": "Zone Emergency Demand Predictor",
        "algorithm": "RandomForestRegressor",
        "train_samples": len(X_train),
        "test_samples": len(X_test),
        "metrics": {
            "MAE": round(float(mae), 3),
            "RMSE": round(float(rmse), 3),
            "R2_score": round(float(r2), 3)
        }
    }
    with open("models/demand_metrics.json", "w") as f:
        json.dump(metrics_summary, f, indent=2)

    print("=== MODEL 1: ZONE DEMAND PREDICTOR ===")
    print(f"MAE: {mae:.3f} | RMSE: {rmse:.3f} | R²: {r2:.3f}")
    return model, metrics_summary

if __name__ == "__main__":
    train_demand_model()

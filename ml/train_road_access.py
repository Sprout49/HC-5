"""
Training script for Model 3: Road Accessibility / Flood Impact Predictor.
Algorithm: RandomForestClassifier.
Predicts accessibility class:
  0: OPEN
  1: RESTRICTED
  2: HIGH_RISK
  3: BLOCKED
Saves model artifact to models/road_access_model.pkl.
"""

import json
import os
import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score, f1_score

def train_road_model():
    data_path = "data/training/simulated_road_accessibility.csv"
    if not os.path.exists(data_path):
        from ml.dataset_builder import build_datasets
        build_datasets()

    df = pd.read_csv(data_path)
    feature_cols = [
        "elevation_m", "river_proximity_m", "upstream_surge_m",
        "length_m", "speed_limit_kmh", "is_bridge", "road_class_code"
    ]
    X = df[feature_cols]
    y = df["target_status"]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model = RandomForestClassifier(n_estimators=100, max_depth=6, random_state=42)
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred, average="weighted")
    report = classification_report(y_test, y_pred, output_dict=True)

    status_labels = {0: "OPEN", 1: "RESTRICTED", 2: "HIGH_RISK", 3: "BLOCKED"}

    os.makedirs("models", exist_ok=True)
    joblib.dump({
        "model": model,
        "feature_names": feature_cols,
        "label_mapping": status_labels,
        "metrics": {
            "accuracy": round(float(acc), 3),
            "f1_score": round(float(f1), 3)
        }
    }, "models/road_access_model.pkl")

    metrics_summary = {
        "model": "Road Accessibility Predictor",
        "algorithm": "RandomForestClassifier",
        "train_samples": len(X_train),
        "test_samples": len(X_test),
        "accuracy": round(float(acc), 3),
        "f1_score_weighted": round(float(f1), 3),
        "classification_report": report
    }
    with open("models/road_access_metrics.json", "w") as f:
        json.dump(metrics_summary, f, indent=2)

    print("=== MODEL 3: ROAD ACCESSIBILITY MODEL ===")
    print(f"Accuracy: {acc:.3f} | Weighted F1: {f1:.3f}")
    return model, metrics_summary

if __name__ == "__main__":
    train_road_model()

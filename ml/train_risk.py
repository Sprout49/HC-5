"""
Training script for Model 2: Zone Risk Classifier & Regressor.
Algorithm: GradientBoostingClassifier & GradientBoostingRegressor.
Predicts risk score [0, 1] and risk category (LOW, MEDIUM, HIGH, CRITICAL).
Saves model artifact to models/risk_model.pkl.
"""

import json
import os
import joblib
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier, GradientBoostingRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score, f1_score

def train_risk_model():
    data_path = "data/training/simulated_zone_risk.csv"
    if not os.path.exists(data_path):
        from ml.dataset_builder import build_datasets
        build_datasets()

    df = pd.read_csv(data_path)
    feature_cols = [
        "water_head", "pop_exposed", "vulnerability_score",
        "active_demand", "accessible_roads_pct", "medical_coverage"
    ]
    X = df[feature_cols]
    y_cat = df["target_risk_level"]
    y_score = df["target_risk_score"]

    X_train, X_test, y_cat_train, y_cat_test, y_score_train, y_score_test = train_test_split(
        X, y_cat, y_score, test_size=0.2, random_state=42
    )

    clf = GradientBoostingClassifier(n_estimators=100, max_depth=4, random_state=42)
    clf.fit(X_train, y_cat_train)

    reg = GradientBoostingRegressor(n_estimators=100, max_depth=4, random_state=42)
    reg.fit(X_train, y_score_train)

    y_cat_pred = clf.predict(X_test)
    acc = accuracy_score(y_cat_test, y_cat_pred)
    f1 = f1_score(y_cat_test, y_cat_pred, average="weighted")
    report = classification_report(y_cat_test, y_cat_pred, output_dict=True)

    os.makedirs("models", exist_ok=True)
    joblib.dump({
        "classifier": clf,
        "regressor": reg,
        "feature_names": feature_cols,
        "classes": clf.classes_.tolist(),
        "metrics": {
            "accuracy": round(float(acc), 3),
            "f1_score": round(float(f1), 3)
        }
    }, "models/risk_model.pkl")

    metrics_summary = {
        "model": "Zone Risk Classifier & Score Predictor",
        "algorithm": "GradientBoostingClassifier & Regressor",
        "train_samples": len(X_train),
        "test_samples": len(X_test),
        "accuracy": round(float(acc), 3),
        "f1_score_weighted": round(float(f1), 3),
        "classification_report": report
    }
    with open("models/risk_metrics.json", "w") as f:
        json.dump(metrics_summary, f, indent=2)

    print("=== MODEL 2: ZONE RISK MODEL ===")
    print(f"Accuracy: {acc:.3f} | Weighted F1: {f1:.3f}")
    return clf, metrics_summary

if __name__ == "__main__":
    train_risk_model()

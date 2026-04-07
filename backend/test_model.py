import joblib
import numpy as np

model = joblib.load("posture_xgboost_model_new.pkl")
print("Classes:", model.classes_)

try:
    print("Feature properties inside XGBoost:")
    print("Num features expected:", model.n_features_in_)
    # xgboost specific:
    booster = model.get_booster()
    print("Feature names:", booster.feature_names)
except Exception as e:
    print("Error getting model metadata:", e)

# Test 1: Ideal posture
X_good = [[10.0, 0.05, 0.1, 0.0]]
proba_good = model.predict_proba(X_good)[0]
print("---")
print("Ideal posture probe:", proba_good)
print("Prediction:", model.predict(X_good)[0])

# Test 2: Terrible posture (severe side angle, massive forward lean)
X_bad = [[45.0, 0.5, 0.02, 0.2]]
proba_bad = model.predict_proba(X_bad)[0]
print("---")
print("Terrible posture probe:", proba_bad)
print("Prediction:", model.predict(X_bad)[0])

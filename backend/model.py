import joblib
import numpy as np

# Load your trained XGBoost model
model = joblib.load("posture_xgboost_model_new.pkl")

def predict(features: dict) -> int:

    X = [[
        features["side_angle"],
        features["forward_lean"],
        features["vertical_offset"],
        features["shoulder_slope"]
    ]]

    proba = model.predict_proba(X)[0]

    good_probability = proba[0]
    bad_probability  = proba[1]

    # Only predict BAD if model is strongly confident
    # AND good probability is clearly lower
    if bad_probability >= 0.5 and good_probability < 0.5:
        prediction = 1
    else:
        prediction = 0


    return prediction
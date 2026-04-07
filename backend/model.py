import joblib
import numpy as np

# Load your trained XGBoost model
model = joblib.load("posture_xgboost_model_new.pkl")

def predict(features: dict) -> int:
    """
    Evaluates posture dynamically using the trained ML model.
    """
    try:
        # Create the feature array in the exact order the model expects:
        # ['side_angle', 'forward_ratio_z', 'vertical_offset', 'shoulder_slope']
        X = np.array([[
            features.get("side_angle", 0.0),
            features.get("forward_lean", 0.0),
            features.get("vertical_offset", 0.0),
            features.get("shoulder_slope", 0.0)
        ]])
        
        # Make the prediction using the original teammate's model
        prediction = int(model.predict(X)[0])
        return prediction
    except Exception as e:
        print(f"XGBoost Exception: {e}")
        return 0
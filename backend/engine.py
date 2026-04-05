import asyncio
from collections import deque
from model import predict
from fastapi import WebSocketDisconnect

class PostureEngine:

    def __init__(self):
        # ==========================
        # SMOOTHING BUFFER
        # Stores last 15 predictions
        # Majority vote prevents flickering
        # ==========================
        self.prediction_buffer = deque(maxlen=15)

        # ==========================
        # RUNNING FLAG
        # Controls the detection loop
        # ==========================
        self.running = False

    # ==========================
    # MAIN DETECTION LOOP
    # ==========================
    async def start(self, websocket):
        self.running = True
        
        try:
            while self.running:
                # Receive features from frontend over websocket
                try:
                    features = await websocket.receive_json()
                except WebSocketDisconnect:
                    break

                if not features:
                    await asyncio.sleep(0.05)
                    continue

                # Predict posture using backend XGBoost
                prediction = predict(features)

                # Add to smoothing buffer
                self.prediction_buffer.append(prediction)

                # Majority vote
                final_prediction = max(
                    set(self.prediction_buffer),
                    key=self.prediction_buffer.count
                )

                # Calculate confidence
                confidence = round(
                    self.prediction_buffer.count(final_prediction)
                    / len(self.prediction_buffer), 2
                )

                # Build status string
                status = "GOOD" if final_prediction == 0 else "BAD"

                # Send back payload with predictions
                payload = {
                    "status"          : status,
                    "confidence"      : confidence,
                    "side_angle"      : features.get("side_angle", 0),
                    "forward_lean"    : features.get("forward_lean", 0),
                    "vertical_offset" : features.get("vertical_offset", 0),
                    "shoulder_slope"  : features.get("shoulder_slope", 0),
                    "blink_rate"      : features.get("blink_rate", 0),
                    "eye_distance"    : features.get("eye_distance", 0)
                }
                await websocket.send_json(payload)

        finally:
            self.stop()

    # ==========================
    # STOP ENGINE CLEANLY
    # ==========================
    def stop(self):
        self.running = False
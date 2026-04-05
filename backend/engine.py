import cv2
import asyncio
from collections import deque
from concurrent.futures import ThreadPoolExecutor
from detection import extract_features_from_frame
from model import predict

class PostureEngine:

    def __init__(self):
        # ==========================
        # WEBCAM (INITIALIZED ON START)
        # ==========================
        self.cap = None

        # ==========================
        # SMOOTHING BUFFER
        # Stores last 10 predictions
        # Majority vote prevents flickering
        # ==========================
        self.prediction_buffer = deque(maxlen=15)

        # ==========================
        # THREAD EXECUTOR
        # cap.read() is blocking
        # ==========================
        self.executor = ThreadPoolExecutor(max_workers=1)

        # ==========================
        # RUNNING FLAG
        # Controls the detection loop
        # ==========================
        self.running = False

    # ==========================
    # READ FRAME — NON BLOCKING
    # ==========================
    def _read_frame(self):
        if self.cap is None or not self.cap.isOpened():
            return None
        ret, frame = self.cap.read()
        if not ret:
            return None
        return cv2.flip(frame, 1)

    async def read_frame_async(self):
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            self.executor,
            self._read_frame
        )

    # ==========================
    # MAIN DETECTION LOOP
    # ==========================
    async def start(self, websocket):
        # Initialize camera ONLY when needed
        if self.cap is None or not self.cap.isOpened():
            print("Starting camera...")
            self.cap = cv2.VideoCapture(0)
            
        self.running = True
        
        try:
            while self.running:
                # Read frame without blocking
                frame = await self.read_frame_async()

                if frame is None:
                    await asyncio.sleep(0.1)
                    continue

                # Extract all features from frame
                features = extract_features_from_frame(frame)

                # Skip if detection failed
                if features is None:
                    await asyncio.sleep(0.05)
                    continue

                # Predict posture
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

                # Send to React frontend
                payload = {
                    "status"          : status,
                    "confidence"      : confidence,
                    "side_angle"      : features["side_angle"],
                    "forward_lean"    : features["forward_lean"],
                    "vertical_offset" : features["vertical_offset"],
                    "shoulder_slope"  : features["shoulder_slope"],
                    "blink_rate"      : features["blink_rate"],
                    "eye_distance"    : features["eye_distance"]
                }
                await websocket.send_json(payload)

                # 10 FPS
                await asyncio.sleep(0.1)
        finally:
            self.stop()

    # ==========================
    # STOP ENGINE CLEANLY
    # ==========================
    def stop(self):
        self.running = False
        if self.cap is not None and self.cap.isOpened():
            self.cap.release()
            self.cap = None
            print("Camera released")
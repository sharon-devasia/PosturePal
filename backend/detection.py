import cv2
import math
import time
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
#class blink
class BlinkDetector:

    def __init__(self):
        self.eye_closed = False
        self.blink_times = []

    def update(self, ear):

        if ear < 0.20:
            self.eye_closed = True
        else:
            if self.eye_closed:
                self.blink_times.append(time.time())
                self.eye_closed = False

        # keep only last 60 seconds
        now = time.time()
        self.blink_times = [t for t in self.blink_times if now - t < 60]

        return len(self.blink_times)
blink_detector = BlinkDetector()

# ==========================
# LOAD POSE MODEL
# ==========================
pose_detector = vision.PoseLandmarker.create_from_options(
    vision.PoseLandmarkerOptions(
        base_options=python.BaseOptions(
            model_asset_path='pose.task'
        ),
        running_mode=vision.RunningMode.IMAGE,
        num_poses=1        # ← add this line
                           # only detect 1 person
                           # always picks most prominent
    )
)

# ==========================
# LOAD FACE MODEL
# ==========================
face_detector = vision.FaceLandmarker.create_from_options(
    vision.FaceLandmarkerOptions(
        base_options=python.BaseOptions(
            model_asset_path='face_landmarker.task'
        ),
        running_mode=vision.RunningMode.IMAGE
    )
)

# ==========================
# BLINK STATE
# ==========================


# ==========================
# EYE LANDMARK INDICES
# MediaPipe Face Mesh
# ==========================
LEFT_EYE  = [33,  160, 158, 133, 153, 144]
RIGHT_EYE = [362, 385, 387, 263, 373, 380]

# Eye outer corners for eye distance
LEFT_OUTER  = 33
RIGHT_OUTER = 263

# ==========================
# EAR FORMULA
# ==========================
def eye_aspect_ratio(landmarks, indices):
    p  = [landmarks[i] for i in indices]
    v1 = math.hypot(p[1].x - p[5].x, p[1].y - p[5].y)
    v2 = math.hypot(p[2].x - p[4].x, p[2].y - p[4].y)
    h  = math.hypot(p[0].x - p[3].x, p[0].y - p[3].y)
    return (v1 + v2) / (2.0 * h + 1e-6)

# ==========================
# MAIN EXTRACTION FUNCTION
# ==========================
def extract_features_from_frame(frame):
  

    rgb      = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(
        image_format=mp.ImageFormat.SRGB,
        data=rgb
    )

    pose_result = pose_detector.detect(mp_image)
    face_result = face_detector.detect(mp_image)

    # ==============================
    # FACE LANDMARKS — EYE DISTANCE
    # Must detect face first
    # All pose features depend on eye_distance
    # ==============================
    if not face_result.face_landmarks: 
        return None

    face_lm = face_result.face_landmarks[0]

    # Eye outer corner landmarks
    left_eye_pt  = face_lm[LEFT_OUTER]
    right_eye_pt = face_lm[RIGHT_OUTER]

    # Eye distance — normalization reference
    eye_distance = math.hypot(
        left_eye_pt.x  - right_eye_pt.x,
        left_eye_pt.y  - right_eye_pt.y
    )
    eye_distance = max(eye_distance, 1e-6)

    # ==============================
    # BLINK DETECTION
    # ==============================
    left_ear_val  = eye_aspect_ratio(face_lm, LEFT_EYE)
    right_ear_val = eye_aspect_ratio(face_lm, RIGHT_EYE)
    avg_ear       = (left_ear_val + right_ear_val) / 2
    blink_rate = blink_detector.update(avg_ear)

    # ==============================
    # POSE LANDMARKS
    # ==============================
    if not pose_result.pose_landmarks:
        return None

    lm = pose_result.pose_landmarks[0]


    left_ear_lm    = lm[7]
    right_ear_lm   = lm[8]
    left_shoulder  = lm[11]
    right_shoulder = lm[12]

    # Visibility check
    if left_shoulder.visibility  < 0.6 or \
       right_shoulder.visibility < 0.6:
        return None

    # ==========================
    # MIDPOINTS
    # All in normalized 0-1 space
    # ==========================

    # Ear midpoint
    ear_x = (left_ear_lm.x + right_ear_lm.x) / 2
    ear_y = (left_ear_lm.y + right_ear_lm.y) / 2
    ear_z = (left_ear_lm.z + right_ear_lm.z) / 2

    # Shoulder midpoint
    sh_x  = (left_shoulder.x + right_shoulder.x) / 2
    sh_y  = (left_shoulder.y + right_shoulder.y) / 2
    sh_z  = (left_shoulder.z + right_shoulder.z) / 2

    # ==========================
    # FEATURE 1 — SIDE ANGLE
    # Not normalized — angle is
    # already scale independent
    # ==========================
    dx         = ear_x - sh_x
    dy         = sh_y  - ear_y
    side_angle = math.degrees(math.atan2(dx, dy))

    # ==========================
    # FEATURE 2 — FORWARD LEAN
    # Normalized by eye distance
    # ==========================
    forward_lean = (sh_z - ear_z) / eye_distance

    # ==========================
    # FEATURE 3 — VERTICAL OFFSET
    # Normalized by eye distance
    # ==========================
    vertical_offset = (sh_y - ear_y) / eye_distance

    # ==========================
    # FEATURE 4 — SHOULDER SLOPE
    # Normalized by eye distance
    # ==========================
    shoulder_slope = (
        right_shoulder.y - left_shoulder.y
    ) / eye_distance

    # ==============================
    # RETURN FEATURE VECTOR
    # X = [side_angle, forward_lean,
    #      vertical_offset, shoulder_slope]
    # ==============================
   
    return {
        "side_angle"      : round(side_angle,      3),
        "forward_lean"    : round(forward_lean,     3),
        "vertical_offset" : round(vertical_offset,  3),
        "shoulder_slope"  : round(shoulder_slope,   3),
        "blink_rate"      : blink_rate,
        "eye_distance"    : round(eye_distance,     4)
    }
import {
    FaceLandmarker,
    PoseLandmarker,
    FilesetResolver,
    NormalizedLandmark,
} from "@mediapipe/tasks-vision";

// Constants
const LEFT_EYE = [33, 160, 158, 133, 153, 144];
const RIGHT_EYE = [362, 385, 387, 263, 373, 380];
const LEFT_OUTER = 33;
const RIGHT_OUTER = 263;

class BlinkDetector {
    eyeClosed: boolean = false;
    blinkTimes: number[] = [];

    update(ear: number): number {
        if (ear < 0.2) {
            this.eyeClosed = true;
        } else {
            if (this.eyeClosed) {
                this.blinkTimes.push(Date.now());
                this.eyeClosed = false;
            }
        }
        const now = Date.now();
        // keep only last 60 seconds
        this.blinkTimes = this.blinkTimes.filter((t) => now - t < 60000);
        return this.blinkTimes.length;
    }
}

export const blinkDetector = new BlinkDetector();

function eyeAspectRatio(landmarks: NormalizedLandmark[], indices: number[]): number {
    const p = indices.map((i) => landmarks[i]);
    const v1 = Math.hypot(p[1].x - p[5].x, p[1].y - p[5].y);
    const v2 = Math.hypot(p[2].x - p[4].x, p[2].y - p[4].y);
    const h = Math.hypot(p[0].x - p[3].x, p[0].y - p[3].y);
    return (v1 + v2) / (2.0 * h + 1e-6);
}

export interface ExtractedFeatures {
    side_angle: number;
    forward_lean: number;
    vertical_offset: number;
    shoulder_slope: number;
    blink_rate: number;
    eye_distance: number;
}

export class VisionProcessor {
    private faceLandmarker: FaceLandmarker | null = null;
    private poseLandmarker: PoseLandmarker | null = null;
    private isInitialized = false;

    async initialize() {
        if (this.isInitialized) return;
        try {
            const vision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
            );

            this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: "/face_landmarker.task",
                    delegate: "GPU",
                },
                runningMode: "VIDEO",
                numFaces: 1, // only detect 1 person, always picks the most prominent
            });

            this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: "/pose.task",
                    delegate: "GPU",
                },
                runningMode: "VIDEO",
                numPoses: 1, // only detect 1 person, always picks the most prominent
            });

            this.isInitialized = true;
        } catch (error) {
            console.error("Failed to initialize Vision Process", error);
            throw error;
        }
    }

    processFrame(videoElement: HTMLVideoElement, timestamp: number): ExtractedFeatures | null {
        if (!this.isInitialized || !this.faceLandmarker || !this.poseLandmarker) {
            return null;
        }

        const faceResult = this.faceLandmarker.detectForVideo(videoElement, timestamp);
        const poseResult = this.poseLandmarker.detectForVideo(videoElement, timestamp);

        if (!faceResult.faceLandmarks || faceResult.faceLandmarks.length === 0) {
            return null;
        }

        const faceLm = faceResult.faceLandmarks[0];

        const leftEyePt = faceLm[LEFT_OUTER];
        const rightEyePt = faceLm[RIGHT_OUTER];

        let eyeDistance = Math.hypot(leftEyePt.x - rightEyePt.x, leftEyePt.y - rightEyePt.y);
        eyeDistance = Math.max(eyeDistance, 1e-6);

        const leftEarVal = eyeAspectRatio(faceLm, LEFT_EYE);
        const rightEarVal = eyeAspectRatio(faceLm, RIGHT_EYE);
        const avgEar = (leftEarVal + rightEarVal) / 2;
        const blinkRate = blinkDetector.update(avgEar);

        if (!poseResult.landmarks || poseResult.landmarks.length === 0) {
            return null;
        }

        const lm = poseResult.landmarks[0];

        const leftEarLm = lm[7];
        const rightEarLm = lm[8];
        const leftShoulder = lm[11];
        const rightShoulder = lm[12];

        const leftShoulderVis = leftShoulder.visibility ?? 1;
        const rightShoulderVis = rightShoulder.visibility ?? 1;

        if (leftShoulderVis < 0.6 || rightShoulderVis < 0.6) {
            return null;
        }

        const earX = (leftEarLm.x + rightEarLm.x) / 2;
        const earY = (leftEarLm.y + rightEarLm.y) / 2;
        const earZ = (leftEarLm.z + rightEarLm.z) / 2;

        const shX = (leftShoulder.x + rightShoulder.x) / 2;
        const shY = (leftShoulder.y + rightShoulder.y) / 2;
        const shZ = (leftShoulder.z + rightShoulder.z) / 2;

        const dx = earX - shX;
        const dy = shY - earY;

        const sideAngle = (Math.atan2(dx, dy) * 180) / Math.PI;

        const forwardLean = (shZ - earZ) / eyeDistance;
        const verticalOffset = (shY - earY) / eyeDistance;
        const shoulderSlope = (rightShoulder.y - leftShoulder.y) / eyeDistance;

        return {
            side_angle: Number(sideAngle.toFixed(3)),
            forward_lean: Number(forwardLean.toFixed(3)),
            vertical_offset: Number(verticalOffset.toFixed(3)),
            shoulder_slope: Number(shoulderSlope.toFixed(3)),
            blink_rate: blinkRate,
            eye_distance: Number(eyeDistance.toFixed(4)),
        };
    }
}

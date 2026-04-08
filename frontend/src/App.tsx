import { useState, useEffect, useCallback, useRef } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner, toast } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import { VisionProcessor, ExtractedFeatures } from "./lib/vision";
import { apiFetch, getAuthToken } from "./lib/api";

// --- Types ---
interface PostureData {
  status: "GOOD" | "BAD";
  confidence: number;
  side_angle: number;
  forward_lean: number;
  vertical_offset: number;
  shoulder_slope: number;
  blink_rate: number;
  eye_distance: number;
}

interface Settings {
  breakReminderMin: number;
  postureAlertThreshold: number;
  blinkRateThreshold: number;
  notificationsEnabled: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  breakReminderMin: 25,
  postureAlertThreshold: 30,
  blinkRateThreshold: 12,
  notificationsEnabled: true,
};

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const token = getAuthToken();
  if (!token) {
    return <Navigate to="/auth" replace />;
  }
  return children;
};

const App = () => {
  // Native notification permission state
  const notifPermission = useRef<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "denied"
  );

  // Request browser notification permission on first mount
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().then((p) => {
        notifPermission.current = p;
      });
    }
  }, []);

  const [monitoring, setMonitoring] = useState(false);
  const [settings, setSettings] = useState<Settings>(() => {
    const saved = localStorage.getItem("posturepal-settings");
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  useEffect(() => {
    localStorage.setItem("posturepal-settings", JSON.stringify(settings));
  }, [settings]);
  
  const [connected, setConnected] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [data, setData] = useState<PostureData | null>(null);
  
  const dataRef = useRef<PostureData | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const visionRef = useRef<VisionProcessor | null>(null);
  const requestRef = useRef<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const sessionActive = useRef(false);
  const streamLock = useRef(false);

  // Background Timers
  const [badTimer, setBadTimer] = useState(0);
  const [breakTimer, setBreakTimer] = useState(25 * 60);
  const [lowBlinkTimer, setLowBlinkTimer] = useState(0);

  // Alert Tracking
  const [badPostureAlerts, setBadPostureAlerts] = useState(0);
  const [lowBlinkAlerts, setLowBlinkAlerts] = useState(0);
  const [breakAlerts, setBreakAlerts] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);

  // Background Stats
  const [goodFrames, setGoodFrames] = useState(0);
  const [badFrames, setBadFrames] = useState(0);

  // Live mini-graph data
  const [liveHistory, setLiveHistory] = useState<
    { 
      time: string; 
      accuracy: number; 
      blinkRate: number;
      side_angle: number;
      forward_lean: number;
      vertical_offset: number;
      shoulder_slope: number;
    }[]
  >([]);

  const formatTime = (d: Date) =>
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const fireNativeNotification = useCallback((title: string, body: string) => {
    if (
      typeof Notification !== "undefined" &&
      notifPermission.current === "granted"
    ) {
      try {
        new Notification(title, {
          body,
          icon: "/favicon.ico",
          tag: "posturepal-alert",        // collapse duplicate notifications
          requireInteraction: false,
        });
      } catch (_) {
        // Safari / iOS may throw — silently ignore
      }
    }
  }, []);

  const addAlert = useCallback((message: string, isWarning: boolean = false) => {
    // Always fire a native OS notification so the user sees it
    // even when the tab is unfocused or the browser is minimized
    fireNativeNotification(
      "PosturePal",
      message
    );

    // Also show the in-app sonner toast for when the tab is visible
    if (isWarning) {
      toast.warning(message, {
        description: "Posture correction required",
        duration: 5000,
        action: {
          label: "View Tracker",
          onClick: () => {
             // safely dismiss without breaking state
          },
        },
      });
    } else {
      toast(message, {
        description: new Date().toLocaleTimeString(),
        duration: 4000,
      });
    }
  }, [fireNativeNotification]);

  // Replaced local evaluatePosture with direct backend WebSockets

  const startVision = useCallback(async () => {
    if (streamLock.current) return;
    streamLock.current = true;
    
    try {
      sessionActive.current = true;
      if (videoRef.current && videoRef.current.srcObject) {
          const old = videoRef.current.srcObject as MediaStream;
          old.getTracks().forEach((t) => t.stop());
      }
      // Begin Session
      await apiFetch("/sessions/start", { method: "POST" });
      
      if (!sessionActive.current) {
          streamLock.current = false;
          return;
      }
      setConnected(true);

      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      
      if (!sessionActive.current) {
         stream.getTracks().forEach(t => t.stop());
         streamLock.current = false;
         return;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      visionRef.current = new VisionProcessor();
      await visionRef.current.initialize();

      // Connect WebSocket
      const wsUrl = `ws://127.0.0.1:8000/ws/stream?token=${getAuthToken() || ""}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
         const result = JSON.parse(event.data);
         setData(result);
         dataRef.current = result;
      };

      let lastApiTime = 0;
      let lastProcessTime = 0;

      const loop = (time: number) => {
        // Run vision processing locally every 100ms 
        if (time - lastProcessTime >= 100) {
           if (videoRef.current && visionRef.current && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
             const features = visionRef.current.processFrame(videoRef.current, time);
             if (features) {
                // Instantly forward coordinates to AI backend
                wsRef.current.send(JSON.stringify(features));

                // Save frame metadata loop
                if (dataRef.current && time - lastApiTime >= 10000) {
                  apiFetch("/sessions/frame", {
                    method: "POST",
                    body: JSON.stringify({
                      status: dataRef.current.status === "GOOD" ? "good" : "bad",
                      blink_rate: dataRef.current.blink_rate,
                      confidence: dataRef.current.confidence,
                    })
                  });
                  lastApiTime = time;
                }
             }
           }
           lastProcessTime = time;
        }
        requestRef.current = requestAnimationFrame(loop);
      };
      // give an initial 10s offset to fire immediately
      requestRef.current = requestAnimationFrame((time) => {
        lastApiTime = time - 10000; 
        loop(time);
      });
    } catch (err) {
      console.error("Camera access denied or API failed", err);
      setHasError(true);
      setMonitoring(false);
      streamLock.current = false;
    }
  }, []);

  const stopVision = useCallback(async () => {
    sessionActive.current = false;
    streamLock.current = false;
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    visionRef.current = null;

    if (connected) {
       await apiFetch("/sessions/end", { method: "POST" });
       // Redirect to dashboard is handled in Dashboard component or via Link
    }
    setConnected(false);
    setData(null);
  }, [connected]);

  useEffect(() => {
    if (monitoring) {
      setSessionStartTime(new Date());
      setHasError(false);
      startVision();
    } else {
      stopVision();
    }
  }, [monitoring, startVision, stopVision]);

  // Background Loop (1Hz tick)
  useEffect(() => {
    if (!monitoring) return;
    
    const interval = setInterval(() => {
      const currentData = dataRef.current;
      if (!currentData) return;

      // Posture check
      if (currentData.status === "BAD") {
        setBadTimer((t) => {
          const next = t + 1;
          if (settings.notificationsEnabled && next === settings.postureAlertThreshold) {
            addAlert("Bad posture detected! Please sit upright.", true);
            setBadPostureAlerts(a => a + 1);
          }
          return next;
        });
        setBadFrames(f => f + 1);
      } else {
        setBadTimer(0);
        setGoodFrames(f => f + 1);
      }

      // Blink check
      if (currentData.blink_rate < 12) {
        setLowBlinkTimer((t) => {
          const next = t + 1;
          if (next === 60) {
            addAlert("Low blink rate detected. Rest your eyes!");
            setLowBlinkAlerts(a => a + 1);
          }
          return next;
        });
      } else {
        setLowBlinkTimer(0);
      }

      // Break timer
      setBreakTimer((t) => {
        if (t <= 1) {
          addAlert("Break time! Take 5 minutes to stretch.");
          setBreakAlerts(a => a + 1);
          return settings.breakReminderMin * 60;
        }
        return t - 1;
      });

      // Update history
      const accuracy = (currentData.confidence ?? 0) * 100;
      const blinkRate = currentData.blink_rate ?? 0;
      
      const elapsedMinutes = sessionStartTime ? (new Date().getTime() - sessionStartTime.getTime()) / 60000 : 0;
      
      setLiveHistory((prev) => {
        const next = [
          ...prev,
          {
            time: formatTime(new Date()),
            sessionTime: Number(elapsedMinutes.toFixed(2)),
            accuracy: Number.isFinite(accuracy) ? Number(accuracy.toFixed(1)) : 0,
            blinkRate: Number.isFinite(blinkRate) ? Number(blinkRate.toFixed(1)) : 0,
            side_angle: Number(currentData.side_angle.toFixed(1)),
            forward_lean: Number(currentData.forward_lean.toFixed(1)),
            vertical_offset: Number(currentData.vertical_offset.toFixed(1)),
            shoulder_slope: Number(currentData.shoulder_slope.toFixed(1)),
          },
        ];
        return next.slice(-40); // Keep 40 points for deeper stats
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [monitoring, settings, addAlert, sessionStartTime]);

  // Exported state for children
  const sharedState = {
    monitoring,
    setMonitoring,
    connected,
    hasError,
    data,
    badTimer,
    breakTimer,
    lowBlinkTimer,
    goodFrames,
    badFrames,
    liveHistory,
    settings,
    setSettings,
    badPostureAlerts,
    lowBlinkAlerts,
    breakAlerts,
    sessionStartTime
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <video id="webcam" ref={videoRef} autoPlay playsInline style={{ display: "none" }} />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<ProtectedRoute><Landing {...sharedState} /></ProtectedRoute>} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard {...sharedState} /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;

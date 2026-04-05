import { useState, useEffect, useCallback, useRef } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner, toast } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import { VisionProcessor, ExtractedFeatures } from "./lib/vision";

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
  postureAlertThreshold: 10,
  blinkRateThreshold: 12,
  notificationsEnabled: true,
};

const queryClient = new QueryClient();

const App = () => {
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
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dataRef = useRef<PostureData | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const visionRef = useRef<VisionProcessor | null>(null);
  const requestRef = useRef<number | null>(null);

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

  const addAlert = useCallback((message: string, isWarning: boolean = false) => {
    if (isWarning) {
      toast.warning(message, {
        description: "Posture correction required",
        duration: 5000,
        action: {
          label: "View Data",
          onClick: () => window.location.href = "/dashboard",
        },
      });
    } else {
      toast(message, {
        description: new Date().toLocaleTimeString(),
        duration: 4000,
      });
    }
  }, []);

  // WebSocket logic
  const connectWs = useCallback(() => {
    try {
      const ws = new WebSocket("ws://localhost:8000/ws/live");
      wsRef.current = ws;
      ws.onopen = () => {
        setConnected(true);
        setHasError(false);
      };
      ws.onclose = () => {
        setConnected(false);
        if (wsRef.current === ws) {
          reconnectRef.current = setTimeout(connectWs, 3000);
        }
      };
      ws.onerror = () => {
        setConnected(false);
        setHasError(true);
        ws.close();
      };
      ws.onmessage = (e) => {
        try {
          const parsed = JSON.parse(e.data);
          setData(parsed);
          dataRef.current = parsed;
        } catch { /* ignore */ }
      };
    } catch {
      setConnected(false);
      setHasError(true);
      reconnectRef.current = setTimeout(connectWs, 3000);
    }
  }, []);

  const stopWs = useCallback(() => {
    if (reconnectRef.current) clearTimeout(reconnectRef.current);
    if (wsRef.current) {
      const ws = wsRef.current;
      wsRef.current = null;
      ws.close();
    }
    setConnected(false);
    setHasError(false);
    setData(null);
  }, []);

  const startVision = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      visionRef.current = new VisionProcessor();
      await visionRef.current.initialize();

      let lastTime = 0;
      const loop = (time: number) => {
        // Run vision processing ~10 times per second
        if (time - lastTime >= 100) {
          if (videoRef.current && visionRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
            const features = visionRef.current.processFrame(videoRef.current, time);
            if (features) {
              wsRef.current.send(JSON.stringify(features));
            }
          }
          lastTime = time;
        }
        requestRef.current = requestAnimationFrame(loop);
      };
      requestRef.current = requestAnimationFrame(loop);
    } catch (err) {
      console.error("Camera access denied or vision init failed", err);
      setHasError(true);
      setMonitoring(false);
    }
  }, []);

  const stopVision = useCallback(() => {
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    visionRef.current = null;
  }, []);

  useEffect(() => {
    if (monitoring) {
      setSessionStartTime(new Date());
      connectWs();
      startVision();
    } else {
      stopWs();
      stopVision();
    }
  }, [monitoring, connectWs, stopWs, startVision, stopVision]);

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
            <Route path="/" element={<Landing {...sharedState} />} />
            <Route path="/dashboard" element={<Dashboard {...sharedState} />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;

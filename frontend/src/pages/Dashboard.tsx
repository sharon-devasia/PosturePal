import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/hooks/use-theme";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, Legend,
  BarChart, Bar, ReferenceLine, ReferenceArea
} from "recharts";

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

interface DashboardProps {
  monitoring: boolean;
  setMonitoring: (val: boolean) => void;
  connected: boolean;
  hasError: boolean;
  data: PostureData | null;
  badTimer: number;
  breakTimer: number;
  lowBlinkTimer: number;
  goodFrames: number;
  badFrames: number;
  liveHistory: { 
    time: string; 
    sessionTime?: number;
    accuracy: number; 
    blinkRate: number;
    side_angle: number;
    forward_lean: number;
    vertical_offset: number;
    shoulder_slope: number;
  }[];
  settings: Settings;
  setSettings: (s: Settings) => void;
  badPostureAlerts?: number;
  lowBlinkAlerts?: number;
  breakAlerts?: number;
  sessionStartTime?: Date | null;
}

type DashSection = "realtime" | "stats" | "progress" | "settings";

const formatTime = (d: Date) =>
  d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

// --- Components ---
const DashCard = ({ children, className = "", title }: { children: React.ReactNode; className?: string; title?: string }) => (
  <div className={`bg-card/30 backdrop-blur-md border border-border/50 rounded-2xl p-6 shadow-xl animate-slide-in ${className}`}>
    {title && <h3 className="text-sm font-heading tracking-widest text-foreground/80 flex items-center gap-2 mb-6">
      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
      {title}
    </h3>}
    {children}
  </div>
);

const ComingSoon = ({ title }: { title: string }) => (
  <div className="flex-1 flex items-center justify-center p-12">
    <div className="bg-card border border-border rounded-xl p-12 text-center max-w-md animate-slide-in">
      <div className="w-16 h-16 rounded-full bg-muted border border-border flex items-center justify-center mx-auto mb-4">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
      <h3 className="font-heading text-2xl text-foreground tracking-wide mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground font-body">Coming soon in a future update.</p>
    </div>
  </div>
);

const ThemeToggle = ({ theme, onToggle }: { theme: string; onToggle: () => void }) => (
  <button
    onClick={onToggle}
    className="p-2 rounded-lg border border-border hover:bg-secondary transition-colors"
    title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
  >
    {theme === "dark" ? (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-foreground">
        <circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      </svg>
    ) : (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-foreground">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    )}
  </button>
);

const Dashboard = ({ 
  monitoring, setMonitoring, connected, hasError, data, 
  badTimer, breakTimer, goodFrames, badFrames, liveHistory,
  settings, setSettings, badPostureAlerts = 0, lowBlinkAlerts = 0, breakAlerts = 0, sessionStartTime = null
}: DashboardProps) => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [section, setSection] = useState<DashSection>("realtime");
  const [now, setNow] = useState(new Date());
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Handle local camera feed
  useEffect(() => {
    if (monitoring) {
      const startCamera = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (err) {
          console.error("Error accessing webcam:", err);
        }
      };
      startCamera();
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [monitoring]);

  // Clock tick
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const totalFrames = goodFrames + badFrames;
  const goodPct = totalFrames > 0 ? Number(((goodFrames / totalFrames) * 100).toFixed(1)) : 0;
  const badPct = totalFrames > 0 ? Number(((badFrames / totalFrames) * 100).toFixed(1)) : 0;
  const breakMin = Math.floor(breakTimer / 60);
  const breakSec = breakTimer % 60;

  const isGood = data?.status === "GOOD";
  const val = (v: number | undefined) => (v !== undefined && connected ? v.toFixed(2) : "—");

  const navItems: { key: DashSection; label: string }[] = [
    { key: "realtime", label: "Real-Time Analysis" },
    { key: "stats", label: "Stats" },
    { key: "progress", label: "Progress" },
    { key: "settings", label: "Settings" },
  ];

  const pieData = [
    { name: "Optimal", value: goodFrames || 1 },
    { name: "Correction Needed", value: badFrames || 0 },
  ];
  const COLORS = ["hsl(var(--primary))", "hsl(var(--destructive))"];

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden text-foreground">
      {/* Decorative Orbs */}
      <div className="absolute top-[-10%] right-[-5%] w-[30%] h-[30%] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[25%] h-[25%] bg-primary/10 rounded-full blur-[80px] pointer-events-none" />

      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 md:px-12 py-4 border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-12">
          <span className="font-heading text-3xl tracking-wider text-primary cursor-pointer hover:opacity-80 transition-opacity" onClick={() => navigate("/")}>PosturePal</span>
          <div className="hidden md:flex items-center gap-2">
            {navItems.map((item) => (
              <button
                key={item.key}
                onClick={() => setSection(item.key)}
                className={`px-4 py-2 text-sm font-body font-medium rounded-lg transition-all duration-200 ${section === item.key ? "text-primary bg-primary/10 shadow-[0_0_20px_rgba(var(--primary),0.1)]" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 px-4 py-2 bg-secondary/30 rounded-full border border-border/50">
            {hasError ? (
              <span className="flex items-center gap-2 text-xs font-body font-bold text-destructive">
                <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                OFFLINE
              </span>
            ) : monitoring ? (
              <span className="flex items-center gap-2 text-xs font-body font-bold text-primary">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse-dot shadow-[0_0_10px_hsl(var(--primary))]" />
                LIVE
              </span>
            ) : (
              <span className="flex items-center gap-2 text-xs font-body font-bold text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-muted-foreground" />
                IDLE
              </span>
            )}
            <div className="w-[1px] h-3 bg-border" />
            <span className="text-xs font-heading text-foreground tabular-nums tracking-wider text-muted-foreground">{formatTime(now)}</span>
          </div>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          {monitoring && (
             <button 
              onClick={() => setMonitoring(false)}
              className="p-2 rounded-lg border border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-all duration-200"
              title="Stop Monitoring"
             >
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
             </button>
          )}
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        {section === "realtime" && (
          <div className="flex-1 p-6 md:p-8 flex flex-col gap-8 max-w-[1600px] mx-auto w-full">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 items-start">
              
              {/* Camera Feed Context */}
              <div className="lg:col-span-8 flex flex-col gap-6">
                <div className={`relative bg-card rounded-2xl border-2 overflow-hidden aspect-video shadow-2xl transition-all duration-500 group ${
                  monitoring && connected ? (isGood ? "border-primary/40 shadow-primary/10" : "border-destructive/40 shadow-destructive/10") : "border-border/50"
                }`}>
                  {monitoring ? (
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover scale-x-[-1]"
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-secondary/10 backdrop-blur-sm px-4 text-center">
                      <div className="w-20 h-20 rounded-full bg-background/50 border border-border/50 flex items-center justify-center text-muted-foreground shadow-inner">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                      </div>
                      <span className="text-lg font-heading tracking-wide text-foreground/60">Monitoring Paused</span>
                      <button onClick={() => setMonitoring(true)} className="px-6 py-2 bg-primary text-primary-foreground rounded-full text-sm font-body font-bold hover:scale-105 transition-transform shadow-lg shadow-primary/20">Resume Assessment</button>
                    </div>
                  )}

                  {monitoring && connected && (
                    <div className="absolute top-6 left-6 flex flex-col gap-2">
                       <div className={`px-4 py-2 rounded-xl backdrop-blur-md border border-white/10 shadow-lg flex items-center gap-3 transition-colors ${isGood ? "bg-primary/20" : "bg-destructive/20"}`}>
                        <div className={`w-3 h-3 rounded-full ${isGood ? "bg-primary" : "bg-destructive"} animate-pulse`} />
                        <span className={`text-base font-heading font-bold tracking-widest ${isGood ? "text-primary" : "text-destructive"}`}>
                          {isGood ? "OPTIMAL POSTURE" : "CORRECTION NEEDED"}
                        </span>
                      </div>
                      <div className="px-3 py-1 bg-black/40 backdrop-blur-md rounded-lg self-start border border-white/5">
                        <span className="text-[10px] font-body font-bold text-white/70 uppercase tracking-tighter">AI Confidence: {(data?.confidence ?? 0 * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  )}
                  
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/10 to-transparent pointer-events-none" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   <div className="bg-card/50 backdrop-blur-sm p-6 rounded-2xl border border-border/50 shadow-lg group hover:border-primary/30 transition-colors">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-body font-bold text-muted-foreground uppercase tracking-wider">Session Quality</span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-heading text-primary">{goodPct}%</span>
                        <span className="text-xs font-body text-muted-foreground">optimal focus</span>
                      </div>
                      <div className="mt-4 h-1.5 w-full bg-secondary/50 rounded-full overflow-hidden">
                        <div className="h-full bg-primary transition-all duration-1000" style={{ width: `${goodPct}%` }} />
                      </div>
                   </div>

                   <div className="bg-card/50 backdrop-blur-sm p-6 rounded-2xl border border-border/50 shadow-lg group hover:border-blue-500/30 transition-colors">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-body font-bold text-muted-foreground uppercase tracking-wider">Eye Engagement</span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-4xl font-heading transition-colors ${connected && data && data.blink_rate < 12 ? "text-destructive" : "text-blue-500"}`}>
                          {connected && data ? data.blink_rate : "—"}
                        </span>
                        <span className="text-xs font-body text-muted-foreground">blinks / min</span>
                      </div>
                      <div className="mt-4 h-1.5 w-full bg-secondary/50 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${Math.min((data?.blink_rate ?? 0) / 20 * 100, 100)}%` }} />
                      </div>
                   </div>

                   <div className="bg-card/50 backdrop-blur-sm p-6 rounded-2xl border border-border/50 shadow-lg group hover:border-orange-500/30 transition-colors">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-body font-bold text-muted-foreground uppercase tracking-wider">Break Countdown</span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-heading text-orange-500 tabular-nums">
                           {breakMin}:{breakSec.toString().padStart(2, "0")}
                        </span>
                        <span className="text-xs font-body text-muted-foreground">until rest</span>
                      </div>
                      <div className="mt-4 h-1.5 w-full bg-secondary/50 rounded-full overflow-hidden">
                        <div className="h-full bg-orange-500 transition-all duration-1000" style={{ width: `${(breakTimer / (settings.breakReminderMin * 60)) * 100}%` }} />
                      </div>
                   </div>
                </div>
              </div>

              <div className="lg:col-span-4 flex flex-col gap-6">
                 <DashCard title="ANALYTICAL VECTORS">
                    <div className="flex flex-col gap-4">
                       {[
                        { label: "side_angle", key: "side_angle" as const, max: 45 },
                        { label: "forward_lean", key: "forward_lean" as const, max: 30 },
                        { label: "vertical_offset", key: "vertical_offset" as const, max: 20 },
                        { label: "shoulder_slope", key: "shoulder_slope" as const, max: 15 },
                       ].map((f) => (
                         <div key={f.key} className="flex flex-col gap-2">
                           <div className="flex justify-between items-center text-[11px] font-body font-bold text-muted-foreground">
                             <span className="uppercase tracking-wide">{f.label}</span>
                             <span className="text-foreground font-heading">{val(data?.[f.key])}°</span>
                           </div>
                           <div className="h-1 bg-secondary/30 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary/40 transition-all duration-300"
                                style={{ width: `${Math.min((data?.[f.key] ?? 0) / f.max * 100, 100)}%` }}
                              />
                           </div>
                         </div>
                       ))}
                    </div>
                    
                    <div className="mt-4 p-4 rounded-xl bg-secondary/20 border border-border/30 flex items-center justify-between">
                       <div className="flex flex-col">
                          <span className="text-[10px] font-body font-bold text-muted-foreground uppercase">Bad Posture Duration</span>
                          <span className={`text-2xl font-heading ${badTimer > settings.postureAlertThreshold ? "text-destructive" : "text-foreground"}`}>{badTimer}s</span>
                       </div>
                    </div>
                 </DashCard>

                 <DashCard title="REAL-TIME DRIFT">
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={liveHistory}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "rgba(0,0,0,0.8)",
                              backdropFilter: "blur(10px)",
                              border: "1px solid rgba(255,255,255,0.1)",
                              borderRadius: "12px",
                              fontSize: "10px",
                              padding: "8px"
                            }}
                            labelStyle={{ display: "none" }}
                          />
                          <Line type="monotone" dataKey="accuracy" stroke="hsl(var(--primary))" strokeWidth={3} dot={false} animationDuration={0} />
                          <Line type="monotone" dataKey="blinkRate" stroke="#3b82f6" strokeWidth={3} dot={false} animationDuration={0} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                 </DashCard>
              </div>
            </div>
          </div>
        )}

        {section === "stats" && (() => {
          // CHART 5 Variables
          const totalAlerts = badPostureAlerts + lowBlinkAlerts + breakAlerts;
          const avgBlink = liveHistory.length > 0 ? (liveHistory.reduce((acc, h) => acc + h.blinkRate, 0) / liveHistory.length).toFixed(1) : "0";
          const sessionMinutes = sessionStartTime ? ((new Date().getTime() - sessionStartTime.getTime()) / 60000).toFixed(1) : "0.0";
          
          const alertData = [
            { name: "Bad Posture", count: badPostureAlerts },
            { name: "Low Blink", count: lowBlinkAlerts },
            { name: "Break", count: breakAlerts },
          ];

          const historyWithScore = [...liveHistory].sort((a,b) => b.accuracy - a.accuracy);
          const bestPoint = historyWithScore[0];
          const worstPoint = historyWithScore[historyWithScore.length - 1];
          const bestWorstData = [];
          if (bestPoint && worstPoint && bestPoint !== worstPoint) {
            bestWorstData.push({ name: `Best`, score: bestPoint.accuracy, fill: "#00E5A0" });
            bestWorstData.push({ name: `Worst`, score: worstPoint.accuracy, fill: "#FF3D5A" });
          } else if (bestPoint) {
            bestWorstData.push({ name: `Best`, score: bestPoint.accuracy, fill: "#00E5A0" });
          }

          const CustomTooltip = ({ active, payload, label }: any) => {
            if (active && payload && payload.length) {
              return (
                <div style={{ backgroundColor: "#0F1419", border: "1px solid #1E2A38", padding: "10px", borderRadius: "8px" }}>
                  <p style={{ color: "#5A7090", margin: 0 }}>{label}</p>
                  <p style={{ color: payload[0].color || payload[0].fill, margin: 0, fontWeight: "bold" }}>
                    {payload[0].value}
                  </p>
                </div>
              );
            }
            return null;
          };

          return (
            <div className="flex-1 p-6 md:p-8 flex flex-col gap-6 w-full h-full bg-[#080C10] text-[#5A7090]">
              
              {/* CHART 5 — Session Summary Cards Row */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-[#0F1419] border border-[#1E2A38] rounded-xl p-6 flex flex-col gap-2">
                  <span className="text-xs uppercase tracking-widest text-[#5A7090]">Session Duration</span>
                  <span className="text-3xl font-bold text-white">{sessionMinutes} <span className="text-lg text-[#5A7090]">min</span></span>
                </div>
                <div className="bg-[#0F1419] border border-[#1E2A38] rounded-xl p-6 flex flex-col gap-2">
                  <span className="text-xs uppercase tracking-widest text-[#5A7090]">Overall Score</span>
                  <span className="text-3xl font-bold text-[#00E5A0]">{goodPct}%</span>
                </div>
                <div className="bg-[#0F1419] border border-[#1E2A38] rounded-xl p-6 flex flex-col gap-2">
                  <span className="text-xs uppercase tracking-widest text-[#5A7090]">Total Alerts</span>
                  <span className="text-3xl font-bold text-[#FF6B35]">{totalAlerts}</span>
                </div>
                <div className="bg-[#0F1419] border border-[#1E2A38] rounded-xl p-6 flex flex-col gap-2">
                  <span className="text-xs uppercase tracking-widest text-[#5A7090]">Avg Blink Rate</span>
                  <span className="text-3xl font-bold text-[#0099FF]">{avgBlink}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* CHART 1 — Posture Timeline Line Chart */}
                <div className="bg-[#0F1419] border border-[#1E2A38] rounded-xl p-6 flex flex-col gap-4 lg:col-span-2">
                  <h3 className="text-sm font-heading tracking-widest text-[#5A7090]">POSTURE SCORE TIMELINE</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={liveHistory}>
                        <defs>
                          <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#00E5A0" />
                            <stop offset="70%" stopColor="#00E5A0" />
                            <stop offset="100%" stopColor="#FF3D5A" />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1E2A38" />
                        <XAxis dataKey="sessionTime" stroke="#5A7090" tick={{ fill: "#5A7090" }} />
                        <YAxis domain={[0, 100]} stroke="#5A7090" tick={{ fill: "#5A7090" }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Line type="monotone" dataKey="accuracy" stroke="url(#scoreGradient)" strokeWidth={3} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* CHART 2 — Good vs Bad Posture Donut Chart */}
                <div className="bg-[#0F1419] border border-[#1E2A38] rounded-xl p-6 flex flex-col gap-4">
                  <h3 className="text-sm font-heading tracking-widest text-[#5A7090] text-center">GOOD VS BAD POSTURE</h3>
                  <div className="h-64 relative flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} innerRadius="60%" outerRadius="80%" paddingAngle={2} dataKey="value" stroke="none">
                          <Cell fill="#00E5A0" />
                          <Cell fill="#FF3D5A" />
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute flex flex-col items-center">
                      <span className="text-3xl font-bold text-white">{goodPct}%</span>
                      <span className="text-[10px] text-[#5A7090] uppercase">Optimal</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* CHART 3 — Blink Rate Line Chart */}
                <div className="bg-[#0F1419] border border-[#1E2A38] rounded-xl p-6 flex flex-col gap-4 lg:col-span-1">
                  <h3 className="text-sm font-heading tracking-widest text-[#5A7090]">BLINK RATE</h3>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={liveHistory}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1E2A38" />
                        <XAxis dataKey="sessionTime" hide />
                        <YAxis stroke="#5A7090" tick={{ fill: "#5A7090" }} />
                        <Tooltip content={<CustomTooltip />} />
                        <ReferenceArea y1={0} y2={12} fill="#FF3D5A" fillOpacity={0.1} />
                        <ReferenceLine y={12} stroke="#FF3D5A" strokeDasharray="3 3" />
                        <Line type="monotone" dataKey="blinkRate" stroke="#0099FF" strokeWidth={3} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* CHART 4 — Alert Frequency Bar Chart */}
                <div className="bg-[#0F1419] border border-[#1E2A38] rounded-xl p-6 flex flex-col gap-4">
                  <h3 className="text-sm font-heading tracking-widest text-[#5A7090]">ALERT FREQUENCY</h3>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={alertData} margin={{ top: 20, right: 0, left: -25, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1E2A38" />
                        <XAxis dataKey="name" stroke="#5A7090" tick={{ fill: "#5A7090", fontSize: 11 }} />
                        <YAxis stroke="#5A7090" tick={{ fill: "#5A7090" }} allowDecimals={false} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
                        <Bar dataKey="count" fill="#FF6B35" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* CHART 6 — Best and Worst Posture Bar Chart */}
                <div className="bg-[#0F1419] border border-[#1E2A38] rounded-xl p-6 flex flex-col gap-4">
                  <h3 className="text-sm font-heading tracking-widest text-[#5A7090]">BEST & WORST PERIODS</h3>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={bestWorstData} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#1E2A38" />
                        <XAxis type="number" domain={[0, 100]} stroke="#5A7090" tick={{ fill: "#5A7090" }} />
                        <YAxis dataKey="name" type="category" stroke="#5A7090" tick={{ fill: "#5A7090", fontSize: 11 }} width={80} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
                        <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                          {bestWorstData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>
            </div>
          );
        })()}

        {section === "progress" && <ComingSoon title="PROGRESS TRACKING" />}

        {section === "settings" && (
          <div className="flex-1 p-6 md:p-8 flex flex-col gap-8 max-w-[800px] mx-auto w-full">
            <h2 className="text-3xl font-heading tracking-wide mb-4">PREFERENCES</h2>
            <DashCard title="MONITORING CONFIGURATION">
               <div className="flex flex-col gap-8">
                  <div className="flex items-center justify-between">
                     <div>
                        <h4 className="text-base font-body font-bold">Native Notifications</h4>
                        <p className="text-xs text-muted-foreground">Enable desktop alerts for posture correction.</p>
                     </div>
                     <button 
                        onClick={() => setSettings({...settings, notificationsEnabled: !settings.notificationsEnabled})}
                        className={`w-12 h-6 rounded-full transition-colors relative ${settings.notificationsEnabled ? 'bg-primary' : 'bg-muted'}`}
                     >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.notificationsEnabled ? 'left-7' : 'left-1'}`} />
                     </button>
                  </div>

                  <div className="flex flex-col gap-4">
                     <div className="flex justify-between">
                        <h4 className="text-base font-body font-bold">Alert Sensitivity</h4>
                        <span className="text-primary font-heading">{settings.postureAlertThreshold}s</span>
                     </div>
                     <p className="text-xs text-muted-foreground -mt-2">Trigger alert after continuous bad posture.</p>
                     <input 
                        type="range" min="5" max="60" value={settings.postureAlertThreshold} 
                        onChange={(e) => setSettings({...settings, postureAlertThreshold: parseInt(e.target.value)})}
                        className="w-full accent-primary h-1 bg-secondary rounded-lg appearance-none cursor-pointer"
                     />
                  </div>

                  <div className="flex flex-col gap-4">
                     <div className="flex justify-between">
                        <h4 className="text-base font-body font-bold">Break Frequency</h4>
                        <span className="text-primary font-heading">{settings.breakReminderMin}m</span>
                     </div>
                     <p className="text-xs text-muted-foreground -mt-2">Set the interval for standing up and stretching.</p>
                     <input 
                        type="range" min="15" max="60" step="5" value={settings.breakReminderMin} 
                        onChange={(e) => setSettings({...settings, breakReminderMin: parseInt(e.target.value)})}
                        className="w-full accent-primary h-1 bg-secondary rounded-lg appearance-none cursor-pointer"
                     />
                  </div>
               </div>
            </DashCard>
            
            <button 
              onClick={() => setSection("realtime")}
              className="mt-4 px-6 py-3 bg-secondary hover:bg-secondary/80 text-foreground rounded-xl font-body font-bold transition-colors w-full"
            >
              Return to Analysis
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;

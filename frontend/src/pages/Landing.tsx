import { useNavigate } from "react-router-dom";
import { useTheme } from "@/hooks/use-theme";
import { clearAuthToken } from "@/lib/api";

interface LandingProps {
  monitoring: boolean;
  setMonitoring: (val: boolean) => void;
  connected: boolean;
  hasError: boolean;
  data: any;
}

const StepCard = ({ step, title, desc, icon }: { step: number; title: string; desc: string; icon: React.ReactNode }) => (
  <div className="bg-card border border-border rounded-xl p-6 flex flex-col items-center text-center gap-3 hover:border-primary/40 transition-colors duration-300">
    <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
      {icon}
    </div>
    <span className="text-xs text-muted-foreground font-body">STEP {step}</span>
    <h3 className="font-heading text-xl text-foreground tracking-wide">{title}</h3>
    <p className="text-sm text-muted-foreground font-body">{desc}</p>
  </div>
);

const FeatureCard = ({ title, desc, icon }: { title: string; desc: string; icon: React.ReactNode }) => (
  <div className="bg-card border border-border rounded-xl p-5 hover:border-primary/40 transition-colors duration-300 group">
    <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-3 group-hover:bg-primary/20 transition-colors">
      {icon}
    </div>
    <h3 className="font-heading text-lg text-foreground tracking-wide mb-1">{title}</h3>
    <p className="text-sm text-muted-foreground font-body">{desc}</p>
  </div>
);

const Landing = ({ monitoring, setMonitoring, connected, hasError }: LandingProps) => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const handleToggleMonitoring = () => {
    setMonitoring(!monitoring);
  };

  const performLogout = () => {
    clearAuthToken();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-background bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background flex flex-col relative overflow-hidden">
      {/* Decorative Orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-[120px] pointer-events-none animate-pulse" style={{ animationDuration: '6s' }} />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
      
      {/* Navbar */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 md:px-12 py-4 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <span className="font-heading text-3xl tracking-wider text-primary">PosturePal</span>
        <div className="flex items-center gap-4">
          <a href="#hero" className="text-sm font-body text-muted-foreground hover:text-foreground transition-colors">Home</a>
          <button onClick={() => navigate("/dashboard")} className="text-sm font-body text-muted-foreground hover:text-foreground transition-colors">Dashboard</button>
          <a href="#features" className="text-sm font-body text-muted-foreground hover:text-foreground transition-colors">About</a>
          <button onClick={toggleTheme} className="p-2 rounded-lg border border-border hover:bg-secondary transition-colors transition-all duration-300">
            {theme === "dark" ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-foreground"><circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-foreground"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
            )}
          </button>
          <button onClick={performLogout} className="text-xs text-muted-foreground hover:text-destructive transition-colors ml-4 uppercase tracking-widest font-body font-bold">Logout</button>
        </div>
      </nav>

      {/* Hero */}
      <main id="hero" className="flex-1 flex flex-col items-center justify-center px-4 py-16 md:py-24 max-w-4xl mx-auto text-center">
        {monitoring && (
          <div className="mb-4 px-3 py-1 bg-green-500/10 border border-green-500/20 text-green-500 text-[10px] font-bold uppercase tracking-widest rounded-full animate-pulse">
            Monitoring Active in Background
          </div>
        )}
        <span className="px-4 py-1.5 text-xs font-body font-semibold rounded-full border border-primary/40 text-primary bg-primary/10 mb-6 animate-fade-up">
          AI POWERED MONITORING
        </span>
        <h1 className="font-heading text-5xl md:text-8xl text-foreground tracking-wide leading-tight animate-fade-up opacity-0 [animation-delay:0.1s]">
          SIT BETTER.<br />LIVE BETTER.
        </h1>
        <p className="mt-8 text-muted-foreground text-lg md:text-xl max-w-2xl font-body animate-fade-up opacity-0 [animation-delay:0.2s]">
          Real-time posture analysis powered by computer vision. Protect your spine and eyes, silently in the background.
        </p>

        {/* CTA */}
        <div className="mt-12 flex flex-col items-center animate-fade-up opacity-0 [animation-delay:0.35s]">
          <button
            onClick={handleToggleMonitoring}
            className={`px-10 py-5 font-body font-bold text-lg rounded-xl transition-all duration-300 border relative overflow-hidden group mb-8 ${
              monitoring 
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:shadow-[0_0_45px_hsl(var(--destructive))]" 
                : "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-[0_0_45px_hsl(var(--primary))]"
            }`}
          >
            <span className="relative z-10 flex items-center gap-3">
              {monitoring ? "Stop Monitoring" : "Start Monitoring"} 
              <span className="text-xl group-hover:translate-x-2 transition-transform duration-300">→</span>
            </span>
            <div className="absolute inset-0 bg-white/20 transform -skew-x-12 -translate-x-full group-hover:translate-x-[150%] transition-transform duration-700 ease-out" />
          </button>
          
          <div className="flex gap-8 items-center border-t border-border/50 pt-8 mt-4">
             {[
              { value: hasError ? "Error" : connected ? "Connected" : "Standby", label: "System Status" },
              { value: "90%", label: "Accuracy" },
              { value: "Privacy", label: "Focused" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className={`font-heading text-2xl ${stat.value === 'Error' ? 'text-destructive' : 'text-primary'}`}>{stat.value}</div>
                <div className="text-[10px] text-muted-foreground font-body uppercase tracking-widest">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* How It Works */}
      <section className="px-6 md:px-12 py-16 md:py-24 border-t border-border/50 bg-secondary/10">
        <h2 className="font-heading text-4xl md:text-5xl text-foreground text-center tracking-wide mb-4">HOW IT WORKS</h2>
        <p className="text-muted-foreground text-center font-body mb-12 max-w-md mx-auto">Seamless protection in three steps</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <StepCard step={1} title="CAMERA ACQUIRED" desc="Your webcam monitors your landmarks only when monitoring is active." icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>} />
          <StepCard step={2} title="POSTURE ANALYZED" desc="Advanced AI classifies 4 key skeletal features to maintain your health." icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>} />
          <StepCard step={3} title="CORRECTED ALERTS" desc="Receive subtle notifications when corrections are needed." icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" /></svg>} />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-6 md:px-12 py-16 md:py-24 border-t border-border/50">
        <h2 className="font-heading text-4xl md:text-5xl text-foreground text-center tracking-wide mb-4">FEATURES</h2>
        <p className="text-muted-foreground text-center font-body mb-12 max-w-md mx-auto">A modern eye for your health</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <FeatureCard title="POSTURE DETECTION" desc="Real-time classification using skeletal landmarks." icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>} />
          <FeatureCard title="BLINK RATE MONITOR" desc="Prevents digital eye strain by tracking your blinks." icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>} />
          <FeatureCard title="BREAK REMINDERS" desc="Built-in timer to encourage regular movement." icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>} />
          <FeatureCard title="GLASSMORPHISM UI" desc="A premium dashboard that looks beautiful on any display." icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" /></svg>} />
          <FeatureCard title="NATIVE PRIVACY" desc="Detection runs locally. Your data never leaves your device." icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>} />
          <FeatureCard title="BACKGROUND MODE" desc="Works silently while you focus on your productivity." icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>} />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 px-6 md:px-12 py-12 bg-card">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex flex-col items-center md:items-start gap-1">
            <span className="font-heading text-3xl text-primary tracking-wider">PosturePal</span>
            <span className="text-sm text-muted-foreground font-body">Sit better. Live better.</span>
          </div>
          <div className="text-[10px] text-muted-foreground font-body text-center max-w-xs leading-relaxed uppercase tracking-widest bg-secondary/20 p-4 rounded-lg border border-border/50">
            Powered by Computer Vision · Local Edge AI · High Performance MediaPipe Integration
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;

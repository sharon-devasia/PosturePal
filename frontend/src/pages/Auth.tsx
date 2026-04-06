import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { setAuthToken, getAuthToken, apiFetch } from "@/lib/api";
import { useTheme } from "@/hooks/use-theme";
import { toast } from "sonner";

const Auth = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  
  // If already logged in, redirect away from auth page
  useEffect(() => {
    if (getAuthToken()) {
      navigate("/");
    }
  }, [navigate]);

  const [isLogin, setIsLogin] = useState(true);
  
  // Form Fields
  const [identifier, setIdentifier] = useState(""); // For Login
  const [name, setName] = useState(""); // For Register
  const [email, setEmail] = useState(""); // For Register
  const [password, setPassword] = useState(""); // Shared

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const endpoint = isLogin ? "/auth/login" : "/auth/register";
      let body: string;

      if (isLogin) {
        body = JSON.stringify({ identifier, password });
      } else {
        body = JSON.stringify({ name, email, password });
      }

      const res = await fetch(`http://localhost:8000${endpoint}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body,
      });

      const data = await res.json();

      if (res.ok) {
        if (data.access_token) {
          setAuthToken(data.access_token);
        } else if (data.token) {
          setAuthToken(data.token);
        }
        toast.success(isLogin ? "Login successful!" : "Registration successful!");
        navigate("/");
      } else {
        toast.error(data.detail || "Authentication failed. Please try again.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center relative overflow-hidden text-foreground">
      {/* Decorative Orbs */}
      <div className="absolute top-[10%] right-[10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[10%] left-[10%] w-[30%] h-[30%] bg-primary/5 rounded-full blur-[80px] pointer-events-none" />

      <div className="z-10 bg-card/30 backdrop-blur-md border border-border/50 rounded-3xl p-8 md:p-12 shadow-2xl w-full max-w-md animate-slide-in">
        <div className="flex items-center justify-between mb-8">
          <span className="font-heading text-3xl tracking-wider text-primary">PosturePal</span>
          <button onClick={toggleTheme} className="p-2 rounded-lg border border-border hover:bg-secondary transition-colors">
            {theme === "dark" ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-foreground"><circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-foreground"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
            )}
          </button>
        </div>

        <h2 className="font-heading text-2xl mb-2">{isLogin ? "Welcome Back" : "Create Account"}</h2>
        <p className="text-sm text-muted-foreground font-body mb-8">
          {isLogin ? "Log in to access your posture analytics." : "Register to start monitoring your health."}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {isLogin ? (
             <div className="flex flex-col gap-2">
                <label className="text-xs font-body font-bold text-muted-foreground uppercase tracking-widest">Username or Email</label>
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="bg-secondary/30 border border-border/50 rounded-xl px-4 py-3 outline-none focus:border-primary/50 transition-colors font-body"
                  placeholder="Enter your username or email"
                />
             </div>
          ) : (
             <>
               <div className="flex flex-col gap-2">
                  <label className="text-xs font-body font-bold text-muted-foreground uppercase tracking-widest">Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-secondary/30 border border-border/50 rounded-xl px-4 py-3 outline-none focus:border-primary/50 transition-colors font-body"
                    placeholder="Enter your full name"
                  />
               </div>
               <div className="flex flex-col gap-2">
                  <label className="text-xs font-body font-bold text-muted-foreground uppercase tracking-widest">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-secondary/30 border border-border/50 rounded-xl px-4 py-3 outline-none focus:border-primary/50 transition-colors font-body"
                    placeholder="Enter your email address"
                  />
               </div>
             </>
          )}
          
          <div className="flex flex-col gap-2">
            <label className="text-xs font-body font-bold text-muted-foreground uppercase tracking-widest">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-secondary/30 border border-border/50 rounded-xl px-4 py-3 outline-none focus:border-primary/50 transition-colors font-body"
              placeholder="Enter your password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-4 mt-2 rounded-xl font-heading tracking-widest font-bold transition-all ${
              loading ? "bg-primary/50 text-foreground/50 cursor-not-allowed" : "bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-[1.02] shadow-[0_0_20px_rgba(var(--primary),0.3)]"
            }`}
          >
            {loading ? "PROCESSING..." : isLogin ? "LOGIN" : "GET STARTED"}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button 
            type="button" 
            onClick={() => setIsLogin(!isLogin)} 
            className="text-sm font-body text-muted-foreground hover:text-foreground transition-colors"
          >
            {isLogin ? "Don't have an account? Register" : "Already have an account? Log in"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;

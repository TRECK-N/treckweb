import { createFileRoute, useNavigate, redirect, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import auroraBg from "@/assets/aurora-bg.jpg";
import { ArrowRight, Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  beforeLoad: async () => {
    if (typeof window !== "undefined") {
      const { data } = await supabase.auth.getSession();
      if (data.session) throw redirect({ to: "/dashboard" });
    }
  },
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) navigate({ to: "/dashboard" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back!");
        navigate({ to: "/dashboard" });
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: name },
          },
        });
        if (error) throw error;
        toast.success("Account created. Welcome to TreckWeb!");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Reset email sent — check your inbox.");
        setMode("signin");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    setLoading(true);
    const res = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (res.error) {
      toast.error(res.error.message);
      setLoading(false);
      return;
    }
    if (res.redirected) return;
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="relative min-h-screen grid place-items-center px-4 py-10 overflow-hidden bg-background">
      <img src={auroraBg} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-30 pointer-events-none" />
      <div className="absolute inset-0 mesh-bg opacity-60" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 glass rounded-3xl w-full max-w-md p-8 shadow-[var(--shadow-elevated)]"
      >
        <Link to="/" className="flex items-center gap-2 font-bold text-xl mb-6">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary to-primary-glow shadow-[var(--shadow-glow)]" />
          TreckWeb
        </Link>

        <h1 className="text-2xl font-bold tracking-tight">
          {mode === "signin" && "Welcome back"}
          {mode === "signup" && "Create your account"}
          {mode === "forgot" && "Reset your password"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {mode === "signin" && "Sign in to your TreckWeb workspace."}
          {mode === "signup" && "Start studying, chatting and building."}
          {mode === "forgot" && "We'll email you a reset link."}
        </p>

        {mode !== "forgot" && (
          <>
            <button
              onClick={google}
              disabled={loading}
              className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background/40 py-2.5 text-sm font-medium hover:bg-accent transition disabled:opacity-50"
            >
              <GoogleIcon /> Continue with Google
            </button>
            <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
            </div>
          </>
        )}

        <form onSubmit={onSubmit} className="space-y-3">
          {mode === "signup" && (
            <Field label="Full name">
              <input
                required value={name} onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-border bg-background/40 px-3 py-2.5 text-sm outline-none focus:border-primary transition"
                placeholder="Ada Lovelace"
              />
            </Field>
          )}
          <Field label="Email">
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-border bg-background/40 px-3 py-2.5 text-sm outline-none focus:border-primary transition"
              placeholder="you@school.edu" autoComplete="email"
            />
          </Field>
          {mode !== "forgot" && (
            <Field label="Password">
              <input
                type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                className="w-full rounded-xl border border-border bg-background/40 px-3 py-2.5 text-sm outline-none focus:border-primary transition"
                placeholder="••••••••" autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
            </Field>
          )}

          <button
            type="submit" disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground py-2.5 text-sm font-semibold hover:opacity-90 transition disabled:opacity-50 shadow-[var(--shadow-glow)]"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>
              {mode === "signin" && "Sign in"}
              {mode === "signup" && "Create account"}
              {mode === "forgot" && "Send reset link"}
              <ArrowRight className="h-4 w-4" />
            </>}
          </button>
        </form>

        <div className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground justify-center">
          {mode === "signin" && (<>
            <button onClick={() => setMode("signup")} className="hover:text-foreground transition">Create account</button>
            <button onClick={() => setMode("forgot")} className="hover:text-foreground transition">Forgot password?</button>
          </>)}
          {mode === "signup" && (
            <button onClick={() => setMode("signin")} className="hover:text-foreground transition">Already have an account? Sign in</button>
          )}
          {mode === "forgot" && (
            <button onClick={() => setMode("signin")} className="hover:text-foreground transition">Back to sign in</button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
  );
}

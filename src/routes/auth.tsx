import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { setSessionPersistence } from "@/lib/session-persistence";
import logoAsset from "@/assets/treckweb-logo.png.asset.json";
import { ArrowRight, Loader2, Check } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — WebuWeb" },
      { name: "description", content: "Sign in or create your WebuWeb account to open your workspace, chat, study tools and games." },
      { property: "og:title", content: "Sign in — WebuWeb" },
      { property: "og:description", content: "Sign in or create your WebuWeb account to open your workspace, chat, study tools and games." },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window !== "undefined") {
      const { data } = await supabase.auth.getSession();
      if (data.session) throw redirect({ to: "/dashboard" });
    }
  },
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";

const HIGHLIGHTS = [
  "AI assistant with saved conversations",
  "Private chat, friends and groups",
  "Workspace, study sets and games",
];

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [stay, setStay] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) navigate({ to: "/dashboard", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signin") {
        setSessionPersistence(stay);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back");
        navigate({ to: "/dashboard", replace: true });
      } else if (mode === "signup") {
        setSessionPersistence(stay);
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: name } },
        });
        if (error) throw error;
        toast.success("Account created. Welcome to WebuWeb.");
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
    setSessionPersistence(stay);
    const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (res.error) {
      toast.error(res.error.message);
      setLoading(false);
      return;
    }
    if (res.redirected) return;
    navigate({ to: "/dashboard", replace: true });
  };

  const field =
    "w-full rounded-xl border border-border/70 bg-background/50 px-3.5 py-3 text-sm outline-none transition focus:border-primary/70 focus:bg-background/80";

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/3 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-primary/15 blur-[120px]" />
        <div className="absolute -bottom-48 right-0 h-[28rem] w-[28rem] rounded-full bg-primary-glow/10 blur-[120px]" />
        <div className="absolute inset-0 mesh-bg opacity-40" />
      </div>

      <div className="relative z-10 mx-auto grid min-h-screen max-w-6xl items-center gap-12 px-6 py-12 lg:grid-cols-[1.05fr_1fr]">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="hidden lg:block"
        >
          <div className="flex items-center gap-3">
            <img src={logoAsset.url} alt="WebuWeb" className="h-11 w-11 rounded-2xl object-cover ring-1 ring-border/60" />
            <span className="text-xl font-semibold tracking-tight">WebuWeb</span>
          </div>
          <h1 className="mt-10 text-5xl font-semibold leading-[1.05] tracking-tight">
            Your workspace,
            <br />
            <span className="text-muted-foreground">quietly powerful.</span>
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-muted-foreground">
            One calm, private place to think, talk, study and play. Sign in to continue where you left off.
          </p>
          <ul className="mt-8 space-y-3">
            {HIGHLIGHTS.map((h) => (
              <li key={h} className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="grid h-5 w-5 place-items-center rounded-full border border-border/70 bg-background/60">
                  <Check className="h-3 w-3 text-primary" />
                </span>
                {h}
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="glass mx-auto w-full max-w-md rounded-3xl p-8 shadow-[var(--shadow-elevated)]"
        >
          <div className="flex items-center gap-2.5 lg:hidden">
            <img src={logoAsset.url} alt="WebuWeb" className="h-9 w-9 rounded-xl object-cover ring-1 ring-border/60" />
            <span className="text-lg font-semibold tracking-tight">WebuWeb</span>
          </div>

          <h2 className="mt-6 text-2xl font-semibold tracking-tight lg:mt-0">
            {mode === "signin" && "Sign in"}
            {mode === "signup" && "Create your account"}
            {mode === "forgot" && "Reset your password"}
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {mode === "signin" && "Welcome back to WebuWeb."}
            {mode === "signup" && "It takes less than a minute."}
            {mode === "forgot" && "We'll email you a secure reset link."}
          </p>

          {mode !== "forgot" && (
            <>
              <button
                onClick={google}
                disabled={loading}
                className="mt-6 inline-flex w-full items-center justify-center gap-2.5 rounded-xl border border-border/70 bg-background/50 py-3 text-sm font-medium transition hover:bg-accent/60 disabled:opacity-50"
              >
                <GoogleIcon /> Continue with Google
              </button>
              <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-wider text-muted-foreground">
                <div className="h-px flex-1 bg-border/70" /> or <div className="h-px flex-1 bg-border/70" />
              </div>
            </>
          )}

          <form onSubmit={onSubmit} className="space-y-3.5">
            {mode === "signup" && (
              <Field label="Full name">
                <input required value={name} onChange={(e) => setName(e.target.value)} className={field} placeholder="Ada Lovelace" />
              </Field>
            )}
            <Field label="Email">
              <input
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className={field} placeholder="you@school.edu" autoComplete="email"
              />
            </Field>
            {mode !== "forgot" && (
              <Field label="Password">
                <input
                  type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                  minLength={6} className={field} placeholder="••••••••"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                />
              </Field>
            )}

            {mode !== "forgot" && (
              <label className="flex cursor-pointer select-none items-center gap-2.5 pt-1 text-sm text-muted-foreground">
                <input
                  type="checkbox" checked={stay} onChange={(e) => setStay(e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-[hsl(var(--primary))]"
                />
                Stay signed in
              </label>
            )}

            <button
              type="submit" disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition hover:opacity-90 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                <>
                  {mode === "signin" && "Sign in"}
                  {mode === "signup" && "Create account"}
                  {mode === "forgot" && "Send reset link"}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            {mode === "signin" && (
              <>
                <button onClick={() => setMode("signup")} className="transition hover:text-foreground">Create account</button>
                <button onClick={() => setMode("forgot")} className="transition hover:text-foreground">Forgot password?</button>
              </>
            )}
            {mode === "signup" && (
              <button onClick={() => setMode("signin")} className="transition hover:text-foreground">Already have an account? Sign in</button>
            )}
            {mode === "forgot" && (
              <button onClick={() => setMode("signin")} className="transition hover:text-foreground">Back to sign in</button>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
  );
}

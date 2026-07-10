import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import auroraBg from "@/assets/aurora-bg.jpg";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) setReady(true);
    else {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) setReady(true);
      });
    }
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated!");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="relative min-h-screen grid place-items-center px-4 bg-background overflow-hidden">
      <img src={auroraBg} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-30" />
      <div className="relative z-10 glass rounded-3xl w-full max-w-md p-8">
        <h1 className="text-2xl font-bold">Reset your password</h1>
        <p className="text-sm text-muted-foreground mt-1">Enter a new password below.</p>
        {ready ? (
          <form onSubmit={submit} className="mt-6 space-y-3">
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password"
              className="w-full rounded-xl border border-border bg-background/40 px-3 py-2.5 text-sm outline-none focus:border-primary" autoFocus />
            <button type="submit" disabled={loading} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50 shadow-[var(--shadow-glow)]">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update password"}
            </button>
          </form>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">This link is invalid or expired. Please request a new reset from the sign-in page.</p>
        )}
      </div>
    </div>
  );
}

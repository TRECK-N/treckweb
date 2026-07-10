import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Loader2, Save, LogOut, Trash2, Sun, Moon, Bell, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/components/theme-provider";

export const Route = createFileRoute("/_authenticated/settings")({
  component: Settings,
});

function Settings() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [saving, setSaving] = useState(false);
  const [pwd, setPwd] = useState("");
  const [notif, setNotif] = useState(true);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      return data;
    },
  });

  const [form, setForm] = useState({ display_name: "", username: "", bio: "", language: "en" });
  useEffect(() => {
    if (profile) setForm({
      display_name: profile.display_name ?? "",
      username: profile.username ?? "",
      bio: profile.bio ?? "",
      language: profile.language ?? "en",
    });
  }, [profile]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("profiles").update(form).eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["profile", user.id] });
    toast.success("Profile saved");
  };

  const changePassword = async () => {
    if (pwd.length < 6) return toast.error("Password must be at least 6 characters");
    const { error } = await supabase.auth.updateUser({ password: pwd });
    if (error) return toast.error(error.message);
    setPwd("");
    toast.success("Password updated");
  };

  const deleteAccount = async () => {
    if (!confirm("Delete your account? This cannot be undone.")) return;
    // Anonymize + sign out (server-side deletion requires admin role)
    await supabase.from("profiles").update({ display_name: "Deleted user", bio: null, avatar_url: null }).eq("id", user.id);
    await supabase.auth.signOut();
    toast.success("Account marked for deletion");
    navigate({ to: "/" });
  };

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  if (isLoading) {
    return <div className="grid place-items-center h-screen"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account and preferences.</p>
      </div>

      {/* Profile */}
      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-6">
        <h2 className="font-semibold mb-4">Profile</h2>
        <div className="flex items-center gap-4 mb-6">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-primary-glow grid place-items-center text-primary-foreground text-xl font-bold overflow-hidden">
            {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : (form.display_name[0]?.toUpperCase() ?? "?")}
          </div>
          <div className="text-sm text-muted-foreground">
            <div className="font-medium text-foreground">{user.email}</div>
            <div>Member since {new Date(user.created_at).toLocaleDateString()}</div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Display name">
            <input value={form.display_name} onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))} className={inp} />
          </Field>
          <Field label="Username">
            <input value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} className={inp} />
          </Field>
          <Field label="Avatar URL">
            <input placeholder="https://…" value={profile?.avatar_url ?? ""} onChange={async (e) => {
              await supabase.from("profiles").update({ avatar_url: e.target.value }).eq("id", user.id);
              qc.invalidateQueries({ queryKey: ["profile", user.id] });
            }} className={inp} />
          </Field>
          <Field label="Language">
            <select value={form.language} onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))} className={inp}>
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Bio">
              <textarea rows={3} value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} className={`${inp} resize-none`} />
            </Field>
          </div>
        </div>

        <button onClick={save} disabled={saving} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50 shadow-[var(--shadow-glow)]">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save changes
        </button>
      </motion.section>

      {/* Appearance */}
      <section className="glass rounded-2xl p-6">
        <h2 className="font-semibold mb-4">Appearance</h2>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setTheme("light")} className={`glass rounded-xl p-4 flex flex-col items-center gap-2 border-2 transition ${theme === "light" ? "border-primary" : "border-transparent"}`}>
            <Sun className="h-5 w-5" /><span className="text-sm">Light</span>
          </button>
          <button onClick={() => setTheme("dark")} className={`glass rounded-xl p-4 flex flex-col items-center gap-2 border-2 transition ${theme === "dark" ? "border-primary" : "border-transparent"}`}>
            <Moon className="h-5 w-5" /><span className="text-sm">Dark</span>
          </button>
        </div>
      </section>

      {/* Notifications */}
      <section className="glass rounded-2xl p-6">
        <h2 className="font-semibold mb-4 flex items-center gap-2"><Bell className="h-4 w-4" />Notifications</h2>
        <label className="flex items-center justify-between text-sm">
          <span>In-app toast notifications</span>
          <input type="checkbox" checked={notif} onChange={(e) => setNotif(e.target.checked)} className="h-4 w-4" />
        </label>
      </section>

      {/* Security */}
      <section className="glass rounded-2xl p-6">
        <h2 className="font-semibold mb-4">Change password</h2>
        <div className="flex gap-2">
          <input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="New password" className={`${inp} flex-1`} />
          <button onClick={changePassword} className="rounded-xl bg-primary text-primary-foreground px-4 text-sm font-semibold hover:opacity-90">Update</button>
        </div>
      </section>

      {/* Danger */}
      <section className="glass rounded-2xl p-6 border border-destructive/30">
        <h2 className="font-semibold mb-4 text-destructive">Danger zone</h2>
        <div className="flex flex-wrap gap-3">
          <button onClick={signOut} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm hover:bg-accent"><LogOut className="h-4 w-4" />Sign out</button>
          <button onClick={deleteAccount} className="inline-flex items-center gap-2 rounded-xl bg-destructive text-destructive-foreground px-4 py-2 text-sm hover:opacity-90"><Trash2 className="h-4 w-4" />Delete account</button>
        </div>
      </section>
    </div>
  );
}

const inp = "w-full rounded-xl border border-border bg-background/40 px-3 py-2.5 text-sm outline-none focus:border-primary transition";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

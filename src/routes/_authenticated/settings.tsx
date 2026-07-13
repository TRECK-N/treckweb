import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Loader2, Save, LogOut, Trash2, Sun, Moon, Upload, Image as ImageIcon, Camera,
} from "lucide-react";
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
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

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

  const uploadAvatar = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB");
      return;
    }
    setAvatarUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, {
        contentType: file.type, upsert: false,
      });
      if (uploadError) throw uploadError;
      const { data: signed } = await supabase.storage.from("avatars")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 5); // 5-year signed URL
      if (!signed?.signedUrl) throw new Error("Could not generate URL");
      const { error: updateError } = await supabase
        .from("profiles").update({ avatar_url: signed.signedUrl }).eq("id", user.id);
      if (updateError) throw updateError;
      qc.invalidateQueries({ queryKey: ["profile", user.id] });
      toast.success("Profile picture updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setAvatarUploading(false);
      setShowPicker(false);
    }
  };

  const pickFromLibrary = async (path: string) => {
    setAvatarUploading(true);
    try {
      // Copy the file into avatars bucket so RLS/lifetime is stable
      const { data: fileData, error: dlErr } = await supabase.storage.from("workspace").download(path);
      if (dlErr || !fileData) throw dlErr ?? new Error("Download failed");
      const ext = path.split(".").pop() || "png";
      const newPath = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(newPath, fileData, {
        contentType: fileData.type, upsert: false,
      });
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage.from("avatars")
        .createSignedUrl(newPath, 60 * 60 * 24 * 365 * 5);
      if (!signed?.signedUrl) throw new Error("Could not generate URL");
      await supabase.from("profiles").update({ avatar_url: signed.signedUrl }).eq("id", user.id);
      qc.invalidateQueries({ queryKey: ["profile", user.id] });
      toast.success("Profile picture updated");
      setShowPicker(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to use image");
    } finally { setAvatarUploading(false); }
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
    <div className="p-6 lg:p-10 max-w-3xl mx-auto space-y-6 pb-40">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account and preferences.</p>
      </div>

      {/* Profile */}
      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-6">
        <h2 className="font-semibold mb-4">Profile</h2>
        <div className="flex items-center gap-4 mb-6">
          <div className="relative group">
            <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary to-primary-glow grid place-items-center text-primary-foreground text-2xl font-bold overflow-hidden shadow-[var(--shadow-glow)]">
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                : (form.display_name[0]?.toUpperCase() ?? "?")}
            </div>
            <button
              onClick={() => setShowPicker(true)}
              disabled={avatarUploading}
              className="absolute inset-0 rounded-2xl bg-black/60 backdrop-blur-sm grid place-items-center opacity-0 group-hover:opacity-100 transition text-white text-xs disabled:opacity-100"
              aria-label="Change picture"
            >
              {avatarUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Camera className="h-4 w-4 mb-0.5" /><span>Change</span></>}
            </button>
          </div>
          <div className="text-sm text-muted-foreground">
            <div className="font-medium text-foreground">{user.email}</div>
            <div>Member since {new Date(user.created_at).toLocaleDateString()}</div>
            <button
              onClick={() => setShowPicker(true)}
              disabled={avatarUploading}
              className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs hover:bg-accent transition"
            >
              <Upload className="h-3 w-3" /> Change profile picture
            </button>
          </div>
        </div>

        <input
          ref={avatarInputRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadAvatar(f); e.target.value = ""; }}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Display name">
            <input value={form.display_name} onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))} className={inp} />
          </Field>
          <Field label="Username">
            <input value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} className={inp} />
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

      {showPicker && (
        <AvatarPicker
          userId={user.id}
          onUpload={uploadAvatar}
          onPick={pickFromLibrary}
          onClose={() => setShowPicker(false)}
          uploading={avatarUploading}
        />
      )}
    </div>
  );
}

function AvatarPicker({
  userId, onUpload, onPick, onClose, uploading,
}: {
  userId: string;
  onUpload: (file: File) => void;
  onPick: (path: string) => void;
  onClose: () => void;
  uploading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: files = [] } = useQuery({
    queryKey: ["workspace-images", userId],
    queryFn: async () => {
      const { data } = await supabase.from("workspace_files")
        .select("id, name, storage_path, mime_type")
        .eq("user_id", userId)
        .like("mime_type", "image/%")
        .order("created_at", { ascending: false })
        .limit(24);
      return data ?? [];
    },
  });

  const [signedMap, setSignedMap] = useState<Record<string, string>>({});
  useEffect(() => {
    (async () => {
      const paths = files.map((f) => f.storage_path);
      if (!paths.length) return;
      const { data } = await supabase.storage.from("workspace").createSignedUrls(paths, 3600);
      const next: Record<string, string> = {};
      (data ?? []).forEach((r) => { if (r.path && r.signedUrl) next[r.path] = r.signedUrl; });
      setSignedMap(next);
    })();
  }, [files]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="glass rounded-2xl p-6 w-full max-w-lg max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg">Change profile picture</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-accent text-muted-foreground">✕</button>
        </div>

        <input ref={inputRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }} />

        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full rounded-2xl border-2 border-dashed border-border p-6 flex flex-col items-center gap-2 hover:border-primary hover:bg-accent/40 transition disabled:opacity-50"
        >
          {uploading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <Upload className="h-6 w-6 text-primary" />}
          <span className="text-sm font-medium">Upload a new picture</span>
          <span className="text-xs text-muted-foreground">PNG, JPG or GIF — up to 5 MB</span>
        </button>

        {files.length > 0 && (
          <>
            <div className="mt-5 mb-2 flex items-center gap-2 text-xs text-muted-foreground">
              <ImageIcon className="h-3.5 w-3.5" />
              Or pick from your Workspace
            </div>
            <div className="flex-1 overflow-y-auto grid grid-cols-4 gap-2">
              {files.map((f) => {
                const url = signedMap[f.storage_path];
                return (
                  <button key={f.id} onClick={() => onPick(f.storage_path)}
                    disabled={uploading || !url}
                    className="aspect-square rounded-xl overflow-hidden bg-accent border-2 border-transparent hover:border-primary transition disabled:opacity-50">
                    {url ? <img src={url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center"><Loader2 className="h-4 w-4 animate-spin" /></div>}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}


function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
        checked ? "bg-primary" : "bg-accent"
      }`}
    >
      <motion.span
        layout
        className="inline-block h-5 w-5 rounded-full bg-white shadow"
        style={{ marginLeft: checked ? 22 : 2 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    </button>
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

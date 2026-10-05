import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { ArrowLeft, ArrowUp, ArrowDown, Eye, EyeOff, Pencil, Trash2, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchGames, fetchIsAdmin, GAME_CATEGORIES, APPROVED_EMBED_HOSTS, isApprovedEmbed, type GameRow } from "@/lib/games";

export const Route = createFileRoute("/_authenticated/games/admin")({
  head: () => ({
    meta: [
      { title: "Manage games — WebuWeb" },
      { name: "description", content: "Admin tools for the WebuWeb game library." },
      { property: "og:title", content: "Manage games — WebuWeb" },
      { property: "og:description", content: "Admin tools for the WebuWeb game library." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

const httpsUrl = z.string().trim().url().refine((u) => u.startsWith("https://"), "Must start with https://");
const schema = z.object({
  title: z.string().trim().min(1).max(80),
  slug: z.string().trim().regex(/^[a-z0-9-]{2,60}$/, "Lowercase letters, numbers and dashes"),
  description: z.string().trim().max(400),
  category: z.enum(GAME_CATEGORIES),
  thumbnail_url: httpsUrl.or(z.literal("")),
  official_url: httpsUrl.or(z.literal("")),
  embed_url: httpsUrl.refine(isApprovedEmbed, `Embed must come from: ${APPROVED_EMBED_HOSTS.join(", ")}`),
  aspect_ratio: z.coerce.number().min(0.4).max(3),
});
type Form = z.input<typeof schema>;
const EMPTY: Form = { title: "", slug: "", description: "", category: "Casual", thumbnail_url: "", official_url: "", embed_url: "", aspect_ratio: 1.6 };

/** Pull the src out of pasted embed code, so admins can paste the official iframe snippet. */
function extractSrc(v: string) {
  const m = v.match(/src=["']([^"']+)["']/i);
  if (!m) return v.trim();
  try { const u = new URL(m[1]); u.searchParams.delete("gd_sdk_referrer_url"); return u.toString(); } catch { return m[1]; }
}

function AdminPage() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const isAdmin = useQuery({ queryKey: ["is-admin", user.id], queryFn: () => fetchIsAdmin(user.id) });
  const games = useQuery({ queryKey: ["games"], queryFn: fetchGames, enabled: !!isAdmin.data });
  const [form, setForm] = useState<Form>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["games"] });

  if (isAdmin.isLoading) return <div className="grid min-h-[50vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!isAdmin.data) return <div className="mx-auto max-w-md px-4 py-16 text-center text-muted-foreground">Only administrators can manage games. <Link to="/games" className="text-primary">Back to games</Link></div>;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    const v = parsed.data;
    const row = { ...v, thumbnail_url: v.thumbnail_url || null, official_url: v.official_url || null };
    setSaving(true);
    const { error } = editing
      ? await supabase.from("games").update(row).eq("id", editing)
      : await supabase.from("games").insert({ ...row, sort_order: (games.data?.length ?? 0) });
    setSaving(false);
    if (error) return toast.error(error.message.includes("duplicate") ? "That slug is already used" : "Couldn't save the game");
    toast.success(editing ? "Game updated" : "Game added");
    setForm(EMPTY); setEditing(null); refresh();
  };

  const update = async (id: string, patch: Partial<GameRow>) => {
    const { error } = await supabase.from("games").update(patch).eq("id", id);
    if (error) toast.error("Update failed"); else refresh();
  };
  const remove = async (g: GameRow) => {
    if (!confirm(`Remove "${g.title}" from the library?`)) return;
    const { error } = await supabase.from("games").delete().eq("id", g.id);
    if (error) toast.error("Delete failed"); else { toast.success("Game removed"); refresh(); }
  };
  const move = async (idx: number, dir: -1 | 1) => {
    const list = games.data ?? []; const a = list[idx], b = list[idx + dir];
    if (!a || !b) return;
    await Promise.all([
      supabase.from("games").update({ sort_order: idx + dir }).eq("id", a.id),
      supabase.from("games").update({ sort_order: idx }).eq("id", b.id),
    ]);
    refresh();
  };

  const field = (k: keyof Form, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block text-xs font-medium text-muted-foreground">{label}
      <input {...props} value={String(form[k] ?? "")}
        onChange={(e) => setForm({ ...form, [k]: k === "embed_url" ? extractSrc(e.target.value) : e.target.value })}
        className="mt-1 w-full rounded-xl border border-border/60 bg-background/50 px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60" />
    </label>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <Link to="/games" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Games</Link>
      <h1 className="mt-2 text-2xl font-semibold">Manage games</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-[22rem_1fr]">
        <form onSubmit={save} className="holo-panel space-y-3 rounded-2xl p-5">
          <div className="text-sm font-semibold">{editing ? "Edit game" : "Add game"}</div>
          {field("title", "Title", { maxLength: 80 })}
          {field("slug", "Page slug (e.g. space-racer)", { maxLength: 60 })}
          <label className="block text-xs font-medium text-muted-foreground">Description
            <textarea value={form.description} maxLength={400} onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="mt-1 h-20 w-full rounded-xl border border-border/60 bg-background/50 px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60" />
          </label>
          <label className="block text-xs font-medium text-muted-foreground">Category
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as Form["category"] })}
              className="mt-1 w-full rounded-xl border border-border/60 bg-background/50 px-3 py-2 text-sm text-foreground">
              {GAME_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          {field("embed_url", "Embed URL or official iframe code")}
          {field("official_url", "Official game page (optional)")}
          {field("thumbnail_url", "Thumbnail image URL (optional)")}
          {field("aspect_ratio", "Aspect ratio (width ÷ height)", { type: "number", step: "0.01" })}
          <div className="flex gap-2 pt-1">
            <button disabled={saving} className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{editing ? "Save" : "Add"}
            </button>
            {editing && <button type="button" onClick={() => { setEditing(null); setForm(EMPTY); }} className="rounded-full border border-border/60 px-4 py-2 text-sm">Cancel</button>}
          </div>
          <p className="text-[11px] text-muted-foreground">Only add games the provider allows you to embed. Approved hosts: {APPROVED_EMBED_HOSTS.join(", ")}.</p>
        </form>

        <div className="space-y-2">
          {(games.data ?? []).map((g, i) => (
            <div key={g.id} className="holo-panel flex items-center gap-3 rounded-2xl p-3">
              <div className="flex flex-col">
                <button onClick={() => move(i, -1)} aria-label="Move up" className="p-1 text-muted-foreground hover:text-foreground"><ArrowUp className="h-3.5 w-3.5" /></button>
                <button onClick={() => move(i, 1)} aria-label="Move down" className="p-1 text-muted-foreground hover:text-foreground"><ArrowDown className="h-3.5 w-3.5" /></button>
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{g.title} {!g.enabled && <span className="ml-1 text-xs text-muted-foreground">(hidden)</span>}</div>
                <div className="truncate text-xs text-muted-foreground">{g.category} · /games/play/{g.slug}</div>
              </div>
              <button onClick={() => update(g.id, { enabled: !g.enabled })} aria-label="Toggle visibility" className="rounded-lg p-2 hover:bg-accent/60">{g.enabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</button>
              <button onClick={() => { setEditing(g.id); setForm({ title: g.title, slug: g.slug, description: g.description, category: g.category as Form["category"], thumbnail_url: g.thumbnail_url ?? "", official_url: g.official_url ?? "", embed_url: g.embed_url, aspect_ratio: g.aspect_ratio }); }} aria-label="Edit" className="rounded-lg p-2 hover:bg-accent/60"><Pencil className="h-4 w-4" /></button>
              <button onClick={() => remove(g)} aria-label="Delete" className="rounded-lg p-2 hover:bg-destructive/15 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

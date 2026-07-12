import { createFileRoute, Outlet, Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Users, X, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/use-subscription";

export const Route = createFileRoute("/_authenticated/groups")({
  component: GroupsLayout,
});

interface GroupRow {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  owner_id: string;
  updated_at: string;
}

function GroupsLayout() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: sub } = useSubscription(user.id);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const { data: groups = [] } = useQuery({
    queryKey: ["my-groups", user.id],
    queryFn: async () => {
      const { data: memberships } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", user.id);
      const ids = (memberships ?? []).map((m) => m.group_id);
      if (!ids.length) return [] as GroupRow[];
      const { data } = await supabase
        .from("groups")
        .select("*")
        .in("id", ids)
        .order("updated_at", { ascending: false });
      return (data ?? []) as GroupRow[];
    },
  });

  const createGroup = async () => {
    if (!name.trim()) return;
    if (!sub?.isPro) {
      toast.error("Creating groups is a TRECK PRO feature");
      return;
    }
    const { data, error } = await supabase
      .from("groups")
      .insert({ name: name.trim(), description: description.trim() || null, owner_id: user.id })
      .select("id")
      .maybeSingle();
    if (error) return toast.error(error.message);
    toast.success("Group created");
    setName(""); setDescription(""); setCreating(false);
    qc.invalidateQueries({ queryKey: ["my-groups", user.id] });
    if (data?.id) window.location.href = `/groups/${data.id}`;
  };

  return (
    <div className="flex h-[calc(100vh-56px)] lg:h-screen">
      <aside className="w-full md:w-80 border-r border-border/60 flex flex-col bg-sidebar/40">
        <header className="px-4 py-4 border-b border-border/60 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-lg">Groups</h1>
            <p className="text-xs text-muted-foreground">Study together</p>
          </div>
          <button
            onClick={() => sub?.isPro ? setCreating(true) : toast.error("Creating groups requires TRECK PRO")}
            className="h-8 w-8 rounded-xl bg-primary text-primary-foreground grid place-items-center hover:opacity-90 transition shadow-[var(--shadow-glow)]"
            aria-label="Create group"
          >
            <Plus className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {!sub?.isPro && groups.length === 0 && (
            <div className="glass rounded-2xl p-4 text-sm">
              <div className="inline-flex items-center gap-1.5 text-amber-500 font-semibold text-xs mb-1">
                <Crown className="h-3.5 w-3.5" /> PRO feature
              </div>
              <p className="text-muted-foreground text-xs">
                Create groups with TRECK PRO. You can still join groups friends invite you to.
              </p>
              <Link to="/membership" className="mt-2 inline-flex text-xs text-primary hover:underline">
                Upgrade →
              </Link>
            </div>
          )}
          {groups.length === 0 && sub?.isPro && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No groups yet. Create your first one!
            </div>
          )}
          {groups.map((g) => {
            const active = pathname === `/groups/${g.id}`;
            return (
              <Link
                key={g.id}
                to="/groups/$groupId"
                params={{ groupId: g.id }}
                className={`flex items-center gap-3 rounded-xl p-2.5 transition ${
                  active
                    ? "bg-gradient-to-r from-primary/15 to-primary-glow/10 border border-primary/20"
                    : "hover:bg-sidebar-accent/50"
                }`}
              >
                <div className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-primary/40 to-primary-glow/40 grid place-items-center text-primary-foreground overflow-hidden">
                  {g.avatar_url ? <img src={g.avatar_url} alt="" className="h-full w-full object-cover" /> : <Users className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">{g.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{g.description || "No description"}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </aside>

      <main className="flex-1 min-w-0 hidden md:flex flex-col">
        <Outlet />
      </main>

      {creating && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setCreating(false)}>
          <div className="glass rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg">New group</h2>
              <button onClick={() => setCreating(false)} className="p-2 rounded-lg hover:bg-accent"><X className="h-4 w-4" /></button>
            </div>
            <label className="text-xs font-medium text-muted-foreground">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Study buddies"
              className="mt-1 w-full rounded-xl border border-border bg-background/40 px-3 py-2 text-sm outline-none focus:border-primary" autoFocus />
            <label className="text-xs font-medium text-muted-foreground mt-3 block">Description (optional)</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What's this group about?"
              className="mt-1 w-full rounded-xl border border-border bg-background/40 px-3 py-2 text-sm outline-none focus:border-primary resize-none" />
            <div className="mt-5 flex gap-2 justify-end">
              <button onClick={() => setCreating(false)} className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
              <button onClick={createGroup} disabled={!name.trim()} className="rounded-xl bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 shadow-[var(--shadow-glow)]">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function GroupsEmpty() {
  return (
    <div className="flex-1 grid place-items-center text-center px-6">
      <div>
        <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-primary-glow grid place-items-center text-primary-foreground shadow-[var(--shadow-glow)]">
          <Users className="h-6 w-6" />
        </div>
        <h2 className="mt-4 font-semibold">Your groups</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Select a group from the sidebar, or create a new one to start chatting with your study buddies.
        </p>
      </div>
    </div>
  );
}

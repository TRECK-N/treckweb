import { createFileRoute, Outlet, Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Users, X, Crown, Compass, Mail, Search, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/use-subscription";
import { ChatTabs } from "@/components/chat-tabs";

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
  is_public?: boolean;
  join_policy?: string;
}

function GroupsLayout() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: sub } = useSubscription(user.id);
  const [creating, setCreating] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [showInvites, setShowInvites] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [joinPolicy, setJoinPolicy] = useState<"open" | "request" | "invite">("open");

  const { data: groups = [] } = useQuery({
    queryKey: ["my-groups", user.id],
    queryFn: async () => {
      const { data: memberships } = await supabase
        .from("group_members").select("group_id").eq("user_id", user.id);
      const ids = (memberships ?? []).map((m) => m.group_id);
      if (!ids.length) return [] as GroupRow[];
      const { data } = await supabase.from("groups").select("*").in("id", ids).order("updated_at", { ascending: false });
      return (data ?? []) as GroupRow[];
    },
  });

  const { data: invites = [] } = useQuery({
    queryKey: ["group-invitations", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("group_invitations")
        .select("id,group_id,invited_by,status,groups(name,description,avatar_url)")
        .eq("invited_user_id", user.id).eq("status", "pending");
      return (data ?? []) as Array<{ id: string; group_id: string; status: string; groups: { name: string; description: string | null; avatar_url: string | null } | null }>;
    },
  });

  const createGroup = async () => {
    if (!name.trim()) return;
    if (!sub?.isPro) { toast.error("Creating groups is a TRECK PRO feature"); return; }
    const { data, error } = await supabase.from("groups").insert({
      name: name.trim(), description: description.trim() || null, owner_id: user.id,
      is_public: isPublic, join_policy: joinPolicy,
    }).select("id").maybeSingle();
    if (error) return toast.error(error.message);
    toast.success("Group created");
    setName(""); setDescription(""); setCreating(false);
    qc.invalidateQueries({ queryKey: ["my-groups", user.id] });
    if (data?.id) window.location.href = `/groups/${data.id}`;
  };

  const acceptInvite = async (inviteId: string, groupId: string) => {
    const { error: mErr } = await supabase.from("group_members").insert({
      group_id: groupId, user_id: user.id, role: "member",
    });
    if (mErr) return toast.error(mErr.message);
    await supabase.from("group_invitations").update({ status: "accepted" }).eq("id", inviteId);
    toast.success("Joined group");
    qc.invalidateQueries({ queryKey: ["my-groups", user.id] });
    qc.invalidateQueries({ queryKey: ["group-invitations", user.id] });
  };

  const declineInvite = async (inviteId: string) => {
    await supabase.from("group_invitations").update({ status: "declined" }).eq("id", inviteId);
    qc.invalidateQueries({ queryKey: ["group-invitations", user.id] });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] lg:h-screen">
      <ChatTabs />
      <div className="flex flex-1 min-h-0">
        <aside className="w-full md:w-80 border-r border-border/60 flex flex-col bg-sidebar/40">
          <header className="px-4 py-4 border-b border-border/60 flex items-center justify-between gap-2">
            <div>
              <h1 className="font-bold text-lg">Groups</h1>
              <p className="text-xs text-muted-foreground">Study together</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowInvites(true)}
                className="relative h-8 w-8 rounded-xl bg-accent grid place-items-center hover:opacity-90 transition"
                aria-label="Invitations"
              >
                <Mail className="h-4 w-4" />
                {invites.length > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold grid place-items-center">
                    {invites.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setDiscovering(true)}
                className="h-8 w-8 rounded-xl bg-accent grid place-items-center hover:opacity-90 transition"
                aria-label="Discover"
              >
                <Compass className="h-4 w-4" />
              </button>
              <button
                onClick={() => sub?.isPro ? setCreating(true) : toast.error("Creating groups requires TRECK PRO")}
                className="h-8 w-8 rounded-xl bg-primary text-primary-foreground grid place-items-center hover:opacity-90 transition shadow-[var(--shadow-glow)]"
                aria-label="Create group"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {!sub?.isPro && groups.length === 0 && (
              <div className="glass rounded-2xl p-4 text-sm">
                <div className="inline-flex items-center gap-1.5 text-amber-500 font-semibold text-xs mb-1">
                  <Crown className="h-3.5 w-3.5" /> PRO to create
                </div>
                <p className="text-muted-foreground text-xs">
                  Standard users can still join and chat in groups — tap Discover to find public ones.
                </p>
                <Link to="/membership" className="mt-2 inline-flex text-xs text-primary hover:underline">
                  Upgrade →
                </Link>
              </div>
            )}
            {groups.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No groups yet. Discover or create one!
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
      </div>

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

            <div className="mt-4 space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Visibility</label>
              <div className="flex gap-2">
                <button onClick={() => setIsPublic(true)} className={`flex-1 rounded-xl border px-3 py-2 text-sm ${isPublic ? "border-primary bg-primary/10" : "border-border"}`}>Public</button>
                <button onClick={() => setIsPublic(false)} className={`flex-1 rounded-xl border px-3 py-2 text-sm ${!isPublic ? "border-primary bg-primary/10" : "border-border"}`}>Private</button>
              </div>
              <label className="text-xs font-medium text-muted-foreground mt-2 block">Join policy</label>
              <select value={joinPolicy} onChange={(e) => setJoinPolicy(e.target.value as "open" | "request" | "invite")}
                className="w-full rounded-xl border border-border bg-background/40 px-3 py-2 text-sm outline-none focus:border-primary">
                <option value="open">Open — anyone can join</option>
                <option value="request">Request — admins approve</option>
                <option value="invite">Invite only</option>
              </select>
            </div>

            <div className="mt-5 flex gap-2 justify-end">
              <button onClick={() => setCreating(false)} className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
              <button onClick={createGroup} disabled={!name.trim()} className="rounded-xl bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 shadow-[var(--shadow-glow)]">Create</button>
            </div>
          </div>
        </div>
      )}

      {discovering && <DiscoverModal userId={user.id} onClose={() => setDiscovering(false)} />}

      {showInvites && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setShowInvites(false)}>
          <div className="glass rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg">Invitations · {invites.length}</h2>
              <button onClick={() => setShowInvites(false)} className="p-2 rounded-lg hover:bg-accent"><X className="h-4 w-4" /></button>
            </div>
            {invites.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No pending invitations.</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {invites.map((i) => (
                  <div key={i.id} className="rounded-2xl border border-border/60 p-3 flex items-center gap-3">
                    <div className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-primary/40 to-primary-glow/40 grid place-items-center text-primary-foreground overflow-hidden">
                      {i.groups?.avatar_url ? <img src={i.groups.avatar_url} alt="" className="h-full w-full object-cover" /> : <Users className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate">{i.groups?.name || "Group"}</div>
                      <div className="text-xs text-muted-foreground truncate">{i.groups?.description || "You've been invited"}</div>
                    </div>
                    <button onClick={() => acceptInvite(i.id, i.group_id)} className="inline-flex items-center gap-1 rounded-xl bg-primary text-primary-foreground px-2.5 py-1.5 text-xs font-medium hover:opacity-90">
                      <Check className="h-3 w-3" /> Join
                    </button>
                    <button onClick={() => declineInvite(i.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 hover:text-destructive">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DiscoverModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const { data: groups = [] } = useQuery({
    queryKey: ["discover-groups", q],
    queryFn: async () => {
      let query = supabase.from("groups").select("*").eq("is_public", true).order("updated_at", { ascending: false }).limit(30);
      if (q.trim()) query = query.ilike("name", `%${q.trim()}%`);
      const { data } = await query;
      return (data ?? []) as GroupRow[];
    },
  });

  const { data: myMembership = [] } = useQuery({
    queryKey: ["my-membership-ids", userId],
    queryFn: async () => {
      const { data } = await supabase.from("group_members").select("group_id").eq("user_id", userId);
      return (data ?? []).map((m) => m.group_id);
    },
  });

  const { data: myRequests = [] } = useQuery({
    queryKey: ["my-join-requests", userId],
    queryFn: async () => {
      const { data } = await supabase.from("group_join_requests").select("group_id,status").eq("user_id", userId);
      return data ?? [];
    },
  });

  const join = async (g: GroupRow) => {
    if (g.join_policy === "open") {
      const { error } = await supabase.from("group_members").insert({ group_id: g.id, user_id: userId, role: "member" });
      if (error) return toast.error(error.message);
      toast.success(`Joined ${g.name}`);
      qc.invalidateQueries({ queryKey: ["my-groups", userId] });
      qc.invalidateQueries({ queryKey: ["my-membership-ids", userId] });
      onClose();
    } else if (g.join_policy === "request") {
      const { error } = await supabase.from("group_join_requests").insert({ group_id: g.id, user_id: userId });
      if (error) return toast.error(error.message.includes("duplicate") ? "Already requested" : error.message);
      toast.success("Join request sent");
      qc.invalidateQueries({ queryKey: ["my-join-requests", userId] });
    } else {
      toast.error("This group is invite-only");
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="glass rounded-2xl p-6 w-full max-w-lg max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg">Discover groups</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>
        <div className="glass rounded-2xl flex items-center gap-2 px-3 py-2 mb-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search public groups"
            className="flex-1 bg-transparent outline-none text-sm" autoFocus />
        </div>
        <div className="flex-1 overflow-y-auto space-y-2">
          {groups.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No groups found.</p>
          )}
          {groups.map((g) => {
            const joined = myMembership.includes(g.id);
            const requested = myRequests.find((r) => r.group_id === g.id && r.status === "pending");
            return (
              <div key={g.id} className="rounded-2xl border border-border/60 p-3 flex items-center gap-3">
                <div className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-primary/40 to-primary-glow/40 grid place-items-center text-primary-foreground overflow-hidden">
                  {g.avatar_url ? <img src={g.avatar_url} alt="" className="h-full w-full object-cover" /> : <Users className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">{g.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{g.description || `${g.join_policy || "open"} · public`}</div>
                </div>
                {joined ? (
                  <span className="text-xs text-success inline-flex items-center gap-1"><Check className="h-3 w-3" /> Joined</span>
                ) : requested ? (
                  <span className="text-xs text-muted-foreground">Requested</span>
                ) : (
                  <button onClick={() => join(g)} className="rounded-xl bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:opacity-90">
                    {g.join_policy === "open" ? "Join" : g.join_policy === "request" ? "Request" : "Invite only"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
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
          Pick a group from the sidebar, discover public groups, or create your own.
        </p>
      </div>
    </div>
  );
}

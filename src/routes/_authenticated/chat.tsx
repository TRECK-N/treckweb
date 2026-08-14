import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Search, UserPlus, Check, X, MessageCircle, UserMinus, Users, Compass,
  Inbox, Plus, Loader2, Globe, Lock, Crown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useFriendships, useProfiles, type ProfileLite } from "@/hooks/use-social";
import { SocialAvatar } from "@/components/social-avatar";
import { useSubscription } from "@/hooks/use-subscription";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [
      { title: "Chat — WebuWeb" },
      { name: "description", content: "Discover people and groups, manage requests, message friends and chat in your groups on WebuWeb." },
      { property: "og:title", content: "Chat — WebuWeb" },
      { property: "og:description", content: "Discover people and groups, manage requests, message friends and chat in your groups on WebuWeb." },
    ],
  }),
  component: ChatHub,
});

const MAX_GROUP_MEMBERS = 50;

type TabId = "discover" | "requests" | "friends" | "groups";
const TABS: { id: TabId; label: string; icon: typeof Compass }[] = [
  { id: "discover", label: "Discover", icon: Compass },
  { id: "requests", label: "Requests", icon: Inbox },
  { id: "friends", label: "Friends", icon: MessageCircle },
  { id: "groups", label: "Groups", icon: Users },
];

interface GroupRow {
  id: string; name: string; description: string | null; avatar_url: string | null;
  owner_id: string; is_public: boolean; join_policy: string;
}

function ChatHub() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabId>("friends");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const { data: sub } = useSubscription(user.id);

  const { data: friendships = [] } = useFriendships(user.id);
  const accepted = friendships.filter((f) => f.status === "accepted");
  const incoming = friendships.filter((f) => f.status === "pending" && f.addressee_id === user.id);
  const outgoing = friendships.filter((f) => f.status === "pending" && f.requester_id === user.id);

  const relatedIds = useMemo(
    () => Array.from(new Set(friendships.map((f) => (f.requester_id === user.id ? f.addressee_id : f.requester_id)))),
    [friendships, user.id],
  );
  const { data: profileMap = new Map() } = useProfiles(relatedIds);

  const invalidateFriends = () => qc.invalidateQueries({ queryKey: ["friendships", user.id] });
  const invalidateGroups = () => {
    qc.invalidateQueries({ queryKey: ["my-groups", user.id] });
    qc.invalidateQueries({ queryKey: ["group-requests", user.id] });
    qc.invalidateQueries({ queryKey: ["discover-groups", user.id] });
  };

  /* ---------- groups ---------- */
  const { data: myGroups = [] } = useQuery({
    queryKey: ["my-groups", user.id],
    queryFn: async () => {
      const { data: memberships } = await supabase.from("group_members")
        .select("group_id, role").eq("user_id", user.id);
      const ids = (memberships ?? []).map((m) => m.group_id);
      if (!ids.length) return [] as Array<GroupRow & { role: string; member_count: number }>;
      const [{ data: groups }, { data: allMembers }] = await Promise.all([
        supabase.from("groups").select("*").in("id", ids),
        supabase.from("group_members").select("group_id").in("group_id", ids),
      ]);
      const counts = new Map<string, number>();
      (allMembers ?? []).forEach((m) => counts.set(m.group_id, (counts.get(m.group_id) ?? 0) + 1));
      const roleFor = new Map((memberships ?? []).map((m) => [m.group_id, m.role]));
      return (groups ?? []).map((g) => ({
        ...(g as GroupRow),
        role: roleFor.get(g.id) ?? "member",
        member_count: counts.get(g.id) ?? 1,
      }));
    },
  });

  const { data: pendingJoins = [] } = useQuery({
    queryKey: ["my-join-requests", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("group_join_requests")
        .select("group_id, status").eq("user_id", user.id).eq("status", "pending");
      return (data ?? []).map((r) => r.group_id);
    },
  });

  const { data: adminRequests = [] } = useQuery({
    queryKey: ["group-requests", user.id],
    queryFn: async () => {
      const adminGroupIds = myGroups.filter((g) => g.role === "owner" || g.role === "admin").map((g) => g.id);
      if (!adminGroupIds.length) return [];
      const { data } = await supabase.from("group_join_requests")
        .select("id, group_id, user_id, created_at").in("group_id", adminGroupIds).eq("status", "pending");
      return data ?? [];
    },
    enabled: myGroups.length > 0,
  });

  const { data: myInvites = [] } = useQuery({
    queryKey: ["group-invites", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("group_invitations")
        .select("id, group_id, invited_by, created_at").eq("invited_user_id", user.id).eq("status", "pending");
      return data ?? [];
    },
  });

  /* ---------- discover ---------- */
  const q = search.trim();
  const { data: foundUsers = [], isFetching: findingUsers } = useQuery({
    queryKey: ["discover-users", q, user.id],
    enabled: tab === "discover" && q.length >= 2,
    queryFn: async () => {
      const { data } = await supabase.from("profiles")
        .select("id, display_name, username, avatar_url")
        .or(`display_name.ilike.%${q}%,username.ilike.%${q}%`)
        .neq("id", user.id).limit(20);
      return (data ?? []) as ProfileLite[];
    },
  });

  const { data: publicGroups = [] } = useQuery({
    queryKey: ["discover-groups", user.id, q],
    enabled: tab === "discover",
    queryFn: async () => {
      let builder = supabase.from("groups").select("*").eq("is_public", true).limit(20);
      if (q.length >= 2) builder = builder.or(`name.ilike.%${q}%,description.ilike.%${q}%`);
      const { data } = await builder;
      return (data ?? []) as GroupRow[];
    },
  });

  const requestExtraIds = useMemo(() => {
    const s = new Set<string>();
    adminRequests.forEach((r) => s.add(r.user_id));
    return Array.from(s);
  }, [adminRequests]);
  const { data: requesterMap = new Map() } = useProfiles(requestExtraIds);

  const groupNameById = useMemo(() => {
    const m = new Map<string, string>();
    myGroups.forEach((g) => m.set(g.id, g.name));
    publicGroups.forEach((g) => m.set(g.id, g.name));
    return m;
  }, [myGroups, publicGroups]);

  /* ---------- actions ---------- */
  const sendFriendRequest = async (addresseeId: string) => {
    const { error } = await supabase.from("friendships")
      .insert({ requester_id: user.id, addressee_id: addresseeId, status: "pending" });
    if (error) return toast.error(error.message.includes("duplicate") ? "Request already exists" : error.message);
    toast.success("Friend request sent");
    invalidateFriends();
  };
  const acceptFriend = async (id: string) => {
    const { error } = await supabase.from("friendships").update({ status: "accepted" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("You're now friends");
    invalidateFriends();
  };
  const removeFriend = async (id: string) => {
    const { error } = await supabase.from("friendships").delete().eq("id", id);
    if (error) return toast.error(error.message);
    invalidateFriends();
  };

  const joinGroup = async (g: GroupRow) => {
    const { count } = await supabase.from("group_members")
      .select("id", { count: "exact", head: true }).eq("group_id", g.id);
    if ((count ?? 0) >= MAX_GROUP_MEMBERS) return toast.error("This group is full (50 members).");

    if (g.join_policy === "request") {
      const { error } = await supabase.from("group_join_requests")
        .insert({ group_id: g.id, user_id: user.id, status: "pending" });
      if (error) return toast.error(error.message);
      toast.success("Join request sent");
    } else {
      const { error } = await supabase.from("group_members")
        .insert({ group_id: g.id, user_id: user.id, role: "member" });
      if (error) return toast.error(error.message);
      toast.success(`Joined ${g.name}`);
    }
    invalidateGroups();
    qc.invalidateQueries({ queryKey: ["my-join-requests", user.id] });
  };

  const decideJoinRequest = async (id: string, groupId: string, userId: string, approve: boolean) => {
    if (approve) {
      const { error } = await supabase.from("group_members").insert({ group_id: groupId, user_id: userId, role: "member" });
      if (error) return toast.error(error.message);
    }
    await supabase.from("group_join_requests").update({ status: approve ? "accepted" : "declined" }).eq("id", id);
    toast.success(approve ? "Member added" : "Request declined");
    invalidateGroups();
  };

  const decideInvite = async (id: string, groupId: string, accept: boolean) => {
    if (accept) {
      const { error } = await supabase.from("group_members").insert({ group_id: groupId, user_id: user.id, role: "member" });
      if (error) return toast.error(error.message);
    }
    await supabase.from("group_invitations").update({ status: accept ? "accepted" : "declined" }).eq("id", id);
    invalidateGroups();
    qc.invalidateQueries({ queryKey: ["group-invites", user.id] });
  };

  const requestCount = incoming.length + myInvites.length + adminRequests.length;

  return (
    <div className="relative min-h-full">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 right-0 h-96 w-96 rounded-full bg-primary/10 blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-5xl p-6 lg:p-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Chat</h1>
            <p className="text-sm text-muted-foreground">Find people, manage requests, message friends and join groups.</p>
          </div>
          {tab === "groups" && (
            <button
              onClick={() => (sub?.isPro ? setCreating(true) : toast.error("Creating groups is a PRO feature."))}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              {sub?.isPro ? <Plus className="h-4 w-4" /> : <Crown className="h-4 w-4" />} New group
            </button>
          )}
        </div>

        {/* tabs */}
        <div className="glass mt-6 inline-flex gap-1 rounded-2xl border border-border/60 p-1.5">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id} onClick={() => setTab(t.id)}
                className={`relative inline-flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-sm font-medium transition ${
                  active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {active && (
                  <motion.div layoutId="chat-hub-pill" transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    className="absolute inset-0 rounded-xl bg-primary" />
                )}
                <t.icon className="relative h-3.5 w-3.5" />
                <span className="relative">{t.label}</span>
                {t.id === "requests" && requestCount > 0 && (
                  <span className="relative ml-0.5 rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                    {requestCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {(tab === "discover") && (
          <div className="glass mt-5 flex items-center gap-3 rounded-2xl border border-border/60 px-4 py-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search people and public groups…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
            />
            {findingUsers && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        )}

        <div className="mt-6 space-y-3">
          {/* DISCOVER */}
          {tab === "discover" && (
            <>
              {q.length >= 2 && (
                <Panel title="People">
                  {foundUsers.length === 0 && <Empty text="No people found." />}
                  {foundUsers.map((p) => {
                    const rel = friendships.find((f) => f.requester_id === p.id || f.addressee_id === p.id);
                    return (
                      <Row key={p.id} leading={<SocialAvatar profile={p} size={40} />}
                        title={p.display_name || "User"} subtitle={p.username ? `@${p.username}` : "Member"}>
                        {rel?.status === "accepted" ? (
                          <Link to="/messages/$userId" params={{ userId: p.id }} className="btn-soft"><MessageCircle className="h-3.5 w-3.5" /> Message</Link>
                        ) : rel ? (
                          <span className="text-xs text-muted-foreground">Pending</span>
                        ) : (
                          <button onClick={() => sendFriendRequest(p.id)} className="btn-primary-sm"><UserPlus className="h-3.5 w-3.5" /> Add</button>
                        )}
                      </Row>
                    );
                  })}
                </Panel>
              )}
              <Panel title="Public groups">
                {publicGroups.length === 0 && <Empty text="No public groups yet." />}
                {publicGroups.map((g) => {
                  const joined = myGroups.some((m) => m.id === g.id);
                  const pending = pendingJoins.includes(g.id);
                  return (
                    <Row key={g.id} leading={<GroupAvatar name={g.name} url={g.avatar_url} />}
                      title={g.name} subtitle={g.description || (g.join_policy === "request" ? "Approval required" : "Open to join")}>
                      {joined ? (
                        <Link to="/groups/$groupId" params={{ groupId: g.id }} className="btn-soft"><MessageCircle className="h-3.5 w-3.5" /> Open</Link>
                      ) : pending ? (
                        <span className="text-xs text-muted-foreground">Requested</span>
                      ) : (
                        <button onClick={() => joinGroup(g)} className="btn-primary-sm"><Plus className="h-3.5 w-3.5" /> Join</button>
                      )}
                    </Row>
                  );
                })}
              </Panel>
            </>
          )}

          {/* REQUESTS */}
          {tab === "requests" && (
            <>
              <Panel title={`Friend requests (${incoming.length})`}>
                {incoming.length === 0 && <Empty text="No incoming friend requests." />}
                {incoming.map((f) => {
                  const p = profileMap.get(f.requester_id);
                  return (
                    <Row key={f.id} leading={<SocialAvatar profile={p} size={40} />}
                      title={p?.display_name || "User"} subtitle={p?.username ? `@${p.username}` : "Wants to be friends"}>
                      <button onClick={() => acceptFriend(f.id)} className="btn-primary-sm"><Check className="h-3.5 w-3.5" /> Accept</button>
                      <button onClick={() => removeFriend(f.id)} className="btn-soft"><X className="h-3.5 w-3.5" /> Decline</button>
                    </Row>
                  );
                })}
              </Panel>

              <Panel title={`Group invitations (${myInvites.length})`}>
                {myInvites.length === 0 && <Empty text="No group invitations." />}
                {myInvites.map((i) => (
                  <Row key={i.id} leading={<GroupAvatar name={groupNameById.get(i.group_id) || "G"} url={null} />}
                    title={groupNameById.get(i.group_id) || "Group invitation"} subtitle="You were invited to join">
                    <button onClick={() => decideInvite(i.id, i.group_id, true)} className="btn-primary-sm"><Check className="h-3.5 w-3.5" /> Join</button>
                    <button onClick={() => decideInvite(i.id, i.group_id, false)} className="btn-soft"><X className="h-3.5 w-3.5" /> Ignore</button>
                  </Row>
                ))}
              </Panel>

              <Panel title={`Join requests to your groups (${adminRequests.length})`}>
                {adminRequests.length === 0 && <Empty text="No pending join requests." />}
                {adminRequests.map((r) => {
                  const p = requesterMap.get(r.user_id);
                  return (
                    <Row key={r.id} leading={<SocialAvatar profile={p} size={40} />}
                      title={p?.display_name || "User"} subtitle={`Wants to join ${groupNameById.get(r.group_id) || "your group"}`}>
                      <button onClick={() => decideJoinRequest(r.id, r.group_id, r.user_id, true)} className="btn-primary-sm"><Check className="h-3.5 w-3.5" /> Approve</button>
                      <button onClick={() => decideJoinRequest(r.id, r.group_id, r.user_id, false)} className="btn-soft"><X className="h-3.5 w-3.5" /> Decline</button>
                    </Row>
                  );
                })}
              </Panel>

              {outgoing.length > 0 && (
                <Panel title={`Sent requests (${outgoing.length})`}>
                  {outgoing.map((f) => {
                    const p = profileMap.get(f.addressee_id);
                    return (
                      <Row key={f.id} leading={<SocialAvatar profile={p} size={40} />}
                        title={p?.display_name || "User"} subtitle="Waiting for a reply">
                        <button onClick={() => removeFriend(f.id)} className="btn-soft"><X className="h-3.5 w-3.5" /> Cancel</button>
                      </Row>
                    );
                  })}
                </Panel>
              )}
            </>
          )}

          {/* FRIENDS */}
          {tab === "friends" && (
            <Panel title={`Friends (${accepted.length})`}>
              {accepted.length === 0 && (
                <Empty text="No friends yet — head to Discover to find people." />
              )}
              {accepted.map((f) => {
                const otherId = f.requester_id === user.id ? f.addressee_id : f.requester_id;
                const p = profileMap.get(otherId);
                return (
                  <Row key={f.id} leading={<SocialAvatar profile={p} size={40} />}
                    title={p?.display_name || "User"} subtitle={p?.username ? `@${p.username}` : "Friend"}>
                    <Link to="/messages/$userId" params={{ userId: otherId }} className="btn-primary-sm">
                      <MessageCircle className="h-3.5 w-3.5" /> Message
                    </Link>
                    <button onClick={() => removeFriend(f.id)} className="btn-soft"><UserMinus className="h-3.5 w-3.5" /> Remove</button>
                  </Row>
                );
              })}
            </Panel>
          )}

          {/* GROUPS */}
          {tab === "groups" && (
            <Panel title={`Your groups (${myGroups.length})`}>
              {myGroups.length === 0 && (
                <Empty text={sub?.isPro ? "No groups yet — create one or join from Discover." : "You're not in any group yet. Join one from Discover."} />
              )}
              {myGroups.map((g) => (
                <Row key={g.id} leading={<GroupAvatar name={g.name} url={g.avatar_url} />}
                  title={g.name}
                  subtitle={`${g.member_count}/${MAX_GROUP_MEMBERS} members · ${g.role}${g.is_public ? " · public" : " · private"}`}>
                  <Link to="/groups/$groupId" params={{ groupId: g.id }} className="btn-primary-sm">
                    <MessageCircle className="h-3.5 w-3.5" /> Open
                  </Link>
                </Row>
              ))}
            </Panel>
          )}
        </div>
      </div>

      <AnimatePresence>
        {creating && (
          <CreateGroupModal
            userId={user.id}
            onClose={() => setCreating(false)}
            onCreated={(id) => { setCreating(false); invalidateGroups(); navigate({ to: "/groups/$groupId", params: { groupId: id } }); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------------- pieces ---------------- */

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="glass rounded-2xl border border-border/50 p-2">
      <h2 className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      <div className="divide-y divide-border/50">{children}</div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="px-3 py-6 text-center text-sm text-muted-foreground">{text}</p>;
}

function Row({
  leading, title, subtitle, children,
}: { leading: React.ReactNode; title: string; subtitle: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-accent/40">
      {leading}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{title}</div>
        <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

export function GroupAvatar({ name, url, size = 40 }: { name: string; url: string | null; size?: number }) {
  if (url) return <img src={url} alt="" style={{ height: size, width: size }} className="shrink-0 rounded-xl object-cover" />;
  return (
    <span style={{ height: size, width: size }}
      className="grid shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary-glow text-sm font-bold text-primary-foreground">
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

function CreateGroupModal({
  userId, onClose, onCreated,
}: { userId: string; onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [approval, setApproval] = useState(false);
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (name.trim().length < 2) return toast.error("Give your group a name.");
    setSaving(true);
    const { data, error } = await supabase.from("groups").insert({
      name: name.trim(),
      description: description.trim() || null,
      owner_id: userId,
      is_public: isPublic,
      join_policy: approval ? "request" : "open",
    }).select("id").single();
    setSaving(false);
    if (error || !data) return toast.error(error?.message ?? "Could not create group");
    toast.success("Group created");
    onCreated(data.id);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-sm">
      <motion.div initial={{ scale: 0.96, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }}
        className="glass w-full max-w-md rounded-3xl border border-border/60 p-6">
        <h2 className="text-lg font-semibold">Create a group</h2>
        <p className="mt-1 text-xs text-muted-foreground">Up to {MAX_GROUP_MEMBERS} members per group.</p>

        <label className="mt-5 block text-xs font-medium text-muted-foreground">Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60}
          className="mt-1.5 w-full rounded-xl border border-border bg-background/40 px-3 py-2.5 text-sm outline-none focus:border-primary"
          placeholder="Biology study crew" />

        <label className="mt-4 block text-xs font-medium text-muted-foreground">Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={200}
          className="mt-1.5 w-full resize-none rounded-xl border border-border bg-background/40 px-3 py-2.5 text-sm outline-none focus:border-primary"
          placeholder="What is this group about?" />

        <div className="mt-4 space-y-2">
          <button onClick={() => setIsPublic(!isPublic)}
            className="flex w-full items-center gap-3 rounded-xl border border-border/60 px-3 py-2.5 text-left text-sm transition hover:bg-accent/50">
            {isPublic ? <Globe className="h-4 w-4 text-primary" /> : <Lock className="h-4 w-4 text-muted-foreground" />}
            <span className="flex-1">{isPublic ? "Public — discoverable by everyone" : "Private — invite only"}</span>
          </button>
          {isPublic && (
            <button onClick={() => setApproval(!approval)}
              className="flex w-full items-center gap-3 rounded-xl border border-border/60 px-3 py-2.5 text-left text-sm transition hover:bg-accent/50">
              <Check className={`h-4 w-4 ${approval ? "text-primary" : "text-muted-foreground/40"}`} />
              <span className="flex-1">Require approval to join</span>
            </button>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="btn-soft">Cancel</button>
          <button onClick={create} disabled={saving} className="btn-primary-sm disabled:opacity-50">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Create
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Search, UserPlus, Check, X, MessageCircle, UserMinus, Compass, Inbox, Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useFriendships, useProfiles, type ProfileLite } from "@/hooks/use-social";
import { SocialAvatar } from "@/components/social-avatar";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [
      { title: "Chat — WebuWeb" },
      { name: "description", content: "Discover people, manage friend requests and message your friends privately on WebuWeb." },
      { property: "og:title", content: "Chat — WebuWeb" },
      { property: "og:description", content: "Discover people, manage friend requests and message your friends privately on WebuWeb." },
    ],
  }),
  component: ChatHub,
});

type TabId = "friends" | "discover" | "requests";
const TABS: { id: TabId; label: string; icon: typeof Compass }[] = [
  { id: "friends", label: "Friends", icon: MessageCircle },
  { id: "discover", label: "Discover", icon: Compass },
  { id: "requests", label: "Requests", icon: Inbox },
];

function ChatHub() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabId>("friends");
  const [search, setSearch] = useState("");

  const { data: friendships = [] } = useFriendships(user.id);
  const accepted = friendships.filter((f) => f.status === "accepted");
  const incoming = friendships.filter((f) => f.status === "pending" && f.addressee_id === user.id);
  const outgoing = friendships.filter((f) => f.status === "pending" && f.requester_id === user.id);

  const relatedIds = useMemo(
    () => Array.from(new Set(friendships.map((f) => (f.requester_id === user.id ? f.addressee_id : f.requester_id)))),
    [friendships, user.id],
  );
  const { data: profileMap = new Map() } = useProfiles(relatedIds);

  const q = search.trim();
  const { data: foundUsers = [], isFetching: findingUsers } = useQuery({
    queryKey: ["chat-user-search", q, user.id],
    enabled: q.length >= 2,
    queryFn: async () => {
      const like = `%${q}%`;
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url")
        .or(`display_name.ilike.${like},username.ilike.${like}`)
        .neq("id", user.id)
        .limit(20);
      return (data ?? []) as ProfileLite[];
    },
  });

  const invalidateFriends = () => {
    qc.invalidateQueries({ queryKey: ["friendships", user.id] });
    qc.invalidateQueries({ queryKey: ["chat-user-search"] });
  };

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

  return (
    <div className="relative min-h-full">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 right-0 h-96 w-96 rounded-full bg-primary/10 blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-5xl p-6 lg:p-10">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Chat</h1>
          <p className="text-sm text-muted-foreground">Find people, manage requests and message your friends privately.</p>
        </div>

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
                {t.id === "requests" && incoming.length > 0 && (
                  <span className="relative ml-0.5 rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                    {incoming.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {tab === "discover" && (
          <div className="glass mt-5 flex items-center gap-3 rounded-2xl border border-border/60 px-4 py-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search people by name or username…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
            />
            {findingUsers && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        )}

        <div className="mt-6 space-y-3">
          {tab === "discover" && (
            <Panel title="People">
              {q.length < 2 && <Empty text="Type at least 2 characters to search for people." />}
              {q.length >= 2 && foundUsers.length === 0 && !findingUsers && <Empty text="No people found." />}
              {q.length >= 2 && foundUsers.map((p) => {
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

          {tab === "friends" && (
            <Panel title={`Friends (${accepted.length})`}>
              {accepted.length === 0 && <Empty text="No friends yet — head to Discover to find people." />}
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
        </div>
      </div>
    </div>
  );
}

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

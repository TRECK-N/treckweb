import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, UserPlus, Check, X, MessageCircle, UserMinus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useFriendships, useProfiles, type ProfileLite } from "@/hooks/use-social";
import { SocialAvatar } from "@/components/social-avatar";

export const Route = createFileRoute("/_authenticated/friends")({
  component: FriendsPage,
});

function FriendsPage() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"friends" | "requests" | "find">("friends");
  const [search, setSearch] = useState("");

  const { data: friendships = [] } = useFriendships(user.id);

  const accepted = friendships.filter((f) => f.status === "accepted");
  const incoming = friendships.filter((f) => f.status === "pending" && f.addressee_id === user.id);
  const outgoing = friendships.filter((f) => f.status === "pending" && f.requester_id === user.id);

  const relatedIds = useMemo(() => {
    const s = new Set<string>();
    friendships.forEach((f) => {
      s.add(f.requester_id === user.id ? f.addressee_id : f.requester_id);
    });
    return Array.from(s);
  }, [friendships, user.id]);

  const { data: profileMap = new Map() } = useProfiles(relatedIds);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["friendships", user.id] });

  const accept = async (id: string) => {
    const { error } = await supabase.from("friendships").update({ status: "accepted" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Friend request accepted");
    invalidate();
  };
  const remove = async (id: string) => {
    const { error } = await supabase.from("friendships").delete().eq("id", id);
    if (error) return toast.error(error.message);
    invalidate();
  };

  // Search users
  const { data: searchResults = [] } = useQuery({
    queryKey: ["user-search", search],
    enabled: tab === "find" && search.trim().length >= 2,
    queryFn: async () => {
      const q = search.trim();
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url")
        .or(`display_name.ilike.%${q}%,username.ilike.%${q}%`)
        .neq("id", user.id)
        .limit(20);
      return (data ?? []) as ProfileLite[];
    },
  });

  const sendRequest = async (addresseeId: string) => {
    const { error } = await supabase.from("friendships").insert({
      requester_id: user.id,
      addressee_id: addresseeId,
      status: "pending",
    });
    if (error) return toast.error(error.message.includes("duplicate") ? "Request already exists" : error.message);
    toast.success("Friend request sent");
    invalidate();
  };

  const relationWith = (otherId: string) =>
    friendships.find(
      (f) =>
        (f.requester_id === user.id && f.addressee_id === otherId) ||
        (f.addressee_id === user.id && f.requester_id === otherId),
    );

  return (
    <div className="mx-auto max-w-4xl px-4 lg:px-8 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Friends</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Connect with other students and start conversations.
        </p>
      </header>

      <div className="glass rounded-2xl p-1.5 inline-flex gap-1 mb-6">
        {(
          [
            { id: "friends", label: `Friends (${accepted.length})` },
            { id: "requests", label: `Requests (${incoming.length})` },
            { id: "find", label: "Find people" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative px-4 py-1.5 rounded-xl text-sm font-medium transition ${
              tab === t.id ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === t.id && (
              <motion.div
                layoutId="friends-tab"
                className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary to-primary-glow shadow-[var(--shadow-glow)]"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative">{t.label}</span>
          </button>
        ))}
      </div>

      {tab === "friends" && (
        <div className="space-y-2">
          {accepted.length === 0 && (
            <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
              No friends yet. Head to <button onClick={() => setTab("find")} className="text-primary hover:underline">Find people</button>.
            </div>
          )}
          {accepted.map((f) => {
            const otherId = f.requester_id === user.id ? f.addressee_id : f.requester_id;
            const p = profileMap.get(otherId);
            return (
              <div key={f.id} className="glass rounded-2xl p-3 flex items-center gap-3">
                <SocialAvatar profile={p} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{p?.display_name || "User"}</div>
                  <div className="text-xs text-muted-foreground truncate">@{p?.username}</div>
                </div>
                <Link
                  to="/messages/$userId"
                  params={{ userId: otherId }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:opacity-90 transition shadow-[var(--shadow-glow)]"
                >
                  <MessageCircle className="h-3.5 w-3.5" /> Message
                </Link>
                <button
                  onClick={() => remove(f.id)}
                  className="p-2 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition"
                  aria-label="Remove friend"
                >
                  <UserMinus className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {tab === "requests" && (
        <div className="space-y-6">
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground mb-2 px-1">
              Incoming ({incoming.length})
            </h2>
            <div className="space-y-2">
              {incoming.length === 0 && (
                <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">
                  No incoming requests
                </div>
              )}
              {incoming.map((f) => {
                const p = profileMap.get(f.requester_id);
                return (
                  <div key={f.id} className="glass rounded-2xl p-3 flex items-center gap-3">
                    <SocialAvatar profile={p} size={44} />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{p?.display_name || "User"}</div>
                      <div className="text-xs text-muted-foreground truncate">@{p?.username}</div>
                    </div>
                    <button
                      onClick={() => accept(f.id)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-success/20 text-success border border-success/40 px-3 py-1.5 text-xs font-medium hover:bg-success/30 transition"
                    >
                      <Check className="h-3.5 w-3.5" /> Accept
                    </button>
                    <button
                      onClick={() => remove(f.id)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-medium hover:bg-destructive/10 hover:text-destructive transition"
                    >
                      <X className="h-3.5 w-3.5" /> Reject
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground mb-2 px-1">
              Sent ({outgoing.length})
            </h2>
            <div className="space-y-2">
              {outgoing.length === 0 && (
                <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">
                  No pending sent requests
                </div>
              )}
              {outgoing.map((f) => {
                const p = profileMap.get(f.addressee_id);
                return (
                  <div key={f.id} className="glass rounded-2xl p-3 flex items-center gap-3">
                    <SocialAvatar profile={p} size={44} />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{p?.display_name || "User"}</div>
                      <div className="text-xs text-muted-foreground truncate">@{p?.username}</div>
                    </div>
                    <span className="text-xs text-muted-foreground">Pending…</span>
                    <button
                      onClick={() => remove(f.id)}
                      className="p-2 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition"
                      aria-label="Cancel"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {tab === "find" && (
        <div>
          <div className="glass rounded-2xl flex items-center gap-2 px-4 py-2.5 mb-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or @username"
              className="flex-1 bg-transparent outline-none text-sm"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            {search.trim().length < 2 && (
              <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
                Type at least 2 characters to search.
              </div>
            )}
            {search.trim().length >= 2 && searchResults.length === 0 && (
              <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
                No users found.
              </div>
            )}
            {searchResults.map((p) => {
              const rel = relationWith(p.id);
              return (
                <div key={p.id} className="glass rounded-2xl p-3 flex items-center gap-3">
                  <SocialAvatar profile={p} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{p.display_name || "User"}</div>
                    <div className="text-xs text-muted-foreground truncate">@{p.username}</div>
                  </div>
                  {!rel && (
                    <button
                      onClick={() => sendRequest(p.id)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:opacity-90 transition shadow-[var(--shadow-glow)]"
                    >
                      <UserPlus className="h-3.5 w-3.5" /> Add friend
                    </button>
                  )}
                  {rel?.status === "pending" && (
                    <span className="text-xs text-muted-foreground">
                      {rel.requester_id === user.id ? "Request sent" : "Awaiting your reply"}
                    </span>
                  )}
                  {rel?.status === "accepted" && (
                    <span className="inline-flex items-center gap-1 text-xs text-success">
                      <Check className="h-3.5 w-3.5" /> Friends
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

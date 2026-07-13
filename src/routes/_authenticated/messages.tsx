import { createFileRoute, Outlet, Link, useRouterState } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useFriendships, useProfiles } from "@/hooks/use-social";
import { SocialAvatar } from "@/components/social-avatar";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/messages")({
  component: MessagesLayout,
});

function MessagesLayout() {
  const { user } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: friendships = [] } = useFriendships(user.id);
  const accepted = friendships.filter((f) => f.status === "accepted");

  const friendIds = useMemo(
    () => accepted.map((f) => (f.requester_id === user.id ? f.addressee_id : f.requester_id)),
    [accepted, user.id],
  );
  const { data: profileMap = new Map() } = useProfiles(friendIds);

  // Fetch latest DM per friend for preview
  const { data: previews = {} } = useQuery({
    queryKey: ["dm-previews", user.id, friendIds.join(",")],
    enabled: friendIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("direct_messages")
        .select("sender_id, recipient_id, content, created_at")
        .or(
          friendIds
            .map((id) => `and(sender_id.eq.${user.id},recipient_id.eq.${id}),and(sender_id.eq.${id},recipient_id.eq.${user.id})`)
            .join(","),
        )
        .order("created_at", { ascending: false })
        .limit(200);
      const map: Record<string, { content: string; created_at: string }> = {};
      (data ?? []).forEach((m) => {
        const other = m.sender_id === user.id ? m.recipient_id : m.sender_id;
        if (!map[other]) map[other] = { content: m.content ?? "📎 Attachment", created_at: m.created_at };
      });
      return map;
    },
  });

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] lg:h-screen">
      <ChatTabs />
      <div className="flex flex-1 min-h-0">
      <aside className="w-full md:w-80 border-r border-border/60 flex flex-col bg-sidebar/40">
        <header className="px-4 py-4 border-b border-border/60">
          <h1 className="font-bold text-lg">Messages</h1>
          <p className="text-xs text-muted-foreground">Chat with your friends</p>
        </header>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {accepted.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Add friends first from{" "}
              <Link to="/friends" className="text-primary hover:underline">Friends</Link>.
            </div>
          )}
          {accepted.map((f) => {
            const otherId = f.requester_id === user.id ? f.addressee_id : f.requester_id;
            const p = profileMap.get(otherId);
            const prev = previews[otherId];
            const active = pathname === `/messages/${otherId}`;
            return (
              <Link
                key={f.id}
                to="/messages/$userId"
                params={{ userId: otherId }}
                className={`flex items-center gap-3 rounded-xl p-2.5 transition ${
                  active
                    ? "bg-gradient-to-r from-primary/15 to-primary-glow/10 border border-primary/20"
                    : "hover:bg-sidebar-accent/50"
                }`}
              >
                <SocialAvatar profile={p} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-sm truncate">{p?.display_name || "User"}</div>
                    {prev && (
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatDistanceToNow(new Date(prev.created_at), { addSuffix: false })}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {prev?.content || "Say hi 👋"}
                  </div>
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
  );
}

export function MessagesEmpty() {
  return (
    <div className="flex-1 grid place-items-center text-center px-6">
      <div>
        <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-primary-glow grid place-items-center text-primary-foreground shadow-[var(--shadow-glow)]">
          <MessageCircle className="h-6 w-6" />
        </div>
        <h2 className="mt-4 font-semibold">Your messages</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Select a friend from the sidebar to start a conversation.
        </p>
      </div>
    </div>
  );
}

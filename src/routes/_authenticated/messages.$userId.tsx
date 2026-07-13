import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Trash2, ArrowLeft, Check, CheckCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfiles } from "@/hooks/use-social";
import { SocialAvatar } from "@/components/social-avatar";
import { formatDistanceToNow } from "date-fns";
import { ChatComposer } from "@/components/chat-composer";
import { MessageAttachments } from "@/components/message-attachments";
import type { ChatAttachment } from "@/lib/chat-attachments";
import { useTypingIndicator } from "@/hooks/use-typing";

export const Route = createFileRoute("/_authenticated/messages/$userId")({
  component: DMConversation,
});

interface DM {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string | null;
  created_at: string;
  edited_at: string | null;
  read_at: string | null;
  attachments?: ChatAttachment[];
}

function DMConversation() {
  const { user } = Route.useRouteContext();
  const { userId: otherId } = Route.useParams();
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: profileMap = new Map() } = useProfiles([otherId, user.id]);
  const other = profileMap.get(otherId);
  const me = profileMap.get(user.id);

  const channelName = useMemo(() => `dm-typing-${[user.id, otherId].sort().join("-")}`, [user.id, otherId]);
  const { typing, broadcast } = useTypingIndicator(channelName, {
    userId: user.id,
    name: me?.display_name || me?.username || "Someone",
  });

  const queryKey = ["dm", user.id, otherId];
  const { data: messages = [] } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data } = await supabase
        .from("direct_messages")
        .select("*")
        .or(`and(sender_id.eq.${user.id},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${user.id})`)
        .order("created_at", { ascending: true })
        .limit(200);
      return (data ?? []) as unknown as DM[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`dm-${[user.id, otherId].sort().join("-")}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "direct_messages" }, (payload) => {
        const row = (payload.new ?? payload.old) as DM;
        const involves =
          (row.sender_id === user.id && row.recipient_id === otherId) ||
          (row.sender_id === otherId && row.recipient_id === user.id);
        if (!involves) return;
        if (payload.eventType === "INSERT") {
          qc.setQueryData<DM[]>(queryKey, (prev = []) => prev.some((m) => m.id === row.id) ? prev : [...prev, row]);
        } else if (payload.eventType === "UPDATE") {
          qc.setQueryData<DM[]>(queryKey, (prev = []) => prev.map((m) => (m.id === row.id ? { ...m, ...row } : m)));
        } else if (payload.eventType === "DELETE") {
          qc.setQueryData<DM[]>(queryKey, (prev = []) => prev.filter((m) => m.id !== row.id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, otherId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing.length]);

  // Mark inbound messages as read whenever we see them
  useEffect(() => {
    const unread = messages
      .filter((m) => m.recipient_id === user.id && m.sender_id === otherId && !m.read_at)
      .map((m) => m.id);
    if (unread.length === 0) return;
    (async () => {
      await supabase.from("direct_messages")
        .update({ read_at: new Date().toISOString() })
        .in("id", unread);
    })();
  }, [messages, user.id, otherId]);

  const send = async ({ content, attachments }: { content: string; attachments: ChatAttachment[] }) => {
    const { error } = await supabase.from("direct_messages").insert({
      sender_id: user.id, recipient_id: otherId,
      content: content || null,
      attachments: attachments as unknown as never,
    });
    if (error) toast.error(error.message);
  };

  const saveEdit = async (id: string) => {
    if (!editText.trim()) return;
    await supabase.from("direct_messages").update({ content: editText, edited_at: new Date().toISOString() }).eq("id", id);
    setEditingId(null);
  };

  const del = async (id: string) => {
    if (!confirm("Delete this message?")) return;
    await supabase.from("direct_messages").delete().eq("id", id);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full">
      <header className="border-b border-border/60 px-4 lg:px-6 py-3 flex items-center gap-3 glass">
        <Link to="/messages" className="md:hidden p-2 rounded-lg hover:bg-accent" aria-label="Back">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <SocialAvatar profile={other} size={38} />
        <div className="min-w-0">
          <div className="font-semibold text-sm truncate">{other?.display_name || "User"}</div>
          <div className="text-xs text-muted-foreground truncate">@{other?.username}</div>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 lg:px-6 py-6 space-y-3">
        {messages.map((m) => {
          const isOwn = m.sender_id === user.id;
          const p = isOwn ? null : other;
          const editing = editingId === m.id;
          const atts = (m.attachments || []) as ChatAttachment[];
          return (
            <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className={`group flex gap-3 ${isOwn ? "flex-row-reverse" : ""}`}>
              <SocialAvatar profile={p} size={36} />
              <div className={`max-w-[75%] ${isOwn ? "items-end" : "items-start"} flex flex-col`}>
                <div className={`flex items-center gap-2 text-[11px] text-muted-foreground mb-1 ${isOwn ? "flex-row-reverse" : ""}`}>
                  <span>{formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}</span>
                  {m.edited_at && <span className="italic">(edited)</span>}
                </div>
                {editing ? (
                  <div className="flex gap-2">
                    <input value={editText} onChange={(e) => setEditText(e.target.value)}
                      className="rounded-xl border border-border bg-background/40 px-3 py-2 text-sm outline-none focus:border-primary" autoFocus />
                    <button onClick={() => saveEdit(m.id)} className="text-xs text-primary hover:underline">Save</button>
                    <button onClick={() => setEditingId(null)} className="text-xs text-muted-foreground hover:underline">Cancel</button>
                  </div>
                ) : (
                  <>
                    {m.content && (
                      <div className={`rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap break-words ${
                        isOwn ? "bg-primary text-primary-foreground" : "glass"
                      }`}>{m.content}</div>
                    )}
                    <MessageAttachments items={atts} />
                  </>
                )}
                {isOwn && !editing && (
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                    {m.read_at ? (
                      <span className="inline-flex items-center gap-1 text-primary" title={`Read ${new Date(m.read_at).toLocaleString()}`}>
                        <CheckCheck className="h-3 w-3" /> Read
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1" title="Delivered">
                        <Check className="h-3 w-3" /> Delivered
                      </span>
                    )}
                    <span className="opacity-0 group-hover:opacity-100 transition inline-flex gap-2">
                      {m.content && <button onClick={() => { setEditingId(m.id); setEditText(m.content ?? ""); }} className="hover:text-foreground inline-flex items-center gap-1"><Pencil className="h-3 w-3" />Edit</button>}
                      <button onClick={() => del(m.id)} className="hover:text-destructive inline-flex items-center gap-1"><Trash2 className="h-3 w-3" />Delete</button>
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
        {messages.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-10">No messages yet — say hi!</div>
        )}

        <AnimatePresence>
          {typing.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex items-center gap-3">
              <SocialAvatar profile={other} size={36} />
              <div className="glass rounded-2xl px-4 py-2.5 text-sm text-muted-foreground italic flex items-center gap-1">
                <TypingDots /> {other?.display_name || "User"} is typing…
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ChatComposer userId={user.id} placeholder="Message…" onSend={send} onTyping={broadcast} />
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-0.5">
      {[0, 1, 2].map((i) => (
        <motion.span key={i}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15 }}
          className="h-1 w-1 rounded-full bg-primary" />
      ))}
    </span>
  );
}

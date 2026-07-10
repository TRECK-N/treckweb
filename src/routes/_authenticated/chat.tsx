import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Send, Smile, Pencil, Trash2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/chat")({
  component: GlobalChat,
});

const EMOJIS = ["😀", "😂", "😍", "🔥", "🎉", "👍", "❤️", "🚀", "💯", "🙌", "🤔", "😎"];

interface ChatMsg {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  edited_at: string | null;
  profiles?: { display_name: string | null; avatar_url: string | null } | null;
}

function GlobalChat() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const [input, setInput] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [onlineCount, setOnlineCount] = useState(1);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: messages = [] } = useQuery({
    queryKey: ["chat-messages"],
    queryFn: async () => {
      const { data: msgs } = await supabase.from("chat_messages")
        .select("*").order("created_at", { ascending: false }).limit(100);
      const rows = (msgs ?? []).reverse();
      const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
      const { data: profs } = userIds.length
        ? await supabase.from("profiles").select("id, display_name, avatar_url").in("id", userIds)
        : { data: [] as Array<{ id: string; display_name: string | null; avatar_url: string | null }> };
      const map = new Map((profs ?? []).map((p) => [p.id, p]));
      return rows.map((r) => ({
        ...r,
        profiles: map.get(r.user_id) ?? null,
      })) as ChatMsg[];
    },
  });

  // Realtime subscription + presence
  useEffect(() => {
    const channel = supabase.channel("global-chat", { config: { presence: { key: user.id } } })
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, async (payload) => {
        if (payload.eventType === "INSERT") {
          const { data: profile } = await supabase.from("profiles").select("display_name, avatar_url").eq("id", (payload.new as ChatMsg).user_id).maybeSingle();
          qc.setQueryData<ChatMsg[]>(["chat-messages"], (prev = []) => [...prev, { ...(payload.new as ChatMsg), profiles: profile }]);
        } else if (payload.eventType === "UPDATE") {
          qc.setQueryData<ChatMsg[]>(["chat-messages"], (prev = []) => prev.map((m) => m.id === (payload.new as ChatMsg).id ? { ...m, ...(payload.new as ChatMsg) } : m));
        } else if (payload.eventType === "DELETE") {
          qc.setQueryData<ChatMsg[]>(["chat-messages"], (prev = []) => prev.filter((m) => m.id !== (payload.old as ChatMsg).id));
        }
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setOnlineCount(Object.keys(state).length);
      })
      .on("broadcast", { event: "typing" }, (payload) => {
        const { userId, name } = payload.payload as { userId: string; name: string };
        if (userId === user.id) return;
        setTypingUsers((prev) => Array.from(new Set([...prev, name])));
        setTimeout(() => setTypingUsers((prev) => prev.filter((n) => n !== name)), 2500);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") await channel.track({ online_at: new Date().toISOString() });
      });

    return () => { supabase.removeChannel(channel); };
  }, [user.id, qc]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput("");
    const { error } = await supabase.from("chat_messages").insert({ user_id: user.id, content: text });
    if (error) toast.error(error.message);
  };

  const broadcastTyping = () => {
    if (typingTimeout.current) return;
    const channel = supabase.channel("global-chat");
    channel.send({
      type: "broadcast", event: "typing",
      payload: { userId: user.id, name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Someone" },
    });
    typingTimeout.current = setTimeout(() => { typingTimeout.current = null; }, 2000);
  };

  const saveEdit = async (id: string) => {
    if (!editText.trim()) return;
    await supabase.from("chat_messages").update({ content: editText, edited_at: new Date().toISOString() }).eq("id", id);
    setEditingId(null);
  };

  const del = async (id: string) => {
    if (!confirm("Delete this message?")) return;
    await supabase.from("chat_messages").delete().eq("id", id);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] lg:h-screen">
      <header className="border-b border-border/60 px-6 py-4 flex items-center justify-between glass">
        <div>
          <h1 className="font-bold text-lg">Global Chat</h1>
          <p className="text-xs text-muted-foreground">Talk to everyone on TreckWeb</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
          <Users className="h-3.5 w-3.5" /> {onlineCount} online
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 lg:px-6 py-6 space-y-3">
        {messages.map((m) => (
          <MessageRow key={m.id} m={m} isOwn={m.user_id === user.id}
            editing={editingId === m.id} editText={editText}
            setEditText={setEditText}
            onStartEdit={() => { setEditingId(m.id); setEditText(m.content); }}
            onCancelEdit={() => setEditingId(null)}
            onSaveEdit={() => saveEdit(m.id)}
            onDelete={() => del(m.id)}
          />
        ))}
        <AnimatePresence>
          {typingUsers.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="text-xs text-muted-foreground italic">
              {typingUsers.join(", ")} typing…
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="border-t border-border/60 p-4">
        <div className="max-w-3xl mx-auto relative">
          <AnimatePresence>
            {showEmoji && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                className="absolute bottom-14 left-0 glass rounded-2xl p-2 grid grid-cols-6 gap-1">
                {EMOJIS.map((e) => (
                  <button key={e} className="text-xl hover:bg-accent rounded-lg p-1" onClick={() => { setInput((p) => p + e); setShowEmoji(false); }}>{e}</button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
          <div className="glass rounded-2xl flex items-center gap-1 p-1.5">
            <button onClick={() => setShowEmoji((s) => !s)} className="p-2 rounded-lg hover:bg-accent text-muted-foreground" aria-label="Emoji">
              <Smile className="h-4 w-4" />
            </button>
            <input
              value={input}
              onChange={(e) => { setInput(e.target.value); broadcastTyping(); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); send(); } }}
              placeholder="Say something…"
              className="flex-1 bg-transparent px-2 py-2 text-sm outline-none"
              autoFocus
            />
            <button onClick={send} disabled={!input.trim()}
              className="h-9 w-9 rounded-xl bg-primary text-primary-foreground grid place-items-center hover:opacity-90 transition disabled:opacity-40 shadow-[var(--shadow-glow)]"
              aria-label="Send">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageRow({
  m, isOwn, editing, editText, setEditText, onStartEdit, onCancelEdit, onSaveEdit, onDelete,
}: {
  m: ChatMsg; isOwn: boolean; editing: boolean; editText: string;
  setEditText: (v: string) => void;
  onStartEdit: () => void; onCancelEdit: () => void; onSaveEdit: () => void; onDelete: () => void;
}) {
  const name = m.profiles?.display_name || "User";
  const initials = name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className={`group flex gap-3 ${isOwn ? "flex-row-reverse" : ""}`}>
      <div className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-primary to-primary-glow grid place-items-center text-primary-foreground text-xs font-bold overflow-hidden">
        {m.profiles?.avatar_url ? <img src={m.profiles.avatar_url} alt="" className="h-full w-full object-cover" /> : initials}
      </div>
      <div className={`max-w-[80%] ${isOwn ? "items-end" : "items-start"} flex flex-col`}>
        <div className={`flex items-center gap-2 text-xs text-muted-foreground mb-1 ${isOwn ? "flex-row-reverse" : ""}`}>
          <span className="font-medium text-foreground">{name}</span>
          <span>{formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}</span>
          {m.edited_at && <span className="italic">(edited)</span>}
        </div>
        {editing ? (
          <div className="flex gap-2">
            <input value={editText} onChange={(e) => setEditText(e.target.value)} className="rounded-xl border border-border bg-background/40 px-3 py-2 text-sm outline-none focus:border-primary" autoFocus />
            <button onClick={onSaveEdit} className="text-xs text-primary hover:underline">Save</button>
            <button onClick={onCancelEdit} className="text-xs text-muted-foreground hover:underline">Cancel</button>
          </div>
        ) : (
          <div className={`rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap break-words ${
            isOwn ? "bg-primary text-primary-foreground" : "glass"
          }`}>{m.content}</div>
        )}
        {isOwn && !editing && (
          <div className="mt-1 flex gap-2 opacity-0 group-hover:opacity-100 transition">
            <button onClick={onStartEdit} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"><Pencil className="h-3 w-3" />Edit</button>
            <button onClick={onDelete} className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1"><Trash2 className="h-3 w-3" />Delete</button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

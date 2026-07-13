import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Trash2, ArrowLeft, Users, UserPlus, LogOut, Crown, Shield, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfiles, useFriendships, initialsFor } from "@/hooks/use-social";
import { SocialAvatar } from "@/components/social-avatar";
import { formatDistanceToNow } from "date-fns";
import { ChatComposer } from "@/components/chat-composer";
import { MessageAttachments } from "@/components/message-attachments";
import type { ChatAttachment } from "@/lib/chat-attachments";

export const Route = createFileRoute("/_authenticated/groups/$groupId")({
  component: GroupConversation,
});

interface GroupMsg {
  id: string;
  group_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  edited_at: string | null;
}

interface Member {
  id: string;
  group_id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
}

function GroupConversation() {
  const { user } = Route.useRouteContext();
  const { groupId } = Route.useParams();
  const qc = useQueryClient();
  const [input, setInput] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [inviting, setInviting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: group } = useQuery({
    queryKey: ["group", groupId],
    queryFn: async () => {
      const { data } = await supabase.from("groups").select("*").eq("id", groupId).maybeSingle();
      return data;
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ["group-members", groupId],
    queryFn: async () => {
      const { data } = await supabase.from("group_members").select("*").eq("group_id", groupId);
      return (data ?? []) as Member[];
    },
  });

  const memberIds = members.map((m) => m.user_id);
  const { data: memberProfiles = new Map() } = useProfiles(memberIds);
  const myMembership = members.find((m) => m.user_id === user.id);
  const canAdmin = myMembership?.role === "owner" || myMembership?.role === "admin";

  const msgKey = ["group-messages", groupId];
  const { data: messages = [] } = useQuery({
    queryKey: msgKey,
    queryFn: async () => {
      const { data } = await supabase
        .from("group_messages").select("*").eq("group_id", groupId)
        .order("created_at", { ascending: true }).limit(200);
      return (data ?? []) as GroupMsg[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`group-${groupId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_messages", filter: `group_id=eq.${groupId}` }, (payload) => {
        const row = (payload.new ?? payload.old) as GroupMsg;
        if (payload.eventType === "INSERT") {
          qc.setQueryData<GroupMsg[]>(msgKey, (prev = []) => prev.some((m) => m.id === row.id) ? prev : [...prev, row]);
        } else if (payload.eventType === "UPDATE") {
          qc.setQueryData<GroupMsg[]>(msgKey, (prev = []) => prev.map((m) => m.id === row.id ? { ...m, ...row } : m));
        } else if (payload.eventType === "DELETE") {
          qc.setQueryData<GroupMsg[]>(msgKey, (prev = []) => prev.filter((m) => m.id !== row.id));
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "group_members", filter: `group_id=eq.${groupId}` }, () => {
        qc.invalidateQueries({ queryKey: ["group-members", groupId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput("");
    const { error } = await supabase.from("group_messages").insert({
      group_id: groupId, sender_id: user.id, content: text,
    });
    if (error) toast.error(error.message);
  };

  const saveEdit = async (id: string) => {
    if (!editText.trim()) return;
    await supabase.from("group_messages").update({ content: editText, edited_at: new Date().toISOString() }).eq("id", id);
    setEditingId(null);
  };

  const del = async (id: string) => {
    if (!confirm("Delete this message?")) return;
    await supabase.from("group_messages").delete().eq("id", id);
  };

  const leaveGroup = async () => {
    if (!confirm("Leave this group?")) return;
    if (myMembership?.role === "owner") {
      toast.error("Owners can't leave. Delete the group instead.");
      return;
    }
    await supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", user.id);
    qc.invalidateQueries({ queryKey: ["my-groups", user.id] });
    window.location.href = "/groups";
  };

  const deleteGroup = async () => {
    if (!confirm("Delete this group permanently?")) return;
    await supabase.from("groups").delete().eq("id", groupId);
    qc.invalidateQueries({ queryKey: ["my-groups", user.id] });
    window.location.href = "/groups";
  };

  const removeMember = async (userId: string) => {
    if (!confirm("Remove this member?")) return;
    await supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", userId);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full">
      <header className="border-b border-border/60 px-4 lg:px-6 py-3 flex items-center gap-3 glass">
        <Link to="/groups" className="md:hidden p-2 rounded-lg hover:bg-accent" aria-label="Back">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/40 to-primary-glow/40 grid place-items-center text-primary-foreground overflow-hidden">
          {group?.avatar_url ? <img src={group.avatar_url} alt="" className="h-full w-full object-cover" /> : <Users className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm truncate">{group?.name || "Group"}</div>
          <div className="text-xs text-muted-foreground truncate">{members.length} member{members.length === 1 ? "" : "s"}</div>
        </div>
        <button onClick={() => setShowMembers(true)} className="p-2 rounded-lg hover:bg-accent text-muted-foreground" aria-label="Members">
          <Users className="h-4 w-4" />
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 lg:px-6 py-6 space-y-3">
        {messages.map((m) => {
          const isOwn = m.sender_id === user.id;
          const p = memberProfiles.get(m.sender_id);
          const editing = editingId === m.id;
          const canDelete = isOwn || canAdmin;
          return (
            <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className={`group flex gap-3 ${isOwn ? "flex-row-reverse" : ""}`}>
              <SocialAvatar profile={p} size={36} />
              <div className={`max-w-[75%] ${isOwn ? "items-end" : "items-start"} flex flex-col`}>
                <div className={`flex items-center gap-2 text-[11px] text-muted-foreground mb-1 ${isOwn ? "flex-row-reverse" : ""}`}>
                  <span className="font-medium text-foreground">{p?.display_name || "User"}</span>
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
                  <div className={`rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap break-words ${
                    isOwn ? "bg-primary text-primary-foreground" : "glass"
                  }`}>{m.content}</div>
                )}
                {!editing && (isOwn || canDelete) && (
                  <div className="mt-1 flex gap-2 opacity-0 group-hover:opacity-100 transition">
                    {isOwn && (
                      <button onClick={() => { setEditingId(m.id); setEditText(m.content); }} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"><Pencil className="h-3 w-3" />Edit</button>
                    )}
                    {canDelete && (
                      <button onClick={() => del(m.id)} className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1"><Trash2 className="h-3 w-3" />Delete</button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
        {messages.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-10">
            No messages yet. Start the conversation!
          </div>
        )}
      </div>

      <div className="border-t border-border/60 p-4">
        <div className="max-w-3xl mx-auto relative">
          {showEmoji && (
            <div className="absolute bottom-14 left-0 glass rounded-2xl p-2 grid grid-cols-6 gap-1 z-10">
              {EMOJIS.map((e) => (
                <button key={e} className="text-xl hover:bg-accent rounded-lg p-1" onClick={() => { setInput((p) => p + e); setShowEmoji(false); }}>{e}</button>
              ))}
            </div>
          )}
          <div className="glass rounded-2xl flex items-center gap-1 p-1.5">
            <button onClick={() => setShowEmoji((s) => !s)} className="p-2 rounded-lg hover:bg-accent text-muted-foreground" aria-label="Emoji">
              <Smile className="h-4 w-4" />
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); send(); } }}
              placeholder={`Message ${group?.name || "group"}…`}
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

      {showMembers && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setShowMembers(false)}>
          <div className="glass rounded-2xl p-6 w-full max-w-md max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg">Members · {members.length}</h2>
              <button onClick={() => setShowMembers(false)} className="p-2 rounded-lg hover:bg-accent"><X className="h-4 w-4" /></button>
            </div>
            {canAdmin && (
              <button onClick={() => { setShowMembers(false); setInviting(true); }} className="mb-3 w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:opacity-90 transition shadow-[var(--shadow-glow)]">
                <UserPlus className="h-4 w-4" /> Invite friends
              </button>
            )}
            <div className="flex-1 overflow-y-auto space-y-2">
              {members.map((m) => {
                const p = memberProfiles.get(m.user_id);
                return (
                  <div key={m.id} className="flex items-center gap-3 rounded-xl p-2 hover:bg-accent/50">
                    <SocialAvatar profile={p} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate flex items-center gap-1.5">
                        {p?.display_name || initialsFor(p)}
                        {m.role === "owner" && <Crown className="h-3.5 w-3.5 text-amber-500" />}
                        {m.role === "admin" && <Shield className="h-3.5 w-3.5 text-primary" />}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">@{p?.username}</div>
                    </div>
                    {canAdmin && m.user_id !== user.id && m.role !== "owner" && (
                      <button onClick={() => removeMember(m.user_id)} className="p-1.5 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition" aria-label="Remove">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-4 border-t border-border/60 flex gap-2">
              {myMembership?.role !== "owner" && (
                <button onClick={leaveGroup} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm hover:bg-destructive/10 hover:text-destructive transition">
                  <LogOut className="h-4 w-4" /> Leave
                </button>
              )}
              {myMembership?.role === "owner" && (
                <button onClick={deleteGroup} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-destructive/40 text-destructive px-3 py-2 text-sm hover:bg-destructive/10 transition">
                  <Trash2 className="h-4 w-4" /> Delete group
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {inviting && <InviteModal groupId={groupId} currentMemberIds={memberIds} onClose={() => setInviting(false)} />}
    </div>
  );
}

function InviteModal({ groupId, currentMemberIds, onClose }: { groupId: string; currentMemberIds: string[]; onClose: () => void }) {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const { data: friendships = [] } = useFriendships(user.id);
  const accepted = friendships.filter((f) => f.status === "accepted");
  const friendIds = useMemo(() =>
    accepted.map((f) => f.requester_id === user.id ? f.addressee_id : f.requester_id)
      .filter((id) => !currentMemberIds.includes(id))
  , [accepted, user.id, currentMemberIds]);
  const { data: profileMap = new Map() } = useProfiles(friendIds);

  const invite = async (userId: string) => {
    const { error } = await supabase.from("group_members").insert({
      group_id: groupId, user_id: userId, role: "member",
    });
    if (error) return toast.error(error.message);
    toast.success("Added to group");
    qc.invalidateQueries({ queryKey: ["group-members", groupId] });
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="glass rounded-2xl p-6 w-full max-w-md max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg">Invite friends</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-2">
          {friendIds.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-10">
              All your friends are already in this group.
            </div>
          )}
          {friendIds.map((id) => {
            const p = profileMap.get(id);
            return (
              <div key={id} className="flex items-center gap-3 rounded-xl p-2 hover:bg-accent/50">
                <SocialAvatar profile={p} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">{p?.display_name}</div>
                  <div className="text-xs text-muted-foreground truncate">@{p?.username}</div>
                </div>
                <button onClick={() => invite(id)} className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:opacity-90 transition">
                  <UserPlus className="h-3.5 w-3.5" /> Add
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

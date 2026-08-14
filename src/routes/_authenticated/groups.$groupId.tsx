import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Users, Pencil, Trash2, LogOut, UserPlus, Shield, X, Crown } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useProfiles, useFriendships } from "@/hooks/use-social";
import { SocialAvatar } from "@/components/social-avatar";
import { ChatComposer } from "@/components/chat-composer";
import { MessageAttachments } from "@/components/message-attachments";
import type { ChatAttachment } from "@/lib/chat-attachments";
import { GroupAvatar } from "@/routes/_authenticated/chat";

export const Route = createFileRoute("/_authenticated/groups/$groupId")({
  component: GroupChat,
});

const MAX_GROUP_MEMBERS = 50;

interface GroupMessage {
  id: string;
  group_id: string;
  sender_id: string;
  content: string | null;
  created_at: string;
  edited_at: string | null;
  attachments?: ChatAttachment[];
}

function GroupChat() {
  const { user } = Route.useRouteContext();
  const { groupId } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [showMembers, setShowMembers] = useState(false);
  const [inviting, setInviting] = useState(false);

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
      const { data } = await supabase.from("group_members")
        .select("id, user_id, role, joined_at").eq("group_id", groupId).order("joined_at");
      return data ?? [];
    },
  });

  const myRole = members.find((m) => m.user_id === user.id)?.role ?? null;
  const isAdmin = myRole === "owner" || myRole === "admin";

  const queryKey = ["group-messages", groupId];
  const { data: messages = [] } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data } = await supabase.from("group_messages")
        .select("*").eq("group_id", groupId).order("created_at", { ascending: true }).limit(200);
      return (data ?? []) as unknown as GroupMessage[];
    },
  });

  const participantIds = useMemo(
    () => Array.from(new Set([...members.map((m) => m.user_id), ...messages.map((m) => m.sender_id)])),
    [members, messages],
  );
  const { data: profileMap = new Map() } = useProfiles(participantIds);

  useEffect(() => {
    const channel = supabase
      .channel(`group-${groupId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_messages", filter: `group_id=eq.${groupId}` }, (payload) => {
        const row = (payload.new ?? payload.old) as GroupMessage;
        if (payload.eventType === "INSERT") {
          qc.setQueryData<GroupMessage[]>(queryKey, (prev = []) => prev.some((m) => m.id === row.id) ? prev : [...prev, row]);
        } else if (payload.eventType === "UPDATE") {
          qc.setQueryData<GroupMessage[]>(queryKey, (prev = []) => prev.map((m) => (m.id === row.id ? { ...m, ...row } : m)));
        } else {
          qc.setQueryData<GroupMessage[]>(queryKey, (prev = []) => prev.filter((m) => m.id !== row.id));
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

  const send = async ({ content, attachments }: { content: string; attachments: ChatAttachment[] }) => {
    const { error } = await supabase.from("group_messages").insert({
      group_id: groupId, sender_id: user.id,
      content: content || null,
      attachments: attachments as unknown as never,
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
    if (myRole === "owner") return toast.error("Transfer ownership before leaving.");
    if (!confirm("Leave this group?")) return;
    await supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", user.id);
    qc.invalidateQueries({ queryKey: ["my-groups", user.id] });
    navigate({ to: "/chat" });
  };

  const kick = async (memberId: string) => {
    const { error } = await supabase.from("group_members").delete().eq("id", memberId);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["group-members", groupId] });
  };

  const setRole = async (memberId: string, role: string) => {
    const { error } = await supabase.from("group_members").update({ role }).eq("id", memberId);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["group-members", groupId] });
  };

  if (group === null) {
    return (
      <div className="grid h-full place-items-center p-10 text-center">
        <div>
          <p className="text-sm text-muted-foreground">This group doesn't exist or you don't have access.</p>
          <Link to="/chat" className="btn-primary-sm mt-4">Back to Chat</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <header className="glass flex items-center gap-3 border-b border-border/60 px-4 py-3 lg:px-6">
        <Link to="/chat" className="rounded-lg p-2 hover:bg-accent" aria-label="Back">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <GroupAvatar name={group?.name ?? "G"} url={group?.avatar_url ?? null} size={38} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{group?.name ?? "Group"}</div>
          <div className="truncate text-xs text-muted-foreground">
            {members.length}/{MAX_GROUP_MEMBERS} members{group?.description ? ` · ${group.description}` : ""}
          </div>
        </div>
        <button onClick={() => setShowMembers(true)} className="btn-soft"><Users className="h-3.5 w-3.5" /> Members</button>
        {myRole && myRole !== "owner" && (
          <button onClick={leaveGroup} className="btn-soft"><LogOut className="h-3.5 w-3.5" /> Leave</button>
        )}
      </header>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-6 lg:px-6">
        {messages.map((m) => {
          const isOwn = m.sender_id === user.id;
          const p = profileMap.get(m.sender_id);
          const editing = editingId === m.id;
          const atts = (m.attachments || []) as ChatAttachment[];
          return (
            <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className={`group flex gap-3 ${isOwn ? "flex-row-reverse" : ""}`}>
              <SocialAvatar profile={p} size={36} />
              <div className={`flex max-w-[75%] flex-col ${isOwn ? "items-end" : "items-start"}`}>
                <div className={`mb-1 flex items-center gap-2 text-[11px] text-muted-foreground ${isOwn ? "flex-row-reverse" : ""}`}>
                  <span className="font-medium text-foreground/70">{isOwn ? "You" : p?.display_name || "User"}</span>
                  <span>{formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}</span>
                  {m.edited_at && <span className="italic">(edited)</span>}
                </div>
                {editing ? (
                  <div className="flex gap-2">
                    <input value={editText} onChange={(e) => setEditText(e.target.value)} autoFocus
                      className="rounded-xl border border-border bg-background/40 px-3 py-2 text-sm outline-none focus:border-primary" />
                    <button onClick={() => saveEdit(m.id)} className="text-xs text-primary hover:underline">Save</button>
                    <button onClick={() => setEditingId(null)} className="text-xs text-muted-foreground hover:underline">Cancel</button>
                  </div>
                ) : (
                  <>
                    {m.content && (
                      <div className={`whitespace-pre-wrap break-words rounded-2xl px-4 py-2 text-sm ${
                        isOwn ? "bg-primary text-primary-foreground" : "glass"
                      }`}>{m.content}</div>
                    )}
                    <MessageAttachments items={atts} />
                  </>
                )}
                {(isOwn || isAdmin) && !editing && (
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground opacity-0 transition group-hover:opacity-100">
                    {isOwn && m.content && (
                      <button onClick={() => { setEditingId(m.id); setEditText(m.content ?? ""); }} className="inline-flex items-center gap-1 hover:text-foreground">
                        <Pencil className="h-3 w-3" />Edit
                      </button>
                    )}
                    <button onClick={() => del(m.id)} className="inline-flex items-center gap-1 hover:text-destructive">
                      <Trash2 className="h-3 w-3" />Delete
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
        {messages.length === 0 && (
          <div className="py-10 text-center text-sm text-muted-foreground">No messages yet — start the conversation!</div>
        )}
      </div>

      {myRole ? (
        <ChatComposer userId={user.id} placeholder={`Message ${group?.name ?? "group"}…`} onSend={send} />
      ) : (
        <div className="border-t border-border/60 px-6 py-4 text-center text-sm text-muted-foreground">
          Join this group to send messages.
        </div>
      )}

      <AnimatePresence>
        {showMembers && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-sm"
            onClick={() => setShowMembers(false)}>
            <motion.div initial={{ scale: 0.96, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass w-full max-w-md rounded-3xl border border-border/60 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Members ({members.length}/{MAX_GROUP_MEMBERS})</h2>
                <button onClick={() => setShowMembers(false)} className="rounded-lg p-1.5 hover:bg-accent"><X className="h-4 w-4" /></button>
              </div>

              {isAdmin && members.length < MAX_GROUP_MEMBERS && (
                <button onClick={() => { setShowMembers(false); setInviting(true); }} className="btn-primary-sm mt-4">
                  <UserPlus className="h-3.5 w-3.5" /> Invite friends
                </button>
              )}

              <div className="mt-4 max-h-[50vh] space-y-1 overflow-y-auto">
                {members.map((m) => {
                  const p = profileMap.get(m.user_id);
                  return (
                    <div key={m.id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-accent/40">
                      <SocialAvatar profile={p} size={34} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{p?.display_name || "User"}</div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          {m.role === "owner" && <Crown className="h-3 w-3 text-primary" />}
                          {m.role === "admin" && <Shield className="h-3 w-3 text-primary" />}
                          {m.role}
                        </div>
                      </div>
                      {myRole === "owner" && m.user_id !== user.id && (
                        <button onClick={() => setRole(m.id, m.role === "admin" ? "member" : "admin")} className="btn-soft">
                          {m.role === "admin" ? "Demote" : "Promote"}
                        </button>
                      )}
                      {isAdmin && m.role !== "owner" && m.user_id !== user.id && (
                        <button onClick={() => kick(m.id)} className="btn-soft hover:text-destructive">Remove</button>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}

        {inviting && (
          <InviteModal groupId={groupId} userId={user.id}
            existing={members.map((m) => m.user_id)}
            onClose={() => setInviting(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function InviteModal({
  groupId, userId, existing, onClose,
}: { groupId: string; userId: string; existing: string[]; onClose: () => void }) {
  const { data: friendships = [] } = useFriendships(userId);
  const friendIds = friendships
    .filter((f) => f.status === "accepted")
    .map((f) => (f.requester_id === userId ? f.addressee_id : f.requester_id))
    .filter((id) => !existing.includes(id));
  const { data: profileMap = new Map() } = useProfiles(friendIds);
  const [sent, setSent] = useState<string[]>([]);

  const invite = async (id: string) => {
    const { error } = await supabase.from("group_invitations")
      .insert({ group_id: groupId, invited_user_id: id, invited_by: userId, status: "pending" });
    if (error) return toast.error(error.message);
    setSent((s) => [...s, id]);
    toast.success("Invitation sent");
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ scale: 0.96, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="glass w-full max-w-md rounded-3xl border border-border/60 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Invite friends</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-4 max-h-[50vh] space-y-1 overflow-y-auto">
          {friendIds.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No friends left to invite.</p>}
          {friendIds.map((id) => {
            const p = profileMap.get(id);
            return (
              <div key={id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-accent/40">
                <SocialAvatar profile={p} size={34} />
                <div className="min-w-0 flex-1 truncate text-sm font-medium">{p?.display_name || "User"}</div>
                {sent.includes(id) ? (
                  <span className="text-xs text-muted-foreground">Invited</span>
                ) : (
                  <button onClick={() => invite(id)} className="btn-primary-sm"><UserPlus className="h-3.5 w-3.5" /> Invite</button>
                )}
              </div>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}

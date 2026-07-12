import { createFileRoute, useNavigate, Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import {
  Bot, Plus, Send, Copy, RefreshCw, Trash2, Menu, Sparkles, MessageSquare,
  Paperclip, X, Crown, FileText, Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/use-subscription";
import { useDailyAiUsage } from "@/hooks/use-daily-ai-usage";
import { ProBadge } from "@/components/pro-badge";

export const Route = createFileRoute("/_authenticated/ai/$threadId")({
  component: AiThread,
});

function AiThread() {
  const { threadId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [input, setInput] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [upsellOpen, setUpsellOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: sub } = useSubscription(user.id);
  const isPro = !!sub?.isPro;
  const { remaining, limit } = useDailyAiUsage(user.id, isPro);
  const limitReached = remaining <= 0;

  const { data: threads = [] } = useQuery({
    queryKey: ["ai-threads", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("ai_threads")
        .select("id,title,updated_at").eq("user_id", user.id).order("updated_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: initialMessages } = useQuery({
    queryKey: ["ai-messages", threadId],
    queryFn: async () => {
      const { data } = await supabase.from("ai_messages")
        .select("content,role,created_at").eq("thread_id", threadId).order("created_at");
      return (data ?? []).map((r) => r.content as unknown as UIMessage);
    },
  });

  const transport = useMemo(() => new DefaultChatTransport({
    api: "/api/chat",
    fetch: async (input, init) => {
      const { data } = await supabase.auth.getSession();
      const headers = new Headers(init?.headers);
      if (data.session?.access_token) headers.set("Authorization", `Bearer ${data.session.access_token}`);
      return fetch(input, { ...init, headers });
    },
    prepareSendMessagesRequest: ({ messages }) => ({ body: { messages, threadId } }),
  }), [threadId]);

  const { messages, sendMessage, status, setMessages, regenerate, stop } = useChat({
    id: threadId,
    transport,
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    if (initialMessages) setMessages(initialMessages);
  }, [initialMessages, setMessages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  const pickFiles = (kind: "file" | "camera") => {
    if (!isPro) { setUpsellOpen(true); return; }
    (kind === "camera" ? cameraRef.current : fileRef.current)?.click();
  };

  const onFilesSelected = (list: FileList | null) => {
    if (!list) return;
    const arr = Array.from(list);
    const oversize = arr.find((f) => f.size > 20 * 1024 * 1024);
    if (oversize) { toast.error(`${oversize.name} exceeds 20MB`); return; }
    setPendingFiles((prev) => [...prev, ...arr].slice(0, 5));
  };

  const handleSend = async () => {
    if ((!input.trim() && pendingFiles.length === 0) || status === "streaming" || status === "submitted") return;
    if (pendingFiles.length && !isPro) { setUpsellOpen(true); return; }
    const text = input.trim();
    const filesToSend = pendingFiles;
    setInput("");
    setPendingFiles([]);

    if (messages.length === 0 && text) {
      const title = text.slice(0, 60);
      await supabase.from("ai_threads").update({ title }).eq("id", threadId);
      qc.invalidateQueries({ queryKey: ["ai-threads", user.id] });
    }

    const dt = new DataTransfer();
    filesToSend.forEach((f) => dt.items.add(f));
    await sendMessage({ text: text || " ", files: filesToSend.length ? dt.files : undefined });
  };

  const newChat = async () => {
    const { data } = await supabase.from("ai_threads")
      .insert({ user_id: user.id, title: "New chat" }).select("id").single();
    if (data) {
      qc.invalidateQueries({ queryKey: ["ai-threads", user.id] });
      navigate({ to: "/ai/$threadId", params: { threadId: data.id } });
    }
  };

  const deleteThread = async (id: string) => {
    if (!confirm("Delete this conversation?")) return;
    await supabase.from("ai_threads").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["ai-threads", user.id] });
    if (id === threadId) {
      const remaining = threads.filter((t) => t.id !== id);
      if (remaining[0]) navigate({ to: "/ai/$threadId", params: { threadId: remaining[0].id } });
      else navigate({ to: "/ai" });
    }
  };

  const clearChat = async () => {
    if (!confirm("Clear all messages in this chat?")) return;
    await supabase.from("ai_messages").delete().eq("thread_id", threadId);
    setMessages([]);
    qc.invalidateQueries({ queryKey: ["ai-messages", threadId] });
  };

  const isLoading = status === "streaming" || status === "submitted";

  return (
    <div className="flex h-[calc(100vh-56px)] lg:h-screen">
      <ThreadsSidebar
        open={sidebarOpen} onClose={() => setSidebarOpen(false)}
        threads={threads} threadId={threadId}
        onNew={newChat} onDelete={deleteThread}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
          <button className="lg:hidden p-2 rounded-lg hover:bg-accent" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-4 w-4" />
          </button>
          <Bot className="h-5 w-5 text-primary" />
          <div className="font-semibold truncate flex-1 flex items-center gap-2">
            {threads.find((t) => t.id === threadId)?.title || "New chat"}
            {isPro && <ProBadge />}
          </div>
          <button onClick={clearChat} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-destructive" aria-label="Clear chat">
            <Trash2 className="h-4 w-4" />
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
            {messages.length === 0 && (
              <div className="text-center py-16">
                <div className="inline-flex h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-primary-glow grid place-items-center text-primary-foreground shadow-[var(--shadow-glow)]">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h2 className="mt-4 text-2xl font-bold">How can I help today?</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Ask anything — homework, explanations, code, ideas.
                  {isPro ? " Attach photos, PDFs, or snap a picture." : " Upgrade to PRO for photo & file analysis."}
                </p>
                <div className="mt-6 grid gap-2 sm:grid-cols-2 max-w-lg mx-auto">
                  {[
                    "Explain quadratic equations simply",
                    "Draft a study plan for finals",
                    "Debug this Python function",
                    "Summarize World War II",
                  ].map((s) => (
                    <button key={s} onClick={() => setInput(s)} className="text-left glass rounded-xl p-3 text-sm hover:shadow-[var(--shadow-glow)] transition">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <MessageBubble
                key={m.id} message={m}
                onRegenerate={i === messages.length - 1 && m.role === "assistant" ? () => regenerate() : undefined}
              />
            ))}

            {status === "submitted" && (
              <div className="flex gap-3">
                <div className="h-8 w-8 shrink-0 rounded-lg bg-gradient-to-br from-primary to-primary-glow grid place-items-center text-primary-foreground">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-1 pt-2">
                  <span className="h-2 w-2 rounded-full bg-primary animate-bounce" />
                  <span className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0.15s" }} />
                  <span className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0.3s" }} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Composer */}
        <div className="border-t border-border/60 p-4">
          <div className="max-w-3xl mx-auto">
            {pendingFiles.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {pendingFiles.map((f, i) => (
                  <div key={i} className="glass rounded-xl p-1.5 pr-2 flex items-center gap-2 text-xs">
                    {f.type.startsWith("image/") ? (
                      <img src={URL.createObjectURL(f)} alt="" className="h-10 w-10 rounded-lg object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
                        <FileText className="h-4 w-4" />
                      </div>
                    )}
                    <span className="max-w-[140px] truncate">{f.name}</span>
                    <button
                      onClick={() => setPendingFiles((p) => p.filter((_, idx) => idx !== i))}
                      className="p-1 rounded-md hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Remove"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="glass rounded-2xl p-2 flex items-end gap-1">
              <input
                ref={fileRef} type="file" multiple hidden
                accept="image/*,application/pdf,.doc,.docx,.txt,.md,.csv,.json"
                onChange={(e) => { onFilesSelected(e.target.files); e.target.value = ""; }}
              />
              <input
                ref={cameraRef} type="file" hidden
                accept="image/*" capture="environment"
                onChange={(e) => { onFilesSelected(e.target.files); e.target.value = ""; }}
              />
              <button
                onClick={() => pickFiles("file")}
                className={`h-9 w-9 rounded-xl grid place-items-center transition ${
                  isPro ? "hover:bg-accent text-muted-foreground" : "text-muted-foreground/60"
                }`}
                aria-label="Attach file"
                title={isPro ? "Attach files" : "PRO feature — upgrade to attach files"}
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <button
                onClick={() => pickFiles("camera")}
                className={`h-9 w-9 rounded-xl grid place-items-center transition ${
                  isPro ? "hover:bg-accent text-muted-foreground" : "text-muted-foreground/60"
                }`}
                aria-label="Take a photo"
                title={isPro ? "Take a photo" : "PRO feature — upgrade to use the camera"}
              >
                <Camera className="h-4 w-4" />
              </button>
              <textarea
                value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
                }}
                placeholder="Message TreckWeb AI…"
                rows={1}
                className="flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none max-h-40"
                style={{ minHeight: "40px" }}
                autoFocus
              />
              {isLoading ? (
                <button onClick={stop} className="h-9 w-9 rounded-xl bg-destructive text-destructive-foreground grid place-items-center hover:opacity-90 transition" aria-label="Stop">
                  <div className="h-3 w-3 bg-current rounded-sm" />
                </button>
              ) : (
                <button
                  onClick={handleSend} disabled={!input.trim() && pendingFiles.length === 0}
                  className="h-9 w-9 rounded-xl bg-primary text-primary-foreground grid place-items-center hover:opacity-90 transition disabled:opacity-40 shadow-[var(--shadow-glow)]"
                  aria-label="Send"
                >
                  <Send className="h-4 w-4" />
                </button>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground text-center mt-2">
              Powered by Lovable AI — Gemini 3 Flash
            </p>
          </div>
        </div>
      </div>

      {/* Upsell modal */}
      <AnimatePresence>
        {upsellOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
              onClick={() => setUpsellOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-md glass rounded-3xl p-6 text-center"
            >
              <div className="mx-auto h-12 w-12 rounded-2xl bg-gradient-to-br from-amber-400 to-primary grid place-items-center text-white shadow-[var(--shadow-glow)]">
                <Crown className="h-6 w-6" />
              </div>
              <h3 className="mt-3 text-lg font-bold">Attachments are a PRO feature</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Upload images, PDFs, notes, or snap a photo of your homework for the AI to analyze — all included with TRECK PRO.
              </p>
              <div className="mt-5 flex gap-2 justify-center">
                <button onClick={() => setUpsellOpen(false)} className="rounded-xl px-4 py-2 text-sm hover:bg-accent">
                  Not now
                </button>
                <Link
                  to="/membership"
                  onClick={() => setUpsellOpen(false)}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-primary px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-glow)]"
                >
                  <Crown className="h-4 w-4" /> Get TRECK PRO
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function MessageBubble({
  message, onRegenerate,
}: { message: UIMessage; onRegenerate?: () => void }) {
  const isUser = message.role === "user";
  const text = message.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
  const files = message.parts.filter((p: any) => p.type === "file") as any[];
  const copy = () => {
    navigator.clipboard.writeText(text);
    toast.success("Copied");
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}
    >
      <div className={`h-8 w-8 shrink-0 rounded-lg grid place-items-center text-xs font-bold ${
        isUser ? "bg-accent text-accent-foreground" : "bg-gradient-to-br from-primary to-primary-glow text-primary-foreground"
      }`}>
        {isUser ? "You" : <Bot className="h-4 w-4" />}
      </div>
      <div className={`min-w-0 max-w-[calc(100%-3rem)] ${isUser ? "text-right" : ""}`}>
        {files.length > 0 && (
          <div className={`mb-1.5 flex flex-wrap gap-2 ${isUser ? "justify-end" : ""}`}>
            {files.map((f, i) => {
              const url = f.url || f.data;
              const mime = f.mediaType || f.mimeType || "";
              if (mime.startsWith("image/") && url) {
                return <img key={i} src={url} alt={f.filename || "attachment"} className="max-h-56 rounded-xl border border-border" />;
              }
              return (
                <div key={i} className="glass rounded-xl px-3 py-2 flex items-center gap-2 text-xs">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="truncate max-w-[180px]">{f.filename || "attachment"}</span>
                </div>
              );
            })}
          </div>
        )}
        <div className={`inline-block text-left ${
          isUser
            ? "bg-primary text-primary-foreground rounded-2xl px-4 py-2.5"
            : ""
        }`}>
          <div className={`prose prose-sm dark:prose-invert max-w-none ${isUser ? "prose-invert" : ""}`}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}
              components={{
                code({ className, children, ...props }: any) {
                  const inline = !className;
                  if (inline) return <code className="rounded bg-muted px-1 py-0.5 text-xs" {...props}>{children}</code>;
                  return (
                    <pre className="rounded-xl bg-muted p-3 overflow-x-auto text-xs my-2">
                      <code {...props}>{children}</code>
                    </pre>
                  );
                },
              }}
            >
              {text}
            </ReactMarkdown>
          </div>
        </div>
        {!isUser && (
          <div className="mt-1 flex gap-1 opacity-0 group-hover:opacity-100 transition">
            <button onClick={copy} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground" aria-label="Copy">
              <Copy className="h-3.5 w-3.5" />
            </button>
            {onRegenerate && (
              <button onClick={onRegenerate} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground" aria-label="Regenerate">
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function ThreadsSidebar({
  open, onClose, threads, threadId, onNew, onDelete,
}: {
  open: boolean; onClose: () => void;
  threads: Array<{ id: string; title: string; updated_at: string }>;
  threadId: string;
  onNew: () => void; onDelete: (id: string) => void;
}) {
  const content = (
    <div className="w-72 h-full flex flex-col border-r border-border/60 bg-sidebar">
      <div className="p-3">
        <button onClick={onNew} className="w-full inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-3 py-2.5 text-sm font-semibold hover:opacity-90 transition shadow-[var(--shadow-glow)]">
          <Plus className="h-4 w-4" /> New chat
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {threads.map((t) => (
          <div key={t.id} className={`group flex items-center rounded-xl px-1 ${t.id === threadId ? "bg-sidebar-accent" : ""}`}>
            <Link to="/ai/$threadId" params={{ threadId: t.id }} className="flex-1 flex items-center gap-2 px-2 py-2 text-sm truncate">
              <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{t.title}</span>
            </Link>
            <button onClick={() => onDelete(t.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition" aria-label="Delete">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
  return (
    <>
      <aside className="hidden lg:flex">{content}</aside>
      <AnimatePresence>
        {open && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
            <motion.aside initial={{ x: -288 }} animate={{ x: 0 }} exit={{ x: -288 }}
              className="lg:hidden fixed left-0 top-0 bottom-0 z-50">
              {content}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  GraduationCap, Layers, ListChecks, StickyNote, Sparkles, Plus, Trash2, Loader2, Crown, Zap,
  FolderInput, Pencil, X,
} from "lucide-react";

import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/use-subscription";
import { useStudyAiUsage } from "@/hooks/use-study-ai-usage";

export const Route = createFileRoute("/_authenticated/study/")({
  head: () => ({
    meta: [
      { title: "Study — WebuWeb" },
      { name: "description", content: "Flashcards, quizzes and notes with AI-powered study generation." },
      { property: "og:title", content: "Study — WebuWeb" },
      { property: "og:description", content: "Flashcards, quizzes and notes with AI-powered study generation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StudyPage,
});

type Tab = "flashcards" | "quizzes" | "notes";

const TABS: { id: Tab; label: string; icon: typeof Layers }[] = [
  { id: "flashcards", label: "Flashcards", icon: Layers },
  { id: "quizzes", label: "Quizzes", icon: ListChecks },
  { id: "notes", label: "Notes", icon: StickyNote },
];

function StudyPage() {
  const { user } = Route.useRouteContext();
  const [tab, setTab] = useState<Tab>("flashcards");
  const { data: sub } = useSubscription(user.id);
  const isPro = !!sub?.isPro;
  const usage = useStudyAiUsage(user.id);

  return (
    <div className="relative min-h-full">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-24 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-24 h-96 w-96 rounded-full bg-cyan-500/20 blur-3xl" />
      </div>

      <div className="relative p-6 lg:p-10 max-w-6xl mx-auto space-y-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center gap-4">
          <div className="h-14 w-14 rounded-3xl bg-gradient-to-br from-primary to-cyan-400 grid place-items-center text-white shadow-[var(--shadow-glow)]">
            <GraduationCap className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <h1 className="text-3xl font-bold tracking-tight">Study</h1>
            <p className="text-muted-foreground text-sm">Flashcards, quizzes and notes — build them yourself or let AI do it.</p>
          </div>
          {isPro && (
            <div className="ml-auto flex items-center gap-2 rounded-full glass px-3 py-1.5 text-xs font-medium">
              <Zap className="h-3.5 w-3.5 text-primary" />
              {usage.remaining}/{usage.limit} AI generations left today
            </div>
          )}
        </motion.div>

        <AiGenerator userId={user.id} isPro={isPro} remaining={usage.remaining} />

        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
                tab === t.id ? "bg-primary text-primary-foreground shadow-[var(--shadow-glow)]" : "glass hover:bg-accent"
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            {tab === "flashcards" && <DecksTab userId={user.id} />}
            {tab === "quizzes" && <QuizzesTab userId={user.id} />}
            {tab === "notes" && <NotesTab userId={user.id} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function AiGenerator({ userId, isPro, remaining }: { userId: string; isPro: boolean; remaining: number }) {
  const [kind, setKind] = useState<"flashcards" | "quiz">("flashcards");
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(8);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const generate = useMutation({
    mutationFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch("/api/study-generate", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ kind, topic, count }),
      });
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as { kind: string; id: string; count: number };
    },
    onSuccess: (data) => {
      toast.success(`Generated ${data.count} ${data.kind === "quiz" ? "questions" : "cards"}`);
      setTopic("");
      qc.invalidateQueries({ queryKey: ["study-ai-usage", userId] });
      qc.invalidateQueries({ queryKey: ["study-decks", userId] });
      qc.invalidateQueries({ queryKey: ["study-quizzes", userId] });
      if (data.kind === "quiz") navigate({ to: "/study/quiz/$quizId", params: { quizId: data.id } });
      else navigate({ to: "/study/deck/$deckId", params: { deckId: data.id } });
    },
    onError: (e: Error) => toast.error(e.message || "Generation failed"),
  });

  return (
    <div className="glass rounded-3xl p-5 lg:p-6 border border-border/60">
      <div className="flex flex-wrap items-center gap-3">
        <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-primary grid place-items-center text-white">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-semibold flex items-center gap-2">
            AI Study Generator
            <span className="rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-2 py-0.5 text-[10px] font-bold text-white">PRO</span>
          </h2>
          <p className="text-xs text-muted-foreground">Turn any topic into a flashcard deck or a quiz in seconds.</p>
        </div>
      </div>

      {!isPro ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-border p-4">
          <p className="text-sm text-muted-foreground">
            AI study generation is included with PRO — 3 generations per day.
          </p>
          <Link to="/membership" className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            <Crown className="h-4 w-4" /> Get PRO
          </Link>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {(["flashcards", "quiz"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  kind === k ? "bg-primary text-primary-foreground" : "bg-accent hover:bg-accent/70"
                }`}
              >
                {k === "flashcards" ? "Flashcard deck" : "Quiz"}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Photosynthesis for grade 10 biology"
              className="flex-1 rounded-xl border border-border bg-background/60 px-4 py-2.5 text-sm outline-none focus:border-primary"
            />
            <select
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm outline-none focus:border-primary"
            >
              {[5, 8, 10, 12, 15].map((n) => (
                <option key={n} value={n}>{n} items</option>
              ))}
            </select>
            <button
              disabled={generate.isPending || topic.trim().length < 3 || remaining === 0}
              onClick={() => generate.mutate()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {generate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Generate
            </button>
          </div>
          {remaining === 0 && <p className="text-xs text-muted-foreground">Daily limit reached — resets tomorrow.</p>}
        </div>
      )}
    </div>
  );
}

function EmptyState({ icon: Icon, title, hint }: { icon: typeof Layers; title: string; hint: string }) {
  return (
    <div className="glass rounded-3xl p-10 text-center">
      <Icon className="mx-auto h-8 w-8 text-muted-foreground" />
      <p className="mt-3 font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}

function DecksTab({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const { data: decks, isLoading } = useQuery({
    queryKey: ["study-decks", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("study_decks")
        .select("id,title,description,ai_generated,created_at,study_cards(count)")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("study_decks").insert({ user_id: userId, title: title.trim() || "Untitled deck" }).select("id").single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { setTitle(""); qc.invalidateQueries({ queryKey: ["study-decks", userId] }); toast.success("Deck created"); },
    onError: () => toast.error("Could not create deck"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { await supabase.from("study_decks").delete().eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["study-decks", userId] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create.mutate()}
          placeholder="New deck name…"
          className="flex-1 rounded-xl border border-border bg-background/60 px-4 py-2.5 text-sm outline-none focus:border-primary"
        />
        <button onClick={() => create.mutate()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground">
          <Plus className="h-4 w-4" /> New deck
        </button>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-16"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : !decks?.length ? (
        <EmptyState icon={Layers} title="No decks yet" hint="Create one above or generate a deck with AI." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((d: any) => (
            <div key={d.id} className="group glass rounded-2xl p-5 transition hover:-translate-y-0.5">
              <Link to="/study/deck/$deckId" params={{ deckId: d.id }} className="block">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold truncate">{d.title}</h3>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{d.description || "No description"}</p>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{d.study_cards?.[0]?.count ?? 0} cards</span>
                  {d.ai_generated && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-primary">AI</span>}
                </div>
              </Link>
              <div className="mt-3 flex items-center gap-4">
                <button
                  onClick={() => remove.mutate(d.id)}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
                <WorkspaceMoveButton userId={userId} table="study_decks" id={d.id} />
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function QuizzesTab({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const { data: quizzes, isLoading } = useQuery({
    queryKey: ["study-quizzes", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("study_quizzes")
        .select("id,title,description,ai_generated,study_questions(count)")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("study_quizzes").insert({ user_id: userId, title: title.trim() || "Untitled quiz" });
      if (error) throw error;
    },
    onSuccess: () => { setTitle(""); qc.invalidateQueries({ queryKey: ["study-quizzes", userId] }); toast.success("Quiz created"); },
    onError: () => toast.error("Could not create quiz"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { await supabase.from("study_quizzes").delete().eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["study-quizzes", userId] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create.mutate()}
          placeholder="New quiz name…"
          className="flex-1 rounded-xl border border-border bg-background/60 px-4 py-2.5 text-sm outline-none focus:border-primary"
        />
        <button onClick={() => create.mutate()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground">
          <Plus className="h-4 w-4" /> New quiz
        </button>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-16"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : !quizzes?.length ? (
        <EmptyState icon={ListChecks} title="No quizzes yet" hint="Create one above or generate a quiz with AI." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quizzes.map((q: any) => (
            <div key={q.id} className="glass rounded-2xl p-5 transition hover:-translate-y-0.5">
              <Link to="/study/quiz/$quizId" params={{ quizId: q.id }} className="block">
                <div className="flex items-center gap-2">
                  <ListChecks className="h-4 w-4 text-cyan-400" />
                  <h3 className="font-semibold truncate">{q.title}</h3>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{q.description || "No description"}</p>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{q.study_questions?.[0]?.count ?? 0} questions</span>
                  {q.ai_generated && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-primary">AI</span>}
                </div>
              </Link>
              <div className="mt-3 flex items-center gap-4">
                <button onClick={() => remove.mutate(q.id)} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
                <WorkspaceMoveButton userId={userId} table="study_quizzes" id={q.id} />
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NotesTab({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const { data: notes, isLoading } = useQuery({
    queryKey: ["study-notes", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("notes").select("id,title,content,updated_at").eq("user_id", userId)
        .order("updated_at", { ascending: false }).limit(50);
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("notes").insert({ user_id: userId, title: title.trim() || "Untitled note", kind: "note", content: "" });
      if (error) throw error;
    },
    onSuccess: () => { setTitle(""); qc.invalidateQueries({ queryKey: ["study-notes", userId] }); toast.success("Note created"); },
    onError: () => toast.error("Could not create note"),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create.mutate()}
          placeholder="Quick note title…"
          className="flex-1 rounded-xl border border-border bg-background/60 px-4 py-2.5 text-sm outline-none focus:border-primary"
        />
        <button onClick={() => create.mutate()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground">
          <Plus className="h-4 w-4" /> New note
        </button>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-16"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : !notes?.length ? (
        <EmptyState icon={StickyNote} title="No notes yet" hint="Notes you create here also live in your Workspace." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((n) => (
            <NoteCard
              key={n.id}
              userId={userId}
              note={n as { id: string; title: string; content: string | null }}
              onChanged={() => qc.invalidateQueries({ queryKey: ["study-notes", userId] })}
            />
          ))}
        </div>
      )}

    </div>
  );
}

/* ---------- Workspace integration ---------- */

function useWorkspaceFolders(userId: string) {
  return useQuery({
    queryKey: ["ws-folder-list", userId],
    queryFn: async () => {
      const { data } = await supabase.from("folders").select("id,name,parent_id").eq("user_id", userId).order("name");
      const rows = (data ?? []) as Array<{ id: string; name: string; parent_id: string | null }>;
      const map = new Map(rows.map((r) => [r.id, r]));
      const label = (r: (typeof rows)[number]) => {
        const parts: string[] = [];
        let cur: (typeof rows)[number] | undefined = r;
        const seen = new Set<string>();
        while (cur && !seen.has(cur.id)) { seen.add(cur.id); parts.unshift(cur.name); cur = cur.parent_id ? map.get(cur.parent_id) : undefined; }
        return parts.join(" / ");
      };
      return rows.map((r) => ({ id: r.id, label: label(r) })).sort((a, b) => a.label.localeCompare(b.label));
    },
  });
}

function WorkspaceMoveButton({
  userId, table, id, className,
}: { userId: string; table: "notes" | "study_decks" | "study_quizzes"; id: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const { data: folders = [] } = useWorkspaceFolders(userId);

  const move = async (folderId: string) => {
    const { error } = await (supabase as any).from(table).update({ folder_id: folderId }).eq("id", id);
    setOpen(false);
    if (error) return toast.error(error.message);
    toast.success("Added to your Workspace folder");
  };

  return (
    <div className="relative inline-block">
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
        className={className ?? "inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary"}
      >
        <FolderInput className="h-3.5 w-3.5" /> Workspace
      </button>
      {open && (
        <div className="glass absolute bottom-full left-0 z-30 mb-2 max-h-56 w-56 overflow-y-auto rounded-xl border border-border/60 p-1.5 text-left shadow-[var(--shadow-elevated)]">
          {folders.length === 0 ? (
            <p className="p-2 text-xs text-muted-foreground">Create a folder in Workspace first.</p>
          ) : folders.map((f) => (
            <button key={f.id} onClick={(e) => { e.preventDefault(); move(f.id); }}
              className="block w-full truncate rounded-lg px-2 py-1.5 text-left text-xs hover:bg-accent">
              {f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

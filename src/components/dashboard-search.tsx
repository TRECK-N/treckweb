import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Search as SearchIcon, X, Loader2, FileText, FolderOpen, File, Crown, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SocialAvatar } from "@/components/social-avatar";

/** Static, non-AI platform content that is searchable from the dashboard. */
const PLATFORM_CONTENT: Array<{ id: string; title: string; desc: string; to: string; keywords: string }> = [
  { id: "pro", title: "WebuWeb PRO", desc: "Higher daily AI limits, file uploads and AI study generation.", to: "/membership", keywords: "pro membership subscription upgrade plan premium price" },
  { id: "music-pack", title: "Music Pack", desc: "Temporarily unavailable.", to: "/membership", keywords: "music pack songs library unlock purchase" },
  { id: "study", title: "Study", desc: "Flashcards, notes and quizzes for every subject.", to: "/dashboard", keywords: "study flashcards quiz notes learning revision" },
  { id: "workspace", title: "Workspace", desc: "Your private folders, notes and files.", to: "/workspace", keywords: "workspace folders files notes documents upload storage" },
  { id: "games", title: "Games", desc: "Chess, Snake and more.", to: "/games", keywords: "games chess snake play arcade" },
  { id: "chat", title: "Chat", desc: "Friends, requests and discovery.", to: "/chat", keywords: "chat messages friends requests dm" },
  { id: "ai", title: "AI Assistant", desc: "Ask questions, get explanations and code help.", to: "/ai", keywords: "ai assistant chatbot help explain" },
  { id: "settings", title: "Settings", desc: "Profile, language, appearance and account.", to: "/settings", keywords: "settings profile language theme account password" },
];

type Profile = { id: string; display_name: string | null; username: string | null; avatar_url: string | null; bio: string | null };

export function DashboardSearch({ userId }: { userId: string }) {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setQuery(input.trim()), 220);
    return () => clearTimeout(t);
  }, [input]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const { data, isFetching } = useQuery({
    queryKey: ["dashboard-search", query, userId],
    enabled: query.length >= 2,
    queryFn: async () => {
      const like = `%${query}%`;
      const [usersRes, foldersRes, notesRes, filesRes] = await Promise.all([
        supabase.from("profiles").select("id, display_name, username, avatar_url, bio")
          .or(`display_name.ilike.${like},username.ilike.${like},bio.ilike.${like}`).neq("id", userId).limit(6),
        supabase.from("folders").select("id, name").eq("user_id", userId).ilike("name", like).limit(6),
        supabase.from("notes").select("id, title").eq("user_id", userId)
          .or(`title.ilike.${like},content.ilike.${like}`).limit(6),
        supabase.from("workspace_files").select("id, name").eq("user_id", userId).ilike("name", like).limit(6),
      ]);
      return {
        users: (usersRes.data ?? []) as Profile[],
        folders: foldersRes.data ?? [],
        notes: notesRes.data ?? [],
        files: filesRes.data ?? [],
      };
    },
  });

  const platform = useMemo(() => {
    if (query.length < 2) return [];
    const q = query.toLowerCase();
    return PLATFORM_CONTENT.filter((p) =>
      p.title.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q) || p.keywords.includes(q),
    ).slice(0, 4);
  }, [query]);

  const total =
    (data?.users.length ?? 0) + (data?.folders.length ?? 0) +
    (data?.notes.length ?? 0) + (data?.files.length ?? 0) + platform.length;

  const showPanel = open && query.length >= 2;

  return (
    <div ref={boxRef} className="relative mx-auto w-full max-w-2xl">
      <div className="glass flex items-center gap-3 rounded-2xl border border-border/60 px-5 py-4 transition focus-within:border-primary/50">
        <SearchIcon className="h-5 w-5 shrink-0 text-muted-foreground" />
        <input
          value={input}
          onChange={(e) => { setInput(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search people, your workspace…"
          aria-label="Search WebuWeb"
          className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground/70"
        />
        {isFetching && query.length >= 2 && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {input && (
          <button onClick={() => { setInput(""); setQuery(""); }} aria-label="Clear search"
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {showPanel && (
          <motion.div
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="glass absolute left-0 right-0 top-[calc(100%+0.6rem)] z-40 max-h-[26rem] overflow-y-auto rounded-2xl border border-border/60 p-2 shadow-[var(--shadow-elevated)]"
          >
            {total === 0 && !isFetching && (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">No results for “{query}”.</p>
            )}

            <Section title="People" show={!!data?.users.length}>
              {data?.users.map((u) => (
                <Row key={u.id} to="/messages/$userId" params={{ userId: u.id }} onNavigate={() => setOpen(false)}
                  leading={<SocialAvatar profile={u} size={32} />}
                  title={u.display_name || "User"} subtitle={u.username ? `@${u.username}` : "Member"} />
              ))}
            </Section>


            <Section title="Folders" show={!!data?.folders.length}>
              {data?.folders.map((f) => (
                <Row key={f.id} to="/workspace" onNavigate={() => setOpen(false)}
                  leading={<Icon><FolderOpen className="h-4 w-4" /></Icon>} title={f.name} subtitle="Workspace folder" />
              ))}
            </Section>

            <Section title="Notes" show={!!data?.notes.length}>
              {data?.notes.map((n) => (
                <Row key={n.id} to="/workspace" onNavigate={() => setOpen(false)}
                  leading={<Icon><FileText className="h-4 w-4" /></Icon>} title={n.title || "Untitled note"} subtitle="Note" />
              ))}
            </Section>

            <Section title="Files" show={!!data?.files.length}>
              {data?.files.map((f) => (
                <Row key={f.id} to="/workspace" onNavigate={() => setOpen(false)}
                  leading={<Icon><File className="h-4 w-4" /></Icon>} title={f.name} subtitle="File" />
              ))}
            </Section>

            <Section title="WebuWeb" show={platform.length > 0}>
              {platform.map((p) => (
                <Row key={p.id} to={p.to} onNavigate={() => setOpen(false)}
                  leading={<Icon>{p.id === "pro" ? <Crown className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}</Icon>}
                  title={p.title} subtitle={p.desc} />
              ))}
            </Section>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Icon({ children }: { children: React.ReactNode }) {
  return <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent/70 text-muted-foreground">{children}</span>;
}

function Section({ title, show, children }: { title: string; show: boolean; children: React.ReactNode }) {
  if (!show) return null;
  return (
    <div className="mb-1">
      <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}

function Row({
  to, params, leading, title, subtitle, onNavigate,
}: {
  to: string; params?: Record<string, string>; leading: React.ReactNode;
  title: string; subtitle: string; onNavigate: () => void;
}) {
  return (
    <Link
      to={to} params={params as never} onClick={onNavigate}
      className="flex items-center gap-3 rounded-xl px-3 py-2 transition hover:bg-accent/60"
    >
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
      </span>
    </Link>
  );
}

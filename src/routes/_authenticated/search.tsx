import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/use-subscription";
import { SocialAvatar } from "@/components/social-avatar";
import {
  Search as SearchIcon, X, Users, User, Music as MusicIcon, FileText,
  FolderOpen, MessageCircle, Loader2, Clock, Play,
} from "lucide-react";
import { useMusicPlayer, type Song } from "@/components/music-player-provider";

export const Route = createFileRoute("/_authenticated/search")({
  component: SearchPage,
});

type Category = "all" | "users" | "groups" | "music" | "notes" | "files" | "messages";

interface Results {
  users: Array<{ id: string; display_name: string | null; username: string | null; avatar_url: string | null; bio: string | null }>;
  groups: Array<{ id: string; name: string; description: string | null; avatar_url: string | null; is_public: boolean | null }>;
  music: Song[];
  notes: Array<{ id: string; title: string; content: string | null; updated_at: string }>;
  files: Array<{ id: string; name: string; storage_path: string; mime_type: string; size: number }>;
  messages: Array<{ id: string; kind: "dm" | "group" | "global"; content: string; created_at: string; contextId?: string; contextName?: string }>;
}

function SearchPage() {
  const { user } = Route.useRouteContext();
  const { data: sub } = useSubscription(user.id);
  const qc = useQueryClient();
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("all");
  const player = useMusicPlayer();

  const { data: recentRows = [] } = useQuery({
    queryKey: ["recent-searches", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("recent_searches")
        .select("id, query, created_at").eq("user_id", user.id)
        .order("created_at", { ascending: false }).limit(10);
      return data ?? [];
    },
  });

  const { data: suggestionSeed = [] } = useQuery({
    queryKey: ["search-suggestions", user.id],
    queryFn: async () => {
      const [groupsRes, songsRes] = await Promise.all([
        supabase.from("groups").select("name").eq("is_public", true).order("updated_at", { ascending: false }).limit(4),
        supabase.from("songs").select("title, artist").order("created_at", { ascending: false }).limit(4),
      ]);
      const g = (groupsRes.data ?? []).map((r) => r.name);
      const s = (songsRes.data ?? []).map((r) => `${r.title}`);
      return [...g, ...s].slice(0, 8);
    },
  });

  const submit = async (raw?: string) => {
    const q = (raw ?? input).trim();
    if (!q) return;
    setQuery(q);
    setInput(q);
    await supabase.from("recent_searches").insert({ user_id: user.id, query: q });
    qc.invalidateQueries({ queryKey: ["recent-searches", user.id] });
  };

  const clearRecent = async (id?: string) => {
    if (id) await supabase.from("recent_searches").delete().eq("id", id);
    else await supabase.from("recent_searches").delete().eq("user_id", user.id);
    qc.invalidateQueries({ queryKey: ["recent-searches", user.id] });
  };

  const { data: results, isFetching } = useQuery({
    queryKey: ["search-results", query, sub?.musicPackUnlocked, user.id],
    enabled: !!query,
    queryFn: async (): Promise<Results> => {
      const q = query;
      const like = `%${q}%`;

      const [usersRes, groupsRes, songsRes, notesRes, filesRes, dmSentRes, dmRecvRes, gmsgRes, globalRes] = await Promise.all([
        supabase.from("profiles").select("id, display_name, username, avatar_url, bio")
          .or(`display_name.ilike.${like},username.ilike.${like},bio.ilike.${like}`).limit(20),
        supabase.from("groups").select("id, name, description, avatar_url, is_public")
          .or(`name.ilike.${like},description.ilike.${like}`).limit(20),
        sub?.musicPackUnlocked
          ? supabase.from("songs").select("*").or(`title.ilike.${like},artist.ilike.${like},album.ilike.${like}`).limit(20)
          : Promise.resolve({ data: [] }),
        supabase.from("notes").select("id, title, content, updated_at")
          .eq("user_id", user.id).or(`title.ilike.${like},content.ilike.${like}`).limit(20),
        supabase.from("workspace_files").select("id, name, storage_path, mime_type, size")
          .eq("user_id", user.id).ilike("name", like).limit(20),
        supabase.from("direct_messages").select("id, content, created_at, recipient_id, sender_id")
          .eq("sender_id", user.id).ilike("content", like).order("created_at", { ascending: false }).limit(20),
        supabase.from("direct_messages").select("id, content, created_at, recipient_id, sender_id")
          .eq("recipient_id", user.id).ilike("content", like).order("created_at", { ascending: false }).limit(20),
        supabase.from("group_messages").select("id, content, created_at, group_id, groups(name)")
          .ilike("content", like).order("created_at", { ascending: false }).limit(20),
        supabase.from("chat_messages").select("id, content, created_at, user_id")
          .ilike("content", like).order("created_at", { ascending: false }).limit(20),
      ]);

      const dmRows = [...(dmSentRes.data ?? []), ...(dmRecvRes.data ?? [])];
      const messages: Results["messages"] = [
        ...dmRows.map((r: { id: string; content: string | null; created_at: string; recipient_id: string; sender_id: string }) => ({
          id: r.id, kind: "dm" as const, content: r.content ?? "",
          created_at: r.created_at,
          contextId: r.sender_id === user.id ? r.recipient_id : r.sender_id,
        })),
        ...((gmsgRes.data ?? []) as Array<{ id: string; content: string | null; created_at: string; group_id: string; groups: { name: string } | null }>).map((r) => ({
          id: r.id, kind: "group" as const, content: r.content ?? "",
          created_at: r.created_at, contextId: r.group_id, contextName: r.groups?.name,
        })),
        ...(globalRes.data ?? []).map((r: { id: string; content: string | null; created_at: string }) => ({
          id: r.id, kind: "global" as const, content: r.content ?? "", created_at: r.created_at,
        })),
      ].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 30);

      return {
        users: usersRes.data ?? [],
        groups: groupsRes.data ?? [],
        music: (songsRes.data ?? []) as Song[],
        notes: notesRes.data ?? [],
        files: filesRes.data ?? [],
        messages,
      };
    },
  });

  const counts = useMemo(() => ({
    users: results?.users.length ?? 0,
    groups: results?.groups.length ?? 0,
    music: results?.music.length ?? 0,
    notes: results?.notes.length ?? 0,
    files: results?.files.length ?? 0,
    messages: results?.messages.length ?? 0,
  }), [results]);
  const totalCount = counts.users + counts.groups + counts.music + counts.notes + counts.files + counts.messages;

  const CATS: { id: Category; label: string; icon: React.ComponentType<{ className?: string }>; count?: number }[] = [
    { id: "all", label: "All", icon: SearchIcon, count: totalCount },
    { id: "users", label: "People", icon: User, count: counts.users },
    { id: "groups", label: "Groups", icon: Users, count: counts.groups },
    { id: "music", label: "Music", icon: MusicIcon, count: counts.music },
    { id: "notes", label: "Notes", icon: FileText, count: counts.notes },
    { id: "files", label: "Files", icon: FolderOpen, count: counts.files },
    { id: "messages", label: "Messages", icon: MessageCircle, count: counts.messages },
  ];

  return (
    <div className="min-h-screen p-6 lg:p-10">
      <div className="max-w-5xl mx-auto">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary-glow/5 to-transparent rounded-3xl pointer-events-none" />
          <div className="relative">
            <h1 className="text-3xl lg:text-4xl font-bold tracking-tight">Search</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Find people, groups, music, notes, files, and messages across TRECK HUB.
            </p>

            <form
              onSubmit={(e) => { e.preventDefault(); void submit(); }}
              className="mt-6 glass rounded-2xl flex items-center gap-2 px-4 py-3 shadow-[var(--shadow-glow)] border border-border/60"
            >
              <SearchIcon className="h-5 w-5 text-muted-foreground" />
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Search TRECK HUB…"
                className="flex-1 bg-transparent outline-none text-base"
                autoFocus
              />
              {input && (
                <button type="button" onClick={() => { setInput(""); setQuery(""); }}
                  className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground" aria-label="Clear">
                  <X className="h-4 w-4" />
                </button>
              )}
              <button type="submit"
                className="rounded-xl bg-primary text-primary-foreground px-4 py-1.5 text-sm font-semibold hover:opacity-90 shadow-[var(--shadow-glow)]">
                Search
              </button>
            </form>
          </div>
        </div>

        {!query && (
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <section className="glass rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold flex items-center gap-2"><Clock className="h-4 w-4" /> Recent</h2>
                {recentRows.length > 0 && (
                  <button onClick={() => clearRecent()} className="text-xs text-muted-foreground hover:text-destructive">Clear all</button>
                )}
              </div>
              {recentRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing yet. Try searching for a friend or a song.</p>
              ) : (
                <ul className="space-y-1">
                  {recentRows.map((r) => (
                    <li key={r.id} className="flex items-center gap-2 group">
                      <button onClick={() => submit(r.query)}
                        className="flex-1 text-left px-3 py-2 rounded-xl hover:bg-accent/40 text-sm transition">
                        {r.query}
                      </button>
                      <button onClick={() => clearRecent(r.id)}
                        className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-accent transition">
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="glass rounded-2xl p-5">
              <h2 className="font-semibold mb-3">Suggestions</h2>
              {suggestionSeed.length === 0 ? (
                <p className="text-sm text-muted-foreground">No suggestions right now.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {suggestionSeed.map((s) => (
                    <button key={s} onClick={() => submit(s)}
                      className="rounded-full border border-border/60 px-3 py-1.5 text-xs hover:bg-accent/60 transition">
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {query && (
          <div className="mt-6">
            <div className="flex items-center gap-2 flex-wrap mb-6 overflow-x-auto pb-1">
              {CATS.map((c) => {
                const active = category === c.id;
                return (
                  <button key={c.id} onClick={() => setCategory(c.id)}
                    className={`relative inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition ${
                      active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}>
                    {active && (
                      <motion.div layoutId="search-cat"
                        className="absolute inset-0 rounded-full bg-gradient-to-r from-primary to-primary-glow shadow-[var(--shadow-glow)]"
                        transition={{ type: "spring", stiffness: 400, damping: 30 }} />
                    )}
                    <c.icon className="relative h-3.5 w-3.5" />
                    <span className="relative">{c.label}</span>
                    {typeof c.count === "number" && (
                      <span className={`relative text-[10px] rounded-full px-1.5 py-0.5 ${active ? "bg-white/25" : "bg-accent"}`}>{c.count}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {isFetching && !results ? (
              <div className="glass rounded-2xl p-10 grid place-items-center">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : results && totalCount === 0 ? (
              <div className="glass rounded-2xl p-10 text-center">
                <SearchIcon className="h-8 w-8 text-muted-foreground mx-auto" />
                <p className="mt-3 font-medium">No results for “{query}”</p>
                <p className="text-sm text-muted-foreground mt-1">Try a shorter query or a different word.</p>
              </div>
            ) : results ? (
              <AnimatePresence mode="popLayout">
                <motion.div key={category} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                  {(category === "all" || category === "users") && counts.users > 0 && (
                    <ResultSection title="People" icon={User}>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {results.users.slice(0, category === "all" ? 4 : 20).map((u) => (
                          <Link key={u.id} to="/messages/$userId" params={{ userId: u.id }}
                            className="glass rounded-2xl p-3 flex items-center gap-3 hover:bg-accent/40 transition">
                            <SocialAvatar profile={u} size={44} />
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-sm truncate">{u.display_name || "Unnamed"}</div>
                              <div className="text-xs text-muted-foreground truncate">@{u.username}</div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </ResultSection>
                  )}

                  {(category === "all" || category === "groups") && counts.groups > 0 && (
                    <ResultSection title="Groups" icon={Users}>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {results.groups.slice(0, category === "all" ? 4 : 20).map((g) => (
                          <Link key={g.id} to="/groups/$groupId" params={{ groupId: g.id }}
                            className="glass rounded-2xl p-3 flex items-center gap-3 hover:bg-accent/40 transition">
                            <div className="h-11 w-11 shrink-0 rounded-xl bg-gradient-to-br from-primary/40 to-primary-glow/40 grid place-items-center text-primary-foreground overflow-hidden">
                              {g.avatar_url ? <img src={g.avatar_url} alt="" className="h-full w-full object-cover" /> : <Users className="h-5 w-5" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-sm truncate">{g.name}</div>
                              <div className="text-xs text-muted-foreground truncate">{g.description || (g.is_public ? "Public group" : "Private group")}</div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </ResultSection>
                  )}

                  {(category === "all" || category === "music") && counts.music > 0 && (
                    <ResultSection title="Music" icon={MusicIcon}>
                      <div className="glass rounded-2xl overflow-hidden">
                        {results.music.slice(0, category === "all" ? 4 : 20).map((s) => (
                          <div key={s.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-border/40 last:border-0 hover:bg-accent/30 transition">
                            <button onClick={() => player.play(s, results.music)}
                              className="h-9 w-9 rounded-lg bg-gradient-to-br from-fuchsia-500 to-primary grid place-items-center text-white hover:opacity-90">
                              <Play className="h-4 w-4" />
                            </button>
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-sm truncate">{s.title}</div>
                              <div className="text-xs text-muted-foreground truncate">{s.artist}{s.album ? ` · ${s.album}` : ""}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ResultSection>
                  )}

                  {(category === "all" || category === "notes") && counts.notes > 0 && (
                    <ResultSection title="Notes" icon={FileText}>
                      <div className="grid gap-2">
                        {results.notes.slice(0, category === "all" ? 4 : 20).map((n) => (
                          <Link key={n.id} to="/workspace"
                            className="glass rounded-2xl p-3 hover:bg-accent/40 transition block">
                            <div className="font-medium text-sm truncate">{n.title || "Untitled note"}</div>
                            {n.content && (
                              <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                {highlight(n.content, query)}
                              </div>
                            )}
                          </Link>
                        ))}
                      </div>
                    </ResultSection>
                  )}

                  {(category === "all" || category === "files") && counts.files > 0 && (
                    <ResultSection title="Files" icon={FolderOpen}>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {results.files.slice(0, category === "all" ? 4 : 20).map((f) => (
                          <Link key={f.id} to="/workspace"
                            className="glass rounded-2xl p-3 flex items-center gap-3 hover:bg-accent/40 transition">
                            <div className="h-10 w-10 shrink-0 rounded-xl bg-accent grid place-items-center text-muted-foreground">
                              <FileText className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-sm truncate">{f.name}</div>
                              <div className="text-xs text-muted-foreground truncate">
                                {(f.size / 1024).toFixed(1)} KB · {f.mime_type}
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </ResultSection>
                  )}

                  {(category === "all" || category === "messages") && counts.messages > 0 && (
                    <ResultSection title="Messages" icon={MessageCircle}>
                      <div className="glass rounded-2xl overflow-hidden">
                        {results.messages.slice(0, category === "all" ? 5 : 30).map((m) => {
                          const to = m.kind === "dm" ? `/messages/${m.contextId}` : m.kind === "group" ? `/groups/${m.contextId}` : "/chat";
                          return (
                            <Link key={`${m.kind}-${m.id}`} to={to}
                              className="block px-4 py-3 border-b border-border/40 last:border-0 hover:bg-accent/30 transition">
                              <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
                                <span className={m.kind === "dm" ? "text-primary" : m.kind === "group" ? "text-fuchsia-500" : "text-emerald-500"}>
                                  {m.kind === "dm" ? "Direct" : m.kind === "group" ? `Group${m.contextName ? ` · ${m.contextName}` : ""}` : "Global"}
                                </span>
                                <span>· {new Date(m.created_at).toLocaleDateString()}</span>
                              </div>
                              <div className="text-sm line-clamp-2">{highlight(m.content, query)}</div>
                            </Link>
                          );
                        })}
                      </div>
                    </ResultSection>
                  )}
                </motion.div>
              </AnimatePresence>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function ResultSection({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
        <Icon className="h-3.5 w-3.5" /> {title}
      </h3>
      {children}
    </section>
  );
}

function highlight(text: string, q: string) {
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-primary/20 text-foreground rounded px-0.5">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

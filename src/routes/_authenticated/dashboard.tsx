import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Bot, MessageCircle, FolderOpen, Music, Sparkles, TrendingUp, Users, Crown, Zap, Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/use-subscription";
import { useDailyAiUsage } from "@/hooks/use-daily-ai-usage";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

const QUOTES = [
  "The expert in anything was once a beginner.",
  "Small progress each day adds up to big results.",
  "You don't have to be great to start, but you have to start to be great.",
  "Discipline is choosing between what you want now and what you want most.",
  "Focus on being productive instead of busy.",
];

function Dashboard() {
  const { user } = Route.useRouteContext();
  const quote = QUOTES[new Date().getDate() % QUOTES.length];
  const { data: sub } = useSubscription(user.id);
  const { used, limit } = useDailyAiUsage(user.id, !!sub?.isPro);

  const { data: stats } = useQuery({
    queryKey: ["stats", user.id],
    queryFn: async () => {
      const [threads, notes, folders, friends, likes] = await Promise.all([
        supabase.from("ai_threads").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("notes").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("folders").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("friendships").select("id", { count: "exact", head: true }).eq("status", "accepted").or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`),
        supabase.from("song_likes").select("song_id", { count: "exact", head: true }).eq("user_id", user.id),
      ]);
      return {
        threads: threads.count || 0,
        notes: notes.count || 0,
        folders: folders.count || 0,
        friends: friends.count || 0,
        likes: likes.count || 0,
      };
    },
  });

  const { data: recent } = useQuery({
    queryKey: ["recent-threads", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_threads").select("id,title,updated_at")
        .eq("user_id", user.id).order("updated_at", { ascending: false }).limit(4);
      return data ?? [];
    },
  });

  const displayName = user.user_metadata?.full_name || user.email?.split("@")[0] || "there";

  return (
    <div className="relative min-h-full">
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-fuchsia-500/20 blur-3xl" />
      </div>

      <div className="relative p-6 lg:p-10 max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Welcome back</div>
              <h1 className="text-3xl lg:text-4xl font-bold tracking-tight mt-1">
                Hi {displayName} <span className="gradient-text">👋</span>
              </h1>
              <p className="mt-2 text-sm text-muted-foreground max-w-lg">
                Everything you need to think, chat, and study — in one calm place.
              </p>
            </div>
            {!sub?.isPro && (
              <Link to="/membership" className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500 to-primary px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-glow)] hover:opacity-90">
                <Crown className="h-4 w-4" /> Go PRO
              </Link>
            )}
          </div>
        </motion.div>

        {/* Quick actions */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { to: "/ai", label: "Ask AI", desc: "Start a new chat", icon: Bot, gradient: "from-violet-500 to-fuchsia-500" },
            { to: "/chat", label: "Chat", desc: "Talk with friends & the community", icon: MessageCircle, gradient: "from-sky-500 to-cyan-400" },
            { to: "/workspace", label: "Workspace", desc: "Notes & files", icon: FolderOpen, gradient: "from-emerald-500 to-teal-400" },
            { to: "/music", label: "Music", desc: "Focus soundtrack", icon: Music, gradient: "from-fuchsia-500 to-primary" },
          ].map((q, i) => (
            <motion.div key={q.to} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Link to={q.to} className="group block glass rounded-2xl p-5 hover:shadow-[var(--shadow-glow)] transition hover:-translate-y-0.5">
                <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${q.gradient} grid place-items-center text-white shadow-lg`}>
                  <q.icon className="h-5 w-5" />
                </div>
                <div className="mt-4 font-semibold">{q.label}</div>
                <div className="text-xs text-muted-foreground">{q.desc}</div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Stats + AI usage + Quote */}
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "AI chats", value: stats?.threads ?? 0, icon: Bot },
              { label: "Notes", value: stats?.notes ?? 0, icon: FolderOpen },
              { label: "Friends", value: stats?.friends ?? 0, icon: Users },
              { label: "Liked songs", value: stats?.likes ?? 0, icon: Heart },
            ].map((s) => (
              <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="glass rounded-2xl p-5 hover:shadow-[var(--shadow-glow)] transition">
                <s.icon className="h-4 w-4 text-primary" />
                <div className="mt-2 text-3xl font-bold tabular-nums">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </motion.div>
            ))}
          </div>

          <div className="glass rounded-2xl p-5 flex flex-col gap-4">
            <div>
              <div className="flex items-center gap-2 text-primary">
                <Zap className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-wider">AI today</span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <div className="text-2xl font-bold tabular-nums">{used}</div>
                <div className="text-xs text-muted-foreground">/ {limit} prompts</div>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-gradient-to-r from-primary to-primary-glow transition-all" style={{ width: `${Math.min(100, (used / limit) * 100)}%` }} />
              </div>
            </div>
            <div className="pt-3 border-t border-border/60">
              <div className="flex items-center gap-2 text-primary">
                <Sparkles className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-wider">Daily thought</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed">"{quote}"</p>
            </div>
          </div>
        </div>

        {/* Recent activity */}
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Recent AI conversations</h2>
              <Link to="/ai" className="text-xs text-primary hover:underline">View all</Link>
            </div>
            {recent && recent.length ? (
              <ul className="divide-y divide-border/60">
                {recent.map((t) => (
                  <li key={t.id}>
                    <Link to="/ai/$threadId" params={{ threadId: t.id }} className="flex items-center justify-between py-3 hover:bg-accent/40 rounded-lg px-2 -mx-2 transition">
                      <span className="text-sm truncate">{t.title}</span>
                      <span className="text-xs text-muted-foreground shrink-0 ml-3">{new Date(t.updated_at).toLocaleDateString()}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No conversations yet. <Link to="/ai" className="text-primary hover:underline">Start one</Link>.</p>
            )}
          </div>

          <div className="glass rounded-2xl p-5 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/10 via-primary/5 to-transparent pointer-events-none" />
            <div className="relative">
              <div className="flex items-center gap-2 text-primary">
                <Music className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-wider">Focus music</span>
              </div>
              <p className="mt-2 text-sm">
                {sub?.musicPackUnlocked
                  ? "Your Complete Music Pack is unlocked. Dive into the library."
                  : "Unlock the Complete Music Pack to focus with the full TRECK library."}
              </p>
              <Link to={sub?.musicPackUnlocked ? "/music" : "/membership"}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-primary px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-glow)] hover:opacity-90">
                <Music className="h-4 w-4" /> {sub?.musicPackUnlocked ? "Open Music" : "Unlock now"}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

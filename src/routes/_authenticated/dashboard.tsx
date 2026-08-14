import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Bot, MessageCircle, FolderOpen, Gamepad2, Sparkles, TrendingUp, Users, Crown, Zap, GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/use-subscription";
import { useDailyAiUsage } from "@/hooks/use-daily-ai-usage";
import { DashboardSearch } from "@/components/dashboard-search";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Home — WebuWeb" },
      { name: "description", content: "Your WebuWeb home: search everything, jump into AI, chat, workspace, study and games." },
      { property: "og:title", content: "Home — WebuWeb" },
      { property: "og:description", content: "Your WebuWeb home: search everything, jump into AI, chat, workspace, study and games." },
    ],
  }),
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
      const [threads, notes, folders, friends] = await Promise.all([
        supabase.from("ai_threads").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("notes").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("folders").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("friendships").select("id", { count: "exact", head: true }).eq("status", "accepted").or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`),
      ]);
      return {
        threads: threads.count || 0,
        notes: notes.count || 0,
        folders: folders.count || 0,
        friends: friends.count || 0,
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
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute -bottom-40 -left-32 h-96 w-96 rounded-full bg-primary-glow/10 blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-6xl p-6 lg:p-10">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <div className="text-sm text-muted-foreground">Welcome back</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight lg:text-4xl">Hi {displayName}</h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="mt-7"
        >
          <DashboardSearch userId={user.id} />
        </motion.div>

        {!sub?.isPro && (
          <div className="mt-6 flex justify-center">
            <Link to="/membership" className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/50 px-4 py-2 text-sm font-medium transition hover:bg-accent/60">
              <Crown className="h-4 w-4 text-primary" /> Discover WebuWeb PRO
            </Link>
          </div>
        )}

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { to: "/ai", label: "AI Assistant", desc: "Ask anything", icon: Bot },
            { to: "/chat", label: "Chat", desc: "Friends & groups", icon: MessageCircle },
            { to: "/workspace", label: "Workspace", desc: "Notes & files", icon: FolderOpen },
            { to: "/games", label: "Games", desc: "Play & compete", icon: Gamepad2 },
          ].map((q, i) => (
            <motion.div key={q.to} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 + i * 0.04 }}>
              <Link to={q.to} className="group glass block rounded-2xl border border-border/50 p-5 transition hover:-translate-y-0.5 hover:border-primary/30">
                <div className="grid h-10 w-10 place-items-center rounded-xl border border-border/60 bg-accent/50 text-primary">
                  <q.icon className="h-5 w-5" />
                </div>
                <div className="mt-4 font-medium">{q.label}</div>
                <div className="text-xs text-muted-foreground">{q.desc}</div>
              </Link>
            </motion.div>
          ))}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:col-span-2">
            {[
              { label: "AI chats", value: stats?.threads ?? 0, icon: Bot },
              { label: "Notes", value: stats?.notes ?? 0, icon: FileIconAlias },
              { label: "Folders", value: stats?.folders ?? 0, icon: FolderOpen },
              { label: "Friends", value: stats?.friends ?? 0, icon: Users },
            ].map((s) => (
              <div key={s.label} className="glass rounded-2xl border border-border/50 p-5">
                <s.icon className="h-4 w-4 text-muted-foreground" />
                <div className="mt-2 text-3xl font-semibold tabular-nums">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="glass flex flex-col gap-4 rounded-2xl border border-border/50 p-5">
            <div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Zap className="h-4 w-4 text-primary" />
                <span className="text-[11px] font-semibold uppercase tracking-wider">AI today</span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <div className="text-2xl font-semibold tabular-nums">{used}</div>
                <div className="text-xs text-muted-foreground">/ {limit} prompts</div>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary transition-all" style={{ width: `${Math.min(100, (used / limit) * 100)}%` }} />
              </div>
            </div>
            <div className="border-t border-border/60 pt-3">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-[11px] font-semibold uppercase tracking-wider">Daily thought</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed">“{quote}”</p>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="glass rounded-2xl border border-border/50 p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-medium"><TrendingUp className="h-4 w-4 text-primary" /> Recent AI conversations</h2>
              <Link to="/ai" className="text-xs text-primary hover:underline">View all</Link>
            </div>
            {recent && recent.length ? (
              <ul className="divide-y divide-border/60">
                {recent.map((t) => (
                  <li key={t.id}>
                    <Link to="/ai/$threadId" params={{ threadId: t.id }} className="-mx-2 flex items-center justify-between rounded-lg px-2 py-3 transition hover:bg-accent/40">
                      <span className="truncate text-sm">{t.title}</span>
                      <span className="ml-3 shrink-0 text-xs text-muted-foreground">{new Date(t.updated_at).toLocaleDateString()}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No conversations yet. <Link to="/ai" className="text-primary hover:underline">Start one</Link>.</p>
            )}
          </div>

          <div className="glass rounded-2xl border border-border/50 p-5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <GraduationCap className="h-4 w-4 text-primary" />
              <span className="text-[11px] font-semibold uppercase tracking-wider">Study</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Build flashcards, notes and quizzes for every subject, and keep them next to your workspace files.
            </p>
            <Link to="/study" className="mt-4 inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/50 px-4 py-2 text-sm font-medium transition hover:bg-accent/60">
              <GraduationCap className="h-4 w-4" /> Open Study
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function FileIconAlias({ className }: { className?: string }) {
  return <FolderOpen className={className} />;
}

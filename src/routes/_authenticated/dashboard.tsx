import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  Bot, MessageCircle, FolderOpen, Gamepad2, Crown, Zap, GraduationCap, Music, Settings, Users, Lock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/use-subscription";
import { useDailyAiUsage } from "@/hooks/use-daily-ai-usage";
import { DashboardSearch } from "@/components/dashboard-search";
import { AiCore, type CoreState } from "@/components/ai-core";
import { WebuVoice } from "@/components/webu-voice";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Command Centre — WebuWeb" },
      { name: "description", content: "Your WebuWeb command centre: talk to Webu, search everything and jump into AI, chat, workspace, study and games." },
      { property: "og:title", content: "Command Centre — WebuWeb" },
      { property: "og:description", content: "Your WebuWeb command centre: talk to Webu, search everything and jump into AI, chat, workspace, study and games." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const PANELS = [
  { to: "/ai", label: "AI Assistant", desc: "Ask anything", icon: Bot },
  { to: "/chat", label: "Chat", desc: "Friends & messages", icon: MessageCircle },
  { to: "/workspace", label: "Workspace", desc: "Notes & files", icon: FolderOpen },
  { to: "/study", label: "Study", desc: "Decks & quizzes", icon: GraduationCap },
  { to: "/games", label: "Games", desc: "Play & compete", icon: Gamepad2 },
  { to: "/music", label: "Music", desc: "Locked", icon: Music, locked: true },
  { to: "/membership", label: "Membership", desc: "Your plan", icon: Crown },
  { to: "/settings", label: "Settings", desc: "Preferences", icon: Settings },
] as const;

function Dashboard() {
  const { user } = Route.useRouteContext();
  const [coreState, setCoreState] = useState<CoreState>("idle");
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

  const displayName = user.user_metadata?.full_name || user.email?.split("@")[0] || "there";

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/3 h-[46rem] w-[46rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[160px]" />
        <div className="absolute -bottom-52 -left-40 h-[30rem] w-[30rem] rounded-full bg-primary-glow/10 blur-[140px]" />
        <div className="absolute inset-0 mesh-bg opacity-30" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-5 py-8 lg:px-10">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Command centre</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight lg:text-3xl">Hi {displayName}</h1>
          </div>
          {!sub?.isPro && (
            <Link to="/membership" className="hidden items-center gap-2 rounded-full border border-border/70 bg-background/40 px-4 py-2 text-sm font-medium backdrop-blur-xl transition hover:bg-accent/60 sm:inline-flex">
              <Crown className="h-4 w-4 text-primary" /> WebuWeb PRO
            </Link>
          )}
        </motion.div>

        <div className="mt-6 grid flex-1 items-center gap-8 lg:grid-cols-[1fr_minmax(0,26rem)_1fr]">
          <div className="order-2 grid gap-3 sm:grid-cols-2 lg:order-1 lg:grid-cols-1">
            {PANELS.slice(0, 4).map((p, i) => <Panel key={p.to} panel={p} delay={i * 0.05} />)}
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6 }}
            className="order-1 flex flex-col items-center gap-6 lg:order-2"
          >
            <AiCore state={coreState} className="h-64 w-64 lg:h-80 lg:w-80" />
            <WebuVoice onStateChange={setCoreState} />
            <div className="w-full max-w-md">
              <DashboardSearch userId={user.id} />
            </div>
          </motion.div>

          <div className="order-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {PANELS.slice(4).map((p, i) => <Panel key={p.to} panel={p} delay={i * 0.05} />)}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="mt-8 grid gap-3 rounded-3xl border border-border/50 bg-background/30 p-4 backdrop-blur-xl sm:grid-cols-3 lg:grid-cols-5"
        >
          {[
            { label: "AI chats", value: stats?.threads ?? 0, icon: Bot },
            { label: "Notes", value: stats?.notes ?? 0, icon: FolderOpen },
            { label: "Folders", value: stats?.folders ?? 0, icon: FolderOpen },
            { label: "Friends", value: stats?.friends ?? 0, icon: Users },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-3 rounded-2xl px-3 py-2">
              <s.icon className="h-4 w-4 text-primary" />
              <div>
                <div className="text-xl font-semibold tabular-nums leading-none">{s.value}</div>
                <div className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
              </div>
            </div>
          ))}
          <div className="rounded-2xl px-3 py-2">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Zap className="h-3.5 w-3.5 text-primary" /> AI today
            </div>
            <div className="mt-1 text-xl font-semibold tabular-nums leading-none">
              {used}<span className="text-xs font-normal text-muted-foreground"> / {limit}</span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-all" style={{ width: `${Math.min(100, (used / limit) * 100)}%` }} />
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function Panel({ panel, delay }: { panel: (typeof PANELS)[number]; delay: number }) {
  const locked = "locked" in panel && panel.locked;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + delay }}>
      <Link
        to={panel.to}
        className="group flex items-center gap-3 rounded-2xl border border-border/50 bg-background/30 p-4 backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-background/50"
      >
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border/60 bg-accent/40 text-primary">
          <panel.icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{panel.label}</div>
          <div className="truncate text-xs text-muted-foreground">{panel.desc}</div>
        </div>
        {locked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
      </Link>
    </motion.div>
  );
}

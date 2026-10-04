import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  Bot, MessageCircle, FolderOpen, Gamepad2, Crown, Zap, GraduationCap, Music, Settings, Users, Lock, Mic, Home, StickyNote, Folder,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/use-subscription";
import { useDailyAiUsage } from "@/hooks/use-daily-ai-usage";
import { DashboardSearch } from "@/components/dashboard-search";
import { AiCore, type CoreState } from "@/components/ai-core";
import { WebuVoice } from "@/components/webu-voice";
import { ProBadge } from "@/components/pro-badge";

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
  { to: "/ai", label: "AI Assistant", desc: "Ask, write and analyse with AI", icon: Bot },
  { to: "/chat", label: "Chat", desc: "Friends and private messages", icon: MessageCircle },
  { to: "/workspace", label: "Workspace", desc: "Your files, notes and folders", icon: FolderOpen },
  { to: "/study", label: "Study", desc: "Notes, flashcards and quizzes", icon: GraduationCap },
  { to: "/games", label: "Games", desc: "Chess, Snake, 2048 and more", icon: Gamepad2 },
  { to: "/music", label: "Music", desc: "Coming soon — locked", icon: Music, locked: true },
  { to: "/membership", label: "Membership", desc: "Your plan and benefits", icon: Crown },
  { to: "/settings", label: "Settings", desc: "Profile and preferences", icon: Settings },
] as const;

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good Morning" : h < 18 ? "Good Afternoon" : "Good Evening";
}

function Dashboard() {
  const { user } = Route.useRouteContext();
  const [coreState, setCoreState] = useState<CoreState>("idle");
  const { data: sub } = useSubscription(user.id);
  const { used, limit } = useDailyAiUsage(user.id, !!sub?.isPro);

  const { data: profile } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle()).data,
  });

  const { data: stats } = useQuery({
    queryKey: ["stats", user.id],
    queryFn: async () => {
      const [threads, notes, folders, friends] = await Promise.all([
        supabase.from("ai_threads").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("notes").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("folders").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("friendships").select("id", { count: "exact", head: true }).eq("status", "accepted").or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`),
      ]);
      return { threads: threads.count || 0, notes: notes.count || 0, folders: folders.count || 0, friends: friends.count || 0 };
    },
  });

  const displayName = profile?.display_name || user.user_metadata?.full_name || user.email?.split("@")[0] || "there";
  const initials = String(displayName).split(" ").map((s: string) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute left-1/2 top-[45%] h-[48rem] w-[48rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[160px]" />
        <div className="absolute -bottom-52 right-0 h-[30rem] w-[30rem] rounded-full bg-primary-glow/10 blur-[140px]" />
        <div className="absolute inset-0 opacity-[0.35] [background-image:radial-gradient(var(--color-border)_1px,transparent_1px)] [background-size:28px_28px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-10">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-3">
          <button onClick={() => window.dispatchEvent(new Event("webu:listen"))}
            className="group inline-flex items-center gap-2.5 rounded-full border border-primary/40 bg-primary/10 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-primary shadow-[var(--shadow-glow)] backdrop-blur-xl transition hover:bg-primary/20">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/20"><Mic className="h-3.5 w-3.5" /></span>
            Talk to Webu
          </button>
          <Link to="/settings" className="holo-panel flex items-center gap-3 rounded-full py-1.5 pl-1.5 pr-4 transition hover:border-primary/40">
            <div className="grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-primary to-primary-glow text-[11px] font-bold text-primary-foreground">
              {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : initials}
            </div>
            <div className="hidden text-left sm:block">
              <div className="flex items-center gap-1.5 text-sm font-medium leading-tight">{displayName}{sub?.isPro && <ProBadge />}</div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-success" /> Online</div>
            </div>
          </Link>
        </div>

        {/* Greeting */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mt-6 text-center">
          <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-primary">{greeting()}, {displayName}</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">Welcome to <span className="gradient-text">WebuWeb</span></h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">How can I assist you today?</p>
        </motion.div>

        {/* Core + panels */}
        <div className="mt-6 grid flex-1 items-center gap-6 lg:grid-cols-[1fr_minmax(0,26rem)_1fr] lg:gap-10">
          <div className="order-2 grid grid-cols-2 gap-3 lg:order-1 lg:grid-cols-1">
            {PANELS.slice(0, 4).map((p, i) => <Panel key={p.to} panel={p} delay={i * 0.06} side="left" />)}
          </div>
          <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7 }}
            className="order-1 flex flex-col items-center gap-5 lg:order-2">
            <AiCore state={coreState} className="h-56 w-56 sm:h-72 sm:w-72 lg:h-[22rem] lg:w-[22rem]" />
            <WebuVoice onStateChange={setCoreState} />
          </motion.div>
          <div className="order-3 grid grid-cols-2 gap-3 lg:grid-cols-1">
            {PANELS.slice(4).map((p, i) => <Panel key={p.to} panel={p} delay={i * 0.06} side="right" />)}
          </div>
        </div>

        {/* Search */}
        <div className="mx-auto mt-6 w-full max-w-2xl"><DashboardSearch userId={user.id} /></div>

        {/* Activity + quick nav */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto]">
          <div className="holo-panel grid grid-cols-2 gap-1 rounded-2xl p-3 sm:grid-cols-5">
            {[
              { label: "AI chats", value: stats?.threads ?? 0, icon: Bot },
              { label: "Notes", value: stats?.notes ?? 0, icon: StickyNote },
              { label: "Folders", value: stats?.folders ?? 0, icon: Folder },
              { label: "Friends", value: stats?.friends ?? 0, icon: Users },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-3 rounded-xl px-3 py-2">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary"><s.icon className="h-4 w-4" /></div>
                <div>
                  <div className="text-lg font-semibold tabular-nums leading-none">{s.value}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
                </div>
              </div>
            ))}
            <div className="col-span-2 rounded-xl px-3 py-2 sm:col-span-1">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"><Zap className="h-3.5 w-3.5 text-primary" /> AI today</div>
              <div className="mt-1 text-lg font-semibold tabular-nums leading-none">{used}<span className="text-xs font-normal text-muted-foreground"> / {limit}</span></div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-gradient-to-r from-primary to-primary-glow transition-all" style={{ width: `${Math.min(100, (used / Math.max(1, limit)) * 100)}%` }} />
              </div>
            </div>
          </div>
          <nav aria-label="Quick navigation" className="holo-panel hidden items-center gap-1 rounded-2xl p-2 md:flex">
            {[{ to: "/dashboard", icon: Home, label: "Home" }, ...PANELS.slice(0, 5)].map((p) => (
              <Link key={p.to} to={p.to} title={p.label} className="grid h-10 w-10 place-items-center rounded-xl text-muted-foreground transition hover:bg-primary/10 hover:text-primary">
                <p.icon className="h-4 w-4" />
              </Link>
            ))}
          </nav>
        </motion.div>
      </div>
    </div>
  );
}

function Panel({ panel, delay, side }: { panel: (typeof PANELS)[number]; delay: number; side: "left" | "right" }) {
  const locked = "locked" in panel && panel.locked;
  return (
    <motion.div initial={{ opacity: 0, x: side === "left" ? -14 : 14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + delay }} className="relative">
      <span aria-hidden className={`absolute top-1/2 hidden h-px w-10 bg-gradient-to-r lg:block ${side === "left" ? "-right-10 from-primary/40 to-transparent" : "-left-10 from-transparent to-primary/40"}`} />
      <Link to={panel.to}
        className="holo-panel group flex items-center gap-3 rounded-2xl p-3 transition duration-300 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-[var(--shadow-glow)] sm:p-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-primary/25 bg-primary/10 text-primary transition group-hover:bg-primary/20">
          <panel.icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{panel.label}</div>
          <div className="hidden truncate text-xs text-muted-foreground sm:block">{panel.desc}</div>
        </div>
        {locked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
      </Link>
    </motion.div>
  );
}

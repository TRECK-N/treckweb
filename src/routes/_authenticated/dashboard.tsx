import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Bot, MessageCircle, FolderOpen, ShoppingBag, Sparkles, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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

  const { data: stats } = useQuery({
    queryKey: ["stats", user.id],
    queryFn: async () => {
      const [threads, notes, folders, orders] = await Promise.all([
        supabase.from("ai_threads").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("notes").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("folders").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      ]);
      return {
        threads: threads.count || 0,
        notes: notes.count || 0,
        folders: folders.count || 0,
        orders: orders.count || 0,
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
    <div className="p-6 lg:p-10 max-w-6xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="text-sm text-muted-foreground">Welcome back</div>
        <h1 className="text-3xl lg:text-4xl font-bold tracking-tight mt-1">
          Hi {displayName} <span className="gradient-text">👋</span>
        </h1>
      </motion.div>

      {/* Quick actions */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { to: "/ai", label: "Ask AI", desc: "Start a new chat", icon: Bot, gradient: "from-violet-500 to-fuchsia-500" },
          { to: "/chat", label: "Global Chat", desc: "Talk to everyone", icon: MessageCircle, gradient: "from-sky-500 to-cyan-400" },
          { to: "/workspace", label: "Workspace", desc: "Notes & files", icon: FolderOpen, gradient: "from-emerald-500 to-teal-400" },
          { to: "/store", label: "Store", desc: "Browse products", icon: ShoppingBag, gradient: "from-amber-500 to-orange-400" },
        ].map((q, i) => (
          <motion.div key={q.to} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Link to={q.to} className="group block glass rounded-2xl p-5 hover:shadow-[var(--shadow-glow)] transition">
              <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${q.gradient} grid place-items-center text-white shadow-lg`}>
                <q.icon className="h-5 w-5" />
              </div>
              <div className="mt-4 font-semibold">{q.label}</div>
              <div className="text-xs text-muted-foreground">{q.desc}</div>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Stats + Recent */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "AI chats", value: stats?.threads ?? 0 },
            { label: "Notes", value: stats?.notes ?? 0 },
            { label: "Folders", value: stats?.folders ?? 0 },
            { label: "Orders", value: stats?.orders ?? 0 },
          ].map((s) => (
            <div key={s.label} className="glass rounded-2xl p-5">
              <TrendingUp className="h-4 w-4 text-primary" />
              <div className="mt-2 text-3xl font-bold">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-wider">Daily motivation</span>
          </div>
          <p className="mt-3 text-sm leading-relaxed">"{quote}"</p>
        </div>
      </div>

      {/* Recent activity */}
      <div className="mt-6 glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Recent AI conversations</h2>
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
    </div>
  );
}

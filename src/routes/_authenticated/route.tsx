import { createFileRoute, Outlet, redirect, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home, Bot, MessageCircle, FolderOpen, Settings, LogOut, Sun, Moon, Crown, Mic, X,
  Music, Gamepad2, Lock, GraduationCap,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/components/theme-provider";
import { useSubscription } from "@/hooks/use-subscription";
import { ProBadge } from "@/components/pro-badge";
import { MusicPlayerProvider } from "@/components/music-player-provider";
import { MiniPlayer } from "@/components/mini-player";
import { shouldDropSession, clearSessionPersistence } from "@/lib/session-persistence";
import logoAsset from "@/assets/webuweb-mark.png.asset.json";
import { toast } from "sonner";
import { WebuVoice } from "@/components/webu-voice";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    if (shouldDropSession()) {
      clearSessionPersistence();
      await supabase.auth.signOut();
      throw redirect({ to: "/auth" });
    }
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthLayout,
});

const NAV = [
  { to: "/dashboard", labelKey: "nav.home", label: "Home", icon: Home },
  { to: "/ai", labelKey: "nav.ai", label: "AI Assistant", icon: Bot },
  { to: "/chat", labelKey: "nav.chat", label: "Chat", icon: MessageCircle },
  { to: "/workspace", labelKey: "nav.workspace", label: "Workspace", icon: FolderOpen },
  { to: "/study", labelKey: "nav.study", label: "Study", icon: GraduationCap },
  { to: "/games", labelKey: "nav.games", label: "Games", icon: Gamepad2 },
  { to: "/music", labelKey: "nav.music", label: "Music", icon: Music, locked: true },
  { to: "/membership", labelKey: "nav.membership", label: "Membership", icon: Crown },
  { to: "/settings", labelKey: "nav.settings", label: "Settings", icon: Settings },
] as const;


function AuthLayout() {
  const { user } = Route.useRouteContext();
  const [voiceOpen, setVoiceOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { theme, toggle } = useTheme();
  const { t } = useI18n();

  const { data: profile } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      return data;
    },
  });
  const { data: sub } = useSubscription(user.id);

  useEffect(() => { setVoiceOpen(false); }, [pathname]);

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  };

  const displayName = profile?.display_name || user.email?.split("@")[0] || "You";
  const initials = displayName.split(" ").map((s: string) => s[0]).slice(0, 2).join("").toUpperCase();
  const isHome = pathname === "/dashboard";
  const isActive = (to: string) =>
    to === "/chat" ? pathname.startsWith("/chat") || pathname.startsWith("/messages")
      : to === "/dashboard" ? isHome : pathname.startsWith(to);

  return (
    <MusicPlayerProvider>
      <div className="relative min-h-screen w-full bg-background text-foreground">
        {/* Shared ambient atmosphere for every section */}
        <div className="pointer-events-none fixed inset-0 app-ambient" aria-hidden />

        {!isHome && (
          <header className="sticky top-0 z-40 px-3 pt-3 sm:px-5">
            <div className="holo-panel mx-auto flex max-w-7xl items-center gap-2 rounded-2xl px-2.5 py-2">
              <Link to="/dashboard" className="flex items-center gap-2 rounded-xl px-2 py-1 font-semibold tracking-tight">
                <img src={logoAsset.url} alt="WebuWeb" className="h-8 w-8 object-contain" />
                <span className="hidden sm:inline">WebuWeb</span>
              </Link>
              <nav className="hidden md:flex flex-1 items-center justify-center gap-0.5">
                {NAV.map((item) => {
                  const active = isActive(item.to);
                  return (
                    <Link key={item.to} to={item.to} title={t(item.labelKey, item.label)}
                      className={`relative flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-medium transition ${active ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                      {active && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-xl border border-primary/30 bg-primary/10 shadow-[var(--shadow-glow)]" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
                      <item.icon className="relative h-4 w-4" />
                      <span className="relative hidden xl:inline">{t(item.labelKey, item.label)}</span>
                      {"locked" in item && item.locked && <Lock className="relative h-3 w-3 opacity-60" />}
                    </Link>
                  );
                })}
              </nav>
              <div className="ml-auto flex items-center gap-1 md:ml-0">
                <button onClick={toggle} aria-label="Toggle theme" className="grid h-9 w-9 place-items-center rounded-xl text-muted-foreground hover:bg-accent/60 hover:text-foreground">
                  {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>
                <Link to="/settings" className="flex items-center gap-2 rounded-xl px-1.5 py-1 hover:bg-accent/60">
                  <div className="grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-primary to-primary-glow text-[11px] font-bold text-primary-foreground">
                    {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : initials}
                  </div>
                  {sub?.isPro && <ProBadge />}
                </Link>
                <button onClick={signOut} aria-label="Sign out" className="grid h-9 w-9 place-items-center rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </header>
        )}

        <motion.main key={pathname.split("/")[1]} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
          className="relative min-w-0 pb-24 md:pb-0">
          <Outlet />
        </motion.main>

        {/* Mobile dock */}
        <nav className="holo-panel fixed inset-x-3 bottom-3 z-40 flex items-center justify-between rounded-2xl px-1.5 py-1.5 md:hidden">
          {NAV.filter((n) => ["/dashboard", "/ai", "/chat", "/workspace", "/study", "/games"].includes(n.to)).map((item) => (
            <Link key={item.to} to={item.to} aria-label={item.label}
              className={`grid h-11 flex-1 place-items-center rounded-xl transition ${isActive(item.to) ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}>
              <item.icon className="h-5 w-5" />
            </Link>
          ))}
        </nav>

        {/* Floating Webu control (Home has its own) */}
        {!isHome && (
          <div className="fixed bottom-20 right-4 z-50 flex flex-col items-end gap-3 md:bottom-28 md:right-5">
            <AnimatePresence>
              {voiceOpen && (
                <motion.div initial={{ opacity: 0, y: 10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.97 }}
                  className="holo-panel w-[min(22rem,calc(100vw-2rem))] rounded-2xl p-4">
                  <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Webu</div>
                  <WebuVoice compact />
                </motion.div>
              )}
            </AnimatePresence>
            <button onClick={() => setVoiceOpen((v) => !v)} aria-label="Talk to Webu"
              className="grid h-12 w-12 place-items-center rounded-full border border-primary/40 bg-background/70 text-primary shadow-[var(--shadow-glow)] backdrop-blur-xl transition hover:scale-105">
              {voiceOpen ? <X className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>
          </div>
        )}

        <MiniPlayer />
      </div>
    </MusicPlayerProvider>
  );
}

import { createFileRoute, Outlet, redirect, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home, Bot, MessageCircle, FolderOpen, Settings, LogOut, Menu, Sun, Moon, Crown,
  Music, Gamepad2, Lock,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/components/theme-provider";
import { useSubscription } from "@/hooks/use-subscription";
import { ProBadge } from "@/components/pro-badge";
import { MusicPlayerProvider } from "@/components/music-player-provider";
import { MiniPlayer } from "@/components/mini-player";
import { shouldDropSession, clearSessionPersistence } from "@/lib/session-persistence";
import logoAsset from "@/assets/treckweb-logo.png.asset.json";
import { toast } from "sonner";

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
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/ai", label: "AI Assistant", icon: Bot },
  { to: "/chat", label: "Chat", icon: MessageCircle },
  { to: "/workspace", label: "Workspace", icon: FolderOpen },
  { to: "/games", label: "Games", icon: Gamepad2 },
  { to: "/music", label: "Music", icon: Music, locked: true },
  { to: "/membership", label: "Membership", icon: Crown },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;


function AuthLayout() {
  const { user } = Route.useRouteContext();
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { theme, toggle } = useTheme();

  const { data: profile } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      return data;
    },
  });
  const { data: sub } = useSubscription(user.id);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  };

  const displayName = profile?.display_name || user.email?.split("@")[0] || "You";
  const initials = displayName.split(" ").map((s: string) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <MusicPlayerProvider>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        <aside className="hidden lg:flex w-64 flex-col border-r border-border/60 bg-sidebar">
          <SidebarInner pathname={pathname} displayName={displayName} initials={initials} avatar={profile?.avatar_url} onSignOut={signOut} theme={theme} toggleTheme={toggle} isPro={!!sub?.isPro} />
        </aside>

        <AnimatePresence>
          {mobileOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
                onClick={() => setMobileOpen(false)}
              />
              <motion.aside
                initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
                transition={{ type: "spring", damping: 25 }}
                className="lg:hidden fixed left-0 top-0 bottom-0 w-64 z-50 bg-sidebar border-r border-border flex flex-col"
              >
                <SidebarInner pathname={pathname} displayName={displayName} initials={initials} avatar={profile?.avatar_url} onSignOut={signOut} theme={theme} toggleTheme={toggle} isPro={!!sub?.isPro} />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 border-b border-border/60 glass">
            <button onClick={() => setMobileOpen(true)} aria-label="Open menu" className="p-2 rounded-lg hover:bg-accent">
              <Menu className="h-5 w-5" />
            </button>
            <Link to="/dashboard" className="flex items-center gap-2 font-bold">
              <img src={logoAsset.url} alt="WebuWeb" className="h-8 w-8 rounded-full object-cover ring-1 ring-primary/40" />
              WebuWeb
            </Link>
            <div className="w-9" />
          </header>

          <main className="flex-1 min-w-0">
            <Outlet />
          </main>
        </div>

        <MiniPlayer />
      </div>
    </MusicPlayerProvider>
  );
}

function SidebarInner({
  pathname, displayName, initials, avatar, onSignOut, theme, toggleTheme, isPro,
}: {
  pathname: string; displayName: string; initials: string; avatar?: string | null;
  onSignOut: () => void; theme: string; toggleTheme: () => void; isPro: boolean;
}) {
  return (
    <div className="flex flex-col h-full p-4">
      <Link to="/dashboard" className="flex items-center gap-2.5 font-bold text-lg px-2 py-2">
        <img src={logoAsset.url} alt="WebuWeb" className="h-9 w-9 rounded-full object-cover ring-1 ring-primary/40 shadow-[var(--shadow-glow)]" />
        WebuWeb
      </Link>

      <nav className="mt-6 flex flex-col gap-1">
        {NAV.map((item) => {
          const isChat = item.to === "/chat" && (pathname.startsWith("/chat") || pathname.startsWith("/messages"));
          const active = isChat || pathname === item.to || (item.to !== "/dashboard" && item.to !== "/chat" && pathname.startsWith(item.to));
          return (
            <Link
              key={item.to} to={item.to}
              className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              }`}
            >
              {active && (
                <motion.div
                  layoutId="nav-pill"
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/15 to-primary-glow/10 border border-primary/20"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <item.icon className="relative h-4 w-4" />
              <span className="relative flex-1">{item.label}</span>
              {"locked" in item && item.locked && (
                <Lock className="relative h-3.5 w-3.5 text-muted-foreground" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-2 pt-4 border-t border-border/60">
        <button
          onClick={toggleTheme}
          className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/60 transition"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </button>

        <div className="flex items-center gap-3 rounded-xl p-2">
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-primary-glow grid place-items-center text-primary-foreground text-xs font-bold overflow-hidden">
            {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate flex items-center gap-1.5">
              {displayName}
              {isPro && <ProBadge />}
            </div>
          </div>
          <button onClick={onSignOut} aria-label="Sign out" className="p-2 rounded-lg hover:bg-destructive/10 hover:text-destructive transition">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

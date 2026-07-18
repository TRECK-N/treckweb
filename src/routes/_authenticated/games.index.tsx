import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Gamepad2, ExternalLink, Play, Crown, Brain } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/games/")({
  component: GamesPage,
});

type Game = {
  id: string;
  title: string;
  description: string;
  gradient: string;
  icon: typeof Gamepad2;
  action:
    | { kind: "external"; url: string }
    | { kind: "internal"; to: "/games/snake" | "/games/memory" };
  badge?: string;
};

const GAMES: Game[] = [
  {
    id: "chessfriends",
    title: "ChessFriends",
    description: "A modern online chess experience. Play friends and rivals in a beautifully polished board.",
    gradient: "from-amber-500 via-orange-500 to-rose-500",
    icon: Crown,
    action: { kind: "external", url: "https://www.chess.com/play/online" },
    badge: "Featured",
  },
  {
    id: "snake",
    title: "Snake",
    description: "The timeless arcade classic — smoother, faster and prettier. Chase your high score.",
    gradient: "from-emerald-500 via-teal-500 to-cyan-500",
    icon: Gamepad2,
    action: { kind: "internal", to: "/games/snake" },
  },
  {
    id: "memory",
    title: "Memory Match",
    description: "Match every pair before the timer runs out. Three difficulties, one shiny best score.",
    gradient: "from-fuchsia-500 via-purple-500 to-primary",
    icon: Brain,
    action: { kind: "internal", to: "/games/memory" },
  },
];

function GamesPage() {
  const launchExternal = (url: string) => {
    const w = window.open(url, "_blank", "noopener,noreferrer");
    if (!w) toast.error("Your browser blocked the new tab. Please allow pop-ups.");
  };

  return (
    <div className="relative min-h-full">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-fuchsia-500/20 blur-3xl" />
      </div>

      <div className="relative p-6 lg:p-10 max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-3xl bg-gradient-to-br from-primary to-fuchsia-500 grid place-items-center text-white shadow-[var(--shadow-glow)]">
              <Gamepad2 className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold tracking-tight">Games</h1>
              <p className="text-sm text-muted-foreground">A calm place to take a break. More games arriving soon.</p>
            </div>
          </div>
        </motion.div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {GAMES.map((g, i) => (
            <motion.div
              key={g.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              whileHover={{ y: -4 }}
              className="group glass rounded-3xl overflow-hidden border border-border/60 hover:shadow-[var(--shadow-glow)] transition"
            >
              <div className={`relative h-40 bg-gradient-to-br ${g.gradient} overflow-hidden`}>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_60%)]" />
                <div className="absolute inset-0 grid place-items-center">
                  <g.icon className="h-20 w-20 text-white/90 drop-shadow-lg transition group-hover:scale-110" />
                </div>
                {g.badge && (
                  <div className="absolute top-3 left-3 rounded-full bg-black/30 backdrop-blur px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
                    {g.badge}
                  </div>
                )}
              </div>
              <div className="p-5">
                <div className="font-semibold text-lg">{g.title}</div>
                <p className="mt-1 text-sm text-muted-foreground min-h-[40px]">{g.description}</p>
                {g.action.kind === "external" ? (
                  <button
                    onClick={() => launchExternal((g.action as { kind: "external"; url: string }).url)}
                    className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-primary-glow px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] hover:opacity-90 transition"
                  >
                    <Play className="h-4 w-4" /> Play
                    <ExternalLink className="h-3.5 w-3.5 opacity-80" />
                  </button>
                ) : (
                  <Link
                    to={g.action.to}
                    className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-primary-glow px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] hover:opacity-90 transition"
                  >
                    <Play className="h-4 w-4" /> Play
                  </Link>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-10 glass rounded-2xl p-5 text-sm text-muted-foreground">
          More games coming soon — Tetris, Sudoku, Minesweeper, 2048, Connect Four and more.
        </div>
      </div>
    </div>
  );
}

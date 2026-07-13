import { motion, AnimatePresence } from "framer-motion";
import { Link, useRouterState } from "@tanstack/react-router";
import { Play, Pause, SkipBack, SkipForward, X, Music as MusicIcon } from "lucide-react";
import { useMusicPlayer, formatTime } from "./music-player-provider";

export function MiniPlayer() {
  const { current, playing, progress, duration, toggle, next, prev, stop } = useMusicPlayer();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Hide on /music where the full player is shown
  const hideOnMusic = pathname.startsWith("/music");

  return (
    <AnimatePresence>
      {current && !hideOnMusic && (
        <motion.div
          initial={{ y: 40, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 40, opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", damping: 25, stiffness: 320 }}
          className="fixed z-40 left-3 lg:left-[248px] bottom-24 lg:bottom-28 w-[min(320px,calc(100%-1.5rem))]"
        >
          <div className="glass rounded-2xl shadow-[var(--shadow-glow)] border border-border/60 backdrop-blur-xl">
            <div className="relative">
              {/* Progress bar (top edge) */}
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-border/50 rounded-t-2xl overflow-hidden">
                <div className="h-full bg-gradient-to-r from-primary to-primary-glow transition-[width] duration-200"
                  style={{ width: `${duration ? (progress / duration) * 100 : 0}%` }} />
              </div>

              <div className="flex items-center gap-3 p-2.5 pr-3">
                <Link
                  to="/music"
                  className="flex items-center gap-2.5 min-w-0 flex-1 hover:bg-accent/40 rounded-xl p-1 transition"
                >
                  <div className="h-11 w-11 shrink-0 rounded-xl bg-gradient-to-br from-fuchsia-500 to-primary grid place-items-center text-white overflow-hidden">
                    {current.cover_url ? (
                      <img src={current.cover_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <MusicIcon className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0 hidden sm:block">
                    <div className="font-medium text-sm truncate">{current.title}</div>
                    <div className="text-xs text-muted-foreground truncate">{current.artist}</div>
                  </div>
                </Link>

                <div className="flex items-center gap-1">
                  <button onClick={prev} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition" aria-label="Previous">
                    <SkipBack className="h-4 w-4" />
                  </button>
                  <button onClick={toggle}
                    className="h-9 w-9 rounded-full bg-primary text-primary-foreground grid place-items-center hover:opacity-90 shadow-[var(--shadow-glow)]"
                    aria-label={playing ? "Pause" : "Play"}>
                    {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-[1px]" />}
                  </button>
                  <button onClick={next} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition" aria-label="Next">
                    <SkipForward className="h-4 w-4" />
                  </button>
                </div>

                <div className="hidden md:block text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                  {formatTime(progress)} / {formatTime(duration || current.duration_seconds || 0)}
                </div>

                <button onClick={stop} className="p-2 rounded-lg text-muted-foreground hover:text-destructive transition" aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

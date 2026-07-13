import { motion, AnimatePresence } from "framer-motion";
import { Link, useRouterState } from "@tanstack/react-router";
import { Play, Pause, X, Music as MusicIcon, Volume2, VolumeX } from "lucide-react";
import { useMusicPlayer } from "./music-player-provider";

export function MiniPlayer() {
  const {
    current, playing, progress, duration, toggle, stop,
    volume, muted, setVolume, toggleMute, seek,
  } = useMusicPlayer();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hideOnMusic = pathname.startsWith("/music");
  const dur = duration || current?.duration_seconds || 0;

  return (
    <AnimatePresence>
      {current && !hideOnMusic && (
        <motion.div
          initial={{ y: 40, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 40, opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", damping: 25, stiffness: 320 }}
          className="fixed z-40 left-3 lg:left-4 bottom-24 lg:bottom-28 w-[min(240px,calc(100%-1.5rem))]"
        >
          <div className="glass rounded-2xl shadow-[var(--shadow-glow)] border border-border/60 backdrop-blur-xl overflow-hidden">
            <div className="relative p-3">
              <div className="flex items-center gap-2.5">
                <Link
                  to="/music"
                  className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-fuchsia-500 to-primary grid place-items-center text-white overflow-hidden"
                >
                  {current.cover_url ? (
                    <img src={current.cover_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <MusicIcon className="h-4 w-4" />
                  )}
                </Link>
                <Link to="/music" className="min-w-0 flex-1">
                  <div className="font-medium text-xs truncate">{current.title}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{current.artist}</div>
                </Link>
                <button onClick={stop} className="p-1 rounded-lg text-muted-foreground hover:text-destructive transition shrink-0" aria-label="Close">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="mt-2.5 flex items-center gap-2">
                <button onClick={toggle}
                  className="h-8 w-8 shrink-0 rounded-full bg-primary text-primary-foreground grid place-items-center hover:opacity-90 shadow-[var(--shadow-glow)]"
                  aria-label={playing ? "Pause" : "Play"}>
                  {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 translate-x-[1px]" />}
                </button>
                <input
                  type="range" min={0} max={dur || 0} step="0.1" value={progress}
                  onChange={(e) => seek(Number(e.target.value))}
                  className="flex-1 accent-primary h-1 min-w-0"
                  aria-label="Seek"
                />
              </div>

              <div className="mt-2 flex items-center gap-2">
                <button onClick={toggleMute} className="p-1 rounded-lg text-muted-foreground hover:text-foreground shrink-0" aria-label="Mute">
                  {muted || volume === 0 ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                </button>
                <input
                  type="range" min={0} max={1} step={0.01}
                  value={muted ? 0 : volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className="flex-1 accent-primary h-1 min-w-0"
                  aria-label="Volume"
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

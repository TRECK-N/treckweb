import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/use-subscription";
import {
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, Heart, Volume2, VolumeX,
  Search, Music as MusicIcon, Clock, Crown,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/music")({
  component: MusicPage,
});

interface Song {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  cover_url: string | null;
  audio_url: string;
  duration_seconds: number | null;
}

function fmt(s: number) {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60); const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function MusicPage() {
  const { user } = Route.useRouteContext();
  const { data: sub } = useSubscription(user.id);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"library" | "favorites" | "recent">("library");

  const { data: songs = [] } = useQuery({
    queryKey: ["songs"],
    queryFn: async () => {
      const { data } = await supabase.from("songs").select("*").order("created_at", { ascending: false });
      return (data ?? []) as Song[];
    },
  });

  const { data: likes = [] } = useQuery({
    queryKey: ["song-likes", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("song_likes").select("song_id").eq("user_id", user.id);
      return (data ?? []).map((r) => r.song_id);
    },
  });

  const { data: recent = [] } = useQuery({
    queryKey: ["recently-played", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("recently_played").select("song_id, played_at")
        .eq("user_id", user.id).order("played_at", { ascending: false }).limit(30);
      return (data ?? []) as Array<{ song_id: string; played_at: string }>;
    },
  });

  const likeSet = useMemo(() => new Set(likes), [likes]);
  const recentSongs = useMemo(() => {
    const map = new Map(songs.map((s) => [s.id, s]));
    return recent.map((r) => map.get(r.song_id)).filter(Boolean) as Song[];
  }, [songs, recent]);

  const displayed = useMemo(() => {
    let list = songs;
    if (tab === "favorites") list = songs.filter((s) => likeSet.has(s.id));
    if (tab === "recent") list = recentSongs;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((s) => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q));
    }
    return list;
  }, [songs, tab, search, likeSet, recentSongs]);

  // Player state
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<"off" | "all" | "one">("off");
  const audioRef = useRef<HTMLAudioElement>(null);
  const current = songs.find((s) => s.id === currentId) || null;

  const queue = displayed;

  const playSong = async (song: Song) => {
    setCurrentId(song.id);
    setPlaying(true);
    // Log recent
    await supabase.from("recently_played").insert({ user_id: user.id, song_id: song.id });
    qc.invalidateQueries({ queryKey: ["recently-played", user.id] });
  };

  useEffect(() => {
    const a = audioRef.current;
    if (!a || !current) return;
    a.src = current.audio_url;
    a.volume = muted ? 0 : volume;
    if (playing) a.play().catch(() => setPlaying(false));
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) a.play().catch(() => setPlaying(false));
    else a.pause();
  }, [playing]);

  useEffect(() => {
    const a = audioRef.current; if (!a) return;
    a.volume = muted ? 0 : volume;
  }, [volume, muted]);

  useEffect(() => {
    const a = audioRef.current; if (!a) return;
    const onTime = () => setProgress(a.currentTime);
    const onLoaded = () => setDuration(a.duration || 0);
    const onEnd = () => nextTrack();
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onLoaded);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onLoaded);
      a.removeEventListener("ended", onEnd);
    };
  }); // rebind each render — cheap

  const idx = current ? queue.findIndex((s) => s.id === current.id) : -1;

  const nextTrack = () => {
    if (!queue.length) return;
    if (repeat === "one" && current) {
      const a = audioRef.current; if (a) { a.currentTime = 0; a.play(); }
      return;
    }
    let nextIdx: number;
    if (shuffle) {
      nextIdx = Math.floor(Math.random() * queue.length);
    } else {
      nextIdx = idx + 1;
      if (nextIdx >= queue.length) {
        if (repeat === "all") nextIdx = 0;
        else { setPlaying(false); return; }
      }
    }
    playSong(queue[nextIdx]);
  };

  const prevTrack = () => {
    if (!queue.length) return;
    if (progress > 3 && audioRef.current) { audioRef.current.currentTime = 0; return; }
    const prevIdx = idx <= 0 ? queue.length - 1 : idx - 1;
    playSong(queue[prevIdx]);
  };

  const toggleLike = async (songId: string) => {
    if (likeSet.has(songId)) {
      await supabase.from("song_likes").delete().eq("user_id", user.id).eq("song_id", songId);
    } else {
      await supabase.from("song_likes").insert({ user_id: user.id, song_id: songId });
    }
    qc.invalidateQueries({ queryKey: ["song-likes", user.id] });
  };

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const a = audioRef.current; if (!a) return;
    const v = Number(e.target.value);
    a.currentTime = v;
    setProgress(v);
  };

  // Gate
  if (!sub?.musicPackUnlocked) {
    return (
      <div className="p-6 lg:p-10 max-w-3xl mx-auto">
        <div className="glass rounded-3xl p-10 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/10 via-primary/5 to-transparent pointer-events-none" />
          <div className="relative">
            <div className="mx-auto h-16 w-16 rounded-3xl bg-gradient-to-br from-fuchsia-500 to-primary grid place-items-center text-white shadow-[var(--shadow-glow)]">
              <MusicIcon className="h-7 w-7" />
            </div>
            <h1 className="mt-4 text-2xl font-bold">Unlock the Music section</h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
              Get the <b>Complete Music Pack</b> to unlock every current and future song in the TRECK library.
            </p>
            <Link to="/membership" className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-primary px-5 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-glow)] hover:opacity-90">
              <Crown className="h-4 w-4" /> Unlock now
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] lg:h-screen">
      <audio ref={audioRef} preload="metadata" />

      <div className="flex-1 overflow-y-auto">
        {/* Hero */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/20 via-primary/10 to-transparent pointer-events-none" />
          <div className="relative px-6 lg:px-10 py-10">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-3xl bg-gradient-to-br from-fuchsia-500 to-primary grid place-items-center text-white shadow-[var(--shadow-glow)]">
                <MusicIcon className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Music</h1>
                <p className="text-sm text-muted-foreground">Your unlocked TRECK library · {songs.length} song{songs.length === 1 ? "" : "s"}</p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <div className="glass rounded-2xl inline-flex gap-1 p-1.5">
                {([
                  { id: "library", label: "Library" },
                  { id: "favorites", label: `Favorites (${likes.length})` },
                  { id: "recent", label: "Recently played" },
                ] as const).map((t) => (
                  <button key={t.id} onClick={() => setTab(t.id)}
                    className={`relative px-4 py-1.5 rounded-xl text-sm font-medium transition ${
                      tab === t.id ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}>
                    {tab === t.id && (
                      <motion.div layoutId="music-tab"
                        className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary to-primary-glow shadow-[var(--shadow-glow)]"
                        transition={{ type: "spring", stiffness: 400, damping: 30 }} />
                    )}
                    <span className="relative">{t.label}</span>
                  </button>
                ))}
              </div>

              <div className="glass rounded-2xl flex items-center gap-2 px-3 py-2 flex-1 min-w-[240px] max-w-md">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search songs or artists"
                  className="flex-1 bg-transparent outline-none text-sm" />
              </div>
            </div>
          </div>
        </div>

        {/* Song list */}
        <div className="px-6 lg:px-10 pb-32">
          {displayed.length === 0 ? (
            <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
              {tab === "favorites" ? "You haven't liked any songs yet." : tab === "recent" ? "Nothing played recently." : "No songs match your search."}
            </div>
          ) : (
            <div className="glass rounded-2xl overflow-hidden">
              <div className="hidden md:grid grid-cols-[3rem_1fr_1fr_3rem_3rem] gap-4 px-4 py-3 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border/60">
                <div>#</div>
                <div>Title</div>
                <div>Album</div>
                <div className="text-center"><Clock className="h-3.5 w-3.5 inline" /></div>
                <div></div>
              </div>
              {displayed.map((s, i) => {
                const isCurrent = current?.id === s.id;
                return (
                  <div key={s.id}
                    onDoubleClick={() => playSong(s)}
                    className={`group grid grid-cols-[3rem_1fr_3rem] md:grid-cols-[3rem_1fr_1fr_3rem_3rem] gap-4 items-center px-4 py-2.5 border-b border-border/40 last:border-0 hover:bg-accent/40 transition ${isCurrent ? "bg-primary/5" : ""}`}>
                    <button onClick={() => isCurrent ? setPlaying((p) => !p) : playSong(s)}
                      className="h-9 w-9 rounded-lg grid place-items-center text-muted-foreground group-hover:text-foreground">
                      {isCurrent && playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </button>
                    <div className="min-w-0">
                      <div className={`font-medium text-sm truncate ${isCurrent ? "text-primary" : ""}`}>{s.title}</div>
                      <div className="text-xs text-muted-foreground truncate">{s.artist}</div>
                    </div>
                    <div className="hidden md:block text-sm text-muted-foreground truncate">{s.album || "—"}</div>
                    <div className="hidden md:block text-xs text-muted-foreground text-center">{s.duration_seconds ? fmt(s.duration_seconds) : "—"}</div>
                    <button onClick={() => toggleLike(s.id)}
                      className={`h-9 w-9 rounded-lg grid place-items-center transition ${likeSet.has(s.id) ? "text-destructive" : "text-muted-foreground hover:text-foreground"}`}
                      aria-label="Like">
                      <Heart className={`h-4 w-4 ${likeSet.has(s.id) ? "fill-current" : ""}`} />
                    </button>
                    <div className="md:hidden col-span-3 text-[10px] text-muted-foreground">{i + 1}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Player */}
      <AnimatePresence>
        {current && (
          <motion.div
            initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
            className="border-t border-border/60 glass"
          >
            <div className="px-4 lg:px-8 py-3">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="h-12 w-12 shrink-0 rounded-xl bg-gradient-to-br from-fuchsia-500 to-primary grid place-items-center text-white overflow-hidden">
                    {current.cover_url ? <img src={current.cover_url} alt="" className="h-full w-full object-cover" /> : <MusicIcon className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 hidden sm:block">
                    <div className="font-medium text-sm truncate">{current.title}</div>
                    <div className="text-xs text-muted-foreground truncate">{current.artist}</div>
                  </div>
                  <button onClick={() => toggleLike(current.id)}
                    className={`p-2 rounded-lg transition ${likeSet.has(current.id) ? "text-destructive" : "text-muted-foreground hover:text-foreground"}`}>
                    <Heart className={`h-4 w-4 ${likeSet.has(current.id) ? "fill-current" : ""}`} />
                  </button>
                </div>

                <div className="flex-1 flex flex-col items-center gap-1.5 max-w-lg">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShuffle((s) => !s)}
                      className={`p-2 rounded-lg transition ${shuffle ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                      <Shuffle className="h-4 w-4" />
                    </button>
                    <button onClick={prevTrack} className="p-2 rounded-lg text-muted-foreground hover:text-foreground">
                      <SkipBack className="h-4 w-4" />
                    </button>
                    <button onClick={() => setPlaying((p) => !p)}
                      className="h-10 w-10 rounded-full bg-primary text-primary-foreground grid place-items-center hover:opacity-90 shadow-[var(--shadow-glow)]">
                      {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-[1px]" />}
                    </button>
                    <button onClick={nextTrack} className="p-2 rounded-lg text-muted-foreground hover:text-foreground">
                      <SkipForward className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setRepeat((r) => r === "off" ? "all" : r === "all" ? "one" : "off")}
                      className={`p-2 rounded-lg transition ${repeat !== "off" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                      {repeat === "one" ? <Repeat1 className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="flex items-center gap-2 w-full">
                    <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">{fmt(progress)}</span>
                    <input type="range" min={0} max={duration || 0} step="0.1" value={progress} onChange={seek}
                      className="flex-1 accent-primary h-1" />
                    <span className="text-[10px] text-muted-foreground tabular-nums w-8">{fmt(duration)}</span>
                  </div>
                </div>

                <div className="hidden md:flex items-center gap-2 flex-1 justify-end max-w-[180px]">
                  <button onClick={() => setMuted((m) => !m)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground">
                    {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </button>
                  <input type="range" min={0} max={1} step={0.01} value={muted ? 0 : volume}
                    onChange={(e) => { setVolume(Number(e.target.value)); setMuted(false); }}
                    className="flex-1 accent-primary h-1" />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

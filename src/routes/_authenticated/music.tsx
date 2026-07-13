import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/use-subscription";
import { useMusicPlayer, formatTime, type Song } from "@/components/music-player-provider";
import {
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, Heart, Volume2, VolumeX,
  Search, Music as MusicIcon, Clock, Crown,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/music")({
  component: MusicPage,
});

function MusicPage() {
  const { user } = Route.useRouteContext();
  const { data: sub } = useSubscription(user.id);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"library" | "favorites" | "recent">("library");

  const player = useMusicPlayer();

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

  const playSong = async (song: Song) => {
    player.play(song, displayed);
    await supabase.from("recently_played").insert({ user_id: user.id, song_id: song.id });
    qc.invalidateQueries({ queryKey: ["recently-played", user.id] });
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
    const v = Number(e.target.value);
    player.seek(v);
  };

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

  const current = player.current;
  const displayDuration = player.duration || current?.duration_seconds || 0;

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] lg:h-screen">
      <div className="flex-1 overflow-y-auto">
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

        <div className="px-6 lg:px-10 pb-32">
          {displayed.length === 0 ? (
            <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
              {tab === "favorites" ? "You haven't liked any songs yet." : tab === "recent" ? "Nothing played recently." : "No songs match your search."}
            </div>
          ) : (
            <div className="glass rounded-2xl overflow-hidden">
              <div className="hidden md:grid grid-cols-[3rem_1fr_1fr_5rem_3rem] gap-4 px-4 py-3 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border/60">
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
                    className={`group grid grid-cols-[3rem_1fr_3rem] md:grid-cols-[3rem_1fr_1fr_5rem_3rem] gap-4 items-center px-4 py-2.5 border-b border-border/40 last:border-0 hover:bg-accent/40 transition ${isCurrent ? "bg-primary/5" : ""}`}>
                    <button onClick={() => isCurrent ? player.toggle() : playSong(s)}
                      className="h-9 w-9 rounded-lg grid place-items-center text-muted-foreground group-hover:text-foreground">
                      {isCurrent && player.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </button>
                    <div className="min-w-0">
                      <div className={`font-medium text-sm truncate ${isCurrent ? "text-primary" : ""}`}>{s.title}</div>
                      <div className="text-xs text-muted-foreground truncate">{s.artist}</div>
                    </div>
                    <div className="hidden md:block text-sm text-muted-foreground truncate">{s.album || "—"}</div>
                    <div className="hidden md:block text-xs text-muted-foreground text-center tabular-nums">
                      {s.duration_seconds ? formatTime(s.duration_seconds) : "—"}
                    </div>
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

      {current && (
        <motion.div
          initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
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
                  <button onClick={player.toggleShuffle}
                    className={`p-2 rounded-lg transition ${player.shuffle ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                    <Shuffle className="h-4 w-4" />
                  </button>
                  <button onClick={player.prev} className="p-2 rounded-lg text-muted-foreground hover:text-foreground">
                    <SkipBack className="h-4 w-4" />
                  </button>
                  <button onClick={player.toggle}
                    className="h-10 w-10 rounded-full bg-primary text-primary-foreground grid place-items-center hover:opacity-90 shadow-[var(--shadow-glow)]">
                    {player.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-[1px]" />}
                  </button>
                  <button onClick={player.next} className="p-2 rounded-lg text-muted-foreground hover:text-foreground">
                    <SkipForward className="h-4 w-4" />
                  </button>
                  <button
                    onClick={player.cycleRepeat}
                    className={`p-2 rounded-lg transition ${player.repeat !== "off" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                    {player.repeat === "one" ? <Repeat1 className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
                  </button>
                </div>
                <div className="flex items-center gap-3 w-full">
                  <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">
                    {formatTime(player.progress)} / {formatTime(displayDuration)}
                  </span>
                  <input type="range" min={0} max={displayDuration || 0} step="0.1" value={player.progress} onChange={seek}
                    className="flex-1 accent-primary h-1" />
                </div>
              </div>

              <div className="hidden md:flex items-center gap-2 flex-1 justify-end max-w-[180px]">
                <button onClick={player.toggleMute} className="p-2 rounded-lg text-muted-foreground hover:text-foreground">
                  {player.muted || player.volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
                <input type="range" min={0} max={1} step={0.01} value={player.muted ? 0 : player.volume}
                  onChange={(e) => player.setVolume(Number(e.target.value))}
                  className="flex-1 accent-primary h-1" />
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/use-subscription";
import { useMusicPlayer, type Song } from "@/components/music-player-provider";
import {
  Play, Pause, Heart, Search, Music as MusicIcon, Crown,
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
              {displayed.map((s) => {
                const isCurrent = current?.id === s.id;
                return (
                  <div key={s.id}
                    onDoubleClick={() => playSong(s)}
                    className={`group flex items-center gap-4 px-4 py-3 border-b border-border/40 last:border-0 hover:bg-accent/40 transition ${isCurrent ? "bg-primary/5" : ""}`}>
                    <div className="h-11 w-11 shrink-0 rounded-xl bg-gradient-to-br from-fuchsia-500 to-primary grid place-items-center text-white overflow-hidden">
                      {s.cover_url
                        ? <img src={s.cover_url} alt="" className="h-full w-full object-cover" />
                        : <MusicIcon className="h-4 w-4" />}
                    </div>
                    <button onClick={() => isCurrent ? player.toggle() : playSong(s)}
                      className="h-9 w-9 shrink-0 rounded-full bg-primary/10 hover:bg-primary hover:text-primary-foreground text-primary grid place-items-center transition"
                      aria-label={isCurrent && player.playing ? "Pause" : "Play"}>
                      {isCurrent && player.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-[1px]" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className={`font-medium text-sm truncate ${isCurrent ? "text-primary" : ""}`}>{s.title}</div>
                      {s.artist && <div className="text-xs text-muted-foreground truncate">{s.artist}</div>}
                    </div>
                    <button onClick={() => toggleLike(s.id)}
                      className={`h-9 w-9 shrink-0 rounded-lg grid place-items-center transition ${likeSet.has(s.id) ? "text-destructive" : "text-muted-foreground hover:text-foreground"}`}
                      aria-label="Like">
                      <Heart className={`h-4 w-4 ${likeSet.has(s.id) ? "fill-current" : ""}`} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

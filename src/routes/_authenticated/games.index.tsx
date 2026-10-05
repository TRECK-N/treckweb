import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Gamepad2, Play, Crown, Brain, Grid3x3, Bomb, Search, Heart, History, Shield, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchGames, fetchIsAdmin, GAME_CATEGORIES, type GameRow } from "@/lib/games";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/games/")({
  head: () => ({
    meta: [
      { title: "Games — WebuWeb" },
      { name: "description", content: "Browse and play browser games inside WebuWeb, plus live 1v1 Chess with friends." },
      { property: "og:title", content: "Games — WebuWeb" },
      { property: "og:description", content: "Browse and play browser games inside WebuWeb, plus live 1v1 Chess with friends." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GamesPage,
});

const ORIGINALS = [
  { title: "Chess", desc: "Live 1v1 multiplayer chess", icon: Crown, to: "/games/chess" },
  { title: "Snake", desc: "Arcade classic", icon: Gamepad2, to: "/games/snake" },
  { title: "Memory Match", desc: "Find every pair", icon: Brain, to: "/games/memory" },
  { title: "2048", desc: "Slide and merge", icon: Grid3x3, to: "/games/2048" },
  { title: "Minesweeper", desc: "Clear the field", icon: Bomb, to: "/games/minesweeper" },
] as const;

function GamesPage() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("All");
  const [favOnly, setFavOnly] = useState(false);

  const games = useQuery({ queryKey: ["games"], queryFn: fetchGames });
  const isAdmin = useQuery({ queryKey: ["is-admin", user.id], queryFn: () => fetchIsAdmin(user.id) });
  const favs = useQuery({
    queryKey: ["game-favs", user.id],
    queryFn: async () => new Set(((await supabase.from("game_favorites").select("game_id")).data ?? []).map((r) => r.game_id)),
  });
  const plays = useQuery({
    queryKey: ["game-plays", user.id],
    queryFn: async () => (await supabase.from("game_plays").select("game_id, played_at").order("played_at", { ascending: false }).limit(6)).data ?? [],
  });

  const list = (games.data ?? []).filter((g) => g.enabled);
  const filtered = useMemo(() => list.filter((g) =>
    (cat === "All" || g.category === cat) &&
    (!favOnly || favs.data?.has(g.id)) &&
    (!q || `${g.title} ${g.description}`.toLowerCase().includes(q.toLowerCase())),
  ), [list, cat, favOnly, q, favs.data]);
  const recent = (plays.data ?? []).map((p) => list.find((g) => g.id === p.game_id)).filter(Boolean) as GameRow[];

  const toggleFav = async (id: string) => {
    const has = favs.data?.has(id);
    const { error } = has
      ? await supabase.from("game_favorites").delete().eq("game_id", id).eq("user_id", user.id)
      : await supabase.from("game_favorites").insert({ game_id: id, user_id: user.id });
    if (error) return toast.error("Couldn't update favorites");
    qc.invalidateQueries({ queryKey: ["game-favs", user.id] });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.25em] text-primary">Game library</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Games</h1>
        </div>
        {isAdmin.data && (
          <Link to="/games/admin" className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/20">
            <Shield className="h-4 w-4" /> Manage games
          </Link>
        )}
      </div>

      {/* Originals */}
      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">WebuWeb originals</h2>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {ORIGINALS.map((g) => (
            <Link key={g.to} to={g.to} className="holo-panel group flex min-w-[13rem] items-center gap-3 rounded-2xl p-3 transition hover:border-primary/50">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><g.icon className="h-5 w-5" /></div>
              <div><div className="text-sm font-semibold">{g.title}</div><div className="text-xs text-muted-foreground">{g.desc}</div></div>
            </Link>
          ))}
        </div>
      </section>

      {recent.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground"><History className="h-4 w-4" /> Recently played</h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {recent.map((g) => (
              <Link key={g.id} to="/games/play/$slug" params={{ slug: g.slug }} className="holo-panel flex min-w-[14rem] items-center gap-3 rounded-2xl p-2 hover:border-primary/50">
                <Thumb game={g} className="h-12 w-16 rounded-lg" />
                <div className="truncate text-sm font-medium">{g.title}</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Filters */}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-2 rounded-full border border-border/60 bg-background/40 px-4 py-2 backdrop-blur-xl focus-within:border-primary/50">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search games" className="flex-1 bg-transparent text-sm outline-none" />
        </div>
        <button onClick={() => setFavOnly((v) => !v)} className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm ${favOnly ? "border-primary/50 bg-primary/15 text-primary" : "border-border/60 text-muted-foreground"}`}>
          <Heart className={`h-4 w-4 ${favOnly ? "fill-current" : ""}`} /> Favorites
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {["All", ...GAME_CATEGORIES].map((c) => (
          <button key={c} onClick={() => setCat(c)} className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${cat === c ? "bg-primary text-primary-foreground" : "border border-border/60 text-muted-foreground hover:text-foreground"}`}>{c}</button>
        ))}
      </div>

      {/* Grid */}
      {games.isLoading ? (
        <div className="mt-10 grid place-items-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : games.error ? (
        <div className="holo-panel mt-8 rounded-2xl p-6 text-sm text-destructive">Couldn't load the game library. Please refresh.</div>
      ) : filtered.length === 0 ? (
        <div className="holo-panel mt-8 rounded-2xl p-8 text-center text-sm text-muted-foreground">No games match these filters.</div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((g, i) => (
            <motion.div key={g.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="holo-panel group overflow-hidden rounded-2xl transition hover:-translate-y-1 hover:border-primary/50 hover:shadow-[var(--shadow-glow)]">
              <Link to="/games/play/$slug" params={{ slug: g.slug }} className="relative block">
                <Thumb game={g} className="aspect-[4/3] w-full" />
                <div className="absolute inset-0 grid place-items-center bg-background/50 opacity-0 transition group-hover:opacity-100">
                  <span className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><Play className="h-4 w-4" /> Play</span>
                </div>
              </Link>
              <div className="flex items-start gap-2 p-4">
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-primary">{g.category}</div>
                  <div className="truncate font-semibold">{g.title}</div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{g.description}</p>
                </div>
                <button onClick={() => toggleFav(g.id)} aria-label="Favorite" className="rounded-full p-2 text-muted-foreground hover:text-primary">
                  <Heart className={`h-4 w-4 ${favs.data?.has(g.id) ? "fill-primary text-primary" : ""}`} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function Thumb({ game, className }: { game: GameRow; className: string }) {
  const [broken, setBroken] = useState(false);
  return game.thumbnail_url && !broken ? (
    <img src={game.thumbnail_url} alt="" loading="lazy" onError={() => setBroken(true)} className={`${className} object-cover`} />
  ) : (
    <div className={`${className} grid place-items-center bg-gradient-to-br from-primary/30 to-primary-glow/20`}><Gamepad2 className="h-8 w-8 text-primary" /></div>
  );
}

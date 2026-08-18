import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Crown, Plus, KeyRound, Search, RefreshCw, Users, Lock, Globe, Copy, Play } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/games/chess/")({
  component: ChessHome,
});

type Tab = "browse" | "create" | "join";

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function ChessHome() {
  const { user } = Route.useRouteContext() as { user: { id: string } };
  const nav = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("browse");

  const [name, setName] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const mode = "1v1" as const;
  const maxPlayers = 2;
  const [timeControl, setTimeControl] = useState<number | null>(null);
  const [chatEnabled, setChatEnabled] = useState(true);
  const [spectators, setSpectators] = useState(true);
  const [creating, setCreating] = useState(false);

  const [joinCode, setJoinCode] = useState("");
  const [search, setSearch] = useState("");

  const { data: lobbies, refetch, isFetching } = useQuery({
    queryKey: ["chess-lobbies"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("chess_lobbies")
        .select("id,name,host_id,is_public,max_players,status,time_control_seconds,created_at")
        .eq("is_public", true)
        .in("status", ["waiting", "playing"])
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as Array<{ id: string; name: string; host_id: string; is_public: boolean; max_players: number; status: string; time_control_seconds: number | null; created_at: string }>;
    },
  });

  useEffect(() => {
    const ch = (supabase as any)
      .channel("chess-lobbies-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "chess_lobbies" }, () => {
        qc.invalidateQueries({ queryKey: ["chess-lobbies"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "chess_lobby_members" }, () => {
        qc.invalidateQueries({ queryKey: ["chess-lobbies"] });
      })
      .subscribe();
    return () => { (supabase as any).removeChannel(ch); };
  }, [qc]);

  const create = async () => {
    if (!name.trim()) { toast.error("Give your lobby a name"); return; }
    setCreating(true);
    const code = randomCode();
    const { data, error } = await (supabase as any)
      .from("chess_lobbies")
      .insert({
        host_id: user.id,
        name: name.trim(),
        is_public: isPublic,
        code,
        max_players: maxPlayers,
        time_control_seconds: timeControl,
        chat_enabled: chatEnabled,
        spectators_allowed: spectators,
        settings: { mode },
      })
      .select("id")
      .single();
    setCreating(false);
    if (error || !data) { toast.error(error?.message ?? "Failed to create lobby"); return; }
    toast.success("Lobby created");
    nav({ to: "/games/chess/$lobbyId", params: { lobbyId: data.id } });
  };

  const joinByCode = async () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) { toast.error("Enter a valid code"); return; }
    const { data, error } = await (supabase as any)
      .from("chess_lobbies")
      .select("id")
      .eq("code", code)
      .maybeSingle();
    if (error || !data) { toast.error("Lobby not found"); return; }
    nav({ to: "/games/chess/$lobbyId", params: { lobbyId: data.id } });
  };

  const filtered = (lobbies ?? []).filter((l) => l.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="relative min-h-full">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-amber-500/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
      </div>

      <div className="relative p-4 sm:p-6 lg:p-10 max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-3xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 grid place-items-center text-white shadow-[var(--shadow-glow)]">
            <Crown className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold tracking-tight">ChessFriends</h1>
            <p className="text-sm text-muted-foreground">Create a lobby, invite friends, or jump into a public match.</p>
          </div>
        </motion.div>

        <div className="mt-6 flex flex-wrap gap-2">
          {(["browse", "create", "join"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                tab === t
                  ? "bg-gradient-to-r from-primary to-primary-glow text-primary-foreground shadow-[var(--shadow-glow)]"
                  : "glass hover:bg-accent/60"
              }`}
            >
              {t === "browse" ? "Browse public lobbies" : t === "create" ? "Create lobby" : "Join by code"}
            </button>
          ))}
        </div>

        {tab === "browse" && (
          <div className="mt-6 glass rounded-3xl border border-border/60 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search lobbies…"
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-background/50 border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <button
                onClick={() => refetch()}
                className="inline-flex items-center gap-2 rounded-xl px-3 py-2 bg-accent hover:bg-accent/70 text-sm"
              >
                <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Refresh
              </button>
            </div>

            <div className="mt-4 grid gap-2">
              {filtered.length === 0 ? (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  No public lobbies yet. Create one!
                </div>
              ) : (
                filtered.map((l) => (
                  <motion.button
                    key={l.id}
                    initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                    whileHover={{ x: 4 }}
                    onClick={() => nav({ to: "/games/chess/$lobbyId", params: { lobbyId: l.id } })}
                    className="w-full text-left p-4 rounded-2xl bg-background/40 hover:bg-background/70 border border-border/60 flex items-center gap-4 transition"
                  >
                    <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-amber-500 to-rose-500 grid place-items-center text-white shrink-0">
                      <Crown className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{l.name}</div>
                      <div className="text-xs text-muted-foreground flex gap-2 items-center mt-0.5">
                        <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />max {l.max_players}</span>
                        <span>·</span>
                        <span>{l.time_control_seconds ? `${Math.round(l.time_control_seconds / 60)} min` : "Unlimited"}</span>
                        <span>·</span>
                        <span className={l.status === "playing" ? "text-amber-500" : "text-emerald-500"}>
                          {l.status === "playing" ? "In game" : "Waiting"}
                        </span>
                      </div>
                    </div>
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-semibold">
                      <Play className="h-3 w-3" /> Join
                    </div>
                  </motion.button>
                ))
              )}
            </div>
          </div>
        )}

        {tab === "create" && (
          <div className="mt-6 glass rounded-3xl border border-border/60 p-5 sm:p-6 grid gap-4 max-w-2xl">
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Lobby name</label>
              <input
                value={name} onChange={(e) => setName(e.target.value)}
                placeholder="My chess lobby"
                className="mt-1 w-full px-3 py-2.5 rounded-xl bg-background/50 border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Privacy</label>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <button onClick={() => setIsPublic(true)}
                    className={`px-3 py-2 rounded-xl text-sm border ${isPublic ? "bg-primary/10 border-primary/40 text-primary" : "border-border/60"}`}>
                    <Globe className="inline h-4 w-4 mr-1" /> Public
                  </button>
                  <button onClick={() => setIsPublic(false)}
                    className={`px-3 py-2 rounded-xl text-sm border ${!isPublic ? "bg-primary/10 border-primary/40 text-primary" : "border-border/60"}`}>
                    <Lock className="inline h-4 w-4 mr-1" /> Private
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Match mode</label>
                <select
                  value={mode} onChange={(e) => setMode(e.target.value as "1v1" | "2v2" | "2v1")}
                  className="mt-1 w-full px-3 py-2.5 rounded-xl bg-background/50 border border-border/60 text-sm"
                >
                  <option value="1v1">1v1 — Classic (2 players)</option>
                  <option value="2v2">2v2 — Teams, alternating moves (4 players)</option>
                  <option value="2v1">2v1 — Handicap duo vs solo (3 players)</option>
                </select>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  In team modes, teammates take turns making their side's moves.
                </p>
              </div>

              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Time control</label>
                <select
                  value={timeControl ?? "0"}
                  onChange={(e) => setTimeControl(e.target.value === "0" ? null : Number(e.target.value))}
                  className="mt-1 w-full px-3 py-2.5 rounded-xl bg-background/50 border border-border/60 text-sm"
                >
                  <option value="0">Unlimited</option>
                  <option value="60">1 min bullet</option>
                  <option value="180">3 min blitz</option>
                  <option value="300">5 min blitz</option>
                  <option value="600">10 min rapid</option>
                  <option value="1800">30 min classical</option>
                </select>
              </div>

              <div className="grid gap-2">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={chatEnabled} onChange={(e) => setChatEnabled(e.target.checked)} className="accent-primary" />
                  Lobby chat
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={spectators} onChange={(e) => setSpectators(e.target.checked)} className="accent-primary" />
                  Allow spectators
                </label>
              </div>
            </div>

            <button
              onClick={create}
              disabled={creating}
              className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-glow px-4 py-3 font-semibold text-primary-foreground shadow-[var(--shadow-glow)] hover:opacity-90 transition disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> {creating ? "Creating…" : "Create lobby"}
            </button>
          </div>
        )}

        {tab === "join" && (
          <div className="mt-6 glass rounded-3xl border border-border/60 p-5 sm:p-6 max-w-lg">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <KeyRound className="h-4 w-4" /> Enter a 6-character lobby code
            </div>
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 8))}
              placeholder="ABC123"
              className="mt-3 w-full px-4 py-3 rounded-xl bg-background/50 border border-border/60 text-center tracking-[0.4em] font-mono text-lg uppercase focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button
              onClick={joinByCode}
              className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-glow px-4 py-3 font-semibold text-primary-foreground shadow-[var(--shadow-glow)] hover:opacity-90"
            >
              Join lobby
            </button>
            <div className="mt-4 text-xs text-muted-foreground flex items-center gap-2">
              <Copy className="h-3 w-3" /> Tip: hosts can share their code from the lobby screen.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

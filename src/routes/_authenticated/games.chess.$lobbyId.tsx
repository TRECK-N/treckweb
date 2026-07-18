import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Chess } from "chess.js";
import { toast } from "sonner";
import {
  ArrowLeft, Copy, Crown, Users, MessageSquare, Send, Play, X, LogOut,
  Flag, Handshake, Palette, Shuffle, UserX, ShieldCheck, Lock, Globe, Check,
} from "lucide-react";
import { ChessBoard, type BoardTheme, pieceLabel } from "@/components/chess/chess-board";

export const Route = createFileRoute("/_authenticated/games/chess/$lobbyId")({
  component: ChessLobbyPage,
});

type Lobby = {
  id: string; host_id: string; name: string; is_public: boolean; code: string | null;
  max_players: number; status: string; chat_enabled: boolean; spectators_allowed: boolean;
  time_control_seconds: number | null; settings: Record<string, unknown>;
};
type Member = {
  id: string; lobby_id: string; user_id: string; role: string; team: string | null;
  is_ready: boolean; joined_at: string;
};
type Profile = { id: string; display_name: string | null; avatar_url: string | null };
type Game = {
  id: string; lobby_id: string; white_id: string | null; black_id: string | null;
  fen: string; pgn: string; turn: string; status: string; result: string | null;
  draw_offered_by: string | null;
};
type ChatMsg = { id: string; user_id: string; content: string; created_at: string };

function ChessLobbyPage() {
  const { lobbyId } = Route.useParams();
  const { user } = Route.useRouteContext() as { user: { id: string } };
  const nav = useNavigate();
  const qc = useQueryClient();
  const [theme, setTheme] = useState<BoardTheme>("emerald");

  const { data: lobby } = useQuery({
    queryKey: ["chess-lobby", lobbyId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("chess_lobbies").select("*").eq("id", lobbyId).maybeSingle();
      if (error) throw error;
      return data as Lobby | null;
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ["chess-members", lobbyId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("chess_lobby_members")
        .select("*").eq("lobby_id", lobbyId).order("joined_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Member[];
    },
  });

  const memberIds = useMemo(() => members.map((m) => m.user_id), [members]);
  const { data: profiles = [] } = useQuery({
    queryKey: ["chess-profiles", memberIds.join(",")],
    enabled: memberIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id,display_name,avatar_url").in("id", memberIds);
      return (data ?? []) as Profile[];
    },
  });
  const profileById = useMemo(() => {
    const m = new Map<string, Profile>();
    for (const p of profiles) m.set(p.id, p);
    return m;
  }, [profiles]);

  const { data: game } = useQuery({
    queryKey: ["chess-game", lobbyId],
    queryFn: async () => {
      const { data } = await (supabase as any).from("chess_games")
        .select("*").eq("lobby_id", lobbyId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      return (data ?? null) as Game | null;
    },
  });

  const { data: chat = [] } = useQuery({
    queryKey: ["chess-chat", lobbyId],
    queryFn: async () => {
      const { data } = await (supabase as any).from("chess_lobby_chat")
        .select("*").eq("lobby_id", lobbyId).order("created_at", { ascending: true }).limit(200);
      return (data ?? []) as ChatMsg[];
    },
  });

  // Auto-join as member if not already
  useEffect(() => {
    if (!lobby) return;
    const already = members.some((m) => m.user_id === user.id);
    if (already) return;
    (async () => {
      const playerCount = members.filter((m) => m.role === "player").length;
      const role = playerCount >= lobby.max_players ? "spectator" : "player";
      if (role === "spectator" && !lobby.spectators_allowed) {
        toast.error("Lobby is full and spectators aren't allowed");
        nav({ to: "/games/chess" });
        return;
      }
      const team = role === "player" ? (playerCount === 0 ? "white" : "black") : null;
      const { error } = await (supabase as any).from("chess_lobby_members")
        .insert({ lobby_id: lobbyId, user_id: user.id, role, team });
      if (error) toast.error(error.message);
    })();
  }, [lobby, members, user.id, lobbyId, nav]);

  // Realtime subscriptions
  useEffect(() => {
    const ch = (supabase as any)
      .channel(`chess-lobby-${lobbyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chess_lobbies", filter: `id=eq.${lobbyId}` }, () => {
        qc.invalidateQueries({ queryKey: ["chess-lobby", lobbyId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "chess_lobby_members", filter: `lobby_id=eq.${lobbyId}` }, () => {
        qc.invalidateQueries({ queryKey: ["chess-members", lobbyId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "chess_games", filter: `lobby_id=eq.${lobbyId}` }, () => {
        qc.invalidateQueries({ queryKey: ["chess-game", lobbyId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "chess_lobby_chat", filter: `lobby_id=eq.${lobbyId}` }, () => {
        qc.invalidateQueries({ queryKey: ["chess-chat", lobbyId] });
      })
      .subscribe();
    return () => { (supabase as any).removeChannel(ch); };
  }, [lobbyId, qc]);

  if (!lobby) {
    return (
      <div className="p-10 text-center text-muted-foreground">
        Loading lobby…
        <div className="mt-4">
          <Link to="/games/chess" className="text-primary hover:underline">Back to ChessFriends</Link>
        </div>
      </div>
    );
  }

  const isHost = lobby.host_id === user.id;
  const myMember = members.find((m) => m.user_id === user.id);
  const players = members.filter((m) => m.role === "player");
  const spectators = members.filter((m) => m.role === "spectator");
  const allReady = players.length >= 2 && players.every((p) => p.is_ready || p.user_id === lobby.host_id);

  const copyCode = () => {
    if (!lobby.code) return;
    navigator.clipboard.writeText(lobby.code);
    toast.success("Code copied");
  };

  const toggleReady = async () => {
    if (!myMember) return;
    await (supabase as any).from("chess_lobby_members")
      .update({ is_ready: !myMember.is_ready }).eq("id", myMember.id);
  };

  const leaveLobby = async () => {
    if (!myMember) { nav({ to: "/games/chess" }); return; }
    await (supabase as any).from("chess_lobby_members").delete().eq("id", myMember.id);
    if (isHost) {
      await (supabase as any).from("chess_lobbies").update({ status: "closed" }).eq("id", lobbyId);
    }
    nav({ to: "/games/chess" });
  };

  const closeLobby = async () => {
    await (supabase as any).from("chess_lobbies").delete().eq("id", lobbyId);
    nav({ to: "/games/chess" });
  };

  const kick = async (memberId: string) => {
    await (supabase as any).from("chess_lobby_members").delete().eq("id", memberId);
  };

  const transferHost = async (userId: string) => {
    await (supabase as any).from("chess_lobbies").update({ host_id: userId }).eq("id", lobbyId);
    toast.success("Host transferred");
  };

  const startGame = async () => {
    if (players.length < 2) { toast.error("Need at least 2 players"); return; }
    // Assign white/black by team, fallback to joined order
    const white = players.find((p) => p.team === "white") ?? players[0];
    const black = players.find((p) => p.team === "black" && p.user_id !== white.user_id) ?? players.find((p) => p.user_id !== white.user_id)!;
    const { error } = await (supabase as any).from("chess_games").insert({
      lobby_id: lobbyId,
      white_id: white.user_id,
      black_id: black.user_id,
    });
    if (error) { toast.error(error.message); return; }
    await (supabase as any).from("chess_lobbies").update({ status: "playing" }).eq("id", lobbyId);
  };

  const swapColors = async () => {
    if (players.length < 2) return;
    const w = players.find((p) => p.team === "white");
    const b = players.find((p) => p.team === "black");
    if (w && b) {
      await (supabase as any).from("chess_lobby_members").update({ team: "black" }).eq("id", w.id);
      await (supabase as any).from("chess_lobby_members").update({ team: "white" }).eq("id", b.id);
    }
  };

  return (
    <div className="relative min-h-full">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="relative p-3 sm:p-5 lg:p-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-between gap-2 mb-4">
          <Link to="/games/chess" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <div className="flex items-center gap-2">
            <button onClick={leaveLobby} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs bg-destructive/10 text-destructive hover:bg-destructive/20 transition">
              <LogOut className="h-3.5 w-3.5" /> Leave
            </button>
            {isHost && (
              <button onClick={closeLobby} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs bg-destructive text-destructive-foreground hover:opacity-90 transition">
                <X className="h-3.5 w-3.5" /> Close lobby
              </button>
            )}
          </div>
        </div>

        <div className="glass rounded-3xl border border-border/60 p-4 sm:p-5 mb-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-amber-500 to-rose-500 grid place-items-center text-white">
              <Crown className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-lg font-semibold truncate">{lobby.name}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1">{lobby.is_public ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}{lobby.is_public ? "Public" : "Private"}</span>
                <span>·</span>
                <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{players.length}/{lobby.max_players}</span>
                <span>·</span>
                <span>{lobby.time_control_seconds ? `${Math.round(lobby.time_control_seconds / 60)} min` : "Unlimited"}</span>
                <span>·</span>
                <span className={lobby.status === "playing" ? "text-amber-500" : "text-emerald-500"}>{lobby.status}</span>
              </div>
            </div>
            {!lobby.is_public && lobby.code && (
              <button onClick={copyCode} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 bg-background/60 border border-border/60 text-sm font-mono tracking-widest hover:bg-accent/60 transition">
                <Copy className="h-3.5 w-3.5" /> {lobby.code}
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <div className="min-w-0">
            {game && game.status === "active" ? (
              <GameView
                game={game}
                lobby={lobby}
                userId={user.id}
                theme={theme}
                onThemeChange={setTheme}
                profileById={profileById}
              />
            ) : game && game.status !== "active" ? (
              <FinishedGameView game={game} theme={theme} profileById={profileById} isHost={isHost} lobbyId={lobbyId} />
            ) : (
              <WaitingRoom
                members={members} players={players} spectators={spectators}
                profileById={profileById} lobby={lobby} isHost={isHost} me={user.id}
                onKick={kick} onTransferHost={transferHost} onToggleReady={toggleReady}
                onStart={startGame} onSwapColors={swapColors} allReady={allReady}
                myMember={myMember}
              />
            )}
          </div>

          {lobby.chat_enabled && (
            <ChatPanel lobbyId={lobbyId} userId={user.id} messages={chat} profileById={profileById} />
          )}
        </div>
      </div>
    </div>
  );
}

function WaitingRoom({
  players, spectators, profileById, lobby, isHost, me,
  onKick, onTransferHost, onToggleReady, onStart, onSwapColors, allReady, myMember,
}: {
  members: Member[]; players: Member[]; spectators: Member[];
  profileById: Map<string, Profile>; lobby: Lobby; isHost: boolean; me: string;
  onKick: (id: string) => void; onTransferHost: (uid: string) => void; onToggleReady: () => void;
  onStart: () => void; onSwapColors: () => void; allReady: boolean; myMember?: Member;
}) {
  return (
    <div className="glass rounded-3xl border border-border/60 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="font-semibold">Waiting room</div>
        {isHost && (
          <button onClick={onSwapColors} className="inline-flex items-center gap-1.5 text-xs rounded-full px-3 py-1.5 bg-accent hover:bg-accent/70">
            <Shuffle className="h-3 w-3" /> Swap colors
          </button>
        )}
      </div>

      <div className="space-y-2">
        {players.map((m) => {
          const p = profileById.get(m.user_id);
          const name = p?.display_name ?? "Player";
          const isHostRow = m.user_id === lobby.host_id;
          return (
            <div key={m.id} className="flex items-center gap-3 p-3 rounded-2xl bg-background/40 border border-border/60">
              <div className={`h-9 w-9 rounded-full grid place-items-center overflow-hidden text-xs font-bold ${m.team === "white" ? "bg-white text-slate-900" : "bg-slate-900 text-white"}`}>
                {p?.avatar_url ? <img src={p.avatar_url} className="h-full w-full object-cover" alt="" /> : name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate flex items-center gap-1.5">
                  {name} {isHostRow && <Crown className="h-3.5 w-3.5 text-amber-500" />}
                </div>
                <div className="text-xs text-muted-foreground capitalize">{m.team ?? "team"} · {m.is_ready ? "Ready" : "Not ready"}</div>
              </div>
              {m.user_id === me ? (
                <button onClick={onToggleReady}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs ${m.is_ready ? "bg-emerald-500/15 text-emerald-500" : "bg-accent hover:bg-accent/70"}`}>
                  <Check className="h-3 w-3" /> {m.is_ready ? "Ready" : "Ready up"}
                </button>
              ) : isHost ? (
                <div className="flex gap-1">
                  <button onClick={() => onTransferHost(m.user_id)} title="Transfer host"
                    className="p-1.5 rounded-lg hover:bg-accent"><ShieldCheck className="h-3.5 w-3.5" /></button>
                  <button onClick={() => onKick(m.id)} title="Kick"
                    className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive"><UserX className="h-3.5 w-3.5" /></button>
                </div>
              ) : null}
            </div>
          );
        })}

        {spectators.length > 0 && (
          <>
            <div className="pt-3 pb-1 text-xs uppercase tracking-wider text-muted-foreground">Spectators</div>
            {spectators.map((m) => {
              const p = profileById.get(m.user_id);
              return (
                <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-2xl bg-background/30 border border-border/60">
                  <div className="h-8 w-8 rounded-full bg-muted grid place-items-center text-xs">
                    {p?.avatar_url ? <img src={p.avatar_url} className="h-full w-full object-cover rounded-full" alt="" /> : (p?.display_name ?? "S").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 text-sm">{p?.display_name ?? "Spectator"}</div>
                  {isHost && (
                    <button onClick={() => onKick(m.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive">
                      <UserX className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>

      {isHost && (
        <button
          onClick={onStart}
          disabled={players.length < 2}
          className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-glow px-4 py-3 font-semibold text-primary-foreground shadow-[var(--shadow-glow)] hover:opacity-90 disabled:opacity-50 transition"
        >
          <Play className="h-4 w-4" /> Start game {allReady ? "" : players.length < 2 ? "(need 2 players)" : "(some players not ready)"}
        </button>
      )}
      {!isHost && (
        <div className="mt-5 text-center text-xs text-muted-foreground">Waiting for host to start the game…</div>
      )}
    </div>
  );
}

function GameView({
  game, lobby, userId, theme, onThemeChange, profileById,
}: {
  game: Game; lobby: Lobby; userId: string; theme: BoardTheme;
  onThemeChange: (t: BoardTheme) => void; profileById: Map<string, Profile>;
}) {
  const isWhite = game.white_id === userId;
  const isBlack = game.black_id === userId;
  const isPlayer = isWhite || isBlack;
  const orientation: "white" | "black" = isBlack ? "black" : "white";
  const chess = useMemo(() => { const c = new Chess(); try { c.load(game.fen); } catch { /*noop*/ } return c; }, [game.fen]);
  const myTurn = isPlayer && chess.turn() === (isWhite ? "w" : "b");
  const disabled = !isPlayer || !myTurn || game.status !== "active";

  const [lastMove, setLastMove] = useState<{ from: any; to: any } | null>(null);

  const history = useMemo(() => {
    const c = new Chess();
    if (game.pgn) { try { c.loadPgn(game.pgn); } catch { /*noop*/ } }
    return c.history({ verbose: true }) as Array<{ san: string; color: "w" | "b"; captured?: string; piece: string; from: any; to: any }>;
  }, [game.pgn]);

  useEffect(() => {
    if (history.length > 0) {
      const last = history[history.length - 1];
      setLastMove({ from: last.from, to: last.to });
    } else setLastMove(null);
  }, [history.length]);

  const capturedByWhite = history.filter((h) => h.color === "w" && h.captured).map((h) => ({ color: "b" as const, type: h.captured as any }));
  const capturedByBlack = history.filter((h) => h.color === "b" && h.captured).map((h) => ({ color: "w" as const, type: h.captured as any }));

  const handleMove = async (m: { from: any; to: any; san: string; fen: string; pgn: string }) => {
    setLastMove({ from: m.from, to: m.to });
    const c2 = new Chess(); c2.load(m.fen);
    let status = "active"; let result: string | null = null;
    if (c2.isCheckmate()) { status = "checkmate"; result = c2.turn() === "w" ? "0-1" : "1-0"; }
    else if (c2.isDraw() || c2.isStalemate() || c2.isThreefoldRepetition() || c2.isInsufficientMaterial()) { status = "draw"; result = "1/2-1/2"; }
    await (supabase as any).from("chess_games").update({
      fen: m.fen, pgn: m.pgn, turn: c2.turn(), status, result, draw_offered_by: null,
    }).eq("id", game.id);
    if (status !== "active") {
      await (supabase as any).from("chess_lobbies").update({ status: "waiting" }).eq("id", lobby.id);
    }
  };

  const resign = async () => {
    if (!isPlayer) return;
    const result = isWhite ? "0-1" : "1-0";
    await (supabase as any).from("chess_games").update({ status: "resigned", result }).eq("id", game.id);
    await (supabase as any).from("chess_lobbies").update({ status: "waiting" }).eq("id", lobby.id);
    toast.info("You resigned");
  };

  const offerDraw = async () => {
    if (!isPlayer) return;
    if (game.draw_offered_by && game.draw_offered_by !== userId) {
      await (supabase as any).from("chess_games").update({ status: "draw", result: "1/2-1/2", draw_offered_by: null }).eq("id", game.id);
      await (supabase as any).from("chess_lobbies").update({ status: "waiting" }).eq("id", lobby.id);
      toast.success("Draw accepted");
    } else {
      await (supabase as any).from("chess_games").update({ draw_offered_by: userId }).eq("id", game.id);
      toast.info("Draw offer sent");
    }
  };

  const whiteName = profileById.get(game.white_id ?? "")?.display_name ?? "White";
  const blackName = profileById.get(game.black_id ?? "")?.display_name ?? "Black";

  return (
    <div className="glass rounded-3xl border border-border/60 p-4 sm:p-5">
      <div className="flex items-center gap-2 justify-between mb-3">
        <PlayerBar name={orientation === "white" ? blackName : whiteName} color={orientation === "white" ? "b" : "w"} captured={orientation === "white" ? capturedByBlack : capturedByWhite} isTurn={chess.turn() === (orientation === "white" ? "b" : "w")} />
        <ThemePicker theme={theme} onChange={onThemeChange} />
      </div>

      <ChessBoard
        fen={game.fen}
        orientation={orientation}
        theme={theme}
        disabled={disabled}
        onMove={handleMove}
        lastMove={lastMove}
      />

      <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
        <PlayerBar name={orientation === "white" ? whiteName : blackName} color={orientation === "white" ? "w" : "b"} captured={orientation === "white" ? capturedByWhite : capturedByBlack} isTurn={chess.turn() === (orientation === "white" ? "w" : "b")} />
        {isPlayer && game.status === "active" && (
          <div className="flex gap-2">
            <button onClick={offerDraw} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs bg-accent hover:bg-accent/70">
              <Handshake className="h-3.5 w-3.5" /> {game.draw_offered_by && game.draw_offered_by !== userId ? "Accept draw" : "Offer draw"}
            </button>
            <button onClick={resign} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs bg-destructive/10 text-destructive hover:bg-destructive/20">
              <Flag className="h-3.5 w-3.5" /> Resign
            </button>
          </div>
        )}
      </div>

      {game.draw_offered_by && game.status === "active" && (
        <div className="mt-3 text-xs text-center text-muted-foreground">
          {game.draw_offered_by === userId ? "Draw offer sent — waiting for opponent." : "Opponent offered a draw."}
        </div>
      )}

      <MoveHistory history={history} />
    </div>
  );
}

function FinishedGameView({ game, theme, profileById, isHost, lobbyId }: { game: Game; theme: BoardTheme; profileById: Map<string, Profile>; isHost: boolean; lobbyId: string }) {
  const whiteName = profileById.get(game.white_id ?? "")?.display_name ?? "White";
  const blackName = profileById.get(game.black_id ?? "")?.display_name ?? "Black";
  const winnerLabel = game.result === "1-0" ? `${whiteName} wins` : game.result === "0-1" ? `${blackName} wins` : "Draw";
  const rematch = async () => {
    await (supabase as any).from("chess_games").insert({
      lobby_id: lobbyId, white_id: game.black_id, black_id: game.white_id,
    });
    await (supabase as any).from("chess_lobbies").update({ status: "playing" }).eq("id", lobbyId);
  };
  return (
    <div className="glass rounded-3xl border border-border/60 p-5">
      <div className="text-center mb-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{game.status}</div>
        <div className="text-2xl font-bold mt-1">{winnerLabel}</div>
      </div>
      <ChessBoard fen={game.fen} theme={theme} disabled />
      {isHost && (
        <button onClick={rematch} className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-glow px-4 py-3 font-semibold text-primary-foreground shadow-[var(--shadow-glow)]">
          <Play className="h-4 w-4" /> Rematch (swap colors)
        </button>
      )}
    </div>
  );
}

function PlayerBar({ name, color, captured, isTurn }: {
  name: string; color: "w" | "b";
  captured: Array<{ color: "w" | "b"; type: any }>; isTurn: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 p-2 pr-3 rounded-2xl border ${isTurn ? "border-primary/60 bg-primary/5" : "border-border/60 bg-background/40"}`}>
      <div className={`h-8 w-8 rounded-full grid place-items-center text-xs font-bold ${color === "w" ? "bg-white text-slate-900" : "bg-slate-900 text-white"}`}>
        {name.slice(0, 2).toUpperCase()}
      </div>
      <div>
        <div className="text-sm font-medium leading-tight">{name}</div>
        <div className="text-[10px] text-muted-foreground leading-tight flex items-center gap-0.5 h-4">
          {captured.length === 0 ? "—" : captured.map((c, i) => (
            <span key={i} className={c.color === "w" ? "text-slate-300" : "text-slate-700 dark:text-slate-200"}>
              {pieceLabel(c.color, c.type)}
            </span>
          ))}
        </div>
      </div>
      {isTurn && <span className="ml-2 text-[10px] uppercase tracking-widest text-primary font-bold">to move</span>}
    </div>
  );
}

function MoveHistory({ history }: { history: Array<{ san: string; color: "w" | "b" }> }) {
  const pairs: Array<{ n: number; w?: string; b?: string }> = [];
  history.forEach((h, i) => {
    const idx = Math.floor(i / 2);
    pairs[idx] ??= { n: idx + 1 };
    if (h.color === "w") pairs[idx].w = h.san;
    else pairs[idx].b = h.san;
  });
  return (
    <div className="mt-4 max-h-32 overflow-y-auto rounded-xl bg-background/30 border border-border/60 p-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Moves</div>
      {pairs.length === 0 ? (
        <div className="text-xs text-muted-foreground">No moves yet.</div>
      ) : (
        <div className="grid grid-cols-[auto_1fr_1fr] gap-x-3 gap-y-1 text-sm font-mono">
          {pairs.map((p) => (
            <div key={p.n} className="contents">
              <div className="text-muted-foreground">{p.n}.</div>
              <div>{p.w ?? ""}</div>
              <div>{p.b ?? ""}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ThemePicker({ theme, onChange }: { theme: BoardTheme; onChange: (t: BoardTheme) => void }) {
  const themes: BoardTheme[] = ["classic", "emerald", "midnight", "rose"];
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs bg-accent hover:bg-accent/70">
        <Palette className="h-3.5 w-3.5" /> Theme
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="absolute right-0 mt-2 w-40 rounded-xl bg-popover border border-border/60 shadow-lg z-10 p-1"
          >
            {themes.map((t) => (
              <button key={t} onClick={() => { onChange(t); setOpen(false); }}
                className={`w-full text-left px-3 py-1.5 text-xs rounded-lg capitalize ${theme === t ? "bg-primary/10 text-primary" : "hover:bg-accent"}`}>
                {t}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ChatPanel({ lobbyId, userId, messages, profileById }: {
  lobbyId: string; userId: string; messages: ChatMsg[]; profileById: Map<string, Profile>;
}) {
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);
  const send = async () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    await (supabase as any).from("chess_lobby_chat").insert({ lobby_id: lobbyId, user_id: userId, content: t });
  };
  return (
    <div className="glass rounded-3xl border border-border/60 flex flex-col h-[560px] lg:h-auto lg:min-h-[560px] lg:max-h-[calc(100vh-9rem)]">
      <div className="p-4 border-b border-border/60 flex items-center gap-2 text-sm font-semibold">
        <MessageSquare className="h-4 w-4" /> Lobby chat
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-6">Say hi to your opponents 👋</div>
        ) : messages.map((m) => {
          const p = profileById.get(m.user_id);
          const mine = m.user_id === userId;
          return (
            <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
              <div className="h-7 w-7 rounded-full bg-muted shrink-0 overflow-hidden grid place-items-center text-[10px] font-bold">
                {p?.avatar_url ? <img src={p.avatar_url} className="h-full w-full object-cover" alt="" /> : (p?.display_name ?? "?").slice(0, 2).toUpperCase()}
              </div>
              <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-accent"}`}>
                {!mine && <div className="text-[10px] opacity-70 mb-0.5">{p?.display_name ?? "Player"}</div>}
                {m.content}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <div className="p-3 border-t border-border/60 flex gap-2">
        <input
          value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          placeholder="Message"
          className="flex-1 px-3 py-2 rounded-xl bg-background/50 border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button onClick={send} className="h-9 w-9 grid place-items-center rounded-xl bg-primary text-primary-foreground hover:opacity-90">
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

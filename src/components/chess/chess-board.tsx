import { useMemo, useState } from "react";
import { Chess, type Square, type PieceSymbol, type Color } from "chess.js";
import { motion, AnimatePresence } from "framer-motion";

const PIECE_UNICODE: Record<Color, Record<PieceSymbol, string>> = {
  w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
  b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" },
};

export type BoardTheme = "classic" | "emerald" | "midnight" | "rose";
const THEMES: Record<BoardTheme, { light: string; dark: string; ring: string }> = {
  classic: { light: "bg-[#f0d9b5]", dark: "bg-[#b58863]", ring: "ring-amber-400" },
  emerald: { light: "bg-[#eeeed2]", dark: "bg-[#4b7f52]", ring: "ring-emerald-400" },
  midnight: { light: "bg-slate-300", dark: "bg-slate-700", ring: "ring-primary" },
  rose: { light: "bg-rose-100", dark: "bg-rose-500/80", ring: "ring-rose-400" },
};

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const RANKS = [8, 7, 6, 5, 4, 3, 2, 1] as const;

export function ChessBoard({
  fen,
  orientation = "white",
  theme = "classic",
  disabled = false,
  onMove,
  lastMove,
}: {
  fen: string;
  orientation?: "white" | "black";
  theme?: BoardTheme;
  disabled?: boolean;
  onMove?: (m: { from: Square; to: Square; promotion?: "q" | "r" | "b" | "n"; san: string; fen: string; pgn: string }) => void;
  lastMove?: { from: Square; to: Square } | null;
}) {
  const chess = useMemo(() => {
    const c = new Chess();
    try { c.load(fen); } catch { /* ignore */ }
    return c;
  }, [fen]);

  const [selected, setSelected] = useState<Square | null>(null);
  const legal = useMemo(() => {
    if (!selected) return [] as { from: Square; to: Square; promotion?: string }[];
    return chess.moves({ square: selected, verbose: true }) as unknown as { from: Square; to: Square; promotion?: string }[];
  }, [selected, chess]);
  const legalTargets = useMemo(() => new Set(legal.map((m) => m.to)), [legal]);

  const files = orientation === "white" ? FILES : [...FILES].reverse();
  const ranks = orientation === "white" ? RANKS : [...RANKS].reverse();

  const board = chess.board();
  const getPiece = (sq: Square) => {
    const fileIdx = FILES.indexOf(sq[0] as (typeof FILES)[number]);
    const rankIdx = 8 - Number(sq[1]);
    return board[rankIdx][fileIdx];
  };

  const themed = THEMES[theme];

  const onSquare = (sq: Square) => {
    if (disabled) return;
    const piece = getPiece(sq);
    if (selected) {
      if (sq === selected) { setSelected(null); return; }
      const match = legal.find((m) => m.to === sq);
      if (match) {
        const moved = chess.move({ from: selected, to: sq, promotion: match.promotion ?? "q" });
        if (moved) {
          onMove?.({
            from: selected, to: sq, promotion: (match.promotion as "q" | "r" | "b" | "n" | undefined),
            san: moved.san, fen: chess.fen(), pgn: chess.pgn(),
          });
        }
        setSelected(null);
        return;
      }
      if (piece && piece.color === chess.turn()) { setSelected(sq); return; }
      setSelected(null);
      return;
    }
    if (piece && piece.color === chess.turn()) setSelected(sq);
  };

  const inCheckSquare: Square | null = useMemo(() => {
    if (!chess.inCheck()) return null;
    const turn = chess.turn();
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const p = board[r][f];
      if (p && p.type === "k" && p.color === turn) return (FILES[f] + (8 - r)) as Square;
    }
    return null;
  }, [chess, board]);

  return (
    <div className="w-full max-w-[min(90vh,720px)] mx-auto">
      <div className="rounded-2xl overflow-hidden shadow-[var(--shadow-glow)] border border-border/60 aspect-square grid grid-cols-8 grid-rows-8 select-none">
        {ranks.map((rank) =>
          files.map((file) => {
            const sq = (file + rank) as Square;
            const piece = getPiece(sq);
            const isDark = (FILES.indexOf(file as (typeof FILES)[number]) + rank) % 2 === 0;
            const isSelected = selected === sq;
            const isTarget = legalTargets.has(sq);
            const isLast = lastMove && (lastMove.from === sq || lastMove.to === sq);
            const isCheck = inCheckSquare === sq;
            return (
              <button
                key={sq}
                onClick={() => onSquare(sq)}
                className={`relative flex items-center justify-center transition ${
                  isDark ? themed.dark : themed.light
                } ${isSelected ? `ring-4 ring-inset ${themed.ring}` : ""} ${
                  isLast ? "after:absolute after:inset-0 after:bg-yellow-300/30 after:pointer-events-none" : ""
                } ${isCheck ? "!bg-red-500/60" : ""}`}
                aria-label={sq}
              >
                {isTarget && !piece && (
                  <div className="absolute h-1/3 w-1/3 rounded-full bg-black/25 dark:bg-white/25" />
                )}
                {isTarget && piece && (
                  <div className="absolute inset-1 rounded-full ring-4 ring-black/30 dark:ring-white/40 pointer-events-none" />
                )}
                <AnimatePresence mode="popLayout">
                  {piece && (
                    <motion.span
                      key={piece.color + piece.type + sq}
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.6, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 25 }}
                      className={`relative text-[clamp(1.5rem,7vw,4rem)] leading-none drop-shadow ${
                        piece.color === "w" ? "text-white" : "text-slate-900"
                      }`}
                      style={{ textShadow: piece.color === "w" ? "0 1px 2px rgba(0,0,0,0.6)" : "0 1px 2px rgba(255,255,255,0.3)" }}
                    >
                      {PIECE_UNICODE[piece.color][piece.type]}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

export function pieceLabel(color: Color, type: PieceSymbol) {
  return PIECE_UNICODE[color][type];
}

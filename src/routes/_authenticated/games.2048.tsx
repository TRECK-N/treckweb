import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Grid3x3, RotateCcw, Trophy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/games/2048")({
  head: () => ({
    meta: [
      { title: "2048 — WebuWeb Games" },
      { name: "description", content: "Slide the tiles, merge the numbers and chase the 2048 tile." },
      { property: "og:title", content: "2048 — WebuWeb Games" },
      { property: "og:description", content: "Slide the tiles, merge the numbers and chase the 2048 tile." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Game2048,
});

const SIZE = 4;
type Board = number[][];

function emptyBoard(): Board {
  return Array.from({ length: SIZE }, () => Array<number>(SIZE).fill(0));
}

function addTile(board: Board): Board {
  const spots: [number, number][] = [];
  board.forEach((row, r) => row.forEach((v, c) => v === 0 && spots.push([r, c])));
  if (!spots.length) return board;
  const [r, c] = spots[Math.floor(Math.random() * spots.length)];
  const next = board.map((row) => [...row]);
  next[r][c] = Math.random() < 0.9 ? 2 : 4;
  return next;
}

function slideRow(row: number[]): { row: number[]; gained: number } {
  const values = row.filter((v) => v !== 0);
  const out: number[] = [];
  let gained = 0;
  for (let i = 0; i < values.length; i++) {
    if (values[i] === values[i + 1]) {
      out.push(values[i] * 2);
      gained += values[i] * 2;
      i++;
    } else out.push(values[i]);
  }
  while (out.length < SIZE) out.push(0);
  return { row: out, gained };
}

function rotate(board: Board): Board {
  return board[0].map((_, c) => board.map((row) => row[c]).reverse());
}

function move(board: Board, dir: "left" | "right" | "up" | "down"): { board: Board; gained: number; moved: boolean; merged: string[] } {
  const turns = { left: 0, up: 1, right: 2, down: 3 }[dir];
  let work = board.map((row) => [...row]);
  for (let i = 0; i < turns; i++) work = rotate(work);
  let gained = 0;
  work = work.map((row) => {
    const res = slideRow(row);
    gained += res.gained;
    return res.row;
  });
  for (let i = 0; i < (4 - turns) % 4; i++) work = rotate(work);
  const moved = JSON.stringify(work) !== JSON.stringify(board);
  const merged: string[] = [];
  work.forEach((row, r) => row.forEach((v, c) => { if (v && v !== board[r][c]) merged.push(`${r}-${c}`); }));
  return { board: work, gained, moved, merged };
}

function hasMoves(board: Board): boolean {
  return (["left", "right", "up", "down"] as const).some((d) => move(board, d).moved);
}

const TILE_STYLE: Record<number, string> = {
  2: "bg-slate-500/20 text-foreground",
  4: "bg-slate-500/30 text-foreground",
  8: "bg-amber-500/40 text-white",
  16: "bg-orange-500/50 text-white",
  32: "bg-rose-500/50 text-white",
  64: "bg-rose-600/60 text-white",
  128: "bg-fuchsia-500/60 text-white",
  256: "bg-purple-500/70 text-white",
  512: "bg-indigo-500/70 text-white",
  1024: "bg-cyan-500/70 text-white",
  2048: "bg-emerald-500/80 text-white",
};

function Game2048() {
  const [board, setBoard] = useState<Board>(() => addTile(addTile(emptyBoard())));
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [over, setOver] = useState(false);
  const [won, setWon] = useState(false);
  const [pop, setPop] = useState<string[]>([]);
  const [gain, setGain] = useState<{ id: number; value: number } | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("webuweb-2048-best");
    if (raw) setBest(Number(raw) || 0);
  }, []);

  const reset = () => {
    setBoard(addTile(addTile(emptyBoard())));
    setScore(0); setOver(false); setWon(false); setPop([]); setGain(null);
  };

  const doMove = useCallback((dir: "left" | "right" | "up" | "down") => {
    setBoard((prev) => {
      if (over) return prev;
      const res = move(prev, dir);
      if (!res.moved) return prev;
      const next = addTile(res.board);
      setPop(res.merged);
      if (res.gained) {
        setGain({ id: Date.now(), value: res.gained });
        setScore((s) => {
          const ns = s + res.gained;
          setBest((b) => {
            const nb = Math.max(b, ns);
            localStorage.setItem("webuweb-2048-best", String(nb));
            return nb;
          });
          return ns;
        });
      }
      if (next.some((row) => row.some((v) => v >= 2048))) setWon(true);
      if (!hasMoves(next)) setOver(true);
      return next;
    });
  }, [over]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, "left" | "right" | "up" | "down"> = {
        ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down",
        a: "left", d: "right", w: "up", s: "down",
      };
      const dir = map[e.key];
      if (dir) { e.preventDefault(); doMove(dir); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doMove]);

  return (
    <div className="relative min-h-full">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-24 h-96 w-96 rounded-full bg-amber-500/20 blur-3xl" />
      </div>

      <div className="relative p-4 sm:p-6 lg:p-10 max-w-xl mx-auto space-y-5">
        <Link to="/games" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Games
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-amber-500 to-rose-500 grid place-items-center text-white">
            <Grid3x3 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">2048</h1>
            <p className="text-sm text-muted-foreground">Arrows / WASD · swipe on mobile</p>
          </div>
          <div className="ml-auto flex gap-2 text-sm">
            <span className="rounded-full glass px-3 py-1.5 font-semibold">{score}</span>
            <span className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5">
              <Trophy className="h-3.5 w-3.5 text-amber-400" /> {best}
            </span>
            <button onClick={reset} className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 hover:bg-accent">
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div
          className="glass relative aspect-square w-full rounded-3xl p-3 touch-none select-none"
          onTouchStart={(e) => { const t = e.touches[0]; touchStart.current = { x: t.clientX, y: t.clientY }; }}
          onTouchEnd={(e) => {
            const s = touchStart.current; if (!s) return;
            const t = e.changedTouches[0];
            const dx = t.clientX - s.x, dy = t.clientY - s.y;
            if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
            doMove(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
          }}
        >
          <div className="grid h-full w-full grid-cols-4 grid-rows-4 gap-2">
            {board.flatMap((row, r) =>
              row.map((v, c) => (
                <motion.div
                  key={`${r}-${c}`}
                  animate={{ scale: v ? (pop.includes(`${r}-${c}`) ? [0.85, 1.12, 1] : 1) : 0.9 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className={`grid place-items-center rounded-2xl text-xl font-bold sm:text-2xl ${
                    v ? TILE_STYLE[v] ?? "bg-emerald-600/80 text-white" : "bg-foreground/[0.05]"
                  }`}
                >
                  {v || ""}
                </motion.div>
              )),
            )}
          </div>

          <AnimatePresence>
            {gain && (
              <motion.span
                key={gain.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: -18 }}
                exit={{ opacity: 0, y: -34 }}
                transition={{ duration: 0.55 }}
                onAnimationComplete={() => setGain(null)}
                className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 text-lg font-bold text-amber-400"
              >
                +{gain.value}
              </motion.span>
            )}
          </AnimatePresence>

          {(over || won) && (
            <div className="absolute inset-0 grid place-items-center rounded-3xl bg-background/75 backdrop-blur-sm">
              <div className="text-center">
                <p className="text-2xl font-bold">{over ? "No moves left" : "You made 2048!"}</p>
                <p className="mt-1 text-sm text-muted-foreground">Score {score}</p>
                <div className="mt-4 flex justify-center gap-2">
                  <button onClick={reset} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">
                    New game
                  </button>
                  {won && !over && (
                    <button onClick={() => setWon(false)} className="rounded-xl glass px-5 py-2.5 text-sm hover:bg-accent">
                      Keep going
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

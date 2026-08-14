import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Bomb, Flag, RotateCcw, Timer } from "lucide-react";

export const Route = createFileRoute("/_authenticated/games/minesweeper")({
  head: () => ({
    meta: [
      { title: "Minesweeper — WebuWeb Games" },
      { name: "description", content: "Classic Minesweeper with three difficulties, flags and a timer." },
      { property: "og:title", content: "Minesweeper — WebuWeb Games" },
      { property: "og:description", content: "Classic Minesweeper with three difficulties, flags and a timer." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Minesweeper,
});

const LEVELS = {
  easy: { cols: 9, rows: 9, mines: 10 },
  medium: { cols: 12, rows: 12, mines: 22 },
  hard: { cols: 16, rows: 16, mines: 45 },
} as const;
type Level = keyof typeof LEVELS;

type Cell = { mine: boolean; revealed: boolean; flagged: boolean; adjacent: number };

function buildBoard(level: Level, safeIndex: number | null): Cell[] {
  const { cols, rows, mines } = LEVELS[level];
  const total = cols * rows;
  const cells: Cell[] = Array.from({ length: total }, () => ({ mine: false, revealed: false, flagged: false, adjacent: 0 }));
  let placed = 0;
  while (placed < mines) {
    const i = Math.floor(Math.random() * total);
    if (cells[i].mine || i === safeIndex) continue;
    cells[i].mine = true;
    placed++;
  }
  for (let i = 0; i < total; i++) {
    if (cells[i].mine) continue;
    cells[i].adjacent = neighbors(i, cols, rows).filter((n) => cells[n].mine).length;
  }
  return cells;
}

function neighbors(i: number, cols: number, rows: number): number[] {
  const r = Math.floor(i / cols), c = i % cols;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
      out.push(nr * cols + nc);
    }
  }
  return out;
}

const NUM_COLOR = ["", "text-sky-400", "text-emerald-400", "text-rose-400", "text-indigo-400", "text-amber-400", "text-cyan-400", "text-fuchsia-400", "text-muted-foreground"];

function Minesweeper() {
  const [level, setLevel] = useState<Level>("easy");
  const { cols, rows, mines } = LEVELS[level];
  const [cells, setCells] = useState<Cell[]>(() => buildBoard("easy", null));
  const [started, setStarted] = useState(false);
  const [dead, setDead] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const won = useMemo(
    () => !dead && cells.length > 0 && cells.every((c) => c.revealed || c.mine),
    [cells, dead],
  );

  useEffect(() => {
    if (!started || dead || won) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [started, dead, won]);

  const reset = (next: Level = level) => {
    setLevel(next);
    setCells(buildBoard(next, null));
    setStarted(false); setDead(false); setSeconds(0);
  };

  const reveal = (index: number) => {
    if (dead || won) return;
    setCells((prev) => {
      let board = prev;
      if (!started) {
        board = buildBoard(level, index);
        setStarted(true);
      }
      if (board[index].flagged || board[index].revealed) return board;
      const next = board.map((c) => ({ ...c }));
      if (next[index].mine) {
        next.forEach((c) => { if (c.mine) c.revealed = true; });
        setDead(true);
        return next;
      }
      const stack = [index];
      while (stack.length) {
        const i = stack.pop()!;
        if (next[i].revealed || next[i].flagged) continue;
        next[i].revealed = true;
        if (next[i].adjacent === 0) stack.push(...neighbors(i, cols, rows).filter((n) => !next[n].revealed && !next[n].mine));
      }
      return next;
    });
  };

  const toggleFlag = (index: number) => {
    if (dead || won) return;
    setCells((prev) => prev.map((c, i) => (i === index && !c.revealed ? { ...c, flagged: !c.flagged } : c)));
  };

  const flags = cells.filter((c) => c.flagged).length;

  return (
    <div className="relative min-h-full">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-sky-500/20 blur-3xl" />
      </div>

      <div className="relative p-4 sm:p-6 lg:p-10 max-w-2xl mx-auto space-y-5">
        <Link to="/games" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Games
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-500 grid place-items-center text-white">
            <Bomb className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Minesweeper</h1>
            <p className="text-sm text-muted-foreground">Click to reveal · right-click (or long-press the flag button) to mark</p>
          </div>
          <div className="ml-auto flex gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5"><Flag className="h-3.5 w-3.5" /> {flags}/{mines}</span>
            <span className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5"><Timer className="h-3.5 w-3.5" /> {seconds}s</span>
            <button onClick={() => reset()} className="rounded-full glass px-3 py-1.5 hover:bg-accent"><RotateCcw className="h-3.5 w-3.5" /></button>
          </div>
        </div>

        <div className="flex gap-2">
          {(Object.keys(LEVELS) as Level[]).map((l) => (
            <button
              key={l}
              onClick={() => reset(l)}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium capitalize transition ${
                level === l ? "bg-primary text-primary-foreground" : "glass hover:bg-accent"
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        <div className="glass relative rounded-3xl p-3">
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {cells.map((cell, i) => (
              <button
                key={i}
                onClick={() => reveal(i)}
                onContextMenu={(e) => { e.preventDefault(); toggleFlag(i); }}
                className={`aspect-square rounded-md text-xs font-bold transition ${
                  cell.revealed
                    ? cell.mine ? "bg-destructive/70 text-white" : "bg-foreground/[0.06]"
                    : "bg-foreground/[0.12] hover:bg-foreground/[0.2]"
                } ${cell.revealed && !cell.mine ? NUM_COLOR[cell.adjacent] : ""}`}
              >
                {cell.revealed
                  ? cell.mine ? "💣" : cell.adjacent || ""
                  : cell.flagged ? "🚩" : ""}
              </button>
            ))}
          </div>

          {(dead || won) && (
            <div className="absolute inset-0 grid place-items-center rounded-3xl bg-background/75 backdrop-blur-sm">
              <div className="text-center">
                <p className="text-2xl font-bold">{won ? "Field cleared!" : "Boom."}</p>
                <p className="mt-1 text-sm text-muted-foreground">{won ? `In ${seconds}s` : "You hit a mine."}</p>
                <button onClick={() => reset()} className="mt-4 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">
                  Play again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

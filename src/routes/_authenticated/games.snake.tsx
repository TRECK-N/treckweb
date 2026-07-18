import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Pause, Play, RotateCcw, Trophy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/games/snake")({
  component: SnakeGame,
});

const COLS = 22;
const ROWS = 22;
const TICK_MS = 110;

type Point = { x: number; y: number };
type Dir = "up" | "down" | "left" | "right";

const START_SNAKE: Point[] = [
  { x: 10, y: 11 },
  { x: 9, y: 11 },
  { x: 8, y: 11 },
];

function randomFood(snake: Point[]): Point {
  while (true) {
    const p = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
    if (!snake.some((s) => s.x === p.x && s.y === p.y)) return p;
  }
}

const OPPOSITE: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left" };

function SnakeGame() {
  const [snake, setSnake] = useState<Point[]>(START_SNAKE);
  const [dir, setDir] = useState<Dir>("right");
  const dirRef = useRef<Dir>("right");
  const nextDirRef = useRef<Dir>("right");
  const [food, setFood] = useState<Point>(() => randomFood(START_SNAKE));
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => Number(localStorage.getItem("treck_snake_best") || 0));
  const [paused, setPaused] = useState(false);
  const [dead, setDead] = useState(false);

  const reset = useCallback(() => {
    setSnake(START_SNAKE);
    setDir("right");
    dirRef.current = "right";
    nextDirRef.current = "right";
    setFood(randomFood(START_SNAKE));
    setScore(0);
    setDead(false);
    setPaused(false);
  }, []);

  const changeDir = useCallback((d: Dir) => {
    if (OPPOSITE[d] === dirRef.current) return;
    nextDirRef.current = d;
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, Dir> = {
        ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
        w: "up", s: "down", a: "left", d: "right",
      };
      const d = map[e.key];
      if (d) { e.preventDefault(); changeDir(d); }
      if (e.key === " ") { e.preventDefault(); setPaused((p) => !p); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [changeDir]);

  useEffect(() => {
    if (paused || dead) return;
    const id = setInterval(() => {
      setSnake((prev) => {
        const nd = nextDirRef.current;
        dirRef.current = nd;
        setDir(nd);
        const head = prev[0];
        const nh = { ...head };
        if (nd === "up") nh.y--;
        if (nd === "down") nh.y++;
        if (nd === "left") nh.x--;
        if (nd === "right") nh.x++;

        if (nh.x < 0 || nh.y < 0 || nh.x >= COLS || nh.y >= ROWS) {
          setDead(true);
          return prev;
        }
        if (prev.some((s) => s.x === nh.x && s.y === nh.y)) {
          setDead(true);
          return prev;
        }
        const ate = nh.x === food.x && nh.y === food.y;
        const next = [nh, ...prev];
        if (!ate) next.pop();
        else {
          setScore((s) => {
            const ns = s + 1;
            setBest((b) => {
              if (ns > b) {
                localStorage.setItem("treck_snake_best", String(ns));
                return ns;
              }
              return b;
            });
            return ns;
          });
          setFood(randomFood(next));
        }
        return next;
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [paused, dead, food]);

  return (
    <div className="relative min-h-full p-6 lg:p-10 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Link to="/games" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition">
          <ArrowLeft className="h-4 w-4" /> Back to Games
        </Link>
        <div className="flex items-center gap-3">
          <div className="glass rounded-xl px-3 py-1.5 text-sm">
            Score <span className="font-bold tabular-nums">{score}</span>
          </div>
          <div className="glass rounded-xl px-3 py-1.5 text-sm inline-flex items-center gap-1.5">
            <Trophy className="h-3.5 w-3.5 text-amber-500" /> <span className="font-bold tabular-nums">{best}</span>
          </div>
        </div>
      </div>

      <div className="glass rounded-3xl p-4 sm:p-6">
        <div
          className="relative mx-auto rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-border/60"
          style={{ aspectRatio: `${COLS} / ${ROWS}`, maxWidth: 560 }}
        >
          <div
            className="absolute inset-0 grid"
            style={{ gridTemplateColumns: `repeat(${COLS},1fr)`, gridTemplateRows: `repeat(${ROWS},1fr)` }}
          >
            {snake.map((s, i) => (
              <motion.div
                key={i}
                layout
                className={`m-[1px] rounded-[3px] ${i === 0 ? "bg-primary" : "bg-primary/70"}`}
                style={{ gridColumn: s.x + 1, gridRow: s.y + 1 }}
              />
            ))}
            <div
              className="m-[3px] rounded-full bg-gradient-to-br from-fuchsia-500 to-rose-500 shadow-lg animate-pulse"
              style={{ gridColumn: food.x + 1, gridRow: food.y + 1 }}
            />
          </div>

          {(paused || dead) && (
            <div className="absolute inset-0 bg-background/70 backdrop-blur-sm grid place-items-center">
              <div className="text-center">
                <div className="text-2xl font-bold">{dead ? "Game Over" : "Paused"}</div>
                {dead && <div className="text-sm text-muted-foreground mt-1">Score {score} · Best {best}</div>}
                <button onClick={dead ? reset : () => setPaused(false)}
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
                  {dead ? <><RotateCcw className="h-4 w-4" /> Play again</> : <><Play className="h-4 w-4" /> Resume</>}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center justify-center gap-3">
          <button onClick={() => setPaused((p) => !p)} disabled={dead}
            className="inline-flex items-center gap-2 rounded-full glass px-4 py-2 text-sm font-medium hover:bg-accent/60 transition disabled:opacity-50">
            {paused ? <><Play className="h-4 w-4" /> Resume</> : <><Pause className="h-4 w-4" /> Pause</>}
          </button>
          <button onClick={reset}
            className="inline-flex items-center gap-2 rounded-full glass px-4 py-2 text-sm font-medium hover:bg-accent/60 transition">
            <RotateCcw className="h-4 w-4" /> Restart
          </button>
        </div>

        {/* Mobile pad */}
        <div className="mt-6 grid grid-cols-3 gap-2 max-w-[220px] mx-auto sm:hidden">
          <div />
          <button onClick={() => changeDir("up")} className="glass rounded-xl py-3 font-bold">▲</button>
          <div />
          <button onClick={() => changeDir("left")} className="glass rounded-xl py-3 font-bold">◀</button>
          <button onClick={() => setPaused((p) => !p)} className="glass rounded-xl py-3 text-xs">{paused ? "▶" : "❚❚"}</button>
          <button onClick={() => changeDir("right")} className="glass rounded-xl py-3 font-bold">▶</button>
          <div />
          <button onClick={() => changeDir("down")} className="glass rounded-xl py-3 font-bold">▼</button>
          <div />
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Use arrow keys or WASD · Space to pause · Direction: {dir}
        </p>
      </div>
    </div>
  );
}

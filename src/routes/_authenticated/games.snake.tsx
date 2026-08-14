import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Gamepad2, Pause, Play, RotateCcw, Trophy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/games/snake")({
  head: () => ({
    meta: [
      { title: "Snake — WebuWeb Games" },
      { name: "description", content: "Grid-perfect arcade Snake with speed levels, wrap mode and high scores." },
      { property: "og:title", content: "Snake — WebuWeb Games" },
      { property: "og:description", content: "Grid-perfect arcade Snake with speed levels, wrap mode and high scores." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SnakeGame,
});

const GRID = 20;
const SPEEDS = { chill: 160, normal: 110, insane: 70 } as const;
type Speed = keyof typeof SPEEDS;
type Point = { x: number; y: number };
type Dir = "up" | "down" | "left" | "right";

const DELTA: Record<Dir, Point> = {
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
};
const OPPOSITE: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left" };

function randomFood(snake: Point[]): Point {
  while (true) {
    const p = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
    if (!snake.some((s) => s.x === p.x && s.y === p.y)) return p;
  }
}

function SnakeGame() {
  const [snake, setSnake] = useState<Point[]>([{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }]);
  const [food, setFood] = useState<Point>({ x: 15, y: 10 });
  const [dir, setDir] = useState<Dir>("right");
  const [running, setRunning] = useState(false);
  const [dead, setDead] = useState(false);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [speed, setSpeed] = useState<Speed>("normal");
  const [wrap, setWrap] = useState(false);

  // Queue of turns so fast key presses within one tick are never dropped.
  const queue = useRef<Dir[]>([]);
  const dirRef = useRef<Dir>("right");
  dirRef.current = dir;

  useEffect(() => {
    const raw = localStorage.getItem("webuweb-snake-best");
    if (raw) setBest(Number(raw) || 0);
  }, []);

  const reset = useCallback(() => {
    setSnake([{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }]);
    setFood({ x: 15, y: 10 });
    setDir("right");
    queue.current = [];
    setScore(0);
    setDead(false);
    setRunning(false);
  }, []);

  const turn = useCallback((next: Dir) => {
    const last = queue.current[queue.current.length - 1] ?? dirRef.current;
    if (next === last || next === OPPOSITE[last]) return;
    queue.current.push(next);
    if (queue.current.length > 2) queue.current.shift();
    setRunning((r) => (dead ? r : true));
  }, [dead]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, Dir> = {
        ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
        w: "up", s: "down", a: "left", d: "right",
      };
      const next = map[e.key];
      if (next) { e.preventDefault(); turn(next); }
      if (e.key === " ") { e.preventDefault(); if (!dead) setRunning((r) => !r); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [turn, dead]);

  useEffect(() => {
    if (!running || dead) return;
    const id = setInterval(() => {
      setSnake((prev) => {
        const nextDir = queue.current.shift() ?? dirRef.current;
        dirRef.current = nextDir;
        setDir(nextDir);
        const d = DELTA[nextDir];
        let head = { x: prev[0].x + d.x, y: prev[0].y + d.y };

        if (wrap) {
          head = { x: (head.x + GRID) % GRID, y: (head.y + GRID) % GRID };
        } else if (head.x < 0 || head.y < 0 || head.x >= GRID || head.y >= GRID) {
          setDead(true); setRunning(false);
          return prev;
        }

        if (prev.some((s, i) => i !== prev.length - 1 && s.x === head.x && s.y === head.y)) {
          setDead(true); setRunning(false);
          return prev;
        }

        const ate = head.x === food.x && head.y === food.y;
        const next = [head, ...prev];
        if (ate) {
          setFood(randomFood(next));
          setScore((s) => {
            const ns = s + 1;
            setBest((b) => {
              const nb = Math.max(b, ns);
              localStorage.setItem("webuweb-snake-best", String(nb));
              return nb;
            });
            return ns;
          });
        } else {
          next.pop();
        }
        return next;
      });
    }, SPEEDS[speed]);
    return () => clearInterval(id);
  }, [running, dead, food, speed, wrap]);

  // Swipe controls
  const touchStart = useRef<Point | null>(null);

  return (
    <div className="relative min-h-full">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-emerald-500/20 blur-3xl" />
      </div>

      <div className="relative p-4 sm:p-6 lg:p-10 max-w-3xl mx-auto space-y-5">
        <Link to="/games" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Games
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 grid place-items-center text-white">
            <Gamepad2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Snake</h1>
            <p className="text-sm text-muted-foreground">Arrow keys or WASD · Space to pause · swipe on mobile</p>
          </div>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="rounded-full glass px-3 py-1.5 font-semibold">Score {score}</span>
            <span className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5">
              <Trophy className="h-3.5 w-3.5 text-amber-400" /> {best}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(SPEEDS) as Speed[]).map((s) => (
            <button
              key={s}
              onClick={() => { setSpeed(s); reset(); }}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium capitalize transition ${
                speed === s ? "bg-primary text-primary-foreground" : "glass hover:bg-accent"
              }`}
            >
              {s}
            </button>
          ))}
          <button
            onClick={() => { setWrap((w) => !w); reset(); }}
            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${wrap ? "bg-primary text-primary-foreground" : "glass hover:bg-accent"}`}
          >
            Wrap walls
          </button>
          <button onClick={() => setRunning((r) => !r)} disabled={dead}
            className="ml-auto inline-flex items-center gap-1.5 rounded-xl glass px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50">
            {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />} {running ? "Pause" : "Play"}
          </button>
          <button onClick={reset} className="inline-flex items-center gap-1.5 rounded-xl glass px-3 py-1.5 text-xs hover:bg-accent">
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </button>
        </div>

        <div
          className="glass relative aspect-square w-full overflow-hidden rounded-3xl p-2 select-none touch-none"
          onTouchStart={(e) => { const t = e.touches[0]; touchStart.current = { x: t.clientX, y: t.clientY }; }}
          onTouchEnd={(e) => {
            const s = touchStart.current; if (!s) return;
            const t = e.changedTouches[0];
            const dx = t.clientX - s.x, dy = t.clientY - s.y;
            if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
            turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
          }}
        >
          <div
            className="grid h-full w-full gap-[2px]"
            style={{ gridTemplateColumns: `repeat(${GRID}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${GRID}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: GRID * GRID }).map((_, i) => {
              const x = i % GRID, y = Math.floor(i / GRID);
              const isHead = snake[0].x === x && snake[0].y === y;
              const isBody = !isHead && snake.some((s) => s.x === x && s.y === y);
              const isFood = food.x === x && food.y === y;
              return (
                <div
                  key={i}
                  className={`rounded-[3px] transition-colors ${
                    isHead ? "bg-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.8)]"
                    : isBody ? "bg-emerald-500/80"
                    : isFood ? "bg-rose-400 shadow-[0_0_12px_rgba(251,113,133,0.8)]"
                    : (x + y) % 2 === 0 ? "bg-foreground/[0.03]" : "bg-foreground/[0.06]"
                  }`}
                />
              );
            })}
          </div>

          {(!running || dead) && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="absolute inset-0 grid place-items-center bg-background/70 backdrop-blur-sm">
              <div className="text-center">
                <p className="text-xl font-bold">{dead ? "Game over" : score > 0 ? "Paused" : "Ready?"}</p>
                <p className="mt-1 text-sm text-muted-foreground">{dead ? `You scored ${score}` : "Press an arrow key or Play"}</p>
                <button
                  onClick={() => (dead ? reset() : setRunning(true))}
                  className="mt-4 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
                >
                  {dead ? "Play again" : "Start"}
                </button>
              </div>
            </motion.div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 sm:hidden">
          <div />
          <button onClick={() => turn("up")} className="glass rounded-xl py-3">▲</button>
          <div />
          <button onClick={() => turn("left")} className="glass rounded-xl py-3">◀</button>
          <button onClick={() => turn("down")} className="glass rounded-xl py-3">▼</button>
          <button onClick={() => turn("right")} className="glass rounded-xl py-3">▶</button>
        </div>
      </div>
    </div>
  );
}

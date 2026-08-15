import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, RotateCcw, Trophy, Timer } from "lucide-react";

export const Route = createFileRoute("/_authenticated/games/memory")({
  component: MemoryGame,
});

type Difficulty = "easy" | "medium" | "hard";
const CONFIG: Record<Difficulty, { pairs: number; cols: number; peek: number; maxWidth: number }> = {
  easy: { pairs: 8, cols: 4, peek: 900, maxWidth: 480 },
  medium: { pairs: 12, cols: 6, peek: 750, maxWidth: 640 },
  hard: { pairs: 18, cols: 6, peek: 550, maxWidth: 720 },
};

const EMOJI = [
  "🚀","🌟","🎧","🎮","🍄","🍕","🐙","🦄","🍩","🎲","⚡","🌈",
  "🔥","🍀","👾","🌙","🎯","🧊","🍒","🛸","🐝","🎸","🧩","🪐",
];

type Card = { id: number; symbol: string; flipped: boolean; matched: boolean };

function makeDeck(pairs: number): Card[] {
  const symbols = EMOJI.slice(0, pairs);
  const deck = [...symbols, ...symbols]
    .map((s, i) => ({ id: i, symbol: s, flipped: false, matched: false }))
    .sort(() => Math.random() - 0.5)
    .map((c, i) => ({ ...c, id: i }));
  return deck;
}

function MemoryGame() {
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [deck, setDeck] = useState<Card[]>(() => makeDeck(CONFIG.easy.pairs));
  const [picked, setPicked] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [best, setBest] = useState<Record<Difficulty, number | null>>(() => {
    try { return JSON.parse(localStorage.getItem("treck_memory_best") || "{}"); } catch { return { easy: null, medium: null, hard: null }; }
  });

  const cols = CONFIG[difficulty].cols;
  const done = useMemo(() => deck.length > 0 && deck.every((c) => c.matched), [deck]);

  const reset = useCallback((d: Difficulty = difficulty) => {
    setDeck(makeDeck(CONFIG[d].pairs));
    setPicked([]);
    setMoves(0);
    setSeconds(0);
    setRunning(false);
  }, [difficulty]);

  useEffect(() => {
    if (!running || done) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running, done]);

  useEffect(() => {
    if (done && seconds > 0) {
      setBest((prev) => {
        const b = prev[difficulty];
        if (b == null || seconds < b) {
          const next = { ...prev, [difficulty]: seconds };
          localStorage.setItem("treck_memory_best", JSON.stringify(next));
          return next;
        }
        return prev;
      });
    }
  }, [done, seconds, difficulty]);

  const flip = (idx: number) => {
    if (picked.length === 2) return;
    const c = deck[idx];
    if (c.flipped || c.matched) return;
    if (!running) setRunning(true);
    const next = deck.map((card, i) => (i === idx ? { ...card, flipped: true } : card));
    setDeck(next);
    const newPicked = [...picked, idx];
    setPicked(newPicked);
    if (newPicked.length === 2) {
      setMoves((m) => m + 1);
      const [a, b] = newPicked;
      if (next[a].symbol === next[b].symbol) {
        setTimeout(() => {
          setDeck((d) => d.map((c2, i) => (i === a || i === b ? { ...c2, matched: true } : c2)));
          setPicked([]);
        }, 350);
      } else {
        setTimeout(() => {
          setDeck((d) => d.map((c2, i) => (i === a || i === b ? { ...c2, flipped: false } : c2)));
          setPicked([]);
        }, 850);
      }
    }
  };

  const changeDifficulty = (d: Difficulty) => {
    setDifficulty(d);
    reset(d);
  };

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="relative min-h-full p-6 lg:p-10 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <Link to="/games" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition">
          <ArrowLeft className="h-4 w-4" /> Back to Games
        </Link>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="glass rounded-xl px-3 py-1.5 text-sm inline-flex items-center gap-1.5">
            <Timer className="h-3.5 w-3.5 text-primary" /> <span className="font-bold tabular-nums">{mm}:{ss}</span>
          </div>
          <div className="glass rounded-xl px-3 py-1.5 text-sm">Moves <span className="font-bold tabular-nums">{moves}</span></div>
          <div className="glass rounded-xl px-3 py-1.5 text-sm inline-flex items-center gap-1.5">
            <Trophy className="h-3.5 w-3.5 text-amber-500" />
            <span className="font-bold tabular-nums">
              {best[difficulty] != null ? `${String(Math.floor((best[difficulty] as number) / 60)).padStart(2, "0")}:${String((best[difficulty] as number) % 60).padStart(2, "0")}` : "—"}
            </span>
          </div>
        </div>
      </div>

      <div className="glass rounded-3xl p-4 sm:p-6">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div className="glass rounded-2xl inline-flex gap-1 p-1.5">
            {(["easy","medium","hard"] as Difficulty[]).map((d) => (
              <button key={d} onClick={() => changeDifficulty(d)}
                className={`relative px-4 py-1.5 rounded-xl text-sm font-medium transition ${
                  difficulty === d ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}>
                {difficulty === d && (
                  <motion.div layoutId="mem-tab"
                    className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary to-primary-glow shadow-[var(--shadow-glow)]"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }} />
                )}
                <span className="relative capitalize">{d}</span>
              </button>
            ))}
          </div>
          <button onClick={() => reset()}
            className="inline-flex items-center gap-2 rounded-full glass px-4 py-2 text-sm font-medium hover:bg-accent/60 transition">
            <RotateCcw className="h-4 w-4" /> Restart
          </button>
        </div>

        <div className="grid gap-2 sm:gap-3 mx-auto" style={{ gridTemplateColumns: `repeat(${cols},minmax(0,1fr))`, maxWidth: cols === 6 ? 640 : 480 }}>
          {deck.map((c, i) => (
            <button
              key={c.id}
              onClick={() => flip(i)}
              className="relative aspect-square"
              style={{ perspective: 800 }}
            >
              <motion.div
                className="absolute inset-0 rounded-2xl"
                style={{ transformStyle: "preserve-3d" }}
                animate={{ rotateY: c.flipped || c.matched ? 180 : 0 }}
                transition={{ duration: 0.35 }}
              >
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary to-fuchsia-500 shadow-lg grid place-items-center text-white text-xl font-bold" style={{ backfaceVisibility: "hidden" }}>
                  ✦
                </div>
                <div
                  className={`absolute inset-0 rounded-2xl grid place-items-center text-3xl sm:text-4xl bg-card border border-border/60 ${c.matched ? "ring-2 ring-emerald-400/70" : ""}`}
                  style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                >
                  {c.symbol}
                </div>
              </motion.div>
            </button>
          ))}
        </div>

        {done && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="mt-6 rounded-2xl bg-gradient-to-r from-primary/10 to-fuchsia-500/10 border border-primary/20 p-5 text-center">
            <div className="text-lg font-bold">You cleared the board! 🎉</div>
            <div className="text-sm text-muted-foreground mt-1">{moves} moves · {mm}:{ss}</div>
            <button onClick={() => reset()}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
              <RotateCcw className="h-4 w-4" /> Play again
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}

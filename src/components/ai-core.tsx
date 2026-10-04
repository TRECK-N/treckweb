import logoAsset from "@/assets/webuweb-mark.png.asset.json";

export type CoreState = "idle" | "listening" | "thinking" | "speaking";

const SPEED: Record<CoreState, number> = { idle: 1, listening: 0.6, thinking: 0.3, speaking: 0.5 };

const PARTICLES = Array.from({ length: 28 }, (_, i) => ({
  a: (i * 137.5) % 360,
  r: 38 + ((i * 7) % 12),
  s: 1 + (i % 3),
  d: (i % 7) * 0.4,
}));

/**
 * Holographic WebuWeb core — layered rings, energy shells and particles,
 * all CSS-driven for performance. Reacts to the assistant state.
 */
export function AiCore({ state = "idle", className = "" }: { state?: CoreState; level?: number; className?: string }) {
  const k = SPEED[state];
  const active = state !== "idle";
  const ring = (pct: number, op: number, dur: number, rev = false, dashed = false, tilt = 0) => (
    <div
      className="absolute rounded-full"
      style={{
        width: `${pct}%`, height: `${pct}%`,
        border: `${dashed ? "1px dashed" : "1px solid"} color-mix(in oklab, var(--primary) ${op}%, transparent)`,
        transform: `rotateX(${tilt}deg)`,
        animation: `${rev ? "core-spin-rev" : "core-spin"} ${dur * k}s linear infinite`,
        borderTopColor: `color-mix(in oklab, var(--cyan) ${Math.min(100, op + 40)}%, transparent)`,
      }}
    />
  );

  return (
    <div className={`relative grid place-items-center [perspective:900px] ${className}`} aria-hidden>
      {/* halo */}
      <div
        className="absolute inset-[-15%] rounded-full blur-3xl transition-opacity duration-700"
        style={{
          background: "radial-gradient(circle, color-mix(in oklab, var(--primary) 45%, transparent), color-mix(in oklab, var(--primary-glow) 18%, transparent) 45%, transparent 70%)",
          opacity: active ? 1 : 0.65,
          animation: `pulse ${state === "listening" ? 1.2 : 4}s ease-in-out infinite`,
        }}
      />
      {/* rings */}
      {ring(100, 22, 60, false, true)}
      {ring(90, 35, 28, true)}
      {ring(80, 25, 40, false, true, 68)}
      {ring(80, 25, 34, true, false, -68)}
      {ring(70, 45, 18)}
      {/* listening pulses */}
      {state === "listening" && [0, 1, 2].map((i) => (
        <div key={i} className="absolute h-[60%] w-[60%] rounded-full border border-cyan/60"
          style={{ animation: `ping 1.8s cubic-bezier(0,0,.2,1) ${i * 0.6}s infinite` }} />
      ))}
      {/* particles */}
      <div className="absolute inset-0" style={{ animation: `core-spin ${90 * k}s linear infinite` }}>
        {PARTICLES.map((p, i) => (
          <span key={i} className="absolute rounded-full bg-cyan"
            style={{
              width: p.s, height: p.s,
              left: `${50 + p.r * Math.cos((p.a * Math.PI) / 180)}%`,
              top: `${50 + p.r * Math.sin((p.a * Math.PI) / 180)}%`,
              animation: `twinkle ${2.4 + (i % 4)}s ease-in-out ${p.d}s infinite`,
              boxShadow: "0 0 6px var(--cyan)",
            }} />
        ))}
      </div>
      {/* orb */}
      <div className="relative grid aspect-square w-[56%] place-items-center rounded-full" style={{ animation: "core-float 6s ease-in-out infinite" }}>
        <div className="absolute inset-0 rounded-full border border-primary/40 backdrop-blur-xl"
          style={{
            background: "radial-gradient(circle at 32% 28%, color-mix(in oklab, var(--cyan) 35%, transparent), color-mix(in oklab, var(--primary) 18%, transparent) 40%, color-mix(in oklab, var(--background) 70%, transparent) 75%)",
            boxShadow: "0 0 90px color-mix(in oklab, var(--primary) 40%, transparent), inset 0 0 60px color-mix(in oklab, var(--primary) 30%, transparent), inset -20px -30px 60px color-mix(in oklab, var(--primary-glow) 25%, transparent)",
            transform: state === "speaking" ? "scale(1.04)" : "scale(1)",
            transition: "transform .4s ease",
          }} />
        <div className="absolute inset-[8%] rounded-full border border-dashed border-cyan/30"
          style={{ animation: `core-spin ${(state === "thinking" ? 4 : 24) * 1}s linear infinite` }} />
        <img src={logoAsset.url} alt="" className="relative w-[50%] object-contain"
          style={{ filter: "drop-shadow(0 0 24px color-mix(in oklab, var(--primary) 80%, transparent))" }} />
      </div>
    </div>
  );
}

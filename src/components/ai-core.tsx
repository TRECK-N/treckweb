import { motion } from "framer-motion";
import logoAsset from "@/assets/webuweb-mark.png.asset.json";

export type CoreState = "idle" | "listening" | "thinking" | "speaking";

const TINT: Record<CoreState, string> = {
  idle: "hsl(var(--primary) / 0.45)",
  listening: "hsl(var(--primary) / 0.75)",
  thinking: "hsl(var(--primary) / 0.65)",
  speaking: "hsl(var(--primary) / 0.85)",
};

/**
 * Holographic WebuWeb core. Reacts to the assistant state with orbiting rings,
 * a breathing halo and an audio-reactive pulse.
 */
export function AiCore({ state = "idle", level = 0, className = "" }: { state?: CoreState; level?: number; className?: string }) {
  const active = state !== "idle";
  const pulse = state === "speaking" ? 1 + Math.min(level, 1) * 0.12 : 1;

  return (
    <div className={`relative grid place-items-center ${className}`} aria-hidden>
      {/* Ambient halo */}
      <motion.div
        className="absolute rounded-full blur-3xl"
        style={{ width: "120%", height: "120%", background: `radial-gradient(circle, ${TINT[state]}, transparent 65%)` }}
        animate={{ opacity: active ? [0.7, 1, 0.7] : [0.4, 0.6, 0.4], scale: [1, 1.06, 1] }}
        transition={{ duration: state === "thinking" ? 1.6 : 4, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Orbiting rings */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border"
          style={{
            width: `${72 + i * 14}%`,
            height: `${72 + i * 14}%`,
            borderColor: `hsl(var(--primary) / ${0.35 - i * 0.08})`,
            transform: `rotateX(${62 + i * 6}deg)`,
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: (state === "thinking" ? 5 : 22) + i * 4, repeat: Infinity, ease: "linear" }}
        />
      ))}

      {/* Particles */}
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * Math.PI * 2;
        return (
          <motion.span
            key={i}
            className="absolute h-1 w-1 rounded-full bg-primary"
            style={{ left: `${50 + Math.cos(angle) * 44}%`, top: `${50 + Math.sin(angle) * 44}%` }}
            animate={{ opacity: active ? [0.2, 1, 0.2] : [0.1, 0.5, 0.1], scale: [0.8, 1.5, 0.8] }}
            transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.12, ease: "easeInOut" }}
          />
        );
      })}

      {/* Glass sphere */}
      <motion.div
        className="relative grid aspect-square w-[58%] place-items-center rounded-full border border-primary/30 bg-[radial-gradient(circle_at_30%_25%,hsl(var(--primary)/0.35),transparent_60%)] backdrop-blur-xl"
        style={{ boxShadow: "0 0 80px hsl(var(--primary)/0.35), inset 0 0 60px hsl(var(--primary)/0.2)" }}
        animate={{ scale: active ? [pulse, pulse * 1.04, pulse] : [1, 1.02, 1] }}
        transition={{ duration: state === "listening" ? 1.2 : 3, repeat: Infinity, ease: "easeInOut" }}
      >
        <motion.img
          src={logoAsset.url}
          alt=""
          className="w-[52%] object-contain drop-shadow-[0_0_28px_hsl(var(--primary)/0.7)]"
          animate={{ y: [-4, 4, -4], rotate: state === "thinking" ? [0, 4, -4, 0] : 0 }}
          transition={{ duration: state === "thinking" ? 2 : 6, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.div>
    </div>
  );
}

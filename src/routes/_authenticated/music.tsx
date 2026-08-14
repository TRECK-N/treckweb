import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Lock, Music as MusicIcon, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/music")({
  head: () => ({
    meta: [
      { title: "Music — WebuWeb" },
      { name: "description", content: "The WebuWeb music library is temporarily unavailable while payments are being set up." },
      { property: "og:title", content: "Music — WebuWeb" },
      { property: "og:description", content: "The WebuWeb music library is temporarily unavailable while payments are being set up." },
    ],
  }),
  component: MusicLocked,
});

function MusicLocked() {
  return (
    <div className="relative grid min-h-full place-items-center overflow-hidden p-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/3 h-[26rem] w-[26rem] -translate-x-1/2 rounded-full bg-primary/10 blur-[130px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="glass relative w-full max-w-md rounded-3xl border border-border/60 p-8 text-center"
      >
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-border/60 bg-accent/50">
          <MusicIcon className="h-6 w-6 text-primary" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">Music is temporarily unavailable</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          The WebuWeb music library is paused while we finish setting up secure payments.
          It will come back — together with the Music Pack — as soon as checkout is live.
        </p>
        <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/50 px-3 py-1.5 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" /> Locked for everyone right now
        </div>
        <div className="mt-7">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Home
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

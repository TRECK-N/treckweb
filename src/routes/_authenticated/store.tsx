import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Crown, Music, Check, Sparkles, Bot, MessageCircle, Users } from "lucide-react";
import { useSubscription } from "@/hooks/use-subscription";

export const Route = createFileRoute("/_authenticated/store")({
  component: Store,
});

function Store() {
  const { user } = Route.useRouteContext();
  const { data: sub } = useSubscription(user.id);

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Store</h1>
        <p className="text-sm text-muted-foreground">Two products. Simple, transparent pricing.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* PRO */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="glass rounded-3xl overflow-hidden relative"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-amber-400/10 via-primary/10 to-transparent pointer-events-none" />
          <div className="relative p-6 lg:p-8">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-amber-400 to-primary grid place-items-center text-white shadow-[var(--shadow-glow)]">
                <Crown className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-primary font-bold">Subscription</div>
                <h2 className="text-2xl font-bold">TRECK PRO Pass</h2>
              </div>
            </div>

            <p className="mt-4 text-sm text-muted-foreground">
              Everything premium. Pick your duration — 1, 3, 6, or 12 months.
              Fake checkout activates instantly.
            </p>

            <div className="mt-5 flex items-baseline gap-2">
              <span className="text-4xl font-bold">$4</span>
              <span className="text-sm text-muted-foreground">/ month</span>
              <span className="ml-2 text-xs line-through text-muted-foreground">$8</span>
              <span className="text-[10px] font-bold uppercase text-primary">50% off</span>
            </div>

            <ul className="mt-5 space-y-2 text-sm">
              {[
                { icon: Bot, t: "Unlimited AI messages" },
                { icon: Sparkles, t: "AI image & file uploads" },
                { icon: Sparkles, t: "Camera analysis for AI" },
                { icon: Users, t: "Create unlimited groups" },
                { icon: MessageCircle, t: "Attachments in private chats & groups" },
              ].map((b) => (
                <li key={b.t} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-success shrink-0" /> {b.t}
                </li>
              ))}
            </ul>

            <Link
              to="/membership"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-primary px-5 py-3 text-sm font-semibold text-white shadow-[var(--shadow-glow)] hover:opacity-95"
            >
              <Crown className="h-4 w-4" />
              {sub?.isPro ? "Extend PRO" : "Get TRECK PRO"}
            </Link>
          </div>
        </motion.div>

        {/* Music Pack */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="glass rounded-3xl overflow-hidden relative"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/10 via-primary/5 to-transparent pointer-events-none" />
          <div className="relative p-6 lg:p-8">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-primary grid place-items-center text-white shadow-[var(--shadow-glow)]">
                <Music className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-primary font-bold">One-time unlock</div>
                <h2 className="text-2xl font-bold">TRECK Extra Music Pack</h2>
              </div>
            </div>

            <p className="mt-4 text-sm text-muted-foreground">
              Instantly unlock 50% more of the music library. Yours forever — no subscription required.
            </p>

            <div className="mt-5 flex items-baseline gap-2">
              <span className="text-4xl font-bold">$5</span>
              <span className="text-sm text-muted-foreground">one-time</span>
            </div>

            <ul className="mt-5 space-y-2 text-sm">
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-success shrink-0" /> Unlocks additional music</li>
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-success shrink-0" /> Permanent — never expires</li>
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-success shrink-0" /> Works with or without PRO</li>
            </ul>

            <Link
              to="/membership"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-5 py-3 text-sm font-semibold shadow-[var(--shadow-glow)] hover:opacity-95"
            >
              <Music className="h-4 w-4" />
              {sub?.musicPackUnlocked ? "Already unlocked" : "Unlock — $5"}
            </Link>
          </div>
        </motion.div>
      </div>

      <p className="mt-8 text-xs text-muted-foreground text-center">
        Demo checkout — no real payment is processed. Real billing coming soon.
      </p>
    </div>
  );
}

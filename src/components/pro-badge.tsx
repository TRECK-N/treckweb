import { Crown } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function ProBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400/20 to-primary/20 border border-amber-400/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-500 ${className}`}
    >
      <Crown className="h-3 w-3" /> Pro
    </span>
  );
}

export function ProUpsell({ feature }: { feature: string }) {
  return (
    <div className="glass rounded-2xl p-6 text-center">
      <div className="mx-auto h-12 w-12 rounded-2xl bg-gradient-to-br from-amber-400 to-primary grid place-items-center text-white shadow-[var(--shadow-glow)]">
        <Crown className="h-5 w-5" />
      </div>
      <h3 className="mt-3 font-semibold">{feature} is a TRECK PRO feature</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Upgrade to unlock unlimited AI, file &amp; image uploads, camera analysis, AI study tools, and more.
      </p>
      <Link
        to="/membership"
        className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500 to-primary px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-glow)] hover:opacity-90"
      >
        <Crown className="h-4 w-4" /> Get TRECK PRO
      </Link>
    </div>
  );
}

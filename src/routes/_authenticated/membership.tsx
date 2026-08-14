import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Crown, Check, Lock, Sparkles, Music, Bot, Image as ImageIcon, Paperclip } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/use-subscription";

export const Route = createFileRoute("/_authenticated/membership")({
  component: Membership,
});

const PRO_MONTHLY = 4;
const PLANS: { months: number; label: string; save?: string }[] = [
  { months: 1, label: "1 month" },
  { months: 3, label: "3 months", save: "Save 10%" },
  { months: 6, label: "6 months", save: "Save 20%" },
  { months: 12, label: "12 months", save: "Save 33%" },
];
const DISCOUNTS: Record<number, number> = { 1: 1, 3: 0.9, 6: 0.8, 12: 0.67 };

const BENEFITS = [
  { icon: Bot, title: "2× daily AI messages", desc: "10 AI prompts per day, twice the Standard limit." },
  { icon: Paperclip, title: "AI file uploads", desc: "Attach PDFs and documents to your AI chats." },
  { icon: ImageIcon, title: "AI image analysis", desc: "Send photos and images to the AI for analysis." },
  { icon: Sparkles, title: "Priority PRO features", desc: "Early access to new PRO capabilities as they launch." },
];

function priceFor(months: number) {
  return Math.round(months * PRO_MONTHLY * DISCOUNTS[months] * 100) / 100;
}

function Membership() {
  const { user } = Route.useRouteContext();
  const { data: sub } = useSubscription(user.id);
  const [months, setMonths] = useState(1);

  const { data: history = [] } = useQuery({
    queryKey: ["purchases", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("purchases").select("*").eq("user_id", user.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Membership</h1>
        <p className="text-sm text-muted-foreground">Manage your WebuWeb PRO plan and unlocks.</p>
      </div>

      {/* Current plan */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="glass rounded-3xl p-6 lg:p-8 relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-amber-400/10 via-primary/5 to-transparent pointer-events-none" />
        <div className="relative flex flex-wrap items-center gap-6 justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Current plan</div>
            <div className="mt-1 flex items-center gap-2">
              <h2 className="text-2xl font-bold">
                {sub?.isPro ? "WebuWeb PRO" : "Standard"}
              </h2>
              {sub?.isPro && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-primary text-white text-xs px-2 py-0.5 font-bold uppercase">
                  <Crown className="h-3 w-3" /> Pro
                </span>
              )}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {sub?.isPro && sub.expiresAt
                ? <>Expires {sub.expiresAt.toLocaleDateString()} · <b className="text-foreground">{sub.daysLeft} days left</b></>
                : "Basic AI chat, workspace, and community access."}
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Music pack</div>
            <div className="mt-1 font-semibold">
              {sub?.musicPackUnlocked ? (
                <span className="inline-flex items-center gap-1 text-success"><Check className="h-4 w-4" /> Unlocked</span>
              ) : (
                <span className="text-muted-foreground">Locked</span>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Buy PRO */}
      <div className="glass rounded-3xl p-6 lg:p-8">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-amber-400 to-primary grid place-items-center text-white shadow-[var(--shadow-glow)]">
            <Crown className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold">{sub?.isPro ? "Extend WebuWeb PRO" : "Get WebuWeb PRO"}</h2>
            <p className="text-sm text-muted-foreground">Checkout is being upgraded — purchases open soon.</p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((p) => (
            <button
              key={p.months}
              onClick={() => setMonths(p.months)}
              className={`rounded-2xl border p-4 text-left transition ${
                months === p.months
                  ? "border-primary bg-primary/5 shadow-[var(--shadow-glow)]"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <div className="text-sm text-muted-foreground">{p.label}</div>
              <div className="mt-1 text-2xl font-bold">${priceFor(p.months)}</div>
              {p.save && <div className="text-[10px] font-bold uppercase text-primary">{p.save}</div>}
            </button>
          ))}
        </div>

        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {BENEFITS.map((b) => (
            <li key={b.title} className="flex gap-3">
              <div className="h-9 w-9 shrink-0 rounded-xl bg-primary/10 text-primary grid place-items-center">
                <b.icon className="h-4 w-4" />
              </div>
              <div>
                <div className="font-medium text-sm">{b.title}</div>
                <div className="text-xs text-muted-foreground">{b.desc}</div>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            disabled
            aria-disabled="true"
            className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl bg-muted px-6 py-3 text-sm font-semibold text-muted-foreground"
          >
            <Lock className="h-4 w-4" /> Purchases temporarily unavailable
          </button>
          <span className="text-xs text-muted-foreground">
            Secure payments are being set up. PRO will be purchasable here soon.
          </span>
        </div>
      </div>

      {/* Music Pack */}
      <div className="glass rounded-3xl p-6 lg:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-primary grid place-items-center text-white">
              <Music className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Music Pack</h2>
              <p className="text-sm text-muted-foreground">Unlock the entire music library — every current and future track.</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">$5</div>
            <div className="text-xs text-muted-foreground">One time</div>
          </div>
        </div>
        <ul className="mt-4 text-sm space-y-1.5">
          <li className="flex items-center gap-2"><Check className="h-4 w-4 text-success" /> Unlocks the full Music section</li>
          <li className="flex items-center gap-2"><Check className="h-4 w-4 text-success" /> Every current & future song included</li>
          <li className="flex items-center gap-2"><Check className="h-4 w-4 text-success" /> Permanent access — never expires</li>
          <li className="flex items-center gap-2"><Check className="h-4 w-4 text-success" /> Works alongside WebuWeb PRO</li>
        </ul>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            disabled
            aria-disabled="true"
            className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl bg-muted px-5 py-2.5 text-sm font-semibold text-muted-foreground"
          >
            <Lock className="h-4 w-4" /> Temporarily unavailable
          </button>
          <span className="text-xs text-muted-foreground">The Music Pack returns once payments go live.</span>
        </div>
      </div>

      {/* History */}
      <div className="glass rounded-3xl p-6 lg:p-8">
        <h2 className="text-lg font-bold">Purchase history</h2>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No purchases yet.</p>
        ) : (
          <div className="mt-4 divide-y divide-border/60">
            {history.map((h) => (
              <div key={h.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="font-medium text-sm">
                    {h.product_kind === "pro" ? `WebuWeb PRO — ${h.months} month${(h.months ?? 0) > 1 ? "s" : ""}` : "Music Pack"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(h.created_at).toLocaleString()}
                    {h.expires_at && <> · expires {new Date(h.expires_at).toLocaleDateString()}</>}
                  </div>
                </div>
                <div className="font-bold">${Number(h.amount).toFixed(2)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Crown, Check, Loader2, Sparkles, Music, Bot, Image as ImageIcon, Paperclip } from "lucide-react";
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
  const qc = useQueryClient();
  const { data: sub, refetch } = useSubscription(user.id);
  const [months, setMonths] = useState(1);
  const [processing, setProcessing] = useState<"pro" | "music" | null>(null);

  const { data: history = [] } = useQuery({
    queryKey: ["purchases", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("purchases").select("*").eq("user_id", user.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const buyPro = async () => {
    setProcessing("pro");
    await new Promise((r) => setTimeout(r, 900));
    const now = new Date();
    const start = sub?.isPro && sub.expiresAt ? sub.expiresAt : now;
    const expires = new Date(start);
    expires.setMonth(expires.getMonth() + months);
    const amount = priceFor(months);

    const { error: pErr } = await supabase.from("profiles")
      .update({ subscription_tier: "pro", pro_expires_at: expires.toISOString() })
      .eq("id", user.id);
    if (pErr) { toast.error(pErr.message); setProcessing(null); return; }

    await supabase.from("purchases").insert({
      user_id: user.id, product_kind: "pro", months, amount, expires_at: expires.toISOString(),
    });
    toast.success(`TRECK PRO active until ${expires.toLocaleDateString()}`);
    await refetch();
    qc.invalidateQueries({ queryKey: ["purchases", user.id] });
    qc.invalidateQueries({ queryKey: ["subscription", user.id] });
    setProcessing(null);
  };

  const buyMusic = async () => {
    setProcessing("music");
    await new Promise((r) => setTimeout(r, 900));
    const { error } = await supabase.from("profiles")
      .update({ music_pack_unlocked: true }).eq("id", user.id);
    if (error) { toast.error(error.message); setProcessing(null); return; }
    await supabase.from("purchases").insert({
      user_id: user.id, product_kind: "music_pack", amount: 5,
    });
    toast.success("Music Pack unlocked forever 🎵");
    await refetch();
    qc.invalidateQueries({ queryKey: ["purchases", user.id] });
    qc.invalidateQueries({ queryKey: ["subscription", user.id] });
    setProcessing(null);
  };

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Membership</h1>
        <p className="text-sm text-muted-foreground">Manage your TRECK PRO subscription and unlocks.</p>
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
                {sub?.isPro ? "TRECK PRO" : "Standard"}
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
            <h2 className="text-xl font-bold">{sub?.isPro ? "Extend TRECK PRO" : "Get TRECK PRO"}</h2>
            <p className="text-sm text-muted-foreground">Fake checkout — instant activation.</p>
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

        <button
          onClick={buyPro}
          disabled={processing !== null}
          className="mt-6 w-full sm:w-auto inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-primary px-6 py-3 text-sm font-semibold text-white shadow-[var(--shadow-glow)] hover:opacity-95 disabled:opacity-50"
        >
          {processing === "pro" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {sub?.isPro ? `Extend ${months}mo for $${priceFor(months)}` : `Activate PRO for $${priceFor(months)}`}
        </button>
      </div>

      {/* Complete Music Pack */}
      <div className="glass rounded-3xl p-6 lg:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-primary grid place-items-center text-white">
              <Music className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Complete Music Pack</h2>
              <p className="text-sm text-muted-foreground">Unlock the entire music library — every current and future track.</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">$9</div>
            <div className="text-xs text-muted-foreground">One time</div>
          </div>
        </div>
        <ul className="mt-4 text-sm space-y-1.5">
          <li className="flex items-center gap-2"><Check className="h-4 w-4 text-success" /> Unlocks the full Music section</li>
          <li className="flex items-center gap-2"><Check className="h-4 w-4 text-success" /> Every current & future song included</li>
          <li className="flex items-center gap-2"><Check className="h-4 w-4 text-success" /> Permanent access — never expires</li>
          <li className="flex items-center gap-2"><Check className="h-4 w-4 text-success" /> Works alongside TRECK PRO</li>
        </ul>
        <button
          onClick={buyMusic}
          disabled={processing !== null || !!sub?.musicPackUnlocked}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold shadow-[var(--shadow-glow)] hover:opacity-95 disabled:opacity-50"
        >
          {processing === "music" ? <Loader2 className="h-4 w-4 animate-spin" /> : sub?.musicPackUnlocked ? <Check className="h-4 w-4" /> : <Music className="h-4 w-4" />}
          {sub?.musicPackUnlocked ? "Already unlocked" : "Unlock Complete Music Pack — $9"}
        </button>
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
                    {h.product_kind === "pro" ? `TRECK PRO — ${h.months} month${(h.months ?? 0) > 1 ? "s" : ""}` : "Complete Music Pack"}
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

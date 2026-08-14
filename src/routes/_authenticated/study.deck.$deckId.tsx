import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronLeft, ChevronRight, Layers, Loader2, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/study/deck/$deckId")({
  head: () => ({
    meta: [
      { title: "Flashcard deck — WebuWeb" },
      { name: "description", content: "Study your flashcard deck with a focused flip-card review mode." },
      { property: "og:title", content: "Flashcard deck — WebuWeb" },
      { property: "og:description", content: "Study your flashcard deck with a focused flip-card review mode." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DeckPage,
});

function DeckPage() {
  const { deckId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const [mode, setMode] = useState<"study" | "edit">("study");

  const { data: deck } = useQuery({
    queryKey: ["study-deck", deckId],
    queryFn: async () => {
      const { data } = await supabase.from("study_decks").select("*").eq("id", deckId).maybeSingle();
      return data;
    },
  });

  const { data: cards, isLoading } = useQuery({
    queryKey: ["study-cards", deckId],
    queryFn: async () => {
      const { data } = await supabase.from("study_cards").select("*").eq("deck_id", deckId).order("position");
      return data ?? [];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["study-cards", deckId] });
    qc.invalidateQueries({ queryKey: ["study-decks", user.id] });
  };

  const addCard = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("study_cards").insert({
        deck_id: deckId, user_id: user.id, front: "New question", back: "New answer", position: cards?.length ?? 0,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast.error("Could not add card"),
  });

  const updateCard = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: { front?: string; back?: string } }) => {
      await supabase.from("study_cards").update(patch).eq("id", id);
    },
    onSuccess: invalidate,
  });

  const deleteCard = useMutation({
    mutationFn: async (id: string) => { await supabase.from("study_cards").delete().eq("id", id); },
    onSuccess: invalidate,
  });

  return (
    <div className="relative min-h-full">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 right-0 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
      </div>
      <div className="relative p-6 lg:p-10 max-w-4xl mx-auto space-y-6">
        <Link to="/study" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Study
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-cyan-400 grid place-items-center text-white">
            <Layers className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold truncate">{deck?.title ?? "Deck"}</h1>
            <p className="text-sm text-muted-foreground">{deck?.description || `${cards?.length ?? 0} cards`}</p>
          </div>
          <div className="ml-auto flex gap-2">
            {(["study", "edit"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-xl px-4 py-2 text-sm font-medium capitalize transition ${
                  mode === m ? "bg-primary text-primary-foreground" : "glass hover:bg-accent"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="grid place-items-center py-20"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : mode === "study" ? (
          <StudyMode cards={cards ?? []} />
        ) : (
          <div className="space-y-3">
            {(cards ?? []).map((c) => (
              <div key={c.id} className="glass rounded-2xl p-4 space-y-2">
                <input
                  defaultValue={c.front}
                  onBlur={(e) => e.target.value !== c.front && updateCard.mutate({ id: c.id, patch: { front: e.target.value } })}
                  className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm font-medium outline-none focus:border-primary"
                />
                <textarea
                  defaultValue={c.back}
                  onBlur={(e) => e.target.value !== c.back && updateCard.mutate({ id: c.id, patch: { back: e.target.value } })}
                  rows={2}
                  className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <button onClick={() => deleteCard.mutate(c.id)} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" /> Delete card
                </button>
              </div>
            ))}
            <button onClick={() => addCard.mutate()} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground">
              <Plus className="h-4 w-4" /> Add card
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StudyMode({ cards }: { cards: { id: string; front: string; back: string }[] }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = cards[index];
  const progress = useMemo(() => (cards.length ? ((index + 1) / cards.length) * 100 : 0), [index, cards.length]);

  if (!cards.length) {
    return (
      <div className="glass rounded-3xl p-10 text-center">
        <p className="font-medium">This deck is empty</p>
        <p className="text-sm text-muted-foreground">Switch to Edit mode to add your first card.</p>
      </div>
    );
  }

  const go = (dir: number) => {
    setFlipped(false);
    setIndex((i) => (i + dir + cards.length) % cards.length);
  };

  return (
    <div className="space-y-4">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-accent">
        <motion.div className="h-full bg-primary" animate={{ width: `${progress}%` }} />
      </div>

      <button onClick={() => setFlipped((f) => !f)} className="w-full text-left">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${card.id}-${flipped}`}
            initial={{ rotateX: 90, opacity: 0 }}
            animate={{ rotateX: 0, opacity: 1 }}
            exit={{ rotateX: -90, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="glass grid min-h-[260px] place-items-center rounded-3xl p-8 text-center"
          >
            <div>
              <p className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">{flipped ? "Answer" : "Question"}</p>
              <p className="text-xl font-medium">{flipped ? card.back : card.front}</p>
              <p className="mt-6 text-xs text-muted-foreground">Click to flip</p>
            </div>
          </motion.div>
        </AnimatePresence>
      </button>

      <div className="flex items-center justify-between">
        <button onClick={() => go(-1)} className="inline-flex items-center gap-1.5 rounded-xl glass px-4 py-2 text-sm hover:bg-accent">
          <ChevronLeft className="h-4 w-4" /> Prev
        </button>
        <span className="text-sm text-muted-foreground">{index + 1} / {cards.length}</span>
        <div className="flex gap-2">
          <button onClick={() => { setIndex(0); setFlipped(false); }} className="inline-flex items-center gap-1.5 rounded-xl glass px-4 py-2 text-sm hover:bg-accent">
            <RotateCcw className="h-4 w-4" />
          </button>
          <button onClick={() => go(1)} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Next <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

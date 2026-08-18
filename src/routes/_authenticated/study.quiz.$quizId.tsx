import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, ListChecks, Loader2, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/study/quiz/$quizId")({
  head: () => ({
    meta: [
      { title: "Quiz — WebuWeb" },
      { name: "description", content: "Take your multiple-choice quiz and track your score." },
      { property: "og:title", content: "Quiz — WebuWeb" },
      { property: "og:description", content: "Take your multiple-choice quiz and track your score." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: QuizPage,
});

type Question = {
  id: string;
  question: string;
  options: string[];
  correct_index: number;
  correct_indexes: number[] | null;
  explanation: string | null;
};

/** Correct answers for a question — falls back to the legacy single answer. */
function correctSet(q: Question): number[] {
  const multi = Array.isArray(q.correct_indexes) ? q.correct_indexes : [];
  return multi.length ? [...multi].sort((a, b) => a - b) : [q.correct_index];
}

function sameSet(a: number[], b: number[]) {
  const x = [...a].sort((p, q) => p - q);
  const y = [...b].sort((p, q) => p - q);
  return x.length === y.length && x.every((v, i) => v === y[i]);
}


function QuizPage() {
  const { quizId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const [mode, setMode] = useState<"play" | "edit">("play");

  const { data: quiz } = useQuery({
    queryKey: ["study-quiz", quizId],
    queryFn: async () => {
      const { data } = await supabase.from("study_quizzes").select("*").eq("id", quizId).maybeSingle();
      return data;
    },
  });

  const { data: questions, isLoading } = useQuery({
    queryKey: ["study-questions", quizId],
    queryFn: async () => {
      const { data } = await supabase.from("study_questions").select("*").eq("quiz_id", quizId).order("position");
      return (data ?? []).map((q: any) => ({ ...q, options: Array.isArray(q.options) ? q.options : [] })) as Question[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["study-questions", quizId] });
    qc.invalidateQueries({ queryKey: ["study-quizzes", user.id] });
  };

  const addQuestion = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("study_questions").insert({
        quiz_id: quizId, user_id: user.id, question: "New question",
        options: ["Option A", "Option B", "Option C", "Option D"],
        correct_index: 0, correct_indexes: [0], position: questions?.length ?? 0,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast.error("Could not add question"),
  });

  const updateQuestion = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: { question?: string; options?: string[]; correct_index?: number; correct_indexes?: number[]; explanation?: string } }) => {
      await (supabase as any).from("study_questions").update(patch).eq("id", id);
    },
    onSuccess: invalidate,
  });

  /** Toggle one option's "correct" flag, keeping the legacy single column in sync. */
  const toggleCorrect = (q: Question, i: number) => {
    const cur = correctSet(q);
    const next = cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i].sort((a, b) => a - b);
    if (!next.length) return toast.error("Keep at least one correct answer");
    updateQuestion.mutate({ id: q.id, patch: { correct_indexes: next, correct_index: next[0] } });
  };


  const deleteQuestion = useMutation({
    mutationFn: async (id: string) => { await supabase.from("study_questions").delete().eq("id", id); },
    onSuccess: invalidate,
  });

  return (
    <div className="relative min-h-full">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-0 h-80 w-80 rounded-full bg-cyan-500/20 blur-3xl" />
      </div>
      <div className="relative p-6 lg:p-10 max-w-4xl mx-auto space-y-6">
        <Link to="/study" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Study
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-cyan-400 to-primary grid place-items-center text-white">
            <ListChecks className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold truncate">{quiz?.title ?? "Quiz"}</h1>
            <p className="text-sm text-muted-foreground">{quiz?.description || `${questions?.length ?? 0} questions`}</p>
          </div>
          <div className="ml-auto flex gap-2">
            {(["play", "edit"] as const).map((m) => (
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
        ) : mode === "play" ? (
          <PlayMode questions={questions ?? []} quizId={quizId} userId={user.id} />
        ) : (
          <div className="space-y-4">
            {(questions ?? []).map((q) => (
              <div key={q.id} className="glass rounded-2xl p-4 space-y-2">
                <input
                  defaultValue={q.question}
                  onBlur={(e) => e.target.value !== q.question && updateQuestion.mutate({ id: q.id, patch: { question: e.target.value } })}
                  className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm font-medium outline-none focus:border-primary"
                />
                <p className="text-[11px] text-muted-foreground">
                  Tick every correct answer — a question can have more than one.
                </p>
                {q.options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <button
                      onClick={() => toggleCorrect(q, i)}
                      title="Mark as correct"
                      aria-pressed={correctSet(q).includes(i)}
                      className={`h-6 w-6 shrink-0 rounded-md border grid place-items-center transition ${
                        correctSet(q).includes(i) ? "border-emerald-500 bg-emerald-500 text-white" : "border-border"
                      }`}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <input
                      defaultValue={opt}
                      onBlur={(e) => {
                        if (e.target.value === opt) return;
                        const next = [...q.options];
                        next[i] = e.target.value;
                        updateQuestion.mutate({ id: q.id, patch: { options: next } });
                      }}
                      className="flex-1 rounded-lg border border-border bg-background/60 px-3 py-1.5 text-sm outline-none focus:border-primary"
                    />
                  </div>
                ))}
                <button onClick={() => deleteQuestion.mutate(q.id)} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" /> Delete question
                </button>

              </div>
            ))}
            <button onClick={() => addQuestion.mutate()} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground">
              <Plus className="h-4 w-4" /> Add question
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PlayMode({ questions, quizId, userId }: { questions: Question[]; quizId: string; userId: string }) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const qc = useQueryClient();

  const score = questions.reduce((acc, q) => acc + (answers[q.id] === q.correct_index ? 1 : 0), 0);

  const saveAttempt = useMutation({
    mutationFn: async () => {
      await supabase.from("study_attempts").insert({ quiz_id: quizId, user_id: userId, score, total: questions.length });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["study-attempts", quizId] }),
  });

  if (!questions.length) {
    return (
      <div className="glass rounded-3xl p-10 text-center">
        <p className="font-medium">This quiz has no questions yet</p>
        <p className="text-sm text-muted-foreground">Switch to Edit mode to add some.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {submitted && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-5 text-center">
          <p className="text-3xl font-bold">{score} / {questions.length}</p>
          <p className="text-sm text-muted-foreground">
            {score === questions.length ? "Perfect run!" : score / questions.length >= 0.6 ? "Nice work — keep going." : "Review the explanations and retry."}
          </p>
        </motion.div>
      )}

      {questions.map((q, qi) => (
        <div key={q.id} className="glass rounded-2xl p-5">
          <p className="font-medium">{qi + 1}. {q.question}</p>
          <div className="mt-3 grid gap-2">
            {q.options.map((opt, i) => {
              const picked = answers[q.id] === i;
              const correct = q.correct_index === i;
              const state = submitted ? (correct ? "correct" : picked ? "wrong" : "idle") : picked ? "picked" : "idle";
              return (
                <button
                  key={i}
                  disabled={submitted}
                  onClick={() => setAnswers((a) => ({ ...a, [q.id]: i }))}
                  className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-left text-sm transition ${
                    state === "correct" ? "border-emerald-500/60 bg-emerald-500/10"
                    : state === "wrong" ? "border-destructive/60 bg-destructive/10"
                    : state === "picked" ? "border-primary bg-primary/10"
                    : "border-border hover:bg-accent"
                  }`}
                >
                  {submitted && correct && <Check className="h-4 w-4 text-emerald-500" />}
                  {submitted && state === "wrong" && <X className="h-4 w-4 text-destructive" />}
                  {opt}
                </button>
              );
            })}
          </div>
          {submitted && q.explanation && (
            <p className="mt-3 rounded-xl bg-accent/60 p-3 text-xs text-muted-foreground">{q.explanation}</p>
          )}
        </div>
      ))}

      <div className="flex gap-2">
        {!submitted ? (
          <button
            onClick={() => { setSubmitted(true); saveAttempt.mutate(); }}
            disabled={Object.keys(answers).length !== questions.length}
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            Submit answers
          </button>
        ) : (
          <button
            onClick={() => { setAnswers({}); setSubmitted(false); }}
            className="inline-flex items-center gap-2 rounded-xl glass px-5 py-2.5 text-sm font-medium hover:bg-accent"
          >
            <RotateCcw className="h-4 w-4" /> Retry
          </button>
        )}
      </div>
    </div>
  );
}

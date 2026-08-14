import { createFileRoute } from "@tanstack/react-router";
import { generateObject } from "ai";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

export const DAILY_STUDY_AI_LIMIT = 3;

const flashcardsSchema = z.object({
  title: z.string(),
  description: z.string(),
  cards: z.array(z.object({ front: z.string(), back: z.string() })).min(4).max(20),
});

const quizSchema = z.object({
  title: z.string(),
  description: z.string(),
  questions: z
    .array(
      z.object({
        question: z.string(),
        options: z.array(z.string()).length(4),
        correctIndex: z.number().int().min(0).max(3),
        explanation: z.string(),
      }),
    )
    .min(3)
    .max(15),
});

export const Route = createFileRoute("/api/study-generate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });
        const token = authHeader.slice(7);

        const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const { data: userData, error: userErr } = await supabase.auth.getUser(token);
        if (userErr || !userData.user) return new Response("Unauthorized", { status: 401 });
        const userId = userData.user.id;

        const body = (await request.json().catch(() => null)) as
          | { kind?: "flashcards" | "quiz"; topic?: string; count?: number; subject?: string }
          | null;
        const kind = body?.kind;
        const topic = (body?.topic ?? "").trim();
        if ((kind !== "flashcards" && kind !== "quiz") || topic.length < 3) {
          return new Response("Please describe what you want to study.", { status: 400 });
        }
        const count = Math.min(Math.max(body?.count ?? (kind === "quiz" ? 6 : 10), 3), kind === "quiz" ? 15 : 20);

        const { data: profile } = await supabase
          .from("profiles").select("subscription_tier,pro_expires_at").eq("id", userId).maybeSingle();
        const isPro =
          profile?.subscription_tier === "pro" &&
          (!profile.pro_expires_at || new Date(profile.pro_expires_at).getTime() > Date.now());
        if (!isPro) {
          return new Response("AI study tools are a PRO feature. Upgrade in Membership to unlock them.", { status: 402 });
        }

        const startOfDay = new Date();
        startOfDay.setUTCHours(0, 0, 0, 0);
        const { count: used } = await supabase
          .from("study_ai_generations")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .gte("created_at", startOfDay.toISOString());
        if ((used ?? 0) >= DAILY_STUDY_AI_LIMIT) {
          return new Response(`Daily AI study limit reached (${DAILY_STUDY_AI_LIMIT}/day). Resets tomorrow.`, { status: 429 });
        }

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3-flash-preview");

        try {
          if (kind === "flashcards") {
            const { object } = await generateObject({
              model,
              schema: flashcardsSchema,
              prompt:
                `Create exactly ${count} high-quality study flashcards about: "${topic}".\n` +
                `Fronts are short prompts/questions, backs are precise but concise answers. ` +
                `Also give the deck a short title and a one-sentence description.`,
            });

            const { data: deck, error: deckErr } = await supabase
              .from("study_decks")
              .insert({
                user_id: userId,
                title: object.title.slice(0, 120),
                description: object.description.slice(0, 300),
                subject: body?.subject?.slice(0, 60) ?? null,
                ai_generated: true,
              })
              .select("id")
              .single();
            if (deckErr || !deck) return new Response("Could not save deck", { status: 500 });

            await supabase.from("study_cards").insert(
              object.cards.map((c, i) => ({
                deck_id: deck.id, user_id: userId, front: c.front, back: c.back, position: i,
              })),
            );
            await supabase.from("study_ai_generations").insert({ user_id: userId, kind, topic: topic.slice(0, 200) });
            return Response.json({ kind, id: deck.id, count: object.cards.length });
          }

          const { object } = await generateObject({
            model,
            schema: quizSchema,
            prompt:
              `Create exactly ${count} multiple-choice quiz questions about: "${topic}".\n` +
              `Each question has exactly 4 options, exactly one correct answer (correctIndex), and a short explanation. ` +
              `Also give the quiz a short title and a one-sentence description.`,
          });

          const { data: quiz, error: quizErr } = await supabase
            .from("study_quizzes")
            .insert({
              user_id: userId,
              title: object.title.slice(0, 120),
              description: object.description.slice(0, 300),
              subject: body?.subject?.slice(0, 60) ?? null,
              ai_generated: true,
            })
            .select("id")
            .single();
          if (quizErr || !quiz) return new Response("Could not save quiz", { status: 500 });

          await supabase.from("study_questions").insert(
            object.questions.map((q, i) => ({
              quiz_id: quiz.id,
              user_id: userId,
              question: q.question,
              options: q.options,
              correct_index: q.correctIndex,
              explanation: q.explanation,
              position: i,
            })),
          );
          await supabase.from("study_ai_generations").insert({ user_id: userId, kind, topic: topic.slice(0, 200) });
          return Response.json({ kind, id: quiz.id, count: object.questions.length });
        } catch {
          return new Response("The AI could not generate that. Try a clearer topic.", { status: 502 });
        }
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { generateObject } from "ai";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

/** Pages Webu is allowed to open. */
const PAGES = ["dashboard", "ai", "chat", "workspace", "study", "games", "chess", "music", "membership", "settings"] as const;

const commandSchema = z.object({
  action: z.enum(["navigate", "search", "answer"]),
  page: z.enum(PAGES).nullable(),
  query: z.string().nullable(),
  reply: z.string(),
});

export const Route = createFileRoute("/api/webu-command")({
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

        const body = (await request.json().catch(() => null)) as { transcript?: string } | null;
        const transcript = (body?.transcript ?? "").trim();
        if (transcript.length < 2) return new Response("Nothing was heard.", { status: 400 });

        const gateway = createLovableAiGatewayProvider(key);

        try {
          const { object } = await generateObject({
            model: gateway("google/gemini-3-flash-preview"),
            schema: commandSchema,
            prompt:
              `You are Webu, the voice assistant inside the WebuWeb app. The user said: "${transcript}".\n` +
              `Decide what to do:\n` +
              `- "navigate": they want to open a section. Set page to one of ${PAGES.join(", ")} ` +
              `(dashboard = home). Music and membership purchases are currently locked, mention that if relevant.\n` +
              `- "search": they want to find something in their own content. Put the search terms in query.\n` +
              `- "answer": everything else — just answer briefly.\n` +
              `Always set reply to one short spoken sentence (max 25 words). ` +
              `Set page and query to null when they do not apply. Never invent actions beyond these three.`,
          });
          return Response.json(object);
        } catch {
          return new Response("Webu could not understand that. Try again.", { status: 502 });
        }
      },
    },
  },
});

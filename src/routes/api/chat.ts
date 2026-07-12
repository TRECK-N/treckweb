import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });
        const token = authHeader.slice(7);

        const supabaseUrl = process.env.SUPABASE_URL!;
        const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const supabase = createClient(supabaseUrl, supabaseKey, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const { data: userData, error: userErr } = await supabase.auth.getUser(token);
        if (userErr || !userData.user) return new Response("Unauthorized", { status: 401 });
        const userId = userData.user.id;

        const body = (await request.json()) as { messages: UIMessage[]; threadId: string };
        const { messages, threadId } = body;
        if (!threadId || !Array.isArray(messages)) return new Response("Bad request", { status: 400 });

        // Verify thread ownership
        const { data: thread } = await supabase
          .from("ai_threads").select("id").eq("id", threadId).eq("user_id", userId).maybeSingle();
        if (!thread) return new Response("Thread not found", { status: 404 });

        // Fetch profile once for PRO + daily limit
        const { data: profile } = await supabase
          .from("profiles").select("subscription_tier,pro_expires_at").eq("id", userId).maybeSingle();
        const isPro = profile?.subscription_tier === "pro" &&
          (!profile.pro_expires_at || new Date(profile.pro_expires_at).getTime() > Date.now());

        // Enforce PRO for attachments
        const last = messages[messages.length - 1];
        const hasAttachment = last?.role === "user" && last.parts?.some((p: any) => p.type === "file");
        if (hasAttachment && !isPro) {
          return new Response("Attachments require TRECK PRO. Upgrade in Membership to unlock file uploads.", { status: 402 });
        }

        // Daily prompt limit (resets at local midnight UTC)
        if (last?.role === "user") {
          const dailyLimit = isPro ? 10 : 5;
          const startOfDay = new Date();
          startOfDay.setUTCHours(0, 0, 0, 0);
          const { count } = await supabase
            .from("ai_messages")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId)
            .eq("role", "user")
            .gte("created_at", startOfDay.toISOString());
          if ((count ?? 0) >= dailyLimit) {
            return new Response(
              isPro
                ? `Daily PRO limit reached (${dailyLimit}/day). Resets tomorrow.`
                : `Daily limit reached (${dailyLimit}/day). Upgrade to TRECK PRO for ${10}/day.`,
              { status: 429 },
            );
          }
        }

        // Persist the latest user message if it wasn't stored yet
        if (last?.role === "user") {
          await supabase.from("ai_messages").insert({
            thread_id: threadId, user_id: userId, role: "user", content: last as unknown as object,
          });
        }

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3-flash-preview");

        const result = streamText({
          model,
          system: "You are TreckWeb AI, a helpful, warm, and precise assistant for students. Use markdown, code blocks, and be concise unless asked for depth.",
          messages: await convertToModelMessages(messages),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages,
          onFinish: async ({ messages: finalMessages }) => {
            const assistant = finalMessages[finalMessages.length - 1];
            if (assistant?.role === "assistant") {
              await supabase.from("ai_messages").insert({
                thread_id: threadId, user_id: userId, role: "assistant", content: assistant as unknown as object,
              });
              await supabase.from("ai_threads").update({ updated_at: new Date().toISOString() }).eq("id", threadId);
            }
          },
        });
      },
    },
  },
});

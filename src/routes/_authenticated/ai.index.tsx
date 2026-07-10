import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ai/")({
  component: AiIndex,
});

function AiIndex() {
  const navigate = useNavigate();
  const { user } = Route.useRouteContext();

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("ai_threads")
        .select("id").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(1);
      if (data?.[0]) {
        navigate({ to: "/ai/$threadId", params: { threadId: data[0].id }, replace: true });
      } else {
        const { data: created } = await supabase.from("ai_threads")
          .insert({ user_id: user.id, title: "New chat" }).select("id").single();
        if (created) navigate({ to: "/ai/$threadId", params: { threadId: created.id }, replace: true });
      }
    })();
  }, [navigate, user.id]);

  return (
    <div className="grid place-items-center h-full min-h-[60vh]">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

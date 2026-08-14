import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const DAILY_STUDY_AI_LIMIT = 3;

function startOfUtcDayISO() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

export function useStudyAiUsage(userId: string | undefined) {
  const query = useQuery({
    queryKey: ["study-ai-usage", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { count } = await supabase
        .from("study_ai_generations")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId!)
        .gte("created_at", startOfUtcDayISO());
      return count ?? 0;
    },
  });
  const used = query.data ?? 0;
  return { ...query, used, limit: DAILY_STUDY_AI_LIMIT, remaining: Math.max(0, DAILY_STUDY_AI_LIMIT - used) };
}

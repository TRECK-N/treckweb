import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const DAILY_LIMIT_STANDARD = 5;
export const DAILY_LIMIT_PRO = 10;

function startOfTodayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function useDailyAiUsage(userId: string | undefined, isPro: boolean) {
  const limit = isPro ? DAILY_LIMIT_PRO : DAILY_LIMIT_STANDARD;
  const query = useQuery({
    queryKey: ["ai-daily-usage", userId, isPro],
    enabled: !!userId,
    queryFn: async () => {
      const { count } = await supabase
        .from("ai_messages")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId!)
        .eq("role", "user")
        .gte("created_at", startOfTodayISO());
      return count ?? 0;
    },
  });
  const used = query.data ?? 0;
  const remaining = Math.max(0, limit - used);
  return { ...query, used, limit, remaining, isPro };
}

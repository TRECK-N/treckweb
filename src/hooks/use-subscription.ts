import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Subscription {
  tier: "standard" | "pro";
  isPro: boolean;
  expiresAt: Date | null;
  daysLeft: number | null;
  musicPackUnlocked: boolean;
}

export function useSubscription(userId: string | undefined) {
  return useQuery<Subscription>({
    queryKey: ["subscription", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("subscription_tier,pro_expires_at,music_pack_unlocked")
        .eq("id", userId!)
        .maybeSingle();
      const tier = (data?.subscription_tier ?? "standard") as "standard" | "pro";
      const expiresAt = data?.pro_expires_at ? new Date(data.pro_expires_at) : null;
      const isActive = tier === "pro" && (!expiresAt || expiresAt.getTime() > Date.now());
      const daysLeft = expiresAt
        ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000))
        : null;
      return {
        tier: isActive ? "pro" : "standard",
        isPro: isActive,
        expiresAt,
        daysLeft,
        musicPackUnlocked: !!data?.music_pack_unlocked,
      };
    },
  });
}

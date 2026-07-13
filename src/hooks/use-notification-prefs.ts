import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface NotificationPrefs {
  master_enabled: boolean;
  chat_private: boolean;
  chat_groups: boolean;
  chat_global: boolean;
  ai_reset: boolean;
  updates: boolean;
  marketing_pro: boolean;
  marketing_music: boolean;
}

const DEFAULTS: NotificationPrefs = {
  master_enabled: true,
  chat_private: true,
  chat_groups: true,
  chat_global: false,
  ai_reset: false,
  updates: true,
  marketing_pro: true,
  marketing_music: true,
};

export function useNotificationPrefs(userId: string | undefined) {
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["notification-prefs", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", userId!)
        .maybeSingle();
      if (!data) {
        // Lazy-create with defaults
        await supabase.from("notification_preferences").insert({ user_id: userId!, ...DEFAULTS });
        return DEFAULTS;
      }
      return data as unknown as NotificationPrefs;
    },
  });

  const update = useMutation({
    mutationFn: async (patch: Partial<NotificationPrefs>) => {
      if (!userId) throw new Error("Not signed in");
      const next = { ...(q.data ?? DEFAULTS), ...patch };
      const { error } = await supabase
        .from("notification_preferences")
        .upsert({ user_id: userId, ...next }, { onConflict: "user_id" });
      if (error) throw error;
      return next;
    },
    onSuccess: (next) => {
      qc.setQueryData(["notification-prefs", userId], next);
    },
  });

  return { ...q, prefs: q.data ?? DEFAULTS, update };
}

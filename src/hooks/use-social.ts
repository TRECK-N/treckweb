import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProfileLite {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "blocked";
  created_at: string;
  updated_at: string;
}

export function useFriendships(userId: string | undefined) {
  return useQuery({
    queryKey: ["friendships", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("friendships")
        .select("*")
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
        .order("updated_at", { ascending: false });
      return (data ?? []) as Friendship[];
    },
  });
}

export async function fetchProfiles(ids: string[]): Promise<Map<string, ProfileLite>> {
  if (!ids.length) return new Map();
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, username, avatar_url")
    .in("id", ids);
  return new Map((data ?? []).map((p) => [p.id, p as ProfileLite]));
}

export function useProfiles(ids: string[]) {
  const key = ids.slice().sort().join(",");
  return useQuery({
    queryKey: ["profiles-lite", key],
    enabled: ids.length > 0,
    queryFn: () => fetchProfiles(ids),
  });
}

export function initialsFor(p: { display_name?: string | null; username?: string | null } | null | undefined) {
  const name = p?.display_name || p?.username || "U";
  return name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
}

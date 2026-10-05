import { supabase } from "@/integrations/supabase/client";

export const GAME_CATEGORIES = ["Action", "Racing", "Multiplayer", "Puzzle", "Sports", "Strategy", "Casual"] as const;
export type GameCategory = (typeof GAME_CATEGORIES)[number];

/** Only official embed hosts may be used. Keep in sync with the database check. */
export const APPROVED_EMBED_HOSTS = ["html5.gamedistribution.com", "html5.gamemonetize.co"];

export type GameRow = {
  id: string; slug: string; title: string; description: string; category: string;
  thumbnail_url: string | null; official_url: string | null; embed_url: string;
  aspect_ratio: number; enabled: boolean; sort_order: number;
};

export const PUBLIC_SITE = "https://webuweb.lovable.app";

export function isApprovedEmbed(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && APPROVED_EMBED_HOSTS.includes(u.hostname);
  } catch { return false; }
}

/** Build the official embed URL, adding GameDistribution's required referrer (our canonical page URL). */
export function buildEmbedUrl(game: Pick<GameRow, "embed_url" | "slug">) {
  const u = new URL(game.embed_url);
  if (u.hostname === "html5.gamedistribution.com") {
    u.searchParams.set("gd_sdk_referrer_url", `${PUBLIC_SITE}/games/play/${game.slug}`);
  }
  return u.toString();
}

export async function fetchGames() {
  const { data, error } = await supabase.from("games").select("*").order("sort_order").order("title");
  if (error) throw error;
  return (data ?? []) as GameRow[];
}

export async function fetchIsAdmin(userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  return !!data;
}

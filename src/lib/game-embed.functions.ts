import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Asks GameDistribution (the same public endpoint its own game loader uses)
 * whether a game may run on the given domain. When `dmain` is false the
 * provider's loader replaces the game with its "not available here" page.
 */
export const checkGameDistributionDomain = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({
    gameId: z.string().regex(/^[a-f0-9]{32}$/),
    domain: z.string().regex(/^[a-z0-9.-]{1,253}$/i),
  }).parse(d))
  .handler(async ({ data }) => {
    try {
      const res = await fetch(`https://game.api.gamedistribution.com/game/v4/get/${data.gameId}/?domain=${encodeURIComponent(data.domain)}`);
      if (!res.ok) return { status: "unknown" as const };
      const j = (await res.json()) as { result?: { game?: { dmain?: boolean; bloc_gard?: { enabled?: boolean } } } };
      const g = j.result?.game;
      if (!g) return { status: "unknown" as const };
      if (g.dmain === false || g.bloc_gard?.enabled) return { status: "blocked" as const };
      return { status: "allowed" as const };
    } catch {
      return { status: "unknown" as const };
    }
  });

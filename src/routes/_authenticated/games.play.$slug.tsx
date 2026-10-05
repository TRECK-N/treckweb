import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Maximize2, RotateCw, ExternalLink, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { buildEmbedUrl, isApprovedEmbed, type GameRow } from "@/lib/games";

export const Route = createFileRoute("/_authenticated/games/play/$slug")({
  head: () => ({
    meta: [
      { title: "Play — WebuWeb Games" },
      { name: "description", content: "Play an officially embedded browser game inside WebuWeb." },
      { property: "og:title", content: "Play — WebuWeb Games" },
      { property: "og:description", content: "Play an officially embedded browser game inside WebuWeb." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlayPage,
});

function PlayPage() {
  const { slug } = Route.useParams();
  const { user } = Route.useRouteContext();
  const frameWrap = useRef<HTMLDivElement>(null);
  const [nonce, setNonce] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "slow">("loading");

  const { data: game, isLoading, error } = useQuery({
    queryKey: ["game", slug],
    queryFn: async () => {
      const { data, error } = await supabase.from("games").select("*").eq("slug", slug).maybeSingle();
      if (error) throw error;
      return data as GameRow | null;
    },
  });

  const src = useMemo(() => (game && isApprovedEmbed(game.embed_url) ? buildEmbedUrl(game) : null), [game]);

  useEffect(() => {
    if (!game) return;
    void supabase.from("game_plays").upsert({ user_id: user.id, game_id: game.id, played_at: new Date().toISOString() });
  }, [game, user.id]);

  useEffect(() => {
    setStatus("loading");
    const t = setTimeout(() => setStatus((s) => (s === "loading" ? "slow" : s)), 15000);
    return () => clearTimeout(t);
  }, [nonce, src]);

  const fullscreen = () => frameWrap.current?.requestFullscreen?.().catch(() => {});
  const official = game?.official_url || game?.embed_url;

  if (isLoading) return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (error || !game) return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <p className="text-muted-foreground">{error ? "This game couldn't be loaded." : "This game isn't available."}</p>
      <Link to="/games" className="mt-4 inline-flex items-center gap-2 text-primary"><ArrowLeft className="h-4 w-4" /> Back to games</Link>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl px-3 py-4 sm:px-6 sm:py-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link to="/games" className="inline-flex items-center gap-2 rounded-full border border-border/60 px-3 py-1.5 text-sm hover:bg-accent/60"><ArrowLeft className="h-4 w-4" /> Library</Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold">{game.title}</h1>
          <div className="text-xs text-muted-foreground">{game.category}</div>
        </div>
        <button onClick={() => setNonce((n) => n + 1)} className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5 text-sm hover:bg-accent/60"><RotateCw className="h-4 w-4" /> Reload</button>
        <button onClick={fullscreen} className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5 text-sm hover:bg-accent/60"><Maximize2 className="h-4 w-4" /> Fullscreen</button>
        {official && <a href={official} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 px-3 py-1.5 text-sm text-primary hover:bg-primary/10"><ExternalLink className="h-4 w-4" /> Official site</a>}
      </div>

      <div ref={frameWrap} className="holo-panel relative mx-auto w-full overflow-hidden rounded-2xl bg-background"
        style={{ aspectRatio: String(game.aspect_ratio || 1.6), maxHeight: "calc(100vh - 11rem)" }}>
        {!src ? (
          <Fallback official={official} text="This game's embed link isn't from an approved provider." />
        ) : (
          <>
            <iframe key={nonce} src={src} title={game.title} className="absolute inset-0 h-full w-full border-0"
              allow="autoplay; fullscreen; gamepad" allowFullScreen onLoad={() => setStatus("ready")} />
            {status !== "ready" && (
              <div className="absolute inset-0 grid place-items-center bg-background/85">
                {status === "loading" ? (
                  <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin text-primary" /> Loading game…</div>
                ) : (
                  <Fallback official={official} text="The game is taking too long to load. The provider or your network may be blocking it." onDismiss={() => setStatus("ready")} />
                )}
              </div>
            )}
          </>
        )}
      </div>
      {game.description && <p className="mx-auto mt-4 max-w-3xl text-sm text-muted-foreground">{game.description}</p>}
    </div>
  );
}

function Fallback({ official, text, onDismiss }: { official?: string | null; text: string; onDismiss?: () => void }) {
  return (
    <div className="flex max-w-sm flex-col items-center gap-3 p-6 text-center text-sm">
      <AlertTriangle className="h-6 w-6 text-destructive" />
      <p className="text-muted-foreground">{text}</p>
      <div className="flex gap-2">
        {official && <a href={official} target="_blank" rel="noopener noreferrer" className="rounded-full bg-primary px-4 py-2 font-medium text-primary-foreground">Open official game</a>}
        {onDismiss && <button onClick={onDismiss} className="rounded-full border border-border/60 px-4 py-2">Keep waiting</button>}
      </div>
    </div>
  );
}

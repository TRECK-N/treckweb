import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface TypingUser { userId: string; name: string; at: number }

/**
 * Realtime typing indicators via Supabase Broadcast on a shared channel.
 * Emits { userId, name } on `event: "typing"`. Auto-expires after 2.5s of no activity.
 */
export function useTypingIndicator(
  channelName: string,
  self: { userId: string; name: string },
): { typing: TypingUser[]; broadcast: () => void } {
  const [typing, setTyping] = useState<TypingUser[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const cooldownRef = useRef<number>(0);

  useEffect(() => {
    const ch = supabase.channel(channelName, { config: { broadcast: { self: false } } });
    channelRef.current = ch;
    ch.on("broadcast", { event: "typing" }, (payload) => {
      const p = payload.payload as { userId: string; name: string };
      if (!p?.userId || p.userId === self.userId) return;
      const at = Date.now();
      setTyping((prev) => {
        const filtered = prev.filter((t) => t.userId !== p.userId);
        return [...filtered, { userId: p.userId, name: p.name, at }];
      });
    });
    ch.subscribe();

    const interval = setInterval(() => {
      const now = Date.now();
      setTyping((prev) => prev.filter((t) => now - t.at < 2500));
    }, 800);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, self.userId]);

  const broadcast = () => {
    const now = Date.now();
    if (now - cooldownRef.current < 1500) return;
    cooldownRef.current = now;
    channelRef.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { userId: self.userId, name: self.name },
    });
  };

  return { typing, broadcast };
}

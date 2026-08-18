import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Volume2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { CoreState } from "@/components/ai-core";

const PAGE_ROUTES: Record<string, string> = {
  dashboard: "/dashboard",
  ai: "/ai",
  chat: "/chat",
  workspace: "/workspace",
  study: "/study",
  games: "/games",
  music: "/music",
  membership: "/membership",
  settings: "/settings",
};

type Recognition = {
  start: () => void;
  stop: () => void;
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
};

function getRecognition(): Recognition | null {
  if (typeof window === "undefined") return null;
  const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec: Recognition = new Ctor();
  rec.lang = navigator.language || "en-US";
  rec.continuous = false;
  rec.interimResults = true;
  return rec;
}

/**
 * "Webu" — voice control for the app. Uses the browser speech APIs for
 * listening/speaking and the AI gateway to turn speech into a safe action.
 */
export function WebuVoice({ onStateChange }: { onStateChange?: (s: CoreState) => void }) {
  const navigate = useNavigate();
  const [supported, setSupported] = useState(true);
  const [state, setState] = useState<CoreState>("idle");
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const recRef = useRef<Recognition | null>(null);

  useEffect(() => { onStateChange?.(state); }, [state, onStateChange]);
  useEffect(() => { setSupported(!!getRecognition()); }, []);

  const speak = useCallback((text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.02;
    utter.onstart = () => setState("speaking");
    utter.onend = () => setState("idle");
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  }, []);

  const run = useCallback(async (text: string) => {
    setState("thinking");
    setReply("");
    try {
      const { data: sess } = await supabase.auth.getSession();
      const res = await fetch("/api/webu-command", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sess.session?.access_token ?? ""}` },
        body: JSON.stringify({ transcript: text }),
      });
      if (!res.ok) throw new Error(await res.text());
      const cmd = (await res.json()) as { action: string; page: string | null; query: string | null; reply: string };
      setReply(cmd.reply);
      speak(cmd.reply);
      if (cmd.action === "navigate" && cmd.page && PAGE_ROUTES[cmd.page]) {
        setTimeout(() => navigate({ to: PAGE_ROUTES[cmd.page!] }), 500);
      } else if (cmd.action === "search" && cmd.query) {
        window.dispatchEvent(new CustomEvent("webu:search", { detail: cmd.query }));
      }
    } catch (err) {
      setState("idle");
      toast.error((err as Error).message || "Webu could not respond");
    }
  }, [navigate, speak]);

  const toggle = () => {
    if (state === "listening") {
      recRef.current?.stop();
      return;
    }
    const rec = getRecognition();
    if (!rec) return toast.error("Voice input isn't supported in this browser.");
    recRef.current = rec;
    setTranscript("");
    setReply("");
    let final = "";
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      setTranscript((final + interim).trim());
    };
    rec.onerror = () => { setState("idle"); toast.error("Microphone unavailable"); };
    rec.onend = () => {
      const said = final.trim();
      if (said) void run(said);
      else setState("idle");
    };
    setState("listening");
    rec.start();
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={toggle}
        disabled={!supported || state === "thinking"}
        className={`group inline-flex items-center gap-2.5 rounded-full border px-5 py-3 text-sm font-medium backdrop-blur-xl transition disabled:opacity-50 ${
          state === "listening"
            ? "border-primary/60 bg-primary/15 text-primary shadow-[var(--shadow-glow)]"
            : "border-border/70 bg-background/40 hover:bg-accent/50"
        }`}
      >
        {state === "thinking" ? <Loader2 className="h-4 w-4 animate-spin" />
          : state === "speaking" ? <Volume2 className="h-4 w-4 text-primary" />
          : state === "listening" ? <Mic className="h-4 w-4" />
          : supported ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
        {state === "listening" ? "Listening…"
          : state === "thinking" ? "Thinking…"
          : state === "speaking" ? "Speaking…"
          : supported ? "Talk to Webu" : "Voice unavailable"}
      </button>

      <AnimatePresence>
        {(transcript || reply) && (
          <motion.div
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
            className="max-w-md rounded-2xl border border-border/60 bg-background/50 px-4 py-2.5 text-center text-sm backdrop-blur-xl"
          >
            {transcript && <p className="text-muted-foreground">“{transcript}”</p>}
            {reply && <p className="mt-1 font-medium">{reply}</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

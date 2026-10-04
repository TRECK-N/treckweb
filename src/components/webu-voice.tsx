import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Volume2, Loader2, Square, Send, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { CoreState } from "@/components/ai-core";
import { executeWebuCommand, type WebuCommand } from "@/lib/webu-actions";

type Recognition = {
  start: () => void; stop: () => void; abort?: () => void;
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: any) => void) | null; onerror: ((e: any) => void) | null; onend: (() => void) | null;
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

type UiState = CoreState | "error";

/**
 * Webu — user-activated voice/text assistant. Speech → text (browser),
 * text → allow-listed action (AI), reply → speech (browser).
 */
export function useWebu(onStateChange?: (s: CoreState) => void) {
  const navigate = useNavigate();
  const [supported, setSupported] = useState(true);
  const [state, setState] = useState<UiState>("idle");
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const recRef = useRef<Recognition | null>(null);

  useEffect(() => { onStateChange?.(state === "error" ? "idle" : state); }, [state, onStateChange]);
  useEffect(() => { setSupported(!!getRecognition()); }, []);
  useEffect(() => {
    const open = () => start();
    window.addEventListener("webu:listen", open);
    return () => window.removeEventListener("webu:listen", open);
  });

  const speak = useCallback((text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) { setState("idle"); return; }
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.02;
    u.onstart = () => setState("speaking");
    u.onend = () => setState("idle");
    u.onerror = () => setState("idle");
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }, []);

  const run = useCallback(async (text: string) => {
    setState("thinking"); setReply(""); setError(""); setTranscript(text);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const res = await fetch("/api/webu-command", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sess.session?.access_token ?? ""}` },
        body: JSON.stringify({ transcript: text }),
      });
      if (!res.ok) throw new Error(await res.text());
      const cmd = (await res.json()) as WebuCommand;
      setReply(cmd.reply);
      speak(cmd.reply);
      executeWebuCommand(cmd, (o) => navigate(o as never));
    } catch (err) {
      setError((err as Error).message || "Webu could not respond");
      setState("error");
    }
  }, [navigate, speak]);

  const stop = () => {
    recRef.current?.abort?.() ?? recRef.current?.stop();
    window.speechSynthesis?.cancel();
    setState("idle");
  };

  function start() {
    if (state === "listening") { recRef.current?.stop(); return; }
    const rec = getRecognition();
    if (!rec) { setError("Voice input isn't supported here — type instead."); setState("error"); return; }
    recRef.current = rec;
    setTranscript(""); setReply(""); setError("");
    let final = "";
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final += r[0].transcript; else interim += r[0].transcript;
      }
      setTranscript((final + interim).trim());
    };
    rec.onerror = (e: any) => {
      setError(e?.error === "not-allowed" ? "Microphone permission was denied." : "Microphone unavailable.");
      setState("error");
    };
    rec.onend = () => {
      const said = final.trim();
      if (said) void run(said);
      else setState((s) => (s === "listening" ? "idle" : s));
    };
    setState("listening");
    try { rec.start(); } catch { setState("idle"); }
  }

  return { supported, state, transcript, reply, error, start, stop, run };
}

const LABEL: Record<UiState, string> = {
  idle: "Talk to Webu", listening: "Listening…", thinking: "Processing…", speaking: "Speaking…", error: "Try again",
};

/** Full voice panel: mic, stop, text fallback, transcript & reply. */
export function WebuVoice({ onStateChange, compact = false }: { onStateChange?: (s: CoreState) => void; compact?: boolean }) {
  const w = useWebu(onStateChange);
  const [text, setText] = useState("");
  const busy = w.state === "listening" || w.state === "thinking" || w.state === "speaking";

  return (
    <div className={`flex w-full flex-col gap-3 ${compact ? "" : "items-center"}`}>
      <div className="flex items-center gap-2">
        <button
          onClick={w.start}
          disabled={w.state === "thinking"}
          className={`inline-flex items-center gap-2.5 rounded-full border px-5 py-2.5 text-sm font-medium backdrop-blur-xl transition disabled:opacity-60 ${
            w.state === "listening" ? "border-cyan/60 bg-primary/15 text-cyan shadow-[var(--shadow-glow)]" : "border-primary/30 bg-background/40 hover:border-primary/60 hover:bg-primary/10"
          }`}
        >
          {w.state === "thinking" ? <Loader2 className="h-4 w-4 animate-spin" />
            : w.state === "speaking" ? <Volume2 className="h-4 w-4 text-primary" />
            : w.state === "error" ? <AlertCircle className="h-4 w-4 text-destructive" />
            : w.supported ? <Mic className="h-4 w-4 text-primary" /> : <MicOff className="h-4 w-4" />}
          {w.supported || w.state !== "idle" ? LABEL[w.state] : "Voice unavailable"}
        </button>
        {busy && (
          <button onClick={w.stop} aria-label="Stop" className="grid h-10 w-10 place-items-center rounded-full border border-border/70 bg-background/40 hover:bg-destructive/15 hover:text-destructive">
            <Square className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); const t = text.trim(); if (t.length > 1) { void w.run(t); setText(""); } }}
        className="flex w-full max-w-md items-center gap-2 rounded-full border border-border/60 bg-background/40 px-4 py-1.5 backdrop-blur-xl focus-within:border-primary/50"
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Or type a command — “open my workspace”"
          className="flex-1 bg-transparent py-1.5 text-sm outline-none placeholder:text-muted-foreground" />
        <button type="submit" aria-label="Send" disabled={text.trim().length < 2 || w.state === "thinking"} className="text-primary disabled:opacity-40">
          <Send className="h-4 w-4" />
        </button>
      </form>

      <AnimatePresence>
        {(w.transcript || w.reply || w.error) && (
          <motion.div
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
            className="w-full max-w-md rounded-2xl border border-border/60 bg-background/50 px-4 py-2.5 text-sm backdrop-blur-xl"
          >
            {w.transcript && <p className="text-muted-foreground">“{w.transcript}”</p>}
            {w.reply && <p className="mt-1 font-medium">{w.reply}</p>}
            {w.error && <p className="mt-1 text-destructive">{w.error}</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

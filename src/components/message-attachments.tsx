import { useState, useRef, useEffect } from "react";
import { FileText, Download, Play, Pause } from "lucide-react";
import type { ChatAttachment } from "@/lib/chat-attachments";

export function MessageAttachments({ items }: { items: ChatAttachment[] }) {
  if (!items?.length) return null;
  return (
    <div className="mt-1 flex flex-col gap-1.5 max-w-sm">
      {items.map((a, i) => {
        if (a.kind === "image") {
          return (
            <a key={i} href={a.url} target="_blank" rel="noreferrer" className="block rounded-xl overflow-hidden border border-border/60 max-w-[280px]">
              <img src={a.url} alt={a.name || "image"} className="max-h-64 w-auto object-cover" loading="lazy" />
            </a>
          );
        }
        if (a.kind === "audio") {
          return <VoicePlayer key={i} url={a.url} duration={a.duration} />;
        }
        return (
          <a key={i} href={a.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-background/40 px-3 py-2 text-xs hover:bg-accent/50 transition">
            <FileText className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate flex-1 min-w-0">{a.name || "File"}</span>
            <Download className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </a>
        );
      })}
    </div>
  );
}

function VoicePlayer({ url, duration }: { url: string; duration?: number }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dur, setDur] = useState(duration ?? 0);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => { setProgress(a.currentTime); };
    const onEnd = () => { setPlaying(false); setProgress(0); };
    const onLoad = () => { if (Number.isFinite(a.duration)) setDur(a.duration); };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnd);
    a.addEventListener("loadedmetadata", onLoad);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnd);
      a.removeEventListener("loadedmetadata", onLoad);
    };
  }, []);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play(); setPlaying(true); }
  };

  const pct = dur > 0 ? (progress / dur) * 100 : 0;
  const fmt = (s: number) => {
    if (!Number.isFinite(s) || s <= 0) return "0:00";
    const m = Math.floor(s / 60); const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="inline-flex items-center gap-3 rounded-2xl border border-border/60 bg-background/40 px-3 py-2 min-w-[220px]">
      <audio ref={audioRef} src={url} preload="metadata" />
      <button onClick={toggle} className="h-8 w-8 rounded-full bg-primary text-primary-foreground grid place-items-center hover:opacity-90 shrink-0" aria-label={playing ? "Pause" : "Play"}>
        {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 translate-x-[1px]" />}
      </button>
      <div className="flex-1">
        <div className="h-1 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-1 text-[10px] text-muted-foreground">{fmt(progress)} / {fmt(dur)}</div>
      </div>
    </div>
  );
}

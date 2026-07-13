import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback, type ReactNode } from "react";

export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  cover_url: string | null;
  audio_url: string;
  duration_seconds: number | null;
}

type Repeat = "off" | "all" | "one";

interface PlayerContextValue {
  current: Song | null;
  queue: Song[];
  playing: boolean;
  progress: number;
  duration: number;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: Repeat;
  setQueue: (songs: Song[]) => void;
  play: (song: Song, queue?: Song[]) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (t: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  stop: () => void;
  onSongEnd?: (song: Song) => void;
  setOnSongEnd: (cb: (song: Song) => void) => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function MusicPlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [current, setCurrent] = useState<Song | null>(null);
  const [queue, setQueueState] = useState<Song[]>([]);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<Repeat>("off");
  const onEndRef = useRef<((s: Song) => void) | undefined>(undefined);

  // Ensure audio element exists once
  useEffect(() => {
    if (!audioRef.current) {
      const a = new Audio();
      a.preload = "metadata";
      audioRef.current = a;
    }
    const a = audioRef.current!;
    const onTime = () => setProgress(a.currentTime);
    const onLoaded = () => setDuration(a.duration || 0);
    const onEnded = () => handleEnded();
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onLoaded);
    a.addEventListener("ended", onEnded);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onLoaded);
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const a = audioRef.current;
    if (a) a.volume = muted ? 0 : volume;
  }, [volume, muted]);

  const idx = current ? queue.findIndex((s) => s.id === current.id) : -1;

  const handleEnded = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (repeat === "one" && current) {
      a.currentTime = 0;
      void a.play();
      return;
    }
    const list = queue;
    if (!list.length) { setPlaying(false); return; }
    let n: number;
    if (shuffle) n = Math.floor(Math.random() * list.length);
    else {
      n = idx + 1;
      if (n >= list.length) {
        if (repeat === "all") n = 0;
        else { setPlaying(false); return; }
      }
    }
    const nx = list[n];
    if (nx) playSong(nx);
    if (current) onEndRef.current?.(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, queue, shuffle, repeat, idx]);

  const playSong = (song: Song) => {
    const a = audioRef.current;
    if (!a) return;
    setCurrent(song);
    if (a.src !== song.audio_url) {
      a.src = song.audio_url;
    }
    a.volume = muted ? 0 : volume;
    void a.play().catch(() => setPlaying(false));
    // Media Session
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: song.title,
        artist: song.artist,
        album: song.album || undefined,
        artwork: song.cover_url ? [{ src: song.cover_url, sizes: "512x512" }] : undefined,
      });
    }
  };

  const play = (song: Song, newQueue?: Song[]) => {
    if (newQueue) setQueueState(newQueue);
    playSong(song);
  };

  const toggle = () => {
    const a = audioRef.current;
    if (!a || !current) return;
    if (a.paused) void a.play(); else a.pause();
  };

  const next = () => {
    if (!queue.length) return;
    let n: number;
    if (shuffle) n = Math.floor(Math.random() * queue.length);
    else n = (idx + 1) % queue.length;
    const nx = queue[n];
    if (nx) playSong(nx);
  };

  const prev = () => {
    if (!queue.length) return;
    if (progress > 3 && audioRef.current) { audioRef.current.currentTime = 0; return; }
    const p = idx <= 0 ? queue.length - 1 : idx - 1;
    const px = queue[p];
    if (px) playSong(px);
  };

  const seek = (t: number) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = t;
    setProgress(t);
  };

  const stop = () => {
    const a = audioRef.current;
    if (a) { a.pause(); a.src = ""; }
    setCurrent(null);
    setPlaying(false);
  };

  // Media Session action handlers
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.setActionHandler("play", () => toggle());
    navigator.mediaSession.setActionHandler("pause", () => toggle());
    navigator.mediaSession.setActionHandler("previoustrack", () => prev());
    navigator.mediaSession.setActionHandler("nexttrack", () => next());
    navigator.mediaSession.setActionHandler("seekto", (details) => {
      if (details.seekTime != null) seek(details.seekTime);
    });
    return () => {
      if (!("mediaSession" in navigator)) return;
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.setActionHandler("previoustrack", null);
      navigator.mediaSession.setActionHandler("nexttrack", null);
      navigator.mediaSession.setActionHandler("seekto", null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, queue, shuffle, repeat, idx]);

  const value = useMemo<PlayerContextValue>(() => ({
    current, queue, playing, progress, duration, volume, muted, shuffle, repeat,
    setQueue: setQueueState,
    play, toggle, next, prev, seek,
    setVolume: setVolumeState, toggleMute: () => setMuted((m) => !m),
    toggleShuffle: () => setShuffle((s) => !s),
    cycleRepeat: () => setRepeat((r) => r === "off" ? "all" : r === "all" ? "one" : "off"),
    stop,
    setOnSongEnd: (cb) => { onEndRef.current = cb; },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [current, queue, playing, progress, duration, volume, muted, shuffle, repeat]);

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function useMusicPlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("useMusicPlayer must be used inside MusicPlayerProvider");
  return ctx;
}

export function formatTime(s: number) {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

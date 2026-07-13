import { useEffect, useRef, useState } from "react";
import { Send, Smile, Paperclip, Mic, X, Loader2, Square } from "lucide-react";
import { toast } from "sonner";
import { uploadChatAttachment, type ChatAttachment } from "@/lib/chat-attachments";
import { MessageAttachments } from "./message-attachments";

const EMOJIS = ["😀", "😂", "😍", "🔥", "🎉", "👍", "❤️", "🚀", "💯", "🙌", "🤔", "😎"];

export function ChatComposer({
  userId,
  placeholder,
  disabled,
  onSend,
  onTyping,
}: {
  userId: string;
  placeholder?: string;
  disabled?: boolean;
  onSend: (payload: { content: string; attachments: ChatAttachment[] }) => Promise<void> | void;
  onTyping?: () => void;
}) {
  const [input, setInput] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    mediaRecorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
  }, []);

  const pickFiles = () => fileRef.current?.click();

  const onFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setUploading(true);
    try {
      const uploaded: ChatAttachment[] = [];
      for (const f of Array.from(files)) {
        const kind: ChatAttachment["kind"] = f.type.startsWith("image/") ? "image" : "file";
        const a = await uploadChatAttachment(userId, f, kind);
        uploaded.push(a);
      }
      setAttachments((p) => [...p, ...uploaded]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setUploading(true);
        try {
          const a = await uploadChatAttachment(userId, blob, "audio", `voice-${Date.now()}.webm`);
          a.duration = recordSeconds;
          setAttachments((p) => [...p, a]);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Voice upload failed");
        } finally { setUploading(false); }
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch {
      toast.error("Microphone permission denied");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    if (recordTimerRef.current) { clearInterval(recordTimerRef.current); recordTimerRef.current = null; }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      chunksRef.current = [];
      try { mediaRecorderRef.current.stop(); } catch { /* ignore */ }
    }
    setRecording(false);
    if (recordTimerRef.current) { clearInterval(recordTimerRef.current); recordTimerRef.current = null; }
  };

  const canSend = (input.trim().length > 0 || attachments.length > 0) && !uploading && !recording && !disabled;

  const send = async () => {
    if (!canSend) return;
    const text = input.trim();
    const files = attachments;
    setInput("");
    setAttachments([]);
    await onSend({ content: text, attachments: files });
  };

  return (
    <div className="border-t border-border/60 p-4">
      <div className="max-w-3xl mx-auto relative">
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachments.map((a, i) => (
              <div key={i} className="relative">
                <MessageAttachments items={[a]} />
                <button
                  onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))}
                  className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground grid place-items-center text-xs shadow"
                  aria-label="Remove"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {showEmoji && (
          <div className="absolute bottom-14 left-0 glass rounded-2xl p-2 grid grid-cols-6 gap-1 z-10">
            {EMOJIS.map((e) => (
              <button key={e} className="text-xl hover:bg-accent rounded-lg p-1" onClick={() => { setInput((p) => p + e); setShowEmoji(false); }}>{e}</button>
            ))}
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          accept="image/*,application/pdf,.doc,.docx,.txt,.md,.csv,.json,.zip"
          onChange={(e) => onFiles(e.target.files)}
        />

        {recording ? (
          <div className="glass rounded-2xl flex items-center gap-3 p-3">
            <div className="h-2.5 w-2.5 rounded-full bg-destructive animate-pulse" />
            <div className="flex-1 text-sm">Recording… {Math.floor(recordSeconds/60)}:{(recordSeconds%60).toString().padStart(2,"0")}</div>
            <button onClick={cancelRecording} className="text-xs text-muted-foreground hover:text-destructive">Cancel</button>
            <button onClick={stopRecording} className="h-9 w-9 rounded-xl bg-primary text-primary-foreground grid place-items-center hover:opacity-90 shadow-[var(--shadow-glow)]" aria-label="Stop">
              <Square className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="glass rounded-2xl flex items-center gap-1 p-1.5">
            <button onClick={() => setShowEmoji((s) => !s)} className="p-2 rounded-lg hover:bg-accent text-muted-foreground" aria-label="Emoji" type="button">
              <Smile className="h-4 w-4" />
            </button>
            <button onClick={pickFiles} disabled={uploading || !!disabled} className="p-2 rounded-lg hover:bg-accent text-muted-foreground disabled:opacity-40" aria-label="Attach" type="button">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
            </button>
            <button onClick={startRecording} disabled={!!disabled} className="p-2 rounded-lg hover:bg-accent text-muted-foreground disabled:opacity-40" aria-label="Voice" type="button">
              <Mic className="h-4 w-4" />
            </button>
            <input
              value={input}
              onChange={(e) => { setInput(e.target.value); onTyping?.(); }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={placeholder || "Message…"}
              disabled={!!disabled}
              className="flex-1 bg-transparent px-2 py-2 text-sm outline-none disabled:opacity-50"
            />
            <button onClick={send} disabled={!canSend}
              className="h-9 w-9 rounded-xl bg-primary text-primary-foreground grid place-items-center hover:opacity-90 transition disabled:opacity-40 shadow-[var(--shadow-glow)]"
              aria-label="Send" type="button">
              <Send className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

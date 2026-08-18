import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, FileQuestion } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/** Inline preview for a workspace file: images, video, audio, PDFs and text. */
export function FilePreview({ path, mime, name }: { path: string; mime: string | null; name: string }) {
  const type = (mime ?? "").toLowerCase();
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const isImage = type.startsWith("image/");
  const isVideo = type.startsWith("video/");
  const isAudio = type.startsWith("audio/");
  const isPdf = type === "application/pdf" || ext === "pdf";
  const isText =
    type.startsWith("text/") ||
    ["json", "csv", "md", "txt", "log", "ts", "tsx", "js", "css", "html"].includes(ext);
  const previewable = isImage || isVideo || isAudio || isPdf || isText;

  const { data: url, isLoading } = useQuery({
    queryKey: ["file-url", path],
    enabled: previewable,
    staleTime: 4 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.storage.from("workspace").createSignedUrl(path, 300);
      return data?.signedUrl ?? null;
    },
  });

  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    if (!isText || !url) return;
    let cancelled = false;
    fetch(url)
      .then((r) => r.text())
      .then((t) => !cancelled && setText(t.slice(0, 20000)))
      .catch(() => !cancelled && setText(null));
    return () => { cancelled = true; };
  }, [isText, url]);

  if (!previewable) {
    return (
      <div className="grid place-items-center gap-2 rounded-2xl border border-border/60 bg-background/40 py-10 text-center text-xs text-muted-foreground">
        <FileQuestion className="h-6 w-6" />
        No inline preview for this file type
      </div>
    );
  }

  if (isLoading || !url) {
    return (
      <div className="grid place-items-center rounded-2xl border border-border/60 bg-background/40 py-10">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-background/40">
      {isImage && <img src={url} alt={name} className="max-h-72 w-full object-contain" />}
      {isVideo && <video src={url} controls className="max-h-72 w-full bg-black" />}
      {isAudio && <audio src={url} controls className="w-full p-3" />}
      {isPdf && <iframe src={url} title={name} className="h-80 w-full" />}
      {isText && (
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap p-3 text-xs leading-relaxed text-muted-foreground">
          {text ?? "Loading…"}
        </pre>
      )}
    </div>
  );
}

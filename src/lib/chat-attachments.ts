export type ChatAttachment = {
  kind: "image" | "file" | "audio";
  url: string;
  name?: string;
  size?: number;
  duration?: number;
  mime?: string;
};

import { supabase } from "@/integrations/supabase/client";

export async function uploadChatAttachment(
  userId: string,
  file: File | Blob,
  kind: ChatAttachment["kind"],
  extraName?: string,
): Promise<ChatAttachment> {
  const filename = (file as File).name || extraName || `${kind}-${Date.now()}`;
  const ext = filename.includes(".") ? filename.split(".").pop() : (kind === "audio" ? "webm" : "bin");
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
  const { error } = await supabase.storage.from("chat-attachments").upload(path, file, {
    contentType: (file as File).type || (kind === "audio" ? "audio/webm" : undefined),
    upsert: false,
  });
  if (error) throw error;
  const { data } = await supabase.storage.from("chat-attachments").createSignedUrl(path, 60 * 60 * 24 * 365);
  return {
    kind,
    url: data?.signedUrl ?? "",
    name: filename,
    size: (file as File).size,
    mime: (file as File).type,
  };
}

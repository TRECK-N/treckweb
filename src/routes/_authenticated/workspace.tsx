import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  FolderPlus, Folder, Plus, Pin, Trash2, Search, FileText, Upload, File as FileIcon, Loader2, Pencil,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/workspace")({
  component: Workspace,
});

const COLORS = ["violet", "sky", "emerald", "amber", "rose", "cyan"];

function Workspace() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { data: folders = [] } = useQuery({
    queryKey: ["folders", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("folders")
        .select("*").eq("user_id", user.id).order("created_at");
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!activeFolder && folders[0]) setActiveFolder(folders[0].id);
  }, [folders, activeFolder]);

  const { data: notes = [] } = useQuery({
    queryKey: ["notes", user.id, activeFolder],
    queryFn: async () => {
      if (!activeFolder) return [];
      const { data } = await supabase.from("notes")
        .select("*").eq("user_id", user.id).eq("folder_id", activeFolder)
        .order("pinned", { ascending: false }).order("updated_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!activeFolder,
  });

  const { data: files = [] } = useQuery({
    queryKey: ["files", user.id, activeFolder],
    queryFn: async () => {
      if (!activeFolder) return [];
      const { data } = await supabase.from("workspace_files")
        .select("*").eq("user_id", user.id).eq("folder_id", activeFolder)
        .order("pinned", { ascending: false }).order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!activeFolder,
  });

  const createFolder = async () => {
    const name = prompt("Folder name?");
    if (!name?.trim()) return;
    const color = COLORS[folders.length % COLORS.length];
    const { data, error } = await supabase.from("folders").insert({ user_id: user.id, name, color }).select().single();
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["folders", user.id] });
    if (data) setActiveFolder(data.id);
  };

  const renameFolder = async (id: string, current: string) => {
    const name = prompt("Rename folder", current);
    if (!name?.trim() || name === current) return;
    await supabase.from("folders").update({ name }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["folders", user.id] });
  };

  const deleteFolder = async (id: string) => {
    if (!confirm("Delete folder and everything inside?")) return;
    await supabase.from("folders").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["folders", user.id] });
    if (activeFolder === id) setActiveFolder(null);
  };

  const createNote = async () => {
    if (!activeFolder) return;
    const { data } = await supabase.from("notes")
      .insert({ user_id: user.id, folder_id: activeFolder, title: "Untitled note", content: "" }).select().single();
    if (data) qc.invalidateQueries({ queryKey: ["notes", user.id, activeFolder] });
  };

  const updateNote = async (id: string, patch: { title?: string; content?: string; pinned?: boolean }) => {
    await supabase.from("notes").update(patch).eq("id", id);
    qc.invalidateQueries({ queryKey: ["notes", user.id, activeFolder] });
  };

  const deleteNote = async (id: string) => {
    if (!confirm("Delete note?")) return;
    await supabase.from("notes").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["notes", user.id, activeFolder] });
  };

  const uploadFile = async (file: File) => {
    if (!activeFolder) return;
    const path = `${user.id}/${activeFolder}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("workspace").upload(path, file);
    if (error) return toast.error(error.message);
    await supabase.from("workspace_files").insert({
      user_id: user.id, folder_id: activeFolder,
      name: file.name, storage_path: path, mime_type: file.type, size: file.size,
    });
    qc.invalidateQueries({ queryKey: ["files", user.id, activeFolder] });
    toast.success("Uploaded");
  };

  const downloadFile = async (path: string, name: string) => {
    const { data } = await supabase.storage.from("workspace").createSignedUrl(path, 60);
    if (data?.signedUrl) {
      const a = document.createElement("a");
      a.href = data.signedUrl; a.download = name; a.click();
    }
  };

  const deleteFile = async (id: string, path: string) => {
    if (!confirm("Delete file?")) return;
    await supabase.storage.from("workspace").remove([path]);
    await supabase.from("workspace_files").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["files", user.id, activeFolder] });
  };

  const filteredNotes = notes.filter((n) => n.title.toLowerCase().includes(search.toLowerCase()) || (n.content ?? "").toLowerCase().includes(search.toLowerCase()));
  const filteredFiles = files.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()));
  const activeMeta = folders.find((f) => f.id === activeFolder);

  return (
    <div className="flex h-[calc(100vh-56px)] lg:h-screen">
      <aside className="hidden md:flex w-64 flex-col border-r border-border/60 bg-sidebar p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold">Workspace</h2>
          <button onClick={createFolder} className="p-1.5 rounded-lg hover:bg-accent" aria-label="New folder">
            <FolderPlus className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-1 flex-1 overflow-y-auto">
          {folders.map((f) => (
            <div key={f.id} className={`group flex items-center rounded-lg ${activeFolder === f.id ? "bg-sidebar-accent" : ""}`}>
              <button onClick={() => setActiveFolder(f.id)} className="flex-1 flex items-center gap-2 px-2 py-2 text-sm">
                <Folder className="h-4 w-4 text-primary" />
                <span className="truncate">{f.name}</span>
              </button>
              <button onClick={() => renameFolder(f.id, f.name)} className="p-1.5 opacity-0 group-hover:opacity-100 hover:text-primary" aria-label="Rename"><Pencil className="h-3 w-3" /></button>
              <button onClick={() => deleteFolder(f.id)} className="p-1.5 opacity-0 group-hover:opacity-100 hover:text-destructive" aria-label="Delete"><Trash2 className="h-3 w-3" /></button>
            </div>
          ))}
          {folders.length === 0 && (
            <button onClick={createFolder} className="w-full text-left glass rounded-xl p-3 text-sm text-muted-foreground hover:text-foreground">
              <FolderPlus className="h-4 w-4 inline mr-2" />Create your first folder
            </button>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-border/60 px-6 py-4 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-lg truncate">{activeMeta?.name ?? "Workspace"}</h1>
            <p className="text-xs text-muted-foreground">Notes, files, all in one place.</p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="pl-9 pr-3 py-2 rounded-xl border border-border bg-background/40 text-sm outline-none w-40 sm:w-64 focus:border-primary" />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {!activeFolder ? (
            <div className="text-center text-muted-foreground py-16">Select or create a folder to get started.</div>
          ) : (
            <>
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-sm">Notes</h2>
                  <button onClick={createNote} className="inline-flex items-center gap-1.5 text-xs rounded-full bg-primary text-primary-foreground px-3 py-1.5 hover:opacity-90"><Plus className="h-3.5 w-3.5" />New note</button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <AnimatePresence>
                    {filteredNotes.map((n) => (
                      <motion.div key={n.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                        className="glass rounded-2xl p-4 hover:shadow-[var(--shadow-glow)] transition group">
                        <div className="flex items-start justify-between gap-2">
                          <input
                            defaultValue={n.title}
                            onBlur={(e) => e.target.value !== n.title && updateNote(n.id, { title: e.target.value })}
                            className="font-semibold bg-transparent outline-none flex-1 min-w-0"
                          />
                          <div className="flex opacity-0 group-hover:opacity-100 transition">
                            <button onClick={() => updateNote(n.id, { pinned: !n.pinned })} className={`p-1 ${n.pinned ? "text-primary" : "text-muted-foreground hover:text-primary"}`}><Pin className="h-3.5 w-3.5" /></button>
                            <button onClick={() => deleteNote(n.id)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </div>
                        <textarea
                          defaultValue={n.content ?? ""}
                          onBlur={(e) => e.target.value !== (n.content ?? "") && updateNote(n.id, { content: e.target.value })}
                          placeholder="Write something…"
                          rows={5}
                          className="mt-2 w-full bg-transparent resize-none outline-none text-sm text-muted-foreground"
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </section>

              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-sm">Files</h2>
                  <label className="inline-flex items-center gap-1.5 text-xs rounded-full glass px-3 py-1.5 cursor-pointer hover:bg-accent">
                    <Upload className="h-3.5 w-3.5" />Upload
                    <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])} />
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredFiles.map((f) => (
                    <div key={f.id} className="glass rounded-2xl p-4 flex items-center gap-3 group">
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary-glow/20 grid place-items-center text-primary">
                        <FileIcon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <button onClick={() => downloadFile(f.storage_path, f.name)} className="block text-left text-sm font-medium truncate hover:text-primary">{f.name}</button>
                        <div className="text-xs text-muted-foreground">{formatSize(f.size ?? 0)}</div>
                      </div>
                      <button onClick={() => deleteFile(f.id, f.storage_path)} className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  ))}
                  {filteredFiles.length === 0 && (
                    <div className="col-span-full text-center text-sm text-muted-foreground py-8">No files yet. Upload PDFs, images, or docs.</div>
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function formatSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

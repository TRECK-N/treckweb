import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  FolderPlus, Plus, Trash2, Search, Upload, Pencil, ChevronRight, Home, X,
  Download, ArrowRightLeft, Pin, ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { WorkspaceUniverse, type UniverseCounts, type UniverseItem } from "@/components/workspace-universe";

export const Route = createFileRoute("/_authenticated/workspace")({
  head: () => ({
    meta: [
      { title: "Workspace — WebuWeb" },
      { name: "description", content: "Explore your folders, notes, files and study sets in an immersive workspace universe." },
      { property: "og:title", content: "Workspace — WebuWeb" },
      { property: "og:description", content: "Explore your folders, notes, files and study sets in an immersive workspace universe." },
    ],
  }),
  component: Workspace,
});

const COLORS = ["violet", "sky", "emerald", "amber", "rose", "cyan"];

interface FolderRow {
  id: string; user_id: string; name: string; color: string | null;
  icon: string | null; parent_id: string | null; created_at: string; updated_at: string;
}

type Selected =
  | { kind: "note"; id: string }
  | { kind: "file"; id: string }
  | { kind: "deck"; id: string }
  | { kind: "quiz"; id: string }
  | null;

function Workspace() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [openPath, setOpenPath] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Selected>(null);

  const currentFolder = openPath.length ? openPath[openPath.length - 1] : null;

  const { data: folders = [] } = useQuery({
    queryKey: ["folders", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("folders").select("*").eq("user_id", user.id).order("created_at");
      return (data ?? []) as FolderRow[];
    },
  });

  const { data: counts = new Map<string, UniverseCounts>() } = useQuery({
    queryKey: ["workspace-counts", user.id],
    queryFn: async () => {
      const [{ data: allNotes }, { data: allFiles }] = await Promise.all([
        supabase.from("notes").select("folder_id").eq("user_id", user.id),
        supabase.from("workspace_files").select("folder_id").eq("user_id", user.id),
      ]);
      const m = new Map<string, UniverseCounts>();
      const bump = (id: string | null, key: keyof UniverseCounts) => {
        if (!id) return;
        const c = m.get(id) ?? { notes: 0, files: 0 };
        c[key] += 1;
        m.set(id, c);
      };
      (allNotes ?? []).forEach((n) => bump(n.folder_id, "notes"));
      (allFiles ?? []).forEach((f) => bump(f.folder_id, "files"));
      return m;
    },
  });

  const { data: notes = [] } = useQuery({
    queryKey: ["notes", user.id, currentFolder],
    enabled: !!currentFolder,
    queryFn: async () => {
      const { data } = await supabase.from("notes").select("*").eq("user_id", user.id)
        .eq("folder_id", currentFolder!).order("pinned", { ascending: false }).order("updated_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: files = [] } = useQuery({
    queryKey: ["files", user.id, currentFolder],
    enabled: !!currentFolder,
    queryFn: async () => {
      const { data } = await supabase.from("workspace_files").select("*").eq("user_id", user.id)
        .eq("folder_id", currentFolder!).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: decks = [] } = useQuery({
    queryKey: ["ws-decks", user.id, currentFolder],
    enabled: !!currentFolder,
    queryFn: async () => {
      const { data } = await (supabase as any).from("study_decks").select("id,title")
        .eq("user_id", user.id).eq("folder_id", currentFolder!);
      return (data ?? []) as Array<{ id: string; title: string }>;
    },
  });

  const { data: quizzes = [] } = useQuery({
    queryKey: ["ws-quizzes", user.id, currentFolder],
    enabled: !!currentFolder,
    queryFn: async () => {
      const { data } = await (supabase as any).from("study_quizzes").select("id,title")
        .eq("user_id", user.id).eq("folder_id", currentFolder!);
      return (data ?? []) as Array<{ id: string; title: string }>;
    },
  });

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["folders", user.id] });
    qc.invalidateQueries({ queryKey: ["workspace-counts", user.id] });
    qc.invalidateQueries({ queryKey: ["notes", user.id, currentFolder] });
    qc.invalidateQueries({ queryKey: ["files", user.id, currentFolder] });
    qc.invalidateQueries({ queryKey: ["ws-decks", user.id, currentFolder] });
    qc.invalidateQueries({ queryKey: ["ws-quizzes", user.id, currentFolder] });
  };

  const q = search.trim().toLowerCase();
  const items: UniverseItem[] = useMemo(() => {
    const list: UniverseItem[] = [
      ...notes.map((n) => ({ id: n.id, name: n.title || "Untitled note", kind: "note" as const })),
      ...files.map((f) => ({ id: f.id, name: f.name, kind: "file" as const, mime: f.mime_type })),
      ...decks.map((d) => ({ id: d.id, name: d.title, kind: "deck" as const })),
      ...quizzes.map((z) => ({ id: z.id, name: z.title, kind: "quiz" as const })),
    ];
    return q ? list.filter((i) => i.name.toLowerCase().includes(q)) : list;
  }, [notes, files, decks, quizzes, q]);

  /* ---------- folder actions ---------- */
  const createFolder = async (parentId: string | null) => {
    const name = prompt(parentId ? "Subfolder name?" : "Folder name?");
    if (!name?.trim()) return;
    const color = COLORS[folders.length % COLORS.length];
    const { error } = await supabase.from("folders")
      .insert({ user_id: user.id, name: name.trim(), color, parent_id: parentId });
    if (error) return toast.error(error.message);
    refreshAll();
  };

  const renameFolder = async () => {
    if (!currentFolder) return;
    const cur = folders.find((f) => f.id === currentFolder);
    const name = prompt("Rename folder", cur?.name ?? "");
    if (!name?.trim() || name === cur?.name) return;
    await supabase.from("folders").update({ name: name.trim() }).eq("id", currentFolder);
    refreshAll();
  };

  const deleteFolder = async () => {
    if (!currentFolder) return;
    if (!confirm("Delete this folder and everything inside it?")) return;
    await supabase.from("folders").delete().eq("id", currentFolder);
    setOpenPath((p) => p.slice(0, -1));
    refreshAll();
  };

  /* ---------- item actions ---------- */
  const createNote = async () => {
    if (!currentFolder) return;
    const { data } = await supabase.from("notes")
      .insert({ user_id: user.id, folder_id: currentFolder, title: "Untitled note", content: "" }).select().single();
    refreshAll();
    if (data) setSelected({ kind: "note", id: data.id });
  };

  const uploadFile = async (file: File) => {
    if (!currentFolder) return;
    const path = `${user.id}/${currentFolder}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("workspace").upload(path, file);
    if (error) return toast.error(error.message);
    await supabase.from("workspace_files").insert({
      user_id: user.id, folder_id: currentFolder,
      name: file.name, storage_path: path, mime_type: file.type, size: file.size,
    });
    refreshAll();
    toast.success("Uploaded");
  };

  const moveTo = async (kind: "note" | "file" | "deck" | "quiz", id: string) => {
    const options = folders.map((f) => `${f.id}: ${folderPath(f, folders)}`).join("\n");
    const target = prompt(`Move to folder — paste the folder id:\n${options}`);
    const clean = target?.split(":")[0].trim();
    if (!clean) return;
    if (!folders.some((f) => f.id === clean)) return toast.error("Folder not found");
    const table = kind === "note" ? "notes" : kind === "file" ? "workspace_files" : kind === "deck" ? "study_decks" : "study_quizzes";
    await (supabase as any).from(table).update({ folder_id: clean }).eq("id", id);
    setSelected(null);
    refreshAll();
    toast.success("Moved");
  };

  const breadcrumb = openPath.map((id) => folders.find((f) => f.id === id)).filter(Boolean) as FolderRow[];

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col lg:h-screen">
      <header className="flex flex-wrap items-center gap-3 border-b border-border/60 px-5 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 truncate text-xs text-muted-foreground">
            <button onClick={() => setOpenPath([])} className="inline-flex items-center gap-1 hover:text-foreground">
              <Home className="h-3 w-3" /> Universe
            </button>
            {breadcrumb.map((b, i) => (
              <span key={b.id} className="inline-flex items-center gap-1">
                <ChevronRight className="h-3 w-3" />
                <button onClick={() => setOpenPath(openPath.slice(0, i + 1))}
                  className={i === breadcrumb.length - 1 ? "font-medium text-foreground" : "hover:text-foreground"}>
                  {b.name}
                </button>
              </span>
            ))}
          </div>
          <h1 className="mt-0.5 truncate text-lg font-bold">
            {breadcrumb.length ? breadcrumb[breadcrumb.length - 1].name : "Workspace universe"}
          </h1>
        </div>

        {currentFolder && (
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={createNote} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">
              <Plus className="h-3.5 w-3.5" /> Note
            </button>
            <label className="glass inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs hover:bg-accent">
              <Upload className="h-3.5 w-3.5" /> Upload
              <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])} />
            </label>
            <button onClick={() => createFolder(currentFolder)} className="glass inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs hover:bg-accent">
              <FolderPlus className="h-3.5 w-3.5" /> Subfolder
            </button>
            <button onClick={renameFolder} className="glass grid h-8 w-8 place-items-center rounded-full hover:bg-accent" aria-label="Rename folder"><Pencil className="h-3.5 w-3.5" /></button>
            <button onClick={deleteFolder} className="glass grid h-8 w-8 place-items-center rounded-full text-destructive hover:bg-destructive/10" aria-label="Delete folder"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter items…"
            className="w-40 rounded-xl border border-border bg-background/40 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary sm:w-56" />
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        <WorkspaceUniverse
          folders={folders}
          openPath={openPath}
          counts={counts}
          items={items}
          onOpenFolder={(id) => { setSelected(null); setOpenPath((p) => (p.includes(id) ? p : [...p, id])); }}
          onCollapse={() => { setSelected(null); setOpenPath((p) => p.slice(0, -1)); }}
          onCreateFolder={createFolder}
          onSelectItem={(it) => setSelected({ kind: it.kind, id: it.id } as Selected)}
        />

        <AnimatePresence>
          {selected && (
            <motion.aside
              initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="glass absolute right-0 top-0 z-20 flex h-full w-full max-w-md flex-col border-l border-border/60"
            >
              <div className="flex items-center justify-between border-b border-border/60 p-4">
                <div className="text-sm font-semibold capitalize">{selected.kind}</div>
                <button onClick={() => setSelected(null)} className="rounded-lg p-1.5 hover:bg-accent" aria-label="Close"><X className="h-4 w-4" /></button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {selected.kind === "note" && (
                  <NoteEditor
                    note={notes.find((n) => n.id === selected.id)}
                    onSaved={refreshAll}
                    onDeleted={() => { setSelected(null); refreshAll(); }}
                    onMove={() => moveTo("note", selected.id)}
                  />
                )}
                {selected.kind === "file" && (
                  <FilePanel
                    file={files.find((f) => f.id === selected.id)}
                    onChanged={refreshAll}
                    onDeleted={() => { setSelected(null); refreshAll(); }}
                    onMove={() => moveTo("file", selected.id)}
                  />
                )}
                {(selected.kind === "deck" || selected.kind === "quiz") && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      This {selected.kind === "deck" ? "flashcard deck" : "quiz"} lives in this folder and stays available in Study.
                    </p>
                    <button
                      onClick={() => navigate({
                        to: selected.kind === "deck" ? "/study/deck/$deckId" : "/study/quiz/$quizId",
                        params: selected.kind === "deck" ? { deckId: selected.id } : { quizId: selected.id },
                      } as never)}
                      className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                    >
                      <ExternalLink className="h-4 w-4" /> Open in Study
                    </button>
                    <button onClick={() => moveTo(selected.kind as "deck" | "quiz", selected.id)}
                      className="glass inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm hover:bg-accent">
                      <ArrowRightLeft className="h-4 w-4" /> Move to another folder
                    </button>
                  </div>
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function NoteEditor({
  note, onSaved, onDeleted, onMove,
}: {
  note?: { id: string; title: string; content: string | null; pinned: boolean };
  onSaved: () => void; onDeleted: () => void; onMove: () => void;
}) {
  const [title, setTitle] = useState(note?.title ?? "");
  const [content, setContent] = useState(note?.content ?? "");
  const [saving, setSaving] = useState(false);
  if (!note) return <p className="text-sm text-muted-foreground">Note not found.</p>;

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("notes").update({ title: title || "Untitled note", content }).eq("id", note.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    onSaved();
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <input value={title} onChange={(e) => setTitle(e.target.value)}
        className="w-full rounded-xl border border-border bg-background/40 px-3 py-2 text-base font-semibold outline-none focus:border-primary" />
      <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={16} placeholder="Write your notes…"
        className="min-h-[16rem] flex-1 resize-none rounded-xl border border-border bg-background/40 px-3 py-2 text-sm outline-none focus:border-primary" />
      <div className="flex flex-wrap gap-2">
        <button onClick={save} disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
          Save
        </button>
        <button onClick={async () => { await supabase.from("notes").update({ pinned: !note.pinned }).eq("id", note.id); onSaved(); }}
          className="glass inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-accent">
          <Pin className="h-4 w-4" /> {note.pinned ? "Unpin" : "Pin"}
        </button>
        <button onClick={onMove} className="glass inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-accent">
          <ArrowRightLeft className="h-4 w-4" /> Move
        </button>
        <button
          onClick={async () => { if (!confirm("Delete note?")) return; await supabase.from("notes").delete().eq("id", note.id); onDeleted(); }}
          className="inline-flex items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive hover:bg-destructive/20">
          <Trash2 className="h-4 w-4" /> Delete
        </button>
      </div>
    </div>
  );
}

function FilePanel({
  file, onChanged, onDeleted, onMove,
}: {
  file?: { id: string; name: string; storage_path: string; mime_type: string | null; size: number | null };
  onChanged: () => void; onDeleted: () => void; onMove: () => void;
}) {
  if (!file) return <p className="text-sm text-muted-foreground">File not found.</p>;

  const download = async () => {
    const { data } = await supabase.storage.from("workspace").createSignedUrl(file.storage_path, 60);
    if (!data?.signedUrl) return toast.error("Could not create a download link");
    const a = document.createElement("a");
    a.href = data.signedUrl; a.download = file.name; a.click();
  };

  const rename = async () => {
    const name = prompt("Rename file", file.name);
    if (!name?.trim() || name === file.name) return;
    await supabase.from("workspace_files").update({ name: name.trim() }).eq("id", file.id);
    onChanged();
  };

  return (
    <div className="space-y-3">
      <div>
        <div className="truncate text-base font-semibold">{file.name}</div>
        <div className="text-xs text-muted-foreground">{file.mime_type ?? "file"} · {formatSize(file.size ?? 0)}</div>
      </div>
      <FilePreview path={file.storage_path} mime={file.mime_type} name={file.name} />

      <div className="grid gap-2">
        <button onClick={download} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
          <Download className="h-4 w-4" /> Download
        </button>
        <button onClick={rename} className="glass inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm hover:bg-accent">
          <Pencil className="h-4 w-4" /> Rename
        </button>
        <button onClick={onMove} className="glass inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm hover:bg-accent">
          <ArrowRightLeft className="h-4 w-4" /> Move
        </button>
        <button
          onClick={async () => {
            if (!confirm("Delete file?")) return;
            await supabase.storage.from("workspace").remove([file.storage_path]);
            await supabase.from("workspace_files").delete().eq("id", file.id);
            onDeleted();
          }}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-destructive/10 px-4 py-2 text-sm text-destructive hover:bg-destructive/20">
          <Trash2 className="h-4 w-4" /> Delete
        </button>
      </div>
    </div>
  );
}

function folderAncestors(f: FolderRow, all: FolderRow[]): FolderRow[] {
  const map = new Map(all.map((x) => [x.id, x]));
  const chain: FolderRow[] = [];
  let cur: FolderRow | undefined = f;
  const guard = new Set<string>();
  while (cur && !guard.has(cur.id)) {
    guard.add(cur.id);
    chain.unshift(cur);
    cur = cur.parent_id ? map.get(cur.parent_id) : undefined;
  }
  return chain;
}

function folderPath(f: FolderRow, all: FolderRow[]): string {
  return folderAncestors(f, all).map((x) => x.name).join(" / ");
}

function formatSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

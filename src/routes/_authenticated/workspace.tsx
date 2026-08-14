import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  FolderPlus, Folder, FolderOpen, Plus, Pin, Trash2, Search, Upload, File as FileIcon, Pencil,
  ChevronRight, ChevronDown, Home, ArrowRightLeft, Orbit, LayoutGrid,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { WorkspaceUniverse, type UniverseCounts } from "@/components/workspace-universe";

export const Route = createFileRoute("/_authenticated/workspace")({
  component: Workspace,
});

const COLORS = ["violet", "sky", "emerald", "amber", "rose", "cyan"];

interface FolderRow {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  icon: string | null;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

function Workspace() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"universe" | "list">("universe");

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

  const { data: folders = [] } = useQuery({
    queryKey: ["folders", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("folders")
        .select("*").eq("user_id", user.id).order("created_at");
      return (data ?? []) as FolderRow[];
    },
  });

  // Tree structure
  const childrenMap = useMemo(() => {
    const m = new Map<string | null, FolderRow[]>();
    for (const f of folders) {
      const k = f.parent_id ?? null;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(f);
    }
    return m;
  }, [folders]);

  const rootFolders = childrenMap.get(null) ?? [];

  useEffect(() => {
    if (!activeFolder && rootFolders[0]) setActiveFolder(rootFolders[0].id);
  }, [rootFolders, activeFolder]);

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

  const createFolder = async (parentId: string | null) => {
    const name = prompt(parentId ? "Subfolder name?" : "Folder name?");
    if (!name?.trim()) return;
    const color = COLORS[folders.length % COLORS.length];
    const { data, error } = await supabase.from("folders")
      .insert({ user_id: user.id, name, color, parent_id: parentId })
      .select().single();
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["folders", user.id] });
    if (parentId) setExpanded((s) => new Set([...s, parentId]));
    if (data) setActiveFolder(data.id);
  };

  const renameFolder = async (id: string, current: string) => {
    const name = prompt("Rename folder", current);
    if (!name?.trim() || name === current) return;
    await supabase.from("folders").update({ name }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["folders", user.id] });
  };

  const deleteFolder = async (id: string) => {
    if (!confirm("Delete folder and everything inside (including subfolders)?")) return;
    await supabase.from("folders").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["folders", user.id] });
    if (activeFolder === id) setActiveFolder(null);
  };

  const moveItem = async (kind: "note" | "file", id: string) => {
    const options = folders.map((f) => `${f.id}: ${folderPath(f, folders)}`).join("\n");
    const target = prompt(`Move to folder — paste ID:\n${options}`);
    if (!target?.trim()) return;
    const clean = target.split(":")[0].trim();
    const exists = folders.some((f) => f.id === clean);
    if (!exists) return toast.error("Folder not found");
    const table = kind === "note" ? "notes" : "workspace_files";
    await supabase.from(table).update({ folder_id: clean }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["notes", user.id, activeFolder] });
    qc.invalidateQueries({ queryKey: ["files", user.id, activeFolder] });
    toast.success("Moved");
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
  const breadcrumb = activeMeta ? folderAncestors(activeMeta, folders) : [];

  const toggleExpand = (id: string) => setExpanded((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const renderTree = (parentId: string | null, depth: number): React.ReactNode => {
    const items = childrenMap.get(parentId) ?? [];
    return items.map((f) => {
      const kids = childrenMap.get(f.id) ?? [];
      const isOpen = expanded.has(f.id);
      const isActive = activeFolder === f.id;
      return (
        <div key={f.id}>
          <div className={`group flex items-center rounded-lg transition ${isActive ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/50"}`}
            style={{ paddingLeft: depth * 12 }}>
            <button onClick={() => kids.length && toggleExpand(f.id)}
              className="h-6 w-6 grid place-items-center text-muted-foreground shrink-0">
              {kids.length ? (isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />) : <span className="h-3.5 w-3.5" />}
            </button>
            <button onClick={() => setActiveFolder(f.id)} className="flex-1 flex items-center gap-2 py-1.5 text-sm min-w-0">
              {isActive ? <FolderOpen className="h-4 w-4 text-primary shrink-0" /> : <Folder className="h-4 w-4 text-primary shrink-0" />}
              <span className="truncate">{f.name}</span>
            </button>
            <div className="flex opacity-0 group-hover:opacity-100 transition">
              <button onClick={() => createFolder(f.id)} className="p-1 hover:text-primary" aria-label="Add subfolder" title="Add subfolder"><Plus className="h-3 w-3" /></button>
              <button onClick={() => renameFolder(f.id, f.name)} className="p-1 hover:text-primary" aria-label="Rename"><Pencil className="h-3 w-3" /></button>
              <button onClick={() => deleteFolder(f.id)} className="p-1 hover:text-destructive" aria-label="Delete"><Trash2 className="h-3 w-3" /></button>
            </div>
          </div>
          {isOpen && kids.length > 0 && renderTree(f.id, depth + 1)}
        </div>
      );
    });
  };

  return (
    <div className="flex h-[calc(100vh-56px)] lg:h-screen">
      <aside className="hidden md:flex w-72 flex-col border-r border-border/60 bg-sidebar p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold">Workspace</h2>
          <button onClick={() => createFolder(null)} className="p-1.5 rounded-lg hover:bg-accent" aria-label="New folder">
            <FolderPlus className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-0.5 flex-1 overflow-y-auto">
          {renderTree(null, 0)}
          {folders.length === 0 && (
            <button onClick={() => createFolder(null)} className="w-full text-left glass rounded-xl p-3 text-sm text-muted-foreground hover:text-foreground">
              <FolderPlus className="h-4 w-4 inline mr-2" />Create your first folder
            </button>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-border/60 px-6 py-4 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 text-xs text-muted-foreground truncate">
              <Home className="h-3 w-3" />
              {breadcrumb.map((b, i) => (
                <span key={b.id} className="inline-flex items-center gap-1">
                  <ChevronRight className="h-3 w-3" />
                  <button onClick={() => setActiveFolder(b.id)}
                    className={i === breadcrumb.length - 1 ? "text-foreground font-medium" : "hover:text-foreground"}>
                    {b.name}
                  </button>
                </span>
              ))}
            </div>
            <h1 className="font-bold text-lg truncate mt-0.5">{activeMeta?.name ?? "Workspace"}</h1>
          </div>
          {activeFolder && (
            <button onClick={() => createFolder(activeFolder)}
              className="hidden sm:inline-flex items-center gap-1.5 text-xs rounded-full glass px-3 py-1.5 hover:bg-accent">
              <FolderPlus className="h-3.5 w-3.5" />New subfolder
            </button>
          )}
          <div className="glass inline-flex gap-1 rounded-full border border-border/60 p-1">
            <button onClick={() => setView("universe")}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition ${view === "universe" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              <Orbit className="h-3.5 w-3.5" /> Universe
            </button>
            <button onClick={() => setView("list")}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition ${view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              <LayoutGrid className="h-3.5 w-3.5" /> Content
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="pl-9 pr-3 py-2 rounded-xl border border-border bg-background/40 text-sm outline-none w-40 sm:w-64 focus:border-primary" />
          </div>
        </header>

        {view === "universe" ? (
          <div className="flex-1 min-h-0 p-4">
            <WorkspaceUniverse
              folders={folders}
              activeFolder={activeFolder}
              counts={counts}
              onSelect={setActiveFolder}
              onCreateFolder={createFolder}
            />
          </div>
        ) : (
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {!activeFolder ? (
            <div className="text-center text-muted-foreground py-16">Select or create a folder to get started.</div>
          ) : (
            <>
              {/* Subfolders */}
              {(childrenMap.get(activeFolder)?.length ?? 0) > 0 && (
                <section>
                  <h2 className="font-semibold text-sm mb-3">Subfolders</h2>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {(childrenMap.get(activeFolder) ?? []).map((f) => (
                      <button key={f.id} onClick={() => setActiveFolder(f.id)}
                        className="glass rounded-2xl p-4 flex items-center gap-3 hover:shadow-[var(--shadow-glow)] hover:-translate-y-0.5 transition text-left">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center text-primary shrink-0">
                          <Folder className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">{f.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {(childrenMap.get(f.id)?.length ?? 0)} subfolder{(childrenMap.get(f.id)?.length ?? 0) === 1 ? "" : "s"}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              )}

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
                            <button onClick={() => moveItem("note", n.id)} className="p-1 text-muted-foreground hover:text-primary" aria-label="Move"><ArrowRightLeft className="h-3.5 w-3.5" /></button>
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
                      <div className="flex opacity-0 group-hover:opacity-100 transition">
                        <button onClick={() => moveItem("file", f.id)} className="p-1.5 text-muted-foreground hover:text-primary" aria-label="Move"><ArrowRightLeft className="h-4 w-4" /></button>
                        <button onClick={() => deleteFile(f.id, f.storage_path)} className="p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                      </div>
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

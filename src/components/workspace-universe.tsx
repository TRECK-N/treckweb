import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Folder, FolderPlus, StickyNote, File as FileIcon, Maximize2, Minus, Plus,
  Image as ImageIcon, FileText, Music, Video, Archive, Layers, ListChecks,
} from "lucide-react";

export interface UniverseFolder {
  id: string;
  name: string;
  parent_id: string | null;
  color?: string | null;
}

export interface UniverseCounts {
  notes: number;
  files: number;
}

export interface UniverseItem {
  id: string;
  name: string;
  kind: "note" | "file" | "deck" | "quiz";
  mime?: string | null;
}

interface Props {
  folders: UniverseFolder[];
  /** ids from root down to the currently opened folder; empty = universe overview */
  openPath: string[];
  counts: Map<string, UniverseCounts>;
  items: UniverseItem[];
  onOpenFolder: (id: string) => void;
  onCollapse: () => void;
  onCreateFolder: (parentId: string | null) => void;
  onSelectItem: (item: UniverseItem) => void;
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2.5;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

function hash(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function itemIcon(item: UniverseItem) {
  if (item.kind === "note") return StickyNote;
  if (item.kind === "deck") return Layers;
  if (item.kind === "quiz") return ListChecks;
  const m = item.mime ?? "";
  if (m.startsWith("image/")) return ImageIcon;
  if (m.startsWith("audio/")) return Music;
  if (m.startsWith("video/")) return Video;
  if (m.includes("pdf") || m.includes("text") || m.includes("word")) return FileText;
  if (m.includes("zip") || m.includes("rar")) return Archive;
  return FileIcon;
}

export function WorkspaceUniverse({
  folders, openPath, counts, items, onOpenFolder, onCollapse, onCreateFolder, onSelectItem,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number; moved: boolean } | null>(null);

  const childrenMap = useMemo(() => {
    const m = new Map<string | null, UniverseFolder[]>();
    for (const f of folders) {
      const k = f.parent_id ?? null;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(f);
    }
    return m;
  }, [folders]);

  const currentId = openPath.length ? openPath[openPath.length - 1] : null;
  const current = currentId ? folders.find((f) => f.id === currentId) ?? null : null;
  const ring = childrenMap.get(currentId) ?? [];

  const recenter = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    setZoom(1);
    setOffset({ x: el.clientWidth / 2, y: el.clientHeight / 2 });
  }, []);

  useEffect(() => { recenter(); }, [recenter]);

  const stateRef = useRef({ zoom, offset });
  stateRef.current = { zoom, offset };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { zoom: z, offset: o } = stateRef.current;
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * Math.exp(-dy * 0.0018)));
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const k = next / z;
      setOffset({ x: px - (px - o.x) * k, y: py - (py - o.y) * k });
      setZoom(next);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const zoomBy = (factor: number) => {
    const el = containerRef.current;
    if (!el) return;
    const { zoom: z, offset: o } = stateRef.current;
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * factor));
    const px = el.clientWidth / 2;
    const py = el.clientHeight / 2;
    const k = next / z;
    setOffset({ x: px - (px - o.x) * k, y: py - (py - o.y) * k });
    setZoom(next);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-node]")) return;
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    drag.current.moved = true;
    setOffset({ x: drag.current.ox + (e.clientX - drag.current.x), y: drag.current.oy + (e.clientY - drag.current.y) });
  };
  const endDrag = () => { drag.current = null; };

  /* ---------- node layout ---------- */
  const overview = !current;

  // Overview: scatter main folders across a wide galaxy using a deterministic spiral.
  const scattered = useMemo(() => {
    const roots = childrenMap.get(null) ?? [];
    return roots.map((f, i) => {
      const r = 240 + Math.sqrt(i + 1) * 210;
      const a = i * GOLDEN + (hash(f.id) % 100) / 100;
      return { folder: f, x: Math.cos(a) * r, y: Math.sin(a) * r * 0.72 };
    });
  }, [childrenMap]);

  const folderRadius = Math.max(230, Math.min(430, 170 + ring.length * 34));
  const orbitFolders = ring.map((f, i) => {
    const a = (i / Math.max(ring.length, 1)) * Math.PI * 2 - Math.PI / 2;
    return { folder: f, x: Math.cos(a) * folderRadius, y: Math.sin(a) * folderRadius * 0.8 };
  });

  const itemRadius = folderRadius + 200;
  const orbitItems = items.map((it, i) => {
    const a = (i / Math.max(items.length, 1)) * Math.PI * 2 - Math.PI / 2 + 0.28;
    return { item: it, x: Math.cos(a) * itemRadius, y: Math.sin(a) * itemRadius * 0.8 };
  });

  const c = current ? counts.get(current.id) : undefined;

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
      className="relative h-full w-full cursor-grab touch-none overflow-hidden bg-[radial-gradient(circle_at_50%_45%,color-mix(in_oklab,var(--color-primary)_16%,transparent),transparent_65%)] active:cursor-grabbing"
    >
      {/* starfield */}
      <div className="pointer-events-none absolute inset-0 opacity-70">
        {STARS.map((s, i) => (
          <motion.span
            key={i}
            className="absolute rounded-full bg-foreground/40"
            style={{ left: `${s.x}%`, top: `${s.y}%`, height: s.r, width: s.r }}
            animate={{ opacity: [0.1, 0.75, 0.1] }}
            transition={{ duration: 3 + (i % 6), repeat: Infinity, delay: i * 0.11 }}
          />
        ))}
      </div>

      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}
      >
        {overview ? (
          <>
            <motion.div data-node layout className="absolute -translate-x-1/2 -translate-y-1/2">
              <div className="grid h-40 w-40 place-items-center rounded-full border border-primary/30 bg-primary/5 text-center backdrop-blur-md">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Your</div>
                  <div className="text-lg font-semibold">Universe</div>
                  <div className="mt-1 text-[10px] text-muted-foreground">{scattered.length} main folders</div>
                </div>
              </div>
            </motion.div>

            {scattered.map(({ folder, x, y }) => (
              <PlanetNode
                key={folder.id}
                name={folder.name}
                counts={counts.get(folder.id)}
                subfolders={(childrenMap.get(folder.id) ?? []).length}
                x={x} y={y} size={128}
                onOpen={() => onOpenFolder(folder.id)}
              />
            ))}

            <AddNode x={0} y={300} label="New main folder" onClick={() => onCreateFolder(null)} />
          </>
        ) : (
          <>
            {/* expanded folder — single click collapses */}
            <motion.button
              data-node
              layout
              onClick={onCollapse}
              whileHover={{ scale: 1.03 }}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
            >
              <div className="grid h-44 w-44 place-items-center rounded-full border border-primary/50 bg-primary/10 text-center shadow-[var(--shadow-glow)] backdrop-blur-md">
                <div className="px-4">
                  <Folder className="mx-auto h-7 w-7 text-primary" />
                  <div className="mt-1 line-clamp-2 text-sm font-semibold">{current.name}</div>
                  <div className="mt-1 flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
                    <span className="inline-flex items-center gap-0.5"><StickyNote className="h-3 w-3" />{c?.notes ?? 0}</span>
                    <span className="inline-flex items-center gap-0.5"><FileIcon className="h-3 w-3" />{c?.files ?? 0}</span>
                  </div>
                  <div className="mt-1 text-[9px] uppercase tracking-widest text-primary/80">click to close</div>
                </div>
              </div>
            </motion.button>

            {orbitFolders.map(({ folder, x, y }) => (
              <PlanetNode
                key={folder.id}
                name={folder.name}
                counts={counts.get(folder.id)}
                subfolders={(childrenMap.get(folder.id) ?? []).length}
                x={x} y={y} size={112}
                onOpen={() => onOpenFolder(folder.id)}
              />
            ))}

            {orbitItems.map(({ item, x, y }) => {
              const Icon = itemIcon(item);
              return (
                <motion.button
                  data-node
                  key={`${item.kind}-${item.id}`}
                  onClick={() => onSelectItem(item)}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.08 }}
                  className="glass absolute w-28 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border/60 p-2.5 text-center transition hover:border-primary/60"
                  style={{ left: x, top: y }}
                >
                  <Icon className="mx-auto h-4 w-4 text-primary" />
                  <div className="mt-1 truncate text-[11px] font-medium">{item.name}</div>
                  <div className="text-[9px] capitalize text-muted-foreground">{item.kind}</div>
                </motion.button>
              );
            })}

            <AddNode x={0} y={folderRadius + 320} label="New subfolder" onClick={() => onCreateFolder(current.id)} />
          </>
        )}
      </div>

      {/* controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1.5">
        <button onClick={() => zoomBy(1.2)} className="glass grid h-8 w-8 place-items-center rounded-lg border border-border/60 hover:text-primary" aria-label="Zoom in"><Plus className="h-4 w-4" /></button>
        <button onClick={() => zoomBy(1 / 1.2)} className="glass grid h-8 w-8 place-items-center rounded-lg border border-border/60 hover:text-primary" aria-label="Zoom out"><Minus className="h-4 w-4" /></button>
        <button onClick={recenter} className="glass grid h-8 w-8 place-items-center rounded-lg border border-border/60 hover:text-primary" aria-label="Recenter"><Maximize2 className="h-4 w-4" /></button>
      </div>

      <div className="pointer-events-none absolute left-4 bottom-4 text-[11px] text-muted-foreground">
        Drag to pan · scroll to zoom · double-click a folder to open · click the open folder to close
      </div>
    </div>
  );
}

function PlanetNode({
  name, counts, subfolders, x, y, size, onOpen,
}: {
  name: string; counts?: UniverseCounts; subfolders: number;
  x: number; y: number; size: number; onOpen: () => void;
}) {
  return (
    <motion.button
      data-node
      onDoubleClick={onOpen}
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.06 }}
      className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-border/60 bg-background/50 text-center backdrop-blur-md transition hover:border-primary/70 hover:shadow-[var(--shadow-glow)]"
      style={{ left: x, top: y, height: size, width: size }}
    >
      <span className="grid h-full w-full place-items-center px-3">
        <span>
          <Folder className="mx-auto h-5 w-5 text-primary" />
          <span className="mt-1 block line-clamp-2 text-xs font-medium">{name}</span>
          <span className="mt-0.5 block text-[10px] text-muted-foreground">
            {subfolders > 0 ? `${subfolders} inside · ` : ""}{(counts?.notes ?? 0) + (counts?.files ?? 0)} items
          </span>
        </span>
      </span>
    </motion.button>
  );
}

function AddNode({ x, y, label, onClick }: { x: number; y: number; label: string; onClick: () => void }) {
  return (
    <motion.button
      data-node
      onClick={onClick}
      whileHover={{ scale: 1.08 }}
      className="absolute -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-dashed border-primary/50 px-4 py-3 text-[11px] font-medium text-primary"
      style={{ left: x, top: y }}
    >
      <FolderPlus className="mx-auto h-4 w-4" />
      {label}
    </motion.button>
  );
}

const STARS = Array.from({ length: 70 }, (_, i) => ({
  x: (i * 37.5) % 100,
  y: (i * 61.7) % 100,
  r: 1 + (i % 3),
}));

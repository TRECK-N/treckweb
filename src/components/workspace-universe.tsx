import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Folder, FolderPlus, ArrowUp, StickyNote, File as FileIcon, Maximize2, Minus, Plus } from "lucide-react";

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

interface Props {
  folders: UniverseFolder[];
  activeFolder: string | null;
  counts: Map<string, UniverseCounts>;
  onSelect: (id: string | null) => void;
  onCreateFolder: (parentId: string | null) => void;
}

const MIN_ZOOM = 0.35;
const MAX_ZOOM = 2.5;

export function WorkspaceUniverse({ folders, activeFolder, counts, onSelect, onCreateFolder }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const childrenMap = useMemo(() => {
    const m = new Map<string | null, UniverseFolder[]>();
    for (const f of folders) {
      const k = f.parent_id ?? null;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(f);
    }
    return m;
  }, [folders]);

  const center = activeFolder ? folders.find((f) => f.id === activeFolder) ?? null : null;
  const ring = childrenMap.get(center?.id ?? null) ?? [];
  const parent = center?.parent_id ? folders.find((f) => f.id === center.parent_id) ?? null : null;

  const recenter = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    setZoom(1);
    setOffset({ x: el.clientWidth / 2, y: el.clientHeight / 2 });
  }, []);

  useEffect(() => { recenter(); }, [recenter]);

  /* wheel zoom anchored at the cursor */
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
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    setOffset({ x: drag.current.ox + (e.clientX - drag.current.x), y: drag.current.oy + (e.clientY - drag.current.y) });
  };
  const endDrag = () => { drag.current = null; };

  const radius = Math.max(190, Math.min(340, 120 + ring.length * 26));
  const positions = ring.map((f, i) => {
    const angle = (i / Math.max(ring.length, 1)) * Math.PI * 2 - Math.PI / 2;
    return { folder: f, x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  });

  const centerCounts = center ? counts.get(center.id) : undefined;

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
      className="relative h-full w-full cursor-grab touch-none overflow-hidden rounded-3xl border border-border/50 bg-[radial-gradient(circle_at_50%_40%,color-mix(in_oklab,var(--color-primary)_14%,transparent),transparent_62%)] active:cursor-grabbing"
    >
      {/* starfield */}
      <div className="pointer-events-none absolute inset-0 opacity-60">
        {STARS.map((s, i) => (
          <motion.span
            key={i}
            className="absolute rounded-full bg-foreground/40"
            style={{ left: `${s.x}%`, top: `${s.y}%`, height: s.r, width: s.r }}
            animate={{ opacity: [0.15, 0.7, 0.15] }}
            transition={{ duration: 3 + (i % 5), repeat: Infinity, delay: i * 0.13 }}
          />
        ))}
      </div>

      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}
      >
        {/* orbit ring */}
        {positions.length > 0 && (
          <svg className="pointer-events-none absolute overflow-visible" style={{ left: 0, top: 0 }}>
            <circle cx={0} cy={0} r={radius} fill="none" stroke="currentColor" className="text-border" strokeDasharray="4 8" opacity={0.5} />
            {positions.map((p) => (
              <line key={p.folder.id} x1={0} y1={0} x2={p.x} y2={p.y} stroke="currentColor" className="text-border" opacity={0.45} />
            ))}
          </svg>
        )}

        {/* center node */}
        <motion.div
          data-node
          layout
          className="absolute -translate-x-1/2 -translate-y-1/2"
        >
          <div className="glass grid h-36 w-36 place-items-center rounded-full border border-primary/40 text-center shadow-[var(--shadow-glow)]">
            <div className="px-3">
              <Folder className="mx-auto h-6 w-6 text-primary" />
              <div className="mt-1 line-clamp-2 text-sm font-semibold">{center?.name ?? "Universe"}</div>
              {center && (
                <div className="mt-1 flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
                  <span className="inline-flex items-center gap-0.5"><StickyNote className="h-3 w-3" />{centerCounts?.notes ?? 0}</span>
                  <span className="inline-flex items-center gap-0.5"><FileIcon className="h-3 w-3" />{centerCounts?.files ?? 0}</span>
                </div>
              )}
            </div>
          </div>
          {center && (
            <button
              data-node
              onClick={() => onSelect(parent?.id ?? null)}
              className="glass absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-border/60 px-2 py-1 text-[10px] font-medium hover:text-primary"
            >
              <ArrowUp className="mr-0.5 inline h-3 w-3" />{parent?.name ?? "Root"}
            </button>
          )}
        </motion.div>

        {/* orbiting children */}
        {positions.map(({ folder, x, y }) => {
          const c = counts.get(folder.id);
          const kids = (childrenMap.get(folder.id) ?? []).length;
          return (
            <motion.button
              data-node
              key={folder.id}
              onClick={() => onSelect(folder.id)}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.07 }}
              className="glass absolute w-32 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border/60 p-3 text-center transition hover:border-primary/60"
              style={{ left: x, top: y }}
            >
              <Folder className="mx-auto h-5 w-5 text-primary" />
              <div className="mt-1 truncate text-xs font-medium">{folder.name}</div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">
                {kids > 0 ? `${kids} inside · ` : ""}{(c?.notes ?? 0) + (c?.files ?? 0)} items
              </div>
            </motion.button>
          );
        })}

        {/* add node */}
        <motion.button
          data-node
          onClick={() => onCreateFolder(center?.id ?? null)}
          whileHover={{ scale: 1.08 }}
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-dashed border-primary/50 px-3 py-3 text-[11px] font-medium text-primary"
          style={{ left: 0, top: radius + 110 }}
        >
          <FolderPlus className="mx-auto h-4 w-4" />
          New folder
        </motion.button>
      </div>

      {/* controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1.5">
        <button onClick={() => zoomBy(1.2)} className="glass grid h-8 w-8 place-items-center rounded-lg border border-border/60 hover:text-primary" aria-label="Zoom in"><Plus className="h-4 w-4" /></button>
        <button onClick={() => zoomBy(1 / 1.2)} className="glass grid h-8 w-8 place-items-center rounded-lg border border-border/60 hover:text-primary" aria-label="Zoom out"><Minus className="h-4 w-4" /></button>
        <button onClick={recenter} className="glass grid h-8 w-8 place-items-center rounded-lg border border-border/60 hover:text-primary" aria-label="Recenter"><Maximize2 className="h-4 w-4" /></button>
      </div>

      <div className="pointer-events-none absolute left-4 top-4 text-[11px] text-muted-foreground">
        Drag to pan · scroll to zoom · click a folder to travel inside
      </div>
    </div>
  );
}

const STARS = Array.from({ length: 45 }, (_, i) => ({
  x: (i * 37.5) % 100,
  y: (i * 61.7) % 100,
  r: 1 + (i % 3),
}));

"use client";

import { hierarchy, tree as d3tree } from "d3-hierarchy";
import { ArrowRight, ChevronDown, ChevronUp, Maximize, Minus, Plus, Users } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import * as React from "react";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader } from "@/components/ui/overlay";
import { DescriptionList } from "@/components/ui/primitives";
import { Tooltip } from "@/components/ui/tooltip";
import { displayName } from "@/features/people/format";
import type { OrgNodeRow } from "@/features/people/queries";
import { gentle } from "@/lib/motion";
import { cn } from "@/lib/utils";

import {
  ancestors,
  buildTree,
  defaultCollapsed,
  descendantCount,
  neighbor,
  revealIn,
  visibleTree,
  type VisibleNode,
} from "../tree";
import { swatchClass } from "./department-sheet";

const W = 228;
const H = 76;
const GAP_X = 24;
const GAP_Y = 64;
const MIN_K = 0.3;
const MAX_K = 1.6;

type Row = OrgNodeRow & { name: string };
type View = { x: number; y: number; k: number };
type Placed = { id: string; x: number; y: number; parent: string | null };

const clampK = (k: number) => Math.min(MAX_K, Math.max(MIN_K, k));

export function OrgChart({ rows, focusId }: { rows: OrgNodeRow[]; focusId: string | null }) {
  const reduce = useReducedMotion();
  const data = React.useMemo(() => rows.map((r) => ({ ...r, name: displayName(r) })), [rows]);
  const tree = React.useMemo(() => buildTree<Row>(data), [data]);

  const [collapsed, setCollapsed] = React.useState<Set<string>>(() => {
    const base = defaultCollapsed(tree, 1);
    return focusId && tree.byId.has(focusId) ? revealIn(tree, base, focusId) : base;
  });
  const [active, setActive] = React.useState<string | null>(focusId ?? tree.roots[0] ?? null);
  // Arriving from a profile's "Org chart" button opens that person's card.
  const [preview, setPreview] = React.useState<string | null>(
    focusId && tree.byId.has(focusId) ? focusId : null,
  );
  const [view, setView] = React.useState<View>({ x: 0, y: 40, k: 1 });
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const nodeRefs = React.useRef(new Map<string, HTMLButtonElement>());
  const placedRef = React.useRef<Map<string, Placed>>(new Map());

  // Lay out the visible tree. d3 gives centers; we keep top-left positions.
  const placed = React.useMemo(() => {
    const root = hierarchy<VisibleNode>(visibleTree(tree, collapsed), (n) => n.children);
    d3tree<VisibleNode>().nodeSize([W + GAP_X, H + GAP_Y])(root);
    const out = new Map<string, Placed>();
    root.each((n) => {
      if (n.data.id === "__root") return;
      const parent = n.parent && n.parent.data.id !== "__root" ? n.parent.data.id : null;
      out.set(n.data.id, {
        id: n.data.id,
        x: (n.x ?? 0) - W / 2,
        y: (n.y ?? 0) - (H + GAP_Y),
        parent,
      });
    });
    return out;
  }, [tree, collapsed]);

  React.useEffect(() => {
    placedRef.current = placed;
  }, [placed]);

  const bounds = React.useMemo(() => {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const p of placed.values()) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + W);
      maxY = Math.max(maxY, p.y + H);
    }
    return { minX, minY, maxX, maxY };
  }, [placed]);

  /** Center a node in the viewport, keeping the zoom unless asked. */
  const centerOn = React.useCallback((id: string, k?: number) => {
    const el = viewportRef.current;
    const p = placedRef.current.get(id);
    if (!el || !p) return;
    setView((v) => {
      const kk = k ?? v.k;
      return {
        k: kk,
        x: el.clientWidth / 2 - (p.x + W / 2) * kk,
        y: el.clientHeight / 3 - (p.y + H / 2) * kk,
      };
    });
  }, []);

  const fit = React.useCallback(() => {
    const el = viewportRef.current;
    if (!el || !Number.isFinite(bounds.minX)) return;
    const pad = 40;
    // Leave room for the floating search and zoom controls.
    const top = 96;
    const w = bounds.maxX - bounds.minX;
    const h = bounds.maxY - bounds.minY;
    const k = clampK(
      Math.min((el.clientWidth - pad * 2) / w, (el.clientHeight - top - pad) / h, 1),
    );
    setView({
      k,
      x: (el.clientWidth - w * k) / 2 - bounds.minX * k,
      y: top - bounds.minY * k,
    });
  }, [bounds]);

  // First paint: focus the requested person, or fit the opening view.
  const didInit = React.useRef(false);
  React.useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    if (focusId && placed.has(focusId)) centerOn(focusId, 1);
    else fit();
  }, [focusId, placed, centerOn, fit]);

  // Wheel zooms around the pointer; it needs a non-passive listener.
  React.useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const rect = el!.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      setView((v) => {
        const k = clampK(v.k * Math.exp(-e.deltaY * 0.0015));
        return { k, x: px - ((px - v.x) / v.k) * k, y: py - ((py - v.y) / v.k) * k };
      });
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Drag the background to pan.
  const drag = React.useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  function onPointerDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest("button,a")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    setView((v) => ({ ...v, x: d.vx + e.clientX - d.x, y: d.vy + e.clientY - d.y }));
  }
  const endDrag = () => (drag.current = null);

  function zoomBy(factor: number) {
    const el = viewportRef.current;
    if (!el) return;
    const cx = el.clientWidth / 2;
    const cy = el.clientHeight / 2;
    setView((v) => {
      const k = clampK(v.k * factor);
      return { k, x: cx - ((cx - v.x) / v.k) * k, y: cy - ((cy - v.y) / v.k) * k };
    });
  }

  function toggle(id: string) {
    const opening = collapsed.has(id);
    setCollapsed((c) => {
      const next = new Set(c);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    // Opening a team can push it off-screen; bring it into view once laid out.
    if (opening) requestAnimationFrame(() => requestAnimationFrame(() => centerOn(id)));
  }

  function focusPerson(id: string) {
    setCollapsed((c) => revealIn(tree, c, id));
    setActive(id);
    // Wait for the new layout before centering.
    requestAnimationFrame(() => requestAnimationFrame(() => centerOn(id)));
  }

  /** Keep the keyboard-focused node on screen. */
  function ensureVisible(id: string) {
    const el = viewportRef.current;
    const p = placedRef.current.get(id);
    if (!el || !p) return;
    const sx = p.x * view.k + view.x;
    const sy = p.y * view.k + view.y;
    const margin = 40;
    if (
      sx < margin ||
      sy < margin ||
      sx + W * view.k > el.clientWidth - margin ||
      sy + H * view.k > el.clientHeight - margin
    ) {
      centerOn(id);
    }
  }

  function onNodeKey(e: React.KeyboardEvent, id: string) {
    const map: Record<string, "up" | "down" | "left" | "right"> = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
    };
    const dir = map[e.key];
    if (dir) {
      e.preventDefault();
      let next = neighbor(tree, collapsed, id, dir);
      if (dir === "down" && !next && collapsed.has(id) && tree.children.get(id)?.length) {
        toggle(id);
        next = tree.children.get(id)![0]!;
      }
      if (next) {
        setActive(next);
        requestAnimationFrame(() => {
          nodeRefs.current.get(next!)?.focus({ preventScroll: true });
          ensureVisible(next!);
        });
      }
    } else if (e.key === "+" || e.key === "-" || e.key === " ") {
      if (tree.children.get(id)?.length) {
        e.preventDefault();
        toggle(id);
      }
    }
  }

  const searchOptions = React.useMemo(
    () =>
      data.map((p) => ({
        value: p.id,
        label: p.name,
        hint: `${p.designation.title} · ${p.department.name}`,
        keywords: [p.designation.title, p.department.name, p.employeeCode],
        leading: <Avatar name={p.name} src={p.avatarUrl} size="xs" />,
      })),
    [data],
  );

  const previewRow = preview ? tree.byId.get(preview) : null;
  const previewManager = previewRow?.managerId ? tree.byId.get(previewRow.managerId) : null;
  const transition = reduce ? { duration: 0 } : gentle;
  const width = Number.isFinite(bounds.maxX) ? bounds.maxX - bounds.minX + W : 0;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* Controls */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="pointer-events-auto w-full max-w-xs rounded-control bg-surface shadow-md">
          <Combobox
            value={null}
            onChange={(id) => id && focusPerson(id)}
            options={searchOptions}
            placeholder="Find someone in the chart"
            aria-label="Find someone in the chart"
            searchPlaceholder="Name, role, team or ID"
          />
        </div>
        <div
          role="toolbar"
          aria-label="Chart controls"
          className="pointer-events-auto flex items-center gap-0.5 rounded-control border border-hairline bg-surface p-0.5 shadow-md"
        >
          <Tooltip content="Zoom out">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Zoom out"
              onClick={() => zoomBy(1 / 1.25)}
            >
              <Minus />
            </Button>
          </Tooltip>
          <span className="w-12 text-center num text-caption text-ink-muted" aria-live="polite">
            {Math.round(view.k * 100)}%
          </span>
          <Tooltip content="Zoom in">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Zoom in"
              onClick={() => zoomBy(1.25)}
            >
              <Plus />
            </Button>
          </Tooltip>
          <span className="mx-0.5 h-5 w-px bg-hairline" aria-hidden />
          <Tooltip content="Fit everyone on screen">
            <Button variant="ghost" size="icon-sm" aria-label="Fit to screen" onClick={fit}>
              <Maximize />
            </Button>
          </Tooltip>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setCollapsed(new Set());
              requestAnimationFrame(() => requestAnimationFrame(fit));
            }}
          >
            Expand all
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setCollapsed(defaultCollapsed(tree, 1));
              requestAnimationFrame(() => requestAnimationFrame(fit));
            }}
          >
            Collapse
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={viewportRef}
        className="relative min-h-0 flex-1 cursor-grab touch-none overflow-hidden bg-bg [background-image:radial-gradient(var(--hairline)_1px,transparent_1px)] [background-size:24px_24px] active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div
          className="absolute top-0 left-0 origin-top-left"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}
        >
          <svg
            aria-hidden
            className="absolute overflow-visible"
            style={{ left: 0, top: 0, width: Math.max(width, 1), height: 1 }}
          >
            <AnimatePresence initial={false}>
              {[...placed.values()]
                .filter((p) => p.parent)
                .map((p) => {
                  const parent = placed.get(p.parent!)!;
                  const x1 = parent.x + W / 2;
                  const y1 = parent.y + H;
                  const x2 = p.x + W / 2;
                  const y2 = p.y;
                  const my = (y1 + y2) / 2;
                  const d = `M ${x1} ${y1} C ${x1} ${my} ${x2} ${my} ${x2} ${y2}`;
                  return (
                    <motion.path
                      key={p.id}
                      initial={{ opacity: 0, d }}
                      animate={{ opacity: 1, d }}
                      exit={{ opacity: 0, transition: { duration: 0.12 } }}
                      transition={transition}
                      fill="none"
                      className="stroke-border-strong"
                      strokeWidth={1.5}
                    />
                  );
                })}
            </AnimatePresence>
          </svg>

          <div role="tree" aria-label="Org chart of Northwind Grove">
            <AnimatePresence initial={false}>
              {[...placed.values()].map((p) => {
                const row = tree.byId.get(p.id)!;
                const kids = tree.children.get(p.id)?.length ?? 0;
                const isCollapsed = collapsed.has(p.id);
                const level = ancestors(tree, p.id).length + 1;
                const team = descendantCount(tree, p.id);
                const isActive = active === p.id;
                const highlighted = preview === p.id;
                return (
                  <motion.div
                    key={p.id}
                    className="absolute"
                    style={{ width: W, height: H }}
                    initial={{ opacity: 0, x: p.x, y: p.y, scale: 0.94 }}
                    animate={{ opacity: 1, x: p.x, y: p.y, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.12 } }}
                    transition={transition}
                  >
                    <button
                      ref={(el) => {
                        if (el) nodeRefs.current.set(p.id, el);
                        else nodeRefs.current.delete(p.id);
                      }}
                      type="button"
                      role="treeitem"
                      aria-level={level}
                      aria-expanded={kids ? !isCollapsed : undefined}
                      aria-selected={isActive}
                      aria-label={`${row.name}, ${row.designation.title}, ${row.department.name}${kids ? `, ${team} in team` : ""}`}
                      tabIndex={isActive ? 0 : -1}
                      onFocus={() => setActive(p.id)}
                      onClick={() => {
                        setActive(p.id);
                        setPreview(p.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          setPreview(p.id);
                        } else onNodeKey(e, p.id);
                      }}
                      className={cn(
                        "group relative flex h-full w-full items-center gap-3 overflow-hidden rounded-card border bg-surface pr-3 pl-4 text-left shadow-xs",
                        "transition-[border-color,box-shadow] duration-150 hover:border-border-strong hover:shadow-sm",
                        highlighted ? "border-accent shadow-sm" : "border-hairline",
                        focusId === p.id && "ring-2 ring-highlight ring-offset-2 ring-offset-bg",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "absolute inset-y-0 left-0 w-1",
                          swatchClass(row.department.colorToken),
                        )}
                      />
                      <Avatar name={row.name} src={row.avatarUrl} size="md" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body font-semibold text-ink">
                          {row.name}
                        </span>
                        <span className="block truncate text-small text-ink-muted">
                          {row.designation.title}
                        </span>
                        <span className="block truncate text-caption text-ink-subtle">
                          {row.department.name}
                        </span>
                      </span>
                    </button>
                    {kids > 0 && (
                      <button
                        type="button"
                        tabIndex={-1}
                        aria-hidden
                        onClick={() => toggle(p.id)}
                        className={cn(
                          "absolute -bottom-3 left-1/2 flex h-6 -translate-x-1/2 items-center gap-1 rounded-full border border-hairline bg-surface px-2 text-caption font-medium shadow-xs",
                          "text-ink-muted transition-colors hover:border-accent/50 hover:text-accent",
                        )}
                      >
                        <span className="num">{isCollapsed ? team : kids}</span>
                        {isCollapsed ? (
                          <ChevronDown className="size-3" />
                        ) : (
                          <ChevronUp className="size-3" />
                        )}
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        <p className="pointer-events-none absolute bottom-3 left-4 hidden text-caption text-ink-subtle sm:block">
          Drag to move · scroll to zoom · arrow keys to walk the tree · Enter for details
        </p>
      </div>

      <Sheet open={!!previewRow} onOpenChange={(o) => !o && setPreview(null)}>
        <SheetContent>
          {previewRow && (
            <>
              <SheetHeader title={previewRow.name} description={previewRow.designation.title} />
              <SheetBody className="flex flex-col gap-6">
                <div className="flex items-center gap-4">
                  <Avatar name={previewRow.name} src={previewRow.avatarUrl} size="lg" />
                  <div className="flex flex-col gap-1.5">
                    <Badge tone="accent">{previewRow.department.name}</Badge>
                    <span className="font-mono num text-small text-ink-muted">
                      {previewRow.employeeCode}
                    </span>
                  </div>
                </div>
                <DescriptionList
                  columns={1}
                  items={[
                    {
                      term: "Reports to",
                      detail: previewManager
                        ? previewManager.name
                        : "No one. They lead the company.",
                    },
                    {
                      term: "Team",
                      detail:
                        (tree.children.get(previewRow.id)?.length ?? 0)
                          ? `${tree.children.get(previewRow.id)!.length} direct, ${descendantCount(tree, previewRow.id)} in total`
                          : "No reports",
                    },
                    {
                      term: "Works",
                      detail: previewRow.location.isRemote
                        ? "Remotely, in India"
                        : "From the Bengaluru office",
                    },
                  ]}
                />
                {(tree.children.get(previewRow.id)?.length ?? 0) > 0 && (
                  <Button
                    variant="secondary"
                    className="self-start"
                    onClick={() => {
                      const id = previewRow.id;
                      setCollapsed((c) => {
                        const next = new Set(c);
                        next.delete(id);
                        return next;
                      });
                      setPreview(null);
                      requestAnimationFrame(() => requestAnimationFrame(() => centerOn(id)));
                    }}
                  >
                    <Users aria-hidden /> Show their team
                  </Button>
                )}
              </SheetBody>
              <SheetFooter>
                <Button asChild>
                  <Link href={`/people/${previewRow.id}`}>
                    Open full profile <ArrowRight aria-hidden />
                  </Link>
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

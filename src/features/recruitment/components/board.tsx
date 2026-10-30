"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDown,
  GripVertical,
  MessageSquareText,
  MoreHorizontal,
  Pencil,
  Star,
  UserCheck,
  UserPlus,
  UserX,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import { Card } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

import { moveCandidate, restoreCandidate } from "../actions";
import { PIPELINE, STAGE_META, daysSince, type PipelineStage, type Stage } from "../logic/pipeline";
import type { Board as BoardData, BoardCandidate, RecruitmentOptions } from "../queries";
import type { JobInput } from "../schemas";
import { AddCandidateSheet } from "./candidate-sheet";
import { ConvertDialog } from "./convert-dialog";
import { JobSheet } from "./job-sheet";
import { RejectDialog } from "./reject-dialog";

type Columns = Record<PipelineStage, BoardCandidate[]>;
type MoveStage = Exclude<PipelineStage, "HIRED">;

function group(candidates: BoardCandidate[]): Columns {
  const columns = { APPLIED: [], SCREENING: [], INTERVIEW: [], OFFER: [], HIRED: [] } as Columns;
  for (const c of candidates) if (c.stage !== "REJECTED") columns[c.stage].push(c);
  return columns;
}

const isStage = (id: UniqueIdentifier): id is PipelineStage =>
  (PIPELINE as readonly UniqueIdentifier[]).includes(id);

/**
 * Arrow keys while a card is lifted. Up and down walk through the cards;
 * left and right jump to the top of the neighbouring column, which is what
 * the default sortable behaviour can't decide between a column and its cards.
 */
const boardKeyboard: KeyboardCoordinateGetter = (event, args) => {
  if (event.code !== "ArrowLeft" && event.code !== "ArrowRight") {
    return sortableKeyboardCoordinates(event, args);
  }
  event.preventDefault();
  const { droppableRects, droppableContainers, collisionRect } = args.context;
  if (!collisionRect) return undefined;
  const columns = PIPELINE.flatMap((stage) => {
    const rect = droppableRects.get(stage);
    return rect && droppableContainers.get(stage) ? [{ stage, rect }] : [];
  }).sort((a, b) => a.rect.left - b.rect.left);
  const centre = collisionRect.left + collisionRect.width / 2;
  const here = columns.findIndex((c) => centre >= c.rect.left && centre <= c.rect.right);
  const next = columns[here + (event.code === "ArrowRight" ? 1 : -1)];
  if (here < 0 || !next) return undefined;
  return { x: next.rect.left + 2, y: next.rect.top + 2 };
};

function CardBody({
  candidate,
  now,
  children,
  handle,
}: {
  candidate: BoardCandidate;
  now: string;
  children?: React.ReactNode;
  handle?: React.ReactNode;
}) {
  const days = daysSince(new Date(candidate.stageSince), new Date(now));
  return (
    <div className="flex items-start gap-1 rounded-control border border-hairline bg-surface p-2 shadow-xs">
      {handle}
      <div className="min-w-0 flex-1 py-0.5 pl-1">
        <Link
          href={`/hiring/candidates/${candidate.id}`}
          className="block truncate text-body font-medium text-ink hover:text-accent"
        >
          {candidate.name}
        </Link>
        <p className="truncate text-small text-ink-muted">
          {candidate.source} · {days === 0 ? "today" : `${days}d`}
        </p>
        {(candidate.rating != null || candidate.notes > 0) && (
          <p className="mt-1 flex items-center gap-3 text-caption text-ink-subtle">
            {candidate.rating != null && (
              <span className="inline-flex items-center gap-1">
                <Star className="size-3 fill-current text-accent" aria-hidden />
                <span className="num">{candidate.rating.toFixed(1)}</span>
                <span className="sr-only">out of 5</span>
              </span>
            )}
            {candidate.notes > 0 && (
              <span className="inline-flex items-center gap-1">
                <MessageSquareText className="size-3" aria-hidden />
                <span className="num">{candidate.notes}</span>
                <span className="sr-only">{candidate.notes === 1 ? "note" : "notes"}</span>
              </span>
            )}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

function SortableCard({
  candidate,
  now,
  canEdit,
  children,
}: {
  candidate: BoardCandidate;
  now: string;
  canEdit: boolean;
  children?: React.ReactNode;
}) {
  const movable = canEdit && candidate.stage !== "HIRED";
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: candidate.id, disabled: !movable });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(isDragging && "opacity-40")}
    >
      <CardBody
        candidate={candidate}
        now={now}
        handle={
          movable ? (
            <button
              ref={setActivatorNodeRef}
              type="button"
              aria-label={`Move ${candidate.name}`}
              className="mt-0.5 grid h-7 w-5 shrink-0 cursor-grab touch-none place-items-center rounded-xs text-ink-subtle hover:bg-surface-hover hover:text-ink active:cursor-grabbing"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="size-4" aria-hidden />
            </button>
          ) : undefined
        }
      >
        {children}
      </CardBody>
    </li>
  );
}

function Column({
  stage,
  candidates,
  canHire,
  children,
}: {
  stage: PipelineStage;
  candidates: BoardCandidate[];
  canHire: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const headingId = `stage-${stage}`;
  return (
    <section
      aria-labelledby={headingId}
      className="flex w-[17rem] shrink-0 snap-start flex-col rounded-card bg-surface-sunken/70 p-2 lg:w-auto lg:min-w-0 lg:flex-1"
    >
      <div className="flex items-center justify-between px-1.5 py-1">
        <h2 id={headingId} className="text-small font-semibold text-ink">
          {STAGE_META[stage].label}
        </h2>
        <Badge>
          <span className="num">{candidates.length}</span>
        </Badge>
      </div>
      <SortableContext
        id={stage}
        items={candidates.map((c) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul
          ref={setNodeRef}
          className={cn(
            "mt-1 flex min-h-24 flex-1 flex-col gap-2 rounded-control p-0.5 transition-colors duration-150",
            isOver && "bg-accent-subtle/60",
          )}
        >
          {children}
          {candidates.length === 0 && (
            <li className="grid flex-1 place-items-center rounded-control border border-dashed border-hairline px-3 py-6 text-center text-small text-ink-subtle">
              {stage === "HIRED"
                ? canHire
                  ? "Drop an offer here to hire"
                  : "No one hired yet"
                : "No one here yet"}
            </li>
          )}
        </ul>
      </SortableContext>
    </section>
  );
}

export function Board({
  data,
  canEdit,
  canHire,
  now,
  suggestedStart,
  options,
}: {
  data: BoardData;
  canEdit: boolean;
  canHire: boolean;
  now: string;
  suggestedStart: string;
  options: Pick<RecruitmentOptions, "managers" | "takenEmails">;
}) {
  const { job, candidates } = data;
  const router = useRouter();
  const [columns, setColumns] = React.useState(() => group(candidates));
  const [activeId, setActiveId] = React.useState<UniqueIdentifier | null>(null);
  const [hiring, setHiring] = React.useState<BoardCandidate | null>(null);
  const [rejecting, setRejecting] = React.useState<BoardCandidate | null>(null);
  const [, startTransition] = React.useTransition();
  const before = React.useRef<Columns | null>(null);
  const origin = React.useRef<PipelineStage | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: boardKeyboard }),
  );

  const columnOf = (id: UniqueIdentifier, cols: Columns = columns): PipelineStage | null =>
    isStage(id) ? id : (PIPELINE.find((s) => cols[s].some((c) => c.id === id)) ?? null);
  const byId = (id: UniqueIdentifier) =>
    Object.values(columns)
      .flat()
      .find((c) => c.id === id);
  const active = activeId ? byId(activeId) : null;

  const nameOf = (id: UniqueIdentifier) => byId(id)?.name ?? "Candidate";
  const stageName = (id: UniqueIdentifier) => {
    const s = columnOf(id);
    return s ? STAGE_META[s].label : "the board";
  };
  const announcements: Announcements = {
    onDragStart: ({ active: a }) => `Picked up ${nameOf(a.id)}, in ${stageName(a.id)}.`,
    onDragOver: ({ active: a, over }) =>
      over
        ? `${nameOf(a.id)} is over ${stageName(over.id)}.`
        : `${nameOf(a.id)} is between stages.`,
    onDragEnd: ({ active: a, over }) =>
      over ? `${nameOf(a.id)} dropped in ${stageName(over.id)}.` : `${nameOf(a.id)} was put back.`,
    onDragCancel: ({ active: a }) => `Cancelled. ${nameOf(a.id)} stays where they were.`,
  };

  /** Saves a position, and puts everything back if the server says no. */
  function persist(id: string, stage: MoveStage, list: BoardCandidate[], snapshot: Columns) {
    const i = list.findIndex((c) => c.id === id);
    startTransition(async () => {
      const r = await moveCandidate({
        candidateId: id,
        stage,
        aboveId: list[i - 1]?.id ?? null,
        belowId: list[i + 1]?.id ?? null,
      });
      if (!r.ok) {
        setColumns(snapshot);
        toast.error("Couldn't move them", { description: r.error });
        return;
      }
      router.refresh();
    });
  }

  function onDragStart({ active: a }: DragStartEvent) {
    setActiveId(a.id);
    before.current = columns;
    origin.current = columnOf(a.id);
  }

  /** Crossing into another column moves the card there straight away. */
  function onDragOver({ active: a, over }: DragOverEvent) {
    if (!over) return;
    const from = columnOf(a.id);
    const to = columnOf(over.id);
    if (!from || !to || from === to || to === "HIRED") return;
    setColumns((prev) => {
      const moving = prev[from].find((c) => c.id === a.id);
      if (!moving) return prev;
      const target = prev[to];
      const index = isStage(over.id) ? target.length : target.findIndex((c) => c.id === over.id);
      return {
        ...prev,
        [from]: prev[from].filter((c) => c.id !== a.id),
        [to]: [...target.slice(0, index), { ...moving, stage: to }, ...target.slice(index)],
      };
    });
  }

  function onDragEnd({ active: a, over }: DragEndEvent) {
    setActiveId(null);
    const snapshot = before.current ?? columns;
    const from = origin.current;
    const id = String(a.id);
    const dropped = over ? columnOf(over.id) : null;
    if (!over || !dropped || !from) {
      setColumns(snapshot);
      return;
    }
    if (dropped === "HIRED") {
      setColumns(snapshot);
      const person = snapshot[from].find((c) => c.id === id);
      if (from === "OFFER" && canHire) setHiring(person ?? null);
      else if (from !== "OFFER") {
        toast.info("Make them an offer first", {
          description: "Move them to Offer, then drop them here.",
        });
      } else toast.info("Only the people team can complete a hire.");
      return;
    }
    const stage = columnOf(id);
    if (!stage || stage === "HIRED") return;
    let list = columns[stage];
    const oldIndex = list.findIndex((c) => c.id === id);
    const overIndex = list.findIndex((c) => c.id === over.id);
    if (overIndex >= 0 && overIndex !== oldIndex) list = arrayMove(list, oldIndex, overIndex);
    const unchanged = from === stage && overIndex === oldIndex;
    if (unchanged || (from === stage && overIndex < 0)) return;
    setColumns({ ...columns, [stage]: list });
    persist(id, stage, list, snapshot);
  }

  /** The menu's version of a drag, for anyone who'd rather not (or can't) drag. */
  function moveTo(candidate: BoardCandidate, stage: MoveStage) {
    const snapshot = columns;
    const list = [{ ...candidate, stage }, ...columns[stage]];
    setColumns({
      ...columns,
      [candidate.stage as PipelineStage]: columns[candidate.stage as PipelineStage].filter(
        (c) => c.id !== candidate.id,
      ),
      [stage]: list,
    });
    persist(candidate.id, stage, list, snapshot);
  }

  function menuFor(c: BoardCandidate) {
    if (!canEdit || c.stage === "HIRED") return null;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${c.name}`}>
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Move to</DropdownMenuLabel>
          {PIPELINE.filter((s): s is MoveStage => s !== "HIRED" && s !== c.stage).map((s) => (
            <DropdownMenuItem key={s} onSelect={() => moveTo(c, s)}>
              {STAGE_META[s].label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          {c.stage === "OFFER" && canHire && (
            <DropdownMenuItem onSelect={() => setHiring(c)}>
              <UserCheck aria-hidden /> Convert to employee
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => setRejecting(c)}>
            <UserX aria-hidden /> Not moving forward
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <>
      <DndContext
        id="pipeline"
        sensors={sensors}
        collisionDetection={closestCorners}
        accessibility={{
          announcements,
          screenReaderInstructions: {
            draggable:
              "To move a candidate, press Space, use the arrow keys to pick a stage, then press Space again. Press Escape to cancel.",
          },
        }}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setActiveId(null);
          if (before.current) setColumns(before.current);
        }}
      >
        <div
          role="region"
          aria-label="Hiring pipeline"
          tabIndex={0}
          className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 outline-none focus-visible:ring-2 focus-visible:ring-accent sm:mx-0 sm:px-0"
        >
          {PIPELINE.map((stage) => (
            <Column key={stage} stage={stage} candidates={columns[stage]} canHire={canHire}>
              {columns[stage].map((c) => (
                <SortableCard key={c.id} candidate={c} now={now} canEdit={canEdit}>
                  {menuFor(c)}
                </SortableCard>
              ))}
            </Column>
          ))}
        </div>
        <DragOverlay>
          {active ? (
            <div className="rotate-1 shadow-lg">
              <CardBody candidate={active} now={now} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <ConvertDialog
        candidate={
          hiring
            ? {
                id: hiring.id,
                firstName: hiring.name.split(" ")[0]!,
                lastName: hiring.name.split(" ").slice(1).join(" "),
              }
            : null
        }
        hiringManagerId={job.hiringManagerId}
        suggestedStart={suggestedStart}
        options={options}
        onOpenChange={(o) => !o && setHiring(null)}
      />
      <RejectDialog candidate={rejecting} onOpenChange={(o) => !o && setRejecting(null)} />
    </>
  );
}

/* ─── Rejected candidates ──────────────────────────────────────────────── */

export function RejectedList({
  candidates,
  canEdit,
}: {
  candidates: BoardCandidate[];
  canEdit: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const router = useRouter();
  if (candidates.length === 0) return null;

  function restore(c: BoardCandidate) {
    startTransition(async () => {
      const r = await restoreCandidate({ candidateId: c.id });
      if (!r.ok) {
        toast.error("Couldn't bring them back", { description: r.error });
        return;
      }
      toast.success(`${c.name} is back in ${STAGE_META[r.data.stage as Stage].label}`);
      router.refresh();
    });
  }

  return (
    <Card>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-card px-5 py-3.5 text-left hover:bg-surface-hover"
      >
        <span className="text-body font-medium text-ink">
          Not moving forward <span className="num text-ink-muted">· {candidates.length}</span>
        </span>
        <ChevronDown
          className={cn("size-4 text-ink-subtle transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open && (
        <ul className="border-t border-hairline px-5 py-1">
          {candidates.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-3 border-b border-hairline py-2 last:border-0"
            >
              <Link
                href={`/hiring/candidates/${c.id}`}
                className="min-w-0 flex-1 truncate text-body text-ink hover:text-accent"
              >
                {c.name}
              </Link>
              <span className="text-small text-ink-muted">{c.source}</span>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => restore(c)}
                  aria-label={`Bring back ${c.name}`}
                >
                  Bring back
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ─── Page header actions ──────────────────────────────────────────────── */

export function JobActions({
  jobId,
  closed,
  canManage,
  canAdd,
  job,
  options,
}: {
  jobId: string;
  closed: boolean;
  canManage: boolean;
  canAdd: boolean;
  job: JobInput;
  options: RecruitmentOptions;
}) {
  const [editing, setEditing] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  return (
    <>
      {canManage && (
        <Button variant="secondary" onClick={() => setEditing(true)}>
          <Pencil aria-hidden /> Edit role
        </Button>
      )}
      {canAdd && !closed && (
        <Button onClick={() => setAdding(true)}>
          <UserPlus aria-hidden /> Add candidate
        </Button>
      )}
      {canManage && (
        <JobSheet open={editing} onOpenChange={setEditing} job={job} options={options} />
      )}
      {canAdd && <AddCandidateSheet jobId={jobId} open={adding} onOpenChange={setAdding} />}
    </>
  );
}

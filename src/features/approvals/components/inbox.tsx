"use client";

import { format, formatDistanceToNowStrict } from "date-fns";
import {
  CalendarClock,
  Check,
  CheckCheck,
  Clock3,
  Inbox as InboxIcon,
  PartyPopper,
  Users,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Avatar } from "@/components/ui/avatar";
import { Badge, StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/choice";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/overlay";
import { Card } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/states";
import { toast } from "@/components/ui/toaster";
import { useMounted } from "@/hooks/use-mounted";
import { gentle, snappy } from "@/lib/motion";
import { dbDate } from "@/lib/tz";
import { cn } from "@/lib/utils";

import { decideRequests } from "../actions";
import type { InboxItem } from "../queries";

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

function leaveDates(l: NonNullable<InboxItem["leave"]>) {
  if (l.start === l.end) {
    const part =
      l.startHalf === "FIRST" ? " · morning" : l.startHalf === "SECOND" ? " · afternoon" : "";
    return `${format(dbDate(l.start), "EEE d MMM")}${part}`;
  }
  return `${format(dbDate(l.start), "EEE d MMM")} – ${format(dbDate(l.end), "EEE d MMM")}`;
}

function Summary({ item }: { item: InboxItem }) {
  if (item.leave) {
    return (
      <>
        <p className="flex flex-wrap items-baseline gap-x-2 text-body text-ink">
          <span className="font-medium">{item.leave.type}</span>
          <span className="num text-ink-muted">
            {fmt(item.leave.days)} {item.leave.days === 1 ? "day" : "days"}
          </span>
        </p>
        <p className="num text-small text-ink">{leaveDates(item.leave)}</p>
        <p className="mt-1 text-small text-ink-muted">“{item.leave.reason}”</p>
      </>
    );
  }
  if (item.correction) {
    const c = item.correction;
    const show = (from: string | null, to: string | null, label: string) =>
      to ? (
        <span>
          {label} <span className="font-mono text-ink-subtle line-through">{from ?? "none"}</span>{" "}
          <span className="font-mono text-ink">{to}</span>
        </span>
      ) : null;
    return (
      <>
        <p className="text-body font-medium text-ink">Attendance correction</p>
        <p className="flex flex-wrap gap-x-3 num text-small text-ink-muted">
          <span className="text-ink">{format(dbDate(c.date), "EEE d MMM")}</span>
          {show(c.from.in, c.to.in, "In")}
          {show(c.from.out, c.to.out, "Out")}
        </p>
        <p className="mt-1 text-small text-ink-muted">“{c.reason}”</p>
      </>
    );
  }
  return null;
}

function Context({ item }: { item: InboxItem }) {
  const levels = item.steps.length;
  const current = item.steps.find((s) => s.status === "PENDING");
  const before = item.steps.filter((s) => s.status === "APPROVED");
  return (
    <div className="flex flex-wrap gap-1.5">
      {levels > 1 && current && (
        <Badge tone="info">
          Step {current.level} of {levels}
          {before.length > 0 &&
            ` · ${before.map((b) => b.approver.split(" ")[0]).join(", ")} approved`}
        </Badge>
      )}
      {item.conflicts.length > 0 && (
        <Badge tone="warning">
          <Users aria-hidden /> Also away:{" "}
          {item.conflicts
            .slice(0, 2)
            .map((c) => c.name.split(" ")[0])
            .join(", ")}
          {item.conflicts.length > 2 && ` +${item.conflicts.length - 2}`}
        </Badge>
      )}
      {item.holidaysInside.length > 0 && (
        <Badge tone="accent">Includes {item.holidaysInside.join(", ")}</Badge>
      )}
    </div>
  );
}

function Requested({ at }: { at: string }) {
  const mounted = useMounted();
  return (
    <span className="inline-flex items-center gap-1 text-caption text-ink-subtle">
      <Clock3 className="size-3" aria-hidden />
      {mounted ? `${formatDistanceToNowStrict(new Date(at))} ago` : format(new Date(at), "d MMM")}
    </span>
  );
}

export function Inbox({ items, emptyTitle }: { items: InboxItem[]; emptyTitle: string }) {
  const router = useRouter();
  const [hidden, setHidden] = React.useState<Set<string>>(new Set());
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [declining, setDeclining] = React.useState<string[] | null>(null);
  const [comment, setComment] = React.useState("");
  const [commentError, setCommentError] = React.useState<string | null>(null);
  const [, startTransition] = React.useTransition();

  const visible = items.filter((i) => !hidden.has(i.id));
  const selectedVisible = visible.filter((i) => selected.has(i.id)).map((i) => i.id);
  const allSelected = visible.length > 0 && selectedVisible.length === visible.length;

  function run(ids: string[], decision: "APPROVE" | "REJECT", note: string | null) {
    // Optimistic: they leave the list at once and come back if it fails.
    setHidden((h) => new Set([...h, ...ids]));
    setSelected((s) => new Set([...s].filter((x) => !ids.includes(x))));
    startTransition(async () => {
      const r = await decideRequests({ requestIds: ids, decision, comment: note });
      if (!r.ok) {
        setHidden((h) => new Set([...h].filter((x) => !ids.includes(x))));
        toast.error("Nothing was changed", { description: r.error });
        return;
      }
      const { approved, rejected, advanced, skipped } = r.data;
      const parts = [
        approved && `${approved} approved`,
        advanced && `${advanced} sent on to HR`,
        rejected && `${rejected} declined`,
        skipped && `${skipped} already decided by someone else`,
      ].filter(Boolean);
      toast.success(parts.join(", ") || "Done", {
        description:
          decision === "APPROVE" ? "They'll see it straight away." : "They'll see your note.",
      });
      router.refresh();
    });
  }

  function confirmDecline() {
    if (!declining) return;
    if (!comment.trim()) {
      setCommentError("Add a short note so they know why");
      return;
    }
    run(declining, "REJECT", comment.trim());
    setDeclining(null);
    setComment("");
    setCommentError(null);
  }

  if (visible.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={CheckCheck}
          satellites={[PartyPopper, InboxIcon]}
          title={emptyTitle}
          description="New leave and attendance requests land here. Requests you decide disappear from this list and move to Decided."
        />
      </Card>
    );
  }

  return (
    <div className="relative flex flex-col gap-3">
      <div className="flex items-center gap-3 px-1">
        <label className="flex items-center gap-2.5 text-small text-ink-muted">
          <Checkbox
            checked={allSelected ? true : selectedVisible.length ? "indeterminate" : false}
            onCheckedChange={(v) => setSelected(v ? new Set(visible.map((i) => i.id)) : new Set())}
            aria-label="Select all requests"
          />
          {selectedVisible.length ? `${selectedVisible.length} selected` : "Select all"}
        </label>
      </div>

      <ul className="flex flex-col gap-3">
        <AnimatePresence initial={false}>
          {visible.map((item) => (
            <motion.li
              key={item.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 24, transition: { duration: 0.18 } }}
              transition={gentle}
            >
              <Card
                className={cn(
                  "flex flex-col gap-4 p-5 sm:flex-row sm:items-start",
                  selected.has(item.id) && "border-accent/50",
                )}
              >
                <div className="flex items-start gap-3 sm:w-64 sm:shrink-0">
                  <Checkbox
                    className="mt-2"
                    checked={selected.has(item.id)}
                    onCheckedChange={(v) =>
                      setSelected((s) => {
                        const n = new Set(s);
                        if (v) n.add(item.id);
                        else n.delete(item.id);
                        return n;
                      })
                    }
                    aria-label={`Select ${item.requester.name}'s request`}
                  />
                  <Link
                    href={`/people/${item.requester.id}`}
                    className="flex min-w-0 items-center gap-3 hover:text-accent"
                  >
                    <Avatar name={item.requester.name} src={item.requester.avatarUrl} size="md" />
                    <span className="min-w-0">
                      <span className="block truncate text-body font-semibold text-ink">
                        {item.requester.name}
                      </span>
                      <span className="block truncate text-small text-ink-muted">
                        {item.requester.title}
                      </span>
                      <Requested at={item.createdAt} />
                    </span>
                  </Link>
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                  <div>
                    <Summary item={item} />
                  </div>
                  <Context item={item} />
                </div>
                <div className="flex gap-2 sm:flex-col">
                  <Button
                    size="sm"
                    onClick={() => run([item.id], "APPROVE", null)}
                    aria-label={`Approve ${item.requester.name}'s request`}
                  >
                    <Check aria-hidden /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeclining([item.id])}
                    aria-label={`Decline ${item.requester.name}'s request`}
                  >
                    <X aria-hidden /> Decline
                  </Button>
                </div>
              </Card>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      <AnimatePresence>
        {selectedVisible.length > 0 && (
          <motion.div
            role="region"
            aria-label="Bulk actions"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={snappy}
            className="sticky bottom-4 z-10 mx-auto flex items-center gap-3 rounded-full border border-hairline bg-ink py-1.5 pr-1.5 pl-4 text-bg shadow-lg"
          >
            <span className="num text-small font-medium">{selectedVisible.length} selected</span>
            <Button
              size="sm"
              className="rounded-full"
              onClick={() => run(selectedVisible, "APPROVE", null)}
            >
              <CheckCheck aria-hidden /> Approve all
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="rounded-full text-bg/80 hover:bg-bg/10 hover:text-bg"
              onClick={() => setDeclining(selectedVisible)}
            >
              Decline
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog
        open={!!declining}
        onOpenChange={(o) => {
          if (!o) {
            setDeclining(null);
            setCommentError(null);
          }
        }}
      >
        <DialogContent size="sm">
          <DialogHeader
            title={
              declining && declining.length > 1
                ? `Decline ${declining.length} requests?`
                : "Decline this request?"
            }
            description="They'll see your note, so make it kind and specific."
          />
          <DialogBody>
            <Field label="Note" error={commentError ?? undefined}>
              <Textarea
                rows={3}
                value={comment}
                onChange={(e) => {
                  setComment(e.target.value);
                  setCommentError(null);
                }}
                placeholder="We're short-staffed that week. Could you move it by a week?"
              />
            </Field>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Back</Button>
            </DialogClose>
            <Button variant="destructive" onClick={confirmDecline}>
              Decline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function DecidedList({
  items,
}: {
  items: Awaited<ReturnType<typeof import("../queries").recentDecisions>>;
}) {
  if (items.length === 0) {
    return (
      <Card>
        <EmptyState
          compact
          icon={CalendarClock}
          title="Nothing decided yet"
          description="Requests you approve or decline are kept here for reference."
        />
      </Card>
    );
  }
  return (
    <Card>
      <ul className="divide-y divide-hairline">
        {items.map((i) => (
          <li key={i.id} className="flex items-center gap-3 px-5 py-3">
            <Avatar name={i.requester.name} src={i.requester.avatarUrl} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body text-ink">
                {i.requester.name} ·{" "}
                {i.leave ? `${i.leave.type}, ${leaveDates(i.leave)}` : "Attendance correction"}
              </span>
              <span className="block text-caption text-ink-subtle">
                {i.decidedAt && format(new Date(i.decidedAt), "d MMM, HH:mm")}
              </span>
            </span>
            <StatusPill
              tone={
                i.status === "APPROVED"
                  ? "success"
                  : i.status === "REJECTED"
                    ? "danger"
                    : i.status === "PENDING"
                      ? "info"
                      : "neutral"
              }
            >
              {i.status === "APPROVED"
                ? "Approved"
                : i.status === "REJECTED"
                  ? "Declined"
                  : i.status === "PENDING"
                    ? "With HR"
                    : "Cancelled"}
            </StatusPill>
          </li>
        ))}
      </ul>
    </Card>
  );
}

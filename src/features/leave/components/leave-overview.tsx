"use client";

import { format } from "date-fns";
import { CalendarCheck, CalendarX, Hourglass, Palmtree, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Badge, StatusPill, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { celebrate } from "@/components/ui/celebrate";
import { SegmentedControl } from "@/components/ui/choice";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/overlay";
import { Card, CardHeader } from "@/components/ui/primitives";
import { ProgressRing } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/states";
import { toast } from "@/components/ui/toaster";
import { gentle } from "@/lib/motion";
import { dbDate, type ISODate } from "@/lib/tz";
import { cn } from "@/lib/utils";

import { cancelLeave } from "../actions";
import type { BalanceRow, MyLeaveRequest } from "../queries";

const STATUS: Record<MyLeaveRequest["status"], { label: string; tone: Tone }> = {
  PENDING: { label: "Pending", tone: "warning" },
  APPROVED: { label: "Approved", tone: "success" },
  REJECTED: { label: "Declined", tone: "danger" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};

/** The everyday balances get rings; everything else is listed below them. */
const PRIMARY = { EL: "accent", CL: "highlight", SL: "success" } as const;
const isPrimary = (b: BalanceRow) => b.code in PRIMARY;
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

function dateRange(r: MyLeaveRequest) {
  const s = dbDate(r.start);
  const e = dbDate(r.end);
  const half = (h: string | null, which: "start" | "end") =>
    h ? (which === "start" ? (h === "SECOND" ? " (afternoon)" : " (morning)") : " (morning)") : "";
  if (r.start === r.end)
    return `${format(s, "EEE d MMM yyyy")}${half(r.startHalf ?? r.endHalf, "start")}`;
  const sameYear = r.start.slice(0, 4) === r.end.slice(0, 4);
  return `${format(s, sameYear ? "d MMM" : "d MMM yyyy")}${r.startHalf ? " (pm)" : ""} – ${format(e, "d MMM yyyy")}${r.endHalf ? " (am)" : ""}`;
}

function progress(r: MyLeaveRequest) {
  if (r.status === "CANCELLED") return "You cancelled this request";
  const decided = r.steps.filter((s) => s.status === "APPROVED" || s.status === "REJECTED");
  const waiting = r.steps.find((s) => s.status === "PENDING");
  const parts = decided.map(
    (s) => `${s.status === "APPROVED" ? "Approved" : "Declined"} by ${s.approver}`,
  );
  if (waiting) parts.push(`waiting on ${waiting.approver}`);
  return parts.join(", then ");
}

export function BalanceCards({ balances }: { balances: BalanceRow[] }) {
  const paid = balances
    .filter(isPrimary)
    .sort((a, b) => Object.keys(PRIMARY).indexOf(a.code) - Object.keys(PRIMARY).indexOf(b.code));
  return (
    <ul className="grid gap-3 sm:grid-cols-3">
      {paid.map((b) => {
        const total = b.summary.accrued + b.summary.carriedForward + b.summary.adjusted;
        const pct = total ? (b.summary.available / total) * 100 : 0;
        return (
          <li key={b.typeId}>
            <Card className="flex items-center gap-4 p-5">
              <ProgressRing
                value={pct}
                size={68}
                stroke={6}
                tone={PRIMARY[b.code as keyof typeof PRIMARY]}
                label={`${b.name}: ${fmt(b.summary.available)} days left`}
              >
                <span className="num text-heading font-semibold text-ink">
                  {fmt(b.summary.available)}
                </span>
              </ProgressRing>
              <div className="min-w-0">
                <p className="text-body font-semibold text-ink">{b.name}</p>
                <p className="text-small text-ink-muted">
                  {fmt(b.summary.used)} used
                  {b.summary.pending > 0 && <> · {fmt(b.summary.pending)} pending</>}
                </p>
                <p className="text-caption text-ink-subtle">
                  {fmt(b.summary.accrued)} earned so far
                  {b.summary.carriedForward > 0 &&
                    ` + ${fmt(b.summary.carriedForward)} carried over`}
                </p>
              </div>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}

const CELEBRATED_KEY = "grove.celebrated-leave";

export function LeaveRequests({ requests, today }: { requests: MyLeaveRequest[]; today: ISODate }) {
  const [view, setView] = React.useState<"upcoming" | "past">("upcoming");
  const [cancelling, setCancelling] = React.useState<MyLeaveRequest | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [hidden, setHidden] = React.useState<Set<string>>(new Set());
  const router = useRouter();

  // Approved recently and not celebrated yet: a moment worth marking.
  React.useEffect(() => {
    let seen: string[] = [];
    try {
      seen = JSON.parse(localStorage.getItem(CELEBRATED_KEY) ?? "[]");
    } catch {}
    const weekAgo = Date.now() - 7 * 864e5;
    const fresh = requests.find(
      (r) =>
        r.status === "APPROVED" &&
        r.end >= today &&
        r.decidedAt &&
        Date.parse(r.decidedAt) > weekAgo &&
        !seen.includes(r.id),
    );
    if (!fresh) return;
    const t = setTimeout(() => {
      celebrate();
      toast.success("Your leave is approved", { description: `${dateRange(fresh)}. Enjoy it.` });
      try {
        localStorage.setItem(CELEBRATED_KEY, JSON.stringify([...seen, fresh.id].slice(-50)));
      } catch {}
    }, 500);
    return () => clearTimeout(t);
  }, [requests, today]);

  const upcoming = requests.filter(
    (r) => r.end >= today && (r.status === "PENDING" || r.status === "APPROVED"),
  );
  const past = requests.filter((r) => !upcoming.includes(r));
  const list = (view === "upcoming" ? upcoming : past).filter((r) => !hidden.has(r.id));

  function cancel(r: MyLeaveRequest) {
    setHidden((h) => new Set(h).add(r.id));
    setCancelling(null);
    startTransition(async () => {
      const res = await cancelLeave({ requestId: r.id });
      if (!res.ok) {
        setHidden((h) => {
          const n = new Set(h);
          n.delete(r.id);
          return n;
        });
        toast.error("Couldn't cancel", { description: res.error });
        return;
      }
      toast.success("Request cancelled", {
        description: `${fmt(r.days)} ${r.days === 1 ? "day is" : "days are"} back in your balance.`,
      });
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader
        title="Your requests"
        action={
          <SegmentedControl
            aria-label="Show"
            size="sm"
            value={view}
            onValueChange={setView}
            options={[
              { value: "upcoming", label: `Upcoming · ${upcoming.length}` },
              { value: "past", label: "Past" },
            ]}
          />
        }
      />
      {list.length === 0 ? (
        <EmptyState
          compact
          icon={view === "upcoming" ? Palmtree : CalendarCheck}
          satellites={[Hourglass]}
          title={view === "upcoming" ? "No leave planned yet" : "Nothing here yet"}
          description={
            view === "upcoming"
              ? "When you need a break, apply above. You'll see approval progress here."
              : "Leave you've taken this year and last shows up here."
          }
        />
      ) : (
        <ul className="mt-3 flex flex-col">
          <AnimatePresence initial={false}>
            {list.map((r) => {
              const s = STATUS[r.status];
              const canCancel =
                r.status === "PENDING" || (r.status === "APPROVED" && r.start > today);
              return (
                <motion.li
                  key={r.id}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={gentle}
                  className="overflow-hidden border-t border-hairline"
                >
                  <div className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-body font-medium text-ink">
                        {r.type.name}
                        <span className="num text-small font-normal text-ink-muted">
                          {fmt(r.days)} {r.days === 1 ? "day" : "days"}
                        </span>
                      </p>
                      <p className="num text-small text-ink">{dateRange(r)}</p>
                      <p className="mt-0.5 text-small text-ink-subtle">
                        {progress(r)}
                        {r.steps.find((x) => x.comment) && (
                          <span className="block text-ink-muted">
                            “{r.steps.find((x) => x.comment)!.comment}”
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusPill tone={s.tone}>{s.label}</StatusPill>
                      {canCancel && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setCancelling(r)}
                          disabled={pending}
                          aria-label={`Cancel ${r.type.name} on ${dateRange(r)}`}
                        >
                          <X aria-hidden /> Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}

      <Dialog open={!!cancelling} onOpenChange={(o) => !o && setCancelling(null)}>
        <DialogContent size="sm">
          <DialogHeader
            title="Cancel this leave?"
            description={
              cancelling
                ? `${cancelling.type.name}, ${dateRange(cancelling)}. The days go back into your balance.`
                : undefined
            }
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Keep it</Button>
            </DialogClose>
            <Button variant="destructive" onClick={() => cancelling && cancel(cancelling)}>
              <CalendarX aria-hidden /> Cancel leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export function UnpaidNote({ balances }: { balances: BalanceRow[] }) {
  const others = balances.filter((b) => !isPrimary(b));
  if (!others.length) return null;
  return (
    <p className="flex flex-wrap items-center gap-2 text-small text-ink-muted">
      Also available:
      {others.map((b) => (
        <Badge key={b.typeId} tone="neutral" className={cn(!b.isPaid && "italic")}>
          {b.name}
          {b.isPaid ? ` · ${fmt(b.summary.available)}` : ""}
        </Badge>
      ))}
    </p>
  );
}

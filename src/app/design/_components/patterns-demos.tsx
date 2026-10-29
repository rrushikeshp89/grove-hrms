"use client";

import { format } from "date-fns";
import {
  Award,
  CalendarCheck,
  CheckCheck,
  Coffee,
  FileText,
  FolderOpen,
  Inbox,
  PartyPopper,
  Sparkles,
  Sprout,
  Upload,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import * as React from "react";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { celebrate } from "@/components/ui/celebrate";
import { SegmentedControl } from "@/components/ui/choice";
import { Card, CardHeader } from "@/components/ui/primitives";
import {
  CardGridSkeleton,
  DashboardSkeleton,
  EmptyState,
  ErrorState,
  ProfileSkeleton,
  TableSkeleton,
} from "@/components/ui/states";
import { toast } from "@/components/ui/toaster";
import { useMounted } from "@/hooks/use-mounted";
import { dayPart, greeting } from "@/lib/format";
import { gentle } from "@/lib/motion";

/* ─── Greeting ─────────────────────────────────────────────────────────── */

export function GreetingDemo() {
  const mounted = useMounted();
  // Render a neutral greeting on the server; the real hour is the viewer's.
  const now = mounted ? new Date() : null;
  const hour = now?.getHours() ?? 9;
  const part = dayPart(hour);
  const Icon = part === "morning" ? Coffee : part === "afternoon" ? Sprout : Sparkles;
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-end sm:justify-between sm:p-8">
        <div>
          <p className="mb-3 inline-flex items-center gap-1.5 eyebrow">
            <Icon className="size-3.5" aria-hidden />
            {now ? format(now, "EEEE, d MMMM") : " "}
          </p>
          <h3 className="font-display-soft text-display font-medium text-ink sm:text-display-xl">
            {mounted ? greeting("Priya", hour) : "Welcome back, Priya"}
          </h3>
          <p className="mt-2 max-w-lg text-body text-ink-muted">
            Two leave requests are waiting on you, Ananya is out today, and Rohan finishes his first
            week on Friday.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary">
            <Inbox aria-hidden /> Review approvals
          </Button>
        </div>
      </div>
    </Card>
  );
}

/* ─── Empty and error states ───────────────────────────────────────────── */

export function EmptyStatesDemo() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <EmptyState
          icon={CheckCheck}
          satellites={[PartyPopper, Inbox]}
          title="You're all caught up"
          description="No requests are waiting on you. New leave and attendance requests from your team will land here."
          action={
            <Button variant="secondary" size="sm">
              View past decisions
            </Button>
          }
        />
      </Card>
      <Card>
        <EmptyState
          icon={FolderOpen}
          satellites={[FileText, Upload]}
          title="No documents yet"
          description="Upload Arjun's offer letter, ID proof or certificates. Only Arjun and HR can see them."
          action={
            <Button size="sm">
              <Upload aria-hidden /> Upload a document
            </Button>
          }
        />
      </Card>
      <Card>
        <EmptyState
          icon={CalendarCheck}
          satellites={[Sprout, Coffee]}
          title="Nobody's away this week"
          description="The whole team is in. Leave you approve will show up on this calendar."
          action={
            <Button variant="secondary" size="sm">
              Apply for leave
            </Button>
          }
        />
      </Card>
    </div>
  );
}

export function ErrorDemo() {
  const [state, setState] = React.useState<"error" | "loading" | "done">("error");
  return (
    <div className="flex flex-col gap-3">
      {state === "error" && (
        <ErrorState
          title="We couldn't load this month's timesheet"
          description="The attendance service didn't respond in time. Nothing was lost; your clock-ins are saved."
          reference="ATT-7F3K-0291"
          onRetry={() => {
            setState("loading");
            setTimeout(() => setState("done"), 900);
          }}
          secondaryAction={<Button variant="ghost">Go to home</Button>}
        />
      )}
      {state === "loading" && <TableSkeleton rows={3} columns={4} />}
      {state === "done" && (
        <Card className="flex items-center justify-between gap-4 p-5">
          <p className="text-body text-ink">
            Timesheet loaded. In the product, the real content replaces the skeleton here.
          </p>
          <Button variant="secondary" size="sm" onClick={() => setState("error")}>
            Show the error again
          </Button>
        </Card>
      )}
    </div>
  );
}

/* ─── Skeletons ────────────────────────────────────────────────────────── */

export function SkeletonsDemo() {
  const [kind, setKind] = React.useState<"table" | "profile" | "dashboard" | "cards">("table");
  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl
        aria-label="Skeleton layout"
        value={kind}
        onValueChange={setKind}
        options={[
          { value: "table", label: "Table" },
          { value: "profile", label: "Profile" },
          { value: "dashboard", label: "Dashboard" },
          { value: "cards", label: "Directory" },
        ]}
        className="self-start"
      />
      <Card className="p-5">
        {kind === "table" && <TableSkeleton />}
        {kind === "profile" && <ProfileSkeleton />}
        {kind === "dashboard" && <DashboardSkeleton />}
        {kind === "cards" && <CardGridSkeleton />}
      </Card>
    </div>
  );
}

/* ─── Optimistic list ──────────────────────────────────────────────────── */

const REQUESTS = [
  { id: "r1", name: "Arjun Mehta", what: "Casual leave · 4–5 Nov", days: "2 days" },
  {
    id: "r2",
    name: "Fatima Shaikh",
    what: "Regularize · 27 Oct, forgot to clock out",
    days: "18:30",
  },
  { id: "r3", name: "Daniel Thomas", what: "Earned leave · 12–14 Nov", days: "3 days" },
  { id: "r4", name: "Lakshmi Venkatesh", what: "Sick leave · 28 Oct", days: "1 day" },
];

export function OptimisticDemo() {
  const [items, setItems] = React.useState(REQUESTS);

  function decide(id: string, verdict: "approved" | "declined") {
    const index = items.findIndex((r) => r.id === id);
    const item = items[index];
    if (!item) return;
    // Optimistic: the row leaves immediately; undo puts it back where it was.
    setItems((all) => all.filter((r) => r.id !== id));
    toast.success(`${item.name.split(" ")[0]}'s request ${verdict}`, {
      action: {
        label: "Undo",
        onClick: () =>
          setItems((all) => {
            const next = [...all];
            next.splice(Math.min(index, next.length), 0, item);
            return next;
          }),
      },
    });
  }

  return (
    <Card>
      <CardHeader
        title="Waiting on you"
        description="Approving removes the row right away. Undo restores it in place."
        action={
          <Badge tone="accent" className="num">
            {items.length}
          </Badge>
        }
      />
      <ul className="mt-3 flex flex-col">
        <AnimatePresence initial={false}>
          {items.map((r) => (
            <motion.li
              key={r.id}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0, transition: { duration: 0.18 } }}
              transition={gentle}
              className="overflow-hidden border-t border-hairline"
            >
              <div className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center">
                <div className="flex flex-1 items-center gap-3">
                  <Avatar name={r.name} size="sm" />
                  <div className="min-w-0">
                    <p className="text-body font-medium text-ink">{r.name}</p>
                    <p className="truncate text-small text-ink-muted">{r.what}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => decide(r.id, "declined")}>
                    Decline
                  </Button>
                  <Button size="sm" onClick={() => decide(r.id, "approved")}>
                    Approve
                  </Button>
                </div>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {items.length === 0 && (
        <EmptyState
          compact
          icon={CheckCheck}
          satellites={[PartyPopper]}
          title="All caught up"
          description="Nothing else needs your decision today."
          action={
            <Button variant="secondary" size="sm" onClick={() => setItems(REQUESTS)}>
              Reset the demo
            </Button>
          }
        />
      )}
    </Card>
  );
}

/* ─── Celebration ──────────────────────────────────────────────────────── */

export function CelebrationDemo() {
  function fire(e: React.MouseEvent<HTMLButtonElement>, title: string, description: string) {
    const r = e.currentTarget.getBoundingClientRect();
    celebrate({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    toast.success(title, { description });
  }
  return (
    <Card className="border-highlight/40 bg-highlight-subtle/50">
      <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
        <span className="grid size-14 shrink-0 place-items-center rounded-full bg-highlight text-highlight-fg">
          <Award className="size-7" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="flex-1">
          <h3 className="font-display-soft text-title font-medium text-ink">
            Saved for real milestones
          </h3>
          <p className="mt-1 text-body text-ink-muted">
            Confetti only fires when leave is approved, onboarding is complete, or it&apos;s a work
            anniversary. With reduced motion on, the message carries the moment on its own.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={(e) => fire(e, "Your leave is approved", "4–5 Nov · enjoy the wedding")}
          >
            Leave approved
          </Button>
          <Button
            variant="secondary"
            onClick={(e) =>
              fire(e, "Five years at Northwind Grove", "Thank you for everything, Vikram")
            }
          >
            Anniversary
          </Button>
        </div>
      </div>
    </Card>
  );
}

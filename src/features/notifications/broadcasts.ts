import "server-only";

import { inAudience, type Audience } from "@/features/announcements/logic/content";
import type { Prisma } from "@/generated/prisma/client";

import { notify } from "./notify";

type Tx = Prisma.TransactionClient;

const nameOf = (p: { firstName: string; lastName: string; preferredName: string | null }) =>
  `${p.preferredName ?? p.firstName} ${p.lastName}`;

const people = { firstName: true, lastName: true, preferredName: true } as const;

/** Notifications sent to many people at once, when something they care about happens. */

export async function notifyPayslipsReady(
  tx: Tx,
  runId: string,
  label: string,
  actorUserId?: string,
) {
  const slips = await tx.payslip.findMany({
    where: { runId },
    select: { id: true, employeeId: true },
  });
  await notify(
    tx,
    slips.map((s) => ({
      employeeId: s.employeeId,
      kind: "SYSTEM" as const,
      title: `Your ${label} payslip is ready`,
      body: "Open it to see the breakdown or download the PDF.",
      href: `/pay/${s.id}`,
      actorUserId,
    })),
  );
}

export async function notifyAnnouncementPublished(
  tx: Tx,
  announcementId: string,
  actorUserId?: string,
) {
  const a = await tx.announcement.findUnique({
    where: { id: announcementId },
    select: { title: true, bodyText: true, audience: true },
  });
  if (!a) return;
  const audience = (
    a.audience && typeof a.audience === "object" && !Array.isArray(a.audience) ? a.audience : null
  ) as Audience;
  const staff = await tx.employee.findMany({
    where: { status: { not: "EXITED" } },
    select: { id: true, departmentId: true, locationId: true },
  });
  const preview = a.bodyText.length > 120 ? `${a.bodyText.slice(0, 119).trimEnd()}…` : a.bodyText;
  await notify(
    tx,
    staff
      .filter((p) => inAudience(p, audience))
      .map((p) => ({
        employeeId: p.id,
        kind: "ANNOUNCEMENT" as const,
        title: a.title,
        body: preview,
        href: "/announcements",
        actorUserId,
      })),
  );
}

const CYCLE_COPY: Partial<
  Record<string, { title: (name: string) => string; body: string; kind: "REMINDER" | "SYSTEM" }>
> = {
  SELF_REVIEW: {
    kind: "REMINDER",
    title: (n) => `${n} self reviews are open`,
    body: "Write yours when you have a quiet half hour.",
  },
  MANAGER_REVIEW: {
    kind: "REMINDER",
    title: (n) => `${n} manager reviews are open`,
    body: "Your reviews of your reports are ready to write.",
  },
  CLOSED: {
    kind: "SYSTEM",
    title: (n) => `Your ${n} results are ready`,
    body: "See your ratings and what your manager wrote.",
  },
};

/** Tells the people a new cycle step is waiting on, or at the end, everyone with results. */
export async function notifyCycleStep(
  tx: Tx,
  cycleId: string,
  status: string,
  actorUserId?: string,
) {
  const copy = CYCLE_COPY[status];
  if (!copy) return;
  const cycle = await tx.reviewCycle.findUnique({ where: { id: cycleId }, select: { name: true } });
  if (!cycle) return;
  const kind = status === "MANAGER_REVIEW" ? "MANAGER" : "SELF";
  const reviews = await tx.review.findMany({
    where: { cycleId, kind },
    select: { reviewerId: true, revieweeId: true },
  });
  const recipients = new Set(
    reviews.map((r) => (status === "CLOSED" ? r.revieweeId : r.reviewerId)),
  );
  await notify(
    tx,
    [...recipients].map((employeeId) => ({
      employeeId,
      kind: copy.kind,
      title: copy.title(cycle.name),
      body: copy.body,
      href: "/performance?view=reviews",
      actorUserId,
    })),
  );
}

export async function notifyFeedbackRequested(
  tx: Tx,
  opts: { revieweeId: string; fromIds: string[]; actorUserId?: string },
) {
  const about = await tx.employee.findUnique({ where: { id: opts.revieweeId }, select: people });
  if (!about) return;
  await notify(
    tx,
    opts.fromIds.map((employeeId) => ({
      employeeId,
      kind: "REMINDER" as const,
      title: `Feedback wanted about ${nameOf(about)}`,
      body: "It takes a few minutes, and your name isn't shown to them.",
      href: "/performance?view=reviews",
      actorUserId: opts.actorUserId,
    })),
  );
}

/** One notification per person who now has tasks on a checklist, saying how many. */
export async function notifyChecklistTasks(tx: Tx, checklistId: string, actorUserId?: string) {
  const c = await tx.checklist.findUnique({
    where: { id: checklistId },
    select: { kind: true, employee: { select: people }, tasks: { select: { assigneeId: true } } },
  });
  if (!c) return;
  const counts = new Map<string, number>();
  for (const t of c.tasks) {
    if (t.assigneeId) counts.set(t.assigneeId, (counts.get(t.assigneeId) ?? 0) + 1);
  }
  const who = nameOf(c.employee);
  const what = c.kind === "ONBOARDING" ? "onboarding" : "offboarding";
  await notify(
    tx,
    [...counts].map(([employeeId, n]) => ({
      employeeId,
      kind: "REMINDER" as const,
      title: `${n} ${n === 1 ? "task" : "tasks"} for ${who}'s ${what}`,
      body: "They're on your list, with due dates.",
      href: `/lifecycle/${checklistId}`,
      actorUserId,
    })),
  );
}

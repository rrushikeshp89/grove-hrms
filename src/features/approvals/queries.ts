import "server-only";

import { holidaysFor } from "@/features/time/calendar";
import { teamAbsences } from "@/features/leave/queries";
import { db, type Prisma } from "@/lib/db";
import { scopeFor } from "@/lib/rbac";
import { clockTime, isoFromDbDate } from "@/lib/tz";
import { actorOf, type CurrentUser } from "@/server/session";

const requestSelect = {
  id: true,
  type: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  requester: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      preferredName: true,
      avatarUrl: true,
      locationId: true,
      designation: { select: { title: true } },
      location: { select: { timezone: true } },
    },
  },
  steps: {
    orderBy: { level: "asc" },
    select: {
      level: true,
      status: true,
      comment: true,
      decidedAt: true,
      approver: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
    },
  },
  leave: {
    select: {
      startDate: true,
      endDate: true,
      startHalf: true,
      endHalf: true,
      days: true,
      reason: true,
      leaveType: { select: { name: true, code: true } },
    },
  },
  regularization: {
    select: { date: true, requestedClockIn: true, requestedClockOut: true, reason: true },
  },
} satisfies Prisma.RequestSelect;

type Row = Prisma.RequestGetPayload<{ select: typeof requestSelect }>;
const nameOf = (p: { firstName: string; lastName: string; preferredName: string | null }) =>
  `${p.preferredName ?? p.firstName} ${p.lastName}`;

async function shape(r: Row) {
  const tz = r.requester.location.timezone;
  const original =
    r.regularization &&
    (await db.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId: r.requester.id, date: r.regularization.date } },
      select: { clockInAt: true, clockOutAt: true },
    }));
  return {
    id: r.id,
    type: r.type,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    decidedAt: r.status === "PENDING" ? null : r.updatedAt.toISOString(),
    requester: {
      id: r.requester.id,
      name: nameOf(r.requester),
      title: r.requester.designation.title,
      avatarUrl: r.requester.avatarUrl,
    },
    steps: r.steps.map((s) => ({
      level: s.level,
      status: s.status,
      comment: s.comment,
      decidedAt: s.decidedAt?.toISOString() ?? null,
      approver: nameOf(s.approver),
      approverId: s.approver.id,
    })),
    leave: r.leave
      ? {
          type: r.leave.leaveType.name,
          code: r.leave.leaveType.code,
          start: isoFromDbDate(r.leave.startDate),
          end: isoFromDbDate(r.leave.endDate),
          startHalf: r.leave.startHalf,
          endHalf: r.leave.endHalf,
          days: Number(r.leave.days),
          reason: r.leave.reason,
        }
      : null,
    correction: r.regularization
      ? {
          date: isoFromDbDate(r.regularization.date),
          from: {
            in: original?.clockInAt ? clockTime(original.clockInAt, tz) : null,
            out: original?.clockOutAt ? clockTime(original.clockOutAt, tz) : null,
          },
          to: {
            in: r.regularization.requestedClockIn
              ? clockTime(r.regularization.requestedClockIn, tz)
              : null,
            out: r.regularization.requestedClockOut
              ? clockTime(r.regularization.requestedClockOut, tz)
              : null,
          },
          reason: r.regularization.reason,
        }
      : null,
  };
}

export type InboxItem = Awaited<ReturnType<typeof shape>> & {
  conflicts: { name: string; days: number }[];
  holidaysInside: string[];
};

/**
 * Requests waiting on this person, plus (for HR and admins) everything else
 * that's pending. Each leave request comes with who else is away then.
 */
export async function inbox(user: CurrentUser, view: "mine" | "all") {
  const me = user.employee?.id;
  const everyone = scopeFor(actorOf(user), "leave.approve") === "all";
  const where: Prisma.RequestWhereInput =
    view === "all" && everyone
      ? { status: "PENDING", requesterId: { not: me ?? "" } }
      : { status: "PENDING", steps: { some: { status: "PENDING", approverId: me ?? "-" } } };
  const rows = await db.request.findMany({
    where,
    orderBy: { createdAt: "asc" },
    select: requestSelect,
    take: 100,
  });
  const items: InboxItem[] = [];
  for (const r of rows) {
    const base = await shape(r);
    let conflicts: InboxItem["conflicts"] = [];
    let holidaysInside: string[] = [];
    if (base.leave) {
      const away = await teamAbsences(r.requester.id, base.leave.start, base.leave.end);
      const tally = new Map<string, number>();
      for (const list of away.values())
        for (const a of list)
          if (!a.pending) tally.set(a.name, (tally.get(a.name) ?? 0) + a.portion);
      conflicts = [...tally].map(([name, days]) => ({ name, days }));
      holidaysInside = (await holidaysFor(r.requester.locationId, base.leave.start, base.leave.end))
        .filter((h) => !h.optional)
        .map((h) => h.name);
    }
    items.push({ ...base, conflicts, holidaysInside });
  }
  const counts = {
    mine: me
      ? await db.approvalStep.count({
          where: { status: "PENDING", approverId: me, request: { status: "PENDING" } },
        })
      : 0,
    all: everyone
      ? await db.request.count({ where: { status: "PENDING", requesterId: { not: me ?? "" } } })
      : null,
  };
  return { items, counts };
}

/** What this person decided recently, for the "Done" tab. */
export async function recentDecisions(user: CurrentUser) {
  const me = user.employee?.id;
  if (!me) return [];
  const rows = await db.request.findMany({
    where: { steps: { some: { approverId: me, status: { in: ["APPROVED", "REJECTED"] } } } },
    orderBy: { updatedAt: "desc" },
    take: 15,
    select: requestSelect,
  });
  return Promise.all(rows.map(shape));
}

/** Badge count for navigation. */
export async function pendingCount(user: CurrentUser) {
  const me = user.employee?.id;
  if (!me) return 0;
  return db.approvalStep.count({
    where: { status: "PENDING", approverId: me, request: { status: "PENDING" } },
  });
}

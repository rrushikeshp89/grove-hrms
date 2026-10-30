import "server-only";

import { holidaysFor, workCalendar, workContext } from "@/features/time/calendar";
import { db, type Prisma } from "@/lib/db";
import {
  addDays,
  dbDate,
  eachDay,
  isoFromDbDate,
  monthBounds,
  todayIn,
  type ISODate,
} from "@/lib/tz";
import { visibleEmployeeIds } from "@/server/authz";
import type { CurrentUser } from "@/server/session";

import { accrued, summarize, type BalanceSummary, type Policy } from "./logic/balance";
import { leaveDayParts } from "./logic/days";

type Client = Prisma.TransactionClient;

const ACTIVE_REQUEST = { in: ["PENDING", "APPROVED"] as ("PENDING" | "APPROVED")[] };

export async function leaveTypes(client: Client = db) {
  const types = await client.leaveType.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: { policies: true },
  });
  return types;
}

function policyFor(
  type: Awaited<ReturnType<typeof leaveTypes>>[number],
  employee: { locationId: string; employmentType: string },
): Policy | null {
  // Most specific policy wins: location + type, then either, then the default.
  const score = (p: (typeof type.policies)[number]) =>
    (p.locationId === employee.locationId ? 2 : p.locationId ? -10 : 0) +
    (p.employmentType === employee.employmentType ? 1 : p.employmentType ? -10 : 0);
  const best = [...type.policies].sort((a, b) => score(b) - score(a))[0];
  if (!best || score(best) < 0) return null;
  return {
    annualQuota: Number(best.annualQuota),
    accrual: best.accrual,
    carryForwardMax: Number(best.carryForwardMax),
    proRataOnJoin: best.proRataOnJoin,
  };
}

export type BalanceRow = {
  typeId: string;
  code: string;
  name: string;
  colorToken: string;
  description: string | null;
  isPaid: boolean;
  allowHalfDay: boolean;
  minNoticeDays: number;
  maxConsecutiveDays: number | null;
  approvalLevels: number;
  quota: number;
  summary: BalanceSummary;
};

/** Every leave type with this person's balance for the year. */
export async function balancesFor(
  employeeId: string,
  year: number,
  client: Client = db,
): Promise<BalanceRow[]> {
  const [employee, types, ledger] = await Promise.all([
    client.employee.findUniqueOrThrow({
      where: { id: employeeId },
      select: { joinDate: true, locationId: true, employmentType: true },
    }),
    leaveTypes(client),
    client.leaveLedgerEntry.groupBy({
      by: ["leaveTypeId", "kind"],
      where: { employeeId, year },
      _sum: { days: true },
    }),
  ]);
  const asOf = todayIn();
  const joinDate = isoFromDbDate(employee.joinDate);
  return types.flatMap((t) => {
    const policy = policyFor(t, employee);
    if (!policy) return [];
    const entries = ledger
      .filter((l) => l.leaveTypeId === t.id)
      .map((l) => ({ kind: l.kind, days: Number(l._sum.days ?? 0) }));
    return [
      {
        typeId: t.id,
        code: t.code,
        name: t.name,
        colorToken: t.colorToken,
        description: t.description,
        isPaid: t.isPaid,
        allowHalfDay: t.allowHalfDay,
        minNoticeDays: t.minNoticeDays,
        maxConsecutiveDays: t.maxConsecutiveDays,
        approvalLevels: t.approvalLevels,
        quota: policy.annualQuota,
        summary: summarize(accrued(policy, joinDate, year, asOf), entries),
      },
    ];
  });
}

const stepSelect = {
  level: true,
  status: true,
  comment: true,
  decidedAt: true,
  approver: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
} satisfies Prisma.ApprovalStepSelect;

export async function myLeaveRequests(employeeId: string) {
  const rows = await db.request.findMany({
    where: { requesterId: employeeId, type: "LEAVE" },
    orderBy: { leave: { startDate: "desc" } },
    take: 40,
    select: {
      id: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      leave: {
        select: {
          startDate: true,
          endDate: true,
          startHalf: true,
          endHalf: true,
          days: true,
          reason: true,
          leaveType: { select: { name: true, code: true, colorToken: true } },
        },
      },
      steps: { orderBy: { level: "asc" }, select: stepSelect },
    },
  });
  return rows.flatMap((r) =>
    r.leave
      ? [
          {
            id: r.id,
            status: r.status,
            createdAt: r.createdAt.toISOString(),
            decidedAt: r.status === "PENDING" ? null : r.updatedAt.toISOString(),
            start: isoFromDbDate(r.leave.startDate),
            end: isoFromDbDate(r.leave.endDate),
            startHalf: r.leave.startHalf,
            endHalf: r.leave.endHalf,
            days: Number(r.leave.days),
            reason: r.leave.reason,
            type: r.leave.leaveType,
            steps: r.steps.map((s) => ({
              level: s.level,
              status: s.status,
              comment: s.comment,
              decidedAt: s.decidedAt?.toISOString() ?? null,
              approver: `${s.approver.preferredName ?? s.approver.firstName} ${s.approver.lastName}`,
            })),
          },
        ]
      : [],
  );
}

export type MyLeaveRequest = Awaited<ReturnType<typeof myLeaveRequests>>[number];

/**
 * The people whose absence matters when planning leave: same manager,
 * direct reports, and the manager. Returns who is away on which days.
 */
export async function teamAbsences(employeeId: string, start: ISODate, end: ISODate) {
  const me = await db.employee.findUniqueOrThrow({
    where: { id: employeeId },
    select: { managerId: true },
  });
  const people = await db.employee.findMany({
    where: {
      id: { not: employeeId },
      status: { not: "EXITED" },
      OR: [
        ...(me.managerId ? [{ managerId: me.managerId }, { id: me.managerId }] : []),
        { managerId: employeeId },
      ],
    },
    select: { id: true, firstName: true, lastName: true, preferredName: true },
  });
  return absencesFor(people, start, end);
}

async function absencesFor(
  people: { id: string; firstName: string; lastName: string; preferredName: string | null }[],
  start: ISODate,
  end: ISODate,
) {
  const requests = await db.leaveRequest.findMany({
    where: {
      request: { requesterId: { in: people.map((p) => p.id) }, status: ACTIVE_REQUEST },
      startDate: { lte: dbDate(end) },
      endDate: { gte: dbDate(start) },
    },
    select: {
      startDate: true,
      endDate: true,
      startHalf: true,
      endHalf: true,
      request: { select: { requesterId: true, status: true } },
      leaveType: { select: { name: true } },
    },
  });
  const name = new Map(
    people.map((p) => [p.id, `${p.preferredName ?? p.firstName} ${p.lastName}`]),
  );
  const byDay = new Map<
    ISODate,
    { personId: string; name: string; type: string; pending: boolean; portion: number }[]
  >();
  const calendar = { workDays: [1, 2, 3, 4, 5], holidays: new Set<string>() };
  for (const r of requests) {
    const parts = leaveDayParts(
      {
        start: isoFromDbDate(r.startDate),
        end: isoFromDbDate(r.endDate),
        startHalf: r.startHalf,
        endHalf: r.endHalf,
      },
      calendar,
    );
    for (const p of parts) {
      if (p.day < start || p.day > end) continue;
      const list = byDay.get(p.day) ?? [];
      list.push({
        personId: r.request.requesterId,
        name: name.get(r.request.requesterId) ?? "Someone",
        type: r.leaveType.name,
        pending: r.request.status === "PENDING",
        portion: p.portion,
      });
      byDay.set(p.day, list);
    }
  }
  return byDay;
}

/** Everything the apply sheet needs to preview a request on the client. */
export async function applyContext(employeeId: string) {
  const ctx = await workContext(employeeId);
  const today = todayIn(ctx.tz);
  const until = addDays(today, 180);
  const [holidays, absences] = await Promise.all([
    holidaysFor(ctx.locationId, addDays(today, -14), until),
    teamAbsences(employeeId, addDays(today, -14), until),
  ]);
  return {
    today,
    workDays: ctx.workDays,
    holidays: holidays.filter((h) => !h.optional).map((h) => ({ day: h.day, name: h.name })),
    conflicts: [...absences].map(([day, people]) => ({ day, names: people.map((p) => p.name) })),
  };
}

export type ApplyContext = Awaited<ReturnType<typeof applyContext>>;

/** Month grid of who's away, scoped to what the viewer may see. */
export async function teamCalendar(
  user: CurrentUser,
  year: number,
  month: number,
  departmentCode: string | null,
) {
  const { start, end } = monthBounds(year, month);
  const self = user.employee?.id ?? null;
  const visible = await visibleEmployeeIds(user, "leave.read");
  const me = self
    ? await db.employee.findUnique({
        where: { id: self },
        select: { managerId: true, locationId: true },
      })
    : null;

  // Employees see the team they work in; managers their org; HR everyone
  // (optionally one department).
  const where: Prisma.EmployeeWhereInput =
    visible === "all"
      ? departmentCode
        ? { department: { code: departmentCode } }
        : {}
      : {
          OR: [
            { id: { in: visible } },
            ...(me?.managerId ? [{ managerId: me.managerId }, { id: me.managerId }] : []),
          ],
        };
  const people = await db.employee.findMany({
    where: { ...where, status: { not: "EXITED" } },
    orderBy: [{ firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      preferredName: true,
      avatarUrl: true,
      designation: { select: { title: true } },
    },
  });
  const [absences, holidays] = await Promise.all([
    absencesFor(people, start, end),
    holidaysFor(me?.locationId ?? "", start, end),
  ]);
  const away = new Map<string, Map<ISODate, { type: string; pending: boolean; portion: number }>>();
  for (const [day, list] of absences) {
    for (const a of list) {
      const m = away.get(a.personId) ?? new Map();
      m.set(day, { type: a.type, pending: a.pending, portion: a.portion });
      away.set(a.personId, m);
    }
  }
  return {
    start,
    end,
    days: eachDay(start, end),
    holidays: holidays.map((h) => ({ day: h.day, name: h.name, optional: h.optional })),
    people: people
      .map((p) => ({
        id: p.id,
        name: `${p.preferredName ?? p.firstName} ${p.lastName}`,
        title: p.designation.title,
        avatarUrl: p.avatarUrl,
        away: Object.fromEntries(away.get(p.id) ?? []),
      }))
      // People with leave this month first, then everyone else.
      .sort(
        (a, b) => Number(Object.keys(b.away).length > 0) - Number(Object.keys(a.away).length > 0),
      ),
    canFilterDepartments: visible === "all",
  };
}

export { workCalendar };

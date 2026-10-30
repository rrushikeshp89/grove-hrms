import "server-only";

import { leaveDayParts } from "@/features/leave/logic/days";
import { holidaysFor, workCalendar, workContext } from "@/features/time/calendar";
import { db, type Prisma } from "@/lib/db";
import { dbDate, isoFromDbDate, monthBounds, todayIn, type ISODate } from "@/lib/tz";
import { visibleEmployeeIds } from "@/server/authz";
import type { CurrentUser } from "@/server/session";

import { buildTimesheet, summarizeTimesheet, type DayRecord } from "./logic/timesheet";

/** Approved (and pending) leave per day for some people in a window. */
async function leaveByDay(
  employeeIds: string[],
  start: ISODate,
  end: ISODate,
  cal: { workDays: readonly number[]; holidays: ReadonlySet<string> },
) {
  const rows = await db.leaveRequest.findMany({
    where: {
      request: { requesterId: { in: employeeIds }, status: "APPROVED" },
      startDate: { lte: dbDate(end) },
      endDate: { gte: dbDate(start) },
    },
    select: {
      startDate: true,
      endDate: true,
      startHalf: true,
      endHalf: true,
      request: { select: { requesterId: true } },
      leaveType: { select: { name: true } },
    },
  });
  const out = new Map<string, Map<ISODate, { type: string; portion: number }>>();
  for (const r of rows) {
    const m = out.get(r.request.requesterId) ?? new Map();
    for (const p of leaveDayParts(
      {
        start: isoFromDbDate(r.startDate),
        end: isoFromDbDate(r.endDate),
        startHalf: r.startHalf,
        endHalf: r.endHalf,
      },
      cal,
    )) {
      if (p.day >= start && p.day <= end)
        m.set(p.day, { type: r.leaveType.name, portion: p.portion });
    }
    out.set(r.request.requesterId, m);
  }
  return out;
}

const toRecord = (r: {
  clockInAt: Date | null;
  clockOutAt: Date | null;
  status: DayRecord["status"];
  workedMinutes: number;
  lateByMinutes: number;
  earlyByMinutes: number;
}): DayRecord => ({
  clockInAt: r.clockInAt,
  clockOutAt: r.clockOutAt,
  status: r.status,
  workedMinutes: r.workedMinutes,
  lateByMinutes: r.lateByMinutes,
  earlyByMinutes: r.earlyByMinutes,
});

export async function myTimesheet(employeeId: string, year: number, month: number) {
  const ctx = await workContext(employeeId);
  const today = todayIn(ctx.tz);
  const { start, end } = monthBounds(year, month);
  const [records, holidays, cal, corrections] = await Promise.all([
    db.attendanceRecord.findMany({
      where: { employeeId, date: { gte: dbDate(start), lte: dbDate(end) } },
    }),
    holidaysFor(ctx.locationId, start, end),
    workCalendar(ctx, start, end),
    db.regularizationRequest.findMany({
      where: {
        date: { gte: dbDate(start), lte: dbDate(end) },
        request: { requesterId: employeeId },
      },
      select: { date: true, request: { select: { status: true, updatedAt: true } } },
      orderBy: { request: { createdAt: "asc" } },
    }),
  ]);
  const leave = (await leaveByDay([employeeId], start, end, cal)).get(employeeId) ?? new Map();
  const days = buildTimesheet({
    start,
    end,
    today,
    joinDate: ctx.joinDate,
    workDays: ctx.workDays,
    holidays: new Map(holidays.filter((h) => !h.optional).map((h) => [h.day, h.name])),
    leave,
    records: new Map(records.map((r) => [isoFromDbDate(r.date), toRecord(r)])),
  });
  const correctionByDay = new Map(
    corrections.map((c) => [isoFromDbDate(c.date), c.request.status]),
  );
  return {
    today,
    tz: ctx.tz,
    schedule: ctx.schedule,
    joinDate: ctx.joinDate,
    summary: summarizeTimesheet(days),
    days: days.map((d) => ({
      day: d.day,
      kind: d.kind,
      holiday: d.holiday,
      leave: d.leave,
      clockInAt: d.record?.clockInAt?.toISOString() ?? null,
      clockOutAt: d.record?.clockOutAt?.toISOString() ?? null,
      workedMinutes: d.record?.workedMinutes ?? 0,
      lateByMinutes: d.record?.lateByMinutes ?? 0,
      earlyByMinutes: d.record?.earlyByMinutes ?? 0,
      correction: correctionByDay.get(d.day) ?? null,
    })),
  };
}

export type Timesheet = Awaited<ReturnType<typeof myTimesheet>>;
export type TimesheetRow = Timesheet["days"][number];

/** Today's state for the clock card. */
export async function myToday(employeeId: string) {
  const ctx = await workContext(employeeId);
  const today = todayIn(ctx.tz);
  const [record, holidays, cal] = await Promise.all([
    db.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId, date: dbDate(today) } },
    }),
    holidaysFor(ctx.locationId, today, today),
    workCalendar(ctx, today, today),
  ]);
  const leave =
    (await leaveByDay([employeeId], today, today, cal)).get(employeeId)?.get(today) ?? null;
  return {
    today,
    tz: ctx.tz,
    schedule: ctx.schedule,
    workDay: ctx.workDays.includes(new Date(`${today}T00:00:00Z`).getUTCDay() || 7),
    holiday: holidays.find((h) => !h.optional)?.name ?? null,
    leave,
    clockInAt: record?.clockInAt?.toISOString() ?? null,
    clockOutAt: record?.clockOutAt?.toISOString() ?? null,
    lateByMinutes: record?.lateByMinutes ?? 0,
    workedMinutes: record?.workedMinutes ?? 0,
  };
}

export type TodayState = Awaited<ReturnType<typeof myToday>>;

/** The manager's view of the day: who's in, who's late, who's away. */
export async function teamToday(user: CurrentUser, departmentCode: string | null) {
  const visible = await visibleEmployeeIds(user, "attendance.read");
  const self = user.employee?.id;
  const where: Prisma.EmployeeWhereInput =
    visible === "all"
      ? departmentCode
        ? { department: { code: departmentCode } }
        : {}
      : { id: { in: visible.filter((id) => id !== self) } };
  const people = await db.employee.findMany({
    where: { ...where, status: { not: "EXITED" } },
    orderBy: { firstName: "asc" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      preferredName: true,
      avatarUrl: true,
      joinDate: true,
      locationId: true,
      designation: { select: { title: true } },
      department: { select: { name: true } },
      location: { select: { isRemote: true } },
    },
  });
  const ctx = self ? await workContext(self) : null;
  const today = todayIn(ctx?.tz);
  const [records, holidays] = await Promise.all([
    db.attendanceRecord.findMany({
      where: { employeeId: { in: people.map((p) => p.id) }, date: dbDate(today) },
    }),
    db.holiday.findMany({
      where: { date: dbDate(today), isOptional: false },
      select: { name: true, locationId: true },
    }),
  ]);
  const leave = await leaveByDay(
    people.map((p) => p.id),
    today,
    today,
    { workDays: [1, 2, 3, 4, 5, 6, 7], holidays: new Set() },
  );
  const recordBy = new Map(records.map((r) => [r.employeeId, r]));
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  const weekend = weekday === 0 || weekday === 6;

  const rows = people.map((p) => {
    const r = recordBy.get(p.id);
    const l = leave.get(p.id)?.get(today) ?? null;
    const holiday =
      holidays.find((h) => !h.locationId || h.locationId === p.locationId)?.name ?? null;
    const state: "in" | "late" | "out" | "leave" | "away" | "notYet" = r?.clockOutAt
      ? "out"
      : r?.clockInAt
        ? r.lateByMinutes
          ? "late"
          : "in"
        : l?.portion === 1
          ? "leave"
          : holiday || weekend
            ? "away"
            : "notYet";
    return {
      id: p.id,
      name: `${p.preferredName ?? p.firstName} ${p.lastName}`,
      title: p.designation.title,
      department: p.department.name,
      avatarUrl: p.avatarUrl,
      remote: p.location.isRemote,
      state,
      clockInAt: r?.clockInAt?.toISOString() ?? null,
      clockOutAt: r?.clockOutAt?.toISOString() ?? null,
      lateByMinutes: r?.lateByMinutes ?? 0,
      leave: l,
      holiday,
    };
  });
  const order = { late: 0, notYet: 1, in: 2, out: 3, leave: 4, away: 5 } as const;
  rows.sort((a, b) => order[a.state] - order[b.state] || a.name.localeCompare(b.name));
  return { today, tz: ctx?.tz, rows, canFilterDepartments: visible === "all" };
}

export type TeamTodayRow = Awaited<ReturnType<typeof teamToday>>["rows"][number];

import "server-only";

import type { WorkCalendar } from "@/features/leave/logic/days";
import { db, type Prisma } from "@/lib/db";
import { COMPANY_TZ, dbDate, isoFromDbDate, type ISODate } from "@/lib/tz";

type Client = Prisma.TransactionClient;

const FALLBACK_SCHEDULE = {
  startTime: "09:30",
  endTime: "18:30",
  graceMinutes: 15,
  workDays: [1, 2, 3, 4, 5],
};

/** Everything time logic needs to know about where and when someone works. */
export async function workContext(employeeId: string, client: Client = db) {
  const e = await client.employee.findUniqueOrThrow({
    where: { id: employeeId },
    select: {
      id: true,
      joinDate: true,
      managerId: true,
      locationId: true,
      location: { select: { timezone: true, workSchedule: true } },
    },
  });
  const s = e.location.workSchedule ?? FALLBACK_SCHEDULE;
  return {
    employeeId: e.id,
    managerId: e.managerId,
    locationId: e.locationId,
    joinDate: isoFromDbDate(e.joinDate),
    tz: e.location.timezone || COMPANY_TZ,
    schedule: { startTime: s.startTime, endTime: s.endTime, graceMinutes: s.graceMinutes },
    workDays: s.workDays,
  };
}

export type WorkContext = Awaited<ReturnType<typeof workContext>>;

/** Holidays for a location (company-wide ones included), keyed by day. */
export async function holidaysFor(
  locationId: string,
  start: ISODate,
  end: ISODate,
  client: Client = db,
): Promise<{ id: string; day: ISODate; name: string; optional: boolean }[]> {
  const rows = await client.holiday.findMany({
    where: {
      date: { gte: dbDate(start), lte: dbDate(end) },
      OR: [{ locationId: null }, { locationId }],
    },
    orderBy: { date: "asc" },
    select: { id: true, date: true, name: true, isOptional: true },
  });
  return rows.map((h) => ({
    id: h.id,
    day: isoFromDbDate(h.date),
    name: h.name,
    optional: h.isOptional,
  }));
}

/** Working-day calendar for leave counting: optional holidays still count as work days. */
export async function workCalendar(
  ctx: WorkContext,
  start: ISODate,
  end: ISODate,
  client: Client = db,
): Promise<WorkCalendar> {
  const holidays = await holidaysFor(ctx.locationId, start, end, client);
  return {
    workDays: ctx.workDays,
    holidays: new Set(holidays.filter((h) => !h.optional).map((h) => h.day)),
  };
}

/**
 * Who approves at HR level: the most senior HR manager with an employee
 * record. Seeded as the Head of People.
 */
export async function hrApproverId(client: Client = db): Promise<string> {
  const hr = await client.employee.findFirst({
    where: { status: { not: "EXITED" }, user: { role: "HR_MANAGER" } },
    orderBy: [{ designation: { level: "desc" } }, { joinDate: "asc" }],
    select: { id: true },
  });
  if (!hr) throw new Error("No HR manager is set up to approve requests.");
  return hr.id;
}

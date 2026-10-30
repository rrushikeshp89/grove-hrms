import { leaveDayParts } from "@/features/leave/logic/days";
import type { Prisma } from "@/generated/prisma/client";
import { dbDate, isoFromDbDate, monthBounds, todayIn, type ISODate } from "@/lib/tz";

import { computePayslip, lossOfPay, type Component, type DayRecordLite } from "./logic/compute";

/** Just the tables payslips are built from, so both the app and the seed can pass their client. */
type Client = Pick<
  Prisma.TransactionClient,
  "employee" | "attendanceRecord" | "leaveRequest" | "holiday"
>;

/**
 * Builds one payslip for everyone who was employed during the month and has
 * a salary structure in force. Reads attendance, approved leave and holidays
 * in bulk, then runs the same pure maths the tests cover.
 */
/**
 * Not marked server-only: the seed builds historical runs with it too.
 */
export async function buildPayslips(client: Client, year: number, month: number) {
  const { start, end } = monthBounds(year, month);
  const today = todayIn();

  const people = await client.employee.findMany({
    where: {
      joinDate: { lte: dbDate(end) },
      OR: [{ exitDate: null }, { exitDate: { gte: dbDate(start) } }],
    },
    select: {
      id: true,
      joinDate: true,
      exitDate: true,
      locationId: true,
      location: { select: { workSchedule: { select: { workDays: true } } } },
      salaryStructures: {
        where: { effectiveFrom: { lte: dbDate(end) } },
        orderBy: { effectiveFrom: "desc" },
        take: 1,
        select: { currency: true, components: true },
      },
    },
  });
  const ids = people.map((p) => p.id);

  const [records, leaves, holidays] = await Promise.all([
    client.attendanceRecord.findMany({
      where: { employeeId: { in: ids }, date: { gte: dbDate(start), lte: dbDate(end) } },
      select: { employeeId: true, date: true, status: true },
    }),
    client.leaveRequest.findMany({
      where: {
        request: { requesterId: { in: ids }, status: "APPROVED" },
        startDate: { lte: dbDate(end) },
        endDate: { gte: dbDate(start) },
      },
      select: {
        startDate: true,
        endDate: true,
        startHalf: true,
        endHalf: true,
        request: { select: { requesterId: true } },
        leaveType: { select: { isPaid: true } },
      },
    }),
    client.holiday.findMany({
      where: { isOptional: false, date: { gte: dbDate(start), lte: dbDate(end) } },
      select: { date: true, locationId: true },
    }),
  ]);

  const recordsBy = new Map<string, Map<ISODate, DayRecordLite>>();
  for (const r of records) {
    const m = recordsBy.get(r.employeeId) ?? new Map();
    m.set(isoFromDbDate(r.date), { status: r.status });
    recordsBy.set(r.employeeId, m);
  }
  const holidaysFor = (locationId: string) =>
    new Set(
      holidays
        .filter((h) => !h.locationId || h.locationId === locationId)
        .map((h) => isoFromDbDate(h.date)),
    );
  const leaveBy = new Map<string, Map<ISODate, { portion: number; paid: boolean }>>();
  const person = new Map(people.map((p) => [p.id, p]));
  for (const l of leaves) {
    const id = l.request.requesterId;
    const p = person.get(id);
    if (!p) continue;
    const workDays = p.location.workSchedule?.workDays ?? [1, 2, 3, 4, 5];
    const m = leaveBy.get(id) ?? new Map();
    for (const part of leaveDayParts(
      {
        start: isoFromDbDate(l.startDate),
        end: isoFromDbDate(l.endDate),
        startHalf: l.startHalf,
        endHalf: l.endHalf,
      },
      { workDays, holidays: holidaysFor(p.locationId) },
    )) {
      if (part.day >= start && part.day <= end)
        m.set(part.day, { portion: part.portion, paid: l.leaveType.isPaid });
    }
    leaveBy.set(id, m);
  }

  const slips = [];
  for (const p of people) {
    const structure = p.salaryStructures[0];
    if (!structure) continue;
    const components: Component[] = structure.components.map((c) => ({
      name: c.name,
      kind: c.kind,
      calc: c.calc,
      amountMinor: c.amountMinor,
      percentBps: c.percentBps,
      sortOrder: c.sortOrder,
    }));
    const { workingDays, lop } = lossOfPay({
      start,
      end,
      today,
      workDays: p.location.workSchedule?.workDays ?? [1, 2, 3, 4, 5],
      holidays: holidaysFor(p.locationId),
      employedFrom: isoFromDbDate(p.joinDate),
      employedTo: p.exitDate ? isoFromDbDate(p.exitDate) : null,
      records: recordsBy.get(p.id) ?? new Map(),
      leave: leaveBy.get(p.id) ?? new Map(),
    });
    const slip = computePayslip({ components, workingDays, lopDays: lop });
    slips.push({
      employeeId: p.id,
      workingDays: slip.workingDays,
      paidDays: slip.paidDays,
      lopDays: slip.lopDays,
      grossMinor: slip.grossMinor,
      deductionsMinor: slip.deductionsMinor,
      netMinor: slip.netMinor,
      currency: structure.currency,
      lines: slip.lines,
    });
  }
  return slips;
}

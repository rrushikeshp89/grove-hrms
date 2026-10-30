import "server-only";

import { db } from "@/lib/db";
import { isoFromDbDate } from "@/lib/tz";

export async function companySettings() {
  const [company, schedule] = await Promise.all([
    db.company.findFirst({
      select: {
        id: true,
        name: true,
        legalName: true,
        defaultTimezone: true,
        currency: true,
        fiscalYearStartMonth: true,
      },
    }),
    db.workSchedule.findFirst({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        startTime: true,
        endTime: true,
        graceMinutes: true,
        workDays: true,
        locations: { select: { name: true } },
      },
    }),
  ]);
  return { company, schedule };
}

export async function leaveSetup() {
  const rows = await db.leaveType.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: {
      policies: { orderBy: { createdAt: "asc" } },
      _count: { select: { requests: true } },
    },
  });
  return rows.map((t) => {
    const p = t.policies.find((x) => !x.locationId && !x.employmentType) ?? t.policies[0];
    return {
      id: t.id,
      name: t.name,
      code: t.code,
      colorToken: t.colorToken,
      description: t.description,
      isPaid: t.isPaid,
      allowHalfDay: t.allowHalfDay,
      approvalLevels: t.approvalLevels as 1 | 2,
      maxConsecutiveDays: t.maxConsecutiveDays,
      minNoticeDays: t.minNoticeDays,
      requiresDocumentAfterDays: t.requiresDocumentAfterDays,
      isActive: t.isActive,
      requests: t._count.requests,
      policy: p
        ? {
            annualQuota: Number(p.annualQuota),
            accrual: p.accrual as "UPFRONT" | "MONTHLY",
            carryForwardMax: Number(p.carryForwardMax),
            proRataOnJoin: p.proRataOnJoin,
          }
        : { annualQuota: 0, accrual: "MONTHLY" as const, carryForwardMax: 0, proRataOnJoin: true },
    };
  });
}

export type LeaveTypeRow = Awaited<ReturnType<typeof leaveSetup>>[number];

export async function holidaysAdmin(year: number, locationId: string | null) {
  const [rows, locations, years] = await Promise.all([
    db.holiday.findMany({
      where: {
        date: {
          gte: new Date(`${year}-01-01T00:00:00Z`),
          lte: new Date(`${year}-12-31T00:00:00Z`),
        },
        ...(locationId ? { OR: [{ locationId: null }, { locationId }] } : {}),
      },
      orderBy: [{ date: "asc" }, { name: "asc" }],
      include: { location: { select: { name: true } } },
    }),
    db.location.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.holiday.findMany({ distinct: ["date"], select: { date: true } }),
  ]);
  const thisYear = new Date().getUTCFullYear();
  const availableYears = [
    ...new Set([thisYear, thisYear + 1, ...years.map((y) => y.date.getUTCFullYear())]),
  ].sort();
  return {
    locations,
    years: availableYears,
    holidays: rows.map((h) => ({
      id: h.id,
      name: h.name,
      date: isoFromDbDate(h.date),
      locationId: h.locationId,
      location: h.location?.name ?? null,
      isOptional: h.isOptional,
    })),
  };
}

export type HolidayRow = Awaited<ReturnType<typeof holidaysAdmin>>["holidays"][number];

/** Everyone with a sign-in, for the roles table. */
export async function rolePeople() {
  const rows = await db.user.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isDemo: true,
      employee: {
        select: { avatarUrl: true, designation: { select: { title: true } }, status: true },
      },
    },
  });
  return rows
    .filter((u) => u.employee?.status !== "EXITED")
    .map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      isDemo: u.isDemo,
      avatarUrl: u.employee?.avatarUrl ?? null,
      title: u.employee?.designation.title ?? null,
    }));
}

export type RolePerson = Awaited<ReturnType<typeof rolePeople>>[number];

import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { leaveDayParts, type WorkCalendar } from "@/features/leave/logic/days";
import { db, type Prisma } from "@/lib/db";
import { addDays, dbDate, isoFromDbDate, type ISODate } from "@/lib/tz";

import {
  arrivalGrid,
  attrition,
  funnelCounts,
  furthestStage,
  headcountOn,
  headcountSeries,
  leaveByBucket,
  median,
  monthsBetween,
  type Stage,
} from "./logic/metrics";
import { bucketIndex, bucketsFor } from "./logic/range";

/**
 * Company-wide reports. None of these read the session: callers check
 * `analytics.read` first and pass plain filters, which also makes each
 * result safe to cache across viewers for a few minutes.
 */
export type Filters = { start: ISODate; end: ISODate; department: string | null };

function cached() {
  cacheLife("minutes");
  cacheTag("analytics");
}

const inDepartment = (code: string | null): Prisma.EmployeeWhereInput =>
  code ? { department: { code } } : {};

/** The first day we have history for, so ranges can't wander into nothing. */
export async function dataStart(today: ISODate): Promise<ISODate> {
  "use cache";
  cached();
  const first = await db.attendanceRecord.findFirst({
    orderBy: { date: "asc" },
    select: { date: true },
  });
  return first ? isoFromDbDate(first.date) : addDays(today, -365);
}

export async function departmentOptions() {
  "use cache";
  cached();
  return db.department.findMany({ orderBy: { name: "asc" }, select: { code: true, name: true } });
}

/* ─── People: headcount, departments, attrition ────────────────────────── */

export async function peopleReport(f: Filters) {
  "use cache";
  cached();
  const rows = await db.employee.findMany({
    where: inDepartment(f.department),
    select: {
      joinDate: true,
      exitDate: true,
      exitReason: true,
      employmentType: true,
      department: { select: { code: true, name: true } },
      designation: { select: { title: true } },
      location: { select: { isRemote: true } },
    },
  });
  const people = rows.map((r) => ({
    ...r,
    joinDate: isoFromDbDate(r.joinDate),
    exitDate: r.exitDate ? isoFromDbDate(r.exitDate) : null,
  }));
  const buckets = bucketsFor(f);
  const series = headcountSeries(people, buckets);
  const att = attrition(people, f);
  const employed = people.filter((p) => p.joinDate <= f.end && (!p.exitDate || p.exitDate > f.end));

  const count = <K extends string>(keyOf: (p: (typeof employed)[number]) => K) => {
    const m = new Map<K, number>();
    for (const p of employed) m.set(keyOf(p), (m.get(keyOf(p)) ?? 0) + 1);
    return [...m].map(([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value);
  };

  const leavers = people.filter((p) => p.exitDate && p.exitDate >= f.start && p.exitDate <= f.end);
  const reasons = new Map<string, number>();
  for (const l of leavers) {
    const r = l.exitReason ?? "Not recorded";
    reasons.set(r, (reasons.get(r) ?? 0) + 1);
  }

  // Attrition per bucket uses that bucket's own average headcount.
  const monthlyAttrition = buckets.map((b, i) => {
    const opening = headcountOn(people, addDays(b.start, -1));
    const avg = (opening + series[i]!.headcount) / 2;
    return {
      label: b.label,
      leavers: series[i]!.leavers,
      rate: avg ? series[i]!.leavers / avg : 0,
    };
  });

  return {
    series,
    attrition: att,
    monthlyAttrition,
    departments: count((p) => p.department.name),
    roles: count((p) => p.designation.title).slice(0, 8),
    employmentTypes: count((p) => p.employmentType),
    remote: employed.filter((p) => p.location.isRemote).length,
    joiners: series.reduce((s, p) => s + p.joiners, 0),
    reasons: [...reasons].map(([reason, n]) => ({ reason, n })).sort((a, b) => b.n - a.n),
    tenureAtExit: median(leavers.map((l) => monthsBetween(l.joinDate, l.exitDate!))),
  };
}

/* ─── Leave ────────────────────────────────────────────────────────────── */

export async function leaveReport(f: Filters) {
  "use cache";
  cached();
  const [types, requests, holidays, headcount] = await Promise.all([
    db.leaveType.findMany({
      orderBy: { name: "asc" },
      select: { code: true, name: true },
    }),
    db.leaveRequest.findMany({
      where: {
        request: { status: "APPROVED", requester: inDepartment(f.department) },
        startDate: { lte: dbDate(f.end) },
        endDate: { gte: dbDate(f.start) },
      },
      select: {
        startDate: true,
        endDate: true,
        startHalf: true,
        endHalf: true,
        leaveType: { select: { code: true } },
        request: {
          select: {
            requester: { select: { locationId: true, department: { select: { name: true } } } },
          },
        },
      },
    }),
    db.holiday.findMany({
      where: { isOptional: false, date: { gte: dbDate(f.start), lte: dbDate(f.end) } },
      select: { date: true, locationId: true },
    }),
    db.employee.groupBy({
      by: ["departmentId"],
      where: {
        ...inDepartment(f.department),
        joinDate: { lte: dbDate(f.end) },
        OR: [{ exitDate: null }, { exitDate: { gt: dbDate(f.end) } }],
      },
      _count: true,
    }),
  ]);

  const calendars = new Map<string | null, WorkCalendar>();
  const calendarFor = (locationId: string): WorkCalendar => {
    let cal = calendars.get(locationId);
    if (!cal) {
      cal = {
        workDays: [1, 2, 3, 4, 5],
        holidays: new Set(
          holidays
            .filter((h) => !h.locationId || h.locationId === locationId)
            .map((h) => isoFromDbDate(h.date)),
        ),
      };
      calendars.set(locationId, cal);
    }
    return cal;
  };

  const parts: { day: ISODate; code: string; portion: number }[] = [];
  const byDepartment = new Map<string, number>();
  for (const r of requests) {
    const requester = r.request.requester;
    for (const p of leaveDayParts(
      {
        start: isoFromDbDate(r.startDate),
        end: isoFromDbDate(r.endDate),
        startHalf: r.startHalf,
        endHalf: r.endHalf,
      },
      calendarFor(requester.locationId),
    )) {
      if (p.day < f.start || p.day > f.end) continue;
      parts.push({ day: p.day, code: r.leaveType.code, portion: p.portion });
      byDepartment.set(
        requester.department.name,
        (byDepartment.get(requester.department.name) ?? 0) + p.portion,
      );
    }
  }

  const totals = new Map<string, number>();
  for (const p of parts) totals.set(p.code, (totals.get(p.code) ?? 0) + p.portion);
  const used = types.filter((t) => totals.get(t.code));
  const departmentNames = await db.department.findMany({ select: { id: true, name: true } });
  const nameById = new Map(departmentNames.map((d) => [d.id, d.name]));
  const people = headcount.reduce((s, h) => s + h._count, 0);

  return {
    types: used.map((t) => ({ code: t.code, name: t.name, days: totals.get(t.code)! })),
    rows: leaveByBucket(
      parts,
      bucketsFor(f),
      used.map((t) => t.code),
    ),
    total: parts.reduce((s, p) => s + p.portion, 0),
    people,
    perDepartment: headcount
      .map((h) => {
        const name = nameById.get(h.departmentId)!;
        return { name, days: byDepartment.get(name) ?? 0, people: h._count };
      })
      .map((d) => ({ ...d, perPerson: d.people ? d.days / d.people : 0 }))
      .sort((a, b) => b.perPerson - a.perPerson),
  };
}

/* ─── Attendance ───────────────────────────────────────────────────────── */

// The company runs on IST, which has no daylight saving: a fixed offset is exact.
const IST_OFFSET_MINUTES = 330;

export async function attendanceReport(f: Filters) {
  "use cache";
  cached();
  const dept = f.department;
  const deptFilter = (alias: string) =>
    dept ? `AND ${alias}."departmentId" = (SELECT id FROM "Department" WHERE code = $3)` : "";
  const args: unknown[] = [dbDate(f.start), dbDate(f.end), ...(dept ? [dept] : [])];

  const [arrivals, days] = await Promise.all([
    db.$queryRawUnsafe<{ weekday: number; minute: number; count: number }[]>(
      `SELECT EXTRACT(ISODOW FROM a.date)::int AS weekday,
              (((EXTRACT(EPOCH FROM a."clockInAt") / 60)::int + ${IST_OFFSET_MINUTES}) % 1440) / 15 * 15 AS minute,
              COUNT(*)::int AS count
         FROM "AttendanceRecord" a
         JOIN "Employee" e ON e.id = a."employeeId"
        WHERE a.date BETWEEN $1 AND $2
          AND a."clockInAt" IS NOT NULL
          AND a.status IN ('PRESENT', 'LATE')
          ${deptFilter("e")}
        GROUP BY 1, 2`,
      ...args,
    ),
    db.$queryRawUnsafe<
      { date: Date; present: number; late: number; worked: number; arrival: number }[]
    >(
      `SELECT a.date,
              COUNT(*)::int AS present,
              COUNT(*) FILTER (WHERE a.status = 'LATE')::int AS late,
              COALESCE(AVG(a."workedMinutes") FILTER (WHERE a."clockOutAt" IS NOT NULL), 0)::float AS worked,
              AVG((((EXTRACT(EPOCH FROM a."clockInAt") / 60)::int + ${IST_OFFSET_MINUTES}) % 1440))::float AS arrival
         FROM "AttendanceRecord" a
         JOIN "Employee" e ON e.id = a."employeeId"
        WHERE a.date BETWEEN $1 AND $2
          AND a."clockInAt" IS NOT NULL
          AND a.status IN ('PRESENT', 'LATE')
          ${deptFilter("e")}
        GROUP BY a.date
        ORDER BY a.date`,
      ...args,
    ),
  ]);

  const buckets = bucketsFor(f);
  const trend = buckets.map((b) => ({ label: b.label, present: 0, late: 0, worked: 0, n: 0 }));
  let present = 0;
  let late = 0;
  let workedSum = 0;
  let arrivalSum = 0;
  for (const d of days) {
    const i = bucketIndex(buckets, isoFromDbDate(d.date));
    if (i < 0) continue;
    const t = trend[i]!;
    t.present += d.present;
    t.late += d.late;
    t.worked += d.worked * d.present;
    t.n += d.present;
    present += d.present;
    late += d.late;
    workedSum += d.worked * d.present;
    arrivalSum += d.arrival * d.present;
  }

  return {
    grid: arrivalGrid(arrivals, { from: 8 * 60 + 30, to: 10 * 60 + 15, step: 15 }),
    // Weekend-only buckets (a range starting on a Saturday) have nothing to say.
    trend: trend
      .filter((t) => t.present > 0)
      .map((t) => ({
        label: t.label,
        onTime: t.present ? (t.present - t.late) / t.present : 0,
        hours: t.n ? t.worked / t.n / 60 : 0,
      })),
    days: present,
    onTime: present ? (present - late) / present : 0,
    averageArrival: present ? arrivalSum / present : null,
    averageHours: present ? workedSum / present / 60 : null,
  };
}

/* ─── Hiring ───────────────────────────────────────────────────────────── */

export async function hiringReport(f: Filters) {
  "use cache";
  cached();
  const jobWhere: Prisma.JobPostingWhereInput = f.department
    ? { department: { code: f.department } }
    : {};
  const [candidates, open, hired] = await Promise.all([
    db.candidate.findMany({
      where: {
        job: jobWhere,
        createdAt: { gte: dbDate(f.start), lt: dbDate(addDays(f.end, 1)) },
      },
      select: { source: true, stageHistory: { select: { to: true } } },
    }),
    db.jobPosting.findMany({
      where: { ...jobWhere, status: "OPEN" },
      select: {
        openings: true,
        _count: { select: { candidates: { where: { stage: { notIn: ["HIRED", "REJECTED"] } } } } },
      },
    }),
    db.candidateStageEvent.findMany({
      where: {
        to: "HIRED",
        at: { gte: dbDate(f.start), lt: dbDate(addDays(f.end, 1)) },
        candidate: { job: jobWhere },
      },
      select: { at: true, candidate: { select: { createdAt: true, source: true } } },
    }),
  ]);

  const funnel = funnelCounts(
    candidates.map((c) => furthestStage(c.stageHistory.map((e) => e.to as Stage))),
  );
  const sources = new Map<string, { applied: number; hired: number }>();
  for (const c of candidates) {
    const s = sources.get(c.source) ?? { applied: 0, hired: 0 };
    s.applied++;
    sources.set(c.source, s);
  }
  for (const h of hired) {
    const s = sources.get(h.candidate.source) ?? { applied: 0, hired: 0 };
    s.hired++;
    sources.set(h.candidate.source, s);
  }

  return {
    funnel,
    sources: [...sources]
      .map(([source, v]) => ({ source, ...v }))
      .sort((a, b) => b.applied - a.applied),
    hires: hired.length,
    daysToHire: median(
      hired.map((h) => Math.round((h.at.getTime() - h.candidate.createdAt.getTime()) / 864e5)),
    ),
    openRoles: open.length,
    openings: open.reduce((s, j) => s + j.openings, 0),
    inPipeline: open.reduce((s, j) => s + j._count.candidates, 0),
  };
}

export type PeopleReport = Awaited<ReturnType<typeof peopleReport>>;
export type LeaveReport = Awaited<ReturnType<typeof leaveReport>>;
export type AttendanceReport = Awaited<ReturnType<typeof attendanceReport>>;
export type HiringReport = Awaited<ReturnType<typeof hiringReport>>;

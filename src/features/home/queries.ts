import "server-only";

import { parseRange } from "@/features/analytics/logic/range";
import { dataStart, hiringReport, peopleReport } from "@/features/analytics/queries";
import { waitingOnMe } from "@/features/approvals/queries";
import { myTimesheet, myToday, teamToday, type TeamTodayRow } from "@/features/attendance/queries";
import { balancesFor, myLeaveRequests } from "@/features/leave/queries";
import { latestForHome } from "@/features/announcements/queries";
import { myOpenTasks } from "@/features/lifecycle/queries";
import { myPayslips } from "@/features/payroll/queries";
import { myReviewTasks } from "@/features/performance/queries";
import { db } from "@/lib/db";
import { can, scopeFor } from "@/lib/rbac";
import { addDays, dbDate, isoFromDbDate, todayIn, type ISODate } from "@/lib/tz";
import { actorOf, type CurrentUser } from "@/server/session";

import { upcomingMoments } from "./logic/moments";

const personSelect = {
  id: true,
  firstName: true,
  lastName: true,
  preferredName: true,
  avatarUrl: true,
  status: true,
  joinDate: true,
  designation: { select: { title: true } },
} as const;

/** The everyday balances; the rest live on the Leave page. */
const PRIMARY_LEAVE = ["EL", "CL", "SL"];

/**
 * Everything the home screen shows, scoped to what this user may see. Each
 * block is only loaded for the roles that get it.
 */
export async function getHomeData(user: CurrentUser) {
  const actor = actorOf(user);
  const employeeId = user.employee?.id;
  const today = todayIn();

  const me = employeeId
    ? await db.employee.findUnique({
        where: { id: employeeId },
        select: {
          ...personSelect,
          locationId: true,
          manager: { select: personSelect },
          reports: {
            where: { status: { not: "EXITED" } },
            select: personSelect,
            orderBy: { firstName: "asc" },
          },
        },
      })
    : null;

  const teammates =
    me?.manager && me.reports.length === 0
      ? await db.employee.findMany({
          where: { managerId: me.manager.id, id: { not: me.id }, status: { not: "EXITED" } },
          select: personSelect,
          orderBy: { firstName: "asc" },
        })
      : [];

  const holidays = await db.holiday.findMany({
    where: {
      date: { gte: dbDate(today) },
      OR: [{ locationId: null }, ...(me ? [{ locationId: me.locationId }] : [])],
    },
    orderBy: { date: "asc" },
    take: 4,
    select: { id: true, name: true, date: true, isOptional: true },
  });

  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const [clock, balances, requests, sheet] = me
    ? await Promise.all([
        myToday(me.id),
        balancesFor(me.id, year),
        myLeaveRequests(me.id),
        myTimesheet(me.id, year, month),
      ])
    : [null, [], [], null];

  const tasks = me ? await myOpenTasks(me.id) : { count: 0, items: [] };
  const [announcements, payslips, reviewTasks] = await Promise.all([
    latestForHome(user, 3),
    me ? myPayslips(me.id) : [],
    me ? myReviewTasks(user) : [],
  ]);
  const approvals = can(actor, "leave.approve") ? await waitingOnMe(user) : null;
  const team =
    me && me.reports.length > 0 && scopeFor(actor, "attendance.read") === "team"
      ? summarizeDay((await teamToday(user, null)).rows)
      : null;
  const company = can(actor, "analytics.read") ? await companyPulse(user, today) : null;

  return {
    today,
    me,
    teammates,
    holidays,
    clock,
    balances: balances
      .filter((b) => PRIMARY_LEAVE.includes(b.code))
      .sort((a, b) => PRIMARY_LEAVE.indexOf(a.code) - PRIMARY_LEAVE.indexOf(b.code)),
    requests: requests
      .filter((r) => (r.status === "PENDING" || r.status === "APPROVED") && r.end >= today)
      .sort((a, b) => a.start.localeCompare(b.start))
      .slice(0, 3),
    month: sheet?.summary ?? null,
    tasks,
    announcements,
    payslip: payslips[0] ?? null,
    reviewsToWrite: reviewTasks.filter((t) => t.writable && t.status !== "SUBMITTED").length,
    approvals,
    team,
    company,
    moments: await moments(today, me?.id ?? null),
  };
}

/* ─── Who's in today ───────────────────────────────────────────────────── */

function summarizeDay(rows: TeamTodayRow[]) {
  const counts = { in: 0, late: 0, out: 0, leave: 0, away: 0, notYet: 0 };
  for (const r of rows) counts[r.state]++;
  return {
    total: rows.length,
    counts,
    /** The people worth a glance: late, not in yet, or away. */
    attention: rows
      .filter((r) => r.state === "late" || r.state === "notYet" || r.state === "leave")
      .slice(0, 6)
      .map((r) => ({
        id: r.id,
        name: r.name,
        avatarUrl: r.avatarUrl,
        state: r.state,
        lateByMinutes: r.lateByMinutes,
        leave: r.leave?.type ?? null,
      })),
  };
}

export type DaySummary = ReturnType<typeof summarizeDay>;

/* ─── Company pulse (HR and admins) ────────────────────────────────────── */

async function companyPulse(user: CurrentUser, today: ISODate) {
  const range = parseRange({}, today, await dataStart(today));
  const filters = { start: range.start, end: range.end, department: null };
  const monthAgo = dbDate(addDays(today, -30));
  const [people, hiring, joiners, onNotice, day] = await Promise.all([
    peopleReport(filters),
    hiringReport(filters),
    db.employee.count({ where: { status: { not: "EXITED" }, joinDate: { gte: monthAgo } } }),
    db.employee.count({ where: { status: "NOTICE" } }),
    teamToday(user, null),
  ]);
  return {
    headcount: people.attrition.closing,
    growth: people.attrition.closing - people.attrition.opening,
    series: people.series.map((p) => ({ label: p.label, headcount: p.headcount })),
    attrition: people.attrition.annualized,
    joiners,
    onNotice,
    openRoles: hiring.openRoles,
    openings: hiring.openings,
    day: summarizeDay(day.rows),
  };
}

/* ─── Moments ──────────────────────────────────────────────────────────── */

async function moments(today: ISODate, myId: string | null) {
  const people = await db.employee.findMany({
    where: { status: { not: "EXITED" } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      preferredName: true,
      avatarUrl: true,
      dateOfBirth: true,
      joinDate: true,
      designation: { select: { title: true } },
    },
  });
  const byId = new Map(people.map((p) => [p.id, p]));
  return upcomingMoments(
    people.map((p) => ({
      id: p.id,
      // Only the day and month ever leave the server; the year stays private.
      dateOfBirth: p.dateOfBirth ? isoFromDbDate(p.dateOfBirth) : null,
      joinDate: isoFromDbDate(p.joinDate),
    })),
    today,
  )
    .slice(0, 6)
    .map((m) => {
      const p = byId.get(m.personId)!;
      return {
        ...m,
        isMe: m.personId === myId,
        name: `${p.preferredName ?? p.firstName} ${p.lastName}`,
        title: p.designation.title,
        avatarUrl: p.avatarUrl,
      };
    });
}

export type HomeData = Awaited<ReturnType<typeof getHomeData>>;
export type HomePerson = NonNullable<HomeData["me"]>["reports"][number];
export type HomeMoment = HomeData["moments"][number];

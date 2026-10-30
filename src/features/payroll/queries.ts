import "server-only";

import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { isoFromDbDate, todayIn } from "@/lib/tz";
import { actorOf, type CurrentUser } from "@/server/session";

import { diffRuns, runnableMonth, type Line } from "./logic/compute";

const nameOf = (p: { firstName: string; lastName: string; preferredName?: string | null }) =>
  `${p.preferredName ?? p.firstName} ${p.lastName}`;

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
export const monthName = (month: number) => MONTHS[month - 1]!;
export const periodLabel = (year: number, month: number) => `${monthName(month)} ${year}`;

/* ─── Your pay ─────────────────────────────────────────────────────────── */

export async function myPayslips(employeeId: string) {
  const rows = await db.payslip.findMany({
    where: { employeeId, run: { status: "FINALIZED" } },
    orderBy: [{ run: { year: "desc" } }, { run: { month: "desc" } }],
    select: {
      id: true,
      netMinor: true,
      grossMinor: true,
      currency: true,
      run: { select: { year: true, month: true, finalizedAt: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    year: r.run.year,
    month: r.run.month,
    label: periodLabel(r.run.year, r.run.month),
    netMinor: r.netMinor,
    grossMinor: r.grossMinor,
    currency: r.currency,
  }));
}

export type PayslipSummary = Awaited<ReturnType<typeof myPayslips>>[number];

/** The structure in force today, as monthly components. */
export async function currentStructure(employeeId: string) {
  const s = await db.salaryStructure.findFirst({
    where: { employeeId, effectiveFrom: { lte: new Date(`${todayIn()}T00:00:00Z`) } },
    orderBy: { effectiveFrom: "desc" },
    select: {
      effectiveFrom: true,
      annualCtcMinor: true,
      currency: true,
      components: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!s) return null;
  return {
    effectiveFrom: isoFromDbDate(s.effectiveFrom),
    annualCtcMinor: Number(s.annualCtcMinor),
    currency: s.currency,
    components: s.components.map((c) => ({
      name: c.name,
      kind: c.kind,
      calc: c.calc,
      amountMinor: c.amountMinor,
      percentBps: c.percentBps,
      sortOrder: c.sortOrder,
    })),
  };
}

/** A payslip, if this person may see it: their own once final, or anyone's for payroll staff. */
export async function payslipDetail(user: CurrentUser, id: string) {
  const slip = await db.payslip.findUnique({
    where: { id },
    select: {
      id: true,
      employeeId: true,
      workingDays: true,
      paidDays: true,
      lopDays: true,
      grossMinor: true,
      deductionsMinor: true,
      netMinor: true,
      currency: true,
      lines: true,
      run: { select: { year: true, month: true, status: true, finalizedAt: true } },
      employee: {
        select: {
          firstName: true,
          lastName: true,
          preferredName: true,
          employeeCode: true,
          joinDate: true,
          designation: { select: { title: true } },
          department: { select: { name: true } },
          location: { select: { name: true } },
        },
      },
    },
  });
  if (!slip) return null;
  const staff = can(actorOf(user), "payroll.run");
  const own = slip.employeeId === user.employee?.id && slip.run.status === "FINALIZED";
  if (!staff && !own) return null;
  return {
    id: slip.id,
    year: slip.run.year,
    month: slip.run.month,
    label: periodLabel(slip.run.year, slip.run.month),
    status: slip.run.status,
    finalizedAt: slip.run.finalizedAt?.toISOString() ?? null,
    workingDays: slip.workingDays,
    paidDays: Number(slip.paidDays),
    lopDays: Number(slip.lopDays),
    grossMinor: slip.grossMinor,
    deductionsMinor: slip.deductionsMinor,
    netMinor: slip.netMinor,
    currency: slip.currency,
    lines: slip.lines as unknown as Line[],
    employee: {
      name: nameOf(slip.employee),
      code: slip.employee.employeeCode,
      title: slip.employee.designation.title,
      department: slip.employee.department.name,
      location: slip.employee.location.name,
      joinDate: isoFromDbDate(slip.employee.joinDate),
    },
  };
}

export type PayslipDetail = NonNullable<Awaited<ReturnType<typeof payslipDetail>>>;

/* ─── Payroll runs (people team) ───────────────────────────────────────── */

export async function runs() {
  const rows = await db.payrollRun.findMany({
    orderBy: [{ year: "desc" }, { month: "desc" }],
    select: {
      id: true,
      year: true,
      month: true,
      status: true,
      finalizedAt: true,
      _count: { select: { payslips: true } },
    },
  });
  const totals = await db.payslip.groupBy({
    by: ["runId"],
    _sum: { grossMinor: true, netMinor: true },
  });
  const sum = new Map(totals.map((t) => [t.runId, t._sum]));
  const today = todayIn();
  const taken = new Set(rows.map((r) => `${r.year}-${r.month}`));
  // The months a person could start now: the most recent few that are ready and have no run.
  const [y, m] = today.split("-").map(Number) as [number, number];
  const options: { year: number; month: number; label: string }[] = [];
  for (let i = 0; i < 4; i++) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    if (!taken.has(`${year}-${month}`) && runnableMonth(year, month, today))
      options.push({ year, month, label: periodLabel(year, month) });
  }
  return {
    runs: rows.map((r) => ({
      id: r.id,
      year: r.year,
      month: r.month,
      label: periodLabel(r.year, r.month),
      status: r.status,
      people: r._count.payslips,
      grossMinor: sum.get(r.id)?.grossMinor ?? 0,
      netMinor: sum.get(r.id)?.netMinor ?? 0,
      finalizedAt: r.finalizedAt?.toISOString() ?? null,
    })),
    options,
  };
}

export async function runDetail(runId: string) {
  const run = await db.payrollRun.findUnique({
    where: { id: runId },
    select: {
      id: true,
      year: true,
      month: true,
      status: true,
      createdById: true,
      reviewedById: true,
      finalizedAt: true,
      createdAt: true,
      payslips: {
        select: {
          id: true,
          employeeId: true,
          workingDays: true,
          paidDays: true,
          lopDays: true,
          grossMinor: true,
          deductionsMinor: true,
          netMinor: true,
          employee: {
            select: {
              firstName: true,
              lastName: true,
              preferredName: true,
              avatarUrl: true,
              employeeCode: true,
              department: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  if (!run) return null;
  const prevYear = run.month === 1 ? run.year - 1 : run.year;
  const prevMonth = run.month === 1 ? 12 : run.month - 1;
  const previous = await db.payrollRun.findUnique({
    where: { year_month: { year: prevYear, month: prevMonth } },
    select: {
      id: true,
      payslips: { select: { employeeId: true, grossMinor: true, netMinor: true } },
    },
  });
  const people = new Map(run.payslips.map((p) => [p.employeeId, p.employee]));
  const prevPeople = previous
    ? await db.employee.findMany({
        where: { id: { in: previous.payslips.map((p) => p.employeeId) } },
        select: { id: true, firstName: true, lastName: true, preferredName: true },
      })
    : [];
  const nameBy = new Map<string, string>([
    ...[...people].map(([id, e]) => [id, nameOf(e)] as [string, string]),
    ...prevPeople.map((e) => [e.id, nameOf(e)] as [string, string]),
  ]);
  const diff = diffRuns(previous?.payslips ?? [], run.payslips);
  const lopPeople = run.payslips.filter((p) => Number(p.lopDays) > 0).length;
  return {
    id: run.id,
    year: run.year,
    month: run.month,
    label: periodLabel(run.year, run.month),
    status: run.status,
    createdById: run.createdById,
    finalizedAt: run.finalizedAt?.toISOString() ?? null,
    hasPrevious: !!previous,
    previousLabel: periodLabel(prevYear, prevMonth),
    lopPeople,
    totals: diff.totals,
    diff: {
      joined: diff.joined.map((id) => ({ id, name: nameBy.get(id) ?? "Someone" })),
      left: diff.left.map((id) => ({ id, name: nameBy.get(id) ?? "Someone" })),
      changed: diff.changed
        .slice(0, 12)
        .map((c) => ({ ...c, name: nameBy.get(c.employeeId) ?? "Someone" })),
      changedCount: diff.changed.length,
      flaggedCount: diff.changed.filter((c) => c.flagged).length,
    },
    payslips: run.payslips
      .map((p) => ({
        id: p.id,
        employeeId: p.employeeId,
        name: nameOf(p.employee),
        code: p.employee.employeeCode,
        department: p.employee.department.name,
        avatarUrl: p.employee.avatarUrl,
        workingDays: p.workingDays,
        paidDays: Number(p.paidDays),
        lopDays: Number(p.lopDays),
        grossMinor: p.grossMinor,
        deductionsMinor: p.deductionsMinor,
        netMinor: p.netMinor,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export type RunDetail = NonNullable<Awaited<ReturnType<typeof runDetail>>>;

/** Everyone with their current structure, for salary revisions. */
export async function structures() {
  const today = new Date(`${todayIn()}T00:00:00Z`);
  const rows = await db.employee.findMany({
    where: { status: { not: "EXITED" } },
    orderBy: { firstName: "asc" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      preferredName: true,
      avatarUrl: true,
      designation: { select: { title: true } },
      department: { select: { name: true } },
      salaryStructures: {
        where: { effectiveFrom: { lte: today } },
        orderBy: { effectiveFrom: "desc" },
        take: 1,
        select: { annualCtcMinor: true, effectiveFrom: true },
      },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    name: nameOf(r),
    avatarUrl: r.avatarUrl,
    title: r.designation.title,
    department: r.department.name,
    annualCtcMinor: r.salaryStructures[0] ? Number(r.salaryStructures[0].annualCtcMinor) : null,
    effectiveFrom: r.salaryStructures[0]
      ? isoFromDbDate(r.salaryStructures[0].effectiveFrom)
      : null,
  }));
}

export type StructureRow = Awaited<ReturnType<typeof structures>>[number];

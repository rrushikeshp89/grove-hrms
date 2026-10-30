/**
 * Simulated payroll history: a salary structure for everyone (some with a
 * recent raise), and a finalized run for each fully covered month before
 * the most recent one that can be run. That month is left open so the demo
 * has a run to prepare, review and finalize.
 */
import { buildPayslips } from "../../src/features/payroll/generate";
import { runnableMonth, standardStructure } from "../../src/features/payroll/logic/compute";
import type { PrismaClient } from "../../src/generated/prisma/client";
import { addDays, dbDate, instantAt, isoFromDbDate, type ISODate } from "../../src/lib/tz";
import type { Rng } from "./rng";

/** Yearly CTC in rupees by seniority level, with a spread inside each band. */
const BANDS: Record<number, [number, number]> = {
  1: [300_000, 420_000],
  2: [600_000, 950_000],
  3: [950_000, 1_600_000],
  4: [1_600_000, 2_400_000],
  5: [2_400_000, 3_600_000],
  6: [3_600_000, 5_500_000],
  7: [6_000_000, 9_000_000],
  8: [9_000_000, 14_000_000],
};

const roundTo = (n: number, step: number) => Math.round(n / step) * step;

export async function seedPayroll(
  db: PrismaClient,
  rng: Rng,
  opts: { today: ISODate; preparerId: string; finalizerId: string },
) {
  const people = await db.employee.findMany({
    select: {
      id: true,
      joinDate: true,
      employmentType: true,
      designation: { select: { level: true } },
    },
  });

  const [ty, tm] = opts.today.split("-").map(Number) as [number, number];
  const latestRunnable = runnableMonth(ty, tm, opts.today)
    ? { year: ty, month: tm }
    : { year: tm === 1 ? ty - 1 : ty, month: tm === 1 ? 12 : tm - 1 };

  const raiseDate = `${latestRunnable.year - 1}-04-01` as ISODate;
  let structures = 0;
  for (const p of people) {
    const band = BANDS[Math.min(8, Math.max(1, p.designation.level))]!;
    let ctc = roundTo(band[0] + rng.next() * (band[1] - band[0]), 10_000);
    if (p.employmentType === "INTERN") ctc = roundTo(240_000 + rng.next() * 120_000, 12_000);
    if (p.employmentType === "CONTRACT") ctc = roundTo(ctc * 1.15, 10_000);
    const joined = isoFromDbDate(p.joinDate);
    // Anyone who joined well before the last review got a raise on 1 April.
    const raised = joined < addDays(raiseDate, -90) && rng.chance(0.7);
    const history: { from: ISODate; ctc: number }[] = [];
    if (raised) {
      const before = roundTo(ctc / (1 + 0.07 + rng.next() * 0.08), 10_000);
      history.push({ from: joined, ctc: before }, { from: raiseDate, ctc });
    } else {
      history.push({ from: joined, ctc });
    }
    for (const h of history) {
      await db.salaryStructure.create({
        data: {
          employeeId: p.id,
          effectiveFrom: dbDate(h.from),
          annualCtcMinor: BigInt(h.ctc * 100),
          components: {
            create: standardStructure(h.ctc * 100).map((c) => ({
              name: c.name,
              kind: c.kind,
              calc: c.calc,
              amountMinor: c.amountMinor,
              percentBps: c.percentBps,
              sortOrder: c.sortOrder,
            })),
          },
        },
      });
      structures++;
    }
  }

  // Attendance history starts partway through a month; only fully covered months get a run.
  const first = await db.attendanceRecord.findFirst({
    orderBy: { date: "asc" },
    select: { date: true },
  });
  const covered = first ? isoFromDbDate(first.date) : opts.today;
  let runs = 0;
  let payslips = 0;
  for (let back = 12; back >= 1; back--) {
    const d = new Date(Date.UTC(latestRunnable.year, latestRunnable.month - 1 - back, 1));
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    if (`${year}-${String(month).padStart(2, "0")}-01` < covered) continue;
    const slips = await buildPayslips(db, year, month);
    if (slips.length === 0) continue;
    // Final on the 3rd of the following month.
    const finalDay = new Date(Date.UTC(year, month, 3)).toISOString().slice(0, 10) as ISODate;
    await db.payrollRun.create({
      data: {
        year,
        month,
        status: "FINALIZED",
        createdById: opts.preparerId,
        reviewedById: opts.finalizerId,
        finalizedAt: instantAt(finalDay, "17:30"),
        payslips: { create: slips },
      },
    });
    runs++;
    payslips += slips.length;
  }
  return { structures, runs, payslips };
}
